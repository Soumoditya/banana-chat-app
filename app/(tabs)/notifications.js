import { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SectionList,
    TouchableOpacity,
    Image,
    RefreshControl,
    Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, orderBy, onSnapshot, limit, deleteDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getUserProfile, followUser } from '../../services/users';
import { formatTime, getInitials } from '../../utils/helpers';
import { markAllNotificationsRead } from '../../services/notifications';
import { showLocalNotification, setupNotificationResponseListener } from '../../services/pushNotifications';
import useAppTheme from '../../hooks/useAppTheme';
import PremiumBadge from '../../components/PremiumBadge';
import { useToast } from '../../contexts/ToastContext';

// ─── Time grouping helpers ───
const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
};

const isThisWeek = (date) => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return date >= weekAgo && !isToday(date);
};

const isThisMonth = (date) => {
    const now = new Date();
    return date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear() &&
        !isToday(date) && !isThisWeek(date);
};

const groupNotifications = (notifs) => {
    const groups = { today: [], thisWeek: [], thisMonth: [], earlier: [] };
    for (const n of notifs) {
        const ts = n.createdAt?.seconds ? new Date(n.createdAt.seconds * 1000) : new Date();
        if (isToday(ts)) groups.today.push(n);
        else if (isThisWeek(ts)) groups.thisWeek.push(n);
        else if (isThisMonth(ts)) groups.thisMonth.push(n);
        else groups.earlier.push(n);
    }
    const sections = [];
    if (groups.today.length) sections.push({ title: 'Today', data: groups.today });
    if (groups.thisWeek.length) sections.push({ title: 'This Week', data: groups.thisWeek });
    if (groups.thisMonth.length) sections.push({ title: 'This Month', data: groups.thisMonth });
    if (groups.earlier.length) sections.push({ title: 'Earlier', data: groups.earlier });
    return sections;
};

// ─── Notification Item ───
function NotificationItem({ item, onPress, onDelete, onFollowBack, currentUserId, currentUserProfile }) {
    const translateX = useRef(new Animated.Value(0)).current;
    const itemOpacity = useRef(new Animated.Value(1)).current;

    const getNotifIcon = (type) => {
        switch (type) {
            case 'like': return 'heart';
            case 'comment': return 'chatbubble';
            case 'reply': return 'chatbubble-ellipses';
            case 'follow': return 'person-add';
            case 'friend_request': return 'people';
            case 'mention': return 'at';
            case 'share': return 'share';
            case 'reshare': return 'repeat';
            case 'story_reaction': return 'flame';
            default: return 'notifications';
        }
    };

    const getNotifColor = (type) => {
        switch (type) {
            case 'like': return '#FF3D71';
            case 'comment': return Colors.secondary;
            case 'reply': return Colors.accent;
            case 'follow': return Colors.primary;
            case 'friend_request': return '#7C4DFF';
            case 'mention': return '#00E5FF';
            case 'reshare': return Colors.accentGreen;
            case 'share': return Colors.accent;
            case 'story_reaction': return '#FF6D00';
            default: return Colors.textSecondary;
        }
    };

    const getNotifText = (item) => {
        switch (item.type) {
            case 'like': return 'liked your post';
            case 'comment': return 'commented on your post';
            case 'reply': return 'replied to your comment';
            case 'follow': return 'started following you';
            case 'friend_request': return 'sent you a friend request';
            case 'mention': return 'mentioned you';
            case 'share': return 'shared your post';
            case 'reshare': return 'reshared your post';
            case 'story_reaction': return 'reacted to your story';
            default: return item.message || 'interacted with you';
        }
    };

    const handleDelete = () => {
        Animated.parallel([
            Animated.timing(translateX, { toValue: -400, duration: 200, useNativeDriver: true }),
            Animated.timing(itemOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => onDelete(item.id));
    };

    // Check if current user already follows actor (for follow-back button)
    const isFollowType = item.type === 'follow';
    const alreadyFollowing = currentUserProfile?.following?.includes(item.actorId);

    return (
        <Animated.View style={{ opacity: itemOpacity, transform: [{ translateX }] }}>
            <View style={styles.deleteBackground}>
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                    <Ionicons name="trash" size={22} color="#fff" />
                    <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={[styles.notifItem, !item.read && styles.notifUnread]}
                onPress={() => onPress(item)}
                onLongPress={() => onDelete(item.id)}
            >
                <View style={[styles.notifIconCircle, { backgroundColor: getNotifColor(item.type) + '20' }]}>
                    <Ionicons name={getNotifIcon(item.type)} size={18} color={getNotifColor(item.type)} />
                </View>
                <View style={styles.notifContent}>
                    <View style={styles.notifRow}>
                        {item.actor?.avatar ? (
                            <Image source={{ uri: item.actor.avatar }} style={styles.notifAvatar} />
                        ) : (
                            <View style={[styles.notifAvatar, styles.notifAvatarPlaceholder]}>
                                <Text style={styles.notifAvatarText}>
                                    {getInitials(item.actor?.displayName || 'U')}
                                </Text>
                            </View>
                        )}
                        <Text style={styles.notifText} numberOfLines={2}>
                            <Text style={styles.notifBold}>{item.actor?.displayName || 'Someone'}</Text>
                            {item.actor?.isPremium && ' ✓'}
                            {' '}{getNotifText(item)}
                        </Text>
                    </View>
                    <View style={styles.notifBottom}>
                        <Text style={styles.notifTime}>
                            {formatTime(item.createdAt?.seconds ? item.createdAt.seconds * 1000 : Date.now())}
                        </Text>
                        {/* Follow back button */}
                        {isFollowType && !alreadyFollowing && item.actorId !== currentUserId && (
                            <TouchableOpacity
                                style={styles.followBackBtn}
                                onPress={() => onFollowBack(item.actorId)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.followBackText}>Follow Back</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
                {/* Post thumbnail */}
                {item.thumbnailUrl && (
                    <Image source={{ uri: item.thumbnailUrl }} style={styles.notifThumbnail} />
                )}
            </TouchableOpacity>
        </Animated.View>
    );
}

// ─── Main Screen ───
export default function NotificationsScreen() {
    const { user, userProfile, refreshProfile } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { C } = useAppTheme();
    const { showToast, showConfirm } = useToast();
    const [notifications, setNotifications] = useState([]);
    const [sections, setSections] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const prevNotifCountRef = useRef(0);

    const getNotifTextSimple = (type) => {
        switch (type) {
            case 'like': return 'liked your post';
            case 'comment': return 'commented on your post';
            case 'reply': return 'replied to your comment';
            case 'follow': return 'started following you';
            case 'mention': return 'mentioned you';
            case 'reshare': return 'reshared your post';
            case 'share': return 'shared your post';
            case 'story_reaction': return 'reacted to your story';
            default: return 'interacted with you';
        }
    };

    // Set up notification tap handler
    useEffect(() => {
        const sub = setupNotificationResponseListener(router);
        return () => sub?.remove();
    }, []);

    useEffect(() => {
        if (!user) return;

        // Track fallback unsub so we can clean it up
        let fallbackUnsub = null;

        const q = query(
            collection(db, 'notifications'),
            where('targetUserId', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(200)
        );

        const unsub = onSnapshot(q, async (snapshot) => {
            const notifs = [];
            const blockedIds = userProfile?.blockedUsers || [];
            for (const docSnap of snapshot.docs) {
                const data = { id: docSnap.id, ...docSnap.data() };
                // Skip notifications from blocked users
                if (blockedIds.includes(data.actorId)) continue;
                if (data.actorId) {
                    try {
                        const profile = await getUserProfile(data.actorId);
                        data.actor = profile;
                    } catch (e) { }
                }
                notifs.push(data);
            }
            setNotifications(notifs);
            setSections(groupNotifications(notifs));

            // Only mark read if there are actually unread notifications
            const hasUnread = notifs.some(n => !n.read);
            if (hasUnread) markAllNotificationsRead(user.uid);

            // Foreground push for new notifications
            if (prevNotifCountRef.current > 0 && notifs.length > prevNotifCountRef.current) {
                const newest = notifs[0];
                if (newest && !newest.read) {
                    showLocalNotification(
                        'Banana Chat 🍌',
                        `${newest.actor?.displayName || 'Someone'} ${getNotifTextSimple(newest.type)}`,
                        { postId: newest.postId, userId: newest.actorId }
                    );
                }
            }
            prevNotifCountRef.current = notifs.length;
        }, (err) => {
            console.warn(
                '⚠️ Notifications composite index missing. Create it in Firebase Console:\n' +
                '   Collection: notifications | Fields: targetUserId ASC, createdAt DESC\n' +
                '   Falling back to unordered query. Error:', err.message
            );
            const fallbackQ = query(
                collection(db, 'notifications'),
                where('targetUserId', '==', user.uid),
                limit(200)
            );
            fallbackUnsub = onSnapshot(fallbackQ, async (snap) => {
                const notifs = [];
                for (const d of snap.docs) {
                    const data = { id: d.id, ...d.data() };
                    if (data.actorId) {
                        try { data.actor = await getUserProfile(data.actorId); } catch {}
                    }
                    notifs.push(data);
                }
                notifs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setNotifications(notifs);
                setSections(groupNotifications(notifs));
            });
        });

        return () => {
            unsub();
            if (fallbackUnsub) fallbackUnsub();
        };
    }, [user]);


    const handleNotifPress = async (item) => {
        if (!item.read) {
            try { await updateDoc(doc(db, 'notifications', item.id), { read: true }); } catch { }
        }
        if (item.postId) {
            router.push(`/post/${item.postId}`);
        } else if (item.actorId) {
            router.push(`/user/${item.actorId}`);
        }
    };

    const handleDeleteNotif = async (notifId) => {
        try {
            await deleteDoc(doc(db, 'notifications', notifId));
            setNotifications(prev => {
                const updated = prev.filter(n => n.id !== notifId);
                setSections(groupNotifications(updated));
                return updated;
            });
        } catch (err) {
            showToast('Could not delete notification', 'error');
        }
    };

    const handleFollowBack = async (actorId) => {
        try {
            await followUser(user.uid, actorId);
            if (refreshProfile) await refreshProfile();
            showToast('You are now following this user', 'success', 'Followed!');
        } catch (err) {
            showToast('Could not follow user', 'error');
        }
    };

    const handleClearAll = () => {
        showConfirm('Clear All', 'Delete all notifications?',
            async () => {
                for (const n of notifications) {
                    try { await deleteDoc(doc(db, 'notifications', n.id)); } catch { }
                }
                setNotifications([]);
                setSections([]);
            },
            { variant: 'destructive', confirmText: 'Clear All', icon: 'trash-outline' }
        );
    };

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            const q = query(
                collection(db, 'notifications'),
                where('targetUserId', '==', user.uid),
                limit(200)
            );
            const snapshot = await getDocs(q);
            const notifs = [];
            for (const docSnap of snapshot.docs) {
                const data = { id: docSnap.id, ...docSnap.data() };
                if (data.actorId) {
                    try { data.actor = await getUserProfile(data.actorId); } catch {}
                }
                notifs.push(data);
            }
            notifs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setNotifications(notifs);
            setSections(groupNotifications(notifs));
            await markAllNotificationsRead(user.uid);
        } catch (err) {
            console.warn('Notifications refresh error:', err.message);
        } finally {
            setRefreshing(false);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top, backgroundColor: C.background }]}>
            <View style={[styles.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
                <Text style={[styles.headerTitle, { color: C.text }]}>Activity</Text>
                {notifications.length > 0 && (
                    <TouchableOpacity onPress={handleClearAll}>
                        <Text style={[styles.clearAllText, { color: C.primary }]}>Clear All</Text>
                    </TouchableOpacity>
                )}
            </View>

            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id}
                renderSectionHeader={({ section: { title } }) => (
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{title}</Text>
                    </View>
                )}
                renderItem={({ item }) => (
                    <NotificationItem
                        item={item}
                        onPress={handleNotifPress}
                        onDelete={handleDeleteNotif}
                        onFollowBack={handleFollowBack}
                        currentUserId={user?.uid}
                        currentUserProfile={userProfile}
                    />
                )}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
                }
                ListEmptyComponent={() => (
                    <View style={styles.emptyState}>
                        <Ionicons name="heart-outline" size={64} color={Colors.textTertiary} />
                        <Text style={styles.emptyTitle}>No activity yet</Text>
                        <Text style={styles.emptySubtitle}>When people interact with you, you'll see it here</Text>
                    </View>
                )}
                stickySectionHeadersEnabled={false}
                contentContainerStyle={styles.listContent}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    headerTitle: { fontSize: FontSize.xxl, fontWeight: 'bold', color: Colors.text },
    clearAllText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: '600' },
    listContent: { paddingBottom: 20 },
    // Section headers
    sectionHeader: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.xs,
    },
    sectionTitle: {
        color: Colors.text,
        fontSize: FontSize.md,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    // Notification items
    deleteBackground: {
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 90,
        backgroundColor: Colors.error, justifyContent: 'center', alignItems: 'center',
    },
    deleteBtn: { alignItems: 'center' },
    deleteText: { color: '#fff', fontSize: FontSize.xs, marginTop: 2 },
    notifItem: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md, gap: Spacing.md, backgroundColor: Colors.background,
    },
    notifUnread: { backgroundColor: Colors.primarySurface + '30' },
    notifIconCircle: {
        width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center',
    },
    notifContent: { flex: 1 },
    notifRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    notifAvatar: { width: 32, height: 32, borderRadius: 16 },
    notifAvatarPlaceholder: {
        backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center',
    },
    notifAvatarText: { color: Colors.primary, fontSize: 12, fontWeight: 'bold' },
    notifText: { flex: 1, color: Colors.text, fontSize: FontSize.sm, lineHeight: 18 },
    notifBold: { fontWeight: '700' },
    notifBottom: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        marginTop: 4, marginLeft: 40,
    },
    notifTime: { color: Colors.textTertiary, fontSize: FontSize.xs },
    // Follow back button
    followBackBtn: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: BorderRadius.md,
    },
    followBackText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
    // Post thumbnail
    notifThumbnail: {
        width: 44, height: 44, borderRadius: 8,
        backgroundColor: Colors.surfaceLight,
    },
    // Empty state
    emptyState: { alignItems: 'center', paddingTop: 100 },
    emptyTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text, marginTop: 16 },
    emptySubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
});
