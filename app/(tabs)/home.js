import { useRef, useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image, ScrollView, Modal, Share,
    PanResponder, Animated, Dimensions, Linking,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Clipboard from 'expo-clipboard';
import { Video, ResizeMode } from 'expo-av';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { usePremium } from '../../contexts/PremiumContext';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { getFeedPosts, upvotePost, downvotePost, savePost, unsavePost, incrementShareCount, softDeletePost, archivePost, votePoll, getPost, addPostReaction } from '../../services/posts';
import { createReshare, undoReshare, getUserResharedPostIds } from '../../services/reshares';
import { getStories, cleanupExpiredStories } from '../../services/stories';
import { getUserProfile } from '../../services/users';
import { formatTime, formatCount, getInitials } from '../../utils/helpers';
import { FEED_FILTERS } from '../../utils/constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { updateAppStreak } from '../../services/streaks';
import PremiumBadge from '../../components/PremiumBadge';
import EmojiText from '../../components/EmojiText';
import ImageViewer from '../../components/ImageViewer';
import { useToast } from '../../contexts/ToastContext';
import AnimatedPress, { SkeletonShimmer } from '../../components/AnimatedPress';
import DoubleTapLike, { FadeInView, AnimatedLikeButton } from '../../components/DoubleTapLike';

const SWIPE_THRESHOLD = 100;
const SCREEN_WIDTH = Dimensions.get('window').width;

// Sub-component: renders images at their original aspect ratio with tap-to-zoom
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

export default function HomeScreen() {
    const { user, userProfile, isAdmin, refreshProfile } = useAuth();
    const { themedColors: C, activeFont, skinStyles, downloadMediaEnabled, activeIcon, iosEmojiEnabled } = usePremium();
    const skin = skinStyles || { surfaceStyle: {}, cardStyle: {}, borderRadius: 16 };
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { showToast, showConfirm } = useToast();
    const [posts, setPosts] = useState([]);
    const [stories, setStories] = useState({});
    const [filter, setFilter] = useState('all');
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [authors, setAuthors] = useState({});
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [mutedVideos, setMutedVideos] = useState({});
    const [resharedPostIds, setResharedPostIds] = useState(new Set());
    const swipeAnim = useRef(new Animated.Value(0)).current;
    const [activeCarouselIndex, setActiveCarouselIndex] = useState({});
    const [showReactionPicker, setShowReactionPicker] = useState(null);
    const [visiblePostId, setVisiblePostId] = useState(null);
    const [viewerImage, setViewerImage] = useState(null);
    const POST_REACTIONS = ['❤️', '😂', '😮', '😢', '🔥', '👏', '🍌'];

    // Viewability tracking — only the visible post's video autoplays
    const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;
    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            setVisiblePostId(viewableItems[0]?.item?.id || null);
        }
    }).current;

    // Swipe left → chats, handles both directions
    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gs) => {
                // Only trigger for clear horizontal swipes
                return Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5 && Math.abs(gs.dx) > 15;
            },
            onPanResponderMove: (_, gs) => {
                if (gs.dx < 0) swipeAnim.setValue(gs.dx); // left swipe
            },
            onPanResponderRelease: (_, gs) => {
                if (gs.dx < -SWIPE_THRESHOLD) {
                    Animated.timing(swipeAnim, { toValue: -400, duration: 180, useNativeDriver: true }).start(() => {
                        swipeAnim.setValue(0);
                        router.push('/(tabs)/chats');
                    });
                } else {
                    Animated.spring(swipeAnim, { toValue: 0, friction: 8, useNativeDriver: true }).start();
                }
            },
        })
    ).current;

    const toggleMute = (postId) => {
        // Default is muted (true). Single tap toggles.
        setMutedVideos(prev => ({ ...prev, [postId]: prev[postId] === false ? true : false }));
    };

    const loadFeed = useCallback(async () => {
        try {
            const feedPosts = await getFeedPosts(filter, userProfile);
            // Filter out posts from blocked users
            const blockedIds = userProfile?.blockedUsers || [];
            const filtered = blockedIds.length > 0
                ? feedPosts.filter(p => !blockedIds.includes(p.authorId))
                : feedPosts;
            setPosts(filtered);

            // Load authors in parallel (batched) — collect all unique IDs first
            const allAuthorIds = new Set();
            for (const post of feedPosts) {
                allAuthorIds.add(post.authorId);
                if (post.isReshare && post.resharerId) allAuthorIds.add(post.resharerId);
            }
            const profileEntries = await Promise.all(
                [...allAuthorIds].map(async (id) => {
                    const profile = await getUserProfile(id);
                    return profile ? [id, profile] : null;
                })
            );
            const authorMap = Object.fromEntries(profileEntries.filter(Boolean));
            setAuthors(prev => ({ ...prev, ...authorMap }));

            // Load reshare state
            if (user?.uid) {
                const ids = await getUserResharedPostIds(user.uid);
                setResharedPostIds(ids);
            }
        } catch (err) {
            console.error('Feed error:', err);
        } finally {
            setLoading(false);
        }
    }, [filter, userProfile]);

    const loadStories = useCallback(async () => {
        try {
            // Auto-archive expired stories so highlights work
            await cleanupExpiredStories().catch(() => {});
            const storyData = await getStories(userProfile);
            // Filter out stories from blocked users
            const blockedIds = userProfile?.blockedUsers || [];
            const filteredStories = {};
            for (const authorId of Object.keys(storyData)) {
                if (!blockedIds.includes(authorId)) {
                    filteredStories[authorId] = storyData[authorId];
                }
            }
            setStories(filteredStories);
            const storyAuthorMap = {};
            for (const authorId of Object.keys(filteredStories)) {
                const profile = await getUserProfile(authorId);
                if (profile) storyAuthorMap[authorId] = profile;
            }
            setAuthors(prev => ({ ...prev, ...storyAuthorMap }));
        } catch (err) {
            console.error('Stories error:', err);
        }
    }, [userProfile]);

    useEffect(() => {
        loadFeed();
        loadStories();
        // Update app streak on every home focus
        if (user?.uid) updateAppStreak(user.uid).catch(() => {});
    }, [loadFeed, loadStories]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([loadFeed(), loadStories()]);
        setRefreshing(false);
    };

    const handleUpvote = async (postId) => {
        if (!user) return;
        // Optimistic update — toggle instantly, sync in background
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
        // Optimistic update
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

    const handlePollVote = async (postId, optionIndex) => {
        if (!user) return;
        try {
            await votePoll(postId, optionIndex, user.uid);
            loadFeed();
        } catch (err) {
            console.error('Poll vote error:', err);
        }
    };

    // Local cache of saved posts to avoid full profile refresh on every save tap
    const [localSavedPosts, setLocalSavedPosts] = useState(null);
    const savedPosts = localSavedPosts ?? (userProfile?.savedPosts || []);

    const handleSave = async (postId) => {
        if (!user) return;
        try {
            const isSaved = savedPosts.includes(postId);
            // Optimistic local update
            setLocalSavedPosts(isSaved
                ? savedPosts.filter(id => id !== postId)
                : [...savedPosts, postId]);
            if (isSaved) {
                await unsavePost(postId, user.uid);
            } else {
                await savePost(postId, user.uid);
            }
        } catch (err) {
            console.error('Save error:', err);
            // Revert on error
            setLocalSavedPosts(null);
        }
    };
    const handleReshare = async (postId) => {
        if (!user) return;
        const isReshared = resharedPostIds.has(postId);
        try {
            if (isReshared) {
                await undoReshare(user.uid, postId);
                setResharedPostIds(prev => { const next = new Set(prev); next.delete(postId); return next; });
                // Optimistic: decrement share count locally
                setPosts(prev => prev.map(p => p.id === postId ? { ...p, shareCount: Math.max(0, (p.shareCount || 1) - 1) } : p));
            } else {
                await createReshare(user.uid, postId);
                await incrementShareCount(postId);
                setResharedPostIds(prev => new Set(prev).add(postId));
                // Optimistic: increment share count locally
                setPosts(prev => prev.map(p => p.id === postId ? { ...p, shareCount: (p.shareCount || 0) + 1 } : p));
            }
        } catch (err) {
            console.error('Reshare error:', err);
        }
    };

    const handleShare = async (postId) => {
        showConfirm('Share Post', 'What would you like to do?',
            () => router.push(`/share-post/${postId}`),
            { confirmText: 'Send to Chat', cancelText: 'Share via...', icon: 'share-outline',
              onCancel: async () => {
                try {
                    const postData = await getPost(postId);
                    let shareMsg = postData?.content || '';
                    shareMsg = shareMsg ? `${shareMsg}\n\n` : '';
                    shareMsg += `Shared from Banana Chat 🍌`;
                    const shareOpts = { message: shareMsg };
                    if (postData?.media?.[0]) {
                        const mediaUri = typeof postData.media[0] === 'string' ? postData.media[0] : postData.media[0]?.uri;
                        if (mediaUri) shareOpts.url = mediaUri;
                    }
                    await Share.share(shareOpts);
                    await incrementShareCount(postId);
                } catch {}
              }
            }
        );
    };

    const handlePostMenu = (post) => {
        const isOwner = post.authorId === user?.uid;
        if (isOwner) {
            showConfirm('Post Options', 'What would you like to do?',
                () => {
                    showConfirm('Delete Post', 'Are you sure?',
                        async () => {
                            try { await softDeletePost(post.id); setPosts(prev => prev.filter(p => p.id !== post.id)); } catch(e) { showToast(e.message, 'error'); }
                        },
                        { variant: 'destructive', confirmText: 'Delete', icon: 'trash-outline' }
                    );
                },
                { confirmText: '🗑️ Delete Post', cancelText: '📦 Archive', icon: 'ellipsis-horizontal-circle-outline',
                  onCancel: async () => {
                    try { await archivePost(post.id); setPosts(prev => prev.filter(p => p.id !== post.id)); showToast('Post archived', 'success'); } catch(e) { showToast(e.message, 'error'); }
                  }
                }
            );
        } else {
            showConfirm('Post Options', 'What would you like to do?',
                () => {
                    if (post.content) {
                        Clipboard.setStringAsync(post.content).then(() => showToast('Caption copied', 'success', 'Copied!')).catch(() => {});
                    } else {
                        showToast('No caption to copy', 'info');
                    }
                },
                {
                    confirmText: '📋 Copy Caption',
                    cancelText: '🚩 Report',
                    icon: 'ellipsis-horizontal-circle-outline',
                    onCancel: () => {
                        showToast('Thank you for reporting. We will review this post.', 'info', 'Reported');
                    },
                }
            );
        }
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
        const isSaved = savedPosts.includes(post.id);

        return (
            <FadeInView style={[styles.postCard, { backgroundColor: C.surface, borderBottomColor: C.border, ...skin.cardStyle }]}>
                {post.isReshare && post.resharerId && (
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 4 }} onPress={() => router.push(`/user/${authors[post.resharerId]?.username}`)}>
                        <Ionicons name="repeat" size={14} color={C.textSecondary} style={{ marginRight: 6 }} />
                        <Text style={{ fontSize: 13, color: C.textSecondary, fontWeight: '500' }}>
                            {authors[post.resharerId]?.displayName || 'User'} reshared
                        </Text>
                    </TouchableOpacity>
                )}
                <View style={styles.postHeader}>
                    <TouchableOpacity
                        style={styles.postAuthor}
                        onPress={() => {
                            if (post.authorId === user?.uid) {
                                router.push('/(tabs)/profile');
                            } else {
                                router.push(`/user/${post.authorId}`);
                            }
                        }}
                    >
                        {author?.avatar ? (
                            <Image source={{ uri: author.avatar }} style={styles.authorAvatar} />
                        ) : (
                            <View style={[styles.authorAvatar, styles.avatarPlaceholder]}>
                                <Text style={styles.avatarInitials}>{getInitials(author?.displayName)}</Text>
                            </View>
                        )}
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={[styles.authorName, { color: C.text }, activeFont.fontFamily && { fontFamily: activeFont.fontFamily }]}>{author?.displayName || 'User'}</Text>
                                <PremiumBadge profile={author} size={14} />
                            </View>
                            <Text style={styles.postTime}>
                                @{author?.username} · {formatTime(post.createdAt?.seconds ? post.createdAt.seconds * 1000 : Date.now())}
                            </Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handlePostMenu(post)}>
                        <Ionicons name="ellipsis-horizontal" size={20} color={C.textSecondary} />
                    </TouchableOpacity>
                </View>

                {post.content ? (
                    <EmojiText iosEmoji={iosEmojiEnabled} style={[styles.postContent, { color: C.text }, activeFont.fontFamily && { fontFamily: activeFont.fontFamily }]} selectable>
                        {post.content.split(/(@\w+|https?:\/\/[^\s]+)/g).map((part, i) => {
                            if (part && part.startsWith('@')) {
                                return (
                                    <Text key={i} style={{ color: C.primary, fontWeight: '600' }} onPress={() => router.push(`/user/${part.substring(1)}`)}>
                                        {part}
                                    </Text>
                                );
                            }
                            if (part && part.match(/^https?:\/\//)) {
                                return (
                                    <Text key={i} style={{ color: '#4A90D9', textDecorationLine: 'underline' }} onPress={() => Linking.openURL(part)}>
                                        {part}
                                    </Text>
                                );
                            }
                            return <Text key={i}>{part}</Text>;
                        })}
                    </EmojiText>
                ) : null}

                {post.media?.length > 0 && (() => {
                    const mediaItems = post.media;
                    const screenWidth = SCREEN_WIDTH - 16;
                    const isMuted = mutedVideos[post.id] !== false; // default muted
                    const isVisible = post.id === visiblePostId;
                    return (
                        <DoubleTapLike
                            onDoubleTap={() => { if (!isUpvoted) handleUpvote(post.id); }}
                            style={styles.mediaContainer}
                        >
                            {mediaItems.length === 1 ? (() => {
                                const item = mediaItems[0];
                                const uri = typeof item === 'string' ? item : item?.uri;
                                const isVideo = typeof item !== 'string' && item?.type === 'video';
                                return isVideo ? (
                                    <View>
                                        <Video source={{ uri }} style={styles.postImage} resizeMode={ResizeMode.COVER}
                                            shouldPlay={isVisible} isMuted={isMuted} isLooping useNativeControls={false} />
                                        <TouchableOpacity onPress={() => toggleMute(post.id)}
                                            style={{ position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 6 }}>
                                            <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={18} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <FeedImage uri={uri} onPress={() => setViewerImage(uri)} />
                                );
                            })() : (
                                <View>
                                    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                                        style={{ width: screenWidth }}
                                        onScroll={(e) => {
                                            const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
                                            setActiveCarouselIndex(prev => ({ ...prev, [post.id]: idx }));
                                        }}
                                        scrollEventThrottle={200}
                                    >
                                        {mediaItems.map((item, idx) => {
                                            const uri = typeof item === 'string' ? item : item?.uri;
                                            const isVideo = typeof item !== 'string' && item?.type === 'video';
                                            return isVideo ? (
                                                <View key={idx} style={{ width: screenWidth }}>
                                                    <Video source={{ uri }} style={[styles.postImage, { width: screenWidth }]} resizeMode={ResizeMode.COVER}
                                                        shouldPlay={isVisible && (activeCarouselIndex[post.id] || 0) === idx} isMuted={isMuted} isLooping useNativeControls={false} />
                                                    <TouchableOpacity onPress={() => toggleMute(post.id)}
                                                        style={{ position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 6 }}>
                                                        <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={18} color="#fff" />
                                                    </TouchableOpacity>
                                                </View>
                                            ) : (
                                                <TouchableOpacity key={idx} activeOpacity={0.95} onPress={() => setViewerImage(uri)} style={{ width: screenWidth }}>
                                                    <Image source={{ uri }} style={[styles.postImage, { width: screenWidth }]} resizeMode="cover" />
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                    {/* Page counter */}
                                    <View style={styles.pageCounter}>
                                        <Text style={styles.pageCounterText}>{(activeCarouselIndex[post.id] || 0) + 1}/{mediaItems.length}</Text>
                                    </View>
                                    <View style={styles.carouselDots}>
                                        {mediaItems.map((_, idx) => (
                                            <View key={idx} style={[styles.dot, (activeCarouselIndex[post.id] || 0) === idx && styles.dotActive]} />
                                        ))}
                                    </View>
                                </View>
                            )}
                        </DoubleTapLike>
                    );
                })()}

                {/* Download media button for premium users */}
                {downloadMediaEnabled && post.media?.length > 0 && (
                    <TouchableOpacity
                        style={{
                            flexDirection: 'row', alignItems: 'center', gap: 6,
                            paddingVertical: 6, paddingHorizontal: 10,
                            backgroundColor: C.primarySurface || Colors.primarySurface,
                            borderRadius: 8, alignSelf: 'flex-start', marginBottom: 6,
                        }}
                        onPress={async () => {
                            try {
                                const { status } = await MediaLibrary.requestPermissionsAsync();
                                if (status !== 'granted') {
                                    showToast('Allow media library access to save files.', 'warning', 'Permission needed');
                                    return;
                                }
                                const idx = activeCarouselIndex[post.id] || 0;
                                const item = post.media[idx] || post.media[0];
                                const uri = typeof item === 'string' ? item : item?.uri;
                                if (!uri) return;
                                // Sanitize filename: strip query params and ensure extension
                                let filename = uri.split('/').pop()?.split('?')[0] || `banana_${Date.now()}.jpg`;
                                if (!/\.[a-z0-9]+$/i.test(filename)) filename += '.jpg';
                                const localUri = FileSystem.documentDirectory + filename;
                                const { uri: downloadedUri } = await FileSystem.downloadAsync(uri, localUri);
                                await MediaLibrary.saveToLibraryAsync(downloadedUri);
                                showToast('Media saved to your gallery!', 'success', '✅ Saved');
                            } catch (err) {
                                showToast('Download failed: ' + err.message, 'error');
                            }
                        }}
                    >
                        <Ionicons name="download-outline" size={16} color={C.primary} />
                        <Text style={{ color: C.primary, fontSize: 12, fontWeight: '600' }}>Save</Text>
                    </TouchableOpacity>
                )}

                {post.poll && (
                    <View style={styles.pollContainer}>
                        {post.poll.options?.map((option, index) => {
                            const totalVotes = post.poll.options.reduce((sum, o) => sum + (o.votes || 0), 0);
                            const percentage = totalVotes > 0 ? ((option.votes || 0) / totalVotes * 100).toFixed(0) : 0;
                            return (
                                <TouchableOpacity key={index} style={styles.pollOption} onPress={() => handlePollVote(post.id, index)}>
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
                        <AnimatedLikeButton
                            isLiked={isUpvoted}
                            onPress={() => handleUpvote(post.id)}
                            size={24}
                            color={isUpvoted ? C.upvote || Colors.upvote : C.textSecondary}
                        />
                        <Text style={[styles.voteCount, (post.upvotes - post.downvotes) > 0 && styles.voteCountPositive]}>
                            {formatCount((post.upvotes || 0) - (post.downvotes || 0))}
                        </Text>
                        <TouchableOpacity onPress={() => handleDownvote(post.id)} style={styles.voteBtn}>
                            <Ionicons name={isDownvoted ? "arrow-down-circle" : "arrow-down-circle-outline"} size={24} color={isDownvoted ? C.downvote || Colors.downvote : C.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/post/${post.id}`)}>
                        <Ionicons name="chatbubble-outline" size={20} color={C.textSecondary} />
                        <Text style={styles.actionCount}>{formatCount(post.commentCount || 0)}</Text>
                    </TouchableOpacity>

                    {/* Emoji reaction button */}
                    <TouchableOpacity style={styles.actionBtn} onPress={() => setShowReactionPicker(showReactionPicker === post.id ? null : post.id)}>
                        <Ionicons name="happy-outline" size={20} color={showReactionPicker === post.id ? C.primary : C.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleReshare(post.id)}>
                        <Ionicons name={resharedPostIds.has(post.id) ? "checkmark-done-outline" : "repeat-outline"} size={20} color={resharedPostIds.has(post.id) ? C.primary : C.textSecondary} />
                        {(post.shareCount || 0) > 0 && (
                            <Text style={[styles.actionCount, resharedPostIds.has(post.id) && { color: C.primary }]}>{formatCount(post.shareCount)}</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(post.id)}>
                        <Ionicons name="paper-plane-outline" size={20} color={C.textSecondary} />
                    </TouchableOpacity>

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity onPress={() => handleSave(post.id)}>
                        <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={22} color={isSaved ? C.primary : C.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Emoji reaction picker */}
                {showReactionPicker === post.id && (
                    <View style={styles.reactionPickerRow}>
                        {POST_REACTIONS.map(emoji => (
                            <TouchableOpacity key={emoji} onPress={async () => {
                                const prevEmoji = post.reactedBy?.[user.uid];
                                const updatedReactions = { ...(post.reactions || {}) };
                                // Remove previous reaction if different
                                if (prevEmoji && prevEmoji !== emoji) {
                                    updatedReactions[prevEmoji] = Math.max(0, (updatedReactions[prevEmoji] || 1) - 1);
                                }
                                // Add new reaction (only if not already this emoji)
                                if (prevEmoji !== emoji) {
                                    updatedReactions[emoji] = (updatedReactions[emoji] || 0) + 1;
                                }
                                setPosts(prev => prev.map(p => p.id === post.id ? { ...p, reactions: updatedReactions, reactedBy: { ...p.reactedBy, [user.uid]: emoji } } : p));
                                setShowReactionPicker(null);
                                await addPostReaction(post.id, user.uid, emoji);
                            }} style={styles.reactionEmojiBtn}>
                                <Text style={{ fontSize: 22 }}>{emoji}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Display reactions */}
                {post.reactions && Object.keys(post.reactions).length > 0 && (
                    <View style={styles.reactionDisplay}>
                        {Object.entries(post.reactions).filter(([_, count]) => count > 0).map(([emoji, count]) => (
                            <View key={emoji} style={styles.reactionChip}>
                                <Text style={{ fontSize: 14 }}>{emoji}</Text>
                                <Text style={styles.reactionChipCount}>{count}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </FadeInView>
        );
    };

    // Loading skeleton row — animated shimmer
    const renderSkeleton = () => (
        <View style={styles.skeletonCard}>
            <View style={styles.skeletonHeader}>
                <SkeletonShimmer width={40} height={40} borderRadius={20} />
                <View style={{ flex: 1, gap: 8 }}>
                    <SkeletonShimmer width={'50%'} height={12} />
                    <SkeletonShimmer width={'30%'} height={10} />
                </View>
            </View>
            <SkeletonShimmer width={'90%'} height={14} style={{ marginTop: 12 }} />
            <SkeletonShimmer width={'100%'} height={200} borderRadius={12} style={{ marginTop: 10 }} />
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
                <SkeletonShimmer width={60} height={12} />
                <SkeletonShimmer width={60} height={12} />
                <SkeletonShimmer width={60} height={12} />
            </View>
        </View>
    );

    return (
        <Animated.View
            style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: C.background, transform: [{ translateX: swipeAnim }] }]}
            {...panResponder.panHandlers}
        >
            {/* Header */}
            <View style={[styles.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {activeIcon?.image ? (
                        <Image source={activeIcon.image} style={{ width: 28, height: 28, borderRadius: 6 }} />
                    ) : null}
                    <Text style={[styles.headerTitle, { color: C.primary }]}>Banana Chat</Text>
                </View>
                <View style={styles.headerRight}>
                    {isAdmin && (
                        <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/admin')}>
                            <Ionicons name="shield" size={22} color={C.primary} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.headerBtn} onPress={() => setShowFilterModal(true)}>
                        <Ionicons name="funnel-outline" size={20} color={C.text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/(tabs)/chats')}>
                        <Ionicons name="paper-plane-outline" size={22} color={C.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Sticky active filter bar — outside FlatList so it doesn't scroll away */}
            {filter !== 'all' && (
                <View style={styles.activeFilter}>
                    <Text style={styles.activeFilterText}>Showing: {filterLabels[filter]}</Text>
                    <TouchableOpacity onPress={() => setFilter('all')}>
                        <Ionicons name="close-circle" size={18} color={C.primary} />
                    </TouchableOpacity>
                </View>
            )}

            {loading ? (
                <ScrollView>
                    {[1, 2, 3].map(i => <View key={i}>{renderSkeleton()}</View>)}
                </ScrollView>
            ) : (
                <FlatList
                    data={posts}
                    renderItem={renderPost}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    viewabilityConfig={viewabilityConfig}
                    onViewableItemsChanged={onViewableItemsChanged}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />
                    }
                    ListHeaderComponent={() => (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.storiesContainer}
                            contentContainerStyle={styles.storiesContent}
                        >
                            <TouchableOpacity style={styles.storyCircle} onPress={() => router.push('/(tabs)/create')}>
                                <View style={[styles.storyRing, styles.addStoryRing]}>
                                    <View style={[styles.storyAvatar, styles.addStoryAvatar]}>
                                        <Ionicons name="add" size={28} color={Colors.primary} />
                                    </View>
                                </View>
                                <Text style={styles.storyName} numberOfLines={1}>Your Story</Text>
                            </TouchableOpacity>
                            {Object.keys(stories).map(authorId => renderStoryCircle(authorId))}
                        </ScrollView>
                    )}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyEmoji}>🍌</Text>
                            <Text style={styles.emptyTitle}>No posts yet</Text>
                            <Text style={styles.emptySubtitle}>Be the first to post something!</Text>
                        </View>
                    )}
                />
            )}

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

            {/* Image viewer modal */}
            <ImageViewer visible={!!viewerImage} imageUrl={viewerImage} onClose={() => setViewerImage(null)} />
        </Animated.View>
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
    storyName: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 4, width: 64, textAlign: 'center' },
    // Active filter — sticky, outside FlatList
    activeFilter: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 8, backgroundColor: Colors.primarySurface,
        borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    activeFilterText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
    // Skeleton loader
    skeletonCard: {
        backgroundColor: Colors.surface, marginHorizontal: Spacing.sm, marginTop: Spacing.sm,
        borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 0.5, borderColor: Colors.border,
    },
    skeletonHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
    skeletonAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceLight },
    skeletonLine: { height: 12, borderRadius: 6, backgroundColor: Colors.surfaceLight },
    skeletonImage: { width: '100%', height: 180, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceLight, marginTop: 8 },
    // Posts
    postCard: {
        backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
        paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
        marginBottom: 10, marginHorizontal: 6, borderRadius: BorderRadius.lg,
        borderWidth: 0.5, borderColor: Colors.border,
    },
    postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
    postAuthor: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    authorAvatar: { width: 36, height: 36, borderRadius: 18 },
    avatarPlaceholder: { backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    avatarInitials: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: 'bold' },
    authorName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
    postTime: { color: Colors.textTertiary, fontSize: FontSize.xs },
    postContent: { color: Colors.text, fontSize: FontSize.md, lineHeight: 22, marginBottom: Spacing.sm },
    mediaContainer: { borderRadius: 4, overflow: 'hidden', marginBottom: Spacing.sm, position: 'relative', marginHorizontal: -Spacing.md },
    postImage: { width: '100%', height: 300 },
    mediaCount: { position: 'absolute', top: 8, right: 8, backgroundColor: Colors.overlay, borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
    mediaCountText: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
    carouselDots: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingTop: 8 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.textTertiary + '60' },
    dotActive: { backgroundColor: Colors.primary, width: 8, height: 8, borderRadius: 4 },
    pageCounter: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
    pageCounterText: { color: '#fff', fontSize: 11, fontWeight: '700' },
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
    // Reaction picker
    reactionPickerRow: {
        flexDirection: 'row', gap: 4, paddingVertical: 8, paddingHorizontal: 4,
        backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.full,
        alignSelf: 'flex-start', marginTop: 6,
    },
    reactionEmojiBtn: { padding: 4 },
    reactionDisplay: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
    reactionChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: Colors.surfaceLight, borderRadius: 12,
        paddingHorizontal: 8, paddingVertical: 4,
    },
    reactionChipCount: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
});
