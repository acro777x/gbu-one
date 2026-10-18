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
  MOCK_DATESHEET,
  searchRollNumberResult,
  calculateExamCountdown,
  StudentResultRecord,
} from '../src/features/exams/examService';
import { useAuthStore } from '../src/store/useAuthStore';
import { theme } from '../src/lib/theme';

export default function ExamsScreen() {
  const { user, classSelection } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'datesheet' | 'results'>('datesheet');
  const [rollQuery, setRollQuery] = useState(user?.rollNo || '22/ICS/042');
  const [searchResult, setSearchResult] = useState<StudentResultRecord | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [admitCardReminder, setAdmitCardReminder] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const countdownDays = calculateExamCountdown('2026-11-03T04:00:00.000Z');

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

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color={theme.colors.ivory} />
        </TouchableOpacity>
        <View style={styles.headerTextCol}>
          <Text style={styles.headerTitle}>Examination Hub</Text>
          <Text style={styles.headerSub}>
            {classSelection?.programmeCode || 'BCS'} • Semester {classSelection?.semester || 'II'}
          </Text>
        </View>
      </View>

      {/* Tabs Switcher: Datesheet / Results */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'datesheet' && styles.tabItemActive]}
          onPress={() => setActiveTab('datesheet')}
        >
          <Text style={[styles.tabText, activeTab === 'datesheet' && styles.tabTextActive]}>
            Date Sheet & Alerts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'results' && styles.tabItemActive]}
          onPress={() => setActiveTab('results')}
        >
          <Text style={[styles.tabText, activeTab === 'results' && styles.tabTextActive]}>
            Results Finder
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'datesheet' ? (
          <>
            {/* Exam Countdown Card */}
            <GlassCard style={styles.countdownCard} accentBorder>
              <View style={styles.countdownRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.countdownBadge}>AUTUMN SEMESTER 2026</Text>
                  <Text style={styles.countdownTitle}>Mid Semester Exams</Text>
                  <Text style={styles.countdownSub}>Starts Monday, 3 Nov 2026</Text>
                </View>
                <View style={styles.countdownBox}>
                  <CountUp value={countdownDays} style={styles.countdownNumber} />
                  <Text style={styles.countdownLabel}>DAYS LEFT</Text>
                </View>
              </View>
            </GlassCard>

            {/* Admit Card Reminder Alert */}
            <GlassCard style={styles.reminderCard}>
              <View style={styles.reminderRow}>
                <View style={styles.reminderIconCircle}>
                  <Bell size={18} color={theme.colors.accent} />
                </View>
                <View style={styles.reminderTextCol}>
                  <Text style={styles.reminderTitle}>Admit Card Reminder</Text>
                  <Text style={styles.reminderSub}>
                    Receive notification 48 hours before exam to collect admit card from SOICT office
                  </Text>
                </View>
                <Switch
                  value={admitCardReminder}
                  onValueChange={handleToggleReminder}
                  trackColor={{ false: '#333', true: theme.colors.accent }}
                />
              </View>
            </GlassCard>

            {/* Datesheet Section */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Examination Schedule</Text>
              <Text style={styles.sectionSub}>4 subjects scheduled</Text>
            </View>

            <View style={styles.datesheetList}>
              {MOCK_DATESHEET.map((entry, _idx) => (
                <GlassCard key={entry.id} style={styles.examEntryCard}>
                  <View style={styles.examEntryTop}>
                    <View style={styles.examEntryCodeBadge}>
                      <Text style={styles.examEntryCode}>{entry.subjectCode}</Text>
                    </View>
                    <View style={styles.examShiftBadge}>
                      <Text style={styles.examShiftText}>{entry.shift.toUpperCase()}</Text>
                    </View>
                  </View>

                  <Text style={styles.examSubjectTitle}>{entry.subjectName}</Text>

                  <View style={styles.examMetaGrid}>
                    <View style={styles.metaCol}>
                      <Calendar size={13} color={theme.colors.accent} />
                      <Text style={styles.metaLabel}>
                        {new Date(entry.examDate).toLocaleDateString('en-IN', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </Text>
                    </View>
                    <View style={styles.metaCol}>
                      <Clock size={13} color={theme.colors.textSecondary} />
                      <Text style={styles.metaLabel}>{entry.examTime}</Text>
                    </View>
                    {entry.roomBlock && (
                      <View style={styles.metaCol}>
                        <MapPin size={13} color={theme.colors.textSecondary} />
                        <Text style={styles.metaLabel}>{entry.roomBlock}</Text>
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
                <Award size={22} color={theme.colors.accent} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.resultsHeaderTitle}>On-Device Result Finder</Text>
                  <Text style={styles.resultsHeaderSub}>
                    Search roll number in official university grade sheets. Data is processed locally and never leaves your device.
                  </Text>
                </View>
              </View>

              {/* Search Box */}
              <View style={styles.searchBar}>
                <Search size={18} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  value={rollQuery}
                  onChangeText={setRollQuery}
                  placeholder="Enter Roll Number (e.g. 22/ICS/042)"
                  placeholderTextColor="rgba(255, 255, 255, 0.3)"
                  style={styles.searchInput}
                  autoCapitalize="characters"
                />
                {rollQuery ? (
                  <TouchableOpacity onPress={() => setRollQuery('')} hitSlop={8}>
                    <X size={16} color={theme.colors.textSecondary} />
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
                    <Text style={styles.studentName}>{searchResult.studentName}</Text>
                    <Text style={styles.studentRoll}>{searchResult.rollNo} • {searchResult.programme}</Text>
                  </View>
                  <View style={[styles.statusBadge, searchResult.status === 'PASS' ? styles.statusPass : styles.statusPcp]}>
                    <Text style={styles.statusText}>{searchResult.status}</Text>
                  </View>
                </View>

                {/* GPA Stats */}
                <View style={styles.gpaRow}>
                  <View style={styles.gpaBox}>
                    <Text style={styles.gpaLabel}>SGPA</Text>
                    <Text style={styles.gpaValue}>{searchResult.sgpa.toFixed(2)}</Text>
                  </View>
                  <View style={styles.gpaDivider} />
                  <View style={styles.gpaBox}>
                    <Text style={styles.gpaLabel}>CGPA</Text>
                    <Text style={styles.gpaValue}>{searchResult.cgpa.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Subject Grades */}
                <Text style={styles.gradesTableTitle}>Subject-wise Performance</Text>
                {searchResult.grades.map((g) => (
                  <View key={g.subjectCode} style={styles.gradeRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.gradeSubjectName}>{g.subjectName}</Text>
                      <Text style={styles.gradeSubjectCode}>{g.subjectCode} • {g.credits} Credits</Text>
                    </View>
                    <View style={styles.gradeLetterBox}>
                      <Text style={styles.gradeLetter}>{g.grade}</Text>
                    </View>
                  </View>
                ))}
              </GlassCard>
            )}

            {hasSearched && !searchResult && (
              <View style={styles.noResultBox}>
                <AlertCircle size={24} color={theme.colors.warning} />
                <Text style={styles.noResultTitle}>No matching record found</Text>
                <Text style={styles.noResultSub}>
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#161618',
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
    backgroundColor: theme.colors.accent,
  },
  tabText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    color: theme.colors.ivory,
    fontFamily: 'Inter-SemiBold',
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 110,
  },
  countdownCard: {
    marginBottom: theme.spacing.md,
    backgroundColor: 'rgba(255, 106, 43, 0.08)',
  },
  countdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countdownBadge: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: theme.colors.accent,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  countdownTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: theme.colors.ivory,
  },
  countdownSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
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
    color: theme.colors.accent,
  },
  countdownLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 9,
    color: theme.colors.textSecondary,
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
    backgroundColor: 'rgba(255, 106, 43, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderTextCol: {
    flex: 1,
  },
  reminderTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: theme.colors.ivory,
  },
  reminderSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
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
    color: theme.colors.ivory,
  },
  sectionSub: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: theme.colors.textSecondary,
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  examEntryCode: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: theme.colors.accent,
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
    color: theme.colors.warning,
  },
  examSubjectTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    color: theme.colors.ivory,
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
    color: theme.colors.textSecondary,
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
    color: theme.colors.ivory,
  },
  resultsHeaderSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161618',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.ivory,
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
    color: theme.colors.ivory,
  },
  studentRoll: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
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
    color: theme.colors.ivory,
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
    color: theme.colors.textSecondary,
  },
  gpaValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    color: theme.colors.accent,
    marginTop: 2,
  },
  gpaDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  gradesTableTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: theme.colors.textSecondary,
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
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  gradeSubjectName: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: theme.colors.ivory,
  },
  gradeSubjectCode: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  gradeLetterBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 106, 43, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeLetter: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    color: theme.colors.accent,
  },
  noResultBox: {
    alignItems: 'center',
    padding: 24,
    marginTop: 16,
  },
  noResultTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    color: theme.colors.ivory,
    marginTop: 8,
  },
  noResultSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
});
