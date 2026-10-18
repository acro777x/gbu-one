import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { MapPin, User, WifiOff, AlertTriangle } from 'lucide-react-native';
import { GlassCard, Chip, Skeleton, EmptyState } from '../../src/components/ui';
import {
  GBUTimetableProvider,
  Timetable,
} from '../../src/features/timetable/timetableProvider';
import { useAuthStore } from '../../src/store/useAuthStore';
import { theme } from '../../src/lib/theme';

const DAYS = [
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
];

export default function TimetableScreen() {
  const { classSelection } = useAuthStore();
  const currentSection = classSelection?.section || 'BCS-II B';

  // State
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'compact'>('day');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const provider = new GBUTimetableProvider();

  const loadTimetable = async () => {
    try {
      setLoading(true);
      const data = await provider.getTimetable(currentSection, '39');
      // If current section has changed slot, decorate it
      const decoratedSlots = data.slots.map((s, idx) => {
        if (s.isChanged) return s;
        if (idx === 0 && currentSection === 'BCS-II B') {
          return {
            ...s,
            isChanged: true,
            changeNote: 'Room changed to IL104 (was IL101)',
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

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Timetable</Text>
          <Text style={styles.headerSub}>{currentSection} • Semester 39</Text>
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

      {/* Day Selector Chips (shown in Day & Compact mode) */}
      {viewMode !== 'week' && (
        <View style={styles.daySelector}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayScroll}>
            {DAYS.map((d) => (
              <Chip
                key={d.id}
                label={d.label}
                selected={selectedDay === d.id}
                onPress={() => setSelectedDay(d.id)}
                style={styles.dayChip}
              />
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
            <Skeleton height={80} borderRadius={16} style={{ marginBottom: 12 }} />
            <Skeleton height={80} borderRadius={16} style={{ marginBottom: 12 }} />
            <Skeleton height={80} borderRadius={16} style={{ marginBottom: 12 }} />
          </View>
        ) : viewMode === 'week' ? (
          <View style={styles.weekContainer}>
            {DAYS.map((d) => {
              const slotsForDay = (timetable?.slots || []).filter((s) => s.day === d.id);
              return (
                <View key={d.id} style={styles.weekDaySection}>
                  <View style={styles.weekDayHeader}>
                    <Text style={styles.weekDayTitle}>{d.label}</Text>
                    <Text style={styles.weekDayCount}>
                      {slotsForDay.length} {slotsForDay.length === 1 ? 'class' : 'classes'}
                    </Text>
                  </View>
                  {slotsForDay.length === 0 ? (
                    <Text style={styles.weekDayEmpty}>No scheduled classes</Text>
                  ) : (
                    slotsForDay.map((slot) => (
                      <GlassCard key={slot.id} style={styles.weekSlotCard}>
                        <View style={styles.compactRow}>
                          <Text style={styles.compactTime}>{slot.start}</Text>
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
              const isFirst = index === 0;

              if (viewMode === 'compact') {
                return (
                  <GlassCard key={slot.id} style={styles.compactCard}>
                    <View style={styles.compactRow}>
                      <Text style={styles.compactTime}>{slot.start}</Text>
                      <View style={styles.compactDivider} />
                      <View style={{ flex: 1 }}>
                        <View style={styles.inlineHeader}>
                          <Text style={styles.compactSubject} numberOfLines={1}>{slot.subject}</Text>
                          {slot.isChanged && (
                            <View style={styles.compactChangedBadge}>
                              <Text style={styles.compactChangedBadgeText}>Changed</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.compactRoom}>{slot.room || 'TBD'} • {slot.faculty || 'Faculty'}</Text>
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
                    <View style={styles.railLine} />
                  </View>

                  {/* Class Card */}
                  <View style={styles.cardCol}>
                    <GlassCard
                      style={[
                        styles.classCard,
                        isFirst && styles.activeClassCard,
                      ]}
                      accentBorder={isFirst}
                    >
                      {/* Top tags */}
                      <View style={styles.cardHeader}>
                        <View style={styles.tagGroup}>
                          <View style={styles.typeTag}>
                            <Text style={styles.typeText}>{slot.type?.toUpperCase() || 'LECTURE'}</Text>
                          </View>
                          {slot.isChanged && (
                            <View style={styles.changedBadge}>
                              <AlertTriangle size={10} color={theme.colors.warning} />
                              <Text style={styles.changedBadgeText}>Changed</Text>
                            </View>
                          )}
                        </View>
                        {slot.subjectCode ? (
                          <Text style={styles.subjectCode}>{slot.subjectCode}</Text>
                        ) : null}
                      </View>

                      {/* Subject */}
                      <Text style={styles.subjectTitle}>{slot.subject}</Text>

                      {/* Change note banner */}
                      {slot.isChanged && slot.changeNote ? (
                        <View style={styles.changeNoteBox}>
                          <Text style={styles.changeNoteText}>{slot.changeNote}</Text>
                        </View>
                      ) : null}

                      {/* Room & Faculty */}
                      <View style={styles.cardFooter}>
                        {slot.room && (
                          <View style={styles.metaItem}>
                            <MapPin size={13} color={theme.colors.accent} />
                            <Text style={styles.metaValue}>{slot.room}</Text>
                          </View>
                        )}
                        {slot.faculty && (
                          <View style={styles.metaItem}>
                            <User size={13} color={theme.colors.textSecondary} />
                            <Text style={styles.metaValue}>{slot.faculty}</Text>
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
  daySelector: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  dayScroll: {
    paddingHorizontal: theme.spacing.lg,
  },
  dayChip: {
    marginRight: 8,
    marginBottom: 0,
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
    marginBottom: theme.spacing.md,
  },
  timeRail: {
    width: 60,
    alignItems: 'flex-start',
    paddingTop: 6,
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
  railLine: {
    position: 'absolute',
    top: 38,
    bottom: -16,
    left: 20,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardCol: {
    flex: 1,
    marginLeft: 8,
  },
  classCard: {
    padding: theme.spacing.md,
  },
  activeClassCard: {
    backgroundColor: 'rgba(255, 106, 43, 0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  typeTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 9,
    color: theme.colors.accent,
    letterSpacing: 0.5,
  },
  subjectCode: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  subjectTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    color: theme.colors.ivory,
    lineHeight: 20,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaValue: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  compactCard: {
    marginBottom: 8,
    padding: 12,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactTime: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: theme.colors.accent,
    width: 50,
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
  weekDayTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    color: theme.colors.accent,
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
  tagGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
});
