import React, { useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Poppins_700Bold } from '@expo-google-fonts/poppins';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { SplashScreenView } from '../src/components/brand/SplashScreenView';
import { theme } from '../src/lib/theme';

// Prevent native splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [splashFinished, setSplashFinished] = useState(false);

  const [fontsLoaded] = useFonts({
    'Poppins-Bold': Poppins_700Bold,
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      // Hide native splash once fonts are ready to ensure seamless handoff
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <View style={styles.darkBg} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0B0C" translucent />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
          animation: 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="class-setup" options={{ headerShown: false }} />
        <Stack.Screen name="dev/motion" options={{ headerShown: false }} />
      </Stack>

      {/* Choreographed Animated Splash Overlay */}
      {!splashFinished && (
        <SplashScreenView onFinish={() => setSplashFinished(true)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  darkBg: {
    flex: 1,
    backgroundColor: '#0B0B0C',
  },
});
