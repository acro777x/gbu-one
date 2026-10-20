/**
 * GBU One — Exam Hub & On-Device Result Finder Screen
 * Per docs/ROADMAP.md Phase 5, docs/DATA_SOURCES.md, docs/ARCHITECTURE.md
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Calendar,
  Clock,
  MapPin,
  Search,
  Bell,
  Award,
  AlertCircle,
  ArrowLeft,
  X,
} from 'lucide-react-native';
import { GlassCard, PillButton, Toast } from '../src/components/ui';
import { CountUp } from '../src/components/motion/CountUp';
import {
  searchRollNumberResult,
  calculateExamCountdown,
  StudentResultRecord,
} from '../src/features/exams/examService';
import { useDatesheetQuery } from '../src/features/exams/useDatesheetQuery';
import { useAuthStore } from '../src/store/useAuthStore';
import { theme } from '../src/lib/theme';
import { useAppTheme } from '../src/lib/ThemeContext';

export default function ExamsScreen() {
  const { user, classSelection } = useAuthStore();
  const { colors, isDark } = useAppTheme();
  const [activeTab, setActiveTab] = useState<'datesheet' | 'results'>('datesheet');
  const [rollQuery, setRollQuery] = useState(user?.rollNo || '22/ICS/042');
  const [searchResult, setSearchResult] = useState<StudentResultRecord | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [admitCardReminder, setAdmitCardReminder] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const countdownDays = calculateExamCountdown('2026-11-03T04:00:00.000Z');

  // The date sheet comes from the backend; the bundled seed is the fallback.
  const programmeCode = classSelection?.programmeCode || 'BCS';
  const semester = classSelection?.semester || 'II';
  const { data: datesheet } = useDatesheetQuery(programmeCode, semester);

  const handleSearchRoll = () => {
    if (!rollQuery.trim()) return;
    const res = searchRollNumberResult(rollQuery);
    setSearchResult(res);
    setHasSearched(true);
  };

  const handleToggleReminder = (val: boolean) => {
    setAdmitCardReminder(val);
    setToastMessage(val ? 'Admit card reminder set for 48h before exams' : 'Reminder turned off');
    setToastVisible(true);
  };

  const subtleBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.06)';
  const subtleBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.10)';
  const subtleDivider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.05)';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      {/* Top Bar */}
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
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Examination Hub</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            {classSelection?.programmeCode || 'BCS'} • Semester {classSelection?.semester || 'II'}
          </Text>
        </View>
      </View>

      {/* Tabs Switcher: Datesheet / Results */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'datesheet' && [styles.tabItemActive, { backgroundColor: colors.accent }]]}
          onPress={() => setActiveTab('datesheet')}
        >
          <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'datesheet' && [styles.tabTextActive, { color: colors.onAccent }]]}>
            Date Sheet & Alerts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'results' && [styles.tabItemActive, { backgroundColor: colors.accent }]]}
          onPress={() => setActiveTab('results')}
        >
          <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'results' && [styles.tabTextActive, { color: colors.onAccent }]]}>
            Results Finder
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'datesheet' ? (
          <>
            {/* Exam Countdown Card */}
            <GlassCard style={[styles.countdownCard, { backgroundColor: colors.accentSoft }]} accentBorder>
              <View style={styles.countdownRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.countdownBadge, { color: colors.accent }]}>AUTUMN SEMESTER 2026</Text>
                  <Text style={[styles.countdownTitle, { color: colors.textPrimary }]}>Mid Semester Exams</Text>
                  <Text style={[styles.countdownSub, { color: colors.textSecondary }]}>Starts Monday, 3 Nov 2026</Text>
                </View>
                <View style={styles.countdownBox}>
                  <CountUp value={countdownDays} style={[styles.countdownNumber, { color: colors.accent }]} />
                  <Text style={[styles.countdownLabel, { color: colors.textSecondary }]}>DAYS LEFT</Text>
                </View>
              </View>
            </GlassCard>

            {/* Admit Card Reminder Alert */}
            <GlassCard style={styles.reminderCard}>
              <View style={styles.reminderRow}>
                <View style={[styles.reminderIconCircle, { backgroundColor: colors.accentSoft }]}>
                  <Bell size={18} color={colors.accent} />
                </View>
                <View style={styles.reminderTextCol}>
                  <Text style={[styles.reminderTitle, { color: colors.textPrimary }]}>Admit Card Reminder</Text>
                  <Text style={[styles.reminderSub, { color: colors.textSecondary }]}>
                    Receive notification 48 hours before exam to collect admit card from SOICT office
                  </Text>
                </View>
                <Switch
                  value={admitCardReminder}
                  onValueChange={handleToggleReminder}
                  trackColor={{ false: '#333', true: colors.accent }}
                />
              </View>
            </GlassCard>

            {/* Datesheet Section */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Examination Schedule</Text>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>4 subjects scheduled</Text>
            </View>

            <View style={styles.datesheetList}>
              {datesheet.map((entry, _idx) => (
                <GlassCard key={entry.id} style={styles.examEntryCard}>
                  <View style={styles.examEntryTop}>
                    <View style={[styles.examEntryCodeBadge, { backgroundColor: subtleBg }]}>
                      <Text style={[styles.examEntryCode, { color: colors.accent }]}>{entry.subjectCode}</Text>
                    </View>
                    <View style={styles.examShiftBadge}>
                      <Text style={[styles.examShiftText, { color: colors.warning }]}>{entry.shift.toUpperCase()}</Text>
                    </View>
                  </View>

                  <Text style={[styles.examSubjectTitle, { color: colors.textPrimary }]}>{entry.subjectName}</Text>

                  <View style={styles.examMetaGrid}>
                    <View style={styles.metaCol}>
                      <Calendar size={13} color={colors.accent} />
                      <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                        {new Date(entry.examDate).toLocaleDateString('en-IN', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </Text>
                    </View>
                    <View style={styles.metaCol}>
                      <Clock size={13} color={colors.textSecondary} />
                      <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{entry.examTime}</Text>
                    </View>
                    {entry.roomBlock && (
                      <View style={styles.metaCol}>
                        <MapPin size={13} color={colors.textSecondary} />
                        <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{entry.roomBlock}</Text>
                      </View>
                    )}
                  </View>
                </GlassCard>
              ))}
            </View>
          </>
        ) : (
          <>
            {/* Results Finder Header Card */}
            <GlassCard style={styles.resultsHeaderCard}>
              <View style={styles.resultsHeaderRow}>
                <Award size={22} color={colors.accent} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.resultsHeaderTitle, { color: colors.textPrimary }]}>On-Device Result Finder</Text>
                  <Text style={[styles.resultsHeaderSub, { color: colors.textSecondary }]}>
                    Search roll number in official university grade sheets. Data is processed locally and never leaves your device.
                  </Text>
                </View>
              </View>

              {/* Search Box */}
              <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: subtleBorder }]}>
                <Search size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  value={rollQuery}
                  onChangeText={setRollQuery}
                  placeholder="Enter Roll Number (e.g. 22/ICS/042)"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.searchInput, { color: colors.textPrimary }]}
                  autoCapitalize="characters"
                />
                {rollQuery ? (
                  <TouchableOpacity onPress={() => setRollQuery('')} hitSlop={8}>
                    <X size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <PillButton
                label="Find My Result"
                onPress={handleSearchRoll}
                variant="primary"
                size="md"
                style={{ marginTop: 12 }}
              />
            </GlassCard>

            {/* Results Display */}
            {hasSearched && searchResult && (
              <GlassCard style={styles.resultCard} accentBorder>
                <View style={styles.resultHeader}>
                  <View>
                    <Text style={[styles.studentName, { color: colors.textPrimary }]}>{searchResult.studentName}</Text>
                    <Text style={[styles.studentRoll, { color: colors.textSecondary }]}>{searchResult.rollNo} • {searchResult.programme}</Text>
                  </View>
                  <View style={[styles.statusBadge, searchResult.status === 'PASS' ? styles.statusPass : styles.statusPcp]}>
                    <Text style={[styles.statusText, { color: colors.textPrimary }]}>{searchResult.status}</Text>
                  </View>
                </View>

                {/* GPA Stats */}
                <View style={styles.gpaRow}>
                  <View style={styles.gpaBox}>
                    <Text style={[styles.gpaLabel, { color: colors.textSecondary }]}>SGPA</Text>
                    <Text style={[styles.gpaValue, { color: colors.accent }]}>{searchResult.sgpa.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.gpaDivider, { backgroundColor: subtleBorder }]} />
                  <View style={styles.gpaBox}>
                    <Text style={[styles.gpaLabel, { color: colors.textSecondary }]}>CGPA</Text>
                    <Text style={[styles.gpaValue, { color: colors.accent }]}>{searchResult.cgpa.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Subject Grades */}
                <Text style={[styles.gradesTableTitle, { color: colors.textSecondary }]}>Subject-wise Performance</Text>
                {searchResult.grades.map((g) => (
                  <View key={g.subjectCode} style={[styles.gradeRow, { borderBottomColor: subtleDivider }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.gradeSubjectName, { color: colors.textPrimary }]}>{g.subjectName}</Text>
                      <Text style={[styles.gradeSubjectCode, { color: colors.textSecondary }]}>{g.subjectCode} • {g.credits} Credits</Text>
                    </View>
                    <View style={[styles.gradeLetterBox, { backgroundColor: colors.accentSoft }]}>
                      <Text style={[styles.gradeLetter, { color: colors.accent }]}>{g.grade}</Text>
                    </View>
                  </View>
                ))}
              </GlassCard>
            )}

            {hasSearched && !searchResult && (
              <View style={styles.noResultBox}>
                <AlertCircle size={24} color={colors.warning} />
                <Text style={[styles.noResultTitle, { color: colors.textPrimary }]}>No matching record found</Text>
                <Text style={[styles.noResultSub, { color: colors.textSecondary }]}>
                  No published result found for roll number "{rollQuery}". Ensure your roll number matches university format (e.g. 22/ICS/042).
                </Text>
              </View>
            )}
          </>
        )}
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
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    borderRadius: 999,
    padding: 3,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 999,
  },
  tabItemActive: {
    // backgroundColor applied inline
  },
  tabText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  tabTextActive: {
    fontFamily: 'Inter-SemiBold',
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 110,
  },
  countdownCard: {
    marginBottom: theme.spacing.md,
  },
  countdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countdownBadge: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  countdownTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
  },
  countdownSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 2,
  },
  countdownBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 70,
  },
  countdownNumber: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
  },
  countdownLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 9,
    marginTop: 2,
  },
  reminderCard: {
    marginBottom: theme.spacing.md,
    padding: 12,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reminderIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderTextCol: {
    flex: 1,
  },
  reminderTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  reminderSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
  },
  sectionSub: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
  },
  datesheetList: {
    gap: 10,
  },
  examEntryCard: {
    padding: 14,
  },
  examEntryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  examEntryCodeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  examEntryCode: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
  },
  examShiftBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  examShiftText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 9,
  },
  examSubjectTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    marginBottom: 8,
  },
  examMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
  },
  resultsHeaderCard: {
    marginBottom: theme.spacing.md,
    padding: 14,
  },
  resultsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  resultsHeaderTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
  },
  resultsHeaderSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
  },
  resultCard: {
    padding: 16,
    marginTop: 8,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  studentName: {
    fontFamily: 'Poppins-Bold',
    fontSize: 17,
  },
  studentRoll: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPass: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  statusPcp: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  statusText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
  },
  gpaRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  gpaBox: {
    flex: 1,
    alignItems: 'center',
  },
  gpaLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
  },
  gpaValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    marginTop: 2,
  },
  gpaDivider: {
    width: 1,
  },
  gradesTableTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  gradeSubjectName: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
  },
  gradeSubjectCode: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 2,
  },
  gradeLetterBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeLetter: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
  },
  noResultBox: {
    alignItems: 'center',
    padding: 24,
    marginTop: 16,
  },
  noResultTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    marginTop: 8,
  },
  noResultSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
});
