import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';

export const PYQ_LEADERBOARD_STORAGE_KEY = '@gbu_pyq_leaderboard';
export const POINTS_PER_APPROVED_UPLOAD = 50;

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  avatarId: string;
  uniqueStudentId: string;
  points: number;
  uploadsCount: number;
  isOfficialAdmin?: boolean;
  school?: string;
}

export interface CurrentUserParam {
  id: string;
  name: string;
  avatarId?: string;
  uniqueStudentId?: string;
  school?: string;
  points?: number;
  uploadsCount?: number;
}

export function formatStudentId(id: string, customId?: string): string {
  if (customId && customId.trim()) return customId.trim();
  const clean = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (clean.length >= 6) {
    return `GBU-${clean.slice(0, 6)}`;
  }
  return `GBU-${clean.padEnd(6, '0')}`;
}

/**
 * Seed data with GBU Exam Cell Admin at 1000 points and top authentic
 * Gautam Buddha University student contributors from SOICT, SOE, SOBT, and SOM.
 */
export const DEFAULT_LEADERBOARD_SEED: LeaderboardEntry[] = [
  {
    rank: 1,
    id: 'admin_official',
    name: 'GBU Exam Cell & Admin',
    avatarId: 'gbu-admin',
    uniqueStudentId: 'GBU-OFFICIAL',
    points: 1000,
    uploadsCount: 20,
    isOfficialAdmin: true,
    school: 'Central Admin',
  },
  {
    rank: 2,
    id: 'student_aarav',
    name: 'Aarav Sharma',
    avatarId: 'tech-scholar',
    uniqueStudentId: 'GBU-21ICS045',
    points: 750,
    uploadsCount: 15,
    school: 'SOICT',
  },
  {
    rank: 3,
    id: 'student_priya',
    name: 'Priya Singh',
    avatarId: 'engineer',
    uniqueStudentId: 'GBU-22ECE018',
    points: 600,
    uploadsCount: 12,
    school: 'SOE',
  },
  {
    rank: 4,
    id: 'student_rohan',
    name: 'Rohan Verma',
    avatarId: 'cyber-guardian',
    uniqueStudentId: 'GBU-21BCS089',
    points: 500,
    uploadsCount: 10,
    school: 'SOICT',
  },
  {
    rank: 5,
    id: 'student_ananya',
    name: 'Ananya Gupta',
    avatarId: 'lab-scientist',
    uniqueStudentId: 'GBU-23BIO012',
    points: 350,
    uploadsCount: 7,
    school: 'SOBT',
  },
  {
    rank: 6,
    id: 'student_kabir',
    name: 'Kabir Mehta',
    avatarId: 'business-leader',
    uniqueStudentId: 'GBU-22MBA034',
    points: 250,
    uploadsCount: 5,
    school: 'SOM',
  },
  {
    rank: 7,
    id: 'student_tanvi',
    name: 'Tanvi Malik',
    avatarId: 'legal-eagle',
    uniqueStudentId: 'GBU-22LAW019',
    points: 200,
    uploadsCount: 4,
    school: 'SOLJG',
  },
  {
    rank: 8,
    id: 'student_aditya',
    name: 'Aditya Kashyap',
    avatarId: 'creative-artist',
    uniqueStudentId: 'GBU-23HSS008',
    points: 150,
    uploadsCount: 3,
    school: 'SOHSS',
  },
  {
    rank: 9,
    id: 'student_neha',
    name: 'Neha Bhatt',
    avatarId: 'bookworm',
    uniqueStudentId: 'GBU-23SCI042',
    points: 100,
    uploadsCount: 2,
    school: 'SOVSAS',
  },
];

/**
 * Sorts entries descending by points.
 * Breaks ties by uploadsCount, then alphabetically by name.
 * Dynamically assigns ranks 1, 2, 3...
 */
export function sortAndRankEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  entries.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    if (b.uploadsCount !== a.uploadsCount) {
      return b.uploadsCount - a.uploadsCount;
    }
    return a.name.localeCompare(b.name);
  });

  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return entries;
}

/**
 * Retrieves the crowd-sourced PYQ contributor leaderboard from AsyncStorage.
 * Falls back to DEFAULT_LEADERBOARD_SEED if storage is unpopulated.
 * Merges current user if they have contributions.
 *
 * CRITICAL: Admin defaults to #1 with 1000 pts, BUT if any user has > 1000 pts
 * (or passes the admin), that user naturally takes the #1 spot!
 */
export async function getLeaderboard(
  currentUser?: CurrentUserParam,
): Promise<LeaderboardEntry[]> {
  let entries: LeaderboardEntry[] = [];

  try {
    const raw = await AsyncStorage.getItem(PYQ_LEADERBOARD_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        entries = parsed;
      }
    }
  } catch {
    // Fall back to seed on storage read failure
  }

  if (entries.length === 0) {
    entries = DEFAULT_LEADERBOARD_SEED.map((item) => ({ ...item }));
  }

  // Ensure official Admin is always present in the leaderboard
  const hasAdmin = entries.some((e) => e.isOfficialAdmin || e.id === 'admin_official');
  if (!hasAdmin) {
    const adminSeed =
      DEFAULT_LEADERBOARD_SEED.find((e) => e.isOfficialAdmin) || DEFAULT_LEADERBOARD_SEED[0];
    entries.push({ ...adminSeed });
  }

  // Merge current user if provided
  if (currentUser?.id) {
    const existingIndex = entries.findIndex((e) => e.id === currentUser.id);
    if (existingIndex >= 0) {
      // Update profile info for existing contributor
      const existing = entries[existingIndex];
      if (currentUser.name) existing.name = currentUser.name;
      if (currentUser.avatarId) existing.avatarId = currentUser.avatarId;
      if (currentUser.uniqueStudentId) existing.uniqueStudentId = currentUser.uniqueStudentId;
      if (currentUser.school) existing.school = currentUser.school;
      if (typeof currentUser.points === 'number') {
        existing.points = currentUser.points;
      }
      if (typeof currentUser.uploadsCount === 'number') {
        existing.uploadsCount = currentUser.uploadsCount;
      }
      if (existing.points <= 0 && existing.uploadsCount <= 0 && !existing.isOfficialAdmin) {
        entries.splice(existingIndex, 1);
      }
    } else {
      // Only merge if they have contributions
      const hasContributions =
        (typeof currentUser.points === 'number' && currentUser.points > 0) ||
        (typeof currentUser.uploadsCount === 'number' && currentUser.uploadsCount > 0);

      if (hasContributions) {
        const uploads = currentUser.uploadsCount ?? 1;
        const points = currentUser.points ?? uploads * POINTS_PER_APPROVED_UPLOAD;
        entries.push({
          rank: entries.length + 1,
          id: currentUser.id,
          name: currentUser.name || 'GBU Contributor',
          avatarId: currentUser.avatarId || 'tech-scholar',
          uniqueStudentId: formatStudentId(currentUser.id, currentUser.uniqueStudentId),
          points,
          uploadsCount: uploads,
          school: currentUser.school,
        });
      }
    }
  }

  return sortAndRankEntries(entries);
}

/**
 * Awards contribution points (default +50 points per approved PYQ upload)
 * to a student, updates or creates their entry, recalculates rankings dynamically,
 * and saves to AsyncStorage.
 */
export async function awardUploadPoints(
  student: {
    id: string;
    name: string;
    avatarId?: string;
    uniqueStudentId?: string;
    school?: string;
  },
  points?: number,
): Promise<LeaderboardEntry[]> {
  const ptsToAdd = typeof points === 'number' && points > 0 ? points : POINTS_PER_APPROVED_UPLOAD;
  const entries = await getLeaderboard();
  const existing = entries.find((e) => e.id === student.id);

  if (existing) {
    existing.points += ptsToAdd;
    existing.uploadsCount += 1;
    if (student.name) existing.name = student.name;
    if (student.avatarId) existing.avatarId = student.avatarId;
    if (student.uniqueStudentId) existing.uniqueStudentId = student.uniqueStudentId;
    if (student.school) existing.school = student.school;
  } else {
    entries.push({
      rank: entries.length + 1,
      id: student.id,
      name: student.name || 'GBU Contributor',
      avatarId: student.avatarId || 'tech-scholar',
      uniqueStudentId: formatStudentId(student.id, student.uniqueStudentId),
      points: ptsToAdd,
      uploadsCount: 1,
      school: student.school,
    });
  }

  const ranked = sortAndRankEntries(entries);
  try {
    await AsyncStorage.setItem(PYQ_LEADERBOARD_STORAGE_KEY, JSON.stringify(ranked));
  } catch {
    // Non-fatal persistence error fallback
  }

  return ranked;
}

/**
 * Resets the leaderboard to the default initial seed.
 */
export async function resetLeaderboard(): Promise<LeaderboardEntry[]> {
  const initial = sortAndRankEntries(
    DEFAULT_LEADERBOARD_SEED.map((item) => ({ ...item })),
  );
  try {
    await AsyncStorage.setItem(PYQ_LEADERBOARD_STORAGE_KEY, JSON.stringify(initial));
  } catch {
    // Ignore error
  }
  return initial;
}

/**
 * Generates shareable text for `Share.share()` including current top 3,
 * user rank, and invitation to join GBU One.
 */
export function shareLeaderboardSummary(
  entries: LeaderboardEntry[],
  myRank?: number,
): string {
  const top3 = entries.slice(0, 3);
  const crownMedals = ['👑', '🥈', '🥉'];

  const top3Lines = top3
    .map((entry, index) => {
      const medal = crownMedals[index] || `#${entry.rank}`;
      return `${medal} Rank ${entry.rank}: ${entry.name} (${entry.uniqueStudentId}) — ${entry.points} pts (${entry.uploadsCount} papers)`;
    })
    .join('\n');

  let myRankSection = '';
  if (typeof myRank === 'number' && myRank > 0) {
    const myEntry = entries.find((e) => e.rank === myRank);
    if (myEntry) {
      myRankSection = `\n\n🎯 My Standing: Rank #${myEntry.rank} with ${myEntry.points} pts (${myEntry.uploadsCount} uploads)`;
    } else {
      myRankSection = `\n\n🎯 My Standing: Rank #${myRank}`;
    }
  }

  return (
    `🏆 GBU One — PYQ Contributor Leaderboard\n\n` +
    `Top Contributors:\n` +
    `${top3Lines}` +
    `${myRankSection}\n\n` +
    `Contribute past question papers, help fellow Gautam Buddha University students, and climb the leaderboard on GBU One!\n` +
    `Download GBU One: https://gbuone.space`
  );
}

/**
 * Triggers native system share dialog for the leaderboard.
 */
export async function shareLeaderboard(
  entries: LeaderboardEntry[],
  myRank?: number,
): Promise<void> {
  const message = shareLeaderboardSummary(entries, myRank);
  try {
    await Share.share({
      title: 'GBU One — PYQ Contributor Leaderboard',
      message,
    });
  } catch {
    // Graceful dismissal on cancel
  }
}
