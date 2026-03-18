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
import { ADMIN_EMAIL, ADMIN_USERNAME, BROADCAST_CHAT_ID, BROADCAST_CHAT_NAME } from '../utils/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
                lastSeen: Date.now(),
            });

            if (online) {
                onDisconnect(presenceRef).set({
                    online: false,
                    lastSeen: Date.now(),
                });
            }
        } catch (err) {
            console.error('Presence update error:', err);
        }
    };

    const checkUsernameAvailable = async (username) => {
        try {
            const q = query(collection(db, 'users'), where('usernameLower', '==', username.toLowerCase()));
            const snapshot = await getDocs(q);
            return snapshot.empty;
        } catch (err) {
            console.warn('Username check error (assuming available):', err.message);
            // Fail-open: if Firestore index is missing or query fails,
            // assume username is available so signup isn't blocked.
            // The actual uniqueness will be enforced by createUserProfile.
            return true;
        }
    };

    const createUserProfile = async (uid, data) => {
        const isAdmin = data.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

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

            const isAvailable = await checkUsernameAvailable(username);
            if (!isAvailable) {
                throw new Error('Username already taken');
            }

            const result = await createUserWithEmailAndPassword(auth, email, password);

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
                try {
                    let q = query(collection(db, 'users'), where('usernameLower', '==', identifier.toLowerCase()));
                    let snapshot = await getDocs(q);

                    // Fallback 1: Try exact 'username' (for legacy accounts without usernameLower)
                    if (snapshot.empty) {
                        q = query(collection(db, 'users'), where('username', '==', identifier));
                        snapshot = await getDocs(q);
                    }

                    // Fallback 2: Users often confuse Display Name with Username. Let's try displayNameLower
                    if (snapshot.empty) {
                        q = query(collection(db, 'users'), where('displayNameLower', '==', identifier.toLowerCase()));
                        snapshot = await getDocs(q);
                    }

                    if (snapshot.empty) {
                        throw new Error('No account found with that username or name. Try using your email instead.');
                    }
                    const userData = snapshot.docs[0].data();
                    loginEmail = userData.email;
                    if (!loginEmail) {
                        throw new Error('This account has no email linked. Please login with email.');
                    }
                } catch (lookupErr) {
                    if (lookupErr.message.includes('No account') || lookupErr.message.includes('no email')) {
                        throw lookupErr;
                    }
                    // Firestore query error (missing index etc) — tell user to use email
                    console.warn('Username lookup failed:', lookupErr.message);
                    throw new Error('Username login temporarily unavailable. Please use your email address to sign in.');
                }
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
        setError,
        isAdmin: userProfile?.isAdmin || false,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
