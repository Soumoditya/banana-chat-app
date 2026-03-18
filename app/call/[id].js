import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { ZegoUIKitPrebuiltCall, ONE_ON_ONE_VIDEO_CALL_CONFIG, ONE_ON_ONE_VOICE_CALL_CONFIG } from '@zegocloud/zego-uikit-prebuilt-call-rn';

export default function CallScreen() {
    const { id, type } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    
    // Provided ZegoCloud API Credentials
    const appID = 1254960696;
    const appSign = "dcbd8d09a48d25140334461d055ead78d1e13946a315815e3f374a4c905f31e1";

    const isVideo = type === 'video';
    const config = isVideo ? ONE_ON_ONE_VIDEO_CALL_CONFIG : ONE_ON_ONE_VOICE_CALL_CONFIG;

    // Filter IDs to only alphanumeric characters (Zego requirement limits to 32 chars)
    const secureUserID = (user?.uid || Date.now().toString()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
    const secureUserName = user?.displayName || 'Me';
    const secureCallID = id ? id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 32) : 'testRoom123';

    return (
        <View style={styles.container}>
            <ZegoUIKitPrebuiltCall
                appID={appID}
                appSign={appSign}
                userID={secureUserID}
                userName={secureUserName}
                callID={secureCallID}
                config={{
                    ...config,
                    onCallEnd: (callID, reason, duration) => {
                        router.back();
                    },
                    onOnlySelfInRoom: () => {
                        router.back();
                    },
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
});
