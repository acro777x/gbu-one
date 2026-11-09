import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { User } from 'lucide-react-native';
import {
  AVATARS,
  getAvatarById,
  AvatarPicker,
  SCHOOL_TABS,
  TechScholarAvatar,
  CyberGuardianAvatar,
  AiResearcherAvatar,
  DataWizardAvatar,
  EngineerAvatar,
  CivilArchitectAvatar,
  SpeedRunnerAvatar,
  LabScientistAvatar,
  BioInnovatorAvatar,
  BusinessLeaderAvatar,
  CampusAmbassadorAvatar,
  FinAnalystAvatar,
  LegalEagleAvatar,
  JusticeAdvocateAvatar,
  CreativeArtistAvatar,
  CampusScribeAvatar,
  BookwormAvatar,
  QuantumPhysicistAvatar,
  GbuAdminAvatar,
} from '../src/components/avatar/AvatarPack';
import { Avatar } from '../src/components/ui/Avatar';
import {
  useAuthStore,
  generateUniqueStudentId,
  USER_PROFILE_STORAGE_KEY,
  UserProfile,
} from '../src/store/useAuthStore';

describe('Avatar System and Unique Student ID', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useAuthStore.getState().logout();
    jest.clearAllMocks();
  });

  describe('Unique Student ID Generation', () => {
    it('generates an ID matching /^GBU-[A-Z0-9]{6}$/', () => {
      const studentId = generateUniqueStudentId();
      expect(studentId).toMatch(/^GBU-[A-Z0-9]{6}$/);
      expect(studentId.startsWith('GBU-')).toBe(true);
      expect(studentId.length).toBe(10);
    });

    it('generates random, high-entropy student IDs across calls', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const id = generateUniqueStudentId();
        expect(id).toMatch(/^GBU-[A-Z0-9]{6}$/);
        ids.add(id);
      }
      expect(ids.size).toBe(50);
    });
  });

  describe('Vector Avatar Pack (AVATARS)', () => {
    const EXPECTED_AVATAR_IDS = [
      'tech-scholar',
      'cyber-guardian',
      'ai-researcher',
      'data-wizard',
      'engineer',
      'civil-architect',
      'speed-runner',
      'lab-scientist',
      'bio-innovator',
      'business-leader',
      'campus-ambassador',
      'fin-analyst',
      'legal-eagle',
      'justice-advocate',
      'creative-artist',
      'campus-scribe',
      'bookworm',
      'quantum-physicist',
      'gbu-admin',
    ] as const;

    it('contains exactly 19 distinct academic student avatars across all schools', () => {
      expect(AVATARS).toHaveLength(19);
      const ids = AVATARS.map((a) => a.id);
      expect(ids).toEqual(EXPECTED_AVATAR_IDS);
    });

    it('covers all official GBU schools and administration', () => {
      const schools = Array.from(new Set(AVATARS.map((a) => a.school))).sort();
      expect(schools).toEqual([
        'ADMIN',
        'SOBT',
        'SOE',
        'SOHSS',
        'SOICT',
        'SOLJG',
        'SOM',
        'SOVSAS',
      ]);
    });

    it('exports official SCHOOL_TABS filter list', () => {
      expect(SCHOOL_TABS).toEqual([
        'All',
        'SOICT',
        'SOE',
        'SOBT',
        'SOM',
        'SOLJG',
        'SOHSS',
        'SOVSAS',
        'ADMIN',
      ]);
    });

    it('has complete metadata and valid component for every avatar', () => {
      AVATARS.forEach((avatar) => {
        expect(avatar.id).toBeTruthy();
        expect(avatar.name).toBeTruthy();
        expect(avatar.school).toBeTruthy();
        expect(avatar.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(avatar.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(
          typeof avatar.component === 'function' ||
            typeof avatar.component === 'object'
        ).toBe(true);
      });
    });

    it('wraps all avatar components in React.memo for optimal render performance', () => {
      AVATARS.forEach((avatar) => {
        expect((avatar.component as any).$$typeof).toBe(Symbol.for('react.memo'));
      });
    });

    it('sets gbu-admin school to ADMIN', () => {
      const adminAvatar = AVATARS.find((a) => a.id === 'gbu-admin');
      expect(adminAvatar).toBeDefined();
      expect(adminAvatar?.school).toBe('ADMIN');
    });

    it('retrieves each avatar by its ID via getAvatarById', () => {
      EXPECTED_AVATAR_IDS.forEach((id) => {
        const item = getAvatarById(id);
        expect(item).toBeDefined();
        expect(item.id).toBe(id);
        expect(item.name).toBeTruthy();
      });
    });

    it('falls back to tech-scholar when an unknown or undefined ID is passed', () => {
      const fallbackUnknown = getAvatarById('non-existent-avatar');
      expect(fallbackUnknown.id).toBe('tech-scholar');

      const fallbackUndefined = getAvatarById(undefined);
      expect(fallbackUndefined.id).toBe('tech-scholar');

      const fallbackEmpty = getAvatarById('');
      expect(fallbackEmpty.id).toBe('tech-scholar');
    });

    it('exports all 19 individual vector components', () => {
      expect(TechScholarAvatar).toBeDefined();
      expect(CyberGuardianAvatar).toBeDefined();
      expect(AiResearcherAvatar).toBeDefined();
      expect(DataWizardAvatar).toBeDefined();
      expect(EngineerAvatar).toBeDefined();
      expect(CivilArchitectAvatar).toBeDefined();
      expect(SpeedRunnerAvatar).toBeDefined();
      expect(LabScientistAvatar).toBeDefined();
      expect(BioInnovatorAvatar).toBeDefined();
      expect(BusinessLeaderAvatar).toBeDefined();
      expect(CampusAmbassadorAvatar).toBeDefined();
      expect(FinAnalystAvatar).toBeDefined();
      expect(LegalEagleAvatar).toBeDefined();
      expect(JusticeAdvocateAvatar).toBeDefined();
      expect(CreativeArtistAvatar).toBeDefined();
      expect(CampusScribeAvatar).toBeDefined();
      expect(BookwormAvatar).toBeDefined();
      expect(QuantumPhysicistAvatar).toBeDefined();
      expect(GbuAdminAvatar).toBeDefined();
    });
  });

  describe('Avatar Component (src/components/ui/Avatar.tsx)', () => {
    it('renders vector avatar component when valid avatarId is provided', () => {
      const element = Avatar({ avatarId: 'cyber-guardian', size: 64 }) as any;
      expect(element).toBeDefined();
      expect(element.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ width: 64, height: 64 }),
        ])
      );
      // Children should contain the vector component
      const child = element.props.children;
      expect(child).toBeDefined();
      expect(child.type).toBe(CyberGuardianAvatar);
      expect(child.props.size).toBe(64);
    });

    it('prioritizes url (Image) over avatarId when both are provided', () => {
      const element = Avatar({
        url: 'https://example.com/student.jpg',
        avatarId: 'tech-scholar',
        size: 50,
      }) as any;
      expect(element.props.children.type).toBe('Image');
      expect(element.props.children.props.source).toEqual({
        uri: 'https://example.com/student.jpg',
      });
    });

    it('falls back to initials when avatarId is invalid or undefined and name is given', () => {
      const element = Avatar({
        avatarId: 'invalid-persona',
        name: 'Aarav Sharma',
        size: 40,
      }) as any;
      expect(element.props.children.type).toBe('Text');
      expect(element.props.children.props.children).toBe('AS');
    });

    it('falls back to guest user icon when isGuest is true and no avatarId/url', () => {
      const element = Avatar({
        isGuest: true,
        size: 40,
      }) as any;
      expect(element.props.children).toBeDefined();
      expect(element.props.children.type).toBe(User);
    });
  });

  describe('AvatarPicker Component', () => {
    it('renders filter tabs and all 19 avatars by default', () => {
      const onSelect = jest.fn();
      const element = AvatarPicker({
        selectedId: 'tech-scholar',
        onSelect,
        size: 48,
        scrollable: false,
      }) as any;

      expect(element.props.style).toBeDefined();
      const [tabBar, grid] = element.props.children;
      expect(tabBar).toBeDefined();
      expect(grid.props.children).toHaveLength(19);
    });

    it('supports disabling filter tabs via showTabs={false}', () => {
      const onSelect = jest.fn();
      const element = AvatarPicker({
        selectedId: 'tech-scholar',
        onSelect,
        size: 48,
        scrollable: false,
        showTabs: false,
      }) as any;

      const [tabBar, grid] = element.props.children;
      expect(tabBar).toBeNull();
      expect(grid.props.children).toHaveLength(19);
    });

    it('supports horizontal carousel mode', () => {
      const onSelect = jest.fn();
      const element = AvatarPicker({
        selectedId: 'tech-scholar',
        onSelect,
        size: 48,
        horizontal: true,
      }) as any;

      const [tabBar, carousel] = element.props.children;
      expect(carousel.type).toBe('ScrollView');
      expect(carousel.props.horizontal).toBe(true);
      expect(carousel.props.children).toHaveLength(19);
    });

    it('filters avatars by school when defaultSchool is set', () => {
      const onSelect = jest.fn();
      const element = AvatarPicker({
        selectedId: 'tech-scholar',
        onSelect,
        size: 48,
        scrollable: false,
        defaultSchool: 'SOICT',
      }) as any;

      const [tabBar, grid] = element.props.children;
      expect(grid.props.children).toHaveLength(4);
      expect(grid.props.children.map((c: any) => c.key)).toEqual([
        'tech-scholar',
        'cyber-guardian',
        'ai-researcher',
        'data-wizard',
      ]);
    });

    it('triggers haptics and onSelect callback when an avatar card is pressed', () => {
      const onSelect = jest.fn();
      const element = AvatarPicker({
        selectedId: 'tech-scholar',
        onSelect,
        size: 48,
        scrollable: false,
      }) as any;

      const [tabBar, grid] = element.props.children;
      const secondCard = grid.props.children[1]; // cyber-guardian
      expect(secondCard.key).toBe('cyber-guardian');

      secondCard.props.onPress();
      expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
      expect(onSelect).toHaveBeenCalledWith('cyber-guardian');
    });
  });

  describe('Profile Store & updateProfile persistence', () => {

    it('updates user profile in Zustand store and persists to AsyncStorage', async () => {
      const generatedId = generateUniqueStudentId();
      await useAuthStore.getState().updateProfile({
        name: 'Aarav Sharma',
        avatarId: 'cyber-guardian',
        uniqueStudentId: generatedId,
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeDefined();
      expect(state.user?.name).toBe('Aarav Sharma');
      expect(state.user?.avatarId).toBe('cyber-guardian');
      expect(state.user?.uniqueStudentId).toBe(generatedId);

      const storedJson = await AsyncStorage.getItem(USER_PROFILE_STORAGE_KEY);
      expect(storedJson).toBeTruthy();
      const parsed: UserProfile = JSON.parse(storedJson!);
      expect(parsed.name).toBe('Aarav Sharma');
      expect(parsed.avatarId).toBe('cyber-guardian');
      expect(parsed.uniqueStudentId).toBe(generatedId);
    });

    it('merges partial updates without overwriting existing fields', async () => {
      await useAuthStore.getState().updateProfile({
        name: 'Priya Verma',
        avatarId: 'lab-scientist',
      });

      const initialId = useAuthStore.getState().user?.uniqueStudentId;
      expect(initialId).toMatch(/^GBU-[A-Z0-9]{6}$/);

      // Partial update only the avatar
      await useAuthStore.getState().updateProfile({
        avatarId: 'ai-researcher',
      });

      const updatedState = useAuthStore.getState();
      expect(updatedState.user?.name).toBe('Priya Verma');
      expect(updatedState.user?.avatarId).toBe('ai-researcher');
      expect(updatedState.user?.uniqueStudentId).toBe(initialId);

      const storedJson = await AsyncStorage.getItem(USER_PROFILE_STORAGE_KEY);
      const parsed: UserProfile = JSON.parse(storedJson!);
      expect(parsed.name).toBe('Priya Verma');
      expect(parsed.avatarId).toBe('ai-researcher');
      expect(parsed.uniqueStudentId).toBe(initialId);
    });

    it('initAuth initializes uniqueStudentId if missing on stored profile', async () => {
      // Simulate existing stored profile without uniqueStudentId or avatarId
      const legacyProfile: Partial<UserProfile> = {
        id: 'usr_legacy_101',
        rollNo: '22/BCS/089',
        name: 'Rohan Gupta',
        email: 'rohan@gbu.ac.in',
        isOfflineSession: true,
      };
      await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(legacyProfile));

      // Re-hydrate
      await useAuthStore.getState().initAuth();

      const state = useAuthStore.getState();
      expect(state.user).toBeDefined();
      expect(state.user?.rollNo).toBe('22/BCS/089');
      expect(state.user?.uniqueStudentId).toBeDefined();
      expect(state.user?.uniqueStudentId).toMatch(/^GBU-[A-Z0-9]{6}$/);

      // Verify it was persisted back to storage
      const persistedJson = await AsyncStorage.getItem(USER_PROFILE_STORAGE_KEY);
      const persisted: UserProfile = JSON.parse(persistedJson!);
      expect(persisted.uniqueStudentId).toBe(state.user?.uniqueStudentId);
    });

    it('initAuth initializes uniqueStudentId on legacy stored guest profile', async () => {
      const legacyGuest: Partial<UserProfile> = {
        id: 'usr_guest_legacy',
        rollNo: 'GUEST',
        name: 'Guest Student',
        email: 'guest@gbu.ac.in',
        isOfflineSession: true,
      };
      await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(legacyGuest));

      await useAuthStore.getState().initAuth();

      const state = useAuthStore.getState();
      expect(state.user).toBeDefined();
      expect(state.user?.rollNo).toBe('GUEST');
      expect(state.isGuest).toBe(true);
      expect(state.user?.uniqueStudentId).toMatch(/^GBU-[A-Z0-9]{6}$/);

      const persistedJson = await AsyncStorage.getItem(USER_PROFILE_STORAGE_KEY);
      const persisted: UserProfile = JSON.parse(persistedJson!);
      expect(persisted.uniqueStudentId).toBe(state.user?.uniqueStudentId);
    });

    it('initAuth preserves existing uniqueStudentId without re-generating', async () => {
      const fixedId = 'GBU-FIXED1';
      const existingProfile: UserProfile = {
        id: 'usr_existing',
        rollNo: '22/BCS/090',
        name: 'Simran Kaur',
        email: 'simran@gbu.ac.in',
        uniqueStudentId: fixedId,
        avatarId: 'legal-eagle',
        isOfflineSession: true,
      };
      await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(existingProfile));

      await useAuthStore.getState().initAuth();

      const state = useAuthStore.getState();
      expect(state.user?.uniqueStudentId).toBe(fixedId);
      expect(state.user?.avatarId).toBe('legal-eagle');
    });
  });
});
