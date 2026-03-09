import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, FlatList, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { sendBroadcast, getAppStats, banUser, unbanUser } from '../services/admin';
import { searchUsers } from '../services/users';
import { getInitials, formatCount } from '../utils/helpers';

export default function AdminScreen() {
    const { user, isAdmin } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('broadcast');
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [stats, setStats] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!isAdmin) {
            Alert.alert('Access Denied', 'You do not have admin access.');
            router.back();
            return;
        }
        loadStats();
    }, []);

    const loadStats = async () => {
        const appStats = await getAppStats();
        setStats(appStats);
    };

    const handleBroadcast = async () => {
        if (!broadcastMessage.trim()) return;
        try {
            setSending(true);
            await sendBroadcast(user.uid, broadcastMessage.trim());
            Alert.alert('Broadcast Sent', 'Your message has been sent to all users!');
            setBroadcastMessage('');
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setSending(false);
        }
    };

    const handleSearch = async (text) => {
        setSearchQuery(text);
        if (text.length >= 2) {
            const results = await searchUsers(text);
            setSearchResults(results);
        } else {
            setSearchResults([]);
        }
    };

    const handleBan = async (userId) => {
        Alert.alert('Ban User', 'Are you sure you want to ban this user?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Ban', style: 'destructive', onPress: async () => {
                    await banUser(userId);
                    Alert.alert('Done', 'User has been banned');
                    handleSearch(searchQuery);
                }
            },
        ]);
    };

    return (
        <ScrollView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>🛡️ Admin Panel</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                {['broadcast', 'users', 'stats'].map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.tabActive]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Broadcast */}
            {activeTab === 'broadcast' && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📢 Send Broadcast</Text>
                    <Text style={styles.sectionDesc}>Send a message to all Banana Chat users</Text>
                    <TextInput
                        style={styles.broadcastInput}
                        placeholder="Type your broadcast message..."
                        placeholderTextColor={Colors.textTertiary}
                        value={broadcastMessage}
                        onChangeText={setBroadcastMessage}
                        multiline
                        maxLength={500}
                    />
                    <Text style={styles.charCount}>{broadcastMessage.length}/500</Text>
                    <TouchableOpacity
                        style={[styles.sendBtn, (!broadcastMessage.trim() || sending) && styles.sendBtnDisabled]}
                        onPress={handleBroadcast}
                        disabled={!broadcastMessage.trim() || sending}
                    >
                        <Ionicons name="megaphone" size={20} color={Colors.textInverse} />
                        <Text style={styles.sendBtnText}>{sending ? 'Sending...' : 'Send Broadcast'}</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* User Management */}
            {activeTab === 'users' && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>👥 User Management</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search users..."
                        placeholderTextColor={Colors.textTertiary}
                        value={searchQuery}
                        onChangeText={handleSearch}
                    />
                    {searchResults.map((u) => (
                        <View key={u.id} style={styles.userItem}>
                            {u.avatar ? (
                                <Image source={{ uri: u.avatar }} style={styles.userAvatar} />
                            ) : (
                                <View style={[styles.userAvatar, styles.avatarPlaceholder]}>
                                    <Text style={styles.avatarInitials}>{getInitials(u.displayName)}</Text>
                                </View>
                            )}
                            <View style={styles.userInfo}>
                                <Text style={styles.userName}>{u.displayName}</Text>
                                <Text style={styles.userUsername}>@{u.username}</Text>
                            </View>
                            <View style={styles.userActions}>
                                {u.isBanned ? (
                                    <TouchableOpacity style={styles.unbanBtn} onPress={() => unbanUser(u.id)}>
                                        <Text style={styles.unbanText}>Unban</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity style={styles.banBtn} onPress={() => handleBan(u.id)}>
                                        <Text style={styles.banText}>Ban</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Stats */}
            {activeTab === 'stats' && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📊 App Statistics</Text>
                    <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>{stats?.totalUsers || 0}</Text>
                            <Text style={styles.statLabel}>Total Users</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>{stats?.totalPosts || 0}</Text>
                            <Text style={styles.statLabel}>Total Posts</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>{stats?.totalChats || 0}</Text>
                            <Text style={styles.statLabel}>Active Chats</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>{stats?.totalStories || 0}</Text>
                            <Text style={styles.statLabel}>Stories Today</Text>
                        </View>
                    </View>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: 50, paddingBottom: Spacing.md,
        backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    headerTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.primary },
    tabs: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    tab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: Colors.primary },
    tabText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: '600' },
    tabTextActive: { color: Colors.primary },
    section: { margin: Spacing.lg, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 0.5, borderColor: Colors.border },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.xs },
    sectionDesc: { color: Colors.textSecondary, fontSize: FontSize.sm, marginBottom: Spacing.lg },
    broadcastInput: { backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.md, padding: Spacing.lg, color: Colors.text, fontSize: FontSize.md, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.border },
    charCount: { color: Colors.textTertiary, fontSize: FontSize.xs, textAlign: 'right', marginTop: Spacing.xs },
    sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, paddingVertical: Spacing.lg, marginTop: Spacing.md },
    sendBtnDisabled: { opacity: 0.6 },
    sendBtnText: { color: Colors.textInverse, fontSize: FontSize.md, fontWeight: '600' },
    searchInput: { backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, color: Colors.text, fontSize: FontSize.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
    userItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    userAvatar: { width: 44, height: 44, borderRadius: 22 },
    avatarPlaceholder: { backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    avatarInitials: { color: Colors.primary, fontWeight: 'bold' },
    userInfo: { flex: 1, marginLeft: Spacing.md },
    userName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
    userUsername: { color: Colors.textSecondary, fontSize: FontSize.sm },
    userActions: { flexDirection: 'row', gap: Spacing.sm },
    banBtn: { backgroundColor: 'rgba(255,61,113,0.1)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.error },
    banText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: '600' },
    unbanBtn: { backgroundColor: 'rgba(0,200,83,0.1)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.success },
    unbanText: { color: Colors.success, fontSize: FontSize.sm, fontWeight: '600' },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    statCard: { width: '47%', backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center' },
    statValue: { color: Colors.primary, fontSize: FontSize.xxxl, fontWeight: 'bold' },
    statLabel: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: Spacing.xs },
});
