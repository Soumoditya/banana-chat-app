import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { getUserProfile, updateUserProfile } from '../services/users';
import { getInitials } from '../utils/helpers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function BlockedUsersScreen() {
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadBlockedUsers();
    }, []);

    const loadBlockedUsers = async () => {
        try {
            const blocked = userProfile?.blockedUsers || [];
            const users = [];
            for (const uid of blocked) {
                const profile = await getUserProfile(uid);
                if (profile) users.push(profile);
            }
            setBlockedUsers(users);
        } catch (err) {
            console.error('Error loading blocked users:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUnblock = async (uid) => {
        Alert.alert('Unblock User', 'Are you sure you want to unblock this user?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Unblock', style: 'destructive', onPress: async () => {
                    try {
                        const updated = (userProfile?.blockedUsers || []).filter(id => id !== uid);
                        await updateUserProfile(user.uid, { blockedUsers: updated });
                        setBlockedUsers(blockedUsers.filter(u => u.id !== uid));
                    } catch (err) {
                        Alert.alert('Error', 'Failed to unblock user');
                    }
                }
            },
        ]);
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Blocked Users</Text>
                <View style={{ width: 24 }} />
            </View>

            <FlatList
                data={blockedUsers}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View style={styles.userItem}>
                        {item.avatar ? (
                            <Image source={{ uri: item.avatar }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Text style={styles.avatarText}>{getInitials(item.displayName)}</Text>
                            </View>
                        )}
                        <View style={styles.userInfo}>
                            <Text style={styles.userName}>{item.displayName}</Text>
                            <Text style={styles.userHandle}>@{item.username}</Text>
                        </View>
                        <TouchableOpacity style={styles.unblockBtn} onPress={() => handleUnblock(item.id)}>
                            <Text style={styles.unblockText}>Unblock</Text>
                        </TouchableOpacity>
                    </View>
                )}
                ListEmptyComponent={() => (
                    <View style={styles.empty}>
                        <Ionicons name="shield-checkmark-outline" size={64} color={Colors.textTertiary} />
                        <Text style={styles.emptyTitle}>No Blocked Users</Text>
                        <Text style={styles.emptySubtitle}>Users you block will appear here</Text>
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
        backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    headerTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text },
    userItem: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md, gap: Spacing.md,
    },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    avatarPlaceholder: { backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: Colors.primary, fontWeight: 'bold', fontSize: FontSize.md },
    userInfo: { flex: 1 },
    userName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
    userHandle: { color: Colors.textSecondary, fontSize: FontSize.sm },
    unblockBtn: {
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.error,
    },
    unblockText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: '600' },
    empty: { alignItems: 'center', paddingTop: 100 },
    emptyTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text, marginTop: 16 },
    emptySubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: 8 },
});
