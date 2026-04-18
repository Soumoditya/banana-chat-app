import {
    collection,
    doc,
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

/**
 * Write a notification to the notifications collection.
 * Safe to call from any service — silently swallows errors so
 * a notification failure never breaks the primary action.
 *
 * @param {string} targetUserId  - The user who receives the notification
 * @param {string} actorId       - The user who triggered it
 * @param {'like'|'comment'|'follow'|'mention'|'reshare'|'reply'|'share'|'friend_request'|'story_reaction'} type
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
