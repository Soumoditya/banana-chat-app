import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAppTheme from '../hooks/useAppTheme';
import * as Clipboard from 'expo-clipboard';
import { useToast } from '../contexts/ToastContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const APP_VERSION = '3.2.0';
const UPI_ID = 'soumodityapramanik-2@okaxis';

const DEVELOPER = {
    name: 'Soumoditya Pramanik',
    email: 'soumodityapramanik@gmail.com',
    socials: [
        { icon: 'logo-linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/soumodityapramanik', color: '#0A66C2' },
        { icon: 'logo-github', label: 'GitHub', url: 'https://github.com/Soumoditya', color: '#8B5CF6' },
        { icon: 'logo-twitter', label: 'X / Twitter', url: 'https://x.com/Soumodityax', color: '#1DA1F2' },
        { icon: 'globe-outline', label: 'Grokipedia', url: 'http://grokipedia.com/page/soumoditya-pramanik', color: '#10B981' },
        { icon: 'mail-outline', label: 'Email', url: 'mailto:soumodityapramanik@gmail.com', color: '#F59E0B' },
    ],
};

const VERSION_HISTORY = [
    {
        version: '3.2.0', date: 'Apr 2026', title: 'Phase 3 — Full Feature Build', changes: [
            'Username change with uniqueness check',
            'Profile analytics with Instagram-like graphs',
            'Profile category system (Personal/Creator/Business)',
            'Real push notifications via Expo Push API',
            'Unread badges on tab bar',
            'Chat media download',
            'FAQ section',
            'About page with developer info & UPI donation',
        ]
    },
    {
        version: '3.1.0', date: 'Apr 2026', title: 'Phase 2 — UI Stabilization', changes: [
            'Global theming system across all screens',
            'Premium badge propagation',
            'Enhanced UI skins with dramatic visual effects',
            'Admin plan picker modal',
            'Post reshare button',
        ]
    },
    {
        version: '3.0.0', date: 'Apr 2026', title: 'Phase 1 — Premium & Monetization', changes: [
            'Tiered premium plans (Standard to VIP)',
            'Custom themes, fonts, and UI skins',
            'Premium badges and verification',
            'Story highlights system',
            'App icon customization',
        ]
    },
    {
        version: '2.0.0', date: 'Mar 2026', title: 'Social Features', changes: [
            'Real-time chat with RTDB',
            'Voice messages & media sharing',
            'Stories with close friends support',
            'Follow/unfollow system',
            'Notifications system',
        ]
    },
    {
        version: '1.0.0', date: 'Feb 2026', title: 'Initial Release', changes: [
            'User registration & authentication',
            'Posts with media attachments',
            'Basic profile system',
            'Like and comment system',
        ]
    },
];

const DONATION_AMOUNTS = [
    { amount: 49, label: '☕ Coffee', emoji: '☕' },
    { amount: 99, label: '🍕 Pizza', emoji: '🍕' },
    { amount: 199, label: '🎁 Gift', emoji: '🎁' },
    { amount: 499, label: '💎 Premium', emoji: '💎' },
];

export default function AboutScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { C, skin } = useAppTheme();
    const [expandedVersion, setExpandedVersion] = useState('3.2.0');
    const { showToast } = useToast();

    const toggleVersion = (v) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedVersion(expandedVersion === v ? null : v);
    };

    const handleDonate = (amount) => {
        const upiUrl = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(DEVELOPER.name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Banana Chat Donation - ₹${amount}`)}`;
        Linking.openURL(upiUrl).catch(() => {
            showToast('Install a UPI app (GPay, PhonePe, Paytm) to donate', 'warning', 'UPI App Not Found');
            copyUPI();
        });
    };

    const copyUPI = async () => {
        try {
            await Clipboard.setStringAsync(UPI_ID);
            showToast(`UPI ID copied: ${UPI_ID}`, 'success', 'Copied!');
        } catch {
            showToast(UPI_ID, 'info', 'UPI ID');
        }
    };

    const openLink = (url) => Linking.openURL(url).catch(() => { });

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
                <Text style={[styles.headerTitle, { color: C.text }]}>About</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* App Logo */}
            <View style={styles.logoSection}>
                <Text style={styles.logoEmoji}>🍌</Text>
                <Text style={[styles.appName, { color: C.text }]}>Banana Chat</Text>
                <Text style={[styles.tagline, { color: C.textSecondary }]}>Connect, Share, Go Bananas!</Text>
                <View style={[styles.versionBadge, { backgroundColor: C.primarySurface }]}>
                    <Text style={[styles.versionText, { color: C.primary }]}>v{APP_VERSION}</Text>
                </View>
            </View>

            {/* App Info */}
            <View style={[styles.section, { backgroundColor: C.surface, borderColor: C.border, ...skin.cardStyle }]}>
                <InfoRow icon="information-circle-outline" label="Version" value={APP_VERSION} C={C} />
                <InfoRow icon="construct-outline" label="Build" value="Production" C={C} />
                <InfoRow icon="logo-react" label="Framework" value="React Native + Expo" C={C} />
                <InfoRow icon="server-outline" label="Backend" value="Firebase" C={C} />
            </View>

            {/* Developer Section */}
            <View style={[styles.section, { backgroundColor: C.surface, borderColor: C.border, ...skin.cardStyle }]}>
                <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>Developer</Text>
                <View style={styles.devCard}>
                    <View style={[styles.devAvatar, { backgroundColor: C.primarySurface }]}>
                        <Text style={styles.devAvatarEmoji}>👨‍💻</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.devName, { color: C.text }]}>{DEVELOPER.name}</Text>
                        <Text style={[styles.devEmail, { color: C.textSecondary }]}>{DEVELOPER.email}</Text>
                    </View>
                </View>

                {/* Social Links */}
                <View style={styles.socialsGrid}>
                    {DEVELOPER.socials.map((s, i) => (
                        <TouchableOpacity
                            key={i}
                            style={[styles.socialBtn, { backgroundColor: s.color + '15', borderColor: s.color + '30' }]}
                            onPress={() => openLink(s.url)}
                        >
                            <Ionicons name={s.icon} size={18} color={s.color} />
                            <Text style={[styles.socialLabel, { color: s.color }]}>{s.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Donation Section */}
            <View style={[styles.section, { backgroundColor: C.surface, borderColor: C.border, ...skin.cardStyle }]}>
                <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>Support the Developer</Text>
                <View style={styles.donateInfo}>
                    <Text style={[styles.donateText, { color: C.text }]}>
                        ☕ If you enjoy Banana Chat, consider buying the developer a coffee!
                    </Text>
                </View>

                <View style={styles.donateGrid}>
                    {DONATION_AMOUNTS.map((d) => (
                        <TouchableOpacity
                            key={d.amount}
                            style={[styles.donateCard, { backgroundColor: C.surfaceLight, borderColor: C.border }]}
                            onPress={() => handleDonate(d.amount)}
                        >
                            <Text style={styles.donateEmoji}>{d.emoji}</Text>
                            <Text style={[styles.donateAmount, { color: C.text }]}>₹{d.amount}</Text>
                            <Text style={[styles.donateLabel, { color: C.textSecondary }]}>{d.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* UPI ID */}
                <TouchableOpacity style={[styles.upiRow, { backgroundColor: C.surfaceLight }]} onPress={copyUPI}>
                    <Ionicons name="wallet-outline" size={18} color={C.primary} />
                    <Text style={[styles.upiId, { color: C.text }]}>{UPI_ID}</Text>
                    <Ionicons name="copy-outline" size={16} color={C.textTertiary} />
                </TouchableOpacity>
            </View>

            {/* Version History */}
            <View style={[styles.section, { backgroundColor: C.surface, borderColor: C.border, ...skin.cardStyle }]}>
                <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>Version History</Text>
                {VERSION_HISTORY.map((v) => {
                    const isExpanded = expandedVersion === v.version;
                    return (
                        <View key={v.version}>
                            <TouchableOpacity
                                style={[styles.versionRow, { borderBottomColor: C.border }]}
                                onPress={() => toggleVersion(v.version)}
                            >
                                <View style={{ flex: 1 }}>
                                    <View style={styles.versionHeader}>
                                        <Text style={[styles.versionNum, { color: C.primary }]}>v{v.version}</Text>
                                        <Text style={[styles.versionDate, { color: C.textTertiary }]}>{v.date}</Text>
                                    </View>
                                    <Text style={[styles.versionTitle, { color: C.text }]}>{v.title}</Text>
                                </View>
                                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={C.textTertiary} />
                            </TouchableOpacity>
                            {isExpanded && (
                                <View style={[styles.changesList, { backgroundColor: C.surfaceLight }]}>
                                    {v.changes.map((c, i) => (
                                        <View key={i} style={styles.changeItem}>
                                            <Text style={[styles.changeDot, { color: C.primary }]}>•</Text>
                                            <Text style={[styles.changeText, { color: C.textSecondary }]}>{c}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>

            {/* Legal */}
            <View style={[styles.section, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>Links</Text>
                <TouchableOpacity style={[styles.linkItem, { borderBottomColor: C.border }]} onPress={() => openLink('https://banana-chat-app.vercel.app')}>
                    <View style={styles.linkLeft}>
                        <View style={[styles.iconBox, { backgroundColor: '#3B82F620' }]}>
                            <Ionicons name="globe-outline" size={18} color="#3B82F6" />
                        </View>
                        <Text style={[styles.linkText, { color: C.text }]}>Website</Text>
                    </View>
                    <Ionicons name="open-outline" size={16} color={C.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.linkItem, { borderBottomColor: C.border }]} onPress={() => openLink('https://github.com/Soumoditya/banana-chat-app')}>
                    <View style={styles.linkLeft}>
                        <View style={[styles.iconBox, { backgroundColor: '#8B5CF620' }]}>
                            <Ionicons name="logo-github" size={18} color="#8B5CF6" />
                        </View>
                        <Text style={[styles.linkText, { color: C.text }]}>GitHub</Text>
                    </View>
                    <Ionicons name="open-outline" size={16} color={C.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.linkItem, { borderBottomColor: C.border }]} onPress={() => openLink('https://banana-chat-app.vercel.app')}>
                    <View style={styles.linkLeft}>
                        <View style={[styles.iconBox, { backgroundColor: C.surfaceLight }]}>
                            <Ionicons name="document-text-outline" size={18} color={C.primary} />
                        </View>
                        <Text style={[styles.linkText, { color: C.text }]}>Terms of Service</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.linkItem, { borderBottomColor: C.border }]} onPress={() => openLink('https://banana-chat-app.vercel.app')}>
                    <View style={styles.linkLeft}>
                        <View style={[styles.iconBox, { backgroundColor: C.surfaceLight }]}>
                            <Ionicons name="shield-outline" size={18} color={C.primary} />
                        </View>
                        <Text style={[styles.linkText, { color: C.text }]}>Privacy Policy</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
                </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <Text style={[styles.footerText, { color: C.textSecondary }]}>Made with 💛 by {DEVELOPER.name}</Text>
                <Text style={[styles.copyright, { color: C.textTertiary }]}>© 2026 Banana Chat. All rights reserved.</Text>
            </View>
        </ScrollView>
    );
}

const InfoRow = ({ icon, label, value, C }) => (
    <View style={[infoStyles.row, { borderBottomColor: C.border }]}>
        <View style={infoStyles.left}>
            <View style={[infoStyles.iconBox, { backgroundColor: C.surfaceLight }]}>
                <Ionicons name={icon} size={18} color={C.primary} />
            </View>
            <Text style={[infoStyles.label, { color: C.text }]}>{label}</Text>
        </View>
        <Text style={[infoStyles.value, { color: C.textSecondary }]}>{value}</Text>
    </View>
);

const infoStyles = StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 0.5 },
    left: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    iconBox: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    label: { fontSize: FontSize.md },
    value: { fontSize: FontSize.sm },
});

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 0.5,
    },
    headerTitle: { fontSize: FontSize.xl, fontWeight: 'bold' },
    logoSection: { alignItems: 'center', paddingVertical: 32 },
    logoEmoji: { fontSize: 64 },
    appName: { fontSize: 28, fontWeight: 'bold', marginTop: 12 },
    tagline: { fontSize: FontSize.md, marginTop: 4 },
    versionBadge: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    versionText: { fontSize: FontSize.sm, fontWeight: '700' },
    section: {
        marginHorizontal: Spacing.md, marginBottom: Spacing.md,
        borderRadius: BorderRadius.lg, overflow: 'hidden', borderWidth: 0.5,
    },
    sectionTitle: {
        fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase',
        letterSpacing: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm,
    },
    devCard: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    devAvatar: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
    devAvatarEmoji: { fontSize: 28 },
    devName: { fontSize: FontSize.lg, fontWeight: '700' },
    devEmail: { fontSize: FontSize.sm, marginTop: 2 },
    socialsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: 8 },
    socialBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
    },
    socialLabel: { fontSize: FontSize.sm, fontWeight: '600' },
    donateInfo: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
    donateText: { fontSize: FontSize.sm, lineHeight: 20 },
    donateGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.md, gap: 8 },
    donateCard: {
        flex: 1, minWidth: '40%', alignItems: 'center', padding: Spacing.md,
        borderRadius: BorderRadius.md, borderWidth: 1, gap: 4,
    },
    donateEmoji: { fontSize: 24 },
    donateAmount: { fontSize: FontSize.lg, fontWeight: 'bold' },
    donateLabel: { fontSize: 11 },
    upiRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        margin: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md,
    },
    upiId: { flex: 1, fontSize: FontSize.sm, fontWeight: '500', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    versionRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 0.5,
    },
    versionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    versionNum: { fontSize: FontSize.sm, fontWeight: '700' },
    versionDate: { fontSize: 11 },
    versionTitle: { fontSize: FontSize.md, fontWeight: '500', marginTop: 2 },
    changesList: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
    changeItem: { flexDirection: 'row', gap: 6, paddingVertical: 3 },
    changeDot: { fontSize: FontSize.sm, fontWeight: 'bold' },
    changeText: { flex: 1, fontSize: FontSize.sm, lineHeight: 18 },
    linkItem: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 0.5,
    },
    linkLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    iconBox: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    linkText: { fontSize: FontSize.md },
    footer: { alignItems: 'center', paddingVertical: 30 },
    footerText: { fontSize: FontSize.md },
    copyright: { fontSize: FontSize.xs, marginTop: 4 },
});
