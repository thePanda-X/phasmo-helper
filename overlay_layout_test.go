package main

import "testing"

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
	if !layout.Modules[moduleTrackerDetails].Collapsed {
		t.Fatal("tracker details should start collapsed")
	}
	if !layout.Modules[moduleHuntDetails].Collapsed {
		t.Fatal("hunt details should start collapsed")
	}
}
