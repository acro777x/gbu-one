/**
 * GBU One — About, University Disclaimer & Privacy Policy
 * Per docs/ROADMAP.md Phase 6, docs/PROJECT_BRIEF.md, docs/LOGO_BRIEF.md
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  Mail,
  Heart,
  ExternalLink,
} from 'lucide-react-native';
import { GlassCard, PillButton } from '../src/components/ui';
import { OfficialSeal } from '../src/components/brand/OfficialSeal';
import { LogoMark } from '../src/components/brand/LogoMark';
import { theme } from '../src/lib/theme';

export default function AboutScreen() {
  const handleEmailContact = () => {
    Linking.openURL('mailto:student.gbuone@gmail.com?subject=GBU%20One%20Inquiry').catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color={theme.colors.ivory} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About GBU One</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Brand Banner */}
        <View style={styles.brandHero}>
          <LogoMark size={64} />
          <View style={styles.titleRow}>
            <Text style={styles.brandGBU}>GBU </Text>
            <Text style={styles.brandOne}>One</Text>
          </View>
          <Text style={styles.brandTagline}>The official all-in-one student companion</Text>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>Version 1.0.0 (Build 2026.10)</Text>
          </View>
        </View>

        {/* Official Seal Slot (Reserved) */}
        <GlassCard style={styles.sealCard}>
          <OfficialSeal />
          <Text style={styles.sealNote}>
            Official GBU crest slot reserved. Displayed under university guidelines upon institutional sign-off.
          </Text>
        </GlassCard>

        {/* University Disclaimer */}
        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeadingRow}>
            <ShieldCheck size={20} color={theme.colors.accent} />
            <Text style={styles.sectionHeading}>University Disclaimer</Text>
          </View>
          <Text style={styles.bodyParagraph}>
            GBU One is an open-source student platform developed for Gautam Buddha University (GBU), Greater Noida.
          </Text>
          <Text style={styles.bodyParagraph}>
            Notices, examination schedules, academic calendars, and class timetables are mirrored directly from public university websites (gbu.ac.in, test.gbu.ac.in, exams.gbu.ac.in, and mygbu.in).
          </Text>
          <Text style={styles.bodyParagraph}>
            Official records maintained by the Office of the Registrar and Examination Controller take precedence over electronic summaries.
          </Text>
        </GlassCard>

        {/* Privacy & Security Guarantees */}
        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeadingRow}>
            <Lock size={20} color={theme.colors.accent} />
            <Text style={styles.sectionHeading}>Privacy & Security Principles</Text>
          </View>

          <View style={styles.privacyItem}>
            <Text style={styles.privacyItemTitle}>Zero Password Storage</Text>
            <Text style={styles.privacyItemDesc}>
              We never store your university Samarth or ERP passwords on our servers or databases.
            </Text>
          </View>

          <View style={styles.privacyItem}>
            <Text style={styles.privacyItemTitle}>On-Device Result Matching</Text>
            <Text style={styles.privacyItemDesc}>
              Result finder queries are processed 100% on your device. Your roll number is never collected or tracked.
            </Text>
          </View>

          <View style={styles.privacyItem}>
            <Text style={styles.privacyItemTitle}>Anonymous Push Alerts</Text>
            <Text style={styles.privacyItemDesc}>
              Push notification tokens are keyed only to your chosen academic section (e.g. BCS-II B) without personal profiling.
            </Text>
          </View>

          <View style={styles.privacyItem}>
            <Text style={styles.privacyItemTitle}>Offline-First Storage</Text>
            <Text style={styles.privacyItemDesc}>
              All schedules, saved papers, and notices are cached locally for zero-latency offline access.
            </Text>
          </View>
        </GlassCard>

        {/* Contact & Takedown */}
        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeadingRow}>
            <Mail size={20} color={theme.colors.accent} />
            <Text style={styles.sectionHeading}>Contact & Copyright Takedown</Text>
          </View>
          <Text style={styles.bodyParagraph}>
            For questions, takedown inquiries, or to report discrepancies in mirrored documents, contact the maintainer team:
          </Text>
          <PillButton
            label="student.gbuone@gmail.com"
            onPress={handleEmailContact}
            variant="outline"
            size="sm"
            icon={<ExternalLink size={14} color={theme.colors.accent} style={{ marginRight: 6 }} />}
            style={{ marginTop: 8 }}
          />
        </GlassCard>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerHeartRow}>
            <Text style={styles.footerText}>Crafted with </Text>
            <Heart size={14} color={theme.colors.accent} fill={theme.colors.accent} />
            <Text style={styles.footerText}> by GBU Students</Text>
          </View>
          <Text style={styles.footerSubText}>Gautam Buddha University • Greater Noida, Uttar Pradesh</Text>
        </View>
      </ScrollView>
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
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: theme.colors.ivory,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 110,
  },
  brandHero: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  brandGBU: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: theme.colors.ivory,
  },
  brandOne: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: theme.colors.accent,
  },
  brandTagline: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  versionBadge: {
    backgroundColor: 'rgba(17, 24, 39, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 10,
  },
  versionText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  sealCard: {
    alignItems: 'center',
    padding: 16,
    marginBottom: theme.spacing.md,
  },
  sealNote: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 16,
  },
  sectionCard: {
    padding: 16,
    marginBottom: theme.spacing.md,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionHeading: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    color: theme.colors.ivory,
  },
  bodyParagraph: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: theme.colors.textPrimary,
    lineHeight: 19,
    marginBottom: 8,
  },
  privacyItem: {
    marginBottom: 10,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.accent,
  },
  privacyItemTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: theme.colors.ivory,
    marginBottom: 2,
  },
  privacyItemDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 17,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerHeartRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: theme.colors.ivory,
  },
  footerSubText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
});
