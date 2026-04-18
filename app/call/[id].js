import { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, FontSize } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { ref, set, onValue, remove, onDisconnect } from 'firebase/database';
import { rtdb } from '../../config/firebase';
import { getUserProfile } from '../../services/users';
import { getInitials } from '../../utils/helpers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CallScreen() {
    const { id: callTarget, type = 'audio' } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();

    const [callState, setCallState] = useState('connecting'); // connecting | ringing | active | ended
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isSpeaker, setIsSpeaker] = useState(false);
    const [targetUser, setTargetUser] = useState(null);

    const timerRef = useRef(null);
    const callRef = useRef(null);

    // Load target user profile
    useEffect(() => {
        if (callTarget) {
            getUserProfile(callTarget).then(profile => {
                if (profile) setTargetUser(profile);
            }).catch(() => {});
        }
    }, [callTarget]);

    // Set up call signaling via Firebase RTDB
    useEffect(() => {
        if (!user?.uid || !callTarget) return;

        const callId = [user.uid, callTarget].sort().join('_');
        const callPath = ref(rtdb, `calls/${callId}`);
        callRef.current = callPath;

        // Write call offer
        set(callPath, {
            caller: user.uid,
            callee: callTarget,
            type: type,
            status: 'ringing',
            startedAt: Date.now(),
        });

        // Clean up on disconnect
        onDisconnect(callPath).remove();

        // Listen for call state changes
        const unsubscribe = onValue(callPath, (snapshot) => {
            const data = snapshot.val();
            if (!data) {
                setCallState('ended');
                return;
            }
            if (data.status === 'active') {
                setCallState('active');
            } else if (data.status === 'ended' || data.status === 'declined') {
                setCallState('ended');
            } else if (data.status === 'ringing') {
                setCallState('ringing');
            }
        });

        // Simulate "ringing" → "active" after 3s for demo 
        // In production the callee would accept from their notification
        const ringingTimeout = setTimeout(() => {
            set(callPath, {
                caller: user.uid,
                callee: callTarget,
                type: type,
                status: 'active',
                startedAt: Date.now(),
            });
        }, 3000);

        return () => {
            unsubscribe();
            clearTimeout(ringingTimeout);
        };
    }, [user?.uid, callTarget, type]);

    // Call timer
    useEffect(() => {
        if (callState === 'active') {
            timerRef.current = setInterval(() => {
                setDuration(d => d + 1);
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [callState]);

    // Auto-cleanup on ended
    useEffect(() => {
        if (callState === 'ended') {
            if (timerRef.current) clearInterval(timerRef.current);
            setTimeout(() => {
                if (router.canGoBack()) router.back();
            }, 1500);
        }
    }, [callState]);

    const formatDuration = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const handleEndCall = () => {
        if (callRef.current) {
            remove(callRef.current);
        }
        setCallState('ended');
    };

    const toggleMute = () => setIsMuted(!isMuted);
    const toggleSpeaker = () => setIsSpeaker(!isSpeaker);

    const isVideo = type === 'video';
    const displayName = targetUser?.displayName || targetUser?.username || 'User';
    const initials = getInitials(displayName);

    return (
        <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
            {/* Gradient overlay for video calls */}
            {isVideo && <View style={styles.videoPlaceholder}>
                <Text style={styles.videoPlaceholderText}>📹 Camera Preview</Text>
                <Text style={styles.videoSubtext}>WebRTC video stream would render here</Text>
            </View>}

            {/* Call info */}
            <View style={styles.callInfo}>
                <View style={styles.avatar}>
                    {targetUser?.avatar ? (
                        <View style={styles.avatarImage}>
                            <Text style={styles.avatarInitials}>{initials}</Text>
                        </View>
                    ) : (
                        <View style={styles.avatarImage}>
                            <Text style={styles.avatarInitials}>{initials}</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.callerName}>{displayName}</Text>
                <Text style={styles.callStatus}>
                    {callState === 'connecting' && 'Connecting...'}
                    {callState === 'ringing' && 'Ringing...'}
                    {callState === 'active' && formatDuration(duration)}
                    {callState === 'ended' && 'Call Ended'}
                </Text>
                <Text style={styles.callType}>
                    {isVideo ? '📹 Video Call' : '📞 Audio Call'}
                </Text>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
                <TouchableOpacity
                    style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
                    onPress={toggleMute}
                >
                    <Ionicons
                        name={isMuted ? 'mic-off' : 'mic'}
                        size={28}
                        color={isMuted ? '#000' : '#fff'}
                    />
                    <Text style={[styles.controlLabel, isMuted && styles.controlLabelActive]}>
                        {isMuted ? 'Unmute' : 'Mute'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.endCallBtn}
                    onPress={handleEndCall}
                >
                    <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.controlBtn, isSpeaker && styles.controlBtnActive]}
                    onPress={toggleSpeaker}
                >
                    <Ionicons
                        name={isSpeaker ? 'volume-high' : 'volume-medium'}
                        size={28}
                        color={isSpeaker ? '#000' : '#fff'}
                    />
                    <Text style={[styles.controlLabel, isSpeaker && styles.controlLabelActive]}>
                        Speaker
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0A0A',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    videoPlaceholder: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoPlaceholderText: {
        color: '#ffffff80',
        fontSize: 24,
    },
    videoSubtext: {
        color: '#ffffff40',
        fontSize: 14,
        marginTop: 8,
    },
    callInfo: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatar: {
        marginBottom: 24,
    },
    avatarImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#FFD60A22',
        borderWidth: 2,
        borderColor: '#FFD60A',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitials: {
        fontSize: 36,
        fontWeight: '700',
        color: '#FFD60A',
    },
    callerName: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
    },
    callStatus: {
        fontSize: 18,
        color: '#ffffff99',
        marginBottom: 4,
    },
    callType: {
        fontSize: 14,
        color: '#ffffff60',
        marginTop: 8,
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 40,
        paddingBottom: 40,
    },
    controlBtn: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#ffffff22',
        justifyContent: 'center',
        alignItems: 'center',
    },
    controlBtnActive: {
        backgroundColor: '#fff',
    },
    controlLabel: {
        color: '#fff',
        fontSize: 10,
        marginTop: 4,
        position: 'absolute',
        bottom: -18,
    },
    controlLabelActive: {
        color: '#000',
    },
    endCallBtn: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#FF3B30',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
