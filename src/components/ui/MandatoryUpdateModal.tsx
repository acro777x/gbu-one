/**
 * GBU One — Compulsory & Mandatory Update Overlay Modal
 *
 * Implemented as a pure overlay view (no native Modal) to strictly honor
 * tests/no_native_modal.test.ts and ensure proper touch dispatch on Android.
 *
 * When an update is available:
 * - A clear glass modal presents the new version, highlights, and APK action.
 * - Students can tap "Download & Install Update".
 * - Students can dismiss the modal with "Later" or the top-right close button,
 *   persisting the dismissal so it doesn't repeatedly trap or annoy the user.
 */

import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  BackHandler,
  Linking,
  Platform,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowUpCircle, CheckCircle2, ShieldAlert, X } from 'lucide-react-native';
import { GlassCard } from './GlassCard';
import { PillButton } from './PillButton';
import {
  checkForAppUpdate,
  type UpdateCheckResult,
} from '../../features/updates/versionChecker';
import { useAppTheme } from '../../lib/ThemeContext';
import { theme } from '../../lib/theme';

export const UPDATE_DISMISSED_KEY = '@gbu_one_update_dismissed_until';

export function MandatoryUpdateModal() {
  const { colors, isDark } = useAppTheme();
  const [updateState, setUpdateState] = useState<UpdateCheckResult | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const dismissedUntil = await AsyncStorage.getItem(UPDATE_DISMISSED_KEY);
        if (dismissedUntil && Date.now() < Number(dismissedUntil)) {
          if (mounted) setDismissed(true);
          return;
        }

        const res = await checkForAppUpdate();
        if (mounted) {
          setUpdateState(res);
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleDismiss = async () => {
    setDismissed(true);
    try {
      // Snooze update prompt for 12 hours so it doesn't keep blocking the user
      await AsyncStorage.setItem(
        UPDATE_DISMISSED_KEY,
        String(Date.now() + 12 * 60 * 60 * 1000),
      );
    } catch {
      // ignore
    }
  };

  // Android hardware back button handler
  useEffect(() => {
    if (!updateState?.updateAvailable || dismissed) {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      void handleDismiss();
      return true;
    });

    return () => subscription.remove();
  }, [updateState, dismissed]);

  if (!updateState?.updateAvailable || dismissed) {
    return null;
  }

  const { isMandatory, currentVersion, manifest } = updateState;
  const latestVersion = manifest?.latestVersion ?? '1.1.0';
  const apkUrl = manifest?.apkUrl ?? 'https://github.com/acro777x/gbu-one/releases/latest';

  const handleUpdatePress = async () => {
    setDownloading(true);
    try {
      const supported = await Linking.canOpenURL(apkUrl);
      if (supported) {
        await Linking.openURL(apkUrl);
      } else {
        await Linking.openURL('https://github.com/acro777x/gbu-one/releases/latest');
      }
    } catch {
      if (Platform.OS === 'android') {
        void Linking.openURL(apkUrl);
      }
    } finally {
      setTimeout(() => setDownloading(false), 2000);
    }
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.backdrop, { zIndex: 99999 }]}>
      <View style={styles.container}>
        <GlassCard
          style={[
            styles.card,
            { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)' },
          ]}
          variant="elevated"
        >
          {/* Header Row: Badge & Close Button */}
          <View style={styles.topRow}>
            <View
              style={[
                styles.badge,
                { backgroundColor: isMandatory ? 'rgba(239, 68, 68, 0.15)' : 'rgba(79, 70, 229, 0.15)' },
              ]}
            >
              {isMandatory ? (
                <ShieldAlert size={14} color="#EF4444" style={{ marginRight: 6 }} />
              ) : (
                <ArrowUpCircle size={14} color={colors.accent} style={{ marginRight: 6 }} />
              )}
              <Text style={[styles.badgeText, { color: isMandatory ? '#EF4444' : colors.accent }]}>
                {isMandatory ? 'RECOMMENDED UPDATE' : 'NEW VERSION AVAILABLE'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleDismiss}
              style={[styles.closeBtn, { backgroundColor: colors.surfaceAlt }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss update notice"
            >
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {isMandatory ? 'Update Recommended' : 'A New GBU One is Ready'}
          </Text>

          <View style={styles.versionRow}>
            <Text style={[styles.versionText, { color: colors.textSecondary }]}>
              Current:{' '}
              <Text style={{ fontFamily: 'Inter-SemiBold', color: colors.textPrimary }}>
                v{currentVersion}
              </Text>
            </Text>
            <Text style={[styles.arrow, { color: colors.textTertiary }]}>→</Text>
            <Text style={[styles.versionText, { color: colors.accent }]}>
              New:{' '}
              <Text style={{ fontFamily: 'Inter-SemiBold', color: colors.accent }}>
                v{latestVersion}
              </Text>
            </Text>
          </View>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {isMandatory
              ? 'This release includes official university examination calendar updates, enhanced real notice scrapers, and 120Hz smooth scrolling.'
              : 'Update to enjoy the latest GBU One enhancements, PYQ library, and campus events.'}
          </Text>

          {/* Release Notes */}
          {manifest?.releaseNotes && manifest.releaseNotes.length > 0 && (
            <View style={[styles.notesBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderGlass }]}>
              <Text style={[styles.notesHeader, { color: colors.textPrimary }]}>
                What's New in v{latestVersion}:
              </Text>
              <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false}>
                {manifest.releaseNotes.map((note, index) => (
                  <View key={index} style={styles.noteItem}>
                    <CheckCircle2
                      size={13}
                      color={colors.accent}
                      style={{ marginTop: 2, marginRight: 8, flexShrink: 0 }}
                    />
                    <Text style={[styles.noteText, { color: colors.textSecondary }]}>{note}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            <PillButton
              label={downloading ? 'Launching Updater…' : 'Download & Install Update'}
              variant="primary"
              size="lg"
              loading={downloading}
              icon={<ArrowUpCircle size={18} color={colors.onAccent} style={{ marginRight: 8 }} />}
              onPress={handleUpdatePress}
            />

            <PillButton
              label="Later / Continue to App"
              variant="outline"
              size="md"
              onPress={handleDismiss}
              style={{ marginTop: 8 }}
            />
          </View>
        </GlassCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 420,
  },
  card: {
    padding: theme.spacing.xl,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans-Bold',
    marginBottom: 6,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  versionText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
  },
  arrow: {
    marginHorizontal: 8,
    fontSize: 13,
  },
  description: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    lineHeight: 19,
    marginBottom: theme.spacing.md,
  },
  notesBox: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.lg,
  },
  notesHeader: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 6,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
  },
  noteText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    lineHeight: 17,
    flex: 1,
  },
  actions: {
    marginTop: theme.spacing.xs,
  },
});
