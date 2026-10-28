import React, { useState, useEffect } from 'react';
import { TelemetryData, CircuitInfo, CameraView, Driver } from '../types/racing';
import { DRIVERS, TEAMS } from '../constants/f1Data';
import {
  Gamepad,
  Keyboard,
  Camera,
  RotateCcw,
  Volume2,
  VolumeX,
  Flag,
  AlertTriangle,
  Shield,
  Wind,
  Users,
  Radio,
  Zap,
  Gauge,
  Sun,
  Moon,
  Sparkles,
  ArrowLeftRight,
} from 'lucide-react';
import { TrackMiniMap } from './TrackMiniMap';
import { PracticeLineCoachData } from '../game/racingLineBuilder';
import {
  UnitSystem,
  getStoredUnitSystem,
  setStoredUnitSystem,
  convertSpeed,
  getSpeedUnitLabel,
  formatTemp,
  onUnitSystemChange,
} from '../utils/units';
import {
  AppThemeId,
  APP_THEMES,
  THEME_OPTIONS,
  SpeedometerDockSide,
  getStoredTheme,
  setStoredTheme,
  onThemeChange,
  getStoredSpeedometerDock,
  setStoredSpeedometerDock,
  onSpeedometerDockChange,
} from '../utils/themeSettings';

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
  onPitStop?: (compound?: 'SOFT' | 'MEDIUM' | 'HARD') => void;
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
  onPitStop,
}) => {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(getStoredUnitSystem());
  const [theme, setTheme] = useState<AppThemeId>(getStoredTheme());
  const [dockSide, setDockSide] = useState<SpeedometerDockSide>(getStoredSpeedometerDock());

  useEffect(() => {
    const unsubUnits = onUnitSystemChange((newUnit) => setUnitSystem(newUnit));
    const unsubTheme = onThemeChange((newTheme) => setTheme(newTheme));
    const unsubDock = onSpeedometerDockChange((newSide) => setDockSide(newSide));
    return () => {
      unsubUnits();
      unsubTheme();
      unsubDock();
    };
  }, []);

  const toggleUnits = () => {
    const nextUnit = unitSystem === 'metric' ? 'imperial' : 'metric';
    setUnitSystem(nextUnit);
    setStoredUnitSystem(nextUnit);
  };

  const cycleTheme = () => {
    const idx = THEME_OPTIONS.indexOf(theme);
    const next = THEME_OPTIONS[(idx + 1) % THEME_OPTIONS.length];
    setStoredTheme(next);
  };

  const toggleDockSide = () => {
    const nextSide: SpeedometerDockSide = dockSide === 'right' ? 'left' : 'right';
    setDockSide(nextSide);
    setStoredSpeedometerDock(nextSide);
  };

  const isLight = theme === 'light';

  // Theme-adaptive surface classes so the HUD looks rich and distinct in every theme
  const panelSurface = isLight
    ? 'bg-white/90 text-slate-900 border-slate-300/90 shadow-[0_12px_32px_rgba(15,23,42,0.16)] backdrop-blur-md'
    : theme === 'retro'
    ? 'bg-[#12052c]/92 text-white border-[#ff2a85]/60 shadow-[0_0_24px_rgba(255,42,133,0.3)] backdrop-blur-md'
    : theme === 'papaya'
    ? 'bg-slate-950/90 text-white border-orange-500/35 shadow-[0_12px_34px_rgba(0,0,0,0.65)] backdrop-blur-md'
    : theme === 'rosso'
    ? 'bg-neutral-950/90 text-white border-red-500/35 shadow-[0_12px_34px_rgba(0,0,0,0.65)] backdrop-blur-md'
    : theme === 'emerald'
    ? 'bg-emerald-950/90 text-white border-emerald-400/35 shadow-[0_12px_34px_rgba(0,0,0,0.65)] backdrop-blur-md'
    : 'bg-zinc-950/90 text-white border-white/15 shadow-2xl backdrop-blur-md';

  const subSurface = isLight
    ? 'bg-slate-100/95 border-slate-300/80 text-slate-900'
    : theme === 'retro'
    ? 'bg-[#1d0944]/90 border-[#00f0ff]/40 text-white'
    : theme === 'papaya'
    ? 'bg-slate-900/90 border-orange-400/20 text-white'
    : theme === 'rosso'
    ? 'bg-red-950/50 border-red-500/20 text-white'
    : theme === 'emerald'
    ? 'bg-emerald-900/50 border-emerald-400/20 text-white'
    : 'bg-zinc-900/90 border-white/10 text-white';

  const mutedText = isLight ? 'text-slate-500' : 'text-zinc-400';
  const primaryText = isLight ? 'text-slate-900' : 'text-white';
  const dividerColor = isLight ? 'bg-slate-300' : 'bg-white/10';

  const displaySpeed = Math.round(convertSpeed(telemetry.speedKmh, unitSystem));
  const speedUnitLabel = getSpeedUnitLabel(unitSystem);

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
      const sortedRadar = [...telemetry.carsRadar].sort(
        (a, b) => (a.position || 20) - (b.position || 20)
      );
      return sortedRadar.slice(0, 10).map((r, idx) => {
        const driver = r.isPlayer
          ? playerDriver
          : DRIVERS.find((d) => d.shortName === r.shortName) || {
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
            };
        const isTeammate = Boolean(
          r.isTeammate ||
            (telemetry.teammateShortName &&
              driver.shortName === telemetry.teammateShortName)
        );
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
      isTeammate: Boolean(
        telemetry.teammateShortName &&
          driver.shortName === telemetry.teammateShortName
      ),
      gapToLeaderSeconds: idx === 0 ? 0 : idx * 1.5,
      gapToAheadSeconds: 1.5,
      gapToPlayerSeconds: (idx + 1 - telemetry.position) * 1.5,
      leadOverP2Seconds: idx === 0 ? 1.5 : undefined,
    }));
  }, [telemetry.carsRadar, telemetry.position, playerDriver, telemetry.teammateShortName]);

  // Speedometer + Gear + Tires + ERS/DRS Side Telemetry Cluster
  const tireLifePct = telemetry.tireLife ?? Math.max(0, 100 - telemetry.tireWear);
  const tireGripPct = Math.round((telemetry.tireGripMultiplier ?? 1.0) * 100);
  const tireStatus = telemetry.tireStatusLabel || (tireLifePct < 20 ? 'CRITICAL' : tireLifePct < 42 ? 'BLISTERING' : tireLifePct < 70 ? 'GRAINING' : 'OPTIMAL');
  const compoundRingClass =
    telemetry.tireCompound === 'SOFT'
      ? 'border-red-500 text-red-500'
      : telemetry.tireCompound === 'MEDIUM'
      ? 'border-amber-400 text-amber-400'
      : 'border-slate-200 text-slate-100';

  const renderTelemetryCluster = () => (
    <div className="flex flex-col gap-2 w-[285px] sm:w-[315px] pointer-events-auto">
      {/* Interactive Tire Life, Mechanical Grip & Pit Box Strategy Strip */}
      <div className={`flex flex-col gap-2 px-3.5 py-2.5 rounded-xl border ${panelSurface}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-full border-2 bg-zinc-900 flex items-center justify-center font-black text-xs shrink-0 ${compoundRingClass}`}>
              {telemetry.tireCompound[0]}
            </div>
            <div className="flex flex-col leading-tight">
              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] uppercase tracking-wider font-bold ${mutedText}`}>
                  PIRELLI {telemetry.tireCompound}
                </span>
                <span
                  className={`text-[9px] font-mono font-black px-1.5 py-0.2 rounded ${
                    tireStatus === 'OPTIMAL'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : tireStatus === 'GRAINING'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-red-500/25 text-red-400 animate-pulse'
                  }`}
                >
                  {tireGripPct}% GRIP · {tireStatus}
                </span>
              </div>
              <span className={`text-xs font-mono font-bold tabular-nums ${primaryText}`}>
                {tireLifePct}% LIFE · {formatTemp(telemetry.tireTemp, unitSystem)}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="w-20 bg-zinc-800/80 h-2 rounded-full overflow-hidden border border-white/10">
              <div
                className={`h-full transition-all duration-300 ${
                  tireLifePct < 25
                    ? 'bg-red-500'
                    : tireLifePct < 55
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.max(4, tireLifePct)}%` }}
              />
            </div>
            {telemetry.tireCorners && (
              <span className={`text-[8px] font-mono tabular-nums ${mutedText}`}>
                FL {telemetry.tireCorners.fl}% · FR {telemetry.tireCorners.fr}%
              </span>
            )}
          </div>
        </div>

        {/* Compound Switcher + [P] Pit Box Service Controls */}
        {!isQualifyingMode && onPitStop && (
          <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/10">
            <div className="flex items-center gap-1">
              {(['SOFT', 'MEDIUM', 'HARD'] as const).map((comp) => {
                const isSelected = telemetry.tireCompound === comp;
                return (
                  <button
                    key={comp}
                    type="button"
                    onClick={() => onPitStop(comp)}
                    className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer border ${
                      isSelected
                        ? comp === 'SOFT'
                          ? 'bg-red-600 text-white border-red-400'
                          : comp === 'MEDIUM'
                          ? 'bg-amber-500 text-black border-amber-300'
                          : 'bg-slate-200 text-black border-white'
                        : `${subSurface} opacity-75 hover:opacity-100`
                    }`}
                    title={`Pit & fit fresh 100% Pirelli ${comp} compound`}
                  >
                    {comp[0]} · {comp === 'SOFT' ? '+7% Grip' : comp === 'MEDIUM' ? 'Bal' : 'Long'}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => onPitStop(telemetry.tireCompound)}
              className={`px-2 py-0.5 rounded text-[9px] font-mono font-black uppercase tracking-wider transition-all cursor-pointer border ${
                tireLifePct < 45
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black border-emerald-300 animate-pulse'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border-emerald-500/40'
              }`}
              title="Press [P] or click to Pit for fresh 100% Tires (2.2s stop)"
            >
              {telemetry.pitStopActive ? `PIT ${telemetry.pitStopTimer}s` : '[P] BOX 100%'}
            </button>
          </div>
        )}
      </div>

      {/* Main Side Speedometer, Gear, RPM Shift Lights & ERS/DRS Pod */}
      <div className={`flex flex-col px-4 py-3 rounded-2xl border ${panelSurface}`}>
        {/* Pod Header with Left/Right Dock Switcher */}
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[9px] uppercase tracking-widest font-bold ${mutedText}`}>
            FIA TELEMETRY POD
          </span>
          <button
            onClick={toggleDockSide}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer border ${subSurface} hover:opacity-85`}
            title="Move Speedometer Pod to the Left or Right side of the screen"
          >
            <ArrowLeftRight className="w-2.5 h-2.5 text-orange-400" />
            <span>Dock {dockSide === 'right' ? 'Left' : 'Right'}</span>
          </button>
        </div>

        {/* 15-LED RPM Shift Light Strip */}
        <div className="flex items-center justify-between gap-1 w-full mb-2.5">
          {[...Array(15)].map((_, i) => {
            let color = isLight ? 'bg-slate-200' : 'bg-zinc-800/90';
            if (i < activeLeds) {
              if (i < 5) color = 'bg-emerald-500 shadow-[0_0_8px_#10b981]';
              else if (i < 10) color = 'bg-red-500 shadow-[0_0_8px_#ef4444]';
              else color = 'bg-sky-400 shadow-[0_0_10px_#38bdf8]';
            }
            return (
              <div
                key={i}
                className={`flex-1 h-2 rounded-sm transition-colors duration-75 ${color}`}
              />
            );
          })}
        </div>

        {/* Core Telemetry Row: Gear, Digital Speed, Pedal Pressure Bars */}
        <div className="flex items-center justify-between gap-3 w-full">
          {/* Gear Readout */}
          <div className={`flex flex-col items-center border rounded-xl px-3.5 py-1.5 min-w-[60px] ${subSurface}`}>
            <span className={`text-[9px] uppercase tracking-wider font-bold ${mutedText}`}>
              GEAR
            </span>
            <span className="text-3xl font-black text-amber-500 font-mono tabular-nums leading-none mt-0.5">
              {telemetry.gear === 0 ? 'N' : telemetry.gear === -1 ? 'R' : telemetry.gear}
            </span>
          </div>

          {/* Authoritative Digital Speed Readout */}
          <div className="flex flex-col items-center">
            <div className="flex items-baseline gap-1">
              <span className={`text-4xl font-black font-mono tabular-nums tracking-tight leading-none ${primaryText}`}>
                {displaySpeed}
              </span>
              <span className={`text-[11px] font-bold uppercase ${mutedText}`}>
                {speedUnitLabel}
              </span>
            </div>
            <span className={`text-[10px] font-mono tabular-nums mt-1 ${mutedText}`}>
              {Math.round(telemetry.rpm).toLocaleString()} RPM
            </span>
          </div>

          {/* Live Brake & Throttle Pedal Telemetry Bars */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`w-2.5 h-10 border rounded-sm overflow-hidden flex flex-col justify-end ${subSurface}`}
                title="Brake Pressure"
              >
                <div
                  className="w-full bg-red-500 transition-all duration-75"
                  style={{ height: `${(telemetry.brake || 0) * 100}%` }}
                />
              </div>
              <span className={`text-[8px] font-mono font-bold ${mutedText}`}>BRK</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`w-2.5 h-10 border rounded-sm overflow-hidden flex flex-col justify-end ${subSurface}`}
                title="Throttle Input"
              >
                <div
                  className="w-full bg-emerald-500 transition-all duration-75"
                  style={{ height: `${(telemetry.throttle || 0) * 100}%` }}
                />
              </div>
              <span className={`text-[8px] font-mono font-bold ${mutedText}`}>THR</span>
            </div>
          </div>
        </div>

        {/* ERS Battery & DRS Status Bar */}
        <div className={`flex items-center gap-2.5 w-full mt-2.5 pt-2 border-t ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
          <div className="flex-1 flex flex-col gap-1">
            <div className={`flex justify-between text-[9px] font-bold tracking-wider ${mutedText}`}>
              <span>ERS BATTERY</span>
              <span className="text-sky-500 font-mono tabular-nums font-black">
                {telemetry.ersBattery}%
              </span>
            </div>
            <div className={`w-full h-1.5 rounded-full overflow-hidden border ${subSurface}`}>
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-100"
                style={{ width: `${telemetry.ersBattery}%` }}
              />
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors shrink-0 ${
              telemetry.drsActive
                ? 'bg-emerald-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                : telemetry.drsAvailable
                ? 'bg-amber-400 text-black'
                : `${subSurface} opacity-75`
            }`}
          >
            {telemetry.drsActive
              ? 'DRS OPEN'
              : telemetry.drsAvailable
              ? 'DRS READY'
              : 'DRS OFF'}
          </span>
        </div>
      </div>
    </div>
  );

  // Track Radar Mini-Map + Input Status Pod (placed on the opposite bottom corner)
  const renderMiniMapCorner = () => (
    <div className={`flex flex-col ${dockSide === 'right' ? 'items-start' : 'items-end'} gap-2`}>
      <TrackMiniMap circuit={circuit} carsRadar={telemetry.carsRadar || []} />

      <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-mono ${panelSurface}`}>
        {isGamepadConnected ? (
          <span className="flex items-center gap-1.5 text-emerald-500 font-bold">
            <Gamepad className="w-3.5 h-3.5" />
            <span>Gamepad</span>
          </span>
        ) : (
          <span className={`flex items-center gap-1.5 font-semibold ${primaryText}`}>
            <Keyboard className="w-3.5 h-3.5 text-sky-500" />
            <span>WASD / Arrows</span>
          </span>
        )}
        <span className={mutedText}>·</span>
        <span className={mutedText}>[E] DRS/ERS</span>
        <span className={mutedText}>·</span>
        <span className={mutedText}>[C] Cam</span>
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden flex flex-col justify-between p-3.5 md:p-5 font-racing">
      {/* 1. TOP BROADCAST BAR */}
      <div className="flex items-start justify-between w-full gap-3">
        {/* Top-Left: Session Header, FIA Live Timing Tower & Pit Radio Console */}
        <div className="flex flex-col gap-2 max-w-[240px] w-full">
          <div className={`flex items-center gap-3 px-3.5 py-2 rounded-xl border ${panelSurface}`}>
            <div
              className={`w-1.5 h-8 rounded-full shrink-0 ${
                isQualifyingMode
                  ? 'bg-purple-500'
                  : isPracticeMode
                  ? 'bg-amber-400'
                  : 'bg-red-600'
              }`}
            />
            <div className="flex flex-col min-w-0">
              <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold ${mutedText}`}>
                <Flag
                  className={`w-3 h-3 shrink-0 ${
                    isQualifyingMode
                      ? 'text-purple-500'
                      : isPracticeMode
                      ? 'text-amber-500'
                      : 'text-red-500'
                  }`}
                />
                <span className="truncate">{circuit.country}</span>
                <span>·</span>
                <span
                  className={
                    isQualifyingMode
                      ? 'text-purple-500 font-bold'
                      : isPracticeMode
                      ? 'text-amber-500 font-bold'
                      : 'text-red-500 font-bold'
                  }
                >
                  {isQualifyingMode ? 'QUALIFYING' : isPracticeMode ? 'PRACTICE' : 'GRAND PRIX'}
                </span>
              </div>
              <span className={`text-sm font-bold tracking-tight truncate ${primaryText}`}>
                {circuit.name}
              </span>
            </div>
          </div>

          {/* FIA Leaderboard Tower */}
          <div className={`hidden sm:flex flex-col gap-0.5 p-2.5 rounded-xl border w-full ${panelSurface}`}>
            <div className={`px-1.5 pb-1.5 mb-1 text-[10px] uppercase font-bold tracking-wider flex items-center justify-between border-b ${isLight ? 'border-slate-200 text-slate-500' : 'border-white/10 text-zinc-400'}`}>
              <span>POS · DRIVER</span>
              <span>INTERVAL</span>
            </div>
            {timingTower.map((item) => {
              const {
                driver,
                position,
                isPlayer,
                isTeammate,
                gapToLeaderSeconds,
                gapToPlayerSeconds,
              } = item;
              const team = TEAMS.find((t) => t.id === driver.teamId);
              const teamColor = team?.primaryColor || '#e11d48';

              return (
                <div
                  key={driver.id}
                  className={`flex items-center justify-between px-1.5 py-1 rounded-md text-xs transition-colors ${
                    isPlayer
                      ? isLight
                        ? 'bg-sky-500/20 ring-1 ring-sky-500/60 font-bold text-slate-900'
                        : 'bg-sky-500/20 ring-1 ring-sky-400/50 font-bold text-white'
                      : isTeammate
                      ? isLight
                        ? 'bg-emerald-500/20 ring-1 ring-emerald-500/50 font-bold text-emerald-900'
                        : 'bg-emerald-500/15 ring-1 ring-emerald-400/40 font-bold text-emerald-200'
                      : isLight
                      ? 'text-slate-700'
                      : 'text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className={`w-5 h-5 rounded flex items-center justify-center font-black font-mono text-[10px] tabular-nums shrink-0 ${
                        position === 1
                          ? 'bg-amber-400 text-black'
                          : position === 2
                          ? 'bg-slate-300 text-black'
                          : position === 3
                          ? 'bg-amber-600 text-white'
                          : isPlayer
                          ? 'bg-sky-500 text-white'
                          : `${subSurface}`
                      }`}
                    >
                      {position}
                    </span>
                    <div
                      className="w-1 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: isTeammate ? '#10b981' : teamColor }}
                    />
                    <span
                      className={`font-mono tracking-wider truncate flex items-center gap-1 ${
                        isPlayer
                          ? isLight
                            ? 'text-sky-700 font-black'
                            : 'text-sky-300 font-black'
                          : isTeammate
                          ? isLight
                            ? 'text-emerald-700 font-black'
                            : 'text-emerald-300 font-black'
                          : primaryText
                      }`}
                    >
                      <span>{driver.shortName}</span>
                      {isTeammate && (
                        <span className="text-[8px] text-emerald-500 font-sans font-bold">
                          TM
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="text-[10px] font-mono tabular-nums text-right shrink-0">
                    {position === 1 ? (
                      <span className="text-amber-500 font-black">
                        {telemetry.p1LeadSeconds !== undefined && telemetry.p1LeadSeconds > 0
                          ? `LEAD +${telemetry.p1LeadSeconds.toFixed(2)}s`
                          : 'LEADER'}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span
                          className={
                            position <= 3
                              ? isLight
                                ? 'text-sky-700 font-bold'
                                : 'text-cyan-300 font-bold'
                              : mutedText
                          }
                        >
                          +{gapToLeaderSeconds.toFixed(2)}s
                        </span>
                        {!isPlayer && gapToPlayerSeconds !== 0 && (
                          <span
                            className={`text-[9px] font-semibold ${
                              gapToPlayerSeconds > 0 ? 'text-emerald-500' : 'text-rose-500'
                            }`}
                          >
                            {gapToPlayerSeconds > 0
                              ? `(-${gapToPlayerSeconds.toFixed(1)})`
                              : `(+${Math.abs(gapToPlayerSeconds).toFixed(1)})`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Docked Left-Side Pit Radio Strategy Console (Out of the center view!) */}
          {(telemetry.teammatePosition ||
            telemetry.teammateShortName ||
            telemetry.teammateDriverName) &&
            onIssueTeamOrder && (
              <div className={`hidden sm:flex flex-col gap-1.5 p-2.5 rounded-xl border pointer-events-auto ${panelSurface}`}>
                <div className="flex items-center justify-between text-[10px] font-bold uppercase text-emerald-500">
                  <span className="flex items-center gap-1">
                    <Radio className="w-3 h-3" />
                    PIT RADIO ({telemetry.teammateShortName || 'TM'})
                  </span>
                  <span className="font-mono tabular-nums">{telemetry.teammateObedience ?? 75}%</span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => onIssueTeamOrder('block')}
                    className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                      telemetry.teammateCurrentOrder === 'block'
                        ? 'bg-amber-400 text-black font-bold'
                        : `${subSurface} hover:opacity-85`
                    }`}
                  >
                    <kbd className="text-[9px] font-mono text-amber-500 font-bold">[1]</kbd>
                    <span>Block</span>
                  </button>
                  <button
                    onClick={() => onIssueTeamOrder('yield')}
                    className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                      telemetry.teammateCurrentOrder === 'yield'
                        ? 'bg-sky-400 text-black font-bold'
                        : `${subSurface} hover:opacity-85`
                    }`}
                  >
                    <kbd className="text-[9px] font-mono text-sky-500 font-bold">[2]</kbd>
                    <span>Yield</span>
                  </button>
                  <button
                    onClick={() => onIssueTeamOrder('push')}
                    className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                      telemetry.teammateCurrentOrder === 'push'
                        ? 'bg-red-600 text-white font-bold'
                        : `${subSurface} hover:opacity-85`
                    }`}
                  >
                    <kbd className="text-[9px] font-mono text-red-500 font-bold">[3]</kbd>
                    <Zap className="w-2.5 h-2.5 text-red-500" />
                    <span>Push</span>
                  </button>
                  <button
                    onClick={() => onIssueTeamOrder('neutral')}
                    className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                      telemetry.teammateCurrentOrder === 'neutral'
                        ? 'bg-emerald-500 text-black font-bold'
                        : `${subSurface} hover:opacity-85`
                    }`}
                  >
                    <kbd className="text-[9px] font-mono opacity-75">[4]</kbd>
                    <span>Free</span>
                  </button>
                </div>
              </div>
            )}
        </div>

        {/* Top-Center: Ultra-Slim Flush Telemetry Strip (Hugs the very top edge so the windshield & car are 100% clear) */}
        <div className="flex flex-col items-center gap-1.5 mx-auto">
          <div className={`flex items-center gap-3.5 px-4 py-1.5 rounded-xl border ${panelSurface}`}>
            {/* Lap Counter */}
            <div className="flex flex-col items-center">
              <span className={`text-[8px] uppercase tracking-wider font-bold ${mutedText}`}>
                {isQualifyingMode ? 'SHOOTOUT' : 'LAP'}
              </span>
              <span className={`text-sm md:text-base font-black font-mono tabular-nums leading-tight ${primaryText}`}>
                {isQualifyingMode ? (
                  <span>
                    1 <span className="text-xs text-purple-500">/ 1</span>
                  </span>
                ) : (
                  <>
                    {telemetry.currentLap}{' '}
                    <span className={`text-xs ${mutedText}`}>/ {telemetry.totalLaps}</span>
                  </>
                )}
              </span>
            </div>

            <div className={`w-px h-6 ${dividerColor}`} />

            {/* Player Position */}
            <div className="flex flex-col items-center">
              <span className={`text-[8px] uppercase tracking-wider font-bold ${mutedText}`}>
                POS
              </span>
              <div className="flex items-baseline gap-1 font-mono tabular-nums leading-tight">
                <span className="text-sm md:text-base font-black text-sky-500">
                  P{telemetry.position}
                </span>
                <span className={`text-[10px] ${mutedText}`}>/ 20</span>
              </div>
            </div>

            <div className={`w-px h-6 ${dividerColor}`} />

            {/* Accurate Seconds Lead / Gap */}
            <div className="flex flex-col items-center">
              <span className={`text-[8px] uppercase tracking-wider font-bold ${mutedText}`}>
                {telemetry.position === 1 ? 'LEAD' : 'GAP TO P1'}
              </span>
              <span
                className={`text-sm md:text-base font-mono font-bold tabular-nums leading-tight ${
                  telemetry.position === 1 ? 'text-amber-500' : 'text-sky-500'
                }`}
              >
                {telemetry.position === 1
                  ? telemetry.p1LeadSeconds !== undefined && telemetry.p1LeadSeconds > 0
                    ? `+${telemetry.p1LeadSeconds.toFixed(2)}s`
                    : 'LEADER'
                  : `+${(telemetry.deltaToLeader || 0).toFixed(2)}s`}
              </span>
            </div>

            <div className={`w-px h-6 hidden md:block ${dividerColor}`} />

            {/* Best Lap */}
            <div className="hidden md:flex flex-col items-center">
              <span className={`text-[8px] uppercase tracking-wider font-bold ${mutedText}`}>
                BEST LAP
              </span>
              <span className="text-xs md:text-sm font-mono font-bold text-purple-500 tabular-nums leading-tight">
                {formatTime(telemetry.lapTimeBest)}
              </span>
            </div>

            {/* Teammate Live Tracker */}
            {telemetry.teammatePosition && (
              <>
                <div className={`w-px h-6 hidden lg:block ${dividerColor}`} />
                <div className="hidden lg:flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <div className="flex flex-col text-left leading-tight">
                    <span className="text-[8px] font-bold uppercase text-emerald-500 tracking-wider">
                      {telemetry.teammateShortName || 'TM'}
                    </span>
                    <span className={`text-xs font-black font-mono tabular-nums ${primaryText}`}>
                      P{telemetry.teammatePosition}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Practice Mode Only: Top-of-Screen Live Braking / Throttle & Optimal Line Coach */}
          {isPracticeMode &&
            !isQualifyingMode &&
            showPracticeRacingLine &&
            practiceLineCoach && (
              <div
                className={`flex items-center gap-3 px-3.5 py-1 rounded-xl border shadow-xl transition-colors duration-100 backdrop-blur-md ${
                  practiceLineCoach.zone === 'brake'
                    ? 'bg-red-950/90 border-red-500/70 text-white'
                    : practiceLineCoach.zone === 'coast'
                    ? 'bg-amber-950/90 border-amber-400/70 text-white'
                    : 'bg-emerald-950/90 border-emerald-400/70 text-white'
                }`}
              >
                <span
                  className={`px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider shrink-0 ${
                    practiceLineCoach.zone === 'brake'
                      ? 'bg-red-500 text-white'
                      : practiceLineCoach.zone === 'coast'
                      ? 'bg-amber-400 text-black'
                      : 'bg-emerald-400 text-black'
                  }`}
                >
                  {practiceLineCoach.zone === 'brake'
                    ? `BRAKE (${practiceLineCoach.recommendedPedalPct}%)`
                    : practiceLineCoach.zone === 'coast'
                    ? 'LIFT & TURN IN'
                    : 'FULL THROTTLE'}
                </span>

                <span className="text-xs font-mono font-black text-white tabular-nums">
                  Target: {Math.round(convertSpeed(practiceLineCoach.targetSpeedKmh, unitSystem))}{' '}
                  {speedUnitLabel}
                </span>

                <span
                  className={`hidden sm:inline text-[10px] font-black uppercase ${
                    Math.abs(practiceLineCoach.lineOffsetErrorMeters) <= 1.6
                      ? 'text-emerald-300'
                      : 'text-amber-300'
                  }`}
                >
                  {Math.abs(practiceLineCoach.lineOffsetErrorMeters) <= 1.6
                    ? '✓ OPTIMAL LINE'
                    : practiceLineCoach.lineOffsetErrorMeters < 0
                    ? `◄ LEFT ${Math.abs(practiceLineCoach.lineOffsetErrorMeters).toFixed(1)}m`
                    : `RIGHT ${Math.abs(practiceLineCoach.lineOffsetErrorMeters).toFixed(1)}m ►`}
                </span>
              </div>
            )}

          {/* Compact Top-Edge Status Pills (Slipstream / Yellow Flag / Recovery Shield) */}
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {yellowFlagActive && (
              <div className="bg-amber-400 text-black px-3 py-1 rounded-lg font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-lg">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>YELLOW FLAG</span>
              </div>
            )}

            {telemetry.slipstreamActive && (
              <div className="bg-emerald-500 text-black px-3 py-1 rounded-lg font-black text-[10px] font-mono tabular-nums flex items-center gap-1.5 shadow-lg">
                <Wind className="w-3.5 h-3.5" />
                <span>
                  SLIPSTREAM TOW +{Math.round((telemetry.slipstreamFactor || 0.8) * 22)} KM/H
                </span>
              </div>
            )}

            {telemetry.protectionShieldTimer !== undefined &&
              telemetry.protectionShieldTimer > 0 && (
                <div className="bg-sky-500 text-black px-3 py-1 rounded-lg font-black text-[10px] font-mono tabular-nums flex items-center gap-1.5 shadow-lg">
                  <Shield className="w-3.5 h-3.5" />
                  <span>GHOST SHIELD: {telemetry.protectionShieldTimer.toFixed(1)}s</span>
                </div>
              )}

            {telemetry.crashWaitTimer !== undefined && telemetry.crashWaitTimer > 0 && (
              <div className="bg-red-600 text-white px-3.5 py-1 rounded-lg font-black text-[10px] font-mono tabular-nums flex items-center gap-1.5 shadow-lg">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>ANTI-STALL RESET: {telemetry.crashWaitTimer.toFixed(1)}s</span>
              </div>
            )}
          </div>
        </div>

        {/* Top-Right: Quick Session Controls + Theme Switcher (Positioned at mt-10 below the FPS/Graphics/Exit dock) */}
        <div className="flex flex-col items-end gap-2 mt-10 pointer-events-auto shrink-0">
          <div className={`flex items-center gap-1 p-1 rounded-xl border ${panelSurface}`}>
            <button
              onClick={cycleTheme}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${subSurface} hover:opacity-85`}
              title="Switch UI Color Theme (Light, Dark, Papaya, Rosso, Emerald)"
            >
              {isLight ? (
                <Sun className="w-3.5 h-3.5 text-amber-500" />
              ) : theme === 'dark' ? (
                <Moon className="w-3.5 h-3.5 text-sky-400" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              )}
              <span className="text-[11px]">{APP_THEMES[theme].shortLabel}</span>
            </button>

            <div className={`w-px h-4 ${dividerColor}`} />

            <button
              onClick={onCycleCamera}
              className="flex items-center gap-1.5 px-2.5 py-1 hover:opacity-80 text-xs rounded-md transition-opacity cursor-pointer whitespace-nowrap"
              title="Switch Camera (Key C)"
            >
              <Camera className="w-3.5 h-3.5 text-sky-500" />
              <span className="uppercase text-[11px] font-bold">{cameraView}</span>
            </button>

            <div className={`w-px h-4 ${dividerColor}`} />

            <button
              onClick={onResetCar}
              className="flex items-center gap-1 px-2 py-1 hover:opacity-80 text-xs rounded-md transition-opacity cursor-pointer"
              title="Reset to Track (Key R)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
            </button>

            {onOpenControls && (
              <>
                <div className={`w-px h-4 ${dividerColor}`} />
                <button
                  onClick={onOpenControls}
                  className="flex items-center gap-1 px-2 py-1 hover:opacity-80 text-xs rounded-md transition-opacity cursor-pointer whitespace-nowrap"
                  title="Button Mapping & Controls"
                >
                  <Keyboard className="w-3.5 h-3.5 text-sky-500" />
                  <span className="hidden md:inline text-[11px] font-semibold">Controls</span>
                </button>
              </>
            )}

            <div className={`w-px h-4 ${dividerColor}`} />

            <button
              onClick={toggleUnits}
              className="flex items-center gap-1 px-2 py-1 hover:opacity-80 text-xs rounded-md transition-opacity font-mono font-bold cursor-pointer whitespace-nowrap"
              title="Switch between MPH and KM/H"
            >
              <Gauge className="w-3.5 h-3.5 text-sky-500" />
              <span className="text-[11px]">{unitSystem === 'imperial' ? 'MPH' : 'KM/H'}</span>
            </button>

            <div className={`w-px h-4 ${dividerColor}`} />

            <button
              onClick={onToggleMute}
              className="p-1 hover:opacity-80 rounded-md transition-opacity cursor-pointer"
              title="Mute / Unmute Audio"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-red-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-500" />
              )}
            </button>
          </div>

          {/* Practice Mode Controls Row */}
          {isPracticeMode && !isQualifyingMode && (
            <div className="flex items-center gap-1.5">
              {onSetPracticeBotCount && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${panelSurface}`}>
                  <span className="text-[10px] font-bold uppercase text-amber-500 mr-1">
                    Bots:
                  </span>
                  {[
                    { count: 0, label: '0' },
                    { count: 5, label: '5' },
                    { count: 10, label: '10' },
                    { count: 19, label: '19' },
                  ].map((opt) => (
                    <button
                      key={opt.count}
                      onClick={() => onSetPracticeBotCount(opt.count)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                        practiceBotCount === opt.count
                          ? 'bg-amber-400 text-black'
                          : `${mutedText} hover:opacity-100`
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {onTogglePracticeRacingLine && (
                <button
                  onClick={onTogglePracticeRacingLine}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-lg border transition-colors cursor-pointer font-bold whitespace-nowrap ${
                    showPracticeRacingLine
                      ? 'bg-emerald-500 text-black border-emerald-400 shadow-lg'
                      : `${panelSurface}`
                  }`}
                  title="Toggle 3D Optimal Racing Line (Key L)"
                >
                  <span>Racing Line: {showPracticeRacingLine ? 'ON [L]' : 'OFF [L]'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* WRONG WAY WARNING */}
      {telemetry.wrongWayWarning && (
        <div className="absolute top-20 inset-x-0 flex flex-col items-center justify-center pointer-events-none z-50">
          <div className="bg-red-600 border-2 border-white text-white px-5 py-2.5 rounded-xl shadow-2xl flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0" />
              <span className="text-base font-black uppercase tracking-wider">
                WRONG DIRECTION — TURN AROUND
              </span>
            </div>
            <span className="text-[11px] font-mono text-amber-200 font-bold tabular-nums">
              AUTO-RESPAWN IN {Math.max(0, 5.0 - (telemetry.wrongWayTimer || 0)).toFixed(1)}s
            </span>
          </div>
        </div>
      )}

      {/* 2. OFFICIAL FIA START LIGHTS SEQUENCE */}
      {raceState === 'countdown' && (
        <div className="absolute inset-x-0 top-24 flex flex-col items-center justify-center pointer-events-none z-50">
          <div className={`px-6 py-4 rounded-2xl border flex flex-col items-center gap-3 ${panelSurface}`}>
            <span className={`text-[11px] uppercase tracking-widest font-bold ${mutedText}`}>
              FIA Starting Grid Sequence
            </span>
            <div className="flex gap-3.5 p-3 bg-black rounded-xl border border-white/10">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`w-8 h-8 md:w-9 md:h-9 rounded-full border-2 transition-all duration-100 ${
                    lightsLit > i && !lightsExtinguished
                      ? 'bg-red-600 border-red-400 shadow-[0_0_24px_#ef4444]'
                      : lightsExtinguished
                      ? 'bg-zinc-900 border-zinc-800'
                      : 'bg-red-950/35 border-zinc-800'
                  }`}
                />
              ))}
            </div>
            <span className={`text-xs font-mono font-bold ${primaryText}`}>
              {lightsExtinguished
                ? 'LIGHTS OUT AND AWAY WE GO!'
                : 'HOLD THROTTLE FOR OPTIMAL LAUNCH'}
            </span>
          </div>
        </div>
      )}

      {/* 3. CHEQUERED FLAG FINISH OVERLAY */}
      {raceState === 'finished' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 backdrop-blur-md z-50 pointer-events-auto">
          <div className={`border p-8 rounded-2xl max-w-md w-full text-center flex flex-col items-center gap-4 ${panelSurface}`}>
            <div className="w-14 h-14 rounded-full bg-amber-500/15 border border-amber-400/40 flex items-center justify-center">
              <Flag className="w-7 h-7 text-amber-500" />
            </div>
            <h2 className={`text-2xl font-black tracking-wider ${primaryText}`}>
              CHEQUERED FLAG
            </h2>
            <div className="flex items-center justify-center gap-3 text-lg">
              <span className={mutedText}>Classification:</span>
              <span
                className={`font-black text-3xl font-mono tabular-nums ${
                  telemetry.position === 1
                    ? 'text-amber-500'
                    : telemetry.position <= 3
                    ? 'text-sky-500'
                    : primaryText
                }`}
              >
                P{telemetry.position}
              </span>
            </div>
            <div className={`w-full p-4 rounded-xl border text-sm font-mono tabular-nums flex flex-col gap-1.5 ${subSurface}`}>
              <div className="flex justify-between">
                <span className={mutedText}>Best Lap:</span>
                <span className="text-purple-500 font-bold">
                  {formatTime(telemetry.lapTimeBest)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={mutedText}>Laps Completed:</span>
                <span className={primaryText}>
                  {telemetry.totalLaps} / {telemetry.totalLaps}
                </span>
              </div>
            </div>
            <span className={`text-xs ${mutedText}`}>
              Finalizing FIA Classification & Championship Points...
            </span>
          </div>
        </div>
      )}

      {/* 4. LIVE TEAM RADIO TRANSMISSION BANNER (Docked to top-left/side so it doesn't block center view) */}
      {telemetry.teammateRadioMessage && (
        <div className="absolute top-20 inset-x-0 flex justify-center pointer-events-none z-50">
          <div
            className={`px-4 py-2 rounded-xl shadow-2xl flex items-center gap-3 border ${panelSurface} ${
              telemetry.teammateRadioStatus === 'refused'
                ? 'border-red-500'
                : 'border-emerald-500'
            }`}
          >
            <Radio
              className={`w-4 h-4 shrink-0 ${
                telemetry.teammateRadioStatus === 'refused'
                  ? 'text-red-500'
                  : 'text-emerald-500'
              }`}
            />
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider">
                <span className={mutedText}>
                  TEAM RADIO ·{' '}
                  {telemetry.teammateRadioSpeaker ||
                    telemetry.teammateShortName ||
                    'TEAMMATE'}
                </span>
                <span>·</span>
                <span
                  className={
                    telemetry.teammateRadioStatus === 'refused'
                      ? 'text-red-500'
                      : 'text-emerald-500'
                  }
                >
                  {telemetry.teammateRadioStatus === 'refused'
                    ? 'ORDER DECLINED'
                    : 'COPY THAT'}
                </span>
              </div>
              <p className={`text-xs font-bold mt-0.5 ${primaryText}`}>
                {telemetry.teammateRadioMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 5. BOTTOM SECTION: 100% OPEN CENTER VIEW — SPEEDOMETER DOCKED TO RIGHT OR LEFT SIDE */}
      <div className="flex items-end justify-between w-full mt-auto gap-4">
        {dockSide === 'right' ? (
          <>
            {/* Bottom-Left: Track Radar Mini-Map */}
            {renderMiniMapCorner()}

            {/* Bottom-Center: Intentionally 100% Empty so the Player's Car is never blocked! */}
            <div className="flex-1 pointer-events-none" />

            {/* Bottom-Right: Speedometer, Gear, Shift Lights, Pedals, ERS, DRS & Tires */}
            {renderTelemetryCluster()}
          </>
        ) : (
          <>
            {/* Bottom-Left: Speedometer, Gear, Shift Lights, Pedals, ERS, DRS & Tires */}
            {renderTelemetryCluster()}

            {/* Bottom-Center: Intentionally 100% Empty so the Player's Car is never blocked! */}
            <div className="flex-1 pointer-events-none" />

            {/* Bottom-Right: Track Radar Mini-Map */}
            {renderMiniMapCorner()}
          </>
        )}
      </div>
    </div>
  );
};
