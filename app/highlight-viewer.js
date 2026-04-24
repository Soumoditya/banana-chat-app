import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Animated, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { getStoriesByIds, deleteHighlight } from '../services/stories';
import { getUserProfile } from '../services/users';
import { useAuth } from '../contexts/AuthContext';
import { formatTime, getInitials } from '../utils/helpers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

export default function HighlightViewerScreen() {
    const { highlightId, storyIds: storyIdsParam, authorId, highlightName } = useLocalSearchParams();
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [stories, setStories] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [author, setAuthor] = useState(null);
    const progress = useRef(new Animated.Value(0)).current;
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (stories.length > 0) startProgress();
        return () => { progress.stopAnimation(); };
    }, [currentIndex, stories]);

    const loadData = async () => {
        try {
            const ids = storyIdsParam ? JSON.parse(storyIdsParam) : [];
            const fetchedStories = await getStoriesByIds(ids);
            setStories(fetchedStories);
            if (authorId) {
                const p = await getUserProfile(authorId);
                setAuthor(p);
            }
        } catch (err) {
            console.error('Highlight load error:', err);
        } finally {
            setLoading(false);
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
        } else {
            router.back();
        }
    };

    const prevStory = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    const handleDeleteHighlight = () => {
        if (!highlightId) return;
        Alert.alert('Delete Highlight', 'Are you sure? This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    await deleteHighlight(highlightId);
                    router.back();
                }
            },
        ]);
    };

    const current = stories[currentIndex];

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={{ color: '#fff', marginTop: 16, fontSize: 14 }}>Loading highlight...</Text>
                <TouchableOpacity style={[styles.closeBtn, { top: insets.top + 10 }]} onPress={() => router.back()}>
                    <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
            </View>
        );
    }

    if (!current) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="images-outline" size={56} color="rgba(255,255,255,0.4)" />
                <Text style={[styles.noStories, { marginTop: 16 }]}>No stories in this highlight</Text>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
                    Some stories may have been permanently deleted or are no longer available.
                </Text>
                <TouchableOpacity style={[styles.closeBtn, { top: insets.top + 10 }]} onPress={() => router.back()}>
                    <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
            </View>
        );
    }

    const isOwn = user?.uid === authorId;

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
                        <Text style={styles.authorName}>{highlightName || 'Highlight'}</Text>
                        <Text style={styles.storyTime}>
                            {formatTime(current.createdAt?.seconds ? current.createdAt.seconds * 1000 : Date.now())}
                        </Text>
                    </View>
                </View>
                <View style={styles.headerActions}>
                    {isOwn && (
                        <TouchableOpacity onPress={handleDeleteHighlight} style={{ marginRight: 16 }}>
                            <Ionicons name="trash-outline" size={22} color="#fff" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                </View>
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

            {/* Text overlay */}
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

            {/* Page counter */}
            <View style={[styles.pageCounter, { bottom: insets.bottom + 16 }]}>
                <Text style={styles.pageCounterText}>{currentIndex + 1} / {stories.length}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    noStories: { color: '#fff', textAlign: 'center', marginTop: 100 },
    closeBtn: { position: 'absolute', right: 20 },
    progressContainer: { flexDirection: 'row', gap: 3, paddingHorizontal: 8, zIndex: 10 },
    progressTrack: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 1, overflow: 'hidden' },
    progressBar: { height: '100%', backgroundColor: '#fff', borderRadius: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, zIndex: 10 },
    authorInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerActions: { flexDirection: 'row', alignItems: 'center' },
    authorAvatar: { width: 36, height: 36, borderRadius: 18 },
    avatarPlaceholder: { backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    avatarInitials: { color: Colors.primary, fontWeight: 'bold' },
    authorName: { color: '#fff', fontSize: 15, fontWeight: '700' },
    storyTime: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
    storyImage: { ...StyleSheet.absoluteFillObject, width, height },
    textOverlay: { position: 'absolute', bottom: 100, left: 20, right: 20, zIndex: 10 },
    storyText: { color: '#fff', fontSize: 18, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4 },
    textOnlyStory: { color: '#fff', fontSize: 26, fontWeight: '700', textAlign: 'center', lineHeight: 38 },
    tapZones: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 5 },
    tapLeft: { flex: 1 },
    tapRight: { flex: 2 },
    pageCounter: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, zIndex: 15 },
    pageCounterText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
