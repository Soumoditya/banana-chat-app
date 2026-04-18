import { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Image,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { usePremium } from '../../contexts/PremiumContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../../utils/theme';
import AppleEmojiPicker from '../../components/AppleEmojiPicker';
import { Ionicons } from '@expo/vector-icons';
import { createPost } from '../../services/posts';
import { createStory } from '../../services/stories';
import { uploadToCloudinary } from '../../config/cloudinary';
import { POST_TYPES, STORY_TYPES, PRIVACY } from '../../utils/constants';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMaxMedia, getMaxPostLength, isPremiumActive } from '../../utils/premium';

const STORY_BG_COLORS = [
    '#1a1a2e', '#16213e', '#0f3460', '#e94560', '#533483',
    '#2b2d42', '#8d99ae', '#06d6a0', '#ef476f', '#ffd166',
    '#118ab2', '#073b4c', '#264653', '#e76f51', '#2a9d8f',
];
const STORY_FONT_STYLES = [
    { id: 'normal', label: 'Default', fontFamily: undefined },
    { id: 'serif', label: 'Serif', fontFamily: 'serif' },
    { id: 'mono', label: 'Mono', fontFamily: 'monospace' },
];

export default function CreateTab() {
    const { user, userProfile } = useAuth();
    const { themedColors: C, activeFont, iosEmojiEnabled } = usePremium();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [activeTab, setActiveTab] = useState('post');
    const [content, setContent] = useState('');
    const [media, setMedia] = useState([]);
    const [postType, setPostType] = useState(POST_TYPES.TEXT);
    const [storyType, setStoryType] = useState(STORY_TYPES.PUBLIC);
    const [visibility, setVisibility] = useState(PRIVACY.PUBLIC);
    const [pollOptions, setPollOptions] = useState(['', '']);
    const [loading, setLoading] = useState(false);
    const [hiddenFrom, setHiddenFrom] = useState([]);
    const [postSuccess, setPostSuccess] = useState(false);
    // Text-only story state
    const [storyBgColor, setStoryBgColor] = useState(STORY_BG_COLORS[0]);
    const [storyFontStyle, setStoryFontStyle] = useState('normal');

    // Reset form when tab gains focus
    useFocusEffect(
        useCallback(() => {
            setPostSuccess(false);
        }, [])
    );

    // Block guest users
    if (userProfile?.isGuest) {
        return (
            <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>🔒</Text>
                <Text style={{ color: Colors.text, fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>Guest Account</Text>
                <Text style={{ color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 24 }}>Create a free account to post content, share stories, and interact with others.</Text>
                <TouchableOpacity 
                    style={{ backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 }}
                    onPress={() => router.push('/(auth)/signup')}
                >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Create Account</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Success state
    if (postSuccess) {
        return (
            <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                <Text style={{ fontSize: 64, marginBottom: 16 }}>✅</Text>
                <Text style={{ color: Colors.text, fontSize: 22, fontWeight: 'bold', marginBottom: 8 }}>Posted!</Text>
                <Text style={{ color: Colors.textSecondary, fontSize: 14, marginBottom: 24 }}>Your content is now live.</Text>
                <TouchableOpacity 
                    style={{ backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12, marginBottom: 12 }}
                    onPress={() => { setPostSuccess(false); router.push('/(tabs)/home'); }}
                >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>View Feed</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={{ paddingHorizontal: 24, paddingVertical: 10 }}
                    onPress={() => {
                        setPostSuccess(false);
                        resetForm();
                    }}
                >
                    <Text style={{ color: Colors.primary, fontWeight: '600' }}>Create Another</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const resetForm = () => {
        setContent('');
        setMedia([]);
        setPostType(POST_TYPES.TEXT);
        setStoryType(STORY_TYPES.PUBLIC);
        setVisibility(PRIVACY.PUBLIC);
        setPollOptions(['', '']);
        setHiddenFrom([]);
    };

    const pickMedia = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please allow access to your photo library.');
                return;
            }

            let result;
            try {
                result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images', 'videos'],
                    allowsMultipleSelection: true,
                    quality: 0.7,
                    selectionLimit: 10,
                });
            } catch (e) {
                result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.All,
                    allowsMultipleSelection: true,
                    quality: 0.7,
                    selectionLimit: 10,
                });
            }

            if (!result.canceled && result.assets?.length > 0) {
                const maxMedia = getMaxMedia(userProfile);
                const newTotal = media.length + result.assets.length;
                if (newTotal > maxMedia) {
                    const premium = isPremiumActive(userProfile);
                    Alert.alert(
                        'Media Limit',
                        premium
                            ? `Your plan allows up to ${maxMedia} media. You've selected ${newTotal}.`
                            : `Free accounts can add up to ${maxMedia} media. Upgrade to Premium for up to 20!`,
                        premium ? [{ text: 'OK' }] : [
                            { text: 'OK' },
                            { text: 'Go Premium ✨', onPress: () => router.push('/premium') },
                        ]
                    );
                    // Still add up to the limit
                    const allowed = result.assets.slice(0, maxMedia - media.length);
                    if (allowed.length > 0) setMedia(prev => [...prev, ...allowed]);
                } else {
                    setMedia(prev => [...prev, ...result.assets]);
                }
                const firstAsset = result.assets[0];
                if (firstAsset.type === 'video' || (firstAsset.uri && firstAsset.uri.match(/\.(mp4|mov|avi)$/i))) {
                    setPostType(POST_TYPES.VIDEO);
                } else {
                    setPostType(POST_TYPES.PHOTO);
                }
            }
        } catch (err) {
            console.error('Media picker error:', err);
            Alert.alert('Media Error', `Failed to open gallery: ${err.message}`);
        }
    };

    const removeMedia = (index) => {
        setMedia(prev => prev.filter((_, i) => i !== index));
        if (media.length <= 1) setPostType(POST_TYPES.TEXT);
    };

    const addPollOption = () => {
        if (pollOptions.length < 6) {
            setPollOptions([...pollOptions, '']);
        }
    };

    const updatePollOption = (index, text) => {
        const updated = [...pollOptions];
        updated[index] = text;
        setPollOptions(updated);
    };

    const handleCreatePost = async () => {
        if (!content.trim() && media.length === 0 && postType !== POST_TYPES.POLL) {
            Alert.alert('Empty Post', 'Add a caption, media, or create a poll.');
            return;
        }

        if (postType === POST_TYPES.POLL) {
            const validOptions = pollOptions.filter(o => o.trim());
            if (validOptions.length < 2) {
                Alert.alert('Error', 'Add at least 2 poll options');
                return;
            }
        }

        try {
            setLoading(true);

            // Step 1: Upload media to Cloudinary
            const mediaUrls = [];
            for (let i = 0; i < media.length; i++) {
                const item = media[i];
                const isVideo = item.type === 'video' || (item.uri && item.uri.match(/\.(mp4|mov|avi)$/i));
                try {
                    const uploaded = await uploadToCloudinary(item, isVideo ? 'video' : 'image');
                    if (!uploaded || !uploaded.url) {
                        throw new Error('Upload returned empty URL');
                    }
                    mediaUrls.push({ uri: uploaded.url, type: isVideo ? 'video' : 'image' });
                } catch (uploadErr) {
                    Alert.alert('Upload Failed', `Media ${i + 1} failed: ${uploadErr.message}`);
                    setLoading(false);
                    return;
                }
            }

            // Step 2: Extract tags
            const tags = content.match(/#(\w+)/g)?.map(t => t.slice(1)) || [];
            const taggedUsers = content.match(/@(\w+)/g)?.map(t => t.slice(1)) || [];

            // Step 3: Build post data
            const postData = {
                authorId: user.uid,
                content: content.trim(),
                type: media.length > 0 ? postType : POST_TYPES.TEXT,
                media: mediaUrls,
                tags,
                taggedUsers,
                visibility,
            };

            if (postType === POST_TYPES.POLL) {
                postData.poll = {
                    options: pollOptions.filter(o => o.trim()).map(text => ({ text, votes: 0 })),
                    votedBy: {},
                };
            }

            // Step 4: Write to Firestore
            const result = await createPost(postData);
            
            // Step 5: Verify the write returned an id
            if (!result || !result.id) {
                throw new Error('Firestore write returned no post ID');
            }

            // Step 6: Reset form and show success
            resetForm();
            setPostSuccess(true);

        } catch (err) {
            console.error('Post creation error:', err);
            Alert.alert('Post Failed', `${err.message}\n\nPlease try again.`);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateStory = async () => {
        if (media.length === 0 && !content.trim()) {
            Alert.alert('Error', 'Add a photo/video or write some text for your story');
            return;
        }

        try {
            setLoading(true);

            let mediaUrl = null;
            let mediaType = 'text';

            if (media.length > 0) {
                const firstMedia = media[0];
                const isVideo = firstMedia.type === 'video' || (firstMedia.uri && firstMedia.uri.match(/\.(mp4|mov|avi)$/i));
                
                let uploaded;
                try {
                    uploaded = await uploadToCloudinary(firstMedia, isVideo ? 'video' : 'image');
                    if (!uploaded || !uploaded.url) {
                        throw new Error('Upload returned empty URL');
                    }
                } catch (uploadErr) {
                    Alert.alert('Upload Failed', `Could not upload: ${uploadErr.message}`);
                    setLoading(false);
                    return;
                }
                mediaUrl = uploaded.url;
                mediaType = isVideo ? 'video' : 'image';
            }

            // Step 2: Write to Firestore
            const result = await createStory({
                authorId: user.uid,
                media: mediaUrl,
                mediaType,
                text: content.trim(),
                type: storyType,
                hiddenFrom,
                bgColor: !mediaUrl ? storyBgColor : null,
                fontStyle: !mediaUrl ? storyFontStyle : null,
            });

            if (!result || !result.id) {
                throw new Error('Firestore write returned no story ID');
            }

            // Step 3: Reset and show success
            resetForm();
            setPostSuccess(true);

        } catch (err) {
            console.error('Story creation error:', err);
            Alert.alert('Story Failed', `${err.message}\n\nPlease try again.`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push('/(tabs)/home')}>
                    <Ionicons name="close" size={28} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Create</Text>
                <TouchableOpacity
                    style={[styles.postBtn, loading && styles.postBtnDisabled]}
                    onPress={activeTab === 'post' ? handleCreatePost : handleCreateStory}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color={Colors.textInverse} size="small" />
                    ) : (
                        <Text style={styles.postBtnText}>
                            {activeTab === 'post' ? 'Post' : 'Share'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'post' && styles.tabActive]}
                    onPress={() => setActiveTab('post')}
                >
                    <Text style={[styles.tabText, activeTab === 'post' && styles.tabTextActive]}>Post</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'story' && styles.tabActive]}
                    onPress={() => setActiveTab('story')}
                >
                    <Text style={[styles.tabText, activeTab === 'story' && styles.tabTextActive]}>Story</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContent} keyboardShouldPersistTaps="handled">
                {/* Content input */}
                <TextInput
                    style={[styles.contentInput, { color: C.text }, activeFont.fontFamily && { fontFamily: activeFont.fontFamily }]}
                    placeholder={activeTab === 'post' ? "What's on your mind? Use #tags" : "Add caption..."}
                    placeholderTextColor={Colors.textTertiary}
                    value={content}
                    onChangeText={setContent}
                    multiline
                    maxLength={activeTab === 'post' ? getMaxPostLength(userProfile) : 200}
                />

                {/* Media preview */}
                {media.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaPreview}>
                        {media.map((item, index) => (
                            <View key={index} style={styles.mediaItem}>
                                <Image source={{ uri: item.uri }} style={styles.mediaThumb} />
                                <TouchableOpacity
                                    style={styles.removeMediaBtn}
                                    onPress={() => removeMedia(index)}
                                >
                                    <Ionicons name="close-circle" size={24} color={Colors.error} />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                )}

                {/* Poll (for posts) */}
                {activeTab === 'post' && postType === POST_TYPES.POLL && (
                    <View style={styles.pollSection}>
                        <Text style={styles.sectionTitle}>Poll Options</Text>
                        {pollOptions.map((option, index) => (
                            <TextInput
                                key={index}
                                style={styles.pollInput}
                                placeholder={`Option ${index + 1}`}
                                placeholderTextColor={Colors.textTertiary}
                                value={option}
                                onChangeText={(text) => updatePollOption(index, text)}
                            />
                        ))}
                        {pollOptions.length < 6 && (
                            <TouchableOpacity style={styles.addOptionBtn} onPress={addPollOption}>
                                <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                                <Text style={styles.addOptionText}>Add option</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Actions */}
                <View style={styles.actions}>
                    <TouchableOpacity style={styles.actionItem} onPress={pickMedia}>
                        <Ionicons name="image" size={24} color={Colors.accentGreen} />
                        <Text style={styles.actionText}>Photo/Video</Text>
                    </TouchableOpacity>

                    {/* iOS Emoji button - only for premium users */}
                    {iosEmojiEnabled && (
                        <TouchableOpacity
                            style={styles.actionItem}
                            onPress={() => setShowEmojiPicker(!showEmojiPicker)}
                        >
                            <Ionicons name="happy-outline" size={24} color="#FF9500" />
                            <Text style={styles.actionText}>iOS Emoji</Text>
                        </TouchableOpacity>
                    )}

                    {activeTab === 'post' && (
                        <TouchableOpacity
                            style={styles.actionItem}
                            onPress={() => setPostType(postType === POST_TYPES.POLL ? POST_TYPES.TEXT : POST_TYPES.POLL)}
                        >
                            <Ionicons name="stats-chart" size={24} color={Colors.accentOrange} />
                            <Text style={styles.actionText}>
                                {postType === POST_TYPES.POLL ? 'Remove Poll' : 'Create Poll'}
                            </Text>
                        </TouchableOpacity>
                    )}
                    {activeTab === 'post' && (
                        <TouchableOpacity
                            style={styles.actionItem}
                            onPress={async () => {
                                try {
                                    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
                                    if (!result.canceled && result.assets?.[0]) {
                                        const file = result.assets[0];
                                        setMedia(prev => [...prev, { uri: file.uri, type: 'document', name: file.name, size: file.size }]);
                                    }
                                } catch(e) { Alert.alert('Error', e.message); }
                            }}
                        >
                            <Ionicons name="document-attach" size={24} color={Colors.primary} />
                            <Text style={styles.actionText}>Document / Audio</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Visibility (for posts) */}
                {activeTab === 'post' && (
                    <View style={styles.visibilitySection}>
                        <Text style={styles.sectionTitle}>Visibility</Text>
                        <View style={styles.visibilityOptions}>
                            {Object.entries(PRIVACY).map(([key, value]) => (
                                <TouchableOpacity
                                    key={key}
                                    style={[styles.visibilityChip, visibility === value && styles.visibilityChipActive]}
                                    onPress={() => setVisibility(value)}
                                >
                                    <Ionicons
                                        name={value === 'public' ? 'globe-outline' : value === 'friends' ? 'people-outline' : 'lock-closed-outline'}
                                        size={16}
                                        color={visibility === value ? Colors.primary : Colors.textSecondary}
                                    />
                                    <Text style={[styles.visibilityText, visibility === value && styles.visibilityTextActive]}>
                                        {key.charAt(0) + key.slice(1).toLowerCase()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* Story type */}
                {activeTab === 'story' && (
                    <View style={styles.visibilitySection}>
                        <Text style={styles.sectionTitle}>Story Type</Text>
                        <View style={styles.visibilityOptions}>
                            {Object.entries(STORY_TYPES).map(([key, value]) => (
                                <TouchableOpacity
                                    key={key}
                                    style={[styles.visibilityChip, storyType === value && styles.visibilityChipActive]}
                                    onPress={() => setStoryType(value)}
                                >
                                    <Text style={[styles.visibilityText, storyType === value && styles.visibilityTextActive]}>
                                        {value === 'public' ? '🌍 Story' : value === 'friends' ? '👥 Status' : '💚 Snap'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={{ color: Colors.textTertiary, fontSize: 11, marginTop: 6 }}>
                            {storyType === 'public' ? 'Visible to everyone' :
                                storyType === 'friends' ? 'Visible to friends only' :
                                    'Visible to close friends only'}
                        </Text>

                        {/* Text-only story controls */}
                        {media.length === 0 && (
                            <View style={{ marginTop: Spacing.lg }}>
                                <Text style={styles.sectionTitle}>Background Color</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
                                    {STORY_BG_COLORS.map(color => (
                                        <TouchableOpacity
                                            key={color}
                                            style={[{ width: 36, height: 36, borderRadius: 18, backgroundColor: color, marginRight: 8, borderWidth: 2, borderColor: storyBgColor === color ? '#fff' : 'transparent' }]}
                                            onPress={() => setStoryBgColor(color)}
                                        />
                                    ))}
                                </ScrollView>

                                <Text style={styles.sectionTitle}>Font Style</Text>
                                <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md }}>
                                    {STORY_FONT_STYLES.map(fs => (
                                        <TouchableOpacity
                                            key={fs.id}
                                            style={[styles.visibilityChip, storyFontStyle === fs.id && styles.visibilityChipActive]}
                                            onPress={() => setStoryFontStyle(fs.id)}
                                        >
                                            <Text style={[
                                                styles.visibilityText,
                                                storyFontStyle === fs.id && styles.visibilityTextActive,
                                                fs.fontFamily && { fontFamily: fs.fontFamily },
                                            ]}>{fs.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Preview */}
                                <View style={{ backgroundColor: storyBgColor, borderRadius: 16, padding: 24, alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
                                    <Text style={[
                                        { color: '#fff', fontSize: 20, fontWeight: '600', textAlign: 'center' },
                                        STORY_FONT_STYLES.find(f => f.id === storyFontStyle)?.fontFamily && { fontFamily: STORY_FONT_STYLES.find(f => f.id === storyFontStyle).fontFamily },
                                    ]}>
                                        {content || 'Your text story preview...'}
                                    </Text>
                                </View>
                            </View>
                        )}

                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingVertical: 8 }}
                            onPress={() => router.push('/hide-story-from')}
                        >
                            <Ionicons name="eye-off-outline" size={20} color={Colors.textSecondary} />
                            <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>
                                {hiddenFrom.length > 0 ? `Hidden from ${hiddenFrom.length} people` : 'Hide story from...'}
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            {/* Apple Emoji Picker */}
            {iosEmojiEnabled && (
                <AppleEmojiPicker
                    visible={showEmojiPicker}
                    onClose={() => setShowEmojiPicker(false)}
                    onEmojiPress={(emoji) => {
                        setContent(prev => prev + emoji);
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.md,
        backgroundColor: Colors.surface,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.border,
    },
    headerTitle: {
        fontSize: FontSize.xl,
        fontWeight: 'bold',
        color: Colors.text,
    },
    postBtn: {
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
    },
    postBtnDisabled: {
        opacity: 0.6,
    },
    postBtnText: {
        color: Colors.textInverse,
        fontSize: FontSize.md,
        fontWeight: 'bold',
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.border,
        backgroundColor: Colors.surface,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: Spacing.md,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: {
        borderBottomColor: Colors.primary,
    },
    tabText: {
        color: Colors.textSecondary,
        fontSize: FontSize.md,
        fontWeight: '600',
    },
    tabTextActive: {
        color: Colors.primary,
    },
    scrollContent: {
        padding: Spacing.lg,
    },
    contentInput: {
        color: Colors.text,
        fontSize: FontSize.lg,
        minHeight: 120,
        textAlignVertical: 'top',
        marginBottom: Spacing.lg,
    },
    mediaPreview: {
        marginBottom: Spacing.lg,
    },
    mediaItem: {
        position: 'relative',
        marginRight: Spacing.sm,
    },
    mediaThumb: {
        width: 120,
        height: 120,
        borderRadius: BorderRadius.md,
    },
    removeMediaBtn: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: Colors.background,
        borderRadius: 12,
    },
    pollSection: {
        marginBottom: Spacing.lg,
    },
    sectionTitle: {
        color: Colors.textSecondary,
        fontSize: FontSize.sm,
        fontWeight: '600',
        marginBottom: Spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    pollInput: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        color: Colors.text,
        fontSize: FontSize.md,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    addOptionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.sm,
    },
    addOptionText: {
        color: Colors.primary,
        fontSize: FontSize.md,
    },
    actions: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.lg,
        borderWidth: 0.5,
        borderColor: Colors.border,
    },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.lg,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.border,
    },
    actionText: {
        color: Colors.text,
        fontSize: FontSize.md,
    },
    visibilitySection: {
        marginBottom: Spacing.lg,
    },
    visibilityOptions: {
        flexDirection: 'row',
        gap: Spacing.sm,
        flexWrap: 'wrap',
    },
    visibilityChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    visibilityChipActive: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySurface,
    },
    visibilityText: {
        color: Colors.textSecondary,
        fontSize: FontSize.sm,
    },
    visibilityTextActive: {
        color: Colors.primary,
    },
});
