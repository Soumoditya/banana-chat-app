import { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    RefreshControl,
    Animated,
    Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, orderBy, onSnapshot, limit, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getUserProfile } from '../../services/users';
import { formatTime, getInitials } from '../../utils/helpers';

// Swipeable notification item
function NotificationItem({ item, onPress, onDelete }) {
    const translateX = useRef(new Animated.Value(0)).current;
    const itemHeight = useRef(new Animated.Value(72)).current;
    let lastGesture = 0;

    const getNotifIcon = (type) => {
        switch (type) {
            case 'like': return 'heart';
            case 'comment': return 'chatbubble';
            case 'follow': return 'person-add';
            case 'mention': return 'at';
            case 'share': return 'share';
            default: return 'notifications';
        }
    };

    const getNotifColor = (type) => {
        switch (type) {
            case 'like': return '#FF3D71';
            case 'comment': return Colors.secondary;
            case 'follow': return Colors.primary;
            case 'mention': return '#00E5FF';
            default: return Colors.textSecondary;
        }
    };

    const getNotifText = (item) => {
        switch (item.type) {
            case 'like': return 'liked your post';
            case 'comment': return 'commented on your post';
            case 'follow': return 'started following you';
            case 'mention': return 'mentioned you';
            case 'share': return 'shared your post';
            default: return item.message || 'interacted with you';
        }
    };

    const handleDelete = () => {
        Animated.parallel([
            Animated.timing(translateX, { toValue: -400, duration: 200, useNativeDriver: false }),
            Animated.timing(itemHeight, { toValue: 0, duration: 200, useNativeDriver: false }),
        ]).start(() => onDelete(item.id));
    };

    return (
        <Animated.View style={{ height: itemHeight, overflow: 'hidden' }}>
            {/* Delete background */}
            <View style={styles.deleteBackground}>
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                    <Ionicons name="trash" size={22} color="#fff" />
                    <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={[styles.notifItem, !item.read && styles.notifUnread]}
                onPress={() => onPress(item)}
                onLongPress={() => {
                    Alert.alert('Delete Notification', 'Remove this notification?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => onDelete(item.id) },
                    ]);
                }}
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
                            {' '}{getNotifText(item)}
                        </Text>
                    </View>
                    <Text style={styles.notifTime}>
                        {formatTime(item.createdAt?.seconds ? item.createdAt.seconds * 1000 : Date.now())}
                    </Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

export default function NotificationsScreen() {
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [notifications, setNotifications] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'notifications'),
            where('targetUserId', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(50)
        );

        const unsub = onSnapshot(q, async (snapshot) => {
            const notifs = [];
            for (const docSnap of snapshot.docs) {
                const data = { id: docSnap.id, ...docSnap.data() };
                if (data.actorId) {
                    try {
                        const profile = await getUserProfile(data.actorId);
                        data.actor = profile;
                    } catch (e) { }
                }
                notifs.push(data);
            }
            setNotifications(notifs);
        }, (err) => {
            console.log('Notifications query failed, collection may not exist yet');
            setNotifications([]);
        });

        return () => unsub();
    }, [user]);

    const handleNotifPress = async (item) => {
        // Mark as read
        if (!item.read) {
            try {
                await updateDoc(doc(db, 'notifications', item.id), { read: true });
            } catch { }
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
            setNotifications(prev => prev.filter(n => n.id !== notifId));
        } catch (err) {
            Alert.alert('Error', 'Could not delete notification');
        }
    };

    const handleClearAll = () => {
        Alert.alert('Clear All', 'Delete all notifications?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear All', style: 'destructive', onPress: async () => {
                    for (const n of notifications) {
                        try { await deleteDoc(doc(db, 'notifications', n.id)); } catch { }
                    }
                    setNotifications([]);
                }
            },
        ]);
    };

    const onRefresh = () => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 1000);
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Activity</Text>
                {notifications.length > 0 && (
                    <TouchableOpacity onPress={handleClearAll}>
                        <Text style={styles.clearAllText}>Clear All</Text>
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={notifications}
                renderItem={({ item }) => (
                    <NotificationItem
                        item={item}
                        onPress={handleNotifPress}
                        onDelete={handleDeleteNotif}
                    />
                )}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
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
    notifTime: { color: Colors.textTertiary, fontSize: FontSize.xs, marginTop: 2, marginLeft: 40 },
    emptyState: { alignItems: 'center', paddingTop: 100 },
    emptyTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text, marginTop: 16 },
    emptySubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
});
