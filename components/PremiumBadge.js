import React from 'react';
import { View, Text, StyleSheet, Image as RNImage } from 'react-native';
import { getBadgeType, getBadgeColor, getPremiumFlair } from '../utils/premium';

/**
 * PremiumBadge — renders the correct badge icon for any of the 6 tiers.
 * 
 * All badges (except VIP/black_banana) are rendered as transparent PNG images
 * so they display as their exact design shape (starburst seal) next to
 * usernames — just like Instagram/Twitter verified ticks.
 * 
 * Badge types:
 *   blue_tick     → Standard (₹99)    — blue starburst checkmark
 *   gold_tick     → Premium (₹199)    — gold starburst checkmark
 *   gold_plus     → Premium+ (₹299)   — gold starburst with + symbol
 *   purple_tick   → Elite (₹399)      — purple gradient starburst checkmark
 *   golden_banana → Super (₹499)      — golden banana icon
 *   black_banana  → VIP (₹999)        — (badge to be added later)
 * 
 * Usage: <PremiumBadge profile={userProfile} size={14} />
 */

// ─── Badge Images (transparent PNGs, no background) ───
const BADGE_IMAGES = {
    blue_tick: require('../assets/images/badges/blue_tick.png'),
    gold_tick: require('../assets/images/badges/gold_tick.png'),
    gold_plus: require('../assets/images/badges/gold_plus.png'),
    purple_tick: require('../assets/images/badges/purple_tick.png'),
    golden_banana: require('../assets/images/badges/golden_banana.png'),
    black_banana: require('../assets/images/badges/black_banana.png'),
};

export default function PremiumBadge({ profile, size = 14, style }) {
    const badgeType = getBadgeType(profile);
    if (!badgeType) return null;

    const badgeSource = BADGE_IMAGES[badgeType];
    if (!badgeSource) return null;

    // Banana badges are a different shape, give them more room
    const isBanana = badgeType === 'golden_banana' || badgeType === 'black_banana';
    const imgSize = isBanana ? size + 6 : size + 4;

    return (
        <RNImage
            source={badgeSource}
            style={[
                {
                    width: imgSize,
                    height: imgSize,
                    marginLeft: 3,
                },
                style,
            ]}
            resizeMode="contain"
        />
    );
}

export function PremiumFlair({ profile, style }) {
    const flair = getPremiumFlair(profile);
    if (!flair) return null;

    const badgeType = getBadgeType(profile);
    const config = FLAIR_COLORS[badgeType] || FLAIR_COLORS.blue_tick;

    return (
        <View style={[styles.flair, { backgroundColor: config.bg }, style]}>
            <Text style={[styles.flairText, { color: config.text }]}>{flair}</Text>
        </View>
    );
}

export function PremiumAvatarRing({ profile, children, size = 80 }) {
    const badgeType = getBadgeType(profile);
    if (!badgeType) {
        return <View>{children}</View>;
    }

    const ringConfig = RING_COLORS[badgeType] || RING_COLORS.blue_tick;
    const ringSize = size + 8;

    return (
        <View style={[styles.avatarRing, {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderColor: ringConfig.border,
        }]}>
            {children}
        </View>
    );
}

// ─── Badge Visual Configs ───

const FLAIR_COLORS = {
    blue_tick: { bg: 'rgba(29,161,242,0.12)', text: '#1DA1F2' },
    gold_tick: { bg: 'rgba(255,215,0,0.12)', text: '#FFD700' },
    gold_plus: { bg: 'rgba(245,158,11,0.12)', text: '#F59E0B' },
    purple_tick: { bg: 'rgba(168,85,247,0.12)', text: '#A855F7' },
    golden_banana: { bg: 'rgba(255,215,0,0.15)', text: '#FFD700' },
    black_banana: { bg: 'rgba(100,100,100,0.15)', text: '#C0C0C0' },
};

const RING_COLORS = {
    blue_tick: { border: '#1DA1F2' },
    gold_tick: { border: '#FFD700' },
    gold_plus: { border: '#F59E0B' },
    purple_tick: { border: '#A855F7' },
    golden_banana: { border: '#FFD700' },
    black_banana: { border: '#555555' },
};

const styles = StyleSheet.create({
    flair: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    flairText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    avatarRing: {
        borderWidth: 2.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

