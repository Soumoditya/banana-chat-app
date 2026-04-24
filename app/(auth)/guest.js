import { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../../contexts/ToastContext';

export default function GuestScreen() {
    const [loading, setLoading] = useState(false);
    const { signInAsGuest } = useAuth();
    const router = useRouter();
    const { showToast } = useToast();

    const handleGuestLogin = async () => {
        try {
            setLoading(true);
            await signInAsGuest();
            router.replace('/(tabs)/home');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>

            <View style={styles.content}>
                <Text style={styles.emoji}>👻</Text>
                <Text style={styles.title}>Guest Mode</Text>
                <Text style={styles.description}>
                    Explore Banana Chat without creating an account. Some features will be limited.
                </Text>

                <View style={styles.featureList}>
                    <View style={styles.featureItem}>
                        <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                        <Text style={styles.featureText}>Browse public feed</Text>
                    </View>
                    <View style={styles.featureItem}>
                        <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                        <Text style={styles.featureText}>View public profiles</Text>
                    </View>
                    <View style={styles.featureItem}>
                        <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                        <Text style={styles.featureText}>Read public chats</Text>
                    </View>
                    <View style={styles.featureItem}>
                        <Ionicons name="close-circle" size={20} color={Colors.error} />
                        <Text style={styles.featureTextDisabled}>Send messages</Text>
                    </View>
                    <View style={styles.featureItem}>
                        <Ionicons name="close-circle" size={20} color={Colors.error} />
                        <Text style={styles.featureTextDisabled}>Create posts</Text>
                    </View>
                    <View style={styles.featureItem}>
                        <Ionicons name="close-circle" size={20} color={Colors.error} />
                        <Text style={styles.featureTextDisabled}>Post stories</Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.guestBtn, loading && styles.guestBtnDisabled]}
                    onPress={handleGuestLogin}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color={Colors.textInverse} />
                    ) : (
                        <>
                            <Ionicons name="person-outline" size={20} color={Colors.textInverse} />
                            <Text style={styles.guestBtnText}>Enter as Guest</Text>
                        </>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.createAccountBtn}
                    onPress={() => router.replace('/(auth)/signup')}
                >
                    <Text style={styles.createAccountText}>Create an account instead</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        padding: Spacing.xxl,
        paddingTop: 60,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    title: {
        fontSize: FontSize.xxl,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 12,
    },
    description: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
        paddingHorizontal: 20,
    },
    featureList: {
        width: '100%',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: 32,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    featureText: {
        color: Colors.text,
        fontSize: FontSize.md,
    },
    featureTextDisabled: {
        color: Colors.textTertiary,
        fontSize: FontSize.md,
        textDecorationLine: 'line-through',
    },
    guestBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.secondary,
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.xxxl,
        width: '100%',
    },
    guestBtnDisabled: {
        opacity: 0.6,
    },
    guestBtnText: {
        color: Colors.text,
        fontSize: FontSize.lg,
        fontWeight: 'bold',
    },
    createAccountBtn: {
        marginTop: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    createAccountText: {
        color: Colors.primary,
        fontSize: FontSize.md,
        fontWeight: '600',
    },
});
