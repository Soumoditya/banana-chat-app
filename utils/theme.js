// BananaChat Dark Theme
export const Colors = {
    // Backgrounds
    background: '#0A0A0F',
    surface: '#12121A',
    surfaceLight: '#1A1A2E',
    surfaceElevated: '#222236',
    card: '#16162A',

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
    gradientDark: ['#0A0A0F', '#1A1A2E'],
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
    border: '#2A2A3E',
    borderLight: '#3A3A50',

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
