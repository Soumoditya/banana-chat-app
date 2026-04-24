import { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Image, TextInput, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchUsers, getUserProfile } from '../services/users';
import { getInitials } from '../utils/helpers';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useToast } from '../contexts/ToastContext';

export default function AddMembersScreen() {
    const { chatId } = useLocalSearchParams();
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { showToast } = useToast();

    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [selected, setSelected] = useState([]);
    const [existingMembers, setExistingMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(false);

    // Load existing group participants so we can grey them out
    useEffect(() => {
        if (!chatId) return;
        getDoc(doc(db, 'chats', chatId)).then(snap => {
            if (snap.exists()) {
                setExistingMembers(snap.data().participants || []);
            }
        }).catch(() => {});
    }, [chatId]);

    // Debounced user search
    useEffect(() => {
        if (query.length < 2) { setResults([]); return; }
        const t = setTimeout(async () => {
            setLoading(true);
            try {
                const users = await searchUsers(query);
                setResults(users.filter(u => u.id !== user?.uid));
            } catch { }
            finally { setLoading(false); }
        }, 400);
        return () => clearTimeout(t);
    }, [query]);

    const toggleSelect = (userId) => {
        if (existingMembers.includes(userId)) return; // already a member
        setSelected(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const handleAdd = async () => {
        if (selected.length === 0) return;
        if (!chatId) { showToast('Invalid chat', 'error'); return; }
        setAdding(true);
        try {
            await updateDoc(doc(db, 'chats', chatId), {
                participants: arrayUnion(...selected),
            });
            showToast(`Added ${selected.length} member${selected.length > 1 ? 's' : ''} to the group`, 'success', 'Done');
            router.back();
        } catch (err) {
            showToast(err.message || 'Could not add members', 'error');
        } finally {
            setAdding(false);
        }
    };

    const renderItem = ({ item }) => {
        const isExisting = existingMembers.includes(item.id);
        const isSelected = selected.includes(item.id);
        return (
            <TouchableOpacity
                style={[styles.userRow, isSelected && styles.userRowSelected]}
                onPress={() => toggleSelect(item.id)}
                disabled={isExisting}
            >
                {item.avatar ? (
                    <Image source={{ uri: item.avatar }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarText}>{getInitials(item.displayName)}</Text>
                    </View>
                )}
                <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.displayName}</Text>
                    <Text style={styles.username}>@{item.username}</Text>
                </View>
                {isExisting ? (
                    <Text style={styles.alreadyLabel}>In group</Text>
                ) : (
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add Members</Text>
                <TouchableOpacity
                    style={[styles.addBtn, selected.length === 0 && styles.addBtnDisabled]}
                    onPress={handleAdd}
                    disabled={selected.length === 0 || adding}
                >
                    {adding ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.addBtnText}>
                            Add{selected.length > 0 ? ` (${selected.length})` : ''}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color={Colors.textSecondary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or username..."
                    placeholderTextColor={Colors.textTertiary}
                    value={query}
                    onChangeText={setQuery}
                    autoFocus
                />
                {loading && <ActivityIndicator size="small" color={Colors.primary} />}
            </View>

            {/* Results */}
            <FlatList
                data={results}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                ListEmptyComponent={() => (
                    <View style={styles.empty}>
                        <Ionicons name="people-outline" size={48} color={Colors.textTertiary} />
                        <Text style={styles.emptyText}>
                            {query.length < 2 ? 'Search for people to add' : 'No results found'}
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
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
        backgroundColor: Colors.surface,
    },
    backBtn: { padding: Spacing.xs, marginRight: Spacing.sm },
    headerTitle: { flex: 1, color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
    addBtn: {
        backgroundColor: Colors.primary, paddingVertical: 8, paddingHorizontal: 16,
        borderRadius: BorderRadius.full,
    },
    addBtnDisabled: { backgroundColor: Colors.surfaceLight },
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
    searchBar: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        marginHorizontal: Spacing.md, marginVertical: Spacing.md,
        backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.xl,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    },
    searchInput: { flex: 1, color: Colors.text, fontSize: FontSize.md },
    userRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    userRowSelected: { backgroundColor: Colors.primarySurface + '30' },
    avatar: { width: 44, height: 44, borderRadius: 22 },
    avatarPlaceholder: {
        backgroundColor: Colors.surfaceLight,
        justifyContent: 'center', alignItems: 'center',
    },
    avatarText: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.md },
    name: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
    username: { color: Colors.textSecondary, fontSize: FontSize.sm },
    alreadyLabel: { color: Colors.textTertiary, fontSize: FontSize.xs, fontStyle: 'italic' },
    checkbox: {
        width: 22, height: 22, borderRadius: 11,
        borderWidth: 2, borderColor: Colors.border,
        justifyContent: 'center', alignItems: 'center',
    },
    checkboxSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
    emptyText: { color: Colors.textSecondary, fontSize: FontSize.md },
});
