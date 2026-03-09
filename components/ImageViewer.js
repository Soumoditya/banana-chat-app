import { useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Image, Dimensions, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function ImageViewer({ visible, imageUrl, onClose }) {
    if (!imageUrl) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <View style={styles.container}>
                <StatusBar backgroundColor="black" barStyle="light-content" />
                <Image
                    source={{ uri: imageUrl }}
                    style={styles.image}
                    resizeMode="contain"
                />
                <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
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
