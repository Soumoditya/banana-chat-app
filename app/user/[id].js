import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, FlatList, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { getUserProfile, getUserByUsername, followUser, unfollowUser, addFriend, blockUser, incrementProfileView } from '../../services/users';
import { getUserPosts } from '../../services/posts';
import { getResharesByUser } from '../../services/reshares';
import { getOrCreateDMChat } from '../../services/chat';
import { getStreak } from '../../services/streaks';
import { getHighlights } from '../../services/stories';
import { getInitials, formatCount } from '../../utils/helpers';
import { getStreakEmoji } from '../../utils/constants';
import ImageViewer from '../../components/ImageViewer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PremiumBadge, { PremiumFlair } from '../../components/PremiumBadge';
import { isPremiumActive } from '../../utils/premium';
import useAppTheme from '../../hooks/useAppTheme';
import { useToast } from '../../contexts/ToastContext';

// Social link config — platform name → { icon, color, urlPrefix }
const SOCIAL_PLATFORMS = {
    instagram: { icon: 'logo-instagram', color: '#E4405F', prefix: 'https://instagram.com/' },
    twitter: { icon: 'logo-twitter', color: '#1DA1F2', prefix: 'https://twitter.com/' },
    youtube: { icon: 'logo-youtube', color: '#FF0000', prefix: 'https://youtube.com/@' },
    github: { icon: 'logo-github', color: '#fff', prefix: 'https://github.com/' },
    linkedin: { icon: 'logo-linkedin', color: '#0A66C2', prefix: 'https://linkedin.com/in/' },
    website: { icon: 'globe-outline', color: '#FFD60A', prefix: '' },
};

export default function UserProfileScreen() {
    const { id: userId } = useLocalSearchParams();
    const { user, userProfile, refreshProfile } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { C, skin } = useAppTheme();
    const { showToast, showConfirm } = useToast();
    const [profile, setProfile] = useState(null);
    const [posts, setPosts] = useState([]);
    const [resharedPosts, setResharedPosts] = useState([]);
    const [streak, setStreak] = useState(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [isFriend, setIsFriend] = useState(false);
    const [viewerImage, setViewerImage] = useState(null);
    const [activeTab, setActiveTab] = useState('posts');
    const [highlights, setHighlights] = useState([]);

    useEffect(() => {
        loadProfile();
    }, [userId]);

    const loadProfile = async () => {
        let p = await getUserProfile(userId);

        // Fallback: If UID not found, try searching if the parameter was actually a @username
        if (!p) {
            p = await getUserByUsername(userId);
        }

        setProfile(p);

        // Track profile view (once per visit, only for other users)
        if (p && user?.uid && p.id !== user.uid) {
            incrementProfileView(p.id);
        }

        if (p) {
            const userPosts = await getUserPosts(p.id);
            setPosts(userPosts);

            const reshared = await getResharesByUser(p.id);
            setResharedPosts(reshared);

            setIsFollowing(userProfile?.following?.includes(p.id));
            setIsFriend(userProfile?.friends?.includes(p.id));

            if (user?.uid) {
                const s = await getStreak(user.uid, p.id);
                setStreak(s);
            }

            // Load highlights
            try {
                const hl = await getHighlights(p.id, userProfile);
                setHighlights(hl);
            } catch (e) {}
        }
    };

    const handleFollow = async () => {
        if (!profile) return;
        if (isFollowing) {
            await unfollowUser(user.uid, profile.id);
            setIsFollowing(false);
        } else {
            await followUser(user.uid, profile.id);
            setIsFollowing(true);
        }
    };

    const handleMessage = async () => {
        if (!profile) return;
        const chat = await getOrCreateDMChat(user.uid, profile.id);
        router.push(`/chat/${chat.id}`);
    };

    const handleAddFriend = async () => {
        if (!profile) return;
        await addFriend(user.uid, profile.id);
        setIsFriend(true);
        showToast('Friend added!', 'success');
    };

    // ─── 3-dot menu handler ───
    const handleMoreMenu = () => {
        // Copy Username
        const copyUsername = async () => {
            await Clipboard.setStringAsync(`@${profile.username}`);
            showToast(`@${profile.username} copied to clipboard`, 'success', 'Copied!');
        };

        // Block User
        const blockUserAction = () => {
            showConfirm('Block User', `Are you sure you want to block @${profile.username}? They won't be able to see your profile or contact you.`,
                async () => {
                    try {
                        await blockUser(user.uid, profile.id);
                        if (refreshProfile) await refreshProfile();
                        showToast(`@${profile.username} has been blocked`, 'success', 'Blocked');
                        router.back();
                    } catch (err) {
                        showToast('Failed to block user', 'error');
                    }
                },
                { variant: 'destructive', confirmText: 'Block', icon: 'ban-outline' }
            );
        };

        // Report User
        const reportUser = () => {
            showToast('Thank you. We will review this account.', 'info', 'Report Submitted');
        };

        // Show options as confirm
        showConfirm('Options', `@${profile.username}`,
            copyUsername,
            { confirmText: 'Copy Username', cancelText: 'More...', icon: 'ellipsis-horizontal-circle-outline' }
        );
    };

    // ─── Social links renderer ───
    const renderSocialLinks = () => {
        const links = profile?.socialLinks || {};
        // Also check legacy link1/link2
        const legacyLinks = [];
        if (profile?.link1) legacyLinks.push({ key: 'link1', url: profile.link1 });
        if (profile?.link2) legacyLinks.push({ key: 'link2', url: profile.link2 });

        const socialEntries = Object.entries(links).filter(([_, v]) => v && v.trim());
        if (socialEntries.length === 0 && legacyLinks.length === 0) return null;

        return (
            <View style={styles.socialRow}>
                {socialEntries.map(([platform, value]) => {
                    const config = SOCIAL_PLATFORMS[platform];
                    if (!config) return null;
                    return (
                        <TouchableOpacity
                            key={platform}
                            style={styles.socialIcon}
                            onPress={() => {
                                let url = value;
                                if (!url.startsWith('http')) {
                                    url = config.prefix + value;
                                }
                                Linking.openURL(url).catch(() => showToast('Could not open link', 'error'));
                            }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name={config.icon} size={22} color={config.color} />
                        </TouchableOpacity>
                    );
                })}
                {legacyLinks.map(({ key, url }) => (
                    <TouchableOpacity
                        key={key}
                        style={styles.socialIcon}
                        onPress={() => {
                            let link = url;
                            if (!link.startsWith('http')) link = 'https://' + link;
                            Linking.openURL(link).catch(() => showToast('Could not open link', 'error'));
                        }}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="link-outline" size={20} color={Colors.primary} />
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    // ─── Grid render for posts/reshares ───
    const renderGridItem = (item, index) => {
        const post = item.isReshare ? item.post : item;
        const id = item.isReshare ? item.originalPostId : item.id;
        return (
            <TouchableOpacity
                key={item.id || id || index}
                style={styles.postGridItem}
                onPress={() => router.push(`/post/${id || item.id}`)}
            >
                {post?.media?.length > 0 ? (() => {
                    const m = post.media[0];
                    const uri = typeof m === 'string' ? m : m?.uri;
                    return uri ? <Image source={{ uri }} style={styles.postGridImage} /> : null;
                })() : (
                    <View style={styles.postGridText}>
                        <Text style={styles.postGridContent} numberOfLines={4}>{post?.content}</Text>
                    </View>
                )}
                {item.isReshare && (
                    <View style={styles.reshareOverlay}>
                        <Ionicons name="repeat" size={14} color="#fff" />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const currentDisplayPosts = activeTab === 'posts' ? posts : resharedPosts;

    if (!profile) {
        return (
            <View style={styles.container}>
                <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
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

    const isOwnProfile = user?.uid === profile?.id || user?.uid === userId;
    const isBlocked = userProfile?.blockedUsers?.includes(profile?.id);

    // Show blocked state
    if (isBlocked) {
        return (
            <View style={styles.container}>
                <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>@{profile.username}</Text>
                    <TouchableOpacity onPress={handleMoreMenu}>
                        <Ionicons name="ellipsis-horizontal" size={24} color={Colors.text} />
                    </TouchableOpacity>
                </View>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
                    <Ionicons name="ban-outline" size={64} color={Colors.textTertiary} />
                    <Text style={{ color: Colors.text, fontSize: FontSize.lg, fontWeight: '600', marginTop: 16 }}>User Blocked</Text>
                    <Text style={{ color: Colors.textTertiary, fontSize: FontSize.md, textAlign: 'center', marginTop: 8 }}>
                        You have blocked @{profile.username}. Unblock them from Settings → Blocked Users to view their profile.
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <>
        <ScrollView style={[styles.container, { backgroundColor: C.background }]}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, backgroundColor: C.surface, borderBottomColor: C.border }]}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={C.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: C.text }]}>@{profile.username}</Text>
                <TouchableOpacity onPress={handleMoreMenu}>
                    <Ionicons name="ellipsis-horizontal" size={24} color={C.text} />
                </TouchableOpacity>
            </View>

            {/* Profile */}
            <View style={[styles.profileSection, { backgroundColor: C.surface, ...skin.cardStyle }]}>
                <TouchableOpacity onPress={() => profile.avatar ? setViewerImage(profile.avatar) : null} activeOpacity={0.8}>
                    {profile.avatar ? (
                        <Image source={{ uri: profile.avatar }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                            <Text style={styles.avatarInitials}>{getInitials(profile.displayName)}</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <Text style={styles.displayName}>{profile.displayName}</Text>
                    <PremiumBadge profile={profile} size={18} />
                </View>
                {isPremiumActive(profile) && <PremiumFlair profile={profile} style={{ alignSelf: 'center', marginTop: 4 }} />}
                <Text style={styles.username}>@{profile.username}</Text>
                {profile.bio ? (
                    <View style={styles.bioRow}>
                        <Text style={styles.bio} selectable>
                            {/* Parse @mentions in bio */}
                            {profile.bio.split(/(@\w+)/g).map((part, i) => {
                                if (part.match(/^@\w+$/)) {
                                    const username = part.slice(1);
                                    return (
                                        <Text
                                            key={i}
                                            style={{ color: C.primary, fontWeight: '600' }}
                                            onPress={() => router.push(`/user/${username}`)}
                                        >
                                            {part}
                                        </Text>
                                    );
                                }
                                return <Text key={i}>{part}</Text>;
                            })}
                        </Text>
                        <TouchableOpacity
                            style={styles.copyBioBtn}
                            onPress={async () => {
                                await Clipboard.setStringAsync(profile.bio);
                                showToast('Bio copied to clipboard', 'success', 'Copied!');
                            }}
                            activeOpacity={0.6}
                        >
                            <Ionicons name="copy-outline" size={14} color={C.textTertiary || Colors.textTertiary} />
                        </TouchableOpacity>
                    </View>
                ) : null}

                {/* Social Links */}
                {renderSocialLinks()}

                {/* Streak — now tappable */}
                {streak && streak.count > 0 && (
                    <TouchableOpacity
                        style={styles.streakBadge}
                        onPress={() => {
                            const tips = streak.count >= 30 ? '🏆 Legendary streak!'
                                : streak.count >= 14 ? '💪 Keep it going!'
                                : streak.count >= 7 ? '🔥 One week strong!'
                                : '✨ Keep chatting daily!';
                            showConfirm(
                                `${streak.emoji || '🔥'} ${streak.count} Day Streak`,
                                `You and @${profile.username} have been chatting for ${streak.count} consecutive days!\n\n${tips}\n\nChat every day to keep your streak alive!`,
                                () => {},
                                { confirmText: 'Nice! 🍌', icon: 'flame-outline' }
                            );
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.streakText}>{streak.emoji} {streak.count} day streak</Text>
                    </TouchableOpacity>
                )}

                {/* Stats — Tappable followers/following */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{formatCount(posts.length)}</Text>
                        <Text style={styles.statLabel}>Posts</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <TouchableOpacity
                        style={styles.statItem}
                        onPress={() => router.push(`/followers-list?userId=${profile.id}&tab=followers`)}
                    >
                        <Text style={styles.statValue}>{formatCount(profile.followers?.length || 0)}</Text>
                        <Text style={styles.statLabel}>Followers</Text>
                    </TouchableOpacity>
                    <View style={styles.statDivider} />
                    <TouchableOpacity
                        style={styles.statItem}
                        onPress={() => router.push(`/followers-list?userId=${profile.id}&tab=following`)}
                    >
                        <Text style={styles.statValue}>{formatCount(profile.following?.length || 0)}</Text>
                        <Text style={styles.statLabel}>Following</Text>
                    </TouchableOpacity>
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
                            <Ionicons name="chatbubble-outline" size={18} color={C.text} />
                        </TouchableOpacity>
                        {!isFriend && (
                            <TouchableOpacity style={styles.msgBtn} onPress={handleAddFriend}>
                                <Ionicons name="person-add-outline" size={18} color={C.text} />
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>

            {/* Highlights Row */}
            {highlights.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 12 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
                    {highlights.map(h => (
                        <TouchableOpacity
                            key={h.id}
                            style={{ alignItems: 'center', width: 70 }}
                            onPress={() => router.push(`/highlight-viewer?highlightId=${h.id}&storyIds=${encodeURIComponent(JSON.stringify(h.storyIds || []))}&authorId=${profile.id}&highlightName=${encodeURIComponent(h.name || 'Highlight')}`)}
                        >
                            <View style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: h.type === 'spotlight' ? Colors.primary : Colors.textTertiary, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surfaceLight, overflow: 'hidden' }}>
                                {h.coverImage ? (
                                    <Image source={{ uri: h.coverImage }} style={{ width: '100%', height: '100%' }} />
                                ) : (
                                    <Ionicons name={h.type === 'spotlight' ? 'sunny' : 'heart'} size={22} color={h.type === 'spotlight' ? Colors.primary : Colors.textTertiary} />
                                )}
                            </View>
                            <Text style={{ color: Colors.text, fontSize: 11, marginTop: 4, textAlign: 'center' }} numberOfLines={1}>{h.name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {/* Tabs: Posts / Reshares */}
            <View style={styles.tabs}>
                <TouchableOpacity style={[styles.tab, activeTab === 'posts' && styles.tabActive]} onPress={() => setActiveTab('posts')}>
                    <Ionicons name="grid-outline" size={20} color={activeTab === 'posts' ? Colors.primary : Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'reshares' && styles.tabActive]} onPress={() => setActiveTab('reshares')}>
                    <Ionicons name="repeat" size={22} color={activeTab === 'reshares' ? Colors.primary : Colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Posts Grid */}
            {profile.isPrivate && !isFollowing && !isOwnProfile ? (
                <View style={styles.privateProfile}>
                    <Ionicons name="lock-closed" size={48} color={Colors.textTertiary} />
                    <Text style={styles.privateText}>This profile is private</Text>
                    <Text style={styles.privateSubtext}>Follow to see their posts</Text>
                </View>
            ) : currentDisplayPosts.length > 0 ? (
                <View style={styles.postsGrid}>
                    {currentDisplayPosts.map((item, i) => renderGridItem(item, i))}
                </View>
            ) : (
                <View style={styles.emptyPosts}>
                    <Ionicons name={activeTab === 'posts' ? "images-outline" : "repeat"} size={48} color={Colors.textTertiary} />
                    <Text style={styles.emptyText}>{activeTab === 'posts' ? 'No posts yet' : 'No reshared posts'}</Text>
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
        paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
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
    bioRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: Spacing.xl, marginBottom: Spacing.md, gap: 6 },
    copyBioBtn: { paddingTop: 3, opacity: 0.7 },
    // Social links
    socialRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, marginBottom: Spacing.md },
    socialIcon: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: Colors.surfaceLight,
        justifyContent: 'center', alignItems: 'center',
    },
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
    // Tabs
    tabs: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    tab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: Colors.primary },
    // Grid
    postsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    postGridItem: { width: '33.33%', aspectRatio: 1, padding: 1, position: 'relative' },
    postGridImage: { width: '100%', height: '100%' },
    postGridText: { width: '100%', height: '100%', backgroundColor: Colors.surfaceLight, justifyContent: 'center', padding: Spacing.sm },
    postGridContent: { color: Colors.text, fontSize: FontSize.xs, lineHeight: 14 },
    reshareOverlay: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, padding: 3 },
    // Empty / Private
    emptyPosts: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { color: Colors.textTertiary, fontSize: FontSize.md, marginTop: 12 },
    privateProfile: { alignItems: 'center', paddingVertical: 60 },
    privateText: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '600', marginTop: 12 },
    privateSubtext: { color: Colors.textTertiary, fontSize: FontSize.md, marginTop: 4 },
});
