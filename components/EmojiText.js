// ─── Apple Emoji Text Component ───
// Replaces native emoji characters with Apple-style emoji images.
// When enabled (via PremiumContext), all emoji in text will render as Apple emoji
// regardless of the device platform.

import React, { useMemo } from 'react';
import { Text, Image, View } from 'react-native';
import { usePremium } from '../contexts/PremiumContext';
import { APPLE_EMOJI_CDN, emojiToCodePoint, getAppleEmojiUrl } from '../utils/emoji';

// Regex to match emoji characters (covers most common emoji)
const EMOJI_REGEX = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base})/gu;

/**
 * EmojiText - Drop-in replacement for <Text> that renders Apple emoji as images.
 * 
 * Usage: <EmojiText style={...} iosEmoji={true}>Hello 😀 World</EmojiText>
 * 
 * When iosEmoji is false or not provided, behaves like a regular <Text>.
 */
export default function EmojiText({ children, style, iosEmoji = false, emojiSize, ...props }) {
    const content = useMemo(() => {
        if (!iosEmoji || typeof children !== 'string') {
            return children;
        }

        // Split text into segments: regular text and emoji
        const parts = [];
        let lastIndex = 0;
        const text = children;
        
        let match;
        const regex = new RegExp(EMOJI_REGEX.source, 'gu');
        
        while ((match = regex.exec(text)) !== null) {
            // Add text before emoji
            if (match.index > lastIndex) {
                parts.push({
                    type: 'text',
                    content: text.slice(lastIndex, match.index),
                });
            }
            // Add emoji as image
            parts.push({
                type: 'emoji',
                content: match[0],
                url: getAppleEmojiUrl(match[0]),
            });
            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push({
                type: 'text',
                content: text.slice(lastIndex),
            });
        }

        if (parts.length === 0) return children;

        // Determine emoji size from text style
        const flatStyle = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style || {});
        const fontSize = emojiSize || flatStyle.fontSize || 14;
        const imgSize = fontSize * 1.2; // Slightly larger than text

        return parts.map((part, i) => {
            if (part.type === 'emoji') {
                return (
                    <Image
                        key={i}
                        source={{ uri: part.url }}
                        style={{
                            width: imgSize,
                            height: imgSize,
                            resizeMode: 'contain',
                        }}
                    />
                );
            }
            return <Text key={i}>{part.content}</Text>;
        });
    }, [children, iosEmoji, style, emojiSize]);

    // If content is just the original children (not iOS emoji mode), render plain Text
    if (!iosEmoji || typeof children !== 'string') {
        return <Text style={style} {...props}>{children}</Text>;
    }

    // Render with inline emoji images
    return (
        <Text style={style} {...props}>
            {content}
        </Text>
    );
}

/**
 * Utility hook to get emoji rendering props based on premium status.
 * Usage: const emojiProps = useEmojiProps();
 *        <EmojiText {...emojiProps}>text with emoji</EmojiText>
 */
export const useEmojiProps = () => {
    // usePremium is imported at module level.
    try {
        const { iosEmojiEnabled } = usePremium();
        return { iosEmoji: iosEmojiEnabled };
    } catch {
        return { iosEmoji: false };
    }
};
