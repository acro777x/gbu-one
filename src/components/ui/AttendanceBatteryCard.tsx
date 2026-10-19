import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  BatteryCharging,
  BatteryWarning,
  ShieldCheck,
  Plus,
  Minus,
  AlertCircle,
  Target,
  Zap,
  Users,
  ChevronRight,
  TrendingUp,
} from 'lucide-react-native';
import { GlassCard } from './GlassCard';
import { CountUp } from '../motion/CountUp';
import { useAttendanceStore, calculateAttendanceStatus } from '../../features/attendance/attendanceStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppTheme } from '../../lib/ThemeContext';
import { theme } from '../../lib/theme';

export type BatteryCardMode = 'battery' | 'goal' | 'boost' | 'teamwork';

export interface AttendanceBatteryCardProps {
  onPressDetails?: () => void;
  initialMode?: BatteryCardMode;
}

export const AttendanceBatteryCard: React.FC<AttendanceBatteryCardProps> = ({
  onPressDetails,
  initialMode = 'battery',
}) => {
  const { colors, isDark } = useAppTheme();
  const { subjects, markAttended, markMissed } = useAttendanceStore();
  const { classSelection } = useAuthStore();
  const [activeMode, setActiveMode] = useState<BatteryCardMode>(initialMode);
  const [selectedGoal, setSelectedGoal] = useState<number>(75);
  const [boostCount, setBoostCount] = useState<number>(3);

  const totalAttended = subjects.reduce((acc, s) => acc + s.attended, 0);
  const totalClasses = subjects.reduce((acc, s) => acc + s.total, 0);
  const overallStatus = calculateAttendanceStatus(totalAttended, totalClasses, selectedGoal);

  const percentage = Math.round(overallStatus.percentage);
  const isHealthy = percentage >= 75;
  const isWarning = percentage >= 65 && percentage < 75;

  const batteryColor = isHealthy
    ? colors.success
    : isWarning
      ? colors.warning
      : colors.danger;

  const topSubject = subjects[0];

  const handleModeSwitch = (mode: BatteryCardMode) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch {
        // ignore
      }
    }
    setActiveMode(mode);
  };

  const handleQuickPresent = () => {
    if (!topSubject) return;
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // ignore
      }
    }
    markAttended(topSubject.subjectCode);
  };

  const handleQuickMissed = () => {
    if (!topSubject) return;
    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {
        // ignore
      }
    }
    markMissed(topSubject.subjectCode);
  };

  // Boost calculation
  const boostedAttended = totalAttended + boostCount;
  const boostedTotal = totalClasses + boostCount;
  const boostedStatus = calculateAttendanceStatus(boostedAttended, boostedTotal, 75);
  const boostedPercentage = Math.round(boostedStatus.percentage);
  const boostGain = Math.max(0, boostedPercentage - percentage);

  return (
    <GlassCard style={styles.card} accentBorder={!isHealthy}>
      {/* Header Row: Title & Exam Safe Badge */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.titleWithIcon}
          onPress={onPressDetails || (() => router.push('/profile' as never))}
          activeOpacity={0.8}
        >
          <View style={[styles.statusIconCircle, { backgroundColor: `${batteryColor}18` }]}>
            {isHealthy ? (
              <BatteryCharging size={20} color={batteryColor} />
            ) : (
              <BatteryWarning size={20} color={batteryColor} />
            )}
          </View>
          <View style={styles.titleTextCol}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Attendance Battery</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {totalAttended} of {totalClasses} classes attended
            </Text>
          </View>
        </TouchableOpacity>

        <View style={[styles.badge, { backgroundColor: `${batteryColor}18`, borderColor: `${batteryColor}55` }]}>
          <Text style={[styles.badgeText, { color: batteryColor }]}>
            {isHealthy ? 'EXAM SAFE' : isWarning ? 'LOW BATTERY' : 'CRITICAL'}
          </Text>
        </View>
      </View>

      {/* Mode Segment Bar: Battery | Goal | Boost | Teamwork */}
      <View style={[styles.modeBar, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderGlass }]}>
        <TouchableOpacity
          style={[styles.modeBtn, activeMode === 'battery' && [styles.modeBtnActive, { backgroundColor: colors.surface }]]}
          onPress={() => handleModeSwitch('battery')}
        >
          <Text style={[styles.modeBtnText, { color: activeMode === 'battery' ? colors.accent : colors.textSecondary }]}>
            Battery
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeBtn, activeMode === 'goal' && [styles.modeBtnActive, { backgroundColor: colors.surface }]]}
          onPress={() => handleModeSwitch('goal')}
        >
          <View style={styles.modeIconRow}>
            <Target size={11} color={activeMode === 'goal' ? colors.accent : colors.textSecondary} />
            <Text style={[styles.modeBtnText, { color: activeMode === 'goal' ? colors.accent : colors.textSecondary }]}>
              Goal
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeBtn, activeMode === 'boost' && [styles.modeBtnActive, { backgroundColor: colors.surface }]]}
          onPress={() => handleModeSwitch('boost')}
        >
          <View style={styles.modeIconRow}>
            <Zap size={11} color={activeMode === 'boost' ? colors.accent : colors.textSecondary} />
            <Text style={[styles.modeBtnText, { color: activeMode === 'boost' ? colors.accent : colors.textSecondary }]}>
              Boost
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeBtn, activeMode === 'teamwork' && [styles.modeBtnActive, { backgroundColor: colors.surface }]]}
          onPress={() => handleModeSwitch('teamwork')}
        >
          <View style={styles.modeIconRow}>
            <Users size={11} color={activeMode === 'teamwork' ? colors.accent : colors.textSecondary} />
            <Text style={[styles.modeBtnText, { color: activeMode === 'teamwork' ? colors.accent : colors.textSecondary }]}>
              Teamwork
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* MODE 1: BATTERY VIEW */}
      {activeMode === 'battery' && (
        <View style={styles.modeContent}>
          {/* Percentage Readout and Sleek Modern Battery Bar */}
          <View style={styles.metricRow}>
            <View style={styles.percentageBox}>
              <View style={styles.percentRow}>
                <CountUp value={percentage} style={{ ...styles.percentageNumber, color: batteryColor }} />
                <Text style={[styles.percentSign, { color: batteryColor }]}>%</Text>
              </View>
              <Text style={[styles.targetLabel, { color: colors.textSecondary }]}>Min 75% Req</Text>
            </View>

            {/* Battery Housing */}
            <View style={styles.batteryWrapper}>
              <View
                style={[
                  styles.batteryCasing,
                  {
                    borderColor: `${batteryColor}66`,
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                  },
                ]}
              >
                {/* 4 Internal Battery Cell Segments */}
                <View style={styles.segmentsRow}>
                  {[0, 1, 2, 3].map((cellIdx) => {
                    const threshold = (cellIdx + 1) * 25;
                    const isCellFilled = percentage >= threshold - 12;
                    return (
                      <View
                        key={`cell-${cellIdx}`}
                        style={[
                          styles.batteryCell,
                          {
                            backgroundColor: isCellFilled ? batteryColor : 'transparent',
                            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                          },
                        ]}
                      />
                    );
                  })}
                </View>

                {/* 75% Requirement Milestone Indicator */}
                <View style={[styles.milestoneMarker, { borderColor: isDark ? '#FFF' : '#000' }]} />
              </View>
              {/* Positive Battery Terminal */}
              <View style={[styles.batteryNub, { backgroundColor: `${batteryColor}99` }]} />
            </View>
          </View>

          {/* Smart Safety Margin Advice Banner */}
          <View
            style={[
              styles.adviceBanner,
              {
                backgroundColor: isHealthy ? colors.successSoft : colors.dangerSoft,
                borderColor: isHealthy ? `${colors.success}33` : `${colors.danger}33`,
              },
            ]}
          >
            {isHealthy ? (
              <ShieldCheck size={16} color={colors.success} style={styles.adviceIcon} />
            ) : (
              <AlertCircle size={16} color={colors.danger} style={styles.adviceIcon} />
            )}
            <Text
              style={[
                styles.adviceText,
                { color: isHealthy ? colors.success : colors.danger },
              ]}
            >
              {isHealthy
                ? `Safety Margin: You can safely miss ${overallStatus.canBunkMargin} more ${
                    overallStatus.canBunkMargin === 1 ? 'class' : 'classes'
                  } and stay above 75%.`
                : `Shortage Alert: Attend the next ${overallStatus.classesNeededFor75} ${
                    overallStatus.classesNeededFor75 === 1 ? 'class' : 'classes'
                  } consecutively to reach 75%.`}
            </Text>
          </View>

          {/* Quick Attendance Logging Section */}
          {topSubject && (
            <View style={[styles.quickSection, { borderTopColor: colors.divider }]}>
              <View style={styles.quickSubjectCol}>
                <Text style={[styles.quickSubjectCode, { color: colors.textPrimary }]} numberOfLines={1}>
                  {topSubject.subjectCode}
                </Text>
                <Text style={[styles.quickSubjectName, { color: colors.textSecondary }]} numberOfLines={1}>
                  {topSubject.subjectName}
                </Text>
              </View>

              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={[
                    styles.quickBtn,
                    styles.quickBtnPresent,
                    { backgroundColor: colors.successSoft, borderColor: `${colors.success}44` },
                  ]}
                  onPress={handleQuickPresent}
                  activeOpacity={0.75}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Plus size={13} color={colors.success} />
                  <Text style={[styles.quickBtnText, { color: colors.success }]}>Present</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.quickBtn,
                    styles.quickBtnAbsent,
                    { backgroundColor: colors.dangerSoft, borderColor: `${colors.danger}44` },
                  ]}
                  onPress={handleQuickMissed}
                  activeOpacity={0.75}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Minus size={13} color={colors.danger} />
                  <Text style={[styles.quickBtnText, { color: colors.danger }]}>Absent</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* MODE 2: GOAL SIMULATOR (/goal) */}
      {activeMode === 'goal' && (
        <View style={styles.modeContent}>
          <Text style={[styles.subModeHeader, { color: colors.textPrimary }]}>Select Target Goal:</Text>
          <View style={styles.goalChipsRow}>
            {[75, 80, 85, 90].map((goalVal) => {
              const isSelected = selectedGoal === goalVal;
              return (
                <TouchableOpacity
                  key={`goal-${goalVal}`}
                  style={[
                    styles.goalChip,
                    {
                      backgroundColor: isSelected ? colors.accent : colors.surfaceAlt,
                      borderColor: isSelected ? colors.accent : colors.borderGlass,
                    },
                  ]}
                  onPress={() => setSelectedGoal(goalVal)}
                >
                  <Text style={[styles.goalChipText, { color: isSelected ? colors.onAccent : colors.textPrimary }]}>
                    {goalVal}% {goalVal === 75 ? '(Min)' : goalVal === 85 ? '(Good)' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.goalCalcBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderGlass }]}>
            <Text style={[styles.goalCalcTitle, { color: colors.textPrimary }]}>
              Target: {selectedGoal}% Attendance
            </Text>
            <Text style={[styles.goalCalcDesc, { color: colors.textSecondary }]}>
              {overallStatus.isShortage
                ? `To hit your ${selectedGoal}% goal, you must attend the next ${overallStatus.classesNeededFor75} classes without missing.`
                : `You are on track for ${selectedGoal}%! You can afford to miss up to ${overallStatus.canBunkMargin} classes.`}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.moreActionLink}
            onPress={() => router.push('/goal' as never)}
          >
            <Text style={[styles.moreActionLinkText, { color: colors.accent }]}>Open Full Goal Planner</Text>
            <ChevronRight size={14} color={colors.accent} />
          </TouchableOpacity>
        </View>
      )}

      {/* MODE 3: BOOST SIMULATOR (/boost) */}
      {activeMode === 'boost' && (
        <View style={styles.modeContent}>
          <Text style={[styles.subModeHeader, { color: colors.textPrimary }]}>Simulate Upcoming Classes Attended:</Text>
          <View style={styles.goalChipsRow}>
            {[1, 3, 5, 10].map((num) => {
              const isSelected = boostCount === num;
              return (
                <TouchableOpacity
                  key={`boost-${num}`}
                  style={[
                    styles.goalChip,
                    {
                      backgroundColor: isSelected ? colors.accent : colors.surfaceAlt,
                      borderColor: isSelected ? colors.accent : colors.borderGlass,
                    },
                  ]}
                  onPress={() => setBoostCount(num)}
                >
                  <Text style={[styles.goalChipText, { color: isSelected ? colors.onAccent : colors.textPrimary }]}>
                    +{num} {num === 1 ? 'Class' : 'Classes'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.boostResultRow, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderGlass }]}>
            <View style={styles.boostCol}>
              <Text style={[styles.boostColLabel, { color: colors.textSecondary }]}>Current</Text>
              <Text style={[styles.boostColValue, { color: colors.textPrimary }]}>{percentage}%</Text>
            </View>

            <TrendingUp size={20} color={colors.success} style={{ marginHorizontal: 8 }} />

            <View style={styles.boostCol}>
              <Text style={[styles.boostColLabel, { color: colors.textSecondary }]}>Boosted (+{boostGain}%)</Text>
              <Text style={[styles.boostColValue, { color: colors.success }]}>{boostedPercentage}%</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.moreActionLink}
            onPress={() => router.push('/boost' as never)}
          >
            <Text style={[styles.moreActionLinkText, { color: colors.accent }]}>Open Attendance Booster</Text>
            <ChevronRight size={14} color={colors.accent} />
          </TouchableOpacity>
        </View>
      )}

      {/* MODE 4: TEAMWORK PREVIEW (/teamwork-preview) */}
      {activeMode === 'teamwork' && (
        <View style={styles.modeContent}>
          <View style={[styles.teamworkCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderGlass }]}>
            <View style={styles.teamworkRow}>
              <View>
                <Text style={[styles.teamworkSectionName, { color: colors.textPrimary }]}>
                  {classSelection?.section || 'BCS-II B'} Cohort
                </Text>
                <Text style={[styles.teamworkSub, { color: colors.textSecondary }]}>
                  Batch average: 74.2% • Top 35% standing
                </Text>
              </View>
              <View style={[styles.teamworkBadge, { backgroundColor: colors.successSoft }]}>
                <Text style={[styles.teamworkBadgeText, { color: colors.success }]}>Leaderboard Safe</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.moreActionLink}
            onPress={() => router.push('/teamwork-preview' as never)}
          >
            <Text style={[styles.moreActionLinkText, { color: colors.accent }]}>Open Teamwork Hub</Text>
            <ChevronRight size={14} color={colors.accent} />
          </TouchableOpacity>
        </View>
      )}
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  statusIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleTextCol: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    flexShrink: 0,
    marginLeft: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    letterSpacing: 0.6,
  },
  modeBar: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    marginBottom: 14,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modeIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modeBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
  },
  modeContent: {
    marginTop: 2,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  percentageBox: {
    alignItems: 'flex-start',
    minWidth: 72,
  },
  percentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  percentageNumber: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    lineHeight: 32,
  },
  percentSign: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    marginLeft: 2,
  },
  targetLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
    marginTop: 1,
  },
  batteryWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  batteryCasing: {
    flex: 1,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    padding: 2,
  },
  segmentsRow: {
    flexDirection: 'row',
    gap: 3,
    height: '100%',
  },
  batteryCell: {
    flex: 1,
    borderRadius: 4,
    borderWidth: 0.5,
  },
  milestoneMarker: {
    position: 'absolute',
    left: '75%',
    top: 0,
    bottom: 0,
    width: 1.5,
    borderLeftWidth: 1.5,
    borderStyle: 'dashed',
    opacity: 0.8,
  },
  batteryNub: {
    width: 4,
    height: 12,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    marginLeft: 2,
  },
  adviceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  adviceIcon: {
    marginRight: 8,
    flexShrink: 0,
  },
  adviceText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  quickSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 8,
  },
  quickSubjectCol: {
    flex: 1,
  },
  quickSubjectCode: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  quickSubjectName: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 1,
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickBtnPresent: {},
  quickBtnAbsent: {},
  quickBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
  },
  subModeHeader: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    marginBottom: 8,
  },
  goalChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  goalChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalChipText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
  },
  goalCalcBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  goalCalcTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 13,
    marginBottom: 4,
  },
  goalCalcDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  boostResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  boostCol: {
    alignItems: 'center',
  },
  boostColLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginBottom: 2,
  },
  boostColValue: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
  },
  teamworkCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  teamworkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamworkSectionName: {
    fontFamily: 'Poppins-Bold',
    fontSize: 13,
  },
  teamworkSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 2,
  },
  teamworkBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  teamworkBadgeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
  },
  moreActionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  moreActionLinkText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
});

export default AttendanceBatteryCard;
