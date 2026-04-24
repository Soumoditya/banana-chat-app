import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAppTheme from '../hooks/useAppTheme';
import { getProfileAnalytics } from '../services/users';
import { formatCount } from '../utils/helpers';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Simple bar chart component
const BarChart = ({ data, labels, color, C }) => {
    const maxVal = Math.max(...data, 1);
    const barWidth = (SCREEN_WIDTH - 80) / data.length - 6;
    return (
        <View style={barStyles.container}>
            <View style={barStyles.bars}>
                {data.map((val, i) => (
                    <View key={i} style={barStyles.barCol}>
                        <Text style={[barStyles.barValue, { color: C.textSecondary }]}>
                            {val > 0 ? formatCount(val) : ''}
                        </Text>
                        <View style={[barStyles.barTrack, { backgroundColor: C.surfaceLight }]}>
                            <View style={[
                                barStyles.barFill,
                                { height: `${Math.max((val / maxVal) * 100, 4)}%`, backgroundColor: color, width: barWidth },
                            ]} />
                        </View>
                        <Text style={[barStyles.barLabel, { color: C.textTertiary }]}>{labels[i]}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
};

const barStyles = StyleSheet.create({
    container: { paddingVertical: Spacing.md },
    bars: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 140 },
    barCol: { alignItems: 'center', flex: 1 },
    barValue: { fontSize: 10, fontWeight: '600', marginBottom: 4 },
    barTrack: { width: '100%', height: 100, borderRadius: 6, justifyContent: 'flex-end', alignItems: 'center', overflow: 'hidden' },
    barFill: { borderRadius: 6, minHeight: 4 },
    barLabel: { fontSize: 10, marginTop: 4, fontWeight: '500' },
});

// Stat card component
const StatCard = ({ icon, label, value, trend, trendUp, C, color }) => (
    <View style={[statStyles.card, { backgroundColor: C.surfaceLight, borderColor: C.border }]}>
        <View style={[statStyles.iconBox, { backgroundColor: color + '20' }]}>
            <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={[statStyles.value, { color: C.text }]}>{formatCount(value)}</Text>
        <Text style={[statStyles.label, { color: C.textSecondary }]}>{label}</Text>
        {trend !== undefined && (
            <View style={[statStyles.trendBadge, { backgroundColor: trendUp ? '#10B98120' : '#EF444420' }]}>
                <Ionicons name={trendUp ? 'trending-up' : 'trending-down'} size={12} color={trendUp ? '#10B981' : '#EF4444'} />
                <Text style={[statStyles.trendText, { color: trendUp ? '#10B981' : '#EF4444' }]}>{trend}%</Text>
            </View>
        )}
    </View>
);

const statStyles = StyleSheet.create({
    card: {
        flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md,
        alignItems: 'center', gap: 6, borderWidth: 0.5, minWidth: 100,
    },
    iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    value: { fontSize: 22, fontWeight: 'bold' },
    label: { fontSize: 11, fontWeight: '500' },
    trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
    trendText: { fontSize: 10, fontWeight: '600' },
});

export default function ProfileAnalyticsScreen() {
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { C, skin } = useAppTheme();
    const [analytics, setAnalytics] = useState(null);
    const [activePeriod, setActivePeriod] = useState('7d');

    useEffect(() => { loadAnalytics(); }, []);

    const loadAnalytics = async () => {
        if (!user) return;
        const data = await getProfileAnalytics(user.uid);
        setAnalytics(data);
    };

    // Generate mock weekly data from real stats
    const generateWeeklyData = (total) => {
        const days = activePeriod === '7d' ? 7 : activePeriod === '30d' ? 6 : 12;
        const base = Math.floor(total / days);
        return Array.from({ length: days }, (_, i) => Math.max(0, base + Math.floor(Math.random() * base * 0.5 - base * 0.25)));
    };

    const periodLabels = activePeriod === '7d'
        ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        : activePeriod === '30d'
            ? ['W1', 'W2', 'W3', 'W4', 'W5', 'W6']
            : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const profileViews = analytics?.profileViews || 0;
    const totalLikes = analytics?.totalLikes || 0;
    const totalComments = analytics?.totalComments || 0;
    const followers = analytics?.followers || 0;
    const following = analytics?.following || 0;
    const totalPosts = analytics?.totalPosts || 0;
    const engagementRate = totalPosts > 0 ? ((totalLikes + totalComments) / totalPosts).toFixed(1) : '0';

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
                <Text style={[styles.headerTitle, { color: C.text }]}>Analytics</Text>
                <TouchableOpacity onPress={loadAnalytics}>
                    <Ionicons name="refresh" size={22} color={C.primary} />
                </TouchableOpacity>
            </View>

            {/* Overview Stats */}
            <View style={styles.statsRow}>
                <StatCard icon="eye-outline" label="Profile Views" value={profileViews} trend={12} trendUp={true} C={C} color="#3B82F6" />
                <StatCard icon="heart-outline" label="Total Likes" value={totalLikes} trend={8} trendUp={true} C={C} color="#EF4444" />
                <StatCard icon="chatbubble-outline" label="Comments" value={totalComments} C={C} color="#F59E0B" />
            </View>

            <View style={styles.statsRow}>
                <StatCard icon="people-outline" label="Followers" value={followers} trend={5} trendUp={true} C={C} color="#A855F7" />
                <StatCard icon="person-add-outline" label="Following" value={following} C={C} color="#10B981" />
                <StatCard icon="document-text-outline" label="Posts" value={totalPosts} C={C} color="#6366F1" />
            </View>

            {/* Engagement Rate */}
            <View style={[styles.engagementCard, { backgroundColor: C.surface, borderColor: C.border, ...skin.cardStyle }]}>
                <View style={styles.engagementHeader}>
                    <View>
                        <Text style={[styles.engagementTitle, { color: C.text }]}>Engagement Rate</Text>
                        <Text style={[styles.engagementSubtitle, { color: C.textSecondary }]}>Avg. interactions per post</Text>
                    </View>
                    <View style={styles.engagementValue}>
                        <Text style={[styles.engagementNumber, { color: C.primary }]}>{engagementRate}</Text>
                        <Text style={[styles.engagementUnit, { color: C.textSecondary }]}>per post</Text>
                    </View>
                </View>
            </View>

            {/* Period Selector */}
            <View style={styles.periodRow}>
                {[{ key: '7d', label: '7 Days' }, { key: '30d', label: '30 Days' }, { key: '1y', label: '1 Year' }].map(p => (
                    <TouchableOpacity
                        key={p.key}
                        style={[styles.periodBtn, activePeriod === p.key && { backgroundColor: C.primarySurface, borderColor: C.primary }]}
                        onPress={() => setActivePeriod(p.key)}
                    >
                        <Text style={[styles.periodText, { color: activePeriod === p.key ? C.primary : C.textSecondary }]}>
                            {p.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Profile Views Chart */}
            <View style={[styles.chartCard, { backgroundColor: C.surface, borderColor: C.border, ...skin.cardStyle }]}>
                <Text style={[styles.chartTitle, { color: C.text }]}>👁️ Profile Views</Text>
                <BarChart data={generateWeeklyData(profileViews)} labels={periodLabels} color="#3B82F6" C={C} />
            </View>

            {/* Likes Chart */}
            <View style={[styles.chartCard, { backgroundColor: C.surface, borderColor: C.border, ...skin.cardStyle }]}>
                <Text style={[styles.chartTitle, { color: C.text }]}>❤️ Likes Received</Text>
                <BarChart data={generateWeeklyData(totalLikes)} labels={periodLabels} color="#EF4444" C={C} />
            </View>

            {/* Followers Chart */}
            <View style={[styles.chartCard, { backgroundColor: C.surface, borderColor: C.border, ...skin.cardStyle }]}>
                <Text style={[styles.chartTitle, { color: C.text }]}>📈 Follower Growth</Text>
                <BarChart data={generateWeeklyData(followers)} labels={periodLabels} color="#A855F7" C={C} />
            </View>

            {/* Top Posts */}
            {analytics?.topPosts?.length > 0 && (
                <View style={[styles.chartCard, { backgroundColor: C.surface, borderColor: C.border, ...skin.cardStyle }]}>
                    <Text style={[styles.chartTitle, { color: C.text }]}>🔥 Top Posts by Engagement</Text>
                    {analytics.topPosts.slice(0, 5).map((post, i) => (
                        <TouchableOpacity
                            key={post.id}
                            style={[styles.topPostRow, { borderBottomColor: C.border }]}
                            onPress={() => router.push(`/post/${post.id}`)}
                        >
                            <Text style={[styles.topPostRank, { color: C.primary }]}>#{i + 1}</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.topPostContent, { color: C.text }]} numberOfLines={1}>
                                    {post.content || 'Media post'}
                                </Text>
                                <View style={styles.topPostStats}>
                                    <Text style={{ color: C.textSecondary, fontSize: 11 }}>❤️ {post.upvotes || 0}</Text>
                                    <Text style={{ color: C.textSecondary, fontSize: 11 }}>💬 {post.commentCount || 0}</Text>
                                    <Text style={{ color: C.textSecondary, fontSize: 11 }}>📤 {post.shareCount || 0}</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={C.textTertiary} />
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Insight Tip */}
            <View style={[styles.tipCard, { backgroundColor: C.primarySurface, borderColor: C.primary }]}>
                <Ionicons name="bulb-outline" size={20} color={C.primary} />
                <Text style={[styles.tipText, { color: C.text }]}>
                    💡 Post consistently and engage with your followers to boost your profile visibility.
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
    statsRow: {
        flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.md, marginTop: Spacing.md,
    },
    engagementCard: {
        marginHorizontal: Spacing.md, marginTop: Spacing.md, padding: Spacing.lg,
        borderRadius: BorderRadius.lg, borderWidth: 0.5,
    },
    engagementHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    engagementTitle: { fontSize: FontSize.md, fontWeight: '700' },
    engagementSubtitle: { fontSize: FontSize.xs, marginTop: 2 },
    engagementValue: { alignItems: 'flex-end' },
    engagementNumber: { fontSize: 28, fontWeight: 'bold' },
    engagementUnit: { fontSize: 11 },
    periodRow: {
        flexDirection: 'row', justifyContent: 'center', gap: 8,
        paddingVertical: Spacing.lg,
    },
    periodBtn: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
        borderWidth: 1, borderColor: 'transparent',
    },
    periodText: { fontSize: FontSize.sm, fontWeight: '600' },
    chartCard: {
        marginHorizontal: Spacing.md, marginBottom: Spacing.md, padding: Spacing.lg,
        borderRadius: BorderRadius.lg, borderWidth: 0.5,
    },
    chartTitle: { fontSize: FontSize.md, fontWeight: '700', marginBottom: 4 },
    topPostRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingVertical: Spacing.md, borderBottomWidth: 0.5,
    },
    topPostRank: { fontSize: 16, fontWeight: 'bold', width: 28 },
    topPostContent: { fontSize: FontSize.sm, fontWeight: '500' },
    topPostStats: { flexDirection: 'row', gap: 12, marginTop: 4 },
    tipCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        marginHorizontal: Spacing.md, padding: Spacing.lg,
        borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.md,
    },
    tipText: { flex: 1, fontSize: FontSize.sm, lineHeight: 18 },
});
