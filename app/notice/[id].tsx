import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  Share,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../src/lib/ThemeContext';
import { radius, spacing } from '../../src/lib/theme';
import { MOCK_NOTICES, NoticeItem } from '../../src/features/notices/noticeService';

export default function NoticeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Find notice by id or fallback to first notice
  const notice: NoticeItem =
    MOCK_NOTICES.find((n) => n.id === id) ||
    MOCK_NOTICES[0];

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

  const handleOpenDoc = async () => {
    if (!notice.fileUrl) return;
    try {
      const canOpen = await Linking.canOpenURL(notice.fileUrl);
      if (canOpen) {
        await Linking.openURL(notice.fileUrl);
      } else {
        Alert.alert('Notice Link', notice.fileUrl);
      }
    } catch {
      Alert.alert('Notice Link', notice.fileUrl);
    }
  };

  const handleDownload = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
      handleOpenDoc();
    }, 900);
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
        return { color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)', label: 'HOSTEL OFFICE' };
      case 'result':
        return { color: '#EC4899', bg: 'rgba(236, 72, 153, 0.12)', label: 'ACADEMIC RESULT' };
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

        {/* Primary CTA Buttons */}
        <View style={styles.ctaRow}>
          <Pressable
            onPress={handleOpenDoc}
            style={({ pressed }) => [
              styles.ctaButton,
              styles.primaryCta,
              { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Ionicons name="eye-outline" size={18} color={colors.onAccent} style={{ marginRight: 6 }} />
            <Text style={[styles.primaryCtaText, { color: colors.onAccent }]}>View Document</Text>
          </Pressable>

          <Pressable
            onPress={handleDownload}
            style={({ pressed }) => [
              styles.ctaButton,
              styles.secondaryCta,
              {
                backgroundColor: downloadSuccess ? colors.successSoft : colors.surface,
                borderColor: downloadSuccess ? colors.success : colors.borderGlass,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons
              name={downloadSuccess ? 'checkmark-circle' : 'cloud-download-outline'}
              size={18}
              color={downloadSuccess ? colors.success : colors.textPrimary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.secondaryCtaText,
                { color: downloadSuccess ? colors.success : colors.textPrimary },
              ]}
            >
              {downloading ? 'Downloading...' : downloadSuccess ? 'Downloaded!' : 'Download PDF'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
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
    width: 38,
    height: 38,
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
    height: 48,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  primaryCta: {},
  primaryCtaText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
  },
  secondaryCta: {
    borderWidth: 1,
  },
  secondaryCtaText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
  },
});
