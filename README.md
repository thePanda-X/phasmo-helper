# Phasmo Field Kit

Windows-first Wails scaffold for a manual Phasmophobia no-evidence helper.
It currently includes a real-time footstep BPM tracker and a local ghost
reference/search catalog.

## What Works

- Global Spacebar observation on Windows without suppressing the key.
- Persistent keybind settings for tapping, resetting, full session reset, panel visibility, and opening settings.
- Floating desktop dashboard modules with persistent positions, sizes, and pin state.
- Monitor-sized, click-through overlay mode for pinned modules.
- Session ghost discards, including one-click removal of ghosts outside the measured speed, with individual restore toggles in the lookup.
- Manual tap button for testing or non-Windows development.
- Median BPM from the most recent eight valid footstep intervals.
- Keyboard-repeat rejection and automatic reset after a 2.5 second pause.
- Estimated base and actual movement speed.
- Ghost speed shortlist with a 0.175 m/s tolerance.
- Separate top-three suspect module ranked from measured speed and discarded ghosts.
- Evidence selector that removes ghosts missing confirmed evidence from the candidate lists.
- Manual hunt stopwatch, post-hunt cooldown measurement, and ghost test countdown presets.
- Search by ghost name, alias, or Spanish localized name while displaying English ghost names.
- Thirty ghost entries through Deildegast in `internal/ghosts/data/ghosts.json`, including evidence, conditional speed profiles, and behavior tells.

The tracker uses the community footstep model:

```text
base speed = BPM / (modifier * (60 + BPM * 0.095))
```

At 100% modifier, a 1.7 m/s standard ghost is approximately 121.6 BPM.
The conversion offset is named and configurable in `internal/bpm/model.go`
so it can be recalibrated if a game update changes the relationship.

This is a measurement aid, not an automatic identification system. Missed
steps, line of sight, conditional abilities, custom modifiers, and game
updates can change the result. Speed matches should remain a shortlist until
confirmed by behavior.

## Run

Install Node.js and the Wails CLI, then run:

```text
npm install --prefix frontend
wails dev
```

Build a Windows binary with:

```text
wails build
```

Open **Settings** in the panel to record a key or combination. Defaults are
`Space` for footstep tap, `F7` for tracker and timer reset, `F8` for pinned overlay
mode, `F9` for settings, `F10` to start a hunt timer, `F11` to end a hunt timer,
and `F12` for full session reset. Full session reset also clears evidence and
discarded ghosts.
Preferences are saved at `%APPDATA%\PhasmoHelper\settings.json`.

On desktop, drag any module by its heading and resize it from the bottom-right
corner. Positions and sizes are saved immediately. Use **Pin** to keep a module
visible in the in-game overlay; unpinned modules remain on the dashboard only.
The dashboard switches to a stacked layout on narrow windows. The menu opens maximized
by default. Press `F8` to hide
the menu and show only pinned modules over the current monitor; the overlay is
transparent and click-through. Press `F8` again to return and edit or resize
modules. Module layout is saved at
`%APPDATA%\PhasmoHelper\overlay-layout.json`.
The title bar includes minimize and exit controls. The Windows tray icon includes
an **Exit Phasmo Field Kit** command. It exits the helper without closing the game;
the overlay content is hidden when Phasmophobia is not the foreground application.

Use **Start hunt** when hunt audio begins and **End hunt** when it stops. Ending a
hunt starts the post-hunt cooldown measurement; starting the next hunt records
that cooldown. The timer module also includes presets for Demon, Spirit, Moroi,
Yurei, and Obambo timing tests. Cursed hunts and custom settings can invalidate
the standard timing comparisons.

Run tests with:

```text
go test ./...
```

## Data References

The initial speed profiles follow the public baseline used by the Veknmo
footstep tool and its published source. Ghost evidence and behavior tells are
maintained from the current public 30-ghost roster:

- https://github.com/ArshdeepGadhri/veknmo
- https://progameguides.com/phasmophobia/all-ghosts-moving-speeds-in-phasmophobia/
- https://phasmophobia.fandom.com/wiki/Ghost
- https://phasmophobia.fandom.com/wiki/Deildegast

The catalog is intentionally embedded so packaged builds do not depend on the
working directory. Edit the JSON and rebuild when updating game data.
