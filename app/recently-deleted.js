import { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getRecentlyDeleted, restoreFromTrash, permanentlyDelete } from '../services/stories';

export default function RecentlyDeletedScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [items, setItems] = useState([]);

    useEffect(() => { loadItems(); }, []);

    const loadItems = async () => {
        if (!user) return;
        const deleted = await getRecentlyDeleted(user.uid);
        setItems(deleted);
    };

    const getDaysRemaining = (item) => {
        const expiresAt = item.expiresAt?.seconds
            ? new Date(item.expiresAt.seconds * 1000)
            : item.expiresAt instanceof Date ? item.expiresAt : new Date(item.expiresAt);
        const diff = expiresAt - new Date();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    };

    const handleRestore = (item) => {
        Alert.alert('Restore', `Restore this ${item.itemType}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Restore', onPress: async () => {
                    await restoreFromTrash(item.id);
                    loadItems();
                }
            },
        ]);
    };

    const handlePermanentDelete = (item) => {
        Alert.alert('Delete Permanently', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    await permanentlyDelete(item.id);
                    loadItems();
                }
            },
        ]);
    };

    const handleDeleteAll = () => {
        Alert.alert('Delete All Permanently', `Delete all ${items.length} items? This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete All', style: 'destructive', onPress: async () => {
                    for (const item of items) await permanentlyDelete(item.id);
                    setItems([]);
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
                <Text style={styles.headerTitle}>Recently Deleted</Text>
                {items.length > 0 ? (
                    <TouchableOpacity onPress={handleDeleteAll}>
                        <Text style={styles.deleteAllText}>Delete All</Text>
                    </TouchableOpacity>
                ) : <View style={{ width: 60 }} />}
            </View>

            <View style={styles.infoBanner}>
                <Ionicons name="information-circle" size={18} color={Colors.accent} />
                <Text style={styles.infoText}>
                    Items here are permanently deleted after 30 days. You can restore or delete them sooner.
                </Text>
            </View>

            <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                    const days = getDaysRemaining(item);
                    return (
                        <View style={styles.itemCard}>
                            <View style={styles.itemRow}>
                                {item.media ? (
                                    <Image source={{ uri: item.media }} style={styles.itemThumb} />
                                ) : (
                                    <View style={[styles.itemThumb, styles.itemThumbPlaceholder]}>
                                        <Ionicons
                                            name={item.itemType === 'story' ? 'images' : 'document-text'}
                                            size={20}
                                            color={Colors.textTertiary}
                                        />
                                    </View>
                                )}
                                <View style={styles.itemInfo}>
                                    <Text style={styles.itemType}>
                                        {item.itemType === 'story' ? '📸 Story' : '📝 Post'}
                                    </Text>
                                    {item.text ? (
                                        <Text style={styles.itemText} numberOfLines={1}>{item.text}</Text>
                                    ) : item.content ? (
                                        <Text style={styles.itemText} numberOfLines={1}>{item.content}</Text>
                                    ) : null}
                                    <Text style={[styles.itemDays, days <= 5 && { color: Colors.error }]}>
                                        {days} day{days !== 1 ? 's' : ''} remaining
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.itemActions}>
                                <TouchableOpacity style={styles.restoreBtn} onPress={() => handleRestore(item)}>
                                    <Ionicons name="refresh" size={16} color={Colors.primary} />
                                    <Text style={styles.restoreBtnText}>Restore</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.permDeleteBtn} onPress={() => handlePermanentDelete(item)}>
                                    <Ionicons name="trash" size={16} color={Colors.error} />
                                    <Text style={styles.permDeleteText}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                }}
                ListEmptyComponent={() => (
                    <View style={styles.empty}>
                        <Ionicons name="trash-outline" size={56} color={Colors.textTertiary} />
                        <Text style={styles.emptyTitle}>No deleted items</Text>
                        <Text style={styles.emptySubtitle}>Items you delete will appear here for 30 days</Text>
                    </View>
                )}
                contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}
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
    deleteAllText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: '600' },
    infoBanner: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Colors.surfaceLight, margin: Spacing.lg,
        padding: Spacing.md, borderRadius: BorderRadius.md,
    },
    infoText: { flex: 1, color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 18 },
    itemCard: {
        backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
        marginBottom: Spacing.md, overflow: 'hidden',
        borderWidth: 0.5, borderColor: Colors.border,
    },
    itemRow: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.md },
    itemThumb: { width: 56, height: 56, borderRadius: BorderRadius.sm },
    itemThumbPlaceholder: {
        backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center',
    },
    itemInfo: { flex: 1, justifyContent: 'center' },
    itemType: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
    itemText: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
    itemDays: { color: Colors.textTertiary, fontSize: FontSize.xs, marginTop: 4 },
    itemActions: {
        flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: Colors.border,
    },
    restoreBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: Spacing.xs, padding: Spacing.md,
        borderRightWidth: 0.5, borderRightColor: Colors.border,
    },
    restoreBtnText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
    permDeleteBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: Spacing.xs, padding: Spacing.md,
    },
    permDeleteText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: '600' },
    empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
    emptyTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text },
    emptySubtitle: { color: Colors.textSecondary, fontSize: FontSize.md, textAlign: 'center', paddingHorizontal: 40 },
});
