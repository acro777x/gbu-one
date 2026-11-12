/**
 * GBU One — Exam Hub & On-Device Result Finder Screen
 * Per docs/ROADMAP.md Phase 5, docs/DATA_SOURCES.md, docs/ARCHITECTURE.md
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  CheckCircle,
  AlertCircle,
  Sparkles,
} from 'lucide-react-native';
import { GlassCard, PillButton, Toast } from '../src/components/ui';
import { CountUp } from '../src/components/motion/CountUp';
import {
  calculateExamCountdown,
  examCountdownState,
  getClassDatesheet,
} from '../src/features/exams/examService';
import { buildCanonicalClassKey } from '../src/features/exams/examDateSheetParser';
import {
  PUBLIC_RESULT_SHEETS,
  resultSheetForSchool,
  buildGbuDirectResultUrl,
  openResultPortalWithParams,
  COMMON_RESULT_SESSIONS,
  matchesStudentBatch,
  type ResultSheet,
} from '../src/features/exams/resultPortals';
import { useDatesheetQuery } from '../src/features/exams/useDatesheetQuery';
import { useResultsQuery, type DeclaredResultItem } from '../src/features/exams/useResultsQuery';
import {
  checkSchoolResults,
  notifyBatchResultDeclared,
  BATCH_WATCH_STORAGE_KEY,
  saveSchoolWatchPreference,
  loadSchoolWatchPreference,
  schedulePeriodicResultsCheck,
  stopPeriodicResultsCheck,
  scheduleAdmitCardReminder,
  cancelAdmitCardReminder,
  loadSeenDeclaredResultIds,
  saveSeenDeclaredResultIds,
} from '../src/features/exams/resultAlerts';
import { useAuthStore } from '../src/store/useAuthStore';
import { registerDocument } from '../src/components/pdf/pdfRegistry';
import { theme } from '../src/lib/theme';
import { useAppTheme } from '../src/lib/ThemeContext';

export default function ExamsScreen() {
  const { user, classSelection } = useAuthStore();
  const { colors, isDark } = useAppTheme();
  const [activeTab, setActiveTab] = useState<'datesheet' | 'results'>('datesheet');
  const [examPhase, setExamPhase] = useState<'end' | 'practicals' | 'back' | 'mid'>('end');
  const [rollQuery, setRollQuery] = useState(user?.rollNo || '22/ICS/042');
  const [admitCardReminder, setAdmitCardReminder] = useState(true);
  const [resultsWatch, setResultsWatch] = useState(false);
  const [watching, setWatching] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const programmeCode = classSelection?.programmeCode || 'BCS';
  const semester = classSelection?.semester || 'II';
  // The class key the app uses names the programme, the semester and the
  // section, so a B.Tech AI student is never shown a B.Tech CSE schedule.
  const enrolledClassKey = classSelection?.section
    ? buildCanonicalClassKey(classSelection.section)
    : buildCanonicalClassKey(`${programmeCode} ${semester}`, semester);

  // The date sheet comes from the backend; the bundled sample is the fallback.
  const { data: datesheet } = useDatesheetQuery(programmeCode, semester, enrolledClassKey, examPhase);
  const activeDatesheet =
    datesheet && datesheet.length > 0
      ? datesheet
      : getClassDatesheet(enrolledClassKey, examPhase);

  // The bundled rows are labelled, so a sample schedule is never read as the
  // university's official one.
  const isSampleDatesheet =
    activeDatesheet.length > 0 && activeDatesheet.every((entry) => entry.isSample === true);

  // Calculate upcoming exam and countdown dynamically
  const upcomingExams = activeDatesheet
    .filter((e) => new Date(e.examDate).getTime() >= Date.now() - 24 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());
  const nextExam = upcomingExams[0];

  const countdownDays = nextExam ? calculateExamCountdown(nextExam.examDate) : 0;
  const countdownState = nextExam ? examCountdownState(nextExam.examDate) : null;

  const getDaysBadge = (examDateStr: string) => {
    const state = examCountdownState(examDateStr);
    const examDay = new Date(examDateStr).setHours(0, 0, 0, 0);
    const today = new Date().setHours(0, 0, 0, 0);
    if (examDay < today || state.state === 'past') {
      return { text: 'COMPLETED', color: colors.textTertiary, bg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' };
    }
    if (examDay === today) {
      return { text: 'TODAY', color: colors.danger, bg: colors.dangerSoft };
    }
    if (state.state === 'tomorrow') {
      return { text: 'TOMORROW', color: colors.warning, bg: colors.warningSoft };
    }
    return { text: `IN ${state.days} DAYS`, color: colors.accent, bg: colors.accentSoft };
  };

  const [selectedSession, setSelectedSession] = useState(COMMON_RESULT_SESSIONS[0]);
  const [dobQuery, setDobQuery] = useState('');
  const [portalGatewayVisible, setPortalGatewayVisible] = useState(false);
  const [batchWatch, setBatchWatch] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(BATCH_WATCH_STORAGE_KEY)
      .then((val) => {
        if (val === 'true') setBatchWatch(true);
      })
      .catch(() => {});
  }, []);

  // Live declared results from backend
  const { data: declaredResults } = useResultsQuery();

  const school = classSelection?.school ?? user?.classSelection?.school ?? '';

  /**
   * The result that belongs to this student.
   *
   * A declaration the university made comes first. The bundled sample is
   * only shown when there is no real declaration, and it is then labelled.
   */
  const matchingResult = useMemo(() => {
    const list = declaredResults || [];
    const student = {
      programmeCode,
      programmeName: classSelection?.programme,
      school,
      semester,
      selectedSession,
    };
    const live = list.find((r) => r.isSample !== true && matchesStudentBatch(r, student));
    if (live) return live;
    const sample = list.find((r) => r.isSample === true && matchesStudentBatch(r, student));
    return sample ?? undefined;
  }, [declaredResults, programmeCode, classSelection?.programme, school, semester, selectedSession]);

  const isMatchingResultLive = matchingResult?.isSample !== true;

  const handleOpenResultSheet = (sheet?: ResultSheet) => {
    const target = sheet ?? resultSheetForSchool(school);
    if (!target) {
      setToastMessage(
        school
          ? `The examination portal has no published sheet for ${school} yet.`
          : 'Choose your school in class setup to open your result sheet.',
      );
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

  const handleOpenDeclaredResult = (item: DeclaredResultItem) => {
    if (item.fileUrl.endsWith('.pdf')) {
      router.push({
        pathname: '/pdf',
        params: {
          id: registerDocument(item.fileUrl, item.title),
          title: item.title,
        },
      });
    } else {
      void Linking.openURL(item.fileUrl);
    }
  };

  const handleOpenPrefilledPortal = async () => {
    const opened = await openResultPortalWithParams({
      rollNo: rollQuery,
      session: selectedSession,
      dob: dobQuery,
    });
    if (!opened) {
      setToastMessage('Could not launch the university result portal.');
      setToastVisible(true);
    }
  };

  const handleOpenDirectGateway = async () => {
    try {
      const url = buildGbuDirectResultUrl({
        rollNo: rollQuery,
        session: selectedSession,
      });
      await Linking.openURL(url);
    } catch {
      setToastMessage('Could not launch GBU Direct Gateway.');
      setToastVisible(true);
    }
  };

  const handleToggleReminder = async (val: boolean) => {
    setAdmitCardReminder(val);
    if (!val) {
      await cancelAdmitCardReminder();
      setToastMessage('Admit card reminder turned off');
      setToastVisible(true);
      return;
    }
    // The copy promises a notification 48 hours before the exam, so the
    // reminder has to be scheduled - not just remembered in a switch.
    if (!nextExam) {
      setToastMessage('There is no exam in your date sheet to remind you about yet.');
      setToastVisible(true);
      return;
    }
    const scheduled = await scheduleAdmitCardReminder(
      nextExam.examDate,
      nextExam.subjectCode,
    );
    setToastMessage(
      scheduled
        ? `Admit card reminder set for 48 hours before ${new Date(nextExam.examDate).toLocaleDateString('en-IN')}`
        : 'The admit card reminder could not be scheduled. Allow notifications and try again.',
    );
    setToastVisible(true);
  };

  const handleQueryPortal = () => {
    setPortalGatewayVisible(true);
    if (matchingResult) {
      setToastMessage(`Found result batch for ${matchingResult.programme} Sem ${matchingResult.semester}!`);
    } else {
      setToastMessage(`Direct result gateway ready for Roll ${rollQuery}`);
    }
    setToastVisible(true);
  };

  const handleToggleBatchWatch = async (val: boolean) => {
    setBatchWatch(val);
    await AsyncStorage.setItem(BATCH_WATCH_STORAGE_KEY, val ? 'true' : 'false').catch(() => {});
    if (!val) {
      setToastMessage('Batch result alerts turned off');
      setToastVisible(true);
      return;
    }
    if (matchingResult && isMatchingResultLive) {
      const notified = await notifyBatchResultDeclared(matchingResult);
      setToastMessage(
        notified
          ? `Result for ${matchingResult.programme} Sem ${matchingResult.semester || semester} is declared! Notification sent.`
          : `Result for ${matchingResult.programme} Sem ${matchingResult.semester || semester} is declared! View below.`,
      );
    } else {
      // The bundled sample is not a declaration, so it never raises a
      // notification.
      setToastMessage(
        `Watching ${programmeCode} Sem ${semester}. You will receive a notification when the university declares the result.`,
      );
    }
    setToastVisible(true);
  };

  /**
   * The batch watch: a declaration the university publishes for this
   * student's batch raises exactly one notification.
   *
   * The first run only records the baseline, so the student is not notified
   * about everything that was published before the watch was switched on.
   * A bundled sample row is never a declaration and never notifies.
   */
  const batchBaselineTaken = useRef(false);
  useEffect(() => {
    if (!batchWatch || !school) return;
    const list = (declaredResults || []).filter((r) => r.isSample !== true);
    if (list.length === 0) return;

    let cancelled = false;
    void (async () => {
      const seen = await loadSeenDeclaredResultIds();
      if (cancelled) return;
      const ids = list.map((r) => r.id);
      if (!batchBaselineTaken.current) {
        batchBaselineTaken.current = true;
        await saveSeenDeclaredResultIds([...seen, ...ids]);
        return;
      }
      const student = {
        programmeCode,
        programmeName: classSelection?.programme,
        school,
        semester,
        selectedSession,
      };
      const fresh = list.filter((r) => !seen.includes(r.id) && matchesStudentBatch(r, student));
      for (const item of fresh) {
        await notifyBatchResultDeclared(item);
      }
      await saveSeenDeclaredResultIds([...seen, ...ids]);
    })();

    return () => {
      cancelled = true;
    };
  }, [batchWatch, school, declaredResults, programmeCode, classSelection?.programme, semester, selectedSession]);


  // Load persisted results watch preference for the student's school
  useEffect(() => {
    let active = true;
    if (school) {
      loadSchoolWatchPreference(school)
        .then((saved) => {
          if (active && saved) {
            setResultsWatch(true);
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [school]);

  // Schedule periodic check when watch is enabled, stop on toggle off or unmount.
  // The first check runs straight away, so a sheet that was re-published while
  // the app was closed is noticed without waiting a full interval.
  useEffect(() => {
    if (!resultsWatch || !school) {
      stopPeriodicResultsCheck();
      return;
    }
    const cancel = schedulePeriodicResultsCheck(school);
    void checkSchoolResults(school, { notify: true });
    return () => {
      cancel();
    };
  }, [resultsWatch, school]);

  /**
   * Watches the published sheet for the student's school. The first look only
   * records a baseline; a later look alerts when the sheet's revision moves,
   * which is how a newly published or re-checked result shows up. Nothing is
   * sent to GBU One, and no portal password is involved.
   */
  const handleToggleResultsWatch = async (val: boolean) => {
    if (!school) {
      setResultsWatch(false);
      setToastMessage('Choose your school in class setup, then result alerts can watch it.');
      setToastVisible(true);
      return;
    }

    setResultsWatch(val);
    await saveSchoolWatchPreference(school, val);

    if (!val) {
      stopPeriodicResultsCheck();
      setToastMessage('Result alerts turned off');
      setToastVisible(true);
      return;
    }

    schedulePeriodicResultsCheck(school);
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
            {/* Exam Phase Toggle (End Sem, Practicals, Back Papers, Mid Sem) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.phaseScroll}>
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
                  examPhase === 'practicals' && { backgroundColor: colors.accentFill },
                ]}
                onPress={() => setExamPhase('practicals')}
              >
                <Text
                  style={[
                    styles.phaseToggleText,
                    { color: colors.textSecondary },
                    examPhase === 'practicals' && { color: colors.onAccent, fontFamily: 'Inter-Bold' },
                  ]}
                >
                  Practicals (30 Nov - 4 Dec)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.phaseToggleBtn,
                  examPhase === 'back' && { backgroundColor: colors.accentFill },
                ]}
                onPress={() => setExamPhase('back')}
              >
                <Text
                  style={[
                    styles.phaseToggleText,
                    { color: colors.textSecondary },
                    examPhase === 'back' && { color: colors.onAccent, fontFamily: 'Inter-Bold' },
                  ]}
                >
                  Back Papers (7-12 Dec)
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
                  Mid Sem
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Exam Countdown Card */}
            <GlassCard style={[styles.countdownCard, { backgroundColor: colors.accentSoft }]} accentBorder>
              <View style={styles.countdownRow}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                    <Text style={[styles.countdownBadge, { color: colors.accent }]}>
                      {enrolledClassKey.toUpperCase()} • {examPhase === 'mid' ? 'MID SEMESTER' : examPhase === 'end' ? 'END SEMESTER' : examPhase === 'practicals' ? 'PRACTICALS' : 'BACK PAPERS'}
                    </Text>
                  </View>
                  <Text style={[styles.countdownTitle, { color: colors.textPrimary }]}>
                    {examPhase === 'end'
                      ? 'End Semester Theory Exams'
                      : examPhase === 'practicals'
                        ? 'Practical Examinations'
                        : examPhase === 'back'
                          ? 'Back Paper Examinations'
                          : 'Mid Semester Examinations'}
                  </Text>
                  <Text style={[styles.countdownSub, { color: colors.textSecondary }]}>
                    {nextExam
                      ? `${new Date(nextExam.examDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} • ${nextExam.shift} Shift (${nextExam.examTime})`
                      : examPhase === 'end'
                        ? 'Starts Monday, 14 Dec 2026 • GBU Academic Calendar'
                        : examPhase === 'practicals'
                          ? 'Starts Monday, 30 Nov 2026 • Lab Evaluations & Viva'
                          : examPhase === 'back'
                            ? 'Starts Monday, 7 Dec 2026 • University Exam Halls'
                            : 'Conducted 7 Oct - 16 Oct 2026 • GBU Date Sheet'}
                  </Text>
                  {nextExam && (
                    <View style={{ marginTop: 8, padding: 8, borderRadius: 8, backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: colors.borderGlass }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <Text style={{ fontFamily: 'Inter-Bold', fontSize: 12, color: colors.accent }}>{nextExam.subjectCode}</Text>
                        <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 11, color: colors.warning }}>{nextExam.shift.toUpperCase()}</Text>
                      </View>
                      <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12, color: colors.textPrimary }} numberOfLines={1}>{nextExam.subjectName}</Text>
                    </View>
                  )}
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
                  {nextExam ? (
                    countdownState && countdownState.state === 'past' ? (
                      <>
                        <Text style={[styles.countdownNumber, { color: colors.textTertiary, fontSize: 18 }]}>DONE</Text>
                        <Text style={[styles.countdownLabel, { color: colors.textSecondary }]}>COMPLETED</Text>
                      </>
                    ) : countdownDays === 0 ? (
                      <>
                        <Text style={[styles.countdownNumber, { color: colors.danger, fontSize: 18 }]}>TODAY</Text>
                        <Text style={[styles.countdownLabel, { color: colors.textSecondary }]}>{nextExam.shift.toUpperCase()}</Text>
                      </>
                    ) : (
                      <>
                        <CountUp value={countdownDays} style={[styles.countdownNumber, { color: colors.accent }]} />
                        <Text style={[styles.countdownLabel, { color: colors.textSecondary }]}>
                          {countdownDays === 1 ? 'DAY LEFT' : 'DAYS LEFT'}
                        </Text>
                      </>
                    )
                  ) : (
                    <>
                      <Text style={[styles.countdownNumber, { color: colors.success, fontSize: 18 }]}>DONE</Text>
                      <Text style={[styles.countdownLabel, { color: colors.textSecondary }]}>COMPLETED</Text>
                    </>
                  )}
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
                {examPhase === 'end'
                  ? 'End Semester Examination Schedule'
                  : examPhase === 'practicals'
                    ? 'Practical & Viva Examination Schedule'
                    : examPhase === 'back'
                      ? 'Back Paper Examination Schedule'
                      : 'Mid Semester Examination Schedule'}
              </Text>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                {activeDatesheet.length} papers • {enrolledClassKey.toUpperCase()}
              </Text>
            </View>

            {/* The bundled schedule is labelled, so it is never read as the
                university's official date sheet. */}
            {isSampleDatesheet ? (
              <View style={[styles.sampleBadgeRow, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
                <AlertCircle size={14} color={colors.warning} style={{ marginRight: 8 }} />
                <Text style={[styles.sampleBadgeText, { color: colors.textPrimary }]}>
                  Sample schedule. The university&apos;s published date sheet for your class could
                  not be fetched, so these example rows are shown instead.
                </Text>
              </View>
            ) : null}

            {examPhase === 'end' && (
              <View style={[styles.practicalAlertBanner, { backgroundColor: colors.warningSoft }]}>
                <Text style={[styles.practicalAlertText, { color: colors.warning }]}>
                  Notice: Lab / Practical Exams: 30 Nov – 04 Dec • Back Paper: 07 Dec – 12 Dec
                </Text>
              </View>
            )}

            <View style={styles.datesheetList}>
              {activeDatesheet.map((entry, _idx) => {
                const badge = getDaysBadge(entry.examDate);
                return (
                  <GlassCard
                    key={entry.id}
                    style={styles.examEntryCard}
                    accessibilityLabel={`${entry.subjectCode} ${entry.subjectName}, ${
                      new Date(entry.examDate).toLocaleDateString('en-IN', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    }, ${entry.shift} shift, ${entry.examTime}${
                      entry.roomBlock ? `, ${entry.roomBlock}` : ''
                    }${entry.isSample ? ', sample schedule' : ''}`}
                  >
                    <View style={styles.examEntryTop}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <View style={[styles.examEntryCodeBadge, { backgroundColor: subtleBg }]}>
                          <Text style={[styles.examEntryCode, { color: colors.accent }]}>{entry.subjectCode}</Text>
                        </View>
                        {entry.paperId ? (
                          <View style={[styles.examEntryCodeBadge, { backgroundColor: subtleBg }]}>
                            <Text style={[styles.examEntryCode, { color: colors.textSecondary }]}>ID: {entry.paperId}</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={[styles.examShiftBadge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.examShiftText, { color: badge.color }]}>{badge.text}</Text>
                        </View>
                        <View style={styles.examShiftBadge}>
                          <Text style={[styles.examShiftText, { color: colors.warning }]}>{entry.shift.toUpperCase()}</Text>
                        </View>
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
                );
              })}
            </View>
          </>
        ) : (
          <>
            {/* Results Finder Header Card */}
            <GlassCard style={styles.resultsHeaderCard}>
              <View style={styles.resultsHeaderRow}>
                <Award size={22} color={colors.accent} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.resultsHeaderTitle, { color: colors.textPrimary }]}>Result Finder & Portal</Text>
                  <Text style={[styles.resultsHeaderSub, { color: colors.textSecondary }]}>
                    Query the examination portal directly with your credentials, or view official published batch marksheets.
                  </Text>
                </View>
              </View>

              {/* Roll Number Input */}
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

              {/* Session Picker Pills */}
              <View style={{ marginTop: 10 }}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Examination Session</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sessionScroll}>
                  {COMMON_RESULT_SESSIONS.map((sess) => {
                    const isSelected = selectedSession === sess;
                    return (
                      <TouchableOpacity
                        key={sess}
                        onPress={() => setSelectedSession(sess)}
                        style={[
                          styles.sessionPill,
                          { borderColor: subtleBorder, backgroundColor: isSelected ? colors.accentFill : colors.surface },
                        ]}
                      >
                        <Text
                          style={[
                            styles.sessionPillText,
                            { color: isSelected ? colors.onAccent : colors.textSecondary },
                            isSelected && { fontFamily: 'Inter-SemiBold' },
                          ]}
                        >
                          {sess}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* DOB Input (Optional) */}
              <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: subtleBorder, marginTop: 10 }]}>
                <Calendar size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  value={dobQuery}
                  onChangeText={setDobQuery}
                  placeholder="Date of Birth DD/MM/YYYY (optional for portal)"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.searchInput, { color: colors.textPrimary }]}
                  keyboardType="numbers-and-punctuation"
                />
                {dobQuery ? (
                  <TouchableOpacity onPress={() => setDobQuery('')} hitSlop={8}>
                    <X size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Query & PDF Buttons */}
              <PillButton
                label="Check Portal Result"
                onPress={handleQueryPortal}
                variant="primary"
                size="md"
                style={{ marginTop: 12 }}
              />

              <PillButton
                label={`Open ${school || 'School'} Result Sheet (PDF)`}
                onPress={() => handleOpenResultSheet()}
                variant="outline"
                size="md"
                style={{ marginTop: 8 }}
                accessibilityLabel={
                  school
                    ? `Open the published ${school} result sheet as a PDF`
                    : 'Open your school result sheet as a PDF. Choose your school in class setup first.'
                }
              />

              <Text style={[styles.resultsHint, { color: colors.textTertiary }]}>
                Individual student marksheets are secured behind gbuexam.in's visual CAPTCHA verification. We prefill your details for quick access.
              </Text>
            </GlassCard>

            {/* Portal Fallback & Gateway Card */}
            {portalGatewayVisible && (
              <GlassCard style={[styles.gatewayCard, { backgroundColor: colors.accentSoft }]}>
                <View style={styles.gatewayHeader}>
                  <AlertCircle size={20} color={colors.accent} />
                  <Text style={[styles.gatewayTitle, { color: colors.textPrimary }]}>
                    GBU Portal Gateway (gbuexam.in)
                  </Text>
                  <View style={[styles.gatewayBadge, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.gatewayBadgeText, { color: colors.accent }]}>SECURE LOGIN</Text>
                  </View>
                </View>

                <Text style={[styles.gatewayInfo, { color: colors.textSecondary }]}>
                  The university portal requires solving a visual security CAPTCHA to access personal grade cards. Your parameters have been prepared:
                </Text>

                <View style={styles.paramsGrid}>
                  <View style={[styles.paramChip, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.paramChipLabel, { color: colors.textTertiary }]}>ROLL NO</Text>
                    <Text style={[styles.paramChipValue, { color: colors.textPrimary }]}>{rollQuery || 'Not specified'}</Text>
                  </View>
                  <View style={[styles.paramChip, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.paramChipLabel, { color: colors.textTertiary }]}>SESSION</Text>
                    <Text style={[styles.paramChipValue, { color: colors.textPrimary }]}>{selectedSession}</Text>
                  </View>
                  {dobQuery ? (
                    <View style={[styles.paramChip, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.paramChipLabel, { color: colors.textTertiary }]}>DOB</Text>
                      <Text style={[styles.paramChipValue, { color: colors.textPrimary }]}>{dobQuery}</Text>
                    </View>
                  ) : null}
                </View>

                <PillButton
                  label="Open gbuexam.in (Prefilled)"
                  onPress={handleOpenPrefilledPortal}
                  variant="primary"
                  size="md"
                  style={{ marginTop: 10 }}
                />

                <PillButton
                  label="Direct GBU Results Gateway"
                  onPress={handleOpenDirectGateway}
                  variant="outline"
                  size="md"
                  style={{ marginTop: 6 }}
                />

                {matchingResult && (
                  <TouchableOpacity
                    onPress={() => handleOpenDeclaredResult(matchingResult)}
                    style={[styles.matchActionBtn, { backgroundColor: colors.surface }]}
                  >
                    <CheckCircle size={16} color={colors.accent} />
                    <Text style={[styles.matchActionText, { color: colors.accent }]}>
                      Open Official {matchingResult.programme} Sem {matchingResult.semester} PDF
                    </Text>
                  </TouchableOpacity>
                )}
              </GlassCard>
            )}

            {/* Matching Batch Alert Banner if declared. A bundled sample never
                looks like a live announcement. */}
            {matchingResult && (
              <GlassCard style={styles.matchingBannerCard}>
                <View style={styles.matchingBannerRow}>
                  {isMatchingResultLive ? (
                    <Sparkles size={20} color={colors.accent} />
                  ) : (
                    <AlertCircle size={20} color={colors.warning} />
                  )}
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={styles.matchingTagRow}>
                      <Text
                        style={[
                          styles.matchingTag,
                          { color: isMatchingResultLive ? colors.accent : colors.warning },
                        ]}
                      >
                        {isMatchingResultLive ? 'BATCH RESULT DECLARED' : 'SAMPLE RESULT - NOT DECLARED'}
                      </Text>
                    </View>
                    <Text style={[styles.matchingBannerTitle, { color: colors.textPrimary }]}>
                      {matchingResult.title}
                    </Text>
                    <Text style={[styles.matchingBannerDate, { color: colors.textSecondary }]}>
                      {isMatchingResultLive
                        ? `Announced for ${matchingResult.programme} • Sem ${matchingResult.semester}`
                        : `Example row for ${matchingResult.programme} • Sem ${matchingResult.semester}. The university has not declared this.`}
                    </Text>
                  </View>
                </View>
                <PillButton
                  label={isMatchingResultLive ? 'View Official Batch Sheet' : 'Open the published sheet'}
                  onPress={() => handleOpenDeclaredResult(matchingResult)}
                  variant="primary"
                  size="sm"
                  style={{ marginTop: 10 }}
                  accessibilityLabel={
                    isMatchingResultLive
                      ? `Open the official ${matchingResult.programme} semester ${matchingResult.semester} batch sheet`
                      : `Open the published ${matchingResult.programme} result sheet`
                  }
                />
              </GlassCard>
            )}

            {/* Results Watch & Batch Notification Card */}
            <GlassCard style={styles.resultWatchCard}>
              <View style={styles.resultWatchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.resultWatchTitle, { color: colors.textPrimary }]}>
                    School Result Sheet Watch
                  </Text>
                  <Text style={[styles.resultWatchSub, { color: colors.textSecondary }]}>
                    {school
                      ? `Watches the public ${school} result PDF sheet and alerts you when re-published.`
                      : 'Choose your school in class setup to switch this on.'}
                  </Text>
                </View>
                <Switch
                  value={resultsWatch}
                  onValueChange={(val) => void handleToggleResultsWatch(val)}
                  disabled={watching}
                />
              </View>

              <View style={[styles.watchDivider, { backgroundColor: subtleBorder }]} />

              <View style={styles.resultWatchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.resultWatchTitle, { color: colors.textPrimary }]}>
                    Batch Result Announcement Alerts
                  </Text>
                  <Text style={[styles.resultWatchSub, { color: colors.textSecondary }]}>
                    Instant notification when a result announcement for {programmeCode} Sem {semester} is detected.
                  </Text>
                </View>
                <Switch
                  value={batchWatch}
                  onValueChange={handleToggleBatchWatch}
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

            {/* Recently Declared Results Section */}
            <View style={styles.resultSheetsHeader}>
              <Text style={[styles.resultsHeaderTitle, { color: colors.textPrimary }]}>
                Recently Declared Results
              </Text>
              <Text style={[styles.resultsHeaderSub, { color: colors.textSecondary }]}>
                Announcements published on exams.gbu.ac.in and gbuexam.in
              </Text>
            </View>

            {(declaredResults || []).map((item) => {
              const isUserBatch = matchesStudentBatch(item, {
                programmeCode,
                programmeName: classSelection?.programme,
                school,
                semester,
              });
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.declaredItemCard, { backgroundColor: colors.surface, borderColor: subtleBorder }]}
                  onPress={() => handleOpenDeclaredResult(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open result for ${item.title}${
                    item.isSample ? ' (sample data)' : ''
                  }`}
                >
                  <View style={styles.declaredItemTop}>
                    <View style={[styles.progBadge, { backgroundColor: colors.accentSoft }]}>
                      <Text style={[styles.progBadgeText, { color: colors.accent }]}>{item.programme}</Text>
                    </View>
                    {item.semester ? (
                      <View style={[styles.semBadge, { backgroundColor: subtleBg }]}>
                        <Text style={[styles.semBadgeText, { color: colors.textSecondary }]}>Sem {item.semester}</Text>
                      </View>
                    ) : null}
                    {item.isSample ? (
                      <View style={[styles.userBatchTag, { backgroundColor: colors.warningSoft }]}>
                        <Text style={[styles.userBatchTagText, { color: colors.warning }]}>SAMPLE</Text>
                      </View>
                    ) : null}
                    {isUserBatch && item.isSample !== true ? (
                      <View style={[styles.userBatchTag, { backgroundColor: colors.successSoft }]}>
                        <Text style={[styles.userBatchTagText, { color: colors.success }]}>YOUR BATCH</Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={[styles.declaredItemTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                    {item.title}
                  </Text>

                  <View style={styles.declaredItemFooter}>
                    <View style={styles.declaredDateRow}>
                      <Calendar size={12} color={colors.textTertiary} />
                      <Text style={[styles.declaredDateText, { color: colors.textTertiary }]}>
                        {item.postedAt
                          ? new Date(item.postedAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'Recently Published'}
                      </Text>
                    </View>
                    <ExternalLink size={14} color={colors.accent} />
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* The published result sheets, one per school. */}
            <View style={styles.resultSheetsHeader}>
              <Text style={[styles.resultsHeaderTitle, { color: colors.textPrimary }]}>
                Published School Result Sheets
              </Text>
              <Text style={[styles.resultsHeaderSub, { color: colors.textSecondary }]}>
                Official master PDF sheets published by the examination portal for each school.
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
  phaseScroll: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  phaseToggleBtn: {
    paddingHorizontal: 14,
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
  sampleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
  },
  sampleBadgeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    lineHeight: 17,
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
  inputLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sessionScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  sessionPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
  },
  sessionPillText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  gatewayCard: {
    marginTop: theme.spacing.md,
    padding: 14,
    borderWidth: 1,
  },
  gatewayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  gatewayTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    flex: 1,
  },
  gatewayBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gatewayBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  gatewayInfo: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
  },
  paramsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  paramChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    minWidth: 80,
  },
  paramChipLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 9,
  },
  paramChipValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 12,
    marginTop: 1,
  },
  matchActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  matchActionText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  matchingBannerCard: {
    marginTop: theme.spacing.md,
    padding: 14,
  },
  matchingBannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  matchingTagRow: {
    marginBottom: 2,
  },
  matchingTag: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  matchingBannerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
  },
  matchingBannerDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 2,
  },
  watchDivider: {
    height: 1,
    marginVertical: 12,
  },
  declaredItemCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  declaredItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  progBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  progBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
  },
  semBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  semBadgeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
  },
  userBatchTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  userBatchTagText: {
    fontFamily: 'Inter-Bold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  declaredItemTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 18,
  },
  declaredItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  declaredDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  declaredDateText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
  },
});
