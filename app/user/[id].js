import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { getUserProfile, followUser, unfollowUser, addFriend, blockUser } from '../../services/users';
import { getUserPosts } from '../../services/posts';
import { getOrCreateDMChat } from '../../services/chat';
import { getStreak } from '../../services/streaks';
import { getInitials, formatCount } from '../../utils/helpers';
import { getStreakEmoji } from '../../utils/constants';
import ImageViewer from '../../components/ImageViewer';

export default function UserProfileScreen() {
    const { id: userId } = useLocalSearchParams();
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const [profile, setProfile] = useState(null);
    const [posts, setPosts] = useState([]);
    const [streak, setStreak] = useState(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [isFriend, setIsFriend] = useState(false);
    const [viewerImage, setViewerImage] = useState(null);

    useEffect(() => {
        loadProfile();
    }, [userId]);

    const loadProfile = async () => {
        const p = await getUserProfile(userId);
        setProfile(p);

        if (p) {
            const userPosts = await getUserPosts(userId);
            setPosts(userPosts);

            setIsFollowing(userProfile?.following?.includes(userId));
            setIsFriend(userProfile?.friends?.includes(userId));

            if (user?.uid) {
                const s = await getStreak(user.uid, userId);
                setStreak(s);
            }
        }
    };

    const handleFollow = async () => {
        if (isFollowing) {
            await unfollowUser(user.uid, userId);
            setIsFollowing(false);
        } else {
            await followUser(user.uid, userId);
            setIsFollowing(true);
        }
    };

    const handleMessage = async () => {
        const chat = await getOrCreateDMChat(user.uid, userId);
        router.push(`/chat/${chat.id}`);
    };

    const handleAddFriend = async () => {
        await addFriend(user.uid, userId);
        setIsFriend(true);
        Alert.alert('Success', 'Friend added!');
    };

    if (!profile) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={Colors.text} />
                    </TouchableOpacity>
                </View>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </View>
        );
    }

    const isOwnProfile = user?.uid === userId;

    return (
        <>
        <ScrollView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>@{profile.username}</Text>
                <TouchableOpacity>
                    <Ionicons name="ellipsis-horizontal" size={24} color={Colors.text} />
                </TouchableOpacity>
            </View>

            {/* Profile */}
            <View style={styles.profileSection}>
                <TouchableOpacity onPress={() => profile.avatar ? setViewerImage(profile.avatar) : null} activeOpacity={0.8}>
                    {profile.avatar ? (
                        <Image source={{ uri: profile.avatar }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                            <Text style={styles.avatarInitials}>{getInitials(profile.displayName)}</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <Text style={styles.displayName}>{profile.displayName}</Text>
                <Text style={styles.username}>@{profile.username}</Text>
                {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

                {/* Streak */}
                {streak && streak.count > 0 && (
                    <View style={styles.streakBadge}>
                        <Text style={styles.streakText}>{streak.emoji} {streak.count} day streak</Text>
                    </View>
                )}

                {/* Stats */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{formatCount(posts.length)}</Text>
                        <Text style={styles.statLabel}>Posts</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{formatCount(profile.followers?.length || 0)}</Text>
                        <Text style={styles.statLabel}>Followers</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{formatCount(profile.following?.length || 0)}</Text>
                        <Text style={styles.statLabel}>Following</Text>
                    </View>
                </View>

                {/* Action buttons */}
                {!isOwnProfile && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={[styles.followBtn, isFollowing && styles.followingBtn]}
                            onPress={handleFollow}
                        >
                            <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                                {isFollowing ? 'Following' : 'Follow'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.msgBtn} onPress={handleMessage}>
                            <Ionicons name="chatbubble-outline" size={18} color={Colors.text} />
                        </TouchableOpacity>
                        {!isFriend && (
                            <TouchableOpacity style={styles.msgBtn} onPress={handleAddFriend}>
                                <Ionicons name="person-add-outline" size={18} color={Colors.text} />
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>

            {/* Posts Grid */}
            {profile.isPrivate && !isFollowing && !isOwnProfile ? (
                <View style={styles.privateProfile}>
                    <Ionicons name="lock-closed" size={48} color={Colors.textTertiary} />
                    <Text style={styles.privateText}>This profile is private</Text>
                    <Text style={styles.privateSubtext}>Follow to see their posts</Text>
                </View>
            ) : (
                <View style={styles.postsGrid}>
                    {posts.map((post) => (
                        <TouchableOpacity key={post.id} style={styles.postGridItem} onPress={() => router.push(`/post/${post.id}`)}>
                            {post.media?.length > 0 ? (
                                <Image source={{ uri: post.media[0] }} style={styles.postGridImage} />
                            ) : (
                                <View style={styles.postGridText}>
                                    <Text style={styles.postGridContent} numberOfLines={4}>{post.content}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </ScrollView>
        <ImageViewer
            visible={!!viewerImage}
            imageUrl={viewerImage}
            onClose={() => setViewerImage(null)}
        />
    </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: 50, paddingBottom: Spacing.md,
        backgroundColor: Colors.surface,
    },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: Colors.textSecondary },
    profileSection: { alignItems: 'center', paddingVertical: Spacing.xxl, backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: Spacing.md },
    avatarPlaceholder: { backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.primary },
    avatarInitials: { color: Colors.primary, fontSize: FontSize.xxxl, fontWeight: 'bold' },
    displayName: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text, marginBottom: 2 },
    username: { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.sm },
    bio: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.xxxl, marginBottom: Spacing.md },
    streakBadge: { backgroundColor: Colors.primarySurface, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, marginBottom: Spacing.md },
    streakText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
    statsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl, marginBottom: Spacing.lg },
    statItem: { alignItems: 'center' },
    statValue: { fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text },
    statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
    statDivider: { width: 1, height: 24, backgroundColor: Colors.border },
    actionRow: { flexDirection: 'row', gap: Spacing.sm },
    followBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
    followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.primary },
    followBtnText: { color: Colors.textInverse, fontSize: FontSize.md, fontWeight: '600' },
    followingBtnText: { color: Colors.primary },
    msgBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    privateProfile: { alignItems: 'center', paddingVertical: 60 },
    privateText: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '600', marginTop: 12 },
    privateSubtext: { color: Colors.textTertiary, fontSize: FontSize.md, marginTop: 4 },
    postsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    postGridItem: { width: '33.33%', aspectRatio: 1, padding: 1 },
    postGridImage: { width: '100%', height: '100%' },
    postGridText: { width: '100%', height: '100%', backgroundColor: Colors.surfaceLight, justifyContent: 'center', padding: Spacing.sm },
    postGridContent: { color: Colors.text, fontSize: FontSize.xs, lineHeight: 14 },
});
