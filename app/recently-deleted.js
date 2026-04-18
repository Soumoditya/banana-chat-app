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
        try {
            const deleted = await getRecentlyDeleted(user.uid);
            setItems(deleted);
        } catch (err) {
            console.error('Load deleted error:', err);
        }
    };

    const getDaysRemaining = (item) => {
        const expiresAt = item.expiresAt?.seconds
            ? new Date(item.expiresAt.seconds * 1000)
            : item.expiresAt instanceof Date ? item.expiresAt : new Date(item.expiresAt);
        const diff = expiresAt - new Date();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    };

    const handleRestore = (item) => {
        Alert.alert('Restore', `Restore this ${item.itemType || 'item'}?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Restore', onPress: async () => {
                await restoreFromTrash(item.id);
                loadItems();
            }},
        ]);
    };

    const handlePermanentDelete = (item) => {
        Alert.alert('Delete Permanently', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                await permanentlyDelete(item.id);
                loadItems();
            }},
        ]);
    };

    const handleDeleteAll = () => {
        Alert.alert('Delete All Permanently', `Delete all ${items.length} items? This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete All', style: 'destructive', onPress: async () => {
                for (const item of items) await permanentlyDelete(item.id);
                setItems([]);
            }},
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
                    const mediaUri = item.media || null;
                    const isPost = item.itemType === 'post';
                    const caption = item.content || item.text || '';

                    return (
                        <View style={styles.postCard}>
                            {/* Header */}
                            <View style={styles.postHeader}>
                                <View style={styles.headerLeft}>
                                    <Ionicons name={isPost ? 'document-text' : 'images'} size={16} color={Colors.error} />
                                    <Text style={styles.typeLabel}>{isPost ? '📝 Post' : '📸 Story'}</Text>
                                </View>
                                <Text style={[styles.daysText, days <= 5 && { color: Colors.error }]}>
                                    {days} day{days !== 1 ? 's' : ''} left
                                </Text>
                            </View>

                            {/* Caption */}
                            {caption ? <Text style={styles.caption} selectable numberOfLines={4}>{caption}</Text> : null}

                            {/* Media preview */}
                            {mediaUri ? (
                                <Image source={{ uri: mediaUri }} style={styles.mediaPreview} resizeMode="cover" />
                            ) : null}

                            {/* Actions */}
                            <View style={styles.actionsRow}>
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
                contentContainerStyle={{ paddingBottom: 40 }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
    deleteAllText: { color: Colors.error, fontSize: 13, fontWeight: '600' },
    infoBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: Colors.surfaceLight, marginHorizontal: 16, marginTop: 12,
        padding: 12, borderRadius: 10,
    },
    infoText: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
    postCard: { backgroundColor: Colors.surface, marginTop: 12, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden', borderWidth: 0.5, borderColor: Colors.border },
    postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    typeLabel: { color: Colors.text, fontSize: 14, fontWeight: '600' },
    daysText: { color: Colors.textTertiary, fontSize: 12, fontWeight: '500' },
    caption: { paddingHorizontal: 14, paddingBottom: 8, color: Colors.text, fontSize: 14, lineHeight: 20 },
    mediaPreview: { width: '100%', height: 250 },
    actionsRow: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: Colors.border },
    restoreBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, padding: 12, borderRightWidth: 0.5, borderRightColor: Colors.border,
    },
    restoreBtnText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
    permDeleteBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, padding: 12,
    },
    permDeleteText: { color: Colors.error, fontSize: 14, fontWeight: '600' },
    empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
    emptySubtitle: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
});
