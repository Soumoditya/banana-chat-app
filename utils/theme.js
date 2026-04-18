// BananaChat Dark Theme
export const Colors = {
    // Backgrounds
    background: '#000000',
    surface: '#1A1A1A',
    surfaceLight: '#262626',
    surfaceElevated: '#333333',
    card: '#1A1A1A',

    // Primary accent - Golden Banana
    primary: '#FFD700',
    primaryLight: '#FFE44D',
    primaryDark: '#C8A800',
    primarySurface: 'rgba(255, 215, 0, 0.1)',

    // Secondary accent - Purple
    secondary: '#6C63FF',
    secondaryLight: '#8B84FF',
    secondarySurface: 'rgba(108, 99, 255, 0.1)',

    // Accent colors
    accent: '#00D2FF',
    accentPink: '#FF6B9D',
    accentGreen: '#00E676',
    accentOrange: '#FF9100',

    // Gradients
    gradientPrimary: ['#FFD700', '#FF9100'],
    gradientSecondary: ['#6C63FF', '#00D2FF'],
    gradientPink: ['#FF6B9D', '#FF3D71'],
    gradientDark: ['#000000', '#1A1A1A'],
    gradientGold: ['#FFD700', '#FFA000', '#FF6F00'],

    // Text
    text: '#FFFFFF',
    textSecondary: '#A0A0B8',
    textTertiary: '#6B6B80',
    textInverse: '#0A0A0F',

    // Status
    online: '#00E676',
    offline: '#6B6B80',
    busy: '#FF3D71',
    away: '#FF9100',

    // Semantic
    success: '#00E676',
    error: '#FF3D71',
    warning: '#FF9100',
    info: '#00D2FF',

    // Chat
    messageSent: '#1E1E3A',
    messageReceived: '#2A2A40',
    messageSentText: '#FFFFFF',
    messageReceivedText: '#FFFFFF',

    // Borders
    border: '#262626',
    borderLight: '#333333',

    // Vote
    upvote: '#FF6B9D',
    downvote: '#6C63FF',

    // Reactions
    reactionBg: 'rgba(255, 255, 255, 0.08)',

    // Overlay
    overlay: 'rgba(0, 0, 0, 0.7)',
    overlayLight: 'rgba(0, 0, 0, 0.4)',

    // Streak
    streak: '#FF9100',
    streakFire: '#FF3D00',
};

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
};

export const FontSize = {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 22,
    xxxl: 28,
    title: 34,
};

export const BorderRadius = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    full: 999,
};

export const Shadow = {
    small: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    medium: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    large: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 10,
    },
    glow: (color = '#FFD700') => ({
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    }),
};

export default { Colors, Spacing, FontSize, BorderRadius, Shadow };

// ─── Dynamic Theme Resolution ───
// Merges a premium theme's colors into the base Colors object.
// Falls back to base Colors if themeId is 'default' or unknown.
export const getThemedColors = (themeId) => {
    if (!themeId || themeId === 'default') return { ...Colors };

    // Import inline to avoid circular dependency
    let PREMIUM_THEMES;
    try {
        PREMIUM_THEMES = require('./premium').PREMIUM_THEMES;
    } catch {
        return { ...Colors };
    }

    const theme = PREMIUM_THEMES[themeId];
    if (!theme) return { ...Colors };

    return {
        ...Colors,
        // Override main palette from the theme
        primary: theme.primary || Colors.primary,
        primaryLight: theme.primary ? theme.primary + '80' : Colors.primaryLight,
        primaryDark: theme.primary || Colors.primaryDark,
        primarySurface: theme.primary ? theme.primary + '1A' : Colors.primarySurface,
        secondary: theme.accent || Colors.secondary,
        secondaryLight: theme.accent ? theme.accent + '80' : Colors.secondaryLight,
        secondarySurface: theme.accent ? theme.accent + '1A' : Colors.secondarySurface,
        background: theme.background || Colors.background,
        surface: theme.surface || Colors.surface,
        surfaceLight: theme.surfaceLight || Colors.surfaceLight,
        surfaceElevated: theme.surfaceLight || Colors.surfaceElevated,
        card: theme.surface || Colors.card,
        text: theme.text || Colors.text,
        textSecondary: theme.textSecondary || Colors.textSecondary,
        gradientPrimary: theme.gradient || Colors.gradientPrimary,
        border: theme.surface ? theme.surface + 'CC' : Colors.border,
        borderLight: theme.surfaceLight || Colors.borderLight,
    };
};

// ─── UI Skin Style Resolution ───
// Returns style overrides for card/surface elements based on skin selection.
export const getSkinStyles = (skinId) => {
    if (!skinId || skinId === 'default') {
        return {
            surfaceStyle: {},
            cardStyle: {},
            borderRadius: BorderRadius.lg,
        };
    }

    let UI_SKINS;
    try {
        UI_SKINS = require('./premium').UI_SKINS;
    } catch {
        return { surfaceStyle: {}, cardStyle: {}, borderRadius: BorderRadius.lg };
    }

    const skin = UI_SKINS[skinId];
    if (!skin) return { surfaceStyle: {}, cardStyle: {}, borderRadius: BorderRadius.lg };

    const surfaceStyle = {
        borderRadius: skin.borderRadius || BorderRadius.lg,
        borderWidth: skin.borderWidth || 0.5,
        borderColor: skin.borderColor || 'rgba(255,255,255,0.06)',
        ...(skin.surfaceOpacity < 1 ? { opacity: skin.surfaceOpacity } : {}),
    };

    const cardStyle = {
        ...surfaceStyle,
        ...(skin.cardShadow ? {
            shadowColor: skin.borderColor || '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 8,
        } : {}),
    };

    return {
        surfaceStyle,
        cardStyle,
        borderRadius: skin.borderRadius || BorderRadius.lg,
    };
};
