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

// Cold start: initial attendance is empty. Real attendance will be tracked
// from actual classes attended on device, never fabricated for the student.
export const INITIAL_ATTENDANCE: SubjectAttendance[] = [];

interface AttendanceState {
  subjects: SubjectAttendance[];
  markAttended: (subjectCode: string, subjectName?: string) => void;
  markMissed: (subjectCode: string, subjectName?: string) => void;
  setAttendance: (
    subjectCode: string,
    attended: number,
    total: number,
    subjectName?: string,
  ) => void;
  resetAll: () => void;
}

export const useAttendanceStore = create<AttendanceState>()(
  persist(
    (set) => ({
      subjects: INITIAL_ATTENDANCE,

      markAttended: (subjectCode, subjectName) =>
        set((state) => {
          const existing = state.subjects.find((s) => s.subjectCode === subjectCode);
          if (existing) {
            return {
              subjects: state.subjects.map((s) =>
                s.subjectCode === subjectCode
                  ? { ...s, attended: s.attended + 1, total: s.total + 1 }
                  : s,
              ),
            };
          }
          return {
            subjects: [
              ...state.subjects,
              {
                subjectCode,
                subjectName: subjectName || subjectCode,
                attended: 1,
                total: 1,
              },
            ],
          };
        }),

      markMissed: (subjectCode, subjectName) =>
        set((state) => {
          const existing = state.subjects.find((s) => s.subjectCode === subjectCode);
          if (existing) {
            return {
              subjects: state.subjects.map((s) =>
                s.subjectCode === subjectCode ? { ...s, total: s.total + 1 } : s,
              ),
            };
          }
          return {
            subjects: [
              ...state.subjects,
              {
                subjectCode,
                subjectName: subjectName || subjectCode,
                attended: 0,
                total: 1,
              },
            ],
          };
        }),

      setAttendance: (subjectCode, attended, total, subjectName) =>
        set((state) => {
          const safeTotal = Math.max(0, total);
          const safeAttended = Math.min(Math.max(0, attended), safeTotal);
          const existing = state.subjects.find((s) => s.subjectCode === subjectCode);
          if (existing) {
            return {
              subjects: state.subjects.map((s) =>
                s.subjectCode === subjectCode
                  ? {
                      ...s,
                      attended: safeAttended,
                      total: safeTotal,
                      ...(subjectName ? { subjectName } : {}),
                    }
                  : s,
              ),
            };
          }
          return {
            subjects: [
              ...state.subjects,
              {
                subjectCode,
                subjectName: subjectName || subjectCode,
                attended: safeAttended,
                total: safeTotal,
              },
            ],
          };
        }),

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
