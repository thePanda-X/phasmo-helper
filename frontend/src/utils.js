export function formatNumber(value, digits = 1) {
    return Number.isFinite(value) && value > 0 ? value.toFixed(digits) : '--';
}

export function timerDuration(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
        return '--:--.-';
    }
    const tenths = Math.round(milliseconds / 100);
    const minutes = Math.floor(tenths / 600);
    const seconds = Math.floor(tenths / 10) % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths % 10}`;
}

export function cooldownAssessment(milliseconds) {
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

export function displayBinding(binding) {
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

export function keybindFromEvent(event) {
    const modifiers = [];
    if (event.ctrlKey) modifiers.push('Ctrl');
    if (event.altKey) modifiers.push('Alt');
    if (event.shiftKey) modifiers.push('Shift');
    if (event.metaKey) modifiers.push('Win');

    const modifierCodes = new Set([
        'ControlLeft',
        'ControlRight',
        'AltLeft',
        'AltRight',
        'ShiftLeft',
        'ShiftRight',
        'MetaLeft',
        'MetaRight',
    ]);
    if (modifierCodes.has(event.code)) {
        return null;
    }
    return [...modifiers, event.code].join('+');
}

export function matchesEvidence(ghost, selectedEvidence) {
    return [...selectedEvidence].every((evidence) => ghost.evidence?.includes(evidence));
}
