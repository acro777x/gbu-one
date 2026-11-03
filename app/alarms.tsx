/**
 * GBU One — Class Alarms & Reminder Hub
 *
 * Provides dedicated diagnostics, active alarm management, and real-time
 * alarm firing tests for GBU class schedules.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import {
  ArrowLeft,
  Bell,
  BellRing,
  BellOff,
  Volume2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Sparkles,
  MapPin,
  RefreshCw,
} from 'lucide-react-native';
import { GlassCard, PillButton, Toast, EmptyState } from '../src/components/ui';
import {
  ensureClassReminderChannel,
  scheduleTestAlarm,
  cancelClassAlarmsForSlot,
  CLASS_REMINDER_CHANNEL_ID,
} from '../src/features/notifications/classAlarm';
import {
  formatLeadTimeVerbose,
  type ClassReminder,
} from '../src/features/notifications/notificationPreferences';
import {
  readStoredReminders,
  removeStoredReminder,
  clearAllStoredReminders,
} from '../src/features/notifications/useNotificationPreferences';
import { formatRoomLocation } from '../src/features/timetable/roomMapping';
import { useAppTheme } from '../src/lib/ThemeContext';
import { theme } from '../src/lib/theme';

export default function AlarmsScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [reminders, setReminders] = useState<ClassReminder[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [testingAlarm, setTestingAlarm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
  };

  const loadRemindersAndPermissions = useCallback(async () => {
    try {
      const stored = await readStoredReminders();
      setReminders(stored);

      const perm = await Notifications.getPermissionsAsync();
      setPermissionStatus(perm.granted ? 'granted' : perm.canAskAgain ? 'undetermined' : 'denied');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadRemindersAndPermissions();
    if (Platform.OS === 'android') {
      void ensureClassReminderChannel();
    }
  }, [loadRemindersAndPermissions]);

  const handleRequestPermission = async () => {
    const perm = await Notifications.requestPermissionsAsync();
    setPermissionStatus(perm.granted ? 'granted' : 'denied');
    if (perm.granted) {
      showToast('Notification permission enabled!');
    } else {
      showToast('Notifications denied. Please enable in Android Settings > Apps > GBU One');
    }
  };

  const handleTestAlarm = async () => {
    if (permissionStatus !== 'granted') {
      await handleRequestPermission();
    }
    setTestingAlarm(true);
    try {
      await scheduleTestAlarm(5);
      showToast('Test alarm armed! Put app in background or watch screen — rings in 5 seconds.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not schedule test alarm');
    } finally {
      setTimeout(() => setTestingAlarm(false), 5000);
    }
  };

  const handleCancelReminder = async (slotId: string) => {
    await cancelClassAlarmsForSlot(slotId);
    await removeStoredReminder(slotId);
    setReminders((prev) => prev.filter((r) => r.slotId !== slotId));
    showToast('Alarm removed');
  };

  const handleClearAll = async () => {
    for (const r of reminders) {
      await cancelClassAlarmsForSlot(r.slotId);
    }
    await clearAllStoredReminders();
    setReminders([]);
    showToast('All class alarms cleared');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderGlass }]}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/timetable'))}
          style={[styles.backBtn, { backgroundColor: colors.surface }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
          onPress={loadRemindersAndPermissions}
          style={[styles.iconBtn, { backgroundColor: colors.surface }]}
          accessibilityLabel="Refresh"
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
                {permissionStatus === 'granted'
                  ? 'Active and ready to trigger on schedule'
                  : 'Permission needed to alert you before class starts'}
              </Text>
            </View>
            {permissionStatus === 'granted' ? (
              <View style={[styles.diagBadge, { backgroundColor: colors.successSoft }]}>
                <CheckCircle2 size={14} color={colors.success} />
                <Text style={[styles.diagBadgeText, { color: colors.success }]}>Active</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleRequestPermission}
                style={[styles.diagActionBtn, { backgroundColor: colors.accent }]}
              >
                <Text style={[styles.diagActionBtnText, { color: colors.onAccent }]}>Enable</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Audio Channel Row */}
          <View style={[styles.diagRow, { borderBottomColor: colors.borderGlass }]}>
            <View style={styles.diagLeft}>
              <Text style={[styles.diagLabel, { color: colors.textPrimary }]}>Sound Channel</Text>
              <Text style={[styles.diagSub, { color: colors.textSecondary }]}>
                res/raw/class_alarm.mp3 • High Priority Alarm
              </Text>
            </View>
            <View style={[styles.diagBadge, { backgroundColor: colors.accentSoft }]}>
              <CheckCircle2 size={14} color={colors.accent} />
              <Text style={[styles.diagBadgeText, { color: colors.accent }]}>Channel Ready</Text>
            </View>
          </View>

          {/* Test Alarm Action */}
          <View style={styles.testBtnBox}>
            <PillButton
              label={testingAlarm ? 'Firing Alarm in 5 seconds…' : 'Test Alarm Sound Now (5s)'}
              onPress={handleTestAlarm}
              variant="primary"
              size="md"
              loading={testingAlarm}
              icon={<BellRing size={16} color={colors.onAccent} style={{ marginRight: 6 }} />}
            />
            <Text style={[styles.testHint, { color: colors.textTertiary }]}>
              Tap above to simulate a class alarm firing in 5 seconds with vibration and official audio.
            </Text>
          </View>
        </GlassCard>

        {/* Section Header: Active Alarms */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Active Class Alarms ({reminders.length})
          </Text>
          {reminders.length > 0 && (
            <TouchableOpacity onPress={handleClearAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.clearAllText, { color: colors.danger }]}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        {reminders.length === 0 ? (
          <EmptyState
            title="No Alarms Scheduled"
            description="Open your Timetable, tap any class slot, and choose a reminder lead time to ring before class starts."
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
                </View>
                <TouchableOpacity
                  onPress={() => handleCancelReminder(reminder.slotId)}
                  style={[styles.deleteBtn, { backgroundColor: colors.surface }]}
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
              Ensuring 100% Alarm Reliability on Android
            </Text>
          </View>
          <Text style={[styles.guideText, { color: colors.textSecondary }]}>
            1. Keep 'Do Not Disturb' configured to allow GBU One alarms.{'\n'}
            2. Disable aggressive battery saver for GBU One in your phone's battery settings so the alarm isn't suppressed in deep sleep.{'\n'}
            3. On Xiaomi/Realme/Oppo, enable 'Autostart' and remove background restrictions.
          </Text>
        </GlassCard>
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    paddingVertical: 6,
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
    width: 34,
    height: 34,
    borderRadius: 17,
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
});
