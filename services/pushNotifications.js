import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
    }),
});

/**
 * Register for push notifications and return the Expo push token.
 * Returns null if permissions are denied or unavailable.
 */
export const registerForPushNotifications = async () => {
    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Push notification permissions not granted');
            return null;
        }

        // Set notification channel for Android
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FFD60A',
                sound: 'default',
            });
        }

        const tokenData = await Notifications.getExpoPushTokenAsync();
        return tokenData?.data || null;
    } catch (err) {
        console.warn('Push notification registration failed:', err.message);
        return null;
    }
};

/**
 * Save the push token to the user's Firestore profile.
 */
export const savePushToken = async (userId, token) => {
    if (!userId || !token) return;
    try {
        await updateDoc(doc(db, 'users', userId), {
            expoPushToken: token,
        });
    } catch (err) {
        console.warn('Failed to save push token:', err.message);
    }
};

/**
 * Show a local notification (foreground pop-up).
 */
export const showLocalNotification = async (title, body, data = {}) => {
    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data,
                sound: 'default',
            },
            trigger: null, // immediate
        });
    } catch (err) {
        console.warn('Local notification failed:', err.message);
    }
};

/**
 * Set up notification response listener (when user taps notification).
 * Returns a subscription that should be cleaned up on unmount.
 */
export const setupNotificationResponseListener = (router) => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data;
        if (data?.postId) {
            router.push(`/post/${data.postId}`);
        } else if (data?.chatId) {
            router.push(`/chat/${data.chatId}`);
        } else if (data?.userId) {
            router.push(`/user/${data.userId}`);
        }
    });
    return subscription;
};

/**
 * Send a push notification to a specific user via Expo Push API.
 * Reads their expoPushToken from Firestore and delivers instantly.
 * Works even when the target user's app is closed.
 */
export const sendPushToUser = async (targetUserId, title, body, data = {}) => {
    if (!targetUserId) return;
    try {
        const userDoc = await getDoc(doc(db, 'users', targetUserId));
        if (!userDoc.exists()) return;

        const token = userDoc.data().expoPushToken;
        if (!token) return;

        const message = {
            to: token,
            sound: 'default',
            title,
            body,
            data,
            priority: 'high',
            channelId: 'default',
        };

        await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });
    } catch (err) {
        console.warn('sendPushToUser failed (non-fatal):', err.message);
    }
};

/**
 * Send push notifications to multiple users at once (batch).
 */
export const sendPushToUsers = async (userIds, title, body, data = {}) => {
    if (!userIds?.length) return;
    const promises = userIds.map(uid => sendPushToUser(uid, title, body, data));
    await Promise.allSettled(promises);
};

