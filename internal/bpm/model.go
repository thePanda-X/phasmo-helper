package bpm

import "fmt"

// DefaultFootstepOffset is the community-measured offset used by current
// Phasmophobia footstep speed tools. It is kept as a named value so it can be
// calibrated if the game changes its movement or footstep timing.
const DefaultFootstepOffset = 0.095

// SpeedModel converts between observed footstep BPM and the ghost's base
// movement speed. Modifier is the custom difficulty ghost speed multiplier.
type SpeedModel struct {
	Modifier float64
	Offset   float64
}

func NewSpeedModel(modifier float64) (SpeedModel, error) {
	if modifier <= 0 {
		return SpeedModel{}, fmt.Errorf("speed modifier must be greater than zero")
	}
	return SpeedModel{Modifier: modifier, Offset: DefaultFootstepOffset}, nil
}

// BaseSpeedFromBPM returns the estimated speed before applying the custom
// difficulty modifier. A normal 1.7 m/s ghost at 100% is approximately 121.6
// BPM with this model.
func (m SpeedModel) BaseSpeedFromBPM(bpm float64) float64 {
	if bpm <= 0 || m.Modifier <= 0 {
		return 0
	}
	return bpm / (m.Modifier * (60 + bpm*m.Offset))
}

// ActualSpeedFromBPM returns the estimated in-game speed after the custom
// difficulty modifier has been applied.
func (m SpeedModel) ActualSpeedFromBPM(bpm float64) float64 {
	return m.BaseSpeedFromBPM(bpm) * m.Modifier
}

// BPMFromBaseSpeed is the inverse of BaseSpeedFromBPM.
func (m SpeedModel) BPMFromBaseSpeed(speed float64) float64 {
	if speed <= 0 || m.Modifier <= 0 {
		return 0
	}
	denominator := 1 - speed*m.Modifier*m.Offset
	if denominator <= 0 {
		return 0
	}
	return speed * m.Modifier * 60 / denominator
}
