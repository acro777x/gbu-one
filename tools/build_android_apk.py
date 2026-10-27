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
import time
import hashlib
import re

SOURCE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
BUILD = os.environ.get('GBU_BUILD_DIR', r'C:\gbuone-build')

# Everything except the generated/build artefacts.
SKIP_DIRS = {
    'node_modules', '.git', 'android', '.expo', 'dist', 'apk',
    os.path.join('docs', 'qa'), 'research', 'scripts', 'checklist_extracted',
}
SKIP_FILES = {'.DS_Store'}


def sync(is_admin: bool = False) -> None:
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
        if is_admin:
            shutil.copy2(env_file, os.path.join(BUILD, '.env'))
        else:
            # SANITIZE: For student public APK, strip all admin passwords and master keys
            with open(env_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            clean_lines = [
                line for line in lines
                if not any(k in line for k in ['ADMIN_PASSWORD', 'ADMIN_PIN', 'GBU_ADMIN', 'EXPO_PUBLIC_ADMIN', 'SUPABASE_SERVICE_ROLE_KEY'])
            ]
            clean_lines.append('\nEXPO_PUBLIC_APP_VARIANT=public\n')
            with open(os.path.join(BUILD, '.env'), 'w', encoding='utf-8') as f:
                f.writelines(clean_lines)
            print('Sanitized .env for student public APK build.')

    if not is_admin:
        # STRICT PUBLIC APK PURGE: Exclude all admin routes, moderation tools, and credentials
        admin_dir = os.path.join(BUILD, 'app', 'admin')
        if os.path.exists(admin_dir):
            shutil.rmtree(admin_dir, ignore_errors=True)
            print('Purged app/admin from student public APK build.')

        moderation_file = os.path.join(BUILD, 'app', 'moderation.tsx')
        if os.path.exists(moderation_file):
            os.remove(moderation_file)
            print('Purged app/moderation.tsx from student public APK build.')

        layout_file = os.path.join(BUILD, 'app', '_layout.tsx')
        if os.path.exists(layout_file):
            with open(layout_file, 'r', encoding='utf-8') as f:
                content = f.read()
            content = re.sub(r'\{isAdminApp\(\)\s*\?[\s\S]*?: null\}', '', content)
            with open(layout_file, 'w', encoding='utf-8') as f:
                f.write(content)
            print('Cleaned admin stack screens from app/_layout.tsx.')

        variant_file = os.path.join(BUILD, 'src', 'lib', 'appVariant.ts')
        if os.path.exists(variant_file):
            with open(variant_file, 'w', encoding='utf-8') as f:
                f.write("export function isAdminApp(): boolean { return false; }\n")
            print('Configured appVariant to strictly false for student public APK.')

        app_json = os.path.join(BUILD, 'app.json')
        if os.path.exists(app_json):
            with open(app_json, 'r', encoding='utf-8') as f:
                c = f.read()
            c = c.replace('"package": "in.gbu.one.admin"', '"package": "in.gbu.one"')
            c = c.replace('"name": "GBU One Admin"', '"name": "GBU One"')
            with open(app_json, 'w', encoding='utf-8') as f:
                f.write(c)
            print('Configured app.json for in.gbu.one student package.')
    else:
        # Configure as dedicated Admin APK
        variant_file = os.path.join(BUILD, 'src', 'lib', 'appVariant.ts')
        if os.path.exists(variant_file):
            with open(variant_file, 'w', encoding='utf-8') as f:
                f.write("export function isAdminApp(): boolean { return true; }\n")
            print('Configured appVariant to true for dedicated Admin APK.')

        app_json = os.path.join(BUILD, 'app.json')
        if os.path.exists(app_json):
            with open(app_json, 'r', encoding='utf-8') as f:
                c = f.read()
            c = c.replace('"package": "in.gbu.one"', '"package": "in.gbu.one.admin"')
            c = c.replace('"name": "GBU One"', '"name": "GBU One Admin"')
            with open(app_json, 'w', encoding='utf-8') as f:
                f.write(c)
            print('Configured app.json for in.gbu.one.admin package.')


def dependency_fingerprint() -> str:
    """A cheap fingerprint of the dependency files, so a changed lockfile is
    noticed without hashing the whole tree."""
    parts = []
    for name in ('package.json', 'package-lock.json'):
        path = os.path.join(SOURCE, name)
        if os.path.exists(path):
            with open(path, 'rb') as handle:
                parts.append(handle.read())
    return hashlib.sha256(b''.join(parts)).hexdigest()


def install_dependencies() -> None:
    """Keeps the build copy's node_modules in step with package.json.

    The copy skips node_modules, so a new dependency (a native module, for
    example) would otherwise be missing from the Gradle build.
    """
    marker = os.path.join(BUILD, '.gbu-deps-fingerprint')
    current = dependency_fingerprint()
    previous = ''
    if os.path.exists(marker):
        with open(marker, encoding='utf-8') as handle:
            previous = handle.read().strip()

    if previous == current and os.path.isdir(os.path.join(BUILD, 'node_modules')):
        print('dependencies unchanged, skipping the install')
        return

    print('installing dependencies in the build copy')
    run(['npm', 'install', '--no-audit', '--no-fund'], BUILD)
    with open(marker, 'w', encoding='utf-8') as handle:
        handle.write(current)


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


def run(command: list[str], cwd: str, retries: int = 1) -> None:
    """Runs a command, retrying once: the first Gradle run after a source
    change can fail while it reconfigures the native build."""
    print('>', ' '.join(command))
    for attempt in range(retries + 1):
        result = subprocess.run(command, cwd=cwd, shell=True)
        if result.returncode == 0:
            return
        if attempt < retries:
            print(f'  (retrying, exit {result.returncode})')
            time.sleep(5)
    raise SystemExit(f'command failed: {" ".join(command)}')


def main() -> None:
    release = '--release' in sys.argv
    is_admin = '--admin' in sys.argv
    os.makedirs(BUILD, exist_ok=True)
    sync(is_admin=is_admin)
    install_dependencies()

    # Always prebuild: the signing plugin writes the GBU_ANDROID_* values into
    # android/gradle.properties, so a prebuild that is skipped would leave the
    # release build on the debug key.
    android = os.path.join(BUILD, 'android')
    # The notification sounds are copied into res/raw by the config plugin.
    # A sound that is no longer listed would still be there from the last
    # build, and two files with the same name are a duplicate-resource error.
    raw = os.path.join(android, 'app', 'src', 'main', 'res', 'raw')
    if os.path.isdir(raw):
        for name in os.listdir(raw):
            os.remove(os.path.join(raw, name))
    run(['npx', 'expo', 'prebuild', '--platform', 'android', '--no-install'], BUILD)

    # Ensure build.gradle namespace and applicationId match is_admin
    build_gradle_path = os.path.join(android, 'app', 'build.gradle')
    if os.path.exists(build_gradle_path):
        with open(build_gradle_path, 'r', encoding='utf-8') as f:
            gradle_content = f.read()
        target_pkg = 'in.gbu.one.admin' if is_admin else 'in.gbu.one'
        gradle_content = re.sub(r"namespace\s+['\"][^'\"]+['\"]", f"namespace '{target_pkg}'", gradle_content)
        gradle_content = re.sub(r"applicationId\s+['\"][^'\"]+['\"]", f"applicationId '{target_pkg}'", gradle_content)
        with open(build_gradle_path, 'w', encoding='utf-8') as f:
            f.write(gradle_content)
        print(f"Configured build.gradle namespace and applicationId to '{target_pkg}'.")

    # Fix Kotlin package declarations according to is_admin
    java_base = os.path.join(android, 'app', 'src', 'main', 'java', 'in', 'gbu', 'one')
    if is_admin:
        admin_java_dir = os.path.join(java_base, 'admin')
        if os.path.isdir(admin_java_dir):
            for fname in ('MainActivity.kt', 'MainApplication.kt'):
                fpath = os.path.join(admin_java_dir, fname)
                if os.path.exists(fpath):
                    with open(fpath, 'r', encoding='utf-8') as f:
                        code = f.read()
                    code = code.replace('package `in`.gbu.one\n', 'package `in`.gbu.one.admin\n')
                    code = code.replace('package `in`.gbu.one\r\n', 'package `in`.gbu.one.admin\r\n')
                    code = code.replace('package in.gbu.one\n', 'package in.gbu.one.admin\n')
                    code = code.replace('package in.gbu.one\r\n', 'package in.gbu.one.admin\r\n')
                    with open(fpath, 'w', encoding='utf-8') as f:
                        f.write(code)
            # Remove public copies if admin copies exist to avoid duplicate symbols
            for fname in ('MainActivity.kt', 'MainApplication.kt'):
                pub_fpath = os.path.join(java_base, fname)
                if os.path.exists(pub_fpath):
                    os.remove(pub_fpath)
            print('Fixed package declarations in admin Kotlin files.')
    else:
        # Revert admin folder and ensure public Kotlin files have package in.gbu.one
        admin_java_dir = os.path.join(java_base, 'admin')
        if os.path.isdir(admin_java_dir):
            shutil.rmtree(admin_java_dir, ignore_errors=True)
            print('Removed stale admin Java directory for public build.')
        for fname in ('MainActivity.kt', 'MainApplication.kt'):
            fpath = os.path.join(java_base, fname)
            if os.path.exists(fpath):
                with open(fpath, 'r', encoding='utf-8') as f:
                    code = f.read()
                code = code.replace('package `in`.gbu.one.admin', 'package `in`.gbu.one')
                code = code.replace('package in.gbu.one.admin', 'package in.gbu.one')
                with open(fpath, 'w', encoding='utf-8') as f:
                    f.write(code)
        print('Fixed package declarations in student public Kotlin files.')

    task = 'assembleRelease' if release else 'assembleDebug'
    run([r'.\gradlew.bat', task, '--no-daemon'], android)

    apk_name = 'app-release.apk' if release else 'app-debug.apk'
    apk = os.path.join(android, 'app', 'build', 'outputs', 'apk',
                       'release' if release else 'debug', apk_name)
    if not os.path.exists(apk):
        raise SystemExit(f'APK not found: {apk}')
    print(f'\nAPK: {apk} ({os.path.getsize(apk) / 1_000_000:.1f} MB)')

    out_apk_dir = os.path.join(SOURCE, 'apk')
    os.makedirs(out_apk_dir, exist_ok=True)
    dst_apk_name = 'gbu-one-admin.apk' if is_admin else 'gbu-one.apk'
    dst_apk = os.path.join(out_apk_dir, dst_apk_name)
    shutil.copy2(apk, dst_apk)
    print(f'Updated {dst_apk}')

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
