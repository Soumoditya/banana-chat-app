import { useState, useEffect, useRef } from 'react';
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
    ActivityIndicator,
    Dimensions,
    Linking,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode, Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { usePremium } from '../../contexts/PremiumContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import {
    getPost, upvotePost, downvotePost, addComment, getComments,
    upvoteComment, downvoteComment, savePost, unsavePost, getUpvoters, incrementShareCount,
    addCommentReaction, editComment, deleteComment,
} from '../../services/posts';
import * as DocumentPicker from 'expo-document-picker';
import { createReshare } from '../../services/reshares';
import { getUserProfile, searchUsers } from '../../services/users';
import { createNotification } from '../../services/notifications';
import { formatTime, formatCount, getInitials } from '../../utils/helpers';
import { COMMENT_FILTERS, REACTIONS } from '../../utils/constants';
const COMMENT_REACTIONS = ['❤️', '😂', '😮', '🔥', '👍', '🍌'];
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { uploadToCloudinary } from '../../config/cloudinary';
import ImageViewer from '../../components/ImageViewer';
import VideoViewer from '../../components/VideoViewer';
import AudioWavePlayer from '../../components/AudioWavePlayer';
import PremiumBadge from '../../components/PremiumBadge';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function PostDetailScreen() {
    const carouselScrollRef = useRef(null);
    const [activeMediaIndex, setActiveMediaIndex] = useState(0);
    const { id: postId } = useLocalSearchParams();
    const { user, userProfile } = useAuth();
    const { themedColors: C, activeFont, downloadMediaEnabled, skinStyles } = usePremium();
    const skin = skinStyles || { surfaceStyle: {}, cardStyle: {}, borderRadius: 16 };
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
    const [commentMedia, setCommentMedia] = useState(null);
    const [uploadingComment, setUploadingComment] = useState(false);
    // Media viewers
    const [viewerImage, setViewerImage] = useState(null);
    const [viewerVideo, setViewerVideo] = useState(null);
    // Comment video mute state
    const [mutedCommentVideos, setMutedCommentVideos] = useState({});
    // Audio recording for comments
    const [isRecordingComment, setIsRecordingComment] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const commentRecordingRef = useRef(null);
    const commentRecTimerRef = useRef(null);
    // Attachment menu
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    // @ mention autosuggest
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionResults, setMentionResults] = useState([]);
    const [showMentions, setShowMentions] = useState(false);
    const commentInputRef = useRef(null);
    // Comment reactions, edit/delete, inline video
    const [showCommentReactionPicker, setShowCommentReactionPicker] = useState(null);
    const [editingComment, setEditingComment] = useState(null);
    const [playingCommentVideos, setPlayingCommentVideos] = useState({});

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
        let cmts = await getComments(postId, commentFilter);
        // Filter out deleted comments and comments from blocked users
        const blockedIds = userProfile?.blockedUsers || [];
        cmts = cmts.filter(c => c.deleted !== true && !blockedIds.includes(c.authorId));
        const map = {};
        const roots = [];
        cmts.forEach(c => map[c.id] = { ...c, children: [] });
        cmts.forEach(c => {
            if (c.parentCommentId && map[c.parentCommentId]) {
                map[c.parentCommentId].children.push(map[c.id]);
            } else {
                roots.push(map[c.id]);
            }
        });
        setComments(roots);

        const authorMap = { ...commentAuthors };
        const uniqueIds = [...new Set(cmts.map(c => c.authorId))];
        const entries = await Promise.all(
            uniqueIds.filter(id => !authorMap[id]).map(async (id) => {
                const profile = await getUserProfile(id);
                return profile ? [id, profile] : null;
            })
        );
        entries.filter(Boolean).forEach(([id, profile]) => { authorMap[id] = profile; });
        setCommentAuthors(authorMap);
    };

    // ─── Media picking for comments ───
    const pickCommentMedia = async () => {
        setShowAttachMenu(false);
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            const isVideo = asset.type === 'video';
            setCommentMedia({ ...asset, mediaType: isVideo ? 'video' : 'image' });
        }
    };

    // ─── Document/file picking for comments ───
    const pickCommentFile = async () => {
        setShowAttachMenu(false);
        try {
            const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
            if (!result.canceled && result.assets?.[0]) {
                const file = result.assets[0];
                setCommentMedia({
                    uri: file.uri,
                    mediaType: 'file',
                    fileName: file.name,
                    fileSize: file.size,
                    mimeType: file.mimeType,
                });
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to pick file');
        }
    };

    const startCommentAudioRecording = async () => {
        setShowAttachMenu(false);
        try {
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please allow microphone access');
                return;
            }
            await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
            const recording = new Audio.Recording();
            await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            await recording.startAsync();
            commentRecordingRef.current = recording;
            setIsRecordingComment(true);
            setRecordingDuration(0);
            commentRecTimerRef.current = setInterval(() => {
                setRecordingDuration(d => d + 1);
            }, 1000);
        } catch (err) {
            Alert.alert('Error', 'Failed to start recording: ' + err.message);
        }
    };

    const stopCommentAudioRecording = async () => {
        clearInterval(commentRecTimerRef.current);
        setIsRecordingComment(false);
        if (!commentRecordingRef.current) return;
        try {
            await commentRecordingRef.current.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
            const uri = commentRecordingRef.current.getURI();
            commentRecordingRef.current = null;
            if (uri) {
                setCommentMedia({ uri, mediaType: 'audio', duration: recordingDuration });
            }
        } catch (err) {
            commentRecordingRef.current = null;
        }
    };

    const cancelCommentAudioRecording = async () => {
        clearInterval(commentRecTimerRef.current);
        setIsRecordingComment(false);
        if (commentRecordingRef.current) {
            try { await commentRecordingRef.current.stopAndUnloadAsync(); } catch {}
            commentRecordingRef.current = null;
        }
    };

    // ─── @ Mention autosuggest ───
    const handleCommentTextChange = (text) => {
        setCommentText(text);
        // Detect @mention
        const cursorMatch = text.match(/@(\w*)$/);
        if (cursorMatch && cursorMatch[1].length >= 1) {
            setMentionQuery(cursorMatch[1]);
            searchMentionUsers(cursorMatch[1]);
        } else {
            setShowMentions(false);
            setMentionResults([]);
        }
    };

    const searchMentionUsers = async (q) => {
        try {
            const users = await searchUsers(q);
            const filtered = users.filter(u => u.id !== user?.uid).slice(0, 6);
            setMentionResults(filtered);
            setShowMentions(filtered.length > 0);
        } catch {
            setShowMentions(false);
        }
    };

    const insertMention = (mentionUser) => {
        const newText = commentText.replace(/@\w*$/, `@${mentionUser.username} `);
        setCommentText(newText);
        setShowMentions(false);
        setMentionResults([]);
    };

    // ─── Submit comment (or update if editing) ───
    const handleAddComment = async () => {
        if (!commentText.trim() && !commentMedia) return;

        // If editing an existing comment
        if (editingComment) {
            try {
                await editComment(postId, editingComment.id, commentText.trim());
                setEditingComment(null);
                setCommentText('');
                loadComments();
            } catch (err) {
                Alert.alert('Error', 'Failed to update comment');
            }
            return;
        }

        setUploadingComment(true);
        try {
            let mediaUrl = null;
            let mediaType = null;
            let duration = null;
            let fileName = null;
            let fileSize = null;

            if (commentMedia) {
                mediaType = commentMedia.mediaType || (commentMedia.type === 'video' ? 'video' : 'image');
                if (mediaType === 'file') {
                    // Upload files as raw to Cloudinary
                    const uploaded = await uploadToCloudinary(commentMedia.uri, 'raw');
                    mediaUrl = uploaded.url;
                    fileName = commentMedia.fileName;
                    fileSize = commentMedia.fileSize;
                } else {
                    const resourceType = mediaType === 'image' ? 'image' : 'video';
                    const uploaded = await uploadToCloudinary(commentMedia.uri || commentMedia, resourceType);
                    mediaUrl = uploaded.url;
                    duration = commentMedia.duration || uploaded.duration || null;
                }
            }

            await addComment(postId, {
                authorId: user.uid,
                text: commentText.trim(),
                mediaUrl,
                mediaType,
                duration,
                fileName,
                fileSize,
                parentCommentId: replyTo?.id || null,
            });

            // Send mention notifications
            const mentions = commentText.match(/@(\w+)/g);
            if (mentions) {
                for (const mention of mentions) {
                    const username = mention.substring(1);
                    const mentionedProfile = Object.values(commentAuthors).find(
                        p => p.username?.toLowerCase() === username.toLowerCase()
                    );
                    if (mentionedProfile && mentionedProfile.id !== user.uid) {
                        createNotification(mentionedProfile.id, user.uid, 'mention', postId);
                    }
                }
            }

            setCommentText('');
            setCommentMedia(null);
            setReplyTo(null);
            setShowMentions(false);
            loadComments();
            loadPost();
        } catch (err) {
            console.error('Comment submission error:', err);
            Alert.alert('Error', 'Failed to post comment. Please try again.');
        } finally {
            setUploadingComment(false);
        }
    };

    // ─── Comment edit & delete ───
    const handleEditComment = (comment) => {
        setEditingComment(comment);
        setCommentText(comment.text || '');
        commentInputRef.current?.focus();
    };

    const handleDeleteComment = (comment) => {
        Alert.alert('Delete Comment', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                try {
                    await deleteComment(postId, comment.id);
                    loadComments();
                    loadPost();
                } catch (err) {
                    Alert.alert('Error', 'Failed to delete comment');
                }
            }},
        ]);
    };

    // ─── Comment long-press action sheet ───
    const handleCommentLongPress = (comment) => {
        const isOwner = comment.authorId === user?.uid;
        const buttons = [];
        if (comment.text) {
            buttons.push({ text: '📋 Copy Text', onPress: async () => {
                try { await Clipboard.setStringAsync(comment.text); Alert.alert('Copied!'); } catch {}
            }});
        }
        if (isOwner) {
            buttons.push({ text: '✏️ Edit', onPress: () => handleEditComment(comment) });
            buttons.push({ text: '🗑️ Delete', style: 'destructive', onPress: () => handleDeleteComment(comment) });
        } else {
            buttons.push({ text: '🚩 Report', onPress: () => Alert.alert('Reported', 'Thank you for reporting.') });
        }
        buttons.push({ text: 'Cancel', style: 'cancel' });
        Alert.alert('Comment', '', buttons);
    };

    // ─── Download comment media ───
    const downloadCommentMedia = async (url, type) => {
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Allow media library access to save files.');
                return;
            }
            let filename = url.split('/').pop()?.split('?')[0] || `banana_${Date.now()}`;
            if (!/\.[a-z0-9]+$/i.test(filename)) {
                filename += type === 'video' ? '.mp4' : type === 'audio' ? '.m4a' : '.jpg';
            }
            const localUri = FileSystem.documentDirectory + filename;
            const { uri: downloadedUri } = await FileSystem.downloadAsync(url, localUri);
            await MediaLibrary.saveToLibraryAsync(downloadedUri);
            Alert.alert('✅ Saved', 'Media saved to your gallery!');
        } catch (err) {
            Alert.alert('Download failed', err.message);
        }
    };

    const handleUpvote = async () => { await upvotePost(postId, user.uid); loadPost(); };
    const handleDownvote = async () => { await downvotePost(postId, user.uid); loadPost(); };

    const handleSave = async () => {
        const isSaved = userProfile?.savedPosts?.includes(postId);
        if (isSaved) await unsavePost(postId, user.uid);
        else await savePost(postId, user.uid);
    };

    const handleShare = async () => {
        Alert.alert("Share Post", "What would you like to do?", [
            { text: "Send to Chat", onPress: () => router.push(`/share-post/${postId}`) },
            {
                text: "Share via...", onPress: async () => {
                    try {
                        let shareMsg = post?.content || '';
                        shareMsg = shareMsg ? `${shareMsg}\n\n` : '';
                        shareMsg += `Shared from Banana Chat 🍌`;
                        const shareOpts = { message: shareMsg };
                        if (post?.media?.[0]) {
                            const mediaUri = typeof post.media[0] === 'string' ? post.media[0] : post.media[0]?.uri;
                            if (mediaUri) shareOpts.url = mediaUri;
                        }
                        await Share.share(shareOpts);
                        await incrementShareCount(postId);
                        loadPost();
                    } catch {}
                }
            },
            { text: "Cancel", style: "cancel" }
        ]);
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

    const renderTextWithMentions = (text, selectable = false) => {
        if (!text) return null;
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const combined = /(@\w+|https?:\/\/[^\s]+)/g;
        const parts = text.split(combined);
        return (
            <Text style={styles.postContent} selectable={selectable}>
                {parts.map((part, i) => {
                    if (part && part.startsWith('@')) {
                        return (
                            <Text key={i} style={styles.mentionText} onPress={() => {
                                const username = part.substring(1);
                                router.push(`/user/${username}`);
                            }}>
                                {part}
                            </Text>
                        );
                    }
                    if (part && part.match(urlRegex)) {
                        return (
                            <Text key={i} style={{ color: '#4A90D9', textDecorationLine: 'underline' }} onPress={() => Linking.openURL(part)}>
                                {part}
                            </Text>
                        );
                    }
                    return <Text key={i}>{part}</Text>;
                })}
            </Text>
        );
    };

    // ─── Comment media rendering ───
    const renderCommentMedia = (comment) => {
        if (!comment.mediaUrl) return null;

        // File/document
        if (comment.mediaType === 'file') {
            return (
                <TouchableOpacity
                    onPress={() => Linking.openURL(comment.mediaUrl)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, backgroundColor: Colors.surfaceLight, borderRadius: 10, padding: 10, maxWidth: 220 }}
                >
                    <Ionicons name="document-outline" size={24} color={Colors.primary} />
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '500' }} numberOfLines={1}>{comment.fileName || 'File'}</Text>
                        {comment.fileSize ? <Text style={{ color: Colors.textTertiary, fontSize: 11 }}>{(comment.fileSize / 1024).toFixed(1)} KB</Text> : null}
                    </View>
                    <TouchableOpacity onPress={() => downloadCommentMedia(comment.mediaUrl, 'file')}>
                        <Ionicons name="download-outline" size={18} color={Colors.primary} />
                    </TouchableOpacity>
                </TouchableOpacity>
            );
        }

        // Image
        if (comment.mediaType === 'image' || (!comment.mediaType && !comment.mediaUrl.match(/\.(mp4|mov|mp3|m4a|wav|ogg|webm)/i))) {
            return (
                <View>
                    <TouchableOpacity onPress={() => setViewerImage(comment.mediaUrl)} activeOpacity={0.9}>
                        <Image source={{ uri: comment.mediaUrl }} style={styles.commentMediaImage} resizeMode="cover" />
                        <View style={styles.commentMediaZoomHint}>
                            <Ionicons name="expand-outline" size={14} color="#fff" />
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => downloadCommentMedia(comment.mediaUrl, 'image')} style={{ position: 'absolute', top: 12, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, padding: 4 }}>
                        <Ionicons name="download-outline" size={14} color="#fff" />
                    </TouchableOpacity>
                </View>
            );
        }

        // Video — inline play/pause with mute
        if (comment.mediaType === 'video') {
            const isMuted = mutedCommentVideos[comment.id] !== false;
            const isPlaying = !!playingCommentVideos[comment.id];
            return (
                <View style={styles.commentVideoContainer}>
                    <TouchableOpacity
                        onPress={() => setPlayingCommentVideos(prev => ({ ...prev, [comment.id]: !isPlaying }))}
                        onLongPress={() => setViewerVideo(comment.mediaUrl)}
                        activeOpacity={0.9}
                    >
                        <Video
                            source={{ uri: comment.mediaUrl }}
                            style={styles.commentMediaVideo}
                            resizeMode={ResizeMode.COVER}
                            shouldPlay={isPlaying}
                            isMuted={isMuted}
                            isLooping
                        />
                        {!isPlaying && (
                            <View style={styles.commentVideoPlayOverlay}>
                                <Ionicons name="play-circle" size={40} color="rgba(255,255,255,0.85)" />
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.commentVideoMuteBtn}
                        onPress={() => setMutedCommentVideos(prev => ({ ...prev, [comment.id]: !isMuted }))}
                    >
                        <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={14} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => downloadCommentMedia(comment.mediaUrl, 'video')} style={{ position: 'absolute', top: 12, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, padding: 4 }}>
                        <Ionicons name="download-outline" size={14} color="#fff" />
                    </TouchableOpacity>
                </View>
            );
        }

        // Audio
        if (comment.mediaType === 'audio') {
            return (
                <View style={styles.commentAudioContainer}>
                    <AudioWavePlayer
                        uri={comment.mediaUrl}
                        duration={comment.duration || 0}
                        compact
                    />
                    <TouchableOpacity onPress={() => downloadCommentMedia(comment.mediaUrl, 'audio')} style={{ padding: 4 }}>
                        <Ionicons name="download-outline" size={16} color={Colors.primary} />
                    </TouchableOpacity>
                </View>
            );
        }

        // Fallback — show as image with download
        return (
            <View>
                <TouchableOpacity onPress={() => setViewerImage(comment.mediaUrl)} activeOpacity={0.9}>
                    <Image source={{ uri: comment.mediaUrl }} style={styles.commentMediaImage} resizeMode="cover" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => downloadCommentMedia(comment.mediaUrl, 'image')} style={{ position: 'absolute', top: 12, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, padding: 4 }}>
                    <Ionicons name="download-outline" size={14} color="#fff" />
                </TouchableOpacity>
            </View>
        );
    };

    // ─── Render comment node (with OP badge, reactions, long-press) ───
    const renderCommentNode = (comment, depth = 0) => {
        const cAuthor = commentAuthors[comment.authorId];
        const isOP = post && comment.authorId === post.authorId;
        return (
            <View key={comment.id} style={{ marginLeft: depth * 16, borderLeftWidth: depth > 0 ? 1 : 0, borderColor: Colors.border, paddingLeft: depth > 0 ? 8 : 0, marginTop: 12 }}>
                <TouchableOpacity activeOpacity={0.8} onLongPress={() => handleCommentLongPress(comment)}>
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
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                <Text style={styles.commentAuthor}>{cAuthor?.displayName || 'User'}</Text>
                                <PremiumBadge profile={cAuthor} size={12} />
                            </View>
                            {isOP && (
                                <View style={styles.opBadge}>
                                    <Text style={styles.opBadgeText}>OP</Text>
                                </View>
                            )}
                            <Text style={styles.commentTime}>
                                {formatTime(comment.createdAt?.seconds ? comment.createdAt.seconds * 1000 : Date.now())}
                                {comment.editedAt ? ' (edited)' : ''}
                            </Text>
                        </View>
                        {renderTextWithMentions(comment.text, true)}
                        {renderCommentMedia(comment)}

                        {/* Comment actions row */}
                        <View style={styles.commentActions}>
                            <TouchableOpacity style={styles.commentVote} onPress={() => { upvoteComment(postId, comment.id, user.uid); loadComments(); }}>
                                <Ionicons name="arrow-up" size={16} color={comment.upvotedBy?.includes(user?.uid) ? Colors.upvote : Colors.textTertiary} />
                            </TouchableOpacity>
                            <Text style={[styles.commentVoteCount, (comment.upvotes - comment.downvotes) > 0 && { color: Colors.upvote }]}>
                                {(comment.upvotes || 0) - (comment.downvotes || 0)}
                            </Text>
                            <TouchableOpacity onPress={() => { downvoteComment(postId, comment.id, user.uid); loadComments(); }}>
                                <Ionicons name="arrow-down" size={16} color={comment.downvotedBy?.includes(user?.uid) ? Colors.downvote : Colors.textTertiary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setReplyTo(comment)} style={{ marginLeft: Spacing.lg }}>
                                <Text style={styles.replyBtn}>Reply</Text>
                            </TouchableOpacity>
                            {/* Emoji reaction button */}
                            <TouchableOpacity onPress={() => setShowCommentReactionPicker(showCommentReactionPicker === comment.id ? null : comment.id)} style={{ marginLeft: Spacing.sm }}>
                                <Ionicons name="happy-outline" size={16} color={showCommentReactionPicker === comment.id ? Colors.primary : Colors.textTertiary} />
                            </TouchableOpacity>
                        </View>

                        {/* Emoji reaction picker */}
                        {showCommentReactionPicker === comment.id && (
                            <View style={{ flexDirection: 'row', gap: 2, paddingVertical: 4, paddingHorizontal: 2, backgroundColor: Colors.surfaceLight, borderRadius: 16, alignSelf: 'flex-start', marginTop: 4 }}>
                                {COMMENT_REACTIONS.map(emoji => (
                                    <TouchableOpacity key={emoji} onPress={async () => {
                                        setShowCommentReactionPicker(null);
                                        await addCommentReaction(postId, comment.id, user.uid, emoji);
                                        loadComments();
                                    }} style={{ padding: 3 }}>
                                        <Text style={{ fontSize: 18 }}>{emoji}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {/* Display comment reactions */}
                        {comment.reactions && Object.keys(comment.reactions).length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                {Object.entries(comment.reactions).filter(([_, count]) => count > 0).map(([emoji, count]) => (
                                    <View key={emoji} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: Colors.surfaceLight, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                                        <Text style={{ fontSize: 12 }}>{emoji}</Text>
                                        <Text style={{ color: Colors.textSecondary, fontSize: 10, fontWeight: '600' }}>{count}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                </View>
                </TouchableOpacity>
                {comment.children && comment.children.length > 0 && (
                    <View style={{ marginTop: 4 }}>
                        {comment.children.map(child => renderCommentNode(child, depth + 1))}
                    </View>
                )}
            </View>
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
        <KeyboardAvoidingView style={[styles.container, { backgroundColor: C.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, backgroundColor: C.surface, borderBottomColor: C.border }]}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={C.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: C.text }]}>Post</Text>
                <View style={{ width: 24 }} />
            </View>

            <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={() => (
                    <View>
                        {/* Post content */}
                        <View style={[styles.postCard, { backgroundColor: C.surface, ...skin.cardStyle }]}>
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
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={styles.authorName}>{author?.displayName}</Text>
                                        <PremiumBadge profile={author} size={14} />
                                    </View>
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

                            {post.content ? renderTextWithMentions(post.content, true) : null}

                            {post.media?.length > 0 && (
                                <View>
                                    <ScrollView
                                        ref={carouselScrollRef}
                                        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                                        onMomentumScrollEnd={(e) => {
                                            const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                                            setActiveMediaIndex(idx);
                                        }}
                                    >
                                        {post.media.map((item, i) => {
                                            const uri = typeof item === 'string' ? item : item?.uri;
                                            const isVideo = (typeof item !== 'string' && item?.type === 'video') ||
                                                            (uri && /\.(mp4|mov|avi)$/i.test(uri));
                                            if (isVideo) {
                                                return (
                                                    <Video key={i} source={{ uri }} style={styles.postImage}
                                                        resizeMode={ResizeMode.COVER} shouldPlay={i === activeMediaIndex}
                                                        isLooping useNativeControls
                                                    />
                                                );
                                            }
                                            return <Image key={i} source={{ uri }} style={styles.postImage} resizeMode="cover" />;
                                        })}
                                    </ScrollView>
                                    {post.media.length > 1 && (
                                        <View style={styles.paginationDots}>
                                            {post.media.map((_, i) => (
                                                <View key={i} style={[styles.paginationDot, i === activeMediaIndex && styles.paginationDotActive]} />
                                            ))}
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Download media for premium users */}
                            {downloadMediaEnabled && post.media?.length > 0 && (
                                <TouchableOpacity
                                    style={{
                                        flexDirection: 'row', alignItems: 'center', gap: 6,
                                        paddingVertical: 8, paddingHorizontal: 12,
                                        backgroundColor: C.primarySurface || Colors.primarySurface,
                                        borderRadius: 10, alignSelf: 'flex-start', marginTop: 8,
                                    }}
                                    onPress={async () => {
                                        try {
                                            const { status } = await MediaLibrary.requestPermissionsAsync();
                                            if (status !== 'granted') {
                                                Alert.alert('Permission needed', 'Allow media library access to save files.');
                                                return;
                                            }
                                            const item = post.media[activeMediaIndex] || post.media[0];
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
                                    <Ionicons name="download-outline" size={18} color={C.primary} />
                                    <Text style={{ color: C.primary, fontSize: 13, fontWeight: '600' }}>Save to Gallery</Text>
                                </TouchableOpacity>
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
                                    <Ionicons name="paper-plane-outline" size={20} color={C.textSecondary} />
                                    {(post.shareCount || 0) > 0 && (
                                        <Text style={[styles.actionCount, { color: C.textSecondary }]}>{formatCount(post.shareCount)}</Text>
                                    )}
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.actionBtn} onPress={async () => {
                                    try {
                                        await createReshare(user.uid, post.id);
                                        Alert.alert('✅ Reshared', 'Post reshared to your followers!');
                                    } catch (err) {
                                        Alert.alert('Error', err.message || 'Could not reshare');
                                    }
                                }}>
                                    <Ionicons name="repeat-outline" size={20} color={C.textSecondary} />
                                </TouchableOpacity>
                                <View style={{ flex: 1 }} />
                                <TouchableOpacity onPress={handleSave}>
                                    <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={22} color={isSaved ? Colors.primary : Colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

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
                renderItem={({ item: comment }) => renderCommentNode(comment, 0)}
                ListEmptyComponent={() => (
                    <View style={styles.emptyComments}>
                        <Text style={styles.emptyText}>No comments yet. Be the first!</Text>
                    </View>
                )}
                contentContainerStyle={styles.commentsList}
            />

            {/* @ Mention autosuggest dropdown */}
            {showMentions && mentionResults.length > 0 && (
                <View style={styles.mentionDropdown}>
                    {mentionResults.map(u => (
                        <TouchableOpacity key={u.id} style={styles.mentionItem} onPress={() => insertMention(u)} activeOpacity={0.7}>
                            {u.avatar ? (
                                <Image source={{ uri: u.avatar }} style={styles.mentionAvatar} />
                            ) : (
                                <View style={[styles.mentionAvatar, styles.mentionAvatarPlaceholder]}>
                                    <Text style={styles.mentionAvatarText}>{getInitials(u.displayName)}</Text>
                                </View>
                            )}
                            <View style={{ flex: 1 }}>
                                <Text style={styles.mentionName}>{u.displayName}</Text>
                                <Text style={styles.mentionUsername}>@{u.username}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Comment input */}
            <View style={[styles.commentInputBar, { paddingBottom: insets.bottom + Spacing.sm }]}>
                {(replyTo || editingComment) && (
                    <View style={styles.replyPreview}>
                        <Text style={styles.replyPreviewText}>
                            {editingComment ? '✏️ Editing comment' : `Replying to ${commentAuthors[replyTo.authorId]?.displayName || 'User'}`}
                        </Text>
                        <TouchableOpacity onPress={() => { setReplyTo(null); setEditingComment(null); setCommentText(''); }}>
                            <Ionicons name="close" size={16} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Recording indicator */}
                {isRecordingComment && (
                    <View style={styles.recordingBar}>
                        <View style={styles.recordingWave}>
                            <View style={styles.recordingDot} />
                            <Text style={styles.recordingTimeText}>
                                {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
                            </Text>
                            {/* Animated recording bars */}
                            <View style={styles.recordingBars}>
                                {[...Array(12)].map((_, i) => (
                                    <View key={i} style={[styles.recBar, { height: 4 + Math.random() * 14, backgroundColor: Colors.error }]} />
                                ))}
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                            <TouchableOpacity style={styles.cancelRecBtn} onPress={cancelCommentAudioRecording}>
                                <Ionicons name="close" size={20} color={Colors.error} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.sendRecBtn} onPress={stopCommentAudioRecording}>
                                <Ionicons name="checkmark" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {!isRecordingComment && (
                    <View style={styles.commentInputRow}>
                        {/* Attachment menu button */}
                        <TouchableOpacity style={{ marginRight: 4 }} onPress={() => setShowAttachMenu(!showAttachMenu)}>
                            <Ionicons name="add-circle-outline" size={26} color={Colors.textSecondary} />
                        </TouchableOpacity>
                        {/* Mic button */}
                        <TouchableOpacity style={{ marginRight: 4 }} onPress={startCommentAudioRecording}>
                            <Ionicons name="mic-outline" size={24} color={Colors.textSecondary} />
                        </TouchableOpacity>
                        <TextInput
                            ref={commentInputRef}
                            style={styles.commentInput}
                            placeholder={editingComment ? "Edit your comment..." : "Add a comment..."}
                            placeholderTextColor={Colors.textTertiary}
                            value={commentText}
                            onChangeText={handleCommentTextChange}
                            editable={!uploadingComment}
                            multiline
                        />
                        <TouchableOpacity
                            style={styles.sendBtn}
                            onPress={handleAddComment}
                            disabled={uploadingComment}
                        >
                            {uploadingComment ? <ActivityIndicator size="small" color={Colors.primary} /> : <Ionicons name="send" size={24} color={Colors.primary} />}
                        </TouchableOpacity>
                    </View>
                )}

                {/* Attachment menu */}
                {showAttachMenu && (
                    <View style={styles.attachMenu}>
                        <TouchableOpacity style={styles.attachMenuItem} onPress={pickCommentMedia}>
                            <Ionicons name="images" size={22} color={Colors.primary} />
                            <Text style={styles.attachMenuText}>Media</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.attachMenuItem} onPress={pickCommentFile}>
                            <Ionicons name="document" size={22} color={Colors.warning || '#FF9500'} />
                            <Text style={styles.attachMenuText}>File</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.attachMenuItem} onPress={startCommentAudioRecording}>
                            <Ionicons name="mic" size={22} color={Colors.error} />
                            <Text style={styles.attachMenuText}>Audio</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Media preview */}
                {commentMedia && !isRecordingComment && (
                    <View style={styles.mediaPreviewRow}>
                        {commentMedia.mediaType === 'audio' ? (
                            <View style={styles.audioPreview}>
                                <Ionicons name="musical-note" size={20} color={Colors.primary} />
                                <Text style={styles.audioPreviewText}>
                                    Audio · {commentMedia.duration ? `${Math.floor(commentMedia.duration / 60)}:${String(commentMedia.duration % 60).padStart(2, '0')}` : 'Recorded'}
                                </Text>
                            </View>
                        ) : commentMedia.mediaType === 'video' ? (
                            <View style={styles.videoPreviewThumb}>
                                <Ionicons name="videocam" size={20} color={Colors.primary} />
                                <Text style={styles.audioPreviewText}>Video attached</Text>
                            </View>
                        ) : commentMedia.mediaType === 'file' ? (
                            <View style={styles.videoPreviewThumb}>
                                <Ionicons name="document" size={20} color={Colors.warning || '#FF9500'} />
                                <Text style={styles.audioPreviewText} numberOfLines={1}>{commentMedia.fileName || 'File'}</Text>
                            </View>
                        ) : (
                            <Image source={{ uri: commentMedia.uri }} style={{ width: 60, height: 60, borderRadius: 8 }} />
                        )}
                        <TouchableOpacity style={styles.removeMediaBtn} onPress={() => setCommentMedia(null)}>
                            <Ionicons name="close-circle" size={20} color={Colors.error} />
                        </TouchableOpacity>
                    </View>
                )}
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

            {/* Image viewer modal */}
            <ImageViewer visible={!!viewerImage} imageUrl={viewerImage} onClose={() => setViewerImage(null)} />
            {/* Video viewer modal */}
            <VideoViewer visible={!!viewerVideo} videoUrl={viewerVideo} onClose={() => setViewerVideo(null)} />
        </KeyboardAvoidingView>
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
    postImage: { width: SCREEN_WIDTH, height: 300 },
    paginationDots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 8, gap: 6 },
    paginationDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.textTertiary },
    paginationDotActive: { backgroundColor: Colors.primary, width: 18 },
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
    commentRow: { flexDirection: 'row', gap: Spacing.sm },
    commentAvatar: { width: 32, height: 32, borderRadius: 16 },
    commentAvatarInitials: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: 'bold' },
    commentContent: { flex: 1 },
    commentTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
    commentAuthor: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
    commentTime: { color: Colors.textTertiary, fontSize: FontSize.xs },
    // OP Badge — Reddit-style flair
    opBadge: {
        backgroundColor: '#FFD600',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    opBadgeText: {
        color: '#1A1A1A',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    commentActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
    commentVote: { padding: 2 },
    commentVoteCount: { color: Colors.textSecondary, fontSize: FontSize.xs, minWidth: 20, textAlign: 'center' },
    replyBtn: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '600' },
    // Comment media styles
    commentMediaImage: { width: 180, height: 180, borderRadius: 10, marginTop: 8 },
    commentMediaZoomHint: {
        position: 'absolute', bottom: 12, right: 4,
        backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10,
        padding: 4,
    },
    commentVideoContainer: { marginTop: 8, position: 'relative' },
    commentMediaVideo: { width: 200, height: 160, borderRadius: 10 },
    commentVideoPlayOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: 'center', alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10,
    },
    commentVideoMuteBtn: {
        position: 'absolute', bottom: 8, right: 8,
        backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12,
        padding: 4,
    },
    commentAudioContainer: {
        marginTop: 8,
        backgroundColor: Colors.surfaceLight,
        borderRadius: BorderRadius.lg,
        padding: Spacing.sm,
        maxWidth: 220,
    },
    emptyComments: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { color: Colors.textTertiary, fontSize: FontSize.md },
    // Comment input bar
    commentInputBar: { backgroundColor: Colors.surface, borderTopWidth: 0.5, borderTopColor: Colors.border },
    replyPreview: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, backgroundColor: Colors.surfaceLight },
    replyPreviewText: { color: Colors.primary, fontSize: FontSize.xs },
    commentInputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, gap: 4 },
    commentInput: { flex: 1, backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.xl, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, color: Colors.text, fontSize: FontSize.md, maxHeight: 80 },
    sendBtn: { padding: Spacing.sm },
    // Attachment menu
    attachMenu: {
        flexDirection: 'row', gap: Spacing.lg, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
        borderTopWidth: 0.5, borderTopColor: Colors.border,
    },
    attachMenuItem: { alignItems: 'center', gap: 4 },
    attachMenuText: { color: Colors.textSecondary, fontSize: 10, fontWeight: '600' },
    // Media preview
    mediaPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
    audioPreview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    audioPreviewText: { color: Colors.text, fontSize: FontSize.sm },
    videoPreviewThumb: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    removeMediaBtn: { padding: 4 },
    // Recording bar
    recordingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    recordingWave: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
    recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.error },
    recordingTimeText: { color: Colors.error, fontSize: FontSize.md, fontWeight: '600' },
    recordingBars: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
    recBar: { width: 3, borderRadius: 2 },
    cancelRecBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    sendRecBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
    // @ Mention autosuggest
    mentionDropdown: {
        backgroundColor: Colors.surfaceElevated || Colors.surface,
        borderTopWidth: 1, borderTopColor: Colors.border,
        maxHeight: 200,
    },
    mentionItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
    mentionAvatar: { width: 30, height: 30, borderRadius: 15 },
    mentionAvatarPlaceholder: { backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    mentionAvatarText: { color: Colors.primary, fontSize: 10, fontWeight: 'bold' },
    mentionName: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
    mentionUsername: { color: Colors.textSecondary, fontSize: FontSize.xs },
    // Likes modal
    likesOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    likesModal: { backgroundColor: Colors.surface, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, maxHeight: '60%', paddingBottom: 30 },
    likesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    likesTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text },
    likerItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    likerAvatar: { width: 40, height: 40, borderRadius: 20 },
    likerName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
    likerUsername: { color: Colors.textSecondary, fontSize: FontSize.sm },
});
