import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, StatusBar } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { SplashScreenView } from '../src/components/brand/SplashScreenView';
import { ThemeProvider, useAppTheme } from '../src/lib/ThemeContext';
import { queryClient, QueryClientProvider } from '../src/lib/queryClient';
import { useAuthStore } from '../src/store/useAuthStore';
import {
  configureNotificationHandler,
  isTimetablePushEnabled,
  registerDeviceForPush,
} from '../src/lib/pushNotifications';
import { useClassAlarmLifecycle } from '../src/features/notifications/useClassAlarmLifecycle';
import { AlarmRungPrompt } from '../src/components/notifications/AlarmRungPrompt';
import { MandatoryUpdateModal } from '../src/components/ui/MandatoryUpdateModal';
import { isAdminApp } from '../src/lib/appVariant';


function AppShell() {
  const { colors, isDark } = useAppTheme();
  const [splashFinished, setSplashFinished] = useState(false);
  const classSection = useAuthStore((state) => state.classSelection?.section ?? null);

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

  // Show timetable-change pushes while the app is in the foreground
  useEffect(() => {
    configureNotificationHandler();
  }, []);

  // The class alarms: stop a stale one from ringing when the app opens, and
  // offer the snooze when one has just rung.
  const alarmLifecycle = useClassAlarmLifecycle();

  // Register this device for class-targeted timetable pushes
  useEffect(() => {
    if (!classSection) return;
    let cancelled = false;
    (async () => {
      try {
        if (!(await isTimetablePushEnabled())) return;
        const result = await registerDeviceForPush(classSection);
        if (!cancelled && !result.registered) {
          console.log(`Push registration skipped: ${result.reason}`);
        }
      } catch (err) {
        console.log('Push registration failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classSection]);

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
      {/*
        The app is mounted only after the intro has finished. Rendering it
        behind the splash meant the Home screen (carousel, images, cards) was
        decoding and laying out while the mark was animating, which made the
        startup visibly stutter: 42% janky frames on the release build.
      */}
      {!splashFinished ? (
        <SplashScreenView onFinish={handleSplashFinish} />
      ) : (
        <Animated.View style={styles.app} entering={FadeIn.duration(220)}>
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
            {isAdminApp() ? (
              <>
                <Stack.Screen name="moderation" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="admin/index" options={{ animation: 'slide_from_right' }} />
              </>
            ) : null}
            <Stack.Screen name="events" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="notice/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="pdf" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="dev/motion" />
          </Stack>
        </Animated.View>
      )}

      {/* Mandatory / Compulsory App Version Update Guard */}
      {splashFinished ? <MandatoryUpdateModal /> : null}

      {/* The prompt that appears when a class alarm rang. */}
      {splashFinished && alarmLifecycle.ringedAlarm ? (
        <AlarmRungPrompt
          alarm={alarmLifecycle.ringedAlarm}
          onSnooze={() => {
            void alarmLifecycle.snooze();
          }}
          onDismiss={() => {
            void alarmLifecycle.dismiss();
          }}
        />
      ) : null}
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
  app: { flex: 1 },
});
