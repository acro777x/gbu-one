import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  FlatList,
  Platform,
  Image,
  AppState,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import {
  Search,
  Download,
  UploadCloud,
  CheckCircle2,
  Flame,
  AlertTriangle,
  FileText,
  X,
  Trophy,
  RefreshCw,
  Trash2,
} from 'lucide-react-native';
import {
  GlassCard,
  PillButton,
  Toast,
  BottomSheet,
  Chip,
  EmptyState,
  Avatar,
} from '../../src/components/ui';
import { useAuthStore } from '../../src/store/useAuthStore';
import {
  PYQItem,
  MOCK_PAPERS,
  filterPapers,
  normalizeSemester,
} from '../../src/features/pyq/pyqService';
import { registerDocument } from '../../src/components/pdf/pdfRegistry';
import { usePyqQuery } from '../../src/features/pyq/usePyqQuery';
import {
  reportPaper,
  uploadPendingPaper,
  recordDownload,
  ensureValidUuid,
  type PyqUploadResult,
} from '../../src/features/pyq/pyqRepository';
import { humaniseUploadError, resolveCanonicalMime } from '../../src/features/pyq/pyqStorage';
import {
  buildQueuedUpload,
  deleteQueuedUpload,
  enqueueUpload,
  flushUploadQueue,
  readUploadQueue,
  retryQueuedUpload,
  type QueuedUpload,
  type QueuedUploadIdentity,
} from '../../src/features/pyq/localUploadQueue';
import { useAppTheme } from '../../src/lib/ThemeContext';
import { theme } from '../../src/lib/theme';
import {
  getLeaderboard,
  type LeaderboardEntry,
  type CurrentUserParam,
} from '../../src/features/pyq/pyqLeaderboard';

const SCHOOL_FILTERS = [
  'All',
  'SOICT',
  'SOE',
  'SOBT',
  'SOM',
  'SOLJG',
  'SOHSS',
  'SOVSAS',
  'SOUS',
];

const SEMESTER_FILTERS = [
  'All',
  'Sem I',
  'Sem II',
  'Sem III',
  'Sem IV',
  'Sem V',
  'Sem VI',
  'Sem VII',
  'Sem VIII',
  'Sem IX',
  'Sem X',
];

const EXAM_TYPE_TABS = ['All', 'Mid Sem', 'End Sem', 'Back Paper'] as const;
type ExamTab = (typeof EXAM_TYPE_TABS)[number];

const UPLOAD_SCHOOLS = [
  'SOICT',
  'SOE',
  'SOBT',
  'SOM',
  'SOLJG',
  'SOHSS',
  'SOVSAS',
  'SOUS',
] as const;

const UPLOAD_SEMESTERS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
] as const;

import {
  PROGRAMMES_BY_SCHOOL,
} from '../../src/features/pyq/pyqProgrammes';

export { PROGRAMMES_BY_SCHOOL };

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - theme.spacing.lg * 2 - 12) / 2);

interface PaperCardProps {
  paper: PYQItem;
  isSelected: boolean;
  onPress: () => void;
  onToggleSelect: () => void;
  onDownload: () => void;
  onUpload: () => void;
}

const PaperCard = React.memo<PaperCardProps>(function PaperCard({
  paper,
  isSelected,
  onPress,
  onToggleSelect,
  onDownload,
  onUpload,
}) {
  const { colors, isDark } = useAppTheme();
  const hasAuthenticFile = Boolean(paper.fileUrl);

  return (
    <GlassCard
      style={[styles.card, isSelected && { backgroundColor: colors.accentSoft }]}
      accentBorder={isSelected}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.badge,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.surfaceMuted },
          ]}
        >
          <Text style={[styles.badgeText, { color: colors.accent }]}>{paper.subjectCode}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {hasAuthenticFile ? (
            <View style={[styles.fileStatusPill, { backgroundColor: colors.successSoft }]}>
              <CheckCircle2 size={10} color={colors.success} />
              <Text style={[styles.fileStatusText, { color: colors.success }]}>Available</Text>
            </View>
          ) : (
            <View
              style={[
                styles.fileStatusPill,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(15, 23, 42, 0.06)',
                },
              ]}
            >
              <Text style={[styles.fileStatusText, { color: colors.textTertiary }]}>No paper</Text>
            </View>
          )}
          {hasAuthenticFile && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onToggleSelect();
              }}
              style={styles.selectToggle}
              hitSlop={8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`Select ${paper.subjectCode} for download`}
            >
              <CheckCircle2 size={16} color={isSelected ? colors.accent : colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Text style={[styles.subjectName, { color: colors.textPrimary }]} numberOfLines={2}>
        {paper.subjectName}
      </Text>

      <View style={styles.metaRow}>
        <Text style={[styles.typeText, { color: colors.textSecondary }]}>
          {paper.year} • {paper.examType}
        </Text>
        <Text style={[styles.programmeTag, { color: colors.textTertiary }]}>
          {paper.programme} ({paper.semester})
        </Text>
      </View>

      {hasAuthenticFile ? (
        <TouchableOpacity
          style={styles.downloadRow}
          onPress={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Download ${paper.subjectCode}`}
        >
          <Download size={13} color={colors.accent} />
          <Text style={[styles.downloadCount, { color: colors.accent, fontWeight: '600' }]}>
            Download ({paper.downloads})
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.downloadRow}
          onPress={(e) => {
            e.stopPropagation();
            onUpload();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Upload ${paper.subjectCode}`}
        >
          <UploadCloud size={13} color={colors.accent} />
          <Text style={[styles.downloadCount, { color: colors.accent, fontWeight: '600' }]}>
            Upload Paper
          </Text>
        </TouchableOpacity>
      )}
    </GlassCard>
  );
});

export default function PYQScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('All');
  const [selectedSemester, setSelectedSemester] = useState('All');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [examTab, setExamTab] = useState<ExamTab>('All');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [uploadSheetVisible, setUploadSheetVisible] = useState(false);
  const [reportingPaper, setReportingPaper] = useState<PYQItem | null>(null);
  const [selectedReportReason, setSelectedReportReason] = useState('Incomplete or blurred scan');
  const [reportCustomNote, setReportCustomNote] = useState('');
  const [reportSheetVisible, setReportSheetVisible] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [detailPaper, setDetailPaper] = useState<PYQItem | null>(null);
  const [detailSheetVisible, setDetailSheetVisible] = useState(false);

  // Upload form state
  const [uploadSubjectCode, setUploadSubjectCode] = useState('');
  const [uploadSubjectName, setUploadSubjectName] = useState('');
  const [uploadSchool, setUploadSchool] = useState('SOICT');
  const [uploadExamType, setUploadExamType] = useState<'Mid Sem' | 'End Sem' | 'Back Paper'>('Mid Sem');
  const [uploadProgramme, setUploadProgramme] = useState('BCS');
  const [isCustomProgramme, setIsCustomProgramme] = useState(false);
  const [customProgrammeText, setCustomProgrammeText] = useState('');
  const [uploadSemester, setUploadSemester] = useState('II');
  const [uploadYear, setUploadYear] = useState(String(new Date().getFullYear() - 1));
  const [pickedFile, setPickedFile] = useState<{
    uri: string;
    name: string;
    mimeType: string;
    size: number | null;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [queue, setQueue] = useState<QueuedUpload[]>([]);
  const [queueOpen, setQueueOpen] = useState(false);
  const [topContributors, setTopContributors] = useState<LeaderboardEntry[]>([]);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  const leaderboardUser = useMemo<CurrentUserParam | undefined>(
    () =>
      user
        ? {
            id: user.id,
            name: user.name,
            avatarId: user.avatarId ?? undefined,
            uniqueStudentId:
              user.uniqueStudentId || user.rollNo || `GBU-${user.id.slice(0, 6).toUpperCase()}`,
            school: user.classSelection?.school,
          }
        : undefined,
    [
      user?.id,
      user?.name,
      user?.avatarId,
      user?.uniqueStudentId,
      user?.rollNo,
      user?.classSelection?.school,
    ],
  );

  /**
   * The identity written with every upload.
   *
   * `authUserId` is the real Supabase user id and is NULL for a guest - the
   * column is a foreign key, so a device id must never be written into it.
   * `studentId` is the device identity that names the contributor.
   */
  const uploaderIdentity = useMemo<QueuedUploadIdentity>(() => {
    const studentId =
      user?.uniqueStudentId ||
      user?.rollNo ||
      (user?.id ? `GBU-${user.id.slice(0, 6).toUpperCase()}` : 'GBU-GUEST');
    return {
      authUserId: isAuthenticated ? ensureValidUuid(user?.id) : null,
      studentId,
      name: user?.name || 'Guest Scholar',
      avatarId: user?.avatarId || user?.avatarUrl || 'tech-scholar',
    };
  }, [user, isAuthenticated]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
  };

  // Load top contributors for the banner. The standings are server-derived,
  // so an empty board means "nobody has an approved paper yet" - it is
  // never filled with invented names.
  useEffect(() => {
    let active = true;
    void getLeaderboard(leaderboardUser)
      .then((data) => {
        if (!active) return;
        setTopContributors(data.slice(0, 3));
        setLeaderboardError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setTopContributors([]);
        setLeaderboardError(
          err instanceof Error ? err.message : 'The contributor standings could not be loaded.',
        );
      });
    return () => {
      active = false;
    };
  }, [leaderboardUser]);

  const refreshQueue = useCallback(async () => {
    const entries = await readUploadQueue();
    setQueue(entries);
  }, []);

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

  /**
   * Drains the offline queue.
   *
   * The queue used to be write-only: the screen promised the paper "will
   * upload automatically once connected" and nothing ever uploaded it. The
   * queue is now flushed when the app comes to the foreground, when the
   * account changes, and whenever the student asks for it.
   */
  const runFlush = useCallback(async () => {
    const result = await flushUploadQueue({ uploader: uploaderIdentity });
    await refreshQueue();
    if (result.uploaded > 0) {
      showToast(
        `${result.uploaded} paper${result.uploaded === 1 ? '' : 's'} uploaded to the library.`,
      );
    } else if (result.failed > 0) {
      showToast(
        `${result.failed} paper${result.failed === 1 ? '' : 's'} could not be uploaded yet. It stays on this phone.`,
      );
    }
    return result;
  }, [uploaderIdentity, refreshQueue]);

  useEffect(() => {
    void runFlush();
  }, [runFlush]);

  // The app comes back to the foreground: the network is probably back too.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void runFlush();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [runFlush]);

  // Approved papers from the backend; the bundled seed is the offline fallback.
  const { data: papers = MOCK_PAPERS, isFetching, error: libraryError, refetch } = usePyqQuery();

  // The library answered: Supabase is reachable again, so the queue goes
  // out now.
  useEffect(() => {
    if (!isFetching && !libraryError) {
      void runFlush();
    }
  }, [isFetching, libraryError, runFlush]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  }, []);

  const handleSingleDownload = useCallback((paper: PYQItem) => {
    setDetailSheetVisible(false);
    if (!paper.fileUrl) {
      showToast(`No question paper uploaded for ${paper.subjectCode} yet. Tap Upload to contribute!`);
      return;
    }
    const targetUrl = paper.fileUrl;
    const title = `${paper.subjectCode} - ${paper.subjectName}`;
    const docId = registerDocument(targetUrl, title);
    // The counter was never written before: the screen said "Download
    // logged" while nothing was logged at all.
    void recordDownload(paper.id);
    router.push({
      pathname: '/pdf',
      params: { id: docId, url: targetUrl, title },
    });
    showToast(`Opening ${paper.subjectCode} (${paper.examType}). Download logged.`);
  }, []);

  /**
   * Opens the selected papers.
   *
   * The button used to be labelled "Download ZIP" and did nothing at all:
   * it counted the papers and showed a toast. There is no zip writer in the
   * app, so the action is now honest - it opens the first selected paper in
   * the reader and logs the download of every selected paper.
   */
  const handleBulkDownload = useCallback(async () => {
    const selected = papers.filter((p) => selectedIds.includes(p.id) && p.fileUrl);
    if (selected.length === 0) {
      showToast('None of the selected papers have a file yet.');
      return;
    }

    for (const paper of selected) {
      void recordDownload(paper.id);
    }

    const [first] = selected;
    const docId = registerDocument(first.fileUrl!, `${first.subjectCode} - ${first.subjectName}`);
    router.push({
      pathname: '/pdf',
      params: {
        id: docId,
        url: first.fileUrl!,
        title: `${first.subjectCode} - ${first.subjectName}`,
      },
    });
    setSelectedIds([]);
    showToast(
      selected.length === 1
        ? 'Opened the paper. Download logged.'
        : `Opened ${first.subjectCode}. Download logged for ${selected.length} papers - open the rest one by one.`,
    );
  }, [papers, selectedIds]);

  const handleUploadPress = () => {
    setPickedFile(null);
    setUploadSheetVisible(true);
  };

  const handleOpenReport = (paper: PYQItem) => {
    setReportingPaper(paper);
    setSelectedReportReason('Incomplete or blurred scan');
    setReportCustomNote('');
    setReportSheetVisible(true);
  };

  const handleSendReport = async (overrideReason?: string) => {
    if (!reportingPaper) return;
    const finalReason = overrideReason || selectedReportReason;
    const custom = reportCustomNote.trim();
    setReportSheetVisible(false);
    setReportCustomNote('');
    setReporting(true);
    try {
      const result = await reportPaper(
        reportingPaper.id,
        finalReason,
        user?.uniqueStudentId || user?.rollNo || user?.id || null,
        {
          customNote: custom,
          studentName: user?.name || 'GBU Student',
          subjectCode: reportingPaper.subjectCode,
          subjectName: reportingPaper.subjectName,
        },
      );
      showToast(
        result.ok
          ? `Report received: moderation will review ${reportingPaper.subjectCode}.`
          : `Report could not be sent: ${result.reason}`,
      );
    } finally {
      setReporting(false);
    }
  };

  const handlePickFile = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || picked.assets.length === 0) return;
      const asset = picked.assets[0];
      const canonicalMime = resolveCanonicalMime(asset.mimeType, asset.name);
      setPickedFile({
        uri: asset.uri,
        name: asset.name || 'paper.pdf',
        mimeType: canonicalMime,
        // A cloud document provider may not measure the file. `null` means
        // "unknown", not "empty" - the old `?? 0` threw real papers away.
        size: typeof asset.size === 'number' ? asset.size : null,
      });
      showToast(`Selected ${asset.name}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not open the file picker.');
    }
  };

  const handleSchoolSelect = (school: string) => {
    setUploadSchool(school);
    const progs = PROGRAMMES_BY_SCHOOL[school] || [];
    if (progs.length > 0 && !isCustomProgramme) {
      setUploadProgramme(progs[0].code);
    }
  };

  const handleSubmitUpload = async () => {
    if (!uploadSubjectCode.trim()) {
      showToast('Please enter subject code (e.g. CSE205)');
      return;
    }
    if (!uploadSubjectName.trim()) {
      showToast('Please enter the subject name');
      return;
    }
    const finalProg = isCustomProgramme
      ? customProgrammeText.trim().toUpperCase()
      : uploadProgramme.trim().toUpperCase();
    if (!finalProg) {
      showToast('Please select or enter programme code');
      return;
    }
    if (!pickedFile) {
      showToast('Please choose the question paper file');
      return;
    }

    const meta = {
      school: uploadSchool,
      programmeCode: finalProg,
      semester: uploadSemester,
      subjectCode: uploadSubjectCode.trim().toUpperCase(),
      subjectName: uploadSubjectName.trim(),
      year: Number(uploadYear),
      examType: uploadExamType,
    };

    setUploading(true);
    let result: PyqUploadResult;
    try {
      result = await uploadPendingPaper(pickedFile, meta, uploaderIdentity);
    } catch (err) {
      result = {
        ok: false,
        reason: humaniseUploadError(err instanceof Error ? err.message : undefined),
      };
    } finally {
      // The spinner used to stay on forever when the upload was refused.
      setUploading(false);
    }

    if (!result.ok) {
      const isOfflineOrNetworkFailure =
        result.reason === 'Cloud sync is not configured yet.' ||
        result.reason.toLowerCase().includes('network') ||
        result.reason.toLowerCase().includes('no connection') ||
        result.reason.toLowerCase().includes('failed to fetch') ||
        result.reason.toLowerCase().includes('timeout') ||
        result.reason.toLowerCase().includes('connection');

      if (isOfflineOrNetworkFailure) {
        const entry = buildQueuedUpload(
          {
            uri: pickedFile.uri,
            name: pickedFile.name,
            mimeType: pickedFile.mimeType,
            size: pickedFile.size,
          },
          meta,
          new Date(),
          uploaderIdentity,
        );
        const next = await enqueueUpload(entry);
        setQueue(next);
        setUploadSheetVisible(false);
        setUploadSubjectCode('');
        setUploadSubjectName('');
        setPickedFile(null);
        showToast('Saved on this phone. It will upload automatically once connected.');
        return;
      }
      showToast(humaniseUploadError(result.reason));
      return;
    }

    setUploadSheetVisible(false);
    setUploadSubjectCode('');
    setUploadSubjectName('');
    setPickedFile(null);
    // Points are NOT awarded here. They are derived by the server from the
    // approved papers, so a rejected paper pays nothing and the score
    // always lives on the server.
    showToast('Upload submitted! A moderator will review it before it is listed on GBU One.');
    void refetch();
  };

  const handleDeleteQueued = useCallback(
    async (id: string) => {
      const next = await deleteQueuedUpload(id);
      setQueue(next);
      showToast('The queued paper was removed from this phone.');
    },
    [],
  );

  const handleRetryQueued = useCallback(
    async (id: string) => {
      const next = await retryQueuedUpload(id);
      setQueue(next);
      void runFlush();
    },
    [runFlush],
  );

  const availableSubjects = useMemo(() => {
    const map = new Map<string, { code: string; name: string; count: number }>();
    const cleanSem = selectedSemester === 'All' ? 'All' : normalizeSemester(selectedSemester);
    papers.forEach((p) => {
      if (selectedSchool !== 'All') {
        const pSch = p.school.toUpperCase();
        const selSch = selectedSchool.toUpperCase();
        const matches =
          pSch === selSch ||
          (selSch === 'SOLJG' && (pSch === 'SOL' || pSch === 'SOLJG')) ||
          (selSch === 'SOL' && (pSch === 'SOLJG' || pSch === 'SOL'));
        if (!matches) return;
      }
      if (cleanSem !== 'All') {
        const pSem = normalizeSemester(p.semester);
        if (pSem !== cleanSem) return;
      }
      const code = p.subjectCode.trim();
      const existing = map.get(code);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(code, { code, name: p.subjectName, count: 1 });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [papers, selectedSchool, selectedSemester]);

  useEffect(() => {
    if (selectedSubject !== 'All' && !availableSubjects.some((s) => s.code === selectedSubject)) {
      setSelectedSubject('All');
    }
  }, [availableSubjects, selectedSubject]);

  const filteredPapers = useMemo(() => {
    return filterPapers(
      papers,
      searchQuery,
      selectedSchool,
      selectedSemester,
      examTab,
      selectedSubject,
    );
  }, [papers, searchQuery, selectedSchool, selectedSemester, examTab, selectedSubject]);

  // The trending row used to ignore every filter, so a student looking for
  // one subject still saw the global most-downloaded papers.
  const trendingPapers = useMemo(() => {
    return [...filteredPapers].sort((a, b) => b.downloads - a.downloads).slice(0, 4);
  }, [filteredPapers]);

  const renderPaperItem = useCallback(
    ({ item: paper }: { item: PYQItem }) => {
      const isSelected = selectedIds.includes(paper.id);

      return (
        <PaperCard
          paper={paper}
          isSelected={isSelected}
          onPress={() => {
            setDetailPaper(paper);
            setDetailSheetVisible(true);
          }}
          onToggleSelect={() => toggleSelect(paper.id)}
          onDownload={() => handleSingleDownload(paper)}
          onUpload={() => {
            setUploadSubjectCode(paper.subjectCode);
            setUploadSubjectName(paper.subjectName);
            setUploadSchool(paper.school || 'SOICT');
            setUploadProgramme(paper.programme || 'BCS');
            setUploadSemester(paper.semester.replace(/^Sem\s*/i, '') || 'I');
            setUploadExamType(paper.examType || 'Mid Sem');
            setUploadSheetVisible(true);
          }}
        />
      );
    },
    [selectedIds, toggleSelect, handleSingleDownload],
  );

  const renderHeader = useCallback(
    () => (
      <View>
        {/* Trending Spotlight */}
        {searchQuery === '' && selectedSchool === 'All' && selectedSemester === 'All' && examTab === 'All' && (
          <View style={styles.trendingSection}>
            <View style={styles.sectionHeaderRow}>
              <Flame size={16} color={colors.accent} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Trending Papers</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingScroll}>
              {trendingPapers.map((paper) => (
                <GlassCard
                  key={`trend_${paper.id}`}
                  style={styles.trendingCard}
                  onPress={() => toggleSelect(paper.id)}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.surfaceMuted }]}>
                      <Text style={[styles.badgeText, { color: colors.accent }]}>{paper.subjectCode}</Text>
                    </View>
                    <Text style={[styles.trendDownloads, { color: colors.accent }]}>{paper.downloads} dl</Text>
                  </View>
                  <Text style={[styles.trendTitle, { color: colors.textPrimary }]} numberOfLines={2}>{paper.subjectName}</Text>
                  <Text style={[styles.typeText, { color: colors.textSecondary }]}>{paper.year} • {paper.examType}</Text>
                </GlassCard>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Papers Grid Header */}
        <View style={styles.allPapersHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>All Question Papers</Text>
            {selectedSubject !== 'All' && (
              <TouchableOpacity
                onPress={() => setSelectedSubject('All')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.accentSoft,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 12,
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 11, color: colors.accent, fontWeight: '600' }}>
                  Subject: {selectedSubject}
                </Text>
                <X size={12} color={colors.accent} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
            {isFetching ? 'Syncing…' : `${filteredPapers.length} paper${filteredPapers.length === 1 ? '' : 's'}`}
          </Text>
        </View>
      </View>
    ),
    [searchQuery, selectedSchool, selectedSemester, examTab, trendingPapers, selectedSubject, colors, isDark, isFetching, filteredPapers.length, toggleSelect],
  );

  const renderFooter = useCallback(
    () => (
      <View style={[styles.takedownSection, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderGlass }]}>
        <Text style={[styles.takedownText, { color: colors.textSecondary }]}>
          DMCA & University Copyright Notice: Question papers uploaded are submitted by students for academic non-commercial revision. Gautam Buddha University holds official curriculum copyright.
        </Text>
      </View>
    ),
    [colors],
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Previous Year Papers</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Crowdsourced PYQ repository for GBU</Text>
        </View>

        <TouchableOpacity
          style={[styles.uploadBtn, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
          onPress={handleUploadPress}
          accessibilityRole="button"
          accessibilityLabel="Contribute question paper"
        >
          <UploadCloud size={16} color={colors.accent} />
          <Text style={[styles.uploadBtnText, { color: colors.accent }]}>Upload</Text>
        </TouchableOpacity>
      </View>

      {/* Sleek Compact GBU Contributor Leaderboard Banner Card */}
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => router.push('/pyq/leaderboard')}
        accessibilityRole="button"
        accessibilityLabel="View full contributor leaderboard"
        style={[
          styles.leaderboardBanner,
          {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : colors.surface,
            borderColor: colors.borderGlass,
          },
        ]}
      >
        <View style={styles.leaderboardBannerHeader}>
          <View style={styles.leaderboardBannerTitleRow}>
            <Trophy size={16} color="#F59E0B" />
            <Text style={[styles.leaderboardBannerTitle, { color: colors.textPrimary }]}>
              🏆 GBU Contributor Leaderboard
            </Text>
          </View>
          <View style={styles.leaderboardBannerAction}>
            <Text style={[styles.leaderboardBannerActionText, { color: colors.accent }]}>
              View Full Leaderboard →
            </Text>
          </View>
        </View>

        {/* Compact row of Top 3 podium avatars & points */}
        {topContributors.length > 0 ? (
          <View style={styles.top3Row}>
            {topContributors.map((entry, index) => {
              const medal = index === 0 ? '👑' : index === 1 ? '🥈' : '🥉';
              const medalBorder = index === 0 ? '#F59E0B' : index === 1 ? '#94A3B8' : '#D97706';
              return (
                <View key={`top3_${entry.id}_${index}`} style={styles.top3Item}>
                  <View style={[styles.top3AvatarRing, { borderColor: medalBorder }]}>
                    <Avatar name={entry.name} avatarId={entry.avatarId} size={28} />
                    <Text style={styles.top3Medal}>{medal}</Text>
                  </View>
                  <View style={styles.top3Details}>
                    <Text
                      style={[styles.top3Name, { color: colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {entry.name.split(' ')[0]}
                    </Text>
                    <Text style={[styles.top3Points, { color: colors.accent }]}>
                      {entry.points} pts
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.top3Row}>
            <Text style={[styles.leaderboardEmpty, { color: colors.textSecondary }]}>
              {leaderboardError
                ? 'The contributor standings could not be loaded.'
                : 'No approved uploads yet — the first contributor takes the crown.'}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* The library could not be refreshed: say so, the papers below are the saved ones. */}
      {libraryError ? (
        <View style={[styles.queuedBanner, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
          <AlertTriangle size={15} color={colors.warning} style={{ marginRight: 8 }} />
          <Text style={[styles.queuedBannerText, { color: colors.textSecondary }]}>
            {`The paper library could not be reached. Showing the papers saved on this phone. (${libraryError instanceof Error ? libraryError.message : String(libraryError)})`}
          </Text>
        </View>
      ) : null}

      {queue.length > 0 ? (
        <View style={[styles.queuedBanner, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
          <UploadCloud size={15} color={colors.accent} style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.queuedBannerText, { color: colors.textPrimary }]}>
              {queue.length} {queue.length === 1 ? 'paper is' : 'papers are'} waiting on this phone.
              {queueOpen ? '' : ' Tap to see them.'}
            </Text>
            {queueOpen ? (
              <View style={styles.queueList}>
                {queue.map((entry) => (
                  <View key={entry.id} style={styles.queueRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.queueTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                        {entry.meta.subjectCode} — {entry.meta.subjectName}
                      </Text>
                      <Text style={[styles.queueSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                        {entry.status === 'failed'
                          ? `Upload failed: ${entry.lastError ?? 'unknown error'}`
                          : `Waiting to upload (${entry.attempts} attempt${entry.attempts === 1 ? '' : 's'})`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.queueAction}
                      onPress={() => void handleRetryQueued(entry.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Retry uploading ${entry.meta.subjectCode}`}
                    >
                      <RefreshCw size={15} color={colors.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.queueAction}
                      onPress={() => void handleDeleteQueued(entry.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete queued paper ${entry.meta.subjectCode}`}
                    >
                      <Trash2 size={15} color={colors.danger || '#EF4444'} />
                    </TouchableOpacity>
                  </View>
                ))}
                <PillButton
                  label="Upload queued papers now"
                  onPress={() => void runFlush()}
                  variant="outline"
                  size="sm"
                  icon={<UploadCloud size={14} color={colors.accent} style={{ marginRight: 4 }} />}
                />
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => setQueueOpen((open) => !open)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={queueOpen ? 'Hide queued papers' : 'Show queued papers'}
          >
            <Text style={[styles.queueToggle, { color: colors.accent }]}>{queueOpen ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.searchSection}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.borderGlass }]}>
          <Search size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by subject name or code..."
            placeholderTextColor={colors.textTertiary}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            accessibilityLabel="Search previous year question papers"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Exam-type tabs: Mid Sem / End Sem / Back Paper */}
      <View style={styles.examTabsRow}>
        {EXAM_TYPE_TABS.map((tab) => {
          const active = examTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => setExamTab(tab)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[
                styles.examTab,
                {
                  backgroundColor: active ? colors.accent : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.05)',
                  borderColor: active ? colors.accent : colors.borderGlass,
                },
              ]}
            >
              <Text
                style={[
                  styles.examTabText,
                  { color: active ? colors.onAccent : colors.textSecondary },
                ]}
              >
                {tab === 'All' ? 'All Papers' : tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Hierarchical Browse Filters */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {SCHOOL_FILTERS.map((sch) => (
            <Chip
              key={sch}
              label={sch}
              selected={selectedSchool === sch}
              onPress={() => setSelectedSchool(sch)}
              style={styles.filterChip}
            />
          ))}

          <View style={[styles.filterDivider, { backgroundColor: colors.divider }]} />

          {SEMESTER_FILTERS.map((sem) => (
            <Chip
              key={sem}
              label={sem}
              selected={selectedSemester === sem}
              onPress={() => setSelectedSemester(sem)}
              style={styles.filterChip}
            />
          ))}
        </ScrollView>
      </View>

      {/* Subject level of the browse: school -> semester -> subject */}
      {availableSubjects.length > 0 ? (
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            <Chip
              label="All Subjects"
              selected={selectedSubject === 'All'}
              onPress={() => setSelectedSubject('All')}
              style={styles.filterChip}
            />
            {availableSubjects.map((subject) => (
              <Chip
                key={subject.code}
                label={subject.code}
                selected={selectedSubject === subject.code}
                onPress={() => setSelectedSubject(subject.code)}
                style={styles.filterChip}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <FlatList
        data={filteredPapers}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        renderItem={renderPaperItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <EmptyState
            title="No papers found"
            description="Try selecting a different school, semester or search keyword."
          />
        }
        ListFooterComponent={filteredPapers.length > 0 ? renderFooter : null}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(120, 100 + insets.bottom) }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
      />

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <View style={[styles.floatingActionBar, { backgroundColor: isDark ? 'rgba(22, 22, 26, 0.96)' : 'rgba(255, 255, 255, 0.96)', borderColor: colors.accent }]}>
          <View>
            <Text style={[styles.floatingCountText, { color: colors.textPrimary }]}>
              {selectedIds.length} paper{selectedIds.length > 1 ? 's' : ''} selected
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedIds([])}
              style={styles.floatingClear}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear the selection"
            >
              <Text style={[styles.floatingClearText, { color: colors.textSecondary }]}>Clear</Text>
            </TouchableOpacity>
          </View>
          <PillButton
            label="Open Selected"
            onPress={() => void handleBulkDownload()}
            variant="primary"
            size="sm"
            icon={<Download size={14} color={colors.onAccent} style={{ marginRight: 4 }} />}
          />
        </View>
      )}

      {/* Toast */}
      <Toast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />

      {/* Upload Bottom Sheet */}
      <BottomSheet
        visible={uploadSheetVisible}
        onClose={() => { setUploadSheetVisible(false); setPickedFile(null); }}
        title="Contribute Question Paper"
      >
        <View style={styles.sheetContent}>
          <Text style={[styles.uploadFormLabel, { color: colors.textPrimary }]}>Subject Code</Text>
          <TextInput
            value={uploadSubjectCode}
            onChangeText={setUploadSubjectCode}
            placeholder="e.g. CSE205"
            placeholderTextColor={colors.textTertiary}
            style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.borderGlass, color: colors.textPrimary }]}
            autoCapitalize="characters"
            accessibilityLabel="Subject code"
          />

          <Text style={[styles.uploadFormLabel, { color: colors.textPrimary }]}>Subject Name</Text>
          <TextInput
            value={uploadSubjectName}
            onChangeText={setUploadSubjectName}
            placeholder="e.g. Data Structures & Algorithms"
            placeholderTextColor={colors.textTertiary}
            style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.borderGlass, color: colors.textPrimary }]}
            accessibilityLabel="Subject name"
          />

          <Text style={[styles.uploadFormLabel, { color: colors.textPrimary }]}>School</Text>
          <View style={styles.formChipRow}>
            {UPLOAD_SCHOOLS.map((s) => (
              <Chip
                key={s}
                label={s}
                selected={uploadSchool === s}
                onPress={() => handleSchoolSelect(s)}
                style={styles.formChip}
              />
            ))}
          </View>

          <Text style={[styles.uploadFormLabel, { color: colors.textPrimary }]}>Exam Type</Text>
          <View style={styles.formChipRow}>
            {(['Mid Sem', 'End Sem', 'Back Paper'] as const).map((t) => (
              <Chip
                key={t}
                label={t}
                selected={uploadExamType === t}
                onPress={() => setUploadExamType(t)}
                style={styles.formChip}
              />
            ))}
          </View>

          <Text style={[styles.uploadFormLabel, { color: colors.textPrimary }]}>Programme</Text>
          <View style={styles.formChipRow}>
            {(PROGRAMMES_BY_SCHOOL[uploadSchool] || []).map((p) => (
              <Chip
                key={p.code}
                label={`${p.code} (${p.label})`}
                selected={!isCustomProgramme && uploadProgramme === p.code}
                onPress={() => {
                  setIsCustomProgramme(false);
                  setUploadProgramme(p.code);
                }}
                style={styles.formChip}
              />
            ))}
            <Chip
              key="custom_programme_chip"
              label="Custom"
              selected={isCustomProgramme}
              onPress={() => {
                setIsCustomProgramme(true);
                if (customProgrammeText.trim()) {
                  setUploadProgramme(customProgrammeText.trim().toUpperCase());
                }
              }}
              style={styles.formChip}
            />
          </View>

          {isCustomProgramme && (
            <TextInput
              value={customProgrammeText}
              onChangeText={(txt) => {
                setCustomProgrammeText(txt);
                setUploadProgramme(txt.trim().toUpperCase());
              }}
              placeholder="Enter programme code (e.g. DUAL, PHD, ROBOTICS)"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="characters"
              accessibilityLabel="Custom programme code"
              style={[
                styles.formInput,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.borderGlass,
                  color: colors.textPrimary,
                  marginTop: 2,
                  marginBottom: 6,
                },
              ]}
            />
          )}

          <Text style={[styles.uploadFormLabel, { color: colors.textPrimary }]}>Semester</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.formChipScrollHorizontal}>
            {UPLOAD_SEMESTERS.map((s) => (
              <Chip
                key={`upload_sem_${s}`}
                label={`Sem ${s}`}
                selected={uploadSemester === s}
                onPress={() => setUploadSemester(s)}
                style={styles.formChip}
              />
            ))}
          </ScrollView>

          <Text style={[styles.uploadFormLabel, { color: colors.textPrimary }]}>Exam Year</Text>
          <TextInput
            value={uploadYear}
            onChangeText={setUploadYear}
            placeholder="2025"
            placeholderTextColor={colors.textTertiary}
            keyboardType="number-pad"
            style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.borderGlass, color: colors.textPrimary }]}
            accessibilityLabel="Exam year"
          />

          <Text style={[styles.uploadFormLabel, { color: colors.textPrimary }]}>Paper File (PDF, JPG or PNG)</Text>
          {pickedFile ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.borderGlass,
                borderWidth: 1,
                borderRadius: 12,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
                {pickedFile.mimeType && pickedFile.mimeType.startsWith('image/') ? (
                  <Image
                    source={{ uri: pickedFile.uri }}
                    style={{ width: 44, height: 44, borderRadius: 8, marginRight: 12, backgroundColor: colors.surfaceAlt }}
                  />
                ) : (
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      backgroundColor: colors.accentSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <FileText size={22} color={colors.accent} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: 'Inter-SemiBold',
                      color: colors.textPrimary,
                    }}
                    numberOfLines={1}
                  >
                    {pickedFile.name}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Inter-Regular',
                      color: colors.textSecondary,
                      marginTop: 2,
                    }}
                  >
                    {pickedFile.size === null
                      ? 'Size unknown · Ready to upload'
                      : `${Math.round(pickedFile.size / 1024)} KB · Ready to upload`}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  onPress={handlePickFile}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: colors.surfaceAlt,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Change selected paper file"
                >
                  <Text style={{ fontSize: 12, fontFamily: 'Inter-Medium', color: colors.textPrimary }}>Change</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setPickedFile(null)}
                  style={{
                    padding: 6,
                    borderRadius: 8,
                    backgroundColor: colors.dangerSoft || 'rgba(239, 68, 68, 0.1)',
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Remove selected paper file"
                >
                  <X size={16} color={colors.danger || '#EF4444'} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handlePickFile}
              style={[
                styles.filePicker,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.borderGlass,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Choose the question paper file"
            >
              <FileText size={16} color={colors.textSecondary} />
              <Text
                style={[
                  styles.filePickerText,
                  { color: colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                Choose PDF, JPG or PNG (max 20 MB)
              </Text>
            </TouchableOpacity>
          )}

          {/* Moderation Disclaimer */}
          <View style={[styles.moderationDisclaimer, { backgroundColor: colors.warningSoft }]}>
            <AlertTriangle size={15} color={colors.warning} />
            <Text style={[styles.moderationDisclaimerText, { color: colors.warning }]}>
              All uploads are reviewed by student moderators before being listed. Only submit clean, legible question papers.
            </Text>
          </View>

          <PillButton
            label="Submit Question Paper"
            onPress={() => void handleSubmitUpload()}
            loading={uploading}
            disabled={uploading}
            variant="primary"
            size="md"
            icon={<FileText size={16} color={colors.onAccent} style={{ marginRight: 6 }} />}
            style={{ marginTop: 14 }}
          />

          <Text style={[styles.uploadHint, { color: colors.textTertiary }]}>
            A moderator reviews your paper before it is listed on GBU One. +50 points are added once it is approved.
          </Text>
        </View>
      </BottomSheet>

      {/* Paper Details & Download Bottom Sheet */}
      <BottomSheet
        visible={detailSheetVisible}
        onClose={() => setDetailSheetVisible(false)}
        title={detailPaper ? `${detailPaper.subjectCode} • ${detailPaper.examType}` : 'Question Paper'}
      >
        {detailPaper && (
          <View style={styles.sheetContent}>
            <Text style={[styles.detailSheetTitle, { color: colors.textPrimary }]}>
              {detailPaper.subjectName}
            </Text>

            <View style={styles.detailBadgeRow}>
              <View style={[styles.detailBadge, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.detailBadgeText, { color: colors.accent }]}>{detailPaper.school}</Text>
              </View>
              <View style={[styles.detailBadge, { backgroundColor: colors.surfaceMuted }]}>
                <Text style={[styles.detailBadgeText, { color: colors.textSecondary }]}>{detailPaper.programme}</Text>
              </View>
              <View style={[styles.detailBadge, { backgroundColor: colors.surfaceMuted }]}>
                <Text style={[styles.detailBadgeText, { color: colors.textSecondary }]}>{detailPaper.semester}</Text>
              </View>
              <View style={[styles.detailBadge, { backgroundColor: colors.warningSoft }]}>
                <Text style={[styles.detailBadgeText, { color: colors.warning }]}>{detailPaper.year}</Text>
              </View>
            </View>

            <View style={styles.detailStatsRow}>
              <Download size={14} color={colors.textSecondary} />
              <Text style={[styles.detailStatsText, { color: colors.textSecondary }]}>
                {detailPaper.downloads} downloads
              </Text>
            </View>

            {detailPaper.fileUrl ? (
              <View style={{ marginTop: 16, gap: 10 }}>
                <PillButton
                  label="Download & View Paper"
                  variant="primary"
                  size="md"
                  icon={<Download size={16} color={colors.onAccent} style={{ marginRight: 6 }} />}
                  onPress={() => handleSingleDownload(detailPaper)}
                />

                <PillButton
                  label={selectedIds.includes(detailPaper.id) ? "Deselect for Batch Download" : "Select for Batch Download"}
                  variant={selectedIds.includes(detailPaper.id) ? "outline" : "primary"}
                  size="md"
                  onPress={() => {
                    toggleSelect(detailPaper.id);
                    setDetailSheetVisible(false);
                    showToast(selectedIds.includes(detailPaper.id) ? "Removed from download queue" : "Added to download queue");
                  }}
                />

                <PillButton
                  label="Report Incorrect Paper"
                  variant="outline"
                  size="md"
                  onPress={() => {
                    setDetailSheetVisible(false);
                    handleOpenReport(detailPaper);
                  }}
                />
              </View>
            ) : (
              <View style={{ marginTop: 14 }}>
                <View style={[styles.notUploadedNotice, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderGlass }]}>
                  <Text style={[styles.notUploadedNoticeTitle, { color: colors.textPrimary }]}>
                    Paper Not Uploaded Yet
                  </Text>
                  <Text style={[styles.notUploadedNoticeDesc, { color: colors.textSecondary }]}>
                    No student has uploaded the question paper for {detailPaper.subjectCode} yet. If you have this paper, contribute it now to earn contributor credits and help your fellow students!
                  </Text>
                </View>

                <PillButton
                  label="Upload This Paper Now"
                  variant="primary"
                  size="md"
                  icon={<UploadCloud size={16} color={colors.onAccent} style={{ marginRight: 6 }} />}
                  onPress={() => {
                    setDetailSheetVisible(false);
                    setUploadSubjectCode(detailPaper.subjectCode);
                    setUploadSubjectName(detailPaper.subjectName);
                    setUploadSchool(detailPaper.school || 'SOICT');
                    setUploadProgramme(detailPaper.programme || 'BCS');
                    const cleanSem = detailPaper.semester.replace(/^Sem\s*/i, '');
                    setUploadSemester(cleanSem || 'I');
                    setUploadExamType(detailPaper.examType || 'Mid Sem');
                    setUploadSheetVisible(true);
                  }}
                  style={{ marginTop: 12 }}
                />
              </View>
            )}
          </View>
        )}
      </BottomSheet>

      {/* Reporting Bottom Sheet */}
      <BottomSheet
        visible={reportSheetVisible}
        onClose={() => setReportSheetVisible(false)}
        title="Report Paper"
      >
        <View style={styles.sheetContent}>
          <Text style={[styles.gateTitle, { color: colors.textPrimary }]}>Report {reportingPaper?.subjectCode}</Text>
          <Text style={[styles.gateSubtitle, { color: colors.textSecondary }]}>
            Help us maintain clean academic resources. What is the issue with this paper?
          </Text>

          {[
            'Incomplete or blurred scan',
            'Incorrect subject or semester',
            'Wrong exam year or duplicate',
            'Other / Custom feedback',
          ].map((reasonOption) => {
            const isSelected = selectedReportReason === reasonOption;
            return (
              <TouchableOpacity
                key={reasonOption}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={reasonOption}
                style={[
                  styles.reportOption,
                  {
                    backgroundColor: isSelected ? colors.accentSoft : colors.surfaceMuted,
                    borderColor: isSelected ? colors.accent : colors.borderGlass,
                  },
                ]}
                onPress={() => setSelectedReportReason(reasonOption)}
              >
                <Text
                  style={[
                    styles.reportOptionText,
                    { color: isSelected ? colors.accent : colors.textPrimary, fontWeight: isSelected ? '700' : '500' },
                  ]}
                >
                  {reasonOption}
                </Text>
              </TouchableOpacity>
            );
          })}

          <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 12 }]}>
            Additional Details or Explanation (Optional):
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.textPrimary,
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.borderGlass,
                height: 70,
                textAlignVertical: 'top',
                paddingTop: 8,
              },
            ]}
            placeholder="Type your notes or describe what needs correction..."
            placeholderTextColor={colors.textTertiary}
            value={reportCustomNote}
            onChangeText={setReportCustomNote}
            multiline
            numberOfLines={3}
            accessibilityLabel="Additional details for the report"
          />

          <PillButton
            label="Submit Report to Admin"
            variant="primary"
            size="md"
            loading={reporting}
            disabled={reporting}
            onPress={() => void handleSendReport()}
            style={{ marginTop: 14 }}
          />

          <Text style={[styles.takedownEmailNote, { color: colors.textTertiary, marginTop: 10 }]}>
            Student ID: {user?.uniqueStudentId || 'Guest Scholar'} • Direct moderation review
          </Text>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
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
  },
  headerSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 2,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: 999,
    gap: 4,
  },
  uploadBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  leaderboardBanner: {
    marginHorizontal: theme.spacing.lg,
    marginTop: 6,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  leaderboardBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  leaderboardBannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  leaderboardBannerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 13,
  },
  leaderboardBannerAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leaderboardBannerActionText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
  },
  leaderboardEmpty: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    flex: 1,
  },
  top3Row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  top3Item: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  top3AvatarRing: {
    position: 'relative',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 1,
  },
  top3Medal: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    fontSize: 10,
  },
  top3Details: {
    flex: 1,
  },
  top3Name: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
  },
  top3Points: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
  },
  searchSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
  },
  queuedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.card,
    borderWidth: 1,
  },
  queuedBannerText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 17,
  },
  queueToggle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  queueList: {
    marginTop: 8,
    gap: 8,
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  queueTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  queueSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 2,
  },
  queueAction: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.chip,
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    height: '100%',
  },
  filterSection: {
    paddingVertical: 6,
  },
  filterScroll: {
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  },
  examTabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  examTab: {
    flex: 1,
    minHeight: 44,
    borderRadius: theme.radius.chip,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  examTabText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    textAlign: 'center',
  },
  filterChip: {
    marginRight: 6,
    marginBottom: 0,
  },
  filterDivider: {
    width: 1,
    height: 20,
    marginHorizontal: 8,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 130,
  },
  trendingSection: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
  },
  trendingScroll: {
    paddingRight: theme.spacing.lg,
    gap: 10,
  },
  trendingCard: {
    width: 170,
    padding: 12,
  },
  trendDownloads: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
  },
  trendTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    marginVertical: 4,
  },
  allPapersHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultsCount: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  card: {
    width: CARD_WIDTH,
    padding: theme.spacing.md,
    minHeight: 145,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  badgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
  },
  subjectName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  metaRow: {
    marginBottom: 6,
  },
  typeText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
  },
  programmeTag: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    marginTop: 2,
  },
  selectToggle: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
  },
  downloadCount: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
  },
  takedownSection: {
    marginTop: 24,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  takedownText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    lineHeight: 16,
  },
  floatingActionBar: {
    position: 'absolute',
    bottom: 96,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  floatingCountText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  floatingClear: {
    minHeight: 44,
    justifyContent: 'center',
  },
  floatingClearText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  detailSheetTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    marginBottom: 8,
  },
  detailBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  detailBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  detailBadgeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
  },
  detailStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  detailStatsText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  sheetContent: {
    paddingVertical: 8,
  },
  gateTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    marginBottom: 4,
  },
  gateSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  uploadFormLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    marginBottom: 6,
    marginTop: 10,
  },
  formInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    minHeight: 44,
  },
  formChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  formChipScrollHorizontal: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  filePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
  filePickerText: {
    flex: 1,
    fontFamily: 'Inter-Medium',
    fontSize: 13,
  },
  formChip: {
    marginBottom: 4,
  },
  moderationDisclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginVertical: 12,
  },
  moderationDisclaimerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  reportOption: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    minHeight: 44,
  },
  reportOptionText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
  },
  takedownEmailNote: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
  },
  fileStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  fileStatusText: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
  },
  notUploadedNotice: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  notUploadedNoticeTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    marginBottom: 4,
  },
  notUploadedNoticeDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  inputLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
  },
});
