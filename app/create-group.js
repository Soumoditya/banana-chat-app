import { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
    Image, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { searchUsers } from '../services/users';
import { createGroupChat } from '../services/chat';
import { getInitials } from '../utils/helpers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../contexts/ToastContext';

export default function CreateGroupScreen() {
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { showToast } = useToast();
    const [groupName, setGroupName] = useState('');
    const [searchText, setSearchText] = useState('');
    const [results, setResults] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (searchText.length >= 2) {
            handleSearch();
        } else {
            setResults([]);
        }
    }, [searchText]);

    const handleSearch = async () => {
        try {
            setLoading(true);
            const users = await searchUsers(searchText);
            // Filter out current user and already selected
            const filtered = users.filter(u => u.id !== user.uid);
            setResults(filtered);
        } catch (err) {
            console.error('Search error:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleUser = (u) => {
        if (selectedUsers.find(s => s.id === u.id)) {
            setSelectedUsers(selectedUsers.filter(s => s.id !== u.id));
        } else {
            setSelectedUsers([...selectedUsers, u]);
        }
    };

    const handleCreate = async () => {
        if (!groupName.trim()) {
            showToast('Please enter a group name', 'error');
            return;
        }
        if (selectedUsers.length < 1) {
            showToast('Please select at least 1 member', 'error');
            return;
        }

        try {
            setCreating(true);
            const memberUids = selectedUsers.map(u => u.id);
            const result = await createGroupChat(groupName.trim(), user.uid, memberUids, false);
            router.replace(`/chat/${result.id}`);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setCreating(false);
        }
    };

    const renderUser = ({ item }) => {
        const isSelected = selectedUsers.find(s => s.id === item.id);
        return (
            <TouchableOpacity style={styles.userItem} onPress={() => toggleUser(item)}>
                {item.avatar ? (
                    <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
                ) : (
                    <View style={[styles.userAvatar, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarInitials}>{getInitials(item.displayName)}</Text>
                    </View>
                )}
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.displayName}</Text>
                    <Text style={styles.userHandle}>@{item.username}</Text>
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                    {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>New Group</Text>
                <TouchableOpacity
                    style={[styles.createBtn, creating && styles.createBtnDisabled]}
                    onPress={handleCreate}
                    disabled={creating}
                >
                    {creating ? (
                        <ActivityIndicator size="small" color={Colors.textInverse} />
                    ) : (
                        <Text style={styles.createBtnText}>Create</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Group Name */}
            <View style={styles.nameSection}>
                <View style={styles.groupIcon}>
                    <Ionicons name="people" size={28} color={Colors.primary} />
                </View>
                <TextInput
                    style={styles.nameInput}
                    placeholder="Group name"
                    placeholderTextColor={Colors.textTertiary}
                    value={groupName}
                    onChangeText={setGroupName}
                    maxLength={50}
                />
            </View>

            {/* Selected Users */}
            {selectedUsers.length > 0 && (
                <View style={styles.selectedSection}>
                    <FlatList
                        horizontal
                        data={selectedUsers}
                        keyExtractor={(item) => item.id}
                        showsHorizontalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.selectedChip} onPress={() => toggleUser(item)}>
                                <Text style={styles.selectedName}>{item.displayName}</Text>
                                <Ionicons name="close-circle" size={16} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        )}
                    />
                </View>
            )}

            {/* Search */}
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color={Colors.textTertiary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search users to add..."
                    placeholderTextColor={Colors.textTertiary}
                    value={searchText}
                    onChangeText={setSearchText}
                    autoCapitalize="none"
                />
            </View>

            {/* Results */}
            {loading && <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />}
            <FlatList
                data={results}
                renderItem={renderUser}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    searchText.length >= 2 && !loading ? (
                        <Text style={styles.emptyText}>No users found</Text>
                    ) : null
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
        backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    headerTitle: { fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text },
    createBtn: {
        backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm, borderRadius: BorderRadius.full,
    },
    createBtnDisabled: { opacity: 0.6 },
    createBtnText: { color: Colors.textInverse, fontWeight: 'bold', fontSize: FontSize.sm },
    nameSection: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg,
        backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    groupIcon: {
        width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.surfaceLight,
        justifyContent: 'center', alignItems: 'center',
    },
    nameInput: {
        flex: 1, color: Colors.text, fontSize: FontSize.lg, fontWeight: '500',
    },
    selectedSection: {
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
        borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    selectedChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.full,
        paddingHorizontal: Spacing.md, paddingVertical: 6, marginRight: Spacing.sm,
    },
    selectedName: { color: Colors.text, fontSize: FontSize.sm },
    searchContainer: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.surfaceLight, marginHorizontal: Spacing.lg,
        marginVertical: Spacing.md, borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.md, height: 40,
    },
    searchInput: { flex: 1, color: Colors.text, fontSize: FontSize.md, marginLeft: Spacing.sm },
    listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
    userItem: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md,
        borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    userAvatar: { width: 44, height: 44, borderRadius: 22 },
    avatarPlaceholder: {
        backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center',
    },
    avatarInitials: { color: Colors.primary, fontWeight: 'bold', fontSize: FontSize.md },
    userInfo: { flex: 1, marginLeft: Spacing.md },
    userName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
    userHandle: { color: Colors.textTertiary, fontSize: FontSize.sm },
    checkbox: {
        width: 24, height: 24, borderRadius: 12, borderWidth: 2,
        borderColor: Colors.border, justifyContent: 'center', alignItems: 'center',
    },
    checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    emptyText: {
        color: Colors.textTertiary, textAlign: 'center', marginTop: 40, fontSize: FontSize.md,
    },
});
