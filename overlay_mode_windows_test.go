//go:build windows

package main

import "testing"

func TestOverlayWindowStyleUsesTaskbarAppWindow(t *testing.T) {
	original := uintptr(0x1000) | wsExToolWindow
	style := overlayWindowStyle(original)

	if style&wsExToolWindow != 0 {
		t.Fatal("overlay window should not use WS_EX_TOOLWINDOW")
	}
	if style&wsExAppWindow == 0 {
		t.Fatal("overlay window should use WS_EX_APPWINDOW")
	}
	if style&(wsExLayered|wsExTransparent|wsExNoActivate) != wsExLayered|wsExTransparent|wsExNoActivate {
		t.Fatal("overlay window lost click-through styles")
	}
}
