import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  Share,
  Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../src/lib/ThemeContext';
import { radius, spacing } from '../../src/lib/theme';
import { PillButton, Toast } from '../../src/components/ui';
import {
  isSafePdfUrl,
  looksLikeImageUrl,
  looksLikePdfUrl,
} from '../../src/components/pdf/pdfHelpers';
import { MOCK_NOTICES, NoticeItem } from '../../src/features/notices/noticeService';
import { useNoticesQuery } from '../../src/features/notices/useNoticesQuery';

const EXCERPT_LENGTH = 700;

/** What the notice attachment actually is, from the point of view of the actions. */
type NoticeFileKind = 'none' | 'pdf' | 'image' | 'link';

export default function NoticeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [showFullText, setShowFullText] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // Live notices first (they carry the extracted document text), then the
  // bundled seed used on first launch before the worker has synced anything.
  const { data: liveNotices = [] } = useNoticesQuery();
  const notice: NoticeItem | undefined = useMemo(
    () => liveNotices.find((n) => n.id === id) ?? MOCK_NOTICES.find((n) => n.id === id),
    [liveNotices, id],
  );
  const extractedText = notice?.rawText?.trim() ?? '';
  const hasExtractedText = extractedText.length > 0;

  // The action pair depends on what the attachment really is: a PDF is shown
  // in the app, an image is previewed inline, and anything else is only worth
  // handing to the browser.
  const fileKind: NoticeFileKind = useMemo(() => {
    const fileUrl = notice?.fileUrl ?? '';
    if (!isSafePdfUrl(fileUrl)) return 'none';
    if (notice?.fileType === 'image' || looksLikeImageUrl(fileUrl)) return 'image';
    if (notice?.fileType === 'pdf' || looksLikePdfUrl(fileUrl)) return 'pdf';
    return 'link';
  }, [notice]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
  };

  if (!notice) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.navBar, { borderBottomColor: colors.borderGlass }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={16}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </Pressable>
          <Text style={[styles.navTitle, { color: colors.textPrimary }]}>Notice Details</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.notFoundCenter}>
          <Ionicons name="alert-circle-outline" size={56} color={colors.textTertiary} />
          <Text style={[styles.notFoundTitle, { color: colors.textPrimary }]}>Notice Not Found</Text>
          <Text style={[styles.notFoundDesc, { color: colors.textSecondary }]}>
            The notice you requested may have expired, been removed, or the link is invalid.
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={[styles.notFoundBtn, { backgroundColor: colors.accentFill }]}
          >
            <Text style={styles.notFoundBtnText}>Return to Notices</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const handleShare = async () => {
    try {
      await Share.share({
        title: notice.cleanTitle,
        message: `[GBU One] ${notice.cleanTitle}\nPublished: ${new Date(notice.postedAt).toLocaleDateString()}\nDocument: ${notice.fileUrl}`,
      });
    } catch {
      // ignore
    }
  };

  /**
   * Opens the document inside the app. The viewer downloads the file first
   * and only then renders it, so the university's broken download endpoint
   * produces a readable message instead of a blank screen.
   */
  const handleViewPdf = () => {
    if (!notice) return;
    router.push({
      pathname: '/pdf',
      params: { url: notice.fileUrl, title: notice.cleanTitle },
    });
  };

  /**
   * Hands the original link to the operating system, which opens whichever
   * browser or document app the student has.
   */
  const handleOpenExternally = async () => {
    const fileUrl = notice?.fileUrl ?? '';
    if (!fileUrl) return;
    try {
      await Linking.openURL(fileUrl);
    } catch {
      showToast('No app on this device could open that link. Try the university website instead.');
    }
  };

  const getCategoryTheme = () => {
    switch (notice.category) {
      case 'datesheet':
      case 'exam':
        return { color: colors.accent, bg: colors.accentSoft, label: 'EXAMINATION' };
      case 'fees':
        return { color: colors.warning, bg: colors.warningSoft, label: 'FINANCE / FEES' };
      case 'scholarship':
        return { color: colors.success, bg: colors.successSoft, label: 'SCHOLARSHIP' };
      case 'hostel':
        return { color: colors.textSecondary, bg: colors.surfaceMuted, label: 'HOSTEL OFFICE' };
      case 'result':
        return { color: colors.success, bg: colors.successSoft, label: 'ACADEMIC RESULT' };
      default:
        return { color: colors.accent, bg: colors.accentSoft, label: notice.category.toUpperCase() };
    }
  };

  const catTheme = getCategoryTheme();
  const formattedDate = new Date(notice.postedAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const deadlineFormatted = notice.deadlineAt
    ? new Date(notice.deadlineAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Top Navigation Bar */}
      <View style={[styles.navBar, { borderBottomColor: colors.borderGlass }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={16}
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.navTitleContainer}>
          <Text numberOfLines={1} style={[styles.navTitle, { color: colors.textPrimary }]}>
            Notice Details
          </Text>
        </View>

        <Pressable
          onPress={handleShare}
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(80, insets.bottom + 40) },
        ]}
      >
        {/* Source & Category Badges */}
        <View style={styles.badgeRow}>
          <View style={[styles.pillBadge, { backgroundColor: catTheme.bg }]}>
            <Text style={[styles.pillBadgeText, { color: catTheme.color }]}>
              {catTheme.label}
            </Text>
          </View>

          <View style={[styles.sourceBadge, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name="globe-outline" size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
            <Text style={[styles.sourceBadgeText, { color: colors.textSecondary }]}>
              {notice.source === 'exams'
                ? 'exams.gbu.ac.in'
                : notice.source === 'hostel'
                  ? 'hostels.gbu.ac.in'
                  : notice.source === 'ohms'
                    ? 'ohms.gbu.ac.in'
                    : notice.source === 'csms'
                      ? 'csms.gbu.ac.in'
                      : notice.source === 'digiforms'
                        ? 'digiforms.gbu.ac.in'
                        : 'gbu.ac.in'}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>{notice.cleanTitle}</Text>

        {/* Date & Deadline Info */}
        <View style={[styles.metaCard, { backgroundColor: colors.surface, borderColor: colors.borderGlass }]}>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Published On:</Text>
            <Text style={[styles.metaValue, { color: colors.textPrimary }]}>{formattedDate}</Text>
          </View>

          {deadlineFormatted && (
            <View style={[styles.metaRow, { marginTop: spacing.sm }]}>
              <Ionicons name="alarm-outline" size={16} color={colors.danger} />
              <Text style={[styles.metaLabel, { color: colors.danger }]}>Last Date / Deadline:</Text>
              <Text style={[styles.metaValue, { color: colors.danger, fontWeight: '700' }]}>
                {deadlineFormatted}
              </Text>
            </View>
          )}

          {notice.threadUpdateCount ? (
            <View style={[styles.metaRow, { marginTop: spacing.sm }]}>
              <Ionicons name="git-branch-outline" size={16} color={colors.warning} />
              <Text style={[styles.metaLabel, { color: colors.warning }]}>Timeline Revision:</Text>
              <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                Updated {notice.threadUpdateCount} times
              </Text>
            </View>
          ) : null}
        </View>

        {/* Extracted document text (worker: PDF text layer or OCR) */}
        {hasExtractedText && (
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.borderGlass }]}>
            <View style={styles.summaryHeaderRow}>
              <View style={[styles.sparkleIcon, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="scan-outline" size={16} color={colors.accent} />
              </View>
              <Text style={[styles.summaryHeading, { color: colors.textPrimary }]}>Document Text</Text>
            </View>

            <Text style={[styles.summaryBody, { color: colors.textSecondary }]}>
              Extracted from the official file so you can read it without leaving the app.
            </Text>

            <Text style={[styles.extractedText, { color: colors.textPrimary }]}>
              {showFullText
                ? extractedText
                : `${extractedText.slice(0, EXCERPT_LENGTH)}${
                    extractedText.length > EXCERPT_LENGTH ? '…' : ''
                  }`}
            </Text>

            {extractedText.length > EXCERPT_LENGTH && (
              <Pressable
                onPress={() => setShowFullText((v) => !v)}
                style={({ pressed }) => [styles.readMoreBtn, { opacity: pressed ? 0.7 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={showFullText ? 'Show less' : 'Read the full extracted text'}
              >
                <Text style={[styles.readMoreText, { color: colors.accent }]}>
                  {showFullText ? 'Show less' : 'Read full text'}
                </Text>
                <Ionicons
                  name={showFullText ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.accent}
                />
              </Pressable>
            )}
          </View>
        )}

        {/* Key Highlights / Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.borderGlass }]}>
          <View style={styles.summaryHeaderRow}>
            <View style={[styles.sparkleIcon, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name="sparkles" size={16} color={colors.accent} />
            </View>
            <Text style={[styles.summaryHeading, { color: colors.textPrimary }]}>Summary & Key Takeaways</Text>
          </View>

          <Text style={[styles.summaryBody, { color: colors.textSecondary }]}>
            Official document released by the Gautam Buddha University {catTheme.label} division.
            Applicable to enrolled students across participating schools.
          </Text>

          <View style={styles.highlightList}>
            <View style={styles.highlightItem}>
              <Ionicons name="checkmark-circle" size={16} color={colors.accent} style={{ marginRight: 8, marginTop: 2 }} />
              <Text style={[styles.highlightText, { color: colors.textPrimary }]}>
                Original Reference: "{notice.title}"
              </Text>
            </View>

            {notice.audience.schools && notice.audience.schools.length > 0 && (
              <View style={styles.highlightItem}>
                <Ionicons name="school-outline" size={16} color={colors.accent} style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={[styles.highlightText, { color: colors.textPrimary }]}>
                  Eligible Schools: {notice.audience.schools.join(', ')}
                </Text>
              </View>
            )}

            <View style={styles.highlightItem}>
              <Ionicons name="document-text-outline" size={16} color={colors.accent} style={{ marginRight: 8, marginTop: 2 }} />
              <Text style={[styles.highlightText, { color: colors.textPrimary }]}>
                Format: Verified official {notice.fileType.toUpperCase()} circular with digital seal
              </Text>
            </View>
          </View>
        </View>

        {/* Document Action Box */}
        <View
          style={[
            styles.docBox,
            {
              backgroundColor: isDark ? colors.surfaceAlt : '#FFFFFF',
              borderColor: colors.borderGlass,
            },
          ]}
        >
          <View style={styles.docIconContainer}>
            <Ionicons
              name={notice.fileType === 'pdf' ? 'document-text' : 'image'}
              size={32}
              color={colors.accent}
            />
          </View>

          <View style={styles.docInfo}>
            <Text numberOfLines={1} style={[styles.docName, { color: colors.textPrimary }]}>
              {notice.cleanTitle}.{notice.fileType}
            </Text>
            <Text style={[styles.docMeta, { color: colors.textSecondary }]}>
              Official GBU Circular • Verified Authenticity
            </Text>
          </View>
        </View>

        {/* Image attachments are previewed here; a PDF needs the viewer. */}
        {fileKind === 'image' && (
          <View
            style={[
              styles.imagePreview,
              { backgroundColor: colors.surface, borderColor: colors.borderGlass },
            ]}
          >
            <Image
              source={{ uri: notice.fileUrl }}
              style={styles.imagePreviewImage}
              resizeMode="contain"
              accessibilityLabel={`Preview of ${notice.cleanTitle}`}
            />
          </View>
        )}

        {/* Document actions */}
        {fileKind !== 'none' ? (
          <View style={styles.ctaRow}>
            {fileKind === 'pdf' ? (
              <PillButton
                label="View PDF"
                onPress={handleViewPdf}
                variant="primary"
                size="md"
                style={styles.ctaButton}
                icon={
                  <Ionicons
                    name="eye-outline"
                    size={18}
                    color={colors.onAccent}
                    style={{ marginRight: 6 }}
                  />
                }
              />
            ) : null}

            <PillButton
              label="Open in another app"
              onPress={() => void handleOpenExternally()}
              variant={fileKind === 'pdf' ? 'outline' : 'primary'}
              size="md"
              style={styles.ctaButton}
              icon={
                <Ionicons
                  name="open-outline"
                  size={18}
                  color={fileKind === 'pdf' ? colors.accent : colors.onAccent}
                  style={{ marginRight: 6 }}
                />
              }
            />
          </View>
        ) : null}
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
  container: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  iconButton: {
    // 44dp so the back and share buttons meet the minimum touch target.
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: spacing.sm,
  },
  navTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pillBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.chip,
  },
  pillBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.chip,
  },
  sourceBadgeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    lineHeight: 28,
    marginBottom: spacing.lg,
  },
  metaCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    marginLeft: 6,
    marginRight: 6,
  },
  metaValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  summaryCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sparkleIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  summaryHeading: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
  },
  summaryBody: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  highlightList: {
    gap: spacing.sm,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  highlightText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  extractedText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: spacing.sm,
  },
  readMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    justifyContent: 'flex-start',
  },
  readMoreText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  docBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  docIconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    marginBottom: 2,
  },
  docMeta: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  ctaButton: {
    flex: 1,
  },
  imagePreview: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.sm,
    marginBottom: spacing.lg,
  },
  imagePreviewImage: {
    width: '100%',
    height: 260,
    borderRadius: radius.md,
  },
  notFoundCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  notFoundTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  notFoundDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  notFoundBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  notFoundBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
  },
});
