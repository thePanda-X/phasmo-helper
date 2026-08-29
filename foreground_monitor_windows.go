//go:build windows

package main

import (
	"strings"
	"syscall"
	"time"
	"unsafe"
)

const (
	processQueryLimitedInformation = 0x1000
	overlayForegroundPollInterval  = 100 * time.Millisecond
)

var (
	foregroundUser32           = syscall.NewLazyDLL("user32.dll")
	getForegroundWindow        = foregroundUser32.NewProc("GetForegroundWindow")
	getWindowThreadProcessID   = foregroundUser32.NewProc("GetWindowThreadProcessId")
	foregroundKernel32         = syscall.NewLazyDLL("kernel32.dll")
	openProcess                = foregroundKernel32.NewProc("OpenProcess")
	closeHandle                = foregroundKernel32.NewProc("CloseHandle")
	queryFullProcessImageNameW = foregroundKernel32.NewProc("QueryFullProcessImageNameW")
)

func (a *App) startOverlayForegroundMonitor() {
	stop := make(chan struct{})
	done := make(chan struct{})
	a.overlayMonitorStop = stop
	a.overlayMonitorDone = done

	go func() {
		defer close(done)
		ticker := time.NewTicker(overlayForegroundPollInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				if a.overlay.Load() && a.ctx != nil {
					a.setOverlayVisibility(isPhasmophobiaForeground())
				}
			case <-stop:
				return
			}
		}
	}()
}

func (a *App) stopOverlayForegroundMonitor() {
	if a.overlayMonitorStop == nil {
		return
	}
	close(a.overlayMonitorStop)
	<-a.overlayMonitorDone
	a.overlayMonitorStop = nil
	a.overlayMonitorDone = nil
}

func isPhasmophobiaForeground() bool {
	hwnd, _, _ := getForegroundWindow.Call()
	if hwnd == 0 {
		return false
	}

	var processID uint32
	if result, _, _ := getWindowThreadProcessID.Call(hwnd, uintptr(unsafe.Pointer(&processID))); result == 0 || processID == 0 {
		return false
	}

	process, _, _ := openProcess.Call(processQueryLimitedInformation, 0, uintptr(processID))
	if process == 0 {
		return false
	}
	defer closeHandle.Call(process)

	buffer := make([]uint16, 32768)
	bufferLength := uint32(len(buffer))
	result, _, _ := queryFullProcessImageNameW.Call(
		process,
		0,
		uintptr(unsafe.Pointer(&buffer[0])),
		uintptr(unsafe.Pointer(&bufferLength)),
	)
	if result == 0 {
		return false
	}

	return isPhasmophobiaExecutable(syscall.UTF16ToString(buffer[:bufferLength]))
}

func isPhasmophobiaExecutable(path string) bool {
	path = strings.TrimSpace(path)
	if separator := strings.LastIndexAny(path, `/\\`); separator >= 0 {
		path = path[separator+1:]
	}
	return strings.EqualFold(path, "Phasmophobia.exe")
}
