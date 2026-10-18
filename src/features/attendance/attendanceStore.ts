/**
 * GBU One — Local Attendance Tracker & 75% Calculator
 * Per docs/ROADMAP.md Phase 5
 */

import { create } from 'zustand';

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
  if (total <= 0) {
    return {
      percentage: 100,
      isShortage: false,
      classesNeededFor75: 0,
      canBunkMargin: 0,
    };
  }

  const percentage = (attended / total) * 100;
  const isShortage = percentage < targetPercent;

  if (isShortage) {
    // Equation: (attended + x) / (total + x) >= target / 100
    // attended + x >= (target/100)*total + (target/100)*x
    // x * (1 - target/100) >= (target/100)*total - attended
    // x = ceil(((target/100)*total - attended) / (1 - target/100))
    const p = targetPercent / 100;
    const needed = Math.ceil((p * total - attended) / (1 - p));
    return {
      percentage,
      isShortage: true,
      classesNeededFor75: Math.max(0, needed),
      canBunkMargin: 0,
    };
  } else {
    // Can bunk: attended / (total + y) >= target / 100
    // total + y <= attended / (target/100)
    // y <= (attended / (target/100)) - total
    const p = targetPercent / 100;
    const margin = Math.floor(attended / p - total);
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

export const useAttendanceStore = create<AttendanceState>((set) => ({
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
}));
