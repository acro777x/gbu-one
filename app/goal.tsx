import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Target, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { GlassCard } from '../src/components/ui/GlassCard';
import { CountUp } from '../src/components/motion/CountUp';
import { useAttendanceStore, calculateAttendanceStatus } from '../src/features/attendance/attendanceStore';
import { useAppTheme } from '../src/lib/ThemeContext';
import { theme } from '../src/lib/theme';

export default function GoalScreen() {
  const { colors, isDark } = useAppTheme();
  const { subjects } = useAttendanceStore();
  const [targetGoal, setTargetGoal] = useState<number>(75);

  const totalAttended = subjects.reduce((acc, s) => acc + s.attended, 0);
  const totalClasses = subjects.reduce((acc, s) => acc + s.total, 0);
  const overallStatus = calculateAttendanceStatus(totalAttended, totalClasses, targetGoal);
  const currentPercentage = Math.round(overallStatus.percentage);

  const goalOptions = [
    { target: 75, label: '75%', desc: 'Exam Safe (GBU Mandatory)' },
    { target: 80, label: '80%', desc: 'Safe Buffer Margin' },
    { target: 85, label: '85%', desc: 'Scholarship Eligibility' },
    { target: 90, label: '90%', desc: 'Deans Honours List' },
  ];

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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Attendance Goal Planner</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current Standing Card */}
        <GlassCard style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>CURRENT ATTENDANCE</Text>
              <View style={styles.percentRow}>
                <CountUp value={currentPercentage} style={{ ...styles.summaryPercent, color: colors.textPrimary }} />
                <Text style={[styles.summaryPercentSign, { color: colors.accent }]}>%</Text>
              </View>
              <Text style={[styles.summarySub, { color: colors.textSecondary }]}>
                {totalAttended} of {totalClasses} classes attended
              </Text>
            </View>

            <View style={[styles.iconCircle, { backgroundColor: colors.accentSoft }]}>
              <Target size={28} color={colors.accent} />
            </View>
          </View>
        </GlassCard>

        {/* Target Milestone Selector */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Choose Target Milestone</Text>
        <View style={styles.goalsGrid}>
          {goalOptions.map((opt) => {
            const isSelected = targetGoal === opt.target;
            return (
              <TouchableOpacity
                key={`goal-opt-${opt.target}`}
                style={[
                  styles.goalOptionCard,
                  {
                    backgroundColor: isSelected ? (isDark ? 'rgba(255, 106, 43, 0.16)' : colors.accentSoft) : colors.surface,
                    borderColor: isSelected ? colors.accent : colors.borderGlass,
                  },
                ]}
                onPress={() => setTargetGoal(opt.target)}
                activeOpacity={0.8}
              >
                <View style={styles.goalOptionTop}>
                  <Text style={[styles.goalOptionNum, { color: isSelected ? colors.accent : colors.textPrimary }]}>
                    {opt.label}
                  </Text>
                  {isSelected && <CheckCircle2 size={16} color={colors.accent} />}
                </View>
                <Text style={[styles.goalOptionDesc, { color: colors.textSecondary }]}>{opt.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Milestone Requirement Diagnosis */}
        <GlassCard style={styles.diagnosisCard} accentBorder={overallStatus.isShortage}>
          <View style={styles.diagnosisRow}>
            {overallStatus.isShortage ? (
              <AlertCircle size={22} color={colors.danger} />
            ) : (
              <ShieldCheck size={22} color={colors.success} />
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.diagnosisTitle, { color: colors.textPrimary }]}>
                Target: {targetGoal}% Milestone
              </Text>
              <Text style={[styles.diagnosisBody, { color: colors.textSecondary }]}>
                {overallStatus.isShortage
                  ? `You need to attend the next ${overallStatus.classesNeededFor75} classes consecutively without missing any lecture to attain ${targetGoal}%.`
                  : `You have achieved your ${targetGoal}% milestone with a comfortable safety cushion of ${overallStatus.canBunkMargin} missable classes.`}
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* Subject-Wise Goal Impact */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Subject-Wise Status</Text>
        {subjects.map((sub) => {
          const subStatus = calculateAttendanceStatus(sub.attended, sub.total, targetGoal);
          const isSubSafe = subStatus.percentage >= targetGoal;
          return (
            <GlassCard key={sub.subjectCode} style={styles.subjectCard}>
              <View style={styles.subjectHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.subjectCode, { color: colors.textPrimary }]}>{sub.subjectCode}</Text>
                  <Text style={[styles.subjectName, { color: colors.textSecondary }]} numberOfLines={1}>
                    {sub.subjectName}
                  </Text>
                </View>
                <View style={[styles.subjectBadge, { backgroundColor: isSubSafe ? colors.successSoft : colors.dangerSoft }]}>
                  <Text style={[styles.subjectBadgeText, { color: isSubSafe ? colors.success : colors.danger }]}>
                    {Math.round(subStatus.percentage)}%
                  </Text>
                </View>
              </View>

              <Text style={[styles.subjectAdvice, { color: colors.textSecondary }]}>
                {subStatus.isShortage
                  ? `Attend next ${subStatus.classesNeededFor75} classes to hit ${targetGoal}%`
                  : `Can safely skip ${subStatus.canBunkMargin} classes`}
              </Text>
            </GlassCard>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  summaryCard: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  percentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 4,
  },
  summaryPercent: {
    fontFamily: 'Poppins-Bold',
    fontSize: 36,
  },
  summaryPercentSign: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    marginLeft: 2,
  },
  summarySub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    marginBottom: 12,
  },
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: theme.spacing.lg,
  },
  goalOptionCard: {
    width: '48%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  goalOptionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  goalOptionNum: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
  },
  goalOptionDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    lineHeight: 14,
  },
  diagnosisCard: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  diagnosisRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  diagnosisTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    marginBottom: 4,
  },
  diagnosisBody: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 17,
  },
  subjectCard: {
    padding: 14,
    marginBottom: 10,
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  subjectCode: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  subjectName: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 1,
  },
  subjectBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  subjectBadgeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
  },
  subjectAdvice: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
  },
});
