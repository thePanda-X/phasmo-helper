package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

// OpenSaveFolder opens the folder that contains the saved keybinds and layout.
func (a *App) OpenSaveFolder() error {
	path, err := keybindSettingsPath()
	if err != nil {
		return err
	}
	folder := filepath.Dir(path)
	if err := os.MkdirAll(folder, 0o755); err != nil {
		return fmt.Errorf("create save folder: %w", err)
	}

	var command *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		command = exec.Command("explorer.exe", folder)
	case "darwin":
		command = exec.Command("open", folder)
	default:
		command = exec.Command("xdg-open", folder)
	}
	if err := command.Start(); err != nil {
		return fmt.Errorf("open save folder: %w", err)
	}
	return nil
}
