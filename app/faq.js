import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAppTheme from '../hooks/useAppTheme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQ_DATA = [
    {
        category: '👤 Account',
        items: [
            { q: 'How do I change my username?', a: 'Go to your Profile → Edit Profile. Tap on your username field, enter a new one, and hit "Check Availability". If it\'s available, save your profile to apply the change.' },
            { q: 'Can I switch between Personal and Creator accounts?', a: 'Yes! Go to Settings → Account Type. You can switch between Personal, Creator, and Business profiles anytime. Creator and Business accounts get access to analytics.' },
            { q: 'How do I make my profile private?', a: 'Go to Settings → Privacy → toggle "Private Profile". Only your followers will be able to see your posts.' },
            { q: 'How do I reset my password?', a: 'Go to Settings → Account → Change Password. A reset link will be sent to your registered email address.' },
        ],
    },
    {
        category: '👑 Premium',
        items: [
            { q: 'What does Premium include?', a: 'Premium unlocks verified badges, custom themes, premium fonts, UI skins, iOS emoji keyboard, media download, extended post/story limits, and profile analytics.' },
            { q: 'How do I get Premium?', a: 'Go to Settings → Go Premium. Choose a plan, complete UPI payment, and submit your request. An admin will approve it within 24 hours.' },
            { q: 'What are the different Premium tiers?', a: 'We offer 6 tiers: Standard (₹99), Premium (₹199), Premium+ (₹299), Elite (₹399), Super (₹499), and VIP (₹999). Higher tiers unlock more themes, fonts, skins, and exclusive features.' },
            { q: 'Will I lose my data if Premium expires?', a: 'No! Your posts, chats, and profile remain. Premium-exclusive visual customizations (themes, fonts, skins) will revert to defaults, but your content is safe.' },
        ],
    },
    {
        category: '💬 Chat',
        items: [
            { q: 'Can I send voice messages?', a: 'Yes! In any chat, long-press the microphone icon to record a voice note. Release to send.' },
            { q: 'How do I create a group chat?', a: 'Go to the Chats tab → tap the + icon → "New Group". Add members, set a name, and you\'re good to go.' },
            { q: 'Can I download images and videos from chats?', a: 'Yes! Tap on any media in chat, then use the download button to save it to your device gallery.' },
            { q: 'What are streaks?', a: 'Streaks track consecutive days you and a friend exchange messages. Keep the streak alive by messaging each other daily!' },
        ],
    },
    {
        category: '🔒 Privacy & Safety',
        items: [
            { q: 'How do I block someone?', a: 'Go to their profile → tap the ⋯ menu → "Block User". They won\'t be able to see your posts or message you.' },
            { q: 'Can I hide my stories from specific people?', a: 'Yes! When creating a story, you can choose visibility. You can also manage your "Hide Story From" list in Settings.' },
            { q: 'Is my data secure?', a: 'Yes. Banana Chat uses Firebase with industry-standard encryption. Your data is stored securely and never shared with third parties.' },
        ],
    },
    {
        category: '⚙️ Technical',
        items: [
            { q: 'Why am I not receiving notifications?', a: 'Make sure notifications are enabled in your phone\'s Settings → Apps → Banana Chat → Notifications. Also check Settings → Notifications inside the app.' },
            { q: 'The app is running slowly. What should I do?', a: 'Try clearing the app cache, ensure you\'re on the latest version, and check your internet connection. If the issue persists, restart the app.' },
            { q: 'How do I report a bug?', a: 'Contact the developer at soumodityapramanik@gmail.com with a description of the issue and screenshots if possible.' },
        ],
    },
];

export default function FAQScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { C, skin } = useAppTheme();
    const [expanded, setExpanded] = useState({});

    const toggle = (key) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
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
                <Text style={[styles.headerTitle, { color: C.text }]}>FAQ</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.heroSection}>
                <Text style={styles.heroEmoji}>❓</Text>
                <Text style={[styles.heroTitle, { color: C.text }]}>Frequently Asked Questions</Text>
                <Text style={[styles.heroSubtitle, { color: C.textSecondary }]}>Find answers to common questions</Text>
            </View>

            {FAQ_DATA.map((section, sIdx) => (
                <View key={sIdx} style={[styles.section, { backgroundColor: C.surface, borderColor: C.border, ...skin.cardStyle }]}>
                    <Text style={[styles.sectionTitle, { color: C.textSecondary }]}>{section.category}</Text>
                    {section.items.map((item, iIdx) => {
                        const key = `${sIdx}-${iIdx}`;
                        const isOpen = expanded[key];
                        return (
                            <View key={key}>
                                <TouchableOpacity
                                    style={[styles.questionRow, { borderBottomColor: C.border }]}
                                    onPress={() => toggle(key)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.questionText, { color: C.text }]}>{item.q}</Text>
                                    <Ionicons
                                        name={isOpen ? 'chevron-up' : 'chevron-down'}
                                        size={18}
                                        color={C.textTertiary}
                                    />
                                </TouchableOpacity>
                                {isOpen && (
                                    <View style={[styles.answerBox, { backgroundColor: C.surfaceLight }]}>
                                        <Text style={[styles.answerText, { color: C.textSecondary }]}>{item.a}</Text>
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>
            ))}

            <View style={styles.footer}>
                <Text style={[styles.footerText, { color: C.textTertiary }]}>
                    Still have questions? Email us at
                </Text>
                <Text style={[styles.footerEmail, { color: C.primary }]}>
                    soumodityapramanik@gmail.com
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
    heroSection: { alignItems: 'center', paddingVertical: 30 },
    heroEmoji: { fontSize: 48 },
    heroTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 8 },
    heroSubtitle: { fontSize: FontSize.md, marginTop: 4 },
    section: {
        marginHorizontal: Spacing.md, marginBottom: Spacing.md,
        borderRadius: BorderRadius.lg, overflow: 'hidden', borderWidth: 0.5,
    },
    sectionTitle: {
        fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase',
        letterSpacing: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm,
    },
    questionRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderBottomWidth: 0.5,
    },
    questionText: { flex: 1, fontSize: FontSize.md, fontWeight: '500', marginRight: 8 },
    answerBox: {
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    answerText: { fontSize: FontSize.sm, lineHeight: 20 },
    footer: { alignItems: 'center', paddingVertical: 30 },
    footerText: { fontSize: FontSize.sm },
    footerEmail: { fontSize: FontSize.md, fontWeight: '600', marginTop: 4 },
});
