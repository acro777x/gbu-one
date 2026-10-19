import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BatteryCharging, BatteryWarning, ShieldCheck, Plus } from 'lucide-react-native';
import { GlassCard } from './GlassCard';
import { useAttendanceStore, calculateAttendanceStatus } from '../../features/attendance/attendanceStore';
import { theme } from '../../lib/theme';

export interface AttendanceBatteryCardProps {
  onPressDetails?: () => void;
}

export const AttendanceBatteryCard: React.FC<AttendanceBatteryCardProps> = ({
  onPressDetails,
}) => {
  const { subjects, markAttended, markMissed } = useAttendanceStore();

  const totalAttended = subjects.reduce((acc, s) => acc + s.attended, 0);
  const totalClasses = subjects.reduce((acc, s) => acc + s.total, 0);
  const overallStatus = calculateAttendanceStatus(totalAttended, totalClasses, 75);

  const percentage = Math.round(overallStatus.percentage);
  const isHealthy = percentage >= 75;
  const isWarning = percentage >= 65 && percentage < 75;

  const batteryColor = isHealthy
    ? theme.colors.success
    : isWarning
      ? theme.colors.warning
      : theme.colors.danger;

  const topSubject = subjects[0];

  const handleQuickPresent = () => {
    if (!topSubject) return;
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
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
      } catch (e) {
        // ignore
      }
    }
    markMissed(topSubject.subjectCode);
  };

  return (
    <GlassCard style={styles.card} accentBorder={!isHealthy} onPress={onPressDetails}>
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <View style={[styles.statusIconCircle, { backgroundColor: `${batteryColor}20` }]}>
            {isHealthy ? (
              <BatteryCharging size={18} color={batteryColor} />
            ) : (
              <BatteryWarning size={18} color={batteryColor} />
            )}
          </View>
          <View>
            <Text style={styles.cardTitle}>Academic Attendance Battery</Text>
            <Text style={styles.cardSubtitle}>
              {totalAttended} of {totalClasses} classes attended across all courses
            </Text>
          </View>
        </View>

        <View style={[styles.badge, { backgroundColor: `${batteryColor}20`, borderColor: batteryColor }]}>
          <Text style={[styles.badgeText, { color: batteryColor }]}>
            {isHealthy ? 'EXAM SAFE' : isWarning ? 'LOW BATTERY' : 'CRITICAL'}
          </Text>
        </View>
      </View>

      {/* Visual Battery Meter */}
      <View style={styles.batteryContainer}>
        <View style={[styles.batteryCasing, { borderColor: `${batteryColor}80` }]}>
          {/* Inner Fill */}
          <View
            style={[
              styles.batteryFill,
              {
                width: `${Math.max(6, Math.min(100, percentage))}%`,
                backgroundColor: batteryColor,
              },
            ]}
          />
          {/* Segment Divider Lines (4 segments: 25%, 50%, 75%, 100%) */}
          <View style={[styles.segmentLine, { left: '25%' }]} />
          <View style={[styles.segmentLine, { left: '50%' }]} />
          <View style={[styles.segmentLine, styles.benchmarkLine, { left: '75%' }]} />

          {/* Centered Percentage readout */}
          <View style={styles.batteryTextContainer}>
            <Text style={styles.batteryPercentageText}>{percentage}%</Text>
          </View>
        </View>
        {/* Positive Terminal Nub */}
        <View style={[styles.batteryNub, { backgroundColor: `${batteryColor}80` }]} />
      </View>

      {/* Advisory Metric Row */}
      <View style={styles.statusRow}>
        <View style={styles.statusItem}>
          <ShieldCheck size={14} color={isHealthy ? theme.colors.success : theme.colors.textSecondary} />
          <Text style={styles.statusLabel}>
            {isHealthy
              ? `Can safely miss ${overallStatus.canBunkMargin} more ${overallStatus.canBunkMargin === 1 ? 'class' : 'classes'}`
              : `Need ${overallStatus.classesNeededFor75} ${overallStatus.classesNeededFor75 === 1 ? 'class' : 'classes'} to reach 75%`}
          </Text>
        </View>

        {topSubject && (
          <View style={styles.quickActionGroup}>
            <TouchableOpacity
              style={styles.quickPresentBtn}
              onPress={handleQuickPresent}
              activeOpacity={0.8}
            >
              <Plus size={12} color={theme.colors.success} />
              <Text style={styles.quickActionText}>Present</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAbsentBtn}
              onPress={handleQuickMissed}
              activeOpacity={0.8}
            >
              <Text style={styles.quickAbsentText}>Absent</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
    marginBottom: theme.spacing.md,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statusIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    color: theme.colors.ivory,
  },
  cardSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.sm,
  },
  batteryCasing: {
    flex: 1,
    height: 30,
    borderRadius: 8,
    borderWidth: 1.5,
    backgroundColor: 'rgba(17, 24, 39, 0.04)',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  batteryNub: {
    width: 4,
    height: 14,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    marginLeft: 2,
  },
  batteryFill: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    borderRadius: 5,
    opacity: 0.85,
  },
  segmentLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.12)',
  },
  benchmarkLine: {
    backgroundColor: theme.colors.textTertiary,
    borderStyle: 'dashed',
  },
  batteryTextContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  batteryPercentageText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 13,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  statusLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  quickActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickPresentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.successSoft,
    borderWidth: 1,
    borderColor: `${theme.colors.success}44`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  quickActionText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: theme.colors.success,
  },
  quickAbsentBtn: {
    backgroundColor: theme.colors.dangerSoft,
    borderWidth: 1,
    borderColor: `${theme.colors.danger}44`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  quickAbsentText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: theme.colors.danger,
  },
});

export default AttendanceBatteryCard;
