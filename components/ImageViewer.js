import { useState, useRef } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Dimensions, StatusBar, Animated } from 'react-native';
import { PinchGestureHandler, State } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function ImageViewer({ visible, imageUrl, onClose }) {
    const scale = useRef(new Animated.Value(1)).current;

    if (!imageUrl) return null;

    const onPinchEvent = Animated.event(
        [{ nativeEvent: { scale: scale } }],
        { useNativeDriver: true }
    );

    const onPinchStateChange = event => {
        if (event.nativeEvent.oldState === State.ACTIVE) {
            if (event.nativeEvent.scale < 1) {
                // Bounce back if zoomed out too much
                Animated.spring(scale, {
                    toValue: 1,
                    useNativeDriver: true,
                }).start();
            }
        }
    };

    const handleClose = () => {
        scale.setValue(1); // Reset scale
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose} statusBarTranslucent>
            <View style={styles.container}>
                <StatusBar backgroundColor="black" barStyle="light-content" />
                
                <PinchGestureHandler
                    onGestureEvent={onPinchEvent}
                    onHandlerStateChange={onPinchStateChange}
                >
                    <Animated.Image
                        source={{ uri: imageUrl }}
                        style={[styles.image, { transform: [{ scale: scale }] }]}
                        resizeMode="contain"
                    />
                </PinchGestureHandler>

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
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
