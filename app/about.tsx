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
import { useAppTheme } from '../src/lib/ThemeContext';
import { theme } from '../src/lib/theme';

export default function AboutScreen() {
  const { colors, isDark } = useAppTheme();

  const handleEmailContact = () => {
    Linking.openURL('mailto:student.gbuone@gmail.com?subject=GBU%20One%20Inquiry').catch(() => {});
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.borderGlass }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>About GBU One</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Brand Banner */}
        <View style={styles.brandHero}>
          <LogoMark size={64} variant={isDark ? 'dark' : 'light'} />
          <View style={styles.titleRow}>
            <Text style={[styles.brandGBU, { color: colors.textPrimary }]}>GBU </Text>
            <Text style={[styles.brandOne, { color: colors.accent }]}>One</Text>
          </View>
          <Text style={[styles.brandTagline, { color: colors.textSecondary }]}>
            The official all-in-one student companion
          </Text>
          <View style={[styles.versionBadge, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.versionText, { color: colors.textSecondary }]}>
              Version 1.0.0 (Build 2026.10)
            </Text>
          </View>
        </View>

        {/* Official Seal Slot (Reserved) */}
        <GlassCard style={styles.sealCard}>
          <OfficialSeal />
          <Text style={[styles.sealNote, { color: colors.textSecondary }]}>
            Official GBU crest slot reserved. Displayed under university guidelines upon institutional sign-off.
          </Text>
        </GlassCard>

        {/* University Disclaimer */}
        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeadingRow}>
            <ShieldCheck size={20} color={colors.accent} />
            <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>University Disclaimer</Text>
          </View>
          <Text style={[styles.bodyParagraph, { color: colors.textPrimary }]}>
            GBU One is an open-source student platform developed for Gautam Buddha University (GBU), Greater Noida.
          </Text>
          <Text style={[styles.bodyParagraph, { color: colors.textPrimary }]}>
            Notices, examination schedules, academic calendars, and class timetables are mirrored directly from public university websites (gbu.ac.in, test.gbu.ac.in, exam.gbu.ac.in, gbuexam.in, and mygbu.in).
          </Text>
          <Text style={[styles.bodyParagraph, { color: colors.textPrimary }]}>
            Official records maintained by the Office of the Registrar and Examination Controller take precedence over electronic summaries.
          </Text>
        </GlassCard>

        {/* Privacy & Security Guarantees */}
        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeadingRow}>
            <Lock size={20} color={colors.accent} />
            <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>Privacy & Security Principles</Text>
          </View>

          <View style={[styles.privacyItem, { borderLeftColor: colors.accent }]}>
            <Text style={[styles.privacyItemTitle, { color: colors.textPrimary }]}>Zero Password Storage</Text>
            <Text style={[styles.privacyItemDesc, { color: colors.textSecondary }]}>
              We never store your university Samarth or ERP passwords on our servers or databases.
            </Text>
          </View>

          <View style={[styles.privacyItem, { borderLeftColor: colors.accent }]}>
            <Text style={[styles.privacyItemTitle, { color: colors.textPrimary }]}>On-Device Result Matching</Text>
            <Text style={[styles.privacyItemDesc, { color: colors.textSecondary }]}>
              Result finder queries are processed 100% on your device. Your roll number is never collected or tracked.
            </Text>
          </View>

          <View style={[styles.privacyItem, { borderLeftColor: colors.accent }]}>
            <Text style={[styles.privacyItemTitle, { color: colors.textPrimary }]}>Anonymous Push Alerts</Text>
            <Text style={[styles.privacyItemDesc, { color: colors.textSecondary }]}>
              Push notification tokens are keyed only to your chosen academic section (e.g. BCS-II B) without personal profiling.
            </Text>
          </View>

          <View style={[styles.privacyItem, { borderLeftColor: colors.accent }]}>
            <Text style={[styles.privacyItemTitle, { color: colors.textPrimary }]}>Offline-First Storage</Text>
            <Text style={[styles.privacyItemDesc, { color: colors.textSecondary }]}>
              All schedules, saved papers, and notices are cached locally for zero-latency offline access.
            </Text>
          </View>
        </GlassCard>

        {/* Contact & Takedown */}
        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeadingRow}>
            <Mail size={20} color={colors.accent} />
            <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>Contact & Copyright Takedown</Text>
          </View>
          <Text style={[styles.bodyParagraph, { color: colors.textPrimary }]}>
            For questions, takedown inquiries, or to report discrepancies in mirrored documents, contact the maintainer team:
          </Text>
          <PillButton
            label="student.gbuone@gmail.com"
            onPress={handleEmailContact}
            variant="outline"
            size="sm"
            icon={<ExternalLink size={14} color={colors.accent} style={{ marginRight: 6 }} />}
            style={{ marginTop: 8 }}
          />
        </GlassCard>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerHeartRow}>
            <Text style={[styles.footerText, { color: colors.textPrimary }]}>Crafted with </Text>
            <Heart size={14} color={colors.accent} fill={colors.accent} />
            <Text style={[styles.footerText, { color: colors.textPrimary }]}> by GBU Students</Text>
          </View>
          <Text style={[styles.footerSubText, { color: colors.textSecondary }]}>
            Gautam Buddha University • Greater Noida, Uttar Pradesh
          </Text>
        </View>
      </ScrollView>
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
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
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
  },
  brandOne: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
  },
  brandTagline: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    marginTop: 4,
  },
  versionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 10,
  },
  versionText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
  },
  sealCard: {
    alignItems: 'center',
    padding: 16,
    marginBottom: theme.spacing.md,
  },
  sealNote: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
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
  },
  bodyParagraph: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  privacyItem: {
    marginBottom: 10,
    paddingLeft: 8,
    borderLeftWidth: 2,
  },
  privacyItemTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    marginBottom: 2,
  },
  privacyItemDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
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
  },
  footerSubText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 4,
  },
});
