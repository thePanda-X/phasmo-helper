//go:build !windows

package main

import "sync/atomic"

type globalTapListener struct {
	enabled atomic.Bool
}

func newGlobalTapListener(KeybindSettings, func(string)) *globalTapListener {
	listener := &globalTapListener{}
	listener.enabled.Store(false)
	return listener
}

func (l *globalTapListener) SetEnabled(enabled bool) {
	l.enabled.Store(enabled)
}

func (l *globalTapListener) Enabled() bool {
	return l.enabled.Load()
}

func (l *globalTapListener) SetKeybinds(KeybindSettings) {}

func (l *globalTapListener) Stop() {}

func globalTapSupported() bool {
	return false
}
