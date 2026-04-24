import { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addCloseFriend, removeCloseFriend } from '../services/users';
import { getInitials } from '../utils/helpers';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function CloseFriendsScreen() {
    const { user, userProfile, refreshProfile } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [search, setSearch] = useState('');
    const [friends, setFriends] = useState([]);
    const [closeFriendIds, setCloseFriendIds] = useState(userProfile?.closeFriends || []);

    useEffect(() => { loadFriends(); }, []);

    const loadFriends = async () => {
        // Load all friends/following to pick close friends from
        const followingIds = userProfile?.following || userProfile?.friends || [];
        if (followingIds.length === 0) return;

        const batches = [];
        for (let i = 0; i < followingIds.length; i += 10) {
            batches.push(followingIds.slice(i, i + 10));
        }

        let allFriends = [];
        for (const batch of batches) {
            const q = query(collection(db, 'users'), where('__name__', 'in', batch));
            const snap = await getDocs(q);
            allFriends = [...allFriends, ...snap.docs.map(d => ({ id: d.id, ...d.data() }))];
        }
        setFriends(allFriends);
    };

    const toggleCloseFriend = async (friendId) => {
        if (closeFriendIds.includes(friendId)) {
            await removeCloseFriend(user.uid, friendId);
            setCloseFriendIds(prev => prev.filter(id => id !== friendId));
        } else {
            await addCloseFriend(user.uid, friendId);
            setCloseFriendIds(prev => [...prev, friendId]);
        }
        refreshProfile();
    };

    const filtered = search
        ? friends.filter(f =>
            f.displayName?.toLowerCase().includes(search.toLowerCase()) ||
            f.username?.toLowerCase().includes(search.toLowerCase())
        )
        : friends;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Close Friends</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.info}>
                <View style={styles.infoBadge}>
                    <Ionicons name="star" size={16} color="#00E676" />
                </View>
                <Text style={styles.infoText}>
                    Close friends can see your Snaps and Memories. Only you know who's on this list.
                </Text>
            </View>

            <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color={Colors.textTertiary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search friends..."
                    placeholderTextColor={Colors.textTertiary}
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            <Text style={styles.sectionLabel}>
                {closeFriendIds.length} close friend{closeFriendIds.length !== 1 ? 's' : ''}
            </Text>

            <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                    const isClose = closeFriendIds.includes(item.id);
                    return (
                        <TouchableOpacity style={styles.friendItem} onPress={() => toggleCloseFriend(item.id)}>
                            {item.avatar ? (
                                <Image source={{ uri: item.avatar }} style={styles.friendAvatar} />
                            ) : (
                                <View style={[styles.friendAvatar, styles.avatarPlaceholder]}>
                                    <Text style={styles.avatarInitials}>{getInitials(item.displayName)}</Text>
                                </View>
                            )}
                            <View style={styles.friendInfo}>
                                <Text style={styles.friendName}>{item.displayName}</Text>
                                <Text style={styles.friendUsername}>@{item.username}</Text>
                            </View>
                            <View style={[styles.toggleCircle, isClose && styles.toggleCircleActive]}>
                                {isClose && <Ionicons name="star" size={16} color="#00E676" />}
                            </View>
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={() => (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>Follow people to add them as close friends</Text>
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
    headerTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text },
    info: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        padding: Spacing.lg, backgroundColor: Colors.surfaceLight, margin: Spacing.lg,
        borderRadius: BorderRadius.lg,
    },
    infoBadge: {
        width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,230,118,0.15)',
        justifyContent: 'center', alignItems: 'center',
    },
    infoText: { flex: 1, color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 18 },
    searchBar: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        marginHorizontal: Spacing.lg, backgroundColor: Colors.surfaceLight,
        borderRadius: BorderRadius.xl, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    },
    searchInput: { flex: 1, color: Colors.text, fontSize: FontSize.md },
    sectionLabel: { color: Colors.textTertiary, fontSize: FontSize.sm, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
    friendItem: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md, gap: Spacing.md,
    },
    friendAvatar: { width: 44, height: 44, borderRadius: 22 },
    avatarPlaceholder: { backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    avatarInitials: { color: Colors.primary, fontWeight: 'bold' },
    friendInfo: { flex: 1 },
    friendName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
    friendUsername: { color: Colors.textSecondary, fontSize: FontSize.sm },
    toggleCircle: {
        width: 28, height: 28, borderRadius: 14, borderWidth: 2,
        borderColor: Colors.border, justifyContent: 'center', alignItems: 'center',
    },
    toggleCircleActive: { borderColor: '#00E676', backgroundColor: 'rgba(0,230,118,0.15)' },
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { color: Colors.textTertiary, fontSize: FontSize.md },
});
