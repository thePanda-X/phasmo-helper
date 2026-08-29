//go:build windows

package main

import (
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

const (
	virtualKeyBackspace  = 0x08
	virtualKeyTab        = 0x09
	virtualKeyEnter      = 0x0D
	virtualKeyShift      = 0x10
	virtualKeyControl    = 0x11
	virtualKeyAlt        = 0x12
	virtualKeyPause      = 0x13
	virtualKeyCapsLock   = 0x14
	virtualKeyScrollLock = 0x91
	virtualKeyEscape     = 0x1B
	virtualKeySpace      = 0x20
	virtualKeyPageUp     = 0x21
	virtualKeyPageDown   = 0x22
	virtualKeyEnd        = 0x23
	virtualKeyHome       = 0x24
	virtualKeyLeft       = 0x25
	virtualKeyUp         = 0x26
	virtualKeyRight      = 0x27
	virtualKeyDown       = 0x28
	virtualKeyPrint      = 0x2C
	virtualKeyInsert     = 0x2D
	virtualKeyDelete     = 0x2E
	virtualKeyLWin       = 0x5B
	virtualKeyRWin       = 0x5C
	virtualKey0          = 0x30
	virtualKeyA          = 0x41
	virtualKeyF1         = 0x70
	virtualKeyNumpad0    = 0x60
	virtualKeyMultiply   = 0x6A
	virtualKeyAdd        = 0x6B
	virtualKeySubtract   = 0x6D
	virtualKeyDecimal    = 0x6E
	virtualKeyDivide     = 0x6F
	virtualKeySemicolon  = 0xBA
	virtualKeyEqual      = 0xBB
	virtualKeyComma      = 0xBC
	virtualKeyMinus      = 0xBD
	virtualKeyPeriod     = 0xBE
	virtualKeySlash      = 0xBF
	virtualKeyBackquote  = 0xC0
	virtualKeyBracketL   = 0xDB
	virtualKeyBackslash  = 0xDC
	virtualKeyBracketR   = 0xDD
	virtualKeyQuote      = 0xDE
)

var (
	user32           = syscall.NewLazyDLL("user32.dll")
	getAsyncKeyState = user32.NewProc("GetAsyncKeyState")
)

// globalTapListener observes Space globally without swallowing the key. A
// polling listener avoids installing a keyboard hook and is sufficient for
// human footstep timing at this scale.
type globalTapListener struct {
	enabled  atomic.Bool
	stop     chan struct{}
	done     chan struct{}
	onAction func(string)
	mu       sync.RWMutex
	settings KeybindSettings
	once     sync.Once
}

func newGlobalTapListener(settings KeybindSettings, onAction func(string)) *globalTapListener {
	listener := &globalTapListener{
		stop:     make(chan struct{}),
		done:     make(chan struct{}),
		onAction: onAction,
		settings: settings,
	}
	listener.enabled.Store(true)
	go listener.poll()
	return listener
}

func (l *globalTapListener) poll() {
	defer close(l.done)
	ticker := time.NewTicker(8 * time.Millisecond)
	defer ticker.Stop()

	wasDown := make(map[string]bool)
	for {
		select {
		case <-ticker.C:
			l.mu.RLock()
			entries := l.settings.entries()
			l.mu.RUnlock()
			for _, entry := range entries {
				down := bindingIsDown(entry.Binding)
				if down && !wasDown[entry.Action] && l.enabled.Load() {
					l.onAction(entry.Action)
				}
				wasDown[entry.Action] = down
			}
		case <-l.stop:
			return
		}
	}
}

func (l *globalTapListener) SetEnabled(enabled bool) {
	l.enabled.Store(enabled)
}

func (l *globalTapListener) Enabled() bool {
	return l.enabled.Load()
}

func (l *globalTapListener) SetKeybinds(settings KeybindSettings) {
	l.mu.Lock()
	l.settings = settings
	l.mu.Unlock()
}

func (l *globalTapListener) Stop() {
	l.once.Do(func() {
		close(l.stop)
	})
	<-l.done
}

func globalTapSupported() bool {
	return true
}

func bindingIsDown(binding string) bool {
	keys, ok := bindingVirtualKeys(binding)
	if !ok {
		return false
	}
	for _, key := range keys {
		if !virtualKeyIsDown(key) {
			return false
		}
	}
	return true
}

func virtualKeyIsDown(key uint16) bool {
	if key == virtualKeyLWin {
		left, _, _ := getAsyncKeyState.Call(uintptr(virtualKeyLWin))
		right, _, _ := getAsyncKeyState.Call(uintptr(virtualKeyRWin))
		return left&0x8000 != 0 || right&0x8000 != 0
	}
	result, _, _ := getAsyncKeyState.Call(uintptr(key))
	return result&0x8000 != 0
}

func bindingVirtualKeys(binding string) ([]uint16, bool) {
	parts := strings.Split(binding, "+")
	keys := make([]uint16, 0, len(parts))
	var primary uint16
	for _, part := range parts {
		key := virtualKeyForName(part)
		if key == 0 {
			return nil, false
		}
		if isModifierName(part) {
			keys = append(keys, key)
			continue
		}
		if primary != 0 {
			return nil, false
		}
		primary = key
	}
	if primary == 0 {
		if len(keys) != 1 {
			return nil, false
		}
		return keys, true
	}
	return append(keys, primary), true
}

func isModifierName(name string) bool {
	switch name {
	case "Ctrl", "Alt", "Shift", "Win":
		return true
	default:
		return false
	}
}

func virtualKeyForName(name string) uint16 {
	if isModifierName(name) {
		switch name {
		case "Ctrl":
			return virtualKeyControl
		case "Alt":
			return virtualKeyAlt
		case "Shift":
			return virtualKeyShift
		case "Win":
			return virtualKeyLWin
		}
	}
	if len(name) == 4 && strings.HasPrefix(name, "Key") {
		return virtualKeyA + uint16(name[3]-'A')
	}
	if len(name) == 6 && strings.HasPrefix(name, "Digit") {
		return virtualKey0 + uint16(name[5]-'0')
	}
	if len(name) > 1 && name[0] == 'F' {
		value := 0
		for _, digit := range name[1:] {
			if digit < '0' || digit > '9' {
				return 0
			}
			value = value*10 + int(digit-'0')
		}
		if value >= 1 && value <= 24 {
			return virtualKeyF1 + uint16(value-1)
		}
	}
	switch name {
	case "Backspace":
		return virtualKeyBackspace
	case "Tab":
		return virtualKeyTab
	case "Enter", "NumpadEnter":
		return virtualKeyEnter
	case "Escape":
		return virtualKeyEscape
	case "Space":
		return virtualKeySpace
	case "PageUp":
		return virtualKeyPageUp
	case "PageDown":
		return virtualKeyPageDown
	case "End":
		return virtualKeyEnd
	case "Home":
		return virtualKeyHome
	case "ArrowLeft":
		return virtualKeyLeft
	case "ArrowUp":
		return virtualKeyUp
	case "ArrowRight":
		return virtualKeyRight
	case "ArrowDown":
		return virtualKeyDown
	case "PrintScreen":
		return virtualKeyPrint
	case "Insert":
		return virtualKeyInsert
	case "Delete":
		return virtualKeyDelete
	case "Pause":
		return virtualKeyPause
	case "CapsLock":
		return virtualKeyCapsLock
	case "ScrollLock":
		return virtualKeyScrollLock
	case "Semicolon":
		return virtualKeySemicolon
	case "Equal":
		return virtualKeyEqual
	case "Comma":
		return virtualKeyComma
	case "Minus":
		return virtualKeyMinus
	case "Period":
		return virtualKeyPeriod
	case "Slash":
		return virtualKeySlash
	case "Backquote":
		return virtualKeyBackquote
	case "BracketLeft":
		return virtualKeyBracketL
	case "Backslash":
		return virtualKeyBackslash
	case "BracketRight":
		return virtualKeyBracketR
	case "Quote":
		return virtualKeyQuote
	case "Numpad0", "Numpad1", "Numpad2", "Numpad3", "Numpad4", "Numpad5", "Numpad6", "Numpad7", "Numpad8", "Numpad9":
		return virtualKeyNumpad0 + uint16(name[6]-'0')
	case "NumpadMultiply":
		return virtualKeyMultiply
	case "NumpadAdd":
		return virtualKeyAdd
	case "NumpadSubtract":
		return virtualKeySubtract
	case "NumpadDecimal":
		return virtualKeyDecimal
	case "NumpadDivide":
		return virtualKeyDivide
	default:
		return 0
	}
}
