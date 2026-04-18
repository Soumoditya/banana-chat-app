import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { generateId } from '../utils/helpers';
import { createNotification } from './notifications';

// Create a Reshare
export const createReshare = async (userId, originalPostId) => {
    // Check if already reshared — simple query on userId only
    try {
        const q = query(
            collection(db, 'reshares'),
            where('userId', '==', userId),
            limit(100)
        );
        const existing = await getDocs(q);
        const alreadyReshared = existing.docs.some(d => d.data().originalPostId === originalPostId);
        if (alreadyReshared) {
            throw new Error("You already reshared this post.");
        }
    } catch (err) {
        if (err.message.includes('already reshared')) throw err;
        console.error('Reshare check error:', err);
    }

    const reshareId = generateId();
    const reshare = {
        userId,
        originalPostId,
        createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'reshares', reshareId), reshare);

    // Notify the original post author (non-fatal)
    try {
        const postDoc = await getDoc(doc(db, 'posts', originalPostId));
        if (postDoc.exists()) {
            createNotification(postDoc.data().authorId, userId, 'reshare', originalPostId);
        }
    } catch (e) { /* non-fatal */ }

    return { id: reshareId, ...reshare };
};

// Delete a Reshare by ID
export const deleteReshare = async (reshareId) => {
    await deleteDoc(doc(db, 'reshares', reshareId));
};

// Undo reshare by userId + postId
export const undoReshare = async (userId, postId) => {
    const q = query(
        collection(db, 'reshares'),
        where('userId', '==', userId),
        limit(100)
    );
    const snapshot = await getDocs(q);
    const match = snapshot.docs.find(d => d.data().originalPostId === postId);
    if (match) {
        await deleteDoc(doc(db, 'reshares', match.id));
        return true;
    }
    return false;
};

// Get set of post IDs the user has reshared (for UI state)
export const getUserResharedPostIds = async (userId) => {
    try {
        const q = query(
            collection(db, 'reshares'),
            where('userId', '==', userId),
            limit(200)
        );
        const snapshot = await getDocs(q);
        return new Set(snapshot.docs.map(d => d.data().originalPostId));
    } catch (err) {
        console.error('getUserResharedPostIds error:', err);
        return new Set();
    }
};

// Fetch Reshares — NO orderBy (different field = needs composite index)
export const getResharesByUser = async (userId, limitCount = 30) => {
    try {
        const q = query(
            collection(db, 'reshares'),
            where('userId', '==', userId),
            limit(100)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return [];

        let reshares = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        // Client-side sort
        reshares.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        reshares = reshares.slice(0, limitCount);
        
        // Collect unique post IDs
        const postIds = [...new Set(reshares.map(r => r.originalPostId))];
        if (postIds.length === 0) return [];

        // Bundle fetching in chunks of 10 (Firestore 'in' limit)
        const postMap = {};
        for (let i = 0; i < postIds.length; i += 10) {
            const chunk = postIds.slice(i, i + 10);
            const postsQuery = query(collection(db, 'posts'), where('__name__', 'in', chunk));
            const postsSnap = await getDocs(postsQuery);
            postsSnap.docs.forEach(d => {
                postMap[d.id] = { id: d.id, ...d.data() };
            });
        }

        return reshares.map(r => ({
            ...r,
            post: postMap[r.originalPostId] || null,
            isReshare: true
        })).filter(r => r.post != null);
    } catch (err) {
        console.error('getResharesByUser error:', err);
        return [];
    }
};
