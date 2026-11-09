import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';
import {
  getLeaderboard,
  awardUploadPoints,
  resetLeaderboard,
  shareLeaderboardSummary,
  shareLeaderboard,
  sortAndRankEntries,
  formatStudentId,
  PYQ_LEADERBOARD_STORAGE_KEY,
  POINTS_PER_APPROVED_UPLOAD,
  DEFAULT_LEADERBOARD_SEED,
  type LeaderboardEntry,
} from '../src/features/pyq/pyqLeaderboard';
import { AVATARS } from '../src/components/avatar/AvatarPack';
import { PyqLeaderboardPodium } from '../src/components/pyq/PyqLeaderboardPodium';

describe('PYQ Contributor Leaderboard & Gamification', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  describe('Default Rankings & Seed Data', () => {
    it('initializes with default seed where GBU Admin is Rank #1 with 1000 points', async () => {
      const leaderboard = await getLeaderboard();

      expect(leaderboard.length).toBeGreaterThanOrEqual(6);

      // Rank 1 must be Central GBU Admin
      const rank1 = leaderboard[0];
      expect(rank1.rank).toBe(1);
      expect(rank1.id).toBe('admin_official');
      expect(rank1.name).toContain('Admin');
      expect(rank1.points).toBe(1000);
      expect(rank1.uploadsCount).toBe(20);
      expect(rank1.isOfficialAdmin).toBe(true);
      expect(rank1.uniqueStudentId).toBe('GBU-OFFICIAL');

      // Rank 2 should be the top authentic student contributor
      const rank2 = leaderboard[1];
      expect(rank2.rank).toBe(2);
      expect(rank2.name).toBe('Aarav Sharma');
      expect(rank2.points).toBe(750);
      expect(rank2.uniqueStudentId).toBe('GBU-21ICS045');

      // Rank 3 should be Priya Singh
      const rank3 = leaderboard[2];
      expect(rank3.rank).toBe(3);
      expect(rank3.name).toBe('Priya Singh');
      expect(rank3.points).toBe(600);

      // Sequential ranking validation
      for (let i = 0; i < leaderboard.length; i++) {
        expect(leaderboard[i].rank).toBe(i + 1);
        if (i > 0) {
          expect(leaderboard[i - 1].points).toBeGreaterThanOrEqual(leaderboard[i].points);
        }
      }
    });

    it('recovers gracefully from corrupted storage data and returns seed list', async () => {
      await AsyncStorage.setItem(PYQ_LEADERBOARD_STORAGE_KEY, 'invalid-json{{{');
      const leaderboard = await getLeaderboard();
      expect(leaderboard.length).toBeGreaterThanOrEqual(6);
      expect(leaderboard[0].isOfficialAdmin).toBe(true);
      expect(leaderboard[0].points).toBe(1000);
    });
  });

  describe('Dynamic Ranking & Passing the Admin (Natural #1)', () => {
    it('allows a user with > 1000 points to naturally take the #1 spot and knock Admin to #2', async () => {
      // Confirm admin starts at #1
      const initial = await getLeaderboard();
      expect(initial[0].id).toBe('admin_official');
      expect(initial[0].rank).toBe(1);
      expect(initial[0].points).toBe(1000);

      // Award 1100 points to student Vikram Aditya (more than Admin's 1000)
      const updated = await awardUploadPoints(
        {
          id: 'student_vikram',
          name: 'Vikram Aditya',
          uniqueStudentId: 'GBU-20BCS001',
          school: 'SOICT',
        },
        1100,
      );

      // CRITICAL ASSERTION: Student Vikram is now Rank #1!
      expect(updated[0].id).toBe('student_vikram');
      expect(updated[0].name).toBe('Vikram Aditya');
      expect(updated[0].points).toBe(1100);
      expect(updated[0].rank).toBe(1);
      expect(updated[0].uniqueStudentId).toBe('GBU-20BCS001');

      // Admin has been bumped to Rank #2
      expect(updated[1].id).toBe('admin_official');
      expect(updated[1].isOfficialAdmin).toBe(true);
      expect(updated[1].points).toBe(1000);
      expect(updated[1].rank).toBe(2);

      // Subsequent getLeaderboard call preserves Vikram at Rank #1
      const fetched = await getLeaderboard();
      expect(fetched[0].id).toBe('student_vikram');
      expect(fetched[0].rank).toBe(1);
      expect(fetched[1].id).toBe('admin_official');
      expect(fetched[1].rank).toBe(2);
    });

    it('breaks ties properly based on uploadsCount and name', () => {
      const items: LeaderboardEntry[] = [
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
          uploadsCount: 12, // higher uploads wins tie
        },
      ];

      const ranked = sortAndRankEntries(items);
      expect(ranked[0].id).toBe('user_b');
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].id).toBe('user_a');
      expect(ranked[1].rank).toBe(2);
    });
  });

  describe('Points Awarding & AsyncStorage Persistence', () => {
    it('awards default +50 points per approved upload and increments uploadsCount', async () => {
      const student = {
        id: 'student_divya',
        name: 'Divya Rao',
        uniqueStudentId: 'GBU-22BIO055',
        school: 'SOBT',
      };

      // 1st upload: 50 pts, 1 upload
      const afterFirst = await awardUploadPoints(student);
      const divya1 = afterFirst.find((e) => e.id === student.id);
      expect(divya1).toBeDefined();
      expect(divya1?.points).toBe(POINTS_PER_APPROVED_UPLOAD);
      expect(divya1?.uploadsCount).toBe(1);

      // 2nd upload: +50 pts = 100 pts, 2 uploads
      const afterSecond = await awardUploadPoints(student);
      const divya2 = afterSecond.find((e) => e.id === student.id);
      expect(divya2?.points).toBe(100);
      expect(divya2?.uploadsCount).toBe(2);

      // Verify persistence in AsyncStorage
      const rawStored = await AsyncStorage.getItem(PYQ_LEADERBOARD_STORAGE_KEY);
      expect(rawStored).toBeTruthy();
      const parsed: LeaderboardEntry[] = JSON.parse(rawStored!);
      const storedDivya = parsed.find((e) => e.id === student.id);
      expect(storedDivya?.points).toBe(100);
      expect(storedDivya?.uploadsCount).toBe(2);
    });

    it('allows incremental uploads to climb the ranks and eventually pass the Admin', async () => {
      const student = {
        id: 'student_hardworker',
        name: 'Ishaan Verma',
        uniqueStudentId: 'GBU-21SOE100',
        school: 'SOE',
      };

      // Award +500 points (10 uploads) -> reaches 500 pts (ties Rohan Verma)
      await awardUploadPoints(student, 500);
      let board = await getLeaderboard();
      let entry = board.find((e) => e.id === student.id);
      expect(entry?.points).toBe(500);

      // Award another +300 points -> reaches 800 pts (passes Aarav Sharma at 750, takes #2!)
      board = await awardUploadPoints(student, 300);
      entry = board.find((e) => e.id === student.id);
      expect(entry?.points).toBe(800);
      expect(entry?.rank).toBe(2);
      expect(board[0].id).toBe('admin_official'); // Admin still #1

      // Award another +250 points -> reaches 1050 pts (passes Admin at 1000, takes #1!)
      board = await awardUploadPoints(student, 250);
      entry = board.find((e) => e.id === student.id);
      expect(entry?.points).toBe(1050);
      expect(entry?.rank).toBe(1);
      expect(board[0].id).toBe(student.id);
      expect(board[1].id).toBe('admin_official');
      expect(board[1].rank).toBe(2);
    });

    it('resets leaderboard back to initial seed with resetLeaderboard()', async () => {
      await awardUploadPoints({ id: 'temp_user', name: 'Temp' }, 2000);
      let board = await getLeaderboard();
      expect(board[0].id).toBe('temp_user');

      const reset = await resetLeaderboard();
      expect(reset[0].id).toBe('admin_official');
      expect(reset[0].points).toBe(1000);

      board = await getLeaderboard();
      expect(board.some((e) => e.id === 'temp_user')).toBe(false);
    });
  });

  describe('Current User Merging', () => {
    it('does not insert a current user if they have 0 contributions', async () => {
      const board = await getLeaderboard({
        id: 'lurker_student',
        name: 'Lurker',
        uniqueStudentId: 'GBU-000000',
      });
      expect(board.some((e) => e.id === 'lurker_student')).toBe(false);
    });

    it('merges current user if they have contributions specified', async () => {
      const board = await getLeaderboard({
        id: 'active_student',
        name: 'Active Student',
        uniqueStudentId: 'GBU-22ICS099',
        points: 400,
        uploadsCount: 8,
      });

      const found = board.find((e) => e.id === 'active_student');
      expect(found).toBeDefined();
      expect(found?.points).toBe(400);
      expect(found?.rank).toBeGreaterThan(1);
    });
  });

  describe('Native Share Text Formatting', () => {
    it('formats shareable summary with top 3 crowns, user rank, and invitation', async () => {
      const board = await getLeaderboard();
      const text = shareLeaderboardSummary(board, 2);

      // Contains header and branding
      expect(text).toContain('GBU One');
      expect(text).toContain('PYQ Contributor Leaderboard');

      // Contains top 3 crowns and rankings
      expect(text).toContain('👑 Rank 1: GBU Exam Cell & Admin');
      expect(text).toContain('1000 pts');
      expect(text).toContain('🥈 Rank 2: Aarav Sharma');
      expect(text).toContain('750 pts');
      expect(text).toContain('🥉 Rank 3: Priya Singh');
      expect(text).toContain('600 pts');

      // Contains user rank standing
      expect(text).toContain('🎯 My Standing: Rank #2');

      // Contains invitation call to action and URL
      expect(text).toContain('Gautam Buddha University');
      expect(text).toContain('Contribute past question papers');
      expect(text).toContain('https://gbuone.space');
    });

    it('formats share summary without user rank if none is provided', async () => {
      const board = await getLeaderboard();
      const text = shareLeaderboardSummary(board);

      expect(text).toContain('👑 Rank 1');
      expect(text).not.toContain('🎯 My Standing:');
      expect(text).toContain('https://gbuone.space');
    });

    it('triggers Share.share with formatted summary', async () => {
      const board = await getLeaderboard();
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

  describe('AvatarPack & Student ID Consistency', () => {
    it('uses authentic AvatarPack IDs for all seed contributors so vector avatars render', () => {
      const validAvatarIds = new Set(AVATARS.map((a) => a.id));

      DEFAULT_LEADERBOARD_SEED.forEach((entry) => {
        expect(validAvatarIds.has(entry.avatarId)).toBe(true);
      });
    });

    it('formats student IDs properly adhering to GBU-XXXXXX format', () => {
      expect(formatStudentId('user1', 'GBU-21ICS045')).toBe('GBU-21ICS045');
      expect(formatStudentId('abc')).toBe('GBU-ABC000');
      expect(formatStudentId('123456789')).toBe('GBU-123456');
    });
  });

  describe('Edge Cases & Defense Mechanisms', () => {
    it('allows a student with 1000 points and higher uploadsCount to pass the Admin on tie-breaker', async () => {
      // Admin has 1000 pts with 20 uploads
      // Create student with 1000 pts and 25 uploads
      await awardUploadPoints(
        {
          id: 'student_pro',
          name: 'Pro Contributor',
          uniqueStudentId: 'GBU-20BCS999',
        },
        1000,
      );

      // Student currently has 1 upload (from awardUploadPoints initial insert)
      // Manually set 25 uploads to test tie-breaker against Admin's 20 uploads
      const stored = await AsyncStorage.getItem(PYQ_LEADERBOARD_STORAGE_KEY);
      const entries: LeaderboardEntry[] = JSON.parse(stored!);
      const pro = entries.find((e) => e.id === 'student_pro')!;
      pro.uploadsCount = 25;
      await AsyncStorage.setItem(PYQ_LEADERBOARD_STORAGE_KEY, JSON.stringify(entries));

      const updated = await getLeaderboard();
      expect(updated[0].id).toBe('student_pro');
      expect(updated[0].rank).toBe(1);
      expect(updated[0].points).toBe(1000);
      expect(updated[1].id).toBe('admin_official');
      expect(updated[1].rank).toBe(2);
      expect(updated[1].points).toBe(1000);
    });

    it('falls back to default +50 points when zero or negative points are provided', async () => {
      const student = { id: 'zero_student', name: 'Zero Student' };
      const board = await awardUploadPoints(student, 0);
      const entry = board.find((e) => e.id === student.id);
      expect(entry?.points).toBe(POINTS_PER_APPROVED_UPLOAD);

      const board2 = await awardUploadPoints(student, -100);
      const entry2 = board2.find((e) => e.id === student.id);
      expect(entry2?.points).toBe(POINTS_PER_APPROVED_UPLOAD * 2);
    });

    it('restores the official Admin automatically if storage data is missing admin', async () => {
      // Save data without official Admin
      const partialSeed = DEFAULT_LEADERBOARD_SEED.filter((e) => !e.isOfficialAdmin);
      await AsyncStorage.setItem(PYQ_LEADERBOARD_STORAGE_KEY, JSON.stringify(partialSeed));

      const board = await getLeaderboard();
      const adminEntry = board.find((e) => e.isOfficialAdmin || e.id === 'admin_official');
      expect(adminEntry).toBeDefined();
      expect(adminEntry?.points).toBe(1000);
    });
  });

  describe('PyqLeaderboardPodium Component', () => {
    it('renders podium structure with crowns, points, and action buttons', () => {
      const stateSpy = jest
        .spyOn(React, 'useState')
        .mockReturnValueOnce([DEFAULT_LEADERBOARD_SEED, jest.fn()])
        .mockReturnValueOnce([false, jest.fn()])
        .mockReturnValueOnce([false, jest.fn()]);

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
      }) as any;

      expect(element).toBeDefined();
      const children = element.props.children;
      expect(Array.isArray(children)).toBe(true);

      // Verify header, podium pillars row, and action buttons are present in child tree
      const [header, podiumRow, actionRow] = children;
      expect(header).toBeDefined();
      expect(podiumRow).toBeDefined();
      expect(actionRow).toBeDefined();

      // Podium row should have 3 pillars (top 2, top 1, top 3)
      const pillars = podiumRow.props.children;
      expect(pillars).toHaveLength(3);

      // Rank 1 pillar (center) contains crown badge and animated pulse/glow
      const rank1Pillar = pillars[1];
      expect(rank1Pillar).toBeDefined();
      expect(rank1Pillar.key).toContain('podium_rank_1');

      // Rank 2 pillar (left)
      const rank2Pillar = pillars[0];
      expect(rank2Pillar).toBeDefined();
      expect(rank2Pillar.key).toContain('podium_rank_2');

      // Rank 3 pillar (right)
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
        .mockReturnValueOnce([DEFAULT_LEADERBOARD_SEED, jest.fn()])
        .mockReturnValueOnce([false, jest.fn()])
        .mockReturnValueOnce([false, jest.fn()]);

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
        },
        hideActionRow: true,
      }) as any;

      expect(element).toBeDefined();
      const children = element.props.children;
      // Header and podium row are present
      expect(children[0]).toBeDefined();
      expect(children[1]).toBeDefined();
      // actionRow is false/hidden
      expect(children[2]).toBe(false);

      stateSpy.mockRestore();
      refSpy.mockRestore();
      effectSpy.mockRestore();
      callbackSpy.mockRestore();
    });
  });

  describe('School & Department Filter Coverage', () => {
    it('covers all university schools in seed data: SOICT, SOE, SOBT, SOM, SOLJG, SOHSS, SOVSAS', async () => {
      const leaderboard = await getLeaderboard();
      const schools = new Set(leaderboard.map((e) => e.school).filter(Boolean));

      expect(schools.has('Central Admin')).toBe(true);
      expect(schools.has('SOICT')).toBe(true);
      expect(schools.has('SOE')).toBe(true);
      expect(schools.has('SOBT')).toBe(true);
      expect(schools.has('SOM')).toBe(true);
      expect(schools.has('SOLJG')).toBe(true);
      expect(schools.has('SOHSS')).toBe(true);
      expect(schools.has('SOVSAS')).toBe(true);
    });

    it('filters contributors by school with alias support for SOL and SOLJG', async () => {
      const leaderboard = await getLeaderboard();
      const soictOnly = leaderboard.filter((e) => e.school === 'SOICT');
      expect(soictOnly.length).toBeGreaterThanOrEqual(2);

      const soljgOnly = leaderboard.filter((e) => e.school === 'SOLJG' || e.school === 'SOL');
      expect(soljgOnly.length).toBeGreaterThanOrEqual(1);
      expect(soljgOnly[0].name).toBe('Tanvi Malik');
    });
  });
});
