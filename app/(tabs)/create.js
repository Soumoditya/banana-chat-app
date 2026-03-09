import { useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../utils/theme';

// This tab redirects to the /create modal screen every time it gains focus
export default function CreateTab() {
    const router = useRouter();

    useFocusEffect(
        useCallback(() => {
            // Small delay to ensure navigation is ready
            const timer = setTimeout(() => {
                router.push('/create');
            }, 50);
            return () => clearTimeout(timer);
        }, [])
    );

    return (
        <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={Colors.primary} />
        </View>
    );
}
