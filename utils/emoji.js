// ─── Shared Emoji Utilities ───
// Centralized Apple emoji CDN URL and codepoint conversion.
// Used by both EmojiText (inline rendering) and AppleEmojiPicker (picker grid).

export const APPLE_EMOJI_CDN = 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64';

/**
 * Convert an emoji character to its unicode codepoint string (dash-separated).
 * Strips variation selector (U+FE0F) for CDN compatibility.
 * @param {string} emoji - The emoji character(s)
 * @returns {string} Dash-separated hex codepoints, e.g. "1f600"
 */
export const emojiToCodePoint = (emoji) => {
    const codePoints = [];
    for (const char of emoji) {
        const cp = char.codePointAt(0);
        if (cp !== undefined && cp !== 0xfe0f) {
            codePoints.push(cp.toString(16));
        }
    }
    return codePoints.join('-');
};

/**
 * Get the full CDN URL for an Apple-style emoji image.
 * @param {string} emoji - The emoji character(s)
 * @returns {string} Full URL to the 64x64 Apple emoji PNG
 */
export const getAppleEmojiUrl = (emoji) => {
    return `${APPLE_EMOJI_CDN}/${emojiToCodePoint(emoji)}.png`;
};
