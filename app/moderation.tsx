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
import { router } from 'expo-router';
import {
  ChevronLeft,
  ShieldCheck,
  Check,
  X,
  Clock,
  FileText,
  Inbox,
} from 'lucide-react-native';
import { GlassCard, PillButton, Toast, EmptyState } from '../src/components/ui';
import { useAuthStore } from '../src/store/useAuthStore';
import {
  applyModeration,
  isModerator,
  listPendingPapers,
  type PyqPaperRecord,
} from '../src/features/pyq/pyqRepository';
import { moderationActionLabel, type ModerationAction } from '../src/features/pyq/pyqStorage';
import { useAppTheme } from '../src/lib/ThemeContext';
import { spacing } from '../src/lib/theme';

export default function ModerationQueueScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [papers, setPapers] = useState<PyqPaperRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [mod, pending] = await Promise.all([
      isModerator(user?.email),
      listPendingPapers(),
    ]);
    setAllowed(mod);
    setPapers(pending);
    setLoading(false);
  }, [user?.email]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAction = async (paper: PyqPaperRecord, action: ModerationAction) => {
    setBusyId(paper.id);
    const result = await applyModeration(paper.id, action, user?.email ?? null);
    setBusyId(null);
    if (!result.ok) {
      showToast(result.reason);
      return;
    }
    showToast(
      action === 'approve'
        ? `${paper.subjectCode} approved and published.`
        : action === 'reject'
          ? `${paper.subjectCode} rejected.`
          : 'Changes requested from the uploader.',
    );
    setPapers((prev) => prev.filter((p) => p.id !== paper.id));
  };

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
        {!allowed ? (
          <View style={styles.noticeCard}>
            <EmptyState
              title="Moderator access required"
              description="Only the owner and the trusted students listed in the moderators table can review uploads. Add your email in the Supabase dashboard to join the team."
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
          papers.map((paper) => (
            <GlassCard key={paper.id} style={styles.card}>
              <View style={styles.cardHeader}>
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

              <View style={styles.actionRow}>
                <PillButton
                  label={busyId === paper.id ? 'Working…' : moderationActionLabel('approve')}
                  onPress={() => void handleAction(paper, 'approve')}
                  loading={busyId === paper.id}
                  variant="primary"
                  size="sm"
                  style={styles.actionButton}
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
          ))
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
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
});
