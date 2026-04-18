import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getArchivedPosts, unarchivePost, permanentlyDeletePost } from '../services/posts';
import { Video, ResizeMode } from 'expo-av';

export default function ArchivedPostsScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadPosts(); }, []);

    const loadPosts = async () => {
        if (!user) return;
        try {
            const archived = await getArchivedPosts(user.uid);
            setPosts(archived);
        } catch (err) {
            console.error('Load archived error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUnarchive = (postId) => {
        Alert.alert('Unarchive', 'Move this post back to your profile?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Unarchive', onPress: async () => {
                try {
                    await unarchivePost(postId);
                    setPosts(prev => prev.filter(p => p.id !== postId));
                } catch (err) { Alert.alert('Error', err.message); }
            }},
        ]);
    };

    const handleDelete = (postId) => {
        Alert.alert('Delete Permanently', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                try {
                    await permanentlyDeletePost(postId);
                    setPosts(prev => prev.filter(p => p.id !== postId));
                } catch (err) { Alert.alert('Error', err.message); }
            }},
        ]);
    };

    const renderItem = ({ item }) => {
        const mediaUri = typeof item.media?.[0] === 'string' ? item.media[0] : item.media?.[0]?.uri;
        const isVideo = mediaUri && (mediaUri.includes('video') || mediaUri.match(/\.(mp4|mov|avi)/i));
        const date = item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000) : null;

        return (
            <View style={styles.postCard}>
                {/* Header */}
                <View style={styles.postHeader}>
                    <View style={styles.headerLeft}>
                        <Ionicons name="archive" size={16} color={Colors.primary} />
                        <Text style={styles.archiveLabel}>Archived</Text>
                    </View>
                    {date && <Text style={styles.dateText}>{date.toLocaleDateString()} {date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</Text>}
                </View>

                {/* Content */}
                {item.content ? (
                    <Text style={styles.caption} selectable>{item.content}</Text>
                ) : null}

                {/* Media */}
                {mediaUri && (
                    <View style={styles.mediaWrap}>
                        {isVideo ? (
                            <Video source={{ uri: mediaUri }} style={styles.media} resizeMode={ResizeMode.COVER} shouldPlay={false} useNativeControls />
                        ) : (
                            <Image source={{ uri: mediaUri }} style={styles.media} resizeMode="cover" />
                        )}
                    </View>
                )}

                {/* Stats */}
                <View style={styles.statsRow}>
                    <Text style={styles.statText}>❤️ {item.upvotes || 0}</Text>
                    <Text style={styles.statText}>💬 {item.commentCount || 0}</Text>
                    <Text style={styles.statText}>🔁 {item.shareCount || 0}</Text>
                </View>

                {/* Actions */}
                <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleUnarchive(item.id)}>
                        <Ionicons name="arrow-undo" size={18} color={Colors.primary} />
                        <Text style={styles.actionTextPrimary}>Restore</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item.id)}>
                        <Ionicons name="trash-outline" size={18} color={Colors.error} />
                        <Text style={styles.actionTextDanger}>Delete</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Archived Posts</Text>
                <View style={{ width: 24 }} />
            </View>
            <FlatList
                data={posts}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingBottom: 40 }}
                ListEmptyComponent={() => (
                    <View style={styles.empty}>
                        <Ionicons name="archive-outline" size={56} color={Colors.textTertiary} />
                        <Text style={styles.emptyTitle}>No archived posts</Text>
                        <Text style={styles.emptySubtitle}>Posts you archive will appear here</Text>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
    postCard: { backgroundColor: Colors.surface, marginBottom: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    archiveLabel: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
    dateText: { color: Colors.textTertiary, fontSize: 12 },
    caption: { paddingHorizontal: 14, paddingBottom: 8, color: Colors.text, fontSize: 14, lineHeight: 20 },
    mediaWrap: { width: '100%' },
    media: { width: '100%', height: 300 },
    statsRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 14, paddingVertical: 8 },
    statText: { color: Colors.textSecondary, fontSize: 13 },
    actionsRow: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: Colors.border },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
    actionTextPrimary: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
    actionTextDanger: { color: Colors.error, fontWeight: '600', fontSize: 14 },
    empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
    emptySubtitle: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
});
