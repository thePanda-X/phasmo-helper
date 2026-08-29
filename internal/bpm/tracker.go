package bpm

import (
	"math"
	"sort"
	"sync"
	"time"
)

// Config controls how taps are accepted and how many recent steps contribute
// to the display. The defaults are tuned for normal Phasmophobia hunts.
type Config struct {
	WindowSize  int
	MinInterval time.Duration
	ResetAfter  time.Duration
	Modifier    float64
}

func DefaultConfig() Config {
	return Config{
		WindowSize:  8,
		MinInterval: 120 * time.Millisecond,
		ResetAfter:  2500 * time.Millisecond,
		Modifier:    1,
	}
}

// Snapshot is safe to serialize directly through Wails.
type Snapshot struct {
	BPM               float64   `json:"bpm"`
	BaseSpeedMPS      float64   `json:"baseSpeedMPS"`
	ActualSpeedMPS    float64   `json:"actualSpeedMPS"`
	SpeedModifier     float64   `json:"speedModifier"`
	TapCount          int       `json:"tapCount"`
	IntervalCount     int       `json:"intervalCount"`
	LastIntervalMS    float64   `json:"lastIntervalMS"`
	MedianIntervalMS  float64   `json:"medianIntervalMS"`
	JitterMS          float64   `json:"jitterMS"`
	RecentIntervalsMS []float64 `json:"recentIntervalsMS"`
	Confidence        string    `json:"confidence"`
	Ready             bool      `json:"ready"`
}

// Tracker consumes real tap timestamps. It uses the median of recent
// intervals, which is less sensitive than a plain average to one missed tap.
type Tracker struct {
	mu        sync.RWMutex
	config    Config
	model     SpeedModel
	taps      []time.Time
	intervals []time.Duration
}

func NewTracker(config Config) *Tracker {
	defaults := DefaultConfig()
	if config.WindowSize < 1 {
		config.WindowSize = defaults.WindowSize
	}
	if config.MinInterval <= 0 {
		config.MinInterval = defaults.MinInterval
	}
	if config.ResetAfter <= config.MinInterval {
		config.ResetAfter = defaults.ResetAfter
	}
	if config.Modifier <= 0 {
		config.Modifier = defaults.Modifier
	}
	model, _ := NewSpeedModel(config.Modifier)
	return &Tracker{config: config, model: model}
}

func (t *Tracker) Tap() Snapshot {
	return t.TapAt(time.Now())
}

// TapAt exists so timing behavior can be tested with deterministic timestamps.
func (t *Tracker) TapAt(now time.Time) Snapshot {
	t.mu.Lock()
	defer t.mu.Unlock()

	if len(t.taps) > 0 {
		interval := now.Sub(t.taps[len(t.taps)-1])
		if interval < t.config.MinInterval {
			// Ignore keyboard repeat and accidental double taps without moving
			// the reference timestamp for the next valid step.
			return t.snapshotLocked()
		}
		if interval > t.config.ResetAfter {
			t.taps = nil
			t.intervals = nil
		} else {
			t.intervals = append(t.intervals, interval)
			if len(t.intervals) > t.config.WindowSize {
				t.intervals = t.intervals[len(t.intervals)-t.config.WindowSize:]
			}
		}
	}

	t.taps = append(t.taps, now)
	if len(t.taps) > t.config.WindowSize+1 {
		t.taps = t.taps[len(t.taps)-(t.config.WindowSize+1):]
	}
	return t.snapshotLocked()
}

func (t *Tracker) Reset() Snapshot {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.taps = nil
	t.intervals = nil
	return t.snapshotLocked()
}

func (t *Tracker) SetSpeedModifier(modifier float64) Snapshot {
	if modifier <= 0 {
		return t.Snapshot()
	}
	t.mu.Lock()
	t.config.Modifier = modifier
	t.model, _ = NewSpeedModel(modifier)
	defer t.mu.Unlock()
	return t.snapshotLocked()
}

func (t *Tracker) Snapshot() Snapshot {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.snapshotLocked()
}

func (t *Tracker) snapshotLocked() Snapshot {
	snapshot := Snapshot{
		SpeedModifier: t.config.Modifier,
		TapCount:      len(t.taps),
		IntervalCount: len(t.intervals),
		Confidence:    confidenceFor(len(t.intervals), 0),
	}
	if len(t.intervals) == 0 {
		return snapshot
	}

	values := make([]float64, len(t.intervals))
	for i, interval := range t.intervals {
		values[i] = float64(interval) / float64(time.Millisecond)
	}
	snapshot.RecentIntervalsMS = append([]float64(nil), values...)
	snapshot.LastIntervalMS = values[len(values)-1]
	snapshot.MedianIntervalMS = median(values)
	mean := average(values)
	snapshot.JitterMS = standardDeviation(values, mean)
	snapshot.Confidence = confidenceFor(len(values), snapshot.JitterMS/mean)
	snapshot.BPM = 60_000 / snapshot.MedianIntervalMS
	snapshot.BaseSpeedMPS = t.model.BaseSpeedFromBPM(snapshot.BPM)
	snapshot.ActualSpeedMPS = snapshot.BaseSpeedMPS * t.config.Modifier
	snapshot.Ready = len(values) >= 1
	return snapshot
}

func confidenceFor(intervalCount int, coefficientOfVariation float64) string {
	switch {
	case intervalCount < 2:
		return "low"
	case intervalCount < 4:
		return "medium"
	case coefficientOfVariation > 0.12:
		return "medium"
	default:
		return "high"
	}
}

func median(values []float64) float64 {
	sorted := append([]float64(nil), values...)
	sort.Float64s(sorted)
	middle := len(sorted) / 2
	if len(sorted)%2 == 0 {
		return (sorted[middle-1] + sorted[middle]) / 2
	}
	return sorted[middle]
}

func average(values []float64) float64 {
	var total float64
	for _, value := range values {
		total += value
	}
	return total / float64(len(values))
}

func standardDeviation(values []float64, mean float64) float64 {
	if len(values) < 2 {
		return 0
	}
	var squared float64
	for _, value := range values {
		delta := value - mean
		squared += delta * delta
	}
	return math.Sqrt(squared / float64(len(values)))
}
