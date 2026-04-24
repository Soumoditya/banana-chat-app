import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Linking, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { usePremium } from '../contexts/PremiumContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { updateUserProfile } from '../services/users';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isPremiumActive, getPremiumFlair } from '../utils/premium';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useToast } from '../contexts/ToastContext';
const APP_VERSION = '3.2.0';

// Searchable settings items definition
const SETTINGS_ITEMS = [
    { id: 'theme', section: 'Appearance', icon: 'moon', title: 'Dark Mode', subtitle: 'Toggle between light and dark theme', keywords: ['theme', 'dark', 'light', 'mode', 'appearance', 'color'], type: 'toggle', key: 'isDark' },
    { id: 'premium_active', section: 'Premium', icon: 'diamond', title: 'Plan Active', subtitle: 'Manage your premium features', keywords: ['premium', 'plan', 'manage', 'subscription'], action: '/premium-settings', premiumOnly: true },
    { id: 'premium_upgrade', section: 'Premium', icon: 'star-outline', title: 'Upgrade Plan', subtitle: 'See all plans', keywords: ['upgrade', 'plan', 'premium', 'buy'], action: '/premium', premiumOnly: true },
    { id: 'premium_go', section: 'Premium', icon: 'diamond-outline', title: 'Go Premium', subtitle: 'Verified badges, themes, fonts & more', keywords: ['premium', 'go', 'subscribe', 'badge', 'theme'], action: '/premium', freeOnly: true },
    { id: 'private', section: 'Privacy', icon: 'lock-closed-outline', title: 'Private Profile', subtitle: 'Only followers can see your posts', keywords: ['private', 'profile', 'visibility', 'followers', 'privacy'], type: 'toggle', key: 'isPrivate' },
    { id: 'blocked', section: 'Privacy', icon: 'people-outline', title: 'Blocked Users', subtitle: 'Manage blocked users', keywords: ['blocked', 'block', 'users', 'manage'], action: '/blocked-users' },
    { id: 'close_friends', section: 'Privacy', icon: 'star-outline', title: 'Close Friends', subtitle: 'Manage close friends list', keywords: ['close', 'friends', 'list', 'manage'], action: '/close-friends' },
    { id: 'story_archive', section: 'Stories & Archive', icon: 'calendar-outline', title: 'Story Archive', subtitle: 'Browse past stories by date', keywords: ['story', 'archive', 'past', 'calendar', 'stories'], action: '/story-archive' },
    { id: 'archived_posts', section: 'Stories & Archive', icon: 'archive-outline', title: 'Archived Posts', subtitle: 'View your archived posts', keywords: ['archived', 'posts', 'view', 'archive'], action: '/archived-posts' },
    { id: 'recently_deleted', section: 'Stories & Archive', icon: 'trash-outline', title: 'Recently Deleted', subtitle: 'Recover deleted stories & posts', keywords: ['deleted', 'recently', 'recover', 'trash', 'restore'], action: '/recently-deleted' },
    { id: 'notifications', section: 'Stories & Archive', icon: 'notifications-outline', title: 'Notifications', subtitle: 'Manage notifications', keywords: ['notifications', 'manage', 'alerts', 'push'], action: '/notifications-settings' },
    { id: 'account_type', section: 'Account', icon: 'person-circle-outline', title: 'Account Type', subtitle: 'Personal, Creator, or Business', keywords: ['account', 'type', 'personal', 'creator', 'business'], action: '/account-type' },
    { id: 'change_password', section: 'Account', icon: 'key-outline', title: 'Change Password', subtitle: 'Send password reset email', keywords: ['change', 'password', 'reset', 'email', 'security'], type: 'action', actionKey: 'resetPassword' },
    { id: 'email', section: 'Account', icon: 'mail-outline', title: 'Email', subtitle: '', keywords: ['email', 'address', 'account'], type: 'display' },
    { id: 'admin', section: 'Admin', icon: 'shield-checkmark', title: 'Admin Panel', subtitle: 'Approve premium, manage users, broadcast', keywords: ['admin', 'panel', 'manage', 'approve', 'broadcast'], action: '/admin', adminOnly: true },
    { id: 'faq', section: 'About & Help', icon: 'help-circle-outline', title: 'FAQ', subtitle: 'Frequently asked questions', keywords: ['faq', 'help', 'questions', 'support'], action: '/faq' },
    { id: 'privacy_security', section: 'About & Help', icon: 'shield-checkmark-outline', title: 'Privacy & Security', subtitle: 'Manage your data', keywords: ['privacy', 'security', 'data', 'manage'], type: 'action', actionKey: 'privacyInfo' },
    { id: 'terms', section: 'About & Help', icon: 'document-text-outline', title: 'Terms of Service', subtitle: 'Read our terms', keywords: ['terms', 'service', 'legal', 'policy'], type: 'action', actionKey: 'openTerms' },
    { id: 'about', section: 'About & Help', icon: 'information-circle-outline', title: 'About Banana Chat', subtitle: `Version ${APP_VERSION}`, keywords: ['about', 'version', 'info', 'banana'], action: '/about' },
];

export default function SettingsScreen() {
    const { user, userProfile, signOut, isAdmin } = useAuth();
    const { isDark, toggleTheme, themedColors: C } = usePremium();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [isPrivate, setIsPrivate] = useState(userProfile?.isPrivate || false);
    const [searchQuery, setSearchQuery] = useState('');

    const hasPremium = isPremiumActive(userProfile);
    const { showToast, showConfirm } = useToast();

    // Filter settings items based on search query
    const filteredItems = useMemo(() => {
        let items = SETTINGS_ITEMS.filter(item => {
            // Filter by role/premium
            if (item.adminOnly && !isAdmin) return false;
            if (item.premiumOnly && !hasPremium) return false;
            if (item.freeOnly && hasPremium) return false;
            return true;
        });

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            items = items.filter(item =>
                item.title.toLowerCase().includes(q) ||
                item.subtitle?.toLowerCase().includes(q) ||
                item.keywords.some(k => k.includes(q)) ||
                item.section.toLowerCase().includes(q)
            );
        }

        return items;
    }, [searchQuery, isAdmin, hasPremium]);

    // Group by section
    const sections = useMemo(() => {
        const grouped = {};
        filteredItems.forEach(item => {
            if (!grouped[item.section]) grouped[item.section] = [];
            grouped[item.section].push(item);
        });
        return grouped;
    }, [filteredItems]);

    const handleAction = (item) => {
        if (item.action) {
            router.push(item.action);
            return;
        }
        if (item.actionKey === 'resetPassword') {
            if (!user?.email) {
                showToast('No email associated with this account', 'error');
                return;
            }
            sendPasswordResetEmail(auth, user.email)
                .then(() => showToast(`Reset link sent to ${user.email}`, 'success', '✅ Check your email'))
                .catch(err => showToast(err.message, 'error'));
            return;
        }
        if (item.actionKey === 'privacyInfo') {
            showToast('Your data is stored securely with Firebase. Manage visibility in Privacy settings.', 'info', 'Privacy & Security');
            return;
        }
        if (item.actionKey === 'openTerms') {
            Linking.openURL('https://banana-chat-app.vercel.app').catch(() => { });
            return;
        }
    };

    const renderItem = (item) => {
        // Toggle items
        if (item.type === 'toggle' && item.key === 'isDark') {
            return (
                <TouchableOpacity key={item.id} style={[styles.settingItem, { borderBottomColor: C.border }]} activeOpacity={0.6}>
                    <View style={styles.settingLeft}>
                        <View style={[styles.settingIconContainer, { backgroundColor: C.surfaceLight }]}>
                            <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={C.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.settingTitle, { color: C.text }]}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
                            <Text style={[styles.settingSubtitle, { color: C.textTertiary }]}>{item.subtitle}</Text>
                        </View>
                    </View>
                    <Switch
                        value={isDark}
                        onValueChange={toggleTheme}
                        trackColor={{ false: C.surfaceLight, true: C.primarySurface }}
                        thumbColor={isDark ? C.primary : C.textTertiary}
                    />
                </TouchableOpacity>
            );
        }
        if (item.type === 'toggle' && item.key === 'isPrivate') {
            return (
                <TouchableOpacity key={item.id} style={[styles.settingItem, { borderBottomColor: C.border }]} activeOpacity={0.6}>
                    <View style={styles.settingLeft}>
                        <View style={[styles.settingIconContainer, { backgroundColor: C.surfaceLight }]}>
                            <Ionicons name={item.icon} size={20} color={C.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.settingTitle, { color: C.text }]}>{item.title}</Text>
                            <Text style={[styles.settingSubtitle, { color: C.textTertiary }]}>{item.subtitle}</Text>
                        </View>
                    </View>
                    <Switch
                        value={isPrivate}
                        onValueChange={async (val) => {
                            setIsPrivate(val);
                            await updateUserProfile(user.uid, { isPrivate: val });
                        }}
                        trackColor={{ false: C.surfaceLight, true: C.primarySurface }}
                        thumbColor={isPrivate ? C.primary : C.textTertiary}
                    />
                </TouchableOpacity>
            );
        }
        if (item.type === 'display') {
            return (
                <View key={item.id} style={[styles.settingItem, { borderBottomColor: C.border }]}>
                    <View style={styles.settingLeft}>
                        <View style={[styles.settingIconContainer, { backgroundColor: C.surfaceLight }]}>
                            <Ionicons name={item.icon} size={20} color={C.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.settingTitle, { color: C.text }]}>{item.title}</Text>
                        </View>
                    </View>
                    <Text style={{ color: C.textTertiary, fontSize: 13 }}>{user?.email || ''}</Text>
                </View>
            );
        }

        // Premium active item — customized title
        let title = item.title;
        if (item.id === 'premium_active') title = `${getPremiumFlair(userProfile)} Plan Active`;
        if (item.id === 'account_type') {
            const cat = userProfile?.profileCategory;
            title = cat === 'creator' ? 'Creator Account' : cat === 'business' ? 'Business Account' : 'Personal Account';
        }

        // Standard navigable item
        return (
            <TouchableOpacity key={item.id} style={[styles.settingItem, { borderBottomColor: C.border }]} onPress={() => handleAction(item)} activeOpacity={0.6}>
                <View style={styles.settingLeft}>
                    <View style={[styles.settingIconContainer, { backgroundColor: C.surfaceLight }]}>
                        <Ionicons name={item.icon} size={20} color={C.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.settingTitle, { color: C.text }]}>{title}</Text>
                        {item.subtitle ? <Text style={[styles.settingSubtitle, { color: C.textTertiary }]}>{item.subtitle}</Text> : null}
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={C.textTertiary} />
            </TouchableOpacity>
        );
    };

    return (
        <ScrollView
            style={[styles.container, { paddingTop: insets.top, backgroundColor: C.background }]}
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
            {/* Header */}
            <View style={[styles.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={C.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: C.text }]}>Settings</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Search Bar */}
            <View style={[styles.searchContainer, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Ionicons name="search-outline" size={18} color={C.textTertiary} />
                <TextInput
                    style={[styles.searchInput, { color: C.text }]}
                    placeholder="Search settings..."
                    placeholderTextColor={C.textTertiary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={18} color={C.textTertiary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Search results count */}
            {searchQuery.trim().length > 0 && (
                <Text style={{ color: C.textTertiary, fontSize: 12, paddingHorizontal: Spacing.lg, marginTop: 4 }}>
                    {filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''} for "{searchQuery}"
                </Text>
            )}

            {/* Settings Sections */}
            {Object.entries(sections).map(([sectionName, items]) => (
                <View key={sectionName} style={[styles.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                    <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>{sectionName}</Text>
                    {items.map(item => renderItem(item))}
                </View>
            ))}

            {/* No results */}
            {searchQuery.trim().length > 0 && filteredItems.length === 0 && (
                <View style={{ alignItems: 'center', paddingTop: 40 }}>
                    <Ionicons name="search-outline" size={48} color={C.textTertiary} />
                    <Text style={{ color: C.textTertiary, fontSize: 16, marginTop: 12 }}>No settings found</Text>
                    <Text style={{ color: C.textTertiary, fontSize: 13, marginTop: 4 }}>Try a different search term</Text>
                </View>
            )}

            {/* Sign Out */}
            <TouchableOpacity
                style={[styles.signOutBtn, { borderColor: C.error || Colors.error }]}
                onPress={() => {
                    showConfirm('Sign Out', 'Are you sure you want to sign out?',
                        async () => { await signOut(); router.replace('/(auth)/login'); },
                        { variant: 'destructive', confirmText: 'Sign Out', icon: 'log-out-outline' }
                    );
                }}
            >
                <Ionicons name="log-out-outline" size={20} color={C.error || Colors.error} />
                <Text style={[styles.signOutText, { color: C.error || Colors.error }]}>Sign Out</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
                <Text style={[styles.footerText, { color: C.textTertiary }]}>🍌 Banana Chat v{APP_VERSION}</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md,
        backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    headerTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text },
    searchContainer: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        marginHorizontal: Spacing.md, marginTop: Spacing.md,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
        backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
        borderWidth: 1, borderColor: Colors.border,
    },
    searchInput: {
        flex: 1, color: Colors.text, fontSize: FontSize.md, paddingVertical: 4,
    },
    section: { marginTop: Spacing.lg, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, marginHorizontal: Spacing.md, overflow: 'hidden', borderWidth: 0.5, borderColor: Colors.border },
    sectionTitle: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.xs },
    settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    settingLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
    settingIconContainer: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    settingTitle: { color: Colors.text, fontSize: FontSize.md },
    settingSubtitle: { color: Colors.textTertiary, fontSize: FontSize.xs },
    signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, margin: Spacing.lg, paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.error },
    signOutText: { color: Colors.error, fontSize: FontSize.md, fontWeight: '600' },
    footer: { alignItems: 'center', paddingVertical: Spacing.xxl },
    footerText: { color: Colors.textTertiary, fontSize: FontSize.xs },
});
