# SHELL (Android app)

Package `ing.jere.shell`, label SHELL. A thin Kotlin shell: one WebView running the repo's `index.html`
(copied into the APK's assets at build time) plus `window.ShellNative` for the phone. Forked from the
Switchboard shell on 2026-11-13; it shares nothing with it at runtime.

| | |
|---|---|
| Version | 0.1.0 (versionCode 1) |
| SDK | min 26, target/compile 35 |
| Toolchain | AGP 8.7.3, Kotlin 2.0.21, Gradle wrapper, JDK 17 |

```
app/src/main/java/ing/jere/shell/
  MainActivity.kt  WebView, insets, native → page events (SHELL.onNative), bar colours from SHELL.bars()
  Native.kt        window.ShellNative: every method the page calls (list at the top of src/shell.js)
  Notifs.kt        notification access: the waiting list, replies, media sessions
  Reminders.kt     remind: exact alarms → a notification; rescheduled after a restart
  Updater.kt       page updates from main/index.html, app updates from the latest release
  IconHandler.kt   /icon/<pkg>/<activity> (unused by this page: no icons)
```

Added over the Switchboard bridge: `usage()` (today's unlocks, screen-on time, per-app time and sessions from
UsageStats; needs Usage access, `askPerm("usage")`), `camera()`, and `perms().usage`.

## Build

Actions → **Release APK** → Run workflow (the button is the only trigger). Publishes release `v<versionName>`
with `shell.apk`. Signing: secret `SHELL_KEYSTORE_B64` (+ optional `SHELL_KEYSTORE_PASSWORD`, `SHELL_KEY_ALIAS`,
`SHELL_KEY_PASSWORD`); without it the APK is debug-signed and each build needs an uninstall first.

The Kotlin added for 0.1.0 has not been compiled yet (no Android SDK where it was written). The first CI run is
the compile check.
