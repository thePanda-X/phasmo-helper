package main

import (
	"reflect"
	"testing"
)

func TestNormalizeOverlayLayoutPreservesOffScreenPositions(t *testing.T) {
	layout := OverlayLayout{Modules: map[string]ModuleLayout{
		moduleStepTracker: {X: -40, Y: -20, Width: 500, Height: 500},
	}}

	normalized := normalizeOverlayLayout(layout)
	module := normalized.Modules[moduleStepTracker]
	if module.X != -40 || module.Y != -20 {
		t.Fatalf("normalized position = (%d, %d), want (-40, -20)", module.X, module.Y)
	}
}

func TestDefaultOverlayLayoutCollapsesDetailModules(t *testing.T) {
	layout := defaultOverlayLayout()
	if !layout.Modules[moduleStepTracker].Pinned || !layout.Modules[moduleTopSuspects].Pinned || !layout.Modules[moduleHuntTimers].Pinned {
		t.Fatal("reference layout should pin the tracker, suspects, and hunt timers")
	}
	if !layout.Modules[moduleTrackerDetails].Collapsed {
		t.Fatal("tracker details should start collapsed")
	}
	if !layout.Modules[moduleHuntDetails].Collapsed {
		t.Fatal("hunt details should start collapsed")
	}
	if layout.Modules[moduleTrackerDetails].Y >= 1080 || layout.Modules[moduleHuntDetails].Y >= 1080 {
		t.Fatal("collapsed detail modules should start within a standard 1080p layout")
	}
}

func TestResetOverlayLayoutRestoresAllCurrentModules(t *testing.T) {
	t.Setenv("APPDATA", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	app := NewApp()
	app.layout.Modules[moduleStepTracker] = ModuleLayout{X: 900, Y: 900, Width: 400, Height: 400, Pinned: true}
	reset, err := app.ResetOverlayLayout()
	if err != nil {
		t.Fatalf("reset layout: %v", err)
	}
	if !reflect.DeepEqual(reset, defaultOverlayLayout()) {
		t.Fatalf("reset layout = %#v, want %#v", reset, defaultOverlayLayout())
	}
	if !reflect.DeepEqual(app.GetOverlayLayout(), defaultOverlayLayout()) {
		t.Fatalf("stored layout = %#v, want %#v", app.GetOverlayLayout(), defaultOverlayLayout())
	}
}
