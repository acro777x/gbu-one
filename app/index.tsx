import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../src/lib/ThemeContext';

export default function Index() {
  const { colors } = useAppTheme();
  const [target, setTarget] = useState<'/onboarding' | '/(tabs)' | '/admin' | null>(null);

  useEffect(() => {
    let mounted = true;
    const pkg = Constants.expoConfig?.android?.package;
    if (pkg === 'in.gbu.one.admin' || process.env.EXPO_PUBLIC_APP_VARIANT === 'admin') {
      setTarget('/admin');
      return;
    }

    AsyncStorage.getItem('@gbu_one_has_seen_onboarding')
      .then((v) => {
        if (mounted) {
          setTarget(v === 'true' ? '/(tabs)' : '/onboarding');
        }
      })
      .catch(() => {
        if (mounted) {
          setTarget('/onboarding');
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!target) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return <Redirect href={target} />;
}
