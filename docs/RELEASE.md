# Release build (Android)

**There is ONE way to build this app: `tools/build_android_apk.py`.**

It used to be three - the Python script, `eas.json`, and `tools/build_admin.py` -
and they disagreed on eight points. An EAS production build had no backend
configured (so the app ran offline forever, silently), still contained the
admin console and the moderation screen, and was signed with the **debug key**.
That is fixed: the EAS profile now runs the same prepare step through
`tools/build_config.py`, and a release build refuses to use the debug key.

---

## 1. The four things a release needs

| What | Where it comes from | Missing means |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `.env` | the app runs offline forever, silently |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env` - a **publishable** key (`sb_publishable_...`) | the same, and a `sb_secret_...` key here would ship a credential to every student |
| The owner keystore | the four `GBU_ANDROID_*` variables | the build is refused |
| The app version | `app.json` `version` | the update manifest cannot tell students what to install |

The build checks all four and **stops** rather than producing an artifact that
looks fine and is not.

---

## 2. Create the upload key (once, owner only)

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore gbuone-upload.keystore \
  -alias gbuone \
  -keyalg RSA -keysize 2048 -validity 10000
```

Keep the keystore and its passwords somewhere private. If it is lost the app
can never be updated on Play again - a new key means a new app id. **Back it
up.**

---

## 3. Build the student release APK

```bash
# the key
export GBU_ANDROID_KEYSTORE_PATH=/absolute/path/gbuone-upload.keystore
export GBU_ANDROID_KEYSTORE_PASSWORD='...'
export GBU_ANDROID_KEY_ALIAS=gbuone
export GBU_ANDROID_KEY_PASSWORD='...'

# the build
python tools/build_android_apk.py --release
```

The artifact lands at `apk/gbu-one.apk`.

What the script does, in order:

1. **syncs** the repo into `C:\gbuone-build` - the native CMake/ninja build
   breaks on a path with a space, which is why the repo cannot be built in
   place;
2. **sanitises** `.env` in the build copy - every credential is removed, and
   the check is on the **value**, not the variable name, so a secret key that
   is called `EXPO_PUBLIC_SUPABASE_ANON_KEY` is caught;
3. **purges the admin variant** - `app/admin/`, `app/moderation.tsx`, the admin
   stack in `app/_layout.tsx` and the `isAdminApp()` switch are all removed or
   forced to `false`;
4. **prebuilds and compiles** with the release signing plugin;
5. **verifies the signature** with `apksigner` and fails if the certificate is
   the debug key.

### The admin APK

```bash
python tools/build_android_apk.py --admin --release
```

It is a separate package (`in.gbu.one.admin`) so it installs side by side
with the student app.

---

## 4. What the build refuses to do

| The build stops when | Why |
|---|---|
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` holds a `sb_secret_...` key | Expo inlines it into the bundle; every student would hold a key that bypasses every row level security policy |
| a release build has no `GBU_ANDROID_*` keystore variables | a debug-signed "release" cannot be uploaded, and shipping one by accident is worse than shipping none |
| the release build has no usable backend | the app starts, finds no backend and runs offline forever with no error anywhere |
| `apksigner` reports the debug certificate | the same |

A **debug** build keeps a working anon key on purpose - the owner tests on a
real device or the emulator, and an app with no backend cannot be tested at
all. A debug build is named "debug" and must never be published.

---

## 5. Verify the artifact before publishing

```bash
# the signature is the owner key, not the debug key
apksigner verify --print-certs apk/gbu-one.apk

# the bundle carries no secret key
unzip -p apk/gbu-one.apk assets/index.android.bundle | grep -c 'sb_secret_'
# must print 0 for a release build

# the student build has no admin route
unzip -l apk/gbu-one.apk | grep -c 'admin'
```

---

## 6. The version manifest

The update screen reads `version.json` from the `campus-events` storage
bucket. Publish it from the admin console (**Updates** tab) after the build.

The version in the manifest must match `app.json` `version`, and
`minSupportedVersion` must be **less than or equal to** `latestVersion` -
otherwise every student is pushed into an update loop that can never end. The
admin console refuses to publish a manifest that would do that.

`appVersionSource` is `local`, so `version` in `app.json` is the single
source of truth and it must be bumped by hand.

---

## 7. The EAS profile (optional)

`eas.json` still exists and now runs the **same** prepare step:

```json
"hooks": { "prebuild": { "command": "python tools/build_android_apk.py --prepare-only --release" } }
```

It declares the backend env vars for every profile and produces an APK, like
the local path. `tools/build_config.py` validates it, and CI fails if the
profile ever drifts back to a state that could ship an admin-bearing,
backend-less or debug-signed artifact.

Use the local script unless there is a reason not to. There is exactly one
build path, and it is the one the owner documents.

---

## 8. After the release

- [ ] `apksigner verify --print-certs` shows the owner certificate
- [ ] the bundle contains no `sb_secret_` string
- [ ] the student APK contains no admin route
- [ ] the app starts, reaches the Home screen, and the timetable is LIVE (a
      real class, not the "no timetable published" message)
- [ ] the notices list shows real university notices, not the SAMPLE banner
- [ ] the version manifest is published and matches `app.json`
- [ ] the GitHub Actions secret `SUPABASE_SERVICE_ROLE_KEY` is set, so the
      worker keeps running - see `docs/OPEN_QUESTIONS.md` #23
