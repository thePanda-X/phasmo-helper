package main

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"phasmo-helper/internal/bpm"
	"phasmo-helper/internal/ghosts"
)

type App struct {
	ctx                    context.Context
	tracker                *bpm.Tracker
	catalog                ghosts.Catalog
	tapInput               *globalTapListener
	keybinds               KeybindSettings
	layout                 OverlayLayout
	overlay                atomic.Bool
	overlayVisibilityMu    sync.Mutex
	overlayVisible         bool
	overlayVisibilityKnown bool
	overlayMonitorStop     chan struct{}
	overlayMonitorDone     chan struct{}
	trayMu                 sync.Mutex
	trayEnd                func()
	mu                     sync.RWMutex
}

type TrackerView struct {
	Snapshot bpm.Snapshot        `json:"snapshot"`
	Matches  []ghosts.SpeedMatch `json:"matches"`
	Ranked   []ghosts.SpeedMatch `json:"ranked"`
}

func NewApp() *App {
	return &App{
		tracker:  bpm.NewTracker(bpm.DefaultConfig()),
		catalog:  ghosts.MustLoad(),
		keybinds: loadKeybindSettings(),
		layout:   loadOverlayLayout(),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.overlay.Store(false)
	a.mu.RLock()
	settings := a.keybinds
	a.mu.RUnlock()
	a.tapInput = newGlobalTapListener(settings, a.handleKeybind)
	a.startOverlayForegroundMonitor()
	a.startTray()
}

func (a *App) shutdown(context.Context) {
	a.stopTray()
	a.stopOverlayForegroundMonitor()
	if a.tapInput != nil {
		a.tapInput.Stop()
	}
}

func (a *App) TrackerSnapshot() bpm.Snapshot {
	return a.tracker.Snapshot()
}

func (a *App) Tap() bpm.Snapshot {
	return a.tracker.Tap()
}

func (a *App) ResetTracker() bpm.Snapshot {
	snapshot := a.tracker.Reset()
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "tracker.reset", a.trackerViewFromSnapshot(snapshot))
	}
	return snapshot
}

func (a *App) SetSpeedModifier(modifier float64) bpm.Snapshot {
	return a.tracker.SetSpeedModifier(modifier)
}

func (a *App) TrackerView() TrackerView {
	return a.trackerView()
}

func (a *App) TapAndGetTrackerView() TrackerView {
	return a.trackerViewFromSnapshot(a.tracker.Tap())
}

func (a *App) SetSpeedModifierAndGetTrackerView(modifier float64) TrackerView {
	return a.trackerViewFromSnapshot(a.tracker.SetSpeedModifier(modifier))
}

func (a *App) SetGlobalTapEnabled(enabled bool) bool {
	if a.tapInput == nil {
		return false
	}
	a.tapInput.SetEnabled(enabled)
	return a.tapInput.Enabled()
}

func (a *App) GetKeybindSettings() KeybindSettings {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.keybinds
}

func (a *App) SetKeybind(action, binding string) (KeybindSettings, error) {
	normalized, err := normalizeKeybind(binding)
	if err != nil {
		return a.GetKeybindSettings(), err
	}

	a.mu.Lock()
	next := a.keybinds
	switch action {
	case keybindTap:
		next.Tap = normalized
	case keybindReset:
		next.Reset = normalized
	case keybindFullReset:
		next.FullReset = normalized
	case keybindToggleOverlay:
		next.ToggleOverlay = normalized
	case keybindStartHunt:
		next.StartHunt = normalized
	case keybindEndHunt:
		next.EndHunt = normalized
	default:
		current := a.keybinds
		a.mu.Unlock()
		return current, fmt.Errorf("unknown keybind action %q", action)
	}
	if err := next.validate(); err != nil {
		current := a.keybinds
		a.mu.Unlock()
		return current, err
	}
	if err := saveKeybindSettings(next); err != nil {
		current := a.keybinds
		a.mu.Unlock()
		return current, err
	}
	a.keybinds = next
	if a.tapInput != nil {
		a.tapInput.SetKeybinds(next)
	}
	a.mu.Unlock()
	return next, nil
}

func (a *App) ResetKeybinds() (KeybindSettings, error) {
	defaults := defaultKeybindSettings()
	if err := saveKeybindSettings(defaults); err != nil {
		return a.GetKeybindSettings(), err
	}
	a.mu.Lock()
	a.keybinds = defaults
	if a.tapInput != nil {
		a.tapInput.SetKeybinds(defaults)
	}
	a.mu.Unlock()
	return defaults, nil
}

func (a *App) GetOverlayLayout() OverlayLayout {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.layout
}

func (a *App) SetModuleLayout(moduleID string, module ModuleLayout) (OverlayLayout, error) {
	if moduleID != moduleStepTracker && moduleID != moduleGhostSearch && moduleID != moduleTopSuspects && moduleID != moduleEvidence && moduleID != moduleHuntTimers && moduleID != moduleTrackerDetails && moduleID != moduleHuntDetails {
		return a.GetOverlayLayout(), fmt.Errorf("unknown module %q", moduleID)
	}
	a.mu.Lock()
	next := normalizeOverlayLayout(a.layout)
	next.Modules[moduleID] = module
	next = normalizeOverlayLayout(next)
	if err := saveOverlayLayout(next); err != nil {
		current := a.layout
		a.mu.Unlock()
		return current, err
	}
	a.layout = next
	a.mu.Unlock()
	return next, nil
}

func (a *App) ResetOverlayLayout() (OverlayLayout, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	defaults := defaultOverlayLayout()
	if err := saveOverlayLayout(defaults); err != nil {
		return a.layout, err
	}
	a.layout = defaults
	return defaults, nil
}

func (a *App) SetOverlayMode(enabled bool) bool {
	if a.ctx == nil || !overlaySupported() {
		return false
	}
	if enabled {
		runtime.WindowUnmaximise(a.ctx)
		x, y, width, height := nativeOverlayBounds()
		runtime.WindowSetPosition(a.ctx, x, y)
		runtime.WindowSetSize(a.ctx, width, height)
		runtime.WindowSetAlwaysOnTop(a.ctx, true)
		if !setNativeOverlayMode(true) {
			runtime.WindowSetAlwaysOnTop(a.ctx, false)
			return false
		}
		a.overlay.Store(true)
		a.setOverlayVisibility(isPhasmophobiaForeground())
	} else {
		a.overlay.Store(false)
		setNativeOverlayMode(false)
		runtime.WindowSetAlwaysOnTop(a.ctx, false)
		runtime.WindowSetSize(a.ctx, 1180, 780)
		runtime.WindowCenter(a.ctx)
		runtime.WindowMaximise(a.ctx)
		a.setOverlayVisibility(true)
	}
	runtime.EventsEmit(a.ctx, "overlay.mode", enabled)
	return enabled
}

func (a *App) setOverlayVisibility(visible bool) {
	a.overlayVisibilityMu.Lock()
	defer a.overlayVisibilityMu.Unlock()

	if a.overlayVisibilityKnown && a.overlayVisible == visible {
		return
	}
	if a.overlay.Load() {
		// Keep the taskbar button available while hiding only the overlay content.
		// The native window remains transparent and click-through in overlay mode.
		runtime.EventsEmit(a.ctx, "overlay.visibility", visible)
	} else if visible {
		runtime.WindowShow(a.ctx)
	} else {
		runtime.WindowHide(a.ctx)
	}
	a.overlayVisible = visible
	a.overlayVisibilityKnown = true
}

func (a *App) OverlayMode() bool {
	return a.overlay.Load()
}

func (a *App) GlobalTapEnabled() bool {
	return a.tapInput != nil && a.tapInput.Enabled()
}

func (a *App) GlobalTapSupported() bool {
	return globalTapSupported()
}

func (a *App) OverlaySupported() bool {
	return overlaySupported()
}

func (a *App) SearchGhosts(query string) []ghosts.Ghost {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.catalog.Search(query)
}

func (a *App) MatchGhosts() []ghosts.SpeedMatch {
	return a.trackerView().Matches
}

func (a *App) RankGhosts() []ghosts.SpeedMatch {
	return a.trackerView().Ranked
}

func (a *App) GhostCatalogInfo() ghosts.CatalogInfo {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.catalog.Info()
}

func (a *App) handleKeybind(action string) {
	switch action {
	case keybindTap:
		snapshot := a.tracker.Tap()
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "tracker.updated", a.trackerViewFromSnapshot(snapshot))
		}
	case keybindReset:
		a.ResetTracker()
	case keybindFullReset:
		snapshot := a.tracker.Reset()
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "run.reset", snapshot)
		}
	case keybindToggleOverlay:
		a.SetOverlayMode(!a.overlay.Load())
	case keybindStartHunt:
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "hunt.timer.start")
		}
	case keybindEndHunt:
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "hunt.timer.end")
		}
	}
}

func (a *App) trackerView() TrackerView {
	return a.trackerViewFromSnapshot(a.tracker.Snapshot())
}

func (a *App) trackerViewFromSnapshot(snapshot bpm.Snapshot) TrackerView {
	view := TrackerView{Snapshot: snapshot}
	if !snapshot.Ready {
		return view
	}

	a.mu.RLock()
	defer a.mu.RUnlock()
	view.Matches = a.catalog.MatchSpeed(snapshot.BaseSpeedMPS, 0.175)
	view.Ranked = a.catalog.RankSpeed(snapshot.BaseSpeedMPS, 0)
	return view
}
