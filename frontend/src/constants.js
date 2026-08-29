export const KEYBIND_LABELS = {
    tap: 'Footstep tap',
    reset: 'Reset tracker and timers',
    fullReset: 'Full session reset',
    toggleOverlay: 'Toggle pinned overlay',
    startHunt: 'Start hunt timer',
    endHunt: 'End hunt timer',
};

export const DEFAULT_KEYBINDS = {
    tap: 'Space',
    reset: 'F7',
    fullReset: 'F12',
    toggleOverlay: 'F8',
    startHunt: 'F10',
    endHunt: 'F11',
};

export const KEYBIND_ROWS = [
    { action: 'tap', description: 'Records one timestamp for BPM measurement.' },
    { action: 'reset', description: 'Clears the current tap sequence and hunt timers.' },
    { action: 'fullReset', description: 'Clears taps, hunt timers, evidence, and discarded ghosts.' },
    { action: 'startHunt', description: 'Starts the hunt stopwatch and closes the previous cooldown measurement.' },
    { action: 'endHunt', description: 'Records hunt duration and starts the post-hunt cooldown timer.' },
    { action: 'toggleOverlay', description: 'Shows or hides the pinned floating modules over the game.' },
];

export const EVIDENCE_OPTIONS = [
    { id: 'emf5', label: 'EMF Level 5' },
    { id: 'ultraviolet', label: 'Ultraviolet' },
    { id: 'freezing', label: 'Freezing Temperatures' },
    { id: 'ghostOrbs', label: 'Ghost Orbs' },
    { id: 'spiritBox', label: 'Spirit Box' },
    { id: 'dots', label: 'D.O.T.S. Projector' },
    { id: 'ghostWriting', label: 'Ghost Writing' },
];

export const HUNT_TIMER_PRESETS = [
    { id: 'standardCooldown', label: 'Standard hunt cooldown', durationMs: 25_000, note: '25 seconds' },
    { id: 'demonCooldown', label: 'Demon hunt cooldown floor', durationMs: 20_000, note: '20 seconds' },
    { id: 'standardIncense', label: 'Standard incense hunt block', durationMs: 90_000, note: '90 seconds' },
    { id: 'demonIncense', label: 'Demon incense hunt block', durationMs: 60_000, note: '60 seconds' },
    { id: 'spiritIncense', label: 'Spirit incense hunt block', durationMs: 180_000, note: '180 seconds' },
    { id: 'standardBlind', label: 'Standard hunt blind', durationMs: 5_000, note: '5 seconds' },
    { id: 'moroiBlind', label: 'Moroi hunt blind', durationMs: 7_000, note: '7 seconds' },
    { id: 'yureiRoomLock', label: 'Yurei room lock', durationMs: 90_000, note: '90 seconds' },
    { id: 'obamboFirstSwitch', label: 'Obambo first state switch', durationMs: 60_000, note: '1 minute after the exit door opens' },
    { id: 'obamboRepeatSwitch', label: 'Obambo repeat state switch', durationMs: 120_000, note: '2 minutes between switches' },
];

export function createDefaultLayout() {
    return {
        modules: {
            stepTracker: { x: 24, y: 24, width: 310, height: 185, pinned: false, collapsed: false },
            ghostSearch: { x: 580, y: 24, width: 530, height: 620, pinned: false, collapsed: false },
            topSuspects: { x: 24, y: 230, width: 310, height: 145, pinned: false, collapsed: false },
            evidence: { x: 580, y: 670, width: 530, height: 220, pinned: false, collapsed: false },
            huntTimers: { x: 24, y: 400, width: 430, height: 214, pinned: false, collapsed: false },
            trackerDetails: { x: 24, y: 1280, width: 530, height: 620, pinned: false, collapsed: true },
            huntDetails: { x: 580, y: 1280, width: 630, height: 420, pinned: false, collapsed: true },
        },
    };
}

export function createEmptyTrackerState() {
    return {
        bpm: 0,
        baseSpeedMPS: 0,
        actualSpeedMPS: 0,
        speedModifier: 1,
        tapCount: 0,
        intervalCount: 0,
        lastIntervalMS: 0,
        jitterMS: 0,
        confidence: 'low',
        ready: false,
    };
}

export function createEmptyHuntTimerState() {
    return {
        active: false,
        huntStartedAt: 0,
        huntElapsedMs: 0,
        cooldownStartedAt: 0,
        cooldownElapsedMs: 0,
        lastDurationMs: 0,
        lastCooldownMs: 0,
        history: [],
        testActive: false,
        testStartedAt: 0,
        testDurationMs: 0,
        testRemainingMs: 0,
        testLabel: '',
        testNote: '',
        nextHuntID: 1,
    };
}
