import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Share, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { getUserPosts, getExplorePosts, getSavedPosts, upvotePost, downvotePost, savePost, unsavePost, incrementShareCount, getPost } from '../services/posts';
import { createReshare, undoReshare, getUserResharedPostIds, getResharesByUser } from '../services/reshares';
import { getUserProfile } from '../services/users';
import { formatTime, formatCount, getInitials } from '../utils/helpers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ImageViewer from '../components/ImageViewer';
import useAppTheme from '../hooks/useAppTheme';
import { useToast } from '../contexts/ToastContext';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Sub-component: renders images at original aspect ratio
function FeedImage({ uri, onPress }) {
    const [height, setHeight] = useState(250);
    useEffect(() => {
        if (uri) {
            Image.getSize(uri, (w, h) => {
                const ratio = h / w;
                setHeight(Math.min(Math.max(SCREEN_WIDTH * ratio, 150), 500));
            }, () => setHeight(250));
        }
    }, [uri]);
    return (
        <TouchableOpacity activeOpacity={0.95} onPress={onPress}>
            <Image source={{ uri }} style={{ width: '100%', height }} resizeMode="cover" />
        </TouchableOpacity>
    );
}

export default function PostFeedScreen() {
    const params = useLocalSearchParams();
    const { type, startIndex, userId } = params;
    const { user, userProfile, refreshProfile } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { C, skin } = useAppTheme();
    const { showConfirm } = useToast();
    const flatListRef = useRef(null);
    const [posts, setPosts] = useState([]);
    const [authors, setAuthors] = useState({});
    const [mutedVideos, setMutedVideos] = useState({});
    const [resharedPostIds, setResharedPostIds] = useState(new Set());
    const [visiblePostId, setVisiblePostId] = useState(null);
    const [viewerImage, setViewerImage] = useState(null);
    const [loading, setLoading] = useState(true);

    const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;
    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            setVisiblePostId(viewableItems[0]?.item?.id || null);
        }
    }).current;

    useEffect(() => { loadPosts(); }, []);

    const loadPosts = async () => {
        try {
            let loadedPosts = [];
            if (type === 'explore') {
                loadedPosts = await getExplorePosts();
            } else if (type === 'user') {
                loadedPosts = await getUserPosts(userId);
            } else if (type === 'saved') {
                if (userProfile?.savedPosts?.length > 0) {
                    loadedPosts = await getSavedPosts(userProfile.savedPosts);
                }
            } else if (type === 'reshared') {
                const reshares = await getResharesByUser(userId || user?.uid);
                loadedPosts = reshares.map(r => r.post).filter(Boolean);
            }

            // Filter out posts from blocked users
            const blockedUsers = userProfile?.blockedUsers || [];
            loadedPosts = loadedPosts.filter(p => !blockedUsers.includes(p.authorId));

            setPosts(loadedPosts);

            const authorMap = {};
            for (const post of loadedPosts) {
                if (post?.authorId && !authorMap[post.authorId]) {
                    const profile = await getUserProfile(post.authorId);
                    if (profile) authorMap[post.authorId] = profile;
                }
            }
            setAuthors(authorMap);

            if (user?.uid) {
                const ids = await getUserResharedPostIds(user.uid);
                setResharedPostIds(ids);
            }
        } catch (err) {
            console.error('PostFeed load error:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleMute = (postId) => {
        setMutedVideos(prev => ({ ...prev, [postId]: prev[postId] === false ? true : false }));
    };

    const handleUpvote = async (postId) => {
        if (!user) return;
        setPosts(prev => prev.map(p => {
            if (p.id !== postId) return p;
            const alreadyUp = p.upvotedBy?.includes(user.uid);
            return {
                ...p,
                upvotes: alreadyUp ? (p.upvotes || 1) - 1 : (p.upvotes || 0) + 1,
                downvotes: p.downvotedBy?.includes(user.uid) ? (p.downvotes || 1) - 1 : (p.downvotes || 0),
                upvotedBy: alreadyUp ? (p.upvotedBy || []).filter(id => id !== user.uid) : [...(p.upvotedBy || []), user.uid],
                downvotedBy: (p.downvotedBy || []).filter(id => id !== user.uid),
            };
        }));
        await upvotePost(postId, user.uid);
    };
    const handleDownvote = async (postId) => {
        if (!user) return;
        setPosts(prev => prev.map(p => {
            if (p.id !== postId) return p;
            const alreadyDown = p.downvotedBy?.includes(user.uid);
            return {
                ...p,
                downvotes: alreadyDown ? (p.downvotes || 1) - 1 : (p.downvotes || 0) + 1,
                upvotes: p.upvotedBy?.includes(user.uid) ? (p.upvotes || 1) - 1 : (p.upvotes || 0),
                downvotedBy: alreadyDown ? (p.downvotedBy || []).filter(id => id !== user.uid) : [...(p.downvotedBy || []), user.uid],
                upvotedBy: (p.upvotedBy || []).filter(id => id !== user.uid),
            };
        }));
        await downvotePost(postId, user.uid);
    };
    const handleSave = async (postId) => {
        if (!user) return;
        const isSaved = userProfile?.savedPosts?.includes(postId);
        try {
            if (isSaved) await unsavePost(postId, user.uid);
            else await savePost(postId, user.uid);
            if (refreshProfile) await refreshProfile();
        } catch (err) {
            console.error('Save error:', err);
        }
    };
    const handleReshare = async (postId) => {
        if (!user) return;
        const isReshared = resharedPostIds.has(postId);
        try {
            if (isReshared) {
                await undoReshare(user.uid, postId);
                setResharedPostIds(prev => { const next = new Set(prev); next.delete(postId); return next; });
            } else {
                await createReshare(user.uid, postId);
                await incrementShareCount(postId);
                setResharedPostIds(prev => new Set(prev).add(postId));
            }
        } catch (err) { console.error('Reshare error:', err); }
    };
    const handleShare = async (postId) => {
        showConfirm('Share Post', 'What would you like to do?',
            () => router.push(`/share-post/${postId}`),
            {
                confirmText: 'Send to Chat',
                cancelText: 'Share via...',
                icon: 'share-outline',
                onCancel: async () => {
                    try {
                        const postData = await getPost(postId);
                        let msg = postData?.content ? `${postData.content}\n\n` : '';
                        msg += 'Shared from Banana Chat 🍌';
                        const opts = { message: msg };
                        if (postData?.media?.[0]) {
                            const uri = typeof postData.media[0] === 'string' ? postData.media[0] : postData.media[0]?.uri;
                            if (uri) opts.url = uri;
                        }
                        await Share.share(opts);
                    } catch {}
                },
            }
        );
    };

    const renderPost = ({ item: post }) => {
        if (!post) return null;
        const author = authors[post.authorId] || {};
        const isUpvoted = post.upvotedBy?.includes(user?.uid);
        const isDownvoted = post.downvotedBy?.includes(user?.uid);
        const isSaved = userProfile?.savedPosts?.includes(post.id);
        const isReshared = resharedPostIds.has(post.id);

        return (
            <View style={[styles.postCard, { backgroundColor: C.surface, borderColor: C.border, ...skin.cardStyle }]}>
                <View style={styles.postHeader}>
                    <TouchableOpacity style={styles.postAuthor} onPress={() => {
                        if (post.authorId === user?.uid) router.push('/(tabs)/profile');
                        else router.push(`/user/${post.authorId}`);
                    }}>
                        {author?.avatar ? (
                            <Image source={{ uri: author.avatar }} style={styles.authorAvatar} />
                        ) : (
                            <View style={[styles.authorAvatar, styles.avatarPlaceholder]}>
                                <Text style={styles.avatarInitials}>{getInitials(author?.displayName)}</Text>
                            </View>
                        )}
                        <View>
                            <Text style={styles.authorName}>{author?.displayName || 'User'}</Text>
                        <Text style={styles.postTime}>{formatTime(post.createdAt?.seconds ? post.createdAt.seconds * 1000 : post.createdAt?.toMillis ? post.createdAt.toMillis() : Date.now())}</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {post.content ? <Text style={styles.postContent} selectable>{post.content}</Text> : null}
                {post.media?.length > 0 && (() => {
                    const firstMedia = post.media[0];
                    const uri = typeof firstMedia === 'string' ? firstMedia : firstMedia?.uri;
                    const mType = typeof firstMedia === 'string' ? '' : (firstMedia?.type || '');
                    const isVideo = mType.includes('video') || (uri && /\.(mp4|mov|avi)/i.test(uri));
                    const isMuted = mutedVideos[post.id] !== false;
                    const isVisible = post.id === visiblePostId;
                    return (
                        <View style={styles.mediaContainer}>
                            {isVideo ? (
                                <TouchableOpacity onPress={() => toggleMute(post.id)} activeOpacity={0.9}>
                                    <Video source={{ uri }} style={styles.postImage} resizeMode={ResizeMode.COVER} shouldPlay={isVisible} isMuted={isMuted} isLooping useNativeControls={false} />
                                    <TouchableOpacity onPress={() => toggleMute(post.id)} style={styles.muteBtn}>
                                        <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={18} color="#fff" />
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            ) : (
                                <FeedImage uri={uri} onPress={() => setViewerImage(uri)} />
                            )}
                        </View>
                    );
                })()}

                <View style={styles.postActions}>
                    <View style={styles.voteContainer}>
                        <TouchableOpacity onPress={() => handleUpvote(post.id)}>
                            <Ionicons name={isUpvoted ? "arrow-up-circle" : "arrow-up-circle-outline"} size={24} color={isUpvoted ? C.upvote || Colors.upvote : C.textSecondary} />
                        </TouchableOpacity>
                        <Text style={styles.voteCount}>{formatCount((post.upvotes || 0) - (post.downvotes || 0))}</Text>
                        <TouchableOpacity onPress={() => handleDownvote(post.id)}>
                            <Ionicons name={isDownvoted ? "arrow-down-circle" : "arrow-down-circle-outline"} size={24} color={isDownvoted ? C.downvote || Colors.downvote : C.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/post/${post.id}`)}>
                        <Ionicons name="chatbubble-outline" size={20} color={C.textSecondary} />
                        <Text style={styles.actionCount}>{formatCount(post.commentCount || 0)}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleReshare(post.id)}>
                        <Ionicons name={isReshared ? "checkmark-done-outline" : "repeat-outline"} size={20} color={isReshared ? C.primary : C.textSecondary} />
                        {(post.shareCount || 0) > 0 && <Text style={[styles.actionCount, isReshared && { color: C.primary }]}>{formatCount(post.shareCount)}</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(post.id)}>
                        <Ionicons name="paper-plane-outline" size={20} color={C.textSecondary} />
                    </TouchableOpacity>

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity onPress={() => handleSave(post.id)}>
                        <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={22} color={isSaved ? C.primary : C.textSecondary} />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const title = type === 'explore' ? 'Explore' : type === 'saved' ? 'Saved Posts' : type === 'reshared' ? 'Reshared Posts' : 'Posts';

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{title}</Text>
                <View style={{ width: 24 }} />
            </View>
            <FlatList
                ref={flatListRef}
                data={posts}
                renderItem={renderPost}
                keyExtractor={item => item?.id || Math.random().toString()}
                initialScrollIndex={parseInt(startIndex) || 0}
                onScrollToIndexFailed={(info) => {
                    setTimeout(() => {
                        flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
                    }, 100);
                }}
                viewabilityConfig={viewabilityConfig}
                onViewableItemsChanged={onViewableItemsChanged}
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                ListEmptyComponent={() => (
                    <View style={styles.empty}>
                        <Ionicons name="images-outline" size={56} color={Colors.textTertiary} />
                        <Text style={styles.emptyText}>No posts</Text>
                    </View>
                )}
            />

            {/* Image viewer */}
            <ImageViewer visible={!!viewerImage} imageUrl={viewerImage} onClose={() => setViewerImage(null)} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
    postCard: { backgroundColor: Colors.card || Colors.surface, marginBottom: 10, marginHorizontal: 6, borderRadius: 16, borderWidth: 0.5, borderColor: Colors.border },
    postHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 10 },
    postAuthor: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    authorAvatar: { width: 36, height: 36, borderRadius: 18 },
    avatarPlaceholder: { backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    avatarInitials: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
    authorName: { color: Colors.text, fontWeight: '600', fontSize: 14 },
    postTime: { color: Colors.textTertiary, fontSize: 11 },
    postContent: { paddingHorizontal: 12, paddingTop: 8, color: Colors.text, fontSize: 14, lineHeight: 20 },
    mediaContainer: { marginTop: 8 },
    postImage: { width: '100%', height: 350 },
    muteBtn: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 6 },
    postActions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 14 },
    voteContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    voteCount: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', minWidth: 20, textAlign: 'center' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    actionCount: { color: Colors.textSecondary, fontSize: 13 },
    empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
    emptyText: { color: Colors.textSecondary, fontSize: 16 },
});
