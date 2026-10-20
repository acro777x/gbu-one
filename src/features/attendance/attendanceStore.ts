/**
 * GBU One — Local Attendance Tracker & 75% Calculator
 * Per docs/ROADMAP.md Phase 5
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage } from '../../lib/storage';

export interface SubjectAttendance {
  subjectCode: string;
  subjectName: string;
  attended: number;
  total: number;
}

export interface AttendanceStatus {
  percentage: number;
  isShortage: boolean;
  classesNeededFor75: number;
  canBunkMargin: number;
}

export function calculateAttendanceStatus(
  attended: number,
  total: number,
  targetPercent: number = 75,
): AttendanceStatus {
  const safeTotal = Math.max(0, total);
  const safeAttended = Math.max(0, Math.min(attended, safeTotal));

  if (safeTotal <= 0) {
    return {
      percentage: 100,
      isShortage: false,
      classesNeededFor75: 0,
      canBunkMargin: 0,
    };
  }

  const percentage = (safeAttended / safeTotal) * 100;

  if (targetPercent <= 0) {
    return {
      percentage,
      isShortage: false,
      classesNeededFor75: 0,
      canBunkMargin: safeTotal,
    };
  }

  const isShortage = percentage < targetPercent;

  if (isShortage) {
    if (targetPercent >= 100) {
      return {
        percentage,
        isShortage: true,
        classesNeededFor75: 999,
        canBunkMargin: 0,
      };
    }
    const p = targetPercent / 100;
    const needed = Math.ceil((p * safeTotal - safeAttended) / (1 - p));
    return {
      percentage,
      isShortage: true,
      classesNeededFor75: Math.max(0, needed),
      canBunkMargin: 0,
    };
  } else {
    const p = targetPercent / 100;
    const margin = Math.floor(safeAttended / p - safeTotal);
    return {
      percentage,
      isShortage: false,
      classesNeededFor75: 0,
      canBunkMargin: Math.max(0, margin),
    };
  }
}

export const INITIAL_ATTENDANCE: SubjectAttendance[] = [
  {
    subjectCode: 'CSE205',
    subjectName: 'Data Structures & Algorithms',
    attended: 24,
    total: 28,
  },
  {
    subjectCode: 'CSE209',
    subjectName: 'Operating Systems',
    attended: 22,
    total: 30,
  },
  {
    subjectCode: 'BAS201',
    subjectName: 'Discrete Mathematics',
    attended: 26,
    total: 30,
  },
  {
    subjectCode: 'CSE211',
    subjectName: 'Database Management Systems',
    attended: 14,
    total: 16,
  },
];

interface AttendanceState {
  subjects: SubjectAttendance[];
  markAttended: (subjectCode: string) => void;
  markMissed: (subjectCode: string) => void;
  setAttendance: (subjectCode: string, attended: number, total: number) => void;
  resetAll: () => void;
}

export const useAttendanceStore = create<AttendanceState>()(
  persist(
    (set) => ({
      subjects: INITIAL_ATTENDANCE,

  markAttended: (subjectCode) =>
    set((state) => ({
      subjects: state.subjects.map((s) =>
        s.subjectCode === subjectCode
          ? { ...s, attended: s.attended + 1, total: s.total + 1 }
          : s,
      ),
    })),

  markMissed: (subjectCode) =>
    set((state) => ({
      subjects: state.subjects.map((s) =>
        s.subjectCode === subjectCode ? { ...s, total: s.total + 1 } : s,
      ),
    })),

  setAttendance: (subjectCode, attended, total) =>
    set((state) => ({
      subjects: state.subjects.map((s) =>
        s.subjectCode === subjectCode
          ? { ...s, attended: Math.min(attended, total), total }
          : s,
      ),
    })),

  resetAll: () => set({ subjects: INITIAL_ATTENDANCE }),
    }),
    {
      name: '@gbu_one_attendance',
      storage: createJSONStorage(() => zustandStorage),
      // Persist only user data; actions are functions and never serialised.
      partialize: (state) => ({ subjects: state.subjects }) as AttendanceState,
    }
  )
);
