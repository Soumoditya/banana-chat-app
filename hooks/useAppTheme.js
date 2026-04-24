// ─── useAppTheme Hook ───
// Single import for all theming needs across the entire app.
// Provides: themed colors (C), font, skin styles, iOS emoji flag, dark mode toggle.

import { usePremium } from '../contexts/PremiumContext';
import { useEmojiProps } from '../components/EmojiText';

/**
 * Universal theme hook — use in every screen for consistent theming.
 * 
 * Usage:
 *   const { C, font, skin, iosEmoji, isDark, toggleTheme } = useAppTheme();
 *   <View style={{ backgroundColor: C.background }}>
 *     <Text style={{ color: C.text, fontFamily: font }}>Hello</Text>
 *   </View>
 */
export default function useAppTheme() {
    const premium = usePremium();
    const emojiProps = useEmojiProps();

    return {
        // Themed colors (merges light/dark + premium theme)
        C: premium.themedColors,

        // Active font family string (or undefined for system default)
        font: premium.activeFont?.fontFamily || undefined,

        // Skin styles for cards and surfaces
        skin: premium.skinStyles || { surfaceStyle: {}, cardStyle: {}, borderRadius: 16 },

        // iOS emoji flag
        iosEmoji: premium.iosEmojiEnabled || false,

        // Dark mode
        isDark: premium.isDark,
        toggleTheme: premium.toggleTheme,

        // Premium status
        isActive: premium.isActive,
        plan: premium.plan,

        // Raw premium context (for advanced usage)
        premium,
    };
}
