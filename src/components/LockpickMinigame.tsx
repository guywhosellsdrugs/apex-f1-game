import React, { useEffect, useRef, useState } from 'react';

export interface LockpickTargetInfo {
  houseId: string;
  name: string;
  hasSecuritySystem: boolean;
  alarmTriggered: boolean;
  pinCount: number;
}

interface LockpickMinigameProps {
  target: LockpickTargetInfo;
  onUnlocked: () => void;
  onTriggerAlarm: () => void;
  onAbort: () => void;
}

export const LockpickMinigame: React.FC<LockpickMinigameProps> = ({
  target,
  onUnlocked,
  onTriggerAlarm,
  onAbort,
}) => {
  const [currentPin, setCurrentPin] = useState(0);
  const [cursorX, setCursorX] = useState(50);
  const [strikes, setStrikes] = useState(0);
  const [alarmTrippedLocal, setAlarmTrippedLocal] = useState(target.alarmTriggered);
  const [statusMsg, setStatusMsg] = useState(
    '🔒 Door is LOCKED — press [SPACE] or click PICK PIN inside the green sweet spot!'
  );
  const [unlockedDone, setUnlockedDone] = useState(false);

  const sweetSpotsRef = useRef<number[]>(
    Array.from({ length: target.pinCount }, (_, i) => 22 + ((i * 29 + 17) % 56))
  );
  const cursorRef = useRef(50);
  const dirRef = useRef(1);
  const alarmSentRef = useRef(target.alarmTriggered);
  const callbacksRef = useRef({ onUnlocked, onTriggerAlarm, onAbort });
  callbacksRef.current = { onUnlocked, onTriggerAlarm, onAbort };

  const maxStrikes = 3;
  const sweetHalfWidth = 11.5;

  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();
    const speedPerSec = 78 + currentPin * 16;

    const loop = (now: number) => {
      const dt = Math.min(0.04, (now - lastTs) / 1000);
      lastTs = now;
      if (!unlockedDone) {
        let next = cursorRef.current + dirRef.current * speedPerSec * dt;
        if (next >= 92) {
          next = 92;
          dirRef.current = -1;
        } else if (next <= 8) {
          next = 8;
          dirRef.current = 1;
        }
        cursorRef.current = next;
        setCursorX(next);
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [currentPin, unlockedDone]);

  const attemptPickPin = () => {
    if (unlockedDone) return;

    // If this house has a Home Security System, attempting to pick its lock immediately trips the police alarm!
    if (target.hasSecuritySystem && !alarmSentRef.current) {
      alarmSentRef.current = true;
      setAlarmTrippedLocal(true);
      callbacksRef.current.onTriggerAlarm();
    }

    const spot = sweetSpotsRef.current[currentPin] ?? 50;
    const delta = Math.abs(cursorRef.current - spot);
    if (delta <= sweetHalfWidth) {
      const nextPin = currentPin + 1;
      if (nextPin >= target.pinCount) {
        setUnlockedDone(true);
        setStatusMsg('🔓 CLICK! ALL PINS SET — BREACHING DOOR NOW!');
        setTimeout(() => {
          callbacksRef.current.onUnlocked();
        }, 480);
      } else {
        setCurrentPin(nextPin);
        setStatusMsg(
          alarmSentRef.current
            ? `🚨 PIN ${nextPin}/${target.pinCount} PICKED — ALARM BLARING! POLICE INBOUND!`
            : `✅ PIN ${nextPin}/${target.pinCount} SET! Pick next tumbler...`
        );
      }
    } else {
      const nextStrikes = strikes + 1;
      setStrikes(nextStrikes);
      if (nextStrikes >= maxStrikes) {
        setStatusMsg('💥 PICK SNAPPED! Forced to abort & flee!');
        setTimeout(() => {
          callbacksRef.current.onAbort();
        }, 650);
      } else {
        setStatusMsg(
          alarmSentRef.current
            ? `⚠️ SLIPPED (${nextStrikes}/${maxStrikes}) — POLICE SIRENS CLOSING IN!`
            : `❌ Missed tumbler! (${nextStrikes}/${maxStrikes} picks left)`
        );
      }
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        attemptPickPin();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        callbacksRef.current.onAbort();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  });

  const activeSpot = sweetSpotsRef.current[currentPin] ?? 50;

  return (
    <div className="fixed inset-0 z-[92] w-screen h-screen bg-zinc-950 flex items-center justify-center p-6 font-mono select-none">
      <div
        className={`w-full max-w-2xl rounded-2xl bg-zinc-900/90 border-2 shadow-2xl overflow-hidden ${
          alarmTrippedLocal
            ? 'border-red-500 shadow-[0_0_45px_rgba(239,68,68,0.55)]'
            : 'border-amber-400 shadow-[0_0_40px_rgba(250,204,21,0.35)]'
        }`}
      >
        {/* Header */}
        <div className="bg-zinc-900 border-b border-white/15 px-4 py-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-400 text-black font-black text-[10px] uppercase">
                🔑 LOCKPICKING
              </span>
              {target.hasSecuritySystem && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    alarmTrippedLocal
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                  }`}
                >
                  {alarmTrippedLocal ? '🚨 ALARM TRIPPED!' : '📡 SECURITY SENSOR DETECTED'}
                </span>
              )}
            </div>
            <div className="text-sm font-black text-white mt-1 truncate">{target.name}</div>
          </div>

          <button
            type="button"
            onClick={onAbort}
            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/15 text-[10px] font-black cursor-pointer shrink-0"
          >
            ✖ FLEE / ESC
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {alarmTrippedLocal && (
            <div className="bg-red-950/90 border border-red-400 rounded-xl px-3.5 py-2.5 text-xs font-black text-red-100 animate-pulse text-center">
              🚨 HOME SECURITY SYSTEM TRIGGERED! POLICE HAVE BEEN DISPATCHED TO ARREST YOU!
            </div>
          )}

          {/* Tumbler Pins Visual */}
          <div className="bg-black/70 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-3">
              <span>
                TUMBLER PINS: <strong className="text-amber-300">{currentPin}/{target.pinCount}</strong>
              </span>
              <span>
                STRIKES:{' '}
                <strong className={strikes > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                  {strikes}/{maxStrikes}
                </strong>
              </span>
            </div>

            <div className="flex items-end justify-center gap-4 h-20 bg-zinc-900/90 rounded-lg border border-white/10 px-4 py-2 mb-4">
              {Array.from({ length: target.pinCount }).map((_, idx) => {
                const picked = idx < currentPin || unlockedDone;
                const active = idx === currentPin && !unlockedDone;
                return (
                  <div key={idx} className="flex flex-col items-center gap-1">
                    <div
                      className={`w-7 rounded-t transition-all duration-150 border ${
                        picked
                          ? 'h-6 bg-emerald-400 border-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.7)]'
                          : active
                          ? 'h-11 bg-amber-400 border-amber-200 animate-pulse'
                          : 'h-12 bg-zinc-700 border-zinc-500'
                      }`}
                    />
                    <span className="text-[9px] font-bold text-zinc-400">#{idx + 1}</span>
                  </div>
                );
              })}
            </div>

            {/* Timing Sweet-Spot Slider */}
            <div
              onClick={attemptPickPin}
              className="relative h-9 bg-zinc-900 border border-white/20 rounded-lg overflow-hidden cursor-pointer"
            >
              {/* Sweet Spot Zone */}
              <div
                className="absolute top-0 bottom-0 bg-emerald-500/35 border-x-2 border-emerald-400"
                style={{
                  left: `${activeSpot - sweetHalfWidth}%`,
                  width: `${sweetHalfWidth * 2}%`,
                }}
              />
              {/* Moving Pick Needle */}
              <div
                className="absolute top-0 bottom-0 w-1.5 -ml-[3px] bg-amber-300 shadow-[0_0_10px_#fde047]"
                style={{ left: `${cursorX}%` }}
              />
            </div>
          </div>

          <div className="text-center text-xs font-bold text-zinc-200">{statusMsg}</div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={attemptPickPin}
              disabled={unlockedDone}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 text-black font-black text-sm uppercase tracking-wider shadow-lg cursor-pointer disabled:opacity-50"
            >
              🔑 [SPACE] PICK PIN #{Math.min(target.pinCount, currentPin + 1)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
