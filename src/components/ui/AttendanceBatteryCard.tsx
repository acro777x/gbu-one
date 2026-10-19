import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BatteryCharging, BatteryWarning, ShieldCheck, Plus, Minus, AlertCircle } from 'lucide-react-native';
import { GlassCard } from './GlassCard';
import { useAttendanceStore, calculateAttendanceStatus } from '../../features/attendance/attendanceStore';
import { useAppTheme } from '../../lib/ThemeContext';
import { theme } from '../../lib/theme';

export interface AttendanceBatteryCardProps {
  onPressDetails?: () => void;
}

export const AttendanceBatteryCard: React.FC<AttendanceBatteryCardProps> = ({
  onPressDetails,
}) => {
  const { colors, isDark } = useAppTheme();
  const { subjects, markAttended, markMissed } = useAttendanceStore();

  const totalAttended = subjects.reduce((acc, s) => acc + s.attended, 0);
  const totalClasses = subjects.reduce((acc, s) => acc + s.total, 0);
  const overallStatus = calculateAttendanceStatus(totalAttended, totalClasses, 75);

  const percentage = Math.round(overallStatus.percentage);
  const isHealthy = percentage >= 75;
  const isWarning = percentage >= 65 && percentage < 75;

  const batteryColor = isHealthy
    ? colors.success
    : isWarning
      ? colors.warning
      : colors.danger;

  const topSubject = subjects[0];

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

  return (
    <GlassCard style={styles.card} accentBorder={!isHealthy} onPress={onPressDetails}>
      {/* Header Row: Title & Exam Safe Badge */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
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
        </View>

        <View style={[styles.badge, { backgroundColor: `${batteryColor}18`, borderColor: `${batteryColor}55` }]}>
          <Text style={[styles.badgeText, { color: batteryColor }]}>
            {isHealthy ? 'EXAM SAFE' : isWarning ? 'LOW BATTERY' : 'CRITICAL'}
          </Text>
        </View>
      </View>

      {/* Percentage Readout and Status Gauge */}
      <View style={styles.metricRow}>
        <View style={styles.percentageBox}>
          <Text style={[styles.percentageNumber, { color: batteryColor }]}>{percentage}%</Text>
          <Text style={[styles.targetLabel, { color: colors.textSecondary }]}>Min 75% Req</Text>
        </View>

        {/* Battery Bar with Positive Nub */}
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
            {/* Animated/Filled Battery Gauge */}
            <View
              style={[
                styles.batteryFill,
                {
                  width: `${Math.max(4, Math.min(100, percentage))}%`,
                  backgroundColor: batteryColor,
                },
              ]}
            />
            {/* 75% Requirement Milestone Indicator */}
            <View style={[styles.milestoneMarker, { borderColor: colors.textTertiary }]} />
          </View>
          {/* Positive Battery Terminal */}
          <View style={[styles.batteryNub, { backgroundColor: `${batteryColor}77` }]} />
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
              } and remain above 75%.`
            : `Shortage Alert: Attend the next ${overallStatus.classesNeededFor75} ${
                overallStatus.classesNeededFor75 === 1 ? 'class' : 'classes'
              } consecutively to recover.`}
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
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
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
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Minus size={13} color={colors.danger} />
              <Text style={[styles.quickBtnText, { color: colors.danger }]}>Absent</Text>
            </TouchableOpacity>
          </View>
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
    marginBottom: 14,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  statusIconCircle: {
    width: 40,
    height: 40,
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
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  percentageBox: {
    alignItems: 'flex-start',
    minWidth: 70,
  },
  percentageNumber: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    lineHeight: 32,
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
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  batteryFill: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    borderRadius: 5,
    opacity: 0.9,
  },
  milestoneMarker: {
    position: 'absolute',
    left: '75%',
    top: 0,
    bottom: 0,
    width: 1.5,
    borderLeftWidth: 1.5,
    borderStyle: 'dashed',
    opacity: 0.7,
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
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickBtnPresent: {},
  quickBtnAbsent: {},
  quickBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
  },
});

export default AttendanceBatteryCard;
