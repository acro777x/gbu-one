/**
 * GBU One — Compulsory & Mandatory Update Overlay Modal
 *
 * Implemented as a pure overlay view (no native Modal) to strictly honor
 * tests/no_native_modal.test.ts and ensure proper touch dispatch on Android.
 *
 * Realtime & Compulsory Behavior:
 * - Realtime push: Listens to Supabase Realtime broadcast channel, AppState active
 *   events, and a 15-second background poller so updates appear dynamically in real time
 *   without requiring the student to restart the application.
 * - Compulsory / Mandatory updates (isMandatory = true):
 *   - Strictly non-dismissible: NO "Later" button, NO close button, hardware back button trapped.
 *   - Overrides any prior snooze or dismissal.
 * - Optional updates (isMandatory = false):
 *   - Allows "Later / Continue to App", snoozing that specific version for 12 hours.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  BackHandler,
  Linking,
  Platform,
  TouchableOpacity,
  AppState,
  type AppStateStatus,
} from 'react-native';
import Constants from 'expo-constants';
import { ArrowUpCircle, CheckCircle2, ShieldAlert, X } from 'lucide-react-native';
import { GlassCard } from './GlassCard';
import { PillButton } from './PillButton';
import {
  checkForAppUpdate,
  evaluateManifest,
  subscribeToVersionUpdates,
  isUpdateDismissed,
  dismissUpdateForVersion,
  type UpdateCheckResult,
  type AppVersionManifest,
  UPDATE_DISMISSED_KEY,
} from '../../features/updates/versionChecker';
import { useAppTheme } from '../../lib/ThemeContext';
import { theme } from '../../lib/theme';

export { UPDATE_DISMISSED_KEY };

export function MandatoryUpdateModal() {
  const { colors, isDark } = useAppTheme();
  const [updateState, setUpdateState] = useState<UpdateCheckResult | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const mountedRef = useRef(true);
  const currentAppVersion = Constants.expoConfig?.version ?? '1.0.0';

  const performUpdateCheck = useCallback(async () => {
    try {
      const res = await checkForAppUpdate();
      if (!mountedRef.current) return;

      if (res.updateAvailable && res.manifest) {
        const isSnoozed = await isUpdateDismissed(res.manifest.latestVersion, res.isMandatory);
        if (!mountedRef.current) return;
        setUpdateState(res);
        setDismissed(isSnoozed);
      } else {
        setUpdateState(res);
        setDismissed(false);
      }
    } catch {
      // ignore
    }
  }, []);

  // 1. Initial check on mount
  useEffect(() => {
    mountedRef.current = true;
    void performUpdateCheck();
    return () => {
      mountedRef.current = false;
    };
  }, [performUpdateCheck]);

  // 2. Real-time background-to-foreground AppState listener
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void performUpdateCheck();
      }
    });
    return () => sub.remove();
  }, [performUpdateCheck]);

  // 3. Periodic real-time interval poller (checks every 15 seconds in foreground)
  useEffect(() => {
    const interval = setInterval(() => {
      void performUpdateCheck();
    }, 15000);
    return () => clearInterval(interval);
  }, [performUpdateCheck]);

  // 4. Supabase Realtime Broadcast Channel: INSTANT update delivery (<500ms)
  useEffect(() => {
    const unsubscribe = subscribeToVersionUpdates((newManifest: AppVersionManifest) => {
      if (!mountedRef.current) return;
      const evalResult = evaluateManifest(currentAppVersion, newManifest);

      if (evalResult.updateAvailable && evalResult.manifest) {
        void (async () => {
          const isSnoozed = await isUpdateDismissed(
            newManifest.latestVersion,
            evalResult.isMandatory,
          );
          if (!mountedRef.current) return;
          setUpdateState(evalResult);
          setDismissed(isSnoozed);
        })();
      } else {
        setUpdateState(evalResult);
        setDismissed(false);
      }
    });
    return () => unsubscribe();
  }, [currentAppVersion]);

  const handleDismiss = async () => {
    // Compulsory / mandatory updates CANNOT be dismissed
    if (updateState?.isMandatory) return;

    if (updateState?.manifest?.latestVersion) {
      await dismissUpdateForVersion(updateState.manifest.latestVersion);
    }
    setDismissed(true);
  };

  // Android hardware back button handler
  useEffect(() => {
    if (!updateState?.updateAvailable || dismissed) {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      // If mandatory, NEVER dismiss: consume event and keep modal displayed
      if (updateState.isMandatory) {
        return true;
      }
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
  const apkUrl = manifest?.apkUrl ?? 'https://github.com/acro777x/gbu-one';

  const handleUpdatePress = async () => {
    setDownloading(true);
    try {
      const url = apkUrl && apkUrl.startsWith('http') ? apkUrl : 'https://github.com/acro777x/gbu-one';
      await Linking.openURL(url);
    } catch {
      if (Platform.OS === 'android') {
        void Linking.openURL(apkUrl || 'https://github.com/acro777x/gbu-one');
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
            isMandatory && { borderColor: 'rgba(239, 68, 68, 0.4)', borderWidth: 1.5 },
          ]}
          variant="elevated"
        >
          {/* Header Row: Badge & (Optional) Close Button */}
          <View style={styles.topRow}>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: isMandatory
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(79, 70, 229, 0.15)',
                  borderColor: isMandatory ? 'rgba(239, 68, 68, 0.3)' : 'transparent',
                  borderWidth: isMandatory ? 1 : 0,
                },
              ]}
            >
              {isMandatory ? (
                <ShieldAlert size={14} color="#EF4444" style={{ marginRight: 6 }} />
              ) : (
                <ArrowUpCircle size={14} color={colors.accent} style={{ marginRight: 6 }} />
              )}
              <Text
                style={[
                  styles.badgeText,
                  { color: isMandatory ? '#EF4444' : colors.accent, fontWeight: isMandatory ? '700' : '600' },
                ]}
              >
                {isMandatory ? 'CRITICAL COMPULSORY UPDATE' : 'NEW VERSION AVAILABLE'}
              </Text>
            </View>

            {/* Close button only rendered for optional updates */}
            {!isMandatory && (
              <TouchableOpacity
                onPress={handleDismiss}
                style={[styles.closeBtn, { backgroundColor: colors.surfaceAlt }]}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Dismiss update notice"
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {isMandatory ? 'Compulsory Update Required' : 'A New GBU One is Ready'}
          </Text>

          <View style={styles.versionRow}>
            <Text style={[styles.versionText, { color: colors.textSecondary }]}>
              Current:{' '}
              <Text style={{ fontFamily: 'Inter-SemiBold', color: colors.textPrimary }}>
                v{currentVersion}
              </Text>
            </Text>
            <Text style={[styles.arrow, { color: colors.textTertiary }]}>→</Text>
            <Text style={[styles.versionText, { color: isMandatory ? '#EF4444' : colors.accent }]}>
              New:{' '}
              <Text style={{ fontFamily: 'Inter-SemiBold', color: isMandatory ? '#EF4444' : colors.accent }}>
                v{latestVersion}
              </Text>
            </Text>
          </View>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {isMandatory
              ? 'This critical update is required to continue accessing Gautam Buddha University timetable, notices, and exam services. Access is restricted until updated.'
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
                      color={isMandatory ? '#EF4444' : colors.accent}
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

            {!isMandatory ? (
              <PillButton
                label="Later / Continue to App"
                variant="outline"
                size="md"
                onPress={handleDismiss}
                style={{ marginTop: 8 }}
              />
            ) : (
              <Text
                style={[
                  styles.mandatoryWarning,
                  { color: colors.textTertiary },
                ]}
              >
                This update is compulsory. You cannot bypass or postpone it.
              </Text>
            )}
          </View>
        </GlassCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.84)',
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
    fontFamily: 'Poppins-Bold',
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
  mandatoryWarning: {
    marginTop: 10,
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
});
