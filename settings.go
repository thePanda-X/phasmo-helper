package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

const (
	keybindTap           = "tap"
	keybindReset         = "reset"
	keybindFullReset     = "fullReset"
	keybindToggleOverlay = "toggleOverlay"
	keybindOpenSettings  = "openSettings"
	keybindStartHunt     = "startHunt"
	keybindEndHunt       = "endHunt"
)

type KeybindSettings struct {
	Tap           string `json:"tap"`
	Reset         string `json:"reset"`
	FullReset     string `json:"fullReset"`
	ToggleOverlay string `json:"toggleOverlay"`
	OpenSettings  string `json:"openSettings"`
	StartHunt     string `json:"startHunt"`
	EndHunt       string `json:"endHunt"`
}

type keybindEntry struct {
	Action  string
	Binding string
}

var (
	keyboardCodePattern = regexp.MustCompile(`^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-9]|2[0-4]))$`)
	keyNameAliases      = map[string]string{
		"spacebar": "Space",
		"esc":      "Escape",
		"return":   "Enter",
		"del":      "Delete",
		"ins":      "Insert",
		"pgup":     "PageUp",
		"pgdn":     "PageDown",
	}
)

func defaultKeybindSettings() KeybindSettings {
	return KeybindSettings{
		Tap:           "Space",
		Reset:         "F7",
		FullReset:     "F12",
		ToggleOverlay: "F8",
		OpenSettings:  "F9",
		StartHunt:     "F10",
		EndHunt:       "F11",
	}
}

func (s KeybindSettings) entries() []keybindEntry {
	return []keybindEntry{
		{Action: keybindTap, Binding: s.Tap},
		{Action: keybindReset, Binding: s.Reset},
		{Action: keybindFullReset, Binding: s.FullReset},
		{Action: keybindToggleOverlay, Binding: s.ToggleOverlay},
		{Action: keybindOpenSettings, Binding: s.OpenSettings},
		{Action: keybindStartHunt, Binding: s.StartHunt},
		{Action: keybindEndHunt, Binding: s.EndHunt},
	}
}

func (s KeybindSettings) validate() error {
	seen := make(map[string]string, len(s.entries()))
	for _, entry := range s.entries() {
		binding, err := normalizeKeybind(entry.Binding)
		if err != nil {
			return fmt.Errorf("%s: %w", entry.Action, err)
		}
		if previous, exists := seen[binding]; exists {
			return fmt.Errorf("%s is already assigned to %s", binding, previous)
		}
		seen[binding] = entry.Action
	}
	return nil
}

func normalizeSettings(settings KeybindSettings) KeybindSettings {
	defaults := defaultKeybindSettings()
	if binding, err := normalizeKeybind(settings.Tap); err == nil {
		settings.Tap = binding
	} else {
		settings.Tap = defaults.Tap
	}
	if binding, err := normalizeKeybind(settings.Reset); err == nil {
		settings.Reset = binding
	} else {
		settings.Reset = defaults.Reset
	}
	if binding, err := normalizeKeybind(settings.FullReset); err == nil {
		settings.FullReset = binding
	} else {
		settings.FullReset = defaults.FullReset
	}
	if binding, err := normalizeKeybind(settings.ToggleOverlay); err == nil {
		settings.ToggleOverlay = binding
	} else {
		settings.ToggleOverlay = defaults.ToggleOverlay
	}
	if binding, err := normalizeKeybind(settings.OpenSettings); err == nil {
		settings.OpenSettings = binding
	} else {
		settings.OpenSettings = defaults.OpenSettings
	}
	if binding, err := normalizeKeybind(settings.StartHunt); err == nil {
		settings.StartHunt = binding
	} else {
		settings.StartHunt = defaults.StartHunt
	}
	if binding, err := normalizeKeybind(settings.EndHunt); err == nil {
		settings.EndHunt = binding
	} else {
		settings.EndHunt = defaults.EndHunt
	}
	if settings.validate() != nil {
		return defaults
	}
	return settings
}

func loadKeybindSettings() KeybindSettings {
	defaults := defaultKeybindSettings()
	path, err := keybindSettingsPath()
	if err != nil {
		return defaults
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return defaults
	}
	var settings KeybindSettings
	if err := json.Unmarshal(data, &settings); err != nil {
		return defaults
	}
	return normalizeSettings(settings)
}

func saveKeybindSettings(settings KeybindSettings) error {
	if err := settings.validate(); err != nil {
		return err
	}
	path, err := keybindSettingsPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create settings directory: %w", err)
	}
	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return fmt.Errorf("encode settings: %w", err)
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return fmt.Errorf("write settings: %w", err)
	}
	return nil
}

func keybindSettingsPath() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("find user config directory: %w", err)
	}
	return filepath.Join(configDir, "PhasmoHelper", "settings.json"), nil
}

func normalizeKeybind(raw string) (string, error) {
	parts := strings.Split(raw, "+")
	if len(parts) == 0 {
		return "", fmt.Errorf("keybind cannot be empty")
	}

	modifiers := make(map[string]bool, 4)
	key := ""
	for _, rawPart := range parts {
		part := strings.TrimSpace(rawPart)
		if part == "" {
			return "", fmt.Errorf("keybind contains an empty part")
		}
		if modifier := normalizeModifier(part); modifier != "" {
			if modifiers[modifier] {
				return "", fmt.Errorf("duplicate modifier %q", modifier)
			}
			modifiers[modifier] = true
			continue
		}
		if key != "" {
			return "", fmt.Errorf("keybind must contain one primary key")
		}
		key = normalizeKeyName(part)
		if !validKeyName(key) {
			return "", fmt.Errorf("unsupported key %q", part)
		}
	}

	if key == "" {
		return "", fmt.Errorf("keybind must contain one primary key")
	}

	orderedModifiers := make([]string, 0, len(modifiers))
	for _, modifier := range []string{"Ctrl", "Alt", "Shift", "Win"} {
		if modifiers[modifier] && modifier != key {
			orderedModifiers = append(orderedModifiers, modifier)
		}
	}
	return strings.Join(append(orderedModifiers, key), "+"), nil
}

func normalizeModifier(value string) string {
	switch strings.ToLower(value) {
	case "ctrl", "control", "controlleft", "controlright":
		return "Ctrl"
	case "alt", "altleft", "altright", "option":
		return "Alt"
	case "shift", "shiftleft", "shiftright":
		return "Shift"
	case "win", "meta", "metaleft", "metaright", "command":
		return "Win"
	default:
		return ""
	}
}

func normalizeKeyName(value string) string {
	if alias, ok := keyNameAliases[strings.ToLower(value)]; ok {
		return alias
	}
	if len(value) == 1 {
		value = strings.ToUpper(value)
		if value >= "A" && value <= "Z" {
			return "Key" + value
		}
		if value >= "0" && value <= "9" {
			return "Digit" + value
		}
	}
	if strings.HasPrefix(value, "key") && len(value) == 4 {
		return "Key" + strings.ToUpper(value[3:])
	}
	if strings.HasPrefix(value, "digit") && len(value) == 6 {
		return "Digit" + value[5:]
	}
	if strings.HasPrefix(strings.ToLower(value), "f") {
		if number, err := strconv.Atoi(value[1:]); err == nil && number >= 1 && number <= 24 {
			return "F" + strconv.Itoa(number)
		}
	}
	return value
}

func validKeyName(value string) bool {
	if normalizeModifier(value) != "" {
		return true
	}
	if keyboardCodePattern.MatchString(value) {
		return true
	}
	switch value {
	case "Space", "Enter", "Escape", "Tab", "Backspace", "Delete", "Insert", "Home", "End", "PageUp", "PageDown",
		"ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Minus", "Equal", "BracketLeft", "BracketRight", "Backslash",
		"Semicolon", "Quote", "Comma", "Period", "Slash", "Backquote", "CapsLock", "PrintScreen", "ScrollLock", "Pause",
		"Numpad0", "Numpad1", "Numpad2", "Numpad3", "Numpad4", "Numpad5", "Numpad6", "Numpad7", "Numpad8", "Numpad9",
		"NumpadAdd", "NumpadSubtract", "NumpadMultiply", "NumpadDivide", "NumpadDecimal", "NumpadEnter":
		return true
	default:
		return false
	}
}
