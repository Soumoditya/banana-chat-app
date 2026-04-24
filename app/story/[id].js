import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Animated, TextInput, Modal, FlatList, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { getStories, viewStory, deleteStory, softDelete, archiveStory, getUserStories } from '../../services/stories';
import { getUserProfile } from '../../services/users';
import { getOrCreateDMChat, sendMessage } from '../../services/chat';
import { useAuth } from '../../contexts/AuthContext';
import { formatTime, getInitials } from '../../utils/helpers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STORY_LABELS } from '../../utils/constants';
import { useToast } from '../../contexts/ToastContext';

const { width, height } = Dimensions.get('window');

export default function StoryViewerScreen() {
    const { id: authorId } = useLocalSearchParams();
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { showToast, showConfirm } = useToast();
    const [stories, setStories] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [author, setAuthor] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [isPaused, setIsPaused] = useState(false);
    const progress = useRef(new Animated.Value(0)).current;
    const timer = useRef(null);
    // Viewers modal (Instagram-style)
    const [showViewers, setShowViewers] = useState(false);
    const [viewerProfiles, setViewerProfiles] = useState([]);
    const [loadingViewers, setLoadingViewers] = useState(false);

    useEffect(() => {
        loadStories();
        return () => { if (timer.current) clearTimeout(timer.current); };
    }, [authorId]);

    useEffect(() => {
        if (stories.length > 0 && !isPaused && !showViewers) startProgress();
        return () => { progress.stopAnimation(); clearTimeout(timer.current); };
    }, [currentIndex, stories, isPaused, showViewers]);

    const loadStories = async () => {
        const allStories = await getStories(userProfile);
        const authorStories = allStories[authorId] || [];
        setStories(authorStories);

        const profile = await getUserProfile(authorId);
        setAuthor(profile);

        if (authorStories.length > 0 && user) {
            viewStory(authorStories[0].id, user.uid);
        }
    };

    const startProgress = () => {
        progress.setValue(0);
        Animated.timing(progress, {
            toValue: 1,
            duration: 5000,
            useNativeDriver: false,
        }).start(({ finished }) => {
            if (finished) nextStory();
        });
    };

    const nextStory = () => {
        if (currentIndex < stories.length - 1) {
            setCurrentIndex(currentIndex + 1);
            if (user) viewStory(stories[currentIndex + 1].id, user.uid);
        } else {
            router.back();
        }
    };

    const prevStory = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    const handleReplyStory = async () => {
        if (!replyText.trim() || !user) return;
        try {
            const dm = await getOrCreateDMChat(user.uid, authorId);
            await sendMessage(dm.id, {
                senderId: user.uid,
                text: `📸 Story reply: ${replyText.trim()}`,
                type: 'text',
            });
            setReplyText('');
            showToast('Your reply was sent as a message', 'success', 'Sent!');
        } catch (err) {
            showToast('Could not send reply', 'error');
        }
    };

    const handleDeleteStory = async () => {
        const current = stories[currentIndex];
        if (current?.authorId === user?.uid) {
            showConfirm('Delete Story', 'Move to recently deleted? (30 days)',
                async () => {
                    await softDelete(current.id, 'story', current);
                    if (stories.length <= 1) router.back();
                    else nextStory();
                },
                { variant: 'destructive', confirmText: 'Delete', icon: 'trash-outline' }
            );
        }
    };

    const handleAddToHighlight = async () => {
        const current = stories[currentIndex];
        if (!current || current.authorId !== user?.uid) return;

        try {
            await archiveStory(current.id);
            showConfirm(
                current.type === 'public' ? 'Add to Spotlight' : 'Add to Memory',
                'Story archived! Create a highlight from your archive.',
                () => router.push('/highlight-editor'),
                { confirmText: 'Create Now', cancelText: 'Later', icon: 'bookmark-outline' }
            );
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // Instagram-style: load viewer profiles
    const openViewersList = async () => {
        const current = stories[currentIndex];
        if (!current?.viewers?.length) return;
        setShowViewers(true);
        setIsPaused(true);
        progress.stopAnimation();
        setLoadingViewers(true);
        try {
            const profiles = [];
            for (const uid of current.viewers.slice(0, 50)) {
                const p = await getUserProfile(uid);
                if (p) profiles.push({ ...p, id: uid });
            }
            setViewerProfiles(profiles);
        } catch (e) {}
        setLoadingViewers(false);
    };

    const closeViewers = () => {
        setShowViewers(false);
        setIsPaused(false);
    };

    const current = stories[currentIndex];

    if (!current) {
        return (
            <View style={styles.container}>
                <Text style={styles.noStories}>No stories to show</Text>
                <TouchableOpacity style={[styles.closeBtn, { top: insets.top + 10 }]} onPress={() => router.back()}>
                    <Ionicons name="close" size={28} color={Colors.text} />
                </TouchableOpacity>
            </View>
        );
    }

    const isOwn = current.authorId === user?.uid;

    return (
        <View style={styles.container}>
            {/* Progress bars */}
            <View style={[styles.progressContainer, { paddingTop: insets.top + 8 }]}>
                {stories.map((_, index) => (
                    <View key={index} style={styles.progressTrack}>
                        <Animated.View
                            style={[
                                styles.progressBar,
                                {
                                    width: index < currentIndex ? '100%' :
                                        index === currentIndex ? progress.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: ['0%', '100%'],
                                        }) : '0%',
                                },
                            ]}
                        />
                    </View>
                ))}
            </View>

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.authorInfo}>
                    {author?.avatar ? (
                        <Image source={{ uri: author.avatar }} style={styles.authorAvatar} />
                    ) : (
                        <View style={[styles.authorAvatar, styles.avatarPlaceholder]}>
                            <Text style={styles.avatarInitials}>{getInitials(author?.displayName)}</Text>
                        </View>
                    )}
                    <View>
                        <Text style={styles.authorName}>{author?.displayName}</Text>
                        <Text style={styles.storyTime}>
                            {formatTime(current.createdAt?.seconds ? current.createdAt.seconds * 1000 : Date.now())}
                        </Text>
                    </View>
                </View>
                <View style={styles.headerActions}>
                    {isOwn && (
                        <TouchableOpacity onPress={handleAddToHighlight} style={{ marginRight: 16 }}>
                            <Ionicons name={current.type === 'public' ? 'sunny-outline' : 'heart-outline'} size={22} color="#fff" />
                        </TouchableOpacity>
                    )}
                    {isOwn && (
                        <TouchableOpacity onPress={handleDeleteStory} style={{ marginRight: 16 }}>
                            <Ionicons name="trash-outline" size={22} color="#fff" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="close" size={28} color={Colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Story type badge */}
            <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>
                    {current.type === 'public' ? '🌍 Story' : current.type === 'friends' ? '👥 Status' : '💚 Snap'}
                </Text>
            </View>

            {/* Story Content */}
            {current.media ? (
                <Image source={{ uri: current.media }} style={styles.storyImage} resizeMode="cover" />
            ) : (
                <View style={[styles.storyImage, { backgroundColor: current.bgColor || '#1a1a2e', justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
                    <Text style={[styles.textOnlyStory, current.fontStyle === 'serif' && { fontFamily: 'serif' }, current.fontStyle === 'mono' && { fontFamily: 'monospace' }]}>
                        {current.text || ''}
                    </Text>
                </View>
            )}

            {/* Text overlay (for media stories with caption) */}
            {current.text && current.media ? (
                <View style={styles.textOverlay}>
                    <Text style={styles.storyText}>{current.text}</Text>
                </View>
            ) : null}

            {/* Tap zones */}
            <View style={styles.tapZones}>
                <TouchableOpacity style={styles.tapLeft} onPress={prevStory} />
                <TouchableOpacity style={styles.tapRight} onPress={nextStory} />
            </View>

            {/* Bottom area: Viewers (own) or Reply input (others) */}
            <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 10 }]}>
                {isOwn ? (
                    <TouchableOpacity style={styles.viewersContainer} onPress={openViewersList}>
                        <Ionicons name="eye-outline" size={18} color="#fff" />
                        <Text style={styles.viewersCount}>
                            {current.viewers?.length || 0} views
                        </Text>
                        <Ionicons name="chevron-up" size={16} color="rgba(255,255,255,0.6)" />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.replyContainer}>
                        <TextInput
                            style={styles.replyInput}
                            placeholder={`Reply to ${author?.displayName || 'story'}...`}
                            placeholderTextColor="rgba(255,255,255,0.5)"
                            value={replyText}
                            onChangeText={setReplyText}
                            onFocus={() => {
                                setIsPaused(true);
                                progress.stopAnimation();
                            }}
                            onBlur={() => setIsPaused(false)}
                        />
                        {replyText.trim() ? (
                            <TouchableOpacity style={styles.replySendBtn} onPress={handleReplyStory}>
                                <Ionicons name="send" size={20} color={Colors.primary} />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={styles.replySendBtn} onPress={() => {
                                setReplyText('❤️');
                                setTimeout(() => handleReplyStory(), 100);
                            }}>
                                <Ionicons name="heart-outline" size={22} color="#fff" />
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>

            {/* Instagram-style Viewers Modal */}
            <Modal visible={showViewers} transparent animationType="slide" onRequestClose={closeViewers}>
                <View style={styles.viewersModalOverlay}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={closeViewers} activeOpacity={1} />
                    <View style={[styles.viewersModal, { paddingBottom: insets.bottom + 16 }]}>
                        <View style={styles.viewersHandle} />
                        <View style={styles.viewersHeader}>
                            <Text style={styles.viewersTitle}>Viewers</Text>
                            <Text style={styles.viewersSubtitle}>{current.viewers?.length || 0}</Text>
                        </View>
                        {loadingViewers ? (
                            <Text style={styles.viewersLoading}>Loading...</Text>
                        ) : viewerProfiles.length === 0 ? (
                            <View style={styles.viewersEmpty}>
                                <Ionicons name="eye-off-outline" size={40} color={Colors.textTertiary} />
                                <Text style={styles.viewersEmptyText}>No viewers yet</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={viewerProfiles}
                                keyExtractor={item => item.id}
                                style={{ maxHeight: height * 0.45 }}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.viewerItem}
                                        onPress={() => { closeViewers(); router.push(`/user/${item.id}`); }}
                                    >
                                        {item.avatar ? (
                                            <Image source={{ uri: item.avatar }} style={styles.viewerAvatar} />
                                        ) : (
                                            <View style={[styles.viewerAvatar, styles.avatarPlaceholder]}>
                                                <Text style={styles.avatarInitials}>{getInitials(item.displayName)}</Text>
                                            </View>
                                        )}
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={styles.viewerName}>{item.displayName}</Text>
                                            <Text style={styles.viewerUsername}>@{item.username}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => { closeViewers(); router.push(`/user/${item.id}`); }}>
                                            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    noStories: { color: Colors.text, textAlign: 'center', marginTop: 100 },
    closeBtn: { position: 'absolute', right: 20 },
    progressContainer: { flexDirection: 'row', gap: 3, paddingHorizontal: 8, zIndex: 10 },
    progressTrack: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 1, overflow: 'hidden' },
    progressBar: { height: '100%', backgroundColor: '#fff', borderRadius: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, zIndex: 10 },
    authorInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerActions: { flexDirection: 'row', alignItems: 'center' },
    typeBadge: {
        position: 'absolute', top: 100, alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 4,
        borderRadius: 16, zIndex: 15,
    },
    typeBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    authorAvatar: { width: 36, height: 36, borderRadius: 18 },
    avatarPlaceholder: { backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    avatarInitials: { color: Colors.primary, fontWeight: 'bold' },
    authorName: { color: '#fff', fontSize: 14, fontWeight: '600' },
    storyTime: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
    storyImage: { ...StyleSheet.absoluteFillObject, width, height },
    textOverlay: { position: 'absolute', bottom: 120, left: 20, right: 20, zIndex: 10 },
    storyText: { color: '#fff', fontSize: 18, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4 },
    textOnlyStory: { color: '#fff', fontSize: 26, fontWeight: '700', textAlign: 'center', lineHeight: 38 },
    tapZones: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 5 },
    tapLeft: { flex: 1 },
    tapRight: { flex: 2 },
    bottomArea: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 15, paddingHorizontal: 16 },
    viewersContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20 },
    viewersCount: { color: '#fff', fontSize: 13, fontWeight: '600' },
    replyContainer: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 24,
        paddingHorizontal: 16, paddingVertical: 4,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    },
    replyInput: {
        flex: 1, color: '#fff', fontSize: 14, paddingVertical: 10,
    },
    replySendBtn: { padding: 4 },
    // Viewers Modal
    viewersModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    viewersModal: {
        backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
        paddingTop: 8, minHeight: 200,
    },
    viewersHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.textTertiary, alignSelf: 'center', marginBottom: 12 },
    viewersHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    viewersTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },
    viewersSubtitle: { color: Colors.textSecondary, fontSize: 14 },
    viewersLoading: { color: Colors.textSecondary, textAlign: 'center', padding: 40 },
    viewersEmpty: { alignItems: 'center', paddingVertical: 40 },
    viewersEmptyText: { color: Colors.textTertiary, fontSize: 14, marginTop: 8 },
    viewerItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
    viewerAvatar: { width: 44, height: 44, borderRadius: 22 },
    viewerName: { color: Colors.text, fontSize: 15, fontWeight: '600' },
    viewerUsername: { color: Colors.textSecondary, fontSize: 13 },
});
