import './style.css';

import {
    GetKeybindSettings,
    GetOverlayLayout,
    GlobalTapEnabled,
    GlobalTapSupported,
    GhostCatalogInfo,
    OverlaySupported,
    OverlayMode,
    ResetKeybinds,
    ResetOverlayLayout,
    ResetTracker,
    SearchGhosts,
    SetGlobalTapEnabled,
    SetKeybind,
    SetModuleLayout,
    SetOverlayMode,
    TapAndGetTrackerView,
    SetSpeedModifierAndGetTrackerView,
    TrackerView,
} from '../wailsjs/go/main/App';
import { EventsOn, Quit, WindowMinimise } from '../wailsjs/runtime/runtime';

let trackerState = emptyTrackerState();
let searchSequence = 0;
let searchFocusRestore = true;
let lastMatches = [];
let keybindState = {};
let captureAction = null;
let settingsInputRestore = null;
let layoutState = { modules: {} };
let overlayMode = false;
let overlayContentVisible = true;
let lastGhostResults = [];
let rankedGhosts = [];
let allGhosts = [];
let discardedGhosts = new Set();
let selectedEvidence = new Set();
let currentGhostQuery = '';
let activeDrag = null;
let activeResize = null;
let huntTimerState = emptyHuntTimerState();
let overlaySupportedState = true;
let trackerRefreshSequence = 0;

const keybindLabels = {
    tap: 'Footstep tap',
    reset: 'Reset tracker and timers',
    fullReset: 'Full session reset',
    toggleOverlay: 'Toggle pinned overlay',
    openSettings: 'Open settings',
    startHunt: 'Start hunt timer',
    endHunt: 'End hunt timer',
};

const evidenceOptions = [
    { id: 'emf5', label: 'EMF Level 5' },
    { id: 'ultraviolet', label: 'Ultraviolet' },
    { id: 'freezing', label: 'Freezing Temperatures' },
    { id: 'ghostOrbs', label: 'Ghost Orbs' },
    { id: 'spiritBox', label: 'Spirit Box' },
    { id: 'dots', label: 'D.O.T.S. Projector' },
    { id: 'ghostWriting', label: 'Ghost Writing' },
];

const huntTimerPresets = [
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

document.querySelector('#app').innerHTML = `
    <div class="app-frame">
        <header class="topbar" style="--wails-draggable: drag">
            <div>
                <div class="kicker">FIELD KIT / LIVE INVESTIGATION</div>
                <h1>Phasmo Field Kit</h1>
            </div>
            <div class="topbar-status" role="status" aria-live="polite">
                <span class="status-dot"></span>
                <span id="input-status">Starting input monitor</span>
            </div>
            <div class="topbar-actions" style="--wails-draggable: no-drag">
                <button id="overlay-toggle" class="nav-button overlay-nav-button" type="button">Show pinned overlay</button>
                <button id="settings-toggle" class="nav-button" type="button">Settings</button>
                <button id="window-minimize" class="window-button" type="button" aria-label="Minimize window">MIN</button>
                <button id="window-close" class="window-button window-close-button" type="button" aria-label="Exit Phasmo Field Kit">EXIT</button>
            </div>
        </header>

        <main id="field-view" class="workspace">
            <section id="module-ghostSearch" class="catalog-column dashboard-module" data-module="ghostSearch">
                <div class="catalog-header module-heading-line" data-drag-module="ghostSearch">
                    <div>
                        <div class="kicker">REFERENCE INDEX</div>
                        <h2>Ghost tells</h2>
                    </div>
                    <div class="module-actions">
                        <span class="catalog-count" id="catalog-count">-- entries</span>
                        <button id="clear-discarded" class="text-button" type="button" hidden>Restore discarded</button>
                        <button class="module-pin" type="button" data-module-pin="ghostSearch">Pin</button>
                    </div>
                </div>
                <label class="search-box">
                    <span class="search-icon" aria-hidden="true">/</span>
                    <input id="ghost-search" type="search" autocomplete="off" aria-label="Search ghosts by name or alias" aria-controls="ghost-results" placeholder="Search by ghost name or alias">
                    <kbd>CTRL K</kbd>
                </label>
                <div class="search-help">Search is local and instant. Ghost cards show speed profiles and behavior tells.</div>
                <div id="ghost-results" class="ghost-results" aria-live="polite"></div>
                <div class="module-resize-handle" data-resize-module="ghostSearch" role="separator" aria-orientation="both" aria-label="Resize ghost tells module" tabindex="0"></div>
            </section>

            <section id="module-evidence" class="evidence-column dashboard-module" data-module="evidence">
                <div class="section-heading module-heading-line" data-drag-module="evidence">
                    <div>
                        <div class="kicker">CURRENT KNOWLEDGE</div>
                        <h2>Evidence filter</h2>
                    </div>
                    <div class="module-actions">
                        <span class="subtle" id="evidence-count">None selected</span>
                        <button id="clear-evidence" class="text-button" type="button" hidden>Clear</button>
                        <button class="module-pin" type="button" data-module-pin="evidence">Pin</button>
                    </div>
                </div>
                <div class="evidence-help">Select confirmed evidence. Ghosts without every selected clue are discarded from the candidate lists.</div>
                <div id="evidence-options" class="evidence-options">
                    ${evidenceOptions.map((evidence) => `<button class="evidence-chip" type="button" data-evidence="${evidence.id}" aria-pressed="false">${evidence.label}</button>`).join('')}
                </div>
                <div class="module-resize-handle" data-resize-module="evidence" role="separator" aria-orientation="both" aria-label="Resize evidence module" tabindex="0"></div>
            </section>

            <section id="module-stepTracker" class="tracker-column dashboard-module" data-module="stepTracker">
                <div class="section-heading module-heading-line" data-drag-module="stepTracker">
                    <div>
                        <div class="kicker">LIVE MEASUREMENT</div>
                        <h2>Footstep cadence</h2>
                    </div>
                    <div class="module-actions">
                        <span class="confidence-pill" id="confidence">WAITING</span>
                        <button class="module-pin" type="button" data-module-pin="stepTracker">Pin</button>
                    </div>
                </div>

                <div class="metric-grid">
                    <article class="metric-card metric-primary">
                        <span class="metric-label">Observed BPM</span>
                        <strong id="bpm">--</strong>
                        <span class="metric-caption">median of recent intervals</span>
                    </article>
                    <article class="metric-card">
                        <span class="metric-label">Base speed</span>
                        <strong id="base-speed">--</strong>
                        <span class="metric-caption">m/s before modifier</span>
                        <span class="metric-subvalue" id="actual-speed">actual: -- m/s</span>
                    </article>
                    <article class="metric-card">
                        <span class="metric-label">Last interval</span>
                        <strong id="last-interval">--</strong>
                        <span class="metric-caption">milliseconds</span>
                    </article>
                    <article class="metric-card">
                        <span class="metric-label">Timing jitter</span>
                        <strong id="jitter">--</strong>
                        <span class="metric-caption">standard deviation</span>
                    </article>
                </div>

                <div class="tap-panel">
                    <div>
                        <div class="tap-title">Tap on every footstep</div>
                         <p>Use the global <span id="tap-binding-copy">Space</span> listener while the game is focused. It observes input and never blocks the key.</p>
                    </div>
                    <button id="tap" class="tap-button" type="button">
                        <span>TAP</span>
                        <kbd id="tap-shortcut">SPACE</kbd>
                    </button>
                </div>

                <div class="control-row">
                    <label class="select-control">
                        <span>Ghost speed modifier</span>
                        <select id="speed-modifier">
                            <option value="0.5">50%</option>
                            <option value="0.75">75%</option>
                            <option value="1" selected>100%</option>
                            <option value="1.25">125%</option>
                            <option value="1.5">150%</option>
                        </select>
                    </label>
                    <label class="toggle-control">
                        <input id="global-tap" type="checkbox" checked>
                        <span class="toggle-track"><span></span></span>
                        <span>Global taps</span>
                    </label>
                    <button id="reset" class="quiet-button" type="button">Reset session <kbd id="full-reset-shortcut">F12</kbd></button>
                </div>

                <div class="measurement-note">
                    <span class="note-mark">i</span>
                    <p>Speed is estimated from BPM using the community footstep model. Treat matches as a shortlist, not proof: line of sight, ghost abilities, missed taps, and patch changes can all affect the result.</p>
                </div>

                <section class="matches-panel">
                    <div class="section-heading compact">
                        <div>
                            <div class="kicker">FIRST PASS</div>
                            <h2>Speed shortlist</h2>
                        </div>
                        <div class="module-actions">
                            <span class="subtle" id="match-count">No measurement</span>
                            <button id="discard-speed-outliers" class="text-button" type="button" disabled>Discard outside speed</button>
                        </div>
                    </div>
                    <div id="speed-matches" class="speed-matches empty-state" aria-live="polite">Tap a few consistent footsteps to rank matching profiles.</div>
                    <div class="module-resize-handle" data-resize-module="stepTracker" role="separator" aria-orientation="both" aria-label="Resize footstep cadence module" tabindex="0"></div>
                </section>
            </section>

            <section id="module-topSuspects" class="suspects-column dashboard-module" data-module="topSuspects">
                <div class="section-heading module-heading-line" data-drag-module="topSuspects">
                    <div>
                        <div class="kicker">CURRENT KNOWLEDGE</div>
                        <h2>Most likely ghosts</h2>
                    </div>
                    <div class="module-actions">
                        <span class="subtle" id="suspect-count">Top 3</span>
                        <button class="module-pin" type="button" data-module-pin="topSuspects">Pin</button>
                    </div>
                </div>
                <div id="top-suspects" class="suspect-list empty-state">Tap footsteps to rank the current candidates.</div>
                <div class="module-resize-handle" data-resize-module="topSuspects" role="separator" aria-orientation="both" aria-label="Resize most likely ghosts module" tabindex="0"></div>
            </section>

            <section id="module-huntTimers" class="hunt-timers-column dashboard-module" data-module="huntTimers">
                <div class="section-heading module-heading-line" data-drag-module="huntTimers">
                    <div>
                        <div class="kicker">HUNT TIMING</div>
                        <h2>Hunt timers</h2>
                    </div>
                    <div class="module-actions">
                        <span class="confidence-pill" id="hunt-status">READY</span>
                        <button class="module-pin" type="button" data-module-pin="huntTimers">Pin</button>
                    </div>
                </div>

                <div class="hunt-timer-grid">
                    <article class="hunt-timer-card hunt-timer-primary">
                        <span class="metric-label">Current hunt</span>
                        <strong id="hunt-current">--:--.-</strong>
                        <span class="metric-caption">start on hunt audio, end when it stops</span>
                    </article>
                    <article class="hunt-timer-card">
                        <span class="metric-label">Post-hunt cooldown</span>
                        <strong id="hunt-cooldown">--:--.-</strong>
                        <span class="metric-caption" id="hunt-cooldown-hint">End a hunt, then start the next one to measure it</span>
                    </article>
                    <article class="hunt-timer-card">
                        <span class="metric-label">Last hunt</span>
                        <strong id="hunt-last">--:--.-</strong>
                        <span class="metric-caption">duration record</span>
                    </article>
                </div>

                <div class="hunt-control-row">
                    <button id="start-hunt" class="timer-button timer-button-primary" type="button">Start hunt <kbd id="start-hunt-shortcut">F10</kbd></button>
                    <button id="end-hunt" class="timer-button" type="button">End hunt <kbd id="end-hunt-shortcut">F11</kbd></button>
                    <button id="reset-hunt-timers" class="text-button" type="button">Reset timing</button>
                </div>

                <div class="hunt-test-row">
                    <label class="timer-select-control">
                        <span>Ghost test preset</span>
                        <select id="hunt-test-preset">
                            ${huntTimerPresets.map((preset) => `<option value="${preset.id}">${preset.label} - ${preset.note}</option>`).join('')}
                        </select>
                    </label>
                    <button id="start-test-timer" class="timer-button" type="button">Start preset</button>
                    <button id="stop-test-timer" class="text-button" type="button" disabled>Stop preset</button>
                    <div class="hunt-test-readout">
                        <span id="hunt-test-label">No preset running</span>
                        <strong id="hunt-test">--:--.-</strong>
                    </div>
                </div>

                <div class="hunt-history" id="hunt-history"><span class="empty-state">No hunt timings recorded this session.</span></div>
                <div class="hunt-timing-note">Natural hunts only: cursed hunts, custom settings, map size, and ghost abilities can change these timings.</div>
                <div class="module-resize-handle" data-resize-module="huntTimers" role="separator" aria-orientation="both" aria-label="Resize hunt timers module" tabindex="0"></div>
            </section>
        </main>

        <main id="overlay-view" class="overlay-view" hidden>
            <div id="overlay-stage" class="overlay-stage"></div>
        </main>

        <main id="settings-view" class="settings-view" hidden>
            <section class="settings-intro">
                <div class="kicker">APPLICATION SETTINGS</div>
                <h2>Keybinds</h2>
                <p>Click a binding, then press the key or key combination you want to use. Changes are saved immediately to your user configuration.</p>
            </section>

            <section class="settings-panel">
                <div class="settings-panel-heading">
                    <div>
                        <div class="kicker">GLOBAL INPUT</div>
                        <h3>Investigation controls</h3>
                    </div>
                    <span class="subtle">Windows input monitor</span>
                </div>
                <div class="keybind-list">
                    <div class="keybind-row" data-keybind-row="tap">
                        <div><strong>Footstep tap</strong><span>Records one timestamp for BPM measurement.</span></div>
                        <button class="keybind-button" type="button" data-keybind-action="tap">SPACE</button>
                    </div>
                     <div class="keybind-row" data-keybind-row="reset">
                         <div><strong>Reset tracker and timers</strong><span>Clears the current tap sequence and hunt timers.</span></div>
                         <button class="keybind-button" type="button" data-keybind-action="reset">F7</button>
                     </div>
                     <div class="keybind-row" data-keybind-row="fullReset">
                         <div><strong>Full session reset</strong><span>Clears taps, hunt timers, evidence, and discarded ghosts.</span></div>
                         <button class="keybind-button" type="button" data-keybind-action="fullReset">F12</button>
                     </div>
                     <div class="keybind-row" data-keybind-row="startHunt">
                         <div><strong>Start hunt timer</strong><span>Starts the hunt stopwatch and closes the previous cooldown measurement.</span></div>
                         <button class="keybind-button" type="button" data-keybind-action="startHunt">F10</button>
                     </div>
                     <div class="keybind-row" data-keybind-row="endHunt">
                         <div><strong>End hunt timer</strong><span>Records hunt duration and starts the post-hunt cooldown timer.</span></div>
                         <button class="keybind-button" type="button" data-keybind-action="endHunt">F11</button>
                     </div>
                     <div class="keybind-row" data-keybind-row="toggleOverlay">
                        <div><strong>Toggle pinned overlay</strong><span>Shows or hides the pinned floating modules over the game.</span></div>
                        <button class="keybind-button" type="button" data-keybind-action="toggleOverlay">F8</button>
                    </div>
                    <div class="keybind-row" data-keybind-row="openSettings">
                        <div><strong>Open settings</strong><span>Returns to the floating modules.</span></div>
                        <button class="keybind-button" type="button" data-keybind-action="openSettings">F9</button>
                    </div>
                </div>
                <div class="capture-status" id="capture-status" role="status" aria-live="polite">Bindings are unique and support modifiers such as Ctrl + Shift + O.</div>
                <button id="restore-keybinds" class="quiet-button settings-reset" type="button">Restore defaults</button>
                <button id="restore-layout" class="quiet-button settings-reset" type="button">Reset module layout</button>
            </section>

            <section class="settings-note">
                <span class="note-mark">i</span>
                <p>The global listener observes key state and does not block or inject keyboard input. Disable Global taps on the field page if you want all global actions paused temporarily.</p>
            </section>
        </main>

        <footer class="footer-bar">
            <span>MANUAL ASSISTANCE ONLY</span>
            <span id="catalog-source">Catalog loading</span>
        </footer>
    </div>
`;

const elements = {
    bpm: document.querySelector('#bpm'),
    baseSpeed: document.querySelector('#base-speed'),
    actualSpeed: document.querySelector('#actual-speed'),
    lastInterval: document.querySelector('#last-interval'),
    jitter: document.querySelector('#jitter'),
    confidence: document.querySelector('#confidence'),
    matchCount: document.querySelector('#match-count'),
    speedMatches: document.querySelector('#speed-matches'),
    ghostSearch: document.querySelector('#ghost-search'),
    ghostResults: document.querySelector('#ghost-results'),
    catalogCount: document.querySelector('#catalog-count'),
    catalogSource: document.querySelector('#catalog-source'),
    globalTap: document.querySelector('#global-tap'),
    inputStatus: document.querySelector('#input-status'),
    speedModifier: document.querySelector('#speed-modifier'),
    tapShortcut: document.querySelector('#tap-shortcut'),
    fullResetShortcut: document.querySelector('#full-reset-shortcut'),
    fieldView: document.querySelector('#field-view'),
    settingsView: document.querySelector('#settings-view'),
    settingsToggle: document.querySelector('#settings-toggle'),
    overlayToggle: document.querySelector('#overlay-toggle'),
    windowMinimize: document.querySelector('#window-minimize'),
    windowClose: document.querySelector('#window-close'),
    overlayView: document.querySelector('#overlay-view'),
    overlayStage: document.querySelector('#overlay-stage'),
    captureStatus: document.querySelector('#capture-status'),
    discardSpeedOutliers: document.querySelector('#discard-speed-outliers'),
    clearDiscarded: document.querySelector('#clear-discarded'),
    suspectCount: document.querySelector('#suspect-count'),
    topSuspects: document.querySelector('#top-suspects'),
    evidenceCount: document.querySelector('#evidence-count'),
    evidenceOptions: document.querySelector('#evidence-options'),
    clearEvidence: document.querySelector('#clear-evidence'),
    huntStatus: document.querySelector('#hunt-status'),
    huntCurrent: document.querySelector('#hunt-current'),
    huntCooldown: document.querySelector('#hunt-cooldown'),
    huntCooldownHint: document.querySelector('#hunt-cooldown-hint'),
    huntLast: document.querySelector('#hunt-last'),
    startHunt: document.querySelector('#start-hunt'),
    endHunt: document.querySelector('#end-hunt'),
    resetHuntTimers: document.querySelector('#reset-hunt-timers'),
    huntTestPreset: document.querySelector('#hunt-test-preset'),
    startTestTimer: document.querySelector('#start-test-timer'),
    stopTestTimer: document.querySelector('#stop-test-timer'),
    huntTestLabel: document.querySelector('#hunt-test-label'),
    huntTest: document.querySelector('#hunt-test'),
    huntHistory: document.querySelector('#hunt-history'),
    startHuntShortcut: document.querySelector('#start-hunt-shortcut'),
    endHuntShortcut: document.querySelector('#end-hunt-shortcut'),
    tapBindingCopy: document.querySelector('#tap-binding-copy'),
};

function emptyTrackerState() {
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

function emptyHuntTimerState() {
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

function number(value, digits = 1) {
    return Number.isFinite(value) && value > 0 ? value.toFixed(digits) : '--';
}

function timerDuration(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
        return '--:--.-';
    }
    const tenths = Math.round(milliseconds / 100);
    const minutes = Math.floor(tenths / 600);
    const seconds = Math.floor(tenths / 10) % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths % 10}`;
}

function cooldownAssessment(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
        return 'End a hunt, then start the next one to measure it';
    }
    if (milliseconds < 20_000) {
        return 'Below the Demon floor; check for a cursed hunt or bad start/stop timing';
    }
    if (milliseconds < 25_000) {
        return '20-25 seconds: Demon-compatible natural cooldown window';
    }
    return '25+ seconds: standard-compatible cooldown';
}

function startHuntTimer(source = 'manual') {
    const now = performance.now();
    if (huntTimerState.active) {
        return;
    }
    if (huntTimerState.cooldownStartedAt > 0) {
        huntTimerState.cooldownElapsedMs = now - huntTimerState.cooldownStartedAt;
        huntTimerState.lastCooldownMs = huntTimerState.cooldownElapsedMs;
        huntTimerState.cooldownStartedAt = 0;
        if (huntTimerState.history[0] && huntTimerState.history[0].cooldownMs === 0) {
            huntTimerState.history[0].cooldownMs = huntTimerState.lastCooldownMs;
        }
    }
    huntTimerState.active = true;
    huntTimerState.huntStartedAt = now;
    huntTimerState.huntElapsedMs = 0;
    elements.inputStatus.textContent = source === 'hotkey' ? 'Hunt timer started from F10' : 'Hunt timer started';
    renderHuntTimers(now);
}

function endHuntTimer(source = 'manual') {
    if (!huntTimerState.active) {
        return;
    }
    const now = performance.now();
    huntTimerState.huntElapsedMs = now - huntTimerState.huntStartedAt;
    huntTimerState.lastDurationMs = huntTimerState.huntElapsedMs;
    huntTimerState.active = false;
    huntTimerState.cooldownStartedAt = now;
    huntTimerState.cooldownElapsedMs = 0;
    huntTimerState.history.unshift({
        id: huntTimerState.nextHuntID,
        durationMs: huntTimerState.lastDurationMs,
        cooldownMs: 0,
    });
    huntTimerState.nextHuntID += 1;
    huntTimerState.history = huntTimerState.history.slice(0, 5);
    elements.inputStatus.textContent = source === 'hotkey' ? 'Hunt ended from F11; cooldown running' : 'Hunt ended; cooldown running';
    renderHuntTimers(now);
}

function resetHuntTimers() {
    huntTimerState = emptyHuntTimerState();
    renderHuntTimers();
}

function resetSession(snapshot) {
    if (snapshot) {
        trackerState = snapshot;
    }
    resetHuntTimers();
    selectedEvidence.clear();
    discardedGhosts.clear();
    lastMatches = [];
    rankedGhosts = [];
    renderEvidence();
    renderTracker();
    renderCandidateState();
}

function startPresetTimer() {
    const preset = huntTimerPresets.find((item) => item.id === elements.huntTestPreset.value);
    if (!preset) {
        return;
    }
    huntTimerState.testActive = true;
    huntTimerState.testStartedAt = performance.now();
    huntTimerState.testDurationMs = preset.durationMs;
    huntTimerState.testRemainingMs = preset.durationMs;
    huntTimerState.testLabel = preset.label;
    huntTimerState.testNote = preset.note;
    elements.inputStatus.textContent = `${preset.label} started`;
    renderHuntTimers();
}

function stopPresetTimer() {
    if (!huntTimerState.testActive) {
        return;
    }
    huntTimerState.testActive = false;
    huntTimerState.testDurationMs = 0;
    huntTimerState.testRemainingMs = 0;
    huntTimerState.testStartedAt = 0;
    elements.inputStatus.textContent = 'Preset timer stopped';
    renderHuntTimers();
}

function renderHuntTimers(now = performance.now()) {
    const currentHuntMs = huntTimerState.active
        ? now - huntTimerState.huntStartedAt
        : huntTimerState.huntElapsedMs;
    const currentCooldownMs = huntTimerState.cooldownStartedAt > 0
        ? now - huntTimerState.cooldownStartedAt
        : huntTimerState.cooldownElapsedMs;
    let testRemainingMs = 0;
    if (huntTimerState.testActive) {
        testRemainingMs = Math.max(0, huntTimerState.testDurationMs - (now - huntTimerState.testStartedAt));
        huntTimerState.testRemainingMs = testRemainingMs;
        if (testRemainingMs === 0) {
            huntTimerState.testActive = false;
            elements.inputStatus.textContent = `${huntTimerState.testLabel} complete`;
        }
    }

    elements.huntStatus.textContent = huntTimerState.active ? 'HUNT ACTIVE' : huntTimerState.cooldownStartedAt > 0 ? 'COOLDOWN' : 'READY';
    elements.huntStatus.dataset.level = huntTimerState.active ? 'high' : huntTimerState.cooldownStartedAt > 0 ? 'medium' : 'low';
    elements.huntCurrent.textContent = huntTimerState.active || huntTimerState.huntElapsedMs > 0 ? timerDuration(currentHuntMs) : '--:--.-';
    elements.huntCooldown.textContent = huntTimerState.cooldownStartedAt > 0 || huntTimerState.lastCooldownMs > 0 ? timerDuration(currentCooldownMs) : '--:--.-';
    elements.huntCooldownHint.textContent = huntTimerState.cooldownStartedAt > 0
        ? 'Waiting for the next natural hunt start'
        : cooldownAssessment(huntTimerState.lastCooldownMs);
    elements.huntLast.textContent = huntTimerState.lastDurationMs > 0 ? timerDuration(huntTimerState.lastDurationMs) : '--:--.-';
    elements.startHunt.disabled = huntTimerState.active;
    elements.endHunt.disabled = !huntTimerState.active;
    elements.stopTestTimer.disabled = !huntTimerState.testActive;
    elements.huntTestLabel.textContent = huntTimerState.testActive
        ? `${huntTimerState.testLabel} - ${huntTimerState.testNote}`
        : 'No preset running';
    elements.huntTest.textContent = huntTimerState.testActive
        ? timerDuration(testRemainingMs)
        : '--:--.-';
    elements.huntHistory.innerHTML = huntTimerState.history.length === 0
        ? '<span class="empty-state">No hunt timings recorded this session.</span>'
        : huntTimerState.history.map((entry) => `
            <div class="hunt-history-row">
                <span>Hunt ${entry.id}</span>
                <strong>${timerDuration(entry.durationMs)}</strong>
                <em>${entry.cooldownMs > 0 ? `cooldown ${timerDuration(entry.cooldownMs)}` : 'cooldown pending'}</em>
            </div>
        `).join('');
    renderOverlay();
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function matchesEvidence(ghost) {
    return [...selectedEvidence].every((evidence) => ghost.evidence?.includes(evidence));
}

function renderEvidence() {
    elements.evidenceCount.textContent = selectedEvidence.size === 0
        ? 'None selected'
        : `${selectedEvidence.size} selected`;
    elements.clearEvidence.hidden = selectedEvidence.size === 0;
    for (const button of elements.evidenceOptions.querySelectorAll('[data-evidence]')) {
        const selected = selectedEvidence.has(button.dataset.evidence);
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', String(selected));
    }
}

function toggleEvidence(evidence) {
    if (selectedEvidence.has(evidence)) {
        selectedEvidence.delete(evidence);
    } else {
        selectedEvidence.add(evidence);
    }
    renderEvidence();
    renderCandidateState();
}

function renderTracker() {
    elements.bpm.textContent = number(trackerState.bpm);
    elements.baseSpeed.textContent = trackerState.ready ? `${number(trackerState.baseSpeedMPS, 2)}` : '--';
    elements.actualSpeed.textContent = trackerState.ready ? `actual: ${number(trackerState.actualSpeedMPS, 2)} m/s` : 'actual: -- m/s';
    elements.lastInterval.textContent = trackerState.ready ? `${number(trackerState.lastIntervalMS)} ms` : '--';
    elements.jitter.textContent = trackerState.ready ? `${number(trackerState.jitterMS)} ms` : '--';
    elements.confidence.textContent = trackerState.ready ? trackerState.confidence.toUpperCase() : 'WAITING';
    elements.confidence.dataset.level = trackerState.confidence;
}

function renderMatches(matches) {
    lastMatches = matches || [];
    if (!trackerState.ready) {
        elements.matchCount.textContent = 'No measurement';
        elements.discardSpeedOutliers.disabled = true;
        elements.speedMatches.className = 'speed-matches empty-state';
        elements.speedMatches.textContent = 'Tap a few consistent footsteps to rank matching profiles.';
        renderOverlay();
        return;
    }

    const visibleMatches = lastMatches.filter((match) => !discardedGhosts.has(match.ghost.id) && matchesEvidence(match.ghost));
    elements.matchCount.textContent = `${visibleMatches.length} possible`;
    elements.discardSpeedOutliers.disabled = lastMatches.length === 0;
    if (visibleMatches.length === 0) {
        elements.speedMatches.className = 'speed-matches empty-state';
        elements.speedMatches.textContent = lastMatches.length === 0
            ? 'No profile is inside the current tolerance. Check the modifier or retap the sequence.'
            : selectedEvidence.size > 0
                ? 'No speed matches support the selected evidence.'
            : 'All speed matches are currently discarded. Restore them from the ghost reference module.';
        renderOverlay();
        return;
    }

    elements.speedMatches.className = 'speed-matches';
    elements.speedMatches.innerHTML = visibleMatches.slice(0, 8).map((match) => `
        <div class="match-row">
            <div>
                <strong>${escapeHtml(match.ghost.name)}</strong>
                <span>${match.matchingProfiles.map((profile) => escapeHtml(profile.label)).join(' / ')}</span>
            </div>
            <em>${match.matchingProfiles.map((profile) => `${Number(profile.baseMPS).toFixed(2)} m/s`).join(' / ')}</em>
        </div>
    `).join('');
    renderOverlay();
}

function renderTopSuspects(matches) {
    rankedGhosts = matches || [];
    const visibleSuspects = rankedGhosts.filter((match) => !discardedGhosts.has(match.ghost.id) && matchesEvidence(match.ghost)).slice(0, 3);
    elements.suspectCount.textContent = trackerState.ready ? `${visibleSuspects.length} candidates` : 'Top 3';
    if (!trackerState.ready || visibleSuspects.length === 0) {
        elements.topSuspects.className = 'suspect-list empty-state';
        elements.topSuspects.textContent = !trackerState.ready
            ? 'Tap footsteps to rank the current candidates.'
            : selectedEvidence.size > 0 && rankedGhosts.some((match) => !discardedGhosts.has(match.ghost.id))
                ? 'No ranked candidates support the selected evidence.'
            : 'All ranked candidates are discarded. Restore them to continue.';
        renderOverlay();
        return;
    }

    elements.topSuspects.className = 'suspect-list';
    elements.topSuspects.innerHTML = visibleSuspects.map((match, index) => `
        <div class="suspect-row">
            <span class="suspect-rank">0${index + 1}</span>
            <div>
                <strong>${escapeHtml(match.ghost.name)}</strong>
                <span>${match.matchingProfiles.map((profile) => escapeHtml(profile.label)).join(' / ')}</span>
            </div>
            <em>+/- ${Number(match.closestDistance).toFixed(2)} m/s</em>
        </div>
    `).join('');
    renderOverlay();
}

function renderGhosts(ghostList) {
    lastGhostResults = ghostList || [];
    const matchingGhosts = lastGhostResults.filter((ghost) => matchesEvidence(ghost));
    const activeGhosts = matchingGhosts.filter((ghost) => !discardedGhosts.has(ghost.id));
    const discardedMatches = matchingGhosts.filter((ghost) => discardedGhosts.has(ghost.id));
    const orderedGhosts = [...activeGhosts, ...discardedMatches];
    elements.clearDiscarded.hidden = discardedGhosts.size === 0;
    if (orderedGhosts.length === 0) {
        elements.ghostResults.innerHTML = lastGhostResults.length === 0
            ? '<div class="empty-state">No ghosts matched that search.</div>'
            : '<div class="empty-state">No ghosts match the selected evidence.</div>';
        renderOverlay();
        return;
    }

    elements.ghostResults.innerHTML = orderedGhosts.map((ghost) => {
        const discarded = discardedGhosts.has(ghost.id);
        return `
        <article class="ghost-card${discarded ? ' is-discarded' : ''}">
            <div class="ghost-card-heading">
                <div>
                    <h3>${escapeHtml(ghost.name)}</h3>
                    ${ghost.aliases?.length ? `<span class="alias">also: ${ghost.aliases.map(escapeHtml).join(', ')}</span>` : ''}
                </div>
                <div class="ghost-card-actions">
                    ${discarded ? '<span class="ghost-status">DISCARDED</span>' : ''}
                    <span class="ghost-id">${escapeHtml(ghost.id)}</span>
                    <button class="ghost-discard" type="button" data-discard-ghost="${escapeHtml(ghost.id)}" aria-pressed="${discarded}" aria-label="${discarded ? 'Restore' : 'Discard'} ${escapeHtml(ghost.name)}">${discarded ? 'Restore' : 'Discard'}</button>
                </div>
            </div>
            <div class="profile-list">
                ${ghost.speedProfiles.map((profile) => `
                    <div class="profile-row">
                        <span>${escapeHtml(profile.label)}</span>
                        <strong>${Number(profile.baseMPS).toFixed(2)} m/s</strong>
                        <small>${escapeHtml(profile.condition)}</small>
                    </div>
                `).join('')}
            </div>
            <ul class="tell-list">
                ${ghost.tells.map((tell) => `<li>${escapeHtml(tell)}</li>`).join('')}
            </ul>
        </article>
    `;
    }).join('');
    renderOverlay();
}

function layoutFor(moduleID) {
    return layoutState.modules?.[moduleID] || { x: 24, y: 24, width: 520, height: 620, pinned: false };
}

function renderDashboardLayout() {
    const freeformDashboard = window.innerWidth > 980;
    document.body.classList.toggle('freeform-dashboard', freeformDashboard);
    let hasPinnedModule = false;
    for (const moduleID of ['stepTracker', 'ghostSearch', 'topSuspects', 'evidence', 'huntTimers']) {
        const module = layoutFor(moduleID);
        hasPinnedModule ||= module.pinned;
        const element = document.querySelector(`[data-module="${moduleID}"]`);
        if (element) {
            if (freeformDashboard) {
                element.style.left = `${module.x}px`;
                element.style.top = `${module.y}px`;
                element.style.width = `${module.width}px`;
                element.style.height = `${module.height}px`;
            } else {
                element.style.removeProperty('left');
                element.style.removeProperty('top');
                element.style.removeProperty('width');
                element.style.removeProperty('height');
                element.style.removeProperty('transform');
            }
        }
        const pinButton = document.querySelector(`[data-module-pin="${moduleID}"]`);
        if (pinButton) {
            pinButton.textContent = module.pinned ? 'Pinned' : 'Pin';
            pinButton.classList.toggle('is-pinned', module.pinned);
            pinButton.setAttribute('aria-pressed', String(module.pinned));
            pinButton.title = module.pinned ? 'Hide this module from the overlay' : 'Show this module in the overlay';
        }
    }
    elements.overlayToggle.disabled = !overlaySupportedState || (!hasPinnedModule && !overlayMode);
    elements.overlayToggle.title = !overlaySupportedState
        ? 'Pinned overlay is only available on Windows'
        : hasPinnedModule ? 'Show pinned modules over the game' : 'Pin at least one module first';
}

function overlayGeometry(module) {
    const viewportWidth = Math.max(1, window.innerWidth - 16);
    const viewportHeight = Math.max(1, window.innerHeight - 16);
    const width = Math.min(module.width, viewportWidth);
    const height = Math.min(module.height, viewportHeight);
    return {
        x: Math.min(Math.max(0, module.x), Math.max(0, window.innerWidth - width)),
        y: Math.min(Math.max(0, module.y), Math.max(0, window.innerHeight - height)),
        width,
        height,
    };
}

function renderOverlay() {
    if (!overlayMode || !elements.overlayStage) {
        return;
    }
    const pinnedModules = Object.entries(layoutState.modules || {}).filter(([, module]) => module.pinned);
    elements.overlayStage.innerHTML = pinnedModules.map(([moduleID, module]) => {
        const geometry = overlayGeometry(module);
        const style = `left:${geometry.x}px;top:${geometry.y}px;width:${geometry.width}px;height:${geometry.height}px;`;
        if (moduleID === 'huntTimers') {
            const now = performance.now();
            const currentHuntMs = huntTimerState.active ? now - huntTimerState.huntStartedAt : huntTimerState.huntElapsedMs;
            const currentCooldownMs = huntTimerState.cooldownStartedAt > 0 ? now - huntTimerState.cooldownStartedAt : huntTimerState.cooldownElapsedMs;
            const testRemainingMs = huntTimerState.testActive ? Math.max(0, huntTimerState.testDurationMs - (now - huntTimerState.testStartedAt)) : 0;
            return `
                <article class="pinned-module pinned-hunt-module" style="${style}">
                    <header class="pinned-header"><span>HUNT TIMING</span><span>${huntTimerState.active ? 'HUNT ACTIVE' : 'PINNED'}</span></header>
                    <div class="pinned-hunt-grid">
                        <div><span class="pinned-primary-label">CURRENT HUNT</span><strong class="pinned-timer-value">${huntTimerState.active || huntTimerState.huntElapsedMs > 0 ? timerDuration(currentHuntMs) : '--:--.-'}</strong></div>
                        <div><span class="pinned-primary-label">COOLDOWN</span><strong class="pinned-timer-value">${huntTimerState.cooldownStartedAt > 0 || huntTimerState.lastCooldownMs > 0 ? timerDuration(currentCooldownMs) : '--:--.-'}</strong></div>
                    </div>
                    <div class="pinned-test-timer"><span>${escapeHtml(huntTimerState.testActive ? huntTimerState.testLabel : 'LAST HUNT')}</span><strong>${huntTimerState.testActive ? timerDuration(testRemainingMs) : huntTimerState.lastDurationMs > 0 ? timerDuration(huntTimerState.lastDurationMs) : '--:--.-'}</strong></div>
                    <div class="pinned-footer"><span>${huntTimerState.testActive ? escapeHtml(huntTimerState.testNote) : 'F10 START / F11 END'}</span><span>${huntTimerState.history.length} RECORDS</span></div>
                </article>
            `;
        }
        if (moduleID === 'evidence') {
            const selectedLabels = evidenceOptions
                .filter((evidence) => selectedEvidence.has(evidence.id))
                .map((evidence) => `<span class="pinned-evidence-chip">${evidence.label}</span>`)
                .join('');
            return `
                <article class="pinned-module pinned-evidence-module" style="${style}">
                    <header class="pinned-header"><span>EVIDENCE</span><span>PINNED</span></header>
                    <div class="pinned-evidence-list">${selectedLabels || '<span class="pinned-empty">No evidence selected</span>'}</div>
                    <div class="pinned-footer"><span>CURRENT KNOWLEDGE</span><span>${selectedEvidence.size} SELECTED</span></div>
                </article>
            `;
        }
        if (moduleID === 'topSuspects') {
            const visibleSuspects = rankedGhosts.filter((match) => !discardedGhosts.has(match.ghost.id) && matchesEvidence(match.ghost)).slice(0, 3);
            const suspectRows = visibleSuspects.map((match, index) => `
                <div class="pinned-suspect-row"><span class="pinned-suspect-rank">0${index + 1}</span><strong>${escapeHtml(match.ghost.name)}</strong><em>+/- ${Number(match.closestDistance).toFixed(2)} m/s</em></div>
            `).join('');
            return `
                <article class="pinned-module pinned-suspects-module" style="${style}">
                    <header class="pinned-header"><span>MOST LIKELY</span><span>PINNED</span></header>
                    <div class="pinned-suspect-list">${suspectRows || '<span class="pinned-empty">No ranked candidates</span>'}</div>
                    <div class="pinned-footer"><span>SPEED + DISCARDS</span><span>TOP 3</span></div>
                </article>
            `;
        }
        if (moduleID === 'stepTracker') {
            return `
                <article class="pinned-module" style="${style}">
                    <header class="pinned-header"><span>STEP TRACKER</span><span>PINNED</span></header>
                    <div class="pinned-primary-label">OBSERVED CADENCE</div>
                    <strong class="pinned-bpm">${number(trackerState.bpm)}</strong>
                    <div class="pinned-metrics">
                        <span>base <b>${number(trackerState.baseSpeedMPS, 2)} m/s</b></span>
                        <span>actual <b>${number(trackerState.actualSpeedMPS, 2)} m/s</b></span>
                        <span>jitter <b>${number(trackerState.jitterMS)} ms</b></span>
                    </div>
                    <div class="pinned-footer"><span>${trackerState.confidence.toUpperCase()} CONFIDENCE</span><span>${trackerState.tapCount} taps</span></div>
                </article>
            `;
        }
        const visibleGhosts = lastGhostResults.filter((ghost) => !discardedGhosts.has(ghost.id) && matchesEvidence(ghost));
        const ghostRows = visibleGhosts.slice(0, 4).map((ghost) => `
            <div class="pinned-ghost-row"><strong>${escapeHtml(ghost.name)}</strong><span>${ghost.speedProfiles.map((profile) => `${Number(profile.baseMPS).toFixed(2)} m/s`).join(' / ')}</span></div>
        `).join('');
        return `
            <article class="pinned-module pinned-ghost-module" style="${style}">
                <header class="pinned-header"><span>GHOST REFERENCE</span><span>PINNED</span></header>
                <div class="pinned-query">${escapeHtml(elements.ghostSearch.value.trim() || 'all ghosts')}</div>
                <div class="pinned-ghost-list">${ghostRows || '<span class="pinned-empty">No matching ghosts</span>'}</div>
                <div class="pinned-footer"><span>OPEN PANEL TO SEARCH</span><span>${visibleGhosts.length} results</span></div>
            </article>
        `;
    }).join('');
}

async function toggleModulePin(moduleID) {
    const current = layoutFor(moduleID);
    try {
        layoutState = await SetModuleLayout(moduleID, { ...current, pinned: !current.pinned });
        renderDashboardLayout();
        renderOverlay();
        elements.inputStatus.textContent = current.pinned ? `${moduleID} unpinned` : `${moduleID} pinned`;
    } catch (error) {
        elements.inputStatus.textContent = `Could not save module state: ${error}`;
    }
}

function renderCandidateState() {
    renderGhosts(lastGhostResults);
    renderMatches(lastMatches);
    renderTopSuspects(rankedGhosts);
}

function discardGhost(ghostID) {
    if (discardedGhosts.has(ghostID)) {
        discardedGhosts.delete(ghostID);
        elements.inputStatus.textContent = 'Restored ghost';
    } else {
        discardedGhosts.add(ghostID);
        elements.inputStatus.textContent = 'Discarded ghost';
    }
    renderCandidateState();
}

function discardSpeedOutliers() {
    if (!trackerState.ready || lastMatches.length === 0) {
        return;
    }
    const speedMatches = new Set(lastMatches.map((match) => match.ghost.id));
    for (const ghost of allGhosts) {
        if (!speedMatches.has(ghost.id)) {
            discardedGhosts.add(ghost.id);
        }
    }
    elements.inputStatus.textContent = `Discarded ghosts outside ${number(trackerState.baseSpeedMPS, 2)} m/s`;
    renderCandidateState();
}

function startModuleDrag(event) {
    if (overlayMode || window.innerWidth <= 980 || event.button !== 0 || event.target.closest('button, input, select')) {
        return;
    }
    const moduleID = event.currentTarget.dataset.dragModule;
    const current = layoutFor(moduleID);
    activeDrag = {
        moduleID,
        startX: event.clientX,
        startY: event.clientY,
        initialX: current.x,
        initialY: current.y,
        initialModule: { ...current },
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.currentTarget.classList.add('is-dragging');
}

function startModuleResize(event) {
    if (overlayMode || window.innerWidth <= 980 || event.button !== 0) {
        return;
    }
    const moduleID = event.currentTarget.dataset.resizeModule;
    const current = layoutFor(moduleID);
    activeResize = {
        moduleID,
        startX: event.clientX,
        startY: event.clientY,
        initialWidth: current.width,
        initialHeight: current.height,
        initialModule: { ...current },
    };
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
}

function moveModule(event) {
    if (activeResize) {
        const module = { ...layoutFor(activeResize.moduleID) };
        module.width = Math.max(280, Math.min(1200, Math.round(activeResize.initialWidth + event.clientX - activeResize.startX)));
        module.height = Math.max(100, Math.min(1400, Math.round(activeResize.initialHeight + event.clientY - activeResize.startY)));
        layoutState.modules[activeResize.moduleID] = module;
        const element = document.querySelector(`[data-module="${activeResize.moduleID}"]`);
        if (element) {
            element.style.width = `${module.width}px`;
            element.style.height = `${module.height}px`;
        }
        return;
    }
    if (!activeDrag) {
        return;
    }
    const module = layoutFor(activeDrag.moduleID);
    const nextModule = { ...module };
    nextModule.x = Math.max(0, Math.round(activeDrag.initialX + event.clientX - activeDrag.startX));
    nextModule.y = Math.max(0, Math.round(activeDrag.initialY + event.clientY - activeDrag.startY));
    layoutState.modules[activeDrag.moduleID] = nextModule;
    const element = document.querySelector(`[data-module="${activeDrag.moduleID}"]`);
    if (element) {
        element.style.left = `${nextModule.x}px`;
        element.style.top = `${nextModule.y}px`;
    }
}

async function endModuleDrag() {
    if (!activeDrag) {
        return;
    }
    const finished = activeDrag;
    activeDrag = null;
    document.querySelector(`[data-drag-module="${finished.moduleID}"]`)?.classList.remove('is-dragging');
    try {
        layoutState = await SetModuleLayout(finished.moduleID, layoutFor(finished.moduleID));
        renderDashboardLayout();
    } catch (error) {
        layoutState.modules[finished.moduleID] = finished.initialModule;
        renderDashboardLayout();
        elements.inputStatus.textContent = `Could not save module position: ${error}`;
    }
}

async function resizeModuleWithKeyboard(event) {
    if (window.innerWidth <= 980 || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        return;
    }
    event.preventDefault();
    const moduleID = event.currentTarget.dataset.resizeModule;
    const current = { ...layoutFor(moduleID) };
    const step = event.shiftKey ? 40 : 10;
    if (event.key === 'ArrowLeft') current.width -= step;
    if (event.key === 'ArrowRight') current.width += step;
    if (event.key === 'ArrowUp') current.height -= step;
    if (event.key === 'ArrowDown') current.height += step;
    current.width = Math.max(280, Math.min(1200, current.width));
    current.height = Math.max(100, Math.min(1400, current.height));
    try {
        layoutState = await SetModuleLayout(moduleID, current);
        renderDashboardLayout();
        elements.inputStatus.textContent = `${moduleID} size saved`;
    } catch (error) {
        elements.inputStatus.textContent = `Could not save module size: ${error}`;
    }
}

async function endModuleResize() {
    if (!activeResize) {
        return;
    }
    const finished = activeResize;
    activeResize = null;
    try {
        layoutState = await SetModuleLayout(finished.moduleID, layoutFor(finished.moduleID));
        renderDashboardLayout();
    } catch (error) {
        layoutState.modules[finished.moduleID] = finished.initialModule;
        renderDashboardLayout();
        elements.inputStatus.textContent = `Could not save module size: ${error}`;
    }
}

function applyOverlayMode(enabled) {
    overlayMode = enabled;
    document.body.classList.toggle('overlay-mode', enabled);
    elements.fieldView.hidden = enabled;
    elements.overlayView.hidden = !enabled || !overlayContentVisible;
    if (enabled) {
        elements.settingsView.hidden = true;
        elements.overlayToggle.textContent = 'Edit modules';
        elements.inputStatus.textContent = 'Pinned overlay active';
        renderOverlay();
    } else {
        overlayContentVisible = true;
        elements.overlayToggle.textContent = 'Show pinned overlay';
        elements.inputStatus.textContent = 'Dashboard mode';
        renderDashboardLayout();
    }
}

function applyOverlayVisibility(visible) {
    overlayContentVisible = visible;
    if (overlayMode) {
        elements.overlayView.hidden = !visible;
    }
}

function displayBinding(binding) {
    return binding.split('+').map((part) => {
        if (part === 'Ctrl') return 'CTRL';
        if (part === 'Shift') return 'SHIFT';
        if (part === 'Alt') return 'ALT';
        if (part === 'Win') return 'WIN';
        if (part.startsWith('Key')) return part.slice(3);
        if (part.startsWith('Digit')) return part.slice(5);
        return part.toUpperCase();
    }).join(' + ');
}

function renderKeybinds() {
    for (const [action, label] of Object.entries(keybindLabels)) {
        const button = document.querySelector(`[data-keybind-action="${action}"]`);
        if (button) {
            button.textContent = captureAction === action ? 'PRESS A KEY' : displayBinding(keybindState[action] || '');
            button.classList.toggle('is-capturing', captureAction === action);
            button.setAttribute('aria-label', `Set ${label} keybind`);
        }
    }
    if (elements.tapShortcut && keybindState.tap) {
        elements.tapShortcut.textContent = displayBinding(keybindState.tap);
    }
    if (elements.fullResetShortcut && keybindState.fullReset) {
        elements.fullResetShortcut.textContent = displayBinding(keybindState.fullReset);
    }
    if (elements.startHuntShortcut && keybindState.startHunt) {
        elements.startHuntShortcut.textContent = displayBinding(keybindState.startHunt);
    }
    if (elements.endHuntShortcut && keybindState.endHunt) {
        elements.endHuntShortcut.textContent = displayBinding(keybindState.endHunt);
    }
    if (elements.tapBindingCopy) {
        elements.tapBindingCopy.textContent = displayBinding(keybindState.tap || 'Space');
    }
}

function keybindFromEvent(event) {
    const modifiers = [];
    if (event.ctrlKey) modifiers.push('Ctrl');
    if (event.altKey) modifiers.push('Alt');
    if (event.shiftKey) modifiers.push('Shift');
    if (event.metaKey) modifiers.push('Win');

    const modifierCode = {
        ControlLeft: 'Ctrl',
        ControlRight: 'Ctrl',
        AltLeft: 'Alt',
        AltRight: 'Alt',
        ShiftLeft: 'Shift',
        ShiftRight: 'Shift',
        MetaLeft: 'Win',
        MetaRight: 'Win',
    };
    if (modifierCode[event.code]) {
        return null;
    }
    return [...modifiers, event.code].join('+');
}

async function beginKeybindCapture(action) {
    captureAction = action;
    elements.captureStatus.textContent = `Press a key for ${keybindLabels[action]}. Press Escape to cancel.`;
    renderKeybinds();
    try {
        await SetGlobalTapEnabled(false);
    } catch (error) {
        captureAction = null;
        elements.captureStatus.textContent = `Could not pause global input: ${error}`;
        renderKeybinds();
    }
}

async function setSettingsOpen(open) {
    const alreadyOpen = !elements.settingsView.hidden;
    if (alreadyOpen === open) {
        return;
    }
    if (open) {
        if (overlayMode) {
            const dashboardMode = await SetOverlayMode(false);
            applyOverlayMode(dashboardMode);
        }
        settingsInputRestore = elements.globalTap.checked;
        if (settingsInputRestore) {
            await SetGlobalTapEnabled(false);
        }
        keybindState = await GetKeybindSettings();
        elements.fieldView.hidden = true;
        elements.settingsView.hidden = false;
        elements.settingsToggle.textContent = 'Field view';
        elements.inputStatus.textContent = 'Global input paused for settings';
        elements.captureStatus.textContent = 'Bindings are unique and support modifiers such as Ctrl + Shift + O.';
        renderKeybinds();
        return;
    }

    captureAction = null;
    elements.fieldView.hidden = false;
    elements.settingsView.hidden = true;
    elements.settingsToggle.textContent = 'Settings';
    if (settingsInputRestore) {
        await SetGlobalTapEnabled(true);
        elements.inputStatus.textContent = `Global ${displayBinding(keybindState.tap || 'Space')} active`;
    } else {
        elements.inputStatus.textContent = `Global ${displayBinding(keybindState.tap || 'Space')} paused`;
    }
    settingsInputRestore = null;
    renderKeybinds();
}

async function refreshTracker() {
    const sequence = ++trackerRefreshSequence;
    try {
        const view = await TrackerView();
        if (sequence === trackerRefreshSequence) {
            applyTrackerView(view);
        }
    } catch (error) {
        elements.inputStatus.textContent = `Tracker refresh failed: ${error}`;
    }
}

function applyTrackerView(view) {
    if (!view?.snapshot) {
        return;
    }
    trackerState = view.snapshot;
    renderTracker();
    renderMatches(view.matches || []);
    renderTopSuspects(view.ranked || []);
}

async function searchGhosts(query = '') {
    const sequence = ++searchSequence;
    currentGhostQuery = query;
    elements.ghostResults.setAttribute('aria-busy', 'true');
    try {
        const results = await SearchGhosts(query);
        if (sequence === searchSequence) {
            renderGhosts(results);
            elements.ghostResults.setAttribute('aria-busy', 'false');
        }
    } catch (error) {
        if (sequence === searchSequence) {
            elements.ghostResults.innerHTML = '<div class="empty-state">Ghost catalog unavailable. Try again after restarting the helper.</div>';
            elements.ghostResults.setAttribute('aria-busy', 'false');
            elements.inputStatus.textContent = `Ghost search failed: ${error}`;
        }
    }
}

document.querySelector('#tap').addEventListener('click', async () => {
    try {
        applyTrackerView(await TapAndGetTrackerView());
    } catch (error) {
        elements.inputStatus.textContent = `Tap failed: ${error}`;
    }
});

document.querySelector('#reset').addEventListener('click', async () => {
    try {
        resetSession(await ResetTracker());
    } catch (error) {
        elements.inputStatus.textContent = `Could not reset session: ${error}`;
    }
});

elements.discardSpeedOutliers.addEventListener('click', discardSpeedOutliers);
elements.clearDiscarded.addEventListener('click', () => {
    discardedGhosts.clear();
    elements.inputStatus.textContent = 'Restored discarded ghosts';
    renderCandidateState();
});

elements.evidenceOptions.addEventListener('click', (event) => {
    const button = event.target.closest('[data-evidence]');
    if (button) {
        toggleEvidence(button.dataset.evidence);
    }
});

elements.clearEvidence.addEventListener('click', () => {
    selectedEvidence.clear();
    renderEvidence();
    renderCandidateState();
});

elements.startHunt.addEventListener('click', () => startHuntTimer());
elements.endHunt.addEventListener('click', () => endHuntTimer());
elements.resetHuntTimers.addEventListener('click', resetHuntTimers);
elements.startTestTimer.addEventListener('click', startPresetTimer);
elements.stopTestTimer.addEventListener('click', stopPresetTimer);

elements.ghostResults.addEventListener('click', (event) => {
    const button = event.target.closest('[data-discard-ghost]');
    if (button) {
        discardGhost(button.dataset.discardGhost);
    }
});

elements.overlayToggle.addEventListener('click', async () => {
    try {
        if (!overlayMode && !elements.settingsView.hidden) {
            await setSettingsOpen(false);
        }
        const enabled = await SetOverlayMode(!overlayMode);
        applyOverlayMode(enabled);
    } catch (error) {
        elements.inputStatus.textContent = `Could not change overlay mode: ${error}`;
    }
});

elements.windowMinimize.addEventListener('click', () => WindowMinimise());
elements.windowClose.addEventListener('click', () => Quit());

elements.settingsToggle.addEventListener('click', () => {
    setSettingsOpen(elements.settingsView.hidden).catch((error) => {
        console.error('settings view failed', error);
    });
});

for (const button of document.querySelectorAll('[data-keybind-action]')) {
    button.addEventListener('click', () => {
        beginKeybindCapture(button.dataset.keybindAction).catch((error) => {
            console.error('keybind capture failed', error);
        });
    });
}

document.querySelector('#restore-keybinds').addEventListener('click', async () => {
    try {
        captureAction = null;
        keybindState = await ResetKeybinds();
        elements.captureStatus.textContent = 'Default keybinds restored and saved.';
        renderKeybinds();
    } catch (error) {
        elements.captureStatus.textContent = `Could not restore defaults: ${error}`;
    }
});

document.querySelector('#restore-layout').addEventListener('click', async () => {
    try {
        layoutState = await ResetOverlayLayout();
        elements.captureStatus.textContent = 'Module positions and pins reset.';
        renderDashboardLayout();
        renderOverlay();
    } catch (error) {
        elements.captureStatus.textContent = `Could not reset module layout: ${error}`;
    }
});

for (const button of document.querySelectorAll('[data-module-pin]')) {
    button.addEventListener('click', () => toggleModulePin(button.dataset.modulePin));
}

for (const handle of document.querySelectorAll('[data-drag-module]')) {
    handle.addEventListener('pointerdown', startModuleDrag);
}
for (const handle of document.querySelectorAll('[data-resize-module]')) {
    handle.addEventListener('pointerdown', startModuleResize);
    handle.addEventListener('keydown', resizeModuleWithKeyboard);
}
window.addEventListener('pointermove', moveModule);
window.addEventListener('pointerup', endModuleDrag);
window.addEventListener('pointerup', endModuleResize);
window.addEventListener('pointercancel', endModuleDrag);
window.addEventListener('pointercancel', endModuleResize);
window.addEventListener('resize', () => {
    renderDashboardLayout();
    renderOverlay();
});

document.addEventListener('keydown', async (event) => {
    if (!captureAction || elements.settingsView.hidden || event.repeat) {
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.code === 'Escape') {
        captureAction = null;
        elements.captureStatus.textContent = 'Capture cancelled.';
        renderKeybinds();
        return;
    }

    const binding = keybindFromEvent(event);
    if (!binding) {
        elements.captureStatus.textContent = 'Use one primary key, optionally with Ctrl, Alt, Shift, or Win.';
        return;
    }
    try {
        keybindState = await SetKeybind(captureAction, binding);
        elements.captureStatus.textContent = `${keybindLabels[captureAction]} saved as ${displayBinding(keybindState[captureAction])}.`;
        captureAction = null;
        renderKeybinds();
    } catch (error) {
        elements.captureStatus.textContent = `Could not save binding: ${error}`;
    }
});

elements.speedModifier.addEventListener('change', async (event) => {
    try {
        applyTrackerView(await SetSpeedModifierAndGetTrackerView(Number(event.target.value)));
    } catch (error) {
        elements.inputStatus.textContent = `Could not update speed modifier: ${error}`;
    }
});

elements.globalTap.addEventListener('change', async (event) => {
    const requested = event.target.checked;
    try {
        const enabled = await SetGlobalTapEnabled(requested);
        event.target.checked = enabled;
        elements.inputStatus.textContent = enabled
            ? `Global ${displayBinding(keybindState.tap || 'Space')} active`
            : `Global ${displayBinding(keybindState.tap || 'Space')} paused`;
    } catch (error) {
        event.target.checked = !requested;
        elements.inputStatus.textContent = `Could not change global input: ${error}`;
    }
});

elements.ghostSearch.addEventListener('input', (event) => {
    searchGhosts(event.target.value.trim());
});

elements.ghostSearch.addEventListener('focus', async () => {
    searchFocusRestore = elements.globalTap.checked;
    if (!searchFocusRestore) {
        return;
    }
    try {
        await SetGlobalTapEnabled(false);
        elements.inputStatus.textContent = `Global ${displayBinding(keybindState.tap || 'Space')} paused for search`;
    } catch (error) {
        elements.inputStatus.textContent = `Could not pause global input: ${error}`;
    }
});

elements.ghostSearch.addEventListener('blur', async () => {
    if (searchFocusRestore) {
        try {
            await SetGlobalTapEnabled(true);
            elements.inputStatus.textContent = `Global ${displayBinding(keybindState.tap || 'Space')} active`;
        } catch (error) {
            elements.inputStatus.textContent = `Could not resume global input: ${error}`;
        }
    }
});

window.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        elements.ghostSearch.focus();
    }
});

async function initialize() {
    const failures = [];
    try {
        keybindState = await GetKeybindSettings();
    } catch (error) {
        failures.push('keybinds');
        keybindState = {
            tap: 'Space',
            reset: 'F7',
            fullReset: 'F12',
            toggleOverlay: 'F8',
            openSettings: 'F9',
            startHunt: 'F10',
            endHunt: 'F11',
        };
        elements.captureStatus.textContent = `Keybind settings unavailable: ${error}`;
    }
    renderKeybinds();

    try {
        layoutState = await GetOverlayLayout();
    } catch (error) {
        failures.push('layout');
        layoutState = { modules: {} };
        elements.inputStatus.textContent = `Saved layout unavailable: ${error}`;
    }
    renderDashboardLayout();
    renderEvidence();

    try {
        const info = await GhostCatalogInfo();
        elements.catalogCount.textContent = `${info.count} entries`;
        elements.catalogSource.textContent = `Catalog ${info.version}`;
    } catch (error) {
        failures.push('catalog info');
        elements.catalogCount.textContent = 'Unavailable';
        elements.catalogSource.textContent = 'Catalog unavailable';
    }

    try {
        overlaySupportedState = await OverlaySupported();
    } catch (error) {
        failures.push('overlay capability');
        overlaySupportedState = false;
    }
    if (!overlaySupportedState) {
        elements.overlayToggle.disabled = true;
        elements.overlayToggle.title = 'Pinned overlay is only available on Windows';
    }

    let supported = false;
    try {
        supported = await GlobalTapSupported();
    } catch (error) {
        failures.push('global input capability');
    }
    if (!supported) {
        elements.globalTap.checked = false;
        elements.globalTap.disabled = true;
        elements.inputStatus.textContent = 'Manual tap mode';
    } else {
        try {
            const enabled = await GlobalTapEnabled();
            elements.globalTap.checked = enabled;
            elements.inputStatus.textContent = enabled
                ? `Global ${displayBinding(keybindState.tap || 'Space')} active`
                : `Global ${displayBinding(keybindState.tap || 'Space')} paused`;
        } catch (error) {
            failures.push('global input state');
            elements.globalTap.checked = false;
            elements.inputStatus.textContent = 'Global input state unavailable';
        }
    }

    try {
        allGhosts = await SearchGhosts('');
    } catch (error) {
        failures.push('ghost catalog');
        allGhosts = [];
    }
    await searchGhosts();
    await refreshTracker();
    window.setInterval(() => renderHuntTimers(), 100);

    let savedOverlayMode = false;
    if (overlaySupportedState) {
        try {
            savedOverlayMode = await OverlayMode();
        } catch (error) {
            failures.push('overlay state');
        }
    }
    applyOverlayMode(savedOverlayMode);
    if (failures.length > 0) {
        elements.inputStatus.textContent = `Limited startup: ${failures.join(', ')}`;
    }
    EventsOn('overlay.mode', (enabled) => applyOverlayMode(enabled));
    EventsOn('overlay.visibility', (visible) => applyOverlayVisibility(visible));
    EventsOn('tracker.updated', (view) => applyTrackerView(view));
    EventsOn('hunt.timer.start', () => startHuntTimer('hotkey'));
    EventsOn('hunt.timer.end', () => endHuntTimer('hotkey'));
    EventsOn('tracker.reset', (view) => {
        if (view) {
            applyTrackerView(view);
        }
        resetHuntTimers();
    });
    EventsOn('run.reset', resetSession);
    EventsOn('keybind.openSettings', () => {
        setSettingsOpen(true).catch((error) => {
            elements.inputStatus.textContent = `Could not open settings: ${error}`;
        });
    });
}

initialize().catch((error) => {
    console.error('application initialization failed', error);
    elements.inputStatus.textContent = 'Initialization error';
});
