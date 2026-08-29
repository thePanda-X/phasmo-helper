import { useEffect, useState } from 'react';

import { EVIDENCE_OPTIONS, HUNT_TIMER_PRESETS } from '../constants';
import { cooldownAssessment, displayBinding, formatNumber, matchesEvidence, timerDuration } from '../utils';

function ModuleFrame({ id, className, module, freeform, children, onResizeStart, onResizeKeyDown }) {
    const style = freeform ? {
        left: `${module.x}px`,
        top: `${module.y}px`,
        width: `${module.width}px`,
        height: `${module.height}px`,
    } : undefined;

    return (
        <section id={`module-${id}`} className={`${className} dashboard-module${module.collapsed ? ' is-collapsed' : ''}`} data-module={id} style={style}>
            {children}
            <div
                className="module-resize-handle"
                data-resize-module={id}
                role="separator"
                aria-orientation="both"
                aria-label={`Resize ${id} module`}
                tabIndex={0}
                onPointerDown={(event) => onResizeStart(event, id)}
                onKeyDown={(event) => onResizeKeyDown(event, id)}
            />
        </section>
    );
}

function ModuleHeading({ id, kicker, title, className = 'section-heading', module, dragging, onDragStart, onTogglePin, onToggleCollapsed, pinnable = true, children }) {
    return (
        <div
            className={`${className} module-heading-line${dragging ? ' is-dragging' : ''}`}
            data-drag-module={id}
            onPointerDown={(event) => onDragStart(event, id)}
        >
            <div>
                <div className="kicker">{kicker}</div>
                <h2>{title}</h2>
            </div>
            <div className="module-actions">
                {!module.collapsed && children}
                <button
                    className="module-collapse"
                    type="button"
                    aria-expanded={!module.collapsed}
                    title={module.collapsed ? 'Expand this module' : 'Collapse this module'}
                    onClick={() => onToggleCollapsed(id)}
                >
                    {module.collapsed ? 'Expand' : 'Collapse'}
                </button>
                {!module.collapsed && pinnable && (
                    <button
                        className={`module-pin${module.pinned ? ' is-pinned' : ''}`}
                        type="button"
                        aria-pressed={module.pinned}
                        title={module.pinned ? 'Hide this module from the overlay' : 'Show this module in the overlay'}
                        onClick={() => onTogglePin(id)}
                    >
                        {module.pinned ? 'Pinned' : 'Pin'}
                    </button>
                )}
            </div>
        </div>
    );
}

function CompactModuleHeading({ id, label, module, dragging, onDragStart, onTogglePin, onToggleCollapsed }) {
    return (
        <header
            className={`pinned-header${dragging ? ' is-dragging' : ''}`}
            onPointerDown={(event) => onDragStart(event, id)}
        >
            <span>{label}</span>
            <div className="compact-module-actions">
                <button
                    className="module-collapse"
                    type="button"
                    aria-expanded={!module.collapsed}
                    title={module.collapsed ? 'Expand this module' : 'Collapse this module'}
                    onClick={() => onToggleCollapsed(id)}
                >
                    {module.collapsed ? 'EXPAND' : 'COLLAPSE'}
                </button>
                {!module.collapsed && (
                    <button
                        className={`module-pin${module.pinned ? ' is-pinned' : ''}`}
                        type="button"
                        aria-pressed={module.pinned}
                        title={module.pinned ? 'Hide this module from the overlay' : 'Show this module in the overlay'}
                        onClick={() => onTogglePin(id)}
                    >
                        {module.pinned ? 'PINNED' : 'PIN'}
                    </button>
                )}
            </div>
        </header>
    );
}

export function StepTrackerModule({ moduleProps, tracker }) {
    return (
        <ModuleFrame id="stepTracker" className="pinned-module compact-module" {...moduleProps}>
            <CompactModuleHeading id="stepTracker" label="STEP TRACKER" {...moduleProps} />
            <div className="pinned-primary-label">OBSERVED CADENCE</div>
            <strong className="pinned-bpm">{formatNumber(tracker.bpm)}</strong>
            <div className="pinned-metrics">
                <span>base <b>{formatNumber(tracker.baseSpeedMPS, 2)} m/s</b></span>
                <span>actual <b>{formatNumber(tracker.actualSpeedMPS, 2)} m/s</b></span>
                <span>jitter <b>{formatNumber(tracker.jitterMS)} ms</b></span>
            </div>
            <div className="pinned-footer"><span>{tracker.confidence.toUpperCase()} CONFIDENCE</span><span>{tracker.tapCount} taps</span></div>
        </ModuleFrame>
    );
}

export function TopSuspectsModule({ moduleProps, rankedGhosts, discardedGhosts, selectedEvidence }) {
    const suspects = rankedGhosts
        .filter((match) => !discardedGhosts.has(match.ghost.id) && matchesEvidence(match.ghost, selectedEvidence))
        .slice(0, 3);
    return (
        <ModuleFrame id="topSuspects" className="pinned-module compact-module pinned-suspects-module" {...moduleProps}>
            <CompactModuleHeading id="topSuspects" label="MOST LIKELY" {...moduleProps} />
            <div className="pinned-suspect-list">
                {suspects.length === 0 && <span className="pinned-empty">No ranked candidates</span>}
                {suspects.map((match, index) => (
                    <div className="pinned-suspect-row" key={match.ghost.id}>
                        <span className="pinned-suspect-rank">0{index + 1}</span>
                        <strong>{match.ghost.name}</strong>
                        <em>+/- {Number(match.closestDistance).toFixed(2)} m/s</em>
                    </div>
                ))}
            </div>
            <div className="pinned-footer"><span>SPEED + DISCARDS</span><span>TOP 3</span></div>
        </ModuleFrame>
    );
}

export function HuntTimersModule({ moduleProps, timers }) {
    const timerRunning = timers.active || timers.cooldownStartedAt > 0 || timers.testActive;
    const [now, setNow] = useState(() => performance.now());
    useEffect(() => {
        setNow(performance.now());
        if (!timerRunning) {
            return undefined;
        }
        const interval = window.setInterval(() => setNow(performance.now()), 100);
        return () => window.clearInterval(interval);
    }, [timerRunning, timers.cooldownStartedAt, timers.huntStartedAt, timers.testStartedAt]);

    const currentHuntMs = timers.active ? Math.max(0, now - timers.huntStartedAt) : timers.huntElapsedMs;
    const currentCooldownMs = timers.cooldownStartedAt > 0 ? Math.max(0, now - timers.cooldownStartedAt) : timers.cooldownElapsedMs;
    return (
        <ModuleFrame id="huntTimers" className="pinned-module compact-module pinned-hunt-module" {...moduleProps}>
            <CompactModuleHeading id="huntTimers" label="HUNT TIMING" {...moduleProps} />
            <div className="pinned-hunt-grid">
                <div>
                    <span className="pinned-primary-label">CURRENT HUNT</span>
                    <strong className="pinned-timer-value">{timers.active || timers.huntElapsedMs > 0 ? timerDuration(currentHuntMs) : '--:--.-'}</strong>
                </div>
                <div>
                    <span className="pinned-primary-label">COOLDOWN</span>
                    <strong className="pinned-timer-value">{timers.cooldownStartedAt > 0 || timers.lastCooldownMs > 0 ? timerDuration(currentCooldownMs) : '--:--.-'}</strong>
                </div>
            </div>
            <div className="pinned-test-timer">
                <span>{timers.testActive ? timers.testLabel : 'LAST HUNT'}</span>
                <strong>{timers.testActive ? timerDuration(Math.max(0, timers.testDurationMs - Math.max(0, now - timers.testStartedAt))) : timers.lastDurationMs > 0 ? timerDuration(timers.lastDurationMs) : '--:--.-'}</strong>
            </div>
            <div className="pinned-footer"><span>{timers.testActive ? timers.testNote : 'F10 START / F11 END'}</span><span>{timers.history.length} RECORDS</span></div>
        </ModuleFrame>
    );
}

export function GhostSearchModule({ moduleProps, catalogCount, query, ghosts, loading, error, selectedEvidence, discardedGhosts, searchInputRef, onQueryChange, onSearchFocus, onSearchBlur, onDiscardGhost, onClearDiscarded }) {
    const matchingGhosts = ghosts.filter((ghost) => matchesEvidence(ghost, selectedEvidence));
    const activeGhosts = matchingGhosts.filter((ghost) => !discardedGhosts.has(ghost.id));
    const discardedMatches = matchingGhosts.filter((ghost) => discardedGhosts.has(ghost.id));
    const orderedGhosts = [...activeGhosts, ...discardedMatches];

    return (
        <ModuleFrame id="ghostSearch" className="catalog-column" {...moduleProps}>
            <ModuleHeading id="ghostSearch" kicker="REFERENCE INDEX" title="Ghost tells" className="catalog-header" {...moduleProps}>
                <span className="catalog-count">{catalogCount}</span>
                {discardedGhosts.size > 0 && (
                    <button className="text-button" type="button" onClick={onClearDiscarded}>Restore discarded</button>
                )}
            </ModuleHeading>
            <label className="search-box">
                <span className="search-icon" aria-hidden="true">/</span>
                <input
                    ref={searchInputRef}
                    type="search"
                    value={query}
                    autoComplete="off"
                    aria-label="Search ghosts by name or alias"
                    aria-controls="ghost-results"
                    placeholder="Search by ghost name or alias"
                    onChange={(event) => onQueryChange(event.target.value)}
                    onFocus={onSearchFocus}
                    onBlur={onSearchBlur}
                />
                <kbd>CTRL K</kbd>
            </label>
            <div className="search-help">Search is local and instant. Ghost cards show speed profiles and behavior tells.</div>
            <div id="ghost-results" className="ghost-results" aria-live="polite" aria-busy={loading}>
                {orderedGhosts.length === 0 && (
                    <div className="empty-state">
                        {error || (ghosts.length === 0 ? 'No ghosts matched that search.' : 'No ghosts match the selected evidence.')}
                    </div>
                )}
                {orderedGhosts.map((ghost) => {
                    const discarded = discardedGhosts.has(ghost.id);
                    return (
                        <article className={`ghost-card${discarded ? ' is-discarded' : ''}`} key={ghost.id}>
                            <div className="ghost-card-heading">
                                <div>
                                    <h3>{ghost.name}</h3>
                                    {ghost.aliases?.length > 0 && <span className="alias">also: {ghost.aliases.join(', ')}</span>}
                                </div>
                                <div className="ghost-card-actions">
                                    {discarded && <span className="ghost-status">DISCARDED</span>}
                                    <span className="ghost-id">{ghost.id}</span>
                                    <button
                                        className="ghost-discard"
                                        type="button"
                                        aria-pressed={discarded}
                                        aria-label={`${discarded ? 'Restore' : 'Discard'} ${ghost.name}`}
                                        onClick={() => onDiscardGhost(ghost.id)}
                                    >
                                        {discarded ? 'Restore' : 'Discard'}
                                    </button>
                                </div>
                            </div>
                            <div className="profile-list">
                                {ghost.speedProfiles.map((profile) => (
                                    <div className="profile-row" key={`${profile.label}-${profile.baseMPS}`}>
                                        <span>{profile.label}</span>
                                        <strong>{Number(profile.baseMPS).toFixed(2)} m/s</strong>
                                        <small>{profile.condition}</small>
                                    </div>
                                ))}
                            </div>
                            <ul className="tell-list">
                                {ghost.tells.map((tell) => <li key={tell}>{tell}</li>)}
                            </ul>
                        </article>
                    );
                })}
            </div>
        </ModuleFrame>
    );
}

export function EvidenceModule({ moduleProps, selectedEvidence, onToggleEvidence, onClearEvidence }) {
    return (
        <ModuleFrame id="evidence" className="evidence-column" {...moduleProps}>
            <ModuleHeading id="evidence" kicker="CURRENT KNOWLEDGE" title="Evidence filter" {...moduleProps}>
                <span className="subtle">{selectedEvidence.size === 0 ? 'None selected' : `${selectedEvidence.size} selected`}</span>
                {selectedEvidence.size > 0 && (
                    <button className="text-button" type="button" onClick={onClearEvidence}>Clear</button>
                )}
            </ModuleHeading>
            <div className="evidence-help">Select confirmed evidence. Ghosts without every selected clue are discarded from the candidate lists.</div>
            <div className="evidence-options">
                {EVIDENCE_OPTIONS.map((evidence) => {
                    const selected = selectedEvidence.has(evidence.id);
                    return (
                        <button
                            className={`evidence-chip${selected ? ' is-selected' : ''}`}
                            type="button"
                            key={evidence.id}
                            aria-pressed={selected}
                            onClick={() => onToggleEvidence(evidence.id)}
                        >
                            {evidence.label}
                        </button>
                    );
                })}
            </div>
        </ModuleFrame>
    );
}

export function TrackerDetailsModule({ moduleProps, tracker, matches, selectedEvidence, discardedGhosts, keybinds, globalTapEnabled, globalTapSupported, onTap, onSpeedModifierChange, onGlobalTapChange, onResetSession, onDiscardSpeedOutliers }) {
    const visibleMatches = matches.filter((match) => !discardedGhosts.has(match.ghost.id) && matchesEvidence(match.ghost, selectedEvidence));
    let emptyMessage = '';
    if (!tracker.ready) {
        emptyMessage = 'Tap a few consistent footsteps to rank matching profiles.';
    } else if (matches.length === 0) {
        emptyMessage = 'No profile is inside the current tolerance. Check the modifier or retap the sequence.';
    } else if (selectedEvidence.size > 0) {
        emptyMessage = 'No speed matches support the selected evidence.';
    } else {
        emptyMessage = 'All speed matches are currently discarded. Restore them from the ghost reference module.';
    }

    return (
        <ModuleFrame id="trackerDetails" className="tracker-column" {...moduleProps}>
            <ModuleHeading id="trackerDetails" kicker="LIVE MEASUREMENT" title="Tracker details" pinnable={false} {...moduleProps}>
                <span className="confidence-pill" data-level={tracker.confidence}>
                    {tracker.ready ? tracker.confidence.toUpperCase() : 'WAITING'}
                </span>
            </ModuleHeading>

            <div className="metric-grid">
                <article className="metric-card metric-primary">
                    <span className="metric-label">Observed BPM</span>
                    <strong>{formatNumber(tracker.bpm)}</strong>
                    <span className="metric-caption">median of recent intervals</span>
                </article>
                <article className="metric-card">
                    <span className="metric-label">Base speed</span>
                    <strong>{tracker.ready ? formatNumber(tracker.baseSpeedMPS, 2) : '--'}</strong>
                    <span className="metric-caption">m/s before modifier</span>
                    <span className="metric-subvalue">actual: {tracker.ready ? formatNumber(tracker.actualSpeedMPS, 2) : '--'} m/s</span>
                </article>
                <article className="metric-card">
                    <span className="metric-label">Last interval</span>
                    <strong>{tracker.ready ? `${formatNumber(tracker.lastIntervalMS)} ms` : '--'}</strong>
                    <span className="metric-caption">milliseconds</span>
                </article>
                <article className="metric-card">
                    <span className="metric-label">Timing jitter</span>
                    <strong>{tracker.ready ? `${formatNumber(tracker.jitterMS)} ms` : '--'}</strong>
                    <span className="metric-caption">standard deviation</span>
                </article>
            </div>

            <div className="tap-panel">
                <div>
                    <div className="tap-title">Tap on every footstep</div>
                    <p>Use the global <span>{displayBinding(keybinds.tap || 'Space')}</span> listener while the game is focused. It observes input and never blocks the key.</p>
                </div>
                <button className="tap-button" type="button" onClick={onTap}>
                    <span>TAP</span>
                    <kbd>{displayBinding(keybinds.tap || 'Space')}</kbd>
                </button>
            </div>

            <div className="control-row">
                <label className="select-control">
                    <span>Ghost speed modifier</span>
                    <select value={tracker.speedModifier} onChange={(event) => onSpeedModifierChange(Number(event.target.value))}>
                        <option value="0.5">50%</option>
                        <option value="0.75">75%</option>
                        <option value="1">100%</option>
                        <option value="1.25">125%</option>
                        <option value="1.5">150%</option>
                    </select>
                </label>
                <label className="toggle-control">
                    <input type="checkbox" checked={globalTapEnabled} disabled={!globalTapSupported} onChange={(event) => onGlobalTapChange(event.target.checked)} />
                    <span className="toggle-track"><span /></span>
                    <span>Global taps</span>
                </label>
                <button className="quiet-button" type="button" onClick={onResetSession}>
                    Reset session <kbd>{displayBinding(keybinds.fullReset || 'F12')}</kbd>
                </button>
            </div>

            <div className="measurement-note">
                <span className="note-mark">i</span>
                <p>Speed is estimated from BPM using the community footstep model. Treat matches as a shortlist, not proof: line of sight, ghost abilities, missed taps, and patch changes can all affect the result.</p>
            </div>

            <section className="matches-panel">
                <div className="section-heading compact">
                    <div>
                        <div className="kicker">FIRST PASS</div>
                        <h2>Speed shortlist</h2>
                    </div>
                    <div className="module-actions">
                        <span className="subtle">{tracker.ready ? `${visibleMatches.length} possible` : 'No measurement'}</span>
                        <button className="text-button" type="button" disabled={!tracker.ready || matches.length === 0} onClick={onDiscardSpeedOutliers}>Discard outside speed</button>
                    </div>
                </div>
                <div className={`speed-matches${visibleMatches.length === 0 ? ' empty-state' : ''}`} aria-live="polite">
                    {visibleMatches.length === 0 && emptyMessage}
                    {visibleMatches.slice(0, 8).map((match) => (
                        <div className="match-row" key={match.ghost.id}>
                            <div>
                                <strong>{match.ghost.name}</strong>
                                <span>{match.matchingProfiles.map((profile) => profile.label).join(' / ')}</span>
                            </div>
                            <em>{match.matchingProfiles.map((profile) => `${Number(profile.baseMPS).toFixed(2)} m/s`).join(' / ')}</em>
                        </div>
                    ))}
                </div>
            </section>
        </ModuleFrame>
    );
}

export function HuntDetailsModule({ moduleProps, timers, selectedPreset, keybinds, onStartHunt, onEndHunt, onResetTimers, onPresetChange, onStartPreset, onStopPreset }) {
    const timerRunning = timers.active || timers.cooldownStartedAt > 0 || timers.testActive;
    const [now, setNow] = useState(() => performance.now());
    useEffect(() => {
        setNow(performance.now());
        if (!timerRunning) {
            return undefined;
        }
        const interval = window.setInterval(() => setNow(performance.now()), 100);
        return () => window.clearInterval(interval);
    }, [timerRunning, timers.cooldownStartedAt, timers.huntStartedAt, timers.testStartedAt]);

    const currentHuntMs = timers.active ? Math.max(0, now - timers.huntStartedAt) : timers.huntElapsedMs;
    const currentCooldownMs = timers.cooldownStartedAt > 0 ? Math.max(0, now - timers.cooldownStartedAt) : timers.cooldownElapsedMs;
    const testRemainingMs = timers.testActive ? Math.max(0, timers.testDurationMs - Math.max(0, now - timers.testStartedAt)) : 0;
    const timerStatus = timers.active ? 'HUNT ACTIVE' : timers.cooldownStartedAt > 0 ? 'COOLDOWN' : 'READY';
    const statusLevel = timers.active ? 'high' : timers.cooldownStartedAt > 0 ? 'medium' : 'low';

    return (
        <ModuleFrame id="huntDetails" className="hunt-timers-column" {...moduleProps}>
            <ModuleHeading id="huntDetails" kicker="HUNT TIMING" title="Hunt details" pinnable={false} {...moduleProps}>
                <span className="confidence-pill" data-level={statusLevel}>{timerStatus}</span>
            </ModuleHeading>

            <div className="hunt-timer-grid">
                <article className="hunt-timer-card hunt-timer-primary">
                    <span className="metric-label">Current hunt</span>
                    <strong>{timers.active || timers.huntElapsedMs > 0 ? timerDuration(currentHuntMs) : '--:--.-'}</strong>
                    <span className="metric-caption">start on hunt audio, end when it stops</span>
                </article>
                <article className="hunt-timer-card">
                    <span className="metric-label">Post-hunt cooldown</span>
                    <strong>{timers.cooldownStartedAt > 0 || timers.lastCooldownMs > 0 ? timerDuration(currentCooldownMs) : '--:--.-'}</strong>
                    <span className="metric-caption">
                        {timers.cooldownStartedAt > 0 ? 'Waiting for the next natural hunt start' : cooldownAssessment(timers.lastCooldownMs)}
                    </span>
                </article>
                <article className="hunt-timer-card">
                    <span className="metric-label">Last hunt</span>
                    <strong>{timers.lastDurationMs > 0 ? timerDuration(timers.lastDurationMs) : '--:--.-'}</strong>
                    <span className="metric-caption">duration record</span>
                </article>
            </div>

            <div className="hunt-control-row">
                <button className="timer-button timer-button-primary" type="button" disabled={timers.active} onClick={onStartHunt}>
                    Start hunt <kbd>{displayBinding(keybinds.startHunt || 'F10')}</kbd>
                </button>
                <button className="timer-button" type="button" disabled={!timers.active} onClick={onEndHunt}>
                    End hunt <kbd>{displayBinding(keybinds.endHunt || 'F11')}</kbd>
                </button>
                <button className="text-button" type="button" onClick={onResetTimers}>Reset timing</button>
            </div>

            <div className="hunt-test-row">
                <label className="timer-select-control">
                    <span>Ghost test preset</span>
                    <select value={selectedPreset} onChange={(event) => onPresetChange(event.target.value)}>
                        {HUNT_TIMER_PRESETS.map((preset) => (
                            <option value={preset.id} key={preset.id}>{preset.label} - {preset.note}</option>
                        ))}
                    </select>
                </label>
                <button className="timer-button" type="button" onClick={onStartPreset}>Start preset</button>
                <button className="text-button" type="button" disabled={!timers.testActive} onClick={onStopPreset}>Stop preset</button>
                <div className="hunt-test-readout">
                    <span>{timers.testActive ? `${timers.testLabel} - ${timers.testNote}` : 'No preset running'}</span>
                    <strong>{timers.testActive ? timerDuration(testRemainingMs) : '--:--.-'}</strong>
                </div>
            </div>

            <div className="hunt-history">
                {timers.history.length === 0 && <span className="empty-state">No hunt timings recorded this session.</span>}
                {timers.history.map((entry) => (
                    <div className="hunt-history-row" key={entry.id}>
                        <span>Hunt {entry.id}</span>
                        <strong>{timerDuration(entry.durationMs)}</strong>
                        <em>{entry.cooldownMs > 0 ? `cooldown ${timerDuration(entry.cooldownMs)}` : 'cooldown pending'}</em>
                    </div>
                ))}
            </div>
            <div className="hunt-timing-note">Natural hunts only: cursed hunts, custom settings, map size, and ghost abilities can change these timings.</div>
        </ModuleFrame>
    );
}
