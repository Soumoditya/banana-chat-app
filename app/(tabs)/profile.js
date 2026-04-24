import { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Modal,
    TextInput, Dimensions, Linking, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { usePremium } from '../../contexts/PremiumContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { getUserPosts, getSavedPosts } from '../../services/posts';
import { getHighlights, getStoriesByIds } from '../../services/stories';
import { getResharesByUser } from '../../services/reshares';
import { updateUserProfile, changeUsername } from '../../services/users';
import { getAppStreak } from '../../services/streaks';
import { getInitials, formatCount } from '../../utils/helpers';
import { getStreakEmoji } from '../../utils/constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { uploadToCloudinary } from '../../config/cloudinary';
import * as ImagePicker from 'expo-image-picker';
import PremiumBadge, { PremiumFlair } from '../../components/PremiumBadge';
import { isPremiumActive } from '../../utils/premium';
import { useToast } from '../../contexts/ToastContext';

const { width } = Dimensions.get('window');

// Social link config
const SOCIAL_PLATFORMS = {
    instagram: { icon: 'logo-instagram', color: '#E4405F', label: 'Instagram', placeholder: 'username' },
    twitter: { icon: 'logo-twitter', color: '#1DA1F2', label: 'Twitter / X', placeholder: 'username' },
    youtube: { icon: 'logo-youtube', color: '#FF0000', label: 'YouTube', placeholder: 'channel name' },
    github: { icon: 'logo-github', color: '#fff', label: 'GitHub', placeholder: 'username' },
    linkedin: { icon: 'logo-linkedin', color: '#0A66C2', label: 'LinkedIn', placeholder: 'username' },
    website: { icon: 'globe-outline', color: '#FFD60A', label: 'Website', placeholder: 'https://...' },
};

export default function ProfileScreen() {
    const { user, userProfile, signOut, isAdmin, refreshProfile } = useAuth();
    const { themedColors: C, activeFont, skinStyles } = usePremium();
    const skin = skinStyles || { surfaceStyle: {}, cardStyle: {}, borderRadius: 16 };
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { showToast, showConfirm } = useToast();
    const [posts, setPosts] = useState([]);
    const [savedPosts, setSavedPosts] = useState([]);
    const [resharedPosts, setResharedPosts] = useState([]);
    const [highlights, setHighlights] = useState([]);
    const [appStreak, setAppStreak] = useState(0);
    const [activeTab, setActiveTab] = useState('posts');
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPersonalModal, setShowPersonalModal] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [personalForm, setPersonalForm] = useState({});
    const [uploading, setUploading] = useState(false);

    // Refresh data each time the profile tab is focused (including initial mount)
    useFocusEffect(
        useCallback(() => {
            if (user) loadData();
        }, [user])
    );

    const loadData = async () => {
        if (!user) return;
        try {
            const userPosts = await getUserPosts(user.uid);
            setPosts(userPosts);

            const streak = await getAppStreak(user.uid);
            setAppStreak(streak.count || 0);
            
            const reshared = await getResharesByUser(user.uid);
            setResharedPosts(reshared);

            if (userProfile?.savedPosts?.length > 0) {
                const saved = await getSavedPosts(userProfile.savedPosts);
                setSavedPosts(saved);
            }

            const hlights = await getHighlights(user.uid);
            setHighlights(hlights);
        } catch (err) {
            console.error('Profile data error:', err);
        }
    };

    const handleSignOut = () => {
        showConfirm('Sign Out', 'Are you sure you want to sign out?',
            async () => { await signOut(); router.replace('/(auth)/login'); },
            { variant: 'destructive', confirmText: 'Sign Out', icon: 'log-out-outline' }
        );
    };

    const openEditProfile = () => {
        setEditForm({
            displayName: userProfile?.displayName || '',
            bio: userProfile?.bio || '',
            username: userProfile?.username || '',
            socialLinks: userProfile?.socialLinks || {},
        });
        setShowEditModal(true);
    };

    const openPersonalDetails = () => {
        setPersonalForm({
            birthdate: userProfile?.birthdate || '',
            gender: userProfile?.gender || '',
            location: userProfile?.location || '',
            website: userProfile?.website || '',
            phone: userProfile?.phone || '',
        });
        setShowEditModal(false);
        setTimeout(() => setShowPersonalModal(true), 300);
    };

    const handleChangeAvatar = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });
            if (!result.canceled) {
                setUploading(true);
                const uploaded = await uploadToCloudinary(result.assets[0].uri, 'image');
                await updateUserProfile(user.uid, { avatar: uploaded.url });
                await refreshProfile();
                setUploading(false);
                showToast('Profile photo updated!', 'success');
            }
        } catch (err) {
            setUploading(false);
            showToast('Failed to update photo', 'error');
        }
    };

    const handleSaveProfile = async () => {
        try {
            // Handle username change separately with uniqueness check
            if (editForm.username && editForm.username !== userProfile?.username) {
                await changeUsername(user.uid, editForm.username);
            }
            await updateUserProfile(user.uid, {
                displayName: editForm.displayName,
                bio: editForm.bio,
                socialLinks: editForm.socialLinks || {},
            });
            await refreshProfile();
            setShowEditModal(false);
            showToast('Profile updated!', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const handleSavePersonal = async () => {
        try {
            await updateUserProfile(user.uid, {
                birthdate: personalForm.birthdate,
                gender: personalForm.gender,
                location: personalForm.location,
                website: personalForm.website,
                phone: personalForm.phone,
            });
            await refreshProfile();
            setShowPersonalModal(false);
            showToast('Personal details updated!', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const currentDisplayPosts = activeTab === 'posts' ? posts : activeTab === 'reshares' ? resharedPosts : savedPosts;

    const renderGridItem = (item, index) => {
        const post = item.isReshare ? item.post : item;
        const id = item.isReshare ? item.originalPostId : item.id;
        const feedType = activeTab === 'posts' ? 'user' : activeTab === 'reshares' ? 'reshared' : 'saved';
        return (
            <TouchableOpacity
                key={item.id || id}
                style={styles.postGridItem}
                onPress={() => router.push(`/post-feed?type=${feedType}&startIndex=${index}&userId=${user?.uid}`)}
            >
                {post.media?.length > 0 ? (
                    <Image 
                        source={{ uri: typeof post.media[0] === 'string' ? post.media[0] : post.media[0]?.uri }} 
                        style={styles.postGridImage} 
                    />
                ) : (
                    <View style={styles.postGridText}>
                        <Text style={styles.postGridContent} numberOfLines={4}>{post.content}</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top, backgroundColor: C.background }]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={[styles.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
                    <Text style={[styles.headerTitle, { color: C.text }]}>@{userProfile?.username || 'Profile'}</Text>
                    <View style={styles.headerRight}>
                        {isAdmin && (
                            <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/admin')}>
                                <Ionicons name="shield" size={20} color={C.primary} />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/settings')}>
                            <Ionicons name="menu-outline" size={22} color={C.text} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Profile Card */}
                <View style={[styles.profileCard, { backgroundColor: C.surface, ...skin.cardStyle }]}>
                    <View style={styles.profileTopRow}>
                        {/* Avatar */}
                        <TouchableOpacity style={styles.avatarContainer} onPress={handleChangeAvatar}>
                            {userProfile?.avatar ? (
                                <Image source={{ uri: userProfile.avatar }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                    <Text style={styles.avatarInitials}>
                                        {getInitials(userProfile?.displayName)}
                                    </Text>
                                </View>
                            )}
                            {isAdmin && (
                                <View style={styles.adminBadge}>
                                    <Ionicons name="shield-checkmark" size={14} color={C.primary} />
                                </View>
                            )}
                            <View style={styles.cameraIcon}>
                                <Ionicons name="camera" size={12} color="#fff" />
                            </View>
                        </TouchableOpacity>

                        {/* Stats */}
                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{formatCount(posts.length)}</Text>
                                <Text style={styles.statLabel}>Posts</Text>
                            </View>
                            <TouchableOpacity style={styles.statItem} onPress={() => router.push(`/followers-list?userId=${user?.uid}&tab=followers`)}>
                                <Text style={styles.statValue}>{formatCount(userProfile?.followers?.length || 0)}</Text>
                                <Text style={styles.statLabel}>Followers</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.statItem} onPress={() => router.push(`/followers-list?userId=${user?.uid}&tab=following`)}>
                                <Text style={styles.statValue}>{formatCount(userProfile?.following?.length || 0)}</Text>
                                <Text style={styles.statLabel}>Following</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Name and Bio */}
                    <View style={styles.nameSection}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                            <Text style={styles.displayName}>{userProfile?.displayName || 'User'}</Text>
                            <PremiumBadge profile={userProfile} size={18} />
                        </View>
                        {isPremiumActive(userProfile) && <PremiumFlair profile={userProfile} style={{ alignSelf: 'flex-start', marginTop: 4 }} />}
                        {userProfile?.showCategory && userProfile?.profileCategory && userProfile.profileCategory !== 'personal' && (
                            <Text style={{ color: C.primary, fontSize: 13, fontWeight: '500', marginTop: 3 }}>
                                {userProfile.profileCategory === 'creator' ? '🎨' : '💼'} {userProfile.profileCategory.charAt(0).toUpperCase() + userProfile.profileCategory.slice(1)}
                                {userProfile.occupation ? ` • ${userProfile.occupation}` : ''}
                            </Text>
                        )}
                        {userProfile?.bio ? (
                            <Text style={styles.bio}>
                                {userProfile.bio.split(/(@\w+)/g).map((part, i) => {
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
                        ) : null}
                        {(userProfile?.socialLinks && Object.values(userProfile.socialLinks).some(v => v)) || userProfile?.link1 || userProfile?.link2 ? (
                            <View style={styles.socialLinksDisplay}>
                                {Object.entries(userProfile?.socialLinks || {}).filter(([_, v]) => v && v.trim()).map(([platform, value]) => {
                                    const config = SOCIAL_PLATFORMS[platform];
                                    if (!config) return null;
                                    return (
                                        <TouchableOpacity
                                            key={platform}
                                            style={styles.socialIconBtn}
                                            onPress={() => {
                                                let url = value;
                                                if (platform === 'instagram') url = `https://instagram.com/${value}`;
                                                else if (platform === 'twitter') url = `https://twitter.com/${value}`;
                                                else if (platform === 'youtube') url = `https://youtube.com/@${value}`;
                                                else if (platform === 'github') url = `https://github.com/${value}`;
                                                else if (platform === 'linkedin') url = `https://linkedin.com/in/${value}`;
                                                else if (!url.startsWith('http')) url = 'https://' + url;
                                                Linking.openURL(url).catch(() => showToast('Could not open link', 'error'));
                                            }}
                                        >
                                            <Ionicons name={config.icon} size={20} color={config.color} />
                                        </TouchableOpacity>
                                    );
                                })}
                                {userProfile?.link1 && !userProfile?.socialLinks?.website ? (
                                    <TouchableOpacity style={styles.socialIconBtn} onPress={() => {
                                        let url = userProfile.link1;
                                        if (!url.startsWith('http')) url = 'https://' + url;
                                        Linking.openURL(url).catch(() => showToast('Could not open link', 'error'));
                                    }}>
                                        <Ionicons name="link-outline" size={18} color={Colors.primary} />
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        ) : null}
                        <View style={styles.infoRow}>
                            <View style={styles.streakBadge}>
                                <Text style={styles.streakText}>{getStreakEmoji(appStreak)} {appStreak} day streak</Text>
                            </View>
                            <View style={styles.privacyBadge}>
                                <Ionicons name={userProfile?.isPrivate ? "lock-closed" : "globe-outline"} size={12} color={C.textSecondary} />
                                <Text style={styles.privacyText}>{userProfile?.isPrivate ? 'Private' : 'Public'}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.editProfileBtn} onPress={openEditProfile}>
                            <Text style={styles.editProfileText}>Edit Profile</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.shareProfileBtn}
                            onPress={async () => {
                                try {
                                    await Share.share({
                                        message: `Check out @${userProfile?.username || 'me'} on Banana Chat 🍌`,
                                        title: userProfile?.displayName || 'Banana Chat Profile',
                                    });
                                } catch (e) {}
                            }}
                        >
                            <Ionicons name="share-outline" size={18} color={C.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.shareProfileBtn, isPremiumActive(userProfile) && { borderColor: '#FFD700' }]}
                            onPress={() => router.push('/premium')}
                        >
                            <Ionicons name="diamond" size={16} color={isPremiumActive(userProfile) ? '#FFD700' : C.text} />
                        </TouchableOpacity>
                        {(isPremiumActive(userProfile) || userProfile?.profileCategory === 'creator' || userProfile?.profileCategory === 'business') && (
                            <TouchableOpacity
                                style={[styles.shareProfileBtn, { borderColor: '#A855F7' }]}
                                onPress={() => router.push('/profile-analytics')}
                            >
                                <Ionicons name="bar-chart-outline" size={16} color="#A855F7" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Highlights Row (Spotlight + Memory circles) */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.highlightsRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
                    {/* New highlight button */}
                    <TouchableOpacity style={styles.newHighlight} onPress={() => router.push('/highlight-editor')}>
                        <Ionicons name="add" size={24} color={Colors.primary} />
                        <Text style={styles.highlightLabel} numberOfLines={1}>New</Text>
                    </TouchableOpacity>

                    {highlights.map(h => (
                        <TouchableOpacity
                            key={h.id}
                            style={styles.highlightCircle}
                            onPress={() => {
                                router.push(`/highlight-viewer?highlightId=${h.id}&storyIds=${encodeURIComponent(JSON.stringify(h.storyIds || []))}&authorId=${user.uid}&highlightName=${encodeURIComponent(h.name || 'Highlight')}`);
                            }}
                            onLongPress={() => {
                                showConfirm(h.name || 'Highlight', 'View or edit this highlight?',
                                    () => router.push(`/highlight-viewer?highlightId=${h.id}&storyIds=${encodeURIComponent(JSON.stringify(h.storyIds || []))}&authorId=${user.uid}&highlightName=${encodeURIComponent(h.name || 'Highlight')}`),
                                    { confirmText: 'View', cancelText: 'Edit', icon: 'star-outline',
                                      onCancel: () => router.push(`/highlight-editor?editId=${h.id}`) }
                                );
                            }}
                        >
                            <View style={[
                                styles.highlightRing,
                                h.type === 'spotlight'
                                    ? { borderColor: Colors.primary }
                                    : { borderColor: '#6B6B80' }
                            ]}>
                                {h.coverImage ? (
                                    <Image source={{ uri: h.coverImage }} style={styles.highlightImage} />
                                ) : (
                                    <Ionicons
                                        name={h.type === 'spotlight' ? 'sunny' : 'heart'}
                                        size={20}
                                        color={h.type === 'spotlight' ? Colors.primary : '#6B6B80'}
                                    />
                                )}
                            </View>
                            <Text style={styles.highlightLabel} numberOfLines={1}>{h.name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Post tabs */}
                <View style={styles.tabs}>
                    <TouchableOpacity style={[styles.tab, activeTab === 'posts' && styles.tabActive]} onPress={() => setActiveTab('posts')}>
                        <Ionicons name="grid-outline" size={20} color={activeTab === 'posts' ? C.primary : C.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tab, activeTab === 'reshares' && styles.tabActive]} onPress={() => setActiveTab('reshares')}>
                        <Ionicons name="repeat" size={22} color={activeTab === 'reshares' ? C.primary : C.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tab, activeTab === 'saved' && styles.tabActive]} onPress={() => setActiveTab('saved')}>
                        <Ionicons name="bookmark-outline" size={20} color={activeTab === 'saved' ? C.primary : C.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Posts Grid */}
                {currentDisplayPosts.length > 0 ? (
                    <View style={styles.postsGrid}>
                        {currentDisplayPosts.map(renderGridItem)}
                    </View>
                ) : (
                    <View style={styles.emptyPosts}>
                        <Ionicons name={activeTab === 'posts' ? "images-outline" : activeTab === 'reshares' ? "repeat" : "bookmark-outline"} size={48} color={C.textTertiary} />
                        <Text style={styles.emptyText}>{activeTab === 'posts' ? 'No posts yet' : activeTab === 'reshares' ? 'No reshared posts' : 'No saved posts'}</Text>
                    </View>
                )}

                {/* Sign Out */}
                <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
                    <Ionicons name="log-out-outline" size={20} color={C.error || Colors.error} />
                    <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Edit Profile Modal */}
            <Modal visible={showEditModal} animationType="slide" transparent onRequestClose={() => setShowEditModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.editModal, { paddingTop: insets.top + 16 }]}>
                        <View style={styles.editHeader}>
                            <TouchableOpacity onPress={() => setShowEditModal(false)}>
                                <Text style={styles.editCancel}>Cancel</Text>
                            </TouchableOpacity>
                            <Text style={styles.editTitle}>Edit Profile</Text>
                            <TouchableOpacity onPress={handleSaveProfile}>
                                <Text style={styles.editDone}>Done</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 60 }} bounces={false}>
                            {/* Avatar */}
                            <View style={styles.editAvatarRow}>
                                <TouchableOpacity onPress={handleChangeAvatar}>
                                    {userProfile?.avatar ? (
                                        <Image source={{ uri: userProfile.avatar }} style={styles.editAvatar} />
                                    ) : (
                                        <View style={[styles.editAvatar, styles.avatarPlaceholder]}>
                                            <Text style={styles.avatarInitials}>{getInitials(editForm.displayName)}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleChangeAvatar}>
                                    <Text style={styles.changePhotoText}>Change Photo</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Form */}
                            <View style={styles.editForm}>
                                <View style={styles.editField}>
                                    <Text style={styles.editLabel}>Name</Text>
                                    <TextInput
                                        style={styles.editInput}
                                        value={editForm.displayName}
                                        onChangeText={(t) => setEditForm({ ...editForm, displayName: t })}
                                        placeholderTextColor={Colors.textTertiary}
                                    />
                                </View>
                                <View style={styles.editField}>
                                    <Text style={styles.editLabel}>Username</Text>
                                    <TextInput
                                        style={styles.editInput}
                                        value={editForm.username}
                                        onChangeText={(t) => setEditForm({ ...editForm, username: t.toLowerCase().replace(/[^a-z0-9._]/g, '') })}
                                        editable={true}
                                        autoCapitalize="none"
                                        placeholderTextColor={Colors.textTertiary}
                                    />
                                    <Text style={{ color: Colors.textTertiary, fontSize: 11, marginTop: 2 }}>Letters, numbers, dots, and underscores only</Text>
                                </View>
                                <View style={styles.editField}>
                                    <Text style={styles.editLabel}>Bio</Text>
                                    <TextInput
                                        style={[styles.editInput, styles.editInputBio]}
                                        value={editForm.bio}
                                        onChangeText={(t) => setEditForm({ ...editForm, bio: t })}
                                        placeholder="Tell us about yourself..."
                                        placeholderTextColor={Colors.textTertiary}
                                        multiline
                                        maxLength={150}
                                    />
                                </View>

                                {/* Social Links Section */}
                                <Text style={[styles.editLabel, { marginBottom: Spacing.sm, marginTop: Spacing.sm }]}>Social Links</Text>
                                {Object.entries(SOCIAL_PLATFORMS).map(([key, config]) => (
                                    <View key={key} style={styles.socialLinkField}>
                                        <Ionicons name={config.icon} size={20} color={config.color} />
                                        <TextInput
                                            style={styles.socialLinkInput}
                                            value={editForm.socialLinks?.[key] || ''}
                                            onChangeText={(t) => setEditForm({
                                                ...editForm,
                                                socialLinks: { ...editForm.socialLinks, [key]: t },
                                            })}
                                            placeholder={config.placeholder}
                                            placeholderTextColor={Colors.textTertiary}
                                            autoCapitalize="none"
                                        />
                                    </View>
                                ))}

                                {/* Personal Details */}
                                <TouchableOpacity style={styles.personalDetailsBtn} onPress={openPersonalDetails}>
                                    <View style={styles.personalDetailsLeft}>
                                        <Ionicons name="person-outline" size={20} color={Colors.primary} />
                                        <Text style={styles.personalDetailsText}>Personal Details</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Personal Details Modal */}
            <Modal visible={showPersonalModal} animationType="slide" transparent onRequestClose={() => setShowPersonalModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.editModal, { paddingTop: insets.top + 16 }]}>
                        <View style={styles.editHeader}>
                            <TouchableOpacity onPress={() => setShowPersonalModal(false)}>
                                <Text style={styles.editCancel}>Back</Text>
                            </TouchableOpacity>
                            <Text style={styles.editTitle}>Personal Details</Text>
                            <TouchableOpacity onPress={handleSavePersonal}>
                                <Text style={styles.editDone}>Save</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 60 }} bounces={false}>
                            <View style={styles.editForm}>
                                <View style={styles.editField}>
                                    <Text style={styles.editLabel}>Birthday</Text>
                                    <TextInput
                                        style={styles.editInput}
                                        value={personalForm.birthdate}
                                        onChangeText={(t) => {
                                            // Auto-format as DD/MM/YYYY
                                            let cleaned = t.replace(/[^0-9]/g, '');
                                            if (cleaned.length > 8) cleaned = cleaned.slice(0, 8);
                                            let formatted = '';
                                            if (cleaned.length > 0) formatted += cleaned.slice(0, 2);
                                            if (cleaned.length > 2) formatted += '/' + cleaned.slice(2, 4);
                                            if (cleaned.length > 4) formatted += '/' + cleaned.slice(4, 8);
                                            setPersonalForm({ ...personalForm, birthdate: formatted });
                                        }}
                                        placeholder="DD/MM/YYYY"
                                        placeholderTextColor={Colors.textTertiary}
                                        keyboardType="number-pad"
                                        maxLength={10}
                                    />
                                </View>
                                <View style={styles.editField}>
                                    <Text style={styles.editLabel}>Gender</Text>
                                    <View style={styles.genderRow}>
                                        {['Male', 'Female', 'Other', 'Prefer not to say'].map(g => (
                                            <TouchableOpacity
                                                key={g}
                                                style={[styles.genderChip, personalForm.gender === g && styles.genderChipActive]}
                                                onPress={() => setPersonalForm({ ...personalForm, gender: g })}
                                            >
                                                <Text style={[styles.genderText, personalForm.gender === g && styles.genderTextActive]}>{g}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                                <View style={styles.editField}>
                                    <Text style={styles.editLabel}>Location</Text>
                                    <TextInput
                                        style={styles.editInput}
                                        value={personalForm.location}
                                        onChangeText={(t) => setPersonalForm({ ...personalForm, location: t })}
                                        placeholder="City, Country"
                                        placeholderTextColor={Colors.textTertiary}
                                    />
                                </View>
                                <View style={styles.editField}>
                                    <Text style={styles.editLabel}>Website</Text>
                                    <TextInput
                                        style={styles.editInput}
                                        value={personalForm.website}
                                        onChangeText={(t) => setPersonalForm({ ...personalForm, website: t })}
                                        placeholder="https://..."
                                        placeholderTextColor={Colors.textTertiary}
                                        autoCapitalize="none"
                                    />
                                </View>
                                <View style={styles.editField}>
                                    <Text style={styles.editLabel}>Phone</Text>
                                    <TextInput
                                        style={styles.editInput}
                                        value={personalForm.phone}
                                        onChangeText={(t) => setPersonalForm({ ...personalForm, phone: t })}
                                        placeholder="+1 234 567 890"
                                        placeholderTextColor={Colors.textTertiary}
                                        keyboardType="phone-pad"
                                    />
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scrollContent: { paddingBottom: 100 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.surface,
    },
    headerTitle: { fontSize: FontSize.xxl, fontWeight: 'bold', color: Colors.text },
    headerRight: { flexDirection: 'row', gap: Spacing.sm },
    headerBtn: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceLight,
        justifyContent: 'center', alignItems: 'center',
    },
    profileCard: {
        paddingVertical: Spacing.lg, paddingHorizontal: Spacing.lg,
        backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    profileTopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl },
    avatarContainer: { position: 'relative' },
    avatar: { width: 86, height: 86, borderRadius: 43 },
    avatarPlaceholder: {
        backgroundColor: Colors.surfaceLight, justifyContent: 'center',
        alignItems: 'center', borderWidth: 2, borderColor: Colors.primary,
    },
    avatarInitials: { color: Colors.primary, fontSize: FontSize.xxxl, fontWeight: 'bold' },
    adminBadge: {
        position: 'absolute', bottom: 2, right: 2, backgroundColor: Colors.surface,
        borderRadius: 12, width: 24, height: 24, justifyContent: 'center',
        alignItems: 'center', borderWidth: 2, borderColor: Colors.primary,
    },
    cameraIcon: {
        position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.primary,
        borderRadius: 10, width: 20, height: 20, justifyContent: 'center',
        alignItems: 'center', borderWidth: 2, borderColor: Colors.surface,
    },
    statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
    statItem: { alignItems: 'center' },
    statValue: { fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text },
    statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
    nameSection: { marginTop: Spacing.md },
    displayName: { fontSize: FontSize.md, fontWeight: 'bold', color: Colors.text },
    bio: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
    linksRow: { marginTop: Spacing.sm, gap: 4 },
    linkItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    linkText: { fontSize: FontSize.sm, color: Colors.primary },
    infoRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
    streakBadge: {
        backgroundColor: Colors.surfaceLight, paddingHorizontal: Spacing.sm,
        paddingVertical: 3, borderRadius: BorderRadius.full,
    },
    streakText: { fontSize: FontSize.xs, color: Colors.text },
    privacyBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: Colors.surfaceLight, paddingHorizontal: Spacing.sm,
        paddingVertical: 3, borderRadius: BorderRadius.full,
    },
    privacyText: { color: Colors.textSecondary, fontSize: FontSize.xs },
    actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
    editProfileBtn: {
        flex: 1, alignItems: 'center', paddingVertical: 8,
        borderRadius: BorderRadius.sm, backgroundColor: Colors.surfaceLight,
    },
    editProfileText: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
    shareProfileBtn: {
        paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: BorderRadius.sm, backgroundColor: Colors.surfaceLight,
        justifyContent: 'center', alignItems: 'center',
    },
    highlightsRow: { paddingVertical: Spacing.md, backgroundColor: Colors.surface },
    newHighlight: { alignItems: 'center', width: 64, gap: 4 },
    highlightCircle: { alignItems: 'center', width: 64, gap: 4 },
    highlightRing: {
        width: 58, height: 58, borderRadius: 29, borderWidth: 2,
        justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surfaceLight,
        overflow: 'hidden',
    },
    highlightImage: { width: '100%', height: '100%' },
    highlightLabel: { fontSize: 10, color: Colors.textSecondary, textAlign: 'center' },
    tabs: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    tab: {
        flex: 1, alignItems: 'center', paddingVertical: Spacing.md,
        borderBottomWidth: 2, borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: Colors.primary },
    postsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    postGridItem: { width: '33.33%', aspectRatio: 1, padding: 1 },
    postGridImage: { width: '100%', height: '100%' },
    postGridText: {
        width: '100%', height: '100%', backgroundColor: Colors.surfaceLight,
        justifyContent: 'center', padding: Spacing.sm,
    },
    postGridContent: { color: Colors.text, fontSize: FontSize.xs, lineHeight: 14 },
    emptyPosts: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { color: Colors.textTertiary, fontSize: FontSize.md, marginTop: 12 },
    signOutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: Spacing.sm, marginHorizontal: Spacing.lg, marginTop: Spacing.xxl,
        paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg,
        borderWidth: 1, borderColor: Colors.error,
    },
    signOutText: { color: Colors.error, fontSize: FontSize.md, fontWeight: '600' },
    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    editModal: {
        flex: 1, backgroundColor: Colors.background, marginTop: 40,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
    },
    editHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
        borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    editCancel: { color: Colors.textSecondary, fontSize: FontSize.md },
    editTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: 'bold' },
    editDone: { color: Colors.primary, fontSize: FontSize.md, fontWeight: 'bold' },
    editAvatarRow: { alignItems: 'center', paddingVertical: Spacing.xl },
    editAvatar: { width: 80, height: 80, borderRadius: 40, marginBottom: Spacing.sm },
    changePhotoText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
    editForm: { paddingHorizontal: Spacing.lg },
    editField: { marginBottom: Spacing.lg },
    editLabel: { color: Colors.textSecondary, fontSize: FontSize.sm, marginBottom: Spacing.xs },
    editInput: {
        backgroundColor: Colors.surface, borderRadius: BorderRadius.sm,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
        color: Colors.text, fontSize: FontSize.md,
        borderWidth: 1, borderColor: Colors.border,
    },
    editInputDisabled: { opacity: 0.5 },
    editInputBio: { minHeight: 80, textAlignVertical: 'top' },
    personalDetailsBtn: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: Colors.surface, borderRadius: BorderRadius.sm,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.lg,
        borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg,
    },
    personalDetailsLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    personalDetailsText: { color: Colors.text, fontSize: FontSize.md, fontWeight: '500' },
    // Gender chips
    genderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    genderChip: {
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full, backgroundColor: Colors.surface,
        borderWidth: 1, borderColor: Colors.border,
    },
    genderChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
    genderText: { color: Colors.textSecondary, fontSize: FontSize.sm },
    genderTextActive: { color: Colors.primary, fontWeight: '600' },
    // Social links display
    socialLinksDisplay: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
    socialIconBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: Colors.surfaceLight,
        justifyContent: 'center', alignItems: 'center',
    },
    // Social links edit
    socialLinkField: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        marginBottom: Spacing.sm, backgroundColor: Colors.surface,
        borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.md,
        borderWidth: 1, borderColor: Colors.border,
    },
    socialLinkInput: {
        flex: 1, color: Colors.text, fontSize: FontSize.md,
        paddingVertical: Spacing.sm,
    },
});
