# Build output

The APKs in this folder are **not** committed (`.gitignore` ignores `*.apk`).
They are the build artefacts handed to the owner.

| File | What it is |
| --- | --- |
| `gbu-one-latest-release.apk` | The current **signed release** build (about 123 MB). Signed with the keystore from `GBU_ANDROID_KEYSTORE_PATH` / `GBU_ANDROID_KEY_ALIAS` (see `docs/RELEASE.md`). Never signed with the debug key — `tools/build_android_apk.py` fails the build if it is. |

## Installing on a phone over USB

```powershell
adb devices                 # the phone must show as "device"
adb install -r apk\gbu-one-latest-release.apk
```

If the phone was installed with a different key, `adb install -r` refuses
(`INSTALL_FAILED_UPDATE_INCOMPATIBLE`); remove it first with
`adb uninstall in.gbu.one`.

## Rebuilding

The Android native build breaks when the project path contains a space, so
the APK is always built from a copy at a path without spaces:

```powershell
$env:GBU_ANDROID_KEYSTORE_PATH='<path to your .keystore>'
$env:GBU_ANDROID_KEYSTORE_PASSWORD='<store password>'
$env:GBU_ANDROID_KEY_ALIAS='<key alias>'
$env:GBU_ANDROID_KEY_PASSWORD='<key password>'
python tools\build_android_apk.py --release
```

The script always re-runs `expo prebuild` (the signing plugin writes the
`GBU_ANDROID_*` values into `android/gradle.properties`), installs the
dependencies in the build copy when `package.json` has changed, retries
Gradle once and prints the certificate DN of the finished APK. A full build
takes about 20 minutes.

## Before you publish

- Put your own upload keystore in place (never commit it).
- `npx eas build --profile production --platform android` is the supported
  path once the EAS project id exists (`docs/OPEN_QUESTIONS.md` #11).
- The 16 KB page-size gap from the React Native 0.76 prebuilts is recorded
  in `docs/OPEN_QUESTIONS.md` #13.
