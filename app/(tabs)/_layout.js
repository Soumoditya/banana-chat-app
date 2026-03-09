import { Tabs } from 'expo-router';
import { Colors } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: [styles.tabBar, { paddingBottom: Math.max(insets.bottom, 6), height: 56 + Math.max(insets.bottom, 6) }],
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: Colors.textTertiary,
                tabBarShowLabel: true,
                tabBarLabelStyle: styles.tabLabel,
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="search"
                options={{
                    title: 'Explore',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? "search" : "search-outline"} size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="create"
                options={{
                    title: '',
                    tabBarIcon: ({ color }) => (
                        <View style={styles.createBtn}>
                            <Ionicons name="add" size={28} color={Colors.textInverse} />
                        </View>
                    ),
                }}
                listeners={({ navigation }) => ({
                    tabPress: (e) => {
                        e.preventDefault();
                        const router = require('expo-router').router;
                        router.push('/create');
                    },
                })}
            />
            <Tabs.Screen
                name="notifications"
                options={{
                    title: 'Activity',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? "heart" : "heart-outline"} size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
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
        backgroundColor: Colors.surface,
        borderTopColor: Colors.border,
        borderTopWidth: 0.5,
        paddingTop: 6,
        elevation: 0,
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '600',
    },
    createBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: -8,
    },
});
