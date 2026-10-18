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
import { theme } from '../src/lib/theme';

const CATEGORIES = [
  { id: 'all', label: 'All Inboxes' },
  { id: 'official', label: 'Official' },
  { id: 'academics', label: 'Academics' },
  { id: 'placements', label: 'Placements' },
  { id: 'hostel', label: 'Hostel' },
] as const;

export default function MailScreen() {
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

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityLabel="Go Back"
          >
            <ArrowLeft size={20} color={theme.colors.ivory} />
          </TouchableOpacity>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle}>GBU Webmail</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadCountBadge}>
                  <Text style={styles.unreadCountBadgeText}>{unreadCount} new</Text>
                </View>
              )}
            </View>
            <Text style={styles.headerSub}>student.portal@gbu.ac.in</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.markAllButton}
          onPress={() => {
            markAllAsRead();
            showToast('All emails marked as read');
          }}
          accessibilityLabel="Mark all as read"
        >
          <MailCheck size={18} color={theme.colors.accent} />
          <Text style={styles.markAllText}>Mark Read</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBar}>
          <Search size={18} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search communications, circulars, senders..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={theme.colors.textSecondary} />
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
                style={[styles.emailCard, email.isUnread && styles.unreadCard]}
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
                            email.isUnread && styles.senderNameUnread,
                          ]}
                          numberOfLines={1}
                        >
                          {email.senderName}
                        </Text>
                        {email.priority === 'high' && (
                          <View style={styles.priorityBadge}>
                            <Text style={styles.priorityBadgeText}>URGENT</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.senderRole} numberOfLines={1}>
                        {email.senderRole}
                      </Text>
                    </View>
                  </View>

                  {/* Date & Star */}
                  <View style={styles.rightMeta}>
                    <Text style={styles.dateText}>{email.dateStr}</Text>
                    <TouchableOpacity
                      onPress={() => handleToggleStar(email.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ marginTop: 4 }}
                    >
                      <Star
                        size={16}
                        color={email.isStarred ? '#F5B83D' : theme.colors.textSecondary}
                        fill={email.isStarred ? '#F5B83D' : 'transparent'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Subject */}
                <Text
                  style={[
                    styles.subjectText,
                    email.isUnread && styles.subjectTextUnread,
                  ]}
                  numberOfLines={1}
                >
                  {email.subject}
                </Text>

                {/* Preview */}
                <Text style={styles.previewText} numberOfLines={2}>
                  {email.preview}
                </Text>

                {/* Bottom Meta Badges */}
                <View style={styles.cardBottomRow}>
                  {email.hasAttachment && (
                    <View style={styles.attachmentChip}>
                      <Paperclip size={12} color={theme.colors.accent} />
                      <Text style={styles.attachmentChipText}>
                        {email.attachments?.length || 1} file(s)
                      </Text>
                    </View>
                  )}
                  {email.isUnread && (
                    <View style={styles.unreadDotPill}>
                      <View style={styles.unreadDot} />
                      <Text style={styles.unreadDotText}>New</Text>
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
            <View style={styles.modalContainer}>
              {/* Modal Top Bar */}
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => {
                    setActiveEmail(null);
                    setIsReplying(false);
                    setIsForwarding(false);
                  }}
                >
                  <X size={20} color={theme.colors.ivory} />
                </TouchableOpacity>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => handleToggleStar(activeEmail.id)}
                  >
                    <Star
                      size={18}
                      color={activeEmail.isStarred ? '#F5B83D' : theme.colors.textSecondary}
                      fill={activeEmail.isStarred ? '#F5B83D' : 'transparent'}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => {
                      deleteEmail(activeEmail.id);
                      setActiveEmail(null);
                      showToast('Email moved to trash');
                    }}
                  >
                    <Trash2 size={18} color={theme.colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
              >
                {/* Subject */}
                <Text style={styles.readerSubject}>{activeEmail.subject}</Text>

                {/* Sender Card */}
                <View style={styles.readerSenderRow}>
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
                    <Text style={styles.readerSenderName}>
                      {activeEmail.senderName}
                    </Text>
                    <Text style={styles.readerSenderEmail}>
                      {activeEmail.senderEmail}
                    </Text>
                    <Text style={styles.readerDate}>{activeEmail.dateStr}</Text>
                  </View>
                </View>

                {/* Email Body */}
                <View style={styles.readerBodyContainer}>
                  <Text style={styles.readerBodyText}>{activeEmail.body}</Text>
                </View>

                {/* Attachments Section */}
                {activeEmail.attachments && activeEmail.attachments.length > 0 && (
                  <View style={styles.attachmentsSection}>
                    <Text style={styles.attachmentsTitle}>
                      Attachments ({activeEmail.attachments.length})
                    </Text>
                    {activeEmail.attachments.map((att) => (
                      <TouchableOpacity
                        key={att.id}
                        style={styles.attachmentCard}
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
                        <FileText size={18} color={theme.colors.accent} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.attName} numberOfLines={1}>
                            {att.name}
                          </Text>
                          <Text style={styles.attSize}>{att.size}</Text>
                        </View>
                        <Download size={16} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Reply Composer if active */}
                {isReplying && (
                  <View style={styles.composerBox}>
                    <Text style={styles.composerHeader}>
                      Reply to {activeEmail.senderName}
                    </Text>
                    <TextInput
                      style={styles.composerInput}
                      placeholder="Write your official response..."
                      placeholderTextColor={theme.colors.textSecondary}
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
                        <Text style={styles.composerCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.composerSendBtn}
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
                  <View style={styles.composerBox}>
                    <Text style={styles.composerHeader}>Forward Communication</Text>
                    <TextInput
                      style={styles.forwardInput}
                      placeholder="Recipient GBU Email (e.g. rollno@gbu.ac.in)..."
                      placeholderTextColor={theme.colors.textSecondary}
                      value={forwardRecipient}
                      onChangeText={setForwardRecipient}
                    />
                    <View style={styles.composerActions}>
                      <TouchableOpacity
                        style={styles.composerCancelBtn}
                        onPress={() => setIsForwarding(false)}
                      >
                        <Text style={styles.composerCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.composerSendBtn}
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
              <View style={styles.bottomActionBar}>
                <TouchableOpacity
                  style={styles.quickActionButton}
                  onPress={() => {
                    setIsReplying(true);
                    setIsForwarding(false);
                  }}
                >
                  <CornerUpLeft size={16} color={theme.colors.accent} />
                  <Text style={styles.quickActionText}>Reply</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionButton}
                  onPress={() => {
                    setIsForwarding(true);
                    setIsReplying(false);
                  }}
                >
                  <CornerUpRight size={16} color={theme.colors.ivory} />
                  <Text style={styles.quickActionText}>Forward</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Floating Toast Notice */}
      {toastMessage && (
        <View style={styles.toastContainer} pointerEvents="none">
          <View style={styles.toastPill}>
            <CheckCircle2 size={15} color={theme.colors.accent} />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      )}
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
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
    color: theme.colors.ivory,
  },
  unreadCountBadge: {
    backgroundColor: 'rgba(255, 106, 43, 0.2)',
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderRadius: theme.radius.chip,
    paddingHorizontal: 7,
    paddingVertical: 1,
    marginLeft: 8,
  },
  unreadCountBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: theme.colors.accent,
  },
  headerSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 106, 43, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.chip,
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 43, 0.25)',
  },
  markAllText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: theme.colors.accent,
    marginLeft: 4,
  },
  searchWrapper: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
    paddingHorizontal: 14,
    height: 42,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.ivory,
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
  unreadCard: {
    borderColor: 'rgba(255, 106, 43, 0.4)',
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
    color: theme.colors.textPrimary,
    flexShrink: 1,
  },
  senderNameUnread: {
    fontFamily: 'Inter-SemiBold',
    color: theme.colors.ivory,
  },
  priorityBadge: {
    backgroundColor: 'rgba(255, 92, 92, 0.15)',
    borderWidth: 1,
    borderColor: theme.colors.danger,
    borderRadius: theme.radius.chip,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 6,
  },
  priorityBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 8,
    color: theme.colors.danger,
  },
  senderRole: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  rightMeta: {
    alignItems: 'flex-end',
  },
  dateText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  subjectText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: theme.colors.ivory,
    marginBottom: 4,
  },
  subjectTextUnread: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
  },
  previewText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.chip,
    gap: 4,
  },
  attachmentChipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
    color: theme.colors.textSecondary,
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
    backgroundColor: theme.colors.accent,
  },
  unreadDotText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: theme.colors.accent,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#161618',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
    height: '88%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
    color: theme.colors.ivory,
    lineHeight: 24,
    marginBottom: 14,
  },
  readerSenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
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
    color: theme.colors.ivory,
  },
  readerSenderEmail: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  readerDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  readerBodyContainer: {
    marginBottom: 20,
  },
  readerBodyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.textPrimary,
    lineHeight: 22,
  },
  attachmentsSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 16,
    marginBottom: 20,
  },
  attachmentsTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 10,
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  attName: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: theme.colors.ivory,
  },
  attSize: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  composerBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
    padding: 12,
    marginBottom: 20,
  },
  composerHeader: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: theme.colors.accent,
    marginBottom: 8,
  },
  composerInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 10,
    color: theme.colors.ivory,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  forwardInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 10,
    color: theme.colors.ivory,
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
    color: theme.colors.textSecondary,
  },
  composerSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.radius.chip,
    gap: 4,
  },
  composerSendText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: '#FFF',
  },
  bottomActionBar: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
    borderRadius: theme.radius.pill,
    paddingVertical: 12,
    gap: 6,
  },
  quickActionText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: theme.colors.ivory,
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
    backgroundColor: 'rgba(22, 22, 24, 0.95)',
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  toastText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: theme.colors.ivory,
  },
});
