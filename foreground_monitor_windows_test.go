//go:build windows

package main

import "testing"

func TestIsPhasmophobiaExecutable(t *testing.T) {
	tests := []struct {
		name string
		path string
		want bool
	}{
		{name: "full path", path: `C:\Program Files (x86)\Steam\steamapps\common\Phasmophobia\Phasmophobia.exe`, want: true},
		{name: "case insensitive", path: "phasmophobia.EXE", want: true},
		{name: "different executable", path: `C:\Games\Phasmophobia\steam.exe`, want: false},
		{name: "empty path", path: "", want: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := isPhasmophobiaExecutable(test.path); got != test.want {
				t.Fatalf("isPhasmophobiaExecutable(%q) = %v, want %v", test.path, got, test.want)
			}
		})
	}
}
