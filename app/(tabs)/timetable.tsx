import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MapPin,
  User,
  WifiOff,
  AlertTriangle,
  Clock,
  Sparkles,
  Bell,
  CheckCircle,
  XCircle,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { GlassCard, Skeleton, EmptyState, Chip } from '../../src/components/ui';
import {
  Timetable,
  Slot,
} from '../../src/features/timetable/timetableProvider';
import { getSectionTimetable } from '../../src/features/timetable/timetableStore';
import {
  DayIndex,
  computeSlotStatuses,
  dayIndexForDate,
  nextSlotDate,
  slotDurationMinutes,
  slotStartToday,
} from '../../src/features/timetable/schedule';
import { TIMETABLE_CHANNEL_ID } from '../../src/lib/pushNotifications';
import {
  canScheduleReminder,
  fireAtFor,
  formatLeadTime,
  formatLeadTimeVerbose,
  leadTimeOptions,
  reminderBody,
  reminderTitle,
  type ClassReminder,
} from '../../src/features/notifications/notificationPreferences';
import { useNotificationPreferences } from '../../src/features/notifications/useNotificationPreferences';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useAttendanceStore } from '../../src/features/attendance/attendanceStore';
import { useAppTheme } from '../../src/lib/ThemeContext';
import { theme } from '../../src/lib/theme';

export function getCurrentWeekDays() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sun
  const monday = new Date(today);
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(today.getDate() + diff);

  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return labels.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      id: (i + 1) as DayIndex,
      label,
      dateNum: String(d.getDate()),
      date: d,
    };
  });
}

const DAYS = getCurrentWeekDays();

/** The lead time a class alarm uses until the student picks another one. */
const DEFAULT_LEAD_MINUTES = 30;

/** The class detail sheet covers most of the screen. */
const MODAL_SHEET_MAX_HEIGHT = Math.round(Dimensions.get('window').height * 0.9);

/**
 * Inside a React Native Modal on Android the content view is measured without
 * constraints, so `flex: 1` resolves to zero and the modal paints nothing.
 * The overlay therefore carries explicit window-sized dimensions.
 */
const MODAL_OVERLAY_SIZE = {
  width: Dimensions.get('window').width,
  height: Dimensions.get('window').height,
};

async function cancelScheduledForSlot(slotId: string): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const targets = scheduled.filter((notification) => {
      const data = notification.content.data;
      const stored = data && typeof data === 'object' ? data.slotId : undefined;
      return typeof stored === 'string' && stored === slotId;
    });
    await Promise.all(
      targets.map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.identifier),
      ),
    );
  } catch {
    // The OS may not report scheduled notifications; the stored list still stands.
  }
}

const FACULTY_COLORS = [
  '#C2410C',
  '#0F6B46',
  '#5B21B6',
  '#0E7490',
  '#8A5200',
  '#A21C5C',
];

function getFacultyInitials(name?: string): string {
  if (!name) return 'FA';
  const clean = name.replace(/^(Prof\.|Dr\.|Mr\.|Ms\.)\s*/i, '').trim();
  const parts = clean.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function getFacultyColor(name?: string): string {
  if (!name) return FACULTY_COLORS[0];
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return FACULTY_COLORS[sum % FACULTY_COLORS.length];
}

export default function TimetableScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { classSelection } = useAuthStore();
  const currentSection = classSelection?.section || 'BCS-II B';
  const { markAttended, markMissed } = useAttendanceStore();

  // State
  const [selectedDay, setSelectedDay] = useState<DayIndex>(() => dayIndexForDate(new Date()));
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'compact'>('day');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [now, setNow] = useState(() => new Date());

  // Slot Detail Modal
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [leadMinutes, setLeadMinutes] = useState(DEFAULT_LEAD_MINUTES);

  const { reminders, addReminder, removeReminder, remindersForDay, remindersForSlot } =
    useNotificationPreferences();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Keeps LIVE NOW / UP NEXT honest as the clock moves.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const loadTimetable = async (forceRefresh = false) => {
    try {
      if (!forceRefresh) setLoading(true);
      const data = await getSectionTimetable(currentSection, '39', forceRefresh);
      setTimetable(data);
      setIsOffline(data.source === 'mock');
    } catch {
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimetable(false);
  }, [currentSection]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTimetable(true);
    setRefreshing(false);
  };

  const getDaySlots = (dayId: number): Slot[] => {
    if (!timetable) return [];
    return timetable.slots.filter((s) => s.day === dayId);
  };

  const activeDaySlots = useMemo(() => getDaySlots(selectedDay), [timetable, selectedDay]);

  const selectedDayDate = useMemo(() => {
    const match = DAYS.find((entry) => entry.id === selectedDay);
    return match ? match.date : new Date();
  }, [selectedDay]);

  const selectedDayLabel = useMemo(() => {
    const match = DAYS.find((entry) => entry.id === selectedDay);
    return match ? match.label : '';
  }, [selectedDay]);

  // The alarms that belong to the day on screen: an alarm set for one of its
  // classes, plus any alarm that fires on that calendar day.
  const dayReminders = useMemo(() => {
    const daySlotIds = new Set(activeDaySlots.map((slot) => slot.id));
    const forSlots = reminders.filter((reminder) => daySlotIds.has(reminder.slotId));
    const forDate = remindersForDay(selectedDayDate);
    const merged = new Map<string, ClassReminder>();
    for (const reminder of [...forSlots, ...forDate]) merged.set(reminder.slotId, reminder);
    return [...merged.values()].sort((a, b) => a.fireAt.localeCompare(b.fireAt));
  }, [reminders, activeDaySlots, remindersForDay, selectedDayDate]);

  const todayIndex = dayIndexForDate(now);
  const slotStatuses = useMemo(
    () => computeSlotStatuses(timetable?.slots ?? [], now),
    [timetable, now],
  );

  const slotReminder = selectedSlot ? remindersForSlot(selectedSlot.id) : undefined;

  const getSlotStatus = (slot: Slot) => {
    const label = slotStatuses[slot.id] ?? 'SCHEDULED';
    const isLive = label === 'LIVE NOW';
    const color = isLive
      ? colors.success
      : label === 'UP NEXT'
        ? colors.accent
        : colors.textSecondary;
    return { label, color, isLive };
  };

  const handleOpenSlot = (slot: Slot) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // ignore
      }
    }
    const existing = remindersForSlot(slot.id);
    if (existing) setLeadMinutes(existing.leadMinutes);
    setSelectedSlot(slot);
  };

  const handleScheduleReminder = async () => {
    const slot = selectedSlot;
    if (!slot) return;

    if (Platform.OS === 'web') {
      showToast('Class reminders are not available on web');
      return;
    }

    const current = new Date();
    const classDate =
      slot.day === dayIndexForDate(current)
        ? slotStartToday(slot, current)
        : nextSlotDate(slot, current);
    if (!classDate) {
      showToast('This class has no valid start time');
      return;
    }

    const fireAt = fireAtFor(classDate, leadMinutes);
    const check = canScheduleReminder(classDate, fireAt, current);
    if (!check.ok) {
      showToast(
        check.reason === 'already-started'
          ? 'This class has already started - no reminder set'
          : 'That lead time has already passed - pick a shorter one',
      );
      return;
    }

    try {
      const permission = await Notifications.getPermissionsAsync();
      let granted = permission.granted;
      if (!granted && permission.canAskAgain) {
        const asked = await Notifications.requestPermissionsAsync();
        granted = asked.granted;
      }
      if (!granted) {
        showToast(
          'Notifications are off for GBU One - enable them in Settings to get reminders',
        );
        return;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(TIMETABLE_CHANNEL_ID, {
          name: 'Timetable changes',
          importance: Notifications.AndroidImportance.HIGH,
        });
      }

      await cancelScheduledForSlot(slot.id);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: reminderTitle(slot.subject, leadMinutes),
          body: reminderBody(slot.start, slot.room, leadMinutes),
          data: {
            type: 'class-reminder',
            slotId: slot.id,
            subject: slot.subject,
            start: slot.start,
            leadMinutes: String(leadMinutes),
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          channelId: TIMETABLE_CHANNEL_ID,
        },
      });

      await addReminder({
        leadMinutes,
        slotId: slot.id,
        subject: slot.subject,
        start: slot.start,
        fireAt: fireAt.toISOString(),
        channelId: TIMETABLE_CHANNEL_ID,
      });

      showToast(
        leadMinutes === 0
          ? 'Reminder set - the class starts now'
          : `Reminder set for ${formatLeadTimeVerbose(leadMinutes)} before`,
      );
    } catch {
      showToast('Could not schedule the reminder - please try again');
    }
  };

  const handleCancelReminder = async (slotId: string) => {
    await cancelScheduledForSlot(slotId);
    await removeReminder(slotId);
    showToast('Reminder cancelled');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Class Schedule</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            {currentSection} - Semester Session {timetable?.semesterSessionId ?? '39'}
          </Text>
        </View>

        {/* View Mode Toggle: Day / Week / Compact */}
        <View style={[styles.toggleGroup, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderGlass }]}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'day' && { backgroundColor: colors.accentFill }]}
            onPress={() => setViewMode('day')}
          >
            <Text style={[styles.toggleText, { color: viewMode === 'day' ? colors.onAccent : colors.textSecondary }]}>Day</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'week' && { backgroundColor: colors.accentFill }]}
            onPress={() => setViewMode('week')}
          >
            <Text style={[styles.toggleText, { color: viewMode === 'week' ? colors.onAccent : colors.textSecondary }]}>Week</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'compact' && { backgroundColor: colors.accentFill }]}
            onPress={() => setViewMode('compact')}
          >
            <Text style={[styles.toggleText, { color: viewMode === 'compact' ? colors.onAccent : colors.textSecondary }]}>Compact</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Offline Banner if applicable */}
      {isOffline && (
        <View style={[styles.offlineBanner, { backgroundColor: colors.warningSoft }]}>
          <WifiOff size={14} color={colors.warning} />
          <Text style={[styles.offlineText, { color: colors.warning }]}>Offline mode - Showing cached timetable</Text>
        </View>
      )}

      {/* Elevated Day Selector Chips */}
      {viewMode !== 'week' && (
        <View style={[styles.daySelectorWrapper, { borderBottomColor: colors.divider }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayScroll}
          >
            {DAYS.map((d) => {
              const isSelected = selectedDay === d.id;
              const isToday = d.id === todayIndex;
              const slotsCount = (timetable?.slots || []).filter((s) => s.day === d.id).length;

              return (
                <TouchableOpacity
                  key={d.id}
                  style={[
                    styles.dayCard,
                    {
                      backgroundColor: isSelected
                        ? colors.accentSoft
                        : isDark
                          ? 'rgba(255, 255, 255, 0.05)'
                          : colors.surfaceMuted,
                      borderColor: isSelected ? colors.accent : isToday ? colors.accent : colors.borderGlass,
                    },
                  ]}
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      try {
                        Haptics.selectionAsync();
                      } catch {
                        // ignore
                      }
                    }
                    setSelectedDay(d.id);
                  }}
                  activeOpacity={0.8}
                  accessibilityLabel={`${d.label} ${d.dateNum}${isToday ? ', today' : ''}`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={[styles.dayLabel, { color: isSelected || isToday ? colors.accent : colors.textSecondary }]}>
                    {d.label}
                  </Text>
                  <Text style={[styles.dayNum, { color: isSelected ? colors.accent : colors.textPrimary }]}>
                    {d.dateNum}
                  </Text>
                  {isToday ? (
                    <Text style={[styles.dayTodayTag, { color: colors.accent }]}>TODAY</Text>
                  ) : (
                    <View
                      style={
                        slotsCount > 0
                          ? [styles.dayDot, isSelected && [styles.dayDotActive, { backgroundColor: colors.accent }]]
                          : styles.dayDotEmpty
                      }
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(120, 100 + insets.bottom) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Loading State with Skeleton */}
        {loading && (
          <View style={styles.loadingContainer}>
            <Skeleton width="100%" height={90} borderRadius={18} style={{ marginBottom: 12 }} />
            <Skeleton width="100%" height={90} borderRadius={18} style={{ marginBottom: 12 }} />
            <Skeleton width="100%" height={90} borderRadius={18} />
          </View>
        )}

        {/* Class alarms for the selected day */}
        {!loading && (
          <GlassCard style={styles.alarmsCard}>
            <View style={styles.alarmsHeader}>
              <Bell size={16} color={colors.accent} />
              <Text style={[styles.alarmsTitle, { color: colors.textPrimary }]}>Class alarms</Text>
              <Text style={[styles.alarmsCount, { color: colors.textSecondary }]}>
                {selectedDayLabel} - {dayReminders.length}{' '}
                {dayReminders.length === 1 ? 'alarm' : 'alarms'}
              </Text>
            </View>

            {dayReminders.length === 0 ? (
              <Text style={[styles.alarmsEmpty, { color: colors.textSecondary }]}>
                No alarm set for this day. Open a class to add one.
              </Text>
            ) : (
              dayReminders.map((reminder) => (
                <View
                  key={reminder.slotId}
                  style={[styles.alarmRow, { borderTopColor: colors.divider }]}
                >
                  <View style={styles.alarmInfo}>
                    <Text
                      style={[styles.alarmSubject, { color: colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {reminder.subject}
                    </Text>
                    <Text style={[styles.alarmMeta, { color: colors.textSecondary }]}>
                      {reminder.start} class - alarm {formatLeadTime(reminder.leadMinutes)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.alarmCancel}
                    onPress={() => {
                      void handleCancelReminder(reminder.slotId);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Cancel the alarm for ${reminder.subject}`}
                    hitSlop={8}
                  >
                    <Text style={[styles.alarmCancelText, { color: colors.danger }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </GlassCard>
        )}

        {/* Empty State */}
        {!loading && activeDaySlots.length === 0 && viewMode !== 'week' && (
          <EmptyState
            title="No classes scheduled"
            description="Enjoy your day off! No lecture slots found for this day."
          />
        )}

        {/* COMPACT VIEW */}
        {!loading && viewMode === 'compact' && activeDaySlots.length > 0 && (
          <View style={styles.timelineList}>
            {activeDaySlots.map((slot) => {
              const status = getSlotStatus(slot);

              return (
                <GlassCard
                  key={slot.id}
                  style={styles.compactCard}
                  accentBorder={status.isLive}
                  onPress={() => handleOpenSlot(slot)}
                >
                  <View style={styles.compactRow}>
                    <View style={[styles.timeTag, { backgroundColor: colors.surfaceAlt }]}>
                      <Text style={[styles.compactTime, { color: colors.textPrimary }]}>{slot.start}</Text>
                    </View>
                    <View style={[styles.compactDivider, { backgroundColor: colors.divider }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.compactSubject, { color: colors.textPrimary }]} numberOfLines={1}>
                        {slot.subject}
                      </Text>
                      <Text style={[styles.compactRoom, { color: colors.textSecondary }]}>
                        {slot.room ? `${slot.room} - ` : ''}
                        {slot.faculty || 'Department Faculty'}
                      </Text>
                    </View>
                    {slot.isChanged && (
                      <View style={[styles.compactChangedBadge, { backgroundColor: colors.warningSoft }]}>
                        <Text style={[styles.compactChangedBadgeText, { color: colors.warning }]}>Changed</Text>
                      </View>
                    )}
                  </View>
                </GlassCard>
              );
            })}
          </View>
        )}

        {/* WEEK AT A GLANCE VIEW */}
        {!loading && viewMode === 'week' && (
          <View style={styles.weekContainer}>
            {DAYS.map((d) => {
              const daySlots = getDaySlots(d.id);

              return (
                <View key={`week_day_${d.id}`} style={styles.weekDaySection}>
                  <View style={styles.weekDayHeader}>
                    <View style={styles.weekDayTitleRow}>
                      <Text style={[styles.weekDayTitle, { color: colors.accent }]}>{d.label}</Text>
                      <Text style={[styles.weekDayDate, { color: colors.textSecondary }]}>({d.dateNum})</Text>
                    </View>
                    <Text style={[styles.weekDayCount, { color: colors.textSecondary }]}>
                      {daySlots.length} {daySlots.length === 1 ? 'class' : 'classes'}
                    </Text>
                  </View>

                  {daySlots.length === 0 ? (
                    <Text style={[styles.weekDayEmpty, { color: colors.textTertiary }]}>No lectures scheduled</Text>
                  ) : (
                    daySlots.map((slot) => (
                      <GlassCard
                        key={`week_slot_${slot.id}`}
                        style={styles.weekSlotCard}
                        onPress={() => handleOpenSlot(slot)}
                      >
                        <View style={styles.inlineHeader}>
                          <Text style={[styles.compactTime, { color: colors.textPrimary }]}>
                            {slot.start} - {slot.end}
                          </Text>
                          {slot.isChanged ? (
                            <View style={[styles.compactChangedBadge, { backgroundColor: colors.warningSoft }]}>
                              <Text style={[styles.compactChangedBadgeText, { color: colors.warning }]}>Changed</Text>
                            </View>
                          ) : (
                            <Text style={[styles.compactRoom, { color: colors.textSecondary }]}>{slot.room || 'TBD'}</Text>
                          )}
                        </View>
                        <Text style={[styles.compactSubject, { color: colors.textPrimary }]} numberOfLines={1}>
                          {slot.subject}
                        </Text>
                        {slot.isChanged && slot.changeNote ? (
                          <Text style={[styles.changeNoteText, { color: colors.warning }]}>{slot.changeNote}</Text>
                        ) : null}
                      </GlassCard>
                    ))
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* DAY VIEW (Timeline Rail) */}
        {!loading && viewMode === 'day' && activeDaySlots.length > 0 && (
          <View style={styles.timelineList}>
            {activeDaySlots.map((slot, index) => {
              const status = getSlotStatus(slot);
              const facultyColor = getFacultyColor(slot.faculty);
              const facultyInitials = getFacultyInitials(slot.faculty);
              const isLast = index === activeDaySlots.length - 1;

              return (
                <View key={slot.id} style={styles.timelineRow}>
                  {/* Left Rail: Start and End Time */}
                  <View style={styles.timeRail}>
                    <Text style={[styles.startTime, { color: colors.textPrimary }]}>{slot.start}</Text>
                    <Text style={[styles.endTime, { color: colors.textSecondary }]}>{slot.end}</Text>

                    <View style={[styles.railPeriodPill, { backgroundColor: colors.surfaceAlt }]}>
                      <Text style={[styles.railPeriodText, { color: colors.textSecondary }]}>P{index + 1}</Text>
                    </View>

                    {/* Vertical Connector Line */}
                    {!isLast && <View style={[styles.railLine, { backgroundColor: colors.divider }]} />}
                  </View>

                  {/* Right Card: Full Slot Details */}
                  <View style={styles.cardCol}>
                    <GlassCard
                      style={[
                        styles.classCard,
                        status.isLive && styles.activeClassCard,
                      ]}
                      accentBorder={status.isLive}
                      onPress={() => handleOpenSlot(slot)}
                    >
                      {/* Status and Code Header */}
                      <View style={styles.cardHeader}>
                        <View style={styles.tagGroup}>
                          <View
                            style={[
                              styles.statusChip,
                              {
                                backgroundColor: `${status.color}18`,
                                borderColor: `${status.color}44`,
                              },
                            ]}
                          >
                            {status.isLive && <View style={[styles.livePulseDot, { backgroundColor: colors.accent }]} />}
                            <Text style={[styles.statusChipText, { color: status.color }]}>
                              {status.label}
                            </Text>
                          </View>

                          {/* Changed Badge */}
                          {slot.isChanged && (
                            <View style={[styles.changedBadge, { backgroundColor: colors.warningSoft }]}>
                              <AlertTriangle size={10} color={colors.warning} />
                              <Text style={[styles.changedBadgeText, { color: colors.warning }]}>Changed</Text>
                            </View>
                          )}
                        </View>

                        {slot.subjectCode ? (
                          <View style={[styles.codeTag, { backgroundColor: colors.surfaceAlt }]}>
                            <Text style={[styles.subjectCode, { color: colors.textSecondary }]}>{slot.subjectCode}</Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Subject Title */}
                      <Text style={[styles.subjectTitle, { color: colors.textPrimary }]}>{slot.subject}</Text>

                      {/* Changed Notice Banner */}
                      {slot.isChanged && slot.changeNote ? (
                        <View style={[styles.changeNoteBox, { backgroundColor: colors.warningSoft, borderLeftColor: colors.warning }]}>
                          <Text style={[styles.changeNoteText, { color: colors.warning }]}>{slot.changeNote}</Text>
                        </View>
                      ) : null}

                      {/* Room & Professor Footprint */}
                      <View style={styles.cardFooter}>
                        {/* Professor Squircle Avatar & Name */}
                        <View style={styles.professorRow}>
                          <View
                            style={[
                              styles.professorSquircle,
                              { backgroundColor: facultyColor },
                            ]}
                          >
                            <Text style={[styles.professorInitials, { color: colors.onAccent }]}>{facultyInitials}</Text>
                          </View>
                          <Text style={[styles.professorName, { color: colors.textPrimary }]} numberOfLines={1}>
                            {slot.faculty || 'Department Faculty'}
                          </Text>
                        </View>

                        {/* Room Badge */}
                        {slot.room && (
                          <View style={[styles.roomBadge, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                            <MapPin size={11} color={colors.accent} />
                            <Text style={[styles.roomBadgeText, { color: colors.accent }]}>{slot.room}</Text>
                          </View>
                        )}
                      </View>
                    </GlassCard>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Period Details Modal */}
      {selectedSlot && (
        <Modal
          visible={!!selectedSlot}
          transparent
          // Android only supports "none" and "fade"; "slide" leaves the modal
          // window empty, so the sheet never appears.
          animationType="none"
          onRequestClose={() => setSelectedSlot(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.borderGlass }]}>
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {/* Modal Drag Handle */}
                <View style={[styles.dragHandle, { backgroundColor: colors.borderStrong }]} />

                {/* Close Button */}
                <View style={styles.modalTopRow}>
                  <View style={[styles.typeBadgePill, { backgroundColor: colors.accentSoft }]}>
                    <Text style={[styles.typeBadgePillText, { color: colors.accent }]}>
                      {selectedSlot.type?.toUpperCase() || 'CORE LECTURE'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.closeBtn, { backgroundColor: colors.surfaceAlt }]}
                    onPress={() => setSelectedSlot(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Subject Title */}
                <Text style={[styles.modalSubject, { color: colors.textPrimary }]}>{selectedSlot.subject}</Text>
                <Text style={[styles.modalCode, { color: colors.textSecondary }]}>
                  {selectedSlot.subjectCode || currentSection} - Period {selectedSlot.period}
                </Text>

                {/* Time & Venue Grid */}
                <View style={[styles.modalGrid, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderGlass }]}>
                  {/* Time */}
                  <View style={styles.gridItem}>
                    <Clock size={16} color={colors.accent} />
                    <View style={{ marginLeft: 10 }}>
                      <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>Time & Duration</Text>
                      <Text style={[styles.gridValue, { color: colors.textPrimary }]}>
                        {selectedSlot.start} - {selectedSlot.end}
                        {slotDurationMinutes(selectedSlot) !== null
                          ? ` (${slotDurationMinutes(selectedSlot)} min)`
                          : ''}
                      </Text>
                    </View>
                  </View>

                  {/* Location */}
                  <View style={styles.gridItem}>
                    <MapPin size={16} color={colors.accent} />
                    <View style={{ marginLeft: 10 }}>
                      <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>Lecture Room</Text>
                      <Text style={[styles.gridValue, { color: colors.textPrimary }]}>
                        {selectedSlot.room || 'TBD'}
                        {classSelection?.school ? ` - ${classSelection.school} Building` : ''}
                      </Text>
                    </View>
                  </View>

                  {/* Faculty */}
                  <View style={styles.gridItem}>
                    <User size={16} color={colors.accent} />
                    <View style={{ marginLeft: 10 }}>
                      <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>Instructor</Text>
                      <Text style={[styles.gridValue, { color: colors.textPrimary }]}>
                        {selectedSlot.faculty || 'Department Faculty'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Quick Attendance Actions */}
                <View style={styles.actionSection}>
                  <Text style={[styles.actionHeader, { color: colors.textSecondary }]}>Quick Attendance Logging</Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.presentBtn, { backgroundColor: colors.successSoft, borderColor: colors.success }]}
                      onPress={() => {
                        markAttended(selectedSlot.subjectCode || selectedSlot.subject);
                        if (Platform.OS !== 'web') {
                          try {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          } catch {
                            // ignore
                          }
                        }
                        showToast('Marked Present (+1 class attended)');
                      }}
                    >
                      <CheckCircle size={16} color={colors.success} />
                      <Text style={[styles.presentBtnText, { color: colors.success }]}>+ Present</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, styles.absentBtn, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}
                      onPress={() => {
                        markMissed(selectedSlot.subjectCode || selectedSlot.subject);
                        if (Platform.OS !== 'web') {
                          try {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                          } catch {
                            // ignore
                          }
                        }
                        showToast('Marked Absent');
                      }}
                    >
                      <XCircle size={16} color={colors.danger} />
                      <Text style={[styles.absentBtnText, { color: colors.danger }]}>+ Absent</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Class alarm: the student picks how early it rings */}
                <View style={styles.reminderSection}>
                  <Text style={[styles.actionHeader, { color: colors.textSecondary }]}>
                    Class alarm
                  </Text>
                  <Text style={[styles.reminderHint, { color: colors.textSecondary }]}>
                    Pick how long before the class the alarm rings.
                  </Text>

                  <View style={styles.leadChipRow}>
                    {leadTimeOptions().map((option) => (
                      <Chip
                        key={option.minutes}
                        label={option.label}
                        selected={option.minutes === leadMinutes}
                        onPress={() => setLeadMinutes(option.minutes)}
                      />
                    ))}
                  </View>

                  {slotReminder ? (
                    <View
                      style={[
                        styles.scheduledRow,
                        { backgroundColor: colors.successSoft, borderColor: colors.success },
                      ]}
                    >
                      <CheckCircle size={16} color={colors.success} />
                      <Text style={[styles.scheduledText, { color: colors.success }]}>
                        {slotReminder.leadMinutes === leadMinutes
                          ? `Alarm set ${formatLeadTime(slotReminder.leadMinutes)}`
                          : `Alarm set ${formatLeadTime(slotReminder.leadMinutes)} - tap below to change it`}
                      </Text>
                      <TouchableOpacity
                        style={styles.scheduledCancel}
                        onPress={() => {
                          void handleCancelReminder(slotReminder.slotId);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Cancel the alarm for ${slotReminder.subject}`}
                        hitSlop={8}
                      >
                        <Text style={[styles.scheduledCancelText, { color: colors.danger }]}>
                          Cancel
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.reminderBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderGlass }]}
                    onPress={() => {
                      void handleScheduleReminder();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Set class reminder notification ${formatLeadTime(leadMinutes)}`}
                  >
                    <Bell size={16} color={colors.textPrimary} />
                    <Text style={[styles.reminderBtnText, { color: colors.textPrimary }]}>
                      Set Class Reminder Notification - {formatLeadTime(leadMinutes)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Floating Toast Notice */}
      {toastMessage && (
        <View style={styles.toastContainer} pointerEvents="none">
          <View style={[styles.toastPill, { backgroundColor: isDark ? 'rgba(22, 22, 24, 0.95)' : 'rgba(255, 255, 255, 0.95)', borderColor: colors.accent }]}>
            <Sparkles size={15} color={colors.accent} />
            <Text style={[styles.toastText, { color: colors.textPrimary }]}>{toastMessage}</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
  },
  headerSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    marginTop: 2,
  },
  toggleGroup: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 3,
    borderWidth: 1,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  toggleText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 6,
    gap: 6,
  },
  offlineText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  daySelectorWrapper: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  dayScroll: {
    paddingHorizontal: theme.spacing.lg,
    gap: 8,
  },
  dayCard: {
    width: 52,
    height: 64,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  dayLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
  },
  dayNum: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    marginVertical: 1,
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dayDotActive: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dayDotEmpty: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dayTodayTag: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 7,
    letterSpacing: 0.4,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 110,
  },
  loadingContainer: {
    paddingTop: 10,
  },
  timelineList: {
    paddingTop: 8,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  timeRail: {
    width: 62,
    alignItems: 'flex-start',
    paddingTop: 4,
    position: 'relative',
  },
  startTime: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  endTime: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 2,
  },
  railPeriodPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 6,
  },
  railPeriodText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 9,
  },
  railLine: {
    position: 'absolute',
    top: 50,
    bottom: -16,
    left: 20,
    width: 1,
  },
  cardCol: {
    flex: 1,
    marginLeft: 6,
  },
  classCard: {
    padding: 14,
  },
  activeClassCard: {
    borderColor: 'rgba(255, 106, 43, 0.55)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tagGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: theme.radius.chip,
    borderWidth: 1,
    gap: 4,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusChipText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  codeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subjectCode: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
  },
  subjectTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  professorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  professorSquircle: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  professorInitials: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
  },
  professorName: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    flexShrink: 1,
  },
  roomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.chip,
    gap: 4,
  },
  roomBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
  },
  compactCard: {
    marginBottom: 8,
    padding: 12,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeTag: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  compactTime: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  compactDivider: {
    width: 1,
    height: 24,
    marginHorizontal: 10,
  },
  compactSubject: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  compactRoom: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 2,
  },
  weekContainer: {
    paddingBottom: 24,
  },
  weekDaySection: {
    marginBottom: 20,
  },
  weekDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  weekDayTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekDayTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
  },
  weekDayDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  weekDayCount: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  weekDayEmpty: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    fontStyle: 'italic',
    paddingLeft: 4,
  },
  weekSlotCard: {
    marginBottom: 8,
    padding: 10,
  },
  inlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  changedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  changedBadgeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
    letterSpacing: 0.2,
  },
  compactChangedBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  compactChangedBadgeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 9,
  },
  changeNoteBox: {
    borderRadius: 8,
    borderLeftWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 2,
    marginBottom: 8,
  },
  changeNoteText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
  },
  modalOverlay: {
    ...MODAL_OVERLAY_SIZE,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    // A percentage height does not resolve inside a React Native Modal, so
    // the sheet is sized in pixels from the window height.
    maxHeight: MODAL_SHEET_MAX_HEIGHT,
    height: MODAL_SHEET_MAX_HEIGHT,
  },
  modalScroll: {
    flexGrow: 1,
    flexShrink: 1,
  },
  modalContent: {
    padding: theme.spacing.lg,
    paddingBottom: 36,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.chip,
  },
  typeBadgePillText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSubject: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    lineHeight: 26,
    marginBottom: 4,
  },
  modalCode: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    marginBottom: 16,
  },
  modalGrid: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 12,
    marginBottom: 18,
  },
  gridItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
  },
  gridValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    marginTop: 1,
  },
  actionSection: {
    marginBottom: 14,
  },
  actionHeader: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    gap: 6,
  },
  presentBtn: {},
  presentBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  absentBtn: {},
  absentBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  reminderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingVertical: 12,
    gap: 8,
  },
  reminderBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  reminderSection: {
    marginTop: 4,
  },
  reminderHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 8,
  },
  leadChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  scheduledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: theme.radius.chip,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  scheduledText: {
    flex: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  scheduledCancel: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduledCancelText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  alarmsCard: {
    marginBottom: 14,
  },
  alarmsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  alarmsTitle: {
    flex: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  alarmsCount: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  alarmsEmpty: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 17,
  },
  alarmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: 1,
  },
  alarmInfo: {
    flex: 1,
  },
  alarmSubject: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  alarmMeta: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 2,
  },
  alarmCancel: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alarmCancelText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 999,
  },
  toastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  toastText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
  },
});
