import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    deleteDoc,
    serverTimestamp,
    updateDoc,
    arrayUnion,
    arrayRemove,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { generateId } from '../utils/helpers';
import { MAX_STORY_DURATION, TRASH_RETENTION } from '../utils/constants';

// ─── CREATE ──────────────────────────────────────────
export const createStory = async (storyData) => {
    const storyId = generateId();
    const story = {
        authorId: storyData.authorId,
        media: storyData.media || '',
        mediaType: storyData.mediaType || 'image',
        text: storyData.text || '',
        type: storyData.type || 'public', // public, friends, closeFriends
        hiddenFrom: storyData.hiddenFrom || [], // UIDs who can't see this
        viewers: [],
        expiresAt: new Date(Date.now() + MAX_STORY_DURATION),
        createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'stories', storyId), story);
    return { id: storyId, ...story };
};

// ─── FEED ────────────────────────────────────────────
export const getStories = async (currentUser) => {
    if (!currentUser) return [];

    const publicQ = query(
        collection(db, 'stories'),
        where('type', '==', 'public'),
        where('expiresAt', '>', new Date()),
        orderBy('expiresAt'),
        orderBy('createdAt', 'desc')
    );

    const publicSnapshot = await getDocs(publicQ);
    let stories = publicSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Friends + close friends stories
    if (currentUser.friends?.length > 0) {
        const friendIds = currentUser.friends.slice(0, 10);
        const friendsQ = query(
            collection(db, 'stories'),
            where('authorId', 'in', friendIds),
            where('type', 'in', ['friends', 'closeFriends']),
            where('expiresAt', '>', new Date())
        );

        try {
            const friendsSnapshot = await getDocs(friendsQ);
            const friendStories = friendsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            const filtered = friendStories.filter(s => {
                if (s.type === 'closeFriends') {
                    return currentUser.closeFriends?.includes(s.authorId);
                }
                return true;
            });

            stories = [...stories, ...filtered];
        } catch (err) {
            console.error('Error fetching friend stories:', err);
        }
    }

    // Filter out stories hidden from current user
    const uid = currentUser.uid || currentUser.id;
    stories = stories.filter(s => !(s.hiddenFrom || []).includes(uid));

    // Group by author
    const grouped = {};
    stories.forEach(story => {
        if (!grouped[story.authorId]) grouped[story.authorId] = [];
        grouped[story.authorId].push(story);
    });

    return grouped;
};

// ─── USER STORIES ────────────────────────────────────
export const getUserStories = async (uid) => {
    const q = query(
        collection(db, 'stories'),
        where('authorId', '==', uid),
        where('expiresAt', '>', new Date()),
        orderBy('expiresAt'),
        orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

// ─── VIEW ────────────────────────────────────────────
export const viewStory = async (storyId, uid) => {
    await updateDoc(doc(db, 'stories', storyId), {
        viewers: arrayUnion(uid),
    });
};

// ─── SIMPLE DELETE (hard) ────────────────────────────
export const deleteStory = async (storyId) => {
    await deleteDoc(doc(db, 'stories', storyId));
};

// ─── ARCHIVE ─────────────────────────────────────────

// Archive a single story (moves to stories_archive collection)
export const archiveStory = async (storyId) => {
    const storyRef = doc(db, 'stories', storyId);
    const snap = await getDoc(storyRef);
    if (!snap.exists()) return;

    const data = snap.data();
    await setDoc(doc(db, 'stories_archive', storyId), {
        ...data,
        archivedAt: serverTimestamp(),
    });
    await deleteDoc(storyRef);
};

// Auto-archive all expired stories (call periodically)
export const cleanupExpiredStories = async () => {
    const q = query(
        collection(db, 'stories'),
        where('expiresAt', '<', new Date())
    );

    const snapshot = await getDocs(q);
    for (const d of snapshot.docs) {
        const data = d.data();
        await setDoc(doc(db, 'stories_archive', d.id), {
            ...data,
            archivedAt: serverTimestamp(),
        });
        await deleteDoc(d.ref);
    }
};

// Get archived stories for a user, optionally filtered by month/year
export const getArchivedStories = async (uid, month = null, year = null) => {
    let q = query(
        collection(db, 'stories_archive'),
        where('authorId', '==', uid),
        orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    let stories = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filter by month/year if specified
    if (month !== null && year !== null) {
        stories = stories.filter(s => {
            const ts = s.createdAt?.seconds ? new Date(s.createdAt.seconds * 1000) : null;
            if (!ts) return false;
            return ts.getMonth() === month && ts.getFullYear() === year;
        });
    }

    return stories;
};

// Get which days have archived stories (for calendar dots)
export const getArchiveDays = async (uid, month, year) => {
    const stories = await getArchivedStories(uid, month, year);
    const days = new Set();
    stories.forEach(s => {
        const ts = s.createdAt?.seconds ? new Date(s.createdAt.seconds * 1000) : null;
        if (ts) days.add(ts.getDate());
    });
    return Array.from(days);
};

// ─── SOFT DELETE / TRASH ─────────────────────────────

// Move story or post to recently_deleted
export const softDelete = async (itemId, itemType, itemData) => {
    await setDoc(doc(db, 'recently_deleted', itemId), {
        ...itemData,
        itemType, // 'story', 'post'
        deletedAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + TRASH_RETENTION),
        originalId: itemId,
    });

    // Remove from original collection
    if (itemType === 'story') {
        try { await deleteDoc(doc(db, 'stories', itemId)); } catch { }
        try { await deleteDoc(doc(db, 'stories_archive', itemId)); } catch { }
    } else if (itemType === 'post') {
        try { await deleteDoc(doc(db, 'posts', itemId)); } catch { }
    }
};

// Get user's recently deleted items
export const getRecentlyDeleted = async (uid) => {
    const q = query(
        collection(db, 'recently_deleted'),
        where('authorId', '==', uid),
        where('expiresAt', '>', new Date()),
        orderBy('expiresAt')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Restore from trash
export const restoreFromTrash = async (itemId) => {
    const ref = doc(db, 'recently_deleted', itemId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data = snap.data();
    const { itemType, deletedAt, expiresAt, originalId, ...original } = data;

    if (itemType === 'story') {
        await setDoc(doc(db, 'stories_archive', originalId), original);
    } else if (itemType === 'post') {
        await setDoc(doc(db, 'posts', originalId), original);
    }

    await deleteDoc(ref);
};

// Permanently delete
export const permanentlyDelete = async (itemId) => {
    await deleteDoc(doc(db, 'recently_deleted', itemId));
};

// Clean up expired trash
export const cleanupExpiredTrash = async () => {
    const q = query(
        collection(db, 'recently_deleted'),
        where('expiresAt', '<', new Date())
    );
    const snapshot = await getDocs(q);
    for (const d of snapshot.docs) await deleteDoc(d.ref);
};

// ─── HIGHLIGHTS (SPOTLIGHT + MEMORY) ─────────────────

// Create a highlight group
export const createHighlight = async (highlightData) => {
    const id = generateId();
    const highlight = {
        authorId: highlightData.authorId,
        name: highlightData.name || 'Highlight',
        type: highlightData.type, // 'spotlight' or 'memory'
        coverImage: highlightData.coverImage || '',
        storyIds: highlightData.storyIds || [],
        createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'highlights', id), highlight);
    return { id, ...highlight };
};

// Get highlights for a user (filtered by viewer relationship)
export const getHighlights = async (uid, viewerProfile = null) => {
    const q = query(
        collection(db, 'highlights'),
        where('authorId', '==', uid),
        orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    let highlights = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // If viewing someone else's profile, filter by access
    if (viewerProfile && viewerProfile.uid !== uid && viewerProfile.id !== uid) {
        highlights = highlights.filter(h => {
            if (h.type === 'spotlight') return true; // public
            if (h.type === 'memory') {
                // Only close friends can see memories
                return viewerProfile.closeFriends?.includes(uid) ||
                    (viewerProfile.friends?.includes(uid));
            }
            return false;
        });
    }

    return highlights;
};

// Update a highlight
export const updateHighlight = async (highlightId, updates) => {
    await updateDoc(doc(db, 'highlights', highlightId), updates);
};

// Delete a highlight
export const deleteHighlight = async (highlightId) => {
    await deleteDoc(doc(db, 'highlights', highlightId));
};

// Get stories by IDs (for viewing highlight content)
export const getStoriesByIds = async (storyIds) => {
    const stories = [];
    for (const id of storyIds) {
        // Check archive first, then active stories
        let snap = await getDoc(doc(db, 'stories_archive', id));
        if (!snap.exists()) snap = await getDoc(doc(db, 'stories', id));
        if (snap.exists()) stories.push({ id: snap.id, ...snap.data() });
    }
    return stories;
};

// ─── CLOSE FRIENDS ───────────────────────────────────

export const addCloseFriend = async (uid, friendId) => {
    await updateDoc(doc(db, 'users', uid), {
        closeFriends: arrayUnion(friendId),
    });
};

export const removeCloseFriend = async (uid, friendId) => {
    await updateDoc(doc(db, 'users', uid), {
        closeFriends: arrayRemove(friendId),
    });
};
