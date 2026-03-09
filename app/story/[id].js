import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Animated, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { getStories, viewStory, deleteStory, softDelete, archiveStory } from '../../services/stories';
import { getUserProfile } from '../../services/users';
import { getOrCreateDMChat, sendMessage } from '../../services/chat';
import { useAuth } from '../../contexts/AuthContext';
import { formatTime, getInitials } from '../../utils/helpers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STORY_LABELS } from '../../utils/constants';

const { width, height } = Dimensions.get('window');

export default function StoryViewerScreen() {
    const { id: authorId } = useLocalSearchParams();
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [stories, setStories] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [author, setAuthor] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [isPaused, setIsPaused] = useState(false);
    const progress = useRef(new Animated.Value(0)).current;
    const timer = useRef(null);

    useEffect(() => {
        loadStories();
        return () => { if (timer.current) clearTimeout(timer.current); };
    }, [authorId]);

    useEffect(() => {
        if (stories.length > 0 && !isPaused) startProgress();
        return () => { progress.stopAnimation(); clearTimeout(timer.current); };
    }, [currentIndex, stories, isPaused]);

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
            // Create/get DM chat with story author and send as a story reply
            const dm = await getOrCreateDMChat(user.uid, authorId);
            await sendMessage(dm.id, {
                senderId: user.uid,
                text: `📸 Story reply: ${replyText.trim()}`,
                type: 'text',
            });
            setReplyText('');
            Alert.alert('Sent!', 'Your reply was sent as a message.');
        } catch (err) {
            Alert.alert('Error', 'Could not send reply');
        }
    };

    const handleDeleteStory = async () => {
        const current = stories[currentIndex];
        if (current?.authorId === user?.uid) {
            Alert.alert('Delete Story', 'Move to recently deleted? (30 days)', [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                        await softDelete(current.id, 'story', current);
                        if (stories.length <= 1) router.back();
                        else nextStory();
                    }
                },
            ]);
        }
    };

    const handleAddToHighlight = async () => {
        const current = stories[currentIndex];
        if (!current || current.authorId !== user?.uid) return;

        // Archive the story first, then navigate to highlight editor
        try {
            await archiveStory(current.id);
            Alert.alert(
                current.type === 'public' ? 'Add to Spotlight' : 'Add to Memory',
                'Story archived! Create a highlight from your archive.',
                [{ text: 'Later' }, { text: 'Create Now', onPress: () => router.push('/highlight-editor') }]
            );
        } catch (err) {
            Alert.alert('Error', err.message);
        }
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
            <Image source={{ uri: current.media }} style={styles.storyImage} resizeMode="cover" />

            {/* Text overlay */}
            {current.text ? (
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
                    <View style={styles.viewersContainer}>
                        <Ionicons name="eye-outline" size={16} color="#fff" />
                        <Text style={styles.viewersCount}>
                            {current.viewers?.length || 0} views
                        </Text>
                    </View>
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
                                // Quick heart react
                                handleReplyStory.call(null);
                                setReplyText('❤️');
                                setTimeout(() => handleReplyStory(), 100);
                            }}>
                                <Ionicons name="heart-outline" size={22} color="#fff" />
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>
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
    tapZones: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 5 },
    tapLeft: { flex: 1 },
    tapRight: { flex: 2 },
    bottomArea: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 15, paddingHorizontal: 16 },
    viewersContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    viewersCount: { color: '#fff', fontSize: 12 },
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
});
