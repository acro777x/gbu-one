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
  SafeAreaView,
  TouchableOpacity,
  Linking,
} from 'react-native';
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

const CATEGORIES = ['All', 'Holiday', 'Exam', 'Academic', 'Vacation'];

export default function CalendarScreen() {
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredEvents = filterCalendarEvents(MOCK_CALENDAR_EVENTS, selectedCategory);

  const getCategoryIcon = (category: CalendarEvent['category']) => {
    switch (category) {
      case 'holiday':
        return <Sparkles size={14} color={theme.colors.warning} />;
      case 'vacation':
        return <Palmtree size={14} color={theme.colors.success} />;
      case 'exam':
        return <BookOpen size={14} color={theme.colors.accent} />;
      case 'academic':
        return <GraduationCap size={14} color={theme.colors.ivory} />;
    }
  };

  const getCategoryBadgeStyle = (category: CalendarEvent['category']) => {
    switch (category) {
      case 'holiday':
        return { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: theme.colors.warning };
      case 'vacation':
        return { backgroundColor: 'rgba(16, 185, 129, 0.15)', color: theme.colors.success };
      case 'exam':
        return { backgroundColor: 'rgba(255, 106, 43, 0.15)', color: theme.colors.accent };
      case 'academic':
        return { backgroundColor: 'rgba(255, 255, 255, 0.08)', color: theme.colors.ivory };
    }
  };

  const openOfficialCalendarPdf = () => {
    Linking.openURL(
      'https://exams.gbu.ac.in/uploads/imp_link/Academic%20Calendar%202026-27.pdf',
    ).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color={theme.colors.ivory} />
        </TouchableOpacity>
        <View style={styles.headerTextCol}>
          <Text style={styles.headerTitle}>Academic Calendar</Text>
          <Text style={styles.headerSub}>Session 2026-27 • Gautam Buddha University</Text>
        </View>

        <TouchableOpacity style={styles.pdfBtn} onPress={openOfficialCalendarPdf}>
          <Download size={16} color={theme.colors.accent} />
          <Text style={styles.pdfBtnText}>PDF</Text>
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
                  <Text style={styles.eventDateText}>{formattedDate}</Text>
                </View>

                <Text style={styles.eventTitle}>{event.title}</Text>

                {event.description && (
                  <Text style={styles.eventDescription}>{event.description}</Text>
                )}
              </GlassCard>
            );
          })}
        </View>

        {/* Official Source Callout */}
        <View style={styles.sourceCallout}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sourceTitle}>Official GBU Calendar 2026-27</Text>
            <Text style={styles.sourceSub}>
              Approved by the Academic Council. View the signed official PDF document.
            </Text>
          </View>
          <PillButton
            label="View PDF"
            onPress={openOfficialCalendarPdf}
            variant="outline"
            size="sm"
            icon={<ExternalLink size={14} color={theme.colors.ivory} style={{ marginRight: 6 }} />}
          />
        </View>
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
    backgroundColor: '#161618',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: theme.colors.ivory,
  },
  headerSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 106, 43, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 43, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pdfBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: theme.colors.accent,
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
    color: theme.colors.textSecondary,
  },
  eventTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    color: theme.colors.ivory,
    lineHeight: 20,
    marginBottom: 4,
  },
  eventDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 17,
  },
  sourceCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    marginTop: 20,
    gap: 12,
  },
  sourceTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: theme.colors.ivory,
  },
  sourceSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
});
