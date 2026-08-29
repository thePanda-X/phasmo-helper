package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

const (
	moduleStepTracker    = "stepTracker"
	moduleGhostSearch    = "ghostSearch"
	moduleTopSuspects    = "topSuspects"
	moduleEvidence       = "evidence"
	moduleHuntTimers     = "huntTimers"
	moduleTrackerDetails = "trackerDetails"
	moduleHuntDetails    = "huntDetails"
)

type ModuleLayout struct {
	X         int  `json:"x"`
	Y         int  `json:"y"`
	Width     int  `json:"width"`
	Height    int  `json:"height"`
	Pinned    bool `json:"pinned"`
	Collapsed bool `json:"collapsed"`
}

type OverlayLayout struct {
	Modules map[string]ModuleLayout `json:"modules"`
}

func defaultOverlayLayout() OverlayLayout {
	return OverlayLayout{Modules: map[string]ModuleLayout{
		moduleStepTracker: {
			X: 24, Y: 55, Width: 292, Height: 180, Pinned: true,
		},
		moduleGhostSearch: {
			X: 1276, Y: 87, Width: 579, Height: 850,
		},
		moduleTopSuspects: {
			X: 24, Y: 245, Width: 290, Height: 180, Pinned: true,
		},
		moduleEvidence: {
			X: 627, Y: 124, Width: 454, Height: 304,
		},
		moduleHuntTimers: {
			X: 10, Y: 860, Width: 431, Height: 215, Pinned: true,
		},
		moduleTrackerDetails: {
			X: 897, Y: 790, Width: 240, Height: 83, Collapsed: true,
		},
		moduleHuntDetails: {
			X: 586, Y: 801, Width: 221, Height: 85, Collapsed: true,
		},
	}}
}

func normalizeOverlayLayout(layout OverlayLayout) OverlayLayout {
	defaults := defaultOverlayLayout()
	if layout.Modules == nil {
		layout.Modules = make(map[string]ModuleLayout)
	}
	for id, fallback := range defaults.Modules {
		module, ok := layout.Modules[id]
		if !ok {
			layout.Modules[id] = fallback
			continue
		}
		if module.Width < 280 || module.Width > 1200 {
			module.Width = fallback.Width
		}
		if module.Height < 100 || module.Height > 1400 {
			module.Height = fallback.Height
		}
		layout.Modules[id] = module
	}
	for id := range layout.Modules {
		if _, ok := defaults.Modules[id]; !ok {
			delete(layout.Modules, id)
		}
	}
	return layout
}

func loadOverlayLayout() OverlayLayout {
	defaults := defaultOverlayLayout()
	path, err := overlayLayoutPath()
	if err != nil {
		return defaults
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return defaults
	}
	var layout OverlayLayout
	if err := json.Unmarshal(data, &layout); err != nil {
		return defaults
	}
	return normalizeOverlayLayout(layout)
}

func saveOverlayLayout(layout OverlayLayout) error {
	layout = normalizeOverlayLayout(layout)
	path, err := overlayLayoutPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create overlay settings directory: %w", err)
	}
	data, err := json.MarshalIndent(layout, "", "  ")
	if err != nil {
		return fmt.Errorf("encode overlay layout: %w", err)
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return fmt.Errorf("write overlay layout: %w", err)
	}
	return nil
}

func overlayLayoutPath() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("find user config directory: %w", err)
	}
	return filepath.Join(configDir, "PhasmoHelper", "overlay-layout.json"), nil
}
