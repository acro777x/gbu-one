import {
  compareSemver,
  checkForAppUpdate,
  publishAppVersion,
  clearAppVersionOverride,
  FALLBACK_VERSION_MANIFEST,
  type AppVersionManifest,
} from '../src/features/updates/versionChecker';

describe('Version Checker & Compulsory Update Engine', () => {
  beforeEach(async () => {
    await clearAppVersionOverride();
  });

  afterEach(async () => {
    await clearAppVersionOverride();
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
});
