//go:build windows

package main

import (
	"sync"
	"syscall"
	"unsafe"
)

const (
	smCXScreen = 0
	smCYScreen = 1

	gwlExStyle = ^uintptr(19)
	gwlWndProc = ^uintptr(3)

	wsExLayered     = 0x00080000
	wsExTransparent = 0x00000020
	wsExNoActivate  = 0x08000000
	wsExAppWindow   = 0x00040000
	wsExToolWindow  = 0x00000080

	swpNoSize       = 0x0001
	swpNoMove       = 0x0002
	swpNoZOrder     = 0x0004
	swpNoActivate   = 0x0010
	swpFrameChanged = 0x0020

	wmNCHitTest     = 0x0084
	wmMouseActivate = 0x0021
	wmSetCursor     = 0x0020
	maNoActivate    = 3
)

var (
	overlayUser32     = syscall.NewLazyDLL("user32.dll")
	findWindowW       = overlayUser32.NewProc("FindWindowW")
	getWindowLongPtrW = overlayUser32.NewProc("GetWindowLongPtrW")
	setWindowLongPtrW = overlayUser32.NewProc("SetWindowLongPtrW")
	setWindowPos      = overlayUser32.NewProc("SetWindowPos")
	callWindowProcW   = overlayUser32.NewProc("CallWindowProcW")
	getSystemMetrics  = overlayUser32.NewProc("GetSystemMetrics")
	monitorFromWindow = overlayUser32.NewProc("MonitorFromWindow")
	getMonitorInfoW   = overlayUser32.NewProc("GetMonitorInfoW")

	overlayMu            sync.Mutex
	overlayHWND          uintptr
	overlayOriginalProc  uintptr
	overlayOriginalStyle uintptr
	overlayProc          uintptr
)

type nativeRect struct {
	Left   int32
	Top    int32
	Right  int32
	Bottom int32
}

type nativeMonitorInfo struct {
	Size    uint32
	Monitor nativeRect
	Work    nativeRect
	Flags   uint32
}

func nativeOverlayBounds() (x, y, width, height int) {
	hwnd, _, _ := findWindowW.Call(0, utf16Pointer("Phasmo Field Kit"))
	if hwnd != 0 {
		monitor, _, _ := monitorFromWindow.Call(hwnd, 2)
		info := nativeMonitorInfo{Size: uint32(unsafe.Sizeof(nativeMonitorInfo{}))}
		if monitor != 0 {
			result, _, _ := getMonitorInfoW.Call(monitor, uintptr(unsafe.Pointer(&info)))
			if result != 0 {
				return int(info.Monitor.Left), int(info.Monitor.Top), int(info.Monitor.Right - info.Monitor.Left), int(info.Monitor.Bottom - info.Monitor.Top)
			}
		}
	}
	return 0, 0, int(systemMetric(smCXScreen)), int(systemMetric(smCYScreen))
}

func systemMetric(metric uintptr) uintptr {
	value, _, _ := getSystemMetrics.Call(metric)
	return value
}

func setNativeOverlayMode(enabled bool) bool {
	overlayMu.Lock()
	defer overlayMu.Unlock()

	if enabled {
		hwnd, _, _ := findWindowW.Call(0, utf16Pointer("Phasmo Field Kit"))
		if hwnd == 0 {
			return false
		}
		if overlayHWND == 0 {
			overlayHWND = hwnd
			overlayOriginalProc, _, _ = getWindowLongPtrW.Call(hwnd, gwlWndProc)
			overlayOriginalStyle, _, _ = getWindowLongPtrW.Call(hwnd, gwlExStyle)
			overlayProc = syscall.NewCallback(overlayWindowProc)
			setWindowLongPtrW.Call(hwnd, gwlWndProc, overlayProc)
		}
		style, _, _ := getWindowLongPtrW.Call(hwnd, gwlExStyle)
		style = overlayWindowStyle(style)
		setWindowLongPtrW.Call(hwnd, gwlExStyle, style)
		refreshWindowFrame(hwnd)
		return true
	}

	if overlayHWND == 0 {
		return true
	}
	setWindowLongPtrW.Call(overlayHWND, gwlWndProc, overlayOriginalProc)
	setWindowLongPtrW.Call(overlayHWND, gwlExStyle, overlayOriginalStyle)
	refreshWindowFrame(overlayHWND)
	overlayHWND = 0
	overlayOriginalProc = 0
	overlayOriginalStyle = 0
	return true
}

func overlaySupported() bool {
	return true
}

func refreshWindowFrame(hwnd uintptr) {
	setWindowPos.Call(
		hwnd,
		0,
		0,
		0,
		0,
		0,
		swpNoMove|swpNoSize|swpNoZOrder|swpNoActivate|swpFrameChanged,
	)
}

func overlayWindowStyle(style uintptr) uintptr {
	style &^= wsExToolWindow
	style |= wsExLayered | wsExTransparent | wsExNoActivate | wsExAppWindow
	return style
}

func overlayWindowProc(hwnd, message, wParam, lParam uintptr) uintptr {
	switch message {
	case wmNCHitTest:
		return ^uintptr(0)
	case wmMouseActivate:
		return maNoActivate
	case wmSetCursor:
		return 1
	default:
		if overlayOriginalProc != 0 {
			result, _, _ := callWindowProcW.Call(overlayOriginalProc, hwnd, message, wParam, lParam)
			return result
		}
		return 0
	}
}

func utf16Pointer(value string) uintptr {
	return uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(value)))
}
