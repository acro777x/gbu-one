/**
 * GBU One — Academic Calendar & Holidays Screen
 * Per docs/ROADMAP.md Phase 5, docs/DATA_SOURCES.md
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Sparkles,
  Palmtree,
  BookOpen,
  GraduationCap,
  ChevronRight,
} from 'lucide-react-native';
import { GlassCard, Chip, PillButton } from '../src/components/ui';
import {
  filterCalendarEvents,
  CalendarEvent,
} from '../src/features/calendar/calendarService';
import { useCalendarQuery } from '../src/features/calendar/useCalendarQuery';
import {
  ACADEMIC_CALENDAR_PDF_URL,
  HOLIDAY_LIST_PDF_URL,
} from '../src/features/calendar/officialAcademicCalendar';
import { registerDocument } from '../src/components/pdf/pdfRegistry';
import { theme } from '../src/lib/theme';

import { useAppTheme } from '../src/lib/ThemeContext';

const CATEGORIES = ['All', 'Holiday', 'Exam', 'Academic', 'Vacation'];

export default function CalendarScreen() {
  const { colors, isDark } = useAppTheme();
  const [selectedCategory, setSelectedCategory] = useState('All');

  const { data: calendarEvents } = useCalendarQuery();
  const filteredEvents = filterCalendarEvents(calendarEvents, selectedCategory);

  const getCategoryIcon = (category: CalendarEvent['category']) => {
    switch (category) {
      case 'holiday':
        return <Sparkles size={14} color={colors.warning} />;
      case 'vacation':
        return <Palmtree size={14} color={colors.success} />;
      case 'exam':
        return <BookOpen size={14} color={colors.accent} />;
      case 'academic':
        return <GraduationCap size={14} color={colors.textPrimary} />;
    }
  };

  const getCategoryBadgeStyle = (category: CalendarEvent['category']) => {
    switch (category) {
      case 'holiday':
        return { backgroundColor: colors.warningSoft, color: colors.warning };
      case 'vacation':
        return { backgroundColor: colors.successSoft, color: colors.success };
      case 'exam':
        return { backgroundColor: colors.accentSoft, color: colors.accent };
      case 'academic':
        return { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.06)', color: colors.textPrimary };
    }
  };

  const openOfficialCalendarPdf = () => {
    // The examination portal publishes the calendar; the host is
    // `exams.gbu.ac.in` (with an s) - the old link used `exam.gbu.ac.in`,
    // which does not resolve, so the button did nothing.
    router.push({
      pathname: '/pdf',
      params: {
        id: registerDocument(ACADEMIC_CALENDAR_PDF_URL, 'Academic Calendar 2026-27'),
        title: 'Academic Calendar 2026-27',
      },
    });
  };

  const openHolidayListPdf = () => {
    router.push({
      pathname: '/pdf',
      params: {
        id: registerDocument(HOLIDAY_LIST_PDF_URL, 'List of Holidays 2026'),
        title: 'List of Holidays 2026',
      },
    });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.surface }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTextCol}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Academic Calendar</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Session 2026-27 • Gautam Buddha University</Text>
        </View>

        <TouchableOpacity style={[styles.pdfBtn, { backgroundColor: colors.accentSoft }]} onPress={openOfficialCalendarPdf}>
          <Download size={16} color={colors.accent} />
          <Text style={[styles.pdfBtnText, { color: colors.accent }]}>PDF</Text>
        </TouchableOpacity>
      </View>

      {/* Campus Events & Fests Navigation Banner */}
      <TouchableOpacity
        style={[styles.eventsBanner, { backgroundColor: colors.accentSoft, borderColor: colors.borderGlass }]}
        onPress={() => router.push('/events')}
        accessibilityRole="button"
        accessibilityLabel="View Campus Events and Fests"
      >
        <View style={styles.eventsBannerLeft}>
          <Sparkles size={18} color={colors.accent} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={[styles.eventsBannerTitle, { color: colors.textPrimary }]}>
              Campus Events & Fests
            </Text>
            <Text style={[styles.eventsBannerSub, { color: colors.textSecondary }]}>
              Abhivyanjana, Shauryautsav, club activities & workshops
            </Text>
          </View>
        </View>
        <ChevronRight size={18} color={colors.accent} />
      </TouchableOpacity>

      {/* Category Filter Chips */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              selected={selectedCategory === cat}
              onPress={() => setSelectedCategory(cat)}
              onRemove={selectedCategory === cat && cat !== 'All' ? () => setSelectedCategory('All') : undefined}
              style={styles.filterChip}
            />
          ))}
        </ScrollView>
      </View>

      {/* Events Timeline */}
      <FlatList
        data={filteredEvents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        renderItem={({ item: event }) => {
          const badgeStyle = getCategoryBadgeStyle(event.category);
          const dateObj = new Date(event.dateFrom);
          const formattedDate = dateObj.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });

          return (
            <GlassCard key={event.id} style={styles.eventCard}>
              <View style={styles.eventCardTop}>
                <View style={[styles.categoryBadge, { backgroundColor: badgeStyle.backgroundColor }]}>
                  {getCategoryIcon(event.category)}
                  <Text style={[styles.categoryBadgeText, { color: badgeStyle.color }]}>
                    {event.category.toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.eventDateText, { color: colors.textSecondary }]}>{formattedDate}</Text>
              </View>

              <Text style={[styles.eventTitle, { color: colors.textPrimary }]}>{event.title}</Text>

              {event.description && (
                <Text style={[styles.eventDescription, { color: colors.textSecondary }]}>{event.description}</Text>
              )}
            </GlassCard>
          );
        }}
        ListFooterComponent={
          /* Official Source Callout */
          <View style={[styles.sourceCallout, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.03)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.08)',
          }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sourceTitle, { color: colors.textPrimary }]}>Official GBU Calendar 2026-27</Text>
              <Text style={[styles.sourceSub, { color: colors.textSecondary }]}>
                Approved by the Academic Council. View the signed official PDF document.
              </Text>
            </View>
            <PillButton
              label="View PDF"
              onPress={openOfficialCalendarPdf}
              variant="outline"
              size="sm"
              icon={<ExternalLink size={14} color={colors.accent} style={{ marginRight: 6 }} />}
            />
          </View>
        }
        ListHeaderComponent={
          <View style={[styles.sourceCallout, styles.holidayCallout, {
            backgroundColor: colors.warningSoft,
            borderColor: colors.warning,
          }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sourceTitle, { color: colors.textPrimary }]}>List of holidays 2026</Text>
              <Text style={[styles.sourceSub, { color: colors.textSecondary }]}>
                The university publishes the holiday list as a scan in Hindi. It opens in the app so
                you can read it straight away.
              </Text>
            </View>
            <PillButton
              label="Open"
              onPress={openHolidayListPdf}
              variant="outline"
              size="sm"
              icon={<ExternalLink size={14} color={colors.accent} style={{ marginRight: 6 }} />}
            />
          </View>
        }
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
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
  },
  headerSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 43, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pdfBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
  },
  eventsBanner: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  eventsBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  eventsBannerTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  eventsBannerSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 2,
  },
  filterSection: {
    paddingVertical: theme.spacing.sm,
  },
  filterScroll: {
    paddingHorizontal: theme.spacing.lg,
  },
  filterChip: {
    marginRight: 6,
    marginBottom: 0,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 110,
  },
  timelineList: {
    gap: 12,
  },
  eventCard: {
    padding: 14,
  },
  eventCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  eventDateText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  eventTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  eventDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 17,
  },
  sourceCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: 20,
    gap: 12,
  },
  holidayCallout: {
    marginTop: 12,
  },
  sourceTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  sourceSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
});
