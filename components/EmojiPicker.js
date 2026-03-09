import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal } from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';

const EMOJI_CATEGORIES = {
    'Smileys': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
    'Gestures': ['👍','👎','👊','✊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👋','🤚','🖐️','✋','🖖','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄','💋'],
    'Hearts': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','🔥','💯','✨','⭐','🌟','💫','💥','💢','💨','💦','🎉','🎊'],
    'Animals': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🦭','🐊'],
    'Food': ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🫔','🥙','🧆','🥚','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯'],
    'Objects': ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🥅','⛳','🪃','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','⛸️','🎿','⛷️','🏂','🪂','🎮','🕹️','🎲','🧩','♟️','🎯','🎳','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🪗','🎸','🪕','🎻','🎪','🎠','🎡','🎢'],
};

export default function EmojiPicker({ visible, onClose, onSelect }) {
    const [activeCategory, setActiveCategory] = useState('Smileys');
    const [search, setSearch] = useState('');

    const categories = Object.keys(EMOJI_CATEGORIES);

    const displayEmojis = useMemo(() => {
        if (search.trim()) {
            // When searching, show all emojis
            const all = Object.values(EMOJI_CATEGORIES).flat();
            return all;
        }
        return EMOJI_CATEGORIES[activeCategory] || [];
    }, [activeCategory, search]);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <View style={styles.container} onStartShouldSetResponder={() => true}>
                    <View style={styles.handle} />

                    {/* Category Tabs */}
                    <FlatList
                        horizontal
                        data={categories}
                        keyExtractor={(item) => item}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoryRow}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[styles.categoryTab, activeCategory === item && styles.categoryTabActive]}
                                onPress={() => setActiveCategory(item)}
                            >
                                <Text style={[styles.categoryText, activeCategory === item && styles.categoryTextActive]}>
                                    {EMOJI_CATEGORIES[item][0]} {item}
                                </Text>
                            </TouchableOpacity>
                        )}
                    />

                    {/* Emoji Grid */}
                    <FlatList
                        data={displayEmojis}
                        numColumns={8}
                        key="emoji-grid-8"
                        keyExtractor={(item, index) => `${item}-${index}`}
                        contentContainerStyle={styles.emojiGrid}
                        renderItem={({ item: emoji }) => (
                            <TouchableOpacity
                                style={styles.emojiBtn}
                                onPress={() => { onSelect(emoji); onClose(); }}
                            >
                                <Text style={styles.emoji}>{emoji}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    container: {
        backgroundColor: Colors.surfaceElevated, borderTopLeftRadius: 20, borderTopRightRadius: 20,
        maxHeight: '55%', paddingBottom: 20,
    },
    handle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 8 },
    categoryRow: { paddingHorizontal: Spacing.sm, gap: 4, paddingBottom: Spacing.sm },
    categoryTab: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceLight },
    categoryTabActive: { backgroundColor: Colors.primarySurface },
    categoryText: { color: Colors.textSecondary, fontSize: FontSize.xs },
    categoryTextActive: { color: Colors.primary },
    emojiGrid: { paddingHorizontal: Spacing.sm },
    emojiBtn: { flex: 1, aspectRatio: 1, justifyContent: 'center', alignItems: 'center', maxWidth: '12.5%' },
    emoji: { fontSize: 28 },
});
