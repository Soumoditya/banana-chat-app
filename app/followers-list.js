import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { getFollowers, getFollowing, getUserProfile } from '../services/users';
import { getInitials } from '../utils/helpers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAppTheme from '../hooks/useAppTheme';
import PremiumBadge from '../components/PremiumBadge';

export default function FollowersListScreen() {
    const { userId, tab } = useLocalSearchParams();
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { C, skin } = useAppTheme();
    const [activeTab, setActiveTab] = useState(tab || 'followers');
    const [followers, setFollowers] = useState([]);
    const [following, setFollowing] = useState([]);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        loadData();
    }, [userId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const p = await getUserProfile(userId);
            setProfile(p);
            const f1 = await getFollowers(userId);
            const f2 = await getFollowing(userId);
            setFollowers(f1);
            setFollowing(f2);
        } catch (err) {
            console.error('Error loading followers:', err);
        } finally {
            setLoading(false);
        }
    };

    const data = activeTab === 'followers' ? followers : following;

    return (
        <View style={[styles.container, { paddingTop: insets.top, backgroundColor: C.background }]}>
            <View style={[styles.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={C.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: C.text }]}>{profile?.username ? `@${profile.username}` : 'User'}</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'followers' && styles.tabActive]}
                    onPress={() => setActiveTab('followers')}
                >
                    <Text style={[styles.tabText, activeTab === 'followers' && styles.tabTextActive]}>
                        Followers ({followers.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'following' && styles.tabActive]}
                    onPress={() => setActiveTab('following')}
                >
                    <Text style={[styles.tabText, activeTab === 'following' && styles.tabTextActive]}>
                        Following ({following.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={data}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.userItem}
                            onPress={() => {
                                if (item.id === user?.uid) {
                                    router.push('/(tabs)/profile');
                                } else {
                                    router.push(`/user/${item.id}`);
                                }
                            }}
                        >
                            {item.avatar ? (
                                <Image source={{ uri: item.avatar }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                    <Text style={styles.avatarText}>{getInitials(item.displayName)}</Text>
                                </View>
                            )}
                            <View style={styles.userInfo}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                    <Text style={[styles.userName, { color: C.text }]}>{item.displayName}</Text>
                                    <PremiumBadge profile={item} size={13} />
                                </View>
                                <Text style={styles.userHandle}>@{item.username}</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={() => (
                        <View style={styles.empty}>
                            <Ionicons name="people-outline" size={48} color={Colors.textTertiary} />
                            <Text style={styles.emptyText}>
                                {activeTab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                            </Text>
                        </View>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
    tabs: {
        flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: Colors.border,
        backgroundColor: Colors.surface,
    },
    tab: {
        flex: 1, alignItems: 'center', paddingVertical: Spacing.md,
        borderBottomWidth: 2, borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: Colors.primary },
    tabText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: '600' },
    tabTextActive: { color: Colors.primary },
    userItem: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md, gap: Spacing.md,
        borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    avatarPlaceholder: { backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: Colors.primary, fontWeight: 'bold', fontSize: FontSize.md },
    userInfo: { flex: 1 },
    userName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
    userHandle: { color: Colors.textSecondary, fontSize: FontSize.sm },
    empty: { alignItems: 'center', paddingTop: 80 },
    emptyText: { fontSize: FontSize.md, color: Colors.textTertiary, marginTop: 12 },
});
