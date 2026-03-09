import { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getInitials } from '../utils/helpers';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function HideStoryFromScreen() {
    const router = useRouter();
    const { user, userProfile } = useAuth();
    const insets = useSafeAreaInsets();
    const [search, setSearch] = useState('');
    const [people, setPeople] = useState([]);
    const [hiddenIds, setHiddenIds] = useState([]);

    useEffect(() => { loadPeople(); }, []);

    const loadPeople = async () => {
        const followingIds = [
            ...(userProfile?.following || []),
            ...(userProfile?.followers || []),
            ...(userProfile?.friends || []),
        ];
        const uniqueIds = [...new Set(followingIds)].slice(0, 30);
        if (uniqueIds.length === 0) return;

        const batches = [];
        for (let i = 0; i < uniqueIds.length; i += 10) {
            batches.push(uniqueIds.slice(i, i + 10));
        }

        let allPeople = [];
        for (const batch of batches) {
            const q = query(collection(db, 'users'), where('__name__', 'in', batch));
            const snap = await getDocs(q);
            allPeople = [...allPeople, ...snap.docs.map(d => ({ id: d.id, ...d.data() }))];
        }
        setPeople(allPeople);
    };

    const toggleHide = (id) => {
        setHiddenIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleDone = () => {
        // Pass hidden IDs back via router params
        router.back();
        // The parent screen reads hiddenIds from a shared state or we use a callback
        // For simplicity, we use global state via params
        if (router.canGoBack()) {
            router.setParams({ hiddenFrom: JSON.stringify(hiddenIds) });
        }
    };

    const filtered = search
        ? people.filter(p =>
            p.displayName?.toLowerCase().includes(search.toLowerCase()) ||
            p.username?.toLowerCase().includes(search.toLowerCase())
        )
        : people;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Hide Story From</Text>
                <TouchableOpacity onPress={handleDone}>
                    <Text style={styles.doneText}>Done ({hiddenIds.length})</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.info}>
                <Ionicons name="eye-off-outline" size={18} color={Colors.accent} />
                <Text style={styles.infoText}>
                    Selected people won't see this story. They won't know they've been hidden.
                </Text>
            </View>

            <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color={Colors.textTertiary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search people..."
                    placeholderTextColor={Colors.textTertiary}
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                    const isHidden = hiddenIds.includes(item.id);
                    return (
                        <TouchableOpacity style={styles.personItem} onPress={() => toggleHide(item.id)}>
                            {item.avatar ? (
                                <Image source={{ uri: item.avatar }} style={styles.personAvatar} />
                            ) : (
                                <View style={[styles.personAvatar, styles.avatarPlaceholder]}>
                                    <Text style={styles.avatarInitials}>{getInitials(item.displayName)}</Text>
                                </View>
                            )}
                            <View style={styles.personInfo}>
                                <Text style={styles.personName}>{item.displayName}</Text>
                                <Text style={styles.personUsername}>@{item.username}</Text>
                            </View>
                            <View style={[styles.checkbox, isHidden && styles.checkboxActive]}>
                                {isHidden && <Ionicons name="eye-off" size={14} color="#fff" />}
                            </View>
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={() => (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>No people to show</Text>
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
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    headerTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text },
    doneText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '700' },
    info: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        padding: Spacing.md, margin: Spacing.lg, backgroundColor: Colors.surfaceLight,
        borderRadius: BorderRadius.md,
    },
    infoText: { flex: 1, color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 18 },
    searchBar: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        marginHorizontal: Spacing.lg, backgroundColor: Colors.surfaceLight,
        borderRadius: BorderRadius.xl, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
        marginBottom: Spacing.md,
    },
    searchInput: { flex: 1, color: Colors.text, fontSize: FontSize.md },
    personItem: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md, gap: Spacing.md,
    },
    personAvatar: { width: 44, height: 44, borderRadius: 22 },
    avatarPlaceholder: { backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    avatarInitials: { color: Colors.primary, fontWeight: 'bold' },
    personInfo: { flex: 1 },
    personName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
    personUsername: { color: Colors.textSecondary, fontSize: FontSize.sm },
    checkbox: {
        width: 26, height: 26, borderRadius: 13, borderWidth: 2,
        borderColor: Colors.border, justifyContent: 'center', alignItems: 'center',
    },
    checkboxActive: { borderColor: Colors.error, backgroundColor: Colors.error },
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { color: Colors.textTertiary, fontSize: FontSize.md },
});
