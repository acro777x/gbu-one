/**
 * GBU One — Official Admin Console
 *
 * Dedicated administrative interface for University administrators and student
 * moderators to manage the live student ecosystem:
 *  1. Campus Events & Photo Gallery Publisher (with device gallery upload support)
 *  2. Crowdsourced PYQ Moderation Queue
 *  3. High-Priority Emergency Notice Broadcasts
 *  4. App Version Management & Compulsory Auto-Update Controls
 *
 * Protected by Single Admin Master Passcode Gate.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Image,
  AppState,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import {
  ChevronLeft,
  Calendar,
  CalendarDays,
  FileCheck2,
  ArrowUpCircle,
  PlusCircle,
  Trash2,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Lock,
  Key,
  Image as ImageIcon,
  X,
  Upload,
  Eye,
  BellRing,
  Send,
  FileText,
  Pencil,
  RotateCcw,
  Radio,
  User,
  Mail,
  ShieldCheck,
  MessageSquare,
  ExternalLink,
  AlertCircle,
  CornerDownRight,
  HelpCircle,
} from 'lucide-react-native';
import {
  fetchReportsForAdmin,
  respondToReport,
  type StudentReport,
} from '../../src/features/reports/reportsService';
import { type NoticeItem } from '../../src/features/notices/noticeService';
import {
  publishNoticeToCampus,
  updateNoticeOnCampus,
  deleteNoticeFromCampus,
  revertNoticeBroadcast,
  fetchCloudNotices,
} from '../../src/features/notices/adminNoticesService';
import { GlassCard, PillButton, Toast, Avatar } from '../../src/components/ui';
import {
  listCampusEvents,
  createCampusEvent,
  uploadEventPhoto,
  deleteCampusEvent,
  type CampusEvent,
  type EventCategory,
  EVENT_CATEGORIES,
} from '../../src/features/events/eventsService';
import {
  listPendingPapers,
  applyModeration,
  getPendingPaperUrl,
  type PyqPaperRecord,
} from '../../src/features/pyq/pyqRepository';
import { registerDocument } from '../../src/components/pdf/pdfRegistry';
import {
  checkForAppUpdate,
  publishAppVersion,
  clearAppVersionOverride,
  compareSemver,
  isValidSemver,
  FALLBACK_VERSION_MANIFEST,
  type AppVersionManifest,
} from '../../src/features/updates/versionChecker';
import {
  parseExcelDateSheet,
  buildClassKey,
  dateSlotKey,
  type ExamDateSlot,
} from '../../src/features/exams/examDateSheetParser';
import {
  saveExamDateSlots,
  fetchAdminDateSlots,
  deleteDateSlotByKey,
  uploadDateSheetDocument,
  seedAuthenticSchoolSlots,
} from '../../src/features/exams/adminDateSheetService';
import { useAppTheme } from '../../src/lib/ThemeContext';
import { theme } from '../../src/lib/theme';
import { isAdminApp } from '../../src/lib/appVariant';
import Constants from 'expo-constants';
import { supabase, isSupabaseConfigured } from '../../src/lib/supabase';
import { queryClient, EVENTS_QUERY_KEY, NOTICE_QUERY_KEY } from '../../src/lib/queryClient';
import {
  authenticateAdmin,
  getLockoutState,
  getRemainingLockoutSeconds,
  isLockedOut,
  formatLockoutTime,
  touchAdminSession,
  isSessionExpired,
  clearAdminSession,
  recordAdminAction,
  signOutAdmin,
  checkHasAnyAdmin,
  getCurrentAdminIdentity,
  MAX_ADMIN_ATTEMPTS,
  requestAdminPasswordResetEmail,
  resetAdminPasswordWithEmailCode,
  ADMIN_SESSION_STORAGE_KEY,
  ADMIN_SESSION_TIMEOUT_MS,
  type AdminAuthResult,
} from '../../src/features/admin/adminSecurity';

type AdminTab = 'events' | 'broadcast' | 'datesheet' | 'pyq' | 'reports' | 'version';

export const VERSION_BROADCAST_HISTORY_KEY = '@gbu_one_version_broadcast_history';

/**
 * The version of the running build (from `app.json`).
 *
 * The published "latest version" has to match the build the students can actually
 * download. `eas.json` uses `appVersionSource: "local"`, so the version never changes on
 * its own: publishing a higher number than the shipped APK would leave every student in
 * an endless compulsory-update loop (the installed app keeps reporting the old version).
 * The console therefore publishes the running build version and only lets the admin lower
 * the "minimum supported" threshold.
 */
const BUILD_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function AdminScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!isAdminApp()) {
      router.replace('/(tabs)');
    }
  }, []);

  if (!isAdminApp()) {
    return null;
  }

  // Security Access Gate State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authGateMode, setAuthGateMode] = useState<'sign_in' | 'initial_setup' | 'reset_pin'>('sign_in');
  const [hasExistingAdmins, setHasExistingAdmins] = useState(true);
  // Reports & Feedback State
  const [reportsList, setReportsList] = useState<StudentReport[]>([]);
  const [reportsFilter, setReportsFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [respondingReportId, setRespondingReportId] = useState<string | null>(null);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [isSendingResetCode, setIsSendingResetCode] = useState(false);
  const [resetCodeSentMessage, setResetCodeSentMessage] = useState('');
  const [authenticatedEmail, setAuthenticatedEmail] = useState('');
  const [authenticatedRole, setAuthenticatedRole] = useState('moderator');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isLockedOutState, setIsLockedOutState] = useState(false);
  const [lockoutRemainingSeconds, setLockoutRemainingSeconds] = useState(0);
  const [failedAttemptsCount, setFailedAttemptsCount] = useState(0);

  const [activeTab, setActiveTab] = useState<AdminTab>('events');
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [, setLoading] = useState(false);

  // Events State
  const [eventsList, setEventsList] = useState<CampusEvent[]>([]);
  const [eventTitle, setEventTitle] = useState('');
  const [eventCategory, setEventCategory] = useState<EventCategory>('fest');
  const [eventVenue, setEventVenue] = useState('Main Auditorium & Campus Grounds');
  const [eventDesc, setEventDesc] = useState('');
  const [eventBannerUrl, setEventBannerUrl] = useState('');
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([]);
  const [eventPhotosRaw, setEventPhotosRaw] = useState('');
  const [eventRegUrl, setEventRegUrl] = useState('');

  // Notice Publisher State
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeCategory, setNoticeCategory] = useState<string>('datesheet');
  const [noticeSource, setNoticeSource] = useState<string>('admin');
  const [noticeImportance, setNoticeImportance] = useState<number>(4);
  const [noticeFileUrl, setNoticeFileUrl] = useState('');
  const [noticeDeadline, setNoticeDeadline] = useState('');
  const [adminNoticesList, setAdminNoticesList] = useState<NoticeItem[]>([]);
  const [pickedDocName, setPickedDocName] = useState('');
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [revertingNoticeId, setRevertingNoticeId] = useState<string | null>(null);

  // PYQ Moderation State
  const [pendingPapers, setPendingPapers] = useState<PyqPaperRecord[]>([]);

  // Version Control State
  const [manifestVersion] = useState(BUILD_VERSION);
  const [minSupported, setMinSupported] = useState('1.0.0');
  const [isMandatory, setIsMandatory] = useState(true);
  const [apkDownloadUrl, setApkDownloadUrl] = useState(
    'https://github.com/acro777x/gbu-one',
  );
  const [releaseNotesText, setReleaseNotesText] = useState(
    'Official End Sem datesheet sync\nFull Campus Event photo memories\nAll-department PYQ downloads',
  );
  const [activeReleaseManifest, setActiveReleaseManifest] = useState<AppVersionManifest | null>(null);
  const [versionBroadcastHistory, setVersionBroadcastHistory] = useState<AppVersionManifest[]>([]);
  const [isRevertingRelease, setIsRevertingRelease] = useState(false);

  // Paper Inspection State
  const [inspectingPaper, setInspectingPaper] = useState<PyqPaperRecord | null>(null);
  const [inspectingSignedUrl, setInspectingSignedUrl] = useState<string | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Exam Date Sheet State
  const [adminDateSlots, setAdminDateSlots] = useState<ExamDateSlot[]>([]);
  const [pickedSheetName, setPickedSheetName] = useState('');
  const [sheetPreviewSlots, setSheetPreviewSlots] = useState<ExamDateSlot[]>([]);
  const [isParsingSheet, setIsParsingSheet] = useState(false);
  const [sheetSchool, setSheetSchool] = useState('soict');
  const [sheetExamType, setSheetExamType] = useState<'mid_sem' | 'end_sem' | 'practical'>('mid_sem');
  const [filterClassKey, setFilterClassKey] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'mid_sem' | 'end_sem' | 'practical'>('all');

  // Manual slot entry state
  const [manualProgramme, setManualProgramme] = useState('B. Tech. (CSE) Batch (2025-2029) 3rd Semester');
  const [manualSemester, setManualSemester] = useState('3');
  const [manualDate, setManualDate] = useState('2026-12-14');
  const [manualShift, setManualShift] = useState<'morning' | 'evening'>('morning');
  const [manualShiftTime, setManualShiftTime] = useState('09:30 AM - 12:30 PM');
  const [manualSubjectCode, setManualSubjectCode] = useState('CSE201');
  const [manualSubjectName, setManualSubjectName] = useState('Scientific Computing with Python');
  const [manualPaperId, setManualPaperId] = useState('');
  const [manualIsBack, setManualIsBack] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
  };

  const loadAdminNotices = useCallback(async () => {
    try {
      const res = await fetchCloudNotices();
      setAdminNoticesList(res.notices);
    } catch {
      // ignore
    }
  }, []);

  const loadReports = useCallback(async () => {
    try {
      const reports = await fetchReportsForAdmin();
      setReportsList(reports);
    } catch {
      // ignore
    }
  }, []);

  const handleSendReportResponse = async (reportId: string) => {
    if (!adminReplyText.trim()) {
      showToast('Please type a response message for the student.');
      return;
    }
    setIsSubmittingReply(true);
    try {
      const res = await respondToReport(reportId, adminReplyText.trim(), 'resolved');
      if (res.ok) {
        showToast('Response sent! Student will see resolution in their profile.');
        setRespondingReportId(null);
        setAdminReplyText('');
        await loadReports();
      } else {
        showToast(res.reason || 'Could not send response.');
      }
    } catch {
      showToast('Failed to record response.');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleDismissReport = async (reportId: string) => {
    try {
      const res = await respondToReport(reportId, 'Dismissed by administrator.', 'dismissed');
      if (res.ok) {
        showToast('Report marked as dismissed.');
        await loadReports();
      } else {
        showToast(res.reason || 'Could not dismiss report.');
      }
    } catch {
      showToast('Could not dismiss report.');
    }
  };

  const loadDateSlots = useCallback(async () => {
    try {
      const slots = await fetchAdminDateSlots();
      setAdminDateSlots(slots);
    } catch {
      // ignore
    }
  }, []);

  const loadData = useCallback(async () => {
    touchAdminSession();
    setLoading(true);
    try {
      const events = await listCampusEvents(100);
      setEventsList(events);

      const papers = await listPendingPapers();
      setPendingPapers(papers);

      void loadAdminNotices();
      void loadDateSlots();
      void loadReports();

      const updateInfo = await checkForAppUpdate();
      if (updateInfo.manifest) {
        setActiveReleaseManifest(updateInfo.manifest);
        // `manifestVersion` is intentionally NOT taken from the remote manifest: the
        // published version must stay pinned to the running build (see BUILD_VERSION).
        setMinSupported(updateInfo.manifest.minSupportedVersion);
        setIsMandatory(updateInfo.manifest.isMandatory);
        setApkDownloadUrl(updateInfo.manifest.apkUrl);
        setReleaseNotesText(updateInfo.manifest.releaseNotes.join('\n'));
      }

      try {
        const historyRaw = await AsyncStorage.getItem(VERSION_BROADCAST_HISTORY_KEY);
        if (historyRaw) {
          const parsed = JSON.parse(historyRaw);
          if (Array.isArray(parsed)) {
            setVersionBroadcastHistory(parsed);
          }
        }
      } catch {
        // ignore
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [loadAdminNotices, loadDateSlots, loadReports]);

  const handleSelectTab = (tab: AdminTab) => {
    touchAdminSession();
    setActiveTab(tab);
    if (tab === 'reports') {
      void loadReports();
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      void loadData();
    }
  }, [isAuthenticated, loadData]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'broadcast') {
      void loadAdminNotices();
    }
  }, [isAuthenticated, activeTab, loadAdminNotices]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'datesheet') {
      void loadDateSlots();
    }
  }, [isAuthenticated, activeTab, loadDateSlots]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'reports') {
      void loadReports();
    }
  }, [isAuthenticated, activeTab, loadReports]);

  const checkLockoutStatus = useCallback(async () => {
    const locked = await isLockedOut();
    setIsLockedOutState(locked);
    if (locked) {
      const remaining = await getRemainingLockoutSeconds();
      setLockoutRemainingSeconds(remaining);
    } else {
      setLockoutRemainingSeconds(0);
    }
    const state = await getLockoutState();
    setFailedAttemptsCount(state.failedAttempts);
  }, []);

  useEffect(() => {
    void checkLockoutStatus();
    async function checkSetup() {
      try {
        const hasAdmins = await checkHasAnyAdmin();
        setHasExistingAdmins(hasAdmins);
        if (!hasAdmins) {
          setAuthGateMode('initial_setup');
        } else {
          setAuthGateMode('sign_in');
        }
      } catch {
        // ignore
      }
    }
    void checkSetup();

    async function restoreSession() {
      try {
        // A local timestamp is NOT proof of an admin session: it survives reinstalls and
        // could be forged. The console is only restored when Supabase still reports a live
        // session AND the server confirms the account is on the moderator allowlist.
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData?.session?.user?.email) return;

        const identity = await getCurrentAdminIdentity();
        if (!identity) return;

        // The local inactivity timer still applies on top of the server session.
        const raw = await AsyncStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
        const lastActive = raw ? Number(raw) : 0;
        if (lastActive && Date.now() - lastActive >= ADMIN_SESSION_TIMEOUT_MS) {
          return;
        }

        touchAdminSession();
        setIsAuthenticated(true);
        setAuthenticatedEmail(identity.email);
        setAuthenticatedRole(identity.role);
      } catch {
        // ignore
      }
    }
    void restoreSession();
  }, [checkLockoutStatus]);

  // Live countdown timer for active lockout (uses exact remaining seconds to avoid timer drift)
  useEffect(() => {
    if (!isLockedOutState) return;

    const timer = setInterval(async () => {
      const remaining = await getRemainingLockoutSeconds();
      setLockoutRemainingSeconds(remaining);
      if (remaining <= 0) {
        setIsLockedOutState(false);
        const state = await getLockoutState();
        setFailedAttemptsCount(state.failedAttempts);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isLockedOutState]);

  // Session auto-lock check on app foreground & periodic timer
  useEffect(() => {
    if (!isAuthenticated) return;
    touchAdminSession();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        if (isSessionExpired()) {
          setIsAuthenticated(false);
          clearAdminSession();
          void checkLockoutStatus();
          showToast('Admin session expired after 15 minutes of inactivity.');
        } else {
          touchAdminSession();
        }
      }
    });

    const interval = setInterval(() => {
      if (isSessionExpired()) {
        setIsAuthenticated(false);
        clearAdminSession();
        void checkLockoutStatus();
        showToast('Admin session expired after 15 minutes of inactivity.');
      }
    }, 30000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [isAuthenticated, checkLockoutStatus]);

  // Admin Authentication Handler — Supabase Auth only (email + password).
  const handleSendResetCode = async () => {
    const targetEmail = (adminEmail || '').trim();
    if (!targetEmail) {
      setAuthError('Please enter the email address of your administrator account first.');
      return;
    }
    setIsSendingResetCode(true);
    setAuthError('');
    setResetCodeSentMessage('');
    try {
      const res = await requestAdminPasswordResetEmail(targetEmail);
      if (res.success) {
        setResetCodeSentMessage(res.message || `Verification code sent to ${targetEmail}`);
        showToast('Verification code sent to email!');
      } else {
        setAuthError(res.error || 'Failed to send recovery code.');
        showToast(res.error || 'Failed to send recovery code.');
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Error sending email.');
    } finally {
      setIsSendingResetCode(false);
    }
  };

  const handleUnlockConsole = async () => {
    if (isLockedOutState) {
      showToast(
        `Access Temporarily Locked: Try again in ${formatLockoutTime(lockoutRemainingSeconds)}`,
      );
      return;
    }

    if (authGateMode === 'initial_setup') {
      if (!adminEmail.trim()) {
        setAuthError('Please enter an administrator email address.');
        return;
      }
      if (!adminPassword) {
        setAuthError('Please enter a secure admin password.');
        return;
      }
      if (adminPassword.length < 6) {
        setAuthError('Password must be at least 6 characters.');
        return;
      }
      if (adminPassword !== confirmPassword) {
        setAuthError('Passwords do not match. Please verify.');
        return;
      }
    } else if (authGateMode === 'sign_in') {
      if (!adminEmail.trim()) {
        setAuthError('Please enter your administrator email address.');
        return;
      }
      if (!adminPassword) {
        setAuthError('Please enter your administrator password.');
        return;
      }
    }

    setIsAuthenticating(true);
    setAuthError('');

    let res: AdminAuthResult;
    if (authGateMode === 'reset_pin') {
      if (!resetCode.trim()) {
        setAuthError('Please enter the 6-digit verification code sent to your email.');
        setIsAuthenticating(false);
        return;
      }
      res = await resetAdminPasswordWithEmailCode(
        adminEmail.trim(),
        resetCode.trim(),
        adminPassword,
      );
    } else {
      res = await authenticateAdmin({
        email: adminEmail.trim(),
        password: adminPassword,
        isInitialSetup: authGateMode === 'initial_setup',
      });
    }

    setIsAuthenticating(false);

    if (res.success) {
      setIsAuthenticated(true);
      setAuthenticatedEmail(res.userEmail || adminEmail.trim() || 'Verified Administrator');
      setAuthenticatedRole(res.role || 'moderator');
      setAdminPassword('');
      setConfirmPassword('');
      setAuthError('');
      setIsLockedOutState(false);
      setLockoutRemainingSeconds(0);
      setFailedAttemptsCount(0);
      showToast(
        authGateMode === 'initial_setup'
          ? 'Initial Admin Setup complete! Owner account active.'
          : 'Authenticated successfully via Supabase Auth.'
      );
    } else {
      setAuthError(res.error || 'Access Denied: Authentication failed.');
      showToast(res.error || 'Authentication failed.');
      if (res.lockedOut) {
        setIsLockedOutState(true);
        setLockoutRemainingSeconds(res.lockoutSeconds);
      }
      const state = await getLockoutState();
      setFailedAttemptsCount(state.failedAttempts);
    }
  };

  const handleManualLockConsole = async () => {
    setIsAuthenticated(false);
    setAdminPassword('');
    setConfirmPassword('');
    await signOutAdmin();
    void checkLockoutStatus();
    showToast('Admin console locked and session closed.');
  };

  // Handler: Pick Event Photos from Device Gallery
  const handlePickGalleryPhotos = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const uris = res.assets.map((a) => a.uri).filter(Boolean);
      setGalleryPhotos((prev) => [...prev, ...uris]);
      showToast(`Added ${uris.length} photo${uris.length > 1 ? 's' : ''} from device gallery.`);
    } catch {
      showToast('Could not load photos from device gallery.');
    }
  };

  // Handler: Pick Banner Image from Device Gallery
  const handlePickBannerPhoto = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      setEventBannerUrl(res.assets[0].uri);
      showToast('Banner photo selected from device gallery.');
    } catch {
      showToast('Could not pick banner image.');
    }
  };

  // Handler: Create Event
  const handlePublishEvent = async () => {
    if (!eventTitle.trim()) {
      showToast('Please enter an event title.');
      return;
    }

    setLoading(true);
    showToast('Uploading photos and publishing live event...');

    const urlPhotos = eventPhotosRaw
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http') || u.startsWith('file://') || u.startsWith('content://') || u.startsWith('data:'));

    const allPhotos = [...galleryPhotos, ...urlPhotos];

    try {
      // Verify active authenticated Supabase session
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) {
          // If in offline emergency mode, continue with local cache
        }
      } catch {
        // ignore
      }

      let bannerCdn = eventBannerUrl.trim();
      if (bannerCdn && (bannerCdn.startsWith('file://') || bannerCdn.startsWith('content://'))) {
        bannerCdn = await uploadEventPhoto(bannerCdn);
      }

      const uploadedPhotos: string[] = [];
      for (const p of allPhotos) {
        if (p.startsWith('file://') || p.startsWith('content://')) {
          const cdn = await uploadEventPhoto(p);
          if (cdn) uploadedPhotos.push(cdn);
        } else if (p) {
          uploadedPhotos.push(p);
        }
      }

      const res = await createCampusEvent({
        title: eventTitle.trim(),
        description: eventDesc.trim(),
        category: eventCategory,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000 * 14).toISOString(),
        venue: eventVenue.trim(),
        isFree: true,
        registrationRequired: Boolean(eventRegUrl.trim()),
        registrationUrl: eventRegUrl.trim() || undefined,
        imageUrl: bannerCdn || (uploadedPhotos[0] ?? undefined),
        photos: uploadedPhotos.length > 0 ? uploadedPhotos : (bannerCdn ? [bannerCdn] : []),
        audience: ['all'],
      });

      if (res.ok) {
        showToast('Live event and photo gallery published to all student apps!');
        setEventTitle('');
        setEventDesc('');
        setEventBannerUrl('');
        setGalleryPhotos([]);
        setEventPhotosRaw('');
        setEventRegUrl('');
        void loadData();
        void queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
      } else {
        showToast(res.error || 'Failed to publish event.');
      }
    } catch {
      showToast('Network error while publishing event.');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Delete Event
  const handleDeleteEvent = async (id: string, title: string) => {
    setEventsList((prev) => prev.filter((e) => e.id !== id));
    showToast(`Deleted: "${title}"`);
    const res = await deleteCampusEvent(id);
    if (res.ok) {
      void loadData();
      void queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
    } else {
      showToast(res.error || 'Failed to delete event.');
      void loadData();
    }
  };

  // Handler: Moderate PYQ
  const handleModeratePaper = async (paperId: string, action: 'approve' | 'reject') => {
    const res = await applyModerateAction(paperId, action);
    if (res.ok) {
      showToast(`Paper ${action === 'approve' ? 'approved & published' : 'rejected'}.`);
      void loadData();
    } else {
      showToast(res.reason || 'Moderation action failed.');
    }
  };

  const applyModerateAction = async (paperId: string, action: 'approve' | 'reject') => {
    void recordAdminAction('moderate_pyq', {
      paperId,
      action,
    });
    return applyModeration(paperId, action);
  };

  const getFileExtensionBadge = (filePath: string) => {
    const clean = filePath.split('?')[0];
    const ext = clean.split('.').pop()?.toUpperCase() || 'PDF';
    return ext;
  };

  const handleInspectPaper = async (paper: PyqPaperRecord) => {
    try {
      setInspectLoading(true);
      setInspectingPaper(paper);
      setInspectingSignedUrl(null);
      let targetUrl = paper.fileUrl;
      if (!targetUrl.startsWith('http')) {
        const signed = await getPendingPaperUrl(paper.fileUrl);
        if (signed) targetUrl = signed;
      }
      if (targetUrl.startsWith('http')) {
        setInspectingSignedUrl(targetUrl);
      } else {
        showToast('Storage preview link unavailable.');
      }
    } catch {
      showToast('Could not open paper preview.');
    } finally {
      setInspectLoading(false);
    }
  };

  const handlePickNoticeDoc = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
        ],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const asset = res.assets[0];
      setPickedDocName(asset.name);

      if (asset.uri) {
        showToast(`Selected: ${asset.name}. Attaching...`);
        try {
          const fileExt = asset.name.split('.').pop()?.toLowerCase() || 'pdf';
          const fileName = `admin_notices/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${fileExt}`;
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('pyq-files')
            .upload(fileName, blob, {
              contentType: asset.mimeType || 'application/pdf',
              upsert: true,
            });

          if (!uploadErr && uploadData) {
            const { data: publicUrlData } = supabase.storage
              .from('pyq-files')
              .getPublicUrl(fileName);
            if (publicUrlData?.publicUrl) {
              setNoticeFileUrl(publicUrlData.publicUrl);
              showToast('Document uploaded to cloud storage.');
              return;
            }
          }
        } catch {
          // fallback to uri
        }
        setNoticeFileUrl(asset.uri);
        showToast('Document attached.');
      }
    } catch {
      showToast('Could not pick document.');
    }
  };

  const handlePublishNotice = async () => {
    if (!noticeTitle.trim()) {
      showToast('Please enter a notice headline / title.');
      return;
    }

    setLoading(true);

    try {
      const trimmedTitle = noticeTitle.trim();

      if (editingNoticeId) {
        showToast('Saving notice updates...');
        const res = await updateNoticeOnCampus(editingNoticeId, {
          title: trimmedTitle,
          category: noticeCategory as any,
          importance: noticeImportance,
          fileUrl: noticeFileUrl,
          deadlineAt: noticeDeadline,
        });

        if (res.ok && res.notice) {
          void recordAdminAction('publish_notice', {
            action: 'update_notice',
            id: res.notice.id,
            title: res.notice.title,
            category: res.notice.category,
            importance: res.notice.importance,
          });
          showToast('Notice updated and synced to all devices!');
          setEditingNoticeId(null);
          setNoticeTitle('');
          setNoticeFileUrl('');
          setNoticeDeadline('');
          setPickedDocName('');
          setAdminNoticesList((prev) =>
            prev.map((n) => (n.id === editingNoticeId ? res.notice! : n)),
          );
          void loadAdminNotices();
          void queryClient.invalidateQueries({ queryKey: NOTICE_QUERY_KEY });
        } else {
          showToast(res.error || 'Failed to update notice.');
        }
        return;
      }

      showToast('Publishing notice to student devices...');
      const res = await publishNoticeToCampus({
        title: trimmedTitle,
        category: noticeCategory as any,
        source: noticeSource as any,
        importance: noticeImportance,
        fileUrl: noticeFileUrl,
        deadlineAt: noticeDeadline,
      });

      if (res.ok && res.notice) {
        void recordAdminAction('publish_notice', {
          id: res.notice.id,
          title: res.notice.title,
          category: res.notice.category,
          source: res.notice.source,
          importance: res.notice.importance,
        });
        showToast('Notice published successfully! Visible on student dashboard.');
        setNoticeTitle('');
        setNoticeFileUrl('');
        setNoticeDeadline('');
        setPickedDocName('');
        setAdminNoticesList((prev) => [res.notice!, ...prev]);
        void loadAdminNotices();
        void queryClient.invalidateQueries({ queryKey: NOTICE_QUERY_KEY });
      } else {
        showToast(res.error || 'Failed to publish notice.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error publishing notice.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditNotice = (item: NoticeItem) => {
    setEditingNoticeId(item.id);
    setNoticeTitle(item.cleanTitle || item.title);
    setNoticeCategory(item.category);
    setNoticeImportance(item.importance ?? 4);
    setNoticeFileUrl(item.fileUrl || '');
    setNoticeDeadline(item.deadlineAt || '');
    setPickedDocName(item.fileUrl ? item.fileUrl.split('/').pop() || 'Attached file' : '');
    showToast(`Editing notice: ${item.cleanTitle || item.title}`);
  };

  const handleCancelEditNotice = () => {
    setEditingNoticeId(null);
    setNoticeTitle('');
    setNoticeFileUrl('');
    setNoticeDeadline('');
    setPickedDocName('');
  };

  const handleDeleteNotice = async (noticeId: string) => {
    setAdminNoticesList((prev) => prev.filter((n) => n.id !== noticeId));
    showToast('Notice unpublished successfully.');
    const res = await deleteNoticeFromCampus(noticeId);
    if (res.ok) {
      void recordAdminAction('delete_notice', {
        noticeId,
      });
      void loadAdminNotices();
      void queryClient.invalidateQueries({ queryKey: NOTICE_QUERY_KEY });
    } else {
      showToast(res.error || 'Could not delete notice.');
      void loadAdminNotices();
    }
  };

  const handleConfirmRevertNotice = (item: NoticeItem) => {
    const title = item.cleanTitle || item.title;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm) {
        const confirmed = window.confirm(
          `Are you sure you want to recall "${title}"? This will immediately remove the notice from all student devices.`
        );
        if (confirmed) {
          void handleRevertNotice(item.id);
        }
        return;
      }
    }
    if (typeof Alert !== 'undefined' && Alert?.alert) {
      Alert.alert(
        'Revert Broadcast',
        `Are you sure you want to recall "${title}"? This will immediately remove the notice from all student devices.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Revert Broadcast',
            style: 'destructive',
            onPress: () => void handleRevertNotice(item.id),
          },
        ],
      );
    } else {
      void handleRevertNotice(item.id);
    }
  };

  const handleRevertNotice = async (noticeId: string) => {
    if (revertingNoticeId) return;
    setRevertingNoticeId(noticeId);
    setAdminNoticesList((prev) => prev.filter((n) => n.id !== noticeId));
    try {
      const res = await revertNoticeBroadcast(noticeId);
      if (res.ok) {
        showToast('Notice recalled and removed from student devices.');
        void recordAdminAction('revert_notice', { noticeId });
        void loadAdminNotices();
        void queryClient.invalidateQueries({ queryKey: NOTICE_QUERY_KEY });
      } else {
        showToast(res.error || 'Failed to recall notice.');
        void loadAdminNotices();
      }
    } catch {
      showToast('Error recalling notice.');
      void loadAdminNotices();
    } finally {
      setRevertingNoticeId(null);
    }
  };


  // Exam Date Sheet Handlers
  const handlePickDateSheetFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'application/pdf',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const asset = res.assets[0];
      setPickedSheetName(asset.name);
      setIsParsingSheet(true);
      showToast(`Reading ${asset.name}...`);

      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();

      // Upload to Supabase Storage
      const uploadRes = await uploadDateSheetDocument(asset.uri, asset.name, asset.mimeType);
      const publicUrl = uploadRes.ok ? uploadRes.publicUrl : undefined;
      if (uploadRes.ok) {
        void recordAdminAction('upload_datesheet', {
          action: 'upload_document',
          fileName: asset.name,
          school: sheetSchool,
          examType: sheetExamType,
          publicUrl,
        });
      }

      // Parse with dual-format ingestion engine
      const isPdf = asset.name.toLowerCase().endsWith('.pdf');
      let parsed: ExamDateSlot[] = [];

      if (!isPdf) {
        parsed = parseExcelDateSheet(arrayBuffer, {
          schoolCode: sheetSchool,
          examType: sheetExamType,
          sourceUrl: publicUrl || asset.name,
        });
      }

      if (parsed.length === 0) {
        if (isPdf) {
          showToast(`PDF "${asset.name}" archived to campus storage. Add specific class slots below or load presets.`);
        } else {
          showToast(`Could not extract table grid from ${asset.name}. Check formatting or use presets below.`);
        }
        setSheetPreviewSlots([]);
      } else {
        setSheetPreviewSlots(parsed);
        const distinctClasses = Array.from(new Set(parsed.map((s) => s.classKey)));
        showToast(`Parsed ${parsed.length} slots across ${distinctClasses.length} programmes!`);
      }
    } catch {
      showToast('Error reading date sheet file.');
    } finally {
      setIsParsingSheet(false);
    }
  };

  const handleConfirmPublishSlots = async () => {
    if (sheetPreviewSlots.length === 0) {
      showToast('No slots to publish.');
      return;
    }
    setLoading(true);
    try {
      const res = await saveExamDateSlots(sheetPreviewSlots);
      void recordAdminAction('upload_datesheet', {
        action: 'publish_slots',
        count: res.count,
        school: sheetSchool,
      });
      showToast(`Published ${res.count} exam slots to student apps!`);
      setSheetPreviewSlots([]);
      setPickedSheetName('');
      void loadDateSlots();
    } catch {
      showToast('Failed to save date slots.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManualSlot = async () => {
    if (!manualSubjectCode.trim() || !manualSubjectName.trim()) {
      showToast('Subject Code and Subject Name are required.');
      return;
    }
    const classKey = buildClassKey(manualProgramme, manualSemester);
    const dateIso = manualDate.trim();
    const key = dateSlotKey(
      sheetSchool,
      dateIso,
      manualShift,
      manualSubjectCode.trim(),
      manualSubjectName.trim(),
      classKey,
    );

    const slot: ExamDateSlot = {
      slotKey: key,
      schoolCode: sheetSchool,
      programme: manualProgramme.trim(),
      semester: manualSemester.trim(),
      classKey,
      examDate: dateIso,
      slot: manualShift,
      shiftTime: manualShiftTime.trim(),
      subjectCode: manualSubjectCode.trim().toUpperCase(),
      subjectName: manualSubjectName.trim(),
      paperId: manualPaperId.trim() || undefined,
      examType: sheetExamType,
      isBackPaper: manualIsBack,
    };

    setLoading(true);
    try {
      const res = await saveExamDateSlots([slot]);
      void recordAdminAction('upload_datesheet', {
        action: 'manual_slot',
        subjectCode: slot.subjectCode,
        classKey: slot.classKey,
        examDate: slot.examDate,
        shift: slot.slot,
      });
      showToast(`Exam slot for ${slot.subjectCode} (${classKey}) published! (${res.count} active)`);
      void loadDateSlots();
    } catch {
      showToast('Failed to save manual exam slot.');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedPreset = async (presetType: 'mid_sem' | 'end_sem' | 'practical') => {
    setLoading(true);
    try {
      const count = await seedAuthenticSchoolSlots(presetType);
      showToast(`Seeded ${count} authentic ${presetType.toUpperCase()} exam slots!`);
      void loadDateSlots();
    } catch {
      showToast('Failed to seed preset slots.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDateSlot = async (slotKey: string) => {
    try {
      await deleteDateSlotByKey(slotKey);
      void recordAdminAction('upload_datesheet', {
        action: 'delete_slot',
        slotKey,
      });
      setAdminDateSlots((prev) => prev.filter((s) => s.slotKey !== slotKey));
      showToast('Exam slot deleted.');
    } catch {
      showToast('Failed to delete exam slot.');
    }
  };

  // Handler: Broadcast App Version Update
  const handleBroadcastUpdate = async () => {
    const notes = releaseNotesText
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean);

    const latest = manifestVersion.trim();
    const min = minSupported.trim();

    // Fail closed on nonsense version pairs. An invalid version is ignored by the
    // students' app, and a "minimum supported" above the published version traps every
    // student in an endless compulsory-update loop.
    if (!isValidSemver(latest)) {
      showToast(`Invalid version "${latest}". Use MAJOR.MINOR.PATCH (e.g. 1.2.0).`);
      return;
    }
    if (!isValidSemver(min)) {
      showToast(`Invalid minimum supported version "${min}". Use MAJOR.MINOR.PATCH (e.g. 1.2.0).`);
      return;
    }
    if (compareSemver(min, latest) > 0) {
      showToast(
        `Minimum supported version (${min}) cannot be newer than the published version (${latest}).`,
      );
      return;
    }

    const manifest: AppVersionManifest = {
      platform: 'android',
      latestVersion: latest,
      minSupportedVersion: min,
      isMandatory,
      title: isMandatory ? 'Mandatory GBU One Update' : 'GBU One Update Available',
      message: isMandatory
        ? 'A critical update is required to continue accessing Gautam Buddha University timetable and exam services.'
        : 'A new version with performance improvements and new features is available.',
      releaseNotes: notes.length > 0 ? notes : ['General stability and timetable updates.'],
      apkUrl: apkDownloadUrl.trim() || 'https://github.com/acro777x/gbu-one/releases/latest',
      releasedAt: new Date().toISOString(),
    };

    const res = await publishAppVersion(manifest);
    if (res.ok) {
      setActiveReleaseManifest(manifest);
      setVersionBroadcastHistory((prev) => {
        const next = [manifest, ...prev.filter((p) => p.latestVersion !== manifest.latestVersion)].slice(0, 20);
        AsyncStorage.setItem(VERSION_BROADCAST_HISTORY_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });

      void recordAdminAction('publish_update', {
        version: manifest.latestVersion,
        minSupported: manifest.minSupportedVersion,
        isMandatory,
      });
      showToast(
        res.localOnly
          ? `Saved locally only — cloud publishing is disabled, so students were NOT notified (${manifest.latestVersion}).`
          : `Version manifest broadcast successfully! (${manifest.latestVersion}, Mandatory: ${isMandatory})`,
      );
    } else {
      showToast(res.error || 'Failed to broadcast update.');
    }
  };

  // Handler: Execute Revert / Rollback release to baseline
  const executeRevertRelease = async () => {
    setIsRevertingRelease(true);
    try {
      await clearAppVersionOverride();
      const baselineManifest: AppVersionManifest = {
        ...FALLBACK_VERSION_MANIFEST,
        releasedAt: new Date().toISOString(),
      };
      setActiveReleaseManifest(baselineManifest);
      setMinSupported('1.0.0');
      setIsMandatory(false);
      setApkDownloadUrl('https://github.com/acro777x/gbu-one');
      setReleaseNotesText(baselineManifest.releaseNotes.join('\n'));

      setVersionBroadcastHistory((prev) => {
        const updated = prev.map((item) =>
          item.latestVersion === (activeReleaseManifest?.latestVersion || BUILD_VERSION)
            ? { ...item, isMandatory: false }
            : item
        );
        AsyncStorage.setItem(VERSION_BROADCAST_HISTORY_KEY, JSON.stringify(updated)).catch(() => {});
        return updated;
      });

      void recordAdminAction('revert_update', {
        revertedFrom: activeReleaseManifest?.latestVersion || 'unknown',
      });

      showToast('Release reverted to baseline 1.0.0. Compulsory flags cleared.');
      void loadData();
    } catch {
      showToast('Failed to revert release.');
    } finally {
      setIsRevertingRelease(false);
    }
  };

  const handleConfirmRevertRelease = () => {
    if (Platform.OS === 'web') {
      void executeRevertRelease();
      return;
    }
    Alert.alert(
      'Revert App Release',
      'Roll back to baseline version 1.0.0? This will immediately clear compulsory update flags for all students across the university.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revert to Baseline',
          style: 'destructive',
          onPress: () => void executeRevertRelease(),
        },
      ]
    );
  };

  // Handler: Reset update override
  const handleResetUpdate = async () => {
    await executeRevertRelease();
  };

  // =========================================================================
  // VIEW: SECURITY ACCESS GATE (SINGLE ADMIN RESTRICTION)
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
        <View style={[styles.header, { borderBottomColor: colors.borderGlass }]}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleCol}>
            <View style={styles.roleBadgeRow}>
              <View style={[styles.roleBadge, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.roleBadgeText, { color: colors.accent }]}>RESTRICTED ACCESS</Text>
              </View>
            </View>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Security Verification</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.lockContent}>
          <GlassCard style={styles.lockCard} variant="elevated">
            <View style={[styles.lockIconCircle, { backgroundColor: colors.accentSoft }]}>
              <ShieldAlert size={40} color={colors.accent} />
            </View>
            <Text style={[styles.lockTitle, { color: colors.textPrimary }]}>GBU Admin Console</Text>
            <Text style={[styles.lockSubtitle, { color: colors.textSecondary }]}>
              Central University Administrative Hub. Server-side authenticated via Supabase Auth & public.moderators.
            </Text>

            {/* Lockout Warning Badge with Live Countdown */}
            {isLockedOutState ? (
              <View style={{ marginBottom: 12 }}>
                <View style={[styles.lockoutBadge, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
                  <ShieldAlert size={18} color={colors.danger} />
                  <Text style={[styles.lockoutBadgeText, { color: colors.danger }]}>
                    Access Temporarily Locked: Try again in {formatLockoutTime(lockoutRemainingSeconds)}
                  </Text>
                </View>
                {/* NOTE: there is deliberately NO "clear cooldown" button here. The old
                    "Instant Master PIN Unlock" control reset the lockout without asking for
                    any credential, so anybody standing at the lock screen could clear it and
                    keep guessing. The cooldown now expires on its own. */}
              </View>
            ) : failedAttemptsCount > 0 ? (
              /* Attempts Remaining Warning */
              <View
                style={[
                  styles.attemptsBadge,
                  { backgroundColor: colors.accentSoft, borderColor: colors.accent },
                ]}
              >
                <Lock size={15} color={colors.accent} style={{ marginRight: 6 }} />
                <Text style={[styles.attemptsBadgeText, { color: colors.accent }]}>
                  Attempts remaining: {Math.max(0, MAX_ADMIN_ATTEMPTS - failedAttemptsCount)} of {MAX_ADMIN_ATTEMPTS}
                </Text>
              </View>
            ) : null}

            {/* Mode Selector Tabs */}
            <View style={[styles.authModeTabsRow, { backgroundColor: colors.surfaceAlt }]}>
              <TouchableOpacity
                onPress={() => {
                  setAuthGateMode('sign_in');
                  setAuthError('');
                }}
                style={[
                  styles.authModeTabBtn,
                  authGateMode === 'sign_in' && { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3 },
                ]}
              >
                <Text
                  style={[
                    styles.authModeTabText,
                    { color: authGateMode === 'sign_in' ? colors.accent : colors.textSecondary },
                  ]}
                >
                  Sign In
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setAuthGateMode('reset_pin');
                  setAuthError('');
                }}
                style={[
                  styles.authModeTabBtn,
                  authGateMode === 'reset_pin' && { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3 },
                ]}
              >
                <Text
                  style={[
                    styles.authModeTabText,
                    { color: authGateMode === 'reset_pin' ? colors.accent : colors.textSecondary },
                  ]}
                >
                  Reset Password
                </Text>
              </TouchableOpacity>

              {!hasExistingAdmins && (
                <TouchableOpacity
                  onPress={() => {
                    setAuthGateMode('initial_setup');
                    setAuthError('');
                  }}
                  style={[
                    styles.authModeTabBtn,
                    authGateMode === 'initial_setup' && { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3 },
                  ]}
                >
                  <Text
                    style={[
                      styles.authModeTabText,
                      { color: authGateMode === 'initial_setup' ? colors.accent : colors.textSecondary },
                    ]}
                  >
                    Setup
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.lockForm}>
              {authGateMode === 'sign_in' && (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    Administrator Email *
                  </Text>
                  <TextInput
                    value={adminEmail}
                    onChangeText={(val) => {
                      setAdminEmail(val);
                      setAuthError('');
                    }}
                    placeholder="e.g. admin@gbu.ac.in"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!isLockedOutState && !isAuthenticating}
                    style={[
                      styles.input,
                      {
                        color: colors.textPrimary,
                        borderColor: authError ? colors.danger : colors.borderGlass,
                        backgroundColor: colors.surface,
                        opacity: isLockedOutState ? 0.6 : 1,
                      },
                    ]}
                    returnKeyType="next"
                  />

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                    Administrator Password *
                  </Text>
                  <TextInput
                    value={adminPassword}
                    onChangeText={(val) => {
                      setAdminPassword(val);
                      setAuthError('');
                    }}
                    placeholder="Enter Supabase Auth password"
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry
                    editable={!isLockedOutState && !isAuthenticating}
                    style={[
                      styles.input,
                      {
                        color: colors.textPrimary,
                        borderColor: authError ? colors.danger : colors.borderGlass,
                        backgroundColor: colors.surface,
                        opacity: isLockedOutState ? 0.6 : 1,
                      },
                    ]}
                    onSubmitEditing={handleUnlockConsole}
                    returnKeyType="done"
                  />
                </>
              )}

              {authGateMode === 'reset_pin' && (
                <>
                  <View style={[styles.setupNoticeBox, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                    <ShieldCheck size={16} color={colors.accent} />
                    <Text style={[styles.setupNoticeText, { color: colors.accent }]}>
                      Reset Admin Password: Send a free verification code to your email to set a new password.
                    </Text>
                  </View>

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 10 }]}>
                    Authorized Owner Email *
                  </Text>
                  <TextInput
                    value={adminEmail}
                    onChangeText={(val) => {
                      setAdminEmail(val);
                      setAuthError('');
                    }}
                    placeholder="admin@gbu.ac.in"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!isLockedOutState && !isAuthenticating}
                    style={[
                      styles.input,
                      {
                        color: colors.textPrimary,
                        borderColor: authError ? colors.danger : colors.borderGlass,
                        backgroundColor: colors.surface,
                        opacity: isLockedOutState ? 0.6 : 1,
                      },
                    ]}
                    returnKeyType="next"
                  />

                  <TouchableOpacity
                    onPress={handleSendResetCode}
                    disabled={isSendingResetCode || isLockedOutState}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.accentSoft,
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      marginTop: 8,
                      borderWidth: 1,
                      borderColor: colors.accent,
                      opacity: isSendingResetCode ? 0.6 : 1,
                    }}
                  >
                    {isSendingResetCode ? (
                      <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 8 }} />
                    ) : (
                      <Mail size={16} color={colors.accent} style={{ marginRight: 8 }} />
                    )}
                    <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>
                      {isSendingResetCode ? 'Sending Email Code...' : 'Send Verification Code to Email'}
                    </Text>
                  </TouchableOpacity>

                  {resetCodeSentMessage ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, padding: 10, borderRadius: 8, marginTop: 10 }}>
                      <CheckCircle2 size={16} color={colors.accent} style={{ marginRight: 8 }} />
                      <Text style={{ color: colors.textPrimary, fontSize: 12, flex: 1 }}>
                        {resetCodeSentMessage}
                      </Text>
                    </View>
                  ) : null}

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                    Email Verification Code (OTP) *
                  </Text>
                  <TextInput
                    value={resetCode}
                    onChangeText={(val) => {
                      setResetCode(val);
                      setAuthError('');
                    }}
                    placeholder="Enter 6-digit code received on email"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    editable={!isLockedOutState && !isAuthenticating}
                    style={[
                      styles.input,
                      {
                        color: colors.textPrimary,
                        borderColor: authError ? colors.danger : colors.borderGlass,
                        backgroundColor: colors.surface,
                        opacity: isLockedOutState ? 0.6 : 1,
                      },
                    ]}
                    returnKeyType="next"
                  />

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                    New Administrator Password *
                  </Text>
                  <TextInput
                    value={adminPassword}
                    onChangeText={(val) => {
                      setAdminPassword(val);
                      setAuthError('');
                    }}
                    placeholder="Minimum 6 characters"
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry
                    editable={!isLockedOutState && !isAuthenticating}
                    style={[
                      styles.input,
                      {
                        color: colors.textPrimary,
                        borderColor: authError ? colors.danger : colors.borderGlass,
                        backgroundColor: colors.surface,
                        opacity: isLockedOutState ? 0.6 : 1,
                      },
                    ]}
                    returnKeyType="next"
                  />

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                    Confirm New Password *
                  </Text>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={(val) => {
                      setConfirmPassword(val);
                      setAuthError('');
                    }}
                    placeholder="Confirm new password"
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry
                    editable={!isLockedOutState && !isAuthenticating}
                    style={[
                      styles.input,
                      {
                        color: colors.textPrimary,
                        borderColor: authError ? colors.danger : colors.borderGlass,
                        backgroundColor: colors.surface,
                        opacity: isLockedOutState ? 0.6 : 1,
                      },
                    ]}
                    onSubmitEditing={handleUnlockConsole}
                    returnKeyType="done"
                  />
                </>
              )}

{authGateMode === 'initial_setup' && (
                <>
                  <View style={[styles.setupNoticeBox, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                    <ShieldCheck size={16} color={colors.accent} />
                    <Text style={[styles.setupNoticeText, { color: colors.accent }]}>
                      Initial Admin Setup: Registers the university owner in Supabase Auth & public.moderators.
                    </Text>
                  </View>

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 10 }]}>
                    Owner Email Address *
                  </Text>
                  <TextInput
                    value={adminEmail}
                    onChangeText={(val) => {
                      setAdminEmail(val);
                      setAuthError('');
                    }}
                    placeholder="e.g. owner@gbu.ac.in"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!isLockedOutState && !isAuthenticating}
                    style={[
                      styles.input,
                      {
                        color: colors.textPrimary,
                        borderColor: authError ? colors.danger : colors.borderGlass,
                        backgroundColor: colors.surface,
                        opacity: isLockedOutState ? 0.6 : 1,
                      },
                    ]}
                    returnKeyType="next"
                  />

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                    Create Master Password *
                  </Text>
                  <TextInput
                    value={adminPassword}
                    onChangeText={(val) => {
                      setAdminPassword(val);
                      setAuthError('');
                    }}
                    placeholder="Minimum 6 characters"
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry
                    editable={!isLockedOutState && !isAuthenticating}
                    style={[
                      styles.input,
                      {
                        color: colors.textPrimary,
                        borderColor: authError ? colors.danger : colors.borderGlass,
                        backgroundColor: colors.surface,
                        opacity: isLockedOutState ? 0.6 : 1,
                      },
                    ]}
                    returnKeyType="next"
                  />

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                    Confirm Master Password *
                  </Text>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={(val) => {
                      setConfirmPassword(val);
                      setAuthError('');
                    }}
                    placeholder="Confirm master password"
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry
                    editable={!isLockedOutState && !isAuthenticating}
                    style={[
                      styles.input,
                      {
                        color: colors.textPrimary,
                        borderColor: authError ? colors.danger : colors.borderGlass,
                        backgroundColor: colors.surface,
                        opacity: isLockedOutState ? 0.6 : 1,
                      },
                    ]}
                    onSubmitEditing={handleUnlockConsole}
                    returnKeyType="done"
                  />
                </>
              )}

              

              {authError ? (
                <Text style={[styles.authErrorText, { color: colors.danger }]}>{authError}</Text>
              ) : null}

              <PillButton
                label={
                  isLockedOutState
                    ? `Locked (${formatLockoutTime(lockoutRemainingSeconds)})`
                    : isAuthenticating
                    ? 'Authenticating...'
                    : authGateMode === 'initial_setup'
                    ? 'Initialize Owner Account'
                    : authGateMode === 'reset_pin'
                    ? 'Update Password & Sign In'
                    
                    : 'Sign In via Supabase Auth'
                }
                variant="primary"
                size="md"
                disabled={isLockedOutState || isAuthenticating}
                onPress={handleUnlockConsole}
                icon={<Key size={16} color={colors.onAccent} style={{ marginRight: 6 }} />}
                style={{ marginTop: 16, opacity: isLockedOutState || isAuthenticating ? 0.6 : 1 }}
              />

              <PillButton
                label="Return to Student App"
                variant="outline"
                size="md"
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                style={{ marginTop: 10 }}
              />
            </View>
          </GlassCard>
        </ScrollView>

        <Toast
          message={toastMessage}
          visible={toastVisible}
          onDismiss={() => setToastVisible(false)}
        />
      </SafeAreaView>
    );
  }

  // =========================================================================
  // VIEW: UNLOCKED ADMINISTRATIVE CONSOLE
  // =========================================================================
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      {/* Admin Top App Bar */}
      <View style={[styles.header, { borderBottomColor: colors.borderGlass }]}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleCol}>
          <View style={styles.roleBadgeRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>GBU ADMIN CONSOLE</Text>
            </View>
            <View style={styles.liveDot} />
            <Text style={[styles.liveStatusText, { color: colors.textSecondary }]}>
              {authenticatedRole.toUpperCase()} • Server Auth
            </Text>
          </View>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {authenticatedEmail || 'System & Campus Controls'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleManualLockConsole}
          style={[styles.lockBtn, { backgroundColor: colors.surfaceAlt }]}
          accessibilityRole="button"
          accessibilityLabel="Lock Console"
        >
          <Lock size={15} color={colors.accent} />
          <Text style={[styles.lockBtnText, { color: colors.accent }]}>Lock Console</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={loadData}
          style={styles.refreshBtn}
          accessibilityLabel="Refresh live data"
        >
          <RefreshCw size={18} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Admin Tabs */}
      <View style={[styles.tabsRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.adminTabScroll}
        >
          <TouchableOpacity
            onPress={() => handleSelectTab('events')}
            style={[
              styles.adminTabBtn,
              activeTab === 'events'
                ? [
                    styles.adminTabBtnActive,
                    {
                      backgroundColor: isDark ? 'rgba(0,168,150,0.18)' : 'rgba(0,168,150,0.12)',
                      borderColor: colors.accent,
                    },
                  ]
                : { borderColor: 'transparent', backgroundColor: 'transparent' },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'events' }}
            accessibilityLabel="Events management tab"
          >
            <Calendar size={15} color={activeTab === 'events' ? colors.accent : colors.textSecondary} />
            <Text
              style={[
                styles.adminTabText,
                { color: activeTab === 'events' ? colors.accent : colors.textSecondary },
              ]}
            >
              Events
            </Text>
            {eventsList.length > 0 && (
              <View
                style={[
                  styles.tabBadge,
                  {
                    backgroundColor:
                      activeTab === 'events'
                        ? colors.accent
                        : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    { color: activeTab === 'events' ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  {eventsList.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleSelectTab('broadcast')}
            style={[
              styles.adminTabBtn,
              activeTab === 'broadcast'
                ? [
                    styles.adminTabBtnActive,
                    {
                      backgroundColor: isDark ? 'rgba(0,168,150,0.18)' : 'rgba(0,168,150,0.12)',
                      borderColor: colors.accent,
                    },
                  ]
                : { borderColor: 'transparent', backgroundColor: 'transparent' },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'broadcast' }}
            accessibilityLabel="Notices management tab"
          >
            <BellRing size={15} color={activeTab === 'broadcast' ? colors.accent : colors.textSecondary} />
            <Text
              style={[
                styles.adminTabText,
                { color: activeTab === 'broadcast' ? colors.accent : colors.textSecondary },
              ]}
            >
              Notices
            </Text>
            {adminNoticesList.length > 0 && (
              <View
                style={[
                  styles.tabBadge,
                  {
                    backgroundColor:
                      activeTab === 'broadcast'
                        ? colors.accent
                        : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    { color: activeTab === 'broadcast' ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  {adminNoticesList.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleSelectTab('datesheet')}
            style={[
              styles.adminTabBtn,
              activeTab === 'datesheet'
                ? [
                    styles.adminTabBtnActive,
                    {
                      backgroundColor: isDark ? 'rgba(0,168,150,0.18)' : 'rgba(0,168,150,0.12)',
                      borderColor: colors.accent,
                    },
                  ]
                : { borderColor: 'transparent', backgroundColor: 'transparent' },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'datesheet' }}
            accessibilityLabel={`Datesheets tab, ${adminDateSlots.length} slots`}
          >
            <CalendarDays size={15} color={activeTab === 'datesheet' ? colors.accent : colors.textSecondary} />
            <Text
              style={[
                styles.adminTabText,
                { color: activeTab === 'datesheet' ? colors.accent : colors.textSecondary },
              ]}
            >
              Datesheets
            </Text>
            <View
              style={[
                styles.tabBadge,
                {
                  backgroundColor:
                    activeTab === 'datesheet'
                      ? colors.accent
                      : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
                },
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  { color: activeTab === 'datesheet' ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                {adminDateSlots.length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleSelectTab('pyq')}
            style={[
              styles.adminTabBtn,
              activeTab === 'pyq'
                ? [
                    styles.adminTabBtnActive,
                    {
                      backgroundColor: isDark ? 'rgba(0,168,150,0.18)' : 'rgba(0,168,150,0.12)',
                      borderColor: colors.accent,
                    },
                  ]
                : { borderColor: 'transparent', backgroundColor: 'transparent' },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'pyq' }}
            accessibilityLabel={`PYQ moderation tab, ${pendingPapers.length} papers pending`}
          >
            <FileCheck2 size={15} color={activeTab === 'pyq' ? colors.accent : colors.textSecondary} />
            <Text
              style={[
                styles.adminTabText,
                { color: activeTab === 'pyq' ? colors.accent : colors.textSecondary },
              ]}
            >
              PYQ
            </Text>
            <View
              style={[
                styles.tabBadge,
                {
                  backgroundColor:
                    activeTab === 'pyq'
                      ? colors.accent
                      : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
                },
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  { color: activeTab === 'pyq' ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                {pendingPapers.length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleSelectTab('reports')}
            style={[
              styles.adminTabBtn,
              activeTab === 'reports'
                ? [
                    styles.adminTabBtnActive,
                    {
                      backgroundColor: isDark ? 'rgba(0,168,150,0.18)' : 'rgba(0,168,150,0.12)',
                      borderColor: colors.accent,
                    },
                  ]
                : { borderColor: 'transparent', backgroundColor: 'transparent' },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'reports' }}
            accessibilityLabel={`Reports management tab, ${reportsList.filter((r) => r.status === 'pending').length} pending reports`}
          >
            <MessageSquare size={15} color={activeTab === 'reports' ? colors.accent : colors.textSecondary} />
            <Text
              style={[
                styles.adminTabText,
                { color: activeTab === 'reports' ? colors.accent : colors.textSecondary },
              ]}
            >
              Reports
            </Text>
            {reportsList.filter((r) => r.status === 'pending').length > 0 && (
              <View
                style={[
                  styles.tabBadge,
                  {
                    backgroundColor: colors.danger,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    { color: '#FFFFFF' },
                  ]}
                >
                  {reportsList.filter((r) => r.status === 'pending').length}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleSelectTab('version')}
            style={[
              styles.adminTabBtn,
              activeTab === 'version'
                ? [
                    styles.adminTabBtnActive,
                    {
                      backgroundColor: isDark ? 'rgba(0,168,150,0.18)' : 'rgba(0,168,150,0.12)',
                      borderColor: colors.accent,
                    },
                  ]
                : { borderColor: 'transparent', backgroundColor: 'transparent' },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'version' }}
            accessibilityLabel="App update manager tab"
          >
            <ArrowUpCircle size={15} color={activeTab === 'version' ? colors.accent : colors.textSecondary} />
            <Text
              style={[
                styles.adminTabText,
                { color: activeTab === 'version' ? colors.accent : colors.textSecondary },
              ]}
            >
              Update
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        {/* TAB 1: EVENTS & PHOTOS PUBLISHER */}
        {activeTab === 'events' && (
          <View style={styles.tabContent}>
            <GlassCard style={styles.sectionCard} variant="elevated">
              <View style={styles.cardHeaderRow}>
                <Sparkles size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Publish Campus Event</Text>
              </View>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                Add official fests, workshops, and sports tournaments. Changes reflect immediately on all student devices.
              </Text>

              {/* Event Title */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Event Title *</Text>
              <TextInput
                value={eventTitle}
                onChangeText={setEventTitle}
                placeholder="e.g. Abhivyanjana 2026 - Annual Cultural Fest"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
              />

              {/* Category Picker */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.formRow}>
                {EVENT_CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setEventCategory(cat.id as EventCategory)}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: eventCategory === cat.id ? colors.accentSoft : colors.surface,
                        borderColor: eventCategory === cat.id ? colors.accent : colors.borderGlass,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: eventCategory === cat.id ? colors.accent : colors.textSecondary },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Venue */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Venue</Text>
              <TextInput
                value={eventVenue}
                onChangeText={setEventVenue}
                placeholder="e.g. Main Auditorium / Indoor Stadium"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
              />

              {/* Description */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Description</Text>
              <TextInput
                value={eventDesc}
                onChangeText={setEventDesc}
                placeholder="Event description, rules, eligibility and schedule..."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
                style={[styles.textArea, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
              />

              {/* Banner Image URL & Gallery Button */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Event Banner Image</Text>
              <View style={styles.photoActionRow}>
                <TextInput
                  value={eventBannerUrl}
                  onChangeText={setEventBannerUrl}
                  placeholder="HTTPS URL or pick from gallery..."
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.input, { flex: 1, color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
                />
                <TouchableOpacity
                  onPress={handlePickBannerPhoto}
                  style={[styles.galleryPickerBtn, { backgroundColor: colors.surfaceAlt }]}
                  accessibilityLabel="Pick banner from gallery"
                >
                  <Upload size={16} color={colors.accent} />
                  <Text style={[styles.galleryPickerBtnText, { color: colors.accent }]}>Gallery</Text>
                </TouchableOpacity>
              </View>

              {/* Photo Gallery: Gallery Upload + URL inputs */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Event Photo Gallery ({galleryPhotos.length} from gallery)
              </Text>

              <PillButton
                label="Pick Photos from Device Gallery"
                variant="outline"
                size="sm"
                onPress={handlePickGalleryPhotos}
                icon={<ImageIcon size={16} color={colors.accent} style={{ marginRight: 6 }} />}
                style={{ marginBottom: 10 }}
              />

              {/* Thumbnails of Picked Gallery Photos */}
              {galleryPhotos.length > 0 ? (
                <View style={styles.pickedPhotosTray}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickedPhotosScroll}>
                    {galleryPhotos.map((uri, idx) => (
                      <View key={`${uri}-${idx}`} style={styles.pickedPhotoWrapper}>
                        <Image source={{ uri }} style={styles.pickedPhotoThumb} resizeMode="cover" />
                        <TouchableOpacity
                          onPress={() => setGalleryPhotos((prev) => prev.filter((_, i) => i !== idx))}
                          style={styles.removePhotoBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <X size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 4 }]}>
                Additional Photo URLs (One URL per line)
              </Text>
              <TextInput
                value={eventPhotosRaw}
                onChangeText={setEventPhotosRaw}
                placeholder="https://images.unsplash.com/photo-1...\nhttps://images.unsplash.com/photo-2..."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={2}
                style={[styles.textArea, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
              />

              {/* Registration Link */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Registration URL (Optional)</Text>
              <TextInput
                value={eventRegUrl}
                onChangeText={setEventRegUrl}
                placeholder="https://gbu.ac.in/events/register"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
              />

              <PillButton
                label="Publish Live Campus Event"
                variant="primary"
                size="md"
                onPress={handlePublishEvent}
                icon={<PlusCircle size={16} color={colors.onAccent} style={{ marginRight: 6 }} />}
                style={{ marginTop: 14 }}
              />
            </GlassCard>

            {/* List of Published Events */}
            <Text style={[styles.subHeaderTitle, { color: colors.textPrimary }]}>
              Currently Published Events ({eventsList.length})
            </Text>

            {eventsList.map((evt) => (
              <GlassCard key={evt.id} style={styles.eventItemCard} variant="subtle">
                <View style={styles.eventItemTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.eventItemTitle, { color: colors.textPrimary }]}>{evt.title}</Text>
                    <Text style={[styles.eventItemMeta, { color: colors.textSecondary }]}>
                      {evt.venue} • {evt.category} • {evt.photos?.length ?? 0} photos
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteEvent(evt.id, evt.title)}
                    style={styles.deleteBtn}
                    accessibilityLabel={`Delete ${evt.title}`}
                  >
                    <Trash2 size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </GlassCard>
            ))}
          </View>
        )}

        {/* TAB 2: NOTICES & CIRCULARS PUBLISHER */}
        {activeTab === 'broadcast' && (
          <View style={styles.tabContent}>
            <GlassCard style={styles.sectionCard} variant="elevated">
              <View style={styles.cardHeaderRow}>
                <BellRing size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Publish Campus Notice</Text>
              </View>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                Publish official university circulars, datesheets, and notifications. Visible immediately on the student home screen dashboard and notices section.
              </Text>

              {/* Notice Title / Headline */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Notice Headline / Title *</Text>
              <TextInput
                value={noticeTitle}
                onChangeText={setNoticeTitle}
                placeholder="e.g. Schedule for End Semester Theory Examination Autumn 2026"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
              />

              {/* Category Picker */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.formRow}>
                {[
                  { id: 'datesheet', label: 'Date Sheet' },
                  { id: 'exam', label: 'Examination' },
                  { id: 'fees', label: 'Fees' },
                  { id: 'scholarship', label: 'Scholarship' },
                  { id: 'hostel', label: 'Hostel' },
                  { id: 'academic', label: 'Academic' },
                  { id: 'event', label: 'Event' },
                  { id: 'other', label: 'General' },
                ].map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setNoticeCategory(cat.id)}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: noticeCategory === cat.id ? colors.accentSoft : colors.surface,
                        borderColor: noticeCategory === cat.id ? colors.accent : colors.borderGlass,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: noticeCategory === cat.id ? colors.accent : colors.textSecondary },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Portal Source Picker */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Portal Source</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.formRow}>
                {['admin', 'main', 'exams', 'hostel', 'ohms', 'csms', 'daict'].map((src) => (
                  <TouchableOpacity
                    key={src}
                    onPress={() => setNoticeSource(src)}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: noticeSource === src ? colors.accentSoft : colors.surface,
                        borderColor: noticeSource === src ? colors.accent : colors.borderGlass,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: noticeSource === src ? colors.accent : colors.textSecondary },
                      ]}
                    >
                      {src.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Importance Priority */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Importance: {noticeImportance}★ {noticeImportance >= 4 ? '(Hero Banner on Student Home)' : '(Standard Notice)'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <TouchableOpacity
                    key={lvl}
                    onPress={() => setNoticeImportance(lvl)}
                    style={[
                      styles.categoryChip,
                      {
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: noticeImportance === lvl ? colors.accent : colors.surface,
                        borderColor: noticeImportance === lvl ? colors.accent : colors.borderGlass,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: noticeImportance === lvl ? colors.onAccent : colors.textPrimary,
                        fontFamily: 'Inter-Bold',
                        fontSize: 13,
                      }}
                    >
                      {lvl}★
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Document / PDF Link & Picker */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>PDF / Document URL or Attachment</Text>
              <View style={styles.photoActionRow}>
                <TextInput
                  value={noticeFileUrl}
                  onChangeText={setNoticeFileUrl}
                  placeholder="https://.../notice.pdf or pick file"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.input, { flex: 1, color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
                />
                <TouchableOpacity
                  onPress={handlePickNoticeDoc}
                  style={[styles.galleryPickerBtn, { backgroundColor: colors.surfaceAlt }]}
                  accessibilityLabel="Attach document"
                >
                  <Upload size={16} color={colors.accent} />
                  <Text style={[styles.galleryPickerBtnText, { color: colors.accent }]}>Attach</Text>
                </TouchableOpacity>
              </View>
              {pickedDocName ? (
                <Text style={{ fontSize: 12, color: colors.accent, marginTop: 4, fontFamily: 'Inter-Medium' }}>
                  ✓ Attached: {pickedDocName}
                </Text>
              ) : null}

              {/* Action Deadline */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Action Deadline (Optional)</Text>
              <TextInput
                value={noticeDeadline}
                onChangeText={setNoticeDeadline}
                placeholder="YYYY-MM-DD (e.g. 2026-11-20)"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
              />

              <PillButton
                label={editingNoticeId ? 'Save Notice Changes' : 'Publish Notice to Campus'}
                variant="primary"
                size="md"
                onPress={handlePublishNotice}
                icon={
                  editingNoticeId ? (
                    <CheckCircle2 size={16} color={colors.onAccent} style={{ marginRight: 6 }} />
                  ) : (
                    <Send size={16} color={colors.onAccent} style={{ marginRight: 6 }} />
                  )
                }
                style={{ marginTop: 14 }}
              />
              {editingNoticeId ? (
                <PillButton
                  label="Cancel Edit"
                  variant="outline"
                  size="sm"
                  onPress={handleCancelEditNotice}
                  icon={<X size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />}
                  style={{ marginTop: 8 }}
                />
              ) : null}
            </GlassCard>

            {/* Dedicated Scrollable Card: Broadcast History & Active Notices */}
            <GlassCard style={[styles.sectionCard, { marginTop: 16 }]} variant="elevated">
              <View style={styles.cardHeaderRow}>
                <Radio size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Broadcast History & Active Notices ({adminNoticesList.length} Active)
                </Text>
              </View>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                Live circulars and emergency broadcasts active across student devices. Revert any erroneous broadcast to pull it back immediately in real-time.
              </Text>

              {adminNoticesList.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Active Broadcasts</Text>
                  <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                    No broadcast history found. Pushed circulars will appear here with instant recall controls.
                  </Text>
                </View>
              ) : (
                <ScrollView nestedScrollEnabled style={styles.broadcastListScroll} showsVerticalScrollIndicator={true}>
                  {adminNoticesList.map((item) => (
                    <GlassCard key={item.id} style={styles.broadcastHistoryCard} variant="subtle">
                      <View style={styles.broadcastTopRow}>
                        <View style={styles.broadcastBadgesRow}>
                          <View style={[styles.paperBadge, { backgroundColor: colors.accentSoft }]}>
                            <Text style={[styles.paperBadgeText, { color: colors.accent }]}>
                              {item.category.toUpperCase()}
                            </Text>
                          </View>
                          <View style={[styles.sourceBadge, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderGlass, borderWidth: 1 }]}>
                            <Text style={[styles.sourceBadgeText, { color: colors.textSecondary }]}>
                              {item.source.toUpperCase()}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 12, color: colors.accent, fontFamily: 'Inter-Bold' }}>
                            {item.importance}★
                          </Text>
                        </View>

                        <View style={[styles.activeCampusBadge, { backgroundColor: colors.successSoft }]}>
                          <View style={[styles.pulseDot, { backgroundColor: colors.success }]} />
                          <Text style={[styles.activeCampusText, { color: colors.success }]}>
                            ACTIVE ON CAMPUS
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.broadcastItemTitle, { color: colors.textPrimary }]}>
                        {item.cleanTitle || item.title}
                      </Text>

                      <Text style={[styles.broadcastItemMeta, { color: colors.textSecondary }]}>
                        Posted: {new Date(item.postedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • Source: {item.source.toUpperCase()}
                        {item.fileUrl ? ` • ${item.fileType.toUpperCase()}` : ''}
                      </Text>

                      <View style={styles.broadcastActionRow}>
                        <TouchableOpacity
                          onPress={() => handleConfirmRevertNotice(item)}
                          disabled={revertingNoticeId === item.id}
                          style={[
                            styles.revertBroadcastBtn,
                            {
                              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
                              borderColor: colors.danger,
                              opacity: revertingNoticeId === item.id ? 0.6 : 1,
                            },
                          ]}
                          accessibilityLabel={`Revert broadcast ${item.cleanTitle || item.title}`}
                        >
                          <RotateCcw size={14} color={colors.danger} style={{ marginRight: 6 }} />
                          <Text style={[styles.revertBroadcastBtnText, { color: colors.danger }]}>
                            {revertingNoticeId === item.id ? 'Recalling...' : 'Revert / Recall Broadcast'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleStartEditNotice(item)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={[styles.editBroadcastBtn, { borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
                          accessibilityLabel="Edit notice"
                        >
                          <Pencil size={14} color={colors.accent} />
                        </TouchableOpacity>
                      </View>
                    </GlassCard>
                  ))}
                </ScrollView>
              )}
            </GlassCard>
          </View>
        )}

        {/* TAB: EXAM DATE SHEET MANAGEMENT */}
        {activeTab === 'datesheet' && (
          <View style={styles.tabContent}>
            {/* 1. Header Card & Ingestion */}
            <GlassCard style={styles.sectionCard} variant="elevated">
              <View style={styles.cardHeaderRow}>
                <CalendarDays size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Exam Date Sheet Engine</Text>
              </View>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                Ingest official GBU date sheets in Excel (.xlsx, .csv) or PDF format, map class-wise slots, and broadcast directly to student countdown dashboards.
              </Text>

              {/* School & Exam Type Selectors */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>Target School</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.formRow}>
                {[
                  { id: 'soict', label: 'SOICT' },
                  { id: 'soe', label: 'SOE' },
                  { id: 'sobt', label: 'SOBT' },
                  { id: 'som', label: 'SOM' },
                  { id: 'sohss', label: 'SOHSS' },
                  { id: 'soljg', label: 'SOLJG' },
                  { id: 'sobsc', label: 'SOBSC' },
                  { id: 'sovasas', label: 'SOVASAS' },
                ].map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setSheetSchool(s.id)}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: sheetSchool === s.id ? colors.accentSoft : colors.surface,
                        borderColor: sheetSchool === s.id ? colors.accent : colors.borderGlass,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: sheetSchool === s.id ? colors.accent : colors.textSecondary },
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 8 }]}>Examination Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.formRow}>
                {[
                  { id: 'mid_sem' as const, label: 'Mid-Semester' },
                  { id: 'end_sem' as const, label: 'End-Semester' },
                  { id: 'practical' as const, label: 'Practical & Viva' },
                ].map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => setSheetExamType(t.id)}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: sheetExamType === t.id ? colors.accentSoft : colors.surface,
                        borderColor: sheetExamType === t.id ? colors.accent : colors.borderGlass,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: sheetExamType === t.id ? colors.accent : colors.textSecondary },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Upload Document Button */}
              <View style={{ marginTop: 14 }}>
                <PillButton
                  label={isParsingSheet ? 'Processing Date Sheet...' : 'Upload Date Sheet (.xlsx / .csv / .pdf)'}
                  icon={<Upload size={16} color={colors.onAccent} />}
                  onPress={handlePickDateSheetFile}
                  variant="primary"
                />
              </View>

              {pickedSheetName ? (
                <View style={[styles.pickedDocCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderGlass }]}>
                  <FileText size={16} color={colors.accent} />
                  <Text style={[styles.pickedDocText, { color: colors.textPrimary }]} numberOfLines={1}>
                    {pickedSheetName}
                  </Text>
                </View>
              ) : null}

              {/* Preview Section if Parsed */}
              {sheetPreviewSlots.length > 0 && (
                <View style={{ marginTop: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={[styles.fieldLabel, { color: colors.textPrimary, margin: 0 }]}>
                      Extracted Slots Preview ({sheetPreviewSlots.length})
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter-Medium', color: colors.accent }}>
                      {Array.from(new Set(sheetPreviewSlots.map((s) => s.classKey))).length} classes detected
                    </Text>
                  </View>

                  <ScrollView style={{ maxHeight: 220, marginBottom: 12 }}>
                    {sheetPreviewSlots.slice(0, 6).map((slot, idx) => (
                      <View
                        key={slot.slotKey + idx}
                        style={{
                          padding: 10,
                          borderRadius: 8,
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.borderGlass,
                          marginBottom: 6,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ fontFamily: 'Inter-Bold', fontSize: 12, color: colors.accent }}>
                            {slot.subjectCode} • {slot.classKey.toUpperCase()}
                          </Text>
                          <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 11, color: colors.warning }}>
                            {slot.slot.toUpperCase()} ({slot.shiftTime})
                          </Text>
                        </View>
                        <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12, color: colors.textPrimary }} numberOfLines={1}>
                          {slot.subjectName}
                        </Text>
                        <Text style={{ fontFamily: 'Inter-Regular', fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                          {slot.examDate} • {slot.programme}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <PillButton
                        label={`Confirm & Broadcast (${sheetPreviewSlots.length} Slots)`}
                        variant="primary"
                        onPress={handleConfirmPublishSlots}
                      />
                    </View>
                    <PillButton
                      label="Clear"
                      variant="outline"
                      onPress={() => {
                        setSheetPreviewSlots([]);
                        setPickedSheetName('');
                      }}
                    />
                  </View>
                </View>
              )}
            </GlassCard>

            {/* 2. Authentic Presets Card */}
            <GlassCard style={styles.sectionCard} variant="elevated">
              <View style={styles.cardHeaderRow}>
                <Sparkles size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Authentic GBU Presets</Text>
              </View>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                Quick-load verified Gautam Buddha University schedules (B.Tech CSE, AI, IT, BCA, MCA 3rd Sem):
              </Text>

              <View style={{ flexDirection: 'column', gap: 8, marginTop: 10 }}>
                <PillButton
                  label="Seed SOICT Mid-Sem Schedule (Auth Oct 2026)"
                  variant="outline"
                  size="sm"
                  onPress={() => handleSeedPreset('mid_sem')}
                />
                <PillButton
                  label="Seed SOICT End-Sem Theory Schedule (Dec 2026)"
                  variant="outline"
                  size="sm"
                  onPress={() => handleSeedPreset('end_sem')}
                />
                <PillButton
                  label="Seed SOICT Practical / Viva Schedule (Nov-Dec 2026)"
                  variant="outline"
                  size="sm"
                  onPress={() => handleSeedPreset('practical')}
                />
              </View>
            </GlassCard>

            {/* 3. Manual Slot Entry */}
            <GlassCard style={styles.sectionCard} variant="elevated">
              <View style={styles.cardHeaderRow}>
                <PlusCircle size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Manual Exam Slot Entry</Text>
              </View>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                Add individual class exam schedules or back papers directly to the timetable database.
              </Text>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Programme / Course Title *</Text>
              <TextInput
                value={manualProgramme}
                onChangeText={setManualProgramme}
                placeholder="e.g. B. Tech. (CSE) Batch (2025-2029) 3rd Semester"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Semester (e.g. 3)</Text>
                  <TextInput
                    value={manualSemester}
                    onChangeText={setManualSemester}
                    placeholder="3"
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Exam Date (YYYY-MM-DD) *</Text>
                  <TextInput
                    value={manualDate}
                    onChangeText={setManualDate}
                    placeholder="2026-12-14"
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Course Code *</Text>
                  <TextInput
                    value={manualSubjectCode}
                    onChangeText={setManualSubjectCode}
                    placeholder="CSE201"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="characters"
                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Paper ID (optional)</Text>
                  <TextInput
                    value={manualPaperId}
                    onChangeText={setManualPaperId}
                    placeholder="1042"
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
                  />
                </View>
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 8 }]}>Course / Subject Name *</Text>
              <TextInput
                value={manualSubjectName}
                onChangeText={setManualSubjectName}
                placeholder="Scientific Computing with Python"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Shift</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => {
                        setManualShift('morning');
                        setManualShiftTime(sheetExamType === 'mid_sem' ? '10:00 AM - 11:30 AM' : '09:30 AM - 12:30 PM');
                      }}
                      style={[
                        styles.categoryChip,
                        {
                          flex: 1,
                          alignItems: 'center',
                          backgroundColor: manualShift === 'morning' ? colors.accentSoft : colors.surface,
                          borderColor: manualShift === 'morning' ? colors.accent : colors.borderGlass,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 11, fontFamily: 'Inter-SemiBold', color: manualShift === 'morning' ? colors.accent : colors.textSecondary }}>
                        Morning
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setManualShift('evening');
                        setManualShiftTime(sheetExamType === 'mid_sem' ? '03:30 PM - 05:00 PM' : '02:00 PM - 05:00 PM');
                      }}
                      style={[
                        styles.categoryChip,
                        {
                          flex: 1,
                          alignItems: 'center',
                          backgroundColor: manualShift === 'evening' ? colors.accentSoft : colors.surface,
                          borderColor: manualShift === 'evening' ? colors.accent : colors.borderGlass,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 11, fontFamily: 'Inter-SemiBold', color: manualShift === 'evening' ? colors.accent : colors.textSecondary }}>
                        Evening
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Shift Timing</Text>
                  <TextInput
                    value={manualShiftTime}
                    onChangeText={setManualShiftTime}
                    placeholder="09:30 AM - 12:30 PM"
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                <Text style={{ fontSize: 13, fontFamily: 'Inter-Medium', color: colors.textPrimary }}>
                  Back Paper / Repeat Exam
                </Text>
                <Switch
                  value={manualIsBack}
                  onValueChange={setManualIsBack}
                  trackColor={{ false: '#333', true: colors.accent }}
                />
              </View>

              <View style={{ marginTop: 16 }}>
                <PillButton
                  label="Add / Upsert Exam Slot"
                  icon={<PlusCircle size={16} color={colors.onAccent} />}
                  onPress={handleSaveManualSlot}
                  variant="primary"
                />
              </View>
            </GlassCard>

            {/* 4. Published Slots Viewer */}
            <GlassCard style={styles.sectionCard} variant="elevated">
              <View style={styles.cardHeaderRow}>
                <Calendar size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Published Exam Schedules ({adminDateSlots.length})
                </Text>
              </View>

              {/* Filter controls */}
              <View style={{ flexDirection: 'row', gap: 6, marginVertical: 8 }}>
                {[
                  { id: 'all' as const, label: 'All' },
                  { id: 'mid_sem' as const, label: 'Mid-Sem' },
                  { id: 'end_sem' as const, label: 'End-Sem' },
                  { id: 'practical' as const, label: 'Practical' },
                ].map((f) => (
                  <TouchableOpacity
                    key={f.id}
                    onPress={() => setFilterType(f.id)}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: filterType === f.id ? colors.accentSoft : colors.surface,
                        borderColor: filterType === f.id ? colors.accent : colors.borderGlass,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: 'Inter-Medium',
                        color: filterType === f.id ? colors.accent : colors.textSecondary,
                      }}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                value={filterClassKey}
                onChangeText={setFilterClassKey}
                placeholder="Filter by class key (e.g. btech_cse_sem3)"
                placeholderTextColor={colors.textTertiary}
                style={[
                  styles.input,
                  { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface, marginBottom: 10 },
                ]}
              />

              {adminDateSlots.length === 0 ? (
                <View style={styles.emptyCard}>
                  <CalendarDays size={32} color={colors.textTertiary} style={{ marginBottom: 6 }} />
                  <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Exam Slots Found</Text>
                  <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                    Upload a date sheet above or load presets to populate schedules.
                  </Text>
                </View>
              ) : (
                adminDateSlots
                  .filter((s) => {
                    if (filterType !== 'all' && s.examType !== filterType) return false;
                    if (filterClassKey && !s.classKey.includes(filterClassKey.toLowerCase())) return false;
                    return true;
                  })
                  .slice(0, 30)
                  .map((slot) => (
                    <View
                      key={slot.slotKey}
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.borderGlass,
                        marginBottom: 8,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                            <Text style={{ fontFamily: 'Inter-Bold', fontSize: 13, color: colors.accent }}>
                              {slot.subjectCode}
                            </Text>
                            <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 10, color: colors.warning, backgroundColor: colors.warningSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                              {slot.slot.toUpperCase()}
                            </Text>
                            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 10, color: colors.textTertiary }}>
                              {slot.classKey}
                            </Text>
                          </View>
                          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12, color: colors.textPrimary }} numberOfLines={1}>
                            {slot.subjectName}
                          </Text>
                          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                            {slot.examDate} • {slot.shiftTime || 'Scheduled'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDeleteDateSlot(slot.slotKey)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ padding: 6 }}
                        >
                          <Trash2 size={16} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
              )}
            </GlassCard>
          </View>
        )}


        {/* TAB 3: PYQ MODERATION QUEUE */}
        {activeTab === 'pyq' && (
          <View style={styles.tabContent}>
            <GlassCard style={styles.sectionCard} variant="elevated">
              <View style={styles.cardHeaderRow}>
                <FileCheck2 size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>PYQ Verification Queue</Text>
              </View>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                Review student crowdsourced examination question papers. Verified papers immediately become accessible to all GBU schools.
              </Text>

              {/* In-Console Paper Inspector */}
              {inspectingPaper && (
                <GlassCard style={[styles.sectionCard, { borderColor: colors.accent, borderWidth: 1.5, marginTop: 12, marginBottom: 14 }]} variant="elevated">
                  <View style={[styles.cardHeaderRow, { justifyContent: 'space-between' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Eye size={18} color={colors.accent} />
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Inspect Paper Preview</Text>
                    </View>
                    <TouchableOpacity onPress={() => setInspectingPaper(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ padding: 4 }}>
                      <X size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.paperName, { color: colors.textPrimary, marginTop: 4 }]}>
                    {inspectingPaper.subjectCode} — {inspectingPaper.subjectName}
                  </Text>
                  <Text style={[styles.paperMeta, { color: colors.textSecondary }]}>
                    {inspectingPaper.school} • Sem {inspectingPaper.semester} • Prog: {inspectingPaper.programmeCode} • {inspectingPaper.examType} {inspectingPaper.year}
                  </Text>
                  <Text style={[styles.uploaderInfoText, { color: colors.textSecondary, marginTop: 4 }]}>
                    Uploader: {inspectingPaper.uploader_name || 'Anonymous Student'} ({inspectingPaper.uploader_id || 'GBU-STUDENT'})
                  </Text>

                  {/* Actions & Preview */}
                  <View style={{ marginTop: 12, gap: 10 }}>
                    {inspectLoading ? (
                      <View style={{ padding: 16, alignItems: 'center' }}>
                        <ActivityIndicator color={colors.accent} />
                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6 }}>Resolving secure signed link...</Text>
                      </View>
                    ) : inspectingSignedUrl ? (
                      <>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <PillButton
                            label="Open In-App Viewer"
                            variant="outline"
                            size="sm"
                            icon={<FileText size={14} color={colors.accent} style={{ marginRight: 4 }} />}
                            onPress={() => {
                              const docId = registerDocument(inspectingSignedUrl, `${inspectingPaper.subjectCode} - ${inspectingPaper.subjectName}`);
                              router.push({
                                pathname: '/pdf',
                                params: { id: docId, url: inspectingSignedUrl, title: `${inspectingPaper.subjectCode} (${inspectingPaper.examType})` },
                              });
                            }}
                            style={{ flex: 1.1 }}
                          />
                          <PillButton
                            label="Open in Browser"
                            variant="outline"
                            size="sm"
                            icon={<ExternalLink size={14} color={colors.accent} style={{ marginRight: 4 }} />}
                            onPress={() => {
                              Linking.openURL(inspectingSignedUrl).catch(() => showToast('Could not open external link.'));
                            }}
                            style={{ flex: 1 }}
                          />
                        </View>

                        {['JPG', 'JPEG', 'PNG'].includes(getFileExtensionBadge(inspectingPaper.fileUrl)) ? (
                          <View style={{ height: 220, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surfaceAlt, marginTop: 8 }}>
                            <Image
                              source={{ uri: inspectingSignedUrl }}
                              style={{ width: '100%', height: '100%' }}
                              resizeMode="contain"
                            />
                          </View>
                        ) : null}
                      </>
                    ) : (
                      <Text style={{ color: colors.danger, fontSize: 12 }}>Secure preview link could not be generated.</Text>
                    )}

                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <PillButton
                        label="Approve & Publish"
                        variant="primary"
                        size="sm"
                        onPress={async () => {
                          const pid = inspectingPaper.id;
                          setInspectingPaper(null);
                          await handleModeratePaper(pid, 'approve');
                        }}
                        style={{ flex: 1.2 }}
                      />
                      <PillButton
                        label="Reject"
                        variant="outline"
                        size="sm"
                        onPress={async () => {
                          const pid = inspectingPaper.id;
                          setInspectingPaper(null);
                          await handleModeratePaper(pid, 'reject');
                        }}
                        style={{ flex: 0.8 }}
                      />
                    </View>
                  </View>
                </GlassCard>
              )}

              {pendingPapers.length === 0 ? (
                <View style={styles.emptyCard}>
                  <CheckCircle2 size={36} color={colors.success} style={{ marginBottom: 8 }} />
                  <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Queue is Clear</Text>
                  <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                    All student-uploaded papers have been verified and published.
                  </Text>
                </View>
              ) : (
                pendingPapers.map((paper) => {
                  const ext = getFileExtensionBadge(paper.fileUrl);
                  return (
                    <GlassCard key={paper.id} style={styles.paperCard} variant="subtle">
                      <View style={styles.paperTopRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={[styles.paperBadge, { backgroundColor: colors.accentSoft }]}>
                            <Text style={[styles.paperBadgeText, { color: colors.accent }]}>{paper.subjectCode}</Text>
                          </View>
                          <View style={[styles.extBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.surfaceMuted }]}>
                            <Text style={[styles.extBadgeText, { color: colors.textSecondary }]}>[{ext}]</Text>
                          </View>
                        </View>
                        <Text style={[styles.paperExamType, { color: colors.textSecondary }]}>
                          {paper.examType} {paper.year}
                        </Text>
                      </View>

                      <Text style={[styles.paperName, { color: colors.textPrimary }]}>{paper.subjectName}</Text>
                      <Text style={[styles.paperMeta, { color: colors.textSecondary }]}>
                        School: {paper.school} • Sem {paper.semester} • Prog: {paper.programmeCode}
                      </Text>

                      {/* Uploader Attribution */}
                      <View style={[styles.uploaderAttributionCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderGlass }]}>
                        <Avatar
                          size={24}
                          avatarId={paper.uploader_avatar}
                          url={
                            paper.uploader_avatar &&
                            (paper.uploader_avatar.startsWith('http') || paper.uploader_avatar.startsWith('data:'))
                              ? paper.uploader_avatar
                              : undefined
                          }
                          name={paper.uploader_name}
                        />
                        <Text style={[styles.uploaderInfoText, { color: colors.textSecondary }]}>
                          Uploaded by: {paper.uploader_name || 'Anonymous Student'} ({paper.uploader_id || 'GBU-STUDENT'})
                        </Text>
                      </View>

                      <View style={styles.moderationBtnRow}>
                        <PillButton
                          label={`Inspect [${ext}]`}
                          variant="outline"
                          size="sm"
                          icon={<Eye size={13} color={colors.accent} style={{ marginRight: 4 }} />}
                          onPress={() => handleInspectPaper(paper)}
                          style={{ flex: 1.1, marginRight: 6 }}
                        />
                        <PillButton
                          label="Approve"
                          variant="primary"
                          size="sm"
                          onPress={() => handleModeratePaper(paper.id, 'approve')}
                          style={{ flex: 1, marginRight: 6 }}
                        />
                        <PillButton
                          label="Reject"
                          variant="outline"
                          size="sm"
                          onPress={() => handleModeratePaper(paper.id, 'reject')}
                          style={{ flex: 0.8 }}
                        />
                      </View>
                    </GlassCard>
                  );
                })
              )}
            </GlassCard>
          </View>
        )}

        {/* TAB 3: COMPULSORY AUTO-UPDATE MANAGER */}
        
        {/* TAB: STUDENT ISSUE REPORTS & RESPONSES */}
        {activeTab === 'reports' && (
          <View style={styles.tabContent}>
            <GlassCard style={styles.sectionCard} variant="elevated">
              <View style={[styles.cardHeaderRow, { justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <MessageSquare size={18} color={colors.accent} />
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    Student Issue Reports & Moderation
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => void loadReports()}
                  style={{
                    padding: 6,
                    borderRadius: 8,
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.borderGlass,
                  }}
                  accessibilityLabel="Refresh reports"
                >
                  <RefreshCw size={15} color={colors.accent} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                Incoming paper inaccuracies and general issue reports submitted from the student app. Review and reply directly.
              </Text>

              {/* Filter Chips */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 14 }}>
                {(['all', 'pending', 'resolved'] as const).map((flt) => {
                  const count =
                    flt === 'all'
                      ? reportsList.length
                      : flt === 'pending'
                      ? reportsList.filter((r) => r.status === 'pending').length
                      : reportsList.filter((r) => r.status === 'resolved' || r.status === 'reviewed').length;
                  const active = reportsFilter === flt;
                  return (
                    <TouchableOpacity
                      key={flt}
                      onPress={() => setReportsFilter(flt)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
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
                          color: active ? '#FFFFFF' : colors.textSecondary,
                          textTransform: 'capitalize',
                        }}
                      >
                        {flt} ({count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Reports List */}
              {(() => {
                const filtered = reportsList.filter((r) => {
                  if (reportsFilter === 'all') return true;
                  if (reportsFilter === 'pending') return r.status === 'pending';
                  return r.status === 'resolved' || r.status === 'reviewed';
                });

                if (filtered.length === 0) {
                  return (
                    <View style={styles.emptyCard}>
                      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                        No {reportsFilter === 'all' ? '' : reportsFilter} reports found
                      </Text>
                      <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                        When students submit paper corrections or profile feedback, they will appear here.
                      </Text>
                    </View>
                  );
                }

                return filtered.map((rep) => {
                  const isPending = rep.status === 'pending';
                  const isResponding = respondingReportId === rep.id;

                  return (
                    <GlassCard
                      key={rep.id}
                      style={{
                        marginBottom: 12,
                        padding: 14,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: isPending ? colors.accent : colors.borderGlass,
                      }}
                      variant="subtle"
                    >
                      {/* Top Meta Row */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 6,
                              backgroundColor: colors.accentSoft,
                            }}
                          >
                            <Text style={{ fontFamily: 'Inter-Bold', fontSize: 11, color: colors.accent }}>
                              {rep.category}
                            </Text>
                          </View>
                          {rep.subjectCode && (
                            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 11, color: colors.textSecondary }}>
                              {rep.subjectCode}
                            </Text>
                          )}
                        </View>

                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 12,
                            backgroundColor:
                              rep.status === 'resolved'
                                ? colors.successSoft
                                : rep.status === 'dismissed'
                                ? colors.surfaceAlt
                                : 'rgba(245, 158, 11, 0.15)',
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: 'Inter-Bold',
                              fontSize: 10,
                              color:
                                rep.status === 'resolved'
                                  ? colors.success
                                  : rep.status === 'dismissed'
                                  ? colors.textTertiary
                                  : '#F59E0B',
                              textTransform: 'uppercase',
                            }}
                          >
                            {rep.status}
                          </Text>
                        </View>
                      </View>

                      {/* Reporter Information */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Avatar name={rep.reporterName} size={28} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 13, color: colors.textPrimary }}>
                            {rep.reporterName}
                          </Text>
                          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 11, color: colors.textTertiary }}>
                            ID: {rep.reporterStudentId} • {new Date(rep.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          </Text>
                        </View>
                      </View>

                      {/* Reason Description */}
                      <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12, color: colors.textPrimary, marginBottom: 4 }}>
                        Issue: {rep.reason}
                      </Text>

                      {/* Custom Student Note */}
                      {Boolean(rep.customNote) && (
                        <View
                          style={{
                            backgroundColor: colors.surfaceAlt,
                            padding: 8,
                            borderRadius: 8,
                            marginTop: 4,
                            marginBottom: 8,
                            borderLeftWidth: 3,
                            borderLeftColor: colors.accent,
                          }}
                        >
                          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 11, color: colors.textSecondary }}>
                            Student Note: {rep.customNote}
                          </Text>
                        </View>
                      )}

                      {/* Admin Response Box (if already answered) */}
                      {Boolean(rep.adminResponse) && (
                        <View
                          style={{
                            backgroundColor: colors.successSoft,
                            padding: 10,
                            borderRadius: 8,
                            marginTop: 6,
                            marginBottom: 6,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                            <CornerDownRight size={13} color={colors.success} />
                            <Text style={{ fontFamily: 'Inter-Bold', fontSize: 11, color: colors.success }}>
                              Admin Response:
                            </Text>
                          </View>
                          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textPrimary }}>
                            {rep.adminResponse}
                          </Text>
                          {Boolean(rep.adminResponseAt) && (
                            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 10, color: colors.textTertiary, marginTop: 4 }}>
                              Sent: {new Date(rep.adminResponseAt!).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                            </Text>
                          )}
                        </View>
                      )}

                      {/* Action & Response Controls */}
                      {isPending && !isResponding && (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          <TouchableOpacity
                            onPress={() => {
                              setRespondingReportId(rep.id);
                              setAdminReplyText('');
                            }}
                            style={{
                              flex: 1,
                              paddingVertical: 7,
                              backgroundColor: colors.accent,
                              borderRadius: 8,
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 12, color: '#FFFFFF' }}>
                              Reply & Resolve
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => handleDismissReport(rep.id)}
                            style={{
                              paddingVertical: 7,
                              paddingHorizontal: 12,
                              backgroundColor: colors.surfaceAlt,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: colors.borderGlass,
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12, color: colors.textSecondary }}>
                              Dismiss
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {isResponding && (
                        <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: colors.borderGlass, paddingTop: 8 }}>
                          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}>
                            Type Response to Student:
                          </Text>
                          <TextInput
                            value={adminReplyText}
                            onChangeText={setAdminReplyText}
                            placeholder="e.g. Thanks for reporting. Paper has been corrected and re-uploaded!"
                            placeholderTextColor={colors.textTertiary}
                            multiline
                            style={[
                              styles.input,
                              {
                                height: 70,
                                textAlignVertical: 'top',
                                color: colors.textPrimary,
                                borderColor: colors.accent,
                                backgroundColor: colors.surface,
                                marginBottom: 8,
                              },
                            ]}
                          />

                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                              onPress={() => handleSendReportResponse(rep.id)}
                              disabled={isSubmittingReply}
                              style={{
                                flex: 1,
                                paddingVertical: 8,
                                backgroundColor: colors.accent,
                                borderRadius: 8,
                                alignItems: 'center',
                                opacity: isSubmittingReply ? 0.6 : 1,
                              }}
                            >
                              <Text style={{ fontFamily: 'Inter-Bold', fontSize: 12, color: '#FFFFFF' }}>
                                {isSubmittingReply ? 'Sending...' : 'Send Response & Resolve'}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => setRespondingReportId(null)}
                              style={{
                                paddingVertical: 8,
                                paddingHorizontal: 14,
                                backgroundColor: colors.surfaceAlt,
                                borderRadius: 8,
                                alignItems: 'center',
                              }}
                            >
                              <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12, color: colors.textSecondary }}>
                                Cancel
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </GlassCard>
                  );
                });
              })()}
            </GlassCard>
          </View>
        )}

        {activeTab === 'version' && (
          <View style={styles.tabContent}>
            <GlassCard style={styles.sectionCard} variant="elevated">
              <View style={styles.cardHeaderRow}>
                <ArrowUpCircle size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Compulsory Auto-Update Manager</Text>
              </View>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                Publish new app releases. When marked mandatory, all older student apps display a blocking update modal requiring APK update.
              </Text>

              {/* Latest Version — read-only, it is the running build */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Published Version (students are moved to this build)
              </Text>
              <TextInput
                value={manifestVersion}
                editable={false}
                placeholder={BUILD_VERSION}
                placeholderTextColor={colors.textTertiary}
                style={[
                  styles.input,
                  {
                    color: colors.textPrimary,
                    borderColor: colors.borderGlass,
                    backgroundColor: colors.surfaceAlt,
                    opacity: 0.8,
                  },
                ]}
              />
              <Text style={[styles.fieldHint, { color: colors.textTertiary }]}>
                Read-only: taken from this build (app.json). Bump the app version before publishing a
                higher number, otherwise students would be stuck in an endless update loop.
              </Text>

              {/* Min Supported Version */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Min Supported Version
              </Text>
              <TextInput
                value={minSupported}
                onChangeText={setMinSupported}
                placeholder="1.0.0"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
              />
              <Text style={[styles.fieldHint, { color: colors.textTertiary }]}>
                Students below this version are blocked until they update. It must be lower than or
                equal to v{manifestVersion}.
              </Text>

              {/* Mandatory Toggle */}
              <View style={[styles.switchRow, { borderColor: colors.borderGlass, backgroundColor: colors.surface }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.switchLabel, { color: colors.textPrimary }]}>Compulsory / Mandatory Mode</Text>
                  <Text style={[styles.switchSub, { color: colors.textSecondary }]}>
                    Students cannot bypass or dismiss the update modal.
                  </Text>
                </View>
                <Switch
                  value={isMandatory}
                  onValueChange={setIsMandatory}
                  trackColor={{ false: colors.borderGlass, true: colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* APK URL */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Direct APK Download URL</Text>
              <TextInput
                value={apkDownloadUrl}
                onChangeText={setApkDownloadUrl}
                placeholder="https://github.com/acro777x/gbu-one/releases/latest"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
              />

              {/* Release Notes */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Release Notes (One highlight per line)</Text>
              <TextInput
                value={releaseNotesText}
                onChangeText={setReleaseNotesText}
                placeholder="Feature 1\nFeature 2..."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
                style={[styles.textArea, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
              />

              <PillButton
                label="Broadcast Version Update"
                variant="primary"
                size="md"
                onPress={handleBroadcastUpdate}
                icon={<ArrowUpCircle size={16} color={colors.onAccent} style={{ marginRight: 6 }} />}
                style={{ marginTop: 14 }}
              />

              <PillButton
                label="Reset to Default"
                variant="outline"
                size="sm"
                onPress={handleResetUpdate}
                style={{ marginTop: 8 }}
              />
            </GlassCard>

            {/* Dedicated Scrollable Card: Broadcast History & Active Releases */}
            <GlassCard style={[styles.sectionCard, { marginTop: 16 }]} variant="elevated">
              <View style={styles.cardHeaderRow}>
                <Radio size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Broadcast History & Active Releases
                </Text>
              </View>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                Live releases and broadcast history active across student devices. Revert any release to roll back to baseline v1.0.0 and clear compulsory flags.
              </Text>

              {/* Active Release Card */}
              {activeReleaseManifest ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={[styles.subSectionTitle, { color: colors.textPrimary }]}>Active Campus Release</Text>
                  <GlassCard style={styles.activeReleaseCard} variant="subtle">
                    <View style={styles.broadcastTopRow}>
                      <View style={styles.broadcastBadgesRow}>
                        <View
                          style={[
                            styles.paperBadge,
                            {
                              backgroundColor: activeReleaseManifest.isMandatory
                                ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2')
                                : colors.accentSoft,
                              borderColor: activeReleaseManifest.isMandatory ? colors.danger : colors.accent,
                              borderWidth: 1,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.paperBadgeText,
                              {
                                color: activeReleaseManifest.isMandatory ? colors.danger : colors.accent,
                                fontFamily: 'Inter-Bold',
                              },
                            ]}
                          >
                            {activeReleaseManifest.isMandatory ? 'COMPULSORY / MANDATORY' : 'OPTIONAL UPDATE'}
                          </Text>
                        </View>

                        <View style={[styles.sourceBadge, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderGlass, borderWidth: 1 }]}>
                          <Text style={[styles.sourceBadgeText, { color: colors.textSecondary }]}>
                            {activeReleaseManifest.platform.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.activeCampusBadge, { backgroundColor: colors.successSoft }]}>
                        <View style={[styles.pulseDot, { backgroundColor: colors.success }]} />
                        <Text style={[styles.activeCampusText, { color: colors.success }]}>
                          LIVE ON CAMPUS
                        </Text>
                      </View>
                    </View>

                    {/* Version numbers */}
                    <View style={styles.releaseVersionRow}>
                      <View style={styles.versionCol}>
                        <Text style={[styles.versionLabel, { color: colors.textSecondary }]}>Latest Version</Text>
                        <Text style={[styles.versionValue, { color: colors.textPrimary }]}>
                          v{activeReleaseManifest.latestVersion}
                        </Text>
                      </View>
                      <View style={styles.versionDivider} />
                      <View style={styles.versionCol}>
                        <Text style={[styles.versionLabel, { color: colors.textSecondary }]}>Min Supported</Text>
                        <Text style={[styles.versionValue, { color: colors.textPrimary }]}>
                          v{activeReleaseManifest.minSupportedVersion}
                        </Text>
                      </View>
                    </View>

                    {/* Direct APK Download URL */}
                    <View style={styles.apkUrlBox}>
                      <Text style={[styles.versionLabel, { color: colors.textSecondary, marginBottom: 2 }]}>
                        Direct APK Download URL
                      </Text>
                      <Text
                        selectable
                        numberOfLines={1}
                        style={[styles.apkUrlText, { color: colors.accent }]}
                      >
                        {activeReleaseManifest.apkUrl || 'https://github.com/acro777x/gbu-one/releases/latest'}
                      </Text>
                    </View>

                    {/* Release Notes Preview */}
                    {activeReleaseManifest.releaseNotes && activeReleaseManifest.releaseNotes.length > 0 && (
                      <View style={styles.notesBox}>
                        <Text style={[styles.versionLabel, { color: colors.textSecondary, marginBottom: 4 }]}>
                          Release Notes Preview
                        </Text>
                        {activeReleaseManifest.releaseNotes.slice(0, 4).map((note, idx) => (
                          <Text key={idx} style={[styles.noteBullet, { color: colors.textSecondary }]}>
                            • {note}
                          </Text>
                        ))}
                      </View>
                    )}

                    {/* Broadcast Timestamp */}
                    <Text style={[styles.broadcastItemMeta, { color: colors.textSecondary, marginTop: 8 }]}>
                      Broadcasted:{' '}
                      {activeReleaseManifest.releasedAt
                        ? new Date(activeReleaseManifest.releasedAt).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Recently'}
                    </Text>

                    {/* Revert / Deactivate Release Button */}
                    <View style={styles.broadcastActionRow}>
                      <TouchableOpacity
                        onPress={handleConfirmRevertRelease}
                        disabled={isRevertingRelease}
                        style={[
                          styles.revertBroadcastBtn,
                          {
                            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
                            borderColor: colors.danger,
                            opacity: isRevertingRelease ? 0.6 : 1,
                            minHeight: 44,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Revert or Deactivate Release"
                      >
                        <RotateCcw size={14} color={colors.danger} style={{ marginRight: 6 }} />
                        <Text style={[styles.revertBroadcastBtnText, { color: colors.danger }]}>
                          {isRevertingRelease ? 'Reverting...' : 'Revert / Deactivate Release'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </GlassCard>
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Active Releases</Text>
                  <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                    No custom release broadcast active. Student apps are running baseline v1.0.0.
                  </Text>
                </View>
              )}

              {/* Broadcast History List if there are additional past broadcasts */}
              {versionBroadcastHistory.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={[styles.subSectionTitle, { color: colors.textPrimary, marginBottom: 8 }]}>
                    Past Broadcast Logs ({versionBroadcastHistory.length})
                  </Text>
                  <ScrollView nestedScrollEnabled style={styles.broadcastListScroll} showsVerticalScrollIndicator={true}>
                    {versionBroadcastHistory.map((item, idx) => (
                      <GlassCard key={`${item.latestVersion}_${idx}`} style={styles.broadcastHistoryCard} variant="subtle">
                        <View style={styles.broadcastTopRow}>
                          <View style={styles.broadcastBadgesRow}>
                            <View
                              style={[
                                styles.paperBadge,
                                {
                                  backgroundColor: item.isMandatory
                                    ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2')
                                    : colors.accentSoft,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.paperBadgeText,
                                  { color: item.isMandatory ? colors.danger : colors.accent },
                                ]}
                              >
                                {item.isMandatory ? 'MANDATORY' : 'OPTIONAL'}
                              </Text>
                            </View>
                            <Text style={{ fontSize: 13, fontFamily: 'Inter-Bold', color: colors.textPrimary }}>
                              v{item.latestVersion} (min: v{item.minSupportedVersion})
                            </Text>
                          </View>
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[styles.broadcastItemMeta, { color: colors.textSecondary, marginTop: 4 }]}
                        >
                          APK: {item.apkUrl}
                        </Text>
                        <Text style={[styles.broadcastItemMeta, { color: colors.textTertiary, marginTop: 2 }]}>
                          {new Date(item.releasedAt).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </GlassCard>
                    ))}
                  </ScrollView>
                </View>
              )}
            </GlassCard>
          </View>
        )}
      </ScrollView>

      {/* Floating Toast Feedback */}
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
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.avatar,
  },
  headerTitleCol: {
    flex: 1,
  },
  roleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  roleBadge: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveStatusText: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
  },
  lockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
  },
  lockBtnText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    paddingVertical: 6,
  },
  adminTabScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  adminTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44, // 44pt touch target rule
    borderRadius: 24,
    borderWidth: 1.5,
  },
  adminTabBtnActive: {
    borderWidth: 1.5,
  },
  adminTabText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  tabBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  content: {
    padding: theme.spacing.md,
  },
  tabContent: {
    gap: 16,
  },
  sectionCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 6,
    marginTop: 8,
  },
  fieldHint: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    marginTop: 6,
    lineHeight: 15,
  },
  input: {
    height: 44,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  textArea: {
    minHeight: 70,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlignVertical: 'top',
  },
  photoActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  galleryPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
  },
  galleryPickerBtnText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  pickedPhotosTray: {
    marginBottom: 10,
  },
  pickedPhotosScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  pickedPhotoWrapper: {
    position: 'relative',
    width: 68,
    height: 68,
    borderRadius: 8,
    overflow: 'hidden',
  },
  pickedPhotoThumb: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formRow: {
    flexDirection: 'row',
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  categoryChipText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    marginVertical: 12,
  },
  switchLabel: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  switchSub: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },
  subHeaderTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    marginTop: 8,
  },
  eventItemCard: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  eventItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventItemTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
  },
  eventItemMeta: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 3,
  },
  deleteBtn: {
    padding: 8,
  },
  emptyCard: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    borderRadius: theme.radius.card,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
  },
  emptySub: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    marginTop: 4,
  },
  paperCard: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.card,
  },
  paperTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  paperBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paperBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
  },
  extBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  extBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.5,
  },
  paperExamType: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  paperName: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  paperMeta: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginBottom: 12,
  },
  moderationBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  lockCard: {
    padding: theme.spacing.xl,
    borderRadius: theme.radius.card,
    alignItems: 'center',
  },
  lockIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  lockTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    marginBottom: 6,
    textAlign: 'center',
  },
  lockSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  lockForm: {
    width: '100%',
  },
  authErrorText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    marginTop: 6,
    marginBottom: 4,
  },
  lockoutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    width: '100%',
  },
  lockoutBadgeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    lineHeight: 18,
  },
  attemptsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    width: '100%',
  },
  attemptsBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  pickedDocCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  pickedDocText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  broadcastListScroll: {
    maxHeight: 360,
  },
  broadcastHistoryCard: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  broadcastTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  broadcastBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sourceBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
  },
  activeCampusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeCampusText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.5,
  },
  broadcastItemTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  broadcastItemMeta: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    marginBottom: 8,
  },
  broadcastActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  revertBroadcastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  revertBroadcastBtnText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  editBroadcastBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  uploaderAttributionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 4,
    gap: 8,
  },
  uploaderAvatarBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploaderAvatarImg: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  uploaderInfoText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    flex: 1,
  },
  authModeTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
    width: '100%',
  },
  authModeTabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authModeTabText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  setupNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    width: '100%',
  },
  setupNoticeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    lineHeight: 16,
  },
  activeReleaseCard: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: 'rgba(0,168,150,0.25)',
    gap: 10,
    marginTop: 8,
  },
  subSectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    marginTop: 6,
  },
  releaseVersionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  versionCol: {
    flex: 1,
  },
  versionDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginHorizontal: 12,
  },
  versionLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
  },
  versionValue: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  apkUrlBox: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  apkUrlText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  notesBox: {
    gap: 2,
  },
  noteBullet: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    lineHeight: 18,
  },
});