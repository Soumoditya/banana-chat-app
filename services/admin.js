import {
    doc,
    updateDoc,
    deleteDoc,
    collection,
    getDocs,
    getDoc,
    setDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
} from 'firebase/firestore';
import { db, rtdb } from '../config/firebase';
import { ref, set, push } from 'firebase/database';
import { BROADCAST_CHAT_ID } from '../utils/constants';

// Send broadcast message to all users
export const sendBroadcast = async (adminUid, message) => {
    const messagesRef = ref(rtdb, `messages/${BROADCAST_CHAT_ID}`);
    const newMsgRef = push(messagesRef);

    await set(newMsgRef, {
        id: newMsgRef.key,
        senderId: adminUid,
        text: message,
        type: 'system',
        timestamp: Date.now(),
        readBy: {},
        delivered: {},
        reactions: {},
        deleted: false,
    });

    // Update last message on chat doc
    await updateDoc(doc(db, 'chats', BROADCAST_CHAT_ID), {
        lastMessage: {
            text: message,
            senderId: adminUid,
            timestamp: Date.now(),
        },
    });
};

// Get all users (admin only)
export const getAllUsers = async (pageSize = 50) => {
    const q = query(
        collection(db, 'users'),
        limit(pageSize)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Ban / unban user (admin only)
export const banUser = async (uid) => {
    await updateDoc(doc(db, 'users', uid), {
        isBanned: true,
        bannedAt: serverTimestamp(),
    });
};

export const unbanUser = async (uid) => {
    await updateDoc(doc(db, 'users', uid), {
        isBanned: false,
        bannedAt: null,
    });
};

// Delete any post (admin moderation)
export const moderateDeletePost = async (postId) => {
    await updateDoc(doc(db, 'posts', postId), {
        deleted: true,
        moderatedAt: serverTimestamp(),
        moderationReason: 'Admin removed',
    });
};

// ─── User Management (Enhanced) ───

/**
 * Set a user's verification/admin status
 */
export const setUserVerified = async (uid, isVerified) => {
    await updateDoc(doc(db, 'users', uid), {
        isVerified: isVerified,
    });
};

/**
 * Set a user's admin flag
 */
export const setUserAdminFlag = async (uid, isAdmin) => {
    await updateDoc(doc(db, 'users', uid), {
        isAdmin: isAdmin,
        role: isAdmin ? 'admin' : 'user',
    });
};

/**
 * Force update any field on a user profile
 */
export const adminUpdateUserField = async (uid, field, value) => {
    await updateDoc(doc(db, 'users', uid), {
        [field]: value,
    });
};

/**
 * Delete a user's post permanently
 */
export const adminDeletePost = async (postId) => {
    try {
        await updateDoc(doc(db, 'posts', postId), {
            deleted: true,
            moderatedAt: serverTimestamp(),
            moderationReason: 'Admin removed',
        });
    } catch (err) {
        // If post doc doesn't support update, try delete
        console.error('Admin delete post error:', err);
    }
};

/**
 * Get all posts by a specific user
 */
export const getUserPosts = async (uid) => {
    const q = query(
        collection(db, 'posts'),
        where('authorId', '==', uid),
        where('deleted', '==', false),
        orderBy('createdAt', 'desc'),
        limit(50)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * Get recent reports / flagged content
 */
export const getReportedContent = async () => {
    try {
        const q = query(
            collection(db, 'reports'),
            orderBy('createdAt', 'desc'),
            limit(50)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch {
        return [];
    }
};

/**
 * Reset a user's premium to free
 */
export const adminRevokePremium = async (uid) => {
    await updateDoc(doc(db, 'users', uid), {
        isPremium: false,
        premiumPlan: null,
        premiumExpiresAt: null,
        premiumActivatedAt: null,
        premiumPaymentMethod: null,
    });
};

/**
 * Admin grant premium instantly
 */
export const adminGrantPremium = async (uid, planId, durationDays = 30) => {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    await updateDoc(doc(db, 'users', uid), {
        isPremium: true,
        premiumPlan: planId,
        premiumExpiresAt: expiresAt,
        premiumActivatedAt: serverTimestamp(),
        premiumPaymentMethod: 'admin_grant',
    });
};

/**
 * Get full user details by uid
 */
export const adminGetUser = async (uid) => {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() };
    }
    return null;
};

// Get app statistics
export const getAppStats = async () => {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const postsSnapshot = await getDocs(query(
            collection(db, 'posts'),
            where('deleted', '==', false)
        ));
        const chatsSnapshot = await getDocs(collection(db, 'chats'));

        // Count premium users
        let premiumCount = 0;
        let bannedCount = 0;
        usersSnapshot.docs.forEach(d => {
            const data = d.data();
            if (data.isPremium) premiumCount++;
            if (data.isBanned) bannedCount++;
        });

        return {
            totalUsers: usersSnapshot.size,
            totalPosts: postsSnapshot.size,
            totalChats: chatsSnapshot.size,
            premiumUsers: premiumCount,
            bannedUsers: bannedCount,
        };
    } catch (err) {
        console.error('Stats error:', err);
        return { totalUsers: 0, totalPosts: 0, totalChats: 0, premiumUsers: 0, bannedUsers: 0 };
    }
};
