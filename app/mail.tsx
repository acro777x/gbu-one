import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Search,
  MailCheck,
  Star,
  Paperclip,
  Send,
  CornerUpLeft,
  CornerUpRight,
  Trash2,
  X,
  FileText,
  Download,
  CheckCircle2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { GlassCard, Chip, EmptyState } from '../src/components/ui';
import { useMailStore } from '../src/store/useMailStore';
import { StudentEmail } from '../src/features/mail/mailService';
import { useAppTheme } from '../src/lib/ThemeContext';
import { theme } from '../src/lib/theme';

const CATEGORIES = [
  { id: 'all', label: 'All Inboxes' },
  { id: 'official', label: 'Official' },
  { id: 'academics', label: 'Academics' },
  { id: 'placements', label: 'Placements' },
  { id: 'hostel', label: 'Hostel' },
] as const;

export default function MailScreen() {
  const { colors, isDark } = useAppTheme();
  const {
    emails,
    activeCategory,
    setCategory,
    markAsRead,
    markAllAsRead,
    toggleStar,
    deleteEmail,
    sendReply,
    forwardEmail,
    getUnreadCount,
  } = useMailStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeEmail, setActiveEmail] = useState<StudentEmail | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isForwarding, setIsForwarding] = useState(false);
  const [forwardRecipient, setForwardRecipient] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2400);
  };

  const unreadCount = getUnreadCount();

  const filteredEmails = useMemo(() => {
    return emails.filter((item) => {
      const matchesCategory =
        activeCategory === 'all' || item.category === activeCategory;
      const matchesSearch =
        searchQuery.trim() === '' ||
        item.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.body.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [emails, activeCategory, searchQuery]);

  const handleOpenEmail = (email: StudentEmail) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        // ignore
      }
    }
    markAsRead(email.id);
    setActiveEmail(email);
  };

  const handleToggleStar = (emailId: string) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        // ignore
      }
    }
    toggleStar(emailId);
    if (activeEmail && activeEmail.id === emailId) {
      setActiveEmail({ ...activeEmail, isStarred: !activeEmail.isStarred });
    }
  };

  const handleSendReply = () => {
    if (!activeEmail || !replyText.trim()) return;
    sendReply(activeEmail.id, replyText);
    setReplyText('');
    setIsReplying(false);
    showToast('Reply dispatched successfully');
  };

  const handleSendForward = () => {
    if (!activeEmail || !forwardRecipient.trim()) return;
    forwardEmail(activeEmail.id, forwardRecipient, '');
    setForwardRecipient('');
    setIsForwarding(false);
    showToast(`Forwarded to ${forwardRecipient}`);
  };

  const pillButtonVariant = isDark ? 'dark' : 'white';
  const chipBg = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(17, 24, 39, 0.06)';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: chipBg, borderColor: colors.borderGlass }]}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Go Back"
          >
            <ArrowLeft size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <View>
            <View style={styles.titleRow}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>GBU Webmail</Text>
              {unreadCount > 0 && (
                <View style={[styles.unreadCountBadge, { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}>
                  <Text style={[styles.unreadCountBadgeText, { color: colors.accent }]}>{unreadCount} new</Text>
                </View>
              )}
            </View>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>student.portal@gbu.ac.in</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.markAllButton, { backgroundColor: colors.accentSoft, borderColor: `${colors.accent}40` }]}
          onPress={() => {
            markAllAsRead();
            showToast('All emails marked as read');
          }}
          accessibilityLabel="Mark all as read"
        >
          <MailCheck size={18} color={colors.accent} />
          <Text style={[styles.markAllText, { color: colors.accent }]}>Mark Read</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.borderGlass }]}>
          <Search size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search communications, circulars, senders..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Filter Chips */}
      <View style={styles.categoryRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat.id}
              label={cat.label}
              selected={activeCategory === cat.id}
              onPress={() => setCategory(cat.id as never)}
              style={styles.chip}
            />
          ))}
        </ScrollView>
      </View>

      {/* Email List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredEmails.length === 0 ? (
          <EmptyState
            title="No emails found"
            description={
              searchQuery
                ? `No messages matched "${searchQuery}".`
                : 'Your inbox is clear for this category.'
            }
          />
        ) : (
          filteredEmails.map((email) => {
            return (
              <GlassCard
                key={email.id}
                style={[styles.emailCard, email.isUnread && { borderColor: `${colors.accent}66` }]}
                accentBorder={email.isUnread}
                onPress={() => handleOpenEmail(email)}
              >
                <View style={styles.emailCardHeader}>
                  {/* Avatar + Sender Info */}
                  <View style={styles.senderGroup}>
                    <View
                      style={[
                        styles.avatarSquircle,
                        { backgroundColor: email.avatarColor },
                      ]}
                    >
                      <Text style={styles.avatarText}>{email.avatarInitial}</Text>
                    </View>
                    <View style={styles.senderTextCol}>
                      <View style={styles.senderNameRow}>
                        <Text
                          style={[
                            styles.senderName,
                            { color: colors.textPrimary },
                            email.isUnread && styles.senderNameUnread,
                          ]}
                          numberOfLines={1}
                        >
                          {email.senderName}
                        </Text>
                        {email.priority === 'high' && (
                          <View style={[styles.priorityBadge, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
                            <Text style={[styles.priorityBadgeText, { color: colors.danger }]}>URGENT</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.senderRole, { color: colors.textSecondary }]} numberOfLines={1}>
                        {email.senderRole}
                      </Text>
                    </View>
                  </View>

                  {/* Date & Star */}
                  <View style={styles.rightMeta}>
                    <Text style={[styles.dateText, { color: colors.textSecondary }]}>{email.dateStr}</Text>
                    <TouchableOpacity
                      onPress={() => handleToggleStar(email.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ marginTop: 4 }}
                    >
                      <Star
                        size={16}
                        color={email.isStarred ? colors.warning : colors.textTertiary}
                        fill={email.isStarred ? colors.warning : 'transparent'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Subject */}
                <Text
                  style={[
                    styles.subjectText,
                    { color: colors.textPrimary },
                    email.isUnread && styles.subjectTextUnread,
                  ]}
                  numberOfLines={1}
                >
                  {email.subject}
                </Text>

                {/* Preview */}
                <Text style={[styles.previewText, { color: colors.textSecondary }]} numberOfLines={2}>
                  {email.preview}
                </Text>

                {/* Bottom Meta Badges */}
                <View style={styles.cardBottomRow}>
                  {email.hasAttachment && (
                    <View style={[styles.attachmentChip, { backgroundColor: chipBg }]}>
                      <Paperclip size={12} color={colors.accent} />
                      <Text style={[styles.attachmentChipText, { color: colors.textSecondary }]}>
                        {email.attachments?.length || 1} file(s)
                      </Text>
                    </View>
                  )}
                  {email.isUnread && (
                    <View style={styles.unreadDotPill}>
                      <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />
                      <Text style={[styles.unreadDotText, { color: colors.accent }]}>New</Text>
                    </View>
                  )}
                </View>
              </GlassCard>
            );
          })
        )}
      </ScrollView>

      {/* Email Reader Modal */}
      {activeEmail && (
        <Modal
          visible={!!activeEmail}
          animationType="slide"
          transparent
          onRequestClose={() => setActiveEmail(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { backgroundColor: colors.surface, borderColor: colors.borderGlass }]}>
              {/* Modal Top Bar */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.borderGlass }]}>
                <TouchableOpacity
                  style={[styles.modalCloseBtn, { backgroundColor: chipBg }]}
                  onPress={() => {
                    setActiveEmail(null);
                    setIsReplying(false);
                    setIsForwarding(false);
                  }}
                >
                  <X size={20} color={colors.textPrimary} />
                </TouchableOpacity>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.actionIconBtn, { backgroundColor: chipBg }]}
                    onPress={() => handleToggleStar(activeEmail.id)}
                  >
                    <Star
                      size={18}
                      color={activeEmail.isStarred ? colors.warning : colors.textTertiary}
                      fill={activeEmail.isStarred ? colors.warning : 'transparent'}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionIconBtn, { backgroundColor: colors.dangerSoft }]}
                    onPress={() => {
                      deleteEmail(activeEmail.id);
                      setActiveEmail(null);
                      showToast('Email moved to trash');
                    }}
                  >
                    <Trash2 size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
              >
                {/* Subject */}
                <Text style={[styles.readerSubject, { color: colors.textPrimary }]}>{activeEmail.subject}</Text>

                {/* Sender Card */}
                <View style={[styles.readerSenderRow, { backgroundColor: colors.surfaceMuted }]}>
                  <View
                    style={[
                      styles.avatarSquircleLarge,
                      { backgroundColor: activeEmail.avatarColor },
                    ]}
                  >
                    <Text style={styles.avatarTextLarge}>
                      {activeEmail.avatarInitial}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.readerSenderName, { color: colors.textPrimary }]}>
                      {activeEmail.senderName}
                    </Text>
                    <Text style={[styles.readerSenderEmail, { color: colors.textSecondary }]}>
                      {activeEmail.senderEmail}
                    </Text>
                    <Text style={[styles.readerDate, { color: colors.textSecondary }]}>{activeEmail.dateStr}</Text>
                  </View>
                </View>

                {/* Email Body */}
                <View style={styles.readerBodyContainer}>
                  <Text style={[styles.readerBodyText, { color: colors.textPrimary }]}>{activeEmail.body}</Text>
                </View>

                {/* Attachments Section */}
                {activeEmail.attachments && activeEmail.attachments.length > 0 && (
                  <View style={[styles.attachmentsSection, { borderTopColor: colors.borderGlass }]}>
                    <Text style={[styles.attachmentsTitle, { color: colors.textSecondary }]}>
                      Attachments ({activeEmail.attachments.length})
                    </Text>
                    {activeEmail.attachments.map((att) => (
                      <TouchableOpacity
                        key={att.id}
                        style={[styles.attachmentCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderGlass }]}
                        onPress={() => {
                          if (Platform.OS !== 'web') {
                            try {
                              Haptics.notificationAsync(
                                Haptics.NotificationFeedbackType.Success
                              );
                            } catch (e) {
                              // ignore
                            }
                          }
                          showToast(`Downloaded ${att.name}`);
                        }}
                      >
                        <FileText size={18} color={colors.accent} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.attName, { color: colors.textPrimary }]} numberOfLines={1}>
                            {att.name}
                          </Text>
                          <Text style={[styles.attSize, { color: colors.textSecondary }]}>{att.size}</Text>
                        </View>
                        <Download size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Reply Composer if active */}
                {isReplying && (
                  <View style={[styles.composerBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderGlass }]}>
                    <Text style={[styles.composerHeader, { color: colors.accent }]}>
                      Reply to {activeEmail.senderName}
                    </Text>
                    <TextInput
                      style={[styles.composerInput, { backgroundColor: colors.surface, color: colors.textPrimary }]}
                      placeholder="Write your official response..."
                      placeholderTextColor={colors.textTertiary}
                      multiline
                      numberOfLines={4}
                      value={replyText}
                      onChangeText={setReplyText}
                    />
                    <View style={styles.composerActions}>
                      <TouchableOpacity
                        style={styles.composerCancelBtn}
                        onPress={() => setIsReplying(false)}
                      >
                        <Text style={[styles.composerCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.composerSendBtn, { backgroundColor: colors.accent }]}
                        onPress={handleSendReply}
                      >
                        <Send size={14} color="#FFF" />
                        <Text style={styles.composerSendText}>Send</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Forward Composer if active */}
                {isForwarding && (
                  <View style={[styles.composerBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderGlass }]}>
                    <Text style={[styles.composerHeader, { color: colors.accent }]}>Forward Communication</Text>
                    <TextInput
                      style={[styles.forwardInput, { backgroundColor: colors.surface, color: colors.textPrimary }]}
                      placeholder="Recipient GBU Email (e.g. rollno@gbu.ac.in)..."
                      placeholderTextColor={colors.textTertiary}
                      value={forwardRecipient}
                      onChangeText={setForwardRecipient}
                    />
                    <View style={styles.composerActions}>
                      <TouchableOpacity
                        style={styles.composerCancelBtn}
                        onPress={() => setIsForwarding(false)}
                      >
                        <Text style={[styles.composerCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.composerSendBtn, { backgroundColor: colors.accent }]}
                        onPress={handleSendForward}
                      >
                        <CornerUpRight size={14} color="#FFF" />
                        <Text style={styles.composerSendText}>Forward</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Bottom Quick Action Bar */}
              <View style={[styles.bottomActionBar, { borderTopColor: colors.borderGlass }]}>
                <TouchableOpacity
                  style={[styles.quickActionButton, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderGlass }]}
                  onPress={() => {
                    setIsReplying(true);
                    setIsForwarding(false);
                  }}
                >
                  <CornerUpLeft size={16} color={colors.accent} />
                  <Text style={[styles.quickActionText, { color: colors.textPrimary }]}>Reply</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickActionButton, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderGlass }]}
                  onPress={() => {
                    setIsForwarding(true);
                    setIsReplying(false);
                  }}
                >
                  <CornerUpRight size={16} color={colors.textPrimary} />
                  <Text style={[styles.quickActionText, { color: colors.textPrimary }]}>Forward</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Floating Toast Notice */}
      {toastMessage && (
        <View style={styles.toastContainer} pointerEvents="none">
          <View style={[styles.toastPill, { backgroundColor: isDark ? 'rgba(22, 22, 24, 0.95)' : 'rgba(255, 255, 255, 0.95)', borderColor: colors.accent }]}>
            <CheckCircle2 size={15} color={colors.accent} />
            <Text style={[styles.toastText, { color: colors.textPrimary }]}>{toastMessage}</Text>
          </View>
        </View>
      )}
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
    paddingBottom: theme.spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
  },
  unreadCountBadge: {
    borderWidth: 1,
    borderRadius: theme.radius.chip,
    paddingHorizontal: 7,
    paddingVertical: 1,
    marginLeft: 8,
  },
  unreadCountBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
  },
  headerSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 1,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.chip,
    borderWidth: 1,
  },
  markAllText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    marginLeft: 4,
  },
  searchWrapper: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
  },
  categoryRow: {
    marginBottom: theme.spacing.sm,
  },
  categoryScroll: {
    paddingHorizontal: theme.spacing.lg,
    gap: 8,
  },
  chip: {
    marginRight: 6,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 90,
  },
  emailCard: {
    marginBottom: 10,
  },
  emailCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  senderGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  avatarSquircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#FFF',
    fontFamily: 'Poppins-Bold',
    fontSize: 13,
  },
  senderTextCol: {
    flex: 1,
  },
  senderNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  senderName: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    flexShrink: 1,
  },
  senderNameUnread: {
    fontFamily: 'Inter-SemiBold',
  },
  priorityBadge: {
    borderWidth: 1,
    borderRadius: theme.radius.chip,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 6,
  },
  priorityBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 8,
  },
  senderRole: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 1,
  },
  rightMeta: {
    alignItems: 'flex-end',
  },
  dateText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
  },
  subjectText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    marginBottom: 4,
  },
  subjectTextUnread: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
  },
  previewText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.chip,
    gap: 4,
  },
  attachmentChipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
  },
  unreadDotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  unreadDotText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    height: '88%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: theme.spacing.lg,
  },
  readerSubject: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    lineHeight: 24,
    marginBottom: 14,
  },
  readerSenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 16,
  },
  avatarSquircleLarge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarTextLarge: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: '#FFF',
  },
  readerSenderName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  readerSenderEmail: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 1,
  },
  readerDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
  },
  readerBodyContainer: {
    marginBottom: 20,
  },
  readerBodyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 22,
  },
  attachmentsSection: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginBottom: 20,
  },
  attachmentsTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    marginBottom: 10,
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  attName: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
  },
  attSize: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 2,
  },
  composerBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 20,
  },
  composerHeader: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    marginBottom: 8,
  },
  composerInput: {
    borderRadius: 12,
    padding: 10,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  forwardInput: {
    borderRadius: 12,
    padding: 10,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
  },
  composerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  composerCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.chip,
  },
  composerCancelText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  composerSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.radius.chip,
    gap: 4,
  },
  composerSendText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  bottomActionBar: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingVertical: 12,
    gap: 6,
  },
  quickActionText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 999,
  },
  toastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  toastText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
  },
});
