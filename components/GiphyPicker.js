import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Image, Modal, ActivityIndicator } from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';

const GIPHY_API_KEY = '0YQiHpvmRlPiSNelpIwCckmVYJTg22uU';

export default function GiphyPicker({ visible, onClose, onSelect }) {
    const [search, setSearch] = useState('');
    const [gifs, setGifs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('gifs'); // gifs, stickers

    useEffect(() => {
        if (visible) loadTrending();
    }, [visible, activeTab]);

    const loadTrending = async () => {
        setLoading(true);
        try {
            const type = activeTab === 'stickers' ? 'stickers' : 'gifs';
            const res = await fetch(`https://api.giphy.com/v1/${type}/trending?api_key=${GIPHY_API_KEY}&limit=30&rating=pg-13`);
            const data = await res.json();
            setGifs(data.data || []);
        } catch (err) {
            console.error('Giphy error:', err);
        } finally {
            setLoading(false);
        }
    };

    const searchGifs = async (query) => {
        if (!query.trim()) { loadTrending(); return; }
        setLoading(true);
        try {
            const type = activeTab === 'stickers' ? 'stickers' : 'gifs';
            const res = await fetch(`https://api.giphy.com/v1/${type}/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=30&rating=pg-13`);
            const data = await res.json();
            setGifs(data.data || []);
        } catch (err) {
            console.error('Giphy search error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => { if (search) searchGifs(search); }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <View style={styles.container} onStartShouldSetResponder={() => true}>
                    <View style={styles.handle} />

                    {/* Tabs */}
                    <View style={styles.tabs}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'gifs' && styles.tabActive]}
                            onPress={() => setActiveTab('gifs')}
                        >
                            <Text style={[styles.tabText, activeTab === 'gifs' && styles.tabTextActive]}>GIFs</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'stickers' && styles.tabActive]}
                            onPress={() => setActiveTab('stickers')}
                        >
                            <Text style={[styles.tabText, activeTab === 'stickers' && styles.tabTextActive]}>Stickers</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Search */}
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={18} color={Colors.textTertiary} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search GIFs..."
                            placeholderTextColor={Colors.textTertiary}
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>

                    {/* Grid */}
                    {loading ? (
                        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
                    ) : (
                        <FlatList
                            data={gifs}
                            numColumns={2}
                            key="giphy-grid-2"
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.grid}
                            renderItem={({ item }) => {
                                const url = item.images?.fixed_height?.url || item.images?.original?.url;
                                const previewUrl = item.images?.fixed_height_small?.url || url;
                                return (
                                    <TouchableOpacity
                                        style={styles.gifItem}
                                        onPress={() => { onSelect(url, item.title); onClose(); }}
                                    >
                                        <Image source={{ uri: previewUrl }} style={styles.gifImage} resizeMode="cover" />
                                    </TouchableOpacity>
                                );
                            }}
                            ListEmptyComponent={() => (
                                <Text style={styles.emptyText}>No GIFs found</Text>
                            )}
                        />
                    )}

                    {/* Giphy attribution */}
                    <Text style={styles.attribution}>Powered by GIPHY</Text>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    container: {
        backgroundColor: Colors.surfaceElevated, borderTopLeftRadius: 20, borderTopRightRadius: 20,
        maxHeight: '65%', paddingBottom: 16,
    },
    handle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 8 },
    tabs: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.sm },
    tab: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceLight },
    tabActive: { backgroundColor: Colors.primarySurface },
    tabText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
    tabTextActive: { color: Colors.primary },
    searchBar: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceLight,
        borderRadius: BorderRadius.lg, marginHorizontal: Spacing.md, paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs, marginBottom: Spacing.sm, gap: Spacing.sm,
    },
    searchInput: { flex: 1, color: Colors.text, fontSize: FontSize.md },
    grid: { paddingHorizontal: Spacing.sm },
    gifItem: { flex: 1, margin: 2, borderRadius: BorderRadius.md, overflow: 'hidden' },
    gifImage: { width: '100%', height: 140, backgroundColor: Colors.surfaceLight },
    emptyText: { color: Colors.textTertiary, textAlign: 'center', marginTop: 40, fontSize: FontSize.md },
    attribution: { color: Colors.textTertiary, fontSize: 10, textAlign: 'center', marginTop: 4 },
});
