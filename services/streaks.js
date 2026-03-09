import { ref, get, set, update } from 'firebase/database';
import { rtdb } from '../config/firebase';
import { getStreakEmoji } from '../utils/constants';

// Calculate streak between two users
const getStreakKey = (uid1, uid2) => {
    return [uid1, uid2].sort().join('_');
};

// Update streak on message
export const updateStreak = async (senderUid, receiverUid) => {
    const key = getStreakKey(senderUid, receiverUid);
    const streakRef = ref(rtdb, `streaks/${key}`);

    const snapshot = await get(streakRef);
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (snapshot.exists()) {
        const data = snapshot.val();
        const lastSenderTime = data.lastInteraction?.[senderUid] || 0;
        const lastReceiverTime = data.lastInteraction?.[receiverUid] || 0;
        const lastAnyTime = Math.max(lastSenderTime, lastReceiverTime);

        // If both have interacted within last 24h, maintain/increment streak
        const timeSinceLastAny = now - lastAnyTime;

        if (timeSinceLastAny > 2 * oneDayMs) {
            // Streak broken - reset
            await set(streakRef, {
                count: 1,
                lastInteraction: { [senderUid]: now },
                emoji: getStreakEmoji(1),
                startedAt: now,
            });
        } else {
            // Check if we should increment
            const bothInteractedRecently =
                (now - lastSenderTime < oneDayMs) && (now - lastReceiverTime < oneDayMs);

            const newCount = bothInteractedRecently ? (data.count || 0) + 1 : data.count || 1;

            await update(streakRef, {
                count: newCount,
                [`lastInteraction/${senderUid}`]: now,
                emoji: getStreakEmoji(newCount),
            });
        }
    } else {
        // New streak
        await set(streakRef, {
            count: 1,
            lastInteraction: { [senderUid]: now },
            emoji: getStreakEmoji(1),
            startedAt: now,
        });
    }
};

// Get streak between two users
export const getStreak = async (uid1, uid2) => {
    const key = getStreakKey(uid1, uid2);
    const streakRef = ref(rtdb, `streaks/${key}`);

    const snapshot = await get(streakRef);
    if (snapshot.exists()) {
        return snapshot.val();
    }
    return { count: 0, emoji: '' };
};

// Get all streaks for a user (limited approach - need to know user pairs)
export const getUserStreaks = async (uid, friendIds = []) => {
    const streaks = {};

    for (const friendId of friendIds.slice(0, 20)) {
        const streak = await getStreak(uid, friendId);
        if (streak.count > 0) {
            streaks[friendId] = streak;
        }
    }

    return streaks;
};

// Update app usage streak
export const updateAppStreak = async (uid) => {
    const streakRef = ref(rtdb, `appStreaks/${uid}`);
    const snapshot = await get(streakRef);
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (snapshot.exists()) {
        const data = snapshot.val();
        const timeSinceLast = now - (data.lastUse || 0);

        if (timeSinceLast > 2 * oneDayMs) {
            // Streak broken
            await set(streakRef, { count: 1, lastUse: now });
        } else if (timeSinceLast > oneDayMs) {
            // New day - increment
            await update(streakRef, {
                count: (data.count || 0) + 1,
                lastUse: now,
            });
        }
        // Same day - no change
    } else {
        await set(streakRef, { count: 1, lastUse: now });
    }
};

export const getAppStreak = async (uid) => {
    const streakRef = ref(rtdb, `appStreaks/${uid}`);
    const snapshot = await get(streakRef);
    if (snapshot.exists()) {
        return snapshot.val();
    }
    return { count: 0 };
};
