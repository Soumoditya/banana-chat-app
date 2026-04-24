// ─── Double Tap Heart Animation ───
// Instagram-style double-tap to like with animated heart overlay.
// Also provides FadeInView for smooth mount animations.

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Animated, TouchableWithoutFeedback, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * DoubleTapLike — wraps children and detects double-tap.
 * Shows an animated heart pop on double-tap.
 * 
 * @param {function} onDoubleTap - callback on double-tap
 * @param {function} onSingleTap - callback on single tap
 * @param {ReactNode} children
 */
export default function DoubleTapLike({ children, onDoubleTap, onSingleTap, style }) {
    const lastTap = useRef(0);
    const heartScale = useRef(new Animated.Value(0)).current;
    const heartOpacity = useRef(new Animated.Value(0)).current;
    const [showHeart, setShowHeart] = useState(false);

    const handlePress = useCallback(() => {
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300;
        
        if (now - lastTap.current < DOUBLE_TAP_DELAY) {
            // Double tap detected
            lastTap.current = 0;
            if (onDoubleTap) onDoubleTap();
            
            // Animate heart
            setShowHeart(true);
            heartScale.setValue(0);
            heartOpacity.setValue(1);
            
            Animated.sequence([
                Animated.spring(heartScale, {
                    toValue: 1,
                    friction: 3,
                    tension: 150,
                    useNativeDriver: true,
                }),
                Animated.delay(400),
                Animated.timing(heartOpacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setShowHeart(false);
            });
        } else {
            lastTap.current = now;
            // Delay single tap to avoid conflict
            setTimeout(() => {
                if (Date.now() - lastTap.current >= DOUBLE_TAP_DELAY && lastTap.current !== 0) {
                    if (onSingleTap) onSingleTap();
                }
            }, DOUBLE_TAP_DELAY);
        }
    }, [onDoubleTap, onSingleTap]);

    return (
        <TouchableWithoutFeedback onPress={handlePress}>
            <View style={style}>
                {children}
                {showHeart && (
                    <Animated.View
                        style={[
                            styles.heartOverlay,
                            {
                                transform: [{ scale: heartScale }],
                                opacity: heartOpacity,
                            },
                        ]}
                        pointerEvents="none"
                    >
                        <Ionicons name="heart" size={80} color="#FF3B5C" />
                    </Animated.View>
                )}
            </View>
        </TouchableWithoutFeedback>
    );
}

/**
 * FadeInView — animates children on mount with fade + slide up.
 */
export function FadeInView({ children, delay = 0, duration = 400, style, ...props }) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(12)).current;

    useEffect(() => {
        const timer = setTimeout(() => {
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: 0,
                    duration,
                    useNativeDriver: true,
                }),
            ]).start();
        }, delay);
        return () => clearTimeout(timer);
    }, []);

    return (
        <Animated.View style={[style, { opacity, transform: [{ translateY }] }]} {...props}>
            {children}
        </Animated.View>
    );
}

/**
 * AnimatedLikeButton — heart icon that bounces when toggled on
 */
export function AnimatedLikeButton({ isLiked, onPress, size = 24, color }) {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePress = useCallback(() => {
        if (!isLiked) {
            // Bounce animation
            Animated.sequence([
                Animated.timing(scale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
                Animated.spring(scale, { toValue: 1, friction: 3, tension: 150, useNativeDriver: true }),
            ]).start();
        }
        onPress();
    }, [isLiked, onPress]);

    return (
        <TouchableWithoutFeedback onPress={handlePress}>
            <Animated.View style={{ transform: [{ scale }], padding: 2 }}>
                <Ionicons
                    name={isLiked ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
                    size={size}
                    color={color}
                />
            </Animated.View>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    heartOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
