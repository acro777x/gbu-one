import { Share } from 'react-native';
import { fetchContributorPoints, fetchContributorProfiles } from './pyqRepository';

/**
 * GBU One — PYQ contributor standings.
 *
 * The standings are SERVER DERIVED. `public.pyq_contributor_points` computes
 * `approved_uploads * 50 + total_downloads` in the database, so two devices
 * can never disagree about a score and a student cannot award themselves
 * points by editing local storage.
 *
 * There is NO seeded leaderboard any more. The old build invented nine
 * students and an "Exam Cell & Admin" with 1000 points and showed them as
 * fact; an empty board is honest, an invented one is not.
 */

/**
 * The points one approved paper is worth. The server view uses the same
 * number, so the copy in the app and the score in the database agree.
 */
export const POINTS_PER_APPROVED_UPLOAD = 50;

export interface LeaderboardEntry {
  rank: number;
  /** The device identity (GBU-XXXXXX) of the contributor. */
  id: string;
  name: string;
  avatarId: string;
  uniqueStudentId: string;
  points: number;
  uploadsCount: number;
  /** How many times the contributor's papers were downloaded. */
  totalDownloads?: number;
  school?: string;
}

export interface CurrentUserParam {
  id: string;
  name: string;
  avatarId?: string;
  uniqueStudentId?: string;
  school?: string;
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
 * Sorts entries descending by points.
 *
 * Breaks ties by uploadsCount, then alphabetically by name. The input array
 * is NOT modified (the old version sorted it in place, which quietly
 * reordered the caller's list) and tied entries SHARE a rank: two
 * contributors with the same score are both rank 2 and the next one is
 * rank 4, the way a race is ranked.
 */
export function sortAndRankEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    if (b.uploadsCount !== a.uploadsCount) {
      return b.uploadsCount - a.uploadsCount;
    }
    return a.name.localeCompare(b.name);
  });

  const tieKey = (entry: LeaderboardEntry): string => `${entry.points}|${entry.uploadsCount}`;
  let previousKey: string | null = null;
  let rank = 0;

  sorted.forEach((entry, index) => {
    const key = tieKey(entry);
    if (key !== previousKey) {
      rank = index + 1;
      previousKey = key;
    }
    entry.rank = rank;
  });

  return sorted;
}

/**
 * Reads the contributor standings.
 *
 * The points come from the server-derived view; the names come from the
 * approved papers. A failure is raised so the screen can tell an empty
 * board apart from a dead backend.
 */
export async function getLeaderboard(
  currentUser?: CurrentUserParam,
): Promise<LeaderboardEntry[]> {
  const pointsRows = await fetchContributorPoints();
  const profiles = await fetchContributorProfiles();
  const profileById = new Map(profiles.map((profile) => [profile.studentId, profile]));

  const entries: LeaderboardEntry[] = pointsRows.map((row) => {
    const studentId = String(row.uploader_student_id ?? '');
    const profile = profileById.get(studentId);
    const isCurrentUser =
      Boolean(currentUser) && currentUser?.uniqueStudentId === studentId;

    return {
      id: studentId,
      rank: 0,
      name:
        (isCurrentUser && currentUser?.name) || profile?.name || 'GBU Contributor',
      avatarId:
        (isCurrentUser && currentUser?.avatarId) || profile?.avatarId || 'tech-scholar',
      uniqueStudentId: studentId || formatStudentId(studentId),
      points: Number(row.points) || 0,
      uploadsCount: Number(row.approved_uploads) || 0,
      totalDownloads: Number(row.total_downloads) || 0,
      school: (isCurrentUser && currentUser?.school) || profile?.school,
    };
  });

  return sortAndRankEntries(entries);
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
    `${top3Lines || 'No approved uploads yet — be the first!'}\n` +
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
