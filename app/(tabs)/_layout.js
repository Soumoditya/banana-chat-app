import { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Colors } from '../../utils/theme';
import useAppTheme from '../../hooks/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToUnreadChats } from '../../services/chat';

// Badge dot shown on notification & chat tabs
function TabBadge({ iconFocused, iconOutline, count, color, size, focused }) {
    return (
        <View style={{ width: size + 8, height: size + 8, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name={focused ? iconFocused : iconOutline} size={size} color={color} />
            {count > 0 && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
                </View>
            )}
        </View>
    );
}

export default function TabsLayout() {
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { C } = useAppTheme();
    const [unreadNotifs, setUnreadNotifs] = useState(0);
    const [unreadChats, setUnreadChats] = useState(0);

    // Live unread notification count
    useEffect(() => {
        if (!user?.uid) return;
        const q = query(
            collection(db, 'notifications'),
            where('targetUserId', '==', user.uid),
            where('read', '==', false),
            limit(100)
        );
        const unsub = onSnapshot(q, (snapshot) => {
            setUnreadNotifs(snapshot.size);
        }, () => setUnreadNotifs(0));
        return () => unsub();
    }, [user?.uid]);

    // Live unread chat count
    useEffect(() => {
        if (!user?.uid) return;
        const unsub = subscribeToUnreadChats(user.uid, setUnreadChats);
        return () => unsub();
    }, [user?.uid]);

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                lazy: false,
                tabBarStyle: [styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8), height: 56 + Math.max(insets.bottom, 8), backgroundColor: C.background, borderTopColor: C.border }],
                tabBarActiveTintColor: C.text,
                tabBarInactiveTintColor: C.textTertiary,
                tabBarShowLabel: false,
                animation: 'shift',
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="search"
                options={{
                    title: 'Explore',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'search' : 'search-outline'} size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="create"
                options={{
                    title: '',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'add-circle' : 'add-circle-outline'} size={30} color={C.primary} />
                    ),
                }}
            />
            <Tabs.Screen
                name="chats"
                options={{
                    title: 'Chats',
                    tabBarIcon: ({ color, focused }) => (
                        <TabBadge
                            iconFocused="chatbubbles"
                            iconOutline="chatbubbles-outline"
                            count={focused ? 0 : unreadChats}
                            color={color}
                            size={24}
                            focused={focused}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="notifications"
                options={{
                    title: 'Activity',
                    tabBarIcon: ({ color, focused }) => (
                        <TabBadge
                            iconFocused="heart"
                            iconOutline="heart-outline"
                            count={focused ? 0 : unreadNotifs}
                            color={color}
                            size={24}
                            focused={focused}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: Colors.background,
        borderTopColor: Colors.border,
        borderTopWidth: 0.5,
        paddingTop: 8,
        elevation: 0,
    },
    badge: {
        position: 'absolute',
        top: 0,
        right: -2,
        backgroundColor: Colors.error || '#FF3D71',
        borderRadius: 8,
        minWidth: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 3,
    },
    badgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: 'bold',
    },
});
