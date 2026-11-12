import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import {
  ChevronLeft,
  ShieldCheck,
  Check,
  X,
  Clock,
  FileText,
  Inbox,
  Eye,
} from 'lucide-react-native';
import { GlassCard, PillButton, Toast, EmptyState, BottomSheet } from '../src/components/ui';
import {
  applyModeration,
  approveAllPending,
  listPendingPapers,
  moderatorStatus,
  getPendingPaperUrl,
  type ModeratorStatus,
  type PyqPaperRecord,
} from '../src/features/pyq/pyqRepository';
import { registerDocument } from '../src/components/pdf/pdfRegistry';
import { moderationActionLabel, type ModerationAction } from '../src/features/pyq/pyqStorage';
import { useAppTheme } from '../src/lib/ThemeContext';
import { spacing } from '../src/lib/theme';
import { isAdminApp } from '../src/lib/appVariant';

/**
 * The moderation queue.
 *
 * The guard lives in this wrapper and NOT in the component below: the old
 * version returned `null` before its `useState` calls, which is a
 * Rules-of-Hooks violation that throws "Rendered fewer hooks than during
 * the previous render" as soon as the variant becomes dynamic.
 */
export default function ModerationQueueScreen() {
  if (!isAdminApp()) {
    return <Redirect href="/(tabs)/pyq" />;
  }
  return <ModerationQueue />;
}

function ModerationQueue() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [papers, setPapers] = useState<PyqPaperRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<ModeratorStatus>({ state: 'signed-out', reason: '' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkSheetVisible, setBulkSheetVisible] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
  };

  /**
   * Loads the queue.
   *
   * The moderator identity comes from the verified Supabase session, not
   * from the student auth store: in the admin APK that store holds the
   * guest/empty email, so the queue was permanently unreachable. The
   * moderator MUST be signed in with a Supabase Auth account.
   */
  const load = useCallback(async () => {
    setLoading(true);
    const status = await moderatorStatus();
    setAccess(status);

    if (status.state !== 'moderator') {
      setPapers([]);
      setLoading(false);
      return;
    }

    try {
      const pending = await listPendingPapers();
      setPapers(pending);
    } catch (err) {
      setPapers([]);
      showToast(
        err instanceof Error
          ? `The queue could not be loaded: ${err.message}`
          : 'The queue could not be loaded.',
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAction = async (paper: PyqPaperRecord, action: ModerationAction) => {
    setBusyId(paper.id);
    const result = await applyModeration(paper.id, action);
    setBusyId(null);
    if (!result.ok) {
      showToast(result.reason);
      return;
    }
    showToast(
      action === 'approve'
        ? `${paper.subjectCode} approved and published.${result.warning ? ` ${result.warning}` : ''}`
        : `${paper.subjectCode} rejected.${result.warning ? ` ${result.warning}` : ''}`,
    );
    setPapers((prev) => prev.filter((p) => p.id !== paper.id));
  };

  const handleApproveAll = async () => {
    setBulkSheetVisible(false);
    setBulkBusy(true);
    try {
      const { approved, failed } = await approveAllPending();
      showToast(
        failed === 0
          ? `${approved} paper${approved === 1 ? '' : 's'} approved and published.`
          : `${approved} approved, ${failed} could not be published. The first error is above the list.`,
      );
    } finally {
      setBulkBusy(false);
    }
    void load();
  };

  const getFileExtensionBadge = (filePath: string) => {
    const clean = filePath.split('?')[0];
    const ext = clean.split('.').pop()?.toUpperCase() || 'PDF';
    return ext;
  };

  const handleInspectPaper = async (paper: PyqPaperRecord) => {
    try {
      let targetUrl = paper.fileUrl;
      if (!targetUrl.startsWith('http')) {
        const signed = await getPendingPaperUrl(paper.fileUrl);
        if (signed) targetUrl = signed;
      }
      if (targetUrl.startsWith('http')) {
        const docId = registerDocument(targetUrl, `${paper.subjectCode} - ${paper.subjectName}`);
        router.push({
          pathname: '/pdf',
          params: { id: docId, url: targetUrl, title: `${paper.subjectCode} (${paper.examType})` },
        });
      } else {
        showToast('Storage preview link unavailable for inspection.');
      }
    } catch {
      showToast('Could not open paper preview.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.navBar, { borderBottomColor: colors.borderGlass }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={16}
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={20} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.navTitleContainer}>
          <Text numberOfLines={1} style={[styles.navTitle, { color: colors.textPrimary }]}>
            Moderation Queue
          </Text>
        </View>

        <View style={styles.iconButton} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(80, insets.bottom + 40) }]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void load()}
            tintColor={colors.textSecondary}
          />
        }
      >
        {access.state !== 'moderator' ? (
          <View style={styles.noticeCard}>
            <EmptyState
              title={
                access.state === 'backend-refused'
                  ? 'The server blocked the queue'
                  : access.state === 'signed-out'
                    ? 'Sign in to review'
                    : 'Moderator access required'
              }
              description={access.reason}
              icon={<ShieldCheck size={28} color={colors.accent} />}
            />
          </View>
        ) : papers.length === 0 && !loading ? (
          <View style={styles.noticeCard}>
            <EmptyState
              title="Queue is clear"
              description="No question papers are waiting for review right now."
              icon={<Inbox size={28} color={colors.accent} />}
            />
          </View>
        ) : (
          <>
            {/* The owner clears the imported archive in one pass; every paper
                still goes through its own moderation call and log entry. */}
            <GlassCard style={styles.bulkCard}>
              <Text style={[styles.bulkTitle, { color: colors.textPrimary }]}>
                {papers.length} paper{papers.length === 1 ? '' : 's'} waiting
              </Text>
              <Text style={[styles.bulkBody, { color: colors.textSecondary }]}>
                Approving publishes the file to every student and records your account in the
                moderation log. Check the metadata before you publish a batch.
              </Text>
              <PillButton
                label={bulkBusy ? 'Publishing...' : `Approve all ${papers.length}`}
                onPress={() => setBulkSheetVisible(true)}
                loading={bulkBusy}
                variant="outline"
                size="sm"
                style={{ marginTop: spacing.sm }}
              />
            </GlassCard>

            {papers.map((paper) => {
              const ext = getFileExtensionBadge(paper.fileUrl);
              return (
                <GlassCard key={paper.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.08)' },
                        ]}
                      >
                        <Text style={[styles.badgeText, { color: colors.accent }]}>
                          {paper.subjectCode}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.06)', paddingHorizontal: 6 },
                        ]}
                      >
                        <Text style={{ fontSize: 11, fontFamily: 'Inter-Bold', color: colors.textSecondary }}>
                          [{ext}]
                        </Text>
                      </View>
                    </View>
                    <View style={styles.pendingTag}>
                      <Clock size={11} color={colors.warning} />
                      <Text style={[styles.pendingText, { color: colors.warning }]}>Pending</Text>
                    </View>
                  </View>

                  <Text style={[styles.subjectName, { color: colors.textPrimary }]}>
                    {paper.subjectName}
                  </Text>

                  <View style={styles.metaRow}>
                    <FileText size={12} color={colors.textSecondary} />
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                      {paper.year} · {paper.examType} · {paper.school} {paper.programmeCode} Sem{' '}
                      {paper.semester}
                    </Text>
                  </View>

                  {paper.uploader_name ? (
                    <Text style={[styles.uploaderText, { color: colors.textTertiary }]}>
                      Uploaded by {paper.uploader_name}
                      {paper.uploaderStudentId ? ` (${paper.uploaderStudentId})` : ''}
                    </Text>
                  ) : null}

                  <View style={styles.actionRow}>
                    <PillButton
                      label={`Inspect [${ext}]`}
                      onPress={() => void handleInspectPaper(paper)}
                      variant="outline"
                      size="sm"
                      style={{ ...styles.actionButton, marginRight: 6 }}
                      icon={<Eye size={13} color={colors.accent} style={{ marginRight: 4 }} />}
                    />
                    <PillButton
                      label={busyId === paper.id ? 'Working…' : moderationActionLabel('approve')}
                      onPress={() => void handleAction(paper, 'approve')}
                      loading={busyId === paper.id}
                      variant="primary"
                      size="sm"
                      style={{ ...styles.actionButton, marginRight: 6 }}
                      icon={<Check size={14} color={colors.onAccent} style={{ marginRight: 4 }} />}
                    />
                    <PillButton
                      label={moderationActionLabel('reject')}
                      onPress={() => void handleAction(paper, 'reject')}
                      variant="outline"
                      size="sm"
                      style={styles.actionButton}
                      icon={<X size={14} color={colors.textPrimary} style={{ marginRight: 4 }} />}
                    />
                  </View>
                </GlassCard>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Publishing is irreversible for students, so it asks once. */}
      <BottomSheet
        visible={bulkSheetVisible}
        onClose={() => setBulkSheetVisible(false)}
        title="Publish every waiting paper?"
      >
        <Text style={[styles.sheetBody, { color: colors.textSecondary }]}>
          All {papers.length} waiting papers move to the public PYQ shelf and become downloadable by
          every student. Each one is recorded in the moderation log against your account.
        </Text>
        <PillButton
          label={`Yes, publish ${papers.length}`}
          onPress={() => void handleApproveAll()}
          variant="primary"
          size="md"
          style={{ marginTop: spacing.md }}
        />
        <PillButton
          label="Cancel"
          onPress={() => setBulkSheetVisible(false)}
          variant="outline"
          size="md"
          style={{ marginTop: spacing.sm }}
        />
      </BottomSheet>

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
    // 44dp so the back button meets the minimum touch target.
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  noticeCard: {
    marginTop: spacing.lg,
  },
  bulkCard: {
    padding: spacing.md,
    borderRadius: 18,
  },
  bulkTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    marginBottom: 4,
  },
  bulkBody: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 17,
  },
  sheetBody: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    padding: spacing.md,
    borderRadius: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    letterSpacing: 0.4,
  },
  pendingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pendingText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
  },
  subjectName: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  metaText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  uploaderText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginBottom: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
});
