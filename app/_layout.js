import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '../utils/theme';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import React from 'react';
import * as Clipboard from 'expo-clipboard';

const paperTheme = {
    ...MD3DarkTheme,
    colors: {
        ...MD3DarkTheme.colors,
        primary: Colors.primary,
        secondary: Colors.secondary,
        background: Colors.background,
        surface: Colors.surface,
        error: Colors.error,
        onPrimary: Colors.textInverse,
        onSecondary: Colors.text,
        onBackground: Colors.text,
        onSurface: Colors.text,
    },
};

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        console.error('App Error:', error, errorInfo);
    }

    copyError = async () => {
        const errorText = `Error: ${this.state.error?.toString()}\n\nStack: ${this.state.error?.stack}\n\nComponent Stack: ${this.state.errorInfo?.componentStack}`;
        try {
            if (Clipboard && Clipboard.setStringAsync) {
                await Clipboard.setStringAsync(errorText);
            }
        } catch (e) {
            console.log('Copy failed', e);
        }
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={errorStyles.container}>
                    <Text style={errorStyles.emoji}>🍌💥</Text>
                    <Text style={errorStyles.title}>Oops! Something went wrong</Text>
                    <View style={errorStyles.errorBox}>
                        <Text style={errorStyles.errorText} selectable>
                            {this.state.error?.toString()}
                        </Text>
                        {this.state.error?.stack && (
                            <Text style={errorStyles.stackText} selectable numberOfLines={10}>
                                {this.state.error.stack}
                            </Text>
                        )}
                    </View>
                    <TouchableOpacity style={errorStyles.copyBtn} onPress={this.copyError}>
                        <Text style={errorStyles.copyBtnText}>📋 Copy Error</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={errorStyles.retryBtn}
                        onPress={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                    >
                        <Text style={errorStyles.retryBtnText}>🔄 Try Again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return this.props.children;
    }
}

const errorStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    emoji: { fontSize: 48, marginBottom: 16 },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 20,
        textAlign: 'center',
    },
    errorBox: {
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 16,
        width: '100%',
        maxHeight: 300,
        borderWidth: 1,
        borderColor: Colors.error,
    },
    errorText: {
        color: Colors.error,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    stackText: {
        color: Colors.textSecondary,
        fontSize: 11,
        fontFamily: 'monospace',
    },
    copyBtn: {
        backgroundColor: Colors.surfaceLight,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        marginTop: 16,
    },
    copyBtnText: {
        color: Colors.primary,
        fontSize: 16,
        fontWeight: '600',
    },
    retryBtn: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        marginTop: 12,
    },
    retryBtnText: {
        color: Colors.textInverse,
        fontSize: 16,
        fontWeight: '600',
    },
});

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <ErrorBoundary>
                <PaperProvider theme={paperTheme}>
                    <AuthProvider>
                        <StatusBar style="light" backgroundColor={Colors.background} />
                        <Stack
                            screenOptions={{
                                headerShown: false,
                                contentStyle: { backgroundColor: Colors.background },
                                animation: 'slide_from_right',
                                gestureEnabled: true,
                            }}
                        >
                            <Stack.Screen name="index" />
                            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
                            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
                            <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
                            <Stack.Screen name="user/[id]" options={{ animation: 'slide_from_right' }} />
                            <Stack.Screen name="post/[id]" options={{ animation: 'slide_from_bottom' }} />
                            <Stack.Screen name="story/[id]" options={{ animation: 'fade', presentation: 'fullScreenModal' }} />
                            <Stack.Screen name="create" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
                            <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
                            <Stack.Screen name="admin" options={{ animation: 'slide_from_right' }} />
                            <Stack.Screen name="blocked-users" options={{ animation: 'slide_from_right' }} />
                            <Stack.Screen name="notifications-settings" options={{ animation: 'slide_from_right' }} />
                            <Stack.Screen name="about" options={{ animation: 'slide_from_right' }} />
                            <Stack.Screen name="close-friends" options={{ animation: 'slide_from_right' }} />
                            <Stack.Screen name="story-archive" options={{ animation: 'slide_from_right' }} />
                            <Stack.Screen name="recently-deleted" options={{ animation: 'slide_from_right' }} />
                            <Stack.Screen name="highlight-editor" options={{ animation: 'slide_from_right' }} />
                            <Stack.Screen name="hide-story-from" options={{ animation: 'slide_from_right' }} />
                            <Stack.Screen name="create-group" options={{ animation: 'slide_from_right' }} />
                            <Stack.Screen name="followers-list" options={{ animation: 'slide_from_right' }} />
                        </Stack>
                    </AuthProvider>
                </PaperProvider>
            </ErrorBoundary>
        </SafeAreaProvider>
    );
}
