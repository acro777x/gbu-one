import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  User,
  GraduationCap,
  LogOut,
  ChevronRight,
  Plus,
  Minus,
  Sparkles,
  Calendar,
  Award,
  Mail,
  Sun,
  Moon,
  Smartphone,
  Compass,
  Pencil,
  ShieldCheck,
  MessageSquare,
  AlertTriangle,
  Send,
  CornerDownRight,
  CheckCircle2,
  Clock,
} from 'lucide-react-native';
import {
  submitStudentReport,
  getLocalReports,
  fetchStudentReports,
  REPORT_CATEGORIES,
  type StudentReport,
  type ReportCategory,
} from '../../src/features/reports/reportsService';
import { Avatar, GlassCard, PillButton, SheetOverlay } from '../../src/components/ui';
import { AvatarPicker } from '../../src/components/avatar/AvatarPack';
import { CountUp } from '../../src/components/motion/CountUp';
import { OfficialSeal } from '../../src/components/brand/OfficialSeal';
import { useAuthStore, generateUniqueStudentId } from '../../src/store/useAuthStore';
import {
  useAttendanceStore,
  calculateAttendanceStatus,
} from '../../src/features/attendance/attendanceStore';
import { useAppTheme, ThemeMode } from '../../src/lib/ThemeContext';
import { theme } from '../../src/lib/theme';
import { setTimetablePushEnabled } from '../../src/lib/pushNotifications';

export default function ProfileScreen() {
  const { colors, isDark, themeMode, setThemeMode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user, isGuest, classSelection, updateProfile, logout } = useAuthStore();
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  // Student Issue Reporting & Admin Answers State
  const [isReportSheetOpen, setIsReportSheetOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState<ReportCategory>('Timetable Error');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitLoading, setReportSubmitLoading] = useState(false);
  const [myReports, setMyReports] = useState<StudentReport[]>([]);
  const [reportSuccessMsg, setReportSuccessMsg] = useState('');

  const loadMyReports = useCallback(async () => {
    try {
      const allReports = await fetchStudentReports(
        user?.uniqueStudentId || user?.rollNo,
        user?.email,
      );
      const studentId = user?.uniqueStudentId || user?.rollNo || 'GBU-SCHOLAR';
      const mine = allReports.filter(
        (r) =>
          r.reporterStudentId === studentId ||
          (user?.email && r.reporterEmail === user.email) ||
          r.type === 'general' ||
          r.category === 'PYQ Paper',
      );
      setMyReports(mine);
    } catch {
      // ignore
    }
  }, [user?.uniqueStudentId, user?.rollNo, user?.email]);

  useEffect(() => {
    void loadMyReports();
  }, [loadMyReports]);

  const handleSendReport = async () => {
    if (!reportDetails.trim()) return;
    setReportSubmitLoading(true);
    try {
      const studentId = user?.uniqueStudentId || user?.rollNo || generateUniqueStudentId();
      const studentName = user?.name || 'GBU Student';
      await submitStudentReport({
        type: 'general',
        category: reportCategory,
        reason: reportDetails.trim(),
        reporterName: studentName,
        reporterStudentId: studentId,
        reporterEmail: user?.email,
      });
      setReportDetails('');
      setIsReportSheetOpen(false);
      setReportSuccessMsg('Report submitted! University admin will review and respond here.');
      await loadMyReports();
      setTimeout(() => setReportSuccessMsg(''), 4500);
    } catch {
      // ignore
    } finally {
      setReportSubmitLoading(false);
    }
  };

  // Persistent notification preferences
  const [notifyNotices, setNotifyNotices] = useState(true);
  const [notifyTimetable, setNotifyTimetable] = useState(true);
  const [notifyExams, setNotifyExams] = useState(true);
  const [notifyDeadlines, setNotifyDeadlines] = useState(true);
  const [notifyResults, setNotifyResults] = useState(true);
  const [notifyQuietHours, setNotifyQuietHours] = useState(true);
  const [timetablePushStatus, setTimetablePushStatus] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.multiGet([
      '@gbu_one_notify_notices',
      '@gbu_one_notify_timetable',
      '@gbu_one_notify_exams',
      '@gbu_one_notify_deadlines',
      '@gbu_one_notify_results',
      '@gbu_one_notify_quiet_hours',
    ]).then((pairs) => {
      if (!mounted) return;
      pairs.forEach(([key, val]) => {
        if (val !== null) {
          const parsed = val === 'true';
          if (key === '@gbu_one_notify_notices') setNotifyNotices(parsed);
          if (key === '@gbu_one_notify_timetable') setNotifyTimetable(parsed);
          if (key === '@gbu_one_notify_exams') setNotifyExams(parsed);
          if (key === '@gbu_one_notify_deadlines') setNotifyDeadlines(parsed);
          if (key === '@gbu_one_notify_results') setNotifyResults(parsed);
          if (key === '@gbu_one_notify_quiet_hours') setNotifyQuietHours(parsed);
        }
      });
    }).catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Ensure an offline unique student ID is assigned if student has not been through onboarding
  useEffect(() => {
    if (!user?.uniqueStudentId) {
      void updateProfile({
        uniqueStudentId: generateUniqueStudentId(),
        avatarId: user?.avatarId || 'tech-scholar',
      });
    }
  }, [user?.uniqueStudentId, user?.avatarId, updateProfile]);

  const toggleNotices = (val: boolean) => {
    setNotifyNotices(val);
    AsyncStorage.setItem('@gbu_one_notify_notices', String(val)).catch(() => {});
  };

  const toggleTimetable = (val: boolean) => {
    setNotifyTimetable(val);
    AsyncStorage.setItem('@gbu_one_notify_timetable', String(val)).catch(() => {});
    setTimetablePushEnabled(val, classSelection?.section)
      .then((applied) => {
        setTimetablePushStatus(
          applied
            ? val
              ? `This device now gets timetable changes for ${classSelection?.section || 'your class'}.`
              : 'This device no longer gets timetable changes.'
            : 'Saved on this phone. The switch starts working once this device is registered for university pushes.',
        );
      })
      .catch(() => {
        setTimetablePushStatus(
          'Saved on this phone. The switch starts working once this device is registered for university pushes.',
        );
      });
  };

  const toggleExams = (val: boolean) => {
    setNotifyExams(val);
    AsyncStorage.setItem('@gbu_one_notify_exams', String(val)).catch(() => {});
  };

  const toggleDeadlines = (val: boolean) => {
    setNotifyDeadlines(val);
    AsyncStorage.setItem('@gbu_one_notify_deadlines', String(val)).catch(() => {});
  };

  const toggleResults = (val: boolean) => {
    setNotifyResults(val);
    AsyncStorage.setItem('@gbu_one_notify_results', String(val)).catch(() => {});
  };

  const toggleQuietHours = (val: boolean) => {
    setNotifyQuietHours(val);
    AsyncStorage.setItem('@gbu_one_notify_quiet_hours', String(val)).catch(() => {});
  };

  // Connected local attendance store
  const { subjects, markAttended, markMissed } = useAttendanceStore();
  const totalAttended = subjects.reduce((acc, s) => acc + s.attended, 0);
  const totalClasses = subjects.reduce((acc, s) => acc + s.total, 0);
  const overallStatus = calculateAttendanceStatus(totalAttended, totalClasses, 75);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const handleThemeChange = (mode: ThemeMode) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // ignore
      }
    }
    setThemeMode(mode);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(120, 100 + insets.bottom) }]} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity
            style={styles.avatarTouchTarget}
            onPress={() => setIsAvatarPickerOpen(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Edit avatar persona"
          >
            <Avatar
              url={user?.avatarUrl}
              avatarId={user?.avatarId || 'tech-scholar'}
              name={user?.name}
              isGuest={isGuest && !user?.avatarId && !user?.name}
              size={80}
            />
            <View style={[styles.editAvatarBadge, { backgroundColor: colors.accent, borderColor: colors.surface }]}>
              <Pencil size={12} color={colors.onAccent} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsAvatarPickerOpen(true)}
            hitSlop={8}
            style={styles.editAvatarPill}
            accessibilityRole="button"
            accessibilityLabel="Edit avatar persona"
          >
            <Sparkles size={12} color={colors.accent} />
            <Text style={[styles.editAvatarText, { color: colors.accent }]}>Edit Avatar</Text>
          </TouchableOpacity>

          <Text style={[styles.userName, { color: colors.textPrimary }]}>
            {isGuest && !user?.name ? 'Guest Student' : (user?.name || 'Guest Student')}
          </Text>
          <Text style={[styles.userRoll, { color: colors.textSecondary }]}>
            {isGuest ? 'Guest Mode' : user?.rollNo}
          </Text>

          {/* Unique Student ID Badge */}
          <View
            style={[
              styles.uniqueIdBadge,
              { backgroundColor: colors.accentSoft, borderColor: colors.accent },
            ]}
          >
            <ShieldCheck size={13} color={colors.accent} />
            <Text style={[styles.uniqueIdText, { color: colors.accent }]}>
              {user?.uniqueStudentId || 'GBU-XXXXXX'}
            </Text>
          </View>

          {/* Chips */}
          <View style={styles.chipRow}>
            <View style={[styles.badgeChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.surfaceMuted }]}>
              <Text style={[styles.badgeChipText, { color: colors.textSecondary }]}>{classSelection?.school || 'SOICT'}</Text>
            </View>
            <View style={[styles.badgeChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.surfaceMuted }]}>
              <Text style={[styles.badgeChipText, { color: colors.textSecondary }]}>{classSelection?.programmeCode || 'BCS'} Sem {classSelection?.semester || 'II'}</Text>
            </View>
            <View style={[styles.badgeChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.surfaceMuted }]}>
              <Text style={[styles.badgeChipText, { color: colors.textSecondary }]}>{classSelection?.section || 'Sec B'}</Text>
            </View>
          </View>
        </View>

        {/* Theme & Appearance Switcher */}
        <GlassCard style={styles.card}>
          <Text style={[styles.cardSectionHeader, { color: colors.textPrimary }]}>Appearance & Theme</Text>
          <Text style={[styles.themeDescription, { color: colors.textSecondary }]}>
            {themeMode === 'system'
              ? `System Default (Currently ${isDark ? 'Dark' : 'Light'})`
              : themeMode === 'light'
                ? 'Always Light Theme'
                : 'Always Dark Theme'}
          </Text>

          <View style={[styles.themeSegmentContainer, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderGlass }]}>
            {/* System Segment */}
            <TouchableOpacity
              style={[
                styles.themeSegment,
                themeMode === 'system' && [styles.themeSegmentActive, { backgroundColor: colors.surface }],
              ]}
              onPress={() => handleThemeChange('system')}
              activeOpacity={0.8}
            >
              <Smartphone size={16} color={themeMode === 'system' ? colors.accent : colors.textSecondary} />
              <Text
                style={[
                  styles.themeSegmentText,
                  { color: themeMode === 'system' ? colors.accent : colors.textSecondary },
                ]}
              >
                System
              </Text>
            </TouchableOpacity>

            {/* Light Segment */}
            <TouchableOpacity
              style={[
                styles.themeSegment,
                themeMode === 'light' && [styles.themeSegmentActive, { backgroundColor: colors.surface }],
              ]}
              onPress={() => handleThemeChange('light')}
              activeOpacity={0.8}
            >
              <Sun size={16} color={themeMode === 'light' ? colors.accent : colors.textSecondary} />
              <Text
                style={[
                  styles.themeSegmentText,
                  { color: themeMode === 'light' ? colors.accent : colors.textSecondary },
                ]}
              >
                Light
              </Text>
            </TouchableOpacity>

            {/* Dark Segment */}
            <TouchableOpacity
              style={[
                styles.themeSegment,
                themeMode === 'dark' && [styles.themeSegmentActive, { backgroundColor: colors.surface }],
              ]}
              onPress={() => handleThemeChange('dark')}
              activeOpacity={0.8}
            >
              <Moon size={16} color={themeMode === 'dark' ? colors.accent : colors.textSecondary} />
              <Text
                style={[
                  styles.themeSegmentText,
                  { color: themeMode === 'dark' ? colors.accent : colors.textSecondary },
                ]}
              >
                Dark
              </Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* Guest CTA Card if applicable */}
        {isGuest && (
          <GlassCard style={styles.guestCtaCard} accentBorder>
            <Text style={[styles.guestCtaTitle, { color: colors.textPrimary }]}>Create an Account</Text>
            <Text style={[styles.guestCtaSubtitle, { color: colors.textSecondary }]}>
              Sign up with your student email to unlock PYQ uploads, cloud sync, and personalised push alerts.
            </Text>
            <PillButton
              label="Sign up / Log in"
              onPress={() => router.push('/login')}
              variant="primary"
              size="sm"
              style={{ marginTop: 12 }}
            />
          </GlassCard>
        )}

        {/* Attendance Tracker Card */}
        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Attendance Tracker (Local)</Text>
            <Text style={[styles.attendanceTarget, { color: colors.accent }]}>75% Target</Text>
          </View>

          <View style={styles.attendanceRow}>
            <View style={styles.attendancePercentCol}>
              <CountUp value={overallStatus.percentage} decimals={1} suffix="%" style={{ ...styles.attendanceNum, color: colors.textPrimary }} />
              <Text style={[styles.attendanceRatio, { color: colors.textSecondary }]}>
                {totalAttended} / {totalClasses} classes attended
              </Text>
              <Text style={[styles.attendanceProjection, overallStatus.isShortage ? { color: colors.danger } : { color: colors.success }]}>
                {overallStatus.isShortage
                  ? `Shortage: Attend next ${overallStatus.classesNeededFor75} classes to hit 75%`
                  : `Safe: Can miss ${overallStatus.canBunkMargin} classes and stay >= 75%`}
              </Text>
            </View>
          </View>

          {/* Subject-wise Quick Adjusters */}
          <View style={[styles.subjectList, { borderTopColor: colors.divider }]}>
            {subjects.map((sub) => {
              const subStatus = calculateAttendanceStatus(sub.attended, sub.total, 75);
              return (
                <View key={sub.subjectCode} style={styles.subjectRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.subjectName, { color: colors.textPrimary }]}>{sub.subjectCode} - {sub.subjectName}</Text>
                    <Text style={[styles.subjectSub, { color: colors.textSecondary }]}>
                      {sub.attended}/{sub.total} ({subStatus.percentage.toFixed(0)}%)
                    </Text>
                  </View>
                  <View style={styles.subjectBtns}>
                    <TouchableOpacity
                      style={[styles.subBtn, { backgroundColor: colors.successSoft }]}
                      onPress={() => markAttended(sub.subjectCode)}
                      hitSlop={6}
                    >
                      <Plus size={14} color={colors.success} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.subBtn, { backgroundColor: colors.dangerSoft }]}
                      onPress={() => markMissed(sub.subjectCode)}
                      hitSlop={6}
                    >
                      <Minus size={14} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </GlassCard>

        {/* Academic Hubs Links */}
        <GlassCard style={styles.card}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/exams')}
          >
            <View style={styles.settingIconCol}>
              <Award size={20} color={colors.accent} />
            </View>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Examination Hub & Results</Text>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>Date sheet, admit card alerts, on-device roll finder</Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.settingDivider, { backgroundColor: colors.divider }]} />

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/calendar')}
          >
            <View style={styles.settingIconCol}>
              <Calendar size={20} color={colors.accent} />
            </View>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Academic Calendar & Holidays</Text>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>2026-27 semester milestones, exams & vacations</Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.settingDivider, { backgroundColor: colors.divider }]} />

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/mail')}
          >
            <View style={styles.settingIconCol}>
              <Mail size={20} color={colors.accent} />
            </View>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>GBU Webmail & Dispatch</Text>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>Official student mailbox, deans & placement circulars</Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.settingDivider, { backgroundColor: colors.divider }]} />

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/events')}
          >
            <View style={styles.settingIconCol}>
              <Sparkles size={20} color={colors.accent} />
            </View>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Campus Events & Fests</Text>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>Abhivyanjana, Shauryautsav, hackathons & club activities</Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </GlassCard>

        {/* My Class Settings */}
        <GlassCard style={styles.card}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/class-setup')}
          >
            <View style={styles.settingIconCol}>
              <GraduationCap size={20} color={colors.accent} />
            </View>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>My Class & Department</Text>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
                {classSelection?.section || 'BCS-II B'} ({classSelection?.school || 'SOICT'})
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </GlassCard>

        {/* App Tour / Onboarding link */}
        <GlassCard style={styles.card}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/onboarding')}
          >
            <View style={styles.settingIconCol}>
              <Compass size={20} color={colors.accent} />
            </View>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Welcome Tour & Onboarding</Text>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>Review introductory feature walk-through</Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </GlassCard>

        {/* Notification Preferences */}
        <GlassCard style={styles.card}>
          <Text style={[styles.cardSectionHeader, { color: colors.textPrimary }]}>Notification Preferences</Text>
          <Text style={[styles.prefDescription, { color: colors.textSecondary }]}>
            Timetable changes re-target this device straight away. Notices, exams, deadlines,
            results and quiet hours are saved on this phone only - the university push service
            does not read them yet, so they do not stop any push.
          </Text>

          <PreferenceRow
            label="Notices (by category)"
            hint="Important and general university notices"
            value={notifyNotices}
            onChange={toggleNotices}
          />

          <PreferenceRow
            label="Timetable changes"
            hint="Room and time changes for your class"
            value={notifyTimetable}
            onChange={toggleTimetable}
            status={timetablePushStatus}
          />

          <PreferenceRow
            label="Exam and date sheet"
            hint="Date sheet and exam schedule alerts"
            value={notifyExams}
            onChange={toggleExams}
          />

          <PreferenceRow
            label="Deadlines"
            hint="Fee submission and other deadlines"
            value={notifyDeadlines}
            onChange={toggleDeadlines}
          />

          <PreferenceRow
            label="Results"
            hint="Result postings and admit cards"
            value={notifyResults}
            onChange={toggleResults}
          />

          <PreferenceRow
            label="Quiet hours"
            hint="Pause non-urgent pushes between 23:00 and 07:00"
            value={notifyQuietHours}
            onChange={toggleQuietHours}
            last
          />
        </GlassCard>

        {/* Dev Motion Playground Link */}
        {__DEV__ && (
          <GlassCard style={styles.card}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => router.push('/dev/motion' as never)}
            >
              <View style={styles.settingIconCol}>
                <Sparkles size={20} color={colors.accent} />
              </View>
              <View style={styles.settingTextCol}>
                <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Motion Playground</Text>
                <Text style={[styles.settingValue, { color: colors.textSecondary }]}>Test UI-thread animations, TypeWriter, LetterRise</Text>
              </View>
              <ChevronRight size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </GlassCard>
        )}

        {/* Student Reports & Admin Feedback Section */}
        <GlassCard style={styles.card} variant="elevated">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={20} color={colors.accent} />
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Report Issue & Support</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsReportSheetOpen(true)}
              style={{
                backgroundColor: colors.accent,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
              }}
            >
              <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 12, color: '#FFFFFF' }}>
                + New Report
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.settingValue, { color: colors.textSecondary, marginBottom: 12 }]}>
            Report wrong timetables, missing notices, syllabus errors, or PYQ paper issues. University admin reviews and responds directly here.
          </Text>

          {Boolean(reportSuccessMsg) && (
            <View style={{ backgroundColor: colors.successSoft, padding: 10, borderRadius: 8, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={16} color={colors.success} />
              <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12, color: colors.success, flex: 1 }}>
                {reportSuccessMsg}
              </Text>
            </View>
          )}

          {/* List of Student's Reports and Admin Answers */}
          {myReports.length === 0 ? (
            <View style={{ paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textTertiary, textAlign: 'center' }}>
                No active reports. Found a discrepancy or issue in the app? Tap "+ New Report" above.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10, marginTop: 4 }}>
              <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 12, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Your Submitted Reports ({myReports.length})
              </Text>
              {myReports.slice(0, 5).map((rep) => {
                const isResolved = rep.status === 'resolved';
                const isDismissed = rep.status === 'dismissed';

                return (
                  <View
                    key={rep.id}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: isResolved ? colors.success : colors.borderGlass,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontFamily: 'Inter-Bold', fontSize: 12, color: colors.accent }}>
                        {rep.category}
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 12,
                          backgroundColor: isResolved
                            ? colors.successSoft
                            : isDismissed
                            ? 'rgba(148, 163, 184, 0.15)'
                            : 'rgba(245, 158, 11, 0.15)',
                        }}
                      >
                        {isResolved ? (
                          <CheckCircle2 size={11} color={colors.success} />
                        ) : isDismissed ? (
                          <Clock size={11} color={colors.textTertiary} />
                        ) : (
                          <Clock size={11} color="#F59E0B" />
                        )}
                        <Text
                          style={{
                            fontFamily: 'Inter-SemiBold',
                            fontSize: 10.5,
                            color: isResolved
                              ? colors.success
                              : isDismissed
                              ? colors.textTertiary
                              : '#F59E0B',
                            textTransform: 'capitalize',
                          }}
                        >
                          {rep.status}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12, color: colors.textPrimary, marginTop: 2 }}>
                      {rep.reason}
                    </Text>

                    {Boolean(rep.customNote) && (
                      <Text style={{ fontFamily: 'Inter-Regular', fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                        Note: {rep.customNote}
                      </Text>
                    )}

                    <Text style={{ fontFamily: 'Inter-Regular', fontSize: 10, color: colors.textTertiary, marginTop: 4 }}>
                      Submitted: {new Date(rep.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </Text>

                    {/* Official Admin Response */}
                    {Boolean(rep.adminResponse) && (
                      <View
                        style={{
                          backgroundColor: colors.surface,
                          borderLeftWidth: 3,
                          borderLeftColor: colors.success,
                          padding: 8,
                          borderRadius: 6,
                          marginTop: 8,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                          <CornerDownRight size={12} color={colors.success} />
                          <Text style={{ fontFamily: 'Inter-Bold', fontSize: 11, color: colors.success }}>
                            Admin Answer:
                          </Text>
                        </View>
                        <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textPrimary }}>
                          {rep.adminResponse}
                        </Text>
                        {Boolean(rep.adminResponseAt) && (
                          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 9.5, color: colors.textTertiary, marginTop: 2 }}>
                            {new Date(rep.adminResponseAt!).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </GlassCard>

        {/* Account / Logout */}
        <GlassCard style={styles.card}>
          {!isGuest && (
            <TouchableOpacity style={styles.settingRow} onPress={handleLogout}>
              <View style={styles.settingIconCol}>
                <LogOut size={20} color={colors.danger} />
              </View>
              <View style={styles.settingTextCol}>
                <Text style={[styles.settingTitle, { color: colors.danger }]}>Log Out</Text>
              </View>
              <ChevronRight size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}

          {isGuest && (
            <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/login')}>
              <View style={styles.settingIconCol}>
                <User size={20} color={colors.accent} />
              </View>
              <View style={styles.settingTextCol}>
                <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Switch to Account</Text>
              </View>
              <ChevronRight size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </GlassCard>

        {/* About & Disclaimer */}
        <TouchableOpacity
          style={styles.aboutSection}
          onPress={() => router.push('/about')}
          accessibilityLabel="About GBU One, University Disclaimer & Privacy Policy"
        >
          <OfficialSeal />
          <Text style={[styles.aboutVersion, { color: colors.textSecondary }]}>GBU One v1.0.0</Text>
          <Text style={[styles.aboutDisclaimer, { color: colors.textTertiary }]}>
            Official student app of Gautam Buddha University, Greater Noida (subject to university approval before release). Tap to view full university disclaimer, privacy commitments, and contacts.
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <SheetOverlay
        visible={isAvatarPickerOpen}
        onClose={() => setIsAvatarPickerOpen(false)}
        title="Choose Avatar Persona"
        height={480}
      >
        <View style={styles.pickerSheetBody}>
          <Text style={[styles.pickerSheetHint, { color: colors.textSecondary }]}>
            Select your academic avatar persona. The chosen vector avatar and unique student ID are stored offline.
          </Text>
          <AvatarPicker
            selectedId={user?.avatarId || 'tech-scholar'}
            onSelect={(avatarId) => {
              void updateProfile({ avatarId });
              setIsAvatarPickerOpen(false);
            }}
            size={52}
          />
        </View>
      </SheetOverlay>
      {/* Report an Issue Bottom Sheet */}
      <SheetOverlay
        visible={isReportSheetOpen}
        onClose={() => setIsReportSheetOpen(false)}
        title="Report Issue to University Admin"
        height={540}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
            Select Issue Category:
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {REPORT_CATEGORIES.map((cat) => {
              const active = reportCategory === cat.category;
              return (
                <TouchableOpacity
                  key={cat.category}
                  onPress={() => setReportCategory(cat.category)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 20,
                    backgroundColor: active ? colors.accent : colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: active ? colors.accent : colors.borderGlass,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Inter-SemiBold',
                      fontSize: 12,
                      color: active ? '#FFFFFF' : colors.textPrimary,
                    }}
                  >
                    {cat.category}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
            Describe the problem or discrepancy:
          </Text>
          <TextInput
            value={reportDetails}
            onChangeText={setReportDetails}
            placeholder="e.g. Wednesday 11:30 AM CSE201 room is wrong in timetable, or End-Sem question paper is missing page 2..."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={4}
            style={{
              height: 100,
              borderWidth: 1,
              borderColor: colors.borderGlass,
              borderRadius: 12,
              padding: 12,
              textAlignVertical: 'top',
              color: colors.textPrimary,
              backgroundColor: colors.surfaceAlt,
              fontFamily: 'Inter-Regular',
              fontSize: 13,
              marginBottom: 14,
            }}
          />

          <View style={{ backgroundColor: colors.surfaceAlt, padding: 10, borderRadius: 10, marginBottom: 16 }}>
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 11, color: colors.textTertiary }}>
              Submitting as: {user?.name || 'GBU Student'} (ID: {user?.uniqueStudentId || user?.rollNo || 'GBU-SCHOLAR'})
            </Text>
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
              Your report will sync directly to the GBU One Admin Console.
            </Text>
          </View>

          <PillButton
            label={reportSubmitLoading ? 'Submitting...' : 'Submit Report'}
            variant="primary"
            size="md"
            disabled={reportSubmitLoading || !reportDetails.trim()}
            onPress={handleSendReport}
            icon={<Send size={15} color="#FFFFFF" style={{ marginRight: 6 }} />}
            style={{ width: '100%', opacity: reportSubmitLoading || !reportDetails.trim() ? 0.6 : 1 }}
          />
        </ScrollView>
      </SheetOverlay>
    </SafeAreaView>
  );
}

interface PreferenceRowProps {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
  status?: string | null;
  last?: boolean;
}

function PreferenceRow({
  label,
  hint,
  value,
  onChange,
  status,
  last = false,
}: PreferenceRowProps) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.toggleRow,
        !last && { borderBottomColor: colors.divider },
        last && { borderBottomWidth: 0 },
      ]}
    >
      <View style={styles.toggleTextCol}>
        <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[styles.toggleHint, { color: colors.textSecondary }]}>{hint}</Text>
        {status ? (
          <Text style={[styles.toggleStatus, { color: colors.textSecondary }]}>{status}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.borderStrong, true: colors.accentFill }}
        thumbColor={value ? colors.onAccent : colors.textSecondary}
        ios_backgroundColor={colors.borderStrong}
        accessibilityLabel={label}
        accessibilityHint={hint}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 110,
  },
  profileHeader: {
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
  },
  userName: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    marginTop: 12,
  },
  userRoll: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  badgeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeChipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
  },
  guestCtaCard: {
    marginBottom: theme.spacing.lg,
  },
  guestCtaTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
  },
  guestCtaSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  card: {
    marginBottom: theme.spacing.md,
  },
  themeDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: -6,
    marginBottom: 12,
  },
  themeSegmentContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    gap: 4,
  },
  themeSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  themeSegmentActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  themeSegmentText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
  },
  attendanceTarget: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  attendanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendancePercentCol: {
    flex: 1,
  },
  attendanceNum: {
    fontFamily: 'Poppins-Bold',
    fontSize: 26,
  },
  attendanceRatio: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 2,
  },
  attendanceProjection: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    marginTop: 4,
  },
  subjectList: {
    marginTop: 14,
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 8,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  subjectName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  subjectSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 1,
  },
  subjectBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  subBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingDivider: {
    height: 1,
    marginVertical: 10,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIconCol: {
    marginRight: 12,
  },
  settingTextCol: {
    flex: 1,
  },
  settingTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  settingValue: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 2,
  },
  cardSectionHeader: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    marginBottom: 12,
  },
  prefDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 17,
    marginTop: -6,
    marginBottom: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  toggleTextCol: {
    flex: 1,
  },
  toggleLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  toggleHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  toggleStatus: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  aboutSection: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
  },
  aboutVersion: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    marginBottom: 4,
  },
  aboutDisclaimer: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  avatarTouchTarget: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  editAvatarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  editAvatarText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  uniqueIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8,
  },
  uniqueIdText: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    letterSpacing: 0.8,
  },
  pickerSheetBody: {
    paddingBottom: 24,
  },
  pickerSheetHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
});
