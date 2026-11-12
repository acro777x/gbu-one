import React from 'react';
import { Share } from 'react-native';
import {
  getLeaderboard,
  shareLeaderboardSummary,
  shareLeaderboard,
  sortAndRankEntries,
  formatStudentId,
  POINTS_PER_APPROVED_UPLOAD,
  type LeaderboardEntry,
} from '../src/features/pyq/pyqLeaderboard';
import { PyqLeaderboardPodium } from '../src/components/pyq/PyqLeaderboardPodium';

/**
 * The standings are server-derived.
 *
 * The old build shipped a seeded leaderboard with nine invented students
 * and an "Exam Cell & Admin" on 1000 points and showed them as fact. These
 * tests pin the opposite: no invented people, and the points come from the
 * `pyq_contributor_points` view rather than from a local tally.
 */
let mockPoints: Array<Record<string, unknown>> = [];
let mockProfiles: Array<Record<string, unknown>> = [];
let mockPointsError: { message: string } | null = null;

jest.mock('../src/lib/supabase', () => ({
  get isSupabaseConfigured() {
    return true;
  },
  supabase: {
    from: (table: string) => {
      if (table === 'pyq_contributor_points') {
        return {
          select: () =>
            Promise.resolve({ data: mockPoints, error: mockPointsError }),
        };
      }
      const query: {
        select: () => unknown;
        eq: () => unknown;
        limit: () => Promise<unknown>;
      } = {
        select: () => query,
        eq: () => query,
        limit: () => Promise.resolve({ data: mockProfiles, error: null }),
      };
      return query;
    },
  },
}));

describe('PYQ Contributor Leaderboard (server derived)', () => {
  beforeEach(() => {
    mockPoints = [];
    mockProfiles = [];
    mockPointsError = null;
    jest.clearAllMocks();
  });

  describe('No invented contributors', () => {
    it('returns an empty board when the server has no approved uploads', async () => {
      const board = await getLeaderboard();
      expect(board).toEqual([]);
      // The old build always showed "GBU Exam Cell & Admin" on 1000 points.
      expect(board.some((entry) => entry.name.includes('Admin'))).toBe(false);
    });

    it('never invents a name or a score for an unknown contributor', async () => {
      mockPoints = [
        {
          uploader_student_id: 'GBU-21ICS045',
          approved_uploads: 3,
          total_downloads: 40,
          points: 190,
        },
      ];
      const board = await getLeaderboard();
      expect(board).toHaveLength(1);
      expect(board[0].uniqueStudentId).toBe('GBU-21ICS045');
      expect(board[0].name).toBe('GBU Contributor');
      expect(board[0].points).toBe(190);
    });

    it('takes the name and the school from the approved papers', async () => {
      mockPoints = [
        {
          uploader_student_id: 'GBU-21ICS045',
          approved_uploads: 3,
          total_downloads: 40,
          points: 190,
        },
      ];
      mockProfiles = [
        {
          uploader_student_id: 'GBU-21ICS045',
          uploader_name: 'Aarav Sharma',
          uploader_avatar: 'tech-scholar',
          school: 'SOICT',
        },
      ];
      const board = await getLeaderboard();
      expect(board[0].name).toBe('Aarav Sharma');
      expect(board[0].avatarId).toBe('tech-scholar');
      expect(board[0].school).toBe('SOICT');
    });
  });

  describe('Server-derived points', () => {
    it('uses the points of the view, not a local tally', async () => {
      // The view says 999. A local tally (uploads * 50 + downloads) would
      // say 190, so this pins the source of the number.
      mockPoints = [
        {
          uploader_student_id: 'GBU-21ICS045',
          approved_uploads: 3,
          total_downloads: 40,
          points: 999,
        },
      ];
      const board = await getLeaderboard();
      expect(board[0].points).toBe(999);
      expect(board[0].uploadsCount).toBe(3);
    });

    it('uses the same 50 points per approved paper as the server formula', () => {
      expect(POINTS_PER_APPROVED_UPLOAD).toBe(50);
    });

    it('reports a failure instead of pretending the board is empty', async () => {
      mockPointsError = { message: 'permission denied for view pyq_contributor_points' };
      await expect(getLeaderboard()).rejects.toThrow(/permission denied/);
    });

    it('shows the signed-in student their own name on their entry', async () => {
      mockPoints = [
        {
          uploader_student_id: 'GBU-21ICS045',
          approved_uploads: 1,
          total_downloads: 2,
          points: 52,
        },
      ];
      const board = await getLeaderboard({
        id: 'auth-user-id',
        name: 'Aarav Sharma',
        uniqueStudentId: 'GBU-21ICS045',
        school: 'SOICT',
      });
      expect(board[0].name).toBe('Aarav Sharma');
      expect(board[0].school).toBe('SOICT');
    });
  });

  describe('Ranking', () => {
    it('does not modify the array it is given', () => {
      const entries: LeaderboardEntry[] = [
        {
          rank: 0,
          id: 'b',
          name: 'Bravo',
          avatarId: '1',
          uniqueStudentId: 'GBU-2',
          points: 100,
          uploadsCount: 1,
        },
        {
          rank: 0,
          id: 'a',
          name: 'Alpha',
          avatarId: '1',
          uniqueStudentId: 'GBU-1',
          points: 500,
          uploadsCount: 2,
        },
      ];
      const copy = [...entries];
      const ranked = sortAndRankEntries(entries);
      expect(entries).toEqual(copy);
      expect(ranked[0].id).toBe('a');
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].rank).toBe(2);
    });

    it('gives tied contributors the same rank', () => {
      const entries: LeaderboardEntry[] = [
        {
          rank: 0,
          id: 'a',
          name: 'Anil',
          avatarId: '1',
          uniqueStudentId: 'GBU-1',
          points: 500,
          uploadsCount: 10,
        },
        {
          rank: 0,
          id: 'b',
          name: 'Bharat',
          avatarId: '2',
          uniqueStudentId: 'GBU-2',
          points: 500,
          uploadsCount: 10,
        },
        {
          rank: 0,
          id: 'c',
          name: 'Chandra',
          avatarId: '3',
          uniqueStudentId: 'GBU-3',
          points: 100,
          uploadsCount: 1,
        },
      ];
      const ranked = sortAndRankEntries(entries);
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].rank).toBe(1);
      expect(ranked[2].rank).toBe(3);
    });

    it('breaks ties by uploads and then by name', () => {
      const entries: LeaderboardEntry[] = [
        {
          rank: 0,
          id: 'user_a',
          name: 'Anil Kumar',
          avatarId: '1',
          uniqueStudentId: 'GBU-100',
          points: 500,
          uploadsCount: 10,
        },
        {
          rank: 0,
          id: 'user_b',
          name: 'Bharat Patel',
          avatarId: '2',
          uniqueStudentId: 'GBU-200',
          points: 500,
          uploadsCount: 12,
        },
      ];
      const ranked = sortAndRankEntries(entries);
      expect(ranked[0].id).toBe('user_b');
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].id).toBe('user_a');
      expect(ranked[1].rank).toBe(2);
    });
  });

  describe('Native Share Text Formatting', () => {
    const board: LeaderboardEntry[] = [
      {
        rank: 1,
        id: 'GBU-1',
        name: 'Aarav Sharma',
        avatarId: 'tech-scholar',
        uniqueStudentId: 'GBU-21ICS045',
        points: 750,
        uploadsCount: 15,
      },
      {
        rank: 2,
        id: 'GBU-2',
        name: 'Priya Singh',
        avatarId: 'engineer',
        uniqueStudentId: 'GBU-22ECE018',
        points: 600,
        uploadsCount: 12,
      },
    ];

    it('formats shareable summary with top 3 crowns, user rank, and invitation', async () => {
      const text = shareLeaderboardSummary(board, 2);

      expect(text).toContain('GBU One');
      expect(text).toContain('PYQ Contributor Leaderboard');
      expect(text).toContain('👑 Rank 1: Aarav Sharma');
      expect(text).toContain('750 pts');
      expect(text).toContain('🥈 Rank 2: Priya Singh');
      expect(text).toContain('600 pts');
      expect(text).toContain('🎯 My Standing: Rank #2');
      expect(text).toContain('Gautam Buddha University');
      expect(text).toContain('Contribute past question papers');
      expect(text).toContain('https://gbuone.space');
    });

    it('does not invent contributors when the board is empty', async () => {
      const text = shareLeaderboardSummary([], undefined);
      expect(text).toContain('No approved uploads yet');
      expect(text).not.toContain('👑 Rank 1');
      expect(text).not.toContain('🎯 My Standing:');
    });

    it('triggers Share.share with formatted summary', async () => {
      await shareLeaderboard(board, 1);

      expect(Share.share).toHaveBeenCalledTimes(1);
      expect(Share.share).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('GBU One'),
          message: expect.stringContaining('👑 Rank 1'),
        }),
      );
    });
  });

  describe('Student ID formatting', () => {
    it('formats student IDs properly adhering to GBU-XXXXXX format', () => {
      expect(formatStudentId('user1', 'GBU-21ICS045')).toBe('GBU-21ICS045');
      expect(formatStudentId('abc')).toBe('GBU-ABC000');
      expect(formatStudentId('123456789')).toBe('GBU-123456');
    });
  });

  describe('PyqLeaderboardPodium Component', () => {
    const entries: LeaderboardEntry[] = [
      {
        rank: 1,
        id: 'GBU-1',
        name: 'Aarav Sharma',
        avatarId: 'tech-scholar',
        uniqueStudentId: 'GBU-21ICS045',
        points: 750,
        uploadsCount: 15,
      },
      {
        rank: 2,
        id: 'GBU-2',
        name: 'Priya Singh',
        avatarId: 'engineer',
        uniqueStudentId: 'GBU-22ECE018',
        points: 600,
        uploadsCount: 12,
      },
      {
        rank: 3,
        id: 'GBU-3',
        name: 'Rohan Verma',
        avatarId: 'cyber-guardian',
        uniqueStudentId: 'GBU-21BCS089',
        points: 500,
        uploadsCount: 10,
      },
    ];

    it('renders podium structure with crowns, points, and action buttons', () => {
      const stateSpy = jest
        .spyOn(React, 'useState')
        .mockImplementation((() => [undefined, jest.fn()]) as unknown as typeof React.useState);

      const refSpy = jest
        .spyOn(React, 'useRef')
        .mockReturnValue({ current: new (jest.requireMock('react-native').Animated.Value)(1) });

      const effectSpy = jest.spyOn(React, 'useEffect').mockImplementation(() => {});
      const callbackSpy = jest.spyOn(React, 'useCallback').mockImplementation((fn: any) => fn);

      const element = PyqLeaderboardPodium({
        currentUser: {
          id: 'student_aarav',
          name: 'Aarav Sharma',
          avatarId: 'tech-scholar',
          uniqueStudentId: 'GBU-21ICS045',
        },
        entries,
      }) as any;

      expect(element).toBeDefined();
      const children = element.props.children;
      expect(Array.isArray(children)).toBe(true);

      const [header, podiumRow, actionRow] = children;
      expect(header).toBeDefined();
      expect(podiumRow).toBeDefined();
      expect(actionRow).toBeDefined();

      // Podium row should have 3 pillars (top 2, top 1, top 3)
      const pillars = podiumRow.props.children;
      expect(pillars).toHaveLength(3);

      const rank1Pillar = pillars[1];
      expect(rank1Pillar).toBeDefined();
      expect(rank1Pillar.key).toContain('podium_rank_1');

      const rank2Pillar = pillars[0];
      expect(rank2Pillar).toBeDefined();
      expect(rank2Pillar.key).toContain('podium_rank_2');

      const rank3Pillar = pillars[2];
      expect(rank3Pillar).toBeDefined();
      expect(rank3Pillar.key).toContain('podium_rank_3');

      // Action row contains Share Ranking and View Full Leaderboard
      const [shareBtn, expandBtn] = actionRow.props.children;
      expect(shareBtn.props.accessibilityLabel).toBe('Share leaderboard rankings');
      expect(expandBtn.props.accessibilityLabel).toBe('View full leaderboard');

      stateSpy.mockRestore();
      refSpy.mockRestore();
      effectSpy.mockRestore();
      callbackSpy.mockRestore();
    });

    it('renders clean podium without action row when hideActionRow is true', () => {
      const stateSpy = jest
        .spyOn(React, 'useState')
        .mockImplementation((() => [undefined, jest.fn()]) as unknown as typeof React.useState);

      const refSpy = jest
        .spyOn(React, 'useRef')
        .mockReturnValue({ current: new (jest.requireMock('react-native').Animated.Value)(1) });

      const effectSpy = jest.spyOn(React, 'useEffect').mockImplementation(() => {});
      const callbackSpy = jest.spyOn(React, 'useCallback').mockImplementation((fn: any) => fn);

      const element = PyqLeaderboardPodium({
        currentUser: {
          id: 'student_aarav',
          name: 'Aarav Sharma',
          avatarId: 'tech-scholar',
          uniqueStudentId: 'GBU-21ICS045',
        },
        hideActionRow: true,
        entries,
      }) as any;

      expect(element).toBeDefined();
      const children = element.props.children;
      expect(children[0]).toBeDefined();
      expect(children[1]).toBeDefined();
      expect(children[2]).toBe(false);

      stateSpy.mockRestore();
      refSpy.mockRestore();
      effectSpy.mockRestore();
      callbackSpy.mockRestore();
    });
  });
});
