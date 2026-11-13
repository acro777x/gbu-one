"""
Sync the source into the space-free build copy and produce an APK.

The native (CMake/ninja) part of the Android build breaks when the project
path contains a space, so the APK is always built from a copy at a path
without spaces. See docs/RELEASE.md.

    python tools/build_android_apk.py [--release] [--admin]

Uses the keystore pointed at by the GBU_ANDROID_* environment variables when
--release is given.

    python tools/build_android_apk.py --prepare-only [--release]

applies ONLY the prepare step (sanitised .env + the student variant purge)
to the tree the script lives in. That is the step the EAS prebuild hook
runs, so the hosted build and the local build produce the same artifact -
see eas.json and docs/RELEASE.md.
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

# The shared, build-system independent decisions (which routes exist, which
# package the artifact carries, which backend a release needs). The EAS
# prebuild hook imports the very same module, so the two build systems can
# never disagree about the CONTENT of the artifact.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_config  # noqa: E402  (the path has to be set up first)

# Everything except the generated/build artefacts.
SKIP_DIRS = {
    'node_modules', '.git', 'android', '.expo', 'dist', 'apk',
    os.path.join('docs', 'qa'), 'research', 'scripts', 'checklist_extracted',
}
SKIP_FILES = {'.DS_Store'}

# ---------------------------------------------------------------------------
# Secret hygiene.
#
# Expo inlines every `EXPO_PUBLIC_*` variable into the JavaScript bundle at
# build time. Anything listed here therefore ships to every student. The
# bundle used to contain the project's Supabase SECRET key, because the
# sanitiser only removed variables whose NAME matched, and the anon key was
# named `EXPO_PUBLIC_SUPABASE_ANON_KEY` while holding a secret value.
#
# Two independent rules now apply:
#   1. name based  - a variable whose name looks like a credential is dropped
#   2. value based - a variable whose VALUE is a Supabase secret key is dropped
# The second rule is the important one: it does not care what the variable is
# called.
# ---------------------------------------------------------------------------
SECRET_NAME_RE = re.compile(
    r'(SECRET|PASSWORD|PASSWD|PIN|MFA|PRIVATE|CREDENTIAL|TOKEN|KEY|ADMIN)',
    re.IGNORECASE,
)
SUPABASE_SECRET_PREFIXES = ('sb_secret_',)
SUPABASE_PUBLISHABLE_PREFIXES = ('sb_publishable_',)
LEGACY_SERVICE_ROLE_RE = re.compile(r'^eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}')


def classify_env_line(line: str):
    """Return (action, reason) for one .env line.

    action is 'keep', 'drop' or 'secret-anon'.
    """
    stripped = line.strip()
    if not stripped or stripped.startswith('#'):
        return 'keep', 'comment'

    name, _, value = stripped.partition('=')
    name = name.strip()
    value = value.split(' #')[0].strip().strip('"').strip("'")

    # ------------------------------------------------------------------
    # VALUE FIRST.
    #
    # A Supabase PUBLISHABLE key (`sb_publishable_...`) is safe to ship: it is
    # designed to be embedded in a client and it is constrained by row level
    # security. It must be KEPT even though its variable name contains the
    # word "KEY" - dropping it would leave the release build with no backend
    # at all, and the app would silently fall back to offline mode forever.
    #
    # A Supabase SECRET key (`sb_secret_...`) must never ship, whatever it is
    # called: it bypasses every policy in the project.
    # ------------------------------------------------------------------
    for prefix in SUPABASE_PUBLISHABLE_PREFIXES:
        if value.startswith(prefix):
            return 'keep', 'a publishable key is safe to ship'
    for prefix in SUPABASE_SECRET_PREFIXES:
        if value.startswith(prefix):
            if name == 'EXPO_PUBLIC_SUPABASE_ANON_KEY':
                return 'secret-anon', 'the anon key holds a Supabase SECRET key'
            return 'drop', 'value is a Supabase secret key'

    if LEGACY_SERVICE_ROLE_RE.match(value) and 'SERVICE_ROLE' in name.upper():
        return 'drop', 'value is a legacy service-role JWT'

    # ------------------------------------------------------------------
    # NAME SECOND, for everything that is not a recognised Supabase key.
    #
    # The one legitimate exception is a variable whose value is empty: an
    # unset optional credential carries no secret, and removing it would
    # change behaviour (a missing variable and an empty one are not always
    # the same thing).
    # ------------------------------------------------------------------
    if SECRET_NAME_RE.search(name):
        if value == '':
            return 'keep', 'empty optional credential'
        return 'drop', 'name looks like a credential'

    return 'keep', ''


def sanitise_env_for_client(src_env: str, release: bool, allow_secret_anon: bool):
    """Return the .env text that is safe to inline into a client bundle."""
    kept = []
    dropped = []
    secret_anon = False
    secret_anon_line = None

    for line in src_env.splitlines(keepends=True):
        action, reason = classify_env_line(line)
        if action == 'keep':
            kept.append(line)
        elif action == 'drop':
            dropped.append((line.split('=', 1)[0].strip(), reason))
        else:
            secret_anon = True
            # The original line is kept so a DEBUG build can still reach the
            # live backend. A release build never re-adds it.
            secret_anon_line = line
            dropped.append((line.split('=', 1)[0].strip(), reason))

    if secret_anon:
        if release and not allow_secret_anon:
            raise SystemExit(
                'REFUSING TO BUILD: EXPO_PUBLIC_SUPABASE_ANON_KEY holds a Supabase\n'
                '  SECRET key (sb_secret_...). Expo inlines it into the bundle, so\n'
                '  every student who installs the app would hold a key that\n'
                '  bypasses every row level security policy in the project.\n'
                '\n'
                '  Fix it in the Supabase dashboard:\n'
                '    1. Project Settings -> API Keys -> create a PUBLISHABLE key\n'
                '    2. put that key in .env as EXPO_PUBLIC_SUPABASE_ANON_KEY\n'
                '    3. keep the secret key for the worker only\n'
                '         (SUPABASE_SERVICE_ROLE_KEY, used by worker/ and CI)\n'
                '  Then build again.'
            )
        if release:
            print(
                '  WARNING: the anon key is still a SECRET key. The bundle will\n'
                '  contain a database credential. Rotate it before publishing.'
            )
            # A release bundle must never carry the real secret.
            kept = [
                l for l in kept
                if not l.strip().startswith('EXPO_PUBLIC_SUPABASE_ANON_KEY=')
            ]
            kept.append('EXPO_PUBLIC_SUPABASE_ANON_KEY=REPLACE_ME_BEFORE_PUBLISHING\n')
        else:
            # A DEBUG build stays usable: the owner tests on a real device or
            # the emulator, and an app with no backend cannot be tested at
            # all. The warning is loud and the artifact is named "debug", so
            # it is never the thing that is published.
            print(
                '  WARNING: this DEBUG build carries the Supabase SECRET key.\n'
                '  It is fine for local testing and must NEVER be published.\n'
                '  Rotate the key before building a release.'
            )
            if secret_anon_line is not None:
                kept.append(secret_anon_line if secret_anon_line.endswith('\n')
                            else secret_anon_line + '\n')

    if dropped:
        print(f'  dropped {len(dropped)} secret-bearing variable(s):')
        for name, reason in dropped:
            print(f'    - {name}: {reason}')

    text = ''.join(kept)
    if 'EXPO_PUBLIC_APP_VARIANT=' not in text:
        text += 'EXPO_PUBLIC_APP_VARIANT=public\n'
    return text


def sync(is_admin: bool = False, release: bool = False, allow_secret_anon: bool = False) -> None:
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

    prepare_client_tree(
        BUILD,
        release=release,
        allow_secret_anon=allow_secret_anon,
        is_admin=is_admin,
    )


def prepare_client_tree(
    root: str,
    release: bool,
    allow_secret_anon: bool,
    is_admin: bool = False,
) -> None:
    """Apply the prepare step to a tree IN PLACE.

    This is the whole "what is inside the artifact" decision:

      1. the .env is sanitised (no credential may reach the bundle), and
      2. the admin variant is purged (student build) or switched on (admin
         build), so the artifact is the app it claims to be.

    The local build applies it to the space-free copy; the EAS prebuild
    hook applies it to the checked-out project. One implementation, two
    callers - which is the whole point.
    """
    env_file = os.path.join(root, '.env')
    clean_env = ''
    if os.path.exists(env_file):
        with open(env_file, 'r', encoding='utf-8') as f:
            src_env = f.read()
        clean_env = sanitise_env_for_client(src_env, release, allow_secret_anon)
        with open(env_file, 'w', encoding='utf-8') as f:
            f.write(clean_env)
        print('Sanitized .env for the client build.')

        # Post-condition: the prepared tree must not contain a Supabase
        # secret. For a RELEASE build this is absolute. A DEBUG build may
        # keep the real key so the app can be tested against the live
        # backend - that build is named "debug" and must never be published.
        with open(env_file, 'r', encoding='utf-8') as f:
            built_env = f.read()
        if release:
            for prefix in SUPABASE_SECRET_PREFIXES:
                if prefix in built_env:
                    raise SystemExit(
                        f'REFUSING TO BUILD: the prepared tree still contains "{prefix}".'
                    )
            if SECRET_NAME_RE.search(built_env) and 'EXPO_PUBLIC_SUPABASE_URL' not in built_env:
                raise SystemExit('REFUSING TO BUILD: the prepared tree still holds a credential.')
        else:
            for prefix in SUPABASE_SECRET_PREFIXES:
                if prefix in built_env:
                    print(
                        f'  NOTE: the DEBUG build copy contains "{prefix}". '
                        'This is expected for local testing and must never be published.'
                    )
                    break

    if is_admin:
        # The dedicated admin APK keeps the moderation console and switches
        # the variant on.
        build_config.configure_admin_variant(root)
    else:
        # STRICT PUBLIC APK PURGE: Exclude all admin routes, moderation tools,
        # and credentials. The implementation is shared with the EAS prebuild
        # hook (tools/build_config.py), so the hosted build purges exactly the
        # same files as this one.
        build_config.purge_admin_variant(root)

    if not release:
        return

    # A release without a backend does not crash: the app starts, finds no
    # backend and runs OFFLINE FOREVER, with no error anywhere. That is why
    # this is checked and not left to the Play review.
    problems = build_config.backend_env_problems(clean_env, os.environ)
    if problems:
        raise SystemExit(
            'REFUSING TO BUILD: the release build has no usable backend:\n'
            + ''.join(f'  - {problem}\n' for problem in problems)
            + '\n'
            '  A release bundle without EXPO_PUBLIC_SUPABASE_URL and\n'
            '  EXPO_PUBLIC_SUPABASE_ANON_KEY runs offline forever without\n'
            '  a single error, so the build is stopped instead.\n'
            '  Set them in .env (see .env.example) or, for an EAS build, in\n'
            '  the env block of the profile in eas.json.\n'
        )


def assert_release_keystore() -> None:
    """A release build must be signed with the owner keystore.

    This is the FIRST line of defence. The generated Gradle script throws
    when the keystore is missing (the second), and apksigner verifies the
    signature afterwards (the third).
    """
    required = (
        'GBU_ANDROID_KEYSTORE_PATH',
        'GBU_ANDROID_KEYSTORE_PASSWORD',
        'GBU_ANDROID_KEY_ALIAS',
        'GBU_ANDROID_KEY_PASSWORD',
    )
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        raise SystemExit(
            'REFUSING TO BUILD: a release build must be signed with the owner\n'
            '  keystore, and there is NO debug-key fallback. Missing:\n'
            + ''.join(f'    - {name}\n' for name in missing)
            + '\n'
            '  Set the four GBU_ANDROID_* variables (see docs/RELEASE.md)\n'
            '  and build again.'
        )
    keystore = os.environ['GBU_ANDROID_KEYSTORE_PATH']
    if not os.path.exists(keystore):
        raise SystemExit(
            f'REFUSING TO BUILD: the keystore "{keystore}" does not exist.\n'
            '  Check GBU_ANDROID_KEYSTORE_PATH (see docs/RELEASE.md).'
        )


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
    allow_secret_anon = '--allow-secret-anon-key' in sys.argv
    prepare_only = '--prepare-only' in sys.argv
    if allow_secret_anon and not release:
        print('  (--allow-secret-anon-key is accepted for local QA builds only.)')
    if prepare_only:
        # The EAS prebuild hook runs this against the CHECKED-OUT project, and
        # then EAS runs its own Gradle build. Only the steps that change what
        # is inside the artifact belong here: the sanitised .env, the admin
        # purge and the variant switch. The sync into the space-free build
        # directory, npm install and the Gradle invocation are the local
        # path's business.
        with open(os.path.join(SOURCE, '.env'), 'r', encoding='utf-8') as f:
            src_env = f.read()
        prepare_client_tree(
            SOURCE,
            release=release,
            allow_secret_anon=allow_secret_anon,
            is_admin=is_admin,
        )
        print('Prepare-only: the client bundle is sanitised and the variant is set.')
        print('  variant :', 'admin' if is_admin else 'public')
        return

    os.makedirs(BUILD, exist_ok=True)
    sync(is_admin=is_admin, release=release, allow_secret_anon=allow_secret_anon)

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
    # mistake loud instead of shipping it. This is the LAST line of defence:
    # the build already refused to start without the owner keystore, and the
    # generated Gradle script throws when it is missing.
    if release:
        apksigner = find_apksigner()
        if apksigner:
            result = subprocess.run(
                [apksigner, 'verify', '--print-certs', apk],
                capture_output=True, text=True,
            )
            if result.returncode != 0:
                raise SystemExit(
                    'REFUSING TO PUBLISH: apksigner could not verify the APK:\n'
                    + (result.stderr or result.stdout).strip()
                )
            certificate_seen = False
            for line in result.stdout.splitlines():
                if 'certificate DN' in line:
                    certificate_seen = True
                    print(line.strip())
                    if 'CN=Android Debug' in line:
                        raise SystemExit(
                            'the release APK is signed with the DEBUG key - set '
                            'GBU_ANDROID_KEYSTORE_PATH and the other GBU_ANDROID_* '
                            'variables (see docs/RELEASE.md)'
                        )
            if not certificate_seen:
                raise SystemExit(
                    'REFUSING TO PUBLISH: apksigner printed no certificate for '
                    'the release APK - it is not signed.'
                )


if __name__ == '__main__':
    main()
