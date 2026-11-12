/**
 * GBU One - Attendance Booster (prototype).
 *
 * The booster is a SIMULATOR: it works out what the student's attendance
 * would look like if they attended the next few classes. It is not the
 * university speaking, and it cannot promise a hall ticket - only the
 * university decides that.
 *
 * The banner below says so, in the same words as the other preview
 * screens, and the outcome is stated as a projection rather than a promise.
 */
import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Zap, TrendingUp, CheckCircle, Award } from 'lucide-react-native';
import { GlassCard } from '../src/components/ui/GlassCard';
import { CountUp } from '../src/components/motion/CountUp';
import { useAttendanceStore, calculateAttendanceStatus } from '../src/features/attendance/attendanceStore';
import { useAppTheme } from '../src/lib/ThemeContext';
import { theme } from '../src/lib/theme';

export default function BoostScreen() {
  const { colors } = useAppTheme();
  const { subjects } = useAttendanceStore();
  const [boostLectures, setBoostLectures] = useState<number>(5);

  const totalAttended = subjects.reduce((acc, s) => acc + s.attended, 0);
  const totalClasses = subjects.reduce((acc, s) => acc + s.total, 0);
  // Nothing recorded means there is no percentage to project from.
  const hasRecord = totalClasses > 0;
  const currentStatus = calculateAttendanceStatus(totalAttended, totalClasses, 75);
  const currentPercentage = Math.round(currentStatus.percentage);

  const boostedAttended = totalAttended + boostLectures;
  const boostedTotal = totalClasses + boostLectures;
  const boostedStatus = calculateAttendanceStatus(boostedAttended, boostedTotal, 75);
  const boostedPercentage = Math.round(boostedStatus.percentage);
  const gain = Math.max(0, boostedPercentage - currentPercentage);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.surfaceAlt }]}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Attendance Booster</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/*
          The sample-data banner, the same one the other preview screens
          carry. It is announced to a screen reader: a projection must never
          be read as the student's own record.
        */}
        <View
          style={[styles.previewBanner, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Text style={[styles.previewBannerTitle, { color: colors.accent }]}>PREVIEW MODE • SAMPLE DATA</Text>
          <Text style={[styles.previewBannerText, { color: colors.textSecondary }]}>
            This is a simulator. The percentages below are projections from the attendance recorded on
            this device - they are not your university record, and the university alone decides whether
            you may sit an exam.
          </Text>
        </View>

        {/* Boost Simulation Hero */}
        <GlassCard style={styles.heroCard} glow>
          <View style={styles.heroTop}>
            <View style={[styles.iconCircle, { backgroundColor: colors.accentSoft }]}>
              <Zap size={24} color={colors.accent} />
            </View>
            <Text style={[styles.heroSubtitle, { color: colors.accent }]}>LIVE SIMULATOR</Text>
          </View>

          <View style={styles.comparisonRow}>
            <View style={styles.compBox}>
              <Text style={[styles.compLabel, { color: colors.textSecondary }]}>CURRENT</Text>
              <Text style={[styles.compValue, { color: colors.textPrimary }]}>
                {hasRecord ? `${currentPercentage}%` : '—'}
              </Text>
              <Text style={[styles.compSub, { color: colors.textSecondary }]}>
                {hasRecord ? `${totalAttended}/${totalClasses}` : 'No record yet'}
              </Text>
            </View>

            <TrendingUp size={28} color={colors.success} />

            <View style={styles.compBox}>
              <Text style={[styles.compLabel, { color: colors.success }]}>
                {hasRecord ? `BOOSTED (+${gain}%)` : 'PROJECTED'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                {hasRecord ? (
                  <>
                    <CountUp value={boostedPercentage} style={{ ...styles.compValueBoost, color: colors.success }} />
                    <Text style={[styles.compSign, { color: colors.success }]}>%</Text>
                  </>
                ) : (
                  <Text style={[styles.compValueBoost, { color: colors.success }]}>—</Text>
                )}
              </View>
              <Text style={[styles.compSub, { color: colors.textSecondary }]}>
                {hasRecord ? `${boostedAttended}/${boostedTotal}` : 'No record yet'}
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* Boost Increment Selector */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Choose Attendance Boost Horizon</Text>
        <View style={styles.chipsRow}>
          {[1, 2, 3, 5, 8, 12].map((num) => {
            const isSelected = boostLectures === num;
            return (
              <TouchableOpacity
                key={`boost-${num}`}
                style={[
                  styles.boostChip,
                  {
                    backgroundColor: isSelected ? colors.accent : colors.surface,
                    borderColor: isSelected ? colors.accent : colors.borderGlass,
                  },
                ]}
                onPress={() => setBoostLectures(num)}
                accessibilityRole="button"
                accessibilityLabel={`Simulate attending ${num} more ${num === 1 ? 'class' : 'classes'}`}
              >
                <Text style={[styles.boostChipText, { color: isSelected ? colors.onAccent : colors.textPrimary }]}>
                  +{num} {num === 1 ? 'Class' : 'Classes'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Benefit Summary */}
        <GlassCard style={styles.benefitCard}>
          <Text style={[styles.benefitHeader, { color: colors.textPrimary }]}>Boosted Outcomes</Text>

          <View style={styles.benefitItem}>
            <CheckCircle size={18} color={colors.success} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.benefitTitle, { color: colors.textPrimary }]}>
                {hasRecord && boostedPercentage >= 75
                  ? 'On track for the 75% requirement'
                  : 'Recovering Deficit'}
              </Text>
              <Text style={[styles.benefitDesc, { color: colors.textSecondary }]}>
                {hasRecord
                  ? `Attending your next ${boostLectures} scheduled classes would take your recorded attendance to about ${boostedPercentage}%. Whether that satisfies the university is the university's decision, not this app's.`
                  : 'Record your classes first - until then there is nothing to project from.'}
              </Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <Award size={18} color={colors.accent} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.benefitTitle, { color: colors.textPrimary }]}>
                Safety Buffer Expansion
              </Text>
              <Text style={[styles.benefitDesc, { color: colors.textSecondary }]}>
                {hasRecord
                  ? `On this projection it would leave you about ${boostedStatus.canBunkMargin} classes of cushion for later in the semester.`
                  : 'No buffer can be worked out until some attendance has been recorded.'}
              </Text>
            </View>
          </View>
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBanner: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
  },
  previewBannerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  previewBannerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 17,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 17,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  heroCard: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroSubtitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
  },
  compBox: {
    alignItems: 'center',
  },
  compLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  compValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 32,
  },
  compValueBoost: {
    fontFamily: 'Poppins-Bold',
    fontSize: 32,
  },
  compSign: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    marginLeft: 2,
  },
  compSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: theme.spacing.lg,
  },
  boostChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  boostChipText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  benefitCard: {
    padding: theme.spacing.lg,
  },
  benefitHeader: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    marginBottom: 14,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  benefitTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    marginBottom: 2,
  },
  benefitDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 16,
  },
});
