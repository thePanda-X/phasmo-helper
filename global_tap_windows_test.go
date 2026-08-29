//go:build windows

package main

import "testing"

func TestBindingVirtualKeysSupportsKeysAndModifiers(t *testing.T) {
	keys, ok := bindingVirtualKeys("Ctrl+Shift+KeyO")
	if !ok {
		t.Fatal("expected Ctrl+Shift+KeyO to be supported")
	}
	if len(keys) != 3 || keys[0] != virtualKeyControl || keys[1] != virtualKeyShift || keys[2] != 0x4F {
		t.Fatalf("virtual keys = %#v, want Ctrl, Shift, O", keys)
	}
}

func TestBindingVirtualKeysSupportsSpace(t *testing.T) {
	keys, ok := bindingVirtualKeys("Space")
	if !ok || len(keys) != 1 || keys[0] != virtualKeySpace {
		t.Fatalf("space mapping = %#v, %v", keys, ok)
	}
}

func TestVirtualKeyForNameUsesGenericWinBinding(t *testing.T) {
	if got := virtualKeyForName("Win"); got != virtualKeyLWin {
		t.Fatalf("win mapping = %#x, want left Win alias %#x", got, virtualKeyLWin)
	}
}
