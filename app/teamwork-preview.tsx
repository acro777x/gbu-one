import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Users, Trophy, BookOpen, Award, CheckCircle } from 'lucide-react-native';
import { GlassCard } from '../src/components/ui/GlassCard';
import { Avatar } from '../src/components/ui/Avatar';
import { useAuthStore } from '../src/store/useAuthStore';
import { useAttendanceStore } from '../src/features/attendance/attendanceStore';
import { useAppTheme } from '../src/lib/ThemeContext';
import { theme } from '../src/lib/theme';

export default function TeamworkPreviewScreen() {
  const { colors } = useAppTheme();
  const { user, classSelection } = useAuthStore();
  const { subjects } = useAttendanceStore();

  const totalAttended = subjects.reduce((acc, s) => acc + s.attended, 0);
  const totalClasses = subjects.reduce((acc, s) => acc + s.total, 0);
  const userPct = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 75;

  const cohortMembers = [
    { id: '1', name: 'Aarav Sharma', role: 'Class Rep', attendance: 88, status: 'Active' },
    { id: '2', name: 'Ishita Verma', role: 'Study Partner', attendance: 82, status: 'Active' },
    { id: '3', name: user?.name || 'You', role: 'Student', attendance: userPct, status: 'Active', isYou: true },
    { id: '4', name: 'Rohan Gupta', role: 'Lab Partner', attendance: 78, status: 'Active' },
    { id: '5', name: 'Pooja Singh', role: 'Student', attendance: 74, status: 'At Risk' },
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Cohort & Teamwork Hub</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section Cohort Hero */}
        <GlassCard style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroSubtitle, { color: colors.accent }]}>SECTION BATCH METRICS</Text>
              <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
                {classSelection?.section || 'BCS-II B'} ({classSelection?.school || 'SOICT'})
              </Text>
              <Text style={[styles.heroDesc, { color: colors.textSecondary }]}>
                Batch aggregate attendance is 74.2%. Your section is on track for exam eligibility!
              </Text>
            </View>

            <View style={[styles.iconCircle, { backgroundColor: colors.accentSoft }]}>
              <Users size={26} color={colors.accent} />
            </View>
          </View>
        </GlassCard>

        {/* Benchmarks Overview */}
        <View style={styles.metricGrid}>
          <GlassCard style={styles.metricItem}>
            <Trophy size={18} color={colors.warning} />
            <Text style={[styles.metricVal, { color: colors.textPrimary }]}>Top 35%</Text>
            <Text style={[styles.metricLbl, { color: colors.textSecondary }]}>Your Batch Standing</Text>
          </GlassCard>

          <GlassCard style={styles.metricItem}>
            <Award size={18} color={colors.success} />
            <Text style={[styles.metricVal, { color: colors.textPrimary }]}>74.2%</Text>
            <Text style={[styles.metricLbl, { color: colors.textSecondary }]}>Cohort Class Avg</Text>
          </GlassCard>
        </View>

        {/* Study Group Circles */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Active Study & Lab Circle</Text>
        <GlassCard style={styles.groupCard}>
          <View style={styles.groupHeader}>
            <View style={[styles.groupIcon, { backgroundColor: colors.accentSoft }]}>
              <BookOpen size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.groupName, { color: colors.textPrimary }]}>SOICT CS-II Study Circle</Text>
              <Text style={[styles.groupSub, { color: colors.textSecondary }]}>5 Members • Shared Attendance Goal: 80%</Text>
            </View>
          </View>

          <View style={[styles.memberList, { borderTopColor: colors.divider }]}>
            {cohortMembers.map((m) => (
              <View key={m.id} style={styles.memberRow}>
                <Avatar name={m.name} size={32} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.memberName, { color: colors.textPrimary }]}>
                    {m.name} {m.isYou ? '(You)' : ''}
                  </Text>
                  <Text style={[styles.memberRole, { color: colors.textSecondary }]}>{m.role}</Text>
                </View>
                <View style={[styles.memberBadge, { backgroundColor: m.attendance >= 75 ? colors.successSoft : colors.dangerSoft }]}>
                  <Text style={[styles.memberBadgeText, { color: m.attendance >= 75 ? colors.success : colors.danger }]}>
                    {m.attendance}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </GlassCard>

        {/* Team Attendance Commitment */}
        <GlassCard style={styles.pledgeCard}>
          <View style={styles.pledgeRow}>
            <CheckCircle size={20} color={colors.success} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.pledgeTitle, { color: colors.textPrimary }]}>Team Attendance Pledge</Text>
              <Text style={[styles.pledgeDesc, { color: colors.textSecondary }]}>
                Study circle members keep each other accountable for early morning 08:30 lectures and proxy alert tracking.
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
    marginBottom: theme.spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroSubtitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    marginBottom: 4,
  },
  heroDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 17,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: theme.spacing.lg,
  },
  metricItem: {
    flex: 1,
    padding: theme.spacing.md,
  },
  metricVal: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    marginTop: 6,
    marginBottom: 2,
  },
  metricLbl: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
  },
  sectionTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    marginBottom: 12,
  },
  groupCard: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupName: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
  },
  groupSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 1,
  },
  memberList: {
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 10,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  memberRole: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 1,
  },
  memberBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  memberBadgeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
  },
  pledgeCard: {
    padding: theme.spacing.lg,
  },
  pledgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pledgeTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    marginBottom: 2,
  },
  pledgeDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 16,
  },
});
