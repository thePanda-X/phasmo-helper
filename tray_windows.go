//go:build windows

package main

import (
	_ "embed"

	"fyne.io/systray"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed build/windows/icon.ico
var trayIcon []byte

func (a *App) startTray() {
	start, end := systray.RunWithExternalLoop(func() {
		systray.SetIcon(trayIcon)
		systray.SetTooltip("Phasmo Field Kit")

		exitApp := systray.AddMenuItem("Exit Phasmo Field Kit", "Close the helper")
		go func() {
			<-exitApp.ClickedCh
			if a.ctx != nil {
				wailsRuntime.Quit(a.ctx)
			}
		}()
	}, nil)

	a.trayMu.Lock()
	a.trayEnd = end
	a.trayMu.Unlock()
	start()
}

func (a *App) stopTray() {
	a.trayMu.Lock()
	end := a.trayEnd
	a.trayEnd = nil
	a.trayMu.Unlock()
	if end != nil {
		end()
	}
}
