import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs, router } from 'expo-router';
import { FloatingTabBar } from '../../src/components/ui/FloatingTabBar';
import { useAuthStore } from '../../src/store/useAuthStore';
import { theme } from '../../src/lib/theme';

export default function TabLayout() {
  const { user, isGuest } = useAuthStore();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' }, // Using our custom floating tab bar
        }}
        tabBar={(props) => {
          const currentRoute = props.state.routes[props.state.index].name;
          const activeKey = currentRoute === 'index' ? 'home' : currentRoute;

          const handleTabPress = (tabKey: string) => {
            const targetRoute = tabKey === 'home' ? 'index' : tabKey;
            props.navigation.navigate(targetRoute);
          };

          return (
            <FloatingTabBar
              activeTab={activeKey}
              onTabPress={handleTabPress}
              userAvatar={user?.avatarUrl}
              userName={user?.name}
              isGuest={isGuest}
            />
          );
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="timetable" options={{ title: 'Timetable' }} />
        <Tabs.Screen name="notices" options={{ title: 'Notices' }} />
        <Tabs.Screen name="pyq" options={{ title: 'PYQ' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
});
