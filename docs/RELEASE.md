# Release build (Android)

The owner-owned part of a release is the **signing key** and the **store
credentials**. Everything else is automated and lives in the repo.

## 1. Create the upload key (once, owner only)

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore gbuone-upload.keystore \
  -alias gbuone \
  -keyalg RSA -keysize 2048 -validity 10000
```

Keep `gbuone-upload.keystore` and its passwords somewhere private. If it is
lost, the app can never be updated again on Play — a new key means a new
app id. Back it up.

## 2. Build a signed release APK

The signing values are read from the environment by
`plugins/withReleaseSigning.js`, which patches the generated Gradle files on
every `expo prebuild`:

| Variable | Meaning |
|---|---|
| `GBU_ANDROID_KEYSTORE_PATH` | path to the `.keystore` / `.jks` file |
| `GBU_ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `GBU_ANDROID_KEY_ALIAS` | key alias (e.g. `gbuone`) |
| `GBU_ANDROID_KEY_PASSWORD` | key password |

```bash
export GBU_ANDROID_KEYSTORE_PATH=/absolute/path/gbuone-upload.keystore
export GBU_ANDROID_KEYSTORE_PASSWORD='…'
export GBU_ANDROID_KEY_ALIAS=gbuone
export GBU_ANDROID_KEY_PASSWORD='…'

npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
```

The APK lands in `android/app/build/outputs/apk/release/app-release.apk`.
Without the environment variables the build still succeeds but falls back to
the debug key, so the APK is **not** publishable - always check the signer:

```bash
apksigner verify --print-certs app-release.apk
```

The certificate DN must read `CN=GBU One, …`, not `CN=Android Debug`.

> **Build path caveat.** The native C++ build breaks when the project path
> contains a space (`CMake`/`ninja` mangles the path). Build from a
> space-free path, e.g. `C:\gbuone-build`.

## 3. Build the Play Store bundle (AAB)

```bash
npx expo prebuild --platform android --clean
cd android && ./gradlew bundleRelease
```

The bundle lands in `android/app/build/outputs/bundle/release/app-release.aab`.

## 4. EAS Build (recommended for the store)

`eas.json` is committed with three profiles:

- `development` — dev client, internal distribution
- `preview` — internal APK for testing
- `production` — the store build (AAB for Android)

```bash
npx eas login
npx eas build --platform android --profile production
```

EAS needs an Expo account and a linked project (`npx eas init`), which also
writes `extra.eas.projectId` into `app.json` (see
`docs/OPEN_QUESTIONS.md` #11 - the app needs that id for push registration).

## 5. 16 KB page sizes (Android 15+)

`plugins/withReleaseSigning.js` also:

- pins the **NDK to r27**, whose linker emits 16 KB aligned objects, and
- adds `-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON` to the CMake arguments,
  so the modules built from source in this project are 16 KB ready.

That fixes every library this repo compiles (`libappmodules.so`,
`libc++_shared.so`, the `libreact_codegen_*` set). The **prebuilt** binaries
that ship inside React Native 0.76 and the Expo/React Native AARs
(`libreactnative.so`, `libhermes.so`, `libfbjni.so`, `libjsi.so`,
`libreanimated.so`, `libworklets.so`, …) are still 4 KB aligned. Android 15+
then shows the "not 16 KB compatible" dialog and runs the app in page-size
compatible mode.

Full 16 KB support therefore needs **Expo SDK 53 / React Native 0.79 or
newer**, which ship 16 KB aligned prebuilts. Until that upgrade lands, a
store release is possible but Play may flag the upload - see
`docs/OPEN_QUESTIONS.md` #13.

## 6. Before uploading

- `npm run typecheck && npm run lint && npm test`
- Install the release APK on a device and walk through the app once
- Check the About page still shows the right version
- Never commit the keystore, its passwords or `google-services.json`
