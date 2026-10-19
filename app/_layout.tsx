import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, StatusBar } from 'react-native';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, Poppins_700Bold } from '@expo-google-fonts/poppins';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { SplashScreenView } from '../src/components/brand/SplashScreenView';
import { ThemeProvider, useAppTheme } from '../src/lib/ThemeContext';

// Keep native splash active until root React tree is ready
SplashScreen.preventAutoHideAsync().catch(() => {});

function AppShell() {
  const { colors, isDark } = useAppTheme();
  const [splashFinished, setSplashFinished] = useState(false);
  const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    'Poppins-Bold': Poppins_700Bold,
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  // Query onboarding status from persistent storage
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem('@gbu_one_has_seen_onboarding')
      .then((val) => {
        if (mounted) {
          setHasSeenOnboarding(val === 'true');
          setHasCheckedOnboarding(true);
        }
      })
      .catch(() => {
        if (mounted) {
          setHasSeenOnboarding(false);
          setHasCheckedOnboarding(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Hide native splash screen as soon as fonts are resolved
  const hideNativeSplash = useCallback(async () => {
    try {
      await SplashScreen.hideAsync();
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      hideNativeSplash();
    }
    const fallbackTimer = setTimeout(hideNativeSplash, 450);
    return () => clearTimeout(fallbackTimer);
  }, [fontsLoaded, fontError, hideNativeSplash]);

  const handleSplashFinish = useCallback(() => {
    setSplashFinished(true);
  }, []);

  // Guarantee onboarding routing for first-time launch as soon as storage and splash are ready
  useEffect(() => {
    if (splashFinished && hasCheckedOnboarding && !hasSeenOnboarding) {
      const navTimer = setTimeout(() => {
        router.replace('/onboarding');
      }, 60);
      return () => clearTimeout(navTimer);
    }
  }, [splashFinished, hasCheckedOnboarding, hasSeenOnboarding]);

  // Failsafe timer: ensures animated splash never hangs
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      handleSplashFinish();
    }, 2400);
    return () => clearTimeout(safetyTimer);
  }, [handleSplashFinish]);

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
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
