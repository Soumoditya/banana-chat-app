import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { updateUserProfile } from '../services/users';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
    const { user, userProfile, signOut } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [isPrivate, setIsPrivate] = useState(userProfile?.isPrivate || false);

    const settingItem = (icon, title, subtitle, onPress, rightComponent) => (
        <TouchableOpacity style={styles.settingItem} onPress={onPress} activeOpacity={0.6}>
            <View style={styles.settingLeft}>
                <View style={styles.settingIconContainer}>
                    <Ionicons name={icon} size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.settingTitle}>{title}</Text>
                    {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
                </View>
            </View>
            {rightComponent || <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />}
        </TouchableOpacity>
    );

    return (
        <ScrollView
            style={[styles.container, { paddingTop: insets.top }]}
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Account */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account</Text>
                {settingItem('create-outline', 'Edit Profile', 'Change name, bio, photo, links', () => {
                    router.back(); // go back to profile tab
                    // The edit profile modal is within profile.js
                })}
            </View>

            {/* Privacy */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Privacy</Text>
                {settingItem(
                    'lock-closed-outline', 'Private Profile', 'Only followers can see your posts',
                    null,
                    <Switch
                        value={isPrivate}
                        onValueChange={async (val) => {
                            setIsPrivate(val);
                            await updateUserProfile(user.uid, { isPrivate: val });
                        }}
                        trackColor={{ false: Colors.surfaceLight, true: Colors.primarySurface }}
                        thumbColor={isPrivate ? Colors.primary : Colors.textTertiary}
                    />
                )}
                {settingItem('people-outline', 'Blocked Users', 'Manage blocked users', () => router.push('/blocked-users'))}
                {settingItem('star-outline', 'Close Friends', 'Manage close friends list', () => router.push('/close-friends'))}
            </View>

            {/* Stories & Archive */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Stories & Archive</Text>
                {settingItem('calendar-outline', 'Story Archive', 'Browse past stories by date', () => router.push('/story-archive'))}
                {settingItem('trash-outline', 'Recently Deleted', 'Recover deleted stories & posts', () => router.push('/recently-deleted'))}
                {settingItem('notifications-outline', 'Notifications', 'Manage notifications', () => router.push('/notifications-settings'))}
            </View>

            {/* About */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>About</Text>
                {settingItem('information-circle-outline', 'About Banana Chat', 'Version 1.0.0', () => router.push('/about'))}
                {settingItem('document-text-outline', 'Terms of Service', null, () => Linking.openURL('https://banana-chat.app/terms').catch(() => {}))}
                {settingItem('shield-outline', 'Privacy Policy', null, () => Linking.openURL('https://banana-chat.app/privacy').catch(() => {}))}
            </View>

            {/* Sign Out */}
            <TouchableOpacity
                style={styles.signOutBtn}
                onPress={async () => { await signOut(); router.replace('/(auth)/login'); }}
            >
                <Ionicons name="log-out-outline" size={20} color={Colors.error} />
                <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
                <Text style={styles.footerText}>🍌 Banana Chat v1.0.0</Text>
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
