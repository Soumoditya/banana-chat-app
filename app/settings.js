import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { usePremium } from '../contexts/PremiumContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { updateUserProfile } from '../services/users';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isPremiumActive, getPremiumFlair } from '../utils/premium';
const APP_VERSION = '3.2.0';

export default function SettingsScreen() {
    const { user, userProfile, signOut, isAdmin } = useAuth();
    const { isDark, toggleTheme, themedColors: C } = usePremium();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [isPrivate, setIsPrivate] = useState(userProfile?.isPrivate || false);

    const settingItem = (icon, title, subtitle, onPress, rightComponent) => (
        <TouchableOpacity style={[styles.settingItem, { borderBottomColor: C.border }]} onPress={onPress} activeOpacity={0.6}>
            <View style={styles.settingLeft}>
                <View style={[styles.settingIconContainer, { backgroundColor: C.surfaceLight }]}>
                    <Ionicons name={icon} size={20} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.settingTitle, { color: C.text }]}>{title}</Text>
                    {subtitle && <Text style={[styles.settingSubtitle, { color: C.textTertiary }]}>{subtitle}</Text>}
                </View>
            </View>
            {rightComponent || <Ionicons name="chevron-forward" size={20} color={C.textTertiary} />}
        </TouchableOpacity>
    );

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

            {/* Appearance — Available to ALL users */}
            <View style={[styles.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>Appearance</Text>
                {settingItem(
                    isDark ? 'moon' : 'sunny',
                    isDark ? 'Dark Mode' : 'Light Mode',
                    'Toggle between light and dark theme',
                    null,
                    <Switch
                        value={isDark}
                        onValueChange={toggleTheme}
                        trackColor={{ false: C.surfaceLight, true: C.primarySurface }}
                        thumbColor={isDark ? C.primary : C.textTertiary}
                    />
                )}
            </View>

            {/* Premium */}
            <View style={[styles.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>Premium</Text>
                {isPremiumActive(userProfile) ? (
                    <>
                        {settingItem('diamond', `${getPremiumFlair(userProfile)} Plan Active`, 'Manage your premium features', () => router.push('/premium-settings'))}
                        {settingItem('star-outline', 'Upgrade Plan', 'See all plans', () => router.push('/premium'))}
                    </>
                ) : (
                    settingItem('diamond-outline', 'Go Premium', 'Verified badges, themes, fonts & more', () => router.push('/premium'))
                )}
            </View>

            {/* Privacy */}
            <View style={[styles.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>Privacy</Text>
                {settingItem(
                    'lock-closed-outline', 'Private Profile', 'Only followers can see your posts',
                    null,
                    <Switch
                        value={isPrivate}
                        onValueChange={async (val) => {
                            setIsPrivate(val);
                            await updateUserProfile(user.uid, { isPrivate: val });
                        }}
                        trackColor={{ false: C.surfaceLight, true: C.primarySurface }}
                        thumbColor={isPrivate ? C.primary : C.textTertiary}
                    />
                )}
                {settingItem('people-outline', 'Blocked Users', 'Manage blocked users', () => router.push('/blocked-users'))}
                {settingItem('star-outline', 'Close Friends', 'Manage close friends list', () => router.push('/close-friends'))}
            </View>

            {/* Stories & Archive */}
            <View style={[styles.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>Stories & Archive</Text>
                {settingItem('calendar-outline', 'Story Archive', 'Browse past stories by date', () => router.push('/story-archive'))}
                {settingItem('archive-outline', 'Archived Posts', 'View your archived posts', () => router.push('/archived-posts'))}
                {settingItem('trash-outline', 'Recently Deleted', 'Recover deleted stories & posts', () => router.push('/recently-deleted'))}
                {settingItem('notifications-outline', 'Notifications', 'Manage notifications', () => router.push('/notifications-settings'))}
            </View>

            {/* Account Security */}
            <View style={[styles.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>Account</Text>
                {settingItem('key-outline', 'Change Password', 'Send password reset email', async () => {
                    if (!user?.email) {
                        Alert.alert('Error', 'No email associated with this account');
                        return;
                    }
                    try {
                        const { sendPasswordResetEmail } = require('firebase/auth');
                        const { auth } = require('../config/firebase');
                        await sendPasswordResetEmail(auth, user.email);
                        Alert.alert('✅ Reset Link Sent', `Check ${user.email} for the password reset link. After changing your password, you'll need to sign in again.`);
                    } catch (err) {
                        Alert.alert('Error', err.message);
                    }
                })}
                {settingItem('mail-outline', 'Email', user?.email || 'Not set', null, <Text style={{ color: C.textTertiary, fontSize: 13 }}>{user?.email || ''}</Text>)}
            </View>

            {/* Admin Panel (visible to admins only) */}
            {isAdmin && (
                <View style={[styles.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                    <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>Admin</Text>
                    {settingItem('shield-checkmark', 'Admin Panel', 'Approve premium, manage users, broadcast', () => router.push('/admin'))}
                </View>
            )}

            {/* About */}
            <View style={[styles.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>About</Text>
                {settingItem('shield-checkmark-outline', 'Privacy & Security', 'Manage your data', () => Alert.alert('Privacy & Security', 'Your data is stored securely with Firebase. You can manage your profile visibility in the Privacy section above, and delete your account by contacting support.'))}
                {settingItem('document-text-outline', 'Terms of Service', 'Read our terms', () => Linking.openURL('https://banana-chat.app/terms').catch(() => {}))}
                {settingItem('information-circle-outline', 'About Banana Chat', `Version ${APP_VERSION}`, () => router.push('/about'))}
            </View>

            {/* Sign Out */}
            <TouchableOpacity
                style={styles.signOutBtn}
                onPress={() => {
                    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Sign Out', style: 'destructive',
                            onPress: async () => { await signOut(); router.replace('/(auth)/login'); }
                        },
                    ]);
                }}
            >
                <Ionicons name="log-out-outline" size={20} color={Colors.error} />
                <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
                <Text style={styles.footerText}>🍌 Banana Chat v{APP_VERSION}</Text>
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
