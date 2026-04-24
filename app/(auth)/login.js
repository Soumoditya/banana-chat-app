import { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { getUserByUsername, searchUsers } from '../../services/users';
import { Colors, Spacing, FontSize, BorderRadius } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { signIn, resetPassword, error, setError } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const handleLogin = async () => {
        if (!identifier.trim() || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            await signIn(identifier.trim(), password);
            router.replace('/(tabs)/home');
        } catch (err) {
            Alert.alert('Login Failed', err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        let input = identifier.trim();
        if (!input) {
            Alert.alert('Reset Password', 'Enter your email or username in the field above, then tap "Forgot Password?" again.');
            return;
        }
        
        let emailToReset = input;
        
        // If it's a username (no @), look up the email
        if (!input.includes('@')) {
            try {
                // Try exact username match
                let userDoc = await getUserByUsername(input);
                if (!userDoc) {
                    // Try case-insensitive search
                    const results = await searchUsers(input);
                    userDoc = results.find(u => 
                        (u.username || '').toLowerCase() === input.toLowerCase() ||
                        (u.usernameLower || '').toLowerCase() === input.toLowerCase()
                    );
                }
                if (userDoc && userDoc.email) {
                    emailToReset = userDoc.email;
                } else {
                    Alert.alert('Not Found', 'No account found with that username. Try your email address instead.');
                    return;
                }
            } catch (err) {
                Alert.alert('Error', 'Could not look up username. Please enter your email address instead.');
                return;
            }
        }
        
        try {
            await resetPassword(emailToReset);
            // Mask the email for privacy
            const parts = emailToReset.split('@');
            const masked = parts[0].substring(0, 2) + '***@' + parts[1];
            Alert.alert('✅ Reset Link Sent', `Password reset link sent to ${masked}`);
        } catch (err) {
            Alert.alert('Error', err.message);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.logo}>🍌</Text>
                    <Text style={styles.title}>Banana Chat</Text>
                    <Text style={styles.subtitle}>Welcome back!</Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Ionicons name="person-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Email or Username"
                            placeholderTextColor={Colors.textTertiary}
                            value={identifier}
                            onChangeText={setIdentifier}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor={Colors.textTertiary}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                            <Ionicons
                                name={showPassword ? "eye-off-outline" : "eye-outline"}
                                size={20}
                                color={Colors.textSecondary}
                            />
                        </TouchableOpacity>
                    </View>

                    {error && (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText} selectable>{error}</Text>
                        </View>
                    )}

                    <TouchableOpacity onPress={handleForgotPassword} style={{ alignSelf: 'flex-end', marginBottom: Spacing.md }}>
                        <Text style={{ color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' }}>Forgot Password?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={Colors.textInverse} />
                        ) : (
                            <Text style={styles.loginBtnText}>Sign In</Text>
                        )}
                    </TouchableOpacity>

                    {/* Divider */}
                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>or</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Guest mode */}
                    <TouchableOpacity
                        style={styles.guestBtn}
                        onPress={() => router.push('/(auth)/guest')}
                    >
                        <Ionicons name="person-outline" size={20} color={Colors.primary} />
                        <Text style={styles.guestText}>Continue as Guest</Text>
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Don't have an account? </Text>
                    <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                        <Text style={styles.footerLink}>Sign Up</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: Spacing.xxl,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logo: {
        fontSize: 64,
        marginBottom: 12,
    },
    title: {
        fontSize: FontSize.title,
        fontWeight: 'bold',
        color: Colors.primary,
        letterSpacing: 1,
    },
    subtitle: {
        fontSize: FontSize.lg,
        color: Colors.textSecondary,
        marginTop: 8,
    },
    form: {
        width: '100%',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
        height: 56,
    },
    inputIcon: {
        marginRight: Spacing.md,
    },
    input: {
        flex: 1,
        color: Colors.text,
        fontSize: FontSize.md,
        height: '100%',
    },
    errorBox: {
        backgroundColor: 'rgba(255, 61, 113, 0.1)',
        borderRadius: BorderRadius.sm,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.error,
    },
    errorText: {
        color: Colors.error,
        fontSize: FontSize.sm,
    },
    loginBtn: {
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.lg,
        alignItems: 'center',
        marginTop: Spacing.sm,
    },
    loginBtnDisabled: {
        opacity: 0.6,
    },
    loginBtnText: {
        color: Colors.textInverse,
        fontSize: FontSize.lg,
        fontWeight: 'bold',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: Spacing.xxl,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: Colors.border,
    },
    dividerText: {
        color: Colors.textTertiary,
        fontSize: FontSize.sm,
        marginHorizontal: Spacing.lg,
    },
    socialRow: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    socialBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    socialIcon: {
        color: Colors.text,
        fontSize: FontSize.lg,
        fontWeight: 'bold',
    },
    socialText: {
        color: Colors.text,
        fontSize: FontSize.md,
    },
    guestBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        marginTop: Spacing.lg,
        paddingVertical: Spacing.lg,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.primary,
        borderStyle: 'dashed',
    },
    guestText: {
        color: Colors.primary,
        fontSize: FontSize.md,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: Spacing.xxxl,
    },
    footerText: {
        color: Colors.textSecondary,
        fontSize: FontSize.md,
    },
    footerLink: {
        color: Colors.primary,
        fontSize: FontSize.md,
        fontWeight: 'bold',
    },
});
