package main

import "testing"

func TestNormalizeKeybindCanonicalizesModifiersAndKeys(t *testing.T) {
	got, err := normalizeKeybind("shift+ctrl+o")
	if err != nil {
		t.Fatal(err)
	}
	if got != "Ctrl+Shift+KeyO" {
		t.Fatalf("normalized keybind = %q, want Ctrl+Shift+KeyO", got)
	}
}

func TestNormalizeKeybindRejectsModifierOnlyBinding(t *testing.T) {
	if _, err := normalizeKeybind("Ctrl"); err == nil {
		t.Fatal("expected modifier-only keybind to be rejected")
	}
}

func TestNormalizeKeybindRejectsDuplicateBindings(t *testing.T) {
	settings := defaultKeybindSettings()
	settings.Reset = settings.Tap
	if err := settings.validate(); err == nil {
		t.Fatal("expected duplicate keybinds to be rejected")
	}
}

func TestNormalizeSettingsRepairsInvalidValues(t *testing.T) {
	settings := normalizeSettings(KeybindSettings{Tap: "not-a-key"})
	defaults := defaultKeybindSettings()
	if settings.Tap != defaults.Tap || settings.Reset != defaults.Reset {
		t.Fatalf("normalized settings = %#v, want defaults for invalid values", settings)
	}
}

func TestDefaultKeybindSettingsIncludeHuntTimers(t *testing.T) {
	defaults := defaultKeybindSettings()
	if defaults.StartHunt != "F10" || defaults.EndHunt != "F11" {
		t.Fatalf("hunt timer defaults = %#v, want F10/F11", defaults)
	}
	if defaults.FullReset != "F12" {
		t.Fatalf("full reset default = %q, want F12", defaults.FullReset)
	}
	if err := defaults.validate(); err != nil {
		t.Fatalf("default keybinds should validate: %v", err)
	}
}

func TestSetKeybindUpdatesHuntTimerBindings(t *testing.T) {
	t.Setenv("APPDATA", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	app := &App{keybinds: defaultKeybindSettings()}
	updated, err := app.SetKeybind(keybindStartHunt, "KeyQ")
	if err != nil {
		t.Fatalf("setting start hunt keybind: %v", err)
	}
	if updated.StartHunt != "KeyQ" {
		t.Fatalf("start hunt keybind = %q, want KeyQ", updated.StartHunt)
	}

	updated, err = app.SetKeybind(keybindEndHunt, "KeyE")
	if err != nil {
		t.Fatalf("setting end hunt keybind: %v", err)
	}
	if updated.EndHunt != "KeyE" {
		t.Fatalf("end hunt keybind = %q, want KeyE", updated.EndHunt)
	}

	updated, err = app.SetKeybind(keybindFullReset, "KeyR")
	if err != nil {
		t.Fatalf("setting full reset keybind: %v", err)
	}
	if updated.FullReset != "KeyR" {
		t.Fatalf("full reset keybind = %q, want KeyR", updated.FullReset)
	}
}
