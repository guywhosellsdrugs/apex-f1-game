import React, { useState, useEffect, useRef } from 'react';
import {
  Flag,
  Zap,
  Trophy,
  Gauge,
  Radio,
  Wrench,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  Keyboard,
  Sparkles,
  ArrowRight,
  Timer,
  Play,
  Palette,
  Cpu,
} from 'lucide-react';
import {
  GraphicsQuality,
  GRAPHICS_QUALITY_OPTIONS,
  GRAPHICS_PRESETS,
  getStoredGraphicsQuality,
  setStoredGraphicsQuality,
} from '../utils/graphicsSettings';
import {
  AppThemeId,
  APP_THEMES,
  THEME_OPTIONS,
  getStoredTheme,
  setStoredTheme,
} from '../utils/themeSettings';

export interface TutorialPracticeDrillConfig {
  id: string;
  stepIndex: number;
  circuitId: string;
  laps: number;
  difficulty: 'rookie' | 'pro' | 'legend';
  botCount: number;
  title: string;
  subtitle: string;
  objectives: string[];
}

export const TUTORIAL_PRACTICE_DRILLS: Record<number, TutorialPracticeDrillConfig> = {
  0: {
    id: 'drill_shakedown',
    stepIndex: 0,
    circuitId: 'bahrain',
    laps: 1,
    difficulty: 'rookie',
    botCount: 0,
    title: 'Practice Drill 1: Solo Shakedown & 3D Racing Line (Bahrain · 1 Lap)',
    subtitle:
      'Drive 1 flying lap at Bahrain with the 3D Optimal Racing Line [L] active. Follow the green acceleration & red braking chevrons!',
    objectives: [
      'Accelerate past 250 km/h [W / ↑]',
      'Use [E / Space] ERS & DRS on the straight',
      'Follow the 3D Racing Line [L] through turns',
    ],
  },
  1: {
    id: 'drill_tires_and_apex',
    stepIndex: 1,
    circuitId: 'silverstone',
    laps: 2,
    difficulty: 'rookie',
    botCount: 7,
    title: 'Practice Race 2: Tire Life, Apex Grip & [P] Pit Box Drill (Silverstone · 2 Laps)',
    subtitle:
      'Feel how Soft vs Medium vs Hard tires wear down in high-speed corners, and press [P] (or click BOX 100% on the HUD) for fresh tires!',
    objectives: [
      'Trail-brake into Maggotts & Becketts',
      'Watch Tire Life % & Grip % on the HUD',
      'Press [P] to Pit for fresh 100% tires',
    ],
  },
  2: {
    id: 'drill_radio_and_pack',
    stepIndex: 2,
    circuitId: 'monza',
    laps: 2,
    difficulty: 'rookie',
    botCount: 19,
    title: 'Practice Race 3: Full Grid Slipstream & Teammate Radio Battle (Monza · 2 Laps)',
    subtitle:
      'Race a 20-car practice grid at the Temple of Speed! Draft in the slipstream pocket and press [1]–[4] to command your teammate.',
    objectives: [
      'Catch a Slipstream tow behind a rival car',
      'Press [1] Block or [2] Yield on Team Radio',
      'Overtake into the Monza chicane',
    ],
  },
  3: {
    id: 'drill_graduation_gp',
    stepIndex: 3,
    circuitId: 'abudhabi',
    laps: 2,
    difficulty: 'rookie',
    botCount: 19,
    title: 'Practice Race 4: Final Academy Graduation Race (Abu Dhabi · 2 Laps)',
    subtitle:
      'Put everything together under the Yas Marina floodlights—launch reaction, tire life management, pit stop strategy, and teammate radio!',
    objectives: [
      'Clean launch off the 5 red lights',
      'Manage Tire Life or Pit [P] for Softs',
      'Finish the 2-Lap Graduation Practice Race',
    ],
  },
};

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStep?: number;
  completedDrills?: string[];
  onLaunchPracticeDrill?: (drill: TutorialPracticeDrillConfig) => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({
  isOpen,
  onClose,
  initialStep = 0,
  completedDrills = [],
  onLaunchPracticeDrill,
}) => {
  const [currentStep, setCurrentStep] = useState(initialStep);

  useEffect(() => {
    if (isOpen && typeof initialStep === 'number') {
      setCurrentStep(Math.max(0, Math.min(3, initialStep)));
    }
  }, [isOpen, initialStep]);

  // ============================================================================
  // STEP 1 STATE: INTERACTIVE COCKPIT & 5-LIGHT LAUNCH REACTION CHALLENGE
  // ============================================================================
  const [activeKeys, setActiveKeys] = useState<Record<string, boolean>>({});
  const [simSpeed, setSimSpeed] = useState(0);
  const [simSteer, setSimSteer] = useState(0); // -1 left, 0 center, 1 right
  const [simDrs, setSimDrs] = useState(false);
  const [simErs, setSimErs] = useState(false);
  const [simCamera, setSimCamera] = useState<'CHASE' | 'COCKPIT' | 'NOSE'>('CHASE');
  const [verifiedSystems, setVerifiedSystems] = useState<{
    throttle: boolean;
    brake: boolean;
    steer: boolean;
    drs: boolean;
    ers: boolean;
  }>({
    throttle: false,
    brake: false,
    steer: false,
    drs: false,
    ers: false,
  });

  // 5-Red-Lights Reaction Mini-Game State
  const [launchState, setLaunchState] = useState<'idle' | 'counting' | 'lights_out' | 'result' | 'jump_start'>('idle');
  const [launchLights, setLaunchLights] = useState(0);
  const [lightsOutTimestamp, setLightsOutTimestamp] = useState<number>(0);
  const [reactionMs, setReactionMs] = useState<number | null>(null);
  const [bestReactionMs, setBestReactionMs] = useState<number | null>(null);
  const launchTimersRef = useRef<number[]>([]);

  const clearLaunchTimers = () => {
    launchTimersRef.current.forEach((id) => window.clearTimeout(id));
    launchTimersRef.current = [];
  };

  useEffect(() => {
    return () => clearLaunchTimers();
  }, []);

  const startLaunchChallenge = () => {
    clearLaunchTimers();
    setLaunchState('counting');
    setLaunchLights(1);
    setReactionMs(null);

    for (let i = 2; i <= 5; i++) {
      const tId = window.setTimeout(() => {
        setLaunchLights(i);
      }, (i - 1) * 650);
      launchTimersRef.current.push(tId);
    }

    const randomHold = 600 + Math.random() * 1400;
    const outId = window.setTimeout(() => {
      setLaunchLights(0);
      setLaunchState('lights_out');
      setLightsOutTimestamp(performance.now());
    }, 4 * 650 + randomHold);
    launchTimersRef.current.push(outId);
  };

  const triggerLaunchPedal = () => {
    if (launchState === 'counting') {
      clearLaunchTimers();
      setLaunchState('jump_start');
      setLaunchLights(0);
      return;
    }
    if (launchState === 'lights_out') {
      const elapsed = Math.max(12, Math.round(performance.now() - lightsOutTimestamp));
      setReactionMs(elapsed);
      setBestReactionMs((prev) => (prev === null ? elapsed : Math.min(prev, elapsed)));
      setLaunchState('result');
      setVerifiedSystems((prev) => ({ ...prev, throttle: true }));
    }
  };

  // ============================================================================
  // STEP 2 STATE: INTERACTIVE CORNERING, TIRE LIFE & PIT STOP SIMULATOR
  // ============================================================================
  const [brakeMarker, setBrakeMarker] = useState<'150m' | '100m' | '35m'>('100m');
  const [apexLine, setApexLine] = useState<'early' | 'optimal' | 'defensive'>('optimal');
  const [tireCompound, setTireCompound] = useState<'soft' | 'medium' | 'hard'>('soft');
  const [simTireLife, setSimTireLife] = useState<number>(92);
  const [cornerProgress, setCornerProgress] = useState<number>(100);
  const [isSimulatingCorner, setIsSimulatingCorner] = useState(false);

  const runCornerSimulation = () => {
    setIsSimulatingCorner(true);
    setCornerProgress(0);
    // Simulate real tire wear per hard corner pass based on compound & braking aggressiveness
    const wearHit =
      (tireCompound === 'soft' ? 14 : tireCompound === 'medium' ? 9 : 5) +
      (brakeMarker === '35m' ? 12 : brakeMarker === '100m' ? 3 : 1);
    setSimTireLife((prev) => Math.max(5, prev - wearHit));
  };

  const pitForFreshTiresInLab = (newComp?: 'soft' | 'medium' | 'hard') => {
    if (newComp) setTireCompound(newComp);
    setSimTireLife(100);
  };

  useEffect(() => {
    if (!isSimulatingCorner) return;
    const interval = window.setInterval(() => {
      setCornerProgress((prev) => {
        if (prev >= 100) {
          setIsSimulatingCorner(false);
          return 100;
        }
        return prev + 4;
      });
    }, 28);
    return () => window.clearInterval(interval);
  }, [isSimulatingCorner]);

  // Compute simulated cornering telemetry including Tire Life impact!
  const cornerTelemetry = React.useMemo(() => {
    let apexSpeed = 148;
    let exitSpeed = 268;
    let deltaSec = 0.0;
    let verdict = 'OPTIMAL PURPLE SECTOR';
    let statusColor = 'text-emerald-400';

    if (brakeMarker === '100m') {
      deltaSec -= 0.28;
      exitSpeed += 12;
    } else if (brakeMarker === '150m') {
      deltaSec += 0.42;
      apexSpeed -= 14;
      exitSpeed -= 8;
    } else {
      deltaSec += 1.15;
      apexSpeed -= 28;
      exitSpeed -= 34;
    }

    if (apexLine === 'optimal') {
      deltaSec -= 0.14;
      exitSpeed += 14;
    } else if (apexLine === 'early') {
      deltaSec += 0.35;
      exitSpeed -= 18;
    } else {
      deltaSec += 0.18;
      apexSpeed -= 6;
    }

    if (tireCompound === 'soft') {
      apexSpeed += 8;
      deltaSec -= 0.12;
    } else if (tireCompound === 'hard') {
      apexSpeed -= 7;
      deltaSec += 0.12;
    }

    // Tire Life Grip Multiplier Impact (Real Tire Cliff!)
    const lifeGripFactor =
      simTireLife >= 70
        ? 1.0
        : simTireLife >= 40
        ? 0.88 + ((simTireLife - 40) / 30) * 0.12
        : 0.65 + (simTireLife / 40) * 0.23;

    if (simTireLife < 40) {
      const penaltySec = Number(((1 - lifeGripFactor) * 3.4).toFixed(2));
      deltaSec += penaltySec;
      apexSpeed = Math.round(apexSpeed * lifeGripFactor);
      exitSpeed = Math.round(exitSpeed * (0.85 + lifeGripFactor * 0.15));
    } else if (simTireLife < 70) {
      deltaSec += 0.22;
      apexSpeed -= 9;
    }

    if (simTireLife < 35) {
      verdict = '⚠️ TIRE CLIFF / BLISTERING! PRESS [P] BOX FOR FRESH 100% TIRES!';
      statusColor = 'text-red-400';
    } else if (brakeMarker === '35m') {
      verdict = 'TIRE LOCKUP & WIDE RUNOFF!';
      statusColor = 'text-red-400';
    } else if (deltaSec <= -0.25) {
      verdict = '🏆 PURPLE SECTOR — PERFECT TRAIL-BRAKE & FRESH TIRE GRIP!';
      statusColor = 'text-purple-400';
    } else if (deltaSec <= 0.15) {
      verdict = '✓ GREEN SECTOR — CLEAN EXIT SPEED';
      statusColor = 'text-emerald-400';
    } else {
      verdict = '⚠️ YELLOW SECTOR — TIME LOST ON ENTRY/EXIT OR TIRE GRAINING';
      statusColor = 'text-amber-400';
    }

    return {
      apexSpeed,
      exitSpeed,
      deltaSec,
      verdict,
      statusColor,
      gripPct: Math.round(
        (tireCompound === 'soft' ? 107 : tireCompound === 'medium' ? 100 : 95) * lifeGripFactor
      ),
    };
  }, [brakeMarker, apexLine, tireCompound, simTireLife]);

  // ============================================================================
  // STEP 3 STATE: INTERACTIVE PIT WALL RADIO & ENGINE DYNO SANDBOX
  // ============================================================================
  const [selectedOrder, setSelectedOrder] = useState<'block' | 'yield' | 'push' | 'neutral'>('block');
  const [radioReply, setRadioReply] = useState<string>(
    'Copy that! Moving to the center lane to hold up the chasing pack (-18% rival pace).'
  );
  const [radioAccepted, setRadioAccepted] = useState(true);
  const [dynoBoostHp, setDynoBoostHp] = useState<number>(25);
  const [dynoTestResult, setDynoTestResult] = useState<{
    passed: boolean;
    topSpeedKmh: number;
    message: string;
  } | null>(null);

  const issueSimulatedRadioOrder = (order: 'block' | 'yield' | 'push' | 'neutral') => {
    setSelectedOrder(order);
    if (order === 'block') {
      setRadioAccepted(true);
      setRadioReply('Esteban Ocon #31: "Copy Pit Wall. Defending inside line and backing up the DRS train!"');
    } else if (order === 'yield') {
      setRadioAccepted(true);
      setRadioReply('Esteban Ocon #31: "Understood. Lifting 35% on the straight—come on through, mate!"');
    } else if (order === 'push') {
      setRadioAccepted(true);
      setRadioReply('Esteban Ocon #31: "Full MGU-K overtake mode deployed (+12 km/h). Hunting the podium!"');
    } else {
      setRadioAccepted(true);
      setRadioReply('Esteban Ocon #31: "Roger that, managing my own pace and tires."');
    }
  };

  const runSimulatedDynoPull = () => {
    const reliabilityChance = dynoBoostHp <= 25 ? 0.92 : dynoBoostHp <= 35 ? 0.78 : 0.62;
    const passed = Math.random() < reliabilityChance;
    const topSpeedKmh = Math.round(338 + (dynoBoostHp / 45) * 20);
    if (passed) {
      setDynoTestResult({
        passed: true,
        topSpeedKmh,
        message: `DYNO VERIFIED: +${dynoBoostHp} HP Power Unit calibrated! Projected Straight-Line Speed: ${topSpeedKmh} km/h.`,
      });
    } else {
      setDynoTestResult({
        passed: false,
        topSpeedKmh: 336,
        message: `TURBO OVERHEAT AT +${dynoBoostHp} HP! Lower boost slightly or hire a Chief Engine Scientist to stabilize high-HP pulls.`,
      });
    }
  };

  // ============================================================================
  // STEP 4 STATE: INTERACTIVE QUALIFYING GHOST, CRISP 60+ FPS, RETRO & THEME SETUP
  // ============================================================================
  const [ghostDelay3s, setGhostDelay3s] = useState<boolean>(() => {
    try {
      return localStorage.getItem('apex26_qualifying_ghost_delay_3s') !== 'false';
    } catch {
      return true;
    }
  });
  const [selectedGfx, setSelectedGfx] = useState<GraphicsQuality>(getStoredGraphicsQuality());
  const [selectedTheme, setSelectedTheme] = useState<AppThemeId>(getStoredTheme());

  const handleToggleGhostDelay = (delay3s: boolean) => {
    setGhostDelay3s(delay3s);
    try {
      localStorage.setItem('apex26_qualifying_ghost_delay_3s', String(delay3s));
    } catch {}
  };

  const handleSelectGraphics = (q: GraphicsQuality) => {
    setSelectedGfx(q);
    setStoredGraphicsQuality(q);
  };

  const handleSelectTheme = (t: AppThemeId) => {
    setSelectedTheme(t);
    setStoredTheme(t);
  };

  const handleActivateRetroBundle = () => {
    handleSelectGraphics('retro');
    handleSelectTheme('retro');
  };

  // Live Keyboard Listener for Step 1 Interactive Cockpit & Launch Challenge
  useEffect(() => {
    if (!isOpen || currentStep !== 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      setActiveKeys((prev) => ({ ...prev, [k]: true, [e.code]: true }));

      if (k === 'w' || e.key === 'ArrowUp') {
        setVerifiedSystems((prev) => ({ ...prev, throttle: true }));
        if (launchState === 'counting' || launchState === 'lights_out') {
          triggerLaunchPedal();
        }
      }
      if (k === 's' || e.key === 'ArrowDown') {
        setVerifiedSystems((prev) => ({ ...prev, brake: true }));
      }
      if (k === 'a' || e.key === 'ArrowLeft' || k === 'd' || e.key === 'ArrowRight') {
        setVerifiedSystems((prev) => ({ ...prev, steer: true }));
      }
      if (e.code === 'Space' || k === ' ') {
        setSimDrs((prev) => !prev);
        setVerifiedSystems((prev) => ({ ...prev, drs: true }));
        if (launchState === 'counting' || launchState === 'lights_out') {
          triggerLaunchPedal();
        }
      }
      if (k === 'e' || e.key === 'Shift') {
        setSimErs(true);
        setVerifiedSystems((prev) => ({ ...prev, ers: true }));
      }
      if (k === 'c') {
        setSimCamera((prev) => (prev === 'CHASE' ? 'COCKPIT' : prev === 'COCKPIT' ? 'NOSE' : 'CHASE'));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      setActiveKeys((prev) => ({ ...prev, [k]: false, [e.code]: false }));
      if (k === 'e' || e.key === 'Shift') {
        setSimErs(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, currentStep, launchState, lightsOutTimestamp]);

  // Live speed/steering physics loop for Step 1 Cockpit Rig
  useEffect(() => {
    if (!isOpen || currentStep !== 0) return;
    const interval = setInterval(() => {
      const isAccel = activeKeys['w'] || activeKeys['ArrowUp'];
      const isBrake = activeKeys['s'] || activeKeys['ArrowDown'];
      const isLeft = activeKeys['a'] || activeKeys['ArrowLeft'];
      const isRight = activeKeys['d'] || activeKeys['ArrowRight'];

      setSimSteer(isLeft ? -1 : isRight ? 1 : 0);
      setSimSpeed((prev) => {
        const top = 315 + (simDrs ? 16 : 0) + (simErs ? 14 : 0);
        if (isAccel) return Math.min(top, prev + (simErs ? 16 : 11));
        if (isBrake) return Math.max(0, prev - 22);
        return Math.max(0, prev - 4);
      });
    }, 50);
    return () => clearInterval(interval);
  }, [isOpen, currentStep, activeKeys, simDrs, simErs]);

  if (!isOpen) return null;

  const verifiedCount = Object.values(verifiedSystems).filter(Boolean).length;

  const handleFinish = () => {
    try {
      localStorage.setItem('apex26_tutorial_completed', 'true');
    } catch {}
    onClose();
  };

  // Helper to render the On-Track Practice Race Launch Card for each Tutorial Step
  const renderOnTrackPracticeCard = (stepIdx: number) => {
    const drill = TUTORIAL_PRACTICE_DRILLS[stepIdx];
    if (!drill || !onLaunchPracticeDrill) return null;
    const isPassed = completedDrills.includes(drill.id);

    return (
      <div
        className={`p-4 rounded-2xl border-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
          isPassed
            ? 'bg-emerald-950/40 border-emerald-500/60'
            : 'bg-gradient-to-r from-emerald-950/70 via-neutral-950 to-teal-950/60 border-emerald-400/70 shadow-lg shadow-emerald-950/30'
        }`}
      >
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-400 text-black font-mono font-black text-[10px] uppercase">
              {isPassed ? '✓ ON-TRACK PRACTICE COMPLETED' : 'LIVE 3D ON-TRACK PRACTICE RACE'}
            </span>
            <span className="text-xs font-mono text-emerald-300 font-bold">
              {drill.laps} {drill.laps === 1 ? 'Lap' : 'Laps'} · {drill.botCount === 0 ? 'Solo Track' : `${drill.botCount + 1}-Car Grid`}
            </span>
          </div>
          <h4 className="text-sm font-black text-white">{drill.title}</h4>
          <p className="text-xs text-neutral-300 leading-relaxed">{drill.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => onLaunchPracticeDrill(drill)}
          className="px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{isPassed ? 'Replay Practice Race' : 'Drive Practice Race Now'}</span>
        </button>
      </div>
    );
  };

  const steps = [
    {
      id: 'interactive_rig',
      badge: 'STEP 1 OF 4 • COCKPIT RIG, 5-LIGHT REACTION & SHAKEDOWN LAP',
      title: 'Interactive Cockpit Check & On-Track Shakedown Lap',
      subtitle:
        'Test your controls below, measure your FIA 5-light reaction time, then jump straight into a 1-Lap Solo Practice Shakedown at Bahrain!',
      icon: Keyboard,
      content: (
        <div className="space-y-4">
          {renderOnTrackPracticeCard(0)}

          {/* Systems Verification Progress Bar */}
          <div className="p-3.5 rounded-2xl bg-neutral-950 border border-white/10 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Interactive Cockpit Systems Check ({verifiedCount}/5 Verified)
              </span>
              <span className="font-mono text-[11px] text-emerald-400 font-bold">
                {verifiedCount === 5 ? '✓ ALL COCKPIT SYSTEMS GO!' : 'Click buttons or press keys to test'}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[
                {
                  key: 'throttle',
                  label: '1. Throttle [W]',
                  done: verifiedSystems.throttle,
                  onClick: () => {
                    setVerifiedSystems((p) => ({ ...p, throttle: true }));
                    setSimSpeed((s) => Math.min(340, s + 95));
                  },
                },
                {
                  key: 'brake',
                  label: '2. Brakes [S]',
                  done: verifiedSystems.brake,
                  onClick: () => {
                    setVerifiedSystems((p) => ({ ...p, brake: true }));
                    setSimSpeed((s) => Math.max(0, s - 90));
                  },
                },
                {
                  key: 'steer',
                  label: '3. Steer [A/D]',
                  done: verifiedSystems.steer,
                  onClick: () => {
                    setVerifiedSystems((p) => ({ ...p, steer: true }));
                    setSimSteer((st) => (st === 0 ? -1 : st === -1 ? 1 : 0));
                  },
                },
                {
                  key: 'drs',
                  label: '4. DRS [Space]',
                  done: verifiedSystems.drs,
                  onClick: () => {
                    setSimDrs((d) => !d);
                    setVerifiedSystems((p) => ({ ...p, drs: true }));
                  },
                },
                {
                  key: 'ers',
                  label: '5. ERS Boost [E]',
                  done: verifiedSystems.ers,
                  onClick: () => {
                    setSimErs((e) => !e);
                    setVerifiedSystems((p) => ({ ...p, ers: true }));
                  },
                },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  className={`py-2 px-2 rounded-xl border text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    item.done
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-sm'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600'
                  }`}
                >
                  {item.done && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Live Interactive Telemetry Dashboard + Clickable Pedals/Wheel */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 border border-red-500/40 shadow-inner">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              {/* Left: Clickable & Keyboard-Reactive Controls */}
              <div className="flex flex-col items-center gap-2.5 bg-black/50 p-3.5 rounded-xl border border-white/5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onMouseDown={() => {
                      setActiveKeys((p) => ({ ...p, w: true }));
                      setVerifiedSystems((p) => ({ ...p, throttle: true }));
                    }}
                    onMouseUp={() => setActiveKeys((p) => ({ ...p, w: false }))}
                    onMouseLeave={() => setActiveKeys((p) => ({ ...p, w: false }))}
                    onClick={() => {
                      setVerifiedSystems((p) => ({ ...p, throttle: true }));
                      setSimSpeed((s) => Math.min(342, s + 85));
                    }}
                    className={`w-16 h-12 rounded-xl font-black text-xs flex flex-col items-center justify-center border transition-all cursor-pointer ${
                      activeKeys['w'] || activeKeys['ArrowUp']
                        ? 'bg-emerald-500 text-black border-emerald-300 scale-95 shadow-lg shadow-emerald-500/30'
                        : 'bg-neutral-900 text-neutral-200 border-neutral-700 hover:border-emerald-400'
                    }`}
                  >
                    <span>W / ↑</span>
                    <span className="text-[8px] uppercase">Gas</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSimSteer(-1);
                      setVerifiedSystems((p) => ({ ...p, steer: true }));
                    }}
                    className={`w-14 h-11 rounded-xl font-black text-xs flex flex-col items-center justify-center border transition-all cursor-pointer ${
                      simSteer === -1
                        ? 'bg-cyan-400 text-black border-cyan-200 scale-95'
                        : 'bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-cyan-400'
                    }`}
                  >
                    <span>A / ←</span>
                    <span className="text-[8px]">LEFT</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSimSpeed((s) => Math.max(0, s - 110));
                      setVerifiedSystems((p) => ({ ...p, brake: true }));
                    }}
                    className={`w-16 h-11 rounded-xl font-black text-xs flex flex-col items-center justify-center border transition-all cursor-pointer ${
                      activeKeys['s'] || activeKeys['ArrowDown']
                        ? 'bg-red-500 text-white border-red-300 scale-95'
                        : 'bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-red-400'
                    }`}
                  >
                    <span>S / ↓</span>
                    <span className="text-[8px]">BRAKE</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSimSteer(1);
                      setVerifiedSystems((p) => ({ ...p, steer: true }));
                    }}
                    className={`w-14 h-11 rounded-xl font-black text-xs flex flex-col items-center justify-center border transition-all cursor-pointer ${
                      simSteer === 1
                        ? 'bg-cyan-400 text-black border-cyan-200 scale-95'
                        : 'bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-cyan-400'
                    }`}
                  >
                    <span>D / →</span>
                    <span className="text-[8px]">RIGHT</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 w-full mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSimDrs((d) => !d);
                      setVerifiedSystems((p) => ({ ...p, drs: true }));
                    }}
                    className={`flex-1 py-2 rounded-lg font-black text-[10px] uppercase border transition-all cursor-pointer ${
                      simDrs
                        ? 'bg-emerald-500 text-black border-emerald-300 shadow-md shadow-emerald-500/20'
                        : 'bg-neutral-900 text-neutral-400 border-neutral-700 hover:text-white'
                    }`}
                  >
                    [SPACE] DRS: {simDrs ? 'OPEN (+16 KM/H)' : 'CLOSED'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSimErs((e) => !e);
                      setVerifiedSystems((p) => ({ ...p, ers: true }));
                    }}
                    className={`px-3 py-2 rounded-lg font-black text-[10px] uppercase border transition-all cursor-pointer ${
                      simErs
                        ? 'bg-sky-400 text-black border-sky-200 shadow-md shadow-sky-500/20'
                        : 'bg-neutral-900 text-neutral-400 border-neutral-700 hover:text-white'
                    }`}
                  >
                    [E] ERS: {simErs ? 'BOOSTING' : 'STANDBY'}
                  </button>
                </div>
              </div>

              {/* Right: Live Simulated F1 Steering Wheel & Telemetry Readout */}
              <div className="flex flex-col justify-between bg-black/60 p-4 rounded-xl border border-white/5 h-full gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block">LIVE TELEMETRY</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-black font-mono text-white tabular-nums">{simSpeed}</span>
                      <span className="text-xs font-bold text-red-500">KM/H</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block">STEERING ANGLE</span>
                    <span className="text-xs font-mono font-black text-cyan-400">
                      {simSteer === -1 ? '◄ -24° LEFT' : simSteer === 1 ? 'RIGHT +24° ►' : '0° CENTER'}
                    </span>
                  </div>
                </div>

                {/* RPM Shift Strip */}
                <div className="w-full h-2.5 bg-neutral-900 rounded-full overflow-hidden p-0.5 border border-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500 transition-all duration-75"
                    style={{ width: `${Math.min(100, (simSpeed / 345) * 100)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-neutral-800">
                  <span className={simDrs ? 'text-emerald-400 font-bold' : 'text-neutral-500'}>
                    REAR WING: {simDrs ? 'DRS FLAP OPEN' : 'HIGH DOWNFORCE'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSimCamera((prev) =>
                        prev === 'CHASE' ? 'COCKPIT' : prev === 'COCKPIT' ? 'NOSE' : 'CHASE'
                      )
                    }
                    className="text-amber-400 hover:underline cursor-pointer font-bold"
                  >
                    CAM [C]: {simCamera}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Playable FIA 5-Red-Lights Reaction Time Mini-Game */}
          <div className="p-4 rounded-2xl bg-neutral-950 border border-red-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                  MINI-CHALLENGE
                </span>
                <h4 className="text-sm font-black text-white">FIA 5-Light Start Reaction Test</h4>
              </div>
              <p className="text-xs text-neutral-400">
                {launchState === 'idle' && 'Click "Start Sequence", wait for all 5 red lights to go OUT, then hit LAUNCH!'}
                {launchState === 'counting' && 'HOLD YOUR NERVE... Wait for LIGHTS OUT! (Do not jump the start!)'}
                {launchState === 'lights_out' && '🟢 LIGHTS OUT! CLICK LAUNCH OR PRESS [W / SPACE] NOW!'}
                {launchState === 'jump_start' && '❌ JUMP START! You hit the throttle before the lights went out.'}
                {launchState === 'result' &&
                  `⚡ Reaction Time: ${reactionMs} ms ${
                    reactionMs && reactionMs < 220
                      ? '— 🏆 F1 PRO REFLEXES!'
                      : reactionMs && reactionMs < 320
                      ? '— ✓ SOLID F1 GRID LAUNCH!'
                      : '— Keep practicing your launch!'
                  }`}
              </p>
              {bestReactionMs !== null && (
                <span className="text-[11px] font-mono text-emerald-400 font-bold">
                  Personal Best Reaction: {bestReactionMs} ms
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* 5 Gantry Lights */}
              <div className="flex items-center gap-2 p-2.5 bg-black rounded-xl border border-white/10">
                {[1, 2, 3, 4, 5].map((idx) => (
                  <div
                    key={idx}
                    className={`w-6 h-6 rounded-full border transition-all duration-75 ${
                      launchLights >= idx
                        ? 'bg-red-600 border-red-400 shadow-[0_0_16px_#ef4444]'
                        : launchState === 'lights_out'
                        ? 'bg-emerald-500 border-emerald-300 shadow-[0_0_14px_#10b981]'
                        : 'bg-neutral-900 border-neutral-800'
                    }`}
                  />
                ))}
              </div>

              {launchState === 'counting' || launchState === 'lights_out' ? (
                <button
                  type="button"
                  onClick={triggerLaunchPedal}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer"
                >
                  LAUNCH! [W]
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startLaunchChallenge}
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{launchState === 'idle' ? 'Start Sequence' : 'Try Again'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'cornering_and_tires',
      badge: 'STEP 2 OF 4 • TIRE LIFE, PIT STOPS [P] & CORNERING LAB',
      title: 'Tire Life Degradation, Pit Stops & Trail-Braking Lab',
      subtitle:
        'Tire Life now directly controls your mechanical cornering grip, braking distance, and top speed! Test compounds & Pit Stops below, then run the 2-Lap Silverstone Practice Race.',
      icon: Gauge,
      content: (
        <div className="space-y-4">
          {renderOnTrackPracticeCard(1)}

          {/* Interactive Tire Life & [P] Pit Crew Simulator Bar */}
          <div className="p-3.5 rounded-2xl bg-neutral-950 border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-amber-400">
                  Live Tire Life & Grip Physics Simulator
                </span>
                <span
                  className={`text-[10px] font-mono font-black px-2 py-0.5 rounded ${
                    simTireLife >= 70
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : simTireLife >= 40
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-red-500/25 text-red-400 animate-pulse'
                  }`}
                >
                  {simTireLife}% LIFE · {cornerTelemetry.gripPct}% MECHANICAL GRIP
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Below 40% Tire Life, your tires hit <strong>The Cliff (Blistering)</strong>—losing up to 45% cornering grip! Press <strong>[P]</strong> in any race to Pit for fresh 100% tires.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSimTireLife(24)}
                className="px-2.5 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-[10px] font-mono font-bold cursor-pointer"
              >
                Test Worn Tires (24%)
              </button>
              <button
                type="button"
                onClick={() => pitForFreshTiresInLab()}
                className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-black text-[10px] uppercase cursor-pointer shadow-md"
              >
                [P] Box Fresh 100% Tires
              </button>
            </div>
          </div>

          {/* Interactive Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Braking Point Selector */}
            <div className="p-3 rounded-xl bg-neutral-950 border border-white/10 flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-red-400">
                1. Choose Braking Point
              </span>
              {[
                { id: '150m' as const, label: '150m Early Brake (Low Wear)' },
                { id: '100m' as const, label: '100m Trail-Brake (Optimal)' },
                { id: '35m' as const, label: '35m Late Dive (Heavy Lockup Wear!)' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setBrakeMarker(opt.id);
                    runCornerSimulation();
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-left text-xs font-bold border transition-all cursor-pointer ${
                    brakeMarker === opt.id
                      ? 'bg-red-500/20 border-red-500 text-white'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Apex Line Selector */}
            <div className="p-3 rounded-xl bg-neutral-950 border border-white/10 flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                2. Choose Racing Line
              </span>
              {[
                { id: 'early' as const, label: 'Early Apex (Pinched Exit)' },
                { id: 'optimal' as const, label: 'Out-In-Out Late Apex (Pro)' },
                { id: 'defensive' as const, label: 'Inside Defensive Block' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setApexLine(opt.id);
                    runCornerSimulation();
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-left text-xs font-bold border transition-all cursor-pointer ${
                    apexLine === opt.id
                      ? 'bg-cyan-500/20 border-cyan-400 text-white'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Tire Compound Selector */}
            <div className="p-3 rounded-xl bg-neutral-950 border border-white/10 flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                3. Pirelli Tire Compound
              </span>
              {[
                { id: 'soft' as const, label: '🔴 Soft (+7% Grip · Fast Wear)' },
                { id: 'medium' as const, label: '🟡 Medium (100% Grip · Balanced)' },
                { id: 'hard' as const, label: '⚪ Hard (95% Grip · Long Life)' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setTireCompound(opt.id);
                    setSimTireLife(100);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-left text-xs font-bold border transition-all cursor-pointer ${
                    tireCompound === opt.id
                      ? 'bg-amber-500/20 border-amber-400 text-white'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive SVG Hairpin Trajectory Visualizer & Telemetry Readout */}
          <div className="p-4 rounded-2xl bg-neutral-950 border border-white/10 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
            <div className="md:col-span-3 bg-black/60 rounded-xl p-3 border border-white/5 flex flex-col items-center">
              <svg viewBox="0 0 320 145" className="w-full h-32">
                <path
                  d="M 20 125 L 185 125 Q 285 125 285 72 Q 285 20 185 20 L 30 20"
                  fill="none"
                  stroke="#2a2e37"
                  strokeWidth="36"
                  strokeLinecap="round"
                />
                <path
                  d="M 235 95 Q 262 72 235 50"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="5"
                  strokeDasharray="6 4"
                />
                <path
                  d={
                    brakeMarker === '35m' || simTireLife < 35
                      ? 'M 20 125 L 250 125 Q 312 105 298 62 Q 285 12 180 8 L 30 12'
                      : apexLine === 'optimal'
                      ? 'M 20 135 L 185 135 Q 268 112 252 68 Q 238 28 175 10 L 30 10'
                      : apexLine === 'early'
                      ? 'M 20 120 L 160 105 Q 245 88 265 48 Q 275 8 175 34 L 30 34'
                      : 'M 20 112 L 195 112 Q 255 100 255 72 Q 255 42 185 32 L 30 32'
                  }
                  fill="none"
                  stroke={
                    brakeMarker === '35m' || simTireLife < 35
                      ? '#ef4444'
                      : apexLine === 'optimal' && brakeMarker === '100m'
                      ? '#a855f7'
                      : '#10b981'
                  }
                  strokeWidth="3.5"
                  strokeDasharray="6 3"
                />
                <text x="28" y="141" fill="#9ca3af" fontSize="9" fontWeight="bold">
                  BRAKE ({brakeMarker})
                </text>
                <text x="200" y="76" fill="#fbbf24" fontSize="9" fontWeight="bold">
                  APEX ({cornerTelemetry.gripPct}% GRIP)
                </text>
                <text x="35" y="15" fill="#34d399" fontSize="9" fontWeight="bold">
                  EXIT THROTTLE
                </text>
              </svg>
              <button
                type="button"
                onClick={runCornerSimulation}
                className="mt-1 px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>Drive Corner Lap (-Tire Life%)</span>
              </button>
            </div>

            <div className="md:col-span-2 flex flex-col gap-2.5">
              <div className="p-3 rounded-xl bg-neutral-900 border border-white/5">
                <span className="text-[10px] font-bold uppercase text-neutral-400 block">
                  SECTOR TELEMETRY RESULT ({cornerProgress}%)
                </span>
                <p className={`text-xs font-black mt-1 ${cornerTelemetry.statusColor}`}>
                  {cornerTelemetry.verdict}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="p-2.5 rounded-xl bg-neutral-900 border border-white/5">
                  <span className="text-[9px] text-neutral-500 block">APEX SPEED</span>
                  <span className="text-sm font-black text-white">{cornerTelemetry.apexSpeed} km/h</span>
                </div>
                <div className="p-2.5 rounded-xl bg-neutral-900 border border-white/5">
                  <span className="text-[9px] text-neutral-500 block">EXIT SPEED</span>
                  <span className="text-sm font-black text-cyan-400">{cornerTelemetry.exitSpeed} km/h</span>
                </div>
                <div className="p-2.5 rounded-xl bg-neutral-900 border border-white/5">
                  <span className="text-[9px] text-neutral-500 block">LAP DELTA</span>
                  <span
                    className={`text-sm font-black ${
                      cornerTelemetry.deltaSec <= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {cornerTelemetry.deltaSec <= 0
                      ? `${cornerTelemetry.deltaSec.toFixed(2)}s`
                      : `+${cornerTelemetry.deltaSec.toFixed(2)}s`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'team_principal_sandbox',
      badge: 'STEP 3 OF 4 • PIT RADIO [1]-[4], DYNO & MONZA PRACTICE RACE',
      title: 'Pit Wall Radio, Engine Dyno & 20-Car Practice Race',
      subtitle:
        'Command your teammate via live Pit Radio [1]–[4], calibrate your Engine Dyno, and launch the 2-Lap Monza Slipstream Practice Race!',
      icon: Wrench,
      content: (
        <div className="space-y-4">
          {renderOnTrackPracticeCard(2)}

          {/* Interactive Pit Wall Radio Console */}
          <div className="p-4 rounded-2xl bg-neutral-950 border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase tracking-wider">
                <Radio className="w-4 h-4" />
                <span>Interactive Pit Wall Radio — Click Keys [1]–[4] to Command Teammate</span>
              </div>
              <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold">
                LIVE RADIO SIMULATOR
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'block' as const, key: '[1]', label: 'Block Pack', desc: 'Slows rivals by 18%' },
                { id: 'yield' as const, key: '[2]', label: 'Yield Position', desc: 'Lets you pass cleanly' },
                { id: 'push' as const, key: '[3]', label: 'Push Attack', desc: '+12 km/h overtake pace' },
                { id: 'neutral' as const, key: '[4]', label: 'Free Race', desc: 'Standard pace' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => issueSimulatedRadioOrder(btn.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedOrder === btn.id
                      ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="text-emerald-400 font-mono">{btn.key}</span>
                    <span>{btn.label}</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-1">{btn.desc}</p>
                </button>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-black/60 border border-emerald-500/20 flex items-center gap-3">
              <div className="w-2 h-8 rounded-full bg-emerald-400 shrink-0" />
              <div className="text-xs">
                <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold block">
                  {radioAccepted ? '✓ TEAMMATE OBEYED ORDER' : '⚠️ ORDER DECLINED'}
                </span>
                <p className="text-neutral-200 font-semibold mt-0.5">{radioReply}</p>
              </div>
            </div>
          </div>

          {/* Interactive Engine Dyno Test Bench */}
          <div className="p-4 rounded-2xl bg-neutral-950 border border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase tracking-wider">
                <Cpu className="w-4 h-4" />
                <span>Interactive R&D Engine Dyno Test Bench</span>
              </div>
              <span className="text-xs font-mono font-black text-amber-300">
                Target Boost: +{dynoBoostHp} HP
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1 w-full">
                <input
                  type="range"
                  min={10}
                  max={45}
                  step={5}
                  value={dynoBoostHp}
                  onChange={(e) => setDynoBoostHp(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-neutral-500 mt-1">
                  <span>+10 HP (Safe)</span>
                  <span>+25 HP (Balanced)</span>
                  <span>+45 HP (Max Power)</span>
                </div>
              </div>

              <button
                type="button"
                onClick={runSimulatedDynoPull}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs uppercase tracking-wider cursor-pointer shrink-0 shadow-lg"
              >
                Run Dyno Pull
              </button>
            </div>

            {dynoTestResult && (
              <div
                className={`p-3 rounded-xl border text-xs font-semibold ${
                  dynoTestResult.passed
                    ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                    : 'bg-red-950/50 border-red-500/40 text-red-200'
                }`}
              >
                {dynoTestResult.message}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'weekend_and_performance_setup',
      badge: 'STEP 4 OF 4 • RETRO ARCADE MODE, CRISP 60+ FPS & GRADUATION RACE',
      title: 'Retro Arcade Style, Crisp 60+ FPS & Final Practice Race',
      subtitle:
        'Try the new 90s Retro Arcade Polygon Style, configure Crisp 60+ FPS Conservative Dynamic (zero pixelation!), and run your Graduation Practice Race!',
      icon: Trophy,
      content: (
        <div className="space-y-4">
          {renderOnTrackPracticeCard(3)}

          {/* 1-Click Retro Arcade '89 & Retro Pixel '92 Showcase Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#1d063a] via-[#340952] to-[#120428] border-2 border-[#ff2a85] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_0_25px_rgba(255,42,133,0.25)]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#ff2a85] text-white font-mono font-black text-[10px] uppercase">
                  RETRO ARCADE &apos;89 + RETRO PIXEL &apos;92
                </span>
                <span className="text-xs font-mono text-[#00f0ff] font-bold">
                  Crisp Polygons or Slightly Pixelated 16-Bit CRT
                </span>
              </div>
              <p className="text-xs text-neutral-200">
                Choose between <strong>Retro Arcade &apos;89</strong> (crisp 90s polygons) or <strong>Retro Pixel &apos;92</strong> (slightly pixelated 16-bit CRT blocks)!
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleActivateRetroBundle}
                className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#ff2a85] to-[#00f0ff] text-black font-black text-xs uppercase tracking-wider cursor-pointer whitespace-nowrap shadow-lg"
              >
                {selectedGfx === 'retro' ? "✓ Retro Arcade '89" : "Retro Arcade '89"}
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSelectGraphics('retro_pixel');
                  handleSelectTheme('retro');
                }}
                className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-cyan-400 text-black font-black text-xs uppercase tracking-wider cursor-pointer whitespace-nowrap shadow-lg"
              >
                {selectedGfx === 'retro_pixel' ? "✓ Retro Pixel '92" : "Retro Pixel '92"}
              </button>
            </div>
          </div>

          {/* 2. Interactive Dynamic Graphics (Crisp 1.0x+ Conservative Dynamic + Retro + Presets) */}
          <div className="p-4 rounded-2xl bg-neutral-950 border border-emerald-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Gauge className="w-4 h-4" />
                Graphics & Crisp 60+ FPS Governor (Zero Pixelation)
              </span>
              <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded font-bold">
                ACTIVE: {GRAPHICS_PRESETS[selectedGfx].shortLabel.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              <strong>Conservative Dynamic</strong> locks <strong>crisp 1.0x+ native screen resolution with anti-aliasing</strong>, while <strong>Ultra Realistic</strong> uses physically calibrated 360° PMREM clearcoat reflections with Neutral broadcast tone-mapping!
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {GRAPHICS_QUALITY_OPTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleSelectGraphics(q)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedGfx === q
                      ? q === 'retro'
                        ? 'bg-[#ff2a85]/25 border-[#ff2a85] text-white'
                        : q === 'retro_pixel'
                        ? 'bg-purple-500/25 border-purple-400 text-white'
                        : q === 'dynamic_conservative'
                        ? 'bg-emerald-500/20 border-emerald-400 text-white'
                        : q === 'dynamic_aggressive'
                        ? 'bg-cyan-500/20 border-cyan-400 text-white'
                        : 'bg-amber-500/20 border-amber-400 text-white'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-black">{GRAPHICS_PRESETS[q].shortLabel}</div>
                  <div className="text-[9px] font-mono text-neutral-400 mt-0.5 truncate">
                    {GRAPHICS_PRESETS[q].badge}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Qualifying Ghost Timing & UI Theme Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-neutral-950 border border-purple-500/30 space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <Timer className="w-4 h-4" />
                Qualifying Ghost Cars Timing
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleGhostDelay(true)}
                  className={`p-2 rounded-xl border text-left text-xs font-bold cursor-pointer ${
                    ghostDelay3s
                      ? 'bg-purple-500/20 border-purple-400 text-white'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  ✓ 3s Late Ghosts
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleGhostDelay(false)}
                  className={`p-2 rounded-xl border text-left text-xs font-bold cursor-pointer ${
                    !ghostDelay3s
                      ? 'bg-purple-500/20 border-purple-400 text-white'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  ⚡ Instant (0s)
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-neutral-950 border border-white/10 space-y-2">
              <div className="flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-black text-white uppercase">UI Color Theme</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {THEME_OPTIONS.map((tId) => (
                  <button
                    key={tId}
                    type="button"
                    onClick={() => handleSelectTheme(tId)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      selectedTheme === tId
                        ? tId === 'retro'
                          ? 'bg-[#ff2a85] text-white border-[#00f0ff] font-black'
                          : 'bg-orange-500 text-black border-orange-300 font-black'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white'
                    }`}
                  >
                    {APP_THEMES[tId].shortLabel}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const current = steps[currentStep];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-neutral-900 border border-neutral-700 max-w-3xl w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="p-5 bg-neutral-950/90 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-red-600/20">
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                  {current.badge}
                </span>
                <span className="text-[11px] text-neutral-500 font-mono">
                  {currentStep + 1} of {steps.length} · {completedDrills.length}/4 Practice Races Driven
                </span>
              </div>
              <h3 className="text-lg font-black text-white tracking-wide mt-0.5">{current.title}</h3>
            </div>
          </div>
          <button
            onClick={handleFinish}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Skip and Close Tutorial"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab / Step Bar */}
        <div className="grid grid-cols-4 border-b border-neutral-800 bg-neutral-950/40">
          {steps.map((st, idx) => {
            const isActive = currentStep === idx;
            const drillId = TUTORIAL_PRACTICE_DRILLS[idx]?.id;
            const isCompleted = currentStep > idx || (drillId && completedDrills.includes(drillId));
            const StepIcon = st.icon;

            return (
              <button
                key={st.id}
                onClick={() => setCurrentStep(idx)}
                className={`py-3 px-3 flex items-center justify-center gap-1.5 border-b-2 font-bold text-xs transition-all cursor-pointer ${
                  isActive
                    ? 'border-red-500 text-white bg-neutral-900/60'
                    : isCompleted
                    ? 'border-emerald-500/40 text-emerald-400'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <StepIcon className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">
                  {idx === 0
                    ? '1. Shakedown Lap'
                    : idx === 1
                    ? '2. Tire & Pit Race'
                    : idx === 2
                    ? '3. Radio & Pack Race'
                    : '4. Retro & Final GP'}
                </span>
                <span className="sm:hidden">{idx + 1}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-xs text-neutral-400 mb-4">{current.subtitle}</p>
          {current.content}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/70 flex items-center justify-between gap-4">
          <button
            onClick={handleFinish}
            className="text-xs font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
          >
            <span>Skip Tutorial</span>
          </button>

          <div className="flex items-center gap-3">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>
            )}

            {currentStep < steps.length - 1 ? (
              <button
                onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-red-900/40 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Next Challenge</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-900/40 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Flag className="w-4 h-4" />
                <span>Enter Paddock & Race</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
