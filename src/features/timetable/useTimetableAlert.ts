import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TimetableDiffItem } from './timetableProvider';
import { getSectionTimetable, getTimetableChanges } from './timetableStore';
import { useAuthStore } from '../../store/useAuthStore';

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
        // The store compares the fetched timetable with the cached snapshot
        // and records the differences; the same record drives the "Changed"
        // chips on the Timetable screen.
        await getSectionTimetable(effectiveClassKey);
        const changes = await getTimetableChanges(effectiveClassKey);
        if (changes.length === 0 || !isMounted) return;

        const firstDiff = changes[0];
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
