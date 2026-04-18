// ─── Theme Context (Light / Dark Mode) ───
// Provides app-wide light/dark mode toggle for ALL users.
// Persists choice in AsyncStorage. Default = dark.

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@banana_theme_mode';

// ─── Light Theme Colors ───
const LightColors = {
    background: '#F5F5F7',
    surface: '#FFFFFF',
    surfaceLight: '#F0F0F5',
    surfaceElevated: '#E8E8ED',
    card: '#FFFFFF',

    primary: '#E6A800',
    primaryLight: '#FFD54F',
    primaryDark: '#C8A800',
    primarySurface: 'rgba(230, 168, 0, 0.08)',

    secondary: '#5B52E0',
    secondaryLight: '#7C74FF',
    secondarySurface: 'rgba(91, 82, 224, 0.08)',

    accent: '#0099CC',
    accentPink: '#E05585',
    accentGreen: '#00B85C',
    accentOrange: '#E68200',

    gradientPrimary: ['#FFD700', '#FF9100'],
    gradientSecondary: ['#5B52E0', '#0099CC'],
    gradientPink: ['#E05585', '#D93060'],
    gradientDark: ['#F5F5F7', '#FFFFFF'],
    gradientGold: ['#FFD700', '#FFA000', '#FF6F00'],

    text: '#1A1A2E',
    textSecondary: '#6B6B80',
    textTertiary: '#9999AA',
    textInverse: '#FFFFFF',

    online: '#00B85C',
    offline: '#9999AA',
    busy: '#D93060',
    away: '#E68200',

    success: '#00B85C',
    error: '#D93060',
    warning: '#E68200',
    info: '#0099CC',

    messageSent: '#E6A800',
    messageReceived: '#F0F0F5',
    messageSentText: '#FFFFFF',
    messageReceivedText: '#1A1A2E',

    border: '#E0E0E8',
    borderLight: '#EBEBF0',

    upvote: '#E05585',
    downvote: '#5B52E0',

    reactionBg: 'rgba(0, 0, 0, 0.05)',

    overlay: 'rgba(0, 0, 0, 0.4)',
    overlayLight: 'rgba(0, 0, 0, 0.2)',

    streak: '#E68200',
    streakFire: '#D93060',
};

// ─── Dark Theme Colors (same as existing Colors) ───
const DarkColors = {
    background: '#000000',
    surface: '#1A1A1A',
    surfaceLight: '#262626',
    surfaceElevated: '#333333',
    card: '#1A1A1A',

    primary: '#FFD700',
    primaryLight: '#FFE44D',
    primaryDark: '#C8A800',
    primarySurface: 'rgba(255, 215, 0, 0.1)',

    secondary: '#6C63FF',
    secondaryLight: '#8B84FF',
    secondarySurface: 'rgba(108, 99, 255, 0.1)',

    accent: '#00D2FF',
    accentPink: '#FF6B9D',
    accentGreen: '#00E676',
    accentOrange: '#FF9100',

    gradientPrimary: ['#FFD700', '#FF9100'],
    gradientSecondary: ['#6C63FF', '#00D2FF'],
    gradientPink: ['#FF6B9D', '#FF3D71'],
    gradientDark: ['#000000', '#1A1A1A'],
    gradientGold: ['#FFD700', '#FFA000', '#FF6F00'],

    text: '#FFFFFF',
    textSecondary: '#A0A0B8',
    textTertiary: '#6B6B80',
    textInverse: '#0A0A0F',

    online: '#00E676',
    offline: '#6B6B80',
    busy: '#FF3D71',
    away: '#FF9100',

    success: '#00E676',
    error: '#FF3D71',
    warning: '#FF9100',
    info: '#00D2FF',

    messageSent: '#1E1E3A',
    messageReceived: '#2A2A40',
    messageSentText: '#FFFFFF',
    messageReceivedText: '#FFFFFF',

    border: '#262626',
    borderLight: '#333333',

    upvote: '#FF6B9D',
    downvote: '#6C63FF',

    reactionBg: 'rgba(255, 255, 255, 0.08)',

    overlay: 'rgba(0, 0, 0, 0.7)',
    overlayLight: 'rgba(0, 0, 0, 0.4)',

    streak: '#FF9100',
    streakFire: '#FF3D00',
};

const ThemeContext = createContext({
    isDark: true,
    colors: DarkColors,
    toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        // Load saved preference
        AsyncStorage.getItem(THEME_KEY).then(val => {
            if (val === 'light') setIsDark(false);
        }).catch(() => {});
    }, []);

    const toggleTheme = async () => {
        const newMode = !isDark;
        setIsDark(newMode);
        await AsyncStorage.setItem(THEME_KEY, newMode ? 'dark' : 'light');
    };

    const colors = useMemo(() => isDark ? DarkColors : LightColors, [isDark]);

    return (
        <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
export { DarkColors, LightColors };
