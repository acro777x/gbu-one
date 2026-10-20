/**
 * Unit tests for the Android release-signing config plugin.
 * Per docs/RELEASE.md and docs/OPEN_QUESTIONS.md #13.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const plugin = require('../plugins/withReleaseSigning');

/** The Gradle file `expo prebuild` generates, as a fixture. */
const GENERATED_BUILD_GRADLE = `
android {
    compileSdkVersion 35
    namespace "in.gbu.one"
    defaultConfig {
        applicationId 'in.gbu.one'
        minSdkVersion 24
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"
    }
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
            shrinkResources (findProperty('android.enableShrinkResourcesInReleaseBuilds')?.toBoolean() ?: false)
            minifyEnabled enableProguardInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
            crunchPngs (findProperty('android.enablePngCrunchInReleaseBuilds')?.toBoolean() ?: true)
        }
    }
}
`;

const GENERATED_ROOT_BUILD_GRADLE = `
buildscript {
    ext {
        buildToolsVersion = "35.0.0"
        minSdkVersion = 24
        compileSdkVersion = 35
        targetSdkVersion = 34
        ndkVersion = "26.1.10909125"
    }
}
`;

/** Runs the plugin's Gradle patch over a fixture and returns the project root. */
function patch(fixture: string): Promise<string> {
  // The plugin keeps its patch helpers private, so the fixture is written to
  // a temporary android project and the plugin is run for real.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gbu-gradle-'));
  fs.mkdirSync(path.join(root, 'app'), { recursive: true });
  fs.writeFileSync(path.join(root, 'app', 'build.gradle'), fixture);
  fs.writeFileSync(path.join(root, 'build.gradle'), GENERATED_ROOT_BUILD_GRADLE);

  const config = {
    modRequest: { platformProjectRoot: root, projectRoot: root, platform: 'android' },
    modResults: '',
    mods: {},
  };

  // The dangerous mod is registered on the config; run it directly.
  const registered = plugin(config);
  const mod = registered.mods.android.dangerous;
  return mod({ ...registered, modRequest: { ...config.modRequest, projectRoot: root } })
    .then(() => root);
}

describe('Android release signing plugin', () => {
  it('adds a release signing config next to the debug one', async () => {
    const root = await patch(GENERATED_BUILD_GRADLE);
    const gradle = fs.readFileSync(path.join(root, 'app', 'build.gradle'), 'utf8');
    expect(gradle).toContain('release {');
    expect(gradle).toContain('GBU_KEYSTORE_FILE');
    expect(gradle).toContain('androiddebugkey');
  });

  it('makes the release build use the owner keystore when it exists', async () => {
    const root = await patch(GENERATED_BUILD_GRADLE);
    const gradle = fs.readFileSync(path.join(root, 'app', 'build.gradle'), 'utf8');
    expect(gradle).toContain('signingConfig signingConfigs.release');
    // The debug key stays as the fallback so a fresh clone still builds.
    expect(gradle).toContain('signingConfig signingConfigs.debug');
  });

  it('enables the 16 KB page sizes for the modules built here', async () => {
    const root = await patch(GENERATED_BUILD_GRADLE);
    const gradle = fs.readFileSync(path.join(root, 'app', 'build.gradle'), 'utf8');
    expect(gradle).toContain('ANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON');
  });

  it('pins the NDK to a version that links 16 KB aligned objects', async () => {
    const root = await patch(GENERATED_BUILD_GRADLE);
    const gradle = fs.readFileSync(path.join(root, 'build.gradle'), 'utf8');
    expect(gradle).toMatch(/ndkVersion = "27\./);
    expect(gradle).not.toContain('26.1.10909125');
  });

  it('keeps the generated debug signing config intact', async () => {
    const root = await patch(GENERATED_BUILD_GRADLE);
    const gradle = fs.readFileSync(path.join(root, 'app', 'build.gradle'), 'utf8');
    expect(gradle).toContain("storeFile file('debug.keystore')");
    expect(gradle).toContain("keyAlias 'androiddebugkey'");
  });
});
