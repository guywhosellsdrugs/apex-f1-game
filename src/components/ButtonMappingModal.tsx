import React, { useState, useEffect } from 'react';
import { inputManager, CustomControlBindings, CustomGamepadBindings, DEFAULT_KEY_BINDINGS, DEFAULT_GAMEPAD_BINDINGS } from '../services/inputManager';
import { X, Gamepad2, Keyboard, RotateCcw, Check, Sparkles, AlertCircle, Gauge } from 'lucide-react';
import { UnitSystem, getStoredUnitSystem, setStoredUnitSystem, onUnitSystemChange } from '../utils/units';

interface ButtonMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type KeyAction = keyof CustomControlBindings;
type GamepadAction = keyof CustomGamepadBindings;

const KEY_LABELS: Record<KeyAction, { title: string; desc: string }> = {
  throttle: { title: 'Accelerate / Throttle', desc: 'Accelerate forward' },
  brake: { title: 'Brake / Reverse', desc: 'Decelerate or hold to reverse' },
  steerLeft: { title: 'Steer Left', desc: 'Turn wheels left' },
  steerRight: { title: 'Steer Right', desc: 'Turn wheels right' },
  boost: { title: 'ERS / Overtake Boost', desc: 'Deploy battery energy boost' },
  drs: { title: 'DRS Wing Flap', desc: 'Open rear wing flap in DRS zones' },
  switchCamera: { title: 'Switch Camera', desc: 'Cycle cockpit, chase, nose cam' },
  reset: { title: 'Reset Car', desc: 'Recover car to track center' },
  pause: { title: 'Pause / Options', desc: 'Open in-game pause menu' },
};

const GAMEPAD_LABELS: Record<GamepadAction, { title: string; desc: string }> = {
  throttleButton: { title: 'Throttle', desc: 'Right Trigger / RT (or button)' },
  brakeButton: { title: 'Brake', desc: 'Left Trigger / LT (or button)' },
  boostButton: { title: 'ERS / Boost', desc: 'Overtake button (default: A / Cross)' },
  drsButton: { title: 'DRS Flap', desc: 'DRS button (default: RB / R1)' },
  switchCameraButton: { title: 'Switch Camera', desc: 'Cycle camera (default: Y / Triangle)' },
  resetButton: { title: 'Reset Car', desc: 'Car recovery (default: B / Circle)' },
  pauseButton: { title: 'Pause', desc: 'Pause game (default: Start / Options)' },
};

const GAMEPAD_BUTTON_NAMES: Record<number, string> = {
  0: 'Button A / Cross',
  1: 'Button B / Circle',
  2: 'Button X / Square',
  3: 'Button Y / Triangle',
  4: 'Left Bumper (LB / L1)',
  5: 'Right Bumper (RB / R1)',
  6: 'Left Trigger (LT / L2)',
  7: 'Right Trigger (RT / R2)',
  8: 'Back / Share / Select',
  9: 'Start / Options / Menu',
  10: 'Left Stick Click (L3)',
  11: 'Right Stick Click (R3)',
  12: 'D-Pad Up',
  13: 'D-Pad Down',
  14: 'D-Pad Left',
  15: 'D-Pad Right',
};

export const ButtonMappingModal: React.FC<ButtonMappingModalProps> = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState<'keyboard' | 'gamepad'>('keyboard');
  const [keyBindings, setKeyBindings] = useState<CustomControlBindings>(() => inputManager.getKeyBindings());
  const [gamepadBindings, setGamepadBindings] = useState<CustomGamepadBindings>(() => inputManager.getGamepadBindings());
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(getStoredUnitSystem());

  useEffect(() => {
    return onUnitSystemChange(setUnitSystem);
  }, []);
  
  const [listeningKeyAction, setListeningKeyAction] = useState<KeyAction | null>(null);
  const [listeningGamepadAction, setListeningGamepadAction] = useState<GamepadAction | null>(null);
  
  const [liveInput, setLiveInput] = useState({
    throttle: 0,
    brake: 0,
    steer: 0,
    boost: false,
    isGamepadActive: false,
    gamepadName: null as string | null,
  });

  // Poll live test inputs
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      const state = inputManager.getUnifiedInput();
      setLiveInput({
        throttle: state.throttle,
        brake: state.brake,
        steer: state.steer,
        boost: state.boost,
        isGamepadActive: state.isGamepadActive,
        gamepadName: state.gamepadName,
      });
    }, 50);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Listen for keyboard input when rebinding
  useEffect(() => {
    if (!isOpen || !listeningKeyAction) return;

    const handleKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const newCode = e.code;
      if (newCode === 'Escape') {
        setListeningKeyAction(null);
        return;
      }

      setKeyBindings((prev) => {
        const updated = {
          ...prev,
          [listeningKeyAction]: [newCode],
        };
        inputManager.setKeyBindings(updated);
        return updated;
      });
      setListeningKeyAction(null);
    };

    window.addEventListener('keydown', handleKey, { capture: true });
    return () => window.removeEventListener('keydown', handleKey, { capture: true });
  }, [isOpen, listeningKeyAction]);

  // Listen for gamepad input when rebinding
  useEffect(() => {
    if (!isOpen || !listeningGamepadAction) return;

    let animId: number;
    const pollGamepad = () => {
      if (typeof navigator !== 'undefined' && navigator.getGamepads) {
        const gamepads = navigator.getGamepads();
        for (const gp of gamepads) {
          if (!gp || !gp.connected) continue;
          for (let i = 0; i < gp.buttons.length; i++) {
            if (gp.buttons[i].pressed) {
              setGamepadBindings((prev) => {
                const updated = {
                  ...prev,
                  [listeningGamepadAction]: i,
                };
                inputManager.setGamepadBindings(updated);
                return updated;
              });
              setListeningGamepadAction(null);
              return;
            }
          }
        }
      }
      animId = requestAnimationFrame(pollGamepad);
    };

    animId = requestAnimationFrame(pollGamepad);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, listeningGamepadAction]);

  if (!isOpen) return null;

  const handleResetDefaults = () => {
    inputManager.resetToDefaults();
    setKeyBindings(inputManager.getKeyBindings());
    setGamepadBindings(inputManager.getGamepadBindings());
    setListeningKeyAction(null);
    setListeningGamepadAction(null);
  };

  const formatKeyName = (code: string) => {
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Arrow')) return code.slice(5) + ' Arrow';
    if (code === 'Space') return 'Spacebar';
    if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
    return code;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 max-w-3xl w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white shadow-lg">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                Custom Controls & Button Mapping
              </h2>
              <p className="text-xs text-neutral-400">
                Remap keyboard and controller triggers, steering, and ERS boost to your preferred setup.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Input Gauge Bar */}
        <div className="px-6 py-3 bg-neutral-950 border-b border-neutral-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-neutral-400 uppercase tracking-wider">Live Input Feed:</span>
            {liveInput.isGamepadActive ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[11px] border border-emerald-500/30">
                <Gamepad2 className="w-3.5 h-3.5" />
                {liveInput.gamepadName?.slice(0, 20) || 'Controller Active'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-mono text-[11px] border border-blue-500/30">
                <Keyboard className="w-3.5 h-3.5" />
                Keyboard Active
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 font-mono">
            {/* Throttle Bar */}
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-400">THR:</span>
              <div className="w-16 h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-75"
                  style={{ width: `${Math.round(liveInput.throttle * 100)}%` }}
                />
              </div>
            </div>

            {/* Brake Bar */}
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-400">BRK:</span>
              <div className="w-16 h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all duration-75"
                  style={{ width: `${Math.round(liveInput.brake * 100)}%` }}
                />
              </div>
            </div>

            {/* Steer Bar */}
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-400">STR:</span>
              <div className="w-16 h-2 bg-neutral-800 rounded-full relative overflow-hidden">
                <div
                  className="h-full bg-cyan-400 absolute transition-all duration-75"
                  style={{
                    left: liveInput.steer < 0 ? `${50 + liveInput.steer * 50}%` : '50%',
                    width: `${Math.abs(liveInput.steer) * 50}%`,
                  }}
                />
              </div>
            </div>

            {/* Boost Badge */}
            {liveInput.boost && (
              <span className="px-1.5 py-0.5 bg-amber-500/30 text-amber-300 font-bold rounded animate-pulse text-[10px]">
                ERS ON
              </span>
            )}
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/40 px-6 pt-3">
          <button
            onClick={() => {
              setTab('keyboard');
              setListeningGamepadAction(null);
            }}
            className={`flex items-center gap-2 pb-3 px-4 font-bold text-sm tracking-wide border-b-2 transition-colors ${
              tab === 'keyboard'
                ? 'border-red-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            Keyboard Mapping
          </button>
          <button
            onClick={() => {
              setTab('gamepad');
              setListeningKeyAction(null);
            }}
            className={`flex items-center gap-2 pb-3 px-4 font-bold text-sm tracking-wide border-b-2 transition-colors ${
              tab === 'gamepad'
                ? 'border-red-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            Controller / Gamepad
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {tab === 'keyboard' && (
            <div className="space-y-2.5">
              {(Object.keys(KEY_LABELS) as KeyAction[]).map((action) => {
                const isListening = listeningKeyAction === action;
                const keys = keyBindings[action] || [];
                return (
                  <div
                    key={action}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                      isListening
                        ? 'border-red-500 bg-red-500/10 ring-2 ring-red-500/30'
                        : 'border-neutral-800 bg-neutral-950/50 hover:border-neutral-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-white text-sm">{KEY_LABELS[action].title}</div>
                      <div className="text-xs text-neutral-400">{KEY_LABELS[action].desc}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isListening ? (
                        <div className="px-4 py-1.5 rounded-xl bg-red-600 text-white font-mono text-xs font-bold animate-pulse flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5" />
                          Press Any Key... (Esc to cancel)
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {keys.map((k, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-200 font-mono text-xs font-semibold shadow-sm"
                            >
                              {formatKeyName(k)}
                            </span>
                          ))}
                          <button
                            onClick={() => {
                              setListeningGamepadAction(null);
                              setListeningKeyAction(action);
                            }}
                            className="ml-2 px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-bold transition-colors"
                          >
                            Rebind
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'gamepad' && (
            <div className="space-y-2.5">
              {(Object.keys(GAMEPAD_LABELS) as GamepadAction[]).map((action) => {
                const isListening = listeningGamepadAction === action;
                const buttonIndex = gamepadBindings[action];
                const buttonName = GAMEPAD_BUTTON_NAMES[buttonIndex] || `Button ${buttonIndex}`;

                return (
                  <div
                    key={action}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                      isListening
                        ? 'border-red-500 bg-red-500/10 ring-2 ring-red-500/30'
                        : 'border-neutral-800 bg-neutral-950/50 hover:border-neutral-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-white text-sm">{GAMEPAD_LABELS[action].title}</div>
                      <div className="text-xs text-neutral-400">{GAMEPAD_LABELS[action].desc}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isListening ? (
                        <div className="px-4 py-1.5 rounded-xl bg-red-600 text-white font-mono text-xs font-bold animate-pulse flex items-center gap-2">
                          <Gamepad2 className="w-3.5 h-3.5" />
                          Press Controller Button...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-lg bg-neutral-800 border border-neutral-700 text-amber-300 font-mono text-xs font-semibold shadow-sm">
                            {buttonName}
                          </span>
                          <button
                            onClick={() => {
                              setListeningKeyAction(null);
                              setListeningGamepadAction(action);
                            }}
                            className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-bold transition-colors"
                          >
                            Rebind
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const next = unitSystem === 'metric' ? 'imperial' : 'metric';
                setUnitSystem(next);
                setStoredUnitSystem(next);
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-mono font-bold transition-colors cursor-pointer"
              title="Toggle between American (MPH / Miles) and Metric (KM/H / KM) measurements"
            >
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              <span>{unitSystem === 'imperial' ? '🇺🇸 American (MPH)' : '🌐 Metric (KM/H)'}</span>
            </button>

            <button
              onClick={handleResetDefaults}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restore Factory Defaults
            </button>
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-red-900/30 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
