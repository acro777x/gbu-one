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
  ArrowLeft,
  ExternalLink,
  X,
} from 'lucide-react-native';
import { GlassCard, PillButton, Toast } from '../src/components/ui';
import { CountUp } from '../src/components/motion/CountUp';
import {
  calculateExamCountdown,
  MOCK_END_SEM_DATESHEET,
} from '../src/features/exams/examService';
import {
  PUBLIC_RESULT_SHEETS,
  openResultPortal,
  resultSheetForSchool,
  type ResultSheet,
} from '../src/features/exams/resultPortals';
import { useDatesheetQuery } from '../src/features/exams/useDatesheetQuery';
import { checkSchoolResults } from '../src/features/exams/resultAlerts';
import { useAuthStore } from '../src/store/useAuthStore';
import { registerDocument } from '../src/components/pdf/pdfRegistry';
import { theme } from '../src/lib/theme';
import { useAppTheme } from '../src/lib/ThemeContext';

export default function ExamsScreen() {
  const { user, classSelection } = useAuthStore();
  const { colors, isDark } = useAppTheme();
  const [activeTab, setActiveTab] = useState<'datesheet' | 'results'>('datesheet');
  const [examPhase, setExamPhase] = useState<'end' | 'mid'>('end');
  const [rollQuery, setRollQuery] = useState(user?.rollNo || '22/ICS/042');
  const [admitCardReminder, setAdmitCardReminder] = useState(true);
  const [resultsWatch, setResultsWatch] = useState(false);
  const [watching, setWatching] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const countdownDays = examPhase === 'end'
    ? calculateExamCountdown('2026-12-14T04:00:00.000Z')
    : calculateExamCountdown('2026-11-03T04:00:00.000Z');

  // The date sheet comes from the backend; the bundled seed is the fallback.
  const programmeCode = classSelection?.programmeCode || 'BCS';
  const semester = classSelection?.semester || 'II';
  const { data: datesheet } = useDatesheetQuery(programmeCode, semester);
  const activeDatesheet = examPhase === 'end' ? MOCK_END_SEM_DATESHEET : datesheet;

  const handleOpenResultSheet = (sheet?: ResultSheet) => {
    const target =
      sheet ??
      resultSheetForSchool(user?.classSelection?.school ?? null);
    if (!target) {
      setToastMessage('Pick your school from the list below to open your result sheet.');
      setToastVisible(true);
      return;
    }
    router.push({
      pathname: '/pdf',
      params: {
        id: registerDocument(target.url, `${target.school} result sheet`),
        title: `${target.school} result sheet`,
      },
    });
  };

  const handleOpenResultPortal = async () => {
    const opened = await openResultPortal();
    if (!opened) {
      setToastMessage('Could not open the university result portal.');
      setToastVisible(true);
    }
  };

  const handleToggleReminder = (val: boolean) => {
    setAdmitCardReminder(val);
    setToastMessage(val ? 'Admit card reminder set for 48h before exams' : 'Reminder turned off');
    setToastVisible(true);
  };

  const school = classSelection?.school ?? user?.classSelection?.school ?? '';

  /**
   * Watches the published sheet for the student's school. The first look only
   * records a baseline; a later look alerts when the sheet's revision moves,
   * which is how a newly published or re-checked result shows up. Nothing is
   * sent to GBU One, and no portal password is involved.
   */
  const handleToggleResultsWatch = async (val: boolean) => {
    setResultsWatch(val);
    if (!val) {
      setToastMessage('Result alerts turned off');
      setToastVisible(true);
      return;
    }
    if (!school) {
      setResultsWatch(false);
      setToastMessage('Choose your school in class setup, then result alerts can watch it.');
      setToastVisible(true);
      return;
    }
    await runResultsCheck(true);
  };

  const runResultsCheck = async (fromToggle: boolean) => {
    setWatching(true);
    const outcome = await checkSchoolResults(school, { notify: true });
    setWatching(false);
    if (outcome.checked === 0) {
      setResultsWatch(false);
      setToastMessage(`The examination portal has no published sheet for ${school} yet.`);
      setToastVisible(true);
      return;
    }
    if (outcome.changes.length > 0) {
      setToastMessage(
        outcome.notified
          ? `New ${school} result sheet found - you have been notified.`
          : `New ${school} result sheet found. Allow notifications to be alerted next time.`,
      );
    } else if (fromToggle) {
      setToastMessage(`Watching the ${school} result sheet. You will be told when it changes.`);
    } else {
      setToastMessage(`Checked the ${school} sheet - nothing new since last time.`);
    }
    setToastVisible(true);
  };

  const subtleBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.06)';
  const subtleBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.10)';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      {/* Top Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
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
          style={[styles.tabItem, activeTab === 'datesheet' && [styles.tabItemActive, { backgroundColor: colors.accentFill }]]}
          onPress={() => setActiveTab('datesheet')}
        >
          <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'datesheet' && [styles.tabTextActive, { color: colors.onAccent }]]}>
            Date Sheet & Alerts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'results' && [styles.tabItemActive, { backgroundColor: colors.accentFill }]]}
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
            {/* Exam Phase Toggle (End Sem vs Mid Sem) */}
            <View style={styles.phaseToggleRow}>
              <TouchableOpacity
                style={[
                  styles.phaseToggleBtn,
                  examPhase === 'end' && { backgroundColor: colors.accentFill },
                ]}
                onPress={() => setExamPhase('end')}
              >
                <Text
                  style={[
                    styles.phaseToggleText,
                    { color: colors.textSecondary },
                    examPhase === 'end' && { color: colors.onAccent, fontFamily: 'Inter-Bold' },
                  ]}
                >
                  End Sem (14-24 Dec)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.phaseToggleBtn,
                  examPhase === 'mid' && { backgroundColor: colors.accentFill },
                ]}
                onPress={() => setExamPhase('mid')}
              >
                <Text
                  style={[
                    styles.phaseToggleText,
                    { color: colors.textSecondary },
                    examPhase === 'mid' && { color: colors.onAccent, fontFamily: 'Inter-Bold' },
                  ]}
                >
                  Mid Sem (3 Nov)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Exam Countdown Card */}
            <GlassCard style={[styles.countdownCard, { backgroundColor: colors.accentSoft }]} accentBorder>
              <View style={styles.countdownRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.countdownBadge, { color: colors.accent }]}>AUTUMN SEMESTER 2026</Text>
                  <Text style={[styles.countdownTitle, { color: colors.textPrimary }]}>
                    {examPhase === 'end' ? 'End Semester Exams' : 'Mid Semester Exams'}
                  </Text>
                  <Text style={[styles.countdownSub, { color: colors.textSecondary }]}>
                    {examPhase === 'end'
                      ? 'Starts Monday, 14 Dec 2026 • GBU Academic Calendar'
                      : 'Starts Monday, 3 Nov 2026'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.countdownBox,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.borderGlass,
                      borderWidth: 1,
                    },
                  ]}
                >
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
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {examPhase === 'end' ? 'End Semester Examination Schedule' : 'Mid Semester Examination Schedule'}
              </Text>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                {activeDatesheet.length} subjects • {examPhase === 'end' ? '14 Dec - 24 Dec' : '3 Nov - 10 Nov'}
              </Text>
            </View>

            {examPhase === 'end' && (
              <View style={[styles.practicalAlertBanner, { backgroundColor: colors.warningSoft }]}>
                <Text style={[styles.practicalAlertText, { color: colors.warning }]}>
                  Notice: Lab / Practical Exams: 30 Nov – 04 Dec • Back Paper: 07 Dec – 12 Dec
                </Text>
              </View>
            )}

            <View style={styles.datesheetList}>
              {activeDatesheet.map((entry, _idx) => (
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
                  <Text style={[styles.resultsHeaderTitle, { color: colors.textPrimary }]}>Result Finder</Text>
                  <Text style={[styles.resultsHeaderSub, { color: colors.textSecondary }]}>
                    The university publishes its results as PDF scans, one sheet per school. Open your
                    sheet and find your roll number in it.
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
                label="Open my result sheet"
                onPress={handleOpenResultSheet}
                variant="primary"
                size="md"
                style={{ marginTop: 12 }}
              />

              <PillButton
                label="Student result portal"
                onPress={handleOpenResultPortal}
                variant="outline"
                size="md"
                style={{ marginTop: 8 }}
              />

              <Text style={[styles.resultsHint, { color: colors.textTertiary }]}>
                Your own result and admit card are behind the portal's login, which asks for your
                roll number, your password and a captcha. GBU One never asks for or stores those -
                open the portal here and sign in there.
              </Text>
            </GlassCard>

            {/* A new sheet, noticed without touching the portal's login. */}
            <GlassCard style={styles.resultWatchCard}>
              <View style={styles.resultWatchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.resultWatchTitle, { color: colors.textPrimary }]}>
                    Tell me when results are out
                  </Text>
                  <Text style={[styles.resultWatchSub, { color: colors.textSecondary }]}>
                    {school
                      ? `Watches the public ${school} result sheet and alerts you when it changes.`
                      : 'Choose your school in class setup to switch this on.'}
                  </Text>
                </View>
                <Switch
                  value={resultsWatch}
                  onValueChange={(val) => void handleToggleResultsWatch(val)}
                  disabled={watching}
                />
              </View>
              <TouchableOpacity
                onPress={() => void runResultsCheck(false)}
                disabled={watching || !school}
                style={styles.resultWatchCheck}
                accessibilityRole="button"
                accessibilityLabel="Check the published result sheet now"
              >
                <Text
                  style={[
                    styles.resultWatchCheckText,
                    { color: school ? colors.accent : colors.textTertiary },
                  ]}
                >
                  {watching ? 'Checking the portal...' : 'Check the portal now'}
                </Text>
              </TouchableOpacity>
            </GlassCard>

            {/* The published result sheets, one per school. */}
            <View style={styles.resultSheetsHeader}>
              <Text style={[styles.resultsHeaderTitle, { color: colors.textPrimary }]}>
                Published result sheets
              </Text>
              <Text style={[styles.resultsHeaderSub, { color: colors.textSecondary }]}>
                Every sheet the examination portal publishes for the last session.
              </Text>
            </View>

            {PUBLIC_RESULT_SHEETS.filter((sheet) => !sheet.special).map((sheet) => (
              <TouchableOpacity
                key={sheet.code}
                style={[styles.resultSheetRow, { backgroundColor: colors.surface, borderColor: subtleBorder }]}
                onPress={() => handleOpenResultSheet(sheet)}
                accessibilityRole="button"
                accessibilityLabel={`Open the ${sheet.school} result sheet`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.resultSheetName, { color: colors.textPrimary }]}>
                    {sheet.school} result sheet
                  </Text>
                  <Text style={[styles.resultSheetMeta, { color: colors.textSecondary }]}>
                    Official PDF published by the examination portal
                  </Text>
                </View>
                <ExternalLink size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
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
  phaseToggleRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  phaseToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(128,128,128,0.1)',
  },
  phaseToggleText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
  },
  practicalAlertBanner: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    marginBottom: theme.spacing.md,
  },
  practicalAlertText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
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
    backgroundColor: theme.colors.warningSoft,
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
  resultsHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  resultWatchCard: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
  },
  resultWatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultWatchTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    marginBottom: 2,
  },
  resultWatchSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 17,
  },
  resultWatchCheck: {
    marginTop: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  resultWatchCheckText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  resultSheetsHeader: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  resultSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    minHeight: 56,
  },
  resultSheetName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  resultSheetMeta: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 2,
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
    backgroundColor: theme.colors.successSoft,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  statusPcp: {
    backgroundColor: theme.colors.warningSoft,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  statusText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
  },
  gpaRow: {
    flexDirection: 'row',
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
