import { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    TextInput,
    FlatList,
    Alert,
    Modal,
    Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import {
    getPost, upvotePost, downvotePost, addComment, getComments,
    upvoteComment, downvoteComment, savePost, unsavePost, getUpvoters, incrementShareCount,
} from '../../services/posts';
import { getUserProfile } from '../../services/users';
import { formatTime, formatCount, getInitials } from '../../utils/helpers';
import { COMMENT_FILTERS, REACTIONS } from '../../utils/constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PostDetailScreen() {
    const { id: postId } = useLocalSearchParams();
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [post, setPost] = useState(null);
    const [author, setAuthor] = useState(null);
    const [comments, setComments] = useState([]);
    const [commentAuthors, setCommentAuthors] = useState({});
    const [commentText, setCommentText] = useState('');
    const [commentFilter, setCommentFilter] = useState('all');
    const [replyTo, setReplyTo] = useState(null);
    const [showLikesModal, setShowLikesModal] = useState(false);
    const [likers, setLikers] = useState([]);
    const [likersProfiles, setLikersProfiles] = useState([]);

    useEffect(() => { loadPost(); }, [postId]);
    useEffect(() => { loadComments(); }, [commentFilter]);

    const loadPost = async () => {
        const p = await getPost(postId);
        setPost(p);
        if (p) {
            const a = await getUserProfile(p.authorId);
            setAuthor(a);
        }
    };

    const loadComments = async () => {
        const cmts = await getComments(postId, commentFilter);
        setComments(cmts);
        const authorMap = { ...commentAuthors };
        for (const c of cmts) {
            if (!authorMap[c.authorId]) {
                const profile = await getUserProfile(c.authorId);
                if (profile) authorMap[c.authorId] = profile;
            }
        }
        setCommentAuthors(authorMap);
    };

    const handleAddComment = async () => {
        if (!commentText.trim()) return;
        await addComment(postId, {
            authorId: user.uid,
            text: commentText.trim(),
            parentCommentId: replyTo?.id || null,
        });
        setCommentText('');
        setReplyTo(null);
        loadComments();
        loadPost();
    };

    const handleUpvote = async () => {
        await upvotePost(postId, user.uid);
        loadPost();
    };

    const handleDownvote = async () => {
        await downvotePost(postId, user.uid);
        loadPost();
    };

    const handleSave = async () => {
        const isSaved = userProfile?.savedPosts?.includes(postId);
        if (isSaved) await unsavePost(postId, user.uid);
        else await savePost(postId, user.uid);
    };

    const handleShare = async () => {
        try {
            await Share.share({ message: `Check out this post on Banana Chat! 🍌` });
            await incrementShareCount(postId);
            loadPost();
        } catch { }
    };

    const showLikers = async () => {
        const uids = await getUpvoters(postId);
        setLikers(uids);
        const profiles = [];
        for (const uid of uids.slice(0, 30)) {
            const p = await getUserProfile(uid);
            if (p) profiles.push({ ...p, id: uid });
        }
        setLikersProfiles(profiles);
        setShowLikesModal(true);
    };

    // Parse @mentions in text
    const renderTextWithMentions = (text) => {
        if (!text) return null;
        const parts = text.split(/(@\w+)/g);
        return (
            <Text style={styles.postContent}>
                {parts.map((part, i) => {
                    if (part.startsWith('@')) {
                        return (
                            <Text key={i} style={styles.mentionText} onPress={() => {
                                const username = part.substring(1);
                                router.push(`/user/${username}`);
                            }}>
                                {part}
                            </Text>
                        );
                    }
                    return <Text key={i}>{part}</Text>;
                })}
            </Text>
        );
    };

    const isSaved = userProfile?.savedPosts?.includes(postId);

    if (!post) {
        return (
            <View style={styles.container}>
                <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Post</Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Post</Text>
                <View style={{ width: 24 }} />
            </View>

            <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={() => (
                    <View>
                        {/* Post content */}
                        <View style={styles.postCard}>
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
                                    <Text style={styles.authorName}>{author?.displayName}</Text>
                                    <Text style={styles.postTime}>@{author?.username} · {formatTime(post.createdAt?.seconds ? post.createdAt.seconds * 1000 : Date.now())}</Text>
                                </View>
                            </TouchableOpacity>

                            {/* Tagged users */}
                            {post.taggedUsers?.length > 0 && (
                                <View style={styles.taggedRow}>
                                    <Ionicons name="pricetag" size={12} color={Colors.primary} />
                                    <Text style={styles.taggedText}>with {post.taggedUsers.join(', ')}</Text>
                                </View>
                            )}

                            {post.content ? renderTextWithMentions(post.content) : null}

                            {post.media?.length > 0 && (
                                <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                                    {post.media.map((url, i) => (
                                        <Image key={i} source={{ uri: url }} style={styles.postImage} resizeMode="cover" />
                                    ))}
                                </ScrollView>
                            )}

                            {/* Post Actions */}
                            <View style={styles.postActions}>
                                <View style={styles.voteContainer}>
                                    <TouchableOpacity onPress={handleUpvote}>
                                        <Ionicons
                                            name={post.upvotedBy?.includes(user?.uid) ? "arrow-up-circle" : "arrow-up-circle-outline"}
                                            size={28} color={post.upvotedBy?.includes(user?.uid) ? Colors.upvote : Colors.textSecondary}
                                        />
                                    </TouchableOpacity>
                                    <Text style={styles.voteCount}>{formatCount((post.upvotes || 0) - (post.downvotes || 0))}</Text>
                                    <TouchableOpacity onPress={handleDownvote}>
                                        <Ionicons
                                            name={post.downvotedBy?.includes(user?.uid) ? "arrow-down-circle" : "arrow-down-circle-outline"}
                                            size={28} color={post.downvotedBy?.includes(user?.uid) ? Colors.downvote : Colors.textSecondary}
                                        />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.actionBtn}>
                                    <Ionicons name="chatbubble" size={20} color={Colors.primary} />
                                    <Text style={styles.actionCount}>{formatCount(post.commentCount || 0)}</Text>
                                </View>
                                <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                                    <Ionicons name="paper-plane-outline" size={20} color={Colors.textSecondary} />
                                    {(post.shareCount || 0) > 0 && (
                                        <Text style={styles.actionCount}>{formatCount(post.shareCount)}</Text>
                                    )}
                                </TouchableOpacity>
                                <View style={{ flex: 1 }} />
                                <TouchableOpacity onPress={handleSave}>
                                    <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={22} color={isSaved ? Colors.primary : Colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            {/* Liked by / Upvoters */}
                            {(post.upvotes || 0) > 0 && (
                                <TouchableOpacity style={styles.likedByRow} onPress={showLikers}>
                                    <Text style={styles.likedByText}>👍 {formatCount(post.upvotes || 0)} upvotes</Text>
                                    <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Comment filter */}
                        <View style={styles.commentHeader}>
                            <Text style={styles.commentTitle}>Comments</Text>
                            <View style={styles.commentFilters}>
                                {Object.entries(COMMENT_FILTERS).map(([key, value]) => (
                                    <TouchableOpacity
                                        key={key}
                                        style={[styles.filterChip, commentFilter === value && styles.filterChipActive]}
                                        onPress={() => setCommentFilter(value)}
                                    >
                                        <Text style={[styles.filterText, commentFilter === value && styles.filterTextActive]}>
                                            {key.charAt(0) + key.slice(1).toLowerCase()}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>
                )}
                renderItem={({ item: comment }) => {
                    const cAuthor = commentAuthors[comment.authorId];
                    return (
                        <View style={[styles.commentItem, comment.parentCommentId && styles.replyItem]}>
                            {comment.parentCommentId && <View style={styles.threadLine} />}
                            <View style={styles.commentRow}>
                                <TouchableOpacity onPress={() => router.push(`/user/${comment.authorId}`)}>
                                    {cAuthor?.avatar ? (
                                        <Image source={{ uri: cAuthor.avatar }} style={styles.commentAvatar} />
                                    ) : (
                                        <View style={[styles.commentAvatar, styles.avatarPlaceholder]}>
                                            <Text style={styles.commentAvatarInitials}>{getInitials(cAuthor?.displayName)}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                                <View style={styles.commentContent}>
                                    <View style={styles.commentTop}>
                                        <Text style={styles.commentAuthor}>{cAuthor?.displayName || 'User'}</Text>
                                        <Text style={styles.commentTime}>
                                            {formatTime(comment.createdAt?.seconds ? comment.createdAt.seconds * 1000 : Date.now())}
                                        </Text>
                                    </View>
                                    {renderTextWithMentions(comment.text)}
                                    <View style={styles.commentActions}>
                                        <TouchableOpacity
                                            style={styles.commentVote}
                                            onPress={() => { upvoteComment(postId, comment.id, user.uid); loadComments(); }}
                                        >
                                            <Ionicons name="arrow-up" size={16} color={comment.upvotedBy?.includes(user?.uid) ? Colors.upvote : Colors.textTertiary} />
                                        </TouchableOpacity>
                                        <Text style={[styles.commentVoteCount, (comment.upvotes - comment.downvotes) > 0 && { color: Colors.upvote }]}>
                                            {(comment.upvotes || 0) - (comment.downvotes || 0)}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => { downvoteComment(postId, comment.id, user.uid); loadComments(); }}
                                        >
                                            <Ionicons name="arrow-down" size={16} color={comment.downvotedBy?.includes(user?.uid) ? Colors.downvote : Colors.textTertiary} />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setReplyTo(comment)} style={{ marginLeft: Spacing.lg }}>
                                            <Text style={styles.replyBtn}>Reply</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </View>
                    );
                }}
                ListEmptyComponent={() => (
                    <View style={styles.emptyComments}>
                        <Text style={styles.emptyText}>No comments yet. Be the first!</Text>
                    </View>
                )}
                contentContainerStyle={styles.commentsList}
            />

            {/* Comment input */}
            <View style={[styles.commentInputBar, { paddingBottom: insets.bottom + Spacing.sm }]}>
                {replyTo && (
                    <View style={styles.replyPreview}>
                        <Text style={styles.replyPreviewText}>
                            Replying to {commentAuthors[replyTo.authorId]?.displayName || 'User'}
                        </Text>
                        <TouchableOpacity onPress={() => setReplyTo(null)}>
                            <Ionicons name="close" size={16} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                )}
                <View style={styles.commentInputRow}>
                    <TextInput
                        style={styles.commentInput}
                        placeholder="Add a comment..."
                        placeholderTextColor={Colors.textTertiary}
                        value={commentText}
                        onChangeText={setCommentText}
                    />
                    <TouchableOpacity
                        style={styles.sendBtn}
                        onPress={handleAddComment}
                        disabled={!commentText.trim()}
                    >
                        <Ionicons name="send" size={18} color={commentText.trim() ? Colors.primary : Colors.textTertiary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Likes/Upvoters Modal */}
            <Modal visible={showLikesModal} transparent animationType="slide" onRequestClose={() => setShowLikesModal(false)}>
                <View style={styles.likesOverlay}>
                    <View style={styles.likesModal}>
                        <View style={styles.likesHeader}>
                            <Text style={styles.likesTitle}>Upvoted by</Text>
                            <TouchableOpacity onPress={() => setShowLikesModal(false)}>
                                <Ionicons name="close" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={likersProfiles}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item: liker }) => (
                                <TouchableOpacity
                                    style={styles.likerItem}
                                    onPress={() => { setShowLikesModal(false); router.push(`/user/${liker.id}`); }}
                                >
                                    {liker.avatar ? (
                                        <Image source={{ uri: liker.avatar }} style={styles.likerAvatar} />
                                    ) : (
                                        <View style={[styles.likerAvatar, styles.avatarPlaceholder]}>
                                            <Text style={styles.avatarInitials}>{getInitials(liker.displayName)}</Text>
                                        </View>
                                    )}
                                    <View>
                                        <Text style={styles.likerName}>{liker.displayName}</Text>
                                        <Text style={styles.likerUsername}>@{liker.username}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={() => <Text style={styles.emptyText}>No upvoters yet</Text>}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
        backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    headerTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: Colors.textSecondary },
    postCard: { backgroundColor: Colors.surface, padding: Spacing.lg, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    postAuthor: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
    authorAvatar: { width: 44, height: 44, borderRadius: 22 },
    avatarPlaceholder: { backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    avatarInitials: { color: Colors.primary, fontSize: FontSize.md, fontWeight: 'bold' },
    authorName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
    postTime: { color: Colors.textTertiary, fontSize: FontSize.xs },
    taggedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.sm },
    taggedText: { color: Colors.primary, fontSize: FontSize.xs },
    postContent: { color: Colors.text, fontSize: FontSize.lg, lineHeight: 24, marginBottom: Spacing.md },
    mentionText: { color: Colors.primary, fontWeight: '600' },
    postImage: { width: 340, height: 280, borderRadius: BorderRadius.md, marginRight: Spacing.sm },
    postActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl, marginTop: Spacing.md },
    voteContainer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
    voteCount: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600', minWidth: 30, textAlign: 'center' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    actionCount: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '600' },
    likedByRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 0.5, borderTopColor: Colors.border },
    likedByText: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
    commentHeader: { padding: Spacing.lg },
    commentTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: 'bold', marginBottom: Spacing.sm },
    commentFilters: { flexDirection: 'row', gap: Spacing.sm },
    filterChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceLight },
    filterChipActive: { backgroundColor: Colors.primarySurface },
    filterText: { color: Colors.textSecondary, fontSize: FontSize.sm },
    filterTextActive: { color: Colors.primary },
    commentsList: { paddingBottom: 100 },
    commentItem: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    replyItem: { paddingLeft: 60 },
    threadLine: { position: 'absolute', left: 42, top: -8, bottom: '50%', width: 2, backgroundColor: Colors.border, borderRadius: 1 },
    commentRow: { flexDirection: 'row', gap: Spacing.sm },
    commentAvatar: { width: 32, height: 32, borderRadius: 16 },
    commentAvatarInitials: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: 'bold' },
    commentContent: { flex: 1 },
    commentTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    commentAuthor: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
    commentTime: { color: Colors.textTertiary, fontSize: FontSize.xs },
    commentActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
    commentVote: { padding: 2 },
    commentVoteCount: { color: Colors.textSecondary, fontSize: FontSize.xs, minWidth: 20, textAlign: 'center' },
    replyBtn: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '600' },
    emptyComments: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { color: Colors.textTertiary, fontSize: FontSize.md },
    commentInputBar: { backgroundColor: Colors.surface, borderTopWidth: 0.5, borderTopColor: Colors.border },
    replyPreview: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, backgroundColor: Colors.surfaceLight },
    replyPreviewText: { color: Colors.primary, fontSize: FontSize.xs },
    commentInputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, gap: Spacing.sm },
    commentInput: { flex: 1, backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.xl, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, color: Colors.text, fontSize: FontSize.md },
    sendBtn: { padding: Spacing.sm },
    likesOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    likesModal: { backgroundColor: Colors.surface, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, maxHeight: '60%', paddingBottom: 30 },
    likesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    likesTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text },
    likerItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    likerAvatar: { width: 40, height: 40, borderRadius: 20 },
    likerName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
    likerUsername: { color: Colors.textSecondary, fontSize: FontSize.sm },
});
