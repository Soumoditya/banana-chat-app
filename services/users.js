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

// Get user profile
export const getUserProfile = async (uid) => {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() };
    }
    return null;
};

// Search users by username or display name
export const searchUsers = async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) return [];

    const term = searchTerm.toLowerCase();
    
    // Search by username
    let usernameResults = [];
    try {
        const qUsername = query(
            collection(db, 'users'),
            where('usernameLower', '>=', term),
            where('usernameLower', '<=', term + '\uf8ff'),
            limit(20)
        );
        const usernameSnapshot = await getDocs(qUsername);
        usernameResults = usernameSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.warn('Username search failed:', err.message);
    }

    // Search by display name (displayNameLower) — may fail if field doesn't exist
    let displayResults = [];
    try {
        const qDisplay = query(
            collection(db, 'users'),
            where('displayNameLower', '>=', term),
            where('displayNameLower', '<=', term + '\uf8ff'),
            limit(20)
        );
        const displaySnapshot = await getDocs(qDisplay);
        displayResults = displaySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.warn('Display name search failed (field may not exist):', err.message);
    }

    // Merge and deduplicate
    const combined = [...usernameResults];
    for (const user of displayResults) {
        if (!combined.find(u => u.id === user.id)) {
            combined.push(user);
        }
    }

    return combined;
};

// Update user profile
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

// Follow / Unfollow
export const followUser = async (currentUid, targetUid) => {
    await updateDoc(doc(db, 'users', currentUid), {
        following: arrayUnion(targetUid),
    });
    await updateDoc(doc(db, 'users', targetUid), {
        followers: arrayUnion(currentUid),
    });
};

export const unfollowUser = async (currentUid, targetUid) => {
    await updateDoc(doc(db, 'users', currentUid), {
        following: arrayRemove(targetUid),
    });
    await updateDoc(doc(db, 'users', targetUid), {
        followers: arrayRemove(currentUid),
    });
};

// Friend management
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

// Close friend management
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

// Block/Unblock
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

// Get followers / following list
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

// Subscribe to user profile changes
export const subscribeToUserProfile = (uid, callback) => {
    return onSnapshot(doc(db, 'users', uid), (snapshot) => {
        if (snapshot.exists()) {
            callback({ id: snapshot.id, ...snapshot.data() });
        }
    });
};
