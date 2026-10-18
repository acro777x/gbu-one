import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Search, Download, UploadCloud, CheckCircle2 } from 'lucide-react-native';
import { GlassCard, PillButton, Toast, BottomSheet } from '../../src/components/ui';
import { useAuthStore } from '../../src/store/useAuthStore';
import { theme } from '../../src/lib/theme';

interface PYQItem {
  id: string;
  subjectCode: string;
  subjectName: string;
  year: number;
  examType: 'Mid Sem' | 'End Sem' | 'Back Paper';
  downloads: number;
  status: 'approved' | 'pending';
}

const MOCK_PAPERS: PYQItem[] = [
  { id: 'p1', subjectCode: 'CSE205', subjectName: 'Data Structures & Algorithms', year: 2025, examType: 'Mid Sem', downloads: 320, status: 'approved' },
  { id: 'p2', subjectCode: 'CSE209', subjectName: 'Operating Systems', year: 2025, examType: 'End Sem', downloads: 294, status: 'approved' },
  { id: 'p3', subjectCode: 'BAS201', subjectName: 'Discrete Mathematics', year: 2024, examType: 'End Sem', downloads: 185, status: 'approved' },
  { id: 'p4', subjectCode: 'CSE201', subjectName: 'Object Oriented Programming with Java', year: 2025, examType: 'Mid Sem', downloads: 240, status: 'approved' },
  { id: 'p5', subjectCode: 'CSE207', subjectName: 'Computer Organization & Architecture', year: 2024, examType: 'Back Paper', downloads: 92, status: 'approved' },
  { id: 'p6', subjectCode: 'CSE211', subjectName: 'Database Management Systems', year: 2025, examType: 'End Sem', downloads: 164, status: 'approved' },
];

export default function PYQScreen() {
  const { isGuest } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [uploadSheetVisible, setUploadSheetVisible] = useState(false);
  const [guestGateVisible, setGuestGateVisible] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      let next;
      if (prev.includes(id)) {
        next = prev.filter((item) => item !== id);
      } else {
        next = [...prev, id];
        setToastMessage(`Added ${next.length} paper${next.length > 1 ? 's' : ''} to download queue`);
        setToastVisible(true);
      }
      return next;
    });
  };

  const handleUploadPress = () => {
    if (isGuest) {
      setGuestGateVisible(true);
    } else {
      setUploadSheetVisible(true);
    }
  };

  const filteredPapers = MOCK_PAPERS.filter(
    (p) =>
      p.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.subjectCode.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Previous Year Papers</Text>
          <Text style={styles.headerSub}>Crowdsourced PYQ repository for GBU</Text>
        </View>

        <TouchableOpacity style={styles.uploadBtn} onPress={handleUploadPress}>
          <UploadCloud size={18} color={theme.colors.accent} />
          <Text style={styles.uploadBtnText}>Upload</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
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
        </View>
      </View>

      {/* 2-Column Grid */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
                  {isSelected && (
                    <CheckCircle2 size={16} color={theme.colors.accent} />
                  )}
                </View>

                <Text style={styles.subjectName} numberOfLines={2}>
                  {paper.subjectName}
                </Text>

                <View style={styles.metaRow}>
                  <Text style={styles.typeText}>{paper.year} • {paper.examType}</Text>
                </View>

                <View style={styles.downloadRow}>
                  <Download size={12} color={theme.colors.textSecondary} />
                  <Text style={styles.downloadCount}>{paper.downloads} downloads</Text>
                </View>
              </GlassCard>
            );
          })}
        </View>
      </ScrollView>

      {/* Floating Selection Toast */}
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
          <Text style={styles.gateTitle}>Create a free account to upload</Text>
          <Text style={styles.gateSubtitle}>
            To maintain high academic standards, PYQ uploads are moderated and tied to student profiles.
          </Text>
          <PillButton
            label="Create account"
            onPress={() => {
              setGuestGateVisible(false);
            }}
            variant="primary"
            size="md"
            style={{ marginTop: 16 }}
          />
          <PillButton
            label="Not now"
            onPress={() => setGuestGateVisible(false)}
            variant="dark"
            size="sm"
            style={{ marginTop: 8 }}
          />
        </View>
      </BottomSheet>

      {/* Upload Bottom Sheet */}
      <BottomSheet
        visible={uploadSheetVisible}
        onClose={() => setUploadSheetVisible(false)}
        title="Upload Paper"
      >
        <View style={styles.sheetContent}>
          <Text style={styles.gateTitle}>Contribute a Question Paper</Text>
          <Text style={styles.gateSubtitle}>
            Select your PDF or scanned paper. Uploaded papers undergo quick moderation before appearing for all students.
          </Text>
          <PillButton
            label="Select PDF file (max 20MB)"
            onPress={() => {
              setUploadSheetVisible(false);
              setToastMessage('Paper submitted for student review');
              setToastVisible(true);
            }}
            variant="primary"
            size="md"
            style={{ marginTop: 16 }}
          />
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
    paddingVertical: theme.spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161618',
    borderRadius: theme.radius.chip,
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.ivory,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    height: '100%',
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 110,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '48%',
    padding: theme.spacing.md,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  cardSelected: {
    backgroundColor: 'rgba(255, 106, 43, 0.1)',
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
    marginBottom: 8,
  },
  metaRow: {
    marginBottom: 4,
  },
  typeText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
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
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
});
