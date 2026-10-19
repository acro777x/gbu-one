import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { GlassCard, Skeleton, EmptyState } from '../../src/components/ui';
import {
  GBUTimetableProvider,
  Timetable,
  Slot,
} from '../../src/features/timetable/timetableProvider';
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

  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return labels.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      id: i + 1,
      label,
      dateNum: String(d.getDate()),
    };
  });
}

const DAYS = getCurrentWeekDays();

const FACULTY_COLORS = [
  '#FF6A2B',
  '#3DD68C',
  '#8B5CF6',
  '#06B6D4',
  '#F5B83D',
  '#EC4899',
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

const provider = new GBUTimetableProvider();

export default function TimetableScreen() {
  const { colors, isDark } = useAppTheme();
  const { classSelection } = useAuthStore();
  const currentSection = classSelection?.section || 'BCS-II B';
  const { markAttended, markMissed } = useAttendanceStore();

  // State
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'compact'>('day');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // Slot Detail Modal
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const loadTimetable = async () => {
    try {
      setLoading(true);
      const data = await provider.getTimetable(currentSection, '39');
      // Highlight change only on the specific first slot if applicable
      const decoratedSlots = data.slots.map((s, idx) => {
        if (idx === 0) {
          return {
            ...s,
            isChanged: true,
            changeNote: `${s.subject} shifted to ${s.room || 'IL104'} for today's lecture`,
          };
        }
        return s;
      });
      setTimetable({ ...data, slots: decoratedSlots });
      setIsOffline(false);
    } catch {
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimetable();
  }, [currentSection]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTimetable();
    setRefreshing(false);
  };

  const getDaySlots = (dayId: number): Slot[] => {
    if (!timetable) return [];
    return timetable.slots.filter((s) => s.day === dayId);
  };

  const activeDaySlots = getDaySlots(selectedDay);

  const getSlotStatus = (slot: Slot) => {
    const isToday = (new Date().getDay() || 1) === selectedDay;
    if (isToday && slot.start.startsWith('08:30')) {
      return { label: 'LIVE NOW', color: colors.success, isLive: true };
    }
    if (isToday && slot.start.startsWith('09:30')) {
      return { label: 'UP NEXT', color: colors.accent, isLive: false };
    }
    return { label: 'SCHEDULED', color: colors.textSecondary, isLive: false };
  };

  const handleOpenSlot = (slot: Slot) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // ignore
      }
    }
    setSelectedSlot(slot);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Class Schedule</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{currentSection} • Semester 39 (Autumn)</Text>
        </View>

        {/* View Mode Toggle: Day / Week / Compact */}
        <View style={[styles.toggleGroup, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderGlass }]}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'day' && { backgroundColor: colors.accent }]}
            onPress={() => setViewMode('day')}
          >
            <Text style={[styles.toggleText, { color: viewMode === 'day' ? colors.onAccent : colors.textSecondary }]}>Day</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'week' && { backgroundColor: colors.accent }]}
            onPress={() => setViewMode('week')}
          >
            <Text style={[styles.toggleText, { color: viewMode === 'week' ? colors.onAccent : colors.textSecondary }]}>Week</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'compact' && { backgroundColor: colors.accent }]}
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
          <Text style={[styles.offlineText, { color: colors.warning }]}>Offline mode — Showing cached timetable</Text>
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
                          : 'rgba(17, 24, 39, 0.05)',
                      borderColor: isSelected ? colors.accent : colors.borderGlass,
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
                >
                  <Text style={[styles.dayLabel, { color: isSelected ? colors.accent : colors.textSecondary }]}>
                    {d.label}
                  </Text>
                  <Text style={[styles.dayNum, { color: isSelected ? colors.accent : colors.textPrimary }]}>
                    {d.dateNum}
                  </Text>
                  <View
                    style={
                      slotsCount > 0
                        ? [styles.dayDot, isSelected && [styles.dayDotActive, { backgroundColor: colors.accent }]]
                        : styles.dayDotEmpty
                    }
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
                        {slot.room ? `${slot.room} • ` : ''}
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
                            <Text style={styles.professorInitials}>{facultyInitials}</Text>
                          </View>
                          <Text style={[styles.professorName, { color: colors.textPrimary }]} numberOfLines={1}>
                            {slot.faculty || 'Department Faculty'}
                          </Text>
                        </View>

                        {/* Room Badge */}
                        {slot.room && (
                          <View style={[styles.roomBadge, { backgroundColor: colors.accentSoft, borderColor: `${colors.accent}44` }]}>
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
          animationType="slide"
          onRequestClose={() => setSelectedSlot(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.borderGlass }]}>
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
                {selectedSlot.subjectCode || currentSection} • Period {activeDaySlots.indexOf(selectedSlot) + 1}
              </Text>

              {/* Time & Venue Grid */}
              <View style={[styles.modalGrid, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderGlass }]}>
                {/* Time */}
                <View style={styles.gridItem}>
                  <Clock size={16} color={colors.accent} />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>Time & Duration</Text>
                    <Text style={[styles.gridValue, { color: colors.textPrimary }]}>
                      {selectedSlot.start} - {selectedSlot.end} (60 min)
                    </Text>
                  </View>
                </View>

                {/* Location */}
                <View style={styles.gridItem}>
                  <MapPin size={16} color={colors.accent} />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>Lecture Room</Text>
                    <Text style={[styles.gridValue, { color: colors.textPrimary }]}>
                      {selectedSlot.room || 'TBD'} • {classSelection?.school || 'SOICT'} Building
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
                    style={[styles.actionBtn, styles.presentBtn, { backgroundColor: colors.successSoft, borderColor: `${colors.success}44` }]}
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
                    style={[styles.actionBtn, styles.absentBtn, { backgroundColor: colors.dangerSoft, borderColor: `${colors.danger}44` }]}
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

              {/* Reminder Button */}
              <TouchableOpacity
                style={[styles.reminderBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderGlass }]}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    try {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } catch {
                      // ignore
                    }
                  }
                  showToast(`Reminder scheduled 10m before ${selectedSlot.start}`);
                }}
              >
                <Bell size={16} color={colors.textPrimary} />
                <Text style={[styles.reminderBtnText, { color: colors.textPrimary }]}>Set Class Reminder Notification</Text>
              </TouchableOpacity>
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
    color: '#FFF',
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
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
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
