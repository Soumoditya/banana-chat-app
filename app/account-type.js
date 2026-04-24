import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAppTheme from '../hooks/useAppTheme';
import { updateUserProfile } from '../services/users';
import { useToast } from '../contexts/ToastContext';

const CATEGORIES = [
    { id: 'personal', name: 'Personal', icon: 'person-outline', desc: 'Standard personal profile', color: '#3B82F6' },
    { id: 'creator', name: 'Creator', icon: 'color-palette-outline', desc: 'For content creators, artists & influencers', color: '#A855F7' },
    { id: 'business', name: 'Business', icon: 'briefcase-outline', desc: 'For brands, shops & organizations', color: '#10B981' },
];

const CREATOR_OCCUPATIONS = [
    'Digital Artist', 'Musician', 'Writer', 'Developer', 'Photographer',
    'Videographer', 'Streamer', 'Podcaster', 'Designer', 'Educator', 'Other',
];

const BUSINESS_OCCUPATIONS = [
    'Brand', 'Shop', 'Agency', 'Restaurant', 'Startup', 'Freelancer',
    'Non-Profit', 'Media', 'Entertainment', 'Other',
];

export default function AccountTypeScreen() {
    const { user, userProfile, refreshProfile } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { C, skin } = useAppTheme();
    const { showToast } = useToast();

    const [category, setCategory] = useState(userProfile?.profileCategory || 'personal');
    const [occupation, setOccupation] = useState(userProfile?.occupation || '');
    const [showCategory, setShowCategory] = useState(userProfile?.showCategory !== false);
    const [saving, setSaving] = useState(false);

    const occupations = category === 'creator' ? CREATOR_OCCUPATIONS
        : category === 'business' ? BUSINESS_OCCUPATIONS : [];

    const handleSave = async () => {
        try {
            setSaving(true);
            await updateUserProfile(user.uid, {
                profileCategory: category,
                occupation: category === 'personal' ? '' : occupation,
                showCategory,
            });
            await refreshProfile();
            showToast('Account type saved successfully!', 'success', '✅ Updated');
            router.back();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView
            style={[styles.container, { paddingTop: insets.top, backgroundColor: C.background }]}
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
            <View style={[styles.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={C.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: C.text }]}>Account Type</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    <Text style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
                        {saving ? 'Saving...' : 'Save'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Category Picker */}
            <View style={[styles.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>Choose Account Type</Text>
                {CATEGORIES.map((cat) => {
                    const isActive = category === cat.id;
                    return (
                        <TouchableOpacity
                            key={cat.id}
                            style={[
                                styles.categoryCard,
                                { borderColor: isActive ? cat.color : C.border },
                                isActive && { backgroundColor: cat.color + '15' },
                            ]}
                            onPress={() => { setCategory(cat.id); setOccupation(''); }}
                        >
                            <View style={[styles.catIconBox, { backgroundColor: cat.color + '20' }]}>
                                <Ionicons name={cat.icon} size={24} color={cat.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.catName, { color: C.text }]}>{cat.name}</Text>
                                <Text style={[styles.catDesc, { color: C.textSecondary }]}>{cat.desc}</Text>
                            </View>
                            {isActive && (
                                <Ionicons name="checkmark-circle" size={22} color={cat.color} />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Occupation Picker */}
            {occupations.length > 0 && (
                <View style={[styles.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                    <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>
                        {category === 'creator' ? 'What do you create?' : 'Business Type'}
                    </Text>
                    <View style={styles.occupationGrid}>
                        {occupations.map((occ) => {
                            const isActive = occupation === occ;
                            return (
                                <TouchableOpacity
                                    key={occ}
                                    style={[
                                        styles.occupationChip,
                                        { borderColor: C.border, backgroundColor: C.surfaceLight },
                                        isActive && { borderColor: C.primary, backgroundColor: C.primarySurface },
                                    ]}
                                    onPress={() => setOccupation(occ)}
                                >
                                    <Text style={[
                                        styles.occupationText,
                                        { color: isActive ? C.primary : C.text },
                                    ]}>
                                        {occ}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            )}

            {/* Visibility Toggle */}
            {category !== 'personal' && (
                <View style={[styles.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                    <View style={styles.toggleRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.toggleTitle, { color: C.text }]}>Show on Profile</Text>
                            <Text style={[styles.toggleSubtitle, { color: C.textSecondary }]}>
                                Display your account type and occupation on your profile
                            </Text>
                        </View>
                        <Switch
                            value={showCategory}
                            onValueChange={setShowCategory}
                            trackColor={{ false: C.surfaceLight, true: C.primarySurface }}
                            thumbColor={showCategory ? C.primary : C.textTertiary}
                        />
                    </View>
                </View>
            )}

            {/* Preview */}
            <View style={[styles.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>Preview</Text>
                <View style={styles.previewCard}>
                    <Text style={[styles.previewName, { color: C.text }]}>
                        {userProfile?.displayName || 'Your Name'}
                    </Text>
                    {category !== 'personal' && showCategory && (
                        <Text style={[styles.previewCategory, { color: C.primary }]}>
                            {category === 'creator' ? '🎨' : '💼'} {CATEGORIES.find(c => c.id === category)?.name}
                            {occupation ? ` • ${occupation}` : ''}
                        </Text>
                    )}
                    <Text style={[styles.previewUsername, { color: C.textSecondary }]}>
                        @{userProfile?.username || 'username'}
                    </Text>
                </View>
            </View>

            {/* Info Note */}
            <View style={styles.infoNote}>
                <Ionicons name="information-circle-outline" size={16} color={C.textTertiary} />
                <Text style={[styles.infoText, { color: C.textTertiary }]}>
                    Creator and Business accounts get access to Profile Analytics and advanced features.
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md,
        borderBottomWidth: 0.5,
    },
    headerTitle: { fontSize: FontSize.xl, fontWeight: 'bold' },
    saveBtn: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '700' },
    section: {
        marginHorizontal: Spacing.md, marginTop: Spacing.md,
        borderRadius: BorderRadius.lg, overflow: 'hidden', borderWidth: 0.5,
    },
    sectionTitle: {
        fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase',
        letterSpacing: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm,
    },
    categoryCard: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderBottomWidth: 0.5, borderWidth: 1.5, marginHorizontal: Spacing.md,
        marginBottom: Spacing.sm, borderRadius: BorderRadius.md,
    },
    catIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    catName: { fontSize: FontSize.md, fontWeight: '600' },
    catDesc: { fontSize: FontSize.xs, marginTop: 2 },
    occupationGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: Spacing.md, gap: 8 },
    occupationChip: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        borderWidth: 1,
    },
    occupationText: { fontSize: FontSize.sm, fontWeight: '500' },
    toggleRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg,
    },
    toggleTitle: { fontSize: FontSize.md, fontWeight: '600' },
    toggleSubtitle: { fontSize: FontSize.xs, marginTop: 2 },
    previewCard: { alignItems: 'center', paddingVertical: Spacing.xl },
    previewName: { fontSize: 20, fontWeight: 'bold' },
    previewCategory: { fontSize: FontSize.sm, fontWeight: '500', marginTop: 4 },
    previewUsername: { fontSize: FontSize.sm, marginTop: 2 },
    infoNote: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 6,
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
    },
    infoText: { flex: 1, fontSize: FontSize.xs, lineHeight: 16 },
});
