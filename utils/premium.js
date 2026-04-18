// ─── Premium Plan Definitions, Feature Gating & User Preferences ───
// 6-tier plan system: Standard → Premium → Premium+ → Elite → Super → VIP

// ─── Plan Hierarchy (for comparison/upgrade logic) ───
export const PLAN_TIERS = ['standard', 'premium', 'premium_plus', 'elite', 'super', 'vip'];

export const getPlanTier = (planId) => PLAN_TIERS.indexOf(planId);
export const isHigherPlan = (planA, planB) => getPlanTier(planA) > getPlanTier(planB);

// ─── Font Styles ───
export const FONT_STYLES = {
    system: { id: 'system', name: 'System Default', fontFamily: undefined, minPlan: null },
    serif: { id: 'serif', name: 'Elegant Serif', fontFamily: 'serif', minPlan: 'premium' },
    monospace: { id: 'monospace', name: 'Monospace', fontFamily: 'monospace', minPlan: 'premium' },
    rounded: { id: 'rounded', name: 'Rounded', fontFamily: 'System', minPlan: 'premium' },
    condensed: { id: 'condensed', name: 'Condensed', fontFamily: 'sans-serif-condensed', minPlan: 'premium_plus' },
    handwritten: { id: 'handwritten', name: 'Handwritten', fontFamily: 'cursive', minPlan: 'premium_plus' },
    display: { id: 'display', name: 'Display Bold', fontFamily: 'sans-serif-medium', minPlan: 'elite' },
    futuristic: { id: 'futuristic', name: 'Futuristic', fontFamily: 'sans-serif-light', minPlan: 'elite' },
};

// ─── Premium Themes ───
export const PREMIUM_THEMES = {
    default: {
        id: 'default', name: 'Midnight', minPlan: null,
        primary: '#FFD700', accent: '#6C63FF',
        background: '#000000', surface: '#1A1A1A', surfaceLight: '#262626',
        text: '#FFFFFF', textSecondary: '#A0A0B8',
        gradient: ['#FFD700', '#FF9100'],
    },
    ocean: {
        id: 'ocean', name: 'Deep Ocean', minPlan: 'premium',
        primary: '#06B6D4', accent: '#0EA5E9',
        background: '#0A1628', surface: '#162033', surfaceLight: '#1E2D45',
        text: '#E0F2FE', textSecondary: '#7DD3FC',
        gradient: ['#06B6D4', '#3B82F6'],
    },
    emerald: {
        id: 'emerald', name: 'Emerald Night', minPlan: 'premium',
        primary: '#10B981', accent: '#34D399',
        background: '#0A1F14', surface: '#142B1E', surfaceLight: '#1E3B2A',
        text: '#D1FAE5', textSecondary: '#6EE7B7',
        gradient: ['#10B981', '#059669'],
    },
    rose: {
        id: 'rose', name: 'Rose Gold', minPlan: 'premium_plus',
        primary: '#F472B6', accent: '#FB7185',
        background: '#1A0A14', surface: '#2A1520', surfaceLight: '#3A202A',
        text: '#FFF1F2', textSecondary: '#FDA4AF',
        gradient: ['#F472B6', '#E11D48'],
    },
    neon: {
        id: 'neon', name: 'Neon Pulse', minPlan: 'premium_plus',
        primary: '#00FF88', accent: '#FF00FF',
        background: '#0A0A1A', surface: '#1A1A2E', surfaceLight: '#252540',
        text: '#E0FFE0', textSecondary: '#A0FFA0',
        gradient: ['#00FF88', '#00BFFF'],
    },
    purple_haze: {
        id: 'purple_haze', name: 'Purple Haze', minPlan: 'premium_plus',
        primary: '#A855F7', accent: '#7C3AED',
        background: '#0F0520', surface: '#1A0F2E', surfaceLight: '#2A1A40',
        text: '#F3E8FF', textSecondary: '#C4B5FD',
        gradient: ['#A855F7', '#7C3AED'],
    },
    amber: {
        id: 'amber', name: 'Amber Glow', minPlan: 'elite',
        primary: '#F59E0B', accent: '#FBBF24',
        background: '#1A1200', surface: '#2A2000', surfaceLight: '#3A3010',
        text: '#FEF3C7', textSecondary: '#FCD34D',
        gradient: ['#F59E0B', '#D97706'],
    },
    arctic: {
        id: 'arctic', name: 'Arctic Frost', minPlan: 'elite',
        primary: '#E2E8F0', accent: '#94A3B8',
        background: '#0F172A', surface: '#1E293B', surfaceLight: '#334155',
        text: '#F1F5F9', textSecondary: '#CBD5E1',
        gradient: ['#E2E8F0', '#94A3B8'],
    },
    aurora: {
        id: 'aurora', name: 'Aurora Borealis', minPlan: 'super',
        primary: '#06FFA5', accent: '#A855F7',
        background: '#050B1A', surface: '#0A1528', surfaceLight: '#152238',
        text: '#E0FFF0', textSecondary: '#80FFD0',
        gradient: ['#06FFA5', '#A855F7', '#3B82F6'],
    },
    obsidian: {
        id: 'obsidian', name: 'Obsidian', minPlan: 'vip',
        primary: '#E5E5E5', accent: '#A0A0A0',
        background: '#050505', surface: '#0E0E0E', surfaceLight: '#1A1A1A',
        text: '#F0F0F0', textSecondary: '#909090',
        gradient: ['#555555', '#222222'],
    },
};

// ─── UI Skins ───
export const UI_SKINS = {
    default: {
        id: 'default', name: 'Classic Dark', minPlan: null,
        surfaceOpacity: 1, borderRadius: 16, blur: 0,
        borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
        cardShadow: false, description: 'Standard dark interface',
    },
    glass: {
        id: 'glass', name: 'Glassmorphism', minPlan: 'elite',
        surfaceOpacity: 0.6, borderRadius: 20, blur: 20,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
        cardShadow: true, description: 'Semi-transparent glass surfaces with blur',
    },
    liquid_glass: {
        id: 'liquid_glass', name: 'Liquid Glass', minPlan: 'super',
        surfaceOpacity: 0.4, borderRadius: 24, blur: 30,
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)',
        cardShadow: true, description: 'Apple-style fluid glass with depth & refraction',
    },
    neon_glow: {
        id: 'neon_glow', name: 'Neon Glow', minPlan: 'super',
        surfaceOpacity: 0.8, borderRadius: 16, blur: 10,
        borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)',
        cardShadow: true, description: 'Dark surfaces with glowing neon edges',
    },
    aurora_shift: {
        id: 'aurora_shift', name: 'Aurora Shift', minPlan: 'vip',
        surfaceOpacity: 0.5, borderRadius: 28, blur: 25,
        borderWidth: 1.5, borderColor: 'rgba(168,85,247,0.2)',
        cardShadow: true, description: 'Gradient-shifting translucent surfaces',
    },
};

// ─── App Icon Images ───
const APP_ICON_IMAGES = {
    default: require('../assets/icon.png'),
    spiderman: require('../assets/images/icons/spiderman.png'),
    homelander: require('../assets/images/icons/homelander.png'),
    ironman: require('../assets/images/icons/ironman.png'),
    emperor_viltrum: require('../assets/images/icons/emperor_viltrum.png'),
    ben10: require('../assets/images/icons/ben10.png'),
    invincible: require('../assets/images/icons/invincible.png'),
    viltrum_mark: require('../assets/images/icons/viltrum-mark.png'),
};

// ─── App Icons ───
export const APP_ICONS = {
    default: {
        id: 'default', name: 'Classic Banana', minPlan: null,
        image: APP_ICON_IMAGES.default, accentColor: '#FFD700',
        description: 'The original Banana Chat icon',
    },
    spiderman: {
        id: 'spiderman', name: 'Spiderman', minPlan: 'standard',
        image: APP_ICON_IMAGES.spiderman, accentColor: '#E23636',
        description: 'Your friendly neighborhood banana',
    },
    homelander: {
        id: 'homelander', name: 'Homelander', minPlan: 'premium',
        image: APP_ICON_IMAGES.homelander, accentColor: '#1DA1F2',
        description: 'The world\'s greatest banana',
    },
    ironman: {
        id: 'ironman', name: 'Ironman', minPlan: 'premium_plus',
        image: APP_ICON_IMAGES.ironman, accentColor: '#FF4444',
        description: 'I am Banana Man',
    },
    emperor_viltrum: {
        id: 'emperor_viltrum', name: 'Emperor Viltrum', minPlan: 'elite',
        image: APP_ICON_IMAGES.emperor_viltrum, accentColor: '#A855F7',
        description: 'Ruler of the Viltrum empire',
    },
    ben10: {
        id: 'ben10', name: 'Ben 10', minPlan: 'elite',
        image: APP_ICON_IMAGES.ben10, accentColor: '#00E676',
        description: 'It\'s hero time!',
    },
    invincible: {
        id: 'invincible', name: 'Invincible', minPlan: 'super',
        image: APP_ICON_IMAGES.invincible, accentColor: '#FFD700',
        description: 'Think, Mark, Think!',
    },
    viltrum_mark: {
        id: 'viltrum_mark', name: 'Viltrum Mark', minPlan: 'super',
        image: APP_ICON_IMAGES.viltrum_mark, accentColor: '#E23636',
        description: 'The son of Nolan',
    },
    custom: {
        id: 'custom', name: 'Custom Icon', minPlan: 'super',
        image: null, accentColor: '#FFD700',
        description: 'Upload your own custom icon',
        requiresCustom: true,
    },
};

// ─── Plan Definitions ───
export const PREMIUM_PLANS = {
    standard: {
        id: 'standard',
        name: 'Standard',
        price: 99,
        priceLabel: '₹99/mo',
        badge: 'blue_tick',
        badgeColor: '#1DA1F2',
        badgeIcon: 'checkmark-circle',
        tagline: 'Get verified & use iOS emojis',
        features: [
            'Blue verified tick ✓',
            'iOS emoji support (view & send)',
            '15 media per post',
            '800 character posts',
            'Ad-free experience',
        ],
        limits: {
            maxMedia: 15,
            maxPostLength: 800,
            maxStoryDuration: 24,
            canUseIOSEmoji: true,
            canDownloadMedia: false,
            hasProfileAnalytics: false,
            hasPrioritySearch: false,
            availableFonts: ['system'],
            availableThemes: ['default'],
            availableUISkins: ['default'],
            availableIcons: ['default', 'spiderman'],
        },
    },
    premium: {
        id: 'premium',
        name: 'Premium',
        price: 199,
        priceLabel: '₹199/mo',
        badge: 'gold_tick',
        badgeColor: '#FFD700',
        badgeIcon: 'checkmark-circle',
        tagline: 'Golden tick & unlock customization',
        features: [
            'Gold verified tick ✓',
            'Everything in Standard',
            '3 custom font styles',
            '2 premium themes',
            '18 media per post',
            '1000 character posts',
            'Download any media',
        ],
        limits: {
            maxMedia: 18,
            maxPostLength: 1000,
            maxStoryDuration: 30,
            canUseIOSEmoji: true,
            canDownloadMedia: true,
            hasProfileAnalytics: false,
            hasPrioritySearch: false,
            availableFonts: ['system', 'serif', 'monospace', 'rounded'],
            availableThemes: ['default', 'ocean', 'emerald'],
            availableUISkins: ['default'],
            availableIcons: ['default', 'spiderman', 'homelander'],
        },
    },
    premium_plus: {
        id: 'premium_plus',
        name: 'Premium+',
        price: 299,
        priceLabel: '₹299/mo',
        badge: 'gold_plus',
        badgeColor: '#F59E0B',
        badgeIcon: 'add-circle',
        tagline: 'The complete gold experience',
        popular: true,
        features: [
            'Gold + verified badge',
            'Everything in Premium',
            '5 font styles',
            '5 premium themes',
            '3 app icon styles',
            '20 media per post',
            '1200 character posts',
            'Profile analytics',
        ],
        limits: {
            maxMedia: 20,
            maxPostLength: 1200,
            maxStoryDuration: 36,
            canUseIOSEmoji: true,
            canDownloadMedia: true,
            hasProfileAnalytics: true,
            hasPrioritySearch: false,
            availableFonts: ['system', 'serif', 'monospace', 'rounded', 'condensed', 'handwritten'],
            availableThemes: ['default', 'ocean', 'emerald', 'rose', 'neon', 'purple_haze'],
            availableUISkins: ['default'],
            availableIcons: ['default', 'spiderman', 'homelander', 'ironman'],
        },
    },
    elite: {
        id: 'elite',
        name: 'Elite',
        price: 399,
        priceLabel: '₹399/mo',
        badge: 'purple_tick',
        badgeColor: '#A855F7',
        badgeIcon: 'shield-checkmark',
        tagline: 'Purple royalty with glass UI',
        features: [
            'Purple verified tick ✓',
            'Everything in Premium+',
            'All font styles',
            'All premium themes',
            'Glassmorphism UI skin',
            '6 app icon styles',
            '30 media per post',
            '1500 character posts',
            'Priority in search & explore',
        ],
        limits: {
            maxMedia: 30,
            maxPostLength: 1500,
            maxStoryDuration: 42,
            canUseIOSEmoji: true,
            canDownloadMedia: true,
            hasProfileAnalytics: true,
            hasPrioritySearch: true,
            availableFonts: Object.keys(FONT_STYLES),
            availableThemes: ['default', 'ocean', 'emerald', 'rose', 'neon', 'purple_haze', 'amber', 'arctic'],
            availableUISkins: ['default', 'glass'],
            availableIcons: ['default', 'spiderman', 'homelander', 'ironman', 'emperor_viltrum', 'ben10'],
        },
    },
    super: {
        id: 'super',
        name: 'Super',
        price: 499,
        priceLabel: '₹499/mo',
        badge: 'golden_banana',
        badgeColor: '#FFD700',
        badgeIcon: 'star',
        tagline: 'Golden banana — ultimate flex',
        features: [
            'Golden banana badge 🍌',
            'Everything in Elite',
            'All UI skins (Liquid Glass, Neon Glow)',
            'All app icons + custom upload',
            'Unlimited media uploads',
            '2000 character posts',
            '48h extended stories',
        ],
        limits: {
            maxMedia: 999,
            maxPostLength: 2000,
            maxStoryDuration: 48,
            canUseIOSEmoji: true,
            canDownloadMedia: true,
            hasProfileAnalytics: true,
            hasPrioritySearch: true,
            availableFonts: Object.keys(FONT_STYLES),
            availableThemes: Object.keys(PREMIUM_THEMES).filter(k => k !== 'obsidian'),
            availableUISkins: ['default', 'glass', 'liquid_glass', 'neon_glow'],
            availableIcons: 'all',
        },
    },
    vip: {
        id: 'vip',
        name: 'VIP',
        price: 999,
        priceLabel: '₹999/mo',
        badge: 'black_banana',
        badgeColor: '#1A1A1A',
        badgeIcon: 'star',
        tagline: 'The ultimate Banana experience',
        features: [
            'Black banana badge 🖤',
            'Custom icon upload',
            'Everything in Super',
            'VIP exclusive flair',
            'Aurora Shift UI skin',
            'Obsidian theme',
            '3000 character posts',
            '72h extended stories',
            'All future premium features',
            'First access to new features',
        ],
        limits: {
            maxMedia: 999,
            maxPostLength: 3000,
            maxStoryDuration: 72,
            canUseIOSEmoji: true,
            canDownloadMedia: true,
            hasProfileAnalytics: true,
            hasPrioritySearch: true,
            availableFonts: Object.keys(FONT_STYLES),
            availableThemes: Object.keys(PREMIUM_THEMES),
            availableUISkins: Object.keys(UI_SKINS),
            availableIcons: 'all',
        },
    },
};

// Free user defaults
export const FREE_LIMITS = {
    maxMedia: 12,
    maxPostLength: 500,
    maxStoryDuration: 24,
    canUseIOSEmoji: false,
    canDownloadMedia: false,
    hasProfileAnalytics: false,
    hasPrioritySearch: false,
    availableFonts: ['system'],
    availableThemes: ['default'],
    availableUISkins: ['default'],
    availableIcons: ['default'],
};

// ─── Helper Functions ───

/**
 * Get a user's premium plan config, or null if free
 */
export const getPlanConfig = (profile) => {
    if (!profile?.isPremium || !profile?.premiumPlan) return null;
    // Check expiry
    if (profile.premiumExpiresAt) {
        const expiryDate = profile.premiumExpiresAt?.toDate
            ? profile.premiumExpiresAt.toDate()
            : new Date(profile.premiumExpiresAt);
        if (expiryDate < new Date()) return null;
    }
    return PREMIUM_PLANS[profile.premiumPlan] || null;
};

/**
 * Check if a user is currently premium (not expired)
 */
export const isPremiumActive = (profile) => {
    return getPlanConfig(profile) !== null;
};

/**
 * Get the badge type for a user
 */
export const getBadgeType = (profile) => {
    const plan = getPlanConfig(profile);
    return plan?.badge || null;
};

/**
 * Get badge color
 */
export const getBadgeColor = (profile) => {
    const plan = getPlanConfig(profile);
    return plan?.badgeColor || null;
};

/**
 * Get the max number of media a user can attach
 */
export const getMaxMedia = (profile) => {
    const plan = getPlanConfig(profile);
    return plan?.limits?.maxMedia || FREE_LIMITS.maxMedia;
};

/**
 * Get the max post character length
 */
export const getMaxPostLength = (profile) => {
    const plan = getPlanConfig(profile);
    return plan?.limits?.maxPostLength || FREE_LIMITS.maxPostLength;
};

/**
 * Check if user can download media
 */
export const canDownloadMedia = (profile) => {
    const plan = getPlanConfig(profile);
    return plan?.limits?.canDownloadMedia || false;
};

/**
 * Check if user can use iOS emojis
 */
export const canUseIOSEmoji = (profile) => {
    const plan = getPlanConfig(profile);
    return plan?.limits?.canUseIOSEmoji || false;
};

/**
 * Check if user has profile analytics
 */
export const hasProfileAnalytics = (profile) => {
    const plan = getPlanConfig(profile);
    return plan?.limits?.hasProfileAnalytics || false;
};

/**
 * Check if user gets priority in search
 */
export const hasPrioritySearch = (profile) => {
    const plan = getPlanConfig(profile);
    return plan?.limits?.hasPrioritySearch || false;
};

/**
 * Get available fonts for user's plan
 */
export const getAvailableFonts = (profile) => {
    const plan = getPlanConfig(profile);
    const fontIds = plan?.limits?.availableFonts || FREE_LIMITS.availableFonts;
    return fontIds.map(id => FONT_STYLES[id]).filter(Boolean);
};

/**
 * Get available themes for user's plan
 */
export const getAvailableThemes = (profile) => {
    const plan = getPlanConfig(profile);
    const themeIds = plan?.limits?.availableThemes || FREE_LIMITS.availableThemes;
    return themeIds.map(id => PREMIUM_THEMES[id]).filter(Boolean);
};

/**
 * Get available UI skins for user's plan
 */
export const getAvailableUISkins = (profile) => {
    const plan = getPlanConfig(profile);
    const skinIds = plan?.limits?.availableUISkins || FREE_LIMITS.availableUISkins;
    return skinIds.map(id => UI_SKINS[id]).filter(Boolean);
};

/**
 * Get available app icons for user's plan
 */
export const getAvailableIcons = (profile) => {
    const plan = getPlanConfig(profile);
    const iconConfig = plan?.limits?.availableIcons || FREE_LIMITS.availableIcons;
    if (iconConfig === 'all') {
        return Object.values(APP_ICONS);
    }
    return (iconConfig || ['default']).map(id => APP_ICONS[id]).filter(Boolean);
};

/**
 * Check if user can upload a custom app icon
 */
export const canUseCustomIcon = (profile) => {
    const plan = getPlanConfig(profile);
    if (!plan) return false;
    // Super and VIP tiers can upload custom icons
    const tier = getPlanTier(plan.id);
    return tier >= getPlanTier('super');
};

/**
 * Get the premium flair/tag text for display
 */
export const getPremiumFlair = (profile) => {
    const plan = getPlanConfig(profile);
    if (!plan) return null;
    if (plan.id === 'vip') return 'VIP';
    if (plan.id === 'super') return 'Super';
    if (plan.id === 'elite') return 'Elite';
    if (plan.id === 'premium_plus') return 'Premium+';
    if (plan.id === 'premium') return 'Premium';
    if (plan.id === 'standard') return 'Standard';
    return 'Premium';
};

/**
 * Get plan display name
 */
export const getPlanName = (planId) => {
    return PREMIUM_PLANS[planId]?.name || 'Free';
};

/**
 * Get the story duration limit in hours
 */
export const getStoryDuration = (profile) => {
    const plan = getPlanConfig(profile);
    return (plan?.limits?.maxStoryDuration || FREE_LIMITS.maxStoryDuration) * 60 * 60 * 1000;
};
