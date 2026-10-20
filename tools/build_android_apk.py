"""
Sync the source into the space-free build copy and produce a debug APK.

The native (CMake/ninja) part of the Android build breaks when the project
path contains a space, so the APK is always built from a copy at a path
without spaces. See docs/RELEASE.md.

    python tools/build_android_apk.py [--release]

Uses the keystore pointed at by the GBU_ANDROID_* environment variables when
--release is given.
"""
import os
import shutil
import subprocess
import sys

SOURCE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
BUILD = os.environ.get('GBU_BUILD_DIR', r'C:\gbuone-build')

# Everything except the generated/build artefacts.
SKIP_DIRS = {
    'node_modules', '.git', 'android', '.expo', 'dist', 'apk',
    os.path.join('docs', 'qa'), 'research', 'scripts', 'checklist_extracted',
}
SKIP_FILES = {'.DS_Store'}


def sync() -> None:
    print(f'syncing {SOURCE} -> {BUILD}')
    for name in os.listdir(SOURCE):
        if name in SKIP_DIRS or name in SKIP_FILES:
            continue
        src = os.path.join(SOURCE, name)
        dst = os.path.join(BUILD, name)
        if os.path.isdir(src):
            shutil.copytree(src, dst, dirs_exist_ok=True, ignore=shutil.ignore_patterns('*.apk', '*.zip'))
        else:
            shutil.copy2(src, dst)

    # .env carries the local configuration (git-ignored).
    env_file = os.path.join(SOURCE, '.env')
    if os.path.exists(env_file):
        shutil.copy2(env_file, os.path.join(BUILD, '.env'))


def find_apksigner():
    """Locates the apksigner tool from the Android SDK."""
    roots = [
        os.environ.get('ANDROID_HOME'),
        os.environ.get('ANDROID_SDK_ROOT'),
        os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Android', 'Sdk'),
    ]
    for root in roots:
        if not root:
            continue
        build_tools = os.path.join(root, 'build-tools')
        if not os.path.isdir(build_tools):
            continue
        versions = sorted(os.listdir(build_tools), reverse=True)
        for version in versions:
            for name in ('apksigner.bat', 'apksigner'):
                candidate = os.path.join(build_tools, version, name)
                if os.path.exists(candidate):
                    return candidate
    return None


def run(command: list[str], cwd: str) -> None:
    print('>', ' '.join(command))
    result = subprocess.run(command, cwd=cwd, shell=True)
    if result.returncode != 0:
        raise SystemExit(f'command failed: {" ".join(command)}')


def main() -> None:
    release = '--release' in sys.argv
    os.makedirs(BUILD, exist_ok=True)
    sync()

    # Always prebuild: the signing plugin writes the GBU_ANDROID_* values into
    # android/gradle.properties, so a prebuild that is skipped would leave the
    # release build on the debug key.
    android = os.path.join(BUILD, 'android')
    run(['npx', 'expo', 'prebuild', '--platform', 'android', '--no-install'], BUILD)

    task = 'assembleRelease' if release else 'assembleDebug'
    run([r'.\gradlew.bat', task, '--no-daemon'], android)

    apk_name = 'app-release.apk' if release else 'app-debug.apk'
    apk = os.path.join(android, 'app', 'build', 'outputs', 'apk',
                       'release' if release else 'debug', apk_name)
    if not os.path.exists(apk):
        raise SystemExit(f'APK not found: {apk}')
    print(f'\nAPK: {apk} ({os.path.getsize(apk) / 1_000_000:.1f} MB)')

    # A release APK signed with the debug key is not publishable, so make the
    # mistake loud instead of shipping it.
    if release:
        apksigner = find_apksigner()
        if apksigner:
            result = subprocess.run(
                [apksigner, 'verify', '--print-certs', apk],
                capture_output=True, text=True,
            )
            for line in result.stdout.splitlines():
                if 'certificate DN' in line:
                    print(line.strip())
                    if 'CN=Android Debug' in line:
                        raise SystemExit(
                            'the release APK is signed with the DEBUG key - set '
                            'GBU_ANDROID_KEYSTORE_PATH and the other GBU_ANDROID_* '
                            'variables (see docs/RELEASE.md)'
                        )


if __name__ == '__main__':
    main()
