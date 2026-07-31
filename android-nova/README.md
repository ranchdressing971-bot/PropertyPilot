# Nova Android (burner phone)

Fullscreen WebView shell that loads `https://rideby-ai.vercel.app/nova` with mic + keep-screen-on.

## Build

```bash
# from repo root (uses portable JDK/SDK under .tools if present)
./android-nova/scripts/build-apk.sh
```

Output: `public/downloads/nova.apk` → served at `/downloads/nova.apk`.

## Notes

- Debug-signed APK (fine for personal burner phones).
- Change URL in `app/src/main/res/values/strings.xml` if the domain changes.
