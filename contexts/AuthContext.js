import React, { createContext, useContext, useState, useEffect } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    signInAnonymously,
    GoogleAuthProvider,
    signInWithCredential,
    updateProfile,
    sendPasswordResetEmail,
} from 'firebase/auth';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
    query,
    where,
    getDocs,
    collection,
} from 'firebase/firestore';
import { ref, set, onDisconnect, serverTimestamp as rtdbTimestamp } from 'firebase/database';
import { auth, db, rtdb } from '../config/firebase';
import { ADMIN_EMAIL, ADMIN_USERNAME, BROADCAST_CHAT_ID, BROADCAST_CHAT_NAME, isUserAdmin } from '../utils/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerForPushNotifications, savePushToken } from '../services/pushNotifications';
import { updateAppStreak } from '../services/streaks';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            try {
                if (firebaseUser) {
                    setUser(firebaseUser);
                    const profile = await fetchUserProfile(firebaseUser.uid);
                    if (profile) {
                        setUserProfile(profile);
                        updatePresence(firebaseUser.uid, true);
                        // Register push notifications
                        const pushToken = await registerForPushNotifications();
                        if (pushToken) await savePushToken(firebaseUser.uid, pushToken);
                        // Update app streak on login
                        updateAppStreak(firebaseUser.uid).catch(() => {});
                    }
                } else {
                    setUser(null);
                    setUserProfile(null);
                }
            } catch (err) {
                console.error('Auth state change error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const fetchUserProfile = async (uid) => {
        try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
                return { id: userDoc.id, ...userDoc.data() };
            }
            return null;
        } catch (err) {
            console.error('Error fetching profile:', err);
            return null;
        }
    };

    const updatePresence = (uid, online) => {
        try {
            const presenceRef = ref(rtdb, `presence/${uid}`);
            set(presenceRef, {
                online: online,
                lastSeen: rtdbTimestamp(),
            });

            if (online) {
                // Use serverTimestamp so lastSeen reflects actual disconnect time,
                // not the stale Date.now() captured at connection time.
                onDisconnect(presenceRef).set({
                    online: false,
                    lastSeen: rtdbTimestamp(),
                });
            }
        } catch (err) {
            console.error('Presence update error:', err);
        }
    };

    const checkUsernameAvailable = async (username) => {
        try {
            // Try indexed query first
            const q = query(collection(db, 'users'), where('usernameLower', '==', username.toLowerCase()));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) return false;
        } catch (err) {
            console.warn('Indexed username check failed, trying scan:', err.message);
        }
        
        // Fallback: scan all users to enforce uniqueness even without indexes
        try {
            const allUsersSnapshot = await getDocs(collection(db, 'users'));
            const taken = allUsersSnapshot.docs.some(d => {
                const data = d.data();
                return (data.usernameLower || data.username || '').toLowerCase() === username.toLowerCase();
            });
            return !taken;
        } catch (scanErr) {
            console.warn('Username scan failed:', scanErr.message);
            // If both methods fail, block signup to prevent duplicates
            return false;
        }
    };

    const resetPassword = async (email) => {
        try {
            await sendPasswordResetEmail(auth, email);
            return true;
        } catch (err) {
            throw err;
        }
    };

    const createUserProfile = async (uid, data) => {
        const isAdmin = isUserAdmin({ email: data.email, username: data.username });

        const uname = data.username || 'user_' + uid.substring(0, 6);
        const dname = data.displayName || data.username || 'Banana User';

        const profileData = {
            uid: uid,
            username: uname,
            usernameLower: uname.toLowerCase(),
            displayName: dname,
            displayNameLower: dname.toLowerCase(),
            email: data.email || '',
            avatar: data.avatar || '',
            bio: '',
            isPrivate: false,
            isAdmin: isAdmin,
            role: isAdmin ? 'admin' : 'user',
            streak: 0,
            appStreak: 0,
            lastActive: serverTimestamp(),
            friends: [],
            closeFriends: [],
            following: [],
            followers: [],
            blockedUsers: [],
            isGuest: data.isGuest || false,
            createdAt: serverTimestamp(),
            settings: {
                notifications: true,
                readReceipts: true,
                lastSeen: true,
                darkMode: true,
            },
        };

        await setDoc(doc(db, 'users', uid), profileData);

        // Auto-join broadcast channel
        await ensureBroadcastChannel(uid);

        return { id: uid, ...profileData };
    };

    const ensureBroadcastChannel = async (uid) => {
        try {
            const broadcastDoc = await getDoc(doc(db, 'chats', BROADCAST_CHAT_ID));
            if (!broadcastDoc.exists()) {
                await setDoc(doc(db, 'chats', BROADCAST_CHAT_ID), {
                    type: 'group',
                    groupName: BROADCAST_CHAT_NAME,
                    groupAvatar: '',
                    isPublic: true,
                    isBroadcast: true,
                    participants: [uid],
                    admins: [],
                    lastMessage: null,
                    createdAt: serverTimestamp(),
                });
            } else {
                const data = broadcastDoc.data();
                if (!data.participants?.includes(uid)) {
                    await updateDoc(doc(db, 'chats', BROADCAST_CHAT_ID), {
                        participants: [...(data.participants || []), uid],
                    });
                }
            }
        } catch (err) {
            console.error('Broadcast channel error:', err);
        }
    };

    const signUp = async (email, password, username, displayName) => {
        try {
            setError(null);
            setLoading(true);

            // Create auth account FIRST so we're authenticated for Firestore queries
            const result = await createUserWithEmailAndPassword(auth, email, password);

            // Now check username availability (we're authenticated, Firestore reads work)
            const isAvailable = await checkUsernameAvailable(username);
            if (!isAvailable) {
                // Username taken — delete the auth account we just created
                try { await result.user.delete(); } catch (e) { console.warn('Cleanup failed:', e); }
                throw new Error('Username already taken. Please choose another.');
            }

            await updateProfile(result.user, { displayName });

            const profile = await createUserProfile(result.user.uid, {
                email,
                username,
                displayName,
            });

            setUserProfile(profile);
            updatePresence(result.user.uid, true);

            return result.user;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const signIn = async (identifier, password) => {
        try {
            setError(null);
            setLoading(true);

            let loginEmail = identifier;

            // If identifier doesn't look like an email, treat as username
            if (!identifier.includes('@')) {
                let foundEmail = null;
                
                // Try indexed queries first (fast path)
                try {
                    let q = query(collection(db, 'users'), where('usernameLower', '==', identifier.toLowerCase()));
                    let snapshot = await getDocs(q);
                    
                    if (snapshot.empty) {
                        q = query(collection(db, 'users'), where('username', '==', identifier));
                        snapshot = await getDocs(q);
                    }
                    
                    if (!snapshot.empty) {
                        foundEmail = snapshot.docs[0].data().email;
                    }
                } catch (indexErr) {
                    // Index query failed — this is expected if Firestore indexes are missing
                    console.warn('Indexed username lookup failed, trying fallback:', indexErr.message);
                }
                
                // Fallback: scan users collection (works without indexes)
                if (!foundEmail) {
                    try {
                        const allUsersSnapshot = await getDocs(collection(db, 'users'));
                        const matchedUser = allUsersSnapshot.docs.find(d => {
                            const data = d.data();
                            const unameLower = (data.usernameLower || data.username || '').toLowerCase();
                            const dnameLower = (data.displayNameLower || data.displayName || '').toLowerCase();
                            return unameLower === identifier.toLowerCase() || dnameLower === identifier.toLowerCase();
                        });
                        
                        if (matchedUser) {
                            foundEmail = matchedUser.data().email;
                        }
                    } catch (scanErr) {
                        console.warn('User scan fallback failed:', scanErr.message);
                    }
                }
                
                if (!foundEmail) {
                    throw new Error('No account found with that username. Try your email address instead.');
                }
                
                loginEmail = foundEmail;
            }

            const result = await signInWithEmailAndPassword(auth, loginEmail, password);

            const profile = await fetchUserProfile(result.user.uid);
            if (profile) {
                setUserProfile(profile);
                await updateDoc(doc(db, 'users', result.user.uid), {
                    lastActive: serverTimestamp(),
                });
            }

            updatePresence(result.user.uid, true);
            return result.user;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const signInAsGuest = async () => {
        try {
            setError(null);
            setLoading(true);

            const result = await signInAnonymously(auth);
            const guestName = 'Guest_' + result.user.uid.substring(0, 6);

            const profile = await createUserProfile(result.user.uid, {
                username: guestName,
                displayName: guestName,
                isGuest: true,
            });

            setUserProfile(profile);
            return result.user;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        try {
            if (user) {
                updatePresence(user.uid, false);
            }
            await firebaseSignOut(auth);
            setUser(null);
            setUserProfile(null);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const refreshProfile = async () => {
        if (user) {
            const profile = await fetchUserProfile(user.uid);
            if (profile) {
                setUserProfile(profile);
            }
        }
    };

    const value = {
        user,
        userProfile,
        loading,
        error,
        signUp,
        signIn,
        signInAsGuest,
        signOut,
        refreshProfile,
        checkUsernameAvailable,
        updatePresence,
        resetPassword,
        setError,
        isAdmin: isUserAdmin(userProfile),
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
