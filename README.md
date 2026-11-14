# SHELL

An Android home screen with no icons and no grid. You type at it, and it keeps a ledger of the day.

- **Top:** the numbers (unlocks, screen time, people, waiting, judgment: always 00) and a big thin clock.
- **Middle:** the ledger. Everything you ran from here and every app session of a minute or more, time-stamped.
- **Bottom:** chips and one line: `> say anything_`.

Type an app name, a sum, or a thing to do. Enter runs the bottom suggestion.

```
call dad                  text ana running late        reply leo on my way
remind 20m call inspector timer 10m pasta              alarm 6:30am
event dinner fri 7pm      note punch list: caulk       go reston town center
18*4.5                    pay leo 20 for pizza         play / pause / next
apps  waiting  week  ledger  notes  cal  weather  history  help  setup
theme dusk   chip add spotify   alias sp = spotify   hide uber   export
```

Gestures: swipe up for apps, swipe down from the top for waiting, tap the clock for the full ledger, hold the
clock to change colour, tap a ledger line to bring it back, hold an app or a chip for options.
`help all` lists the rest. Some things are not listed anywhere.

## Layout

```
index.html        the page the APK ships and the phone can download (built; do not edit by hand)
src/              shell.css, body.html, mock.js (preview data), shell.js, fonts.css, build.py
android/          the Kotlin shell: one WebView + window.ShellNative (see android/README.md)
```

Rebuild the page: `python3 src/build.py`. Open `index.html` in a browser to try it on made-up data.

## Install

Actions → **Release APK** → Run workflow. Download `shell.apk` from the release on the phone and open it.
Then type `setup` and turn things on. Usage access (unlocks, screen time, sessions) and notification access are
the two that matter. On Android 13+: App info → ⋮ → Allow restricted settings first.

After that, page-only changes arrive with `update` (no reinstall); `update app` fetches a newer APK.

Font: JetBrains Mono (SIL Open Font License 1.1), three weights, subset and embedded.
