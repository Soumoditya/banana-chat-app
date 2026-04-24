import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Image, RefreshControl, ActivityIndicator, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import {
    sendBroadcast, getAppStats, banUser, unbanUser,
    adminGrantPremium, adminRevokePremium, adminDeletePost,
    setUserVerified, adminGetUser, getUserPosts,
} from '../services/admin';
import { searchUsers, getPendingPremiumRequests, approvePremiumRequest, rejectPremiumRequest } from '../services/users';
import { getInitials, formatCount } from '../utils/helpers';
import { PREMIUM_PLANS } from '../utils/premium';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAppTheme from '../hooks/useAppTheme';
import PremiumBadge from '../components/PremiumBadge';

const TABS = [
    { key: 'premium', icon: 'diamond', label: 'Premium' },
    { key: 'users', icon: 'people', label: 'Users' },
    { key: 'reports', icon: 'flag', label: 'Reports' },
    { key: 'broadcast', icon: 'megaphone', label: 'Broadcast' },
    { key: 'stats', icon: 'stats-chart', label: 'Stats' },
    { key: 'logs', icon: 'time', label: 'Logs' },
];

export default function AdminScreen() {
    const { user, userProfile, isAdmin } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState('premium');
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [stats, setStats] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [sending, setSending] = useState(false);
    const [premiumRequests, setPremiumRequests] = useState([]);
    const [loadingPremium, setLoadingPremium] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [actionLoading, setActionLoading] = useState({});
    const [grantTarget, setGrantTarget] = useState(null); // { userId, username }
    const { C } = useAppTheme();
    const [reportedPosts, setReportedPosts] = useState([]);
    const [activityLogs, setActivityLogs] = useState([]);

    useEffect(() => {
        if (!isAdmin) {
            Alert.alert('Access Denied', 'You do not have admin access.');
            router.back();
            return;
        }
        loadPremiumRequests();
        loadStats();
    }, []);

    const loadStats = async () => {
        const appStats = await getAppStats();
        setStats(appStats);
    };

    const loadPremiumRequests = async () => {
        try {
            setLoadingPremium(true);
            const requests = await getPendingPremiumRequests();
            setPremiumRequests(requests);
        } catch (err) {
            console.error('Premium requests error:', err);
        } finally {
            setLoadingPremium(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([loadPremiumRequests(), loadStats()]);
        setRefreshing(false);
    }, []);

    // ─── Quick Actions (no confirmation dialogs for speed) ───

    const quickApprove = async (requestId, displayName) => {
        setActionLoading(prev => ({ ...prev, [requestId]: 'approving' }));
        try {
            await approvePremiumRequest(requestId, user.uid);
            setPremiumRequests(prev => prev.filter(r => r.id !== requestId));
            Alert.alert('✅ Done', `${displayName} is now premium!`);
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setActionLoading(prev => ({ ...prev, [requestId]: null }));
        }
    };

    const quickReject = async (requestId, displayName) => {
        setActionLoading(prev => ({ ...prev, [requestId]: 'rejecting' }));
        try {
            await rejectPremiumRequest(requestId, user.uid);
            setPremiumRequests(prev => prev.filter(r => r.id !== requestId));
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setActionLoading(prev => ({ ...prev, [requestId]: null }));
        }
    };

    const handleBroadcast = async () => {
        if (!broadcastMessage.trim()) return;
        try {
            setSending(true);
            await sendBroadcast(user.uid, broadcastMessage.trim());
            Alert.alert('✅ Sent', 'Broadcast sent to all users!');
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

    // ─── User Quick Actions ───

    const quickBan = async (userId, username) => {
        Alert.alert('Ban @' + username + '?', 'They won\'t be able to use the app.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Ban',
                style: 'destructive',
                onPress: async () => {
                    setActionLoading(prev => ({ ...prev, [userId]: 'banning' }));
                    await banUser(userId);
                    setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, isBanned: true } : u));
                    setActionLoading(prev => ({ ...prev, [userId]: null }));
                },
            },
        ]);
    };

    const quickUnban = async (userId) => {
        setActionLoading(prev => ({ ...prev, [userId]: 'unbanning' }));
        await unbanUser(userId);
        setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, isBanned: false } : u));
        setActionLoading(prev => ({ ...prev, [userId]: null }));
    };

    const quickVerify = async (userId) => {
        setActionLoading(prev => ({ ...prev, [`v_${userId}`]: true }));
        await setUserVerified(userId, true);
        setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, isVerified: true } : u));
        setActionLoading(prev => ({ ...prev, [`v_${userId}`]: null }));
    };

    const quickUnverify = async (userId) => {
        setActionLoading(prev => ({ ...prev, [`v_${userId}`]: true }));
        await setUserVerified(userId, false);
        setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, isVerified: false } : u));
        setActionLoading(prev => ({ ...prev, [`v_${userId}`]: null }));
    };

    const showGrantPremiumOptions = (userId, username) => {
        setGrantTarget({ userId, username });
    };

    const grantPremium = async (userId, planId) => {
        setActionLoading(prev => ({ ...prev, [`p_${userId}`]: true }));
        try {
            await adminGrantPremium(userId, planId, 30);
            setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, isPremium: true, premiumPlan: planId } : u));
            Alert.alert('✅ Done', `Premium ${planId} granted!`);
        } catch (err) {
            Alert.alert('Error', err.message);
        }
        setActionLoading(prev => ({ ...prev, [`p_${userId}`]: null }));
    };

    const quickRevokePremium = async (userId) => {
        setActionLoading(prev => ({ ...prev, [`p_${userId}`]: true }));
        try {
            await adminRevokePremium(userId);
            setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, isPremium: false, premiumPlan: null } : u));
        } catch (err) {
            Alert.alert('Error', err.message);
        }
        setActionLoading(prev => ({ ...prev, [`p_${userId}`]: null }));
    };

    // ─── Render ───

    const renderPremiumTab = () => (
        <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>👑 Pending Requests</Text>
                <TouchableOpacity onPress={loadPremiumRequests} style={styles.refreshBtn}>
                    <Ionicons name="refresh" size={20} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            {loadingPremium ? (
                <ActivityIndicator size="large" color={Colors.primary} style={{ padding: 40 }} />
            ) : premiumRequests.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="checkmark-done-circle" size={48} color={Colors.textTertiary} />
                    <Text style={styles.emptyText}>No pending requests</Text>
                    <Text style={styles.emptySubtext}>All caught up! 🎉</Text>
                </View>
            ) : (
                premiumRequests.map((req) => {
                    const plan = PREMIUM_PLANS[req.planId];
                    const loading = actionLoading[req.id];
                    const requestTime = req.requestedAt?.seconds
                        ? new Date(req.requestedAt.seconds * 1000).toLocaleString()
                        : 'Just now';

                    return (
                        <View key={req.id} style={[styles.requestCard, { borderLeftColor: plan?.badgeColor || Colors.primary }]}>
                            <View style={styles.requestHeader}>
                                {req.avatar ? (
                                    <Image source={{ uri: req.avatar }} style={styles.reqAvatar} />
                                ) : (
                                    <View style={[styles.reqAvatar, styles.avatarPlaceholder]}>
                                        <Text style={styles.avatarInitials}>{getInitials(req.displayName)}</Text>
                                    </View>
                                )}
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.reqName}>{req.displayName}</Text>
                                    <Text style={styles.reqUsername}>@{req.username}</Text>
                                </View>
                                <View style={[styles.planBadge, { backgroundColor: (plan?.badgeColor || Colors.primary) + '20' }]}>
                                    <Text style={[styles.planBadgeText, { color: plan?.badgeColor || Colors.primary }]}>
                                        {plan?.name || req.planId}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.requestDetails}>
                                <Text style={styles.detailText}>
                                    💰 ₹{req.amount} via {req.paymentMethod?.toUpperCase()}  •  🕐 {requestTime}
                                </Text>
                            </View>

                            {/* ONE-TAP ACTIONS */}
                            <View style={styles.requestActions}>
                                <TouchableOpacity
                                    style={styles.rejectBtn}
                                    onPress={() => quickReject(req.id, req.displayName)}
                                    disabled={!!loading}
                                >
                                    {loading === 'rejecting' ? (
                                        <ActivityIndicator size="small" color={Colors.error} />
                                    ) : (
                                        <>
                                            <Ionicons name="close" size={18} color={Colors.error} />
                                            <Text style={styles.rejectBtnText}>Reject</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.approveBtn}
                                    onPress={() => quickApprove(req.id, req.displayName)}
                                    disabled={!!loading}
                                >
                                    {loading === 'approving' ? (
                                        <ActivityIndicator size="small" color="#000" />
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark-circle" size={18} color="#000" />
                                            <Text style={styles.approveBtnText}>Approve</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })
            )}
        </View>
    );

    const renderUsersTab = () => (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>👥 User Management</Text>
            <Text style={styles.sectionDesc}>Search users • Ban/Unban • Verify • Grant/Revoke Premium</Text>
            <TextInput
                style={styles.searchInput}
                placeholder="Search by username or name..."
                placeholderTextColor={Colors.textTertiary}
                value={searchQuery}
                onChangeText={handleSearch}
            />
            {searchResults.map((u) => (
                <View key={u.id} style={styles.userCard}>
                    {/* User Info Row */}
                    <View style={styles.userInfoRow}>
                        {u.avatar ? (
                            <Image source={{ uri: u.avatar }} style={styles.userAvatar} />
                        ) : (
                            <View style={[styles.userAvatar, styles.avatarPlaceholder]}>
                                <Text style={styles.avatarInitials}>{getInitials(u.displayName)}</Text>
                            </View>
                        )}
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Text style={styles.userName}>{u.displayName}</Text>
                                {u.isVerified && <Ionicons name="checkmark-circle" size={14} color="#1DA1F2" />}
                                {u.isPremium && <Ionicons name="diamond" size={14} color="#A855F7" />}
                                {u.isBanned && <Text style={styles.bannedTag}>BANNED</Text>}
                                {u.isAdmin && <Text style={styles.adminTag}>ADMIN</Text>}
                            </View>
                            <Text style={styles.userUsername}>@{u.username}</Text>
                            {u.isPremium && (
                                <Text style={styles.userPlanText}>
                                    Plan: {PREMIUM_PLANS[u.premiumPlan]?.name || u.premiumPlan || 'Unknown'}
                                </Text>
                            )}
                        </View>
                        <TouchableOpacity
                            style={styles.viewProfileBtn}
                            onPress={() => router.push(`/user/${u.id}`)}
                        >
                            <Ionicons name="eye-outline" size={16} color={Colors.primary} />
                        </TouchableOpacity>
                    </View>

                    {/* Quick Action Buttons */}
                    <View style={styles.userActionsGrid}>
                        {/* Ban / Unban */}
                        {u.isBanned ? (
                            <TouchableOpacity
                                style={[styles.actionChip, styles.chipSuccess]}
                                onPress={() => quickUnban(u.id)}
                                disabled={!!actionLoading[u.id]}
                            >
                                <Ionicons name="checkmark-circle-outline" size={14} color={Colors.success} />
                                <Text style={[styles.chipText, { color: Colors.success }]}>Unban</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[styles.actionChip, styles.chipDanger]}
                                onPress={() => quickBan(u.id, u.username)}
                                disabled={!!actionLoading[u.id]}
                            >
                                <Ionicons name="ban-outline" size={14} color={Colors.error} />
                                <Text style={[styles.chipText, { color: Colors.error }]}>Ban</Text>
                            </TouchableOpacity>
                        )}

                        {/* Verify / Unverify */}
                        {u.isVerified ? (
                            <TouchableOpacity
                                style={[styles.actionChip, styles.chipWarning]}
                                onPress={() => quickUnverify(u.id)}
                                disabled={!!actionLoading[`v_${u.id}`]}
                            >
                                <Ionicons name="close-circle-outline" size={14} color="#F59E0B" />
                                <Text style={[styles.chipText, { color: '#F59E0B' }]}>Unverify</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[styles.actionChip, styles.chipInfo]}
                                onPress={() => quickVerify(u.id)}
                                disabled={!!actionLoading[`v_${u.id}`]}
                            >
                                <Ionicons name="checkmark-circle" size={14} color="#1DA1F2" />
                                <Text style={[styles.chipText, { color: '#1DA1F2' }]}>Verify</Text>
                            </TouchableOpacity>
                        )}

                        {/* Premium Grant / Revoke / Change */}
                        {u.isPremium ? (
                            <>
                                <TouchableOpacity
                                    style={[styles.actionChip, styles.chipPremium]}
                                    onPress={() => showGrantPremiumOptions(u.id, u.username)}
                                    disabled={!!actionLoading[`p_${u.id}`]}
                                >
                                    <Ionicons name="swap-horizontal" size={14} color="#A855F7" />
                                    <Text style={[styles.chipText, { color: '#A855F7' }]}>Change Plan</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionChip, styles.chipDanger]}
                                    onPress={() => quickRevokePremium(u.id)}
                                    disabled={!!actionLoading[`p_${u.id}`]}
                                >
                                    <Ionicons name="diamond-outline" size={14} color={Colors.error} />
                                    <Text style={[styles.chipText, { color: Colors.error }]}>Revoke</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <TouchableOpacity
                                style={[styles.actionChip, styles.chipPremium]}
                                onPress={() => showGrantPremiumOptions(u.id, u.username)}
                                disabled={!!actionLoading[`p_${u.id}`]}
                            >
                                <Ionicons name="diamond" size={14} color="#A855F7" />
                                <Text style={[styles.chipText, { color: '#A855F7' }]}>Grant</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            ))}
            {searchQuery.length >= 2 && searchResults.length === 0 && (
                <Text style={styles.emptyText}>No users found</Text>
            )}
        </View>
    );

    const renderBroadcastTab = () => (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>📢 Broadcast Message</Text>
            <Text style={styles.sectionDesc}>Send a message to all Banana Chat users instantly</Text>
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
                <Ionicons name="megaphone" size={20} color="#000" />
                <Text style={styles.sendBtnText}>{sending ? 'Sending...' : 'Send Broadcast'}</Text>
            </TouchableOpacity>
        </View>
    );

    const renderStatsTab = () => (
        <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>📊 App Statistics</Text>
                <TouchableOpacity onPress={loadStats} style={styles.refreshBtn}>
                    <Ionicons name="refresh" size={20} color={Colors.primary} />
                </TouchableOpacity>
            </View>
            <View style={styles.statsGrid}>
                {[
                    { value: stats?.totalUsers || 0, label: 'Users', icon: 'people', color: '#3B82F6' },
                    { value: stats?.totalPosts || 0, label: 'Posts', icon: 'document-text', color: '#10B981' },
                    { value: stats?.totalChats || 0, label: 'Chats', icon: 'chatbubbles', color: '#F59E0B' },
                    { value: stats?.premiumUsers || 0, label: 'Premium', icon: 'diamond', color: '#A855F7' },
                    { value: stats?.bannedUsers || 0, label: 'Banned', icon: 'ban', color: '#EF4444' },
                ].map((item, idx) => (
                    <View key={idx} style={styles.statCard}>
                        <Ionicons name={item.icon} size={24} color={item.color} />
                        <Text style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
                        <Text style={styles.statLabel}>{item.label}</Text>
                    </View>
                ))}
            </View>
        </View>
    );

    const renderLogsTab = () => (
        <View style={[styles.section, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: C.text }]}>📋 Activity Logs</Text>
            </View>
            <Text style={[styles.sectionDesc, { color: C.textSecondary }]}>Recent admin actions and system events</Text>

            {activityLogs.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="document-text-outline" size={48} color={C.textTertiary || Colors.textTertiary} />
                    <Text style={[styles.emptyText, { color: C.textTertiary }]}>No activity logs yet</Text>
                    <Text style={[styles.emptySubtext, { color: C.textTertiary }]}>Actions will appear here as you moderate</Text>
                </View>
            ) : (
                activityLogs.map((log, idx) => (
                    <View key={idx} style={[styles.userCard, { backgroundColor: C.surfaceLight }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name={log.icon || 'time-outline'} size={16} color={C.primary} />
                            <Text style={{ color: C.text, fontWeight: '600', flex: 1 }}>{log.action}</Text>
                            <Text style={{ color: C.textTertiary, fontSize: 11 }}>{log.time}</Text>
                        </View>
                        <Text style={{ color: C.textSecondary, fontSize: 12, marginTop: 4 }}>{log.details}</Text>
                    </View>
                ))
            )}

            {/* Log Categories */}
            <View style={{ marginTop: Spacing.lg, gap: 8 }}>
                <Text style={[styles.sectionTitle, { color: C.text, fontSize: FontSize.md }]}>📊 Log Categories</Text>
                {[
                    { icon: 'person-add', label: 'User Actions', desc: 'Bans, verifications, profile changes', color: '#3B82F6' },
                    { icon: 'diamond', label: 'Premium Actions', desc: 'Grants, revocations, plan changes', color: '#A855F7' },
                    { icon: 'megaphone', label: 'Broadcast History', desc: 'All sent broadcast messages', color: '#F59E0B' },
                    { icon: 'flag', label: 'Moderation Actions', desc: 'Post removals, warnings issued', color: Colors.error },
                    { icon: 'key', label: 'Security Events', desc: 'Login attempts, password resets', color: Colors.success },
                ].map((cat, idx) => (
                    <TouchableOpacity key={idx} style={[styles.userCard, { backgroundColor: C.surfaceLight, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: cat.color + '20', justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name={cat.icon} size={18} color={cat.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: C.text, fontWeight: '600' }}>{cat.label}</Text>
                            <Text style={{ color: C.textSecondary, fontSize: 12 }}>{cat.desc}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={C.textTertiary || Colors.textTertiary} />
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    const renderReportsTab = () => (
        <View style={[styles.section, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: C.text }]}>🚩 Reported Content</Text>
            </View>
            <Text style={[styles.sectionDesc, { color: C.textSecondary }]}>Review and moderate reported posts, comments, and users</Text>

            {reportedPosts.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="shield-checkmark" size={48} color={C.textTertiary || Colors.textTertiary} />
                    <Text style={[styles.emptyText, { color: C.textTertiary }]}>No reported content</Text>
                    <Text style={[styles.emptySubtext, { color: C.textTertiary }]}>All clear! 🎉</Text>
                </View>
            ) : (
                reportedPosts.map((report, idx) => (
                    <View key={idx} style={[styles.userCard, { backgroundColor: C.surfaceLight, borderLeftWidth: 3, borderLeftColor: Colors.error }]}>
                        <Text style={{ color: C.text, fontWeight: '600' }}>{report.reason || 'Reported'}</Text>
                        <Text style={{ color: C.textSecondary, fontSize: 12 }}>Post ID: {report.postId}</Text>
                        <View style={[styles.userActionsGrid, { marginTop: 8 }]}>
                            <TouchableOpacity style={[styles.actionChip, styles.chipDanger]}>
                                <Ionicons name="trash-outline" size={14} color={Colors.error} />
                                <Text style={[styles.chipText, { color: Colors.error }]}>Remove</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionChip, styles.chipSuccess]}>
                                <Ionicons name="checkmark-outline" size={14} color={Colors.success} />
                                <Text style={[styles.chipText, { color: Colors.success }]}>Dismiss</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ))
            )}

            {/* Quick Actions */}
            <View style={{ marginTop: Spacing.lg, gap: 8 }}>
                <Text style={[styles.sectionTitle, { color: C.text, fontSize: FontSize.md }]}>🔧 Moderation Tools</Text>
                <TouchableOpacity style={[styles.userCard, { backgroundColor: C.surfaceLight, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                    <Ionicons name="eye-off-outline" size={22} color="#F59E0B" />
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontWeight: '600' }}>Content Filter Settings</Text>
                        <Text style={{ color: C.textSecondary, fontSize: 12 }}>Configure auto-moderation rules</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={C.textTertiary || Colors.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.userCard, { backgroundColor: C.surfaceLight, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                    <Ionicons name="analytics-outline" size={22} color="#3B82F6" />
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontWeight: '600' }}>Moderation Analytics</Text>
                        <Text style={{ color: C.textSecondary, fontSize: 12 }}>View moderation action history</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={C.textTertiary || Colors.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.userCard, { backgroundColor: C.surfaceLight, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                    <Ionicons name="warning-outline" size={22} color={Colors.error} />
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontWeight: '600' }}>Spam Detection</Text>
                        <Text style={{ color: C.textSecondary, fontSize: 12 }}>Review flagged spam accounts & content</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={C.textTertiary || Colors.textTertiary} />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
    <>
        <ScrollView
            style={[styles.container, { paddingTop: insets.top, backgroundColor: C.background }]}
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
            }
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>🛡️ Admin Panel</Text>
                    <Text style={styles.headerSubtitle}>@{userProfile?.username}</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* Premium notification banner */}
            {premiumRequests.length > 0 && activeTab !== 'premium' && (
                <TouchableOpacity
                    style={styles.notificationBanner}
                    onPress={() => setActiveTab('premium')}
                >
                    <Ionicons name="diamond" size={18} color="#000" />
                    <Text style={styles.notificationText}>
                        {premiumRequests.length} pending premium request{premiumRequests.length > 1 ? 's' : ''}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#000" />
                </TouchableOpacity>
            )}

            {/* Tabs */}
            <View style={styles.tabs}>
                {TABS.map((tab) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                        onPress={() => setActiveTab(tab.key)}
                    >
                        <Ionicons
                            name={tab.icon}
                            size={18}
                            color={activeTab === tab.key ? Colors.primary : Colors.textTertiary}
                        />
                        <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                            {tab.label}
                        </Text>
                        {tab.key === 'premium' && premiumRequests.length > 0 && (
                            <View style={styles.tabBadge}>
                                <Text style={styles.tabBadgeText}>{premiumRequests.length}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </View>

            {/* Tab Content */}
            {activeTab === 'premium' && renderPremiumTab()}
            {activeTab === 'users' && renderUsersTab()}
            {activeTab === 'reports' && renderReportsTab()}
            {activeTab === 'broadcast' && renderBroadcastTab()}
            {activeTab === 'stats' && renderStatsTab()}
            {activeTab === 'logs' && renderLogsTab()}
        </ScrollView>

        {/* Plan Picker Modal */}
        <Modal visible={!!grantTarget} transparent animationType="fade" onRequestClose={() => setGrantTarget(null)}>
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setGrantTarget(null)}>
                <View style={[styles.planPickerModal, { backgroundColor: C.surface }]}>
                    <Text style={[styles.planPickerTitle, { color: C.text }]}>
                        Grant Premium to @{grantTarget?.username}
                    </Text>
                    <Text style={{ color: C.textSecondary, fontSize: 13, marginBottom: 12 }}>Select a plan (30 days):</Text>
                    {Object.entries(PREMIUM_PLANS).map(([planId, plan]) => (
                        <TouchableOpacity
                            key={planId}
                            style={[styles.planPickerCard, { borderColor: plan.badgeColor + '40' }]}
                            onPress={() => {
                                const target = grantTarget;
                                setGrantTarget(null);
                                grantPremium(target.userId, planId);
                            }}
                        >
                            <View style={[styles.planPickerDot, { backgroundColor: plan.badgeColor }]} />
                            <Text style={[styles.planPickerName, { color: C.text }]}>{plan.name}</Text>
                            <Text style={{ color: C.textSecondary, fontSize: 12 }}>₹{plan.price}</Text>
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={styles.planPickerCancel} onPress={() => setGrantTarget(null)}>
                        <Text style={{ color: Colors.error, fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    </>
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
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.primary },
    headerSubtitle: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },

    // Notification banner
    notificationBanner: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: '#FFD700', paddingVertical: 10, paddingHorizontal: Spacing.lg,
    },
    notificationText: { color: '#000', fontWeight: '700', fontSize: FontSize.sm },

    // Tabs
    tabs: {
        flexDirection: 'row', backgroundColor: Colors.surface,
        borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    tab: {
        flex: 1, alignItems: 'center', paddingVertical: 12, gap: 2,
        borderBottomWidth: 2, borderBottomColor: 'transparent', position: 'relative',
    },
    tabActive: { borderBottomColor: Colors.primary },
    tabText: { color: Colors.textTertiary, fontSize: 11, fontWeight: '600' },
    tabTextActive: { color: Colors.primary },
    tabBadge: {
        position: 'absolute', top: 4, right: '15%',
        backgroundColor: Colors.error, borderRadius: 8,
        minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center',
    },
    tabBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },

    // Section
    section: {
        margin: Spacing.md, backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg, padding: Spacing.lg,
        borderWidth: 0.5, borderColor: Colors.border,
    },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    refreshBtn: { padding: 8, borderRadius: 20, backgroundColor: Colors.surfaceLight },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.xs },
    sectionDesc: { color: Colors.textSecondary, fontSize: FontSize.xs, marginBottom: Spacing.lg },

    // Premium request cards
    requestCard: {
        backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg,
        padding: Spacing.lg, marginBottom: Spacing.md,
        borderLeftWidth: 4,
    },
    requestHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    reqAvatar: { width: 44, height: 44, borderRadius: 22 },
    reqName: { color: Colors.text, fontWeight: '700', fontSize: FontSize.md },
    reqUsername: { color: Colors.textTertiary, fontSize: FontSize.sm },
    planBadge: {
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full,
    },
    planBadgeText: { fontSize: FontSize.xs, fontWeight: '700' },
    requestDetails: { marginTop: Spacing.sm },
    detailText: { color: Colors.textSecondary, fontSize: FontSize.xs },
    requestActions: {
        flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md,
        justifyContent: 'flex-end',
    },
    rejectBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.full,
        backgroundColor: 'rgba(255,61,113,0.1)', borderWidth: 1, borderColor: Colors.error,
        minWidth: 90, justifyContent: 'center',
    },
    rejectBtnText: { color: Colors.error, fontWeight: '600', fontSize: FontSize.sm },
    approveBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 20, paddingVertical: 10, borderRadius: BorderRadius.full,
        backgroundColor: '#FFD700', minWidth: 100, justifyContent: 'center',
    },
    approveBtnText: { color: '#000', fontWeight: '700', fontSize: FontSize.sm },

    // Empty state
    emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
    emptyText: { color: Colors.textTertiary, fontSize: FontSize.md, textAlign: 'center', padding: Spacing.lg },
    emptySubtext: { color: Colors.textTertiary, fontSize: FontSize.sm },

    // User Management
    searchInput: {
        backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        color: Colors.text, fontSize: FontSize.md,
        borderWidth: 1, borderColor: Colors.border,
    },
    userCard: {
        backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg,
        padding: Spacing.md, marginTop: Spacing.md,
    },
    userInfoRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    },
    userAvatar: { width: 44, height: 44, borderRadius: 22 },
    avatarPlaceholder: { backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
    avatarInitials: { color: Colors.primary, fontWeight: 'bold', fontSize: FontSize.md },
    userName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
    userUsername: { color: Colors.textTertiary, fontSize: FontSize.sm },
    userPlanText: { color: '#A855F7', fontSize: 11, fontWeight: '600', marginTop: 2 },
    bannedTag: {
        fontSize: 9, fontWeight: '800', color: '#fff',
        backgroundColor: Colors.error, paddingHorizontal: 6, paddingVertical: 2,
        borderRadius: 4, overflow: 'hidden',
    },
    adminTag: {
        fontSize: 9, fontWeight: '800', color: '#000',
        backgroundColor: '#FFD700', paddingHorizontal: 6, paddingVertical: 2,
        borderRadius: 4, overflow: 'hidden',
    },
    viewProfileBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center',
    },

    // Action chips
    userActionsGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.md,
    },
    actionChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full,
        borderWidth: 1,
    },
    chipText: { fontSize: 12, fontWeight: '600' },
    chipDanger: { borderColor: Colors.error, backgroundColor: 'rgba(239,68,68,0.08)' },
    chipSuccess: { borderColor: Colors.success, backgroundColor: 'rgba(16,185,129,0.08)' },
    chipWarning: { borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.08)' },
    chipInfo: { borderColor: '#1DA1F2', backgroundColor: 'rgba(29,161,242,0.08)' },
    chipPremium: { borderColor: '#A855F7', backgroundColor: 'rgba(168,85,247,0.08)' },

    // Broadcast
    broadcastInput: {
        backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg,
        padding: Spacing.lg, color: Colors.text, fontSize: FontSize.md,
        minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.border,
    },
    charCount: { color: Colors.textTertiary, fontSize: FontSize.xs, textAlign: 'right', marginTop: 4 },
    sendBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        backgroundColor: '#FFD700', borderRadius: BorderRadius.lg, paddingVertical: Spacing.lg, marginTop: Spacing.md,
    },
    sendBtnDisabled: { opacity: 0.5 },
    sendBtnText: { color: '#000', fontSize: FontSize.md, fontWeight: '700' },

    // Stats
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.md },
    statCard: {
        width: '30%', backgroundColor: Colors.surfaceLight,
        borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', gap: 4,
    },
    statValue: { fontSize: FontSize.xxl, fontWeight: 'bold' },
    statLabel: { color: Colors.textSecondary, fontSize: 11 },
    // Plan Picker Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
    planPickerModal: {
        width: '85%', borderRadius: BorderRadius.xl, padding: Spacing.lg,
        maxHeight: '80%',
    },
    planPickerTitle: { fontSize: FontSize.lg, fontWeight: '700', marginBottom: 4 },
    planPickerCard: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingVertical: 12, paddingHorizontal: 14,
        borderWidth: 1.5, borderRadius: BorderRadius.md,
        marginBottom: 8,
    },
    planPickerDot: { width: 12, height: 12, borderRadius: 6 },
    planPickerName: { flex: 1, fontSize: FontSize.md, fontWeight: '600' },
    planPickerCancel: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
});
