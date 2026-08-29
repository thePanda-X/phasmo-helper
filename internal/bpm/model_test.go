package bpm

import (
	"math"
	"testing"
)

func TestSpeedModelRoundTrip(t *testing.T) {
	model, err := NewSpeedModel(1.25)
	if err != nil {
		t.Fatal(err)
	}

	const expectedBaseSpeed = 1.7
	bpm := model.BPMFromBaseSpeed(expectedBaseSpeed)
	if got := model.BaseSpeedFromBPM(bpm); math.Abs(got-expectedBaseSpeed) > 0.000001 {
		t.Fatalf("round trip speed = %.8f, want %.8f", got, expectedBaseSpeed)
	}
	if got := model.ActualSpeedFromBPM(bpm); math.Abs(got-2.125) > 0.000001 {
		t.Fatalf("actual speed = %.8f, want 2.125", got)
	}
}

func TestSpeedModelRejectsInvalidModifier(t *testing.T) {
	if _, err := NewSpeedModel(0); err == nil {
		t.Fatal("expected zero modifier to be rejected")
	}
}
