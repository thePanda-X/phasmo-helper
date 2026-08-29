import { useEffect, useState } from 'react';

import { EVIDENCE_OPTIONS } from '../constants';
import { moduleGeometry } from '../module-geometry';
import { formatNumber, matchesEvidence, timerDuration } from '../utils';

function overlayGeometry(module, viewport) {
    const { x, y, width, height } = moduleGeometry(module, viewport);
    return {
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
    };
}

function HuntOverlay({ module, viewport, timers }) {
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
    return (
        <article className={`pinned-module pinned-hunt-module${module.collapsed ? ' is-collapsed' : ''}`} style={overlayGeometry(module, viewport)}>
            <header className="pinned-header"><span>HUNT TIMING</span><span>{timers.active ? 'HUNT ACTIVE' : 'PINNED'}</span></header>
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
                <strong>{timers.testActive ? timerDuration(testRemainingMs) : timers.lastDurationMs > 0 ? timerDuration(timers.lastDurationMs) : '--:--.-'}</strong>
            </div>
            <div className="pinned-footer"><span>{timers.testActive ? timers.testNote : 'F10 START / F11 END'}</span><span>{timers.history.length} RECORDS</span></div>
        </article>
    );
}

function EvidenceOverlay({ module, viewport, selectedEvidence }) {
    const selected = EVIDENCE_OPTIONS.filter((evidence) => selectedEvidence.has(evidence.id));
    return (
        <article className={`pinned-module pinned-evidence-module${module.collapsed ? ' is-collapsed' : ''}`} style={overlayGeometry(module, viewport)}>
            <header className="pinned-header"><span>EVIDENCE</span><span>PINNED</span></header>
            <div className="pinned-evidence-list">
                {selected.length === 0 && <span className="pinned-empty">No evidence selected</span>}
                {selected.map((evidence) => <span className="pinned-evidence-chip" key={evidence.id}>{evidence.label}</span>)}
            </div>
            <div className="pinned-footer"><span>CURRENT KNOWLEDGE</span><span>{selectedEvidence.size} SELECTED</span></div>
        </article>
    );
}

function SuspectsOverlay({ module, viewport, rankedGhosts, discardedGhosts, selectedEvidence }) {
    const suspects = rankedGhosts
        .filter((match) => !discardedGhosts.has(match.ghost.id) && matchesEvidence(match.ghost, selectedEvidence))
        .slice(0, 3);
    return (
        <article className={`pinned-module pinned-suspects-module${module.collapsed ? ' is-collapsed' : ''}`} style={overlayGeometry(module, viewport)}>
            <header className="pinned-header"><span>MOST LIKELY</span><span>PINNED</span></header>
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
        </article>
    );
}

function TrackerOverlay({ module, viewport, tracker }) {
    return (
        <article className={`pinned-module${module.collapsed ? ' is-collapsed' : ''}`} style={overlayGeometry(module, viewport)}>
            <header className="pinned-header"><span>STEP TRACKER</span><span>PINNED</span></header>
            <div className="pinned-primary-label">OBSERVED CADENCE</div>
            <strong className="pinned-bpm">{formatNumber(tracker.bpm)}</strong>
            <div className="pinned-metrics">
                <span>base <b>{formatNumber(tracker.baseSpeedMPS, 2)} m/s</b></span>
                <span>actual <b>{formatNumber(tracker.actualSpeedMPS, 2)} m/s</b></span>
                <span>jitter <b>{formatNumber(tracker.jitterMS)} ms</b></span>
            </div>
            <div className="pinned-footer"><span>{tracker.confidence.toUpperCase()} CONFIDENCE</span><span>{tracker.tapCount} taps</span></div>
        </article>
    );
}

function GhostSearchOverlay({ module, viewport, query, ghosts, discardedGhosts, selectedEvidence }) {
    const visibleGhosts = ghosts.filter((ghost) => !discardedGhosts.has(ghost.id) && matchesEvidence(ghost, selectedEvidence));
    return (
        <article className={`pinned-module pinned-ghost-module${module.collapsed ? ' is-collapsed' : ''}`} style={overlayGeometry(module, viewport)}>
            <header className="pinned-header"><span>GHOST REFERENCE</span><span>PINNED</span></header>
            <div className="pinned-query">{query.trim() || 'all ghosts'}</div>
            <div className="pinned-ghost-list">
                {visibleGhosts.length === 0 && <span className="pinned-empty">No matching ghosts</span>}
                {visibleGhosts.slice(0, 4).map((ghost) => (
                    <div className="pinned-ghost-row" key={ghost.id}>
                        <strong>{ghost.name}</strong>
                        <span>{ghost.speedProfiles.map((profile) => `${Number(profile.baseMPS).toFixed(2)} m/s`).join(' / ')}</span>
                    </div>
                ))}
            </div>
            <div className="pinned-footer"><span>OPEN PANEL TO SEARCH</span><span>{visibleGhosts.length} results</span></div>
        </article>
    );
}

export function Overlay({ layout, viewport, tracker, timers, query, ghosts, rankedGhosts, discardedGhosts, selectedEvidence }) {
    return (
        <main className="overlay-view">
            <div className="overlay-stage">
                {Object.entries(layout.modules || {}).filter(([, module]) => module.pinned).map(([moduleID, module]) => {
                    if (moduleID === 'huntTimers') {
                        return <HuntOverlay key={moduleID} module={module} viewport={viewport} timers={timers} />;
                    }
                    if (moduleID === 'evidence') {
                        return <EvidenceOverlay key={moduleID} module={module} viewport={viewport} selectedEvidence={selectedEvidence} />;
                    }
                    if (moduleID === 'topSuspects') {
                        return <SuspectsOverlay key={moduleID} module={module} viewport={viewport} rankedGhosts={rankedGhosts} discardedGhosts={discardedGhosts} selectedEvidence={selectedEvidence} />;
                    }
                    if (moduleID === 'stepTracker') {
                        return <TrackerOverlay key={moduleID} module={module} viewport={viewport} tracker={tracker} />;
                    }
                    if (moduleID === 'ghostSearch') {
                        return <GhostSearchOverlay key={moduleID} module={module} viewport={viewport} query={query} ghosts={ghosts} discardedGhosts={discardedGhosts} selectedEvidence={selectedEvidence} />;
                    }
                    return null;
                })}
            </div>
        </main>
    );
}
