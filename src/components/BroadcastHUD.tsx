import React, { useState, useEffect } from 'react';
import { TelemetryData, CircuitInfo, CameraView, Driver, TIRE_COMPOUND_SPECS, TireCompound } from '../types/racing';
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
import { soundEngine } from '../services/soundEngine';
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
  bestReactionTimeMs?: number;
  onToggleManualGear?: () => void;
  onForceShiftUp?: () => void;
  onForceShiftDown?: () => void;
  onRequestEngineerReport?: (topic: 'gap' | 'tires' | 'incident') => void;
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
  bestReactionTimeMs,
  onToggleManualGear,
  onForceShiftUp,
  onForceShiftDown,
  onRequestEngineerReport,
}) => {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(getStoredUnitSystem());
  const [theme, setTheme] = useState<AppThemeId>(getStoredTheme());
  const [dockSide, setDockSide] = useState<SpeedometerDockSide>(getStoredSpeedometerDock());
  const [engineerVoiceOn, setEngineerVoiceOn] = useState<boolean>(() => soundEngine.isEngineerVoiceEnabled());

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
  const isCityDrivingMode = circuit.id === 'city_driving_metro';
  const isOpenFieldProvingGround =
    circuit.id === 'open_field_proving_ground' || isCityDrivingMode;

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

  const rawSpeed = convertSpeed(telemetry?.speedKmh ?? 0, unitSystem);
  const displaySpeed = Number.isFinite(rawSpeed) ? Math.round(rawSpeed) : 0;
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
          tireCompound: (r.tireCompound || 'SOFT') as TireCompound,
          tireLife: r.tireLife ?? 100,
          pitStopsCount: r.pitStopsCount || 0,
          inPit: Boolean(r.inPit),
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
      tireCompound: (idx % 3 === 0 ? 'SOFT' : idx % 3 === 1 ? 'MEDIUM' : 'HARD') as TireCompound,
      tireLife: 100,
      pitStopsCount: 0,
      inPit: false,
    }));
  }, [telemetry.carsRadar, telemetry.position, playerDriver, telemetry.teammateShortName]);

  // Speedometer + Gear + Tires + ERS/DRS Side Telemetry Cluster
  const tireLifePct = telemetry.tireLife ?? Math.max(0, 100 - telemetry.tireWear);
  const tireGripPct = Math.round((telemetry.tireGripMultiplier ?? 1.0) * 100);
  const tireStatus = telemetry.tireStatusLabel || (tireLifePct < 20 ? 'CRITICAL' : tireLifePct < 42 ? 'BLISTERING' : tireLifePct < 70 ? 'GRAINING' : 'OPTIMAL');
  const activeCompoundSpec = TIRE_COMPOUND_SPECS[telemetry.tireCompound] || TIRE_COMPOUND_SPECS.SOFT;
  const thermalState = telemetry.tireThermalState || 'OPTIMAL_WINDOW';
  const compoundRingClass =
    telemetry.tireCompound === 'SOFT'
      ? 'border-red-500 text-red-500 shadow-[0_0_8px_rgba(239,68,68,0.45)]'
      : telemetry.tireCompound === 'MEDIUM'
      ? 'border-amber-400 text-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.45)]'
      : 'border-slate-200 text-slate-100 shadow-[0_0_8px_rgba(248,250,252,0.35)]';

  const renderTelemetryCluster = () => (
    <div className="flex flex-col gap-2 w-[295px] sm:w-[325px] pointer-events-auto">
      {/* Interactive Tire Health, Compound Composition, Thermal Window & Pit Box Strategy Strip (Hidden in City Driving Mode) */}
      {!isCityDrivingMode && (
        <div className={`flex flex-col gap-2 px-3.5 py-2.5 rounded-xl border ${panelSurface}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className={`w-7 h-7 rounded-full border-2 bg-zinc-900 flex items-center justify-center font-black text-xs shrink-0 ${compoundRingClass}`}>
                {telemetry.tireCompound[0]}
              </div>
              <div className="flex flex-col leading-tight">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[9px] uppercase tracking-wider font-black ${primaryText}`}>
                    {activeCompoundSpec.label}
                  </span>
                  <span
                    className={`text-[8px] font-mono font-black px-1.5 py-0.2 rounded ${
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
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-xs font-mono font-bold tabular-nums ${primaryText}`}>
                    {tireLifePct}% HEALTH · {formatTemp(telemetry.tireTemp, unitSystem)}
                  </span>
                  <span
                    className={`text-[8px] font-mono font-bold px-1 rounded ${
                      thermalState === 'OPTIMAL_WINDOW'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : thermalState === 'COLD'
                        ? 'bg-sky-500/20 text-sky-300'
                        : 'bg-orange-500/25 text-orange-400'
                    }`}
                  >
                    {thermalState === 'OPTIMAL_WINDOW' ? 'OPT TEMP' : thermalState}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
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

          {/* Active Compound Composition Characteristics Summary */}
          <div className={`flex items-center justify-between text-[9px] font-mono px-2 py-1 rounded border ${subSurface}`}>
            <span className="truncate">{activeCompoundSpec.summary}</span>
            <span className={mutedText}>Stint: {activeCompoundSpec.idealStintLaps}</span>
          </div>

          {/* Compound Switcher + [P] Pit Box Service Controls */}
          {!isQualifyingMode && onPitStop && (
            <div className="flex items-center justify-between gap-1 pt-0.5">
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
                            ? 'bg-red-600 text-white border-red-400 shadow-sm'
                            : comp === 'MEDIUM'
                            ? 'bg-amber-500 text-black border-amber-300 shadow-sm'
                            : 'bg-slate-200 text-black border-white shadow-sm'
                          : `${subSurface} opacity-75 hover:opacity-100`
                      }`}
                      title={`${raceState === 'countdown' ? 'Start race on' : 'Pit & fit fresh 100%'} ${TIRE_COMPOUND_SPECS[comp].label} (${TIRE_COMPOUND_SPECS[comp].summary})`}
                    >
                      {comp[0]} · {comp === 'SOFT' ? '+8% Grip' : comp === 'MEDIUM' ? '1.0x Bal' : '0.52x Wear'}
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
      )}

      {/* Main Side Speedometer, Gear, RPM Shift Lights & Pod */}
      <div className={`flex flex-col px-4 py-3 rounded-2xl border ${panelSurface}`}>
        {/* Pod Header with Left/Right Dock Switcher */}
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[9px] uppercase tracking-widest font-bold ${mutedText}`}>
            {isCityDrivingMode ? 'STREET DASHBOARD' : 'FIA TELEMETRY POD'}
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

        {/* Core Telemetry Row: Gear + Force-Shift Controls, Digital Speed, Pedal Pressure Bars */}
        <div className="flex items-center justify-between gap-3 w-full">
          {/* Gear Readout + [F] Shift Up / [V] Shift Down + Explicit AUTO / MANUAL Selector */}
          <div className={`flex flex-col items-center border rounded-xl px-2.5 py-1.5 min-w-[88px] ${subSurface}`}>
            <div className="flex items-center justify-between w-full gap-1 mb-0.5">
              <span className={`text-[8px] uppercase tracking-wider font-bold ${mutedText}`}>
                GEAR
              </span>
              <div className="flex items-center bg-zinc-900/90 rounded p-0.5 border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    if (telemetry.manualGearMode && onToggleManualGear) {
                      onToggleManualGear();
                    }
                  }}
                  className={`px-1.5 py-0.2 rounded text-[7px] font-mono font-black uppercase cursor-pointer transition-colors ${
                    !telemetry.manualGearMode
                      ? 'bg-emerald-500 text-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Automatic Mode: Shifts automatically AND lets you force-shift up/down anytime with [F] / [V]"
                >
                  AUTO
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!telemetry.manualGearMode && onToggleManualGear) {
                      onToggleManualGear();
                    }
                  }}
                  className={`px-1.5 py-0.2 rounded text-[7px] font-mono font-black uppercase cursor-pointer transition-colors ${
                    telemetry.manualGearMode
                      ? 'bg-amber-500 text-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Manual Mode: Only shifts when you press [F] (Shift Up) or [V] (Shift Down)"
                >
                  MAN
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 mt-0.5">
              <button
                type="button"
                onClick={onForceShiftDown}
                className="px-1.5 py-0.5 rounded bg-zinc-800/90 hover:bg-amber-500 hover:text-black text-zinc-300 text-[9px] font-mono font-black cursor-pointer transition-colors border border-white/10"
                title="Force Shift Gear Down (Default Key: [V] — works in both AUTO and MANUAL)"
              >
                V-
              </button>
              <span className="text-3xl font-black text-amber-500 font-mono tabular-nums leading-none min-w-[24px] text-center">
                {telemetry.gear === 0 ? 'R' : telemetry.gear === -1 ? 'R' : telemetry.gear}
              </span>
              <button
                type="button"
                onClick={onForceShiftUp}
                className="px-1.5 py-0.5 rounded bg-zinc-800/90 hover:bg-amber-500 hover:text-black text-zinc-300 text-[9px] font-mono font-black cursor-pointer transition-colors border border-white/10"
                title="Force Shift Gear Up (Default Key: [F] — works in both AUTO and MANUAL)"
              >
                F+
              </button>
            </div>
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
              {Math.round(Number.isFinite(telemetry?.rpm) ? telemetry.rpm : 0).toLocaleString()} RPM
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

        {/* ERS Battery & DRS Status Bar (or Street Nitrous Boost in City Mode) */}
        <div className={`flex items-center gap-2.5 w-full mt-2.5 pt-2 border-t ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
          <div className="flex-1 flex flex-col gap-1">
            <div className={`flex justify-between text-[9px] font-bold tracking-wider ${mutedText}`}>
              <span>{isCityDrivingMode ? 'TURBO / NITROUS [E]' : 'ERS BATTERY'}</span>
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

          {!isCityDrivingMode && (
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
          )}
        </div>
      </div>
    </div>
  );

  // Track Radar Mini-Map + Input Status Pod (placed on the opposite bottom corner)
  const renderMiniMapCorner = () => (
    <div className={`flex flex-col ${dockSide === 'right' ? 'items-start' : 'items-end'} gap-2`}>
      {!isOpenFieldProvingGround && (
        <TrackMiniMap circuit={circuit} carsRadar={telemetry.carsRadar || []} />
      )}

      {!isCityDrivingMode && (
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
          <span className="text-amber-400 font-bold">[F/V] Shift ±</span>
          <span className={mutedText}>·</span>
          <span className={mutedText}>[E] DRS/ERS</span>
          {isOpenFieldProvingGround && (
            <>
              <span className={mutedText}>·</span>
              <span className="text-emerald-400 font-bold">[B] 300 KM/H Roll</span>
            </>
          )}
          <span className={mutedText}>·</span>
          <span className={mutedText}>[C] Cam</span>
        </div>
      )}

      {/* Pit-Wall Race Engineer On-Demand Radio Query Bar (F1 Circuits ONLY) */}
      {!isOpenFieldProvingGround && !isCityDrivingMode && onRequestEngineerReport && (
        <div className={`pointer-events-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-mono ${panelSurface}`}>
          <Radio className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className={`text-[9px] font-black uppercase tracking-wider ${mutedText}`}>
            ENGINEER:
          </span>
          <button
            type="button"
            onClick={() => onRequestEngineerReport('gap')}
            className={`px-2 py-0.5 rounded text-[9px] font-bold transition-colors cursor-pointer border ${subSurface} hover:border-cyan-400 hover:text-cyan-300`}
            title="Ask Race Engineer for live gap to car ahead & behind"
          >
            Gap Report
          </button>
          <button
            type="button"
            onClick={() => onRequestEngineerReport('tires')}
            className={`px-2 py-0.5 rounded text-[9px] font-bold transition-colors cursor-pointer border ${subSurface} hover:border-amber-400 hover:text-amber-300`}
            title="Ask Race Engineer for tire wear & temperature status"
          >
            Tire Status
          </button>
          <button
            type="button"
            onClick={() => onRequestEngineerReport('incident')}
            className={`px-2 py-0.5 rounded text-[9px] font-bold transition-colors cursor-pointer border ${subSurface} hover:border-emerald-400 hover:text-emerald-300`}
            title="Ask Race Engineer for sector flags & incident report"
          >
            Track Status
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !engineerVoiceOn;
              setEngineerVoiceOn(next);
              soundEngine.setEngineerVoiceEnabled(next);
            }}
            className={`px-2 py-0.5 rounded text-[9px] font-black uppercase transition-colors cursor-pointer border ${
              engineerVoiceOn
                ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300'
                : `${subSurface} opacity-65`
            }`}
            title="Toggle Race Engineer spoken voice synthesis on/off"
          >
            {engineerVoiceOn ? '🔊 Voice ON' : '🔇 Text Only'}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden flex flex-col justify-between p-3.5 md:p-5 font-racing">
      {/* 1. TOP BROADCAST BAR */}
      <div className="flex items-start justify-between w-full gap-3">
        {/* Top-Left: Session Header, FIA Live Timing Tower & Pit Radio Console */}
        <div className="flex flex-col gap-2 max-w-[260px] w-full">
          <div className={`flex items-center gap-3 px-3.5 py-2 rounded-xl border ${panelSurface}`}>
            <div
              className={`w-1.5 h-8 rounded-full shrink-0 ${
                isOpenFieldProvingGround
                  ? 'bg-emerald-500'
                  : isQualifyingMode
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
                    isOpenFieldProvingGround
                      ? 'text-emerald-400'
                      : isQualifyingMode
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
                    isCityDrivingMode
                      ? 'text-sky-400 font-bold'
                      : isOpenFieldProvingGround
                      ? 'text-emerald-400 font-bold'
                      : isQualifyingMode
                      ? 'text-purple-500 font-bold'
                      : isPracticeMode
                      ? 'text-amber-500 font-bold'
                      : 'text-red-500 font-bold'
                  }
                >
                  {isCityDrivingMode
                    ? 'CITY & PURSUIT'
                    : isOpenFieldProvingGround
                    ? 'INFINITE ROAD'
                    : isQualifyingMode
                    ? 'QUALIFYING'
                    : isPracticeMode
                    ? 'PRACTICE'
                    : 'GRAND PRIX'}
                </span>
              </div>
              <span className={`text-sm font-bold tracking-tight truncate ${primaryText}`}>
                {circuit.name}
              </span>
            </div>
          </div>

          {/* FIA Leaderboard Tower (Hidden in Open-Field Infinite Road Mode so the Dyno Deck has a clean left dock) */}
          {!isOpenFieldProvingGround && (
          <div className={`hidden sm:flex flex-col gap-0.5 p-2.5 rounded-xl border w-full ${panelSurface}`}>
            <div className={`px-1.5 pb-1.5 mb-1 text-[10px] uppercase font-bold tracking-wider flex items-center justify-between border-b ${isLight ? 'border-slate-200 text-slate-500' : 'border-white/10 text-zinc-400'}`}>
              <span>POS · DRIVER · TIRE</span>
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
                tireCompound,
                tireLife,
                pitStopsCount,
                inPit,
              } = item;
              const team = TEAMS.find((t) => t.id === driver.teamId);
              const teamColor = team?.primaryColor || '#e11d48';
              const compBadgeClass =
                tireCompound === 'SOFT'
                  ? 'border-red-500 text-red-400 bg-red-950/70'
                  : tireCompound === 'MEDIUM'
                  ? 'border-amber-400 text-amber-300 bg-amber-950/70'
                  : 'border-slate-200 text-slate-100 bg-zinc-900';

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
                    <span
                      className={`w-3.5 h-3.5 rounded-full border text-[8px] font-mono font-black flex items-center justify-center shrink-0 ${compBadgeClass}`}
                      title={`Pirelli ${tireCompound} (${tireLife}% Tire Health)`}
                    >
                      {tireCompound[0]}
                    </span>
                    <span
                      className={`text-[8px] font-mono tabular-nums ${
                        tireLife < 25 ? 'text-red-400 font-bold' : tireLife < 55 ? 'text-amber-400' : mutedText
                      }`}
                    >
                      {tireLife}%
                    </span>
                    {inPit ? (
                      <span className="px-1 py-0.2 rounded bg-amber-400 text-black text-[7px] font-mono font-black uppercase animate-pulse">
                        PIT
                      </span>
                    ) : pitStopsCount > 0 ? (
                      <span className="text-[7px] font-mono text-sky-400 font-bold">
                        {pitStopsCount}P
                      </span>
                    ) : null}
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
          )}

          {/* Docked Left-Side Pit Radio Strategy Console (Out of the center view!) */}
          {!isOpenFieldProvingGround &&
            (telemetry.teammatePosition ||
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
          {isOpenFieldProvingGround ? (
            <div className={`flex items-center gap-3.5 px-4 py-1.5 rounded-xl border ${panelSurface}`}>
              <div className="flex flex-col items-center">
                <span className={`text-[8px] uppercase tracking-wider font-bold ${mutedText}`}>
                  {isCityDrivingMode ? 'MARYLAND' : 'ARENA'}
                </span>
                <span className={`text-xs md:text-sm font-black font-mono leading-tight whitespace-nowrap ${isCityDrivingMode ? 'text-sky-400' : 'text-emerald-400'}`}>
                  {isCityDrivingMode ? 'BALTIMORE ↔ GAITHERSBURG' : 'INFINITE 360° ROAD'}
                </span>
              </div>

              <div className={`w-px h-6 ${dividerColor}`} />

              <div className="flex flex-col items-center">
                <span className={`text-[8px] uppercase tracking-wider font-bold ${mutedText}`}>
                  {isCityDrivingMode ? 'ENFORCEMENT' : 'SURFACE'}
                </span>
                <span className={`text-xs md:text-sm font-bold font-mono leading-tight whitespace-nowrap ${primaryText}`}>
                  {isCityDrivingMode ? 'SIGNALS · MSP & MCPD' : 'FULL ASPHALT'}
                </span>
              </div>

              {!isCityDrivingMode && (
                <>
                  <div className={`w-px h-6 hidden sm:block ${dividerColor}`} />

                  <div className="hidden sm:flex flex-col items-center">
                    <span className={`text-[8px] uppercase tracking-wider font-bold ${mutedText}`}>
                      TIRE GRIP
                    </span>
                    <span className="text-xs md:text-sm font-mono font-bold text-cyan-400 tabular-nums leading-tight">
                      {tireGripPct}% ({telemetry.tireCompound})
                    </span>
                  </div>

                  <div className={`w-px h-6 hidden md:block ${dividerColor}`} />

                  <div className="hidden md:flex flex-col items-center">
                    <span className={`text-[8px] uppercase tracking-wider font-bold ${mutedText}`}>
                      ERS / DRS
                    </span>
                    <span className="text-xs md:text-sm font-mono font-bold text-amber-400 tabular-nums leading-tight">
                      {telemetry.ersBattery}% {telemetry.drsActive ? '· DRS OPEN' : ''}
                    </span>
                  </div>
                </>
              )}
            </div>
          ) : (
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
                    {Number.isFinite(telemetry?.currentLap) ? telemetry.currentLap : 1}{' '}
                    <span className={`text-xs ${mutedText}`}>/ {Number.isFinite(telemetry?.totalLaps) ? telemetry.totalLaps : 1}</span>
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
          )}

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

            {telemetry.falseStartPenaltyTimer !== undefined && telemetry.falseStartPenaltyTimer > 0 && (
              <div className="bg-red-600 border-2 border-white text-white px-3.5 py-1 rounded-lg font-black text-[10px] font-mono tabular-nums flex items-center gap-1.5 shadow-lg animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                <span>⚠️ FALSE START — ENGINE STALLED: {telemetry.falseStartPenaltyTimer.toFixed(1)}s</span>
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

          {/* Practice Mode Controls Row (Hidden in Open-Field & City Driving modes) */}
          {isPracticeMode && !isQualifyingMode && !isOpenFieldProvingGround && (
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

      {/* 2. OFFICIAL FIA START LIGHTS SEQUENCE & REACTION TIME LAUNCH MONITOR */}
      {raceState === 'countdown' && (
        <div className="absolute inset-x-0 top-24 flex flex-col items-center justify-center pointer-events-none z-50">
          <div className={`px-6 py-4 rounded-2xl border flex flex-col items-center gap-3 ${panelSurface}`}>
            <div className="flex items-center gap-3">
              <span className={`text-[11px] uppercase tracking-widest font-bold ${mutedText}`}>
                FIA Starting Grid Sequence
              </span>
              {!isQualifyingMode && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-mono font-bold">
                  ⚡ BEST REACTION: {bestReactionTimeMs ? `${(bestReactionTimeMs / 1000).toFixed(3)}s (${bestReactionTimeMs} ms)` : 'UNSET'}
                </span>
              )}
            </div>
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
            <span
              className={`text-xs font-mono font-bold ${
                telemetry.falseStartTriggered
                  ? 'text-red-400 animate-pulse'
                  : lightsExtinguished
                  ? 'text-emerald-400'
                  : primaryText
              }`}
            >
              {telemetry.falseStartTriggered
                ? `⚠️ FALSE START — ENGINE STALLED! (Pressed throttle ${((telemetry.falseStartEarlyMs || 0) / 1000).toFixed(2)}s before lights out — 3.2s Car Stall Penalty)`
                : lightsExtinguished
                ? 'LIGHTS OUT AND AWAY WE GO!'
                : 'WAIT FOR ALL 5 RED LIGHTS TO GO OUT BEFORE PRESSING THROTTLE!'}
            </span>
          </div>
        </div>
      )}

      {/* 2B. POST-LAUNCH REACTION TIME TELEMETRY & ENGINE STALL OVERLAY */}
      {raceState === 'racing' && !isQualifyingMode && ((telemetry.launchBannerTimer || 0) > 0 || (telemetry.falseStartPenaltyTimer || 0) > 0) && (
        <div className="absolute inset-x-0 top-24 flex flex-col items-center justify-center pointer-events-none z-40">
          {telemetry.falseStartTriggered ? (
            <div className="px-5 py-3 rounded-2xl bg-red-950/95 border-2 border-red-500 text-white shadow-2xl flex flex-col items-center gap-1.5 backdrop-blur-md">
              <div className="flex items-center gap-2 text-red-300 text-xs font-mono font-black uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-amber-400 animate-bounce" />
                <span>FALSE START PENALTY — ENGINE STALLED ON GRID</span>
              </div>
              <div className="text-sm font-black font-mono tabular-nums text-white">
                {(telemetry.falseStartPenaltyTimer || 0) > 0
                  ? `CAR STALLED — RESTARTING ENGINE IN ${(telemetry.falseStartPenaltyTimer || 0).toFixed(1)}s`
                  : 'ENGINE RESTARTED — GO GO GO!'}
              </div>
              <span className="text-[10px] font-mono text-red-200">
                Throttle pressed {telemetry.falseStartEarlyMs || 0} ms ({((telemetry.falseStartEarlyMs || 0) / 1000).toFixed(3)}s) before the 5 red lights went out
              </span>
            </div>
          ) : telemetry.startReactionTimeMs != null ? (
            <div className={`px-5 py-2.5 rounded-2xl border shadow-2xl flex flex-col items-center gap-1 backdrop-blur-md ${panelSurface} border-emerald-500/60`}>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-mono font-black uppercase tracking-wider text-emerald-400">
                  FIA LAUNCH REACTION TELEMETRY
                </span>
                {(!bestReactionTimeMs || telemetry.startReactionTimeMs <= bestReactionTimeMs) && (
                  <span className="px-2 py-0.5 rounded bg-amber-400 text-black text-[9px] font-mono font-black uppercase">
                    🏆 NEW PERSONAL RECORD!
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2.5">
                <span className={`text-xl font-black font-mono tabular-nums ${primaryText}`}>
                  {(telemetry.startReactionTimeMs / 1000).toFixed(3)}s
                </span>
                <span className="text-xs font-mono font-bold text-amber-400 tabular-nums">
                  ({telemetry.startReactionTimeMs} ms)
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase ${
                    telemetry.startReactionTimeMs <= 165
                      ? 'bg-purple-500 text-white'
                      : telemetry.startReactionTimeMs <= 225
                      ? 'bg-emerald-500 text-black'
                      : telemetry.startReactionTimeMs <= 310
                      ? 'bg-sky-500 text-black'
                      : 'bg-zinc-700 text-zinc-200'
                  }`}
                >
                  {telemetry.startReactionTimeMs <= 165
                    ? '⚡ LIGHTNING F1 REFLEX'
                    : telemetry.startReactionTimeMs <= 225
                    ? '🔥 ELITE PRO LAUNCH'
                    : telemetry.startReactionTimeMs <= 310
                    ? '✅ SOLID LAUNCH'
                    : '⏱️ LATE LAUNCH'}
                </span>
              </div>
              {bestReactionTimeMs && (
                <span className={`text-[10px] font-mono ${mutedText}`}>
                  Personal Best Record: {(Math.min(bestReactionTimeMs, telemetry.startReactionTimeMs) / 1000).toFixed(3)}s ({Math.min(bestReactionTimeMs, telemetry.startReactionTimeMs)} ms)
                </span>
              )}
            </div>
          ) : null}
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

      {/* 4. LIVE TEAMMATE & RACE ENGINEER RADIO TRANSMISSION BANNERS (F1 Circuits ONLY) */}
      {!isCityDrivingMode && (telemetry.teammateRadioMessage || telemetry.raceEngineerRadio) && (
        <div className="absolute top-20 inset-x-0 flex flex-col items-center justify-center gap-2 pointer-events-none z-50 px-4">
          {telemetry.raceEngineerRadio && (
            <div
              className={`max-w-xl w-full px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-3 border backdrop-blur-md ${panelSurface} ${
                telemetry.raceEngineerRadio.priority === 'critical'
                  ? 'border-red-500 ring-1 ring-red-500/50'
                  : telemetry.raceEngineerRadio.priority === 'warning'
                  ? 'border-amber-400 ring-1 ring-amber-400/40'
                  : 'border-cyan-400/80'
              }`}
            >
              <div className="flex items-center gap-1 shrink-0">
                <Radio
                  className={`w-4 h-4 ${
                    telemetry.raceEngineerRadio.priority === 'critical'
                      ? 'text-red-500 animate-bounce'
                      : telemetry.raceEngineerRadio.priority === 'warning'
                      ? 'text-amber-400 animate-pulse'
                      : 'text-cyan-400 animate-pulse'
                  }`}
                />
                {/* Animated Audio Waveform Bars */}
                <div className="flex items-end gap-0.5 h-3.5 px-1">
                  <span className="w-0.5 h-2 bg-cyan-400 animate-pulse rounded-full" />
                  <span className="w-0.5 h-3.5 bg-cyan-300 animate-bounce rounded-full" />
                  <span className="w-0.5 h-2.5 bg-cyan-400 animate-pulse rounded-full" />
                  <span className="w-0.5 h-1.5 bg-cyan-500 animate-bounce rounded-full" />
                </div>
              </div>
              <div className="flex flex-col text-left min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-[9px] font-mono font-black uppercase tracking-wider">
                  <span className="text-cyan-400">
                    {telemetry.raceEngineerRadio.speaker}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[8px] ${
                      telemetry.raceEngineerRadio.priority === 'critical'
                        ? 'bg-red-500 text-white'
                        : telemetry.raceEngineerRadio.priority === 'warning'
                        ? 'bg-amber-400 text-black'
                        : 'bg-cyan-500/20 text-cyan-300'
                    }`}
                  >
                    {telemetry.raceEngineerRadio.category.toUpperCase()} TELEMETRY
                  </span>
                </div>
                <p className={`text-xs font-bold mt-0.5 leading-snug ${primaryText}`}>
                  "{telemetry.raceEngineerRadio.message}"
                </p>
              </div>
            </div>
          )}

          {telemetry.teammateRadioMessage && (
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
          )}
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
