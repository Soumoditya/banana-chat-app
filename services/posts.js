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

// Create a post
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
        commentCount: 0,
        visibility: postData.visibility || 'public',
        createdAt: serverTimestamp(),
        archived: false,
        deleted: false,
    };

    await setDoc(doc(db, 'posts', postId), post);
    return { id: postId, ...post };
};

// Get feed posts
export const getFeedPosts = async (filter = 'all', currentUser = null, lastPost = null, pageSize = 20) => {
    let q;

    switch (filter) {
        case 'latest':
            q = query(
                collection(db, 'posts'),
                where('deleted', '==', false),
                where('archived', '==', false),
                where('visibility', '==', 'public'),
                orderBy('createdAt', 'desc'),
                limit(pageSize)
            );
            break;
        case 'friends':
            if (!currentUser?.friends?.length) return [];
            const friendIds = currentUser.friends.slice(0, 10); // Firestore 'in' limit
            q = query(
                collection(db, 'posts'),
                where('authorId', 'in', friendIds),
                where('deleted', '==', false),
                where('archived', '==', false),
                orderBy('createdAt', 'desc'),
                limit(pageSize)
            );
            break;
        case 'following':
            if (!currentUser?.following?.length) return [];
            const followingIds = currentUser.following.slice(0, 10);
            q = query(
                collection(db, 'posts'),
                where('authorId', 'in', followingIds),
                where('deleted', '==', false),
                where('archived', '==', false),
                orderBy('createdAt', 'desc'),
                limit(pageSize)
            );
            break;
        default: // 'all'
            q = query(
                collection(db, 'posts'),
                where('deleted', '==', false),
                where('archived', '==', false),
                where('visibility', '==', 'public'),
                orderBy('createdAt', 'desc'),
                limit(pageSize)
            );
    }

    if (lastPost) {
        q = query(q, startAfter(lastPost));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Get single post
export const getPost = async (postId) => {
    const postDoc = await getDoc(doc(db, 'posts', postId));
    if (postDoc.exists()) {
        return { id: postDoc.id, ...postDoc.data() };
    }
    return null;
};

// Get user's posts
export const getUserPosts = async (uid, includeArchived = false) => {
    let q = query(
        collection(db, 'posts'),
        where('authorId', '==', uid),
        where('deleted', '==', false),
        orderBy('createdAt', 'desc'),
        limit(50)
    );

    const snapshot = await getDocs(q);
    let posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!includeArchived) {
        posts = posts.filter(p => !p.archived);
    }

    return posts;
};

// Upvote post
export const upvotePost = async (postId, uid) => {
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    if (!postDoc.exists()) return;

    const data = postDoc.data();
    const updates = {};

    if (data.upvotedBy?.includes(uid)) {
        // Remove upvote
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

// Add reaction to post
export const addPostReaction = async (postId, uid, emoji) => {
    await updateDoc(doc(db, 'posts', postId), {
        [`reactions.${emoji}`]: increment(1),
        [`reactedBy.${uid}`]: emoji,
    });
};

// Archive / Unarchive post
export const archivePost = async (postId) => {
    await updateDoc(doc(db, 'posts', postId), { archived: true });
};

export const unarchivePost = async (postId) => {
    await updateDoc(doc(db, 'posts', postId), { archived: false });
};

// Soft delete post (moves to recently deleted)
export const softDeletePost = async (postId) => {
    await updateDoc(doc(db, 'posts', postId), {
        deleted: true,
        deletedAt: serverTimestamp()
    });
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
    const q = query(
        collection(db, 'posts'),
        where('authorId', '==', uid),
        where('deleted', '==', true),
        orderBy('deletedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Get archived posts
export const getArchivedPosts = async (uid) => {
    const q = query(
        collection(db, 'posts'),
        where('authorId', '==', uid),
        where('archived', '==', true),
        where('deleted', '==', false),
        orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
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

    // Search by content (basic approach - for full-text search you'd need Algolia)
    const q = query(
        collection(db, 'posts'),
        where('deleted', '==', false),
        where('visibility', '==', 'public'),
        orderBy('createdAt', 'desc'),
        limit(50)
    );

    const snapshot = await getDocs(q);
    const posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Client-side filter
    const term = searchTerm.toLowerCase();
    return posts.filter(p =>
        p.content?.toLowerCase().includes(term) ||
        p.tags?.some(t => t.toLowerCase().includes(term))
    );
};

// COMMENTS
export const addComment = async (postId, commentData) => {
    const commentId = generateId();
    const comment = {
        authorId: commentData.authorId,
        text: commentData.text,
        parentCommentId: commentData.parentCommentId || null,
        upvotes: 0,
        downvotes: 0,
        upvotedBy: [],
        downvotedBy: [],
        reactions: {},
        createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'posts', postId, 'comments', commentId), comment);
    await updateDoc(doc(db, 'posts', postId), {
        commentCount: increment(1),
    });

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

// Save / Unsave post
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
export const getSpotlightPosts = async (uid) => {
    const q = query(
        collection(db, 'posts'),
        where('authorId', '==', uid),
        where('isSpotlight', '==', true),
        orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Get all public posts (for explore grid)
export const getExplorePosts = async (pageSize = 30) => {
    const q = query(
        collection(db, 'posts'),
        where('deleted', '==', false),
        where('archived', '==', false),
        where('visibility', '==', 'public'),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};
