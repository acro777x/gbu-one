"""
Shared build configuration for every GBU One Android artifact.

Two systems can produce an APK for this project:

  * ``tools/build_android_apk.py`` - the canonical build the project
    documents (it builds from a space-free copy, because the native
    CMake/ninja build breaks on a path with a space), and
  * the EAS ``prebuild`` hook (see ``eas.json``), which runs the SAME
    prepare step in the cloud.

They must never disagree about WHAT is inside the artifact. The decisions
therefore live here and both paths import this module. Logic that exists
twice is exactly how the two systems drifted apart in the first place:
the EAS profile shipped the admin routes, configured no backend at all and
signed with the debug key.

Standard library only - this module runs on the EAS builder, on the
owner's Windows machine and inside CI.
"""
import os
import re
import shutil

# ---------------------------------------------------------------------------
# The two app variants.
#
# The student app is `in.gbu.one`; the admin console is a separate APK with
# its own package name so both can be installed side by side. A student
# build must never contain the admin routes.
# ---------------------------------------------------------------------------
STUDENT_PACKAGE = 'in.gbu.one'
ADMIN_PACKAGE = 'in.gbu.one.admin'
STUDENT_APP_NAME = 'GBU One'
ADMIN_APP_NAME = 'GBU One Admin'

# The files that decide the variant of a build.
ADMIN_ROUTE_DIR = os.path.join('app', 'admin')
ADMIN_ROUTE_FILE = os.path.join('app', 'moderation.tsx')
LAYOUT_FILE = os.path.join('app', '_layout.tsx')
VARIANT_FILE = os.path.join('src', 'lib', 'appVariant.ts')
APP_JSON = 'app.json'

# The client cannot work without these. Expo inlines every EXPO_PUBLIC_*
# variable into the JavaScript bundle, so a bundle without them does not
# crash - it starts, finds no backend and runs OFFLINE FOREVER without a
# single error anywhere. That is the worst possible failure for a release,
# which is why a release build refuses to start without them.
REQUIRED_CLIENT_ENV = (
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
)

# A Supabase SECRET key in an EXPO_PUBLIC_* variable is a credential in the
# shipped bundle. The sanitiser in build_android_apk.py removes it from the
# .env file, but the EAS profile delivers its values through the
# environment, so the value has to be checked there as well.
SUPABASE_SECRET_PREFIX = 'sb_secret_'

# The placeholder the committed eas.json carries. A build with a
# placeholder backend is refused: it would produce an app that silently
# runs offline forever.
PLACEHOLDER_MARKER = 'REPLACE_ME'


def _read(path: str) -> str:
    with open(path, 'r', encoding='utf-8') as handle:
        return handle.read()


def _write(path: str, content: str) -> None:
    with open(path, 'w', encoding='utf-8') as handle:
        handle.write(content)


def purge_admin_variant(root: str) -> None:
    """Remove every trace of the admin console from a student build.

    The admin routes are not just hidden in a student build - they are
    deleted, and the variant is forced to ``false`` so that even a stale
    ``isAdminApp()`` call cannot reach them.
    """
    admin_dir = os.path.join(root, ADMIN_ROUTE_DIR)
    if os.path.isdir(admin_dir):
        shutil.rmtree(admin_dir, ignore_errors=True)
        print('Purged app/admin from student public APK build.')

    moderation_file = os.path.join(root, ADMIN_ROUTE_FILE)
    if os.path.isfile(moderation_file):
        os.remove(moderation_file)
        print('Purged app/moderation.tsx from student public APK build.')

    layout_file = os.path.join(root, LAYOUT_FILE)
    if os.path.isfile(layout_file):
        content = _read(layout_file)
        # The admin stack is registered behind `isAdminApp() ? (...) : null`.
        content = re.sub(r'\{isAdminApp\(\)\s*\?[\s\S]*?: null\}', '', content)
        _write(layout_file, content)
        print('Cleaned admin stack screens from app/_layout.tsx.')

    variant_file = os.path.join(root, VARIANT_FILE)
    if os.path.isfile(variant_file):
        _write(variant_file, "export function isAdminApp(): boolean { return false; }\n")
        print('Configured appVariant to strictly false for student public APK.')

    app_json = os.path.join(root, APP_JSON)
    if os.path.isfile(app_json):
        content = _read(app_json)
        # The package name has to be the STUDENT one, whatever the source
        # tree happened to hold. The quotes anchor the replacement, so
        # "in.gbu.one.admin" is never turned into "in.gbu.one.admin.admin".
        content = content.replace(
            '"package": "%s"' % ADMIN_PACKAGE, '"package": "%s"' % STUDENT_PACKAGE
        )
        content = content.replace(
            '"name": "%s"' % ADMIN_APP_NAME, '"name": "%s"' % STUDENT_APP_NAME
        )
        _write(app_json, content)
        print('Configured app.json for %s student package.' % STUDENT_PACKAGE)


def configure_admin_variant(root: str) -> None:
    """Configure a tree as the dedicated admin APK."""
    variant_file = os.path.join(root, VARIANT_FILE)
    if os.path.isfile(variant_file):
        _write(variant_file, "export function isAdminApp(): boolean { return true; }\n")
        print('Configured appVariant to true for dedicated Admin APK.')

    app_json = os.path.join(root, APP_JSON)
    if os.path.isfile(app_json):
        content = _read(app_json)
        content = content.replace(
            '"package": "%s"' % STUDENT_PACKAGE, '"package": "%s"' % ADMIN_PACKAGE
        )
        content = content.replace(
            '"name": "%s"' % STUDENT_APP_NAME, '"name": "%s"' % ADMIN_APP_NAME
        )
        _write(app_json, content)
        print('Configured app.json for %s admin package.' % ADMIN_PACKAGE)


def apply_variant(root: str, is_admin: bool) -> None:
    """Apply the requested app variant to a checked-out tree."""
    if is_admin:
        configure_admin_variant(root)
    else:
        purge_admin_variant(root)


def parse_env_text(env_text: str) -> dict:
    """Parse a .env file into a dict (last assignment wins)."""
    values = {}
    for line in (env_text or '').splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            continue
        name, _, value = stripped.partition('=')
        name = name.strip()
        value = value.split(' #')[0].strip().strip('"').strip("'")
        if name:
            values[name] = value
    return values


def backend_env_problems(env_text: str, environ=None) -> list:
    """Everything that would make a release build silently useless.

    A bundle without the backend URL and the publishable anon key does not
    crash - it starts, finds no backend and runs offline forever, with no
    error anywhere. The old EAS production profile had exactly that, and
    nothing in the pipeline noticed.
    """
    environ = os.environ if environ is None else environ
    values = parse_env_text(env_text)
    problems = []

    for name in REQUIRED_CLIENT_ENV:
        value = values.get(name) or (environ.get(name) or '').strip()
        if not value:
            problems.append('%s is not set' % name)
        elif PLACEHOLDER_MARKER in value:
            problems.append('%s still holds the placeholder value' % name)

    # A Supabase SECRET key in an EXPO_PUBLIC_* variable is a credential in
    # the shipped bundle, whatever it is called.
    for name, value in list(values.items()) + list(environ.items()):
        if not name.startswith('EXPO_PUBLIC_'):
            continue
        if str(value).startswith(SUPABASE_SECRET_PREFIX):
            problems.append('%s holds a Supabase SECRET key' % name)

    return problems


def eas_profile_problems(eas_config: dict) -> list:
    """Everything that is wrong with the committed EAS configuration.

    The EAS profile is a SECOND way to build the app, so it has to declare
    the same backend the local build uses. A profile without the env vars
    produces an app that runs offline forever.
    """
    problems = []
    build = (eas_config or {}).get('build') or {}

    for name, profile in build.items():
        env = (profile or {}).get('env') or {}
        missing = [key for key in REQUIRED_CLIENT_ENV if key not in env]
        if missing:
            problems.append(
                'eas.json profile "%s" does not declare %s'
                % (name, ', '.join(missing))
            )
        for key, value in env.items():
            if str(value).startswith(SUPABASE_SECRET_PREFIX):
                problems.append(
                    'eas.json profile "%s" ships a Supabase SECRET key in %s'
                    % (name, key)
                )
            if key.startswith('EXPO_PUBLIC_') and 'REPLACE_ME' not in str(value):
                # A real publishable key may be committed (it is public by
                # design); a credential may not.
                if re.search(
                    r'(SECRET|PASSWORD|PASSWD|PIN|MFA|PRIVATE|CREDENTIAL|TOKEN|KEY)',
                    key, re.IGNORECASE,
                ) and key not in REQUIRED_CLIENT_ENV:
                    problems.append(
                        'eas.json profile "%s" declares %s, which looks like a credential'
                        % (name, key)
                    )

    # The release profile must produce the SAME artifact as the Python
    # path: an APK. An AAB from a second system is a second thing to keep
    # in sync for no benefit.
    production = build.get('production') or {}
    build_type = ((production.get('android') or {}).get('buildType') or '').lower()
    if build_type and build_type != 'apk':
        problems.append(
            'the EAS production profile produces a "%s" - the release path '
            'produces an APK' % build_type
        )

    # The EAS build must run the SAME prepare step as the local build.
    hooks = (eas_config or {}).get('hooks') or {}
    commands = []
    for hook in hooks.values():
        if isinstance(hook, dict):
            commands.append(str(hook.get('command') or ''))
        elif isinstance(hook, str):
            commands.append(hook)
    if not any('--prepare-only' in command for command in commands):
        problems.append(
            'eas.json has no prebuild hook that runs the shared prepare step '
            '(tools/build_android_apk.py --prepare-only)'
        )

    return problems
