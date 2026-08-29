//go:build !windows

package main

func (a *App) startOverlayForegroundMonitor() {}

func (a *App) stopOverlayForegroundMonitor() {}

func isPhasmophobiaForeground() bool {
	return true
}
