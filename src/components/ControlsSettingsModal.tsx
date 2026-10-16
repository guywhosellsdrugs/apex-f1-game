import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Keyboard, Gamepad2, Check, Sparkles } from 'lucide-react';
import {
  inputManager,
  CustomControlBindings,
  CustomGamepadBindings,
  DEFAULT_KEY_BINDINGS,
  DEFAULT_GAMEPAD_BINDINGS,
} from '../services/inputManager';

interface ControlsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACTION_LABELS: Record<keyof CustomControlBindings, { label: string; desc: string }> = {
  throttle: { label: 'Throttle (Accelerate)', desc: 'Forward drive & launch acceleration' },
  brake: { label: 'Brakes & Reverse', desc: 'Braking deceleration & reverse gear' },
  steerLeft: { label: 'Steer Left', desc: 'Turn vehicle wheel left' },
  steerRight: { label: 'Steer Right', desc: 'Turn vehicle wheel right' },
  boost: { label: 'ERS Battery Boost', desc: 'Deploy hybrid electric overtake power' },
  drs: { label: 'DRS Wing Flap', desc: 'Open rear wing flap in DRS zones' },
  switchCamera: { label: 'Cycle Camera View', desc: 'Toggle chase, close, cockpit, nose cameras' },
  reset: { label: 'Reset Vehicle', desc: 'Recover car back to center of track' },
  pause: { label: 'Pause / Options Menu', desc: 'Open in-race pause and settings' },
};

const GAMEPAD_BUTTON_NAMES: Record<number, string> = {
  0: 'A / Cross (Bottom)',
  1: 'B / Circle (Right)',
  2: 'X / Square (Left)',
  3: 'Y / Triangle (Top)',
  4: 'LB / L1 (Left Bumper)',
  5: 'RB / R1 (Right Bumper)',
  6: 'LT / L2 (Left Trigger)',
  7: 'RT / R2 (Right Trigger)',
  8: 'View / Share / Select',
  9: 'Menu / Start / Options',
  10: 'L3 (Left Stick Click)',
  11: 'R3 (Right Stick Click)',
  12: 'D-Pad Up',
  13: 'D-Pad Down',
  14: 'D-Pad Left',
  15: 'D-Pad Right',
};

function formatKeyName(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return 'Arrow ' + code.slice(5);
  if (code === 'Space') return 'Spacebar';
  if (code === 'ShiftLeft') return 'Left Shift';
  if (code === 'ShiftRight') return 'Right Shift';
  if (code === 'ControlLeft') return 'Left Ctrl';
  if (code === 'Escape') return 'ESC';
  return code;
}

export const ControlsSettingsModal: React.FC<ControlsSettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'keyboard' | 'gamepad'>('keyboard');
  const [keyBindings, setKeyBindings] = useState<CustomControlBindings>(inputManager.getKeyBindings());
  const [gamepadBindings, setGamepadBindings] = useState<CustomGamepadBindings>(inputManager.getGamepadBindings());
  const [listeningAction, setListeningAction] = useState<keyof CustomControlBindings | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setKeyBindings(inputManager.getKeyBindings());
      setGamepadBindings(inputManager.getGamepadBindings());
      setListeningAction(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartRebind = (action: keyof CustomControlBindings) => {
    setListeningAction(action);
    inputManager.startCapturingKey(action, (reboundAction, newKey) => {
      setKeyBindings(inputManager.getKeyBindings());
      setListeningAction(null);
      triggerSuccess();
    });
  };

  const handleResetDefaults = () => {
    inputManager.resetToDefaults();
    setKeyBindings(inputManager.getKeyBindings());
    setGamepadBindings(inputManager.getGamepadBindings());
    setListeningAction(null);
    triggerSuccess();
  };

  const triggerSuccess = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2200);
  };

  const handleGamepadChange = (action: keyof CustomGamepadBindings, btnIndex: number) => {
    inputManager.setGamepadBinding(action, btnIndex);
    setGamepadBindings(inputManager.getGamepadBindings());
    triggerSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 max-w-2xl w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-red-600 flex items-center justify-center text-white shadow-lg">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Custom Button Mapping</h2>
              <p className="text-xs text-neutral-400">Configure custom keyboard & gamepad controls</p>
            </div>
          </div>
          <button
            onClick={() => {
              inputManager.stopCapturingKey();
              onClose();
            }}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-neutral-800 bg-neutral-950/30">
          <button
            onClick={() => {
              inputManager.stopCapturingKey();
              setListeningAction(null);
              setActiveTab('keyboard');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl transition-colors cursor-pointer border-b-2 ${
              activeTab === 'keyboard'
                ? 'border-red-500 text-white bg-neutral-800/80'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Keyboard Mapping</span>
          </button>
          <button
            onClick={() => {
              inputManager.stopCapturingKey();
              setListeningAction(null);
              setActiveTab('gamepad');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl transition-colors cursor-pointer border-b-2 ${
              activeTab === 'gamepad'
                ? 'border-red-500 text-white bg-neutral-800/80'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            <span>Controller / Gamepad</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          {savedSuccess && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold animate-fade-in">
              <Check className="w-4 h-4 shrink-0" />
              <span>Button mappings saved & active for all racing modes!</span>
            </div>
          )}

          {listeningAction && (
            <div className="p-4 bg-amber-500/20 border-2 border-amber-400 rounded-2xl flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-amber-400 animate-spin" />
                <div>
                  <span className="text-xs uppercase tracking-wider font-black text-amber-300">Awaiting Key Press</span>
                  <p className="text-sm font-bold text-white">
                    Press any key to bind to: <span className="text-amber-400">{ACTION_LABELS[listeningAction]?.label}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  inputManager.stopCapturingKey();
                  setListeningAction(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 text-xs font-bold text-neutral-300 hover:bg-neutral-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          {activeTab === 'keyboard' ? (
            <div className="flex flex-col gap-2.5">
              {(Object.keys(ACTION_LABELS) as (keyof CustomControlBindings)[]).map((action) => {
                const keys = keyBindings[action] || [];
                const isListening = listeningAction === action;
                return (
                  <div
                    key={action}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                      isListening
                        ? 'bg-amber-950/40 border-amber-400 ring-1 ring-amber-400'
                        : 'bg-neutral-950/50 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div>
                      <h4 className="text-sm font-bold text-white">{ACTION_LABELS[action].label}</h4>
                      <p className="text-xs text-neutral-400">{ACTION_LABELS[action].desc}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {keys.map((k, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 bg-neutral-800 border border-neutral-700 text-amber-300 text-xs font-mono font-bold rounded-lg shadow-sm"
                          >
                            {formatKeyName(k)}
                          </span>
                        ))}
                      </div>

                      <button
                        onClick={() => handleStartRebind(action)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isListening
                            ? 'bg-amber-500 text-black font-black animate-pulse'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
                        }`}
                      >
                        {isListening ? 'Press Key...' : 'Rebind'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="p-3 bg-neutral-950/70 border border-neutral-800 rounded-xl text-xs text-neutral-400 leading-relaxed">
                Xbox / PlayStation / DirectInput controller button assignment:
              </div>

              {[
                { action: 'throttleButton' as const, label: 'Throttle (Accelerate)', defaultBtn: 7 },
                { action: 'brakeButton' as const, label: 'Brakes & Reverse', defaultBtn: 6 },
                { action: 'boostButton' as const, label: 'ERS Battery Boost', defaultBtn: 0 },
                { action: 'drsButton' as const, label: 'DRS Wing Flap', defaultBtn: 5 },
                { action: 'switchCameraButton' as const, label: 'Cycle Camera View', defaultBtn: 3 },
                { action: 'resetButton' as const, label: 'Reset Vehicle', defaultBtn: 1 },
                { action: 'pauseButton' as const, label: 'Pause Menu', defaultBtn: 9 },
              ].map((item) => (
                <div
                  key={item.action}
                  className="flex items-center justify-between p-3.5 rounded-xl border bg-neutral-950/50 border-neutral-800"
                >
                  <div>
                    <h4 className="text-sm font-bold text-white">{item.label}</h4>
                    <span className="text-[11px] text-neutral-500 font-mono">
                      Current: Button {gamepadBindings[item.action]} ({GAMEPAD_BUTTON_NAMES[gamepadBindings[item.action]] || 'Button'})
                    </span>
                  </div>

                  <select
                    value={gamepadBindings[item.action]}
                    onChange={(e) => handleGamepadChange(item.action, parseInt(e.target.value, 10))}
                    className="bg-neutral-900 border border-neutral-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg focus:outline-none focus:border-red-500 cursor-pointer"
                  >
                    {Object.entries(GAMEPAD_BUTTON_NAMES).map(([btnIdx, name]) => (
                      <option key={btnIdx} value={btnIdx}>
                        Button {btnIdx}: {name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-neutral-800 bg-neutral-950/80">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-neutral-400 hover:text-white bg-neutral-800/60 hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
          </button>

          <button
            onClick={() => {
              inputManager.stopCapturingKey();
              onClose();
            }}
            className="px-6 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
