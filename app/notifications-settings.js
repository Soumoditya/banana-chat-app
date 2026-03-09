import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { updateUserProfile } from '../services/users';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function NotificationsSettingsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user, userProfile, refreshProfile } = useAuth();

    const [settings, setSettings] = useState({
        messages: userProfile?.settings?.notifications !== false,
        likes: userProfile?.settings?.notifyLikes !== false,
        comments: userProfile?.settings?.notifyComments !== false,
        followers: userProfile?.settings?.notifyFollowers !== false,
        stories: userProfile?.settings?.notifyStories !== false,
    });

    const toggleSetting = async (key) => {
        const updated = { ...settings, [key]: !settings[key] };
        setSettings(updated);

        try {
            // Save to user profile in Firestore
            const settingsUpdate = {
                [`settings.notify${key.charAt(0).toUpperCase() + key.slice(1)}`]: updated[key],
            };
            if (key === 'messages') {
                settingsUpdate['settings.notifications'] = updated[key];
            }
            await updateUserProfile(user.uid, settingsUpdate);

            // Also save locally for quick access
            await AsyncStorage.setItem('notification_settings', JSON.stringify(updated));
        } catch (err) {
            // Revert on error
            setSettings(settings);
            Alert.alert('Error', 'Failed to update notification setting');
        }
    };

    const renderToggle = (icon, title, key) => (
        <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                    <Ionicons name={icon} size={18} color={Colors.primary} />
                </View>
                <Text style={styles.settingText}>{title}</Text>
            </View>
            <Switch
                value={settings[key]}
                onValueChange={() => toggleSetting(key)}
                trackColor={{ false: Colors.surfaceLight, true: Colors.primarySurface }}
                thumbColor={settings[key] ? Colors.primary : Colors.textTertiary}
            />
        </View>
    );

    return (
        <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Push Notifications</Text>
                {renderToggle('chatbubble-outline', 'Messages', 'messages')}
                {renderToggle('heart-outline', 'Likes', 'likes')}
                {renderToggle('chatbox-outline', 'Comments', 'comments')}
                {renderToggle('person-add-outline', 'New Followers', 'followers')}
                {renderToggle('albums-outline', 'Stories', 'stories')}
            </View>

            <View style={styles.note}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.textTertiary} />
                <Text style={styles.noteText}>
                    Changes are saved to your account and synced across devices.
                </Text>
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
    section: {
        marginTop: Spacing.lg, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
        marginHorizontal: Spacing.md, overflow: 'hidden', borderWidth: 0.5, borderColor: Colors.border,
    },
    sectionTitle: {
        color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '600',
        textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.lg, paddingBottom: Spacing.xs,
    },
    settingItem: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    settingLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    iconContainer: {
        width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.surfaceLight,
        justifyContent: 'center', alignItems: 'center',
    },
    settingText: { color: Colors.text, fontSize: FontSize.md },
    note: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        marginHorizontal: Spacing.lg, marginTop: Spacing.lg,
    },
    noteText: { color: Colors.textTertiary, fontSize: FontSize.xs, flex: 1 },
});
