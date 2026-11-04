import {
  compareSemver,
  checkForAppUpdate,
  publishAppVersion,
  clearAppVersionOverride,
  evaluateManifest,
  isUpdateDismissed,
  dismissUpdateForVersion,
  clearUpdateDismissal,
  subscribeToVersionUpdates,
  type AppVersionManifest,
} from '../src/features/updates/versionChecker';

describe('Version Checker & Compulsory Update Engine', () => {
  beforeEach(async () => {
    await clearAppVersionOverride();
    await clearUpdateDismissal();
  });

  afterEach(async () => {
    await clearAppVersionOverride();
    await clearUpdateDismissal();
  });

  describe('compareSemver', () => {
    it('correctly compares version equality', () => {
      expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
      expect(compareSemver('v1.0.0', '1.0.0')).toBe(0);
      expect(compareSemver('2.1.3', '2.1.3')).toBe(0);
    });

    it('identifies older versions', () => {
      expect(compareSemver('1.0.0', '1.0.1')).toBe(-1);
      expect(compareSemver('1.0.0', '1.1.0')).toBe(-1);
      expect(compareSemver('1.9.9', '2.0.0')).toBe(-1);
      expect(compareSemver('v1.0.0', 'v1.2.0')).toBe(-1);
    });

    it('identifies newer versions', () => {
      expect(compareSemver('1.0.1', '1.0.0')).toBe(1);
      expect(compareSemver('1.1.0', '1.0.0')).toBe(1);
      expect(compareSemver('2.0.0', '1.9.9')).toBe(1);
      expect(compareSemver('v1.2.0', '1.0.0')).toBe(1);
    });
  });

  describe('checkForAppUpdate', () => {
    it('returns no update needed when running latest fallback version', async () => {
      const res = await checkForAppUpdate();
      expect(res.currentVersion).toBe('1.0.0');
      expect(res.updateAvailable).toBe(false);
      expect(res.isMandatory).toBe(false);
    });

    it('detects optional update when latestVersion > currentVersion but minSupported <= currentVersion', async () => {
      const manifest: AppVersionManifest = {
        platform: 'android',
        latestVersion: '1.2.0',
        minSupportedVersion: '1.0.0',
        isMandatory: false,
        title: 'New Features Available',
        message: 'A new version with performance improvements is available.',
        releaseNotes: ['Improved calendar caching', 'New event photos'],
        apkUrl: 'https://github.com/acro777x/gbu-one/releases/tag/v1.2.0',
        releasedAt: new Date().toISOString(),
      };

      await publishAppVersion(manifest);
      const res = await checkForAppUpdate();

      expect(res.updateAvailable).toBe(true);
      expect(res.isMandatory).toBe(false);
      expect(res.manifest?.latestVersion).toBe('1.2.0');
    });

    it('detects mandatory update when minSupportedVersion > currentVersion', async () => {
      const manifest: AppVersionManifest = {
        platform: 'android',
        latestVersion: '1.2.0',
        minSupportedVersion: '1.2.0',
        isMandatory: true,
        title: 'Compulsory Security Update',
        message: 'Critical timetable and authentication updates require immediate update.',
        releaseNotes: ['Critical security hotfix'],
        apkUrl: 'https://github.com/acro777x/gbu-one/releases/tag/v1.2.0',
        releasedAt: new Date().toISOString(),
      };

      await publishAppVersion(manifest);
      const res = await checkForAppUpdate();

      expect(res.updateAvailable).toBe(true);
      expect(res.isMandatory).toBe(true);
      expect(res.manifest?.isMandatory).toBe(true);
    });

    it('detects mandatory update if flag is set even if minSupportedVersion is lower', async () => {
      const manifest: AppVersionManifest = {
        platform: 'android',
        latestVersion: '1.2.0',
        minSupportedVersion: '1.0.0',
        isMandatory: true,
        title: 'Important Update',
        message: 'Update is required.',
        releaseNotes: ['Important fix'],
        apkUrl: 'https://github.com/acro777x/gbu-one/releases/tag/v1.2.0',
        releasedAt: new Date().toISOString(),
      };

      await publishAppVersion(manifest);
      const res = await checkForAppUpdate();

      expect(res.updateAvailable).toBe(true);
      expect(res.isMandatory).toBe(true);
    });
  });

  describe('isUpdateDismissed & Compulsory Mode Enforcement', () => {
    it('NEVER dismisses or snoozes a mandatory update', async () => {
      await dismissUpdateForVersion('1.2.0');
      const isDismissed = await isUpdateDismissed('1.2.0', true);
      expect(isDismissed).toBe(false);
    });

    it('returns false when no dismissal has been recorded', async () => {
      const isDismissed = await isUpdateDismissed('1.2.0', false);
      expect(isDismissed).toBe(false);
    });

    it('returns true when optional update was snoozed for the same version', async () => {
      await dismissUpdateForVersion('1.2.0');
      const isDismissed = await isUpdateDismissed('1.2.0', false);
      expect(isDismissed).toBe(true);
    });

    it('invalidates previous dismissal when a newer version is published', async () => {
      await dismissUpdateForVersion('1.2.0');
      const isDismissed = await isUpdateDismissed('1.3.0', false);
      expect(isDismissed).toBe(false);
    });
  });

  describe('evaluateManifest', () => {
    it('flags mandatory when minSupportedVersion is higher than current', () => {
      const manifest: AppVersionManifest = {
        platform: 'android',
        latestVersion: '2.0.0',
        minSupportedVersion: '1.5.0',
        isMandatory: false,
        title: 'Title',
        message: 'Message',
        releaseNotes: [],
        apkUrl: 'url',
        releasedAt: '2026-01-01',
      };
      const result = evaluateManifest('1.0.0', manifest);
      expect(result.updateAvailable).toBe(true);
      expect(result.isMandatory).toBe(true);
    });

    it('flags optional when current version is between minSupported and latest', () => {
      const manifest: AppVersionManifest = {
        platform: 'android',
        latestVersion: '1.2.0',
        minSupportedVersion: '1.0.0',
        isMandatory: false,
        title: 'Title',
        message: 'Message',
        releaseNotes: [],
        apkUrl: 'url',
        releasedAt: '2026-01-01',
      };
      const result = evaluateManifest('1.0.0', manifest);
      expect(result.updateAvailable).toBe(true);
      expect(result.isMandatory).toBe(false);
    });
  });

  describe('subscribeToVersionUpdates', () => {
    it('returns a cleanup function that removes subscription safely', () => {
      const unsubscribe = subscribeToVersionUpdates(() => {});
      expect(typeof unsubscribe).toBe('function');
      expect(() => unsubscribe()).not.toThrow();
    });
  });
});
