// ─── Shared Animation Presets ───
// Reusable animation helpers using React Native's Animated API.
// Import and use across all screens for consistent micro-interactions.

import { Animated, Easing } from 'react-native';

/**
 * Fade in with optional slide up.
 * Returns { opacity, transform } style and a start() function.
 */
export const useFadeIn = (delay = 0, slideDistance = 15) => {
    const opacity = new Animated.Value(0);
    const translateY = new Animated.Value(slideDistance);

    const start = () => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 400,
                delay,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration: 500,
                delay,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    };

    return {
        style: { opacity, transform: [{ translateY }] },
        start,
    };
};

/**
 * Scale press animation for buttons.
 * Call pressIn() on press start, pressOut() on release.
 */
export const useScalePress = (minScale = 0.93) => {
    const scale = new Animated.Value(1);

    const pressIn = () => {
        Animated.spring(scale, {
            toValue: minScale,
            friction: 5,
            tension: 100,
            useNativeDriver: true,
        }).start();
    };

    const pressOut = () => {
        Animated.spring(scale, {
            toValue: 1,
            friction: 3,
            tension: 80,
            useNativeDriver: true,
        }).start();
    };

    return {
        style: { transform: [{ scale }] },
        pressIn,
        pressOut,
    };
};

/**
 * Bounce animation for like/save/reaction buttons.
 * Call bounce() on tap.
 */
export const useBounce = () => {
    const scale = new Animated.Value(1);

    const bounce = () => {
        Animated.sequence([
            Animated.timing(scale, { toValue: 1.3, duration: 100, useNativeDriver: true }),
            Animated.spring(scale, { toValue: 1, friction: 3, tension: 120, useNativeDriver: true }),
        ]).start();
    };

    return { style: { transform: [{ scale }] }, bounce };
};

/**
 * Staggered children animation.
 * Call startStagger() after data loads to animate items sequentially.
 * @param {number} count - Number of items to animate
 * @param {number} staggerDelay - Delay between each item (ms)
 */
export const createStaggerAnimations = (count, staggerDelay = 60) => {
    const anims = Array.from({ length: count }, () => ({
        opacity: new Animated.Value(0),
        translateY: new Animated.Value(20),
    }));

    const start = () => {
        const animations = anims.map((anim, i) =>
            Animated.parallel([
                Animated.timing(anim.opacity, {
                    toValue: 1,
                    duration: 350,
                    delay: i * staggerDelay,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(anim.translateY, {
                    toValue: 0,
                    duration: 400,
                    delay: i * staggerDelay,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ])
        );
        Animated.parallel(animations).start();
    };

    return { anims, start };
};

/**
 * Simple shimmer/pulse animation for loading states.
 */
export const usePulse = (minOpacity = 0.3, maxOpacity = 1, duration = 800) => {
    const opacity = new Animated.Value(minOpacity);

    const start = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: maxOpacity, duration, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: minOpacity, duration, useNativeDriver: true }),
            ])
        ).start();
    };

    return { style: { opacity }, start };
};
