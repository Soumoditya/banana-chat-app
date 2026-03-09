import { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image, ScrollView, Modal, Alert, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { getFeedPosts, upvotePost, downvotePost, savePost, unsavePost, incrementShareCount } from '../../services/posts';
import { getStories } from '../../services/stories';
import { getUserProfile } from '../../services/users';
import { formatTime, formatCount, getInitials } from '../../utils/helpers';
import { FEED_FILTERS } from '../../utils/constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SWIPE_THRESHOLD = 100;

export default function HomeScreen() {
    const { user, userProfile, isAdmin } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [posts, setPosts] = useState([]);
    const [stories, setStories] = useState({});
    const [filter, setFilter] = useState('all');
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [authors, setAuthors] = useState({});
    const [showFilterModal, setShowFilterModal] = useState(false);

    const onSwipeGesture = (event) => {
        if (event.nativeEvent.state === State.END) {
            const { translationX } = event.nativeEvent;
            if (translationX < -SWIPE_THRESHOLD) {
                // Left swipe → open chats
                router.push('/(tabs)/chats');
            } else if (translationX > SWIPE_THRESHOLD) {
                // Right swipe → open story camera
                router.push('/create?tab=story');
            }
        }
    };

    const loadFeed = useCallback(async () => {
        try {
            const feedPosts = await getFeedPosts(filter, userProfile);
            setPosts(feedPosts);

            const authorMap = { ...authors };
            for (const post of feedPosts) {
                if (!authorMap[post.authorId]) {
                    const profile = await getUserProfile(post.authorId);
                    if (profile) authorMap[post.authorId] = profile;
                }
            }
            setAuthors(authorMap);
        } catch (err) {
            console.error('Feed error:', err);
        } finally {
            setLoading(false);
        }
    }, [filter, userProfile]);

    const loadStories = useCallback(async () => {
        try {
            const storyData = await getStories(userProfile);
            setStories(storyData);
        } catch (err) {
            console.error('Stories error:', err);
        }
    }, [userProfile]);

    useEffect(() => {
        loadFeed();
        loadStories();
    }, [loadFeed, loadStories]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([loadFeed(), loadStories()]);
        setRefreshing(false);
    };

    const handleUpvote = async (postId) => {
        if (!user) return;
        await upvotePost(postId, user.uid);
        loadFeed();
    };

    const handleDownvote = async (postId) => {
        if (!user) return;
        await downvotePost(postId, user.uid);
        loadFeed();
    };

    const handleSave = async (postId) => {
        if (!user) return;
        try {
            const isSaved = userProfile?.savedPosts?.includes(postId);
            if (isSaved) {
                await unsavePost(postId, user.uid);
            } else {
                await savePost(postId, user.uid);
            }
        } catch (err) {
            console.error('Save error:', err);
        }
    };

    const handleShare = async (postId) => {
        try {
            await Share.share({ message: `Check out this post on Banana Chat! 🍌` });
            await incrementShareCount(postId);
            loadFeed();
        } catch { }
    };

    const filterLabels = { all: 'All', latest: 'Latest', friends: 'Friends', following: 'Following' };

    const renderStoryCircle = (authorId) => {
        const author = authors[authorId];
        return (
            <TouchableOpacity
                key={authorId}
                style={styles.storyCircle}
                onPress={() => router.push(`/story/${authorId}`)}
            >
                <View style={styles.storyRing}>
                    {author?.avatar ? (
                        <Image source={{ uri: author.avatar }} style={styles.storyAvatar} />
                    ) : (
                        <View style={[styles.storyAvatar, styles.storyAvatarPlaceholder]}>
                            <Text style={styles.storyInitials}>{getInitials(author?.displayName)}</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.storyName} numberOfLines={1}>
                    {author?.username || 'User'}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderPost = ({ item: post }) => {
        const author = authors[post.authorId];
        const isUpvoted = post.upvotedBy?.includes(user?.uid);
        const isDownvoted = post.downvotedBy?.includes(user?.uid);
        const isSaved = userProfile?.savedPosts?.includes(post.id);

        return (
            <TouchableOpacity
                style={styles.postCard}
                onPress={() => router.push(`/post/${post.id}`)}
                activeOpacity={0.8}
            >
                <View style={styles.postHeader}>
                    <TouchableOpacity
                        style={styles.postAuthor}
                        onPress={() => router.push(`/user/${post.authorId}`)}
                    >
                        {author?.avatar ? (
                            <Image source={{ uri: author.avatar }} style={styles.authorAvatar} />
                        ) : (
                            <View style={[styles.authorAvatar, styles.avatarPlaceholder]}>
                                <Text style={styles.avatarInitials}>{getInitials(author?.displayName)}</Text>
                            </View>
                        )}
                        <View>
                            <Text style={styles.authorName}>{author?.displayName || 'User'}</Text>
                            <Text style={styles.postTime}>
                                @{author?.username} · {formatTime(post.createdAt?.seconds ? post.createdAt.seconds * 1000 : Date.now())}
                            </Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity>
                        <Ionicons name="ellipsis-horizontal" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {post.content ? (
                    <Text style={styles.postContent}>
                        {post.content.split(/(@\w+)/g).map((part, i) => {
                            if (part.startsWith('@')) {
                                return (
                                    <Text key={i} style={{ color: Colors.primary, fontWeight: '600' }} onPress={() => router.push(`/user/${part.substring(1)}`)}>                                        {part}
                                    </Text>
                                );
                            }
                            return <Text key={i}>{part}</Text>;
                        })}
                    </Text>
                ) : null}

                {post.media?.length > 0 && (
                    <View style={styles.mediaContainer}>
                        <Image source={{ uri: post.media[0] }} style={styles.postImage} resizeMode="cover" />
                        {post.media.length > 1 && (
                            <View style={styles.mediaCount}>
                                <Text style={styles.mediaCountText}>+{post.media.length - 1}</Text>
                            </View>
                        )}
                    </View>
                )}

                {post.poll && (
                    <View style={styles.pollContainer}>
                        {post.poll.options?.map((option, index) => {
                            const totalVotes = post.poll.options.reduce((sum, o) => sum + (o.votes || 0), 0);
                            const percentage = totalVotes > 0 ? ((option.votes || 0) / totalVotes * 100).toFixed(0) : 0;
                            return (
                                <TouchableOpacity key={index} style={styles.pollOption}>
                                    <View style={[styles.pollBar, { width: `${percentage}%` }]} />
                                    <Text style={styles.pollText}>{option.text}</Text>
                                    <Text style={styles.pollPercent}>{percentage}%</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                <View style={styles.postActions}>
                    <View style={styles.voteContainer}>
                        <TouchableOpacity onPress={() => handleUpvote(post.id)} style={styles.voteBtn}>
                            <Ionicons name={isUpvoted ? "arrow-up-circle" : "arrow-up-circle-outline"} size={24} color={isUpvoted ? Colors.upvote : Colors.textSecondary} />
                        </TouchableOpacity>
                        <Text style={[styles.voteCount, (post.upvotes - post.downvotes) > 0 && styles.voteCountPositive]}>
                            {formatCount((post.upvotes || 0) - (post.downvotes || 0))}
                        </Text>
                        <TouchableOpacity onPress={() => handleDownvote(post.id)} style={styles.voteBtn}>
                            <Ionicons name={isDownvoted ? "arrow-down-circle" : "arrow-down-circle-outline"} size={24} color={isDownvoted ? Colors.downvote : Colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/post/${post.id}`)}>
                        <Ionicons name="chatbubble-outline" size={20} color={Colors.textSecondary} />
                        <Text style={styles.actionCount}>{formatCount(post.commentCount || 0)}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(post.id)}>
                        <Ionicons name="paper-plane-outline" size={20} color={Colors.textSecondary} />
                        {(post.shareCount || 0) > 0 && (
                            <Text style={styles.actionCount}>{formatCount(post.shareCount)}</Text>
                        )}
                    </TouchableOpacity>

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity onPress={() => handleSave(post.id)}>
                        <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={22} color={isSaved ? Colors.primary : Colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <PanGestureHandler onHandlerStateChange={onSwipeGesture}>
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>🍌 Banana Chat</Text>
                <View style={styles.headerRight}>
                    {isAdmin && (
                        <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/admin')}>
                            <Ionicons name="shield" size={22} color={Colors.primary} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.headerBtn} onPress={() => setShowFilterModal(true)}>
                        <Ionicons name="funnel-outline" size={20} color={Colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/(tabs)/chats')}>
                        <Ionicons name="paper-plane-outline" size={22} color={Colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={posts}
                renderItem={renderPost}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
                }
                ListHeaderComponent={() => (
                    <View>
                        {/* Stories */}
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.storiesContainer}
                            contentContainerStyle={styles.storiesContent}
                        >
                            <TouchableOpacity style={styles.storyCircle} onPress={() => router.push('/create')}>
                                <View style={[styles.storyRing, styles.addStoryRing]}>
                                    <View style={[styles.storyAvatar, styles.addStoryAvatar]}>
                                        <Ionicons name="add" size={28} color={Colors.primary} />
                                    </View>
                                </View>
                                <Text style={styles.storyName}>Your Story</Text>
                            </TouchableOpacity>
                            {Object.keys(stories).map(authorId => renderStoryCircle(authorId))}
                        </ScrollView>

                        {/* Active filter indicator */}
                        {filter !== 'all' && (
                            <View style={styles.activeFilter}>
                                <Text style={styles.activeFilterText}>
                                    Showing: {filterLabels[filter]}
                                </Text>
                                <TouchableOpacity onPress={() => setFilter('all')}>
                                    <Ionicons name="close-circle" size={18} color={Colors.primary} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
                ListEmptyComponent={() => (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyEmoji}>🍌</Text>
                        <Text style={styles.emptyTitle}>No posts yet</Text>
                        <Text style={styles.emptySubtitle}>Be the first to post something!</Text>
                    </View>
                )}
            />

            {/* Filter Modal */}
            <Modal visible={showFilterModal} transparent animationType="fade" onRequestClose={() => setShowFilterModal(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowFilterModal(false)}>
                    <View style={[styles.filterModal, { top: insets.top + 60 }]}>
                        {Object.entries(filterLabels).map(([key, label]) => (
                            <TouchableOpacity
                                key={key}
                                style={[styles.filterOption, filter === key && styles.filterOptionActive]}
                                onPress={() => { setFilter(key); setShowFilterModal(false); }}
                            >
                                <Text style={[styles.filterOptionText, filter === key && styles.filterOptionTextActive]}>
                                    {label}
                                </Text>
                                {filter === key && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
        </PanGestureHandler>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    headerTitle: { fontSize: FontSize.xxl, fontWeight: 'bold', color: Colors.primary },
    headerRight: { flexDirection: 'row', gap: Spacing.sm },
    headerBtn: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceLight,
        justifyContent: 'center', alignItems: 'center',
    },
    listContent: { paddingBottom: 20 },
    // Stories
    storiesContainer: { borderBottomWidth: 0.5, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
    storiesContent: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md },
    storyCircle: { alignItems: 'center', width: 72 },
    storyRing: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: Colors.primary, justifyContent: 'center', alignItems: 'center', padding: 2 },
    addStoryRing: { borderColor: Colors.border, borderStyle: 'dashed' },
    storyAvatar: { width: 56, height: 56, borderRadius: 28 },
    storyAvatarPlaceholder: { backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    addStoryAvatar: { backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    storyInitials: { color: Colors.text, fontSize: FontSize.lg, fontWeight: 'bold' },
    storyName: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 4, maxWidth: 64, textAlign: 'center' },
    // Active filter
    activeFilter: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 8, backgroundColor: Colors.primarySurface,
    },
    activeFilterText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
    // Posts
    postCard: {
        backgroundColor: Colors.surface, marginHorizontal: Spacing.sm, marginTop: Spacing.sm,
        borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 0.5, borderColor: Colors.border,
    },
    postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    postAuthor: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    authorAvatar: { width: 40, height: 40, borderRadius: 20 },
    avatarPlaceholder: { backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    avatarInitials: { color: Colors.primary, fontSize: FontSize.md, fontWeight: 'bold' },
    authorName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
    postTime: { color: Colors.textTertiary, fontSize: FontSize.xs },
    postContent: { color: Colors.text, fontSize: FontSize.md, lineHeight: 22, marginBottom: Spacing.md },
    mediaContainer: { borderRadius: BorderRadius.md, overflow: 'hidden', marginBottom: Spacing.md, position: 'relative' },
    postImage: { width: '100%', height: 250, borderRadius: BorderRadius.md },
    mediaCount: { position: 'absolute', top: 8, right: 8, backgroundColor: Colors.overlay, borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
    mediaCountText: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
    pollContainer: { marginBottom: Spacing.md },
    pollOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, marginBottom: Spacing.xs, overflow: 'hidden', position: 'relative' },
    pollBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: Colors.primarySurface, borderRadius: BorderRadius.sm },
    pollText: { flex: 1, color: Colors.text, fontSize: FontSize.md, zIndex: 1 },
    pollPercent: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600', zIndex: 1 },
    postActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    voteContainer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
    voteBtn: { padding: 2 },
    voteCount: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600', minWidth: 24, textAlign: 'center' },
    voteCountPositive: { color: Colors.upvote },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    actionCount: { color: Colors.textSecondary, fontSize: FontSize.sm },
    emptyState: { alignItems: 'center', paddingTop: 80 },
    emptyEmoji: { fontSize: 64, marginBottom: 16 },
    emptyTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text, marginBottom: 8 },
    emptySubtitle: { fontSize: FontSize.md, color: Colors.textSecondary },
    // Filter Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    filterModal: {
        position: 'absolute', right: 16, backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg, paddingVertical: 8, minWidth: 180,
        ...Shadow.medium,
    },
    filterOption: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    filterOptionActive: { backgroundColor: Colors.primarySurface },
    filterOptionText: { color: Colors.text, fontSize: FontSize.md },
    filterOptionTextActive: { color: Colors.primary, fontWeight: '600' },
});
