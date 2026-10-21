/**
 * A development screen that rings a real class alarm a few seconds from now,
 * so the notification can be checked on a device (or in the emulator) end to
 * end: the channel, the bundled chime, the scheduled trigger and the
 * notification itself.
 *
 * Reach it at /dev/alarm-test. It is only meant for the team, never for the
 * students.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useAppTheme } from '../../src/lib/ThemeContext';
import { theme } from '../../src/lib/theme';
import { PillButton } from '../../src/components/ui';
import {
  CLASS_ALARM_SOUND,
  CLASS_REMINDER_CHANNEL_ID,
  CLASS_REMINDER_CHANNEL_NAME,
  ensureClassReminderChannel,
  scheduleClassAlarm,
} from '../../src/features/notifications/classAlarm';

export default function AlarmTestScreen() {
  const { colors } = useAppTheme();
  const [status, setStatus] = useState('Pick a delay and ring a real alarm.');

  const ring = async (seconds: number) => {
    try {
      const permission = await Notifications.getPermissionsAsync();
      if (!permission.granted) {
        const asked = await Notifications.requestPermissionsAsync();
        if (!asked.granted) {
          setStatus('Notifications are off for this app, so nothing can ring.');
          return;
        }
      }

      await ensureClassReminderChannel();
      const fireAt = new Date(Date.now() + seconds * 1000);
      const id = await scheduleClassAlarm({
        title: 'Scientific Computing with Python Lab',
        body: 'The class starts in 15 seconds - IP101 - SOICT Building',
        fireAt,
        data: { type: 'class-reminder', slotId: 'dev-alarm', subject: 'Dev test' },
      });

      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      setStatus(
        `Scheduled for ${fireAt.toLocaleTimeString()} (${seconds}s). ` +
          `Notification id ${id}. The OS holds ${scheduled.length} scheduled notification(s). ` +
          'Lock the screen or wait for it to appear in the shade.',
      );
    } catch (error) {
      setStatus(`Could not schedule: ${String(error)}`);
    }
  };

  const listChannels = async () => {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      setStatus(
        `Scheduled notifications: ${scheduled.length}. ` +
          scheduled
            .map(
              (n) =>
                `${n.content.title} @ ${String(
                  (n.trigger as { date?: Date } | undefined)?.date ?? 'now',
                )}`,
            )
            .join(' | '),
      );
    } catch (error) {
      setStatus(`Could not read the scheduled list: ${String(error)}`);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Class alarm test</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Channel {CLASS_REMINDER_CHANNEL_ID} ({CLASS_REMINDER_CHANNEL_NAME}) with the sound{' '}
          {CLASS_ALARM_SOUND}.
        </Text>

        <View style={styles.row}>
          <PillButton label="Ring in 10 s" onPress={() => void ring(10)} />
          <PillButton label="Ring in 30 s" onPress={() => void ring(30)} />
        </View>
        <View style={styles.row}>
          <PillButton label="List scheduled" onPress={() => void listChannels()} />
        </View>

        <View style={[styles.statusBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderGlass }]}>
          <Text style={[styles.status, { color: colors.textPrimary }]}>{status}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: theme.spacing.lg },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginBottom: theme.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  statusBox: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.radius.card,
    borderWidth: 1,
  },
  status: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    lineHeight: 19,
  },
});
