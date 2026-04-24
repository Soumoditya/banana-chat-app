// ─── Apple Emoji Keyboard/Picker ───
// A scrollable grid of Apple-style emoji that premium users can insert
// into their posts, messages, etc. Uses CDN for Apple emoji images.

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, TextInput, StyleSheet, Dimensions } from 'react-native';
import { Colors } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { APPLE_EMOJI_CDN, emojiToCodePoint } from '../utils/emoji';

// Common emoji organized by category (using unicode code points)
const EMOJI_CATEGORIES = {
    '😀 Smileys': [
        '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇',
        '🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝',
        '🤑','🤗','🤭','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏',
        '😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢',
        '🤮','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟',
        '🙁','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢',
        '😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬',
        '😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖',
    ],
    '👋 Hands': [
        '👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️',
        '🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍',
        '👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏',
    ],
    '❤️ Hearts': [
        '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹',
        '💕','💞','💓','💗','💖','💘','💝','💟',
    ],
    '🐶 Animals': [
        '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮',
        '🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🦆',
        '🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌',
        '🐞','🐜','🪲','🪳','🦟','🦗','🕷️','🐢','🐍','🦎','🦖','🦕',
        '🐙','🦑','🦀','🐠','🐟','🐡','🐬','🦈','🐳','🐋',
    ],
    '🍎 Food': [
        '🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑',
        '🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑',
        '🌽','🥕','🫒','🧄','🧅','🥔','🍠','🍕','🍟','🍔','🌭','🥪',
        '🌮','🌯','🫔','🥙','🧆','🥚','🍳','🥘','🍲','🫕','🥣','🥗',
        '🍿','🧈','🧂','🥫','🍝','🍜','🍛','🍣','🍱','🥟','🦪','🍤',
    ],
    '⚽ Activity': [
        '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓',
        '🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿',
        '🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🏂',
    ],
    '🚗 Travel': [
        '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚',
        '🚛','🚜','🏍️','🛵','🚲','🛴','🛺','🚨','🚔','🚍','🚘','🚖',
        '✈️','🛫','🛬','🛩️','🚀','🛸','🚁','⛵','🚢','🛥️',
    ],
    '💡 Objects': [
        '⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','🖲️','🕹️','🗜️','💾','💿',
        '📀','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺',
        '📻','🎙️','🎚️','🎛️','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡',
        '🔋','🔌','💡','🔦','🕯️','🪔','🧯','🛢️','💸','💵','💴','💶','💷',
    ],
    '🏁 Flags': [
        '🏳️','🏴','🏁','🚩','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️',
        '🇮🇳','🇺🇸','🇬🇧','🇨🇦','🇦🇺','🇯🇵','🇰🇷','🇩🇪','🇫🇷','🇮🇹','🇪🇸','🇧🇷',
    ],
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLS = 8;
const EMOJI_SIZE = (SCREEN_WIDTH - 32) / COLS;

const emojiToCodePoint = (emoji) => {
    const codePoints = [];
    for (const char of emoji) {
        const cp = char.codePointAt(0);
        if (cp !== undefined && cp !== 0xfe0f) {
            codePoints.push(cp.toString(16));
        }
    }
    return codePoints.join('-');
};

const EmojiItem = React.memo(({ emoji, onPress }) => (
    <TouchableOpacity
        style={styles.emojiCell}
        onPress={() => onPress(emoji)}
        activeOpacity={0.6}
    >
        <Image
            source={{ uri: `${APPLE_EMOJI_CDN}/${emojiToCodePoint(emoji)}.png` }}
            style={styles.emojiImage}
            defaultSource={undefined}
        />
    </TouchableOpacity>
));

export default function AppleEmojiPicker({ onEmojiPress, onClose, visible }) {
    const [activeCategory, setActiveCategory] = useState(Object.keys(EMOJI_CATEGORIES)[0]);
    const [searchQuery, setSearchQuery] = useState('');

    const categories = Object.keys(EMOJI_CATEGORIES);
    const currentEmojis = useMemo(() => {
        if (searchQuery) {
            // Search across all categories
            return Object.values(EMOJI_CATEGORIES).flat();
        }
        return EMOJI_CATEGORIES[activeCategory] || [];
    }, [activeCategory, searchQuery]);

    const handleEmojiPress = useCallback((emoji) => {
        onEmojiPress?.(emoji);
    }, [onEmojiPress]);

    if (!visible) return null;

    return (
        <View style={styles.container}>
            {/* Header with close */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Apple Emoji</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <Ionicons name="close" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Category tabs */}
            <FlatList
                horizontal
                data={categories}
                keyExtractor={(item) => item}
                showsHorizontalScrollIndicator={false}
                style={styles.categoryBar}
                renderItem={({ item }) => {
                    const label = item.split(' ')[0]; // Just the emoji
                    const isActive = activeCategory === item;
                    return (
                        <TouchableOpacity
                            style={[styles.categoryTab, isActive && styles.categoryTabActive]}
                            onPress={() => setActiveCategory(item)}
                        >
                            <Text style={styles.categoryEmoji}>{label}</Text>
                        </TouchableOpacity>
                    );
                }}
            />

            {/* Emoji grid */}
            <FlatList
                data={currentEmojis}
                numColumns={COLS}
                keyExtractor={(item, i) => item + i}
                renderItem={({ item }) => (
                    <EmojiItem emoji={item} onPress={handleEmojiPress} />
                )}
                style={styles.emojiGrid}
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
                getItemLayout={(_, index) => ({
                    length: EMOJI_SIZE,
                    offset: EMOJI_SIZE * Math.floor(index / COLS),
                    index,
                })}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.surface,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        maxHeight: 320,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.border,
    },
    headerTitle: {
        color: Colors.text,
        fontSize: 14,
        fontWeight: '600',
    },
    closeBtn: {
        padding: 4,
    },
    categoryBar: {
        maxHeight: 40,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.border,
    },
    categoryTab: {
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    categoryTabActive: {
        borderBottomColor: Colors.primary,
    },
    categoryEmoji: {
        fontSize: 18,
    },
    emojiGrid: {
        flex: 1,
        paddingHorizontal: 8,
        paddingTop: 4,
    },
    emojiCell: {
        width: EMOJI_SIZE,
        height: EMOJI_SIZE,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 4,
    },
    emojiImage: {
        width: EMOJI_SIZE - 12,
        height: EMOJI_SIZE - 12,
        resizeMode: 'contain',
    },
});
