import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const APP_VERSION = '3.2.0';

export default function AboutScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const infoItem = (icon, title, value) => (
        <View style={styles.infoItem}>
            <View style={styles.infoLeft}>
                <View style={styles.iconBox}>
                    <Ionicons name={icon} size={18} color={Colors.primary} />
                </View>
                <Text style={styles.infoTitle}>{title}</Text>
            </View>
            <Text style={styles.infoValue}>{value}</Text>
        </View>
    );

    return (
        <ScrollView style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>About</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* App Logo */}
            <View style={styles.logoSection}>
                <Text style={styles.logoEmoji}>🍌</Text>
                <Text style={styles.appName}>Banana Chat</Text>
                <Text style={styles.tagline}>Connect, Share, Go Bananas!</Text>
            </View>

            <View style={styles.section}>
                {infoItem('information-circle-outline', 'Version', APP_VERSION)}
                {infoItem('construct-outline', 'Build', 'Production')}
                {infoItem('logo-react', 'Framework', 'React Native + Expo')}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Legal</Text>
                <TouchableOpacity style={styles.linkItem} onPress={() => {
                    Linking.openURL('https://banana-chat.app/terms').catch(() => { });
                }}>
                    <View style={styles.infoLeft}>
                        <View style={styles.iconBox}>
                            <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
                        </View>
                        <Text style={styles.infoTitle}>Terms of Service</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.linkItem} onPress={() => {
                    Linking.openURL('https://banana-chat.app/privacy').catch(() => { });
                }}>
                    <View style={styles.infoLeft}>
                        <View style={styles.iconBox}>
                            <Ionicons name="shield-outline" size={18} color={Colors.primary} />
                        </View>
                        <Text style={styles.infoTitle}>Privacy Policy</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>Made with 💛 by the Banana Team</Text>
                <Text style={styles.copyright}>© 2026 Banana Chat. All rights reserved.</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    headerTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text },
    logoSection: { alignItems: 'center', paddingVertical: 40 },
    logoEmoji: { fontSize: 64 },
    appName: { fontSize: 28, fontWeight: 'bold', color: Colors.text, marginTop: 12 },
    tagline: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: 4 },
    section: {
        backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
        marginHorizontal: Spacing.md, marginBottom: Spacing.md,
        overflow: 'hidden', borderWidth: 0.5, borderColor: Colors.border,
    },
    sectionTitle: {
        color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '600',
        textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.lg, paddingBottom: Spacing.xs,
    },
    infoItem: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    linkItem: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    infoLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    iconBox: {
        width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.surfaceLight,
        justifyContent: 'center', alignItems: 'center',
    },
    infoTitle: { color: Colors.text, fontSize: FontSize.md },
    infoValue: { color: Colors.textSecondary, fontSize: FontSize.sm },
    footer: { alignItems: 'center', paddingVertical: 40 },
    footerText: { color: Colors.textSecondary, fontSize: FontSize.md },
    copyright: { color: Colors.textTertiary, fontSize: FontSize.xs, marginTop: 4 },
});
