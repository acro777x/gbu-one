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
        >
          <ArrowLeft size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Attendance Booster</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
              <Text style={[styles.compValue, { color: colors.textPrimary }]}>{currentPercentage}%</Text>
              <Text style={[styles.compSub, { color: colors.textSecondary }]}>{totalAttended}/{totalClasses}</Text>
            </View>

            <TrendingUp size={28} color={colors.success} />

            <View style={styles.compBox}>
              <Text style={[styles.compLabel, { color: colors.success }]}>BOOSTED (+{gain}%)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <CountUp value={boostedPercentage} style={{ ...styles.compValueBoost, color: colors.success }} />
                <Text style={[styles.compSign, { color: colors.success }]}>%</Text>
              </View>
              <Text style={[styles.compSub, { color: colors.textSecondary }]}>{boostedAttended}/{boostedTotal}</Text>
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
                {boostedPercentage >= 75 ? 'Guaranteed Exam Hall Ticket Clearance' : 'Recovering Deficit'}
              </Text>
              <Text style={[styles.benefitDesc, { color: colors.textSecondary }]}>
                Attending your next {boostLectures} scheduled classes raises your aggregate attendance to {boostedPercentage}%.
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
                Earns you {boostedStatus.canBunkMargin} emergency buffer classes that can be missed later in the semester without risk.
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
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
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
