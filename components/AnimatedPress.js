// ─── Animated Touchable Component ───
// Drop-in replacement for TouchableOpacity with scale-down press animation.
// Gives a premium, tactile feel to interactive elements.

import React, { useRef, useCallback } from 'react';
import { Animated, TouchableWithoutFeedback, StyleSheet } from 'react-native';

/**
 * AnimatedPress — scale-bounce on press for premium feel.
 * 
 * @param {number} scaleDown - How much to scale down on press (default 0.96)
 * @param {function} onPress - Press handler
 * @param {function} onLongPress - Long press handler
 * @param {object} style - Container style
 * @param {ReactNode} children
 */
export default function AnimatedPress({ 
    children, 
    onPress, 
    onLongPress, 
    style, 
    scaleDown = 0.96, 
    disabled = false,
    ...props 
}) {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = useCallback(() => {
        Animated.spring(scale, {
            toValue: scaleDown,
            friction: 8,
            tension: 200,
            useNativeDriver: true,
        }).start();
    }, [scaleDown]);

    const handlePressOut = useCallback(() => {
        Animated.spring(scale, {
            toValue: 1,
            friction: 5,
            tension: 150,
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <TouchableWithoutFeedback
            onPress={disabled ? undefined : onPress}
            onLongPress={disabled ? undefined : onLongPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            {...props}
        >
            <Animated.View style={[style, { transform: [{ scale }] }]}>
                {children}
            </Animated.View>
        </TouchableWithoutFeedback>
    );
}

/**
 * AnimatedCard — card wrapper with subtle scale + shadow animation
 */
export function AnimatedCard({ children, style, onPress, ...props }) {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = useCallback(() => {
        Animated.spring(scale, {
            toValue: 0.98,
            friction: 8,
            tension: 200,
            useNativeDriver: true,
        }).start();
    }, []);

    const handlePressOut = useCallback(() => {
        Animated.spring(scale, {
            toValue: 1,
            friction: 5,
            tension: 150,
            useNativeDriver: true,
        }).start();
    }, []);

    if (!onPress) {
        return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
    }

    return (
        <TouchableWithoutFeedback
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            {...props}
        >
            <Animated.View style={[style, { transform: [{ scale }] }]}>
                {children}
            </Animated.View>
        </TouchableWithoutFeedback>
    );
}

/**
 * SkeletonShimmer — loading placeholder with shimmer animation
 */
export function SkeletonShimmer({ width = '100%', height = 16, borderRadius = 8, style }) {
    const shimmer = useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
                Animated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, []);

    const opacity = shimmer.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <Animated.View
            style={[
                {
                    width,
                    height,
                    borderRadius,
                    backgroundColor: '#2a2a3e',
                    opacity,
                },
                style,
            ]}
        />
    );
}
