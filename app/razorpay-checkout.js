// ─── Razorpay Checkout WebView ───
// Opens a WebView pointing to the Vercel-hosted checkout page.
// Receives payment result via postMessage from the WebView.

import { useState, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Colors, Spacing, FontSize } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { upgradeToPremium } from '../services/users';
import { PREMIUM_PLANS } from '../utils/premium';

// The Vercel-hosted checkout page URL
const CHECKOUT_BASE_URL = 'https://banana-chat-app.vercel.app/checkout.html';

export default function RazorpayCheckoutScreen() {
    const { user, userProfile, refreshProfile } = useAuth();
    const { showToast } = useToast();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const webViewRef = useRef(null);
    const { planId } = useLocalSearchParams();
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    const plan = PREMIUM_PLANS[planId] || PREMIUM_PLANS.premium_plus;

    // Build checkout URL with user context
    const checkoutUrl = `${CHECKOUT_BASE_URL}?plan=${planId || 'premium_plus'}&uid=${user?.uid || ''}&email=${encodeURIComponent(userProfile?.email || user?.email || '')}&name=${encodeURIComponent(userProfile?.displayName || '')}&source=app`;

    // Handle messages from the WebView (payment results)
    const handleWebViewMessage = async (event) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);

            if (data.type === 'PAYMENT_SUCCESS') {
                setProcessing(true);
                // Auto-activate premium via Firebase client SDK
                await upgradeToPremium(user.uid, data.planId, 'razorpay');
                await refreshProfile();
                setProcessing(false);

                showToast(
                    `${plan.name} plan activated! Welcome to Premium 🎉`,
                    'success',
                    '✅ Premium Activated'
                );
                router.replace('/premium-settings');
            } else if (data.type === 'PAYMENT_FAILED') {
                showToast(data.error || 'Payment failed', 'error', '❌ Payment Failed');
            }
        } catch (err) {
            console.warn('WebView message parse error:', err);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    <Ionicons name="card-outline" size={18} color={Colors.primary} />{' '}
                    Checkout — {plan.name}
                </Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Processing overlay */}
            {processing && (
                <View style={styles.processingOverlay}>
                    <ActivityIndicator size="large" color="#FFD700" />
                    <Text style={styles.processingText}>Activating your premium...</Text>
                </View>
            )}

            {/* WebView */}
            <WebView
                ref={webViewRef}
                source={{ uri: checkoutUrl }}
                style={{ flex: 1, backgroundColor: '#0A0A0A' }}
                onMessage={handleWebViewMessage}
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                renderLoading={() => (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#FFD700" />
                        <Text style={styles.loadingText}>Loading checkout...</Text>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0A0A' },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderBottomWidth: 0.5, borderBottomColor: Colors.border,
        backgroundColor: Colors.background,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
    loadingOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center',
    },
    loadingText: { color: Colors.textSecondary, marginTop: 12, fontSize: FontSize.sm },
    processingOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center',
    },
    processingText: { color: '#FFD700', marginTop: 16, fontSize: FontSize.md, fontWeight: '600' },
});
