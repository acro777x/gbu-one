import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  computeTimetableDiff,
  TimetableDiffItem,
  Timetable,
} from './timetableProvider';
import { getSectionTimetable } from './timetableStore';
import { useAuthStore } from '../../store/useAuthStore';

const TIMETABLE_SNAPSHOT_KEY = '@gbu_one_timetable_last_snapshot';
const TIMETABLE_LAST_ALERT_KEY = '@gbu_one_timetable_last_alert_id';

export function useTimetableAlert(enrolledClassKey?: string) {
  const [modalVisible, setModalVisible] = useState(false);
  const [activeDiff, setActiveDiff] = useState<TimetableDiffItem | null>(null);

  const authClass = useAuthStore((s) => s.classSelection?.section);
  const isGuest = useAuthStore((s) => s.isGuest);
  const effectiveClassKey = enrolledClassKey || authClass || 'BCS-II B';

  useEffect(() => {
    let isMounted = true;

    async function checkForChanges() {
      // Do not run background alerts for unauthenticated guest sessions
      if (isGuest) return;

      try {
        const currentTimetable = await getSectionTimetable(effectiveClassKey);

        // Never store or diff against a mock fallback to prevent false alerts
        if (currentTimetable.source === 'mock') {
          return;
        }

        const rawOld = await AsyncStorage.getItem(`${TIMETABLE_SNAPSHOT_KEY}_${effectiveClassKey}`);
        if (!rawOld) {
          // Store first live snapshot
          await AsyncStorage.setItem(
            `${TIMETABLE_SNAPSHOT_KEY}_${effectiveClassKey}`,
            JSON.stringify(currentTimetable),
          );
          return;
        }

        const oldTimetable: Timetable = JSON.parse(rawOld);
        if (oldTimetable.source === 'mock') {
          // Upgrade old mock snapshot to new live snapshot silently
          await AsyncStorage.setItem(
            `${TIMETABLE_SNAPSHOT_KEY}_${effectiveClassKey}`,
            JSON.stringify(currentTimetable),
          );
          return;
        }

        const diffs = computeTimetableDiff(oldTimetable, currentTimetable);

        if (diffs.length > 0) {
          const firstDiff = diffs[0];
          const lastAlertId = await AsyncStorage.getItem(
            `${TIMETABLE_LAST_ALERT_KEY}_${effectiveClassKey}`,
          );

          const alertSignature = `${firstDiff.type}_${firstDiff.slot.id}_${firstDiff.slot.start}`;
          if (lastAlertId !== alertSignature && isMounted) {
            setActiveDiff(firstDiff);
            setModalVisible(true);
            await AsyncStorage.setItem(
              `${TIMETABLE_LAST_ALERT_KEY}_${effectiveClassKey}`,
              alertSignature,
            );
            // Save latest live snapshot
            await AsyncStorage.setItem(
              `${TIMETABLE_SNAPSHOT_KEY}_${effectiveClassKey}`,
              JSON.stringify(currentTimetable),
            );
          }
        }
      } catch (err) {
        console.warn('Error checking for timetable changes:', err);
      }
    }

    checkForChanges();

    return () => {
      isMounted = false;
    };
  }, [effectiveClassKey, isGuest]);

  const dismissAlert = () => {
    setModalVisible(false);
  };

  return {
    modalVisible,
    activeDiff,
    dismissAlert,
  };
}

export default useTimetableAlert;
