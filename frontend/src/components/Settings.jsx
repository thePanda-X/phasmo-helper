import { KEYBIND_LABELS, KEYBIND_ROWS } from '../constants';
import { displayBinding } from '../utils';

export function Settings({ keybinds, captureAction, captureStatus, onBeginCapture, onRestoreKeybinds, onRestoreLayout, onOpenSaveFolder }) {
    return (
        <main className="settings-view">
            <section className="settings-intro">
                <div className="kicker">APPLICATION SETTINGS</div>
                <h2>Keybinds</h2>
                <p>Click a binding, then press the key or key combination you want to use. Changes are saved immediately to your user configuration.</p>
            </section>

            <section className="settings-panel">
                <div className="settings-panel-heading">
                    <div>
                        <div className="kicker">GLOBAL INPUT</div>
                        <h3>Investigation controls</h3>
                    </div>
                    <span className="subtle">Windows input monitor</span>
                </div>
                <div className="keybind-list">
                    {KEYBIND_ROWS.map(({ action, description }) => (
                        <div className="keybind-row" key={action}>
                            <div>
                                <strong>{KEYBIND_LABELS[action]}</strong>
                                <span>{description}</span>
                            </div>
                            <button
                                className={`keybind-button${captureAction === action ? ' is-capturing' : ''}`}
                                type="button"
                                aria-label={`Set ${KEYBIND_LABELS[action]} keybind`}
                                onClick={() => onBeginCapture(action)}
                            >
                                {captureAction === action ? 'PRESS A KEY' : displayBinding(keybinds[action] || '')}
                            </button>
                        </div>
                    ))}
                </div>
                <div className="capture-status" role="status" aria-live="polite">{captureStatus}</div>
                <button className="quiet-button settings-reset" type="button" onClick={onRestoreKeybinds}>Restore defaults</button>
                <button className="quiet-button settings-reset" type="button" onClick={onRestoreLayout}>Reset module layout</button>
                <button className="quiet-button settings-reset" type="button" title="Open the folder containing settings.json and overlay-layout.json" onClick={onOpenSaveFolder}>Open save folder</button>
            </section>

            <section className="settings-note">
                <span className="note-mark">i</span>
                <p>The global listener observes key state and does not block or inject keyboard input. Disable Global taps on the field page if you want all global actions paused temporarily.</p>
            </section>
        </main>
    );
}
