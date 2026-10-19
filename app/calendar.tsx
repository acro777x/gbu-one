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
  Linking,
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
} from 'lucide-react-native';
import { GlassCard, Chip, PillButton } from '../src/components/ui';
import {
  MOCK_CALENDAR_EVENTS,
  filterCalendarEvents,
  CalendarEvent,
} from '../src/features/calendar/calendarService';
import { theme } from '../src/lib/theme';
import { useAppTheme } from '../src/lib/ThemeContext';

const CATEGORIES = ['All', 'Holiday', 'Exam', 'Academic', 'Vacation'];

export default function CalendarScreen() {
  const { colors, isDark } = useAppTheme();
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredEvents = filterCalendarEvents(MOCK_CALENDAR_EVENTS, selectedCategory);

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
        return { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: colors.warning };
      case 'vacation':
        return { backgroundColor: 'rgba(16, 185, 129, 0.15)', color: colors.success };
      case 'exam':
        return { backgroundColor: colors.accentSoft, color: colors.accent };
      case 'academic':
        return { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.06)', color: colors.textPrimary };
    }
  };

  const openOfficialCalendarPdf = () => {
    Linking.openURL(
      'https://exam.gbu.ac.in/uploads/imp_link/Academic%20Calendar%202026-27.pdf',
    ).catch(() => {
      Linking.openURL('https://gbu.ac.in').catch(() => {});
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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.timelineList}>
          {filteredEvents.map((event) => {
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
          })}
        </View>

        {/* Official Source Callout */}
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
      </ScrollView>
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
