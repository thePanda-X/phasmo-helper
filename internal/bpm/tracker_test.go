package bpm

import (
	"math"
	"testing"
	"time"
)

func TestTrackerUsesRecentMedianAndReportsSpeed(t *testing.T) {
	tracker := NewTracker(DefaultConfig())
	start := time.Unix(0, 0)
	var snapshot Snapshot
	for i := 0; i < 5; i++ {
		snapshot = tracker.TapAt(start.Add(time.Duration(i) * 500 * time.Millisecond))
	}

	if !snapshot.Ready {
		t.Fatal("tracker should be ready after two taps")
	}
	if snapshot.IntervalCount != 4 {
		t.Fatalf("interval count = %d, want 4", snapshot.IntervalCount)
	}
	if math.Abs(snapshot.BPM-120) > 0.001 {
		t.Fatalf("BPM = %.3f, want 120", snapshot.BPM)
	}
	if math.Abs(snapshot.BaseSpeedMPS-1.680672) > 0.00001 {
		t.Fatalf("base speed = %.6f, want 1.680672", snapshot.BaseSpeedMPS)
	}
	if snapshot.Confidence != "high" {
		t.Fatalf("confidence = %q, want high", snapshot.Confidence)
	}
}

func TestTrackerIgnoresKeyboardRepeat(t *testing.T) {
	tracker := NewTracker(DefaultConfig())
	start := time.Unix(0, 0)
	tracker.TapAt(start)
	tracker.TapAt(start.Add(10 * time.Millisecond))
	snapshot := tracker.TapAt(start.Add(500 * time.Millisecond))

	if snapshot.TapCount != 2 || snapshot.IntervalCount != 1 {
		t.Fatalf("after repeat tap got %d taps and %d intervals, want 2 and 1", snapshot.TapCount, snapshot.IntervalCount)
	}
	if math.Abs(snapshot.LastIntervalMS-500) > 0.001 {
		t.Fatalf("last interval = %.3fms, want 500ms", snapshot.LastIntervalMS)
	}
}

func TestTrackerStartsNewSequenceAfterPause(t *testing.T) {
	tracker := NewTracker(DefaultConfig())
	start := time.Unix(0, 0)
	tracker.TapAt(start)
	tracker.TapAt(start.Add(500 * time.Millisecond))
	snapshot := tracker.TapAt(start.Add(4 * time.Second))

	if snapshot.TapCount != 1 || snapshot.IntervalCount != 0 {
		t.Fatalf("after pause got %d taps and %d intervals, want 1 and 0", snapshot.TapCount, snapshot.IntervalCount)
	}
}

func TestTrackerMedianResistsOneMissedStep(t *testing.T) {
	config := DefaultConfig()
	config.WindowSize = 5
	tracker := NewTracker(config)
	start := time.Unix(0, 0)
	for _, offset := range []time.Duration{0, 500, 1000, 2000, 2500, 3000} {
		tracker.TapAt(start.Add(offset * time.Millisecond))
	}

	snapshot := tracker.Snapshot()
	if math.Abs(snapshot.BPM-120) > 0.001 {
		t.Fatalf("median BPM = %.3f, want 120", snapshot.BPM)
	}
}
