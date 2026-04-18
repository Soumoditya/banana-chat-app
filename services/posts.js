import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    onSnapshot,
    serverTimestamp,
    increment,
    arrayUnion,
    arrayRemove,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { generateId } from '../utils/helpers';
import { getResharesByUser } from './reshares';
import { createNotification } from './notifications';

// ─── Post CRUD ───
export const createPost = async (postData) => {
    const postId = generateId();
    const post = {
        authorId: postData.authorId,
        type: postData.type || 'text',
        content: postData.content || '',
        media: postData.media || [],
        poll: postData.poll || null,
        tags: postData.tags || [],
        upvotes: 0,
        downvotes: 0,
        upvotedBy: [],
        downvotedBy: [],
        reactions: {},
        savedBy: [],
        commentCount: 0,
        visibility: postData.visibility || 'public',
        createdAt: serverTimestamp(),
        archived: false,
        deleted: false,
    };

    await setDoc(doc(db, 'posts', postId), post);
    return { id: postId, ...post };
};

// ─── Feed Queries ───
// Uses simple single-field queries and filters client-side to avoid
// needing Firestore composite indexes (which require manual creation).
export const getFeedPosts = async (filter = 'all', currentUser = null, lastPost = null, pageSize = 20) => {
    let reshares = [];

    try {
        // Use the simplest possible query — just order by createdAt
        // Then filter client-side to avoid needing composite indexes
        let q;
        
        if (filter === 'friends' && currentUser?.friends?.length) {
            const friendIds = currentUser.friends.slice(0, 10);
            q = query(
                collection(db, 'posts'),
                where('authorId', 'in', friendIds),
                limit(pageSize * 3)
            );
            for (const fid of friendIds) {
                try { const rs = await getResharesByUser(fid, pageSize); reshares = [...reshares, ...rs]; } catch(e) {}
            }
        } else if (filter === 'following' && currentUser?.following?.length) {
            const followingIds = currentUser.following.slice(0, 10);
            q = query(
                collection(db, 'posts'),
                where('authorId', 'in', followingIds),
                limit(pageSize * 3)
            );
            for (const fid of followingIds) {
                try { const rs = await getResharesByUser(fid, pageSize); reshares = [...reshares, ...rs]; } catch(e) {}
            }
        } else {
            // Default: all public posts — simple query, no compound index needed
            q = query(
                collection(db, 'posts'),
                orderBy('createdAt', 'desc'),
                limit(pageSize * 3) // fetch more since we filter client-side
            );
        }

        if (lastPost && !lastPost.isReshare) {
            q = query(q, startAfter(lastPost));
        }

        const snapshot = await getDocs(q);
        let posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Client-side filtering (avoids needing composite indexes)
        posts = posts.filter(p => {
            if (p.deleted === true) return false;
            if (p.archived === true) return false;
            // For non-friends/following filters, only show public posts
            if (filter !== 'friends' && filter !== 'following') {
                if (p.visibility && p.visibility !== 'public') return false;
            }
            return true;
        });

        // Trim to requested page size
        // Sort client-side (since we can't use orderBy with where on different fields)
        posts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        posts = posts.slice(0, pageSize);

    // Format reshares to match post schema wrapper for UI rendering
    const formattedReshares = reshares.map(r => ({
        ...r.post,
        isReshare: true,
        resharerId: r.userId,
        // Override sort timestamp with the reshare's timestamp
        createdAt: r.createdAt 
    }));

    // Interleave and Sort
    const interleaved = [...posts, ...formattedReshares];
    
    interleaved.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
    });

    return interleaved.slice(0, pageSize);
    
    } catch (err) {
        console.error('getFeedPosts error:', err);
        // Return empty array instead of crashing — user sees "No posts" with pull-to-refresh
        return [];
    }
};

// Get single post
export const getPost = async (postId) => {
    const postDoc = await getDoc(doc(db, 'posts', postId));
    if (postDoc.exists()) {
        return { id: postDoc.id, ...postDoc.data() };
    }
    return null;
};

// Same single-field query strategy — filter archived/deleted client-side.
export const getUserPosts = async (uid, includeArchived = false) => {
    try {
        // ONLY where — NO orderBy (different field = needs composite index)
        const q = query(
            collection(db, 'posts'),
            where('authorId', '==', uid),
            limit(100)
        );

        const snapshot = await getDocs(q);
        let posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Client-side filtering
        posts = posts.filter(p => p.deleted !== true);
        if (!includeArchived) {
            posts = posts.filter(p => p.archived !== true);
        }

        // Client-side sort (newest first)
        posts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        return posts;
    } catch (err) {
        console.error('getUserPosts error:', err);
        return [];
    }
};

// ─── Voting ───
// Toggle semantics: calling upvote on an already-upvoted post removes it.
// Mutually exclusive with downvote — can't have both simultaneously.
export const upvotePost = async (postId, uid) => {
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    if (!postDoc.exists()) return;

    const data = postDoc.data();
    const updates = {};
    const isNewUpvote = !data.upvotedBy?.includes(uid);

    if (!isNewUpvote) {
        // Remove upvote (toggle off)
        updates.upvotes = increment(-1);
        updates.upvotedBy = arrayRemove(uid);
    } else {
        // Add upvote
        updates.upvotes = increment(1);
        updates.upvotedBy = arrayUnion(uid);
        // Remove downvote if exists
        if (data.downvotedBy?.includes(uid)) {
            updates.downvotes = increment(-1);
            updates.downvotedBy = arrayRemove(uid);
        }
    }

    await updateDoc(postRef, updates);

    // Notify the post author (only on new upvotes, not on removal)
    if (isNewUpvote) {
        createNotification(data.authorId, uid, 'like', postId);
    }
};

// Downvote post
export const downvotePost = async (postId, uid) => {
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    if (!postDoc.exists()) return;

    const data = postDoc.data();
    const updates = {};

    if (data.downvotedBy?.includes(uid)) {
        // Remove downvote
        updates.downvotes = increment(-1);
        updates.downvotedBy = arrayRemove(uid);
    } else {
        // Add downvote
        updates.downvotes = increment(1);
        updates.downvotedBy = arrayUnion(uid);
        // Remove upvote if exists
        if (data.upvotedBy?.includes(uid)) {
            updates.upvotes = increment(-1);
            updates.upvotedBy = arrayRemove(uid);
        }
    }

    await updateDoc(postRef, updates);
};

// Add reaction to post (idempotent — removes old reaction before applying new one)
export const addPostReaction = async (postId, uid, emoji) => {
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    if (!postDoc.exists()) return;
    const data = postDoc.data();
    const updates = {};
    const prevEmoji = data.reactedBy?.[uid];
    if (prevEmoji && prevEmoji !== emoji) {
        // Remove old reaction count
        updates[`reactions.${prevEmoji}`] = increment(-1);
    }
    if (!prevEmoji || prevEmoji !== emoji) {
        updates[`reactions.${emoji}`] = increment(1);
    }
    updates[`reactedBy.${uid}`] = emoji;
    await updateDoc(postRef, updates);
};

// ─── Archive & Delete ───
export const archivePost = async (postId) => {
    await updateDoc(doc(db, 'posts', postId), { archived: true });
};

export const unarchivePost = async (postId) => {
    await updateDoc(doc(db, 'posts', postId), { archived: false });
};

// Soft-deletes post: flags it in-place AND copies to `recently_deleted`
// for 30-day recovery. Dual storage lets the trash UI work independently.
export const softDeletePost = async (postId) => {
    // Get the post data first
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    
    // Mark as deleted
    await updateDoc(postRef, {
        deleted: true,
        deletedAt: serverTimestamp()
    });

    // Also copy to recently_deleted collection for 30-day recovery
    if (postSnap.exists()) {
        const postData = postSnap.data();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        
        await setDoc(doc(db, 'recently_deleted', `post_${postId}`), {
            ...postData,
            originalId: postId,
            itemType: 'post',
            deletedAt: new Date(),
            expiresAt: expiresAt,
            // For display in recently-deleted UI
            media: typeof postData.media?.[0] === 'string' ? postData.media[0] : postData.media?.[0]?.uri || null,
            content: postData.content || '',
        });
    }
};

// Permanently delete post
export const permanentlyDeletePost = async (postId) => {
    await deleteDoc(doc(db, 'posts', postId));
};

// Restore deleted post
export const restorePost = async (postId) => {
    await updateDoc(doc(db, 'posts', postId), {
        deleted: false,
        deletedAt: null
    });
};

// Get deleted posts
export const getDeletedPosts = async (uid) => {
    try {
        const q = query(
            collection(db, 'posts'),
            where('authorId', '==', uid),
            limit(100)
        );
        const snapshot = await getDocs(q);
        let posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        posts = posts.filter(p => p.deleted === true);
        posts.sort((a, b) => (b.deletedAt?.seconds || 0) - (a.deletedAt?.seconds || 0));
        return posts;
    } catch (err) {
        console.error('getDeletedPosts error:', err);
        return [];
    }
};

// Get archived posts
export const getArchivedPosts = async (uid) => {
    try {
        const q = query(
            collection(db, 'posts'),
            where('authorId', '==', uid),
            limit(100)
        );
        const snapshot = await getDocs(q);
        let posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        posts = posts.filter(p => p.archived === true && p.deleted !== true);
        posts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        return posts;
    } catch (err) {
        console.error('getArchivedPosts error:', err);
        return [];
    }
};

// Vote on poll
export const votePoll = async (postId, optionIndex, uid) => {
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    if (!postDoc.exists()) return;

    const data = postDoc.data();
    if (!data.poll) return;

    const poll = { ...data.poll };

    // Check if user already voted
    if (poll.votedBy?.[uid] !== undefined) {
        // Remove old vote
        const oldIndex = poll.votedBy[uid];
        poll.options[oldIndex].votes = (poll.options[oldIndex].votes || 1) - 1;
    }

    // Add new vote
    poll.options[optionIndex].votes = (poll.options[optionIndex].votes || 0) + 1;
    if (!poll.votedBy) poll.votedBy = {};
    poll.votedBy[uid] = optionIndex;

    await updateDoc(postRef, { poll });
};

// Search posts
export const searchPosts = async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) return [];

    try {
        const q = query(
            collection(db, 'posts'),
            orderBy('createdAt', 'desc'),
            limit(100)
        );

        const snapshot = await getDocs(q);
        const allPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const posts = allPosts.filter(p => p.deleted !== true && (!p.visibility || p.visibility === 'public'));

        const term = searchTerm.toLowerCase();
        return posts.filter(p =>
            p.content?.toLowerCase().includes(term) ||
            p.tags?.some(t => t.toLowerCase().includes(term))
        );
    } catch (err) {
        console.warn('searchPosts error:', err.message);
        return [];
    }
};

// ─── Comments ───
export const addComment = async (postId, commentData) => {
    const commentId = generateId();
    const comment = {
        authorId: commentData.authorId,
        text: commentData.text || '',
        mediaUrl: commentData.mediaUrl || null,
        mediaType: commentData.mediaType || null,
        duration: commentData.duration || null,
        parentCommentId: commentData.parentCommentId || null,
        upvotes: 0,
        downvotes: 0,
        upvotedBy: [],
        downvotedBy: [],
        reactions: {},
        deleted: false,
        createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'posts', postId, 'comments', commentId), comment);
    await updateDoc(doc(db, 'posts', postId), {
        commentCount: increment(1),
    });

    // Notify post author (skip self-comments)
    try {
        const postDoc = await getDoc(doc(db, 'posts', postId));
        if (postDoc.exists()) {
            const postAuthorId = postDoc.data().authorId;
            createNotification(postAuthorId, commentData.authorId, 'comment', postId);
        }
    } catch (e) { /* notification failure is non-fatal */ }

    return { id: commentId, ...comment };
};

export const getComments = async (postId, filter = 'all') => {
    let q;

    switch (filter) {
        case 'recent':
            q = query(
                collection(db, 'posts', postId, 'comments'),
                orderBy('createdAt', 'desc'),
                limit(50)
            );
            break;
        case 'top':
            q = query(
                collection(db, 'posts', postId, 'comments'),
                orderBy('upvotes', 'desc'),
                limit(50)
            );
            break;
        default:
            q = query(
                collection(db, 'posts', postId, 'comments'),
                orderBy('createdAt', 'desc'),
                limit(50)
            );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const upvoteComment = async (postId, commentId, uid) => {
    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    const commentDoc = await getDoc(commentRef);
    if (!commentDoc.exists()) return;

    const data = commentDoc.data();
    const updates = {};

    if (data.upvotedBy?.includes(uid)) {
        updates.upvotes = increment(-1);
        updates.upvotedBy = arrayRemove(uid);
    } else {
        updates.upvotes = increment(1);
        updates.upvotedBy = arrayUnion(uid);
        if (data.downvotedBy?.includes(uid)) {
            updates.downvotes = increment(-1);
            updates.downvotedBy = arrayRemove(uid);
        }
    }

    await updateDoc(commentRef, updates);
};

export const downvoteComment = async (postId, commentId, uid) => {
    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    const commentDoc = await getDoc(commentRef);
    if (!commentDoc.exists()) return;

    const data = commentDoc.data();
    const updates = {};

    if (data.downvotedBy?.includes(uid)) {
        updates.downvotes = increment(-1);
        updates.downvotedBy = arrayRemove(uid);
    } else {
        updates.downvotes = increment(1);
        updates.downvotedBy = arrayUnion(uid);
        if (data.upvotedBy?.includes(uid)) {
            updates.upvotes = increment(-1);
            updates.upvotedBy = arrayRemove(uid);
        }
    }

    await updateDoc(commentRef, updates);
};

// ─── Bookmarks ───
// Saved posts live on the user doc (not the post) so users can
// bookmark without write access to someone else's post.
export const savePost = async (postId, uid) => {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        savedPosts: arrayUnion(postId),
    });
};

export const unsavePost = async (postId, uid) => {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        savedPosts: arrayRemove(postId),
    });
};

// Get saved posts
export const getSavedPosts = async (postIds) => {
    if (!postIds || postIds.length === 0) return [];
    const posts = [];
    for (const postId of postIds) {
        const postDoc = await getDoc(doc(db, 'posts', postId));
        if (postDoc.exists()) {
            posts.push({ id: postDoc.id, ...postDoc.data() });
        }
    }
    return posts;
};

// Get users who upvoted a post
export const getUpvoters = async (postId) => {
    const postDoc = await getDoc(doc(db, 'posts', postId));
    if (!postDoc.exists()) return [];
    return postDoc.data().upvotedBy || [];
};

// Increment share count
export const incrementShareCount = async (postId) => {
    await updateDoc(doc(db, 'posts', postId), {
        shareCount: increment(1),
    });
};

// Toggle spotlight on a post
export const toggleSpotlight = async (postId, uid) => {
    const postDoc = await getDoc(doc(db, 'posts', postId));
    if (!postDoc.exists()) return;
    const data = postDoc.data();
    if (data.authorId !== uid) return;
    await updateDoc(doc(db, 'posts', postId), {
        isSpotlight: !data.isSpotlight,
    });
};

// Get spotlight posts for a user
// Uses single-field where to avoid composite index, filters client-side
export const getSpotlightPosts = async (uid) => {
    try {
        const q = query(
            collection(db, 'posts'),
            where('authorId', '==', uid),
            limit(100)
        );
        const snapshot = await getDocs(q);
        let posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        posts = posts.filter(p => p.isSpotlight === true && p.deleted !== true);
        posts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        return posts;
    } catch (err) {
        console.warn('getSpotlightPosts error:', err.message);
        return [];
    }
};

// ─── Explore (Hotness Ranking) ───
// Reddit-style hot ranking: Score = Engagement / Age^1.5
// Fetches a wide pool then ranks client-side for zero-index setup.
export const getExplorePosts = async (pageSize = 30) => {
    try {
    // 1. Fetch a wider pool of recent posts — simple query
    const q = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        limit(200)
    );
    const snapshot = await getDocs(q);
    let posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    // Client-side filter
    posts = posts.filter(p => p.deleted !== true && (!p.visibility || p.visibility === 'public'));

    // 2. Score them using a Reddit-style Hotness Algorithm
    const now = Date.now();
    const scoredPosts = posts.map(post => {
        const timeElapsed = now - (post.createdAt?.seconds ? post.createdAt.seconds * 1000 : now - 86400000);
        const hoursElapsed = Math.max(timeElapsed / (1000 * 60 * 60), 1);
        
        // Engagement metrics
        const netUpvotes = (post.upvotes || 0) - (post.downvotes || 0);
        const commentCount = post.commentCount || 0;
        const shareCount = post.shareCount || 0;
        
        const baseScore = Math.max(netUpvotes + (commentCount * 2) + (shareCount * 3), 0);
        
        // Gravity Equation: Score / (Age in hours)^1.5
        const hotnessScore = baseScore / Math.pow(hoursElapsed + 2, 1.5);

        return { ...post, hotnessScore };
    });

    // 3. Sort by hotness and return requested pageSize
    scoredPosts.sort((a, b) => b.hotnessScore - a.hotnessScore);
    return scoredPosts.slice(0, pageSize);
    } catch (err) {
        console.error('getExplorePosts error:', err);
        return [];
    }
};
