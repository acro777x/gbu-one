import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, StatusBar } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { SplashScreenView } from '../src/components/brand/SplashScreenView';
import { ThemeProvider, useAppTheme } from '../src/lib/ThemeContext';
import { queryClient } from '../src/lib/queryClient';


function AppShell() {
  const { colors, isDark } = useAppTheme();
  const [splashFinished, setSplashFinished] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
  });

  // Hide native splash screen as soon as custom fonts are fully loaded into memory
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  const handleSplashFinish = useCallback(() => {
    setSplashFinished(true);
  }, []);

  // Failsafe timer: ensures animated splash never hangs
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      handleSplashFinish();
    }, 2400);
    return () => clearTimeout(safetyTimer);
  }, [handleSplashFinish]);

  // Hold mount until fonts are guaranteed in memory to eliminate system font fallback
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
        translucent
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="goal" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="boost" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="teamwork-preview" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="mail" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="exams" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="calendar" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="about" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="login" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="class-setup" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="notice/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="dev/motion" />
      </Stack>
      {!splashFinished && (
        <SplashScreenView onFinish={handleSplashFinish} />
      )}
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
