import {
    collection,
    doc,
    getDoc,
    addDoc,
    updateDoc,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { sendPushToUser } from './pushNotifications';

// Notification type → push message mapping
const PUSH_MESSAGES = {
    like: { title: '❤️ New Like', body: (actor) => `${actor} liked your post` },
    comment: { title: '💬 New Comment', body: (actor) => `${actor} commented on your post` },
    follow: { title: '👤 New Follower', body: (actor) => `${actor} started following you` },
    mention: { title: '📢 Mentioned', body: (actor) => `${actor} mentioned you` },
    reshare: { title: '🔄 Reshared', body: (actor) => `${actor} reshared your post` },
    reply: { title: '↩️ Reply', body: (actor) => `${actor} replied to your comment` },
    share: { title: '📤 Shared', body: (actor) => `${actor} shared your post` },
    friend_request: { title: '🤝 Friend Request', body: (actor) => `${actor} sent you a friend request` },
    story_reaction: { title: '⭐ Story Reaction', body: (actor) => `${actor} reacted to your story` },
    message: { title: '💬 New Message', body: (actor) => `${actor} sent you a message` },
};

/**
 * Write a notification to the notifications collection AND
 * deliver a real push notification to the target user's device.
 *
 * @param {string} targetUserId  - The user who receives the notification
 * @param {string} actorId       - The user who triggered it
 * @param {'like'|'comment'|'follow'|'mention'|'reshare'|'reply'|'share'|'friend_request'|'story_reaction'|'message'} type
 * @param {string|null} postId   - The relevant post (optional)
 * @param {string|null} message  - Custom message override (optional)
 * @param {string|null} thumbnailUrl - Post thumbnail preview (optional)
 */
export const createNotification = async (targetUserId, actorId, type, postId = null, message = null, thumbnailUrl = null) => {
    // Never notify yourself
    if (!targetUserId || !actorId || targetUserId === actorId) return;

    try {
        await addDoc(collection(db, 'notifications'), {
            targetUserId,
            actorId,
            type,
            postId: postId || null,
            message: message || null,
            thumbnailUrl: thumbnailUrl || null,
            read: false,
            createdAt: serverTimestamp(),
        });

        // ── Deliver real push notification ──
        const pushConfig = PUSH_MESSAGES[type] || { title: '🍌 Banana Chat', body: () => 'You have a new notification' };
        // Get actor display name for push body
        let actorName = 'Someone';
        try {
            const actorDoc = await getDoc(doc(db, 'users', actorId));
            if (actorDoc.exists()) actorName = actorDoc.data().displayName || actorDoc.data().username || 'Someone';
        } catch {}

        const pushData = { type };
        if (postId) pushData.postId = postId;
        if (type === 'follow') pushData.userId = actorId;

        sendPushToUser(targetUserId, pushConfig.title, pushConfig.body(actorName), pushData).catch(() => {});
    } catch (err) {
        // Notification failure must never crash the calling service
        console.warn('createNotification failed (non-fatal):', err.message);
    }
};

/**
 * Get the count of unread notifications for a user.
 * Used for the tab badge.
 */
export const getUnreadNotificationCount = async (uid) => {
    if (!uid) return 0;
    try {
        const q = query(
            collection(db, 'notifications'),
            where('targetUserId', '==', uid),
            where('read', '==', false),
            limit(99)
        );
        const snapshot = await getDocs(q);
        return snapshot.size;
    } catch (err) {
        console.warn('getUnreadNotificationCount failed:', err.message);
        return 0;
    }
};

/**
 * Mark all notifications read for a user (called when they open Activity tab).
 */
export const markAllNotificationsRead = async (uid) => {
    if (!uid) return;
    try {
        const q = query(
            collection(db, 'notifications'),
            where('targetUserId', '==', uid),
            where('read', '==', false),
            limit(50)
        );
        const snapshot = await getDocs(q);
        const promises = snapshot.docs.map(d => updateDoc(doc(db, 'notifications', d.id), { read: true }));
        await Promise.all(promises);
    } catch (err) {
        console.warn('markAllNotificationsRead failed:', err.message);
    }
};
