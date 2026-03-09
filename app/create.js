import { useState } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { createPost } from '../services/posts';
import { createStory } from '../services/stories';
import { uploadToCloudinary } from '../config/cloudinary';
import { POST_TYPES, STORY_TYPES, STORY_LABELS, PRIVACY } from '../utils/constants';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CreateScreen() {
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { tab } = useLocalSearchParams();
    const [activeTab, setActiveTab] = useState(tab === 'story' ? 'story' : 'post');
    const [content, setContent] = useState('');
    const [media, setMedia] = useState([]);
    const [postType, setPostType] = useState(POST_TYPES.TEXT);
    const [storyType, setStoryType] = useState(STORY_TYPES.PUBLIC);
    const [visibility, setVisibility] = useState(PRIVACY.PUBLIC);
    const [pollOptions, setPollOptions] = useState(['', '']);
    const [loading, setLoading] = useState(false);
    const [hiddenFrom, setHiddenFrom] = useState([]);

    const pickMedia = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images', 'videos'],
                allowsMultipleSelection: true,
                quality: 0.8,
                selectionLimit: 5,
            });

            if (!result.canceled) {
                setMedia([...media, ...result.assets]);
                setPostType(result.assets[0].type === 'video' ? POST_TYPES.VIDEO : POST_TYPES.PHOTO);
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to pick media');
        }
    };

    const removeMedia = (index) => {
        setMedia(media.filter((_, i) => i !== index));
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
            Alert.alert('Error', 'Please add some content');
            return;
        }

        if (postType === POST_TYPES.POLL) {
            const validOptions = pollOptions.filter(o => o.trim());
            if (validOptions.length < 2) {
                Alert.alert('Error', 'Please add at least 2 poll options');
                return;
            }
        }

        try {
            setLoading(true);

            // Upload media
            const mediaUrls = [];
            for (const item of media) {
                const isVideo = item.type === 'video';
                const uploaded = await uploadToCloudinary(item.uri, isVideo ? 'video' : 'image');
                mediaUrls.push(uploaded.url);
            }

            // Extract hashtags from content (#tag)
            const tags = content.match(/#(\w+)/g)?.map(t => t.slice(1)) || [];

            // Extract @mentions as tagged users
            const taggedUsers = content.match(/@(\w+)/g)?.map(t => t.slice(1)) || [];

            const postData = {
                authorId: user.uid,
                content: content.trim(),
                type: postType,
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

            await createPost(postData);
            Alert.alert('Success', 'Post created!', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateStory = async () => {
        if (media.length === 0) {
            Alert.alert('Error', 'Please add a photo or video for your story');
            return;
        }

        try {
            setLoading(true);

            const isVideo = media[0].type === 'video';
            const uploaded = await uploadToCloudinary(media[0].uri, isVideo ? 'video' : 'image');

            await createStory({
                authorId: user.uid,
                media: uploaded.url,
                mediaType: isVideo ? 'video' : 'image',
                text: content.trim(),
                type: storyType,
                hiddenFrom,
            });

            Alert.alert('Success', 'Story posted!', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
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

            <ScrollView style={styles.scrollContent}>
                {/* Content input */}
                <TextInput
                    style={styles.contentInput}
                    placeholder={activeTab === 'post' ? "What's on your mind? Use #tags" : "Add caption..."}
                    placeholderTextColor={Colors.textTertiary}
                    value={content}
                    onChangeText={setContent}
                    multiline
                    maxLength={activeTab === 'post' ? 5000 : 200}
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
                            {storyType === 'public' ? 'Visible to everyone · Becomes Spotlight when archived' :
                                storyType === 'friends' ? 'Visible to friends only' :
                                    'Visible to close friends only · Becomes Memory when archived'}
                        </Text>

                        {/* Hide from */}
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
