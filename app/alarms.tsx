/**
 * GBU One — Class Alarms & Reminder Hub
 *
 * The honest diagnostics screen for the class alarms: what the OS has
 * actually allowed, which channel the alarm really went to, and which alarms
 * are armed right now.
 *
 * Three rules run through this screen:
 *
 *  1. **Never claim an alarm rang when it did not.** The test buttons ask
 *     for the notification permission first and stop there if it was refused.
 *  2. **Never show a green badge for something that failed.** The channel
 *     badge reports the channel that was really created - an Android channel
 *     cannot be changed after it exists, so a silent channel would stay
 *     silent for the rest of the semester.
 *  3. **Never leave the student without a way out.** A blocked permission
 *     cannot be asked for again, so the screen opens the system settings.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import {
  ArrowLeft,
  BellRing,
  Volume2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  MapPin,
  RefreshCw,
  Settings as SettingsIcon,
} from 'lucide-react-native';
import { GlassCard, PillButton, Toast, EmptyState } from '../src/components/ui';
import {
  ensureClassReminderChannel,
  scheduleTestAlarm,
  cancelClassAlarmsForSlot,
  getExactAlarmCapability,
  exactAlarmSettingsHint,
  openAlarmSettings,
  type ClassChannelStatus,
  type ExactAlarmCapability,
} from '../src/features/notifications/classAlarm';
import {
  formatLeadTimeVerbose,
  resolvePermissionState,
  NOTIFICATION_PERMISSION_ASKED_KEY,
  type NotificationPermissionState,
} from '../src/features/notifications/notificationPreferences';
import {
  useNotificationPreferences,
  clearAllStoredReminders,
} from '../src/features/notifications/useNotificationPreferences';
import { useAppTheme } from '../src/lib/ThemeContext';
import { theme } from '../src/lib/theme';

/**
 * The permission rule itself lives with the rest of the notification logic
 * in `src/features/notifications/notificationPreferences.ts`, so it can be
 * unit tested without a device. It is re-exported here for convenience.
 */
export {
  resolvePermissionState,
  NOTIFICATION_PERMISSION_ASKED_KEY,
  type NotificationPermissionState,
};

export default function AlarmsScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  // The alarm list is the SHARED store, so a dismissal in the notification
  // shade is reflected here at once instead of after a reload.
  const { reminders, isLoading, removeReminder } = useNotificationPreferences();

  const [permissionState, setPermissionState] =
    useState<NotificationPermissionState>('unknown');
  const [exactAlarm, setExactAlarm] = useState<ExactAlarmCapability>('unknown');
  const [channelStatus, setChannelStatus] = useState<ClassChannelStatus | null>(null);
  const [testingAlarm, setTestingAlarm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
  };

  const loadDiagnostics = useCallback(async () => {
    try {
      const [perm, askedBefore] = await Promise.all([
        Notifications.getPermissionsAsync(),
        AsyncStorage.getItem(NOTIFICATION_PERMISSION_ASKED_KEY),
      ]);
      setPermissionState(
        resolvePermissionState(perm, askedBefore === 'true'),
      );
    } catch {
      // A platform that cannot report the permission leaves the state as it
      // was: the student is not told anything that is not true.
    }

    try {
      setExactAlarm(await getExactAlarmCapability());
    } catch {
      setExactAlarm('unknown');
    }

    try {
      setChannelStatus(await ensureClassReminderChannel());
    } catch {
      setChannelStatus(null);
    }
  }, []);

  useEffect(() => {
    void loadDiagnostics();
  }, [loadDiagnostics]);

  /**
   * Asks the OS for the notification permission.
   *
   * It returns whether the permission is now on, so the caller can stop
   * instead of going on to claim that an alarm rang when nothing could.
   */
  const handleRequestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const perm = await Notifications.requestPermissionsAsync();
      await AsyncStorage.setItem(NOTIFICATION_PERMISSION_ASKED_KEY, 'true');
      const next = resolvePermissionState(perm, true);
      setPermissionState(next);
      if (next === 'granted') {
        showToast('Notification permission enabled.');
        return true;
      }
      if (next === 'blocked') {
        showToast('Notifications are blocked. Open the app settings to allow them.');
      } else {
        showToast('Notifications were refused. You can allow them from the app settings.');
      }
      return false;
    } catch {
      showToast('The notification permission could not be requested.');
      return false;
    }
  }, []);

  /** Opens the system settings page for this app. */
  const handleOpenSettings = useCallback(async () => {
    const opened = await openAlarmSettings();
    if (!opened) {
      // `Linking.openSettings` is the only API React Native exposes, so
      // this is the last resort: tell the student where to go instead.
      showToast(
        Platform.OS === 'android'
          ? 'Open Settings > Apps > GBU One > Notifications.'
          : 'Open Settings > Notifications > GBU One.',
      );
    }
  }, []);

  const handleImmediateAlarm = async () => {
    if (permissionState !== 'granted') {
      const granted = await handleRequestPermission();
      // Nothing can ring without the permission: say so, and stop.
      if (!granted) return;
    }
    try {
      await scheduleTestAlarm(0);
      showToast('Test alarm sent - check the notification shade.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not trigger the test alarm');
    }
  };

  const handleTestAlarm = async () => {
    if (permissionState !== 'granted') {
      const granted = await handleRequestPermission();
      if (!granted) return;
    }
    setTestingAlarm(true);
    try {
      await scheduleTestAlarm(5);
      showToast('Test alarm armed - it rings in 5 seconds.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not schedule the test alarm');
    } finally {
      setTimeout(() => setTestingAlarm(false), 5000);
    }
  };

  const handleCancelReminder = async (slotId: string) => {
    // The OS alarm goes first, then the stored record: the shared store is
    // updated through the hook's own writer, so the timetable screen sees
    // the removal at the same moment.
    await cancelClassAlarmsForSlot(slotId);
    await removeReminder(slotId);
    showToast('Alarm removed');
  };

  const handleClearAll = async () => {
    for (const reminder of reminders) {
      await cancelClassAlarmsForSlot(reminder.slotId);
    }
    await clearAllStoredReminders();
    showToast('All class alarms cleared');
  };

  const permissionBadge = (() => {
    if (permissionState === 'granted') {
      return (
        <View style={[styles.diagBadge, { backgroundColor: colors.successSoft }]}>
          <CheckCircle2 size={14} color={colors.success} />
          <Text style={[styles.diagBadgeText, { color: colors.success }]}>Active</Text>
        </View>
      );
    }
    if (permissionState === 'blocked') {
      return (
        <TouchableOpacity
          onPress={() => void handleOpenSettings()}
          style={[styles.diagActionBtn, { backgroundColor: colors.warning }]}
          accessibilityRole="button"
          accessibilityLabel="Open the system settings to allow notifications"
        >
          <Text style={[styles.diagActionBtnText, { color: colors.onAccent }]}>Open settings</Text>
        </TouchableOpacity>
      );
    }
    if (permissionState === 'denied') {
      return (
        <TouchableOpacity
          onPress={() => void handleRequestPermission()}
          style={[styles.diagActionBtn, { backgroundColor: colors.accent }]}
          accessibilityRole="button"
          accessibilityLabel="Ask for the notification permission again"
        >
          <Text style={[styles.diagActionBtnText, { color: colors.onAccent }]}>Try again</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        onPress={() => void handleRequestPermission()}
        style={[styles.diagActionBtn, { backgroundColor: colors.accent }]}
        accessibilityRole="button"
        accessibilityLabel="Allow notifications for class alarms"
      >
        <Text style={[styles.diagActionBtnText, { color: colors.onAccent }]}>Enable</Text>
      </TouchableOpacity>
    );
  })();

  const channelBadge = (() => {
    if (!channelStatus) {
      return (
        <View style={[styles.diagBadge, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={[styles.diagBadgeText, { color: colors.textSecondary }]}>Checking…</Text>
        </View>
      );
    }
    if (!channelStatus.ok || !channelStatus.hasSound) {
      return (
        <View style={[styles.diagBadge, { backgroundColor: colors.dangerSoft }]}>
          <AlertTriangle size={14} color={colors.danger} />
          <Text style={[styles.diagBadgeText, { color: colors.danger }]}>Silent</Text>
        </View>
      );
    }
    return (
      <View style={[styles.diagBadge, { backgroundColor: colors.successSoft }]}>
        <CheckCircle2 size={14} color={colors.success} />
        <Text style={[styles.diagBadgeText, { color: colors.success }]}>
          {channelStatus.variant === 'fallback' ? 'Ready (backup)' : 'Ready'}
        </Text>
      </View>
    );
  })();

  const soundDetail =
    Platform.OS === 'android'
      ? 'res/raw/class_alarm.mp3 • High Priority Alarm'
      : 'Bundled university alarm (29s) • Plays with the class alarm channel';

  const settingsAdvice =
    Platform.OS === 'android'
      ? 'Android Settings > Apps > GBU One > Notifications'
      : 'iOS Settings > Notifications > GBU One';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderGlass }]}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/timetable'))}
          style={[styles.backBtn, { backgroundColor: colors.surface }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTextCol}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Class Alarms & Reminders</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            Official Gautam Buddha University class ringtones
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => void loadDiagnostics()}
          style={[styles.iconBtn, { backgroundColor: colors.surface }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Refresh the alarm status"
        >
          <RefreshCw size={18} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(120, insets.bottom + 40) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Diagnostic Card */}
        <GlassCard style={styles.statusCard} variant="elevated">
          <View style={styles.cardHeaderRow}>
            <Volume2 size={20} color={colors.accent} />
            <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>Alarm System Status</Text>
          </View>
          <Text style={[styles.statusSub, { color: colors.textSecondary }]}>
            Class alarms use the official 29-second university sound with vibration pattern and snooze capability.
          </Text>

          {/* Permissions Status Row */}
          <View style={[styles.diagRow, { borderBottomColor: colors.borderGlass }]}>
            <View style={styles.diagLeft}>
              <Text style={[styles.diagLabel, { color: colors.textPrimary }]}>Notification Permission</Text>
              <Text style={[styles.diagSub, { color: colors.textSecondary }]}>
                {permissionState === 'granted'
                  ? 'Active and ready to trigger on schedule'
                  : permissionState === 'blocked'
                    ? 'Blocked. The system will not ask again - allow it in the settings.'
                    : permissionState === 'denied'
                      ? 'Refused. You can allow notifications from the settings.'
                      : 'Permission needed to alert you before class starts'}
              </Text>
            </View>
            {permissionBadge}
          </View>

          {/* Audio Channel Row */}
          <View style={[styles.diagRow, { borderBottomColor: colors.borderGlass }]}>
            <View style={styles.diagLeft}>
              <Text style={[styles.diagLabel, { color: colors.textPrimary }]}>Sound Channel</Text>
              <Text style={[styles.diagSub, { color: colors.textSecondary }]}>{soundDetail}</Text>
            </View>
            {channelBadge}
          </View>

          {/*
            The exact-alarm permission is not granted to an app that is not
            an alarm clock on Android 14, and the student can revoke it on
            Android 12+. An alarm that quietly becomes inexact can ring
            minutes late, so the app says so instead of leaving it to chance.
          */}
          {Platform.OS === 'android' && exactAlarm === 'denied' ? (
            <View style={[styles.warningBox, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
              <View style={styles.diagLeft}>
                <Text style={[styles.diagLabel, { color: colors.textPrimary }]}>
                  Exact alarms are not allowed
                </Text>
                <Text style={[styles.diagSub, { color: colors.textSecondary }]}>
                  Your class alarms may ring late while the app is asleep. Allow them in{' '}
                  {exactAlarmSettingsHint() ?? 'the Android settings'}.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => void handleOpenSettings()}
                style={[styles.diagActionBtn, { backgroundColor: colors.warning }]}
                accessibilityRole="button"
                accessibilityLabel="Open the settings to allow exact alarms"
              >
                <Text style={[styles.diagActionBtnText, { color: colors.onAccent }]}>Open settings</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Test Alarm Action */}
          <View style={styles.testBtnBox}>
            <View style={{ gap: 10 }}>
              <PillButton
                label="Test Alarm Sound (Fire Immediately)"
                onPress={() => void handleImmediateAlarm()}
                variant="primary"
                size="md"
                icon={<BellRing size={16} color={colors.onAccent} style={{ marginRight: 6 }} />}
              />
              <PillButton
                label={testingAlarm ? 'Armed — Rings in 5s…' : 'Arm 5-Second Test Alarm (Background Test)'}
                onPress={() => void handleTestAlarm()}
                variant="outline"
                size="md"
                loading={testingAlarm}
                icon={<Clock size={16} color={colors.accent} style={{ marginRight: 6 }} />}
              />
            </View>
            <Text style={[styles.testHint, { color: colors.textTertiary, marginTop: 8 }]}>
              Test immediately to hear the official university ringtone, or arm for 5 seconds to test lockscreen / background wake.
            </Text>
          </View>
        </GlassCard>

        {/* Section Header: Active Alarms */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Active Class Alarms ({reminders.length})
          </Text>
          {reminders.length > 0 && (
            <TouchableOpacity
              onPress={() => void handleClearAll()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.clearAllBtn}
              accessibilityRole="button"
              accessibilityLabel="Clear every class alarm"
            >
              <Text style={[styles.clearAllText, { color: colors.danger }]}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        {reminders.length === 0 ? (
          <EmptyState
            title={isLoading ? 'Reading your alarms…' : 'No Alarms Scheduled'}
            description={
              isLoading
                ? 'Your scheduled class alarms are being read from this device.'
                : 'Open your Timetable, tap any class slot, and choose a reminder lead time to ring before class starts.'
            }
          />
        ) : (
          reminders.map((reminder) => (
            <GlassCard key={`${reminder.slotId}-${reminder.fireAt}`} style={styles.reminderCard} variant="subtle">
              <View style={styles.reminderTop}>
                <View style={styles.reminderInfo}>
                  <Text style={[styles.reminderSubject, { color: colors.textPrimary }]}>
                    {reminder.subject}
                  </Text>
                  <View style={styles.reminderMetaRow}>
                    <Clock size={13} color={colors.accent} />
                    <Text style={[styles.reminderMetaText, { color: colors.textSecondary }]}>
                      Starts at {reminder.start} ({formatLeadTimeVerbose(reminder.leadMinutes)} before)
                    </Text>
                  </View>
                  {reminder.repeatsWeekly ? (
                    <View style={styles.reminderMetaRow}>
                      <MapPin size={13} color={colors.accent} />
                      <Text style={[styles.reminderMetaText, { color: colors.textSecondary }]}>
                        Repeats every week
                      </Text>
                    </View>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => void handleCancelReminder(reminder.slotId)}
                  style={[styles.deleteBtn, { backgroundColor: colors.surface }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Cancel reminder for ${reminder.subject}`}
                >
                  <Trash2 size={16} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </GlassCard>
          ))
        )}

        {/* Reliability / Battery Optimization Guide */}
        <GlassCard style={styles.guideCard} variant="subtle">
          <View style={styles.guideHeader}>
            <AlertTriangle size={16} color={colors.warning} />
            <Text style={[styles.guideTitle, { color: colors.textPrimary }]}>
              Keeping your class alarms reliable
            </Text>
          </View>
          <Text style={[styles.guideText, { color: colors.textSecondary }]}>
            {Platform.OS === 'android'
              ? `1. Allow notifications and alarms for GBU One (${settingsAdvice}).\n2. Keep 'Do Not Disturb' configured to allow GBU One alarms.\n3. Disable aggressive battery saver for GBU One in your phone's battery settings so the alarm isn't suppressed in deep sleep.\n4. On Xiaomi/Realme/Oppo, enable 'Autostart' and remove background restrictions.`
              : `1. Allow notifications for GBU One (${settingsAdvice}).\n2. Keep 'Do Not Disturb' configured to allow GBU One alarms.\n3. Choose 'Time Sensitive' notifications so an alarm is not held back by a Focus mode.`}
          </Text>
        </GlassCard>

        {/* The settings shortcut is repeated at the bottom: a student who
            scrolled past the diagnostics card still has a way to fix the
            permission. */}
        {permissionState !== 'granted' ? (
          <TouchableOpacity
            onPress={() => void handleOpenSettings()}
            style={[styles.settingsLink, { borderColor: colors.borderGlass, backgroundColor: colors.surfaceAlt }]}
            accessibilityRole="button"
            accessibilityLabel="Open the system settings for GBU One"
          >
            <SettingsIcon size={16} color={colors.accent} />
            <Text style={[styles.settingsLinkText, { color: colors.textPrimary }]}>
              Open the system settings for GBU One
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <Toast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
  },
  headerSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 1,
  },
  content: {
    padding: theme.spacing.lg,
  },
  statusCard: {
    padding: 16,
    marginBottom: 20,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statusTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
  },
  statusSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  diagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  diagLeft: {
    flex: 1,
    marginRight: 10,
  },
  diagLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  diagSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  diagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  diagBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
  },
  diagActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 6,
  },
  diagActionBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  testBtnBox: {
    marginTop: 16,
  },
  testHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 15,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 6,
  },
  sectionTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
  },
  clearAllBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  clearAllText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  reminderCard: {
    padding: 14,
    marginBottom: 10,
  },
  reminderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reminderInfo: {
    flex: 1,
    marginRight: 10,
  },
  reminderSubject: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    marginBottom: 4,
  },
  reminderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reminderMetaText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  deleteBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideCard: {
    padding: 14,
    marginTop: 20,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  guideTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  guideText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    marginTop: 16,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  settingsLinkText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
});
