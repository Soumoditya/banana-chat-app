import { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    TextInput,
    Alert,
    ActivityIndicator,
    Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { subscribeToChats, getOrCreateDMChat, clearChat } from '../../services/chat';
import { getUserProfile, searchUsers, pinChat, unpinChat, archiveChat, unarchiveChat } from '../../services/users';
import { formatTime, getInitials, truncateText, debounce } from '../../utils/helpers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAppTheme from '../../hooks/useAppTheme';
import PremiumBadge from '../../components/PremiumBadge';

const SECTIONS = [
    { key: 'primary', label: 'Primary' },
    { key: 'general', label: 'General' },
    { key: 'requests', label: 'Requests' },
    { key: 'archived', label: 'Archived' },
];

export default function ChatsScreen() {
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { C, skin } = useAppTheme();
    const [chats, setChats] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [chatUsers, setChatUsers] = useState({});
    const [activeSection, setActiveSection] = useState('primary');
    const [userSearchResults, setUserSearchResults] = useState([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);

    useEffect(() => {
        if (!user) return;

        const unsubscribe = subscribeToChats(user.uid, async (chatList) => {
            // Filter out chats with blocked users
            const blockedIds = userProfile?.blockedUsers || [];
            const filteredChats = chatList.filter(chat => {
                if (chat.type === 'dm' && blockedIds.length > 0) {
                    const otherId = chat.participants?.find(p => p !== user.uid);
                    return !blockedIds.includes(otherId);
                }
                return true;
            });
            setChats(filteredChats);

            // Load user info for DM chats
            const userMap = { ...chatUsers };
            for (const chat of filteredChats) {
                if (chat.type === 'dm') {
                    const otherId = chat.participants?.find(p => p !== user.uid);
                    if (otherId && !userMap[otherId]) {
                        const profile = await getUserProfile(otherId);
                        if (profile) userMap[otherId] = profile;
                    }
                }
            }
            setChatUsers(userMap);
        });

        return () => unsubscribe();
    }, [user]);

    // ─── Search users for new conversations ───
    const handleUserSearch = useCallback(debounce(async (text) => {
        if (!text || text.length < 2) {
            setUserSearchResults([]);
            setIsSearchingUsers(false);
            return;
        }
        setIsSearchingUsers(true);
        try {
            const users = await searchUsers(text);
            // Filter out self and blocked users
            const blockedIds = userProfile?.blockedUsers || [];
            setUserSearchResults(users.filter(u => u.id !== user?.uid && !blockedIds.includes(u.id)));
        } catch (err) {
            console.warn('User search error:', err);
        } finally {
            setIsSearchingUsers(false);
        }
    }, 400), [user]);

    const handleStartDM = async (targetUser) => {
        try {
            // getOrCreateDMChat finds existing or creates new — returns full chat object
            const chat = await getOrCreateDMChat(user.uid, targetUser.id);
            setSearchText('');
            setUserSearchResults([]);
            router.push(`/chat/${chat.id}`);
        } catch (err) {
            console.error('Start DM error:', err);
            Alert.alert('Error', 'Failed to start conversation');
        }
    };

    // ─── Section filtering ───
    const friendIds = userProfile?.friends || [];
    const followingIds = userProfile?.following || [];
    const knownUsers = new Set([...friendIds, ...followingIds]);
    const pinnedChats = userProfile?.pinnedChats || [];
    const archivedChats = userProfile?.archivedChats || [];

    const getSectionChats = () => {
        let filtered = chats;

        if (searchText) {
            const term = searchText.toLowerCase();
            filtered = filtered.filter(chat => {
                if (chat.type === 'group') return chat.groupName?.toLowerCase().includes(term);
                const otherId = chat.participants?.find(p => p !== user?.uid);
                const otherUser = chatUsers[otherId];
                return otherUser?.username?.toLowerCase().includes(term) ||
                    otherUser?.displayName?.toLowerCase().includes(term);
            });
        }

        let sectionList = [];
        switch (activeSection) {
            case 'primary':
                sectionList = filtered.filter(c => {
                    if (archivedChats.includes(c.id)) return false;
                    if (c.type === 'group' || c.isBroadcast) return false;
                    const otherId = c.participants?.find(p => p !== user?.uid);
                    return knownUsers.has(otherId);
                });
                break;
            case 'general':
                sectionList = filtered.filter(c => {
                    if (archivedChats.includes(c.id)) return false;
                    return c.type === 'group' || c.isBroadcast;
                });
                break;
            case 'requests':
                sectionList = filtered.filter(c => {
                    if (archivedChats.includes(c.id)) return false;
                    if (c.type === 'group' || c.isBroadcast) return false;
                    const otherId = c.participants?.find(p => p !== user?.uid);
                    return !knownUsers.has(otherId);
                });
                break;
            case 'archived':
                sectionList = filtered.filter(c => archivedChats.includes(c.id));
                break;
            default:
                sectionList = filtered;
        }

        return sectionList.sort((a, b) => {
            const aPinned = pinnedChats.includes(a.id);
            const bPinned = pinnedChats.includes(b.id);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;

            const aTime = a.lastMessage?.timestamp || 0;
            const bTime = b.lastMessage?.timestamp || 0;
            return bTime - aTime;
        });
    };

    const getChatName = (chat) => {
        if (chat.type === 'group') return chat.groupName || 'Group';
        if (chat.isBroadcast) return '📢 Banana Broadcast';
        const otherId = chat.participants?.find(p => p !== user?.uid);
        const otherUser = chatUsers[otherId];
        if (chat.nicknames?.[otherId]) return chat.nicknames[otherId];
        return otherUser?.displayName || 'User';
    };

    const getChatAvatar = (chat) => {
        if (chat.type === 'group') return chat.groupAvatar;
        const otherId = chat.participants?.find(p => p !== user?.uid);
        return chatUsers[otherId]?.avatar;
    };

    const handleChatLongPress = (chat) => {
        const name = getChatName(chat);
        const isPinned = userProfile?.pinnedChats?.includes(chat.id);
        const isArchived = userProfile?.archivedChats?.includes(chat.id);

        Alert.alert(
            name,
            'What would you like to do?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: isPinned ? '📌 Unpin Chat' : '📌 Pin Chat',
                    onPress: async () => {
                        try {
                            if (isPinned) await unpinChat(user.uid, chat.id);
                            else await pinChat(user.uid, chat.id);
                        } catch(e) { Alert.alert('Error', e.message); }
                    }
                },
                {
                    text: isArchived ? '📂 Unarchive Chat' : '📂 Archive Chat',
                    onPress: async () => {
                        try {
                            if (isArchived) {
                                await unarchiveChat(user.uid, chat.id);
                            } else {
                                if (isPinned) await unpinChat(user.uid, chat.id);
                                await archiveChat(user.uid, chat.id);
                            }
                        } catch(e) { Alert.alert('Error', e.message); }
                    }
                },
                { text: '🗑️ Clear History', style: 'destructive', onPress: () => {
                    Alert.alert('Clear History', `Delete all messages in "${name}"?`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Clear', style: 'destructive', onPress: async () => {
                            try {
                                await clearChat(chat.id);
                                if (isPinned) await unpinChat(user.uid, chat.id);
                                if (isArchived) await unarchiveChat(user.uid, chat.id);
                                setChats(prev => prev.filter(c => c.id !== chat.id));
                            } catch(e) { Alert.alert('Error', e.message); }
                        }},
                    ]);
                }},
            ]
        );
    };

    const renderChatItem = ({ item: chat }) => {
        const name = getChatName(chat);
        const avatar = getChatAvatar(chat);
        const lastMsg = chat.lastMessage;

        return (
            <TouchableOpacity
                style={styles.chatItem}
                onPress={() => router.push(`/chat/${chat.id}`)}
                onLongPress={() => handleChatLongPress(chat)}
                activeOpacity={0.6}
            >
                {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.chatAvatar} />
                ) : (
                    <View style={[styles.chatAvatar, styles.avatarPlaceholder]}>
                        {chat.type === 'group' ? (
                            <Ionicons name="people" size={22} color={Colors.primary} />
                        ) : (
                            <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
                        )}
                    </View>
                )}
                <View style={styles.chatInfo}>
                    <View style={styles.chatTopRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Text style={[styles.chatName, { color: C.text }]} numberOfLines={1}>{name}</Text>
                            {chat.type === 'dm' && (() => {
                                const otherId = chat.participants?.find(p => p !== user?.uid);
                                return <PremiumBadge profile={chatUsers[otherId]} size={12} />;
                            })()}
                        </View>
                        {userProfile?.pinnedChats?.includes(chat.id) && (
                            <Ionicons name="pin" size={12} color={Colors.accent} style={{ marginRight: 4 }} />
                        )}
                        {lastMsg && (
                            <Text style={styles.chatTime}>
                                {formatTime(lastMsg.timestamp)}
                            </Text>
                        )}
                    </View>
                    {lastMsg && (
                        <Text style={styles.chatLastMsg} numberOfLines={1}>
                            {truncateText(lastMsg.text, 40)}
                        </Text>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    const renderUserResult = ({ item }) => (
        <TouchableOpacity
            style={styles.userResult}
            onPress={() => handleStartDM(item)}
            activeOpacity={0.6}
        >
            {item.avatar ? (
                <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
            ) : (
                <View style={[styles.userAvatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarInitials}>{getInitials(item.displayName)}</Text>
                </View>
            )}
            <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.displayName}</Text>
                <Text style={styles.userUsername}>@{item.username}</Text>
            </View>
            <Ionicons name="chatbubble-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
    );

    const sectionChats = getSectionChats();

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: C.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
                <Text style={[styles.headerTitle, { color: C.text }]}>Chats</Text>
                <TouchableOpacity
                    style={styles.newChatBtn}
                    onPress={() => Alert.alert(
                        'New Conversation',
                        'What would you like to create?',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            { text: '💬 New DM', onPress: () => router.push('/(tabs)/search') },
                            { text: '👥 New Group', onPress: () => router.push('/create-group') },
                        ]
                    )}
                >
                    <Ionicons name="create-outline" size={22} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color={Colors.textTertiary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search conversations or users..."
                    placeholderTextColor={Colors.textTertiary}
                    value={searchText}
                    onChangeText={(text) => {
                        setSearchText(text);
                        handleUserSearch(text);
                    }}
                />
                {searchText.length > 0 && (
                    <TouchableOpacity onPress={() => {
                        setSearchText('');
                        setUserSearchResults([]);
                    }}>
                        <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Section Tabs */}
            <View style={styles.sectionTabs}>
                {SECTIONS.map(section => (
                    <TouchableOpacity
                        key={section.key}
                        style={[styles.sectionTab, activeSection === section.key && styles.sectionTabActive]}
                        onPress={() => setActiveSection(section.key)}
                    >
                        <Text style={[styles.sectionTabText, activeSection === section.key && styles.sectionTabTextActive]}>
                            {section.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* User Search Results */}
            {searchText.length >= 2 && userSearchResults.length > 0 && (
                <View style={styles.userResultsSection}>
                    <Text style={styles.userResultsTitle}>Start a conversation</Text>
                    <FlatList
                        data={userSearchResults}
                        renderItem={renderUserResult}
                        keyExtractor={(item) => item.id}
                        style={{ maxHeight: 200 }}
                    />
                </View>
            )}

            {/* Chat List */}
            <FlatList
                data={sectionChats}
                renderItem={renderChatItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={() => (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyEmoji}>
                            {activeSection === 'primary' ? '💬' : activeSection === 'general' ? '👥' : '📩'}
                        </Text>
                        <Text style={styles.emptyTitle}>
                            {activeSection === 'primary' ? 'No chats yet' :
                                activeSection === 'general' ? 'No groups yet' : 'No requests'}
                        </Text>
                        <Text style={styles.emptySubtitle}>
                            {activeSection === 'primary' ? 'Search for users above to start chatting!' :
                                activeSection === 'general' ? 'Join or create a group to get started' :
                                    'Message requests will appear here'}
                        </Text>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md,
        backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    headerTitle: { fontSize: FontSize.xxl, fontWeight: 'bold', color: Colors.text },
    newChatBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    searchContainer: {
        flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.md,
        marginVertical: Spacing.sm, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.md, height: 40, gap: Spacing.sm,
        borderWidth: 1, borderColor: Colors.border,
    },
    searchInput: { flex: 1, color: Colors.text, fontSize: FontSize.md },
    // Section tabs
    sectionTabs: {
        flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.sm,
        paddingBottom: Spacing.sm, backgroundColor: Colors.surface,
        borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    sectionTab: {
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceLight,
    },
    sectionTabActive: {
        backgroundColor: Colors.primary,
    },
    sectionTabText: {
        color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600',
    },
    sectionTabTextActive: {
        color: Colors.textInverse,
    },
    // User search results
    userResultsSection: {
        backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
        paddingBottom: Spacing.sm,
    },
    userResultsTitle: {
        color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '600',
        textTransform: 'uppercase', letterSpacing: 1,
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    },
    userResult: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm, gap: Spacing.md,
    },
    userAvatar: { width: 42, height: 42, borderRadius: 21 },
    userInfo: { flex: 1 },
    userName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
    userUsername: { color: Colors.textSecondary, fontSize: FontSize.sm },
    // Chat list
    listContent: { paddingVertical: Spacing.sm },
    chatItem: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md, gap: Spacing.md,
    },
    chatAvatar: { width: 52, height: 52, borderRadius: 26 },
    avatarPlaceholder: { backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    avatarInitials: { color: Colors.primary, fontWeight: 'bold', fontSize: FontSize.md },
    chatInfo: { flex: 1 },
    chatTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
    chatName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600', flex: 1, marginRight: Spacing.sm },
    chatTime: { color: Colors.textTertiary, fontSize: FontSize.xs },
    chatLastMsg: { color: Colors.textSecondary, fontSize: FontSize.sm },
    emptyState: { alignItems: 'center', paddingTop: 60 },
    emptyEmoji: { fontSize: 48, marginBottom: Spacing.md },
    emptyTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text },
    emptySubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: Spacing.xs, textAlign: 'center', paddingHorizontal: Spacing.xxl },
});
