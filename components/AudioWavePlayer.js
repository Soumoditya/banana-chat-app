import { useState, useEffect, useRef, useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '../utils/theme';

const NUM_BARS = 20;

/**
 * WhatsApp-style audio waveform player.
 *
 * Props:
 *   uri        – remote audio/video URL
 *   duration   – total duration in seconds (optional, will be detected)
 *   tintColor  – color for played portion (default: Colors.primary)
 *   compact    – smaller variant for comment sections
 */
export default function AudioWavePlayer({ uri, duration: propDuration, tintColor, compact = false }) {
    const color = tintColor || Colors.primary;
    const [isPlaying, setIsPlaying] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [totalDuration, setTotalDuration] = useState(propDuration || 0);
    const soundRef = useRef(null);
    const progressAnim = useRef(new Animated.Value(0)).current;

    // Generate stable bar heights from URI hash
    const barHeights = useRef(
        Array.from({ length: NUM_BARS }, (_, i) => {
            const code = (uri || '').charCodeAt(i % (uri?.length || 1)) || 0;
            const seed = (code + i * 37) % 100;
            return compact ? 4 + (seed % 12) : 6 + (seed % 18);
        })
    ).current;

    useEffect(() => {
        return () => {
            // Cleanup on unmount
            if (soundRef.current) {
                soundRef.current.unloadAsync().catch(() => {});
                soundRef.current = null;
            }
        };
    }, []);

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    const handlePlayPause = useCallback(async () => {
        try {
            if (isPlaying && soundRef.current) {
                await soundRef.current.pauseAsync();
                setIsPlaying(false);
                return;
            }

            // If no sound loaded yet, create one
            if (!soundRef.current) {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: true,
                });
                const { sound, status } = await Audio.Sound.createAsync(
                    { uri },
                    { shouldPlay: true },
                    onPlaybackStatusUpdate
                );
                soundRef.current = sound;
                if (status.durationMillis) {
                    setTotalDuration(Math.round(status.durationMillis / 1000));
                }
            } else {
                const status = await soundRef.current.getStatusAsync();
                if (status.didJustFinish || status.positionMillis >= (status.durationMillis || 0)) {
                    await soundRef.current.setPositionAsync(0);
                }
                await soundRef.current.playAsync();
            }
            setIsPlaying(true);
        } catch (err) {
            console.warn('AudioWavePlayer play error:', err.message);
        }
    }, [isPlaying, uri]);

    const onPlaybackStatusUpdate = useCallback((status) => {
        if (!status.isLoaded) return;

        const pos = (status.positionMillis || 0) / 1000;
        const dur = (status.durationMillis || 1) / 1000;
        setElapsed(pos);
        if (!totalDuration && dur > 0) setTotalDuration(Math.round(dur));

        // Animate progress
        const pct = dur > 0 ? pos / dur : 0;
        progressAnim.setValue(pct);

        if (status.didJustFinish) {
            setIsPlaying(false);
            setElapsed(0);
            progressAnim.setValue(0);
        }
    }, [totalDuration]);

    const iconSize = compact ? 24 : 30;
    const barWidth = compact ? 2.5 : 3;
    const barGap = compact ? 1.5 : 2;

    return (
        <View style={[styles.container, compact && styles.containerCompact]}>
            <TouchableOpacity onPress={handlePlayPause} activeOpacity={0.7}>
                <Ionicons
                    name={isPlaying ? 'pause-circle' : 'play-circle'}
                    size={iconSize}
                    color={color}
                />
            </TouchableOpacity>

            <View style={styles.waveContainer}>
                {barHeights.map((h, i) => {
                    const barPct = i / NUM_BARS;
                    return (
                        <Animated.View
                            key={i}
                            style={[
                                styles.bar,
                                {
                                    height: h,
                                    width: barWidth,
                                    marginHorizontal: barGap / 2,
                                    backgroundColor: progressAnim.interpolate({
                                        inputRange: [Math.max(0, barPct - 0.01), barPct],
                                        outputRange: [Colors.textTertiary + '50', color],
                                        extrapolate: 'clamp',
                                    }),
                                },
                            ]}
                        />
                    );
                })}
            </View>

            <Text style={[styles.time, compact && styles.timeCompact]}>
                {isPlaying ? formatTime(elapsed) : formatTime(totalDuration || propDuration || 0)}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        minWidth: 180,
        paddingVertical: 4,
    },
    containerCompact: {
        minWidth: 140,
        gap: 4,
    },
    waveContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    bar: {
        borderRadius: 2,
    },
    time: {
        color: Colors.textTertiary,
        fontSize: FontSize.xs,
        minWidth: 32,
        textAlign: 'right',
    },
    timeCompact: {
        fontSize: 10,
        minWidth: 28,
    },
});
