import {
    doc,
    updateDoc,
    collection,
    getDocs,
    query,
    where,
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

// Get app statistics
export const getAppStats = async () => {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const postsSnapshot = await getDocs(query(
            collection(db, 'posts'),
            where('deleted', '==', false)
        ));
        const chatsSnapshot = await getDocs(collection(db, 'chats'));

        return {
            totalUsers: usersSnapshot.size,
            totalPosts: postsSnapshot.size,
            totalChats: chatsSnapshot.size,
        };
    } catch (err) {
        console.error('Stats error:', err);
        return { totalUsers: 0, totalPosts: 0, totalChats: 0 };
    }
};
