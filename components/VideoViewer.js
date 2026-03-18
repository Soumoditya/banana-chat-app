import { View, StyleSheet, Modal, TouchableOpacity, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';

export default function VideoViewer({ visible, videoUrl, onClose }) {
    if (!videoUrl) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <View style={styles.container}>
                <StatusBar backgroundColor="black" barStyle="light-content" />
                
                <Video
                    source={{ uri: videoUrl }}
                    style={styles.video}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={true}
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
    },
    video: {
        width: '100%',
        height: '100%',
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
        zIndex: 10,
    },
});
