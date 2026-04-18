import { useState, useRef } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Dimensions, StatusBar, Image, Animated, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function ImageViewer({ visible, imageUrl, onClose }) {
    const scale = useRef(new Animated.Value(1)).current;
    const translateX = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;
    const lastScale = useRef(1);
    const lastDistance = useRef(0);
    const lastTranslateX = useRef(0);
    const lastTranslateY = useRef(0);
    const isZoomed = useRef(false);

    const getDistance = (touches) => {
        const dx = touches[0].pageX - touches[1].pageX;
        const dy = touches[0].pageY - touches[1].pageY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {},
            onPanResponderMove: (evt, gestureState) => {
                const touches = evt.nativeEvent.touches;
                // Pinch zoom with 2 fingers
                if (touches.length === 2) {
                    const distance = getDistance(touches);
                    if (lastDistance.current === 0) {
                        lastDistance.current = distance;
                        return;
                    }
                    const newScale = Math.max(1, Math.min(5, lastScale.current * (distance / lastDistance.current)));
                    scale.setValue(newScale);
                    isZoomed.current = newScale > 1.1;
                }
                // Pan with 1 finger when zoomed
                else if (touches.length === 1 && isZoomed.current) {
                    translateX.setValue(lastTranslateX.current + gestureState.dx);
                    translateY.setValue(lastTranslateY.current + gestureState.dy);
                }
            },
            onPanResponderRelease: () => {
                lastScale.current = scale.__getValue();
                lastDistance.current = 0;
                lastTranslateX.current = translateX.__getValue();
                lastTranslateY.current = translateY.__getValue();

                // Snap back if zoomed out
                if (lastScale.current < 1.1) {
                    Animated.parallel([
                        Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
                        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
                        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
                    ]).start();
                    lastScale.current = 1;
                    lastTranslateX.current = 0;
                    lastTranslateY.current = 0;
                    isZoomed.current = false;
                }
            },
        })
    ).current;

    const handleClose = () => {
        scale.setValue(1);
        translateX.setValue(0);
        translateY.setValue(0);
        lastScale.current = 1;
        lastDistance.current = 0;
        lastTranslateX.current = 0;
        lastTranslateY.current = 0;
        isZoomed.current = false;
        onClose();
    };

    // Double tap to zoom
    const lastTap = useRef(0);
    const handleTap = () => {
        const now = Date.now();
        if (now - lastTap.current < 300) {
            // Double tap
            if (lastScale.current > 1.1) {
                // Zoom out
                Animated.parallel([
                    Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
                    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
                    Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
                ]).start();
                lastScale.current = 1;
                lastTranslateX.current = 0;
                lastTranslateY.current = 0;
                isZoomed.current = false;
            } else {
                // Zoom in to 2.5x
                Animated.spring(scale, { toValue: 2.5, useNativeDriver: true }).start();
                lastScale.current = 2.5;
                isZoomed.current = true;
            }
        }
        lastTap.current = now;
    };

    if (!imageUrl) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose} statusBarTranslucent>
            <View style={styles.container}>
                <StatusBar backgroundColor="black" barStyle="light-content" />
                
                <View style={styles.imageContainer} {...panResponder.panHandlers}>
                    <TouchableOpacity activeOpacity={1} onPress={handleTap} style={styles.touchArea}>
                        <Animated.Image
                            source={{ uri: imageUrl }}
                            style={[
                                styles.image,
                                {
                                    transform: [
                                        { scale: scale },
                                        { translateX: translateX },
                                        { translateY: translateY },
                                    ]
                                }
                            ]}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
                    <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    imageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    touchArea: {
        width: SCREEN_W,
        height: SCREEN_H,
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: SCREEN_W,
        height: SCREEN_H * 0.85,
    },
    closeBtn: {
        position: 'absolute',
        top: 50,
        right: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
});
