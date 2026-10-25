/**
 * GBU One — Official Admin Console
 *
 * Dedicated administrative interface for University administrators and student
 * moderators to manage the live student ecosystem:
 *  1. Campus Events & Photo Gallery Publisher
 *  2. Crowdsourced PYQ Moderation Queue
 *  3. High-Priority Emergency Notice Broadcasts
 *  4. App Version Management & Compulsory Auto-Update Controls
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ChevronLeft,
  Calendar,
  FileCheck2,
  BellRing,
  ArrowUpCircle,
  PlusCircle,
  Trash2,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react-native';
import { GlassCard, PillButton, Toast } from '../../src/components/ui';
import { useAuthStore } from '../../src/store/useAuthStore';
import {
  listCampusEvents,
  createCampusEvent,
  deleteCampusEvent,
  type CampusEvent,
  type EventCategory,
  EVENT_CATEGORIES,
} from '../../src/features/events/eventsService';
import {
  listPendingPapers,
  applyModeration,
  type PyqPaperRecord,
} from '../../src/features/pyq/pyqRepository';
import {
  checkForAppUpdate,
  publishAppVersion,
  clearAppVersionOverride,
  type AppVersionManifest,
} from '../../src/features/updates/versionChecker';
import { useAppTheme } from '../../src/lib/ThemeContext';
import { theme } from '../../src/lib/theme';

type AdminTab = 'events' | 'pyq' | 'broadcast' | 'version';

export default function AdminScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<AdminTab>('events');
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // Events State
  const [eventsList, setEventsList] = useState<CampusEvent[]>([]);
  const [eventTitle, setEventTitle] = useState('');
  const [eventCategory, setEventCategory] = useState<EventCategory>('fest');
  const [eventVenue, setEventVenue] = useState('Main Auditorium & Campus Grounds');
  const [eventDesc, setEventDesc] = useState('');
  const [eventBannerUrl, setEventBannerUrl] = useState('');
  const [eventPhotosRaw, setEventPhotosRaw] = useState('');
  const [eventRegUrl, setEventRegUrl] = useState('');

  // PYQ Moderation State
  const [pendingPapers, setPendingPapers] = useState<PyqPaperRecord[]>([]);

  // Version Control State
  const [manifestVersion, setManifestVersion] = useState('1.1.0');
  const [minSupported, setMinSupported] = useState('1.0.0');
  const [isMandatory, setIsMandatory] = useState(true);
  const [apkDownloadUrl, setApkDownloadUrl] = useState(
    'https://github.com/acro777x/gbu-one/releases/latest',
  );
  const [releaseNotesText, setReleaseNotesText] = useState(
    'Official End Sem datesheet sync\nFull Campus Event photo memories\nAll-department PYQ downloads',
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const events = await listCampusEvents(100);
      setEventsList(events);

      const papers = await listPendingPapers();
      setPendingPapers(papers);

      const updateInfo = await checkForAppUpdate();
      if (updateInfo.manifest) {
        setManifestVersion(updateInfo.manifest.latestVersion);
        setMinSupported(updateInfo.manifest.minSupportedVersion);
        setIsMandatory(updateInfo.manifest.isMandatory);
        setApkDownloadUrl(updateInfo.manifest.apkUrl);
        setReleaseNotesText(updateInfo.manifest.releaseNotes.join('\n'));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Handler: Create Event
  const handlePublishEvent = async () => {
    if (!eventTitle.trim()) {
      showToast('Please enter an event title.');
      return;
    }

    const photos = eventPhotosRaw
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http'));

    const res = await createCampusEvent({
      title: eventTitle.trim(),
      description: eventDesc.trim() || 'Official University event hosted on GBU campus.',
      category: eventCategory,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      venue: eventVenue.trim() || 'GBU Campus',
      isFree: true,
      registrationRequired: Boolean(eventRegUrl.trim()),
      registrationUrl: eventRegUrl.trim() || undefined,
      imageUrl: eventBannerUrl.trim() || (photos[0] ?? undefined),
      photos,
      audience: ['all'],
    });

    if (res.ok) {
      showToast('Live event and photo gallery published to all student apps!');
      setEventTitle('');
      setEventDesc('');
      setEventBannerUrl('');
      setEventPhotosRaw('');
      setEventRegUrl('');
      void loadData();
    } else {
      showToast(res.error || 'Failed to publish event.');
    }
  };

  // Handler: Delete Event
  const handleDeleteEvent = async (id: string, title: string) => {
    const res = await deleteCampusEvent(id);
    if (res.ok) {
      showToast(`Removed "${title}".`);
      setEventsList((prev) => prev.filter((e) => e.id !== id));
    }
  };

  // Handler: Moderate Paper
  const handleModerate = async (paperId: string, action: 'approve' | 'reject') => {
    const res = await applyModeration(paperId, action, user?.email ?? 'admin@gbu.ac.in');
    if (res.ok) {
      showToast(action === 'approve' ? 'Paper published to public library.' : 'Paper rejected.');
      setPendingPapers((prev) => prev.filter((p) => p.id !== paperId));
    } else {
      showToast(res.reason);
    }
  };

  // Handler: Save & Publish Version Release
  const handleSaveVersionManifest = async () => {
    const notes = releaseNotesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const manifest: AppVersionManifest = {
      platform: 'android',
      latestVersion: manifestVersion.trim(),
      minSupportedVersion: minSupported.trim(),
      isMandatory,
      title: isMandatory ? 'Compulsory Update Required' : 'New Version Available',
      message: 'New version of GBU One with essential updates is ready.',
      releaseNotes: notes,
      apkUrl: apkDownloadUrl.trim(),
      releasedAt: new Date().toISOString(),
    };

    const res = await publishAppVersion(manifest);
    if (res.ok) {
      showToast(
        isMandatory
          ? `Compulsory update v${manifest.latestVersion} broadcasted to all devices!`
          : `Release v${manifest.latestVersion} published.`,
      );
    } else {
      showToast(res.error || 'Failed to publish version manifest.');
    }
  };

  // Handler: Clear / Reset Version Manifest
  const handleResetVersion = async () => {
    await clearAppVersionOverride();
    showToast('Version override reset to default.');
    void loadData();
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      {/* Admin Top App Bar */}
      <View style={[styles.header, { borderBottomColor: colors.borderGlass }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Back"
        >
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleCol}>
          <View style={styles.roleBadgeRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>GBU ADMIN CONSOLE</Text>
            </View>
            <View style={styles.liveDot} />
            <Text style={[styles.liveStatusText, { color: colors.textSecondary }]}>Live Sync</Text>
          </View>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>System & Campus Controls</Text>
        </View>
        <TouchableOpacity
          onPress={loadData}
          style={styles.refreshBtn}
          accessibilityLabel="Refresh live data"
        >
          <RefreshCw size={18} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Admin Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          onPress={() => setActiveTab('events')}
          style={[styles.tabBtn, activeTab === 'events' && { borderBottomColor: colors.accent }]}
        >
          <Calendar size={16} color={activeTab === 'events' ? colors.accent : colors.textSecondary} />
          <Text style={[styles.tabText, { color: activeTab === 'events' ? colors.accent : colors.textSecondary }]}>
            Events & Photos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('pyq')}
          style={[styles.tabBtn, activeTab === 'pyq' && { borderBottomColor: colors.accent }]}
        >
          <FileCheck2 size={16} color={activeTab === 'pyq' ? colors.accent : colors.textSecondary} />
          <Text style={[styles.tabText, { color: activeTab === 'pyq' ? colors.accent : colors.textSecondary }]}>
            PYQ ({pendingPapers.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('version')}
          style={[styles.tabBtn, activeTab === 'version' && { borderBottomColor: colors.accent }]}
        >
          <ArrowUpCircle size={16} color={activeTab === 'version' ? colors.accent : colors.textSecondary} />
          <Text style={[styles.tabText, { color: activeTab === 'version' ? colors.accent : colors.textSecondary }]}>
            Auto-Update
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        {/* TAB 1: EVENTS & PHOTOS PUBLISHER */}
        {activeTab === 'events' && (
          <View style={styles.tabContent}>
            <GlassCard style={styles.sectionCard} variant="elevated">
              <View style={styles.cardHeaderRow}>
                <Sparkles size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Publish Campus Event</Text>
              </View>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                Add events with photo galleries. Updates reflect live in the student app.
              </Text>

              {/* Event Title */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Event Title</Text>
              <TextInput
                value={eventTitle}
                onChangeText={setEventTitle}
                placeholder="e.g. Abhivyanjana 2026 Cultural Fest"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
              />

              {/* Event Category Chips */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {EVENT_CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setEventCategory(cat.id as EventCategory)}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: eventCategory === cat.id ? colors.accent : colors.surfaceAlt,
                        borderColor: eventCategory === cat.id ? colors.accent : colors.borderGlass,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: eventCategory === cat.id ? colors.onAccent : colors.textSecondary },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Venue */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Venue & Location</Text>
              <TextInput
                value={eventVenue}
                onChangeText={setEventVenue}
                placeholder="e.g. Main Auditorium & Open Grounds"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
              />

              {/* Description */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Description</Text>
              <TextInput
                value={eventDesc}
                onChangeText={setEventDesc}
                placeholder="Detailed schedule, guest performers, rules, and entry guidelines..."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
                style={[styles.textArea, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
              />

              {/* Banner Image URL */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Banner Image URL (HTTPS)</Text>
              <TextInput
                value={eventBannerUrl}
                onChangeText={setEventBannerUrl}
                placeholder="https://images.unsplash.com/... or uploaded photo link"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
              />

              {/* Photo Gallery URLs */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Event Photo Gallery (One URL per line)</Text>
              <TextInput
                value={eventPhotosRaw}
                onChangeText={setEventPhotosRaw}
                placeholder="https://images.unsplash.com/photo-1...\nhttps://images.unsplash.com/photo-2..."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
                style={[styles.textArea, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
              />

              {/* Registration Link */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Registration URL (Optional)</Text>
              <TextInput
                value={eventRegUrl}
                onChangeText={setEventRegUrl}
                placeholder="https://gbu.ac.in/events/register"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
              />

              <PillButton
                label="Publish Live Campus Event"
                variant="primary"
                size="md"
                onPress={handlePublishEvent}
                icon={<PlusCircle size={16} color={colors.onAccent} style={{ marginRight: 6 }} />}
                style={{ marginTop: 14 }}
              />
            </GlassCard>

            {/* List of Published Events */}
            <Text style={[styles.subHeaderTitle, { color: colors.textPrimary }]}>
              Currently Published Events ({eventsList.length})
            </Text>
            {eventsList.map((evt) => (
              <GlassCard key={evt.id} style={styles.eventItemCard} variant="subtle">
                <View style={styles.eventItemTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.eventItemTitle, { color: colors.textPrimary }]}>{evt.title}</Text>
                    <Text style={[styles.eventItemMeta, { color: colors.textSecondary }]}>
                      {evt.venue} • {evt.category} • {evt.photos?.length ?? 0} photos
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteEvent(evt.id, evt.title)}
                    style={styles.deleteBtn}
                    accessibilityLabel={`Delete ${evt.title}`}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </GlassCard>
            ))}
          </View>
        )}

        {/* TAB 2: PYQ MODERATION */}
        {activeTab === 'pyq' && (
          <View style={styles.tabContent}>
            <GlassCard style={styles.sectionCard} variant="elevated">
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Crowdsourced PYQ Queue</Text>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                Review submissions from all branches before they are listed in the public library.
              </Text>
            </GlassCard>

            {pendingPapers.length === 0 ? (
              <GlassCard style={styles.emptyCard} variant="subtle">
                <CheckCircle2 size={32} color={colors.accent} style={{ marginBottom: 8 }} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Queue is Clear</Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                  All crowdsourced question papers have been approved or reviewed.
                </Text>
              </GlassCard>
            ) : (
              pendingPapers.map((paper) => (
                <GlassCard key={paper.id} style={styles.paperCard} variant="elevated">
                  <View style={styles.paperTopRow}>
                    <View style={[styles.paperBadge, { backgroundColor: colors.accentSoft }]}>
                      <Text style={[styles.paperBadgeText, { color: colors.accent }]}>{paper.subjectCode}</Text>
                    </View>
                    <Text style={[styles.paperExamType, { color: colors.textSecondary }]}>{paper.examType} {paper.year}</Text>
                  </View>
                  <Text style={[styles.paperName, { color: colors.textPrimary }]}>{paper.subjectName}</Text>
                  <Text style={[styles.paperMeta, { color: colors.textTertiary }]}>
                    {paper.school} • {paper.programmeCode || 'General'} • {paper.semester}
                  </Text>

                  <View style={styles.moderationBtnRow}>
                    <PillButton
                      label="Approve & Publish"
                      variant="primary"
                      size="sm"
                      onPress={() => handleModerate(paper.id, 'approve')}
                      style={{ flex: 1, marginRight: 8 }}
                    />
                    <PillButton
                      label="Reject"
                      variant="outline"
                      size="sm"
                      onPress={() => handleModerate(paper.id, 'reject')}
                      style={{ flex: 1 }}
                    />
                  </View>
                </GlassCard>
              ))
            )}
          </View>
        )}

        {/* TAB 3: APP VERSION & AUTO-UPDATE MANAGER */}
        {activeTab === 'version' && (
          <View style={styles.tabContent}>
            <GlassCard style={styles.sectionCard} variant="elevated">
              <View style={styles.cardHeaderRow}>
                <ArrowUpCircle size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Compulsory Auto-Update Manager
                </Text>
              </View>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                Publish new app releases. When marked mandatory, all older student apps display a blocking update modal requiring APK update.
              </Text>

              {/* Version Inputs */}
              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Latest Version</Text>
                  <TextInput
                    value={manifestVersion}
                    onChangeText={setManifestVersion}
                    placeholder="1.1.0"
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Min Supported</Text>
                  <TextInput
                    value={minSupported}
                    onChangeText={setMinSupported}
                    placeholder="1.0.0"
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
                  />
                </View>
              </View>

              {/* Mandatory Switch */}
              <View style={[styles.switchRow, { borderColor: colors.borderGlass, backgroundColor: colors.surfaceAlt }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.switchLabel, { color: colors.textPrimary }]}>Compulsory / Mandatory Mode</Text>
                  <Text style={[styles.switchSub, { color: colors.textSecondary }]}>
                    Students cannot bypass or dismiss the update modal.
                  </Text>
                </View>
                <Switch
                  value={isMandatory}
                  onValueChange={setIsMandatory}
                  thumbColor={isMandatory ? colors.accent : '#9CA3AF'}
                  trackColor={{ false: 'rgba(255,255,255,0.1)', true: colors.accentSoft }}
                />
              </View>

              {/* APK URL */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Direct APK Download URL</Text>
              <TextInput
                value={apkDownloadUrl}
                onChangeText={setApkDownloadUrl}
                placeholder="https://github.com/acro777x/gbu-one/releases/latest"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
              />

              {/* Release Highlights */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Release Notes (One highlight per line)</Text>
              <TextInput
                value={releaseNotesText}
                onChangeText={setReleaseNotesText}
                placeholder="End Sem exam schedule\nEvents photo gallery"
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
                style={[styles.textArea, { color: colors.textPrimary, borderColor: colors.borderGlass, backgroundColor: colors.surface }]}
              />

              <PillButton
                label="Broadcast Version Update"
                variant="primary"
                size="md"
                onPress={handleSaveVersionManifest}
                icon={<ArrowUpCircle size={16} color={colors.onAccent} style={{ marginRight: 6 }} />}
                style={{ marginTop: 14 }}
              />

              <PillButton
                label="Reset to Default"
                variant="outline"
                size="sm"
                onPress={handleResetVersion}
                style={{ marginTop: 10 }}
              />
            </GlassCard>
          </View>
        )}
      </ScrollView>

      <Toast message={toastMessage} visible={toastVisible} onDismiss={() => setToastVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTitleCol: {
    flex: 1,
  },
  roleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  roleBadge: {
    backgroundColor: 'rgba(79, 70, 229, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#6366F1',
    letterSpacing: 0.5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveStatusText: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Poppins-Bold',
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
  },
  content: {
    padding: theme.spacing.md,
  },
  tabContent: {
    gap: 16,
  },
  sectionCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    height: 44,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  textArea: {
    minHeight: 70,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  categoryChipText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    marginVertical: 12,
  },
  switchLabel: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  switchSub: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },
  subHeaderTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    marginTop: 8,
  },
  eventItemCard: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  eventItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventItemTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
  },
  eventItemMeta: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 3,
  },
  deleteBtn: {
    padding: 8,
  },
  emptyCard: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    borderRadius: theme.radius.card,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
  },
  emptySub: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    marginTop: 4,
  },
  paperCard: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.card,
  },
  paperTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  paperBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paperBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
  },
  paperExamType: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  paperName: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  paperMeta: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginBottom: 12,
  },
  moderationBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
