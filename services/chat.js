import {
    ref,
    push,
    set,
    onValue,
    off,
    query as rtdbQuery,
    orderByChild,
    limitToLast,
    update,
    remove,
    serverTimestamp,
    get,
} from 'firebase/database';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    getDocs,
    query,
    where,
    onSnapshot,
    serverTimestamp as fsTimestamp,
    arrayUnion,
    arrayRemove,
    deleteDoc,
} from 'firebase/firestore';
import { rtdb, db } from '../config/firebase';
import { BROADCAST_CHAT_ID } from '../utils/constants';
import { sendPushToUser } from './pushNotifications';

// Create or get DM chat
export const getOrCreateDMChat = async (currentUid, otherUid) => {
    // Check if DM already exists
    const q = query(
        collection(db, 'chats'),
        where('type', '==', 'dm'),
        where('participants', 'array-contains', currentUid)
    );

    const snapshot = await getDocs(q);
    let existingChat = null;

    snapshot.docs.forEach((d) => {
        const data = d.data();
        if (data.participants?.includes(otherUid)) {
            existingChat = { id: d.id, ...data };
        }
    });

    if (existingChat) return existingChat;

    // Create new DM
    const chatRef = doc(collection(db, 'chats'));
    const chatData = {
        type: 'dm',
        participants: [currentUid, otherUid],
        lastMessage: null,
        nicknames: {},
        createdAt: fsTimestamp(),
    };

    await setDoc(chatRef, chatData);
    return { id: chatRef.id, ...chatData };
};

// Create group chat
export const createGroupChat = async (name, creatorUid, participantUids, isPublic = false) => {
    const chatRef = doc(collection(db, 'chats'));
    const chatData = {
        type: 'group',
        groupName: name,
        groupAvatar: '',
        isPublic: isPublic,
        isBroadcast: false,
        participants: [creatorUid, ...participantUids],
        admins: [creatorUid],
        lastMessage: null,
        nicknames: {},
        createdAt: fsTimestamp(),
    };

    await setDoc(chatRef, chatData);

    // Get creator's profile for the system message
    let creatorName = 'Someone';
    try {
        const creatorDoc = await getDoc(doc(db, 'users', creatorUid));
        if (creatorDoc.exists()) {
            const data = creatorDoc.data();
            creatorName = '@' + (data.username || data.displayName || creatorUid);
        }
    } catch (e) { /* ignore */ }

    // Send system message
    await sendMessage(chatRef.id, {
        senderId: 'system',
        text: `${creatorName} created the group "${name}"`,
        type: 'system',
    });

    return { id: chatRef.id, ...chatData };
};

// Get user's chats
export const subscribeToChats = (uid, callback) => {
    const q = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', uid)
    );

    return onSnapshot(q, (snapshot) => {
        const chats = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort by last message timestamp
        chats.sort((a, b) => {
            const aTime = a.lastMessage?.timestamp || 0;
            const bTime = b.lastMessage?.timestamp || 0;
            return bTime - aTime;
        });
        callback(chats);
    });
};

// Send message
export const sendMessage = async (chatId, messageData) => {
    const messagesRef = ref(rtdb, `messages/${chatId}`);
    const newMsgRef = push(messagesRef);

    const message = {
        id: newMsgRef.key,
        senderId: messageData.senderId,
        text: messageData.text || '',
        type: messageData.type || 'text',
        media: messageData.media || null,
        replyTo: messageData.replyTo || null,
        viewOnce: messageData.viewOnce || false,
        viewOnceTimer: messageData.viewOnceTimer || 0,
        readBy: {},
        delivered: {},
        reactions: {},
        timestamp: Date.now(),
        deleted: false,
    };

    await set(newMsgRef, message);

    // Update chat last message
    if (messageData.type !== 'system') {
        await updateDoc(doc(db, 'chats', chatId), {
            lastMessage: {
                text: messageData.type === 'text' ? messageData.text : `📎 ${messageData.type}`,
                senderId: messageData.senderId,
                timestamp: Date.now(),
            },
        });

        // ── Push notification to all other participants ──
        try {
            const chatDoc = await getDoc(doc(db, 'chats', chatId));
            if (chatDoc.exists()) {
                const chatData = chatDoc.data();
                const recipients = (chatData.participants || []).filter(uid => uid !== messageData.senderId);
                
                // Get sender display name
                let senderName = 'Someone';
                try {
                    const senderDoc = await getDoc(doc(db, 'users', messageData.senderId));
                    if (senderDoc.exists()) senderName = senderDoc.data().displayName || senderDoc.data().username || 'Someone';
                } catch {}

                const title = chatData.groupName ? `${senderName} in ${chatData.groupName}` : senderName;
                const body = messageData.type === 'text' ? (messageData.text || 'Sent a message')
                    : messageData.type === 'voice' ? '🎤 Voice message'
                    : messageData.type === 'image' ? '📷 Photo'
                    : messageData.type === 'video' ? '🎬 Video'
                    : messageData.type === 'document' ? '📄 Document'
                    : 'Sent a message';

                for (const recipientId of recipients) {
                    sendPushToUser(recipientId, title, body, { chatId, type: 'message' }).catch(() => {});
                }
            }
        } catch (pushErr) {
            // Push failure must never break message sending
            console.warn('Chat push notification failed (non-fatal):', pushErr.message);
        }
    }

    return message;
};

// Subscribe to messages
export const subscribeToMessages = (chatId, callback, messageLimit = 50) => {
    const messagesRef = rtdbQuery(
        ref(rtdb, `messages/${chatId}`),
        orderByChild('timestamp'),
        limitToLast(messageLimit)
    );

    onValue(messagesRef, (snapshot) => {
        const messages = [];
        snapshot.forEach((child) => {
            messages.push({ id: child.key, ...child.val() });
        });
        callback(messages);
    });

    return () => off(messagesRef);
};

// Mark message as read
export const markAsRead = async (chatId, messageId, uid) => {
    const msgRef = ref(rtdb, `messages/${chatId}/${messageId}/readBy/${uid}`);
    await set(msgRef, Date.now());
};

// Mark message as delivered
export const markAsDelivered = async (chatId, messageId, uid) => {
    const msgRef = ref(rtdb, `messages/${chatId}/${messageId}/delivered/${uid}`);
    await set(msgRef, Date.now());
};

// Add reaction to message
export const addReaction = async (chatId, messageId, uid, emoji) => {
    const reactionRef = ref(rtdb, `messages/${chatId}/${messageId}/reactions/${uid}`);
    await set(reactionRef, emoji);
};

// Remove reaction
export const removeReaction = async (chatId, messageId, uid) => {
    const reactionRef = ref(rtdb, `messages/${chatId}/${messageId}/reactions/${uid}`);
    await remove(reactionRef);
};

// Delete message (soft delete)
export const deleteMessage = async (chatId, messageId) => {
    const msgRef = ref(rtdb, `messages/${chatId}/${messageId}`);
    await update(msgRef, { deleted: true, text: 'Message deleted' });
};

// Set nickname
export const setNickname = async (chatId, uid, nickname) => {
    await updateDoc(doc(db, 'chats', chatId), {
        [`nicknames.${uid}`]: nickname,
    });
};

// Add participant to group
export const addParticipant = async (chatId, uid) => {
    await updateDoc(doc(db, 'chats', chatId), {
        participants: arrayUnion(uid),
    });
};

// Remove participant from group
export const removeParticipant = async (chatId, uid) => {
    await updateDoc(doc(db, 'chats', chatId), {
        participants: arrayRemove(uid),
    });
};

// Get chat info
export const getChatInfo = async (chatId) => {
    const chatDoc = await getDoc(doc(db, 'chats', chatId));
    if (chatDoc.exists()) {
        return { id: chatDoc.id, ...chatDoc.data() };
    }
    return null;
};

// Pin message
export const pinMessage = async (chatId, messageId) => {
    await updateDoc(doc(db, 'chats', chatId), {
        pinnedMessageId: messageId,
    });
};

// Unpin message
export const unpinMessage = async (chatId) => {
    await updateDoc(doc(db, 'chats', chatId), {
        pinnedMessageId: null,
    });
};

// Delete multiple messages
export const deleteMultipleMessages = async (chatId, messageIds) => {
    const updates = {};
    messageIds.forEach(id => {
        updates[`messages/${chatId}/${id}/deleted`] = true;
        updates[`messages/${chatId}/${id}/text`] = 'Message deleted';
    });
    await update(ref(rtdb), updates);
};

// Clear all chat messages (for user)
export const clearChat = async (chatId) => {
    const messagesRef = ref(rtdb, `messages/${chatId}`);
    await remove(messagesRef);
    await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: null,
    });
};

// Search public groups
export const searchPublicGroups = async (searchTerm) => {
    const q = query(
        collection(db, 'chats'),
        where('type', '==', 'group'),
        where('isPublic', '==', true)
    );

    const snapshot = await getDocs(q);
    const groups = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    if (searchTerm) {
        return groups.filter(g =>
            g.groupName?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    return groups;
};

// Subscribe to typing status
export const setTyping = async (chatId, uid, isTyping) => {
    const typingRef = ref(rtdb, `typing/${chatId}/${uid}`);
    if (isTyping) {
        await set(typingRef, true);
    } else {
        await remove(typingRef);
    }
};

export const subscribeToTyping = (chatId, callback) => {
    const typingRef = ref(rtdb, `typing/${chatId}`);
    onValue(typingRef, (snapshot) => {
        const typing = snapshot.val() || {};
        callback(typing);
    });
    return () => off(typingRef);
};

// ─── Unread Chat Count ───
/**
 * Subscribe to real-time unread chat count for a user.
 * Checks all chats the user participates in and counts ones with unread messages.
 *
 * TODO: The readBy map lives in RTDB on each message, but lastMessage on the
 * Firestore chat doc doesn't include readBy. This check will always show
 * unread for messages from other users. A proper fix would track
 * lastReadTimestamp per-user on the chat doc.
 */
export const subscribeToUnreadChats = (uid, callback) => {
    if (!uid) { callback(0); return () => {}; }

    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', uid));

    const unsub = onSnapshot(q, async (snapshot) => {
        let count = 0;
        for (const chatDoc of snapshot.docs) {
            const data = chatDoc.data();
            const lastMsg = data.lastMessage;
            if (!lastMsg) continue;
            // If last message was sent by someone else and hasn't been read by current user
            if (lastMsg.senderId && lastMsg.senderId !== uid) {
                const readBy = lastMsg.readBy || {};
                if (!readBy[uid]) count++;
            }
        }
        callback(count);
    }, (err) => {
        console.warn('subscribeToUnreadChats error:', err.message);
        callback(0);
    });

    return unsub;
};
