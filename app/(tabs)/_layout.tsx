import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { FloatingTabBar } from '../../src/components/ui/FloatingTabBar';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useSheetStore } from '../../src/store/useSheetStore';
import { useAppTheme } from '../../src/lib/ThemeContext';

export default function TabLayout() {
  // Selectors, not the whole store: a store write (a new email, a sign-in)
  // used to re-render the whole tab navigator.
  const user = useAuthStore((state) => state.user);
  const isGuest = useAuthStore((state) => state.isGuest);
  const isSheetOpen = useSheetStore((state) => state.isSheetOpen);
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Tabs
        screenOptions={{
          headerShown: false,
        }}
        tabBar={(props) => {
          const currentRoute = props.state.routes[props.state.index].name;
          const activeKey = currentRoute === 'index' ? 'home' : currentRoute;

          const handleTabPress = (tabKey: string) => {
            const targetRouteName = tabKey === 'home' ? 'index' : tabKey;
            const route = props.state.routes.find((r) => r.name === targetRouteName);
            if (route) {
              const isFocused = props.state.routes[props.state.index].name === route.name;
              const event = props.navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                props.navigation.navigate(route.name);
              }
            }
          };

          return (
            <View
              style={{ display: isSheetOpen ? 'none' : 'flex' }}
              pointerEvents={isSheetOpen ? 'none' : 'auto'}
            >
              <FloatingTabBar
                activeTab={activeKey}
                onTabPress={handleTabPress}
                userAvatar={user?.avatarUrl}
                userName={user?.name}
                isGuest={isGuest}
              />
            </View>
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
