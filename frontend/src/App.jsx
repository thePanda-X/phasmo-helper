import { startTransition, useEffect, useEffectEvent, useRef, useState } from 'react';

import {
    GetKeybindSettings,
    GetOverlayLayout,
    GlobalTapEnabled,
    GlobalTapSupported,
    GhostCatalogInfo,
    OverlayMode,
    OverlaySupported,
    ResetKeybinds,
    ResetOverlayLayout,
    ResetTracker,
    SearchGhosts,
    SetGlobalTapEnabled,
    SetKeybind,
    SetModuleLayout,
    SetOverlayMode,
    SetSpeedModifierAndGetTrackerView,
    TapAndGetTrackerView,
    TrackerView,
} from '../wailsjs/go/main/App';
import { EventsOn, Quit, WindowMinimise } from '../wailsjs/runtime/runtime';
import {
    EvidenceModule,
    GhostSearchModule,
    HuntDetailsModule,
    HuntTimersModule,
    StepTrackerModule,
    TrackerDetailsModule,
    TopSuspectsModule,
} from './components/Dashboard';
import { Overlay } from './components/Overlay';
import { Settings } from './components/Settings';
import { constrainModuleGeometry } from './module-geometry';
import {
    createEmptyHuntTimerState,
    createEmptyTrackerState,
    createDefaultLayout,
    DEFAULT_KEYBINDS,
    HUNT_TIMER_PRESETS,
    KEYBIND_LABELS,
} from './constants';
import { displayBinding, formatNumber, keybindFromEvent } from './utils';

const FALLBACK_MODULE = { x: 24, y: 24, width: 520, height: 620, pinned: false, collapsed: false };
const DEFAULT_CAPTURE_STATUS = 'Bindings are unique and support modifiers such as Ctrl + Shift + O.';

function moduleFromLayout(layout, moduleID) {
    return layout.modules?.[moduleID] || FALLBACK_MODULE;
}

export default function App() {
    const [tracker, setTracker] = useState(createEmptyTrackerState);
    const [matches, setMatches] = useState([]);
    const [rankedGhosts, setRankedGhosts] = useState([]);
    const [ghosts, setGhosts] = useState([]);
    const [allGhosts, setAllGhosts] = useState([]);
    const [ghostQuery, setGhostQuery] = useState('');
    const [ghostSearchLoading, setGhostSearchLoading] = useState(true);
    const [ghostSearchError, setGhostSearchError] = useState('');
    const [discardedGhosts, setDiscardedGhosts] = useState(() => new Set());
    const [selectedEvidence, setSelectedEvidence] = useState(() => new Set());
    const [keybinds, setKeybinds] = useState(DEFAULT_KEYBINDS);
    const [captureAction, setCaptureAction] = useState(null);
    const [captureStatus, setCaptureStatus] = useState(DEFAULT_CAPTURE_STATUS);
    const [layout, setLayout] = useState(createDefaultLayout);
    const [overlayMode, setOverlayModeState] = useState(false);
    const [overlayContentVisible, setOverlayContentVisible] = useState(true);
    const [overlaySupported, setOverlaySupported] = useState(true);
    const [settingsOpen, setSettingsOpenState] = useState(false);
    const [globalTapEnabled, setGlobalTapEnabledState] = useState(true);
    const [globalTapSupported, setGlobalTapSupported] = useState(true);
    const [inputStatus, setInputStatus] = useState('Starting input monitor');
    const [catalogCount, setCatalogCount] = useState('-- entries');
    const [catalogSource, setCatalogSource] = useState('Catalog loading');
    const [huntTimers, setHuntTimers] = useState(createEmptyHuntTimerState);
    const [selectedPreset, setSelectedPreset] = useState(HUNT_TIMER_PRESETS[0].id);
    const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
    const [activeInteraction, setActiveInteraction] = useState(null);

    const searchSequence = useRef(0);
    const trackerRefreshSequence = useRef(0);
    const searchFocusRestore = useRef(true);
    const settingsInputRestore = useRef(null);
    const interactionRef = useRef(null);
    const searchInputRef = useRef(null);
    const globalTapEnabledRef = useRef(true);
    const globalTapRequestSequence = useRef(0);
    const huntTimersRef = useRef(huntTimers);
    const layoutSaveSequence = useRef(0);
    const viewportRef = useRef(viewport);

    const freeformDashboard = viewport.width > 980;
    const hasPinnedModule = Object.values(layout.modules || {}).some((module) => module.pinned);
    const overlayToggleDisabled = !overlaySupported || (!hasPinnedModule && !overlayMode);
    const overlayToggleTitle = !overlaySupported
        ? 'Pinned overlay is only available on Windows'
        : hasPinnedModule ? 'Show pinned modules over the game' : 'Pin at least one module first';

    function updateGlobalTapEnabled(enabled) {
        globalTapEnabledRef.current = enabled;
        setGlobalTapEnabledState(enabled);
    }

    function updateHuntTimers(update) {
        const current = huntTimersRef.current;
        const next = typeof update === 'function' ? update(current) : update;
        if (next === current) {
            return false;
        }
        huntTimersRef.current = next;
        setHuntTimers(next);
        return true;
    }

    useEffect(() => {
        document.body.classList.toggle('freeform-dashboard', freeformDashboard);
        document.body.classList.toggle('overlay-mode', overlayMode);
        return () => {
            document.body.classList.remove('freeform-dashboard', 'overlay-mode');
        };
    }, [freeformDashboard, overlayMode]);

    useEffect(() => {
        const handleResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        viewportRef.current = viewport;
    }, [viewport]);

    useEffect(() => {
        if (!huntTimers.testActive) {
            return;
        }
        const remainingMs = Math.max(0, huntTimers.testDurationMs - (performance.now() - huntTimers.testStartedAt));
        const timeout = window.setTimeout(() => {
            const completed = updateHuntTimers((current) => current.testActive ? {
                ...current,
                testActive: false,
                testRemainingMs: 0,
            } : current);
            if (completed) {
                setInputStatus(`${huntTimers.testLabel} complete`);
            }
        }, remainingMs);
        return () => window.clearTimeout(timeout);
    }, [huntTimers.testActive, huntTimers.testDurationMs, huntTimers.testLabel, huntTimers.testStartedAt]);

    function applyTrackerView(view) {
        if (!view?.snapshot) {
            return;
        }
        startTransition(() => {
            setTracker(view.snapshot);
            setMatches(view.matches || []);
            setRankedGhosts(view.ranked || []);
        });
    }

    function resetHuntTimers() {
        updateHuntTimers(createEmptyHuntTimerState());
    }

    function resetSession(snapshot) {
        if (snapshot) {
            setTracker(snapshot);
        }
        resetHuntTimers();
        setSelectedEvidence(new Set());
        setDiscardedGhosts(new Set());
        setMatches([]);
        setRankedGhosts([]);
    }

    function applyOverlayMode(enabled) {
        setOverlayModeState(enabled);
        if (enabled) {
            setSettingsOpenState(false);
            setInputStatus('Pinned overlay active');
        } else {
            setOverlayContentVisible(true);
            setInputStatus('Dashboard mode');
        }
    }

    async function setSettingsOpen(open) {
        if (settingsOpen === open) {
            return;
        }
        if (open) {
            if (overlayMode) {
                applyOverlayMode(await SetOverlayMode(false));
            }
            settingsInputRestore.current = globalTapEnabledRef.current;
            if (settingsInputRestore.current) {
                globalTapRequestSequence.current += 1;
                await SetGlobalTapEnabled(false);
            }
            setKeybinds(await GetKeybindSettings());
            setSettingsOpenState(true);
            setInputStatus('Global input paused for settings');
            setCaptureStatus(DEFAULT_CAPTURE_STATUS);
            return;
        }

        setCaptureAction(null);
        setSettingsOpenState(false);
        if (settingsInputRestore.current) {
            globalTapRequestSequence.current += 1;
            await SetGlobalTapEnabled(true);
            setInputStatus(`Global ${displayBinding(keybinds.tap || 'Space')} active`);
        } else {
            setInputStatus(`Global ${displayBinding(keybinds.tap || 'Space')} paused`);
        }
        settingsInputRestore.current = null;
    }

    function startHuntTimer(source = 'manual') {
        const startedAt = performance.now();
        const started = updateHuntTimers((current) => {
            if (current.active) {
                return current;
            }
            let cooldownElapsedMs = current.cooldownElapsedMs;
            let lastCooldownMs = current.lastCooldownMs;
            let history = current.history;
            if (current.cooldownStartedAt > 0) {
                cooldownElapsedMs = startedAt - current.cooldownStartedAt;
                lastCooldownMs = cooldownElapsedMs;
                history = current.history.map((entry, index) => (
                    index === 0 && entry.cooldownMs === 0 ? { ...entry, cooldownMs: cooldownElapsedMs } : entry
                ));
            }
            return {
                ...current,
                active: true,
                huntStartedAt: startedAt,
                huntElapsedMs: 0,
                cooldownStartedAt: 0,
                cooldownElapsedMs,
                lastCooldownMs,
                history,
            };
        });
        if (started) {
            setInputStatus(source === 'hotkey' ? 'Hunt timer started from F10' : 'Hunt timer started');
        }
    }

    function endHuntTimer(source = 'manual') {
        const endedAt = performance.now();
        const ended = updateHuntTimers((current) => {
            if (!current.active) {
                return current;
            }
            const durationMs = endedAt - current.huntStartedAt;
            return {
                ...current,
                active: false,
                huntElapsedMs: durationMs,
                cooldownStartedAt: endedAt,
                cooldownElapsedMs: 0,
                lastDurationMs: durationMs,
                history: [{ id: current.nextHuntID, durationMs, cooldownMs: 0 }, ...current.history].slice(0, 5),
                nextHuntID: current.nextHuntID + 1,
            };
        });
        if (ended) {
            setInputStatus(source === 'hotkey' ? 'Hunt ended from F11; cooldown running' : 'Hunt ended; cooldown running');
        }
    }

    function startPresetTimer() {
        const preset = HUNT_TIMER_PRESETS.find((item) => item.id === selectedPreset);
        if (!preset) {
            return;
        }
        updateHuntTimers((current) => ({
            ...current,
            testActive: true,
            testStartedAt: performance.now(),
            testDurationMs: preset.durationMs,
            testRemainingMs: preset.durationMs,
            testLabel: preset.label,
            testNote: preset.note,
        }));
        setInputStatus(`${preset.label} started`);
    }

    function stopPresetTimer() {
        const stopped = updateHuntTimers((current) => !current.testActive ? current : ({
            ...current,
            testActive: false,
            testDurationMs: 0,
            testRemainingMs: 0,
            testStartedAt: 0,
        }));
        if (stopped) {
            setInputStatus('Preset timer stopped');
        }
    }

    async function searchGhostCatalog(query) {
        const sequence = ++searchSequence.current;
        setGhostSearchLoading(true);
        setGhostSearchError('');
        try {
            const results = await SearchGhosts(query);
            if (sequence === searchSequence.current) {
                startTransition(() => setGhosts(results || []));
            }
        } catch (error) {
            if (sequence === searchSequence.current) {
                setGhosts([]);
                setGhostSearchError('Ghost catalog unavailable. Try again after restarting the helper.');
                setInputStatus(`Ghost search failed: ${error}`);
            }
        } finally {
            if (sequence === searchSequence.current) {
                setGhostSearchLoading(false);
            }
        }
    }

    function handleGhostQueryChange(value) {
        setGhostQuery(value);
        searchGhostCatalog(value.trim());
    }

    async function refreshTracker() {
        const sequence = ++trackerRefreshSequence.current;
        try {
            const view = await TrackerView();
            if (sequence === trackerRefreshSequence.current) {
                applyTrackerView(view);
            }
        } catch (error) {
            setInputStatus(`Tracker refresh failed: ${error}`);
        }
    }

    async function handleTap() {
        try {
            applyTrackerView(await TapAndGetTrackerView());
        } catch (error) {
            setInputStatus(`Tap failed: ${error}`);
        }
    }

    async function handleResetSession() {
        try {
            resetSession(await ResetTracker());
        } catch (error) {
            setInputStatus(`Could not reset session: ${error}`);
        }
    }

    async function handleSpeedModifierChange(modifier) {
        try {
            applyTrackerView(await SetSpeedModifierAndGetTrackerView(modifier));
        } catch (error) {
            setInputStatus(`Could not update speed modifier: ${error}`);
        }
    }

    async function handleGlobalTapChange(requested) {
        const previous = globalTapEnabledRef.current;
        const sequence = ++globalTapRequestSequence.current;
        updateGlobalTapEnabled(requested);
        try {
            const enabled = await SetGlobalTapEnabled(requested);
            if (sequence !== globalTapRequestSequence.current) {
                return;
            }
            updateGlobalTapEnabled(enabled);
            setInputStatus(enabled
                ? `Global ${displayBinding(keybinds.tap || 'Space')} active`
                : `Global ${displayBinding(keybinds.tap || 'Space')} paused`);
        } catch (error) {
            if (sequence !== globalTapRequestSequence.current) {
                return;
            }
            updateGlobalTapEnabled(previous);
            setInputStatus(`Could not change global input: ${error}`);
        }
    }

    async function handleSearchFocus() {
        searchFocusRestore.current = globalTapEnabledRef.current;
        if (!searchFocusRestore.current) {
            return;
        }
        try {
            globalTapRequestSequence.current += 1;
            await SetGlobalTapEnabled(false);
            setInputStatus(`Global ${displayBinding(keybinds.tap || 'Space')} paused for search`);
        } catch (error) {
            setInputStatus(`Could not pause global input: ${error}`);
        }
    }

    async function handleSearchBlur() {
        const shouldRestore = searchFocusRestore.current;
        searchFocusRestore.current = false;
        if (!shouldRestore) {
            return;
        }
        try {
            globalTapRequestSequence.current += 1;
            await SetGlobalTapEnabled(true);
            setInputStatus(`Global ${displayBinding(keybinds.tap || 'Space')} active`);
        } catch (error) {
            setInputStatus(`Could not resume global input: ${error}`);
        }
    }

    function toggleEvidence(evidence) {
        setSelectedEvidence((current) => {
            const next = new Set(current);
            if (next.has(evidence)) {
                next.delete(evidence);
            } else {
                next.add(evidence);
            }
            return next;
        });
    }

    function discardGhost(ghostID) {
        const restoring = discardedGhosts.has(ghostID);
        setDiscardedGhosts((current) => {
            const next = new Set(current);
            if (next.has(ghostID)) {
                next.delete(ghostID);
            } else {
                next.add(ghostID);
            }
            return next;
        });
        setInputStatus(restoring ? 'Restored ghost' : 'Discarded ghost');
    }

    function discardSpeedOutliers() {
        if (!tracker.ready || matches.length === 0) {
            return;
        }
        const speedMatches = new Set(matches.map((match) => match.ghost.id));
        setDiscardedGhosts((current) => {
            const next = new Set(current);
            for (const ghost of allGhosts) {
                if (!speedMatches.has(ghost.id)) {
                    next.add(ghost.id);
                }
            }
            return next;
        });
        setInputStatus(`Discarded ghosts outside ${formatNumber(tracker.baseSpeedMPS, 2)} m/s`);
    }

    async function toggleModulePin(moduleID) {
        const current = constrainModuleGeometry(moduleFromLayout(layout, moduleID), viewport);
        const next = { ...current, pinned: !current.pinned };
        const sequence = ++layoutSaveSequence.current;
        setLayout((saved) => ({
            ...saved,
            modules: { ...saved.modules, [moduleID]: next },
        }));
        try {
            const saved = await SetModuleLayout(moduleID, next);
            if (sequence === layoutSaveSequence.current) {
                setLayout(saved);
            }
            setInputStatus(current.pinned ? `${moduleID} unpinned` : `${moduleID} pinned`);
        } catch (error) {
            if (sequence === layoutSaveSequence.current) {
                setLayout((saved) => ({
                    ...saved,
                    modules: { ...saved.modules, [moduleID]: current },
                }));
            }
            setInputStatus(`Could not save module state: ${error}`);
        }
    }

    async function toggleModuleCollapsed(moduleID) {
        const current = constrainModuleGeometry(moduleFromLayout(layout, moduleID), viewport);
        const next = { ...current, collapsed: !current.collapsed };
        const sequence = ++layoutSaveSequence.current;
        setLayout((saved) => ({
            ...saved,
            modules: { ...saved.modules, [moduleID]: next },
        }));
        try {
            const saved = await SetModuleLayout(moduleID, next);
            if (sequence === layoutSaveSequence.current) {
                setLayout(saved);
            }
        } catch (error) {
            if (sequence === layoutSaveSequence.current) {
                setLayout((saved) => ({
                    ...saved,
                    modules: { ...saved.modules, [moduleID]: current },
                }));
            }
            setInputStatus(`Could not save module state: ${error}`);
        }
    }

    function startModuleDrag(event, moduleID) {
        if (overlayMode || !freeformDashboard || event.button !== 0 || event.target.closest('button, input, select')) {
            return;
        }
        const current = constrainModuleGeometry(moduleFromLayout(layout, moduleID), viewport);
        interactionRef.current = {
            type: 'drag',
            moduleID,
            startX: event.clientX,
            startY: event.clientY,
            initialModule: { ...current },
            latestModule: { ...current },
            element: event.currentTarget.closest('[data-module]'),
        };
        setActiveInteraction({ type: 'drag', moduleID });
        event.currentTarget.setPointerCapture?.(event.pointerId);
    }

    function startModuleResize(event, moduleID) {
        if (overlayMode || !freeformDashboard || event.button !== 0) {
            return;
        }
        const current = constrainModuleGeometry(moduleFromLayout(layout, moduleID), viewport);
        interactionRef.current = {
            type: 'resize',
            moduleID,
            startX: event.clientX,
            startY: event.clientY,
            initialModule: { ...current },
            latestModule: { ...current },
            element: event.currentTarget.closest('[data-module]'),
        };
        setActiveInteraction({ type: 'resize', moduleID });
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture?.(event.pointerId);
    }

    useEffect(() => {
        function moveModule(event) {
            const interaction = interactionRef.current;
            if (!interaction) {
                return;
            }
            const next = { ...interaction.initialModule };
            if (interaction.type === 'resize') {
                next.width = Math.max(280, Math.min(1200, Math.round(interaction.initialModule.width + event.clientX - interaction.startX)));
                next.height = Math.max(100, Math.min(1400, Math.round(interaction.initialModule.height + event.clientY - interaction.startY)));
            } else {
                next.x = Math.round(interaction.initialModule.x + event.clientX - interaction.startX);
                next.y = Math.round(interaction.initialModule.y + event.clientY - interaction.startY);
            }
            interaction.latestModule = constrainModuleGeometry(next, viewportRef.current);
            if (interaction.type === 'resize') {
                interaction.element?.style.setProperty('width', `${interaction.latestModule.width}px`);
                interaction.element?.style.setProperty('height', `${interaction.latestModule.height}px`);
            } else {
                interaction.element?.style.setProperty('left', `${interaction.latestModule.x}px`);
                interaction.element?.style.setProperty('top', `${interaction.latestModule.y}px`);
            }
        }

        async function finishInteraction() {
            const interaction = interactionRef.current;
            if (!interaction) {
                return;
            }
            interactionRef.current = null;
            setActiveInteraction(null);
            const sequence = ++layoutSaveSequence.current;
            setLayout((current) => ({
                ...current,
                modules: { ...current.modules, [interaction.moduleID]: interaction.latestModule },
            }));
            try {
                const saved = await SetModuleLayout(interaction.moduleID, interaction.latestModule);
                if (sequence === layoutSaveSequence.current) {
                    setLayout(saved);
                }
            } catch (error) {
                if (sequence === layoutSaveSequence.current) {
                    if (interaction.type === 'resize') {
                        interaction.element?.style.setProperty('width', `${interaction.initialModule.width}px`);
                        interaction.element?.style.setProperty('height', `${interaction.initialModule.height}px`);
                    } else {
                        interaction.element?.style.setProperty('left', `${interaction.initialModule.x}px`);
                        interaction.element?.style.setProperty('top', `${interaction.initialModule.y}px`);
                    }
                    setLayout((current) => ({
                        ...current,
                        modules: { ...current.modules, [interaction.moduleID]: interaction.initialModule },
                    }));
                }
                setInputStatus(`Could not save module ${interaction.type === 'resize' ? 'size' : 'position'}: ${error}`);
            }
        }

        window.addEventListener('pointermove', moveModule);
        window.addEventListener('pointerup', finishInteraction);
        window.addEventListener('pointercancel', finishInteraction);
        return () => {
            window.removeEventListener('pointermove', moveModule);
            window.removeEventListener('pointerup', finishInteraction);
            window.removeEventListener('pointercancel', finishInteraction);
        };
    }, []);

    async function resizeModuleWithKeyboard(event, moduleID) {
        if (!freeformDashboard || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
            return;
        }
        event.preventDefault();
        const current = { ...moduleFromLayout(layout, moduleID) };
        const step = event.shiftKey ? 40 : 10;
        if (event.key === 'ArrowLeft') current.width -= step;
        if (event.key === 'ArrowRight') current.width += step;
        if (event.key === 'ArrowUp') current.height -= step;
        if (event.key === 'ArrowDown') current.height += step;
        current.width = Math.max(280, Math.min(1200, current.width));
        current.height = Math.max(100, Math.min(1400, current.height));
        const next = constrainModuleGeometry(current, viewport);
        const previous = moduleFromLayout(layout, moduleID);
        const sequence = ++layoutSaveSequence.current;
        setLayout((saved) => ({
            ...saved,
            modules: { ...saved.modules, [moduleID]: next },
        }));
        try {
            const saved = await SetModuleLayout(moduleID, next);
            if (sequence === layoutSaveSequence.current) {
                setLayout(saved);
            }
            setInputStatus(`${moduleID} size saved`);
        } catch (error) {
            if (sequence === layoutSaveSequence.current) {
                setLayout((saved) => ({
                    ...saved,
                    modules: { ...saved.modules, [moduleID]: previous },
                }));
            }
            setInputStatus(`Could not save module size: ${error}`);
        }
    }

    async function handleOverlayToggle() {
        try {
            if (!overlayMode && settingsOpen) {
                await setSettingsOpen(false);
            }
            applyOverlayMode(await SetOverlayMode(!overlayMode));
        } catch (error) {
            setInputStatus(`Could not change overlay mode: ${error}`);
        }
    }

    async function beginKeybindCapture(action) {
        setCaptureAction(action);
        setCaptureStatus(`Press a key for ${KEYBIND_LABELS[action]}. Press Escape to cancel.`);
        try {
            await SetGlobalTapEnabled(false);
        } catch (error) {
            setCaptureAction(null);
            setCaptureStatus(`Could not pause global input: ${error}`);
        }
    }

    async function restoreKeybinds() {
        try {
            setCaptureAction(null);
            setKeybinds(await ResetKeybinds());
            setCaptureStatus('Default keybinds restored and saved.');
        } catch (error) {
            setCaptureStatus(`Could not restore defaults: ${error}`);
        }
    }

    async function restoreLayout() {
        const sequence = ++layoutSaveSequence.current;
        try {
            const saved = await ResetOverlayLayout();
            if (sequence === layoutSaveSequence.current) {
                setLayout(saved);
            }
            setCaptureStatus('Module positions and pins reset.');
        } catch (error) {
            setCaptureStatus(`Could not reset module layout: ${error}`);
        }
    }

    useEffect(() => {
        async function handleCaptureKey(event) {
            if (!captureAction || !settingsOpen || event.repeat) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            if (event.code === 'Escape') {
                setCaptureAction(null);
                setCaptureStatus('Capture cancelled.');
                return;
            }
            const binding = keybindFromEvent(event);
            if (!binding) {
                setCaptureStatus('Use one primary key, optionally with Ctrl, Alt, Shift, or Win.');
                return;
            }
            const action = captureAction;
            try {
                const updated = await SetKeybind(action, binding);
                setKeybinds(updated);
                setCaptureStatus(`${KEYBIND_LABELS[action]} saved as ${displayBinding(updated[action])}.`);
                setCaptureAction(null);
            } catch (error) {
                setCaptureStatus(`Could not save binding: ${error}`);
            }
        }
        document.addEventListener('keydown', handleCaptureKey);
        return () => document.removeEventListener('keydown', handleCaptureKey);
    }, [captureAction, settingsOpen]);

    useEffect(() => {
        function focusSearch(event) {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                searchInputRef.current?.focus();
            }
        }
        window.addEventListener('keydown', focusSearch);
        return () => window.removeEventListener('keydown', focusSearch);
    }, []);

    const onOverlayModeEvent = useEffectEvent((enabled) => applyOverlayMode(enabled));
    const onOverlayVisibilityEvent = useEffectEvent((visible) => setOverlayContentVisible(visible));
    const onTrackerUpdatedEvent = useEffectEvent((view) => applyTrackerView(view));
    const onHuntStartEvent = useEffectEvent(() => startHuntTimer('hotkey'));
    const onHuntEndEvent = useEffectEvent(() => endHuntTimer('hotkey'));
    const onTrackerResetEvent = useEffectEvent((view) => {
        if (view) {
            applyTrackerView(view);
        }
        resetHuntTimers();
    });
    const onRunResetEvent = useEffectEvent((snapshot) => resetSession(snapshot));
    const onOpenSettingsEvent = useEffectEvent(() => {
        setSettingsOpen(true).catch((error) => setInputStatus(`Could not open settings: ${error}`));
    });

    useEffect(() => {
        let cancelled = false;
        let unsubscribers = [];

        async function initialize() {
            const failures = [];
            let loadedKeybinds = DEFAULT_KEYBINDS;
            try {
                loadedKeybinds = await GetKeybindSettings();
                if (!cancelled) setKeybinds(loadedKeybinds);
            } catch (error) {
                failures.push('keybinds');
                if (!cancelled) setCaptureStatus(`Keybind settings unavailable: ${error}`);
            }

            try {
                const savedLayout = await GetOverlayLayout();
                if (!cancelled) setLayout(savedLayout);
            } catch (error) {
                failures.push('layout');
                if (!cancelled) setInputStatus(`Saved layout unavailable: ${error}`);
            }

            try {
                const info = await GhostCatalogInfo();
                if (!cancelled) {
                    setCatalogCount(`${info.count} entries`);
                    setCatalogSource(`Catalog ${info.version}`);
                }
            } catch (error) {
                failures.push('catalog info');
                if (!cancelled) {
                    setCatalogCount('Unavailable');
                    setCatalogSource('Catalog unavailable');
                }
            }

            let supportsOverlay = false;
            try {
                supportsOverlay = await OverlaySupported();
            } catch (error) {
                failures.push('overlay capability');
            }
            if (!cancelled) setOverlaySupported(supportsOverlay);

            let supportsGlobalTap = false;
            try {
                supportsGlobalTap = await GlobalTapSupported();
            } catch (error) {
                failures.push('global input capability');
            }
            if (!cancelled) setGlobalTapSupported(supportsGlobalTap);
            if (!supportsGlobalTap) {
                if (!cancelled) {
                    updateGlobalTapEnabled(false);
                    setInputStatus('Manual tap mode');
                }
            } else {
                try {
                    const enabled = await GlobalTapEnabled();
                    if (!cancelled) {
                        updateGlobalTapEnabled(enabled);
                        setInputStatus(enabled
                            ? `Global ${displayBinding(loadedKeybinds.tap || 'Space')} active`
                            : `Global ${displayBinding(loadedKeybinds.tap || 'Space')} paused`);
                    }
                } catch (error) {
                    failures.push('global input state');
                    if (!cancelled) {
                        updateGlobalTapEnabled(false);
                        setInputStatus('Global input state unavailable');
                    }
                }
            }

            try {
                const catalog = await SearchGhosts('');
                if (!cancelled) {
                    setAllGhosts(catalog || []);
                    if (searchSequence.current === 0) {
                        setGhosts(catalog || []);
                        setGhostSearchLoading(false);
                    }
                }
            } catch (error) {
                failures.push('ghost catalog');
                if (!cancelled) {
                    setGhostSearchLoading(false);
                    setGhostSearchError('Ghost catalog unavailable. Try again after restarting the helper.');
                }
            }

            await refreshTracker();

            let savedOverlayMode = false;
            if (supportsOverlay) {
                try {
                    savedOverlayMode = await OverlayMode();
                } catch (error) {
                    failures.push('overlay state');
                }
            }
            if (cancelled) {
                return;
            }
            applyOverlayMode(savedOverlayMode);
            if (failures.length > 0) {
                setInputStatus(`Limited startup: ${failures.join(', ')}`);
            }

            unsubscribers = [
                EventsOn('overlay.mode', onOverlayModeEvent),
                EventsOn('overlay.visibility', onOverlayVisibilityEvent),
                EventsOn('tracker.updated', onTrackerUpdatedEvent),
                EventsOn('hunt.timer.start', onHuntStartEvent),
                EventsOn('hunt.timer.end', onHuntEndEvent),
                EventsOn('tracker.reset', onTrackerResetEvent),
                EventsOn('run.reset', onRunResetEvent),
                EventsOn('keybind.openSettings', onOpenSettingsEvent),
            ];
        }

        initialize().catch((error) => {
            console.error('application initialization failed', error);
            if (!cancelled) setInputStatus('Initialization error');
        });
        return () => {
            cancelled = true;
            for (const unsubscribe of unsubscribers) unsubscribe();
        };
    }, []);

    function moduleProps(moduleID) {
        return {
            module: constrainModuleGeometry(moduleFromLayout(layout, moduleID), viewport),
            freeform: freeformDashboard,
            dragging: activeInteraction?.type === 'drag' && activeInteraction.moduleID === moduleID,
            onDragStart: startModuleDrag,
            onResizeStart: startModuleResize,
            onResizeKeyDown: resizeModuleWithKeyboard,
            onTogglePin: toggleModulePin,
            onToggleCollapsed: toggleModuleCollapsed,
        };
    }

    return (
        <div className="app-frame">
            <header className="topbar" style={{ '--wails-draggable': 'drag' }}>
                <div>
                    <div className="kicker">FIELD KIT / LIVE INVESTIGATION</div>
                    <h1>Phasmo Field Kit</h1>
                </div>
                <div className="topbar-status" role="status" aria-live="polite">
                    <span className="status-dot" />
                    <span>{inputStatus}</span>
                </div>
                <div className="topbar-actions" style={{ '--wails-draggable': 'no-drag' }}>
                    <button className="nav-button overlay-nav-button" type="button" disabled={overlayToggleDisabled} title={overlayToggleTitle} onClick={handleOverlayToggle}>
                        {overlayMode ? 'Edit modules' : 'Show pinned overlay'}
                    </button>
                    <button className={`nav-button${settingsOpen ? ' is-active' : ''}`} type="button" onClick={() => setSettingsOpen(!settingsOpen).catch((error) => console.error('settings view failed', error))}>
                        {settingsOpen ? 'Field view' : 'Settings'}
                    </button>
                    <button className="window-button" type="button" aria-label="Minimize window" onClick={WindowMinimise}>MIN</button>
                    <button className="window-button window-close-button" type="button" aria-label="Exit Phasmo Field Kit" onClick={Quit}>EXIT</button>
                </div>
            </header>

            <main className="workspace" hidden={overlayMode || settingsOpen}>
                    <GhostSearchModule
                        moduleProps={moduleProps('ghostSearch')}
                        catalogCount={catalogCount}
                        query={ghostQuery}
                        ghosts={ghosts}
                        loading={ghostSearchLoading}
                        error={ghostSearchError}
                        selectedEvidence={selectedEvidence}
                        discardedGhosts={discardedGhosts}
                        searchInputRef={searchInputRef}
                        onQueryChange={handleGhostQueryChange}
                        onSearchFocus={handleSearchFocus}
                        onSearchBlur={handleSearchBlur}
                        onDiscardGhost={discardGhost}
                        onClearDiscarded={() => {
                            setDiscardedGhosts(new Set());
                            setInputStatus('Restored discarded ghosts');
                        }}
                    />
                    <EvidenceModule
                        moduleProps={moduleProps('evidence')}
                        selectedEvidence={selectedEvidence}
                        onToggleEvidence={toggleEvidence}
                        onClearEvidence={() => setSelectedEvidence(new Set())}
                    />
                    <StepTrackerModule
                        moduleProps={moduleProps('stepTracker')}
                        tracker={tracker}
                    />
                    <TrackerDetailsModule
                        moduleProps={moduleProps('trackerDetails')}
                        tracker={tracker}
                        matches={matches}
                        selectedEvidence={selectedEvidence}
                        discardedGhosts={discardedGhosts}
                        keybinds={keybinds}
                        globalTapEnabled={globalTapEnabled}
                        globalTapSupported={globalTapSupported}
                        onTap={handleTap}
                        onSpeedModifierChange={handleSpeedModifierChange}
                        onGlobalTapChange={handleGlobalTapChange}
                        onResetSession={handleResetSession}
                        onDiscardSpeedOutliers={discardSpeedOutliers}
                    />
                    <TopSuspectsModule
                        moduleProps={moduleProps('topSuspects')}
                        rankedGhosts={rankedGhosts}
                        selectedEvidence={selectedEvidence}
                        discardedGhosts={discardedGhosts}
                    />
                    <HuntTimersModule
                        moduleProps={moduleProps('huntTimers')}
                        timers={huntTimers}
                    />
                    <HuntDetailsModule
                        moduleProps={moduleProps('huntDetails')}
                        timers={huntTimers}
                        selectedPreset={selectedPreset}
                        keybinds={keybinds}
                        onStartHunt={() => startHuntTimer()}
                        onEndHunt={() => endHuntTimer()}
                        onResetTimers={resetHuntTimers}
                        onPresetChange={setSelectedPreset}
                        onStartPreset={startPresetTimer}
                        onStopPreset={stopPresetTimer}
                    />
            </main>

            {overlayMode && overlayContentVisible && (
                <Overlay
                    layout={layout}
                    viewport={viewport}
                    tracker={tracker}
                    timers={huntTimers}
                    query={ghostQuery}
                    ghosts={ghosts}
                    rankedGhosts={rankedGhosts}
                    discardedGhosts={discardedGhosts}
                    selectedEvidence={selectedEvidence}
                />
            )}

            <div hidden={overlayMode || !settingsOpen}>
                <Settings
                    keybinds={keybinds}
                    captureAction={captureAction}
                    captureStatus={captureStatus}
                    onBeginCapture={beginKeybindCapture}
                    onRestoreKeybinds={restoreKeybinds}
                    onRestoreLayout={restoreLayout}
                />
            </div>

            <footer className="footer-bar">
                <span>MANUAL ASSISTANCE ONLY</span>
                <span>{catalogSource}</span>
            </footer>
        </div>
    );
}
