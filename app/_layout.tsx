import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, StatusBar, View, Text, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming, runOnJS } from 'react-native-reanimated';
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
import { openAlarmSettings } from '../src/features/notifications/classAlarm';
import { AlarmRungPrompt } from '../src/components/notifications/AlarmRungPrompt';
import { Toast } from '../src/components/ui/Toast';
import { MandatoryUpdateModal } from '../src/components/ui/MandatoryUpdateModal';
import { ErrorBoundary } from '../src/components/ui/ErrorBoundary';
import { isAdminApp } from '../src/lib/appVariant';
import { checkForAppUpdate, isUpdateDismissed } from '../src/features/updates/versionChecker';


function AppShell() {
  const { colors, isDark } = useAppTheme();
  const [splashFinished, setSplashFinished] = useState(false);
  const classSection = useAuthStore((state) => state.classSelection?.section ?? null);
  const hasClassSetup = useAuthStore((state) => state.hasClassSetup);

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

  /*
   * ONE way to close the splash.
   *
   * The splash used to be unmounted by two different paths: its own
   * animation called the finish handler, and a failsafe timer called the
   * same handler directly, so the failsafe skipped the fade and the screen
   * jumped. Both paths now go through `closeSplash`, which fades the
   * overlay and then takes it off the screen.
   */
  const splashOpacity = useSharedValue(1);
  const closeSplash = useCallback(() => {
    splashOpacity.value = withTiming(0, { duration: 240 }, (finished) => {
      if (finished) runOnJS(setSplashFinished)(true);
    });
  }, [splashOpacity]);

  const handleSplashFinish = useCallback(() => {
    closeSplash();
  }, [closeSplash]);

  // Failsafe timer: ensures animated splash never hangs
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      closeSplash();
    }, 2400);
    return () => clearTimeout(safetyTimer);
  }, [closeSplash]);

  const splashOverlayStyle = useAnimatedStyle(() => ({
    opacity: splashOpacity.value,
  }));

  // Show timetable-change pushes while the app is in the foreground
  useEffect(() => {
    configureNotificationHandler();
  }, []);

  // The class alarms: stop a stale one from ringing when the app opens, and
  // offer the snooze when one has just rang.
  const alarmLifecycle = useClassAlarmLifecycle();

  /*
   * Whether an app update is waiting for the student.
   *
   * The compulsory-update modal and the alarm sheet both register a
   * hardware back handler, and the two race: a back press meant for the
   * update could close the alarm sheet instead. The alarm prompt therefore
   * waits while an update is on screen - the sheet is not a modal the
   * student can be trapped behind.
   */
  const [updatePending, setUpdatePending] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await checkForAppUpdate();
        if (cancelled || !result.updateAvailable) return;
        const dismissed = result.manifest?.latestVersion
          ? await isUpdateDismissed(result.manifest.latestVersion, result.isMandatory)
          : false;
        if (!cancelled) setUpdatePending(!dismissed);
      } catch {
        // The update service is not reachable: the app carries on.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Register this device for class-targeted timetable pushes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!(await isTimetablePushEnabled())) return;
        /*
         * A guest who has not chosen a class registers WITHOUT a class key:
         * the placeholder section in the store is not the student's class,
         * and a guest must not be enrolled into somebody else's timetable
         * pushes.
         */
        const result = await registerDeviceForPush(
          hasClassSetup ? classSection : null,
        );
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
  }, [classSection, hasClassSetup]);

  return (
    <SafeAreaProvider style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
        translucent
      />
      {/*
        The navigator is mounted from the very first frame. It used to wait
        for the splash, which meant expo-router threw "Attempted to navigate
        before mounting the Root Layout component" for any navigation in
        that window, and a cold deep link had no navigator to resolve into.
        The splash is now an overlay ON TOP of the mounted navigator.
      */}
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
            <Stack.Screen name="admin/index" options={{ animation: 'slide_from_right' }} />
          ) : null}
          {isAdminApp() ? (
            <Stack.Screen name="moderation" options={{ animation: 'slide_from_right' }} />
          ) : null}
          <Stack.Screen name="events" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="notice/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pdf" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pyq/leaderboard" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="dev/motion" />
        </Stack>
      </Animated.View>

      {/* The splash sits ON TOP of the mounted navigator. */}
      {!splashFinished ? (
        <Animated.View style={[styles.splashOverlay, splashOverlayStyle]}>
          <SplashScreenView onFinish={handleSplashFinish} />
        </Animated.View>
      ) : null}

      {/* Mandatory / Compulsory App Version Update Guard */}
      {splashFinished && !isAdminApp() ? <MandatoryUpdateModal /> : null}

      {/* The prompt that appears when a class alarm rang. */}
      {splashFinished && !updatePending && alarmLifecycle.ringedAlarm ? (
        <AlarmRungPrompt
          alarm={alarmLifecycle.ringedAlarm}
          error={alarmLifecycle.error}
          onSnooze={() => {
            void alarmLifecycle.snooze().catch(() => undefined);
          }}
          onDismiss={() => {
            void alarmLifecycle.dismiss().catch(() => undefined);
          }}
        />
      ) : null}

      {/*
        An alarm action that failed is reported here, not only inside the
        prompt: the prompt releases the student even when the action failed,
        so the message has to outlive it.
      */}
      <Toast
        message={alarmLifecycle.error ?? ''}
        visible={Boolean(alarmLifecycle.error)}
        onDismiss={alarmLifecycle.clearError}
      />

      {/*
        The alarms that expired without an answer. The student is told: an
        alarm that was never delivered (the permission was off, the channel
        was silenced, the phone was off) must not be passed over in silence.
      */}
      {splashFinished && alarmLifecycle.missedAlarms.length > 0 ? (
        <View style={styles.missedCard}>
          <Text style={styles.missedTitle}>An alarm was not answered</Text>
          {alarmLifecycle.missedAlarms.slice(0, 3).map((missed) => (
            <TouchableOpacity
              key={missed.reminder.slotId}
              style={styles.missedRow}
              onPress={() => void alarmLifecycle.acknowledgeMissed(missed.reminder.slotId)}
              accessibilityRole="button"
              accessibilityLabel={`Dismiss the notice about the ${missed.subject} alarm`}
            >
              <Text style={styles.missedText} numberOfLines={2}>
                {missed.subject} ({missed.reminder.start}) - the alarm expired
                without being answered.
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.missedAck}
            onPress={() => {
              for (const missed of alarmLifecycle.missedAlarms) {
                void alarmLifecycle.acknowledgeMissed(missed.reminder.slotId);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Acknowledge every unanswered alarm"
          >
            <Text style={styles.missedAckText}>Got it</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/*
        The exact-alarm permission. Without it Android may ring the alarm
        late, or hold it back until the phone wakes up, so the student is
        told - with the settings screen one tap away.
      */}
      {splashFinished && alarmLifecycle.exactAlarm === 'denied' ? (
        <View style={styles.exactCard}>
          <Text style={styles.exactText}>
            Exact alarms are off, so a class alarm may ring late.
          </Text>
          <TouchableOpacity
            style={styles.exactBtn}
            onPress={() => void openAlarmSettings()}
            accessibilityRole="button"
            accessibilityLabel="Open the settings to allow exact alarms"
          >
            <Text style={styles.exactBtnText}>Open settings</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AppShell />
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  app: { flex: 1 },
  splashOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    elevation: 99999,
  },
  missedCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 120,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
    zIndex: 900,
    elevation: 900,
  },
  missedTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    color: '#78350F',
    marginBottom: 6,
  },
  missedRow: {
    minHeight: 44,
    justifyContent: 'center',
  },
  missedText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 17,
    color: '#78350F',
  },
  missedAck: {
    alignSelf: 'flex-end',
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  missedAckText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#B45309',
  },
  exactCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 120,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
    zIndex: 890,
    elevation: 890,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exactText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 17,
    color: '#78350F',
  },
  exactBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#B45309',
  },
  exactBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: '#FFFFFF',
  },
});
