import { useRef, useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image, ScrollView, Modal, Alert, Share,
    PanResponder, Animated,
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
import { getStories } from '../../services/stories';
import { getUserProfile } from '../../services/users';
import { formatTime, formatCount, getInitials } from '../../utils/helpers';
import { FEED_FILTERS } from '../../utils/constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { updateAppStreak } from '../../services/streaks';
import PremiumBadge from '../../components/PremiumBadge';
import EmojiText from '../../components/EmojiText';

const SWIPE_THRESHOLD = 100;

export default function HomeScreen() {
    const { user, userProfile, isAdmin, refreshProfile } = useAuth();
    const { themedColors: C, activeFont, skinStyles, downloadMediaEnabled, activeIcon, iosEmojiEnabled } = usePremium();
    const router = useRouter();
    const insets = useSafeAreaInsets();
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
    const POST_REACTIONS = ['❤️', '😂', '😮', '😢', '🔥', '👏', '🍌'];

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
        // Start unmuted on first tap, toggle after that
        setMutedVideos(prev => ({ ...prev, [postId]: prev[postId] === undefined ? false : !prev[postId] }));
    };

    const loadFeed = useCallback(async () => {
        try {
            const feedPosts = await getFeedPosts(filter, userProfile);
            setPosts(feedPosts);

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
            const storyData = await getStories(userProfile);
            setStories(storyData);
            // Load story authors separately so they always appear even if they haven't posted
            const storyAuthorMap = {};
            for (const authorId of Object.keys(storyData)) {
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
        Alert.alert(
            "Share Post",
            "What would you like to do?",
            [
                {
                    text: "Send to Chat",
                    onPress: () => router.push(`/share-post/${postId}`),
                },
                {
                    text: "Share via...",
                    onPress: async () => {
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
                },
                { text: "Cancel", style: "cancel" }
            ]
        );
    };

    const handlePostMenu = (post) => {
        const isOwner = post.authorId === user?.uid;
        const buttons = [];
        if (isOwner) {
            buttons.push({ text: '🗑️ Delete Post', style: 'destructive', onPress: () => {
                Alert.alert('Delete Post', 'Are you sure?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: async () => {
                        try { await softDeletePost(post.id); setPosts(prev => prev.filter(p => p.id !== post.id)); } catch(e) { Alert.alert('Error', e.message); }
                    }}
                ]);
            }});
            buttons.push({ text: '📦 Archive Post', onPress: async () => {
                try { await archivePost(post.id); setPosts(prev => prev.filter(p => p.id !== post.id)); Alert.alert('Done', 'Post archived'); } catch(e) { Alert.alert('Error', e.message); }
            }});
        }
        if (post.content) {
            buttons.push({ text: '📋 Copy Caption', onPress: async () => {
                try { await Clipboard.setStringAsync(post.content); Alert.alert('Copied!'); } catch(e) { Alert.alert('Error', 'Could not copy'); }
            }});
        }
        if (!isOwner) {
            buttons.push({ text: '🚩 Report Post', onPress: () => Alert.alert('Reported', 'Thank you for reporting. We will review this post.') });
        }
        buttons.push({ text: 'Cancel', style: 'cancel' });
        Alert.alert('Post Options', '', buttons);
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
            <View style={[styles.postCard, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
                {post.isReshare && post.resharerId && (
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 4 }} onPress={() => router.push(`/user/${authors[post.resharerId]?.username}`)}>
                        <Ionicons name="repeat" size={14} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                        <Text style={{ fontSize: 13, color: Colors.textSecondary, fontWeight: '500' }}>
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
                        <Ionicons name="ellipsis-horizontal" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {post.content ? (
                    <Text style={[styles.postContent, { color: C.text }, activeFont.fontFamily && { fontFamily: activeFont.fontFamily }]} selectable>
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
                                    <Text key={i} style={{ color: '#4A90D9', textDecorationLine: 'underline' }} onPress={() => require('react-native').Linking.openURL(part)}>
                                        {part}
                                    </Text>
                                );
                            }
                            return <Text key={i}>{part}</Text>;
                        })}
                    </Text>
                ) : null}

                {post.media?.length > 0 && (() => {
                    const mediaItems = post.media;
                    const screenWidth = require('react-native').Dimensions.get('window').width - 16;
                    return (
                        <View style={styles.mediaContainer}>
                            {mediaItems.length === 1 ? (() => {
                                const item = mediaItems[0];
                                const uri = typeof item === 'string' ? item : item?.uri;
                                const isVideo = typeof item !== 'string' && item?.type === 'video';
                                return isVideo ? (
                                    <View>
                                        <Video source={{ uri }} style={styles.postImage} resizeMode={ResizeMode.COVER}
                                            shouldPlay={true} isMuted={!!mutedVideos[post.id]} isLooping useNativeControls={false} />
                                        <TouchableOpacity onPress={() => toggleMute(post.id)}
                                            style={{ position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 6 }}>
                                            <Ionicons name={mutedVideos[post.id] ? 'volume-mute' : 'volume-high'} size={18} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <Image source={{ uri }} style={styles.postImage} resizeMode="cover" />
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
                                                        shouldPlay={true} isMuted={!!mutedVideos[post.id]} isLooping useNativeControls={false} />
                                                    <TouchableOpacity onPress={() => toggleMute(post.id)}
                                                        style={{ position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 6 }}>
                                                        <Ionicons name={mutedVideos[post.id] ? 'volume-mute' : 'volume-high'} size={18} color="#fff" />
                                                    </TouchableOpacity>
                                                </View>
                                            ) : (
                                                <Image key={idx} source={{ uri }} style={[styles.postImage, { width: screenWidth }]} resizeMode="cover" />
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
                        </View>
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
                                    Alert.alert('Permission needed', 'Allow media library access to save files.');
                                    return;
                                }
                                const item = post.media[0];
                                const uri = typeof item === 'string' ? item : item?.uri;
                                if (!uri) return;
                                const filename = uri.split('/').pop() || `banana_${Date.now()}.jpg`;
                                const localUri = FileSystem.documentDirectory + filename;
                                const { uri: downloadedUri } = await FileSystem.downloadAsync(uri, localUri);
                                await MediaLibrary.saveToLibraryAsync(downloadedUri);
                                Alert.alert('✅ Saved', 'Media saved to your gallery!');
                            } catch (err) {
                                Alert.alert('Download failed', err.message);
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

                    {/* Emoji reaction button */}
                    <TouchableOpacity style={styles.actionBtn} onPress={() => setShowReactionPicker(showReactionPicker === post.id ? null : post.id)}>
                        <Ionicons name="happy-outline" size={20} color={showReactionPicker === post.id ? Colors.primary : Colors.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleReshare(post.id)}>
                        <Ionicons name={resharedPostIds.has(post.id) ? "checkmark-done-outline" : "repeat-outline"} size={20} color={resharedPostIds.has(post.id) ? Colors.primary : Colors.textSecondary} />
                        {(post.shareCount || 0) > 0 && (
                            <Text style={[styles.actionCount, resharedPostIds.has(post.id) && { color: Colors.primary }]}>{formatCount(post.shareCount)}</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(post.id)}>
                        <Ionicons name="paper-plane-outline" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity onPress={() => handleSave(post.id)}>
                        <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={22} color={isSaved ? Colors.primary : Colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Emoji reaction picker */}
                {showReactionPicker === post.id && (
                    <View style={styles.reactionPickerRow}>
                        {POST_REACTIONS.map(emoji => (
                            <TouchableOpacity key={emoji} onPress={async () => {
                                await addPostReaction(post.id, user.uid, emoji);
                                setPosts(prev => prev.map(p => p.id === post.id ? { ...p, reactions: { ...p.reactions, [emoji]: (p.reactions?.[emoji] || 0) + 1 }, reactedBy: { ...p.reactedBy, [user.uid]: emoji } } : p));
                                setShowReactionPicker(null);
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
            </View>
        );
    };

    // Loading skeleton row
    const renderSkeleton = () => (
        <View style={styles.skeletonCard}>
            <View style={styles.skeletonHeader}>
                <View style={styles.skeletonAvatar} />
                <View style={{ flex: 1, gap: 8 }}>
                    <View style={[styles.skeletonLine, { width: '50%' }]} />
                    <View style={[styles.skeletonLine, { width: '30%' }]} />
                </View>
            </View>
            <View style={[styles.skeletonLine, { width: '90%', marginBottom: 8 }]} />
            <View style={[styles.skeletonLine, { width: '70%', marginBottom: 16 }]} />
            <View style={styles.skeletonImage} />
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

            {/* Sticky active filter bar — outside FlatList so it doesn't scroll away */}
            {filter !== 'all' && (
                <View style={styles.activeFilter}>
                    <Text style={styles.activeFilterText}>Showing: {filterLabels[filter]}</Text>
                    <TouchableOpacity onPress={() => setFilter('all')}>
                        <Ionicons name="close-circle" size={18} color={Colors.primary} />
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
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
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
