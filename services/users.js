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
    onSnapshot,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    increment,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { createNotification } from './notifications';

// ─── Profile Reads ───
export const getUserProfile = async (uid) => {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() };
    }
    return null;
};

// Resolves a username to a profile — cascades through indexed, lowercase,
// and full-scan strategies to handle legacy users without `usernameLower`.
export const getUserByUsername = async (username) => {
    try {
        // Try exact match first
        const qExact = query(collection(db, 'users'), where('username', '==', username), limit(1));
        let snapshot = await getDocs(qExact);
        if (!snapshot.empty) {
            const d = snapshot.docs[0];
            return { id: d.id, ...d.data() };
        }
        // Try lowercase match
        const qLower = query(collection(db, 'users'), where('usernameLower', '==', username.toLowerCase()), limit(1));
        snapshot = await getDocs(qLower);
        if (!snapshot.empty) {
            const d = snapshot.docs[0];
            return { id: d.id, ...d.data() };
        }
        // Fallback: scan all users
        const allSnapshot = await getDocs(collection(db, 'users'));
        const match = allSnapshot.docs.find(d => {
            const data = d.data();
            return (data.username || '').toLowerCase() === username.toLowerCase() ||
                   (data.usernameLower || '').toLowerCase() === username.toLowerCase();
        });
        if (match) return { id: match.id, ...match.data() };
    } catch (err) {
        console.warn('getUserByUsername error:', err.message);
    }
    return null;
};

// ─── Search ───
export const searchUsers = async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 1) return [];

    const term = searchTerm.toLowerCase();
    
    // Try indexed prefix queries first (fast)
    let results = [];
    try {
        const qUsername = query(
            collection(db, 'users'),
            where('usernameLower', '>=', term),
            where('usernameLower', '<=', term + '\uf8ff'),
            limit(20)
        );
        const usernameSnapshot = await getDocs(qUsername);
        results = usernameSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        const qDisplay = query(
            collection(db, 'users'),
            where('displayNameLower', '>=', term),
            where('displayNameLower', '<=', term + '\uf8ff'),
            limit(20)
        );
        const displaySnapshot = await getDocs(qDisplay);
        for (const d of displaySnapshot.docs) {
            if (!results.find(u => u.id === d.id)) {
                results.push({ id: d.id, ...d.data() });
            }
        }
    } catch (err) {
        console.warn('Indexed search failed:', err.message);
    }

    // Fallback: client-side substring search (works without indexes)
    if (results.length === 0) {
        try {
            const allUsersSnapshot = await getDocs(collection(db, 'users'));
            results = allUsersSnapshot.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(u => {
                    const uname = (u.usernameLower || u.username || '').toLowerCase();
                    const dname = (u.displayNameLower || u.displayName || '').toLowerCase();
                    return uname.includes(term) || dname.includes(term);
                });
        } catch (scanErr) {
            console.warn('User scan search failed:', scanErr.message);
        }
    }

    return results.slice(0, 30);
};

// ─── Discovery ───
// Surfaces recent users the viewer doesn't already follow.
// Intentionally simple — avoids a recommendation engine for now.
export const getSuggestedUsers = async (userId, limitCount = 10) => {
    try {
        const currentUserProfile = await getUserProfile(userId);
        const following = currentUserProfile?.following || [];

        // Simple approach: fetch recent/active users
        const q = query(
            collection(db, 'users'),
            orderBy('createdAt', 'desc'),
            limit(limitCount + following.length + 1) // Buffer for filtering out followed users
        );
        const snapshot = await getDocs(q);
        
        const suggestions = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(u => u.id !== userId && !following.includes(u.id) && !u.isGuest && !u.isAnonymous)
            .slice(0, limitCount);

        return suggestions;
    } catch (err) {
        console.warn('getSuggestedUsers error:', err.message);
        return [];
    }
};

// ─── Profile Writes ───
// Automatically maintains lowercase copies of username/displayName
// so prefix search queries work without Firestore composite indexes.
export const updateUserProfile = async (uid, data) => {
    if (data.username) {
        data.usernameLower = data.username.toLowerCase();
    }
    if (data.displayName) {
        data.displayNameLower = data.displayName.toLowerCase();
    }
    await updateDoc(doc(db, 'users', uid), {
        ...data,
        lastActive: serverTimestamp(),
    });
};

// ─── Social Graph ───
export const followUser = async (currentUid, targetUid) => {
    await updateDoc(doc(db, 'users', currentUid), {
        following: arrayUnion(targetUid),
    });
    await updateDoc(doc(db, 'users', targetUid), {
        followers: arrayUnion(currentUid),
    });
    // Notify the followed user
    createNotification(targetUid, currentUid, 'follow');
};

export const unfollowUser = async (currentUid, targetUid) => {
    await updateDoc(doc(db, 'users', currentUid), {
        following: arrayRemove(targetUid),
    });
    await updateDoc(doc(db, 'users', targetUid), {
        followers: arrayRemove(currentUid),
    });
};

// Bidirectional — both users get the friend link atomically.
export const addFriend = async (currentUid, targetUid) => {
    await updateDoc(doc(db, 'users', currentUid), {
        friends: arrayUnion(targetUid),
    });
    await updateDoc(doc(db, 'users', targetUid), {
        friends: arrayUnion(currentUid),
    });
};

export const removeFriend = async (currentUid, targetUid) => {
    await updateDoc(doc(db, 'users', currentUid), {
        friends: arrayRemove(targetUid),
        closeFriends: arrayRemove(targetUid),
    });
    await updateDoc(doc(db, 'users', targetUid), {
        friends: arrayRemove(currentUid),
        closeFriends: arrayRemove(currentUid),
    });
};

// Unidirectional — only the initiator's close-friends list is modified.
export const addCloseFriend = async (currentUid, targetUid) => {
    await updateDoc(doc(db, 'users', currentUid), {
        closeFriends: arrayUnion(targetUid),
    });
};

export const removeCloseFriend = async (currentUid, targetUid) => {
    await updateDoc(doc(db, 'users', currentUid), {
        closeFriends: arrayRemove(targetUid),
    });
};

// Blocking also severs friend/follow links to prevent stale social data.
export const blockUser = async (currentUid, targetUid) => {
    await updateDoc(doc(db, 'users', currentUid), {
        blockedUsers: arrayUnion(targetUid),
        friends: arrayRemove(targetUid),
        closeFriends: arrayRemove(targetUid),
        following: arrayRemove(targetUid),
    });
};

export const unblockUser = async (currentUid, targetUid) => {
    await updateDoc(doc(db, 'users', currentUid), {
        blockedUsers: arrayRemove(targetUid),
    });
};

// ─── Social Lists ───
// Capped at 50 to avoid excessive reads on large follower lists.
export const getFollowers = async (uid) => {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) return [];
    const followerIds = userDoc.data().followers || [];

    const profiles = [];
    for (const id of followerIds.slice(0, 50)) {
        const profile = await getUserProfile(id);
        if (profile) profiles.push(profile);
    }
    return profiles;
};

export const getFollowing = async (uid) => {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) return [];
    const followingIds = userDoc.data().following || [];

    const profiles = [];
    for (const id of followingIds.slice(0, 50)) {
        const profile = await getUserProfile(id);
        if (profile) profiles.push(profile);
    }
    return profiles;
};

// ─── Real-time Subscriptions ───
export const subscribeToUserProfile = (uid, callback) => {
    return onSnapshot(doc(db, 'users', uid), (snapshot) => {
        if (snapshot.exists()) {
            callback({ id: snapshot.id, ...snapshot.data() });
        }
    });
};

// ─── Chat Preferences ───
export const pinChat = async (uid, chatId) => {
    await updateDoc(doc(db, 'users', uid), {
        pinnedChats: arrayUnion(chatId),
    });
};

export const unpinChat = async (uid, chatId) => {
    await updateDoc(doc(db, 'users', uid), {
        pinnedChats: arrayRemove(chatId),
    });
};

export const archiveChat = async (uid, chatId) => {
    await updateDoc(doc(db, 'users', uid), {
        archivedChats: arrayUnion(chatId),
    });
};

export const unarchiveChat = async (uid, chatId) => {
    await updateDoc(doc(db, 'users', uid), {
        archivedChats: arrayRemove(chatId),
    });
};

// ─── Premium Subscription ───

/**
 * Submit a premium request (user pays, then this creates a PENDING request)
 * Admin must approve before premium activates.
 */
export const submitPremiumRequest = async (uid, planId, paymentMethod) => {
    const userDoc = await getDoc(doc(db, 'users', uid));
    const profile = userDoc.exists() ? userDoc.data() : {};

    await setDoc(doc(db, 'premiumRequests', uid), {
        userId: uid,
        username: profile.username || '',
        displayName: profile.displayName || '',
        avatar: profile.avatar || null,
        planId,
        paymentMethod,
        amount: { standard: 99, premium: 199, premium_plus: 299, elite: 399, super: 499, vip: 999 }[planId] || 0,
        status: 'pending', // pending | approved | rejected
        requestedAt: serverTimestamp(),
        reviewedAt: null,
        reviewedBy: null,
    });
};

/**
 * Admin approves a premium request → activates premium on user
 */
export const approvePremiumRequest = async (requestId, adminUid) => {
    const reqDoc = await getDoc(doc(db, 'premiumRequests', requestId));
    if (!reqDoc.exists()) throw new Error('Request not found');

    const data = reqDoc.data();

    // Set expiry to 30 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Activate premium on user
    await updateDoc(doc(db, 'users', data.userId), {
        isPremium: true,
        premiumPlan: data.planId,
        premiumExpiresAt: expiresAt,
        premiumActivatedAt: serverTimestamp(),
        premiumPaymentMethod: data.paymentMethod,
    });

    // Mark request as approved
    await updateDoc(doc(db, 'premiumRequests', requestId), {
        status: 'approved',
        reviewedAt: serverTimestamp(),
        reviewedBy: adminUid,
    });
};

/**
 * Admin rejects a premium request
 */
export const rejectPremiumRequest = async (requestId, adminUid) => {
    await updateDoc(doc(db, 'premiumRequests', requestId), {
        status: 'rejected',
        reviewedAt: serverTimestamp(),
        reviewedBy: adminUid,
    });
};

/**
 * Get pending premium requests (admin only)
 */
export const getPendingPremiumRequests = async () => {
    const q = query(
        collection(db, 'premiumRequests'),
        where('status', '==', 'pending'),
        orderBy('requestedAt', 'desc'),
        limit(50)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * Cancel premium (admin or user)
 */
export const cancelPremium = async (uid) => {
    await updateDoc(doc(db, 'users', uid), {
        isPremium: false,
        premiumPlan: null,
        premiumExpiresAt: null,
    });
};

/**
 * Upgrade directly (for admin manual override)
 */
export const upgradeToPremium = async (uid, planId, paymentMethod) => {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await updateDoc(doc(db, 'users', uid), {
        isPremium: true,
        premiumPlan: planId,
        premiumExpiresAt: expiresAt,
        premiumActivatedAt: serverTimestamp(),
        premiumPaymentMethod: paymentMethod || 'admin',
    });
};

