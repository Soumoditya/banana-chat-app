import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { getOrCreateDMChat, sendMessage } from '../../services/chat';
import { getPost } from '../../services/posts';
import { getUserProfile } from '../../services/users';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getInitials } from '../../utils/helpers';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useToast } from '../../contexts/ToastContext';

export default function SharePostScreen() {
    const { id: postId } = useLocalSearchParams();
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { showToast } = useToast();
    const [following, setFollowing] = useState([]);
    const [sending, setSending] = useState(null);
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const p = await getPost(postId);
            // Lookup actual author name
            if (p?.authorId) {
                try {
                    const authorProfile = await getUserProfile(p.authorId);
                    p._authorName = authorProfile?.displayName || 'User';
                } catch { p._authorName = 'User'; }
            }
            setPost(p);

            // Get following list
            const followingIds = userProfile?.following || [];
            if (followingIds.length > 0) {
                const batches = [];
                for (let i = 0; i < followingIds.length; i += 10) {
                    const batch = followingIds.slice(i, i + 10);
                    const q = query(collection(db, 'users'), where('__name__', 'in', batch));
                    batches.push(getDocs(q));
                }
                const results = await Promise.all(batches);
                const users = [];
                results.forEach(snap => {
                    snap.docs.forEach(d => users.push({ id: d.id, ...d.data() }));
                });
                setFollowing(users);
            }
        } catch (err) {
            console.error('Share load error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async (targetUser) => {
        if (sending) return;
        setSending(targetUser.id);
        try {
            const chat = await getOrCreateDMChat(user.uid, targetUser.id);
            const chatId = chat.id || chat;
            await sendMessage(chatId, {
                senderId: user.uid,
                text: `📎 Shared a post`,
                type: 'post',
                media: {
                    postId: postId,
                    content: post?.content?.substring(0, 100) || '',
                    thumbnail: typeof post?.media?.[0] === 'string' ? post.media[0] : post?.media?.[0]?.uri || null,
                    authorName: post?._authorName || post?.authorName || 'User',
                },
            });
            showToast(`Post shared with ${targetUser.displayName || targetUser.username}`, 'success', 'Sent!');
            router.back();
        } catch (err) {
            console.error('Send error:', err);
            showToast('Could not send post: ' + (err.message || 'Unknown'), 'error');
        } finally {
            setSending(null);
        }
    };

    const renderUser = ({ item }) => (
        <TouchableOpacity style={styles.userRow} onPress={() => handleSend(item)} disabled={sending === item.id}>
            {item.avatar ? (
                <Image source={{ uri: item.avatar }} style={styles.avatar} />
            ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>{getInitials(item.displayName)}</Text>
                </View>
            )}
            <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.displayName || item.username}</Text>
                <Text style={styles.userHandle}>@{item.username}</Text>
            </View>
            {sending === item.id ? (
                <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
                <Ionicons name="send" size={20} color={Colors.primary} />
            )}
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Send to</Text>
                <View style={{ width: 24 }} />
            </View>

            {post && (
                <View style={styles.postPreview}>
                    {typeof post.media?.[0] === 'string' ? (
                        <Image source={{ uri: post.media[0] }} style={styles.previewImage} />
                    ) : post.media?.[0]?.uri ? (
                        <Image source={{ uri: post.media[0].uri }} style={styles.previewImage} />
                    ) : null}
                    <Text style={styles.previewText} numberOfLines={2}>{post.content || 'Post'}</Text>
                </View>
            )}

            {loading ? (
                <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
            ) : following.length === 0 ? (
                <Text style={styles.emptyText}>No users to send to. Follow some people first!</Text>
            ) : (
                <FlatList
                    data={following}
                    renderItem={renderUser}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingBottom: 40 }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
    title: { fontSize: 18, fontWeight: '700', color: Colors.text },
    postPreview: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card },
    previewImage: { width: 50, height: 50, borderRadius: 8, marginRight: 12 },
    previewText: { flex: 1, color: Colors.text, fontSize: 14 },
    userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
    avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
    avatarPlaceholder: { backgroundColor: Colors.card, justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: Colors.primary, fontWeight: '700', fontSize: 16 },
    userInfo: { flex: 1 },
    userName: { color: Colors.text, fontWeight: '600', fontSize: 15 },
    userHandle: { color: Colors.textSecondary, fontSize: 13 },
    emptyText: { color: Colors.textSecondary, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
});
