import { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Colors } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';

// Badge dot shown on the notification tab
function NotifBadge({ count, color, size, focused }) {
    return (
        <View style={{ width: size + 8, height: size + 8, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name={focused ? 'heart' : 'heart-outline'} size={size} color={color} />
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
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user?.uid) return;

        // Live unread count from Firestore
        const q = query(
            collection(db, 'notifications'),
            where('targetUserId', '==', user.uid),
            where('read', '==', false),
            limit(100)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            setUnreadCount(snapshot.size);
        }, () => {
            // Collection may not exist yet — silent fail
            setUnreadCount(0);
        });

        return () => unsub();
    }, [user?.uid]);

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                lazy: false,
                tabBarStyle: [styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8), height: 56 + Math.max(insets.bottom, 8) }],
                tabBarActiveTintColor: Colors.text,
                tabBarInactiveTintColor: Colors.textTertiary,
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
                        <Ionicons name={focused ? 'add-circle' : 'add-circle-outline'} size={30} color={Colors.primary} />
                    ),
                }}
            />
            <Tabs.Screen
                name="notifications"
                options={{
                    title: 'Activity',
                    tabBarIcon: ({ color, focused }) => (
                        <NotifBadge
                            count={focused ? 0 : unreadCount}
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
            {/* Hide chats from tabs — accessed via DM icon on home */}
            <Tabs.Screen
                name="chats"
                options={{
                    href: null,
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
        right: 0,
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
