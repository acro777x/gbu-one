import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { theme } from '../../src/lib/theme';

const SCHOOL_FILTERS = ['All', 'SOICT', 'SOM', 'SOBT', 'SOE', 'SOL'];
const SEMESTER_FILTERS = ['All', 'Sem I', 'Sem II', 'Sem IV'];

export default function PYQScreen() {
  const { isGuest } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('All');
  const [selectedSemester, setSelectedSemester] = useState('All');
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
      let next;
      if (prev.includes(id)) {
        next = prev.filter((item) => item !== id);
      } else {
        next = [...prev, id];
        setToastMessage(`Selected ${next.length} paper${next.length > 1 ? 's' : ''}`);
        setToastVisible(true);
      }
      return next;
    });
  };

  const handleBulkDownload = () => {
    if (selectedIds.length === 0) return;
    setToastMessage(`Downloading ${selectedIds.length} paper${selectedIds.length > 1 ? 's' : ''} as ZIP bundle...`);
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
    setToastMessage(`Report submitted for ${reportingPaper?.subjectCode} (${reason})`);
    setToastVisible(true);
  };

  const handleSubmitUpload = () => {
    if (!uploadSubjectCode.trim()) {
      setToastMessage('Please enter subject code (e.g. CSE205)');
      setToastVisible(true);
      return;
    }
    setUploadSheetVisible(false);
    setToastMessage(`Uploaded ${uploadSubjectCode.toUpperCase()}. Submitted for student review.`);
    setToastVisible(true);
    setUploadSubjectCode('');
    setUploadSubjectName('');
  };

  const filteredPapers = filterPapers(
    MOCK_PAPERS,
    searchQuery,
    selectedSchool,
    selectedSemester,
  );

  const trendingPapers = [...MOCK_PAPERS].sort((a, b) => b.downloads - a.downloads).slice(0, 3);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Previous Year Papers</Text>
          <Text style={styles.headerSub}>Crowdsourced PYQ repository for GBU</Text>
        </View>

        <TouchableOpacity style={styles.uploadBtn} onPress={handleUploadPress}>
          <UploadCloud size={16} color={theme.colors.accent} />
          <Text style={styles.uploadBtnText}>Upload</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={18} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by subject name or code..."
            placeholderTextColor="rgba(255, 255, 255, 0.3)"
            style={styles.searchInput}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
              <X size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
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
              onRemove={selectedSchool === sch && sch !== 'All' ? () => setSelectedSchool('All') : undefined}
              style={styles.filterChip}
            />
          ))}
          <View style={styles.filterDivider} />
          {SEMESTER_FILTERS.map((sem) => (
            <Chip
              key={sem}
              label={sem}
              selected={selectedSemester === sem}
              onPress={() => setSelectedSemester(sem)}
              onRemove={selectedSemester === sem && sem !== 'All' ? () => setSelectedSemester('All') : undefined}
              style={styles.filterChip}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Trending Row */}
        {searchQuery === '' && selectedSchool === 'All' && (
          <View style={styles.trendingSection}>
            <View style={styles.sectionHeaderRow}>
              <Flame size={16} color={theme.colors.accent} />
              <Text style={styles.sectionTitle}>Trending Papers</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingScroll}>
              {trendingPapers.map((paper) => (
                <GlassCard
                  key={`trend_${paper.id}`}
                  style={styles.trendingCard}
                  onPress={() => toggleSelect(paper.id)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{paper.subjectCode}</Text>
                    </View>
                    <Text style={styles.trendDownloads}>{paper.downloads} dl</Text>
                  </View>
                  <Text style={styles.trendTitle} numberOfLines={2}>{paper.subjectName}</Text>
                  <Text style={styles.typeText}>{paper.year} • {paper.examType}</Text>
                </GlassCard>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Papers Grid */}
        <View style={styles.allPapersHeaderRow}>
          <Text style={styles.sectionTitle}>All Question Papers</Text>
          <Text style={styles.resultsCount}>
            {filteredPapers.length} paper{filteredPapers.length === 1 ? '' : 's'}
          </Text>
        </View>

        {filteredPapers.length === 0 ? (
          <EmptyState
            title="No papers found"
            description="Try selecting a different school, semester or search keyword."
          />
        ) : (
          <View style={styles.grid}>
            {filteredPapers.map((paper) => {
              const isSelected = selectedIds.includes(paper.id);

              return (
                <GlassCard
                  key={paper.id}
                  style={[styles.card, isSelected && styles.cardSelected]}
                  accentBorder={isSelected}
                  onPress={() => toggleSelect(paper.id)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{paper.subjectCode}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleOpenReport(paper);
                        }}
                        hitSlop={8}
                      >
                        <Flag size={13} color="rgba(255, 255, 255, 0.3)" />
                      </TouchableOpacity>
                      {isSelected && (
                        <CheckCircle2 size={16} color={theme.colors.accent} />
                      )}
                    </View>
                  </View>

                  <Text style={styles.subjectName} numberOfLines={2}>
                    {paper.subjectName}
                  </Text>

                  <View style={styles.metaRow}>
                    <Text style={styles.typeText}>
                      {paper.year} • {paper.examType}
                    </Text>
                    <Text style={styles.programmeTag}>
                      {paper.programme} ({paper.semester})
                    </Text>
                  </View>

                  <View style={styles.downloadRow}>
                    <Download size={12} color={theme.colors.textSecondary} />
                    <Text style={styles.downloadCount}>{paper.downloads} downloads</Text>
                  </View>
                </GlassCard>
              );
            })}
          </View>
        )}

        {/* Copyright / Takedown note */}
        <View style={styles.takedownSection}>
          <Text style={styles.takedownText}>
            Papers are uploaded by student contributors under fair educational use. If you believe a file infringes copyright or contains errors, tap the flag icon or email student.gbuone@gmail.com for prompt takedown.
          </Text>
        </View>
      </ScrollView>

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <View style={styles.floatingActionBar}>
          <View style={styles.selectedCountBadge}>
            <Text style={styles.selectedCountText}>{selectedIds.length} Selected</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <PillButton
              label="Clear"
              onPress={() => setSelectedIds([])}
              variant="outline"
              size="sm"
            />
            <PillButton
              label={`Download ZIP (${selectedIds.length})`}
              onPress={handleBulkDownload}
              variant="primary"
              size="sm"
              icon={<Download size={15} color={theme.colors.ivory} style={{ marginRight: 6 }} />}
            />
          </View>
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
          <Text style={styles.gateTitle}>Create a student account to upload</Text>
          <Text style={styles.gateSubtitle}>
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
          <Text style={styles.uploadFormLabel}>Subject Code</Text>
          <TextInput
            value={uploadSubjectCode}
            onChangeText={setUploadSubjectCode}
            placeholder="e.g. CSE205"
            placeholderTextColor="rgba(255, 255, 255, 0.3)"
            style={styles.formInput}
            autoCapitalize="characters"
          />

          <Text style={styles.uploadFormLabel}>Subject Name</Text>
          <TextInput
            value={uploadSubjectName}
            onChangeText={setUploadSubjectName}
            placeholder="e.g. Data Structures & Algorithms"
            placeholderTextColor="rgba(255, 255, 255, 0.3)"
            style={styles.formInput}
          />

          <Text style={styles.uploadFormLabel}>School</Text>
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

          <Text style={styles.uploadFormLabel}>Exam Type</Text>
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
          <View style={styles.moderationDisclaimer}>
            <AlertTriangle size={15} color={theme.colors.warning} />
            <Text style={styles.moderationDisclaimerText}>
              All uploads are reviewed by student moderators before being listed. Only submit clean, legible question papers.
            </Text>
          </View>

          <PillButton
            label="Submit Question Paper"
            onPress={handleSubmitUpload}
            variant="primary"
            size="md"
            icon={<FileText size={16} color={theme.colors.ivory} style={{ marginRight: 6 }} />}
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
          <Text style={styles.gateTitle}>Report {reportingPaper?.subjectCode}</Text>
          <Text style={styles.gateSubtitle}>
            Help us maintain clean, authentic academic resources. Select a reason:
          </Text>

          <TouchableOpacity
            style={styles.reportOption}
            onPress={() => handleSendReport('Incomplete or blurred scan')}
          >
            <Text style={styles.reportOptionText}>Incomplete, low resolution or blurred scan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.reportOption}
            onPress={() => handleSendReport('Incorrect subject or semester')}
          >
            <Text style={styles.reportOptionText}>Incorrect subject or semester label</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.reportOption}
            onPress={() => handleSendReport('Copyright / Takedown request')}
          >
            <Text style={styles.reportOptionText}>Copyright / Takedown request</Text>
          </TouchableOpacity>

          <Text style={styles.takedownEmailNote}>
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
    backgroundColor: theme.colors.bg,
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
    color: theme.colors.ivory,
  },
  headerSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 106, 43, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 43, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  uploadBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: theme.colors.accent,
  },
  searchSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161618',
    borderRadius: theme.radius.chip,
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
    paddingHorizontal: 14,
    height: 42,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.ivory,
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
  filterChip: {
    marginRight: 6,
    marginBottom: 0,
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
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
    color: theme.colors.ivory,
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
    color: theme.colors.accent,
  },
  trendTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: theme.colors.ivory,
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
    color: theme.colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '48%',
    padding: theme.spacing.md,
    minHeight: 145,
    justifyContent: 'space-between',
  },
  cardSelected: {
    backgroundColor: 'rgba(255, 106, 43, 0.12)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: theme.colors.accent,
  },
  subjectName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: theme.colors.ivory,
    lineHeight: 18,
    marginBottom: 6,
  },
  metaRow: {
    marginBottom: 6,
  },
  typeText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  programmeTag: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.4)',
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
    color: theme.colors.textSecondary,
  },
  takedownSection: {
    marginTop: 24,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  takedownText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    lineHeight: 16,
  },
  floatingActionBar: {
    position: 'absolute',
    bottom: 84,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    backgroundColor: 'rgba(20, 20, 24, 0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  selectedCountBadge: {
    backgroundColor: 'rgba(255, 106, 43, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  selectedCountText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: theme.colors.accent,
  },
  sheetContent: {
    paddingVertical: 8,
  },
  gateTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: theme.colors.ivory,
    marginBottom: 6,
  },
  gateSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  uploadFormLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 10,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formInput: {
    backgroundColor: '#161618',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.ivory,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  formChipRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  formChip: {
    marginBottom: 0,
  },
  moderationDisclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 8,
    padding: 10,
    marginTop: 14,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.warning,
  },
  moderationDisclaimerText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.warning,
    lineHeight: 16,
  },
  reportOption: {
    backgroundColor: '#161618',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    marginBottom: 8,
  },
  reportOptionText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: theme.colors.ivory,
  },
  takedownEmailNote: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});
