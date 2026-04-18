import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../utils/theme';

export default function SplashScreen() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (user) {
                router.replace('/(tabs)/home');
            } else {
                router.replace('/(auth)/login');
            }
        }
    }, [user, loading]);

    return (
        <View style={styles.container}>
            <View style={styles.logoContainer}>
                <Text style={styles.logo}>🍌</Text>
                <Text style={styles.title}>Banana Chat</Text>
                <Text style={styles.subtitle}>Connect. Chat. Vibe.</Text>
            </View>
            <View style={styles.loading}>
                <View style={styles.loadingDot} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoContainer: {
        alignItems: 'center',
    },
    logo: {
        fontSize: 80,
        marginBottom: 16,
    },
    title: {
        fontSize: 36,
        fontWeight: 'bold',
        color: Colors.primary,
        letterSpacing: 1,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.textSecondary,
        marginTop: 8,
        letterSpacing: 2,
    },
    loading: {
        position: 'absolute',
        bottom: 80,
    },
    loadingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.primary,
    },
});
