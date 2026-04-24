import { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Dimensions, Image, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    getPlanConfig, isPremiumActive, getPremiumFlair,
    getAvailableFonts, getAvailableThemes, getAvailableUISkins, getAvailableIcons, canUseCustomIcon,
    FONT_STYLES, PREMIUM_THEMES, UI_SKINS, APP_ICONS, PREMIUM_PLANS, canUseIOSEmoji,
} from '../utils/premium';
import { setAppIcon } from 'expo-dynamic-app-icon';
import { updateUserProfile } from '../services/users';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import * as ImagePicker from 'expo-image-picker';
import { useToast } from '../contexts/ToastContext';

const { width } = Dimensions.get('window');

export default function PremiumSettingsScreen() {
    const { user, userProfile, refreshProfile } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const plan = getPlanConfig(userProfile);
    const isActive = isPremiumActive(userProfile);
    const flair = getPremiumFlair(userProfile);
    const { showToast } = useToast();

    // User preferences (from Firestore or defaults)
    const prefs = userProfile?.premiumPreferences || {};
    const [selectedFont, setSelectedFont] = useState(prefs.fontStyle || 'system');
    const [selectedTheme, setSelectedTheme] = useState(prefs.theme || 'default');
    const [selectedSkin, setSelectedSkin] = useState(prefs.uiSkin || 'default');
    const [selectedIcon, setSelectedIcon] = useState(prefs.appIcon || 'default');
    const [customIconUrl, setCustomIconUrl] = useState(prefs.customIconUrl || null);
    const [iosEmojiEnabled, setIosEmojiEnabled] = useState(prefs.iosEmoji !== false);
    const [downloadMediaEnabled, setDownloadMediaEnabled] = useState(prefs.downloadMedia !== false);
    const [analyticsEnabled, setAnalyticsEnabled] = useState(prefs.profileAnalytics !== false);
    const [saving, setSaving] = useState(false);

    const availableFonts = isActive ? getAvailableFonts(userProfile) : [];
    const availableThemes = isActive ? getAvailableThemes(userProfile) : [];
    const availableSkins = isActive ? getAvailableUISkins(userProfile) : [];
    const availableIconsList = isActive ? getAvailableIcons(userProfile) : [];
    const canCustom = canUseCustomIcon(userProfile);

    useEffect(() => {
        if (!isActive) {
            showToast('Subscribe to a premium plan to access these features', 'warning', 'Premium Required');
            router.back();
        }
    }, []);

    const savePreference = async (key, value) => {
        setSaving(true);
        try {
            const prefKey = `premiumPreferences.${key}`;
            await updateDoc(doc(db, 'users', user.uid), {
                [prefKey]: value,
            });
            await refreshProfile();
        } catch (err) {
            showToast('Failed to save: ' + err.message, 'error');
        }
        setSaving(false);
    };

    const handleFontChange = (fontId) => {
        setSelectedFont(fontId);
        savePreference('fontStyle', fontId);
    };

    const handleThemeChange = (themeId) => {
        setSelectedTheme(themeId);
        savePreference('theme', themeId);
    };

    const handleSkinChange = (skinId) => {
        setSelectedSkin(skinId);
        savePreference('uiSkin', skinId);
    };

    const handleIconChange = (iconId) => {
        if (iconId === 'custom' && !canCustom) {
            showToast('Upload custom icons with Super or VIP plans', 'warning', 'Super+ Required');
            return;
        }
        setSelectedIcon(iconId);
        savePreference('appIcon', iconId);
        // Change actual device launcher icon (iOS only — Android requires native rebuild)
        try {
            if (Platform.OS === 'ios') {
                if (iconId === 'default') {
                    setAppIcon(null);
                } else {
                    setAppIcon(iconId);
                }
            }
            // On Android, the icon is cosmetic-only (shown in-app header)
            // A native rebuild is required for actual launcher icon changes
        } catch (e) {
            console.warn('Could not change app icon:', e.message);
        }
    };

    const handleCustomIconUpload = async () => {
        if (!canCustom) {
            showToast('You need Super (₹499) or VIP (₹999) to upload custom icons', 'warning', 'Super+ Required');
            return;
        }
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
                const uri = result.assets[0].uri;
                setCustomIconUrl(uri);
                setSelectedIcon('custom');
                // Save both preferences
                setSaving(true);
                await updateDoc(doc(db, 'users', user.uid), {
                    'premiumPreferences.appIcon': 'custom',
                    'premiumPreferences.customIconUrl': uri,
                });
                await refreshProfile();
                setSaving(false);
                showToast('Your custom app icon has been saved!', 'success', '✅ Custom Icon Set');
            }
        } catch (err) {
            showToast('Could not pick image: ' + err.message, 'error');
        }
    };

    const handleToggle = (key, value, setter) => {
        setter(value);
        savePreference(key, value);
    };

    if (!isActive || !plan) return null;

    return (
        <ScrollView
            style={[styles.container, { paddingTop: insets.top }]}
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>✨ Premium Features</Text>
                    <View style={[styles.planTag, { backgroundColor: plan.badgeColor + '20' }]}>
                        <Text style={[styles.planTagText, { color: plan.badgeColor }]}>{flair}</Text>
                    </View>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* Plan Info */}
            <View style={[styles.planBanner, { borderColor: plan.badgeColor }]}>
                <Text style={styles.planBannerTitle}>{plan.name} Plan</Text>
                <Text style={styles.planBannerSub}>
                    Manage your premium features below. Toggle on/off or select your preferences.
                </Text>
                <TouchableOpacity onPress={() => router.push('/premium')} style={styles.upgradeLinkBtn}>
                    <Text style={[styles.upgradeLinkText, { color: plan.badgeColor }]}>
                        Upgrade Plan →
                    </Text>
                </TouchableOpacity>
            </View>

            {/* ─── iOS Emoji Toggle ─── */}
            {canUseIOSEmoji(userProfile) && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>😀 iOS Emojis</Text>
                    <View style={styles.toggleRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.toggleLabel}>Use iOS Emojis</Text>
                            <Text style={styles.toggleDesc}>View & send Apple-style emojis everywhere</Text>
                        </View>
                        <Switch
                            value={iosEmojiEnabled}
                            onValueChange={(v) => handleToggle('iosEmoji', v, setIosEmojiEnabled)}
                            trackColor={{ false: Colors.surfaceLight, true: plan.badgeColor + '60' }}
                            thumbColor={iosEmojiEnabled ? plan.badgeColor : Colors.textTertiary}
                        />
                    </View>
                </View>
            )}

            {/* ─── Font Style Picker ─── */}
            {availableFonts.length > 1 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🔤 Font Style</Text>
                    <Text style={styles.sectionDesc}>Choose how text appears in the app</Text>
                    <View style={styles.optionGrid}>
                        {availableFonts.map((font) => {
                            const isSelected = selectedFont === font.id;
                            return (
                                <TouchableOpacity
                                    key={font.id}
                                    style={[
                                        styles.optionCard,
                                        isSelected && { borderColor: plan.badgeColor, backgroundColor: plan.badgeColor + '10' },
                                    ]}
                                    onPress={() => handleFontChange(font.id)}
                                >
                                    <Text style={[
                                        styles.fontPreview,
                                        { fontFamily: font.fontFamily },
                                        isSelected && { color: plan.badgeColor },
                                    ]}>
                                        Aa
                                    </Text>
                                    <Text style={[
                                        styles.optionName,
                                        isSelected && { color: plan.badgeColor },
                                    ]}>{font.name}</Text>
                                    {isSelected && (
                                        <Ionicons name="checkmark-circle" size={16} color={plan.badgeColor}
                                            style={{ position: 'absolute', top: 6, right: 6 }}
                                        />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            )}

            {/* ─── Theme Selector ─── */}
            {availableThemes.length > 1 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🎨 App Theme</Text>
                    <Text style={styles.sectionDesc}>Change the color scheme of the entire app</Text>
                    <View style={styles.themeGrid}>
                        {availableThemes.map((theme) => {
                            const isSelected = selectedTheme === theme.id;
                            return (
                                <TouchableOpacity
                                    key={theme.id}
                                    style={[
                                        styles.themeCard,
                                        isSelected && styles.themeCardSelected,
                                    ]}
                                    onPress={() => handleThemeChange(theme.id)}
                                >
                                    {/* Color preview */}
                                    <View style={styles.themePreview}>
                                        <View style={[styles.themeColorStrip, { backgroundColor: theme.background }]} />
                                        <View style={[styles.themeColorStrip, { backgroundColor: theme.surface }]} />
                                        <View style={[styles.themeColorStrip, { backgroundColor: theme.primary }]} />
                                        <View style={[styles.themeColorStrip, { backgroundColor: theme.accent || theme.primary }]} />
                                    </View>
                                    <Text style={[
                                        styles.themeName,
                                        isSelected && { color: plan.badgeColor },
                                    ]}>{theme.name}</Text>
                                    {isSelected && (
                                        <Ionicons name="checkmark-circle" size={14} color={plan.badgeColor}
                                            style={{ position: 'absolute', top: 4, right: 4 }}
                                        />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            )}

            {/* ─── UI Skin Selector ─── */}
            {availableSkins.length > 1 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>💎 UI Skin</Text>
                    <Text style={styles.sectionDesc}>Change how surfaces and cards look</Text>
                    {availableSkins.map((skin) => {
                        const isSelected = selectedSkin === skin.id;
                        return (
                            <TouchableOpacity
                                key={skin.id}
                                style={[
                                    styles.skinCard,
                                    isSelected && { borderColor: plan.badgeColor, backgroundColor: plan.badgeColor + '08' },
                                ]}
                                onPress={() => handleSkinChange(skin.id)}
                            >
                                <View style={[
                                    styles.skinPreview,
                                    {
                                        borderRadius: skin.borderRadius,
                                        opacity: skin.surfaceOpacity,
                                        borderWidth: skin.borderWidth,
                                        borderColor: skin.borderColor,
                                    },
                                ]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.skinName, isSelected && { color: plan.badgeColor }]}>
                                        {skin.name}
                                    </Text>
                                    <Text style={styles.skinDesc}>{skin.description}</Text>
                                </View>
                                {isSelected && (
                                    <Ionicons name="checkmark-circle" size={20} color={plan.badgeColor} />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}

            {/* ─── App Icon Picker ─── */}
            {availableIconsList.length > 1 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📱 App Icon</Text>
                    <Text style={styles.sectionDesc}>Choose a custom app icon style</Text>
                    <View style={styles.iconGrid}>
                        {availableIconsList.map((icon) => {
                            if (icon.requiresCustom && !canCustom) return null;
                            const isSelected = selectedIcon === icon.id;
                            return (
                                <TouchableOpacity
                                    key={icon.id}
                                    style={[
                                        styles.iconCard,
                                        isSelected && { borderColor: plan.badgeColor, backgroundColor: plan.badgeColor + '10' },
                                    ]}
                                    onPress={() => {
                                        if (icon.requiresCustom) {
                                            handleCustomIconUpload();
                                        } else {
                                            handleIconChange(icon.id);
                                        }
                                    }}
                                >
                                    {icon.requiresCustom && customIconUrl ? (
                                        <Image
                                            source={{ uri: customIconUrl }}
                                            style={styles.customIconPreview}
                                        />
                                    ) : icon.image ? (
                                        <Image
                                            source={icon.image}
                                            style={{ width: 52, height: 52, borderRadius: 12 }}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View style={[styles.iconPreviewBox, { backgroundColor: '#1A1A1A' }]}>
                                            <Ionicons name="cloud-upload-outline" size={22} color={icon.accentColor} />
                                        </View>
                                    )}
                                    <Text style={[
                                        styles.iconName,
                                        isSelected && { color: plan.badgeColor },
                                    ]}>
                                        {icon.name}
                                    </Text>
                                    {icon.requiresCustom && (
                                        <View style={styles.uploadBadge}>
                                            <Ionicons name="cloud-upload-outline" size={10} color="#FFD700" />
                                        </View>
                                    )}
                                    {isSelected && (
                                        <Ionicons name="checkmark-circle" size={14} color={plan.badgeColor}
                                            style={{ position: 'absolute', top: 4, right: 4 }}
                                        />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    {canCustom && (
                        <TouchableOpacity style={styles.customUploadBtn} onPress={handleCustomIconUpload}>
                            <Ionicons name="cloud-upload" size={18} color="#FFD700" />
                            <Text style={styles.customUploadText}>Upload Custom Icon</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* ─── Download Media Toggle ─── */}
            {plan.limits.canDownloadMedia && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📥 Media Downloads</Text>
                    <View style={styles.toggleRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.toggleLabel}>Download Media</Text>
                            <Text style={styles.toggleDesc}>Save anyone's posts, stories, profile pics</Text>
                        </View>
                        <Switch
                            value={downloadMediaEnabled}
                            onValueChange={(v) => handleToggle('downloadMedia', v, setDownloadMediaEnabled)}
                            trackColor={{ false: Colors.surfaceLight, true: plan.badgeColor + '60' }}
                            thumbColor={downloadMediaEnabled ? plan.badgeColor : Colors.textTertiary}
                        />
                    </View>
                </View>
            )}

            {/* ─── Profile Analytics Toggle ─── */}
            {plan.limits.hasProfileAnalytics && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📊 Profile Analytics</Text>
                    <View style={styles.toggleRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.toggleLabel}>Profile Analytics</Text>
                            <Text style={styles.toggleDesc}>See who viewed your profile and stats</Text>
                        </View>
                        <Switch
                            value={analyticsEnabled}
                            onValueChange={(v) => handleToggle('profileAnalytics', v, setAnalyticsEnabled)}
                            trackColor={{ false: Colors.surfaceLight, true: plan.badgeColor + '60' }}
                            thumbColor={analyticsEnabled ? plan.badgeColor : Colors.textTertiary}
                        />
                    </View>
                </View>
            )}

            {/* ─── Plan Limits Info ─── */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>📋 Your Plan Limits</Text>
                <View style={styles.limitsGrid}>
                    {[
                        { label: 'Media/Post', value: plan.limits.maxMedia >= 999 ? '∞' : plan.limits.maxMedia, icon: 'images' },
                        { label: 'Post Length', value: plan.limits.maxPostLength + ' chars', icon: 'text' },
                        { label: 'Story Duration', value: plan.limits.maxStoryDuration + 'h', icon: 'time' },
                        { label: 'Fonts', value: availableFonts.length, icon: 'text-outline' },
                        { label: 'Themes', value: availableThemes.length, icon: 'color-palette' },
                        { label: 'UI Skins', value: availableSkins.length, icon: 'layers' },
                        { label: 'Icons', value: availableIconsList.length, icon: 'apps' },
                    ].map((item, i) => (
                        <View key={i} style={styles.limitCard}>
                            <Ionicons name={item.icon} size={18} color={plan.badgeColor} />
                            <Text style={styles.limitValue}>{item.value}</Text>
                            <Text style={styles.limitLabel}>{item.label}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* Saving indicator */}
            {saving && (
                <Text style={styles.savingText}>Saving...</Text>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerCenter: { flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
    planTag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
    planTagText: { fontSize: 11, fontWeight: '700' },

    planBanner: {
        margin: Spacing.md, padding: Spacing.lg,
        backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
        borderWidth: 1, borderLeftWidth: 4,
    },
    planBannerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
    planBannerSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, lineHeight: 20 },
    upgradeLinkBtn: { marginTop: Spacing.sm },
    upgradeLinkText: { fontWeight: '700', fontSize: FontSize.sm },

    section: {
        margin: Spacing.md, marginTop: 0, padding: Spacing.lg,
        backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
        borderWidth: 0.5, borderColor: Colors.border,
    },
    sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: Spacing.xs },
    sectionDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.md },

    // Toggles
    toggleRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    toggleLabel: { fontSize: FontSize.md, color: Colors.text, fontWeight: '600' },
    toggleDesc: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },

    // Font grid
    optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    optionCard: {
        width: (width - 80) / 3, paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm,
        backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg,
        alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent', position: 'relative',
    },
    fontPreview: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 4 },
    optionName: { fontSize: 10, color: Colors.textSecondary, textAlign: 'center' },

    // Theme grid
    themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    themeCard: {
        width: (width - 76) / 3, backgroundColor: Colors.surfaceLight,
        borderRadius: BorderRadius.md, overflow: 'hidden',
        borderWidth: 1.5, borderColor: 'transparent', position: 'relative',
    },
    themeCardSelected: { borderColor: '#FFD700' },
    themePreview: { flexDirection: 'row', height: 36 },
    themeColorStrip: { flex: 1 },
    themeName: { fontSize: 10, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 6, fontWeight: '600' },

    // Skin cards
    skinCard: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        padding: Spacing.md, backgroundColor: Colors.surfaceLight,
        borderRadius: BorderRadius.lg, marginBottom: Spacing.sm,
        borderWidth: 1.5, borderColor: 'transparent',
    },
    skinPreview: {
        width: 44, height: 44, backgroundColor: Colors.surface + 'AA',
    },
    skinName: { fontSize: FontSize.md, color: Colors.text, fontWeight: '600' },
    skinDesc: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },

    // Icon grid
    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    iconCard: {
        width: (width - 76) / 4, paddingVertical: Spacing.sm, paddingHorizontal: 4,
        backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg,
        alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent', position: 'relative',
    },
    iconPreviewBox: {
        width: 44, height: 44, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center', position: 'relative',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    iconAccentDot: {
        position: 'absolute', bottom: 2, right: 2,
        width: 8, height: 8, borderRadius: 4,
    },
    iconName: { fontSize: 9, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, fontWeight: '600' },
    customIconPreview: {
        width: 44, height: 44, borderRadius: 12,
    },
    uploadBadge: {
        position: 'absolute', top: 2, left: 2,
        backgroundColor: 'rgba(255,215,0,0.2)', borderRadius: 8,
        padding: 2,
    },
    customUploadBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        marginTop: Spacing.md, paddingVertical: Spacing.md,
        backgroundColor: 'rgba(255,215,0,0.08)', borderRadius: BorderRadius.lg,
        borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)', borderStyle: 'dashed',
    },
    customUploadText: { color: '#FFD700', fontWeight: '600', fontSize: FontSize.sm },

    // Limits
    limitsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    limitCard: {
        width: (width - 80) / 3, backgroundColor: Colors.surfaceLight,
        borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', gap: 4,
    },
    limitValue: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
    limitLabel: { fontSize: 10, color: Colors.textTertiary },

    savingText: { textAlign: 'center', color: Colors.textTertiary, fontSize: FontSize.sm, padding: Spacing.md },
});
