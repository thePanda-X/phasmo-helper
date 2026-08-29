package main

import "testing"

func TestNormalizeOverlayLayoutRepairsNegativePositions(t *testing.T) {
	layout := OverlayLayout{Modules: map[string]ModuleLayout{
		moduleStepTracker: {X: -40, Y: -20, Width: 500, Height: 500},
	}}

	normalized := normalizeOverlayLayout(layout)
	module := normalized.Modules[moduleStepTracker]
	if module.X != 24 || module.Y != 24 {
		t.Fatalf("normalized position = (%d, %d), want (24, 24)", module.X, module.Y)
	}
}
