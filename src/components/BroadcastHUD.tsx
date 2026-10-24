import React, { useState, useEffect } from 'react';
import { TelemetryData, CircuitInfo, CameraView, Driver } from '../types/racing';
import { DRIVERS, TEAMS } from '../constants/f1Data';
import { Gamepad, Keyboard, Camera, RotateCcw, Volume2, VolumeX, Flag, AlertTriangle, Shield, Wind, Users, Radio, Zap, Gauge } from 'lucide-react';
import { TrackMiniMap } from './TrackMiniMap';
import { PracticeLineCoachData } from '../game/racingLineBuilder';
import { UnitSystem, getStoredUnitSystem, setStoredUnitSystem, convertSpeed, getSpeedUnitLabel, formatTemp, onUnitSystemChange } from '../utils/units';

interface BroadcastHUDProps {
  telemetry: TelemetryData;
  circuit: CircuitInfo;
  raceState: 'countdown' | 'racing' | 'finished';
  lightsLit: number;
  lightsExtinguished: boolean;
  cameraView: CameraView;
  onCycleCamera: () => void;
  onResetCar: () => void;
  onToggleMute: () => void;
  isMuted: boolean;
  isGamepadConnected: boolean;
  gamepadName: string | null;
  playerDriver: Driver;
  yellowFlagActive?: boolean;
  isPracticeMode?: boolean;
  isQualifyingMode?: boolean;
  onIssueTeamOrder?: (order: 'block' | 'yield' | 'push' | 'neutral') => void;
  onOpenControls?: () => void;
  showPracticeRacingLine?: boolean;
  onTogglePracticeRacingLine?: () => void;
  practiceLineCoach?: PracticeLineCoachData | null;
  practiceBotCount?: number;
  onSetPracticeBotCount?: (count: number) => void;
}

export const BroadcastHUD: React.FC<BroadcastHUDProps> = ({
  telemetry,
  circuit,
  raceState,
  lightsLit,
  lightsExtinguished,
  cameraView,
  onCycleCamera,
  onResetCar,
  onToggleMute,
  isMuted,
  isGamepadConnected,
  gamepadName,
  playerDriver,
  yellowFlagActive = false,
  isPracticeMode = false,
  isQualifyingMode = false,
  onIssueTeamOrder,
  onOpenControls,
  showPracticeRacingLine = false,
  onTogglePracticeRacingLine,
  practiceLineCoach = null,
  practiceBotCount = 19,
  onSetPracticeBotCount,
}) => {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(getStoredUnitSystem());

  useEffect(() => {
    return onUnitSystemChange((newUnit) => {
      setUnitSystem(newUnit);
    });
  }, []);

  const toggleUnits = () => {
    const nextUnit = unitSystem === 'metric' ? 'imperial' : 'metric';
    setUnitSystem(nextUnit);
    setStoredUnitSystem(nextUnit);
  };

  const displaySpeed = Math.round(convertSpeed(telemetry.speedKmh, unitSystem));
  const speedUnitLabel = getSpeedUnitLabel(unitSystem);

  // Format lap time in mm:ss.ms
  const formatTime = (seconds: number | null) => {
    if (seconds === null || seconds === undefined) return '--:--.---';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  // Shift light LED calculations (15 LEDs total: 5 Green, 5 Red, 5 Blue)
  const rpmFraction = Math.max(0, Math.min(1, (telemetry.rpm - 5000) / 9500));
  const activeLeds = Math.round(rpmFraction * 15);

  // Dynamic timing tower with live real-time position and accurate seconds gaps
  const timingTower = React.useMemo(() => {
    if (telemetry.carsRadar && telemetry.carsRadar.length > 0) {
      const sortedRadar = [...telemetry.carsRadar].sort((a, b) => (a.position || 20) - (b.position || 20));
      return sortedRadar.slice(0, 10).map((r, idx) => {
        const driver = r.isPlayer
          ? playerDriver
          : (DRIVERS.find((d) => d.shortName === r.shortName) || {
              id: r.shortName.toLowerCase(),
              name: r.driverName || r.shortName,
              shortName: r.shortName,
              number: 0,
              country: '',
              countryCode: '',
              teamId: 'haas',
              rating: 85,
              aggression: 0.8,
              color: r.color,
            });
        const isTeammate = Boolean(r.isTeammate || (telemetry.teammateShortName && driver.shortName === telemetry.teammateShortName));
        return {
          driver,
          position: idx + 1,
          isPlayer: r.isPlayer,
          isTeammate,
          gapToLeaderSeconds: r.gapToLeaderSeconds || 0,
          gapToAheadSeconds: r.gapToAheadSeconds || 0,
          gapToPlayerSeconds: r.gapToPlayerSeconds || 0,
          leadOverP2Seconds: r.leadOverP2Seconds,
        };
      });
    }

    const list = [...DRIVERS];
    const playerIdx = list.findIndex((d) => d.id === playerDriver.id);
    if (playerIdx !== -1) {
      list.splice(playerIdx, 1);
    }
    const targetIdx = Math.max(0, Math.min(list.length, telemetry.position - 1));
    list.splice(targetIdx, 0, playerDriver);
    return list.slice(0, 10).map((driver, idx) => ({
      driver,
      position: idx + 1,
      isPlayer: driver.id === playerDriver.id,
      isTeammate: Boolean(telemetry.teammateShortName && driver.shortName === telemetry.teammateShortName),
      gapToLeaderSeconds: idx === 0 ? 0 : idx * 1.5,
      gapToAheadSeconds: 1.5,
      gapToPlayerSeconds: (idx + 1 - telemetry.position) * 1.5,
      leadOverP2Seconds: idx === 0 ? 1.5 : undefined,
    }));
  }, [telemetry.carsRadar, telemetry.position, playerDriver, telemetry.teammateShortName]);

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden flex flex-col justify-between p-4 md:p-6 font-racing">
      {/* 1. TOP BROADCAST BAR */}
      <div className="flex items-center justify-between w-full">
        {/* Left: Circuit & Grand Prix Title */}
        <div className={`flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 border-l-4 rounded-r-lg shadow-2xl ${isQualifyingMode ? 'border-purple-500' : isPracticeMode ? 'border-amber-400' : 'border-red-600'}`}>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-widest text-neutral-400 font-semibold flex items-center gap-2">
              <Flag className={`w-3.5 h-3.5 ${isQualifyingMode ? 'text-purple-400' : isPracticeMode ? 'text-amber-400' : 'text-red-500'}`} />
              <span>{circuit.country.toUpperCase()} {isQualifyingMode ? '• OFFICIAL QUALIFYING' : isPracticeMode ? '• PRACTICE SESSION' : 'GP'}</span>
              {isQualifyingMode && (
                <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-black border border-purple-400/30 animate-pulse">
                  1 FLYING LAP (POLE SHOOTOUT)
                </span>
              )}
              {isPracticeMode && (
                <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-black border border-amber-400/30">
                  FREE PRACTICE
                </span>
              )}
            </span>
            <span className="text-sm md:text-base font-bold text-white tracking-wide">
              {circuit.name}
            </span>
          </div>
        </div>

        {/* Center: Lap Counter, Accurate Seconds Lead / Gap & Strategy Controls */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-4 bg-black/70 backdrop-blur-md px-5 py-2 rounded-lg border border-white/10 shadow-2xl">
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-neutral-400 tracking-wider">{isQualifyingMode ? 'QUALIFYING' : 'LAP'}</span>
              <span className="text-lg md:text-xl font-black text-white tabular-nums">
                {isQualifyingMode ? (
                  <span>HOT LAP <span className="text-xs text-purple-400">1 / 1</span></span>
                ) : (
                  <>{telemetry.currentLap} <span className="text-xs text-neutral-500">/ {telemetry.totalLaps}</span></>
                )}
              </span>
            </div>
            <div className="w-[1px] h-7 bg-white/20" />
            
            {/* ACCURATE SECONDS LEAD / GAP ("on the board add an atual seconds lead how much seconds p1 is beating and everyone on the podium") */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-neutral-400 tracking-wider">
                {telemetry.position === 1 ? 'LEAD OVER P2' : 'GAP TO P1'}
              </span>
              <span className={`text-base md:text-lg font-mono font-bold ${telemetry.position === 1 ? 'text-amber-400' : 'text-cyan-400'}`}>
                {telemetry.position === 1
                  ? (telemetry.p1LeadSeconds !== undefined && telemetry.p1LeadSeconds > 0
                    ? `+${telemetry.p1LeadSeconds.toFixed(2)}s`
                    : 'LEADER')
                  : `+${(telemetry.deltaToLeader || 0).toFixed(2)}s`}
              </span>
            </div>
            <div className="w-[1px] h-7 bg-white/20 hidden sm:block" />
            <div className="flex flex-col items-center hidden sm:flex">
              <span className="text-[10px] text-neutral-400 tracking-wider">BEST LAP</span>
              <span className="text-sm md:text-base font-mono font-semibold text-purple-400">
                {formatTime(telemetry.lapTimeBest)}
              </span>
            </div>

            {/* TEAMMATE LIVE TRACKER */}
            {telemetry.teammatePosition && (
              <>
                <div className="w-[1px] h-7 bg-emerald-500/30" />
                <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-500/40 px-3 py-1 rounded-lg">
                  <div className="w-6 h-6 rounded-md bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                    <Users className="w-3.5 h-3.5 text-emerald-300" />
                  </div>
                  <div className="flex flex-col text-left leading-tight">
                    <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-emerald-300 tracking-wider">
                      <span>TEAMMATE ({telemetry.teammateShortName || 'TEAM'})</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-sm font-black text-white">
                        P{telemetry.teammatePosition}
                      </span>
                      {telemetry.teammateGapSeconds !== undefined && (
                        <span className={`text-[10px] font-bold ${telemetry.teammateGapSeconds < 0 ? 'text-cyan-300' : 'text-amber-400'}`}>
                          {telemetry.teammateGapSeconds < 0
                            ? `${telemetry.teammateGapSeconds.toFixed(1)}s (AHEAD)`
                            : `+${telemetry.teammateGapSeconds.toFixed(1)}s (BEHIND)`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* IN-RACE TEAM RADIO STRATEGY CONSOLE:
              "and add controlls to tell ur teamates what to do like 1 is to tell them to block pack 2 is too tell them to yield position and 3 is to tell them to push" */}
          {(telemetry.teammatePosition || telemetry.teammateShortName || telemetry.teammateDriverName) && onIssueTeamOrder && (
            <div className="flex items-center gap-1.5 bg-black/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-emerald-500/40 shadow-xl pointer-events-auto">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-400 mr-1">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="hidden sm:inline">PIT ORDERS ({telemetry.teammateObedience ?? 75}%):</span>
                <span className="sm:hidden">ORDERS:</span>
              </div>
              <button
                onClick={() => onIssueTeamOrder('block')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                  telemetry.teammateCurrentOrder === 'block'
                    ? 'bg-amber-500 text-black font-black ring-2 ring-amber-300 shadow-md'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-amber-500/30'
                }`}
                title="Press [1] or Click: Tell teammate to defend apex and block pack behind"
              >
                <kbd className="px-1.5 py-0.2 rounded bg-black/70 border border-amber-400/50 text-amber-300 font-mono font-black text-[9px] shadow-sm">1</kbd>
                <span>🛡️</span>
                <span>Block Pack</span>
              </button>
              <button
                onClick={() => onIssueTeamOrder('yield')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                  telemetry.teammateCurrentOrder === 'yield'
                    ? 'bg-cyan-500 text-black font-black ring-2 ring-cyan-300 shadow-md'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-cyan-300 border border-cyan-500/30'
                }`}
                title="Press [2] or Click: Tell teammate to yield position and let you pass cleanly"
              >
                <kbd className="px-1.5 py-0.2 rounded bg-black/70 border border-cyan-400/50 text-cyan-300 font-mono font-black text-[9px] shadow-sm">2</kbd>
                <span>↔️</span>
                <span>Yield Position</span>
              </button>
              <button
                onClick={() => onIssueTeamOrder('push')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                  telemetry.teammateCurrentOrder === 'push'
                    ? 'bg-red-600 text-white font-black ring-2 ring-red-400 shadow-md'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-red-300 border border-red-500/30'
                }`}
                title="Press [3] or Click: Tell teammate to attack and push to overtake"
              >
                <kbd className="px-1.5 py-0.2 rounded bg-black/70 border border-red-400/50 text-red-300 font-mono font-black text-[9px] shadow-sm">3</kbd>
                <Zap className="w-3 h-3 text-red-400" />
                <span>Push</span>
              </button>
              <button
                onClick={() => onIssueTeamOrder('neutral')}
                className={`px-2 py-1 rounded-lg text-[10px] font-medium uppercase transition-all cursor-pointer flex items-center gap-1 ${
                  telemetry.teammateCurrentOrder === 'neutral'
                    ? 'bg-neutral-600 text-white'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400'
                }`}
                title="Press [4] or Click: Free racing for teammate"
              >
                <kbd className="px-1 py-0.2 rounded bg-black/50 border border-white/20 text-neutral-400 font-mono text-[9px]">4</kbd>
                <span>Free</span>
              </button>
            </div>
          )}
        </div>

        {/* F1 BROADCAST POSITION TICKER:
            "also add like things so i can tell who is first place second place etc" */}
        <div className="hidden sm:flex items-center gap-2.5 bg-neutral-950/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/15 shadow-xl text-xs font-mono">
          {/* P1 Leader */}
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-amber-400 text-black font-black text-[10px] flex items-center gap-1 shadow-sm">
              <span>🥇</span>
              <span>P1</span>
            </span>
            <span className="font-bold text-amber-300">
              {telemetry.leaderShortName || 'LEADER'}
            </span>
            {telemetry.position === 1 ? (
              <span className="text-[10px] text-amber-400 font-black animate-pulse">(YOU)</span>
            ) : (
              <span className="text-[10px] text-neutral-400 font-bold">(-{telemetry.deltaToLeader.toFixed(1)}s)</span>
            )}
          </div>

          <div className="w-px h-3.5 bg-white/20" />

          {/* Top 3 Summary */}
          {telemetry.top3Drivers && telemetry.top3Drivers.length >= 3 && (
            <div className="hidden md:flex items-center gap-2">
              <div className="flex items-center gap-1 text-[11px]">
                <span className="px-1 rounded bg-slate-300 text-black font-black text-[9px]">P2</span>
                <span className="text-slate-200 font-semibold">{telemetry.top3Drivers[1]?.shortName}</span>
              </div>
              <div className="flex items-center gap-1 text-[11px]">
                <span className="px-1 rounded bg-amber-600 text-white font-black text-[9px]">P3</span>
                <span className="text-amber-200 font-semibold">{telemetry.top3Drivers[2]?.shortName}</span>
              </div>
              <div className="w-px h-3.5 bg-white/20" />
            </div>
          )}

          {/* Player Position Context */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-neutral-400 text-[10px]">YOU:</span>
              <span className="px-1.5 py-0.5 rounded bg-sky-500 text-black font-black text-[11px] shadow-sm">
                P{telemetry.position}
              </span>
              <span className="text-neutral-400 text-[10px]">/ 20</span>
            </div>

            {/* Direct Battle Gaps: Ahead & Behind */}
            {telemetry.carAheadShortName && (
              <span className="text-[10px] text-emerald-400 hidden lg:inline">
                ▲ P{telemetry.position - 1} {telemetry.carAheadShortName} (-{telemetry.carAheadGapSeconds?.toFixed(1)}s)
              </span>
            )}
            {telemetry.carBehindShortName && (
              <span className="text-[10px] text-rose-400 hidden lg:inline">
                ▼ P{telemetry.position + 1} {telemetry.carBehindShortName} (+{telemetry.carBehindGapSeconds?.toFixed(1)}s)
              </span>
            )}
          </div>
        </div>

        {/* Right: Quick Controls & Camera */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* PRACTICE MODE ONLY: AI Bots Selector (Remove All Bots or Some Bots) */}
          {isPracticeMode && !isQualifyingMode && onSetPracticeBotCount && (
            <div className="flex items-center gap-1 bg-neutral-900/90 px-2 py-1 rounded border border-amber-500/30">
              <span className="text-[10px] font-black uppercase text-amber-400 mr-1">BOTS:</span>
              {[
                { count: 0, label: '0 (NONE)' },
                { count: 5, label: '5' },
                { count: 10, label: '10' },
                { count: 19, label: '19' },
              ].map((opt) => (
                <button
                  key={opt.count}
                  onClick={() => onSetPracticeBotCount(opt.count)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-black transition-all cursor-pointer ${
                    practiceBotCount === opt.count
                      ? 'bg-amber-500 text-black shadow-sm'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                  }`}
                  title={opt.count === 0 ? 'Remove all AI bots (Solo Track)' : `Set ${opt.count} AI bots on track`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* PRACTICE MODE ONLY: Optimal Racing Line & Braking Assist Toggle */}
          {isPracticeMode && !isQualifyingMode && onTogglePracticeRacingLine && (
            <button
              onClick={onTogglePracticeRacingLine}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border transition-all cursor-pointer font-black tracking-wide ${
                showPracticeRacingLine
                  ? 'bg-emerald-600/90 hover:bg-emerald-500 text-black border-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                  : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 border-white/15'
              }`}
              title="Toggle 3D Optimal Racing Line & Braking/Acceleration Indicators (Practice Mode Only • Key L)"
            >
              <span className="text-[11px]">
                {showPracticeRacingLine ? '🟢 RACING LINE: ON [L]' : '⚪ RACING LINE: OFF [L]'}
              </span>
            </button>
          )}
          <button
            onClick={onCycleCamera}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 text-xs rounded border border-white/10 backdrop-blur transition-colors"
            title="Switch Camera (Key C)"
          >
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span className="uppercase text-[11px] font-semibold">{cameraView}</span>
          </button>
          <button
            onClick={onResetCar}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 text-xs rounded border border-white/10 backdrop-blur transition-colors"
            title="Reset to Track (Key R)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
          </button>
          {onOpenControls && (
            <button
              onClick={onOpenControls}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 text-xs rounded border border-white/10 backdrop-blur transition-colors"
              title="Button Mapping & Controls"
            >
              <Keyboard className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline text-[11px]">Controls</span>
            </button>
          )}
          <button
            onClick={toggleUnits}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 text-xs rounded border border-white/10 backdrop-blur transition-colors font-mono font-bold"
            title="Switch measurements to American (MPH / Miles / °F) or Metric (KM/H / KM / °C)"
          >
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-black">{unitSystem === 'imperial' ? '🇺🇸 MPH' : '🌐 KM/H'}</span>
          </button>
          <button
            onClick={onToggleMute}
            className="p-1.5 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 rounded border border-white/10 backdrop-blur transition-colors"
            title="Mute / Unmute"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* YELLOW FLAG INCIDENT OVERLAY */}
      {yellowFlagActive && (
        <div className="absolute top-20 inset-x-0 flex justify-center pointer-events-none z-30">
          <div className="bg-amber-400 text-black px-5 py-2 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2.5 shadow-2xl animate-pulse border-2 border-black/80">
            <AlertTriangle className="w-4 h-4 fill-black" />
            <span>YELLOW FLAG — TRACK INCIDENT / CAR SPUN</span>
          </div>
        </div>
      )}

      {/* HEAVY IMPACT CRASH PENALTY & STALL OVERLAY */}
      {telemetry.crashWaitTimer !== undefined && telemetry.crashWaitTimer > 0 && (
        <div className="absolute top-28 inset-x-0 flex justify-center pointer-events-none z-40">
          <div className="bg-red-950/90 border-2 border-red-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 backdrop-blur-md animate-pulse">
            <div className="w-10 h-10 rounded-full bg-red-600/40 border border-red-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[11px] font-black uppercase tracking-wider text-red-300">
                HEAVY IMPACT DETECTED — ENGINE STALLED
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-mono font-black text-amber-300 tabular-nums">
                  WAITING: {telemetry.crashWaitTimer.toFixed(1)}s
                </span>
                <span className="text-[10px] text-neutral-300 uppercase bg-black/40 px-2 py-0.5 rounded border border-white/10 font-bold">
                  {telemetry.crashWaitMode ? `${telemetry.crashWaitMode.toUpperCase()} MODE` : 'PENALTY'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3-SECOND RECOVERY PROTECTION SHIELD */}
      {telemetry.protectionShieldTimer !== undefined && telemetry.protectionShieldTimer > 0 && (
        <div className="absolute top-28 inset-x-0 flex justify-center pointer-events-none z-40">
          <div className="bg-cyan-950/90 border-2 border-cyan-400 text-white px-6 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-pulse">
            <div className="w-8 h-8 rounded-full bg-cyan-500/30 border border-cyan-400 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                3-SECOND RECOVERY SHIELD ACTIVE
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-mono font-black text-cyan-200 tabular-nums">
                  {telemetry.protectionShieldTimer.toFixed(1)}s PROTECTION
                </span>
                <span className="text-[10px] text-cyan-400 uppercase bg-black/40 px-2 py-0.5 rounded border border-cyan-500/30 font-bold">
                  NO-STICK GHOSTING
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WRONG WAY WARNING & 5-SECOND AUTO-RESPAWN COUNTDOWN */}
      {telemetry.wrongWayWarning && (
        <div className="absolute top-24 inset-x-0 flex flex-col items-center justify-center pointer-events-none z-50 animate-bounce">
          <div className="bg-gradient-to-r from-red-600 via-rose-700 to-red-600 border-4 border-yellow-300 text-white px-8 py-4 rounded-2xl shadow-[0_0_60px_rgba(255,0,0,0.9)] flex flex-col items-center gap-2 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-9 h-9 text-yellow-300 animate-pulse shrink-0" />
              <span className="text-2xl md:text-3xl font-black uppercase tracking-wider text-yellow-200 drop-shadow-md">
                WRONG WAY! TURN AROUND
              </span>
              <AlertTriangle className="w-9 h-9 text-yellow-300 animate-pulse shrink-0" />
            </div>
            <div className="flex items-center gap-3 bg-black/60 px-5 py-1.5 rounded-full border border-yellow-400/40 font-mono text-sm">
              <span className="text-neutral-300 font-bold">AUTO-RESPAWNING IN:</span>
              <span className="text-yellow-300 font-black text-xl tabular-nums">
                {Math.max(0, 5.0 - (telemetry.wrongWayTimer || 0)).toFixed(1)}s
              </span>
            </div>
          </div>
        </div>
      )}

      {/* AERODYNAMIC SLIPSTREAM / TOW INDICATOR */}
      {telemetry.slipstreamActive && (
        <div className="absolute top-44 inset-x-0 flex justify-center pointer-events-none z-40">
          <div className="bg-emerald-950/90 border-2 border-emerald-400 text-white px-5 py-2 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-pulse">
            <div className="w-7 h-7 rounded-full bg-emerald-500/30 border border-emerald-400 flex items-center justify-center shrink-0">
              <Wind className="w-4 h-4 text-emerald-300" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                <span>SLIPSTREAM / TOW ACTIVE</span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono font-normal">
                  -60% DRAG
                </span>
              </span>
              <span className="text-xs font-mono font-bold text-emerald-100">
                WAKE POCKET SPEED BOOST +{Math.round((telemetry.slipstreamFactor || 0.8) * 22)} KM/H
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. TEAMMATE PROXIMITY CAUTION / ANTI-CRASH ALERT:
          "and put like a thing so i know who is my teammate so i dont crash in to them" */}
      {telemetry.teammateDistanceMeters !== undefined && telemetry.teammateDistanceMeters < 40 && (
        <div className="absolute top-44 inset-x-0 flex justify-center pointer-events-none z-40">
          <div className="bg-emerald-950/95 border-2 border-emerald-400 text-white px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-pulse">
            <div className="w-9 h-9 rounded-full bg-emerald-500/30 border border-emerald-400 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300 flex items-center gap-2">
                <span>🛡️ CAUTION: TEAMMATE NEARBY — DO NOT CRASH!</span>
                <span className="text-[10px] bg-emerald-500/30 text-emerald-200 px-2 py-0.5 rounded font-mono font-black border border-emerald-400/40">
                  {telemetry.teammateShortName} (P{telemetry.teammatePosition || '?'})
                </span>
              </span>
              <span className="text-xs font-mono font-bold text-white mt-0.5">
                {telemetry.teammateDistanceMeters.toFixed(1)} METERS AWAY • HOLD RACING LINE & PASS SAFELY
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. OFFICIAL FIA START LIGHTS SEQUENCE (OVERLAY) */}
      {raceState === 'countdown' && (
        <div className="absolute inset-x-0 top-24 flex flex-col items-center justify-center pointer-events-none z-50">
          <div className="bg-black/90 p-5 rounded-2xl border border-neutral-700 shadow-2xl flex flex-col items-center gap-3">
            <span className="text-xs uppercase tracking-widest text-neutral-400 font-bold">
              Starting Grid Sequence
            </span>
            {/* 5 Lights housing */}
            <div className="flex gap-4 p-3 bg-neutral-950 rounded-xl border border-neutral-800">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`w-9 h-9 md:w-11 md:h-11 rounded-full border-2 transition-all duration-100 ${
                    lightsLit > i && !lightsExtinguished
                      ? 'bg-red-600 border-red-400 shadow-[0_0_25px_#ff0000]'
                      : lightsExtinguished
                      ? 'bg-neutral-900 border-neutral-800'
                      : 'bg-red-950/40 border-neutral-800'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-neutral-400">
              {lightsExtinguished
                ? 'LIGHTS OUT AND AWAY WE GO!'
                : `HOLD THROTTLE / REVS AT 11,000 RPM`}
            </span>
          </div>
        </div>
      )}

      {/* 3. CHEQUERED FLAG FINISH OVERLAY */}
      {raceState === 'finished' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md z-50 pointer-events-auto">
          <div className="bg-neutral-900/90 border border-neutral-700 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
              <Flag className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-3xl font-black text-white tracking-wider">CHEQUERED FLAG</h2>
            <div className="flex items-center justify-center gap-3 text-lg">
              <span className="text-neutral-400">Your Finish:</span>
              <span className={`font-black text-3xl ${telemetry.position === 1 ? 'text-amber-400' : telemetry.position <= 3 ? 'text-cyan-400' : 'text-white'}`}>
                P{telemetry.position}
              </span>
            </div>
            <div className="w-full bg-neutral-950 p-4 rounded-xl border border-white/10 text-sm font-mono flex flex-col gap-1.5">
              <div className="flex justify-between">
                <span className="text-neutral-400">Best Lap:</span>
                <span className="text-purple-400 font-bold">{formatTime(telemetry.lapTimeBest)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Laps Completed:</span>
                <span className="text-neutral-200">{telemetry.totalLaps} / {telemetry.totalLaps}</span>
              </div>
            </div>
            <span className="text-xs text-neutral-400 animate-pulse">Calculating Championship Points & Payout...</span>
          </div>
        </div>
      )}

      {/* 4. LIVE TEAM RADIO TRANSMISSION BANNER */}
      {telemetry.teammateRadioMessage && (
        <div className="absolute top-24 inset-x-0 flex justify-center pointer-events-none z-50 animate-bounce">
          <div className={`px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3.5 backdrop-blur-md border-2 ${
            telemetry.teammateRadioStatus === 'refused'
              ? 'bg-red-950/95 border-red-500 text-white shadow-red-950/80'
              : 'bg-emerald-950/95 border-emerald-400 text-white shadow-emerald-950/80'
          }`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${
              telemetry.teammateRadioStatus === 'refused'
                ? 'bg-red-600/30 border-red-400 text-red-400'
                : 'bg-emerald-600/30 border-emerald-400 text-emerald-300'
            }`}>
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-300">
                  PIT RADIO — {telemetry.teammateRadioSpeaker || telemetry.teammateShortName || 'TEAMMATE'}
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                  telemetry.teammateRadioStatus === 'refused'
                    ? 'bg-red-500 text-white'
                    : 'bg-emerald-500 text-black'
                }`}>
                  {telemetry.teammateRadioStatus === 'refused' ? 'ORDER REFUSED' : 'ORDER ACCEPTED'}
                </span>
              </div>
              <p className="text-sm font-bold tracking-wide italic text-white drop-shadow-sm mt-0.5">
                {telemetry.teammateRadioMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 5. MID SECTION: TIMING TOWER */}
      <div className="flex items-start justify-between w-full flex-1 my-4">
        {/* Left: Official FIA Leaderboard Tower with ACCURATE SECONDS LEADS & GAPS */}
        <div className="hidden sm:flex flex-col gap-0.5 bg-black/75 backdrop-blur-md p-2 rounded-xl border border-white/10 shadow-2xl max-w-[215px] w-full">
          <div className="px-2 py-1 text-[10px] uppercase font-bold text-neutral-400 tracking-wider flex items-center justify-between border-b border-white/10 mb-1">
            <span>POS / DRIVER</span>
            <span>GAP / LEAD</span>
          </div>
          {timingTower.map((item) => {
            const { driver, position, isPlayer, isTeammate, gapToLeaderSeconds, gapToPlayerSeconds } = item;
            const team = TEAMS.find((t) => t.id === driver.teamId);
            const teamColor = team?.primaryColor || '#ffffff';

            return (
              <div
                key={driver.id}
                className={`flex items-center justify-between px-2 py-1 rounded text-xs transition-colors ${
                  isPlayer
                    ? 'bg-amber-500/25 border-l-4 border-amber-400 font-bold shadow-inner'
                    : isTeammate
                    ? 'bg-emerald-500/20 border-l-4 border-emerald-400 font-bold text-emerald-200'
                    : 'text-neutral-300'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className={`w-5 h-5 rounded flex items-center justify-center font-black font-mono text-[10px] shrink-0 shadow-sm ${
                      position === 1
                        ? 'bg-amber-400 text-black ring-1 ring-amber-300'
                        : position === 2
                        ? 'bg-slate-300 text-black ring-1 ring-slate-100'
                        : position === 3
                        ? 'bg-amber-600 text-white ring-1 ring-amber-500'
                        : position <= 10
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                        : 'bg-neutral-900 text-neutral-400 border border-white/10'
                    }`}
                  >
                    {position}
                  </span>
                  <div className="w-1 h-3 rounded-full shrink-0" style={{ backgroundColor: isTeammate ? '#10b981' : teamColor }} />
                  <span className={`font-mono tracking-wider truncate flex items-center gap-1 ${isPlayer ? 'text-amber-300 font-black' : isTeammate ? 'text-emerald-300 font-black' : 'text-neutral-200'}`}>
                    {position === 1 && <span className="text-[10px]">👑</span>}
                    <span>{driver.shortName}</span>
                    {isTeammate && <span className="text-[8px] bg-emerald-500/30 text-emerald-300 px-1 rounded font-sans shrink-0 font-bold">TEAM</span>}
                  </span>
                </div>
                
                {/* ACCURATE SECONDS LEAD & GAPS ("on the board add an atual seconds lead how much seconds p1 is beating and everyone on the podium and make it accurate or how much seconds im beating them by") */}
                <div className="text-[10px] font-mono text-right shrink-0">
                  {position === 1 ? (
                    <span className="text-amber-400 font-black">
                      {telemetry.p1LeadSeconds !== undefined && telemetry.p1LeadSeconds > 0
                        ? `LEAD +${telemetry.p1LeadSeconds.toFixed(2)}s`
                        : 'LEADER'}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className={position <= 3 ? 'text-cyan-300 font-bold' : 'text-neutral-300'}>
                        +{gapToLeaderSeconds.toFixed(2)}s
                      </span>
                      {!isPlayer && gapToPlayerSeconds !== 0 && (
                        <span className={`text-[9px] ${gapToPlayerSeconds > 0 ? 'text-emerald-400' : 'text-rose-400'}`} title={gapToPlayerSeconds > 0 ? `You lead by ${gapToPlayerSeconds.toFixed(1)}s` : `Trails you by ${Math.abs(gapToPlayerSeconds).toFixed(1)}s`}>
                          {gapToPlayerSeconds > 0 ? `(-${gapToPlayerSeconds.toFixed(1)})` : `(+${Math.abs(gapToPlayerSeconds).toFixed(1)})`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. BOTTOM SECTION: COCKPIT CLUSTER & CONTROLS */}
      <div className="flex items-end justify-between w-full">
        {/* Left: Tire Compound & Wear */}
        <div className="flex flex-col gap-2 bg-black/60 backdrop-blur-md p-3 rounded-lg border border-white/10 shadow-2xl">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full border-2 border-red-500 bg-black/80 flex items-center justify-center font-bold text-red-500 text-xs shadow-[0_0_10px_#ef4444]">
              {telemetry.tireCompound[0]}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">TIRES</span>
              <span className="text-xs font-bold text-white uppercase">{telemetry.tireCompound}</span>
            </div>
          </div>
          <div className="w-24 bg-neutral-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                telemetry.tireWear > 70 ? 'bg-red-500' : telemetry.tireWear > 40 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.max(5, 100 - telemetry.tireWear)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-neutral-400">
            <span>{formatTemp(telemetry.tireTemp, unitSystem)}</span>
            <span>{100 - telemetry.tireWear}%</span>
          </div>
        </div>

        {/* Center: Central Cockpit Cluster & Dedicated Speedometer (+ Practice Mode Racing Line Coach) */}
        <div className="flex flex-col items-center gap-2">
          {/* STRICTLY PRACTICE MODE ONLY: Live Braking / Acceleration & Optimal Line Coach */}
          {isPracticeMode && !isQualifyingMode && showPracticeRacingLine && practiceLineCoach && (
            <div
              className={`flex items-center gap-3 px-4 py-2 rounded-xl border-2 shadow-2xl transition-all duration-100 ${
                practiceLineCoach.zone === 'brake'
                  ? 'bg-red-950/95 border-red-500 text-white shadow-[0_0_24px_rgba(239,68,68,0.55)]'
                  : practiceLineCoach.zone === 'coast'
                  ? 'bg-amber-950/95 border-amber-400 text-white shadow-[0_0_20px_rgba(251,191,36,0.45)]'
                  : 'bg-emerald-950/95 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]'
              }`}
            >
              {/* Action Badge */}
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-lg font-black text-xs uppercase tracking-wider ${
                    practiceLineCoach.zone === 'brake'
                      ? 'bg-red-500 text-white'
                      : practiceLineCoach.zone === 'coast'
                      ? 'bg-amber-400 text-black'
                      : 'bg-emerald-400 text-black'
                  }`}
                >
                  {practiceLineCoach.zone === 'brake'
                    ? '🔴 BRAKE HARD NOW!'
                    : practiceLineCoach.zone === 'coast'
                    ? '🟡 LIFT & TURN IN (APEX)'
                    : '🟢 FULL THROTTLE / ACCELERATE'}
                </span>
              </div>

              <div className="w-[1px] h-6 bg-white/20" />

              {/* Target Corner Speed */}
              <div className="flex flex-col items-center leading-tight font-mono">
                <span className="text-[9px] uppercase text-neutral-300 font-bold">TARGET SPEED</span>
                <span className="text-sm font-black text-white">
                  {Math.round(convertSpeed(practiceLineCoach.targetSpeedKmh, unitSystem))} {speedUnitLabel}
                </span>
              </div>

              <div className="w-[1px] h-6 bg-white/20 hidden sm:block" />

              {/* Optimal Racing Line Alignment Indicator */}
              <div className="hidden sm:flex flex-col items-center leading-tight">
                <span className="text-[9px] uppercase text-neutral-300 font-bold">RACING LINE POSITION</span>
                <span
                  className={`text-xs font-black uppercase ${
                    Math.abs(practiceLineCoach.lineOffsetErrorMeters) <= 1.6
                      ? 'text-emerald-300'
                      : 'text-amber-300'
                  }`}
                >
                  {Math.abs(practiceLineCoach.lineOffsetErrorMeters) <= 1.6
                    ? '✓ ON OPTIMAL LINE'
                    : practiceLineCoach.lineOffsetErrorMeters < 0
                    ? `◄ DRIFT LEFT (${Math.abs(practiceLineCoach.lineOffsetErrorMeters).toFixed(1)}m)`
                    : `DRIFT RIGHT (${Math.abs(practiceLineCoach.lineOffsetErrorMeters).toFixed(1)}m) ►`}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 bg-black/85 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/15 shadow-2xl">
          {/* Radial Speedometer Gauge (Analog dial + digital readout) */}
          <div className="relative w-20 h-20 sm:w-28 sm:h-28 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              {/* Background Arc */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#1f2937"
                strokeWidth="7"
                strokeDasharray="188.5"
                strokeDashoffset="37.7"
              />
              {/* Speed Value Arc */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={telemetry.speedKmh > 300 ? '#ef4444' : telemetry.speedKmh > 220 ? '#fbbf24' : '#22c55e'}
                strokeWidth="7"
                strokeDasharray="188.5"
                strokeDashoffset={Math.max(37.7, 188.5 - (Math.min(480, telemetry.speedKmh) / 480) * 150.8)}
                strokeLinecap="round"
                className="transition-all duration-75"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[8px] sm:text-[9px] uppercase font-bold text-neutral-400">SPEED</span>
              <span className="text-base sm:text-xl font-black text-white font-mono tabular-nums leading-none">
                {displaySpeed}
              </span>
              <span className="text-[7px] sm:text-[8px] font-bold text-neutral-400">{speedUnitLabel}</span>
            </div>
          </div>

          {/* Central Digital Display (Shift LEDs, Gear, Speed, ERS, Pedals) */}
          <div className="flex flex-col items-center gap-1.5">
            {/* Shift LED Lights (15 LEDs) */}
            <div className="flex gap-1 mb-1">
              {[...Array(15)].map((_, i) => {
                let color = 'bg-neutral-800';
                if (i < activeLeds) {
                  if (i < 5) color = 'bg-emerald-400 shadow-[0_0_8px_#34d399]';
                  else if (i < 10) color = 'bg-red-500 shadow-[0_0_8px_#ef4444]';
                  else color = 'bg-blue-500 shadow-[0_0_10px_#3b82f6]';
                }
                return <div key={i} className={`w-2 h-2.5 rounded-sm transition-all duration-75 ${color}`} />;
              })}
            </div>

            {/* Central Digital Display (Gear & Speed) */}
            <div className="flex items-baseline gap-6">
              <div className="flex flex-col items-center">
                <span className="text-[9px] uppercase tracking-wider text-neutral-400">GEAR</span>
                <span className="text-4xl md:text-5xl font-black text-amber-400 font-mono">
                  {telemetry.gear === 0 ? 'N' : telemetry.gear === -1 ? 'R' : telemetry.gear}
                </span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[9px] uppercase tracking-wider text-neutral-400">SPEED</span>
                <div className="flex items-baseline">
                  <span className="text-4xl md:text-5xl font-black text-white font-mono tabular-nums">
                    {displaySpeed}
                  </span>
                  <span className="text-[10px] font-bold text-neutral-400 ml-1">{speedUnitLabel}</span>
                </div>
              </div>

              {/* Throttle & Brake Pedals Monitor */}
              <div className="flex items-end gap-1.5 h-10 pb-1">
                <div className="w-2 bg-neutral-800 h-full rounded-sm overflow-hidden flex flex-col justify-end" title="Brake">
                  <div className="w-full bg-red-500 transition-all duration-75" style={{ height: `${(telemetry.brake || 0) * 100}%` }} />
                </div>
                <div className="w-2 bg-neutral-800 h-full rounded-sm overflow-hidden flex flex-col justify-end" title="Throttle">
                  <div className="w-full bg-emerald-400 transition-all duration-75" style={{ height: `${(telemetry.throttle || 0) * 100}%` }} />
                </div>
              </div>
            </div>

            {/* ERS Energy Bar & DRS Status */}
            <div className="flex items-center gap-4 w-full mt-1">
              <div className="flex-1 flex flex-col gap-0.5">
                <div className="flex justify-between text-[9px] font-bold tracking-wider text-neutral-400">
                  <span>ERS</span>
                  <span className="text-cyan-400 font-mono">{telemetry.ersBattery}%</span>
                </div>
                <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] transition-all duration-100"
                    style={{ width: `${telemetry.ersBattery}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest transition-colors ${
                    telemetry.drsActive
                      ? 'bg-emerald-500 text-black shadow-[0_0_12px_#10b981]'
                      : telemetry.drsAvailable
                      ? 'bg-amber-400 text-black animate-pulse'
                      : 'bg-neutral-800 text-neutral-500'
                  }`}
                >
                  {telemetry.drsActive ? 'DRS OPEN' : telemetry.drsAvailable ? 'DRS READY' : 'DRS OFF'}
                </span>
              </div>
            </div>

            {/* AI Speed Monitor */}
            <div className="text-[9px] font-mono font-bold tracking-wider text-neutral-400 border-t border-white/10 pt-1 w-full text-center flex items-center justify-center gap-2">
              <span className="text-cyan-400">AI SPEED MONITOR:</span>
              <span className="text-white">
                {telemetry.crashWaitMode === 'legend'
                  ? 'LEGEND 1.04x+ (335+ KM/H) • TIER 1 ADVANTAGE'
                  : telemetry.crashWaitMode === 'pro'
                  ? 'PRO 0.89x (315 KM/H REALISTIC)'
                  : 'ROOKIE 0.80x (285 KM/H BALANCED)'}
              </span>
            </div>
          </div>
          </div>
        </div>

        {/* Right: Track Radar Mini-Map & Controller Status */}
        <div className="flex flex-col items-end gap-2.5">
          <TrackMiniMap circuit={circuit} carsRadar={telemetry.carsRadar || []} />

          <div className="flex flex-col items-end gap-2 bg-black/60 backdrop-blur-md p-3 rounded-lg border border-white/10 shadow-2xl">
            <div className="flex items-center gap-2 text-xs">
              {isGamepadConnected ? (
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <Gamepad className="w-4 h-4" />
                  <span className="text-[11px] truncate max-w-[120px]">
                    {gamepadName ? 'Controller Active' : 'Gamepad Connected'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-neutral-300 font-semibold">
                  <Keyboard className="w-4 h-4 text-cyan-400" />
                  <span className="text-[11px]">WASD / Arrows</span>
                </div>
              )}
            </div>
            <div className="text-[10px] text-neutral-400 flex flex-col items-end font-mono leading-tight">
              <span className="text-emerald-400/90 font-bold">[1] BLOCK • [2] YIELD • [3] PUSH</span>
              {isPracticeMode && !isQualifyingMode && (
                <span className="text-amber-300 font-bold">[L] TOGGLE RACING LINE</span>
              )}
              <span>[E / A] BOOST / DRS</span>
              <span>[W / RT] THROTTLE</span>
              <span>[S / LT] BRAKE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
