import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Search,
  Download,
  UploadCloud,
  CheckCircle2,
  Flame,
  AlertTriangle,
  FileText,
  X,
  Flag,
} from 'lucide-react-native';
import { GlassCard, PillButton, Toast, BottomSheet, Chip, EmptyState } from '../../src/components/ui';
import { useAuthStore } from '../../src/store/useAuthStore';
import { PYQItem, MOCK_PAPERS, filterPapers } from '../../src/features/pyq/pyqService';
import { useAppTheme } from '../../src/lib/ThemeContext';
import { theme } from '../../src/lib/theme';

const SCHOOL_FILTERS = ['All', 'SOICT', 'SOM', 'SOBT', 'SOE', 'SOL'];
const SEMESTER_FILTERS = ['All', 'Sem I', 'Sem II', 'Sem III', 'Sem IV', 'Sem V', 'Sem VI', 'Sem VII', 'Sem VIII'];
const EXAM_TYPE_TABS = ['All', 'Mid Sem', 'End Sem', 'Back Paper'] as const;
type ExamTab = (typeof EXAM_TYPE_TABS)[number];
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - theme.spacing.lg * 2 - 12) / 2);

export default function PYQScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { isGuest } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('All');
  const [selectedSemester, setSelectedSemester] = useState('All');
  const [examTab, setExamTab] = useState<ExamTab>('All');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [uploadSheetVisible, setUploadSheetVisible] = useState(false);
  const [guestGateVisible, setGuestGateVisible] = useState(false);
  const [reportingPaper, setReportingPaper] = useState<PYQItem | null>(null);
  const [reportSheetVisible, setReportSheetVisible] = useState(false);

  // Upload form state
  const [uploadSubjectCode, setUploadSubjectCode] = useState('');
  const [uploadSubjectName, setUploadSubjectName] = useState('');
  const [uploadSchool, setUploadSchool] = useState('SOICT');
  const [uploadExamType, setUploadExamType] = useState<'Mid Sem' | 'End Sem' | 'Back Paper'>('Mid Sem');

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  const handleBulkDownload = () => {
    if (selectedIds.length === 0) return;
    setToastMessage(`Bulk download (${selectedIds.length} papers) is coming soon with cloud storage integration.`);
    setToastVisible(true);
    setSelectedIds([]);
  };

  const handleUploadPress = () => {
    if (isGuest) {
      setGuestGateVisible(true);
    } else {
      setUploadSheetVisible(true);
    }
  };

  const handleOpenReport = (paper: PYQItem) => {
    setReportingPaper(paper);
    setReportSheetVisible(true);
  };

  const handleSendReport = (reason: string) => {
    setReportSheetVisible(false);
    setToastMessage(`Report received: moderation queue will review ${reportingPaper?.subjectCode} (${reason}).`);
    setToastVisible(true);
  };

  const handleSubmitUpload = () => {
    if (!uploadSubjectCode.trim()) {
      setToastMessage('Please enter subject code (e.g. CSE205)');
      setToastVisible(true);
      return;
    }
    setUploadSheetVisible(false);
    setToastMessage(`Upload submitted: ${uploadSubjectCode.toUpperCase()} is queued for cloud storage sync.`);
    setToastVisible(true);
    setUploadSubjectCode('');
    setUploadSubjectName('');
  };

  const filteredPapers = filterPapers(
    MOCK_PAPERS,
    searchQuery,
    selectedSchool,
    selectedSemester,
    examTab,
  );

  const trendingPapers = [...MOCK_PAPERS].sort((a, b) => b.downloads - a.downloads).slice(0, 3);

  const renderPaperItem = ({ item: paper }: { item: PYQItem }) => {
    const isSelected = selectedIds.includes(paper.id);

    return (
      <GlassCard
        key={paper.id}
        style={[styles.card, isSelected && { backgroundColor: colors.accentSoft }]}
        accentBorder={isSelected}
        onPress={() => toggleSelect(paper.id)}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17, 24, 39, 0.08)' }]}>
            <Text style={[styles.badgeText, { color: colors.accent }]}>{paper.subjectCode}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                handleOpenReport(paper);
              }}
              hitSlop={8}
            >
              <Flag size={13} color={colors.textTertiary} />
            </TouchableOpacity>
            {isSelected && (
              <CheckCircle2 size={16} color={colors.accent} />
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

        <View style={styles.downloadRow}>
          <Download size={12} color={colors.textSecondary} />
          <Text style={[styles.downloadCount, { color: colors.textSecondary }]}>{paper.downloads} downloads</Text>
        </View>
      </GlassCard>
    );
  };

  const renderHeader = () => (
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
                  <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17, 24, 39, 0.08)' }]}>
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
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>All Question Papers</Text>
        <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
          {filteredPapers.length} paper{filteredPapers.length === 1 ? '' : 's'}
        </Text>
      </View>
    </View>
  );

  const renderFooter = () => (
    <View style={[styles.takedownSection, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderGlass }]}>
      <Text style={[styles.takedownText, { color: colors.textSecondary }]}>
        DMCA & University Copyright Notice: Question papers uploaded are submitted by students for academic non-commercial revision. Gautam Buddha University holds official curriculum copyright.
      </Text>
    </View>
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
          style={[styles.uploadBtn, { backgroundColor: colors.accentSoft, borderColor: `${colors.accent}44` }]}
          onPress={handleUploadPress}
        >
          <UploadCloud size={16} color={colors.accent} />
          <Text style={[styles.uploadBtnText, { color: colors.accent }]}>Upload</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.borderGlass }]}>
          <Search size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by subject name or code..."
            placeholderTextColor={colors.textTertiary}
            style={[styles.searchInput, { color: colors.textPrimary }]}
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
        initialNumToRender={8}
        maxToRenderPerBatch={10}
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
            <TouchableOpacity onPress={() => setSelectedIds([])}>
              <Text style={[styles.floatingClearText, { color: colors.textSecondary }]}>Clear</Text>
            </TouchableOpacity>
          </View>
          <PillButton
            label="Download ZIP"
            onPress={handleBulkDownload}
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

      {/* Guest Gate Bottom Sheet */}
      <BottomSheet
        visible={guestGateVisible}
        onClose={() => setGuestGateVisible(false)}
        title="Account Required"
      >
        <View style={styles.sheetContent}>
          <Text style={[styles.gateTitle, { color: colors.textPrimary }]}>Create a student account to upload</Text>
          <Text style={[styles.gateSubtitle, { color: colors.textSecondary }]}>
            To maintain academic integrity, PYQ contributions are moderated and linked to student profiles.
          </Text>
          <PillButton
            label="Log In / Sign Up"
            onPress={() => setGuestGateVisible(false)}
            variant="primary"
            size="md"
            style={{ marginTop: 16 }}
          />
        </View>
      </BottomSheet>

      {/* Upload Bottom Sheet */}
      <BottomSheet
        visible={uploadSheetVisible}
        onClose={() => setUploadSheetVisible(false)}
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
          />

          <Text style={[styles.uploadFormLabel, { color: colors.textPrimary }]}>Subject Name</Text>
          <TextInput
            value={uploadSubjectName}
            onChangeText={setUploadSubjectName}
            placeholder="e.g. Data Structures & Algorithms"
            placeholderTextColor={colors.textTertiary}
            style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.borderGlass, color: colors.textPrimary }]}
          />

          <Text style={[styles.uploadFormLabel, { color: colors.textPrimary }]}>School</Text>
          <View style={styles.formChipRow}>
            {['SOICT', 'SOM', 'SOBT', 'SOE'].map((s) => (
              <Chip
                key={s}
                label={s}
                selected={uploadSchool === s}
                onPress={() => setUploadSchool(s)}
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

          {/* Moderation Disclaimer */}
          <View style={[styles.moderationDisclaimer, { backgroundColor: colors.warningSoft }]}>
            <AlertTriangle size={15} color={colors.warning} />
            <Text style={[styles.moderationDisclaimerText, { color: colors.warning }]}>
              All uploads are reviewed by student moderators before being listed. Only submit clean, legible question papers.
            </Text>
          </View>

          <PillButton
            label="Submit Question Paper"
            onPress={handleSubmitUpload}
            variant="primary"
            size="md"
            icon={<FileText size={16} color={colors.onAccent} style={{ marginRight: 6 }} />}
            style={{ marginTop: 14 }}
          />
        </View>
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
            Help us maintain clean, authentic academic resources. Select a reason:
          </Text>

          <TouchableOpacity
            style={[styles.reportOption, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderGlass }]}
            onPress={() => handleSendReport('Incomplete or blurred scan')}
          >
            <Text style={[styles.reportOptionText, { color: colors.textPrimary }]}>Incomplete, low resolution or blurred scan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reportOption, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderGlass }]}
            onPress={() => handleSendReport('Incorrect subject or semester')}
          >
            <Text style={[styles.reportOptionText, { color: colors.textPrimary }]}>Incorrect subject or semester label</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reportOption, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderGlass }]}
            onPress={() => handleSendReport('Copyright / Takedown request')}
          >
            <Text style={[styles.reportOptionText, { color: colors.textPrimary }]}>Copyright / Takedown request</Text>
          </TouchableOpacity>

          <Text style={[styles.takedownEmailNote, { color: colors.textTertiary }]}>
            Takedown inquiries: student.gbuone@gmail.com
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
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  uploadBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  searchSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.chip,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 42,
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
    minHeight: 40,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
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
  downloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  floatingClearText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 2,
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
  },
  formChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
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
});
