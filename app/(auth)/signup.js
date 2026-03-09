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
import { Colors, Spacing, FontSize, BorderRadius } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { validateEmail, validateUsername } from '../../utils/helpers';

export default function SignupScreen() {
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [usernameAvailable, setUsernameAvailable] = useState(null);
    const { signUp, checkUsernameAvailable, error, setError } = useAuth();
    const router = useRouter();

    const checkUsername = async (name) => {
        setUsername(name);
        if (name.length >= 3) {
            const available = await checkUsernameAvailable(name);
            setUsernameAvailable(available);
        } else {
            setUsernameAvailable(null);
        }
    };

    const handleSignup = async () => {
        if (!username.trim() || !email.trim() || !password || !displayName.trim()) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (!validateUsername(username)) {
            Alert.alert('Error', 'Username must be 3-20 characters, letters, numbers, and underscores only');
            return;
        }

        if (!validateEmail(email)) {
            Alert.alert('Error', 'Please enter a valid email');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        if (usernameAvailable === false) {
            Alert.alert('Error', 'Username is already taken');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            await signUp(email.trim(), password, username.trim(), displayName.trim());
            router.replace('/(tabs)/home');
        } catch (err) {
            Alert.alert('Signup Failed', err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {/* Back button */}
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.logo}>🍌</Text>
                    <Text style={styles.title}>Join Banana Chat</Text>
                    <Text style={styles.subtitle}>Create your account</Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    {/* Username */}
                    <View style={[styles.inputContainer, usernameAvailable === false && styles.inputError, usernameAvailable === true && styles.inputSuccess]}>
                        <Ionicons name="at-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Username"
                            placeholderTextColor={Colors.textTertiary}
                            value={username}
                            onChangeText={checkUsername}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        {usernameAvailable === true && (
                            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                        )}
                        {usernameAvailable === false && (
                            <Ionicons name="close-circle" size={20} color={Colors.error} />
                        )}
                    </View>

                    {/* Display Name */}
                    <View style={styles.inputContainer}>
                        <Ionicons name="person-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Display Name"
                            placeholderTextColor={Colors.textTertiary}
                            value={displayName}
                            onChangeText={setDisplayName}
                        />
                    </View>

                    {/* Email */}
                    <View style={styles.inputContainer}>
                        <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor={Colors.textTertiary}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    {/* Password */}
                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Password (min 6 chars)"
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

                    {/* Confirm Password */}
                    <View style={styles.inputContainer}>
                        <Ionicons name="shield-checkmark-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Confirm Password"
                            placeholderTextColor={Colors.textTertiary}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showPassword}
                        />
                    </View>

                    {error && (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText} selectable>{error}</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.signupBtn, loading && styles.signupBtnDisabled]}
                        onPress={handleSignup}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={Colors.textInverse} />
                        ) : (
                            <Text style={styles.signupBtnText}>Create Account</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Already have an account? </Text>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text style={styles.footerLink}>Sign In</Text>
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
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logo: {
        fontSize: 48,
        marginBottom: 12,
    },
    title: {
        fontSize: FontSize.xxl,
        fontWeight: 'bold',
        color: Colors.primary,
    },
    subtitle: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        marginTop: 4,
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
    inputError: {
        borderColor: Colors.error,
    },
    inputSuccess: {
        borderColor: Colors.success,
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
    signupBtn: {
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.lg,
        alignItems: 'center',
        marginTop: Spacing.sm,
    },
    signupBtnDisabled: {
        opacity: 0.6,
    },
    signupBtnText: {
        color: Colors.textInverse,
        fontSize: FontSize.lg,
        fontWeight: 'bold',
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
