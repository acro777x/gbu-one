import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { FloatingTabBar } from '../../src/components/ui/FloatingTabBar';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useSheetStore } from '../../src/store/useSheetStore';
import { useAppTheme } from '../../src/lib/ThemeContext';

export default function TabLayout() {
  const { user, isGuest } = useAuthStore();
  const { colors } = useAppTheme();
  // A sheet is drawn inside the screen, so the tab bar has to step aside
  // while one is open instead of floating on top of it.
  const isSheetOpen = useSheetStore((state) => state.isSheetOpen);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' }, // Using our custom floating tab bar
        }}
        tabBar={(props) => {
          if (isSheetOpen) return null;

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
  },
});
