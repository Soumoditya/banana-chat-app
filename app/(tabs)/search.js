import { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Image, Dimensions, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { searchUsers, getUserProfile, getSuggestedUsers, followUser } from '../../services/users';
import { searchPosts, getExplorePosts } from '../../services/posts';
import { getInitials, debounce } from '../../utils/helpers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PremiumBadge from '../../components/PremiumBadge';

const { width } = Dimensions.get('window');
const GRID_SIZE = (width - 6) / 3;

export default function ExploreScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState([]);
    const [explorePosts, setExplorePosts] = useState([]);
    const [suggestedUsers, setSuggestedUsers] = useState([]);
    const [searchHistory, setSearchHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [authors, setAuthors] = useState({});
    // Track optimistic follow state locally — prevents spam-tapping the Follow button
    const [localFollowing, setLocalFollowing] = useState(new Set());
    const searchRef = useRef(null);

    useEffect(() => {
        loadExplorePosts();
        loadSearchHistory();
        if (user?.uid) loadSuggestions();
    }, [user?.uid]);

    const loadSuggestions = async () => {
        try {
            const suggestions = await getSuggestedUsers(user.uid, 8);
            setSuggestedUsers(suggestions);
        } catch {}
    };

    const loadExplorePosts = async () => {
        try {
            const posts = await getExplorePosts(30);
            setExplorePosts(posts);

            // Load authors in parallel (batched)
            const uniqueAuthorIds = [...new Set(posts.map(p => p.authorId))];
            const profileEntries = await Promise.all(
                uniqueAuthorIds.map(async (id) => {
                    const profile = await getUserProfile(id);
                    return profile ? [id, profile] : null;
                })
            );
            const authorMap = Object.fromEntries(profileEntries.filter(Boolean));
            setAuthors(authorMap);
        } catch (err) {
            console.error('Explore error:', err);
        }
    };

    const loadSearchHistory = async () => {
        try {
            const history = await AsyncStorage.getItem('search_history');
            if (history) setSearchHistory(JSON.parse(history));
        } catch (e) { }
    };

    const saveToHistory = async (term) => {
        try {
            const updated = [term, ...searchHistory.filter(h => h !== term)].slice(0, 20);
            setSearchHistory(updated);
            await AsyncStorage.setItem('search_history', JSON.stringify(updated));
        } catch (e) { }
    };

    const clearHistory = async () => {
        setSearchHistory([]);
        await AsyncStorage.removeItem('search_history');
    };

    const handleSearch = useCallback(debounce(async (text) => {
        if (!text || text.length < 2) {
            setResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        try {
            // Search both users and posts
            const [users, posts] = await Promise.all([
                searchUsers(text),
                searchPosts(text),
            ]);

            const combined = [
                ...users.map(u => ({ ...u, _type: 'user' })),
                ...posts.map(p => ({ ...p, _type: 'post' })),
            ];
            setResults(combined);
        } catch (err) {
            console.error('Search error:', err);
        } finally {
            setIsSearching(false);
        }
    }, 400), []);

    const onSearchSubmit = () => {
        if (searchQuery.trim()) {
            saveToHistory(searchQuery.trim());
        }
    };

    const renderSuggestedUsers = () => {
        if (!suggestedUsers || suggestedUsers.length === 0) return null;
        return (
            <View style={{ marginBottom: Spacing.md, paddingTop: Spacing.sm }}>
                <Text style={{ fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginLeft: Spacing.md, marginBottom: Spacing.sm }}>Suggested for you</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: Spacing.sm }}>
                    {suggestedUsers.map(u => (
                        <TouchableOpacity key={u.id} style={{ width: 120, padding: Spacing.sm, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border }} onPress={() => router.push(`/user/${u.id}`)}>
                            {u.avatar ? (
                                <Image source={{ uri: u.avatar }} style={{ width: 60, height: 60, borderRadius: 30, marginBottom: Spacing.xs }} />
                            ) : (
                                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.xs }}>
                                    <Text style={{ color: Colors.text, fontWeight: 'bold' }}>{getInitials(u.displayName)}</Text>
                                </View>
                            )}
                            <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: Colors.text }} numberOfLines={1}>{u.displayName}</Text>
                            <Text style={{ fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.sm }} numberOfLines={1}>@{u.username}</Text>
                        <TouchableOpacity
                            style={[
                                { backgroundColor: Colors.primary, paddingVertical: 6, paddingHorizontal: 12, borderRadius: BorderRadius.sm, width: '100%', alignItems: 'center' },
                                localFollowing.has(u.id) && { backgroundColor: Colors.surfaceLight },
                            ]}
                            disabled={localFollowing.has(u.id)}
                            onPress={async () => {
                                // Optimistic: update UI immediately, fire request in background
                                setLocalFollowing(prev => new Set(prev).add(u.id));
                                setSuggestedUsers(prev => prev.filter(su => su.id !== u.id));
                                await followUser(user.uid, u.id);
                            }}
                        >
                            <Text style={{ color: localFollowing.has(u.id) ? Colors.textSecondary : '#fff', fontSize: FontSize.xs, fontWeight: '600' }}>
                                {localFollowing.has(u.id) ? 'Following' : 'Follow'}
                            </Text>
                        </TouchableOpacity>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        );
    };

    const renderExploreGrid = () => (
        <FlatList
            key="explore-grid-3"
            data={explorePosts}
            numColumns={3}
            ListHeaderComponent={renderSuggestedUsers}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
                <TouchableOpacity
                    style={styles.gridItem}
                    onPress={() => router.push(`/post-feed?type=explore&startIndex=${index}`)}
                >
                    {item.media?.length > 0 ? (() => {
                        const firstMedia = item.media[0];
                        const thumbUri = typeof firstMedia === 'string' ? firstMedia : firstMedia?.uri;
                        return thumbUri ? <Image source={{ uri: thumbUri }} style={styles.gridImage} /> : null;
                    })() : (
                        <View style={styles.gridTextPost}>
                            <Text style={styles.gridText} numberOfLines={4}>{item.content}</Text>
                        </View>
                    )}
                    {item.media?.length > 1 && (
                        <View style={styles.gridMulti}>
                            <Ionicons name="copy-outline" size={14} color="#fff" />
                        </View>
                    )}
                </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
                <View style={styles.emptyState}>
                    <Ionicons name="compass-outline" size={64} color={Colors.textTertiary} />
                    <Text style={styles.emptyTitle}>Explore</Text>
                    <Text style={styles.emptySubtitle}>Posts from the community will appear here</Text>
                </View>
            )}
        />
    );

    const renderSearchResults = () => (
        <FlatList
            key="search-results-1"
            data={results}
            keyExtractor={(item, index) => item.id + index}
            renderItem={({ item }) => {
                if (item._type === 'user') {
                    return (
                        <TouchableOpacity
                            style={styles.userResult}
                            onPress={() => {
                                saveToHistory(item.username || item.displayName);
                                router.push(`/user/${item.id}`);
                            }}
                        >
                            {item.avatar ? (
                                <Image source={{ uri: item.avatar }} style={styles.resultAvatar} />
                            ) : (
                                <View style={[styles.resultAvatar, styles.resultAvatarPlaceholder]}>
                                    <Text style={styles.resultAvatarText}>{getInitials(item.displayName)}</Text>
                                </View>
                            )}
                            <View style={styles.resultInfo}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                    <Text style={styles.resultName}>{item.displayName}</Text>
                                    <PremiumBadge profile={item} size={14} />
                                </View>
                                <Text style={styles.resultUsername}>@{item.username}</Text>
                            </View>
                        </TouchableOpacity>
                    );
                } else {
                    return (
                        <TouchableOpacity
                            style={styles.postResult}
                            onPress={() => {
                                saveToHistory(searchQuery);
                                router.push(`/post/${item.id}`);
                            }}
                        >
                            <View style={styles.postResultIcon}>
                                <Ionicons name="document-text-outline" size={20} color={Colors.textSecondary} />
                            </View>
                            <View style={styles.resultInfo}>
                                <Text style={styles.resultName} numberOfLines={2}>{item.content}</Text>
                                <Text style={styles.resultUsername}>
                                    {item.tags?.length > 0 ? item.tags.map(t => `#${t}`).join(' ') : 'Post'}
                                </Text>
                            </View>
                            {item.media?.length > 0 && (
                                <Image source={{ uri: item.media[0] }} style={styles.postResultThumb} />
                            )}
                        </TouchableOpacity>
                    );
                }
            }}
            ListEmptyComponent={
                searchQuery.length > 1 && !isSearching ? (
                    <View style={styles.noResults}>
                        <Text style={styles.noResultsText}>No results found</Text>
                    </View>
                ) : null
            }
        />
    );

    const renderSearchHistory = () => (
        <View style={styles.historyContainer}>
            <View style={styles.historyHeader}>
                <Text style={styles.historyTitle}>Recent Searches</Text>
                {searchHistory.length > 0 && (
                    <TouchableOpacity onPress={clearHistory}>
                        <Text style={styles.clearText}>Clear All</Text>
                    </TouchableOpacity>
                )}
            </View>
            {searchHistory.map((term, index) => (
                <TouchableOpacity
                    key={index}
                    style={styles.historyItem}
                    onPress={() => {
                        setSearchQuery(term);
                        handleSearch(term);
                        setShowHistory(false);
                    }}
                >
                    <Ionicons name="time-outline" size={18} color={Colors.textTertiary} />
                    <Text style={styles.historyText}>{term}</Text>
                    <TouchableOpacity onPress={() => {
                        const updated = searchHistory.filter((_, i) => i !== index);
                        setSearchHistory(updated);
                        AsyncStorage.setItem('search_history', JSON.stringify(updated));
                    }}>
                        <Ionicons name="close" size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                </TouchableOpacity>
            ))}
        </View>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Search Bar */}
            <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color={Colors.textTertiary} />
                <TextInput
                    ref={searchRef}
                    style={styles.searchInput}
                    placeholder="Search users, posts..."
                    placeholderTextColor={Colors.textTertiary}
                    value={searchQuery}
                    onChangeText={(text) => {
                        setSearchQuery(text);
                        handleSearch(text);
                        setShowHistory(text.length === 0);
                    }}
                    onFocus={() => setShowHistory(searchQuery.length === 0 && searchHistory.length > 0)}
                    onSubmitEditing={onSearchSubmit}
                    returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => {
                        setSearchQuery('');
                        setResults([]);
                        setShowHistory(false);
                    }}>
                        <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                    </TouchableOpacity>
                )}
            </View>

            {showHistory && searchHistory.length > 0
                ? renderSearchHistory()
                : searchQuery.length > 0
                    ? renderSearchResults()
                    : renderExploreGrid()
            }
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    searchBar: {
        flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.md,
        marginVertical: Spacing.sm, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.md, height: 44, gap: Spacing.sm,
        borderWidth: 1, borderColor: Colors.border,
    },
    searchInput: { flex: 1, color: Colors.text, fontSize: FontSize.md },
    // Grid
    gridItem: { width: GRID_SIZE, height: GRID_SIZE, margin: 1 },
    gridImage: { width: '100%', height: '100%' },
    gridTextPost: {
        width: '100%', height: '100%', backgroundColor: Colors.surface,
        justifyContent: 'center', alignItems: 'center', padding: Spacing.sm,
    },
    gridText: { color: Colors.text, fontSize: FontSize.xs, textAlign: 'center' },
    gridMulti: { position: 'absolute', top: 6, right: 6 },
    // Search Results
    userResult: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md, gap: Spacing.md,
    },
    resultAvatar: { width: 48, height: 48, borderRadius: 24 },
    resultAvatarPlaceholder: { backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    resultAvatarText: { color: Colors.primary, fontWeight: 'bold' },
    resultInfo: { flex: 1 },
    resultName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
    resultUsername: { color: Colors.textSecondary, fontSize: FontSize.sm },
    postResult: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md, gap: Spacing.md,
    },
    postResultIcon: {
        width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.surfaceLight,
        justifyContent: 'center', alignItems: 'center',
    },
    postResultThumb: { width: 48, height: 48, borderRadius: 8 },
    noResults: { alignItems: 'center', paddingTop: 40 },
    noResultsText: { color: Colors.textSecondary, fontSize: FontSize.md },
    // History
    historyContainer: { padding: Spacing.lg },
    historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    historyTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: 'bold' },
    clearText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
    historyItem: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingVertical: Spacing.md,
    },
    historyText: { flex: 1, color: Colors.text, fontSize: FontSize.md },
    // Empty
    emptyState: { alignItems: 'center', paddingTop: 80 },
    emptyTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text, marginTop: 16 },
    emptySubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: 8 },
});
