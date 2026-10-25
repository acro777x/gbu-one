/**
 * GBU One — Compulsory & Mandatory Update Overlay Modal
 *
 * Implemented as a pure overlay view (no native Modal) to strictly honor
 * tests/no_native_modal.test.ts and ensure proper touch dispatch on Android.
 *
 * When an update is marked mandatory:
 * - The overlay blocks the entire screen.
 * - Hardware back button is prevented from dismissing.
 * - Tapping outside is disabled.
 * - Student must tap "Update Now" to download & install the latest APK.
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
} from 'react-native';
import { ArrowUpCircle, CheckCircle2, ShieldAlert } from 'lucide-react-native';
import { GlassCard } from './GlassCard';
import { PillButton } from './PillButton';
import {
  checkForAppUpdate,
  type UpdateCheckResult,
} from '../../features/updates/versionChecker';
import { useAppTheme } from '../../lib/ThemeContext';
import { theme } from '../../lib/theme';

export function MandatoryUpdateModal() {
  const { colors, isDark } = useAppTheme();
  const [updateState, setUpdateState] = useState<UpdateCheckResult | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let mounted = true;
    void checkForAppUpdate().then((res) => {
      if (mounted) {
        setUpdateState(res);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  // Trap Android hardware back button if update is mandatory
  useEffect(() => {
    if (!updateState?.updateAvailable || !updateState.isMandatory || dismissed) {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      // Return true to prevent going back / leaving the mandatory modal
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
      // Fallback
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
          style={[styles.card, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)' }]}
          variant="elevated"
        >
          {/* Header Badge */}
          <View style={styles.badgeRow}>
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
                {isMandatory ? 'COMPULSORY UPDATE' : 'NEW VERSION AVAILABLE'}
              </Text>
            </View>
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {isMandatory ? 'Update Required' : 'A New GBU One is Ready'}
          </Text>

          <View style={styles.versionRow}>
            <Text style={[styles.versionText, { color: colors.textSecondary }]}>
              Current: <Text style={{ fontFamily: 'Inter-SemiBold', color: colors.textPrimary }}>v{currentVersion}</Text>
            </Text>
            <Text style={[styles.arrow, { color: colors.textTertiary }]}>→</Text>
            <Text style={[styles.versionText, { color: colors.accent }]}>
              New: <Text style={{ fontFamily: 'Inter-SemiBold', color: colors.accent }}>v{latestVersion}</Text>
            </Text>
          </View>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {isMandatory
              ? 'This version includes mandatory security updates, official examination calendar syncing, and live university timetable alerts. You must update to continue.'
              : 'Update to enjoy the latest GBU One enhancements, PYQ library, and campus events.'}
          </Text>

          {/* Release Notes */}
          {manifest?.releaseNotes && manifest.releaseNotes.length > 0 && (
            <View style={[styles.notesBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderGlass }]}>
              <Text style={[styles.notesHeader, { color: colors.textPrimary }]}>What's New in v{latestVersion}:</Text>
              <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false}>
                {manifest.releaseNotes.map((note, index) => (
                  <View key={index} style={styles.noteItem}>
                    <CheckCircle2 size={13} color={colors.accent} style={{ marginTop: 2, marginRight: 8, flexShrink: 0 }} />
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

            {!isMandatory && (
              <PillButton
                label="Later"
                variant="outline"
                size="md"
                onPress={() => setDismissed(true)}
                style={{ marginTop: 8 }}
              />
            )}
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
  badgeRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Poppins-Bold',
    marginBottom: 6,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  versionText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
  },
  arrow: {
    fontSize: 14,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
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
    marginBottom: 8,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Inter-Regular',
    flex: 1,
  },
  actions: {
    marginTop: theme.spacing.sm,
  },
});
