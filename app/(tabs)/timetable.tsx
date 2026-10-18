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
import { theme } from '../../src/lib/theme';

const DAYS = [
  { id: 1, label: 'Mon', dateNum: '19' },
  { id: 2, label: 'Tue', dateNum: '20' },
  { id: 3, label: 'Wed', dateNum: '21' },
  { id: 4, label: 'Thu', dateNum: '22' },
  { id: 5, label: 'Fri', dateNum: '23' },
  { id: 6, label: 'Sat', dateNum: '24' },
];

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

  const daySlots = (timetable?.slots || []).filter((s) => s.day === selectedDay);

  const getSlotStatus = (index: number) => {
    if (index === 0) {
      return { label: 'LIVE NOW', color: '#FF6A2B', isLive: true };
    }
    if (index === 1) {
      return { label: 'UP NEXT', color: '#F5B83D', isLive: false };
    }
    return { label: 'SCHEDULED', color: theme.colors.textSecondary, isLive: false };
  };

  const handleOpenSlot = (slot: Slot) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        // ignore
      }
    }
    setSelectedSlot(slot);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Class Schedule</Text>
          <Text style={styles.headerSub}>{currentSection} • Semester 39 (Autumn)</Text>
        </View>

        {/* View Mode Toggle: Day / Week / Compact */}
        <View style={styles.toggleGroup}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'day' && styles.toggleBtnActive]}
            onPress={() => setViewMode('day')}
          >
            <Text style={[styles.toggleText, viewMode === 'day' && styles.toggleTextActive]}>Day</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'week' && styles.toggleBtnActive]}
            onPress={() => setViewMode('week')}
          >
            <Text style={[styles.toggleText, viewMode === 'week' && styles.toggleTextActive]}>Week</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'compact' && styles.toggleBtnActive]}
            onPress={() => setViewMode('compact')}
          >
            <Text style={[styles.toggleText, viewMode === 'compact' && styles.toggleTextActive]}>Compact</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Offline Banner if applicable */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <WifiOff size={14} color={theme.colors.warning} />
          <Text style={styles.offlineText}>Offline mode — Showing cached timetable</Text>
        </View>
      )}

      {/* Elevated Animated Day Selector Chips */}
      {viewMode !== 'week' && (
        <View style={styles.daySelectorWrapper}>
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
                    isSelected && styles.dayCardActive,
                  ]}
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      try {
                        Haptics.selectionAsync();
                      } catch (e) {
                        // ignore
                      }
                    }
                    setSelectedDay(d.id);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dayLabel, isSelected && styles.dayLabelActive]}>
                    {d.label}
                  </Text>
                  <Text style={[styles.dayNum, isSelected && styles.dayNumActive]}>
                    {d.dateNum}
                  </Text>
                  {slotsCount > 0 ? (
                    <View style={[styles.dayDot, isSelected && styles.dayDotActive]} />
                  ) : (
                    <View style={styles.dayDotEmpty} />
                  )}
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
            tintColor={theme.colors.accent}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Skeleton height={90} borderRadius={20} style={{ marginBottom: 12 }} />
            <Skeleton height={90} borderRadius={20} style={{ marginBottom: 12 }} />
            <Skeleton height={90} borderRadius={20} style={{ marginBottom: 12 }} />
          </View>
        ) : viewMode === 'week' ? (
          <View style={styles.weekContainer}>
            {DAYS.map((d) => {
              const slotsForDay = (timetable?.slots || []).filter((s) => s.day === d.id);
              return (
                <View key={d.id} style={styles.weekDaySection}>
                  <View style={styles.weekDayHeader}>
                    <View style={styles.weekDayTitleRow}>
                      <Text style={styles.weekDayTitle}>{d.label}</Text>
                      <Text style={styles.weekDayDate}>Oct {d.dateNum}</Text>
                    </View>
                    <Text style={styles.weekDayCount}>
                      {slotsForDay.length} {slotsForDay.length === 1 ? 'class' : 'classes'}
                    </Text>
                  </View>
                  {slotsForDay.length === 0 ? (
                    <Text style={styles.weekDayEmpty}>No scheduled classes</Text>
                  ) : (
                    slotsForDay.map((slot) => (
                      <GlassCard
                        key={slot.id}
                        style={styles.weekSlotCard}
                        onPress={() => handleOpenSlot(slot)}
                      >
                        <View style={styles.compactRow}>
                          <View style={styles.timeTag}>
                            <Text style={styles.compactTime}>{slot.start}</Text>
                          </View>
                          <View style={styles.compactDivider} />
                          <View style={{ flex: 1 }}>
                            <View style={styles.inlineHeader}>
                              <Text style={styles.compactSubject} numberOfLines={1}>
                                {slot.subject}
                              </Text>
                              {slot.isChanged && (
                                <View style={styles.compactChangedBadge}>
                                  <Text style={styles.compactChangedBadgeText}>Changed</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.compactRoom}>
                              {slot.room || 'TBD'} • {slot.faculty || 'Faculty'}
                            </Text>
                          </View>
                        </View>
                      </GlassCard>
                    ))
                  )}
                </View>
              );
            })}
          </View>
        ) : daySlots.length === 0 ? (
          <EmptyState
            title="No classes scheduled"
            description={`Enjoy your day off! No lectures or labs on this day for ${currentSection}.`}
          />
        ) : (
          <View style={styles.timelineList}>
            {daySlots.map((slot, index) => {
              const status = getSlotStatus(index);
              const facultyInitials = getFacultyInitials(slot.faculty);
              const facultyColor = getFacultyColor(slot.faculty);

              if (viewMode === 'compact') {
                return (
                  <GlassCard
                    key={slot.id}
                    style={styles.compactCard}
                    onPress={() => handleOpenSlot(slot)}
                    accentBorder={status.isLive}
                  >
                    <View style={styles.compactRow}>
                      <View style={styles.timeTag}>
                        <Text style={styles.compactTime}>{slot.start}</Text>
                      </View>
                      <View style={styles.compactDivider} />
                      <View style={{ flex: 1 }}>
                        <View style={styles.inlineHeader}>
                          <Text style={styles.compactSubject} numberOfLines={1}>
                            {slot.subject}
                          </Text>
                          {slot.isChanged && (
                            <View style={styles.compactChangedBadge}>
                              <Text style={styles.compactChangedBadgeText}>Changed</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.compactRoom}>
                          {slot.room || 'TBD'} • {slot.faculty || 'Faculty'}
                        </Text>
                      </View>
                    </View>
                  </GlassCard>
                );
              }

              return (
                <View key={slot.id} style={styles.timelineRow}>
                  {/* Left Time Rail */}
                  <View style={styles.timeRail}>
                    <Text style={styles.startTime}>{slot.start}</Text>
                    <Text style={styles.endTime}>{slot.end}</Text>
                    <View style={styles.railPeriodPill}>
                      <Text style={styles.railPeriodText}>P{index + 1}</Text>
                    </View>
                    <View style={styles.railLine} />
                  </View>

                  {/* Interactive Class Card */}
                  <View style={styles.cardCol}>
                    <GlassCard
                      style={[
                        styles.classCard,
                        status.isLive && styles.activeClassCard,
                      ]}
                      accentBorder={status.isLive || !!slot.isChanged}
                      glow={status.isLive}
                      onPress={() => handleOpenSlot(slot)}
                    >
                      {/* Top Header Tags */}
                      <View style={styles.cardHeader}>
                        <View style={styles.tagGroup}>
                          {/* Status Chip */}
                          <View
                            style={[
                              styles.statusChip,
                              { backgroundColor: `${status.color}20`, borderColor: status.color },
                            ]}
                          >
                            {status.isLive && <View style={styles.livePulseDot} />}
                            <Text style={[styles.statusChipText, { color: status.color }]}>
                              {status.label}
                            </Text>
                          </View>

                          {/* Changed Badge */}
                          {slot.isChanged && (
                            <View style={styles.changedBadge}>
                              <AlertTriangle size={10} color={theme.colors.warning} />
                              <Text style={styles.changedBadgeText}>Changed</Text>
                            </View>
                          )}
                        </View>

                        {slot.subjectCode ? (
                          <View style={styles.codeTag}>
                            <Text style={styles.subjectCode}>{slot.subjectCode}</Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Subject Title */}
                      <Text style={styles.subjectTitle}>{slot.subject}</Text>

                      {/* Changed Notice Banner */}
                      {slot.isChanged && slot.changeNote ? (
                        <View style={styles.changeNoteBox}>
                          <Text style={styles.changeNoteText}>{slot.changeNote}</Text>
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
                          <Text style={styles.professorName} numberOfLines={1}>
                            {slot.faculty || 'Department Faculty'}
                          </Text>
                        </View>

                        {/* Room Badge */}
                        {slot.room && (
                          <View style={styles.roomBadge}>
                            <MapPin size={11} color={theme.colors.accent} />
                            <Text style={styles.roomBadgeText}>{slot.room}</Text>
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
            <View style={styles.modalContent}>
              {/* Modal Drag Handle */}
              <View style={styles.dragHandle} />

              {/* Close Button */}
              <View style={styles.modalTopRow}>
                <View style={styles.typeBadgePill}>
                  <Text style={styles.typeBadgePillText}>
                    {selectedSlot.type?.toUpperCase() || 'CORE LECTURE'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setSelectedSlot(null)}
                >
                  <X size={18} color={theme.colors.ivory} />
                </TouchableOpacity>
              </View>

              {/* Subject Title */}
              <Text style={styles.modalSubject}>{selectedSlot.subject}</Text>
              {selectedSlot.subjectCode && (
                <Text style={styles.modalCode}>Course Code: {selectedSlot.subjectCode}</Text>
              )}

              {/* Details Cards */}
              <View style={styles.modalGrid}>
                {/* Time & Duration */}
                <View style={styles.gridItem}>
                  <Clock size={16} color={theme.colors.accent} />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.gridLabel}>Period Timing</Text>
                    <Text style={styles.gridValue}>
                      {selectedSlot.start} - {selectedSlot.end} (60 min)
                    </Text>
                  </View>
                </View>

                {/* Location */}
                <View style={styles.gridItem}>
                  <MapPin size={16} color={theme.colors.accent} />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.gridLabel}>Lecture Room</Text>
                    <Text style={styles.gridValue}>
                      {selectedSlot.room || 'TBD'} • {classSelection?.school || 'SOICT'} Building
                    </Text>
                  </View>
                </View>

                {/* Faculty */}
                <View style={styles.gridItem}>
                  <User size={16} color={theme.colors.accent} />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.gridLabel}>Instructor</Text>
                    <Text style={styles.gridValue}>
                      {selectedSlot.faculty || 'Department Faculty'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Quick Attendance Actions */}
              <View style={styles.actionSection}>
                <Text style={styles.actionHeader}>Quick Attendance Logging</Text>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.presentBtn]}
                    onPress={() => {
                      markAttended(selectedSlot.subjectCode || selectedSlot.subject);
                      if (Platform.OS !== 'web') {
                        try {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        } catch (e) {
                          // ignore
                        }
                      }
                      showToast('Marked Present (+1 class attended)');
                    }}
                  >
                    <CheckCircle size={16} color="#3DD68C" />
                    <Text style={styles.presentBtnText}>+ Present</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.absentBtn]}
                    onPress={() => {
                      markMissed(selectedSlot.subjectCode || selectedSlot.subject);
                      if (Platform.OS !== 'web') {
                        try {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        } catch (e) {
                          // ignore
                        }
                      }
                      showToast('Marked Absent');
                    }}
                  >
                    <XCircle size={16} color="#FF5C5C" />
                    <Text style={styles.absentBtnText}>+ Absent</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Reminder Button */}
              <TouchableOpacity
                style={styles.reminderBtn}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    try {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } catch (e) {
                      // ignore
                    }
                  }
                  showToast(`Reminder scheduled 10m before ${selectedSlot.start}`);
                }}
              >
                <Bell size={16} color={theme.colors.ivory} />
                <Text style={styles.reminderBtnText}>Set Class Reminder Notification</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Floating Toast Notice */}
      {toastMessage && (
        <View style={styles.toastContainer} pointerEvents="none">
          <View style={styles.toastPill}>
            <Sparkles size={15} color={theme.colors.accent} />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
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
    color: theme.colors.ivory,
  },
  headerSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#1C1C20',
    borderRadius: 999,
    padding: 3,
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  toggleBtnActive: {
    backgroundColor: theme.colors.accent,
  },
  toggleText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  toggleTextActive: {
    color: theme.colors.ivory,
    fontFamily: 'Inter-SemiBold',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 184, 61, 0.1)',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 6,
    gap: 6,
  },
  offlineText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: theme.colors.warning,
  },
  daySelectorWrapper: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  dayScroll: {
    paddingHorizontal: theme.spacing.lg,
    gap: 8,
  },
  dayCard: {
    width: 52,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  dayCardActive: {
    backgroundColor: 'rgba(255, 106, 43, 0.18)',
    borderColor: theme.colors.accent,
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  dayLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  dayLabelActive: {
    color: theme.colors.accent,
    fontFamily: 'Inter-SemiBold',
  },
  dayNum: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: theme.colors.ivory,
    marginVertical: 1,
  },
  dayNumActive: {
    color: '#FFF',
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.textSecondary,
  },
  dayDotActive: {
    backgroundColor: theme.colors.accent,
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
    color: theme.colors.ivory,
  },
  endTime: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  railPeriodPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 6,
  },
  railPeriodText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 9,
    color: theme.colors.textSecondary,
  },
  railLine: {
    position: 'absolute',
    top: 50,
    bottom: -16,
    left: 20,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
    backgroundColor: '#FF6A2B',
  },
  statusChipText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  codeTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subjectCode: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  subjectTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    color: theme.colors.ivory,
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
    color: theme.colors.textPrimary,
    flexShrink: 1,
  },
  roomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 106, 43, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 43, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.chip,
    gap: 4,
  },
  roomBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: theme.colors.accent,
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  compactTime: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: theme.colors.ivory,
  },
  compactDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 10,
  },
  compactSubject: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: theme.colors.ivory,
  },
  compactRoom: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
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
    color: theme.colors.accent,
  },
  weekDayDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  weekDayCount: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  weekDayEmpty: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.3)',
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
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  changedBadgeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
    color: theme.colors.warning,
    letterSpacing: 0.2,
  },
  compactChangedBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  compactChangedBadgeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 9,
    color: theme.colors.warning,
  },
  changeNoteBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 8,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 2,
    marginBottom: 8,
  },
  changeNoteText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: theme.colors.warning,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#161618',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
    padding: theme.spacing.lg,
    paddingBottom: 36,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
    backgroundColor: 'rgba(255, 106, 43, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.chip,
  },
  typeBadgePillText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: theme.colors.accent,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSubject: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: theme.colors.ivory,
    lineHeight: 26,
    marginBottom: 4,
  },
  modalCode: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  modalGrid: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    color: theme.colors.textSecondary,
  },
  gridValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: theme.colors.ivory,
    marginTop: 1,
  },
  actionSection: {
    marginBottom: 14,
  },
  actionHeader: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: theme.colors.textSecondary,
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
  presentBtn: {
    backgroundColor: 'rgba(61, 214, 140, 0.12)',
    borderColor: 'rgba(61, 214, 140, 0.3)',
  },
  presentBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#3DD68C',
  },
  absentBtn: {
    backgroundColor: 'rgba(255, 92, 92, 0.12)',
    borderColor: 'rgba(255, 92, 92, 0.3)',
  },
  absentBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#FF5C5C',
  },
  reminderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
    borderRadius: theme.radius.pill,
    paddingVertical: 12,
    gap: 8,
  },
  reminderBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: theme.colors.ivory,
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
    backgroundColor: 'rgba(22, 22, 24, 0.95)',
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  toastText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: theme.colors.ivory,
  },
});
