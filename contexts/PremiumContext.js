import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import {
    isPremiumActive, getPlanConfig,
    PREMIUM_THEMES, FONT_STYLES, UI_SKINS, APP_ICONS,
    canUseIOSEmoji as checkIOSEmoji,
    canDownloadMedia as checkDownloadMedia,
} from '../utils/premium';
import { getThemedColors, getSkinStyles } from '../utils/theme';

const PremiumContext = createContext({});

export const usePremium = () => useContext(PremiumContext);

export const PremiumProvider = ({ children }) => {
    const { userProfile } = useAuth();
    const { isDark, colors: baseColors, toggleTheme } = useTheme();

    const value = useMemo(() => {
        const isActive = isPremiumActive(userProfile);
        const plan = getPlanConfig(userProfile);
        const prefs = userProfile?.premiumPreferences || {};

        // ── Resolve active theme ──
        let activeThemeId = 'default';
        if (isActive && prefs.theme && PREMIUM_THEMES[prefs.theme]) {
            const planThemes = plan?.limits?.availableThemes || ['default'];
            if (planThemes === 'all' || (Array.isArray(planThemes) && planThemes.includes(prefs.theme))) {
                activeThemeId = prefs.theme;
            }
        }
        const activeTheme = PREMIUM_THEMES[activeThemeId] || PREMIUM_THEMES.default;
        // Start with light/dark base colors, then layer premium theme on top
        const themedColors = activeThemeId === 'default'
            ? { ...baseColors }
            : { ...baseColors, ...getThemedColors(activeThemeId) };

        // ── Resolve active font ──
        let activeFontId = 'system';
        if (isActive && prefs.fontStyle && FONT_STYLES[prefs.fontStyle]) {
            const planFonts = plan?.limits?.availableFonts || ['system'];
            if (Array.isArray(planFonts) && planFonts.includes(prefs.fontStyle)) {
                activeFontId = prefs.fontStyle;
            }
        }
        const activeFont = FONT_STYLES[activeFontId] || FONT_STYLES.system;

        // ── Resolve active UI skin ──
        let activeSkinId = 'default';
        if (isActive && prefs.uiSkin && UI_SKINS[prefs.uiSkin]) {
            const planSkins = plan?.limits?.availableUISkins || ['default'];
            if (Array.isArray(planSkins) && planSkins.includes(prefs.uiSkin)) {
                activeSkinId = prefs.uiSkin;
            }
        }
        const activeSkin = UI_SKINS[activeSkinId] || UI_SKINS.default;
        const skinStyles = getSkinStyles(activeSkinId);

        // ── Resolve active app icon ──
        let activeIconId = 'default';
        if (isActive && prefs.appIcon && APP_ICONS[prefs.appIcon]) {
            activeIconId = prefs.appIcon;
        }
        const activeIcon = APP_ICONS[activeIconId] || APP_ICONS.default;

        // ── Feature flags ──
        const iosEmojiEnabled = isActive && checkIOSEmoji(userProfile) && prefs.iosEmoji !== false;
        const downloadMediaEnabled = isActive && checkDownloadMedia(userProfile) && prefs.downloadMedia !== false;

        return {
            // Status
            isActive,
            plan,

            // Resolved preferences (these persist until user changes them)
            activeTheme,
            activeThemeId,
            themedColors,
            activeFont,
            activeFontId,
            activeSkin,
            activeSkinId,
            skinStyles,
            activeIcon,
            activeIconId,

            // Feature flags
            iosEmojiEnabled,
            downloadMediaEnabled,

            // Theme mode
            isDark,
            toggleTheme,

            // Raw prefs for settings screen
            prefs,
        };
    }, [userProfile, isDark, baseColors]);

    return (
        <PremiumContext.Provider value={value}>
            {children}
        </PremiumContext.Provider>
    );
};

export default PremiumContext;
