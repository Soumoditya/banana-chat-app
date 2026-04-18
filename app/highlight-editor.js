import { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getArchivedStories, createHighlight, updateHighlight, getHighlights } from '../services/stories';
import { HIGHLIGHT_TYPES, STORY_LABELS } from '../utils/constants';

export default function HighlightEditorScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const editId = params?.editId;

    const [name, setName] = useState('');
    const [type, setType] = useState(HIGHLIGHT_TYPES.SPOTLIGHT);
    const [archivedStories, setArchivedStories] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => { loadArchive(); }, []);

    const loadArchive = async () => {
        if (!user) return;
        const stories = await getArchivedStories(user.uid);
        setArchivedStories(stories);

        // If editing, load existing highlight data
        if (editId) {
            try {
                const allHighlights = await getHighlights(user.uid);
                const existing = allHighlights.find(h => h.id === editId);
                if (existing) {
                    setName(existing.name || '');
                    setType(existing.type || HIGHLIGHT_TYPES.SPOTLIGHT);
                    setSelectedIds(existing.storyIds || []);
                }
            } catch (e) {}
        }
    };

    const toggleStory = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Error', 'Please give your highlight a name');
            return;
        }
        if (selectedIds.length === 0) {
            Alert.alert('Error', 'Select at least one story');
            return;
        }
        try {
            setSaving(true);
            const coverStory = archivedStories.find(s => s.id === selectedIds[0]);
            if (editId) {
                // Update existing
                await updateHighlight(editId, {
                    name: name.trim(),
                    type,
                    coverImage: coverStory?.media || '',
                    storyIds: selectedIds,
                });
                Alert.alert('Updated!', 'Highlight updated!', [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            } else {
                await createHighlight({
                    authorId: user.uid,
                    name: name.trim(),
                    type,
                    coverImage: coverStory?.media || '',
                    storyIds: selectedIds,
                });
                Alert.alert('Created!', `${type === HIGHLIGHT_TYPES.SPOTLIGHT ? 'Spotlight' : 'Memory'} created!`, [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            }
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setSaving(false);
        }
    };

    // Filter stories by type relevance
    const filteredStories = type === HIGHLIGHT_TYPES.SPOTLIGHT
        ? archivedStories.filter(s => s.type === 'public')
        : archivedStories.filter(s => s.type === 'closeFriends' || s.type === 'friends');

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>New Highlight</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    <Text style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
                        {saving ? 'Saving...' : 'Create'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Name input */}
            <View style={styles.nameRow}>
                <View style={[styles.coverPreview, type === HIGHLIGHT_TYPES.MEMORY && styles.coverPreviewMemory]}>
                    {selectedIds.length > 0 && archivedStories.find(s => s.id === selectedIds[0])?.media ? (
                        <Image
                            source={{ uri: archivedStories.find(s => s.id === selectedIds[0]).media }}
                            style={styles.coverImage}
                        />
                    ) : (
                        <Ionicons
                            name={type === HIGHLIGHT_TYPES.SPOTLIGHT ? 'sunny' : 'heart'}
                            size={24}
                            color={type === HIGHLIGHT_TYPES.SPOTLIGHT ? Colors.primary : Colors.textTertiary}
                        />
                    )}
                </View>
                <TextInput
                    style={styles.nameInput}
                    placeholder="Highlight name..."
                    placeholderTextColor={Colors.textTertiary}
                    value={name}
                    onChangeText={setName}
                    maxLength={30}
                />
            </View>

            {/* Type selector */}
            <View style={styles.typeRow}>
                <TouchableOpacity
                    style={[styles.typeBtn, type === HIGHLIGHT_TYPES.SPOTLIGHT && styles.typeBtnActive]}
                    onPress={() => setType(HIGHLIGHT_TYPES.SPOTLIGHT)}
                >
                    <Ionicons name="sunny" size={16} color={type === HIGHLIGHT_TYPES.SPOTLIGHT ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.typeText, type === HIGHLIGHT_TYPES.SPOTLIGHT && styles.typeTextActive]}>
                        Spotlight
                    </Text>
                    <Text style={styles.typeDesc}>Public</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.typeBtn, type === HIGHLIGHT_TYPES.MEMORY && styles.typeBtnMemory]}
                    onPress={() => setType(HIGHLIGHT_TYPES.MEMORY)}
                >
                    <Ionicons name="heart" size={16} color={type === HIGHLIGHT_TYPES.MEMORY ? '#A0A0B8' : Colors.textSecondary} />
                    <Text style={[styles.typeText, type === HIGHLIGHT_TYPES.MEMORY && { color: '#A0A0B8' }]}>
                        Memory
                    </Text>
                    <Text style={styles.typeDesc}>Close Friends</Text>
                </TouchableOpacity>
            </View>

            {/* Story picker */}
            <Text style={styles.sectionLabel}>
                Select stories ({selectedIds.length} selected)
            </Text>

            <FlatList
                data={filteredStories}
                numColumns={3}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                    const selected = selectedIds.includes(item.id);
                    return (
                        <TouchableOpacity
                            style={[styles.storyThumb, selected && styles.storyThumbSelected]}
                            onPress={() => toggleStory(item.id)}
                        >
                            {item.media ? (
                                <Image source={{ uri: item.media }} style={styles.thumbImage} />
                            ) : (
                                <View style={[styles.thumbImage, { backgroundColor: item.bgColor || '#1a1a2e', justifyContent: 'center', alignItems: 'center', padding: 4 }]}>
                                    <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }} numberOfLines={3}>{item.text || 'Text'}</Text>
                                </View>
                            )}
                            {selected && (
                                <View style={styles.checkmark}>
                                    <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                                </View>
                            )}
                            <View style={styles.thumbBadge}>
                                <Text style={styles.thumbBadgeText}>
                                    {STORY_LABELS[item.type] || 'Story'}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={() => (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>
                            {type === HIGHLIGHT_TYPES.SPOTLIGHT
                                ? 'No public stories in archive'
                                : 'No close friends stories in archive'}
                        </Text>
                    </View>
                )}
                contentContainerStyle={{ paddingHorizontal: 2, paddingBottom: 40 }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    headerTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text },
    saveBtn: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '700' },
    nameRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
        padding: Spacing.lg,
    },
    coverPreview: {
        width: 56, height: 56, borderRadius: 28, borderWidth: 2,
        borderColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
        backgroundColor: Colors.surfaceLight, overflow: 'hidden',
    },
    coverPreviewMemory: { borderColor: Colors.textTertiary },
    coverImage: { width: '100%', height: '100%' },
    nameInput: {
        flex: 1, color: Colors.text, fontSize: FontSize.lg, fontWeight: '600',
        borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: Spacing.sm,
    },
    typeRow: {
        flexDirection: 'row', gap: Spacing.md, paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    typeBtn: {
        flex: 1, padding: Spacing.md, borderRadius: BorderRadius.lg,
        backgroundColor: Colors.surfaceLight, alignItems: 'center', gap: 4,
        borderWidth: 1.5, borderColor: 'transparent',
    },
    typeBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
    typeBtnMemory: { borderColor: Colors.textTertiary, backgroundColor: 'rgba(160,160,184,0.1)' },
    typeText: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
    typeTextActive: { color: Colors.primary },
    typeDesc: { color: Colors.textTertiary, fontSize: FontSize.xs },
    sectionLabel: {
        color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600',
        paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm,
    },
    storyThumb: {
        flex: 1 / 3, aspectRatio: 0.7, margin: 2, borderRadius: BorderRadius.sm,
        overflow: 'hidden',
    },
    storyThumbSelected: { opacity: 0.8, borderWidth: 2, borderColor: Colors.primary },
    thumbImage: { width: '100%', height: '100%' },
    checkmark: { position: 'absolute', top: 4, right: 4 },
    thumbBadge: {
        position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6,
    },
    thumbBadgeText: { color: '#fff', fontSize: 8, fontWeight: '600' },
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { color: Colors.textTertiary, fontSize: FontSize.md, textAlign: 'center' },
});
