import { useState, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking,
    Dimensions, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PREMIUM_PLANS, getPlanConfig, isPremiumActive, getPremiumFlair, PLAN_TIERS } from '../utils/premium';
import { submitPremiumRequest, cancelPremium, upgradeToPremium } from '../services/users';
import PremiumBadge from '../components/PremiumBadge';
import { isUserAdmin } from '../utils/constants';
import { useToast } from '../contexts/ToastContext';

const { width } = Dimensions.get('window');

// UPI & PayPal config
const UPI_ID = 'soumodityapramanik-2@okaxis';
const PAYPAL_LINK = 'https://paypal.me/SoumodityaPramanik';
const APP_NAME = 'Banana Chat';

// Badge preview config for each plan
const BADGE_PREVIEWS = {
    standard: { icon: 'checkmark-circle', color: '#1DA1F2', label: 'Blue Tick' },
    premium: { icon: 'checkmark-circle', color: '#FFD700', label: 'Gold Tick' },
    premium_plus: { icon: 'add-circle', color: '#F59E0B', label: 'Gold+ Badge' },
    elite: { icon: 'shield-checkmark', color: '#A855F7', label: 'Purple Tick' },
    super: { emoji: '🍌', color: '#FFD700', label: 'Golden Banana' },
    vip: { emoji: '🍌', color: '#333', label: 'Black Banana', dark: true },
};

export default function PremiumScreen() {
    const { user, userProfile, refreshProfile } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [selectedPlan, setSelectedPlan] = useState('premium_plus');
    const [processing, setProcessing] = useState(false);
    const [paymentStep, setPaymentStep] = useState('select');
    const [paymentMethod, setPaymentMethod] = useState(null);
    const { showToast, showConfirm } = useToast();

    const currentPlan = getPlanConfig(userProfile);
    const isCurrentlyPremium = isPremiumActive(userProfile);
    const adminUser = isUserAdmin(userProfile);

    // ─── Admin Instant Activate (no payment) ───
    const handleAdminActivate = async () => {
        if (!adminUser || !user?.uid) return;
        try {
            setProcessing(true);
            await upgradeToPremium(user.uid, selectedPlan, 'admin');
            await refreshProfile();
            setProcessing(false);
            showToast(`${PREMIUM_PLANS[selectedPlan]?.name} plan activated! (Admin override)`, 'success', '✅ Premium Activated');
        } catch (err) {
            setProcessing(false);
            showToast(err.message, 'error');
        }
    };

    // ─── UPI Payment ───
    const handleUPIPay = async (plan) => {
        const amount = plan.price;
        const note = `${APP_NAME} ${plan.name} Plan - ${user?.uid?.slice(0, 8)}`;
        const upiUrl = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(APP_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;

        try {
            const supported = await Linking.canOpenURL(upiUrl);
            if (supported) {
                setPaymentStep('paying');
                setPaymentMethod('upi');
                await Linking.openURL(upiUrl);
            } else {
                showToast('Install Google Pay, PhonePe, or Paytm', 'warning', 'No UPI App');
            }
        } catch {
            showToast('Could not open UPI app', 'error');
        }
    };

    // ─── PayPal Payment ───
    const handlePayPalPay = async (plan) => {
        const amount = (plan.price / 80).toFixed(2);
        const paypalUrl = `${PAYPAL_LINK}/${amount}USD`;
        try {
            setPaymentStep('paying');
            setPaymentMethod('paypal');
            await Linking.openURL(paypalUrl);
        } catch {
            showToast('Could not open PayPal', 'error');
        }
    };

    // ─── Confirm & Submit Request ───
    const handleConfirmPayment = async () => {
        const plan = PREMIUM_PLANS[selectedPlan];
        if (!plan || !user?.uid) return;

        showConfirm(
            'Confirm Payment',
            `Did you complete the ₹${plan.price} payment for ${plan.name}?`,
            async () => {
                try {
                    setProcessing(true);
                    await submitPremiumRequest(user.uid, selectedPlan, paymentMethod || 'upi');
                    setProcessing(false);
                    setPaymentStep('submitted');
                } catch (err) {
                    setProcessing(false);
                    showToast(err.message, 'error');
                }
            },
            { confirmText: 'Yes, Submit', cancelText: 'Not Yet', icon: 'card-outline' }
        );
    };

    // ─── Cancel Premium ───
    const handleCancelPremium = () => {
        showConfirm(
            'Cancel Premium',
            'Are you sure? You\'ll lose all premium features.',
            async () => {
                try {
                    await cancelPremium(user.uid);
                    await refreshProfile();
                    showToast('Premium cancelled', 'info', 'Done');
                } catch (err) { showToast(err.message, 'error'); }
            },
            { variant: 'destructive', confirmText: 'Cancel Premium', icon: 'close-circle-outline' }
        );
    };

    const renderBadgePreview = (planId, size = 24) => {
        const bp = BADGE_PREVIEWS[planId];
        if (!bp) return null;
        if (bp.emoji) {
            return (
                <View style={[styles.badgePreviewCircle, {
                    backgroundColor: bp.dark ? '#222' : bp.color + '20',
                    borderColor: bp.color,
                }]}>
                    <Text style={{ fontSize: size * 0.7 }}>{bp.emoji}</Text>
                </View>
            );
        }
        return (
            <View style={[styles.badgePreviewCircle, { backgroundColor: bp.color + '20', borderColor: bp.color }]}>
                <Ionicons name={bp.icon} size={size * 0.7} color={bp.color} />
            </View>
        );
    };

    const renderPlanCard = (planId) => {
        const plan = PREMIUM_PLANS[planId];
        const isSelected = selectedPlan === planId;
        const isCurrentPlan = currentPlan?.id === planId;
        const bp = BADGE_PREVIEWS[planId];

        return (
            <TouchableOpacity
                key={planId}
                style={[
                    styles.planCard,
                    isSelected && styles.planCardSelected,
                    isSelected && { borderColor: bp?.color || Colors.primary },
                ]}
                onPress={() => setSelectedPlan(planId)}
                activeOpacity={0.7}
            >
                {plan.popular && (
                    <View style={styles.popularTag}>
                        <Text style={styles.popularText}>MOST POPULAR</Text>
                    </View>
                )}
                {isCurrentPlan && (
                    <View style={[styles.popularTag, { backgroundColor: '#10B981' }]}>
                        <Text style={styles.popularText}>CURRENT</Text>
                    </View>
                )}

                <View style={styles.planHeader}>
                    {renderBadgePreview(planId, 28)}
                    <View style={{ flex: 1 }}>
                        <Text style={styles.planName}>{plan.name}</Text>
                        <Text style={styles.planTagline}>{plan.tagline}</Text>
                    </View>
                    <View style={styles.priceBox}>
                        <Text style={[styles.priceAmount, { color: bp?.color || Colors.text }]}>₹{plan.price}</Text>
                        <Text style={styles.priceLabel}>/month</Text>
                    </View>
                </View>

                {isSelected && (
                    <View style={styles.featuresList}>
                        {plan.features.map((f, i) => (
                            <View key={i} style={styles.featureItem}>
                                <Ionicons name="checkmark" size={14} color={bp?.color || '#FFD700'} />
                                <Text style={styles.featureText}>{f}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Selection indicator */}
                <View style={[styles.radioOuter, isSelected && { borderColor: bp?.color || Colors.primary }]}>
                    {isSelected && <View style={[styles.radioInner, { backgroundColor: bp?.color || Colors.primary }]} />}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {isCurrentlyPremium ? '✨ Your Premium' : '✨ Go Premium'}
                </Text>
                {isCurrentlyPremium && (
                    <TouchableOpacity onPress={() => router.push('/premium-settings')}>
                        <Ionicons name="settings-outline" size={22} color={Colors.primary} />
                    </TouchableOpacity>
                )}
                {!isCurrentlyPremium && <View style={{ width: 24 }} />}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Hero */}
                <View style={styles.hero}>
                    <Text style={styles.heroEmoji}>🍌</Text>
                    <Text style={styles.heroTitle}>Banana Premium</Text>
                    <Text style={styles.heroSubtitle}>
                        Verified badges, iOS emojis, custom fonts, glass UI skins, and much more
                    </Text>
                </View>

                {/* Current plan info */}
                {isCurrentlyPremium && currentPlan && (
                    <View style={[styles.currentPlanBanner, { borderColor: currentPlan.badgeColor }]}>
                        <PremiumBadge profile={userProfile} size={20} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.currentPlanName}>{currentPlan.name} Active</Text>
                            <Text style={styles.currentPlanExpiry}>
                                {userProfile?.premiumExpiresAt
                                    ? `Expires: ${new Date(userProfile.premiumExpiresAt?.seconds ? userProfile.premiumExpiresAt.seconds * 1000 : userProfile.premiumExpiresAt).toLocaleDateString()}`
                                    : 'Active'}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => router.push('/premium-settings')} style={styles.manageBtn}>
                            <Text style={styles.manageBtnText}>Manage</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleCancelPremium}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Badge Comparison Strip */}
                <View style={styles.badgeStrip}>
                    {Object.keys(PREMIUM_PLANS).map((id) => {
                        const bp = BADGE_PREVIEWS[id];
                        const isActive = selectedPlan === id;
                        return (
                            <TouchableOpacity
                                key={id}
                                style={[styles.badgeStripItem, isActive && { borderBottomColor: bp?.color || Colors.primary }]}
                                onPress={() => setSelectedPlan(id)}
                            >
                                {renderBadgePreview(id, 20)}
                                <Text style={[styles.badgeStripLabel, isActive && { color: bp?.color }]}>
                                    ₹{PREMIUM_PLANS[id].price}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Plan Cards */}
                <Text style={styles.sectionTitle}>Choose your plan</Text>
                {Object.keys(PREMIUM_PLANS).map(renderPlanCard)}

                {/* Admin Instant Activate (no payment needed) */}
                {adminUser && paymentStep === 'select' && (
                    <View style={styles.paymentSection}>
                        <View style={styles.adminBanner}>
                            <Ionicons name="shield-checkmark" size={28} color="#FFD700" />
                            <Text style={styles.adminBannerTitle}>Admin Privilege</Text>
                            <Text style={styles.adminBannerSub}>
                                As an admin, you can activate any plan instantly — no payment required.
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.activateBtn}
                            onPress={handleAdminActivate}
                            disabled={processing}
                        >
                            {processing ? (
                                <ActivityIndicator color="#000" />
                            ) : (
                                <>
                                    <Ionicons name="flash" size={22} color="#000" />
                                    <Text style={styles.activateBtnText}>
                                        Activate {PREMIUM_PLANS[selectedPlan]?.name} — Free
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* Payment Section (regular users only) */}
                {!adminUser && paymentStep === 'select' && (
                    <View style={styles.paymentSection}>
                        <Text style={styles.sectionTitle}>Pay with</Text>
                        <TouchableOpacity
                            style={styles.payBtn}
                            onPress={() => handleUPIPay(PREMIUM_PLANS[selectedPlan])}
                        >
                            <View style={[styles.payIconBg, { backgroundColor: '#5F259F' }]}>
                                <Text style={{ fontSize: 14, fontWeight: '900', color: '#fff' }}>UPI</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.payBtnTitle}>Pay with UPI</Text>
                                <Text style={styles.payBtnSub}>GPay • PhonePe • Paytm • Any UPI</Text>
                            </View>
                            <Text style={styles.payBtnAmount}>₹{PREMIUM_PLANS[selectedPlan]?.price}</Text>
                            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.payBtn}
                            onPress={() => handlePayPalPay(PREMIUM_PLANS[selectedPlan])}
                        >
                            <View style={[styles.payIconBg, { backgroundColor: '#003087' }]}>
                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>PP</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.payBtnTitle}>Pay with PayPal</Text>
                                <Text style={styles.payBtnSub}>International payments</Text>
                            </View>
                            <Text style={styles.payBtnAmount}>
                                ${(PREMIUM_PLANS[selectedPlan]?.price / 80).toFixed(2)}
                            </Text>
                            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                        </TouchableOpacity>

                        <Text style={styles.disclaimer}>
                            After paying, come back and tap "Activate Premium" to submit your request. Admin approval usually takes minutes.
                        </Text>
                    </View>
                )}

                {/* Confirm Payment */}
                {paymentStep === 'paying' && (
                    <View style={styles.confirmSection}>
                        <View style={styles.confirmBanner}>
                            <Ionicons name="time-outline" size={32} color="#FFD700" />
                            <Text style={styles.confirmTitle}>Complete your payment</Text>
                            <Text style={styles.confirmSub}>
                                Pay ₹{PREMIUM_PLANS[selectedPlan]?.price} via {paymentMethod === 'paypal' ? 'PayPal' : 'UPI'} and come back
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={styles.activateBtn}
                            onPress={handleConfirmPayment}
                            disabled={processing}
                        >
                            {processing ? (
                                <ActivityIndicator color="#000" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle" size={22} color="#000" />
                                    <Text style={styles.activateBtnText}>I've Paid — Activate Premium</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.retryPayBtn}
                            onPress={() => {
                                if (paymentMethod === 'paypal') handlePayPalPay(PREMIUM_PLANS[selectedPlan]);
                                else handleUPIPay(PREMIUM_PLANS[selectedPlan]);
                            }}
                        >
                            <Text style={styles.retryPayText}>Open {paymentMethod === 'paypal' ? 'PayPal' : 'UPI'} Again</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setPaymentStep('select')}>
                            <Text style={[styles.retryPayText, { color: Colors.textTertiary }]}>← Go back</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Submitted */}
                {paymentStep === 'submitted' && (
                    <View style={styles.confirmSection}>
                        <View style={styles.confirmBanner}>
                            <Ionicons name="checkmark-circle" size={48} color="#10B981" />
                            <Text style={styles.confirmTitle}>Request Submitted! 🎉</Text>
                            <Text style={styles.confirmSub}>
                                Your {PREMIUM_PLANS[selectedPlan]?.name} plan request has been submitted. Admin will approve shortly.
                            </Text>
                            <View style={styles.pendingBadge}>
                                <Ionicons name="time" size={16} color="#F59E0B" />
                                <Text style={styles.pendingText}>Awaiting admin approval</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={[styles.activateBtn, { backgroundColor: Colors.surfaceLight }]}
                            onPress={() => router.back()}
                        >
                            <Text style={[styles.activateBtnText, { color: Colors.text }]}>← Back to App</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Feature Highlights */}
                <View style={styles.featureHighlights}>
                    <Text style={styles.sectionTitle}>Why go Premium?</Text>
                    {[
                        { icon: 'checkmark-circle', color: '#1DA1F2', title: 'Verified Badge', desc: 'Blue, Gold, Purple, or exclusive Banana badge' },
                        { icon: 'happy', color: '#FFD700', title: 'iOS Emojis', desc: 'Use Apple-style emojis everywhere in the app' },
                        { icon: 'text', color: '#A855F7', title: 'Custom Fonts', desc: 'Serif, Monospace, Rounded, Handwritten & more' },
                        { icon: 'color-palette', color: '#F59E0B', title: 'Premium Themes', desc: 'Ocean, Neon Pulse, Aurora, Obsidian & more' },
                        { icon: 'layers', color: '#06B6D4', title: 'UI Skins', desc: 'Glassmorphism, Liquid Glass, Neon Glow' },
                        { icon: 'download', color: '#10B981', title: 'Download Media', desc: 'Save anyone\'s posts, stories, profile pics' },
                        { icon: 'analytics', color: '#3B82F6', title: 'Profile Analytics', desc: 'See who viewed your profile' },
                        { icon: 'search', color: '#EF4444', title: 'Priority Search', desc: 'Appear higher in search & explore' },
                    ].map((item, i) => (
                        <View key={i} style={styles.highlightItem}>
                            <View style={[styles.highlightIcon, { backgroundColor: item.color + '18' }]}>
                                <Ionicons name={item.icon} size={22} color={item.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.highlightTitle}>{item.title}</Text>
                                <Text style={styles.highlightDesc}>{item.desc}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
    scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },

    // Hero
    hero: { alignItems: 'center', paddingVertical: Spacing.xxl },
    heroEmoji: { fontSize: 48 },
    heroTitle: { fontSize: 28, fontWeight: '800', color: Colors.text, marginTop: 8 },
    heroSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: 6, paddingHorizontal: Spacing.lg },

    // Current plan banner
    currentPlanBanner: {
        flexDirection: 'row', alignItems: 'center', padding: Spacing.lg,
        backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg,
        borderWidth: 1, marginBottom: Spacing.lg,
    },
    currentPlanName: { color: Colors.text, fontWeight: '700', fontSize: FontSize.md },
    currentPlanExpiry: { color: Colors.textTertiary, fontSize: FontSize.xs, marginTop: 2 },
    cancelText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: '600', marginLeft: 10 },
    manageBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.primarySurface, borderRadius: BorderRadius.full },
    manageBtnText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '700' },

    // Badge strip
    badgeStrip: {
        flexDirection: 'row', backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg, padding: Spacing.xs, marginBottom: Spacing.md,
    },
    badgeStripItem: {
        flex: 1, alignItems: 'center', paddingVertical: 8, gap: 4,
        borderBottomWidth: 2, borderBottomColor: 'transparent',
    },
    badgeStripLabel: { fontSize: 10, fontWeight: '700', color: Colors.textTertiary },

    // Badge preview circle
    badgePreviewCircle: {
        width: 32, height: 32, borderRadius: 16,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1.5,
    },

    sectionTitle: {
        fontSize: FontSize.lg, fontWeight: '700', color: Colors.text,
        marginBottom: Spacing.md, marginTop: Spacing.lg,
    },

    // Plan cards
    planCard: {
        backgroundColor: Colors.surfaceLight,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.sm,
        borderWidth: 2,
        borderColor: 'transparent',
        position: 'relative',
        overflow: 'hidden',
    },
    planCardSelected: { backgroundColor: Colors.surface },
    popularTag: {
        position: 'absolute', top: 0, right: 0,
        backgroundColor: '#F59E0B', paddingHorizontal: 10, paddingVertical: 4,
        borderBottomLeftRadius: 8,
    },
    popularText: { fontSize: 9, fontWeight: '800', color: '#000', letterSpacing: 0.5 },
    planHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    planName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
    planTagline: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
    priceBox: { alignItems: 'flex-end' },
    priceAmount: { fontSize: 20, fontWeight: '800' },
    priceLabel: { fontSize: FontSize.xs, color: Colors.textTertiary },
    featuresList: { marginTop: Spacing.md, gap: 6 },
    featureItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    featureText: { color: Colors.textSecondary, fontSize: FontSize.sm },
    radioOuter: {
        position: 'absolute', top: Spacing.lg, left: Spacing.lg,
        width: 18, height: 18, borderRadius: 9,
        borderWidth: 2, borderColor: Colors.border,
        justifyContent: 'center', alignItems: 'center',
    },
    radioInner: { width: 9, height: 9, borderRadius: 5 },

    // Payment
    paymentSection: { marginTop: Spacing.md },
    payBtn: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg,
        padding: Spacing.lg, marginBottom: Spacing.sm,
    },
    payIconBg: {
        width: 38, height: 38, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },
    payBtnTitle: { color: Colors.text, fontWeight: '600', fontSize: FontSize.md },
    payBtnSub: { color: Colors.textTertiary, fontSize: FontSize.xs, marginTop: 2 },
    payBtnAmount: { color: Colors.text, fontWeight: '700', fontSize: FontSize.md, marginRight: 4 },
    disclaimer: {
        color: Colors.textTertiary, fontSize: FontSize.xs, textAlign: 'center',
        marginTop: Spacing.md, lineHeight: 18, paddingHorizontal: Spacing.lg,
    },

    // Admin banner
    adminBanner: {
        alignItems: 'center', gap: Spacing.sm, padding: Spacing.lg,
        backgroundColor: 'rgba(255,215,0,0.08)', borderRadius: BorderRadius.lg,
        borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)', marginBottom: Spacing.md,
    },
    adminBannerTitle: {
        fontSize: FontSize.lg, fontWeight: '800', color: '#FFD700',
    },
    adminBannerSub: {
        fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20,
    },

    // Confirm
    confirmSection: { alignItems: 'center', marginTop: Spacing.xl, gap: Spacing.lg },
    confirmBanner: { alignItems: 'center', gap: Spacing.sm },
    confirmTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
    confirmSub: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
    activateBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#FFD700', paddingHorizontal: 32, paddingVertical: 14,
        borderRadius: BorderRadius.full, width: '100%', justifyContent: 'center',
    },
    activateBtnText: { fontSize: FontSize.md, fontWeight: '700', color: '#000' },
    retryPayBtn: { paddingVertical: Spacing.md },
    retryPayText: { color: Colors.primary, fontWeight: '600', fontSize: FontSize.md },
    pendingBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: BorderRadius.full, marginTop: Spacing.md,
    },
    pendingText: { color: '#F59E0B', fontWeight: '600', fontSize: FontSize.sm },

    // Feature highlights
    featureHighlights: { marginTop: Spacing.md },
    highlightItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
    highlightIcon: {
        width: 44, height: 44, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },
    highlightTitle: { color: Colors.text, fontWeight: '600', fontSize: FontSize.md },
    highlightDesc: { color: Colors.textTertiary, fontSize: FontSize.sm, marginTop: 2 },
});
