export const ADMIN_EMAIL = 'soumodityapramanik@gmail.com';
export const ADMIN_USERNAME = 'X';
// ADMIN_PASSWORD removed — never store passwords in client-side code

// ─── Admin Users (usernames with full admin power) ───
export const ADMIN_USERNAMES = ['xdd', 'inactiveritesh'];

/**
 * Check if a user profile belongs to an admin
 * Checks: isAdmin flag, email match, or username in admin list
 */
export const isUserAdmin = (profile) => {
    if (!profile) return false;
    if (profile.isAdmin === true) return true;
    if (profile.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;
    const uname = (profile.username || '').toLowerCase();
    return ADMIN_USERNAMES.some(a => a.toLowerCase() === uname);
};

export const APP_NAME = 'Banana Chat';
export const APP_VERSION = '1.0.0';

export const BROADCAST_CHAT_ID = 'app_broadcast';
export const BROADCAST_CHAT_NAME = 'Banana Chat Broadcast';

export const MESSAGE_TYPES = {
    TEXT: 'text',
    PHOTO: 'photo',
    VIDEO: 'video',
    VOICE: 'voice',
    GIF: 'gif',
    EMOJI: 'emoji',
    POLL: 'poll',
    SYSTEM: 'system',
    FILE: 'file',
};

export const POST_TYPES = {
    TEXT: 'text',
    PHOTO: 'photo',
    VIDEO: 'video',
    POLL: 'poll',
    GIF: 'gif',
};

export const STORY_TYPES = {
    PUBLIC: 'public',
    FRIENDS: 'friends',
    CLOSE_FRIENDS: 'closeFriends',
};

export const FEED_FILTERS = {
    ALL: 'all',
    LATEST: 'latest',
    FRIENDS: 'friends',
    FOLLOWING: 'following',
};

export const COMMENT_FILTERS = {
    ALL: 'all',
    RECENT: 'recent',
    TOP: 'top',
};

export const REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍', '🔥', '👏', '🎉', '💯', '🙏', '😍', '🤔', '👎', '💀', '🍌'];

export const STREAK_EMOJIS = {
    0: '',
    1: '⭐',
    3: '🔥',
    7: '💫',
    14: '🌟',
    30: '💎',
    60: '👑',
    100: '🏆',
    365: '🍌',
};

export const getStreakEmoji = (count) => {
    const thresholds = Object.keys(STREAK_EMOJIS)
        .map(Number)
        .sort((a, b) => b - a);
    for (const threshold of thresholds) {
        if (count >= threshold) {
            return STREAK_EMOJIS[threshold];
        }
    }
    return '';
};

export const ONLINE_STATUS = {
    ONLINE: 'online',
    OFFLINE: 'offline',
    AWAY: 'away',
    BUSY: 'busy',
};

export const PRIVACY = {
    PUBLIC: 'public',
    FRIENDS: 'friends',
    PRIVATE: 'private',
};

export const STORY_LABELS = {
    public: 'Story',
    friends: 'Status',
    closeFriends: 'Snap',
};

export const HIGHLIGHT_TYPES = {
    SPOTLIGHT: 'spotlight',  // public, gold ring
    MEMORY: 'memory',        // close friends, grey ring
};

export const MAX_STORY_DURATION = 24 * 60 * 60 * 1000; // 24 hours
export const TRASH_RETENTION = 30 * 24 * 60 * 60 * 1000; // 30 days
export const MAX_MEDIA_SIZE = 10 * 1024 * 1024; // 10MB for free Cloudinary

export const VIEW_ONCE_TIMERS = [5, 10, 15, 30]; // seconds
