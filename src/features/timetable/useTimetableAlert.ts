import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GBUTimetableProvider,
  computeTimetableDiff,
  TimetableDiffItem,
  Timetable,
} from './timetableProvider';

const TIMETABLE_SNAPSHOT_KEY = '@gbu_one_timetable_last_snapshot';
const TIMETABLE_LAST_ALERT_KEY = '@gbu_one_timetable_last_alert_id';

export function useTimetableAlert(enrolledClassKey: string = 'BAI-II A') {
  const [modalVisible, setModalVisible] = useState(false);
  const [activeDiff, setActiveDiff] = useState<TimetableDiffItem | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkForChanges() {
      try {
        const provider = new GBUTimetableProvider();
        const currentTimetable = await provider.getTimetable(enrolledClassKey);

        const rawOld = await AsyncStorage.getItem(`${TIMETABLE_SNAPSHOT_KEY}_${enrolledClassKey}`);
        if (!rawOld) {
          // Store first snapshot
          await AsyncStorage.setItem(
            `${TIMETABLE_SNAPSHOT_KEY}_${enrolledClassKey}`,
            JSON.stringify(currentTimetable),
          );
          return;
        }

        const oldTimetable: Timetable = JSON.parse(rawOld);
        const diffs = computeTimetableDiff(oldTimetable, currentTimetable);

        if (diffs.length > 0) {
          const firstDiff = diffs[0];
          const lastAlertId = await AsyncStorage.getItem(
            `${TIMETABLE_LAST_ALERT_KEY}_${enrolledClassKey}`,
          );

          const alertSignature = `${firstDiff.type}_${firstDiff.slot.id}_${firstDiff.slot.start}`;
          if (lastAlertId !== alertSignature && isMounted) {
            setActiveDiff(firstDiff);
            setModalVisible(true);
            await AsyncStorage.setItem(
              `${TIMETABLE_LAST_ALERT_KEY}_${enrolledClassKey}`,
              alertSignature,
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
  }, [enrolledClassKey]);

  const dismissAlert = () => {
    setModalVisible(false);
  };

  return {
    modalVisible,
    activeDiff,
    dismissAlert,
  };
}
