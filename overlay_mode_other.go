//go:build !windows

package main

func nativeOverlayBounds() (x, y, width, height int) {
	return 0, 0, 1180, 780
}

func setNativeOverlayMode(bool) bool {
	return true
}

func overlaySupported() bool {
	return false
}
