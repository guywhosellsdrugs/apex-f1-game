import React, { useState, useMemo } from 'react';
import { MarylandGoogleMapModal } from './MarylandGoogleMapModal';
import {
  CircuitInfo,
  SeasonState,
  Driver,
  Team,
  CustomTeamConfig,
  EngineOption,
  AeroStaffOption,
  ChassisEngineerOption,
  BrakeEngineerOption,
  EngineEngineerOption,
  EngineScientistOption,
  EngineDynoResult,
  SponsorOption,
  SeasonHistoryEntry,
  CustomerTeamPUOffer,
  NewsCompanyConfig,
  PublishedNewsReport,
  TireCompound,
  TIRE_COMPOUND_SPECS,
  getStoredStartingTireCompound,
  setStoredStartingTireCompound,
  IncomingTeamOffer,
} from '../types/racing';
import {
  CIRCUITS,
  OPEN_FIELD_PROVING_GROUND_CIRCUIT,
  CITY_DRIVING_METRO_CIRCUIT,
  TEAMS,
  DRIVERS,
  TEAM_CONTRACTS,
  PRIZE_MONEY,
  ENGINE_OPTIONS,
  CUSTOMER_PU_OFFERS,
  AERO_STAFF_OPTIONS,
  CHASSIS_ENGINEER_OPTIONS,
  BRAKE_ENGINEER_OPTIONS,
  ENGINE_ENGINEER_OPTIONS,
  ENGINE_SCIENTIST_OPTIONS,
  SPONSOR_OPTIONS,
} from '../constants/f1Data';
import {
  Play,
  Trophy,
  Calendar,
  Briefcase,
  Gamepad,
  Keyboard,
  RotateCcw,
  DollarSign,
  Shield,
  Palette,
  ArrowRight,
  User,
  AlertTriangle,
  Sparkles,
  Building2,
  CheckCircle,
  XCircle,
  TrendingUp,
  Wrench,
  Cpu,
  Users,
  Wind,
  Check,
  Flame,
  Gauge,
  Lock,
  Award,
  CircleDollarSign,
  Zap,
  Volume2,
  Cloud,
  Pencil,
  HelpCircle,
  Timer,
  Newspaper,
  BarChart3,
  Sun,
  Moon,
  Bug,
  FolderKanban,
} from 'lucide-react';
import { soundEngine } from '../services/soundEngine';
import { TrackLayoutPreview } from './TrackLayoutPreview';
import { Newsfeed, BreakingNewsTicker } from './Newsfeed';
import { PerformanceAnalytics } from './PerformanceAnalytics';
import { RumorMill } from './RumorMill';
import { DeveloperNotes } from './DeveloperNotes';
import { BugReportsPage } from './BugReportsPage';
import {
  UnitSystem,
  getStoredUnitSystem,
  setStoredUnitSystem,
  formatSpeed,
  formatDistance,
  getSpeedUnitLabel,
  getDistanceUnitLabel,
  onUnitSystemChange,
} from '../utils/units';
import {
  GraphicsQuality,
  GRAPHICS_QUALITY_OPTIONS,
  GRAPHICS_PRESETS,
  GRAPHICS_PRESET_LABELS,
  getStoredGraphicsQuality,
  setStoredGraphicsQuality,
  onGraphicsQualityChange,
  getStoredMotionBlur,
  setStoredMotionBlur,
  onMotionBlurChange,
} from '../utils/graphicsSettings';
import {
  AppThemeId,
  APP_THEMES,
  THEME_OPTIONS,
  getStoredTheme,
  setStoredTheme,
  onThemeChange,
  applyThemeToDocument,
} from '../utils/themeSettings';
import {
  CITY_STREET_CARS,
  CITY_MISSIONS_CATALOG,
  loadMetroCitySave,
  saveMetroCitySave,
  MetroCitySaveState,
  getEffectiveStreetCarSpec,
} from '../game/cityTrafficBuilder';

interface SeasonHubProps {
  season: SeasonState;
  currentCircuit: CircuitInfo;
  onStartRace: (laps: number) => void;
  onStartPractice?: (circuit: CircuitInfo, laps: number, difficulty: 'rookie' | 'pro' | 'legend', botCount?: number) => void;
  onChangeDifficulty?: (difficulty: 'rookie' | 'pro' | 'legend') => void;
  onSelectTeam: (
    teamId: string,
    driverId: string,
    buyoutFee: number,
    signingBonus: number,
    salary: number,
    contractYears?: number,
    contractTypeLabel?: string,
    isProveItDeal?: boolean
  ) => void;
  onResetSeason: () => void;
  onCreateCustomTeam: (teamConfig: CustomTeamConfig, actualFeePaid?: number) => void;
  onUpdateCustomTeam?: (updated: CustomTeamConfig, costDeduction?: number) => void;
  onUpdateDriverProfile: (name: string, number: number, country: string) => void;
  isGamepadConnected: boolean;
  gamepadName: string | null;
  onTestRumble: () => void;
  onStartNextSeason?: () => void;
  onCompleteOffSeasonTask?: (
    taskId: string,
    rewards?: {
      cashDelta?: number;
      reputationDelta?: number;
      ratingDelta?: number;
      interviewQuote?: string;
      interviewSummary?: string;
    }
  ) => void;
  onQuitCareer?: () => void;
  onSellCustomTeam?: (saleValue?: number) => void;
  onOpenMultiplayer?: () => void;
  onOpenControls?: () => void;
  onOpenCloud?: () => void;
  onOpenTutorial?: () => void;
  onStartQualifying?: (ghostDelay3s?: boolean) => void;
  qualifyingGhostDelay3s?: boolean;
  onChangeQualifyingGhostDelay3s?: (delay3s: boolean) => void;
  qualifyingGridSlot?: number | null;
  onFoundNewsCompany?: (company: NewsCompanyConfig, startupFee: number) => void;
  onUpdateNewsCompany?: (company: NewsCompanyConfig, feeDelta?: number) => void;
  onPublishNewsReport?: (report: PublishedNewsReport) => void;
  onToggleLookingForTeam?: (looking: boolean) => void;
  onRecordLaunchReaction?: (data: {
    reactionTimeMs: number | null;
    falseStart: boolean;
    jumpedEarlyByMs?: number | null;
    circuitName?: string;
  }) => void;
  onOpenCareerSlots?: () => void;
  careerSlotsCount?: number;
  activeCareerSlotName?: string;
  onAttemptUnsignedWalkOn?: () => { foundOffer: boolean; message: string };
}

export const SeasonHub: React.FC<SeasonHubProps> = ({
  season,
  currentCircuit,
  onStartRace,
  onStartPractice,
  onChangeDifficulty,
  onSelectTeam,
  onResetSeason,
  onCreateCustomTeam,
  onUpdateCustomTeam,
  onUpdateDriverProfile,
  isGamepadConnected,
  gamepadName,
  onTestRumble,
  onStartNextSeason,
  onCompleteOffSeasonTask,
  onQuitCareer,
  onSellCustomTeam,
  onOpenMultiplayer,
  onOpenControls,
  onOpenCloud,
  onOpenTutorial,
  onStartQualifying,
  qualifyingGhostDelay3s = true,
  onChangeQualifyingGhostDelay3s,
  qualifyingGridSlot,
  onFoundNewsCompany,
  onUpdateNewsCompany,
  onPublishNewsReport,
  onToggleLookingForTeam,
  onRecordLaunchReaction,
  onOpenCareerSlots,
  careerSlotsCount = 1,
  activeCareerSlotName = 'Career #1',
  onAttemptUnsignedWalkOn,
}) => {
  const [activeTab, setActiveTab] = useState<'weekend' | 'metrocity' | 'newsfeed' | 'analytics' | 'offseason' | 'contracts' | 'myteam' | 'standings' | 'calendar' | 'records' | 'devnotes' | 'patchnotes' | 'bugreports'>('weekend');
  const [citySave, setCitySave] = useState<MetroCitySaveState>(() => loadMetroCitySave());
  const [cityHubSubTab, setCityHubSubTab] = useState<'garage' | 'dealership' | 'missions'>('garage');
  const [showGoogleMapsModal, setShowGoogleMapsModal] = useState<boolean>(false);
  const [selectedLaps, setSelectedLaps] = useState<number>(season.lapCount || 5);
  const [startingTireCompound, setStartingTireCompound] = useState<TireCompound>(getStoredStartingTireCompound());
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(getStoredUnitSystem());
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>(getStoredGraphicsQuality());
  const [motionBlurEnabled, setMotionBlurEnabled] = useState<boolean>(() => getStoredMotionBlur());
  const [appTheme, setAppTheme] = useState<AppThemeId>(getStoredTheme());
  const [isManualGearMode, setIsManualGearMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('apex26_manual_gear_mode') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleGearboxMode = (manual: boolean) => {
    setIsManualGearMode(manual);
    try {
      localStorage.setItem('apex26_manual_gear_mode', String(manual));
    } catch {}
  };

  const handleBuyOrEquipMetroCar = (carId: string) => {
    const current = loadMetroCitySave();
    const spec = CITY_STREET_CARS.find((c) => c.id === carId);
    if (!spec) return;
    if (current.ownedCarIds.includes(carId)) {
      const next: MetroCitySaveState = {
        ...current,
        selectedCarId: carId,
      };
      saveMetroCitySave(next);
      setCitySave(next);
      const eff = getEffectiveStreetCarSpec(spec, next.activeTrimByCar?.[carId]);
      setNotificationMsg(`Equipped ${eff.name} (${eff.horsepower} HP · ${eff.topSpeedKmh} km/h) in your Metro City Street Garage!`);
      return;
    }
    if (current.streetCash < spec.price) {
      setNotificationMsg(`Not enough Street Cash! ${spec.name} costs $${spec.price.toLocaleString()} (You have $${current.streetCash.toLocaleString()}). Complete street missions in Metro City to earn more!`);
      return;
    }
    const baseTrimId = spec.trims[0]?.id || '';
    const nextUnlocked = { ...(current.unlockedTrimsByCar || {}) };
    if (baseTrimId && (!nextUnlocked[carId] || nextUnlocked[carId].length === 0)) {
      nextUnlocked[carId] = [baseTrimId];
    }
    const nextActive = { ...(current.activeTrimByCar || {}) };
    if (baseTrimId && !nextActive[carId]) {
      nextActive[carId] = baseTrimId;
    }
    const next: MetroCitySaveState = {
      ...current,
      streetCash: current.streetCash - spec.price,
      ownedCarIds: [...current.ownedCarIds, carId],
      unlockedTrimsByCar: nextUnlocked,
      activeTrimByCar: nextActive,
      selectedCarId: carId,
    };
    saveMetroCitySave(next);
    setCitySave(next);
    setNotificationMsg(`PURCHASED & EQUIPPED: ${spec.name} added to your Street Garage for $${spec.price.toLocaleString()}!`);
  };

  const handleBuyOrSelectMetroCarTrim = (carId: string, trimId: string) => {
    const current = loadMetroCitySave();
    const spec = CITY_STREET_CARS.find((c) => c.id === carId);
    if (!spec) return;
    const trim = spec.trims.find((t) => t.id === trimId);
    if (!trim) return;

    const isCarOwned = current.ownedCarIds.includes(carId);
    const unlockedTrims = current.unlockedTrimsByCar?.[carId] || (spec.trims[0] ? [spec.trims[0].id] : []);
    const isTrimOwned = isCarOwned && (unlockedTrims.includes(trim.id) || trim.upgradePrice === 0);

    if (isTrimOwned) {
      const nextSet = new Set(unlockedTrims);
      nextSet.add(trim.id);
      const next: MetroCitySaveState = {
        ...current,
        selectedCarId: carId,
        unlockedTrimsByCar: {
          ...(current.unlockedTrimsByCar || {}),
          [carId]: Array.from(nextSet),
        },
        activeTrimByCar: {
          ...(current.activeTrimByCar || {}),
          [carId]: trim.id,
        },
      };
      saveMetroCitySave(next);
      setCitySave(next);
      setNotificationMsg(`Equipped Trim: ${spec.name} — ${trim.name} (${trim.horsepower} HP · 0-60 in ${trim.zeroToSixtySec.toFixed(2)}s · ${trim.topSpeedKmh} km/h)!`);
      return;
    }

    const totalCost = (isCarOwned ? 0 : spec.price) + trim.upgradePrice;
    if (current.streetCash < totalCost) {
      setNotificationMsg(`Need $${(totalCost - current.streetCash).toLocaleString()} more Street Cash to unlock ${spec.name} (${trim.name})!`);
      return;
    }

    const nextSet = new Set(unlockedTrims);
    if (spec.trims[0]) nextSet.add(spec.trims[0].id);
    nextSet.add(trim.id);

    const next: MetroCitySaveState = {
      ...current,
      streetCash: current.streetCash - totalCost,
      ownedCarIds: isCarOwned ? current.ownedCarIds : [...current.ownedCarIds, carId],
      selectedCarId: carId,
      unlockedTrimsByCar: {
        ...(current.unlockedTrimsByCar || {}),
        [carId]: Array.from(nextSet),
      },
      activeTrimByCar: {
        ...(current.activeTrimByCar || {}),
        [carId]: trim.id,
      },
    };
    saveMetroCitySave(next);
    setCitySave(next);
    setNotificationMsg(`UNLOCKED & EQUIPPED: ${spec.name} [${trim.name}] (-$${totalCost.toLocaleString()})!`);
  };

  const handlePaintMetroCar = (carId: string, hexColor: string) => {
    const current = loadMetroCitySave();
    const next: MetroCitySaveState = {
      ...current,
      customPaintByCar: {
        ...(current.customPaintByCar || {}),
        [carId]: hexColor,
      },
    };
    saveMetroCitySave(next);
    setCitySave(next);
  };

  const handleLaunchMetroCityWithMission = (missionId: string | null) => {
    const current = loadMetroCitySave();
    const next: MetroCitySaveState = {
      ...current,
      pendingMissionId: missionId,
    };
    saveMetroCitySave(next);
    setCitySave(next);
    if (onStartPractice) {
      onStartPractice(CITY_DRIVING_METRO_CIRCUIT, 99, season.difficulty, 0);
    }
  };

  // Interactive 5-Lights Start Reaction Practice State
  const [startPracticePhase, setStartPracticePhase] = useState<'idle' | 'countdown' | 'lights_out' | 'result'>('idle');
  const [startPracticeLights, setStartPracticeLights] = useState<number>(0);
  const [startPracticeResult, setStartPracticeResult] = useState<{
    reactionTimeMs: number | null;
    falseStart: boolean;
    jumpedEarlyByMs?: number | null;
    isNewBest?: boolean;
  } | null>(null);
  const practiceTimersRef = React.useRef<number[]>([]);
  const lightsOutPerfRef = React.useRef<number>(0);
  const expectedLightsOutPerfRef = React.useRef<number>(0);
  const startPracticePhaseRef = React.useRef<'idle' | 'countdown' | 'lights_out' | 'result'>('idle');
  startPracticePhaseRef.current = startPracticePhase;

  const clearPracticeTimers = React.useCallback(() => {
    practiceTimersRef.current.forEach((id) => window.clearTimeout(id));
    practiceTimersRef.current = [];
  }, []);

  React.useEffect(() => {
    return () => clearPracticeTimers();
  }, [clearPracticeTimers]);

  const handleStartReactionDrill = React.useCallback(() => {
    clearPracticeTimers();
    soundEngine.init();
    setStartPracticeResult(null);
    setStartPracticePhase('countdown');
    setStartPracticeLights(1);
    soundEngine.playStartLightBeep(false);

    const lightIntervalMs = 620;
    const randomHoldMs = 500 + Math.random() * 1150;
    const totalDelayToLightsOut = lightIntervalMs * 4 + randomHoldMs;
    expectedLightsOutPerfRef.current = performance.now() + totalDelayToLightsOut;

    const t2 = window.setTimeout(() => {
      setStartPracticeLights(2);
      soundEngine.playStartLightBeep(false);
    }, lightIntervalMs * 1);

    const t3 = window.setTimeout(() => {
      setStartPracticeLights(3);
      soundEngine.playStartLightBeep(false);
    }, lightIntervalMs * 2);

    const t4 = window.setTimeout(() => {
      setStartPracticeLights(4);
      soundEngine.playStartLightBeep(false);
    }, lightIntervalMs * 3);

    const t5 = window.setTimeout(() => {
      setStartPracticeLights(5);
      soundEngine.playStartLightBeep(false);
    }, lightIntervalMs * 4);

    const tOut = window.setTimeout(() => {
      lightsOutPerfRef.current = performance.now();
      setStartPracticeLights(0);
      setStartPracticePhase('lights_out');
      soundEngine.playStartLightBeep(true);
    }, totalDelayToLightsOut);

    practiceTimersRef.current = [t2, t3, t4, t5, tOut];
  }, [clearPracticeTimers]);

  const handleTriggerPracticeThrottle = React.useCallback(() => {
    const phase = startPracticePhaseRef.current;
    if (phase === 'countdown') {
      clearPracticeTimers();
      const jumpedEarlyByMs = Math.max(10, Math.round(expectedLightsOutPerfRef.current - performance.now()));
      soundEngine.playCrash(0.45);
      setStartPracticePhase('result');
      setStartPracticeResult({
        reactionTimeMs: null,
        falseStart: true,
        jumpedEarlyByMs,
      });
      onRecordLaunchReaction?.({
        reactionTimeMs: null,
        falseStart: true,
        jumpedEarlyByMs,
        circuitName: '5-Lights Start Practice',
      });
    } else if (phase === 'lights_out') {
      clearPracticeTimers();
      const reactionTimeMs = Math.max(1, Math.round(performance.now() - lightsOutPerfRef.current));
      const prevBest = season.career.bestReactionTimeMs;
      const isNewBest = !prevBest || reactionTimeMs <= prevBest;
      setStartPracticePhase('result');
      setStartPracticeResult({
        reactionTimeMs,
        falseStart: false,
        isNewBest,
      });
      onRecordLaunchReaction?.({
        reactionTimeMs,
        falseStart: false,
        circuitName: '5-Lights Start Practice',
      });
    }
  }, [clearPracticeTimers, onRecordLaunchReaction, season.career.bestReactionTimeMs]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (startPracticePhaseRef.current !== 'countdown' && startPracticePhaseRef.current !== 'lights_out') {
        return;
      }
      if (e.repeat) return;
      if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') {
        e.preventDefault();
        handleTriggerPracticeThrottle();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTriggerPracticeThrottle]);

  // Off-Season Mandatory Press Interview State
  const [interviewQ1, setInterviewQ1] = useState<'confident' | 'humble' | 'hungry'>('confident');
  const [interviewQ2, setInterviewQ2] = useState<'praise_team' | 'demand_upgrades' | 'focus_racecraft'>('praise_team');
  const [interviewQ3, setInterviewQ3] = useState<'title_charge' | 'race_wins' | 'consistent_podiums'>('title_charge');

  const offSeasonCompletedTasks = season.career.offSeasonActionsUsed || [];
  const isInterviewDone = offSeasonCompletedTasks.includes('interview_completed');
  const isGalaDone = offSeasonCompletedTasks.includes('gala_attended');
  const isShakedownDone = offSeasonCompletedTasks.includes('shakedown_completed');
  const completedMandatoryCount =
    (isInterviewDone ? 1 : 0) + (isGalaDone ? 1 : 0) + (isShakedownDone ? 1 : 0);
  const canLaunchNextSeason = season.seasonFinished && completedMandatoryCount === 3;

  const [hubFps, setHubFps] = useState<number>(60);

  React.useEffect(() => {
    applyThemeToDocument(appTheme);
    return onThemeChange((newTheme) => {
      setAppTheme(newTheme);
    });
  }, []);

  React.useEffect(() => {
    let frameCount = 0;
    let lastStamp = performance.now();
    let rafId: number;
    const tickFps = (now: number) => {
      frameCount++;
      const elapsed = now - lastStamp;
      if (elapsed >= 500) {
        const currentFps = Math.max(1, Math.round((frameCount * 1000) / elapsed));
        setHubFps(currentFps);
        frameCount = 0;
        lastStamp = now;
      }
      rafId = requestAnimationFrame(tickFps);
    };
    rafId = requestAnimationFrame(tickFps);
    return () => cancelAnimationFrame(rafId);
  }, []);

  React.useEffect(() => {
    return onUnitSystemChange((newUnit) => {
      setUnitSystem(newUnit);
    });
  }, []);

  React.useEffect(() => {
    return onGraphicsQualityChange((newQuality) => {
      setGraphicsQuality(newQuality);
    });
  }, []);

  React.useEffect(() => {
    return onMotionBlurChange((enabled) => {
      setMotionBlurEnabled(enabled);
    });
  }, []);

  const handleChangeGraphicsQuality = (q: GraphicsQuality) => {
    setGraphicsQuality(q);
    setStoredGraphicsQuality(q);
  };

  const handleToggleMotionBlur = (enabled: boolean) => {
    setMotionBlurEnabled(enabled);
    setStoredMotionBlur(enabled);
  };

  const handleChangeTheme = (nextTheme: AppThemeId) => {
    setAppTheme(nextTheme);
    setStoredTheme(nextTheme);
  };

  const toggleUnits = () => {
    const nextUnit = unitSystem === 'metric' ? 'imperial' : 'metric';
    setUnitSystem(nextUnit);
    setStoredUnitSystem(nextUnit);
  };

  // Driver Edit Modal
  const [editingProfile, setEditingProfile] = useState(false);
  const [driverNameInput, setDriverNameInput] = useState(season.career.driverName);
  const [driverNumberInput, setDriverNumberInput] = useState(season.career.driverNumber);
  const [countryInput, setCountryInput] = useState(season.career.country);

  // Custom Team Form
  const [customTeamName, setCustomTeamName] = useState('Apex Grand Prix');
  const [customTeamShort, setCustomTeamShort] = useState('Apex');
  const [customPrimaryColor, setCustomPrimaryColor] = useState('#e10600');
  const [customSecondaryColor, setCustomSecondaryColor] = useState('#0d0e12');
  const [customAccentColor, setCustomAccentColor] = useState('#ffd700');
  const [customEngine, setCustomEngine] = useState('Ferrari 066/14 V6 Turbo');
  const [customTeammate, setCustomTeammate] = useState('alonso');

  // Mid-Season Team Rename Modal
  const [isRenamingTeam, setIsRenamingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState(season.career.customTeam?.name || '');
  const [newTeamShort, setNewTeamShort] = useState(season.career.customTeam?.shortName || '');

  const handleSaveRenamedTeam = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTeamName.trim() || !season.career.customTeam) return;
    const cleanName = newTeamName.trim();
    const cleanShort = (newTeamShort.trim() || cleanName.split(' ')[0]).slice(0, 12);

    const updatedTeam = {
      ...season.career.customTeam,
      name: cleanName,
      shortName: cleanShort,
    };

    if (onUpdateCustomTeam) {
      onUpdateCustomTeam(updatedTeam);
    }
    setIsRenamingTeam(false);
    setNotificationMsg(`Team name successfully updated to "${cleanName}" (${cleanShort})!`);
  };

  // Anytime Team Color Switcher Modal ("if i own a team allow me to switch my teams colors whenever i want")
  const [isEditingTeamColors, setIsEditingTeamColors] = useState(false);
  const [editPrimaryColor, setEditPrimaryColor] = useState(season.career.customTeam?.primaryColor || '#e10600');
  const [editSecondaryColor, setEditSecondaryColor] = useState(season.career.customTeam?.secondaryColor || '#0d0e12');
  const [editAccentColor, setEditAccentColor] = useState(season.career.customTeam?.accentColor || '#ffd700');

  const handleSaveTeamColors = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!season.career.customTeam) return;
    const updatedTeam: CustomTeamConfig = {
      ...season.career.customTeam,
      primaryColor: editPrimaryColor,
      secondaryColor: editSecondaryColor,
      accentColor: editAccentColor,
    };
    if (onUpdateCustomTeam) {
      onUpdateCustomTeam(updatedTeam);
    }
    setIsEditingTeamColors(false);
    setNotificationMsg(
      `Updated ${season.career.customTeam.name} livery colors! Your new team colors are now live across the paddock and 3D race car.`
    );
  };

  // Contract Modal & Interactive Negotiation State
  const [selectedOffer, setSelectedOffer] = useState<{
    team: Team;
    salary: number;
    signingBonus: number;
    buyoutFee: number;
    minRating: number;
    minPoints: number;
    minWins: number;
    minPodiums: number;
    expectation: string;
    canAffordBuyout: boolean;
    meetsRating: boolean;
    meetsPoints: boolean;
    meetsWins: boolean;
    meetsPodiums: boolean;
    displacedDriverName: string;
    isHeadhunterOffer?: boolean;
    offerTitle?: string;
    isDesperateOverpay?: boolean;
    contractYears: number;
    isProveItDeal?: boolean;
    isCurrentTeamRenegotiation?: boolean;
  } | null>(null);

  const [counterSalaryPerRace, setCounterSalaryPerRace] = useState<number>(200000);
  const [counterSigningBonus, setCounterSigningBonus] = useState<number>(500000);
  const [counterContractYears, setCounterContractYears] = useState<number>(1);
  const [negotiationPatience, setNegotiationPatience] = useState<number>(3);
  const [negotiationStatus, setNegotiationStatus] = useState<'initial' | 'accepted' | 'countered' | 'walked_away'>('initial');
  const [negotiationFeedback, setNegotiationFeedback] = useState<string>('');
  const [maxNegotiableSalary, setMaxNegotiableSalary] = useState<number>(300000);
  const [maxNegotiableBonus, setMaxNegotiableBonus] = useState<number>(750000);

  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const [showQuitCareerModal, setShowQuitCareerModal] = useState(false);
  const [showResetStandingsModal, setShowResetStandingsModal] = useState(false);
  const [showSellTeamModal, setShowSellTeamModal] = useState(false);
  const [dismissedOfferIds, setDismissedOfferIds] = useState<string[]>([]);
  const [myTeamSubTab, setMyTeamSubTab] = useState<'finances' | 'specs' | 'engine' | 'staff' | 'sponsors' | 'drivers'>('finances');

  // Free Practice Mode Modal ("without quitting my career i can do practice on all of the tracks and i can choose my difficulty and laps")
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [practiceSelectedCircuit, setPracticeSelectedCircuit] = useState<CircuitInfo>(currentCircuit);
  const [practiceLaps, setPracticeLaps] = useState<number>(5);
  const [practiceDifficulty, setPracticeDifficulty] = useState<'rookie' | 'pro' | 'legend'>(season.difficulty || 'pro');
  const [practiceBotCount, setPracticeBotCount] = useState<number>(19);

  const playerTeam = season.career.customTeam && season.selectedTeamId === season.career.customTeam.id
    ? {
        id: season.career.customTeam.id,
        name: season.career.customTeam.name,
        shortName: season.career.customTeam.shortName,
        engine: season.career.customTeam.engine,
        primaryColor: season.career.customTeam.primaryColor,
        secondaryColor: season.career.customTeam.secondaryColor,
        accentColor: season.career.customTeam.accentColor,
        performanceTier: 1,
        drivers: [season.selectedDriverId, season.career.customTeam.teammateDriverId] as [string, string],
        reputationRequired: 0,
        baseSalary: 1000000,
      }
    : TEAMS.find((t) => t.id === season.selectedTeamId) || TEAMS.find((t) => t.id === 'haas') || TEAMS[0];

  const activeTeammateDriver: Driver = useMemo(() => {
    if (season.career.customTeam) {
      const cTeam = season.career.customTeam;
      const tId = cTeam.teammateDriverId;
      const baseDriver =
        DRIVERS.find((d) => d.id === tId) || {
          id: 'rookie_teammate',
          name: 'Luca Sterling (Academy Rookie)',
          shortName: 'STE',
          number: 88,
          country: 'United States',
          countryCode: 'US',
          teamId: cTeam.id,
          rating: 78,
          aggression: 0.74,
          color: cTeam.primaryColor || '#10b981',
        };
      return {
        ...baseDriver,
        teamId: cTeam.id,
        name: cTeam.teammateCustomName || baseDriver.name,
        shortName: cTeam.teammateCustomName
          ? cTeam.teammateCustomName.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
          : baseDriver.shortName,
        rating: cTeam.teammateCustomRating ?? baseDriver.rating,
      };
    }
    const teammateId = playerTeam.drivers?.find((id) => id !== season.selectedDriverId);
    return (
      DRIVERS.find((d) => d.id === teammateId) || {
        id: 'rookie_teammate',
        name: 'Luca Sterling (Academy Rookie)',
        shortName: 'STE',
        number: 88,
        country: 'United States',
        countryCode: 'US',
        teamId: 'custom_f1_team',
        rating: 78,
        aggression: 0.74,
        color: '#10b981',
      }
    );
  }, [season.career.customTeam, season.selectedDriverId, playerTeam.drivers]);

  // Resolves any driver's current team:
  // - If signed to your Custom Team -> returns your Custom Team (with whatever your current team name is!)
  // - If cut from your team -> returns the new F1 team they joined (can be ANY other team on the grid, not forced to their old team!)
  const getDriverCurrentTeam = React.useCallback(
    (driver: Driver): Team => {
      if (driver.id === season.selectedDriverId) {
        return playerTeam;
      }
      if (season.career.customTeam && season.career.customTeam.teammateDriverId === driver.id) {
        return {
          id: season.career.customTeam.id,
          name: season.career.customTeam.name,
          shortName: season.career.customTeam.shortName,
          engine: season.career.customTeam.engine,
          primaryColor: season.career.customTeam.primaryColor,
          secondaryColor: season.career.customTeam.secondaryColor,
          accentColor: season.career.customTeam.accentColor,
          performanceTier: 1,
          drivers: [season.selectedDriverId, season.career.customTeam.teammateDriverId] as [string, string],
          reputationRequired: 0,
          baseSalary: season.career.customTeam.teammateSalaryPerRace ?? 220000,
        };
      }
      const overrideTeamId = season.career.customTeam?.driverTeamOverrides?.[driver.id];
      if (overrideTeamId) {
        const overriddenTeam = TEAMS.find((t) => t.id === overrideTeamId);
        if (overriddenTeam) return overriddenTeam;
      }
      return TEAMS.find((t) => t.id === driver.teamId) || TEAMS[0];
    },
    [season.selectedDriverId, season.career.customTeam, playerTeam]
  );

  // Pool of Academy Rookies at different price points ("try getting a cheaper academy rookie or something")
  const ACADEMY_ROOKIE_POOL = useMemo(
    () => [
      {
        id: 'rookie_teammate',
        rookieKey: 'leo_vane',
        name: 'Leo Vane (Karting & F3 Rookie)',
        shortName: 'VAN',
        number: 82,
        country: 'United Kingdom',
        countryCode: 'GB',
        teamId: 'custom_f1_team',
        rating: 71,
        aggression: 0.68,
        color: '#38bdf8',
        salaryPerRaceDemand: 45000,
        minSalaryFloor: 22000,
        signingBonusDemand: 0,
        bio: 'Ultra-cheap F3 rookie hungry for any F1 seat. Willing to race for bare-minimum pay, and his rating will grow if he scores podiums or wins!',
      },
      {
        id: 'rookie_teammate',
        rookieKey: 'kaito_sato',
        name: 'Kaito Sato (Formula Regional Rookie)',
        shortName: 'SAT',
        number: 85,
        country: 'Japan',
        countryCode: 'JP',
        teamId: 'custom_f1_team',
        rating: 74,
        aggression: 0.72,
        color: '#f43f5e',
        salaryPerRaceDemand: 68000,
        minSalaryFloor: 35000,
        signingBonusDemand: 25000,
        bio: 'Consistent Formula Regional graduate with low salary demands and high willingness to accept a pay cut.',
      },
      {
        id: 'rookie_teammate',
        rookieKey: 'mateo_silva',
        name: 'Mateo Silva (FIA F2 Rookie)',
        shortName: 'SIL',
        number: 87,
        country: 'Brazil',
        countryCode: 'BR',
        teamId: 'custom_f1_team',
        rating: 76,
        aggression: 0.75,
        color: '#eab308',
        salaryPerRaceDemand: 90000,
        minSalaryFloor: 50000,
        signingBonusDemand: 50000,
        bio: 'Aggressive F2 sprint winner who offers strong midfield pace at a fraction of veteran F1 driver salaries.',
      },
      {
        id: 'rookie_teammate',
        rookieKey: 'luca_sterling',
        name: 'Luca Sterling (Academy Rookie)',
        shortName: 'STE',
        number: 88,
        country: 'United States',
        countryCode: 'US',
        teamId: 'custom_f1_team',
        rating: 78,
        aggression: 0.74,
        color: '#10b981',
        salaryPerRaceDemand: 120000,
        minSalaryFloor: 65000,
        signingBonusDemand: 80000,
        bio: 'Top-rated FIA Academy graduate ready to score points right away. Can be negotiated down on salary!',
      },
    ],
    []
  );

  // Team Owner -> Send Offers to F1 Drivers & Negotiate with Academy Rookies State
  const [driverOfferModal, setDriverOfferModal] = useState<{
    driverId: string;
    name: string;
    rating: number;
    color: string;
    number: number;
    isAcademyRookie: boolean;
    isCurrentTeammateRenegotiation: boolean;
    currentOrDemandedSalary: number;
    minAcceptableSalary: number;
    demandedSigningBonus: number;
    minAcceptableBonus: number;
    agreedSalaryPerRace: number;
    agreedSigningBonus: number;
    agreedContractYears: number;
    patience: number;
    status: 'initial' | 'accepted' | 'countered' | 'rejected';
    feedback: string;
  } | null>(null);

  const [ownerProposedSalary, setOwnerProposedSalary] = useState<number>(100000);
  const [ownerProposedBonus, setOwnerProposedBonus] = useState<number>(0);
  const [ownerProposedYears, setOwnerProposedYears] = useState<number>(1);
  const [showCutDriverConfirm, setShowCutDriverConfirm] = useState<boolean>(false);

  // Computes the effective minimum salary a CPU driver will accept given the offered Signing Bonus & Contract Duration:
  // If you offer a massive Signing Bonus (or multi-year security / prove-it bonus), they will accept a much lower per-race salary (all the way down to $0/race)!
  const computeEffectiveMinSalaryWithBonus = (
    baseMinSalary: number,
    minBonusRequired: number,
    offeredSigningBonus: number,
    _isRookie: boolean,
    offeredYears: number = 1
  ) => {
    const rockBottomFloor = 0;
    // Multi-year job security (2 or 3 years) slightly lowers per-race floor by 5-8%, while 1-year prove-it deals allow low upfront commitment
    const durationDiscount = offeredYears >= 3 ? 0.92 : offeredYears === 2 ? 0.96 : 1.0;
    const adjustedBaseMin = Math.round((baseMinSalary * durationDiscount) / 1000) * 1000;
    if (offeredSigningBonus >= minBonusRequired) {
      const extraBonus = offeredSigningBonus - minBonusRequired;
      // Every $100,000 of extra upfront signing bonus reduces required per-race salary by $25,000/GP (can go all the way to $0)
      const salaryOffset = Math.round((extraBonus * 0.25) / 1000) * 1000;
      return Math.max(rockBottomFloor, adjustedBaseMin - salaryOffset);
    } else {
      // Offering less than minimum bonus requires slightly higher per-race salary
      const bonusShortfall = minBonusRequired - offeredSigningBonus;
      const salaryPenalty = Math.round((bonusShortfall * 0.12) / 1000) * 1000;
      return adjustedBaseMin + salaryPenalty;
    }
  };

  const handleOpenDriverOfferModal = (opts: {
    driverId: string;
    name: string;
    rating: number;
    color: string;
    number: number;
    isAcademyRookie: boolean;
    isCurrentTeammateRenegotiation: boolean;
    baseSalaryDemand: number;
    minSalaryFloor: number;
    signingBonusDemand: number;
    defaultYears?: number;
  }) => {
    const startSalary = opts.isCurrentTeammateRenegotiation
      ? Math.max(0, Math.round((opts.baseSalaryDemand * 0.75) / 5000) * 5000)
      : opts.baseSalaryDemand;
    const startBonus = opts.isCurrentTeammateRenegotiation ? 0 : opts.signingBonusDemand;
    const startYears = opts.defaultYears || (opts.isCurrentTeammateRenegotiation ? (season.career.customTeam?.teammateContractYearsRemaining || 1) : 1);
    const minBonus = opts.isCurrentTeammateRenegotiation
      ? 0
      : Math.round((opts.signingBonusDemand * 0.6) / 10000) * 10000;

    setShowCutDriverConfirm(false);
    setOwnerProposedSalary(startSalary);
    setOwnerProposedBonus(startBonus);
    setOwnerProposedYears(startYears);
    setDriverOfferModal({
      driverId: opts.driverId,
      name: opts.name,
      rating: opts.rating,
      color: opts.color,
      number: opts.number,
      isAcademyRookie: opts.isAcademyRookie,
      isCurrentTeammateRenegotiation: opts.isCurrentTeammateRenegotiation,
      currentOrDemandedSalary: opts.baseSalaryDemand,
      minAcceptableSalary: opts.minSalaryFloor,
      demandedSigningBonus: opts.signingBonusDemand,
      minAcceptableBonus: minBonus,
      agreedSalaryPerRace: startSalary,
      agreedSigningBonus: startBonus,
      agreedContractYears: startYears,
      patience: opts.isAcademyRookie ? 4 : 3,
      status: 'initial',
      feedback: opts.isCurrentTeammateRenegotiation
        ? `Renegotiate contract terms (pay cut, raise, or extension for 1–3 seasons) with ${opts.name} (${opts.rating} OVR) on ${season.career.customTeam?.name || 'your team'}. You can also offer an upfront Signing Bonus (with no upper limit) to convince ${opts.name} to accept a lower per-race salary! Send your offer to see their response.`
        : `Prepare your contract offer for ${opts.name} (${opts.rating} OVR) to race for ${season.career.customTeam?.name || 'your team'}. Standard ask: ${formatMoney(opts.baseSalaryDemand * 10)}/yr (${formatMoney(opts.baseSalaryDemand)}/race)${opts.signingBonusDemand > 0 ? ` + ${formatMoney(opts.signingBonusDemand)} signing bonus` : ''}. Choose a contract duration (e.g. 1-Season Prove-It Deal, $3M for 1 Year, or 2–3 Years), set any salary & bonus, and click Send Offer!`,
    });
  };

  const handleSendOfferToDriver = () => {
    if (!driverOfferModal || driverOfferModal.status === 'rejected') return;

    const offeredSal = ownerProposedSalary;
    const offeredBon = ownerProposedBonus;
    const offeredYrs = ownerProposedYears;
    const effectiveMinSal = computeEffectiveMinSalaryWithBonus(
      driverOfferModal.minAcceptableSalary,
      driverOfferModal.minAcceptableBonus,
      offeredBon,
      driverOfferModal.isAcademyRookie,
      offeredYrs
    );

    if (offeredSal >= effectiveMinSal) {
      const acceptedViaBigBonus =
        offeredSal < driverOfferModal.minAcceptableSalary &&
        offeredBon > driverOfferModal.minAcceptableBonus;
      const savingsPerRace = Math.max(0, driverOfferModal.currentOrDemandedSalary - offeredSal);
      const totalTermCash = offeredSal * 10 * offeredYrs;

      setDriverOfferModal({
        ...driverOfferModal,
        agreedSalaryPerRace: offeredSal,
        agreedSigningBonus: offeredBon,
        agreedContractYears: offeredYrs,
        status: 'accepted',
        feedback: acceptedViaBigBonus
          ? `${driverOfferModal.name}: "Normally I wouldn't go as low as ${formatMoney(offeredSal)}/race, but that ${formatMoney(offeredBon)} upfront signing bonus sealed the deal! I accept your ${offeredYrs}-Year (${formatMoney(totalTermCash)} total salary) contract to race for ${season.career.customTeam?.name || 'your team'}—saving you ${formatMoney(savingsPerRace)}/race! Click Confirm below."`
          : `${driverOfferModal.name}: "I accept your ${offeredYrs}-Year contract offer of ${formatMoney(offeredSal * 10)}/yr (${formatMoney(totalTermCash)} over ${offeredYrs} season${offeredYrs > 1 ? 's' : ''} · ${formatMoney(offeredSal)}/race)${
              offeredBon > 0 ? ` + ${formatMoney(offeredBon)} signing bonus` : ''
            } to race for ${season.career.customTeam?.name || 'your team'}${
              savingsPerRace > 0
                ? ` — saving your team ${formatMoney(savingsPerRace)} every race!`
                : '!'
            } Click Confirm below to lock in my contract."`,
      });
      return;
    }

    const nextPatience = driverOfferModal.patience - 1;
    if (nextPatience <= 0) {
      setDriverOfferModal({
        ...driverOfferModal,
        patience: 0,
        status: 'rejected',
        feedback: `${driverOfferModal.name}: "That ${offeredYrs}-year offer (${formatMoney(offeredSal * 10)}/yr · ${formatMoney(offeredSal)}/race with ${formatMoney(offeredBon)} bonus) is too low for a ${driverOfferModal.rating}-rated F1 seat. Either raise the salary or offer a bigger signing bonus next time. Talks are over!"`,
      });
      return;
    }

    const counterSal = Math.max(
      effectiveMinSal,
      Math.round(((offeredSal + effectiveMinSal) / 2) / 5000) * 5000
    );
    const counterBon = Math.max(
      offeredBon,
      driverOfferModal.minAcceptableBonus,
      Math.round(((offeredBon + driverOfferModal.demandedSigningBonus) / 2) / 10000) * 10000
    );

    setOwnerProposedSalary(counterSal);
    setOwnerProposedBonus(counterBon);
    setDriverOfferModal({
      ...driverOfferModal,
      agreedSalaryPerRace: counterSal,
      agreedSigningBonus: counterBon,
      agreedContractYears: offeredYrs,
      patience: nextPatience,
      status: 'countered',
      feedback: `${driverOfferModal.name}: "With a ${formatMoney(offeredBon)} signing bonus, I can't accept ${formatMoney(offeredSal * 10)}/yr (${formatMoney(offeredSal)}/race) for ${offeredYrs} season${offeredYrs > 1 ? 's' : ''}. I'll counter at ${formatMoney(counterSal * 10)}/yr (${formatMoney(counterSal)}/race · ${formatMoney(counterSal * 10 * offeredYrs)} over ${offeredYrs} yr${offeredYrs > 1 ? 's' : ''})${
        counterBon > 0 ? ` + ${formatMoney(counterBon)} signing bonus` : ''
      } — OR offer me a bigger Signing Bonus if you want me to accept ${formatMoney(offeredSal)}/race! (${nextPatience} tries left)."`,
    });
  };

  const handleAcceptDriverCounterOffer = () => {
    if (!driverOfferModal) return;
    setOwnerProposedSalary(driverOfferModal.agreedSalaryPerRace);
    setOwnerProposedBonus(driverOfferModal.agreedSigningBonus);
    setOwnerProposedYears(driverOfferModal.agreedContractYears || 1);
    const yrs = driverOfferModal.agreedContractYears || 1;
    setDriverOfferModal({
      ...driverOfferModal,
      status: 'accepted',
      feedback: `${driverOfferModal.name}: "Great! We've agreed on my ${yrs}-year counter-offer of ${formatMoney(driverOfferModal.agreedSalaryPerRace * 10)}/yr (${formatMoney(driverOfferModal.agreedSalaryPerRace)}/race)${
        driverOfferModal.agreedSigningBonus > 0
          ? ` + ${formatMoney(driverOfferModal.agreedSigningBonus)} signing bonus`
          : ''
      } to drive for ${season.career.customTeam?.name || 'your team'}. Finalize the contract below!"`,
    });
  };

  const executeFinalizeDriverOffer = () => {
    if (!driverOfferModal || !season.career.customTeam || driverOfferModal.status !== 'accepted') return;

    const finalSalary = driverOfferModal.agreedSalaryPerRace;
    const finalBonus = driverOfferModal.agreedSigningBonus;
    const finalYears = Math.max(1, Math.min(5, driverOfferModal.agreedContractYears || ownerProposedYears || 1));

    if (bankBalance < finalBonus) {
      setNotificationMsg(
        `Insufficient funds! Signing ${driverOfferModal.name} requires ${formatMoney(finalBonus)} upfront signing bonus.`
      );
      return;
    }

    const cTeam = season.career.customTeam;
    const currentMateName = activeTeammateDriver.name;
    const isSameDriver =
      driverOfferModal.isCurrentTeammateRenegotiation &&
      cTeam.teammateDriverId === driverOfferModal.driverId &&
      currentMateName === driverOfferModal.name;

    // When a driver is cut, they become a Free Agent and can join ANY other F1 team on the grid (not forced to the team they were recently on!)
    const prevOverrideTeamId = cTeam.driverTeamOverrides?.[activeTeammateDriver.id];
    const recentTeamId = prevOverrideTeamId || activeTeammateDriver.teamId;
    const otherGridTeams = TEAMS.filter((t) => t.id !== recentTeamId);
    const randomOtherTeam =
      otherGridTeams.length > 0
        ? otherGridTeams[Math.floor(Math.random() * otherGridTeams.length)]
        : TEAMS[0];

    let updatedCutDrivers = [...(cTeam.cutFreeAgentDrivers || [])];
    const nextDriverTeamOverrides: Record<string, string> = {
      ...(cTeam.driverTeamOverrides || {}),
      [driverOfferModal.driverId]: cTeam.id,
    };

    if (!isSameDriver) {
      if (activeTeammateDriver.id !== 'rookie_teammate') {
        nextDriverTeamOverrides[activeTeammateDriver.id] = randomOtherTeam.id;
      }
      const cutDriverEntry = {
        id: activeTeammateDriver.id,
        name: currentMateName,
        rating: activeTeammateDriver.rating,
        number: activeTeammateDriver.number,
        color: activeTeammateDriver.color,
        previousSalary: cTeam.teammateSalaryPerRace ?? 220000,
        isAcademyRookie:
          cTeam.teammateDriverId === 'rookie_teammate' ||
          Boolean(cTeam.isAcademyRookieTeammate),
        cutRound: season.currentRound + 1,
        joinedTeamId: randomOtherTeam.id,
        joinedTeamName: randomOtherTeam.name,
      };
      // Avoid duplicate entry for the same driver name, update latest cut record
      updatedCutDrivers = [
        cutDriverEntry,
        ...updatedCutDrivers.filter(
          (d) => d.name !== currentMateName && d.name !== driverOfferModal.name && d.id !== driverOfferModal.driverId
        ),
      ];
    } else {
      updatedCutDrivers = updatedCutDrivers.filter(
        (d) => d.name !== driverOfferModal.name && d.id !== driverOfferModal.driverId
      );
    }

    // Track baseline salary so any pay cut directly increases owner net earnings & displays savings!
    const prevBaseline = isSameDriver
      ? Math.max(
          cTeam.teammateBaselineSalaryPerRace || 0,
          cTeam.teammateSalaryPerRace || 220000,
          driverOfferModal.currentOrDemandedSalary
        )
      : Math.max(driverOfferModal.currentOrDemandedSalary, finalSalary);

    const savingsPerRace = Math.max(0, prevBaseline - finalSalary);
    const isProveItContract =
      finalYears === 1 && finalSalary <= driverOfferModal.currentOrDemandedSalary * 0.75;
    const contractLabel = isProveItContract
      ? `1-Season Prove-It Deal (${formatMoney(finalSalary * 10)}/yr)`
      : `${finalYears}-Year Contract (${formatMoney(finalSalary * 10 * finalYears)} total)`;

    const updated: CustomTeamConfig = {
      ...cTeam,
      teammateDriverId: driverOfferModal.driverId,
      teammateSalaryPerRace: finalSalary,
      teammateBaselineSalaryPerRace: prevBaseline,
      teammateContractYearsRemaining: finalYears,
      teammateContractTotalYears: finalYears,
      teammateContractTypeLabel: contractLabel,
      teammateCustomName: driverOfferModal.name,
      teammateCustomRating: driverOfferModal.rating,
      isAcademyRookieTeammate: driverOfferModal.isAcademyRookie,
      teammateWins: isSameDriver ? cTeam.teammateWins || 0 : 0,
      teammatePodiums: isSameDriver ? cTeam.teammatePodiums || 0 : 0,
      cutFreeAgentDrivers: updatedCutDrivers,
      driverTeamOverrides: nextDriverTeamOverrides,
    };

    if (onUpdateCustomTeam) {
      onUpdateCustomTeam(updated, finalBonus);
    }

    setNotificationMsg(
      isSameDriver
        ? `CONTRACT RENEGOTIATED (${cTeam.name}): ${driverOfferModal.name} signed a ${finalYears}-Year deal at ${formatMoney(finalSalary * 10)}/yr (${formatMoney(finalSalary)}/race)${
            finalBonus > 0 ? ` with a ${formatMoney(finalBonus)} signing bonus` : ''
          }!${
            savingsPerRace > 0
              ? ` You now pay ${formatMoney(savingsPerRace)}/race LESS in teammate payroll and earn +${formatMoney(savingsPerRace)} MORE every Grand Prix!`
              : ''
          }`
        : `DRIVER SIGNED TO ${cTeam.name.toUpperCase()} (${finalYears}-YEAR DEAL): ${driverOfferModal.name} (${driverOfferModal.rating} OVR) signed for ${finalYears} Season${finalYears > 1 ? 's' : ''} at ${formatMoney(finalSalary * 10)}/yr (${formatMoney(finalSalary)}/race)${
            finalBonus > 0 ? ` (Signing Bonus: -${formatMoney(finalBonus)})` : ''
          }! Cut driver ${currentMateName} entered Free Agency and signed with ${randomOtherTeam.name}.`
    );
    setShowCutDriverConfirm(false);
    setDriverOfferModal(null);
  };

  const handleConfirmDriverOffer = () => {
    if (!driverOfferModal || !season.career.customTeam || driverOfferModal.status === 'rejected') return;

    // Do NOT reveal or auto-finalize before the offer has been sent and accepted!
    if (driverOfferModal.status !== 'accepted') {
      handleSendOfferToDriver();
      return;
    }

    const cTeam = season.career.customTeam;
    const isSameDriver =
      driverOfferModal.isCurrentTeammateRenegotiation &&
      cTeam.teammateDriverId === driverOfferModal.driverId &&
      activeTeammateDriver.name === driverOfferModal.name;

    // If signing a NEW driver while we already have a driver, show the Cut Old Driver -> Free Agent warning confirmation first!
    if (!isSameDriver && !showCutDriverConfirm) {
      setShowCutDriverConfirm(true);
      return;
    }

    executeFinalizeDriverOffer();
  };

  const [previewingEngineName, setPreviewingEngineName] = useState<string | null>(null);

  const careerPoints = season.driverPoints[season.selectedDriverId] || 0;
  const careerWins = season.career.wins;
  const careerPodiums = season.career.podiums;
  const driverRating = season.career.driverRating || 76;
  const bankBalance = season.career.careerEarnings;
  const careerRacesDriven = season.career.racesDriven || 0;
  const careerWinRate = careerRacesDriven > 0 ? careerWins / careerRacesDriven : 0;
  const careerReputation = season.career.reputation || 0.1;
  const careerCups = season.career.championships || 0;
  const isLookingForTeam = Boolean(season.career.isLookingForTeam);

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  // Computes how much a team is willing to pay in contract negotiations based on driver stats AND team tier:
  // Worse teams (performanceTier >= 3) have a MUCH higher chance/willingness to overpay big money for a good driver,
  // whereas top teams (performanceTier === 1) won't offer massive extra money unless the player is truly elite!
  // Also handles renegotiating with the player's CURRENT team after proving themselves (e.g. winning the Drivers' Cup or races after a low prove-it offer)!
  const initNegotiationForOffer = (
    team: Team,
    initialSalaryPerRace: number,
    initialBonus: number,
    isDesperateOverpay?: boolean,
    defaultContractYears: number = 1,
    isCurrentTeamRenegotiation: boolean = false
  ) => {
    const isEliteSuperstar = careerCups >= 1 || driverRating >= 88 || (careerRacesDriven >= 3 && careerWinRate >= 0.25);
    const isGoodContender =
      isEliteSuperstar ||
      driverRating >= 81 ||
      careerWins >= 1 ||
      (driverRating >= 79 && careerPodiums >= 2 && careerReputation >= 0.42);

    const wonCupsSinceSigning = careerCups > (season.career.contractSignedAtCups ?? 0);
    const wonRacesSinceSigning = careerWins > (season.career.contractSignedAtWins ?? 0);
    const improvedRatingSinceSigning = driverRating > (season.career.contractSignedAtRating ?? 76);
    const provedSelfOnCurrentTeam =
      isCurrentTeamRenegotiation &&
      (careerCups >= 1 || wonCupsSinceSigning || wonRacesSinceSigning || improvedRatingSinceSigning || careerWins >= 1 || careerPodiums >= 1);

    let salaryCapMultiplier = 1.1;
    let bonusCapMultiplier = 1.15;
    let patienceRounds = 2;
    let openingNote = '';

    if (isCurrentTeamRenegotiation) {
      if (careerCups >= 1 || wonCupsSinceSigning) {
        salaryCapMultiplier = 2.15;
        bonusCapMultiplier = 2.25;
        patienceRounds = 4;
        openingNote = `${team.name} Team Principal: "You joined us on a ${season.career.contractTypeLabel || 'prove-it contract'} and delivered ${careerCups} World Drivers' Cup(s)! Our board has authorized a massive championship war-chest extension—propose your salary and contract length (1–3 years) below!"`;
      } else if (provedSelfOnCurrentTeam || isGoodContender) {
        salaryCapMultiplier = 1.75;
        bonusCapMultiplier = 1.8;
        patienceRounds = 4;
        openingNote = `${team.name} Team Principal: "You've proven yourself in our car (${driverRating} OVR · ${careerWins} Wins · ${careerPodiums} Podiums). We're ready to tear up your old ${formatMoney(season.career.currentSalary * 10)}/yr deal and negotiate a big raise!"`;
      } else {
        salaryCapMultiplier = 1.25;
        bonusCapMultiplier = 1.3;
        patienceRounds = 3;
        openingNote = `${team.name} Team Principal: "You're currently earning ${formatMoney(season.career.currentSalary * 10)}/yr (${formatMoney(season.career.currentSalary)}/race). Win races or the Drivers' Cup and we'll unlock superstar championship money, or propose a modest raise/extension now."`;
      }
    } else if (team.performanceTier >= 3) {
      // Worse / midfield team: if player is good, they are desperate to lure them with big money!
      if (isEliteSuperstar) {
        salaryCapMultiplier = isDesperateOverpay ? 1.45 : 3.2;
        bonusCapMultiplier = isDesperateOverpay ? 1.5 : 2.8;
        patienceRounds = 4;
        openingNote = `${team.name} knows their car is slower than the frontrunners, so their board has authorized a massive war-chest budget to negotiate if that's what it takes to sign a ${driverRating}-rated star!`;
      } else if (isGoodContender) {
        salaryCapMultiplier = isDesperateOverpay ? 1.35 : 2.4;
        bonusCapMultiplier = isDesperateOverpay ? 1.4 : 2.1;
        patienceRounds = 3;
        openingNote = `As a midfield/underdog outfit, ${team.name} is willing to pay significantly more cash per race than top teams to convince a strong driver (${driverRating} OVR) to lead their project.`;
      } else {
        salaryCapMultiplier = 1.12;
        bonusCapMultiplier = 1.15;
        patienceRounds = 2;
        openingNote = `With your current ${driverRating} Rating and ${Math.round(careerWinRate * 100)}% win rate, ${team.name} is tabling a 1-Season Prove-It contract. Win races or the Drivers' Cup after joining to renegotiate for massive cash!`;
      }
    } else if (team.performanceTier === 2) {
      if (isEliteSuperstar) {
        salaryCapMultiplier = 1.65;
        bonusCapMultiplier = 1.6;
        patienceRounds = 3;
        openingNote = `${team.name} views you as a championship cornerstone and has strong financial flexibility in negotiations.`;
      } else if (isGoodContender) {
        salaryCapMultiplier = 1.28;
        bonusCapMultiplier = 1.3;
        patienceRounds = 3;
        openingNote = `${team.name} respects your pace (${driverRating} OVR) and is open to reasonable salary and bonus counter-offers.`;
      } else {
        salaryCapMultiplier = 1.08;
        bonusCapMultiplier = 1.1;
        patienceRounds = 2;
        openingNote = `${team.name} has multiple drivers vying for this seat—accept a 1-Year Prove-It offer now, then renegotiate for big cash once you win races or the Drivers' Cup!`;
      }
    } else {
      // Tier 1 Elite Frontrunner: Just because a team is better does NOT mean they will offer more unless you're really good!
      if (isEliteSuperstar) {
        salaryCapMultiplier = 1.5;
        bonusCapMultiplier = 1.5;
        patienceRounds = 3;
        openingNote = `Because you are an elite superstar (${driverRating} OVR${careerCups > 0 ? `, ${careerCups}x Champion` : ''}), ${team.name} is willing to negotiate a true marquee frontrunner package.`;
      } else {
        salaryCapMultiplier = 1.08;
        bonusCapMultiplier = 1.1;
        patienceRounds = 2;
        openingNote = `${team.name} is a Tier-1 frontrunner with the fastest machinery on the grid. Unless you have elite ratings or Drivers' Cups, they offer a 1-Season Prove-It deal—win the Drivers' Cup with them and you can immediately renegotiate for massive money!`;
      }
    }

    const computedMaxSalary = Math.round((initialSalaryPerRace * salaryCapMultiplier) / 25000) * 25000;
    const computedMaxBonus = Math.round((Math.max(150000, initialBonus) * bonusCapMultiplier) / 50000) * 50000;

    setCounterSalaryPerRace(initialSalaryPerRace);
    setCounterSigningBonus(initialBonus);
    setCounterContractYears(defaultContractYears);
    setMaxNegotiableSalary(Math.max(initialSalaryPerRace + 25000, computedMaxSalary));
    setMaxNegotiableBonus(Math.max(initialBonus + 50000, computedMaxBonus));
    setNegotiationPatience(patienceRounds);
    setNegotiationStatus('initial');
    setNegotiationFeedback(openingNote);
  };

  const handleOpenContract = (team: Team, forceProveItOffer: boolean = false) => {
    const isUnsigned = Boolean(season.career.isUnsignedFreeAgent && !season.career.customTeam);
    const isCurrentTeam = team.id === season.selectedTeamId && !season.career.customTeam && !isUnsigned;
    const cutCount = season.career.proveItCutCount || 0;
    const cutHistory = season.career.cutFromTeamsHistory || [];

    // If the player was just cut from this exact team on a Prove-It contract, that team refuses to immediately re-sign them!
    if (season.career.lastCutByTeamId === team.id && cutCount > 0) {
      setNotificationMsg(
        `🚫 CONTRACT BLOCKED: ${team.name} just CUT you from your Prove-It contract! Their Team Principal refuses to negotiate with you until you prove yourself at another team.`
      );
      return;
    }

    // If the player is an Unsigned Free Agent who was cut from a prove-it contract:
    // - If nobody signed them (`nobody_signed`), standard grid teams won't hand out normal contracts until they either win a Walk-On Tryout or buy a Pay-Driver seat!
    // - Even if lowball offers exist, Tier 1 & Tier 2 teams will NOT give an unsigned cut driver a prove-it deal!
    if (isUnsigned) {
      if (season.career.lastProveItCutNotice?.outcome === 'nobody_signed') {
        setNotificationMsg(
          `🚨 NOBODY SIGNED YOU: After getting cut (${cutCount}x), ${team.name} and the rest of the grid closed talks! Use "Call Backmarker Teams for Emergency Walk-On Tryout" or "Pay-Driver Seat Buy-In" in the Unsigned Free Agent banner above!`
        );
        return;
      }
      if (team.performanceTier <= 2) {
        setNotificationMsg(
          `🚫 REJECTED BY ${team.name.toUpperCase()}: Frontrunner and midfield teams refuse to sign a driver who was just cut from a Prove-It contract! You can only sign a rock-bottom Prove-It lifeline with a really bad Tier 3/4 backmarker team.`
        );
        return;
      }
      if (cutHistory.includes(team.id) && cutCount >= 2) {
        setNotificationMsg(
          `🚫 REJECTED BY ${team.name.toUpperCase()}: You were already cut by ${team.name} earlier! They refuse to offer you another seat.`
        );
        return;
      }
    }

    const offer = TEAM_CONTRACTS.find((c) => c.teamId === team.id) || {
      teamId: team.id,
      minRating: 75,
      minPoints: 0,
      minWins: 0,
      minPodiums: 0,
      salaryPerRace: 200000,
      signingBonus: 500000,
      midSeasonBuyoutFee: 500000,
      prestigeTier: 'Rookie' as const,
      teamExpectation: 'Drive cleanly and develop the car.',
    };

    const isMidSeason = season.currentRound > 0 && !season.seasonFinished;
    // Renegotiating with your current team OR signing while an Unsigned Free Agent NEVER charges a mid-season buyout fee!
    const buyout = isCurrentTeam || isUnsigned ? 0 : isMidSeason ? offer.midSeasonBuyoutFee : 0;
    const canAfford = bankBalance >= buyout;

    // If renegotiating with your current team OR accepting a 1-Season Prove-It deal on a team you qualify for, entry locks are satisfied
    const meetsRating = isCurrentTeam || forceProveItOffer ? true : driverRating >= offer.minRating;
    const meetsPoints = true; // No career points required to join a team
    const meetsWins = isCurrentTeam || forceProveItOffer ? true : careerWins >= offer.minWins;
    const meetsPodiums = isCurrentTeam || forceProveItOffer ? true : careerPodiums >= offer.minPodiums;

    const displacedDriver = DRIVERS.find((d) => d.id === team.drivers[1]) || DRIVERS.find((d) => d.teamId === team.id) || DRIVERS[0];

    const isGoodDriver = (driverRating >= 81 || careerWins >= 1 || careerCups >= 1) && !isUnsigned;
    let initialSalary = offer.salaryPerRace;
    let initialBonus = offer.signingBonus;
    let isUnderdogBoost = false;
    let defaultYears = 1;
    let isProveIt = forceProveItOffer;
    let modalOfferTitle: string | undefined = undefined;

    if (isCurrentTeam) {
      // Player is already on this team and wants to renegotiate!
      // If they joined on a low prove-it offer and later won the Drivers' Cup, won races, or raised their rating, scale up their offer massively!
      const curSal = season.career.currentSalary || 180000;
      const baseMarketSal = Math.max(offer.salaryPerRace, curSal);
      if (careerCups >= 1) {
        // Won the Drivers' Cup! Huge championship payday!
        const cupMultiplier = 1.85 + Math.min(1.5, (careerCups - 1) * 0.45 + Math.max(0, driverRating - 82) * 0.06);
        initialSalary = Math.round((Math.max(1250000, baseMarketSal * cupMultiplier)) / 50000) * 50000;
        initialBonus = Math.round((Math.max(2500000, offer.signingBonus * 1.9 + careerCups * 1200000)) / 100000) * 100000;
        defaultYears = 2;
        isProveIt = false;
        modalOfferTitle = `CHAMPIONSHIP RAISE & CONTRACT RENEGOTIATION (${careerCups}x DRIVERS' CUP WINNER)`;
      } else if (careerWins >= 1 || careerPodiums >= 2 || driverRating >= 80) {
        const perfMult = 1.35 + Math.min(1.1, careerWins * 0.14 + careerPodiums * 0.05 + Math.max(0, driverRating - 78) * 0.06);
        initialSalary = Math.round((Math.max(450000, baseMarketSal * perfMult)) / 25000) * 25000;
        initialBonus = Math.round((Math.max(750000, offer.signingBonus * 1.35)) / 50000) * 50000;
        defaultYears = 2;
        isProveIt = false;
        modalOfferTitle = 'PROVEN WINNER CONTRACT RAISE & EXTENSION';
      } else {
        // Still unproven, modest renewal/renegotiation baseline
        initialSalary = Math.max(curSal, Math.round((baseMarketSal * 1.05) / 25000) * 25000);
        initialBonus = Math.round((offer.signingBonus * 0.6) / 50000) * 50000;
        defaultYears = 1;
        isProveIt = true;
        modalOfferTitle = 'CURRENT TEAM CONTRACT RENEGOTIATION';
      }
    } else if (isUnsigned || (cutCount > 0 && forceProveItOffer && team.performanceTier >= 3)) {
      // Recently cut from a Prove-It contract! Only rock-bottom Prove-It contracts from bad teams!
      initialSalary = cutCount >= 3 ? 10000 : cutCount === 2 ? 25000 : 50000;
      initialBonus = 0;
      defaultYears = 1;
      isProveIt = true;
      modalOfferTitle = `BACKMARKER LAST-CHANCE PROVE-IT LIFELINE (${formatMoney(initialSalary * 10)} FOR 1 YEAR · $0 BONUS)`;
    } else if (forceProveItOffer) {
      // Player explicitly chose a 1-Season Low "Prove-It" Offer (or $3M for 1 Year deal) to get their foot in the door!
      // Once they join and win races or the Drivers' Cup, they can renegotiate with this team for massive cash!
      if (team.performanceTier === 1) {
        initialSalary = 300000; // $3,000,000 for 1 Year Prove-It Deal!
        initialBonus = 250000;
        modalOfferTitle = '1-SEASON TOP TEAM PROVE-IT OFFER ($3,000,000 FOR 1 YEAR)';
      } else if (team.performanceTier === 2) {
        initialSalary = 200000; // $2,000,000 for 1 Year Prove-It Deal!
        initialBonus = 150000;
        modalOfferTitle = '1-SEASON CONTENDER PROVE-IT OFFER ($2,000,000 FOR 1 YEAR)';
      } else {
        initialSalary = 110000; // $1,100,000 for 1 Season Low Prove-It Deal!
        initialBonus = 100000;
        modalOfferTitle = '1-SEASON LOW PROVE-IT CONTRACT (WIN TO RENEGOTIATE BIG CASH)';
      }
      defaultYears = 1;
      isProveIt = true;
    } else if (team.performanceTier >= 3 && isGoodDriver) {
      const boostFactor = careerCups >= 1 || driverRating >= 88 ? 2.8 : 2.1;
      initialSalary = Math.round((Math.max(850000, offer.salaryPerRace) * boostFactor) / 50000) * 50000;
      initialBonus = Math.round((Math.max(1800000, offer.signingBonus) * 1.9) / 100000) * 100000;
      isUnderdogBoost = true;
      defaultYears = 2;
      isProveIt = false;
    } else {
      isProveIt = driverRating < 80 && careerWins === 0 && careerCups === 0;
      defaultYears = isProveIt ? 1 : 2;
    }

    initNegotiationForOffer(team, initialSalary, initialBonus, isUnderdogBoost, defaultYears, isCurrentTeam);

    setSelectedOffer({
      team,
      salary: initialSalary,
      signingBonus: initialBonus,
      buyoutFee: buyout,
      minRating: isCurrentTeam || forceProveItOffer ? 0 : offer.minRating,
      minPoints: 0,
      minWins: isCurrentTeam || forceProveItOffer ? 0 : offer.minWins,
      minPodiums: isCurrentTeam || forceProveItOffer ? 0 : offer.minPodiums,
      expectation: isCurrentTeam
        ? `Renegotiate your active contract with ${team.name}. Winning races or the Drivers' Cup unlocks massive championship raises!`
        : forceProveItOffer
        ? `1-Season Prove-It Deal with ${team.name}: Accept lower pay for 1 season to get the seat, then renegotiate for massive cash once you win races or the Drivers' Cup!`
        : offer.teamExpectation,
      canAffordBuyout: canAfford,
      meetsRating,
      meetsPoints,
      meetsWins,
      meetsPodiums,
      displacedDriverName: isCurrentTeam ? 'None (Retaining Your Current Seat)' : displacedDriver.name,
      isHeadhunterOffer: forceProveItOffer,
      offerTitle: modalOfferTitle,
      isDesperateOverpay: isUnderdogBoost,
      contractYears: defaultYears,
      isProveItDeal: isProveIt,
      isCurrentTeamRenegotiation: isCurrentTeam,
    });
  };

  // Active Incoming Headhunter Offers:
  // - Only get good offers if you're performing well.
  // - Once on a team, unless you announce `isLookingForTeam`, you get little to no offers (0 unless elite superstar).
  // - Worse teams have a much higher chance of offering massive cash per year to lure a good driver!
  const activeIncomingOffers: IncomingTeamOffer[] = useMemo(() => {
    if (Array.isArray(season.career.incomingOffers)) {
      return season.career.incomingOffers.filter(
        (o) => o.teamId !== season.selectedTeamId && !dismissedOfferIds.includes(o.id)
      );
    }
    return [];
  }, [season.career.incomingOffers, season.selectedTeamId, dismissedOfferIds]);

  const handleAcceptIncomingOffer = (incOffer: IncomingTeamOffer) => {
    const team = TEAMS.find((t) => t.id === incOffer.teamId);
    if (!team) return;
    const displacedDriver = DRIVERS.find((d) => d.id === team.drivers[1]) || DRIVERS.find((d) => d.teamId === team.id) || DRIVERS[0];
    const offerYears = incOffer.contractYears || 1;
    const isProveIt = Boolean(incOffer.isProveItDeal || incOffer.offerTier === 'rookie_prove_it' || incOffer.offerTier === 'backmarker_lowball');

    initNegotiationForOffer(team, incOffer.salaryPerRace, incOffer.signingBonus, incOffer.isDesperateOverpay, offerYears, false);

    setSelectedOffer({
      team,
      salary: incOffer.salaryPerRace,
      signingBonus: incOffer.signingBonus,
      buyoutFee: 0, // Covered by poaching team
      minRating: 0,
      minPoints: 0,
      minWins: 0,
      minPodiums: 0,
      expectation: incOffer.pitchMessage,
      canAffordBuyout: true,
      meetsRating: true,
      meetsPoints: true,
      meetsWins: true,
      meetsPodiums: true,
      displacedDriverName: displacedDriver.name,
      isHeadhunterOffer: true,
      offerTitle: incOffer.offerTitle,
      isDesperateOverpay: incOffer.isDesperateOverpay,
      contractYears: offerYears,
      isProveItDeal: isProveIt,
      isCurrentTeamRenegotiation: false,
    });
  };

  const handleProposeCounterOffer = () => {
    if (!selectedOffer || negotiationStatus === 'walked_away') return;

    const askedSalary = counterSalaryPerRace;
    const askedBonus = counterSigningBonus;
    const askedYears = counterContractYears;
    const totalTermCash = askedSalary * 10 * askedYears;

    // If asking at or below current offer, immediately accept
    if (askedSalary <= selectedOffer.salary && askedBonus <= selectedOffer.signingBonus) {
      setSelectedOffer({
        ...selectedOffer,
        salary: askedSalary,
        signingBonus: askedBonus,
        contractYears: askedYears,
        isProveItDeal: askedYears === 1 && Boolean(selectedOffer.isProveItDeal),
      });
      setNegotiationStatus('accepted');
      setNegotiationFeedback(
        `${selectedOffer.team.name} Team Principal: "Agreed! ${formatMoney(totalTermCash)} for ${askedYears} Year${askedYears > 1 ? 's' : ''} (${formatMoney(askedSalary * 10)}/yr · ${formatMoney(askedSalary)}/race) works perfectly for our budget. Sign below whenever you're ready."`
      );
      return;
    }

    // Check if within the team's maximum willingness
    if (askedSalary <= maxNegotiableSalary && askedBonus <= maxNegotiableBonus) {
      setSelectedOffer({
        ...selectedOffer,
        salary: askedSalary,
        signingBonus: askedBonus,
        contractYears: askedYears,
        isProveItDeal: askedYears === 1 && askedSalary <= 350000,
      });
      setNegotiationStatus('accepted');
      setNegotiationPatience((p) => Math.max(1, p - 1));
      setNegotiationFeedback(
        `${selectedOffer.team.name} Team Principal: "You drive a hard bargain, but given your ${driverRating} Driver Rating${careerCups > 0 ? ` and ${careerCups} Drivers' Cup(s)` : ''}, we've approved ${formatMoney(totalTermCash)} for ${askedYears} Year${askedYears > 1 ? 's' : ''} (${formatMoney(askedSalary * 10)}/yr · ${formatMoney(askedSalary)}/race) + ${formatMoney(askedBonus)} signing bonus!"`
      );
      return;
    }

    // If asking way too much (> 1.45x max) and patience is low, team walks away!
    const salaryOverreach = askedSalary / Math.max(1, maxNegotiableSalary);
    const bonusOverreach = askedBonus / Math.max(1, maxNegotiableBonus);
    const nextPatience = negotiationPatience - 1;
    setNegotiationPatience(nextPatience);

    if (nextPatience <= 0 || salaryOverreach > 1.45 || bonusOverreach > 1.6) {
      setNegotiationStatus('walked_away');
      setNegotiationFeedback(
        `${selectedOffer.team.name} Team Principal: "Your financial demands (${formatMoney(askedSalary * 10)}/yr for ${askedYears} yr${askedYears > 1 ? 's' : ''}) are completely out of line with what our board will authorize. Negotiations are terminated!"`
      );
      return;
    }

    // Otherwise, the Team Principal meets halfway up to their ceiling!
    const compromisedSalary = Math.min(
      maxNegotiableSalary,
      Math.round(((selectedOffer.salary + Math.min(askedSalary, maxNegotiableSalary)) / 2) / 25000) * 25000
    );
    const compromisedBonus = Math.min(
      maxNegotiableBonus,
      Math.round(((selectedOffer.signingBonus + Math.min(askedBonus, maxNegotiableBonus)) / 2) / 50000) * 50000
    );

    setSelectedOffer({
      ...selectedOffer,
      salary: compromisedSalary,
      signingBonus: compromisedBonus,
      contractYears: askedYears,
    });
    setCounterSalaryPerRace(compromisedSalary);
    setCounterSigningBonus(compromisedBonus);
    setNegotiationStatus('countered');
    setNegotiationFeedback(
      `${selectedOffer.team.name} Team Principal: "We can't stretch to ${formatMoney(askedSalary * 10)}/yr, but our board will counter at ${formatMoney(compromisedSalary * 10 * askedYears)} for ${askedYears} Year${askedYears > 1 ? 's' : ''} (${formatMoney(compromisedSalary * 10)}/yr · ${formatMoney(compromisedSalary)}/race) with a ${formatMoney(compromisedBonus)} signing bonus. You can accept our counter-offer below or counter again (${nextPatience} round${nextPatience === 1 ? '' : 's'} left)!"`
    );
  };

  const handleAcceptTeamCounterOffer = () => {
    if (!selectedOffer) return;
    setNegotiationStatus('accepted');
    const yrs = selectedOffer.contractYears || counterContractYears || 1;
    setNegotiationFeedback(
      `${selectedOffer.team.name} Team Principal: "Wonderful! You've accepted our ${yrs}-year counter-offer of ${formatMoney(selectedOffer.salary * 10 * yrs)} (${formatMoney(selectedOffer.salary * 10)}/yr · ${formatMoney(selectedOffer.salary)}/race) + ${formatMoney(selectedOffer.signingBonus)} signing bonus. ${
        season.career.customTeam
          ? `Once you sell ${season.career.customTeam.name}, we will immediately register your contract with the FIA!`
          : 'Sign the contract below to make it official!'
      }"`
    );
  };

  const handleConfirmContract = () => {
    if (!selectedOffer || negotiationStatus === 'walked_away') return;
    const eligible =
      selectedOffer.canAffordBuyout &&
      selectedOffer.meetsRating &&
      selectedOffer.meetsPoints &&
      selectedOffer.meetsWins &&
      selectedOffer.meetsPodiums;

    if (!eligible) return;

    // If player still owns a custom team, they can negotiate freely, but to finally accept/sign they must confirm selling their team!
    if (season.career.customTeam) {
      setShowSellTeamModal(true);
      return;
    }

    const team = selectedOffer.team;
    const targetDriver = DRIVERS.find((d) => d.teamId === team.id) || DRIVERS[0];
    const finalYears = Math.max(1, Math.min(5, counterContractYears || selectedOffer.contractYears || 1));
    const isProveIt = Boolean(selectedOffer.isProveItDeal && finalYears === 1 && selectedOffer.salary <= 350000);
    const contractLabel = isProveIt
      ? `1-Season Prove-It Deal (${formatMoney(selectedOffer.salary * 10)}/yr)`
      : selectedOffer.isCurrentTeamRenegotiation
      ? `${finalYears}-Year Renegotiated Extension (${formatMoney(selectedOffer.salary * 10)}/yr)`
      : `${finalYears}-Year Contract (${formatMoney(selectedOffer.salary * 10 * finalYears)} total)`;

    onSelectTeam(
      team.id,
      targetDriver.id,
      selectedOffer.buyoutFee,
      selectedOffer.signingBonus,
      selectedOffer.salary,
      finalYears,
      contractLabel,
      isProveIt
    );
    setNotificationMsg(
      selectedOffer.isCurrentTeamRenegotiation
        ? `CONTRACT RENEGOTIATED WITH ${team.name.toUpperCase()}: Locked in a new ${finalYears}-Year deal worth ${formatMoney(selectedOffer.salary * 10 * finalYears)} (${formatMoney(selectedOffer.salary * 10)}/yr · ${formatMoney(selectedOffer.salary)}/race) + ${formatMoney(selectedOffer.signingBonus)} signing bonus!`
        : `OFFICIAL FIA PRESS: You signed a ${finalYears}-Year ${isProveIt ? 'Prove-It ' : ''}contract with ${team.name} worth ${formatMoney(selectedOffer.salary * 10 * finalYears)} (${formatMoney(selectedOffer.salary * 10)}/yr · ${formatMoney(selectedOffer.salary)}/race) + ${formatMoney(selectedOffer.signingBonus)} bonus!`
    );
    setSelectedOffer(null);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateDriverProfile(driverNameInput, driverNumberInput, countryInput);
    setEditingProfile(false);
  };

  const franchisePurchaseCost = 200000000; // $200,000,000 Official FIA 11th Team Anti-Dilution Expansion Fee (No financing allowed)

  const selectedEngineOpt = ENGINE_OPTIONS.find((eng) => eng.name === customEngine) || ENGINE_OPTIONS[0];
  const totalTeamEntryCost = franchisePurchaseCost + selectedEngineOpt.purchaseCost;

  const handleCreateTeamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bankBalance < totalTeamEntryCost) {
      setNotificationMsg(
        `Acquiring an official F1 Constructor franchise requires ${formatMoney(franchisePurchaseCost)} plus ${formatMoney(selectedEngineOpt.purchaseCost)} for the ${selectedEngineOpt.name} power unit (${formatMoney(totalTeamEntryCost)} total in liquid career earnings). Financing is strictly prohibited by FIA regulations.`
      );
      return;
    }

    // Default starting teammate is Academy Rookie driver Luca Sterling until user signs another driver in Contracts
    const rookieTeammate = DRIVERS.find((d) => d.id === 'rookie_teammate') || DRIVERS[DRIVERS.length - 1];

    const config: CustomTeamConfig = {
      id: 'custom_f1_team',
      name: customTeamName,
      shortName: customTeamShort,
      primaryColor: customPrimaryColor,
      secondaryColor: customSecondaryColor,
      accentColor: customAccentColor,
      engine: selectedEngineOpt.name,
      engineId: selectedEngineOpt.id,
      enginePower: selectedEngineOpt.powerRating,
      engineTopSpeed: selectedEngineOpt.topSpeedKmh,
      engineCostPerRace: selectedEngineOpt.costPerRace,
      isWorksEngine: selectedEngineOpt.isWorksCustom,
      teammateDriverId: rookieTeammate.id,
      teammateSalaryPerRace: rookieTeammate.salaryPerRaceDemand || 220000,
      teammateBaselineSalaryPerRace: rookieTeammate.salaryPerRaceDemand || 220000,
      teammateContractYearsRemaining: 1,
      teammateContractTotalYears: 1,
      teammateContractTypeLabel: '1-Season Rookie Prove-It Deal',
      factoryLevel: 1,
      maintenanceCostPerRace: 2200000,
      baseSponsorPerRace: 8500000,
    };

    onCreateCustomTeam(config, totalTeamEntryCost);
    setNotificationMsg(
      `OFFICIAL FIA ANNOUNCEMENT: ${customTeamName} has been officially acquired and entered into the FIA Formula 1 World Championship for ${formatMoney(totalTeamEntryCost)} (${formatMoney(franchisePurchaseCost)} franchise + ${formatMoney(selectedEngineOpt.purchaseCost)} ${selectedEngineOpt.name})! Rookie teammate ${rookieTeammate.name} assigned to car #2.`
    );
    setActiveTab('weekend');
  };

  const [customEngineNameInput, setCustomEngineNameInput] = useState('');
  const [dynoAttemptTier, setDynoAttemptTier] = useState<'tier_1' | 'tier_2' | 'tier_3' | 'tier_4'>('tier_2');
  const [dynoTestActive, setDynoTestActive] = useState(false);
  const [dynoResultNotice, setDynoResultNotice] = useState<EngineDynoResult | null>(null);

  const handleBuyEngine = (engine: EngineOption) => {
    if (!season.career.customTeam) return;
    if (bankBalance < engine.purchaseCost) {
      setNotificationMsg(`Insufficient funds! Acquiring the ${engine.name} requires ${formatMoney(engine.purchaseCost)} from career bank balance.`);
      return;
    }

    const updated: CustomTeamConfig = {
      ...season.career.customTeam,
      engine: engine.name,
      engineId: engine.id,
      enginePower: engine.powerRating,
      engineTopSpeed: engine.topSpeedKmh,
      engineCostPerRace: engine.costPerRace,
      isWorksEngine: engine.isWorksCustom,
    };

    if (onUpdateCustomTeam) {
      onUpdateCustomTeam(updated, engine.purchaseCost);
    }
    setNotificationMsg(
      `OFFICIAL PU AGREEMENT: ${season.career.customTeam.name} has equipped the ${engine.name} (Power: ${engine.powerRating}/100)!`
    );
  };

  const handleHireEngineEngineer = (engineer: EngineEngineerOption) => {
    if (!season.career.customTeam) return;
    if (bankBalance < engineer.hiringFee) {
      setNotificationMsg(`Insufficient funds! Contracting ${engineer.name} requires ${formatMoney(engineer.hiringFee)}.`);
      return;
    }

    const updated: CustomTeamConfig = {
      ...season.career.customTeam,
      engineEngineerId: engineer.id,
      engineEngineerSalary: engineer.salaryPerRace,
    };

    if (onUpdateCustomTeam) {
      onUpdateCustomTeam(updated, engineer.hiringFee);
    }
    setNotificationMsg(
      `POWERTRAIN SIGNING: ${engineer.name} has joined as Chief Engine Engineer (+${engineer.successBonus}% Success Odds, -${engineer.failureReduction}% Downgrade Risk)!`
    );
  };

  const handleHireEngineScientist = (scientist: EngineScientistOption) => {
    if (!season.career.customTeam) return;
    if (bankBalance < scientist.hiringFee) {
      setNotificationMsg(`Insufficient funds! Contracting ${scientist.name} requires ${formatMoney(scientist.hiringFee)}.`);
      return;
    }

    const updated: CustomTeamConfig = {
      ...season.career.customTeam,
      engineScientistId: scientist.id,
      engineScientistSalary: scientist.salaryPerRace,
    };

    if (onUpdateCustomTeam) {
      onUpdateCustomTeam(updated, scientist.hiringFee);
    }
    setNotificationMsg(
      `RESEARCH SIGNING: ${scientist.name} joined as Lead Materials & Combustion Scientist (+${scientist.successBonus}% Success Odds, -${scientist.failureReduction}% Downgrade Risk)!`
    );
  };

  const handleRunDynoAttempt = (tierCost: number, tierName: string, baseSuccessRate: number, baseFailureRate: number) => {
    if (!season.career.customTeam) return;
    if (bankBalance < tierCost) {
      setNotificationMsg(`Dyno development attempt requires ${formatMoney(tierCost)} upfront cash. Win races to raise R&D budget!`);
      return;
    }

    const curTeam = season.career.customTeam;
    const curPower = curTeam.enginePower || 84;
    const curReliability = curTeam.engineReliability || 80;
    const isSuperHighPower = curPower >= 100;
    const hiredEngineer = ENGINE_ENGINEER_OPTIONS.find((e) => e.id === curTeam.engineEngineerId);
    const hiredScientist = ENGINE_SCIENTIST_OPTIONS.find((s) => s.id === curTeam.engineScientistId);

    // Dynamic Odds Calculation
    const engineerSuccess = hiredEngineer ? hiredEngineer.successBonus : 0;
    const engineerFailureCut = hiredEngineer ? hiredEngineer.failureReduction : 0;
    const scientistSuccess = hiredScientist ? hiredScientist.successBonus : 0;
    const scientistFailureCut = hiredScientist ? hiredScientist.failureReduction : 0;

    const powerPenalty = Math.max(0, (curPower - 80) * 0.45);
    const powerRiskBonus = Math.max(0, (curPower - 82) * 0.35);

    const successOdds = Math.max(10, Math.min(95, baseSuccessRate + engineerSuccess + scientistSuccess - powerPenalty));
    const failureOdds = Math.max(2, Math.min(65, baseFailureRate - engineerFailureCut - scientistFailureCut + powerRiskBonus));
    const neutralOdds = Math.max(3, 100 - successOdds - failureOdds);

    const roll = Math.random() * 100;
    let outcome: 'breakthrough' | 'upgrade' | 'neutral' | 'downgrade' = 'neutral';
    let powerDelta = 0;
    let newPower = curPower;
    let newReliability = curReliability;
    let message = '';

    if (isSuperHighPower) {
      // Once engine rating goes super high (>= 100), power cannot increase further — only RELIABILITY can improve!
      // "make it so once my engine rating goes super high then i can only improve my reliability the more reliable an engine the harder the hits the car can take with out stalling but DONT make it fully immune to hits its just that it can survive like a light tap."
      newPower = curPower;
      if (roll < successOdds) {
        const isBreakthrough = roll < successOdds * 0.35 || (hiredScientist?.id === 'legend_scientist' && Math.random() < 0.4);
        if (isBreakthrough) {
          outcome = 'breakthrough';
          const relGain = 3 + Math.floor(Math.random() * 3) + (hiredEngineer?.powerGainBonus || 0);
          newReliability = Math.min(99, curReliability + relGain);
          message = `MAX POWER CEILING REACHED (Rating: ${curPower}): Combustion power is maxed! Breakthrough in Component Endurance: Reliability improved from ${curReliability}% to ${newReliability}%! The car can now take light barrier taps and wheel rubs without stalling the engine!`;
        } else {
          outcome = 'upgrade';
          const relGain = 1 + Math.floor(Math.random() * 2);
          newReliability = Math.min(99, curReliability + relGain);
          message = `MAX POWER CEILING REACHED: Power is at peak limit. Dyno endurance stress-testing reinforced engine mounts: Reliability improved from ${curReliability}% to ${newReliability}%! Enhanced resistance to light impact stalls.`;
        }
      } else if (roll < successOdds + neutralOdds) {
        outcome = 'neutral';
        newReliability = curReliability;
        message = `STEADY DYNO RUN: Endurance stress analysis normal. Reliability remains steady at ${curReliability}% (Power Rating: ${curPower}).`;
      } else {
        outcome = 'downgrade';
        const relLoss = Math.min(curReliability - 75, 1 + Math.floor(Math.random() * 2));
        newReliability = Math.max(75, curReliability - relLoss);
        message = `DYNO KNOCKING & FATIGUE: High-RPM resonance micro-fracture! Component reliability decreased from ${curReliability}% to ${newReliability}%. Hire senior scientists to damp high-frequency vibration.`;
      }
    } else {
      // Normal power scaling prior to super-high ceiling
      if (roll < successOdds) {
        const isBreakthrough = roll < successOdds * 0.35 || (hiredScientist?.id === 'legend_scientist' && Math.random() < 0.4);
        if (isBreakthrough) {
          outcome = 'breakthrough';
          powerDelta = 3 + Math.floor(Math.random() * 4) + (hiredEngineer?.powerGainBonus || 0);
          message = `BREAKTHROUGH POWER UNIT: Cylinder pre-chamber combustion pressure +18%! Power surged from ${curPower} to ${curPower + powerDelta} ${curPower + powerDelta >= 100 ? '(HYPER-SPEC PEAK REACHED)!' : ''}!`;
        } else {
          outcome = 'upgrade';
          powerDelta = 1 + Math.floor(Math.random() * 3) + Math.floor((hiredEngineer?.powerGainBonus || 0) * 0.5);
          message = `DYNO UPGRADE CONFIRMED: MGU-H turbo recovery improved. Power increased from ${curPower} to ${curPower + powerDelta} ${curPower + powerDelta >= 100 ? '(HYPER-SPEC PEAK)' : ''}.`;
        }
      } else if (roll < successOdds + neutralOdds) {
        outcome = 'neutral';
        powerDelta = 0;
        message = `FLAT DYNO RUN: New camshaft profile matched baseline output. Power remains steady at ${curPower}.`;
      } else {
        outcome = 'downgrade';
        powerDelta = -Math.min(curPower - 70, 2 + Math.floor(Math.random() * 3));
        message = `DYNO DETONATION FAILURE: Severe thermal knocking and pre-ignition! Power DECREASED from ${curPower} to ${curPower + powerDelta}! Higher tier scientists and master engineers are essential to stabilize high-compression combustion.`;
      }
      newPower = Math.max(70, curPower + powerDelta);
    }

    const engineName = customEngineNameInput.trim() || curTeam.engine || `${curTeam.name} Works Turbo`;

    const dynoResult: EngineDynoResult = {
      outcome,
      prevPower: curPower,
      newPower,
      powerDelta,
      message,
      timestamp: Date.now(),
    };

    const updatedTeam: CustomTeamConfig = {
      ...curTeam,
      engine: engineName,
      engineId: 'works_inhouse_custom',
      enginePower: newPower,
      engineReliability: newReliability,
      engineTopSpeed: 348 + Math.round((newPower - 80) * 2.4),
      isWorksEngine: true,
      engineDevelopmentAttempts: (curTeam.engineDevelopmentAttempts || 0) + 1,
      lastDynoResult: dynoResult,
    };

    setDynoTestActive(true);
    setDynoResultNotice(dynoResult);
    if (onUpdateCustomTeam) {
      onUpdateCustomTeam(updatedTeam, tierCost);
    }
    setNotificationMsg(message);
    setTimeout(() => {
      setDynoTestActive(false);
    }, 1800);
  };

  const handleToggleCustomerTeamPU = (offer: CustomerTeamPUOffer) => {
    if (!season.career.customTeam) return;
    const curTeam = season.career.customTeam;
    const currentCustomers = curTeam.customerTeamsSupplied || [];
    const isAlreadySupplied = currentCustomers.includes(offer.teamId);
    const curSeasonNumber = season.career.seasonNumber || 1;
    const contractSeasons = { ...(curTeam.customerContractSeasons || {}) };

    let updatedCustomers: string[];
    let costDeduction = 0;

    if (isAlreadySupplied) {
      const signedSeason = contractSeasons[offer.teamId] ?? curSeasonNumber;
      const isEarlyTermination = curSeasonNumber <= signedSeason;

      if (isEarlyTermination) {
        // Must refund the signing bonus back if terminating before 1 full season ends
        // "make it so once i sign a contract with a team i have to keep that contract for 1 season and if i terminate it before that one season ends then i have to pay them the signing bonus back"
        const penaltyToRefund = offer.signingBonus;
        if ((season.career.careerEarnings || 0) < penaltyToRefund) {
          setNotificationMsg(
            `INSUFFICIENT FUNDS: Cannot terminate early! You must pay back the ${formatMoney(penaltyToRefund)} signing bonus to ${offer.teamName}. Current funds: ${formatMoney(season.career.careerEarnings || 0)}.`
          );
          return;
        }

        costDeduction = penaltyToRefund; // Positive number deducts from team cash
        delete contractSeasons[offer.teamId];
        updatedCustomers = currentCustomers.filter((id) => id !== offer.teamId);

        setNotificationMsg(
          `EARLY CONTRACT TERMINATION: Agreement with ${offer.teamName} terminated before 1 full season ended. Full signing bonus of ${formatMoney(penaltyToRefund)} was refunded back to ${offer.teamName}.`
        );
      } else {
        // 1 season commitment fulfilled!
        delete contractSeasons[offer.teamId];
        updatedCustomers = currentCustomers.filter((id) => id !== offer.teamId);
        costDeduction = 0;
        setNotificationMsg(
          `CONTRACT CONCLUDED: 1-season supply contract with ${offer.teamName} successfully fulfilled. Agreement concluded without penalty.`
        );
      }
    } else {
      const enginePower = curTeam.enginePower || 84;
      if (enginePower < offer.minPowerRequired) {
        setNotificationMsg(
          `${offer.teamName} rejected the PU contract! Their technical directors require a minimum power unit rating of ${offer.minPowerRequired} (Current: ${enginePower}). Develop your engine on the dyno bench to meet their requirements!`
        );
        return;
      }
      updatedCustomers = [...currentCustomers, offer.teamId];
      contractSeasons[offer.teamId] = curSeasonNumber;
      costDeduction = -(offer.signingBonus || 0); // Negative cost adds signing bonus cash!

      setNotificationMsg(
        `OFFICIAL 1-SEASON CONTRACT SIGNED: ${offer.teamName} licensed ${curTeam.name} Power Units! Received +${formatMoney(offer.signingBonus)} upfront signing bonus and +${formatMoney(offer.feePerRace)} every Grand Prix! (Contract locked for Season ${curSeasonNumber}).`
      );
    }

    const totalRevenue = updatedCustomers.reduce((sum, tId) => {
      const off = CUSTOMER_PU_OFFERS.find((o) => o.teamId === tId);
      return sum + (off ? off.feePerRace : 0);
    }, 0);

    const updatedTeam: CustomTeamConfig = {
      ...curTeam,
      customerTeamsSupplied: updatedCustomers,
      customerSupplyRevenuePerRace: totalRevenue,
      customerContractSeasons: contractSeasons,
    };

    if (onUpdateCustomTeam) {
      onUpdateCustomTeam(updatedTeam, costDeduction);
    }
  };

  const handleHireAeroStaff = (staff: AeroStaffOption) => {
    if (!season.career.customTeam) return;
    if (bankBalance < staff.hiringFee) {
      setNotificationMsg(`Insufficient funds! Contracting ${staff.name} requires ${formatMoney(staff.hiringFee)}.`);
      return;
    }

    const updated: CustomTeamConfig = {
      ...season.career.customTeam,
      aeroStaffId: staff.id,
      aeroDownforceBonus: staff.downforceBonus,
      handlingBonus: staff.handlingBonus,
      aeroStaffSalary: staff.salaryPerRace,
    };

    if (onUpdateCustomTeam) {
      onUpdateCustomTeam(updated, staff.hiringFee);
    }
    setNotificationMsg(
      `TECHNICAL SIGNING: ${staff.name} has joined ${season.career.customTeam.name} (+${staff.handlingBonus} Handling, +${Math.round(staff.downforceBonus * 100)}% Downforce)! Deducted ${formatMoney(staff.hiringFee)}.`
    );
  };

  const handleSignTeammate = (driver: Driver) => {
    if (!season.career.customTeam) return;
    const isEligible = driver.contractExpiring || driver.willingToJoinCustomTeam;
    if (!isEligible) {
      setNotificationMsg(`${driver.name} is under long-term contract and is not willing to negotiate with an independent team.`);
      return;
    }

    const signingBonus = Math.round((driver.salaryPerRaceDemand || 450000) * 1.5);
    if (bankBalance < signingBonus) {
      setNotificationMsg(`Insufficient funds! Contracting ${driver.name} requires an upfront signing bonus of ${formatMoney(signingBonus)}.`);
      return;
    }

    const updated: CustomTeamConfig = {
      ...season.career.customTeam,
      teammateDriverId: driver.id,
      teammateSalaryPerRace: driver.salaryPerRaceDemand || 450000,
    };

    if (onUpdateCustomTeam) {
      onUpdateCustomTeam(updated, signingBonus);
    }
    setNotificationMsg(
      `FIA DRIVER SIGNING: ${driver.name} has signed as second driver for ${season.career.customTeam.name} (Signing Bonus: -${formatMoney(signingBonus)}, Salary: ${formatMoney(driver.salaryPerRaceDemand || 450000)}/race)!`
    );
  };

  const handleHireChassisEngineer = (chassis: ChassisEngineerOption) => {
    if (!season.career.customTeam) return;
    if (bankBalance < chassis.hiringFee) {
      setNotificationMsg(`Insufficient funds! Hiring ${chassis.name} requires ${formatMoney(chassis.hiringFee)}.`);
      return;
    }

    const updated: CustomTeamConfig = {
      ...season.career.customTeam,
      chassisEngineerId: chassis.id,
      handlingBonus: (season.career.customTeam.handlingBonus || 0) + chassis.handlingBonus,
      chassisEngineerSalary: chassis.salaryPerRace,
    };

    if (onUpdateCustomTeam) {
      onUpdateCustomTeam(updated, chassis.hiringFee);
    }
    setNotificationMsg(
      `CHASSIS SIGNING: ${chassis.name} joined ${season.career.customTeam.name} (+${chassis.handlingBonus} Mechanical Grip & Cornering Rotation)! Deducted ${formatMoney(chassis.hiringFee)}.`
    );
  };

  const handleHireBrakeEngineer = (brakes: BrakeEngineerOption) => {
    if (!season.career.customTeam) return;
    if (bankBalance < brakes.hiringFee) {
      setNotificationMsg(`Insufficient funds! Contracting ${brakes.name} requires ${formatMoney(brakes.hiringFee)}.`);
      return;
    }

    const updated: CustomTeamConfig = {
      ...season.career.customTeam,
      brakesEngineerId: brakes.id,
      brakesBonus: brakes.brakesBonus,
      brakesEngineerSalary: brakes.salaryPerRace,
    };

    if (onUpdateCustomTeam) {
      onUpdateCustomTeam(updated, brakes.hiringFee);
    }
    setNotificationMsg(
      `BRAKE SYSTEMS SIGNING: ${brakes.name} joined ${season.career.customTeam.name} (+${brakes.brakesBonus} Braking Power & Lockup Prevention)! Deducted ${formatMoney(brakes.hiringFee)}.`
    );
  };

  const handleSignSponsor = (sponsor: SponsorOption) => {
    if (!season.career.customTeam) return;
    if (season.career.reputation < sponsor.requiredReputation) {
      setNotificationMsg(`${sponsor.name} requires at least ${sponsor.requiredReputation}% Paddock Reputation to partner with your team.`);
      return;
    }

    const updated: CustomTeamConfig = {
      ...season.career.customTeam,
      sponsorId: sponsor.id,
      sponsorBasePerRace: sponsor.basePayPerRace,
      sponsorWinBonus: sponsor.winBonus,
      sponsorPodiumBonus: sponsor.podiumBonus,
      sponsorPointsBonus: sponsor.pointsBonus,
      baseSponsorPerRace: sponsor.basePayPerRace,
    };

    if (onUpdateCustomTeam) {
      onUpdateCustomTeam(updated);
    }
    setNotificationMsg(
      `COMMERCIAL AGREEMENT: ${sponsor.name} is now Title Sponsor for ${season.career.customTeam.name} (${formatMoney(sponsor.basePayPerRace)}/race guaranteed + up to ${formatMoney(sponsor.winBonus)} win bonus)!`
    );
  };

  const sortedDrivers = React.useMemo(() => {
    const baseList = [...DRIVERS];
    if (
      season.career.customTeam &&
      season.career.customTeam.teammateDriverId === 'rookie_teammate' &&
      !baseList.some((d) => d.id === 'rookie_teammate')
    ) {
      baseList.push(activeTeammateDriver);
    }
    return baseList.sort((a, b) => {
      const ptsA = season.driverPoints[a.id] || 0;
      const ptsB = season.driverPoints[b.id] || 0;
      return ptsB - ptsA;
    });
  }, [season.driverPoints, season.career.customTeam, activeTeammateDriver]);

  const sortedConstructors = React.useMemo(() => {
    const list: Team[] = [...TEAMS];
    if (season.career.customTeam) {
      list.push({
        id: season.career.customTeam.id,
        name: season.career.customTeam.name,
        shortName: season.career.customTeam.shortName,
        engine: season.career.customTeam.engine,
        primaryColor: season.career.customTeam.primaryColor,
        secondaryColor: season.career.customTeam.secondaryColor,
        accentColor: season.career.customTeam.accentColor,
        performanceTier: 1,
        drivers: [season.selectedDriverId, season.career.customTeam.teammateDriverId] as [string, string],
        reputationRequired: 0,
        baseSalary: 850000,
      });
    }
    return list.sort((a, b) => {
      const ptsA = season.constructorPoints[a.id] || 0;
      const ptsB = season.constructorPoints[b.id] || 0;
      return ptsB - ptsA;
    });
  }, [season.constructorPoints, season.career.customTeam, season.selectedDriverId]);

  return (
    <div className="f1-paddock-surface flex flex-col w-full h-full bg-zinc-950 text-zinc-100 overflow-hidden select-none">
      {/* 1. TOP CARRIER STATUS BAR */}
      <header className="h-16 border-b border-white/10 bg-zinc-950/95 px-6 flex items-center justify-between gap-4 shrink-0">
        {/* Left: Driver Profile & Team */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setEditingProfile(true)}
            className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 transition-colors text-left cursor-pointer"
            title="Edit Driver Profile"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-xs font-mono tabular-nums shadow-inner"
              style={{ backgroundColor: playerTeam.primaryColor }}
            >
              #{season.career.driverNumber}
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5 whitespace-nowrap">
                <span>{season.career.driverName}</span>
                <span className="text-[10px] text-zinc-400 font-normal">({season.career.country})</span>
              </div>
              <div className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                {season.career.isUnsignedFreeAgent && !season.career.customTeam ? (
                  <span className="font-black text-red-400 truncate max-w-[180px]">
                    🚨 UNSIGNED FREE AGENT (CUT)
                  </span>
                ) : (
                  <span className="font-semibold text-zinc-300 truncate max-w-[160px]">{playerTeam.name}</span>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Center: Career Metrics */}
        <div className="hidden lg:flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Driver Rating</span>
            <div className="flex items-center gap-1.5 font-mono tabular-nums">
              <span className="text-sm font-black text-purple-400">{driverRating}</span>
              <span className="text-[10px] text-zinc-500">
                {driverRating >= 100 ? 'LEGEND' : 'OVR'}
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-white/10" />

          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Reputation</span>
            <span className="text-sm font-black text-amber-400 font-mono tabular-nums">{season.career.reputation}%</span>
          </div>

          <div className="h-6 w-px bg-white/10" />

          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Bank Balance</span>
            <span className="text-sm font-black text-emerald-400 font-mono tabular-nums">
              {formatMoney(bankBalance)}
            </span>
          </div>

          <div className="h-6 w-px bg-white/10" />

          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Contract Salary</span>
            <span className="text-sm font-black text-cyan-400 font-mono tabular-nums">
              {formatMoney(season.career.currentSalary)}/race
            </span>
          </div>

          <div className="h-6 w-px bg-white/10" />

          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Best Launch Reaction</span>
            <span className="text-sm font-black text-amber-300 font-mono tabular-nums">
              {season.career.bestReactionTimeMs
                ? `${(season.career.bestReactionTimeMs / 1000).toFixed(3)}s (${season.career.bestReactionTimeMs} ms)`
                : '—'}
            </span>
          </div>
        </div>

        {/* Right: Quick Modes, Controller Status & Utilities */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setPracticeSelectedCircuit(currentCircuit);
              setShowPracticeModal(true);
            }}
            className="px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-400/30 cursor-pointer whitespace-nowrap"
            title="Practice on any track without quitting your career"
          >
            <Gauge className="w-3.5 h-3.5 text-amber-400" />
            <span>Free Practice</span>
          </button>

          {onOpenMultiplayer && (
            <button
              onClick={onOpenMultiplayer}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
              title="Join or Host Multiplayer 4-Digit Rooms without quitting Career"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Multiplayer</span>
            </button>
          )}

          {onOpenCareerSlots && (
            <button
              onClick={onOpenCareerSlots}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
              title="Switch between multiple careers or create a new career under your account without quitting"
            >
              <FolderKanban className="w-3.5 h-3.5 text-amber-400" />
              <span>{activeCareerSlotName}</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-500/25 text-amber-200 font-mono text-[10px]">
                {careerSlotsCount}
              </span>
            </button>
          )}

          {onOpenCloud && (
            <button
              onClick={onOpenCloud}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              title="Firebase Cloud Save & Global Circuit Leaderboards"
            >
              <Cloud className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Cloud Save</span>
            </button>
          )}

          {onOpenControls && (
            <button
              onClick={onOpenControls}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              title="Custom Button Mapping (Keyboard & Gamepad)"
            >
              <Keyboard className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Controls</span>
            </button>
          )}

          {onOpenTutorial && (
            <button
              onClick={onOpenTutorial}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              title="FIA Academy & Gameplay Tutorial Guide"
            >
              <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden xl:inline">Guide</span>
            </button>
          )}

          {isGamepadConnected && (
            <button
              onClick={onTestRumble}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              title="Controller Connected — Click to test rumble"
            >
              <Gamepad className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Pad</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. STRUCTURED NAVIGATION PILLARS & SUB-TABS */}
      <div className="bg-zinc-900/95 border-b border-white/10 shrink-0">
        {/* Tier 1: 4 Major Pillar Tabs */}
        <div className="h-11 px-4 sm:px-6 flex items-center justify-between gap-3 border-b border-white/5 bg-zinc-950/60 overflow-x-auto">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Pillar 1: Racing & City Drive */}
            <button
              onClick={() => {
                if (activeTab !== 'weekend' && activeTab !== 'metrocity') {
                  setActiveTab('weekend');
                }
              }}
              className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'weekend' || activeTab === 'metrocity'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <span className="text-sm">🏁</span>
              <span>RACING & CITY DRIVE</span>
              {activeTab === 'metrocity' && (
                <span className="px-1.5 py-0.2 rounded bg-sky-400 text-black text-[9px] font-mono font-black">
                  CITY
                </span>
              )}
            </button>

            {/* Pillar 2: Career & Team Management */}
            <button
              onClick={() => {
                if (activeTab !== 'myteam' && activeTab !== 'contracts' && activeTab !== 'calendar' && activeTab !== 'offseason') {
                  setActiveTab('myteam');
                }
              }}
              className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'myteam' || activeTab === 'contracts' || activeTab === 'calendar' || activeTab === 'offseason'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <span className="text-sm">🏎️</span>
              <span>CAREER & TEAM</span>
              {activeIncomingOffers.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-black font-black text-[10px]">
                  {activeIncomingOffers.length}
                </span>
              )}
            </button>

            {/* Pillar 3: Standings & Analytics */}
            <button
              onClick={() => {
                if (activeTab !== 'standings' && activeTab !== 'analytics' && activeTab !== 'records') {
                  setActiveTab('standings');
                }
              }}
              className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'standings' || activeTab === 'analytics' || activeTab === 'records'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <span className="text-sm">📊</span>
              <span>STANDINGS & STATS</span>
            </button>

            {/* Pillar 4: News & Updates */}
            <button
              onClick={() => {
                if (activeTab !== 'newsfeed' && activeTab !== 'patchnotes' && activeTab !== 'devnotes' && activeTab !== 'bugreports') {
                  setActiveTab('newsfeed');
                }
              }}
              className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'newsfeed' || activeTab === 'patchnotes' || activeTab === 'devnotes' || activeTab === 'bugreports'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <span className="text-sm">📰</span>
              <span>PADDOCK & SYSTEM</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Interactive Multi-Theme Switcher (Light, Dark, Papaya, Rosso, Emerald) */}
            <div className="flex items-center gap-0.5 bg-zinc-950 border border-white/10 rounded-lg p-1 shadow-inner">
              <Palette className="w-3.5 h-3.5 text-orange-400 mx-1 shrink-0" />
              {THEME_OPTIONS.map((tId) => {
                const meta = APP_THEMES[tId];
                const isSelected = appTheme === tId;
                return (
                  <button
                    key={tId}
                    type="button"
                    onClick={() => handleChangeTheme(tId)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                      isSelected
                        ? tId === 'light'
                          ? 'bg-amber-400 text-black shadow-sm'
                          : tId === 'papaya'
                          ? 'bg-orange-500 text-black shadow-sm'
                          : tId === 'rosso'
                          ? 'bg-red-600 text-white shadow-sm'
                          : tId === 'emerald'
                          ? 'bg-emerald-500 text-black shadow-sm'
                          : 'bg-sky-400 text-black shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title={meta.description}
                  >
                    {tId === 'light' ? (
                      <Sun className="w-2.5 h-2.5" />
                    ) : tId === 'dark' ? (
                      <Moon className="w-2.5 h-2.5" />
                    ) : (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: meta.badgeColor }}
                      />
                    )}
                    <span>{meta.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Live FPS Counter */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950 border border-white/10 font-mono text-[11px] font-bold tabular-nums"
              title="Live Frame Rate (FPS)"
            >
              <span
                className={
                  hubFps >= 55
                    ? 'text-emerald-400'
                    : hubFps >= 40
                    ? 'text-amber-400'
                    : 'text-red-400'
                }
              >
                {hubFps} FPS
              </span>
            </div>

            {/* Graphics Quality Preset Selector */}
            <div className="hidden 2xl:flex items-center gap-0.5 bg-zinc-950 border border-white/10 rounded-lg p-1">
              {GRAPHICS_QUALITY_OPTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleChangeGraphicsQuality(q)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    graphicsQuality === q
                      ? q === 'ultra'
                        ? 'bg-amber-500 text-black'
                        : q === 'dynamic_conservative'
                        ? 'bg-emerald-400 text-black'
                        : q === 'dynamic_aggressive'
                        ? 'bg-cyan-400 text-black'
                        : 'bg-white text-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title={GRAPHICS_PRESET_LABELS[q].subtitle}
                >
                  {GRAPHICS_PRESETS[q].hudButtonLabel}
                </button>
              ))}
            </div>

            {/* MPH / KM/H Toggle */}
            <button
              type="button"
              onClick={toggleUnits}
              className="text-xs font-mono font-bold text-zinc-200 hover:text-white bg-zinc-950 hover:bg-zinc-800 border border-white/10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              title="Switch between American (MPH / Miles / °F) and Metric (KM/H / KM / °C)"
            >
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              <span>{unitSystem === 'imperial' ? 'MPH' : 'KM/H'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowResetStandingsModal(true)}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer whitespace-nowrap"
              title="Reset current 10-race calendar standings"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline">Reset</span>
            </button>

            <button
              type="button"
              onClick={() => setShowQuitCareerModal(true)}
              className="text-xs text-red-400 hover:text-white hover:bg-red-600/30 border border-red-500/30 flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors font-semibold cursor-pointer whitespace-nowrap"
              title="Quit active career to choose a new AI difficulty"
            >
              <Lock className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden 2xl:inline">Quit</span>
            </button>
          </div>
        </div>

        {/* Tier 2: Sub-Navigation Ribbon (Contextual for the active pillar) */}
        <div className="h-10 px-4 sm:px-6 flex items-center gap-1.5 overflow-x-auto bg-zinc-900/60">
          {(activeTab === 'weekend' || activeTab === 'metrocity') && (
            <>
              <button
                onClick={() => setActiveTab('weekend')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'weekend'
                    ? 'bg-zinc-800 text-white border border-white/20'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                }`}
              >
                <Play className="w-3.5 h-3.5 text-red-500" />
                <span>Race Weekend (Grand Prix & Practice)</span>
              </button>

              <button
                onClick={() => {
                  setCitySave(loadMetroCitySave());
                  setActiveTab('metrocity');
                }}
                className={`px-3 py-1 text-xs font-black rounded-md transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'metrocity'
                    ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md ring-1 ring-sky-300'
                    : 'bg-sky-500/15 text-sky-300 border border-sky-400/30 hover:bg-sky-500/25 hover:text-white'
                }`}
              >
                <span>🌆 Metro City Open World</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-400 text-black font-mono font-black text-[9px]">
                  {citySave.ownedCarIds.length}/{CITY_STREET_CARS.length} CARS
                </span>
                <span className="px-1.5 py-0.2 rounded bg-teal-400 text-black font-mono font-black text-[9px]">
                  {citySave.ownedHouseIds.length}/5 HOMES
                </span>
              </button>
            </>
          )}

          {(activeTab === 'myteam' || activeTab === 'contracts' || activeTab === 'calendar' || activeTab === 'offseason') && (
            <>
              <button
                onClick={() => setActiveTab('myteam')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'myteam'
                    ? 'bg-zinc-800 text-white border border-white/20'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-sky-400" />
                <span>My Team HQ</span>
              </button>

              <button
                onClick={() => setActiveTab('contracts')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'contracts'
                    ? 'bg-zinc-800 text-white border border-white/20'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                <span>Contracts & Market</span>
                {activeIncomingOffers.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-black font-black text-[9px]">
                    {activeIncomingOffers.length} OFFERS
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('calendar')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'calendar'
                    ? 'bg-zinc-800 text-white border border-white/20'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Season Calendar</span>
              </button>

              <button
                onClick={() => setActiveTab('offseason')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'offseason'
                    ? 'bg-amber-500 text-black font-black'
                    : season.seasonFinished
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                }`}
              >
                <Wind className="w-3.5 h-3.5 text-amber-400" />
                <span>{season.seasonFinished ? 'Off-Season Hub (Active)' : 'Off-Season Gala'}</span>
              </button>
            </>
          )}

          {(activeTab === 'standings' || activeTab === 'analytics' || activeTab === 'records') && (
            <>
              <button
                onClick={() => setActiveTab('standings')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'standings'
                    ? 'bg-zinc-800 text-white border border-white/20'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                }`}
              >
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>Championship Standings</span>
              </button>

              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'analytics'
                    ? 'bg-zinc-800 text-white border border-white/20'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-teal-400" />
                <span>Telemetry Analytics</span>
              </button>

              <button
                onClick={() => setActiveTab('records')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'records'
                    ? 'bg-zinc-800 text-white border border-white/20'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-purple-400" />
                <span>All-Time Lap Records</span>
              </button>
            </>
          )}

          {(activeTab === 'newsfeed' || activeTab === 'patchnotes' || activeTab === 'devnotes' || activeTab === 'bugreports') && (
            <>
              <button
                onClick={() => setActiveTab('newsfeed')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'newsfeed'
                    ? 'bg-zinc-800 text-white border border-white/20'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                }`}
              >
                <Newspaper className="w-3.5 h-3.5 text-sky-400" />
                <span>Paddock Newsfeed</span>
              </button>

              <button
                onClick={() => setActiveTab('patchnotes')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'patchnotes'
                    ? 'bg-zinc-800 text-white border border-white/20'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Updates & Patch Notes</span>
              </button>

              <button
                onClick={() => setActiveTab('devnotes')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'devnotes'
                    ? 'bg-zinc-800 text-white border border-white/20'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>Developer Notes</span>
              </button>

              <button
                onClick={() => setActiveTab('bugreports')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'bugreports'
                    ? 'bg-zinc-800 text-white border border-white/20'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                }`}
              >
                <Bug className="w-3.5 h-3.5 text-rose-400" />
                <span>Feedback & Ideas</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Active Off-Season Banner & Championship Confetti when Season is Finished */}
      {season.seasonFinished && (
        <>
          {(sortedDrivers[0]?.id === season.selectedDriverId ||
            sortedConstructors[0]?.id === playerTeam.id) && (
            <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
              {Array.from({ length: 65 }).map((_, i) => {
                const colors = ['#fbbf24', '#ef4444', '#10b981', '#38bdf8', '#a855f7', '#ffffff', '#f97316'];
                const leftPct = (i * 14.3) % 100;
                const delaySec = (i % 14) * 0.22;
                const durationSec = 2.8 + (i % 6) * 0.5;
                const widthPx = 7 + (i % 4) * 2;
                const heightPx = 12 + (i % 4) * 3;
                return (
                  <div
                    key={i}
                    className="absolute -top-6 rounded-sm opacity-90"
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPx}px`,
                      height: `${heightPx}px`,
                      backgroundColor: colors[i % colors.length],
                      transform: `rotate(${(i * 53) % 360}deg)`,
                      animation: `hubConfettiFall ${durationSec}s linear ${delaySec}s infinite`,
                    }}
                  />
                );
              })}
              <style>{`
                @keyframes hubConfettiFall {
                  0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
                  80% { opacity: 0.9; }
                  100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
                }
              `}</style>
            </div>
          )}
          <div className="bg-amber-500/15 border-b border-amber-400/40 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-white font-bold">
                SEASON {season.career.seasonNumber || 1} COMPLETE — WELCOME TO THE FIA WINTER OFF-SEASON!
              </span>
              <span className="text-neutral-300">
                Read post-season F1 media recaps, run Winter R&D upgrades, or start Season {(season.career.seasonNumber || 1) + 1}.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('offseason')}
                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-[11px] cursor-pointer"
              >
                Open Off-Season Hub
              </button>
              <button
                onClick={() => setActiveTab('newsfeed')}
                className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-[11px] cursor-pointer"
              >
                Post-Season Media Wire
              </button>
            </div>
          </div>
        </>
      )}

      {/* Notifications Banner */}
      {notificationMsg && (
        <div className="bg-emerald-950/80 border-b border-emerald-500/30 px-6 py-2 flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>{notificationMsg}</span>
          </div>
          <button onClick={() => setNotificationMsg(null)} className="text-emerald-400 hover:text-white font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* 3. MAIN TAB CONTENT CONTAINER */}
      <main className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto">
        {/* TAB 1: RACE WEEKEND */}
        {activeTab === 'weekend' && (
          <div className="flex flex-col gap-5">
            <BreakingNewsTicker season={season} onOpenNewsfeed={() => setActiveTab('newsfeed')} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Grand Prix Details Card */}
            <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between gap-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-3 py-1 bg-red-600/20 text-red-400 border border-red-500/30 rounded-full text-xs font-bold uppercase tracking-wider">
                    Round {season.currentRound + 1} of {CIRCUITS.length}
                  </span>
                  <span className="text-xs font-mono text-neutral-400">
                    FIA Formula 1 World Championship · Season {season.career.seasonNumber || 1}
                  </span>
                </div>
                <h1 className="text-3xl font-black text-white tracking-wide">{currentCircuit.name}</h1>
                <p className="text-sm text-neutral-400 font-semibold">{currentCircuit.location}, {currentCircuit.country}</p>
                <p className="text-sm text-neutral-300 mt-2 leading-relaxed">{currentCircuit.description}</p>

                {/* Official Circuit Layout Outline Preview */}
                <div className="bg-neutral-950/80 rounded-xl p-3 border border-white/5 my-3">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1 px-1">
                    <span className="flex items-center gap-1.5 text-red-400">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      Official FIA Circuit Geometry Layout
                    </span>
                    <span className="font-mono text-neutral-500">
                      {currentCircuit.turns} Corners • Direction ➔ • Start Line ▌
                    </span>
                  </div>
                  <TrackLayoutPreview
                    circuit={currentCircuit}
                    height={190}
                    strokeColor="#ef4444"
                    strokeWidth={3.5}
                    showStartFinish={true}
                    showDirection={true}
                    showTurnLabels={true}
                  />
                </div>
              </div>

              {/* Circuit Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-neutral-950/70 p-4 rounded-xl border border-white/5">
                <div>
                  <span className="text-[10px] uppercase font-bold text-neutral-400">Circuit Length</span>
                  <p className="text-base font-black text-white">{formatDistance(currentCircuit.lengthKm, unitSystem)}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-neutral-400">Turns</span>
                  <p className="text-base font-black text-white">{currentCircuit.turns} Corners</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-neutral-400">Lap Record</span>
                  <p className="text-base font-mono font-bold text-purple-400">{currentCircuit.lapRecord}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-neutral-400">Record Holder</span>
                  <p className="text-xs font-semibold text-neutral-300 truncate">{currentCircuit.recordHolder}</p>
                </div>
              </div>

              {/* CPU AI Difficulty - Locked for Active Career */}
              <div className="flex flex-col gap-2 p-3.5 bg-neutral-950/80 rounded-xl border border-neutral-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400" />
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                      Career AI Difficulty & Regulations
                    </label>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-300 uppercase px-2.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-amber-400" />
                    <span>{season.difficulty.toUpperCase()} (LOCKED)</span>
                  </span>
                </div>
                <div className="text-xs text-neutral-400 leading-relaxed">
                  {season.difficulty === 'rookie' ? (
                    <span>
                      <strong>Rookie Mode:</strong> 0.80x AI pace, 2.0s stall penalty on collision. Forgiving cornering and soft braking.
                    </span>
                  ) : season.difficulty === 'legend' ? (
                    <span>
                      <strong>Legend Simulation:</strong> 1.14x-1.18x ferocious AI pace, 5.0s stall penalty on collision. Verstappen & Norris push to the absolute edge with razor-sharp braking.
                    </span>
                  ) : (
                    <span>
                      <strong>Pro Standard:</strong> 0.89x authentic F1 pace, 3.5s stall penalty on collision. Realistic grid battles and slipstream overtaking.
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-neutral-900 text-[11px]">
                  <span className="text-neutral-500 font-mono">
                    Difficulty is locked for your active career.
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowQuitCareerModal(true)}
                    className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>Quit Career to Change</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* 3D Graphics Quality Selector (Conservative Dynamic, Aggressive Dynamic, Low -> Ultra Realistic) */}
              <div className="flex flex-col gap-2 p-3.5 bg-neutral-950/80 rounded-xl border border-neutral-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                      3D Engine Graphics Quality Preset (Uncapped FPS)
                    </label>
                  </div>
                  <span className="text-xs font-mono text-amber-400 font-bold">
                    {GRAPHICS_PRESET_LABELS[graphicsQuality].label}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  {GRAPHICS_PRESET_LABELS[graphicsQuality].subtitle}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {GRAPHICS_QUALITY_OPTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleChangeGraphicsQuality(q)}
                      className={`py-2 px-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer border ${
                        graphicsQuality === q
                          ? q === 'ultra'
                            ? 'bg-amber-500 text-black border-amber-300 shadow-md'
                            : q === 'retro'
                            ? 'bg-[#ff2a85] text-white border-[#00f0ff] shadow-md'
                            : q === 'retro_pixel'
                            ? 'bg-purple-600 text-white border-cyan-300 shadow-md'
                            : q === 'dynamic_conservative'
                            ? 'bg-emerald-500 text-black border-emerald-300 shadow-md'
                            : q === 'dynamic_aggressive'
                            ? 'bg-cyan-500 text-black border-cyan-300 shadow-md'
                            : 'bg-red-600 text-white border-red-400 shadow-md'
                          : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                      }`}
                    >
                      {GRAPHICS_PRESET_LABELS[q].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Motion Blur Optimization Setting */}
              <div className="flex flex-col gap-2 p-3.5 bg-neutral-950/80 rounded-xl border border-neutral-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">💨</span>
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                      Motion Blur (Speed Flow & Frame Rate Optimization)
                    </label>
                  </div>
                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                      motionBlurEnabled
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-400/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/30'
                    }`}
                  >
                    {motionBlurEnabled ? 'ON (Cinematic Streaks)' : 'OFF (Optimized for Max FPS)'}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  {motionBlurEnabled
                    ? 'Generates high-speed radial velocity blur along your vehicle travel vector for a dramatic cinematic sensation of speed. Runs on GPU shader.'
                    : 'Completely disables screen-space motion blur passes, bypassing post-processing shaders to maximize framerate (FPS) and reduce GPU load on lower-spec hardware.'}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleToggleMotionBlur(true)}
                    className={`py-2 px-3 rounded-lg font-bold text-xs transition-all cursor-pointer border flex items-center justify-center gap-2 ${
                      motionBlurEnabled
                        ? 'bg-sky-600 text-white border-sky-400 shadow-md shadow-sky-950/40 ring-1 ring-sky-400'
                        : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-sky-300" />
                    <span>Enabled (Cinematic Blur)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleMotionBlur(false)}
                    className={`py-2 px-3 rounded-lg font-bold text-xs transition-all cursor-pointer border flex items-center justify-center gap-2 ${
                      !motionBlurEnabled
                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-400'
                        : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-300" />
                    <span>Disabled (Optimized / Max FPS)</span>
                  </button>
                </div>
              </div>

              {/* Lap Count Selector (3 - 10 laps) */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                    Grand Prix Race Distance (Laps)
                  </label>
                  <span className="text-xs font-mono text-amber-400">{selectedLaps} Laps ({(selectedLaps * currentCircuit.lengthKm).toFixed(1)} km)</span>
                </div>
                <div className="grid grid-cols-8 gap-2">
                  {[3, 4, 5, 6, 7, 8, 9, 10].map((laps) => (
                    <button
                      key={laps}
                      onClick={() => setSelectedLaps(laps)}
                      className={`py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        selectedLaps === laps
                          ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 ring-2 ring-red-400'
                          : 'bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700'
                      }`}
                    >
                      {laps} LAPS
                    </button>
                  ))}
                </div>
              </div>

              {/* Starting Pirelli Tire Composition & Stint Strategy Selector */}
              <div className="flex flex-col gap-2.5 p-3.5 bg-neutral-950/85 rounded-xl border border-neutral-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-red-500" />
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                      Starting Pirelli Tire Composition & Stint Strategy
                    </label>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {TIRE_COMPOUND_SPECS[startingTireCompound].label} · Ideal Stint: {TIRE_COMPOUND_SPECS[startingTireCompound].idealStintLaps}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Tire composition and health directly govern cornering bite, braking distance, top speed, and pit stop windows. You can also swap compounds mid-race in the Pit Box (<kbd className="px-1 py-0.5 bg-neutral-800 text-neutral-200 rounded font-mono text-[10px]">[P]</kbd>).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  {(['SOFT', 'MEDIUM', 'HARD'] as const).map((comp) => {
                    const spec = TIRE_COMPOUND_SPECS[comp];
                    const isSelected = startingTireCompound === comp;
                    return (
                      <button
                        key={comp}
                        type="button"
                        onClick={() => {
                          setStartingTireCompound(comp);
                          setStoredStartingTireCompound(comp);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                          isSelected
                            ? comp === 'SOFT'
                              ? 'bg-red-950/60 border-red-500 ring-1 ring-red-400/60 shadow-lg'
                              : comp === 'MEDIUM'
                              ? 'bg-amber-950/50 border-amber-400 ring-1 ring-amber-300/60 shadow-lg'
                              : 'bg-zinc-800/90 border-slate-200 ring-1 ring-white/60 shadow-lg'
                            : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700 opacity-85 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-6 h-6 rounded-full border-2 bg-zinc-950 flex items-center justify-center font-black font-mono text-xs ${
                                comp === 'SOFT'
                                  ? 'border-red-500 text-red-500'
                                  : comp === 'MEDIUM'
                                  ? 'border-amber-400 text-amber-400'
                                  : 'border-slate-200 text-slate-100'
                              }`}
                            >
                              {spec.shortCode}
                            </span>
                            <span className="text-xs font-black text-white">{spec.label}</span>
                          </div>
                          {isSelected && (
                            <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              FITTED
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-neutral-300 mt-0.5">
                          <span>Grip: {Math.round((spec.baseGripMultiplier || 1) * 100)}%</span>
                          <span>Wear: {spec.wearRateMultiplier}x</span>
                          <span>Stint: {spec.idealStintLaps}</span>
                        </div>
                        <p className="text-[10px] text-neutral-400 leading-snug">
                          {spec.summary}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Transmission Gearbox Selector: Automatic (with F/V Force Shift) vs Full Manual */}
              <div className="p-3.5 rounded-xl bg-neutral-950/90 border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      Gearbox Transmission Mode
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    {isManualGearMode
                      ? 'Full Manual: Automatic shifting is off — shift manually with [F] (Up) and [V] (Down).'
                      : 'Automatic (+ Force Shift): Shifts automatically AND lets you force-shift up/down anytime with [F] and [V]!'}
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-xl border border-neutral-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleGearboxMode(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      !isManualGearMode
                        ? 'bg-emerald-500 text-black font-black'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Automatic (+ F/V Shift)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleGearboxMode(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      isManualGearMode
                        ? 'bg-amber-500 text-black font-black'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Manual Only
                  </button>
                </div>
              </div>

              {season.seasonFinished ? (
                <div className="p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-400/50 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                      <Trophy className="w-4 h-4" />
                      <span>
                        Season {season.career.seasonNumber || 1} Complete — Mandatory Off-Season Duties ({completedMandatoryCount}/3 Done)
                      </span>
                    </span>
                    <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded bg-black/60 text-amber-300 border border-amber-400/30">
                      {canLaunchNextSeason ? 'READY FOR NEXT SEASON' : 'ACTION REQUIRED'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-200 leading-relaxed">
                    You cannot start Season {(season.career.seasonNumber || 1) + 1} right away! Per FIA regulations, you must complete your{' '}
                    <strong className="text-white">Post-Season Press Conference Interviews</strong>, attend the{' '}
                    <strong className="text-white">FIA Prize Giving Gala</strong>, and finish your{' '}
                    <strong className="text-white">Pre-Season Simulator Shakedown</strong> in the Off-Season Hub first.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                    <button
                      onClick={() => setActiveTab('offseason')}
                      className="flex-1 w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-sm uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Wind className="w-4 h-4" />
                      <span>
                        Open Off-Season Hub ({completedMandatoryCount}/3 Duties Completed)
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setPracticeSelectedCircuit(currentCircuit);
                        setShowPracticeModal(true);
                      }}
                      className="w-full sm:w-auto px-5 py-3.5 bg-neutral-800 hover:bg-neutral-700 text-amber-300 font-black text-xs uppercase tracking-wider rounded-xl border border-amber-400/30 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Gauge className="w-4 h-4 text-amber-400" />
                      <span>Winter Practice</span>
                    </button>
                  </div>
                </div>
              ) : season.career.isUnsignedFreeAgent && !season.career.customTeam ? (
                <div className="p-5 rounded-2xl bg-red-950/50 border-2 border-red-500/80 flex flex-col gap-3 shadow-xl shadow-red-950/40">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-400 shrink-0 mt-0.5 animate-bounce" />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-red-500 text-black font-mono font-black text-[10px] uppercase">
                          🚨 NO RACE SEAT — CUT FROM PROVE-IT CONTRACT ({season.career.proveItCutCount || 1}x CUT)
                        </span>
                        {season.career.lastCutByTeamName && (
                          <span className="text-xs font-mono text-red-300">
                            Terminated by: <strong>{season.career.lastCutByTeamName}</strong>
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-black text-white mt-1">
                        You Cannot Enter Qualifying or the Grand Prix Without a Team!
                      </h4>
                      <p className="text-xs text-red-200/90 mt-1 leading-relaxed">
                        {season.career.lastProveItCutNotice?.message ||
                          'You underperformed on a high-risk Prove-It contract and were immediately cut! Go to the Contracts & Teams tab to see if any backmarker team offered you a low-money lifeline—or try a Walk-On Tryout if nobody signed you.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('contracts')}
                      className="px-5 py-3 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg cursor-pointer flex items-center gap-2"
                    >
                      <Briefcase className="w-4 h-4" />
                      <span>Go to Contracts & Teams to Find a Seat</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* High-Risk Prove-It Contract Warning Banner on Race Weekend */}
                  {season.career.isOnProveItContract && !season.career.customTeam && (
                    <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-mono font-black uppercase tracking-wider text-amber-300 block">
                            ⚠️ HIGH-RISK PROVE-IT CONTRACT CLAUSE ({playerTeam.name})
                          </span>
                          <p className="text-[11px] text-neutral-200 mt-0.5">
                            You must finish <strong className="text-amber-300">P{playerTeam.performanceTier === 1 ? 10 : playerTeam.performanceTier === 2 ? 13 : 15} or better</strong> in this race! Even <strong className="text-red-400">ONE bad race</strong> on a Prove-It deal can get you immediately cut and left unsigned or forced onto a worse backmarker team.
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 font-mono font-black text-[10px] uppercase whitespace-nowrap self-start sm:self-center">
                        Target: P{playerTeam.performanceTier === 1 ? 10 : playerTeam.performanceTier === 2 ? 13 : 15}+ or Risk Cut
                      </span>
                    </div>
                  )}

                  {/* Qualifying & Grid Position Indicator + Ghost Car 3s Delay Option */}
                  <div className="p-3.5 rounded-xl bg-neutral-950/90 border border-neutral-800 flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${qualifyingGridSlot ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-neutral-800 text-neutral-400'}`}>
                          {qualifyingGridSlot ? `P${qualifyingGridSlot}` : 'Q'}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-2">
                            <span>Qualifying Session (1 Flying Lap)</span>
                            {qualifyingGridSlot && (
                              <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-mono font-bold border border-purple-400/30">
                                {qualifyingGridSlot === 1 ? '👑 POLE POSITION' : `STARTING P${qualifyingGridSlot}`}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-neutral-400 mt-0.5">
                            {qualifyingGridSlot
                              ? `You qualified P${qualifyingGridSlot}. You can re-qualify or proceed directly to Grand Prix.`
                              : 'Optional: Complete 1 fast flying lap to determine your Grand Prix starting grid slot!'}
                          </p>
                        </div>
                      </div>

                      {onStartQualifying && (
                        <button
                          onClick={() => onStartQualifying(qualifyingGhostDelay3s)}
                          className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-lg shadow-md shadow-purple-950/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Timer className="w-4 h-4 text-purple-200" />
                          <span>{qualifyingGridSlot ? 'RE-QUALIFY' : 'START QUALIFYING'}</span>
                        </button>
                      )}
                    </div>

                    {/* Ghost Cars 3-Second Delay Option */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2.5 border-t border-white/10">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-300">
                          Qualifying Ghost Cars:
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {qualifyingGhostDelay3s
                            ? 'Ghost cars come in 3 seconds late so your start view is clear'
                            : 'Ghost cars appear immediately at 0s alongside you at the start'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 bg-neutral-900 border border-white/10 rounded-lg p-1 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => onChangeQualifyingGhostDelay3s?.(true)}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold transition-colors cursor-pointer whitespace-nowrap ${
                            qualifyingGhostDelay3s
                              ? 'bg-purple-500 text-white shadow'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          3s Late (Clear Start)
                        </button>
                        <button
                          type="button"
                          onClick={() => onChangeQualifyingGhostDelay3s?.(false)}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold transition-colors cursor-pointer whitespace-nowrap ${
                            !qualifyingGhostDelay3s
                              ? 'bg-purple-500 text-white shadow'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          Instant (0s Delay)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Launch Race, Practice & Open-Field Car Test Buttons */}
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <button
                      onClick={() => onStartRace(selectedLaps)}
                      className="flex-1 w-full py-4 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-black text-base md:text-lg tracking-wider uppercase rounded-xl shadow-xl shadow-red-600/25 transition-all transform active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Play className="w-5 h-5 fill-white" />
                      <span>
                        START GRAND PRIX {qualifyingGridSlot ? `(P${qualifyingGridSlot})` : ''}
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        setPracticeSelectedCircuit(currentCircuit);
                        setShowPracticeModal(true);
                      }}
                      className="w-full sm:w-auto px-5 py-4 bg-neutral-800 hover:bg-neutral-750 text-amber-300 hover:text-white font-black text-sm tracking-wider uppercase rounded-xl border border-amber-400/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Gauge className="w-5 h-5 text-amber-400" />
                      <span>FREE PRACTICE</span>
                    </button>

                    {onStartPractice && (
                      <>
                        <button
                          onClick={() => onStartPractice(CITY_DRIVING_METRO_CIRCUIT, 99, season.difficulty, 0)}
                          className="w-full sm:w-auto px-5 py-4 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-black text-sm tracking-wider uppercase rounded-xl border border-sky-400/40 shadow-lg shadow-sky-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                          title="Drive around a 7x7 Downtown City Grid with 49 Red/Yellow/Green traffic light intersections, civilian traffic, and active Police Interceptor pursuits"
                        >
                          <span>🏙️ CITY DRIVING & COPS</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowGoogleMapsModal(true)}
                          className="w-full sm:w-auto px-5 py-4 bg-gradient-to-r from-cyan-600 to-sky-700 hover:from-cyan-500 hover:to-sky-600 text-white font-black text-sm tracking-wider uppercase rounded-xl border border-cyan-400/40 shadow-lg shadow-cyan-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                          title="Explore Maryland on real Google Maps, search addresses, view live traffic & calculate routes"
                        >
                          <span>🗺️ GOOGLE MAPS</span>
                        </button>
                        <button
                          onClick={() => onStartPractice(OPEN_FIELD_PROVING_GROUND_CIRCUIT, 99, season.difficulty, 0)}
                          className="w-full sm:w-auto px-5 py-4 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-sm tracking-wider uppercase rounded-xl border border-emerald-400/40 shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                          title="Drive forever on an infinitely long and wide 100% Racing Road Tarmac Arena, Endless Highway, G-Force Skidpad & Braking Strip"
                        >
                          <span>TEST CAR (INFINITE ROAD)</span>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Metro City Driving & Police Pursuit + Infinite Road Proving Ground Cards */}
                  {onStartPractice && (
                    <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div className="bg-neutral-900 border border-sky-500/35 rounded-xl p-4 flex flex-col justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-mono text-sky-400">
                            <span>Metro City Sandbox</span>
                            <span>·</span>
                            <span className="font-bold text-white">
                              City Driving, Traffic Lights & Police Pursuit
                            </span>
                          </div>
                          <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                            Cruise or blast through a <strong className="text-sky-300">7×7 Downtown City Street Grid</strong> with <strong className="text-emerald-300">49 active Red/Yellow/Green traffic light intersections</strong> and <strong className="text-amber-300">28 civilian traffic cars</strong> that obey signals. Run a red light or crash into traffic and <strong className="text-red-400">Metro Police Interceptors</strong> will activate their sirens and chase you (<strong className="text-amber-300">★ 1–5 Wanted Heat</strong>)!
                          </p>
                        </div>
                        <button
                          onClick={() => onStartPractice(CITY_DRIVING_METRO_CIRCUIT, 99, season.difficulty, 0)}
                          className="self-start px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-sky-500/20 transition-all cursor-pointer whitespace-nowrap"
                        >
                          Enter Metro City Driving →
                        </button>
                      </div>

                      <div className="bg-neutral-900 border border-emerald-500/30 rounded-xl p-4 flex flex-col justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                            <span>Infinite 360° Road Sandbox</span>
                            <span>·</span>
                            <span className="font-bold text-white">
                              Infinite Full-Road Car Testing & R&D Dyno
                            </span>
                          </div>
                          <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                            Test your car on an <strong className="text-emerald-300">infinitely long and wide 100% high-grip racing road tarmac</strong> with zero walls or speed limiters, an <strong className="text-cyan-300">endless multi-lane top-speed highway</strong>, automatic <strong className="text-amber-300">0–100 / 0–200 / 0–300 km/h, 100–200 roll, 1/4 mile & 100–0 braking distance</strong> timers, and live 4-spec R&D comparison.
                          </p>
                        </div>
                        <button
                          onClick={() => onStartPractice(OPEN_FIELD_PROVING_GROUND_CIRCUIT, 99, season.difficulty, 0)}
                          className="self-start px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer whitespace-nowrap"
                        >
                          Launch Infinite Road Test →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Current Team & Driver Card */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between gap-6">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-neutral-400">Active Contract</span>
                <div className="flex items-center gap-3 mt-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white" style={{ backgroundColor: playerTeam.primaryColor }}>
                    {playerTeam.shortName.substring(0, 3)}
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-white leading-tight">{playerTeam.name}</h3>
                    <p className="text-xs text-neutral-400 font-mono">PU: {playerTeam.engine}</p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <div className="flex justify-between text-xs py-2 border-b border-neutral-800">
                    <span className="text-neutral-400">Driver Seat:</span>
                    <span className="font-bold text-white">#{season.career.driverNumber} {season.career.driverName}</span>
                  </div>
                  <div className="flex justify-between text-xs py-2 border-b border-neutral-800">
                    <span className="text-neutral-400">Teammate:</span>
                    <span className="font-bold text-neutral-300">
                      {activeTeammateDriver.name}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs py-2 border-b border-neutral-800">
                    <span className="text-neutral-400">Contract Salary:</span>
                    <span className="font-bold text-cyan-400">{formatMoney(season.career.currentSalary)} / race</span>
                  </div>
                  <div className="flex justify-between text-xs py-2 border-b border-neutral-800">
                    <span className="text-neutral-400">Career Wins:</span>
                    <span className="font-bold text-amber-400">{season.career.wins}</span>
                  </div>
                  <div className="flex justify-between text-xs py-2 border-b border-neutral-800">
                    <span className="text-neutral-400">Career Podiums:</span>
                    <span className="font-bold text-amber-400">{season.career.podiums}</span>
                  </div>
                  <div className="flex justify-between text-xs py-2">
                    <span className="text-neutral-400">Career Points:</span>
                    <span className="font-bold text-purple-400">{careerPoints} PTS</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-neutral-950 rounded-xl border border-white/5 text-xs text-neutral-400 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white uppercase text-[10px] tracking-wider">Driver Controls</span>
                  {onOpenControls && (
                    <button
                      onClick={onOpenControls}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer"
                    >
                      Custom Mapping
                    </button>
                  )}
                </div>
                <span>• Throttle: <strong className="text-white">W / Up / RT Trigger</strong></span>
                <span>• Brake: <strong className="text-white">S / Down / LT Trigger</strong></span>
                <span>• Steer: <strong className="text-white">A, D / Left, Right / Stick</strong></span>
                <span>• DRS / Boost: <strong className="text-white">E / Space / A Button</strong></span>
                <span>• Change Camera: <strong className="text-white">C / Y Button</strong></span>

                {/* Option on the side to join multiplayer without quitting career */}
                {onOpenMultiplayer && (
                  <button
                    onClick={onOpenMultiplayer}
                    className="mt-2 py-2 px-3 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-red-950/40 transition-all cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Join / Host Multiplayer</span>
                  </button>
                )}
              </div>

              {/* Start Reaction Time Records Card */}
              <div className="p-4 bg-neutral-950 rounded-xl border border-amber-500/30 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-white">
                      Start Reaction Time Records
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400 font-bold">
                    5-LIGHTS LAUNCH
                  </span>
                </div>

                {(() => {
                  const allRecords = season.career.reactionTimeRecords || [];
                  const validRecords = allRecords.filter((r) => !r.falseStart && r.reactionTimeMs > 0);
                  const bestMs =
                    season.career.bestReactionTimeMs ||
                    (validRecords.length > 0
                      ? Math.min(...validRecords.map((r) => r.reactionTimeMs))
                      : null);
                  const avgMs =
                    validRecords.length > 0
                      ? Math.round(
                          validRecords.reduce((acc, r) => acc + r.reactionTimeMs, 0) /
                            validRecords.length
                        )
                      : null;
                  const falseStarts =
                    season.career.falseStartsCount ??
                    allRecords.filter((r) => r.falseStart).length;
                  const topSortedRecords = [...validRecords]
                    .sort((a, b) => a.reactionTimeMs - b.reactionTimeMs)
                    .slice(0, 5);

                  return (
                    <>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 rounded-lg bg-neutral-900 border border-white/5">
                          <span className="text-[9px] uppercase font-bold text-neutral-400 block">
                            Best Record
                          </span>
                          <span className="text-xs font-mono font-black text-emerald-400">
                            {bestMs != null ? `${(bestMs / 1000).toFixed(3)}s` : '—'}
                          </span>
                          {bestMs != null && (
                            <span className="text-[9px] font-mono text-amber-300 block">
                              {bestMs} ms
                            </span>
                          )}
                        </div>
                        <div className="p-2 rounded-lg bg-neutral-900 border border-white/5">
                          <span className="text-[9px] uppercase font-bold text-neutral-400 block">
                            Avg Reaction
                          </span>
                          <span className="text-xs font-mono font-black text-cyan-400">
                            {avgMs != null ? `${(avgMs / 1000).toFixed(3)}s` : '—'}
                          </span>
                          {avgMs != null && (
                            <span className="text-[9px] font-mono text-neutral-400 block">
                              {avgMs} ms
                            </span>
                          )}
                        </div>
                        <div className="p-2 rounded-lg bg-neutral-900 border border-white/5">
                          <span className="text-[9px] uppercase font-bold text-neutral-400 block">
                            False Starts
                          </span>
                          <span className="text-xs font-mono font-black text-red-400">
                            {falseStarts}
                          </span>
                          <span className="text-[9px] font-mono text-neutral-500 block">
                            Car Stalls
                          </span>
                        </div>
                      </div>

                      {topSortedRecords.length > 0 ? (
                        <div className="space-y-1">
                          <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-400 block">
                            Top Personal Reaction Records:
                          </span>
                          {topSortedRecords.map((rec, idx) => (
                            <div
                              key={rec.id}
                              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-neutral-900/90 border border-white/5 text-[11px] font-mono"
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <span
                                  className={`font-black ${
                                    idx === 0
                                      ? 'text-amber-400'
                                      : idx === 1
                                      ? 'text-slate-300'
                                      : 'text-amber-600'
                                  }`}
                                >
                                  #{idx + 1}
                                </span>
                                <span className="text-neutral-200 font-sans font-semibold truncate max-w-[110px]">
                                  {rec.circuitName}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-emerald-400 font-black">
                                  {(rec.reactionTimeMs / 1000).toFixed(3)}s
                                </span>
                                <span className="text-[10px] text-amber-300">
                                  ({rec.reactionTimeMs} ms)
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-neutral-400 leading-snug">
                          Wait for all 5 red lights to go out at the start of a race before hitting the throttle! Your launch reaction time (in ms) will be measured and ranked here.
                        </p>
                      )}

                      {/* Interactive 5-Lights Start Reaction Practice Section */}
                      <div className="mt-1 pt-2.5 border-t border-white/10 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase font-black tracking-wider text-amber-400 flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            5-Lights Reaction Practice
                          </span>
                          <span className="text-[9px] font-mono text-neutral-400">
                            Press W / ↑ / Space or Click
                          </span>
                        </div>

                        {/* 5-Light Gantry Display */}
                        <div className="p-3 rounded-xl bg-black/90 border border-white/10 flex flex-col items-center gap-2.5 shadow-inner">
                          <div className="flex items-center justify-center gap-2.5">
                            {[1, 2, 3, 4, 5].map((lightIdx) => {
                              const isRedOn =
                                startPracticePhase === 'countdown' && startPracticeLights >= lightIdx;
                              const isGreenFlash =
                                startPracticePhase === 'lights_out' ||
                                (startPracticePhase === 'result' &&
                                  startPracticeResult &&
                                  !startPracticeResult.falseStart);
                              return (
                                <div
                                  key={lightIdx}
                                  className="px-2 py-2 rounded-lg bg-zinc-900 border border-white/10 flex flex-col items-center gap-1.5"
                                >
                                  <div
                                    className={`w-3.5 h-3.5 rounded-full transition-all duration-75 ${
                                      isRedOn
                                        ? 'bg-red-600/40 border border-red-400/50'
                                        : 'bg-zinc-800 border border-white/5'
                                    }`}
                                  />
                                  <div
                                    className={`w-5 h-5 rounded-full transition-all duration-75 ${
                                      isRedOn
                                        ? 'bg-red-500 shadow-[0_0_16px_#ef4444] scale-105 border border-red-300'
                                        : isGreenFlash
                                        ? 'bg-emerald-500/20 border border-emerald-500/40'
                                        : 'bg-zinc-800 border border-white/10'
                                    }`}
                                  />
                                </div>
                              );
                            })}
                          </div>

                          {/* Status Banner inside Practice Gantry */}
                          {startPracticePhase === 'idle' && (
                            <span className="text-[10px] font-mono text-neutral-400 text-center">
                              Click <strong className="text-white">Start 5-Lights Sequence</strong>, hold off the throttle until all 5 red lights go out!
                            </span>
                          )}
                          {startPracticePhase === 'countdown' && (
                            <span className="text-[11px] font-mono font-black uppercase tracking-wider text-amber-400 animate-pulse">
                              HOLD CLUTCH — WAIT FOR LIGHTS OUT ({startPracticeLights}/5)...
                            </span>
                          )}
                          {startPracticePhase === 'lights_out' && (
                            <span className="text-xs font-mono font-black uppercase tracking-widest text-emerald-400 animate-bounce">
                              🟢 LIGHTS OUT — HIT THROTTLE NOW!
                            </span>
                          )}
                          {startPracticePhase === 'result' && startPracticeResult && (
                            <div className="w-full text-center space-y-1 pt-0.5">
                              {startPracticeResult.falseStart ? (
                                <div className="p-2 rounded-lg bg-red-950/80 border border-red-500/60">
                                  <span className="text-[11px] font-mono font-black text-red-300 block uppercase">
                                    ⚠️ FALSE START — ENGINE STALLED!
                                  </span>
                                  <span className="text-[10px] font-mono text-red-200 block">
                                    Hit throttle {( (startPracticeResult.jumpedEarlyByMs || 0) / 1000 ).toFixed(2)}s ({startPracticeResult.jumpedEarlyByMs} ms) before lights out!
                                  </span>
                                </div>
                              ) : (
                                <div className="p-2 rounded-lg bg-emerald-950/70 border border-emerald-500/50">
                                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                    <span className="text-sm font-mono font-black text-white">
                                      {((startPracticeResult.reactionTimeMs || 0) / 1000).toFixed(3)}s
                                    </span>
                                    <span className="text-xs font-mono font-bold text-amber-300">
                                      ({startPracticeResult.reactionTimeMs} ms)
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-black uppercase ${
                                        (startPracticeResult.reactionTimeMs || 999) <= 165
                                          ? 'bg-purple-500 text-white'
                                          : (startPracticeResult.reactionTimeMs || 999) <= 225
                                          ? 'bg-emerald-500 text-black'
                                          : (startPracticeResult.reactionTimeMs || 999) <= 310
                                          ? 'bg-sky-500 text-black'
                                          : 'bg-zinc-700 text-zinc-200'
                                      }`}
                                    >
                                      {(startPracticeResult.reactionTimeMs || 999) <= 165
                                        ? '⚡ LIGHTNING F1 REFLEX'
                                        : (startPracticeResult.reactionTimeMs || 999) <= 225
                                        ? '🔥 ELITE PRO LAUNCH'
                                        : (startPracticeResult.reactionTimeMs || 999) <= 310
                                        ? '✅ SOLID LAUNCH'
                                        : '⏱️ LATE LAUNCH'}
                                    </span>
                                  </div>
                                  {startPracticeResult.isNewBest && (
                                    <span className="text-[9px] font-mono font-black text-amber-400 uppercase block mt-0.5">
                                      🏆 NEW PERSONAL BEST REACTION RECORD!
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Interactive Action / Throttle Pedal Buttons */}
                          {startPracticePhase === 'countdown' || startPracticePhase === 'lights_out' ? (
                            <button
                              type="button"
                              onMouseDown={handleTriggerPracticeThrottle}
                              onTouchStart={(e) => {
                                e.preventDefault();
                                handleTriggerPracticeThrottle();
                              }}
                              className={`w-full py-2.5 px-3 rounded-xl font-mono font-black text-xs uppercase tracking-wider transition-all cursor-pointer select-none shadow-lg ${
                                startPracticePhase === 'lights_out'
                                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/30 scale-[1.01]'
                                  : 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200'
                              }`}
                            >
                              ⚡ HIT THROTTLE / LAUNCH (W / SPACE / CLICK)
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleStartReactionDrill}
                              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-400 hover:to-red-500 text-white font-mono font-black text-[11px] uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>
                                {startPracticePhase === 'result'
                                  ? 'Practice 5-Lights Start Again'
                                  : 'Start 5-Lights Sequence'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* 3-Race Paddock Rumor Mill Component */}
          <RumorMill
            season={season}
            onSelectContractTeam={(team) => {
              setActiveTab('contracts');
              handleOpenContract(team);
            }}
            onNavigateToContracts={() => setActiveTab('contracts')}
            onToggleLookingForTeam={onToggleLookingForTeam}
          />
        </div>
      )}

      {/* TAB: PADDOCK NEWSFEED & NEWS COMPANY */}
      {activeTab === 'newsfeed' && (
        <Newsfeed
          season={season}
          onNavigateToTab={(tab) => setActiveTab(tab)}
          onFoundNewsCompany={(company, startupFee) => {
            if (onFoundNewsCompany) {
              onFoundNewsCompany(company, startupFee);
              setNotificationMsg(
                `OFFICIAL FIA MEDIA PRESS CREDENTIAL: Founded "${company.name}" [${company.badgeCode}]! Hire writers, edit their drafts, or write your own reports to grow your subscribers.`
              );
            }
          }}
          onUpdateNewsCompany={(company, feeDelta) => {
            if (onUpdateNewsCompany) {
              onUpdateNewsCompany(company, feeDelta);
            }
          }}
          onPublishNewsReport={(report) => {
            if (onPublishNewsReport) {
              onPublishNewsReport(report);
              setNotificationMsg(
                report.revenueEarned >= 0
                  ? `REPORT PUBLISHED (${report.verdictLabel}): Net Profit +${formatMoney(report.revenueEarned)} (${report.subscriberDelta >= 0 ? '+' : ''}${report.subscriberDelta.toLocaleString()} subscribers)!`
                  : `REPORT FINANCIAL LOSS (${report.verdictLabel}): Lost -${formatMoney(Math.abs(report.revenueEarned))} and ${Math.abs(report.subscriberDelta).toLocaleString()} subscribers due to operating costs & inaccurate/weak reporting.`
              );
            }
          }}
        />
      )}

      {/* TAB: PERFORMANCE ANALYTICS DASHBOARD */}
      {activeTab === 'analytics' && (
        <PerformanceAnalytics
          season={season}
          onStartRaceClick={() => setActiveTab('weekend')}
        />
      )}

      {/* TAB: OFF-SEASON & WINTER R&D HUB */}
      {activeTab === 'offseason' && (
        <div className="space-y-6">
          {/* Top Off-Season Header */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-amber-400 font-mono font-bold uppercase">
                <Wind className="w-4 h-4" />
                <span>FIA Winter Off-Season & Mandatory Media Duties Hub</span>
                <span>·</span>
                <span>
                  Season {season.career.seasonNumber || 1}
                </span>
              </div>
              <h2 className="text-2xl font-black text-white mt-1">
                Off-Season Press Conference, FIA Gala & Winter R&D
              </h2>
              <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
                {season.seasonFinished
                  ? `Season ${season.career.seasonNumber || 1} is complete! Complete all 3 mandatory off-season duties below (Press Conference Interviews, FIA Prize Gala, and Pre-Season Simulator Shakedown) to unlock Season ${(season.career.seasonNumber || 1) + 1}.`
                  : `Season ${season.career.seasonNumber || 1} is currently active (Round ${season.currentRound + 1} of 10). Skipping seasons is prohibited by FIA Career Rules—finish all 10 rounds to enter the Off-Season!`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setActiveTab('newsfeed')}
                className="px-4 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white border border-neutral-700 text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Newspaper className="w-4 h-4 text-red-400" />
                <span>Paddock Media Coverage</span>
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className="px-4 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <span>Previous Years Analytics</span>
              </button>

              {!season.seasonFinished ? (
                <div className="px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-400 text-xs font-mono font-bold flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>Complete Round 10 ({10 - season.completedRounds.length} Races Left) — No Skipping Seasons</span>
                </div>
              ) : canLaunchNextSeason && onStartNextSeason ? (
                <button
                  onClick={() => {
                    onStartNextSeason();
                    setActiveTab('weekend');
                    setNotificationMsg(
                      `Launched Season ${(season.career.seasonNumber || 1) + 1}! Paddock media will continue discussing Season ${season.career.seasonNumber || 1} until Round 1 at Bahrain concludes.`
                    );
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-amber-400 hover:from-emerald-400 hover:to-amber-300 text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Trophy className="w-4 h-4" />
                  <span>
                    Launch Season {(season.career.seasonNumber || 1) + 1} →
                  </span>
                </button>
              ) : (
                <div className="px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-mono font-bold flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>
                    Complete Mandatory Off-Season Duties ({completedMandatoryCount}/3) to Unlock Season {(season.career.seasonNumber || 1) + 1}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* MANDATORY OFF-SEASON DUTIES & INTERVIEWS PANEL */}
          <div className="bg-neutral-900 border-2 border-amber-500/40 rounded-2xl p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
              <div>
                <span className="text-[11px] font-mono font-black uppercase tracking-wider text-amber-400">
                  Mandatory Post-Season Protocol · Cannot Skip to Next Season Without Completing
                </span>
                <h3 className="text-xl font-black text-white mt-0.5">
                  Required Off-Season Duties ({completedMandatoryCount} / 3 Completed)
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {season.seasonFinished
                    ? 'Complete your press interviews, attend the FIA Gala, and finish your pre-season shakedown below to unlock the next championship season.'
                    : `These mandatory off-season activities unlock immediately after Round 10 (Abu Dhabi GP). You are currently on Round ${season.currentRound + 1} of 10.`}
                </p>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className={`px-2.5 py-1 rounded-lg border font-bold ${isInterviewDone ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' : 'bg-neutral-950 border-neutral-800 text-neutral-400'}`}>
                  {isInterviewDone ? '✓ 1. Interviews' : '○ 1. Interviews'}
                </span>
                <span className={`px-2.5 py-1 rounded-lg border font-bold ${isGalaDone ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' : 'bg-neutral-950 border-neutral-800 text-neutral-400'}`}>
                  {isGalaDone ? '✓ 2. FIA Gala' : '○ 2. FIA Gala'}
                </span>
                <span className={`px-2.5 py-1 rounded-lg border font-bold ${isShakedownDone ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' : 'bg-neutral-950 border-neutral-800 text-neutral-400'}`}>
                  {isShakedownDone ? '✓ 3. Shakedown' : '○ 3. Shakedown'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Duty 1: Mandatory Post-Season Press Conference Interviews */}
              <div className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 ${isInterviewDone ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-neutral-950 border-neutral-800'}`}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-black uppercase tracking-wider text-amber-400">
                      Duty 1 · Mandatory Media Press Conference
                    </span>
                    {isInterviewDone && (
                      <span className="text-[10px] font-mono font-black text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
                        COMPLETED ✓
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-black text-white">
                    FIA Post-Season Press Interviews
                  </h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Answer questions from Sky Sports F1, The Race, and Autosport regarding your Season {season.career.seasonNumber || 1} performance. Your quotes will be published across the Paddock Newsfeed until Round 1 of next season ends!
                  </p>

                  {!isInterviewDone ? (
                    <div className="space-y-2.5 pt-1 text-xs">
                      <div>
                        <label className="text-[10px] font-mono uppercase text-neutral-400 block mb-1">
                          Q1 (Sky Sports F1): How do you rate your Season {season.career.seasonNumber || 1} campaign?
                        </label>
                        <select
                          value={interviewQ1}
                          onChange={(e) => setInterviewQ1(e.target.value as any)}
                          disabled={!season.seasonFinished}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        >
                          <option value="confident">"We proved our pace against the best on the grid and extracted maximum points."</option>
                          <option value="humble">"It was a grueling 10-race battle—proud of the crew, but we left points on the table."</option>
                          <option value="hungry">"This season was just the foundation. Nobody in the paddock has seen our true ceiling yet."</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-mono uppercase text-neutral-400 block mb-1">
                          Q2 (The Race): Where is {playerTeam.name} focusing this winter?
                        </label>
                        <select
                          value={interviewQ2}
                          onChange={(e) => setInterviewQ2(e.target.value as any)}
                          disabled={!season.seasonFinished}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        >
                          <option value="praise_team">"Our factory aero and powertrain engineers are working flat-out on cornering downforce."</option>
                          <option value="demand_upgrades">"We need more straight-line DRS speed and braking stability if we want to dominate next year."</option>
                          <option value="focus_racecraft">"Late-braking racecraft and tire management under pressure will be our biggest weapons."</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-mono uppercase text-neutral-400 block mb-1">
                          Q3 (Autosport): What is your target for Season {(season.career.seasonNumber || 1) + 1}?
                        </label>
                        <select
                          value={interviewQ3}
                          onChange={(e) => setInterviewQ3(e.target.value as any)}
                          disabled={!season.seasonFinished}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        >
                          <option value="title_charge">"Nothing less than the FIA World Championship trophy. We are coming for P1 from Bahrain."</option>
                          <option value="race_wins">"Fighting for Grand Prix victories and podiums on every single circuit on the calendar."</option>
                          <option value="consistent_podiums">"Relentless points finishes and shocking the front-running constructors every weekend."</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-neutral-900 border border-emerald-500/30 text-xs text-emerald-200 italic">
                      "{season.career.lastOffSeasonInterviewQuote || 'We proved our pace this season and we are coming out swinging at Bahrain.'}"
                    </div>
                  )}
                </div>

                <button
                  disabled={!season.seasonFinished || isInterviewDone}
                  onClick={() => {
                    if (!season.seasonFinished || isInterviewDone || !onCompleteOffSeasonTask) return;
                    const q1Map = {
                      confident: 'We proved our pace against the best on the grid and extracted maximum points.',
                      humble: 'It was a grueling 10-race campaign—proud of the crew, and we learned huge lessons.',
                      hungry: 'This season was just the foundation. Nobody in the paddock has seen our true ceiling yet.',
                    };
                    const q2Map = {
                      praise_team: 'Our factory aero and powertrain engineers are working flat-out on winter upgrades.',
                      demand_upgrades: 'We are pushing aggressively for more straight-line DRS speed and braking stability.',
                      focus_racecraft: 'Late-braking racecraft and tire management under pressure will be our biggest weapons.',
                    };
                    const q3Map = {
                      title_charge: 'Our target for next season is nothing less than the FIA World Championship title.',
                      race_wins: 'We are targeting Grand Prix victories and podiums at every circuit next year.',
                      consistent_podiums: 'We aim to shock the front-running constructors starting right at Round 1 in Bahrain.',
                    };
                    const fullQuote = `${q1Map[interviewQ1]} ${q2Map[interviewQ2]} ${q3Map[interviewQ3]}`;
                    onCompleteOffSeasonTask('interview_completed', {
                      cashDelta: 350000,
                      reputationDelta: 4,
                      interviewQuote: fullQuote,
                      interviewSummary: `Spoke to Sky Sports F1, The Race & Autosport at the Season ${season.career.seasonNumber || 1} Post-Season Press Conference`,
                    });
                    setNotificationMsg(
                      'POST-SEASON PRESS INTERVIEW COMPLETED: Earned +$350,000 FIA Media Bonus & +4% Paddock Reputation! Your quotes are now live in Paddock News.'
                    );
                  }}
                  className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
                    isInterviewDone
                      ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 cursor-default'
                      : season.seasonFinished
                      ? 'bg-amber-500 hover:bg-amber-400 text-black cursor-pointer shadow-md'
                      : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  }`}
                >
                  {isInterviewDone
                    ? '✓ Press Interviews Completed'
                    : season.seasonFinished
                    ? 'Complete Press Interviews (+$350K & +4% Rep)'
                    : 'Locked Until Round 10 Ends'}
                </button>
              </div>

              {/* Duty 2: Mandatory FIA Prize Giving Gala & Classification Sign-Off */}
              <div className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 ${isGalaDone ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-neutral-950 border-neutral-800'}`}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-black uppercase tracking-wider text-cyan-400">
                      Duty 2 · Official FIA Ceremony
                    </span>
                    {isGalaDone && (
                      <span className="text-[10px] font-mono font-black text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
                        COMPLETED ✓
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-black text-white">
                    Attend FIA Prize-Giving Gala & Sign Final Classification
                  </h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    All Formula 1 drivers and team principals are required by FIA Sporting Regulations to attend the post-season Awards Gala, certify final championship points, and conduct red-carpet media appearances.
                  </p>
                  <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Season {season.career.seasonNumber || 1} Points:</span>
                      <span className="text-white font-bold">{season.driverPoints[season.selectedDriverId] || 0} PTS</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Constructor Points:</span>
                      <span className="text-cyan-400 font-bold">{season.constructorPoints[season.selectedTeamId] || 0} PTS</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Gala Appearance Stipend:</span>
                      <span className="text-emerald-400 font-bold">+$500,000 & +3% Rep</span>
                    </div>
                  </div>
                </div>

                <button
                  disabled={!season.seasonFinished || isGalaDone}
                  onClick={() => {
                    if (!season.seasonFinished || isGalaDone || !onCompleteOffSeasonTask) return;
                    onCompleteOffSeasonTask('gala_attended', {
                      cashDelta: 500000,
                      reputationDelta: 3,
                    });
                    setNotificationMsg(
                      'FIA PRIZE GALA ATTENDED: Certified Season classification and received +$500,000 FIA Gala Appearance Stipend & +3% Reputation!'
                    );
                  }}
                  className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
                    isGalaDone
                      ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 cursor-default'
                      : season.seasonFinished
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-black cursor-pointer shadow-md'
                      : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  }`}
                >
                  {isGalaDone
                    ? '✓ FIA Gala Attended'
                    : season.seasonFinished
                    ? 'Attend FIA Prize Gala (+$500K & +3% Rep)'
                    : 'Locked Until Round 10 Ends'}
                </button>
              </div>

              {/* Duty 3: Mandatory Pre-Season Simulator Shakedown & Super Licence Renewal */}
              <div className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 ${isShakedownDone ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-neutral-950 border-neutral-800'}`}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-black uppercase tracking-wider text-purple-400">
                      Duty 3 · Pre-Season Homologation
                    </span>
                    {isShakedownDone && (
                      <span className="text-[10px] font-mono font-black text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
                        COMPLETED ✓
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-black text-white">
                    Pre-Season Simulator Shakedown & Seat Fitting
                  </h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Complete your mandatory 200km winter simulator telemetry correlation, crash-structure homologation, and FIA Super Licence renewal with {playerTeam.name} before shipping freight to Bahrain.
                  </p>
                  <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Contracted Constructor:</span>
                      <span className="text-white font-bold">{playerTeam.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Simulator Telemetry Gain:</span>
                      <span className="text-purple-400 font-bold">+0.5 Driver Rating</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">FIA Super Licence Status:</span>
                      <span className={isShakedownDone ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                        {isShakedownDone ? 'CERTIFIED FOR NEXT SEASON' : 'PENDING SHAKEDOWN'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  disabled={!season.seasonFinished || isShakedownDone}
                  onClick={() => {
                    if (!season.seasonFinished || isShakedownDone || !onCompleteOffSeasonTask) return;
                    onCompleteOffSeasonTask('shakedown_completed', {
                      ratingDelta: 0.5,
                    });
                    setNotificationMsg(
                      `PRE-SEASON SHAKEDOWN COMPLETE: ${playerTeam.name} chassis homologated and Driver Rating increased by +0.5!`
                    );
                  }}
                  className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
                    isShakedownDone
                      ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 cursor-default'
                      : season.seasonFinished
                      ? 'bg-purple-500 hover:bg-purple-400 text-black cursor-pointer shadow-md'
                      : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  }`}
                >
                  {isShakedownDone
                    ? '✓ Shakedown & Licence Certified'
                    : season.seasonFinished
                    ? 'Run Pre-Season Shakedown (+0.5 Rating)'
                    : 'Locked Until Round 10 Ends'}
                </button>
              </div>
            </div>
          </div>

          {/* 3-Column Off-Season Programs Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Program 1: FIA Post-Season Awards & Media Summary */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="text-xs font-mono font-bold text-amber-400 uppercase">
                  1. FIA Awards Gala & Season Recap
                </div>
                <h3 className="text-lg font-black text-white">
                  Season {season.career.seasonNumber || 1} Classification
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  International F1 media outlets (Sky Sports F1, The Race, Autosport, F1 Technical) publish dedicated post-season championship analysis and driver report cards once the season concludes.
                </p>
                <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2 text-xs font-mono tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Your Driver Points:</span>
                    <span className="text-white font-bold">
                      {season.driverPoints[season.selectedDriverId] || 0} PTS
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Constructor Points:</span>
                    <span className="text-cyan-400 font-bold">
                      {season.constructorPoints[season.selectedTeamId] || 0} PTS
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Driver Rating:</span>
                    <span className="text-emerald-400 font-bold">
                      {season.career.driverRating} OVR
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Available Bank Balance:</span>
                    <span className="text-amber-400 font-bold">
                      {formatMoney(season.career.careerEarnings)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('newsfeed')}
                className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Open Post-Season Paddock News →
              </button>
            </div>

            {/* Program 2: Winter Wind-Tunnel & Chassis R&D (For Custom Team or Career Preparation) */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="text-xs font-mono font-bold text-cyan-400 uppercase">
                  2. Winter Wind-Tunnel & Aero R&D
                </div>
                <h3 className="text-lg font-black text-white">
                  Factory Winter Upgrade Package
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  {season.career.customTeam
                    ? `Invest $4,500,000 in off-season CFD wind-tunnel testing for ${season.career.customTeam.name} to permanently boost Engine Power (+2), Cornering Downforce (+2), and Braking (+2) for the upcoming season.`
                    : 'Own your own 11th Constructor in the My Team tab to unlock full factory wind-tunnel, chassis, and power unit dyno R&D during the winter off-season.'}
                </p>
                {season.career.customTeam && (
                  <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1.5 text-xs font-mono tabular-nums">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Engine Power Rating:</span>
                      <span className="text-amber-400 font-bold">
                        {season.career.customTeam.enginePower} / 100
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Aero Handling Bonus:</span>
                      <span className="text-cyan-400 font-bold">
                        +{season.career.customTeam.handlingBonus}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Carbon Brakes Bonus:</span>
                      <span className="text-emerald-400 font-bold">
                        +{season.career.customTeam.brakesBonus}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              {season.career.customTeam ? (
                <button
                  onClick={() => {
                    if (!season.career.customTeam || !onUpdateCustomTeam) return;
                    const cost = 4500000;
                    if (season.career.careerEarnings < cost) {
                      setNotificationMsg('Insufficient funds for the $4,500,000 Winter Wind-Tunnel R&D Package.');
                      return;
                    }
                    const ct = season.career.customTeam;
                    onUpdateCustomTeam(
                      {
                        ...ct,
                        enginePower: Math.min(100, (ct.enginePower || 86) + 2),
                        handlingBonus: Math.min(25, (ct.handlingBonus || 5) + 2),
                        brakesBonus: Math.min(25, (ct.brakesBonus || 5) + 2),
                      },
                      cost
                    );
                    setNotificationMsg(
                      `WINTER R&D COMPLETE: ${ct.name} gained +2 Engine Power, +2 Aero Handling, and +2 Braking Efficiency!`
                    );
                  }}
                  className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Run Winter Wind-Tunnel R&D ($4,500,000)
                </button>
              ) : (
                <button
                  onClick={() => setActiveTab('myteam')}
                  className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-cyan-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Open My Team (11th Constructor) →
                </button>
              )}
            </div>

            {/* Program 3: Off-Season Driver Contracts & Previous Years Analytics */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="text-xs font-mono font-bold text-purple-400 uppercase">
                  3. Driver Market & Telemetry Archive
                </div>
                <h3 className="text-lg font-black text-white">
                  Off-Season Seat Negotiations
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Review contract offers across all 10 official F1 constructors or compare multi-year constructor championship trajectories from 2024, 2025, and every completed career season.
                </p>
                <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1.5 text-xs font-mono tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Current Team:</span>
                    <span className="text-white font-bold">{playerTeam.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Archived Seasons:</span>
                    <span className="text-purple-400 font-bold">
                      {(season.career.seasonHistory?.length || 0) + 2} Seasons Available
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setActiveTab('contracts')}
                  className="py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Driver Contracts
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className="py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Past Years Charts
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* TAB 2: DRIVER CONTRACTS & TEAM SWITCHING */}
        {activeTab === 'contracts' && (
          <div className="flex flex-col gap-6">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-white">FIA Driver Market & Team Contracts</h2>
                <p className="text-sm text-neutral-400 mt-1 max-w-2xl">
                  No career points are required to join teams—eligibility is based purely on <strong className="text-white">Driver Rating, Wins, and Podiums</strong>, or direct <strong className="text-amber-400">Incoming Team Headhunter Offers</strong>!
                </p>
              </div>
              <div className="bg-neutral-950 p-4 rounded-xl border border-white/5 text-right shrink-0">
                <span className="text-[10px] uppercase font-bold text-neutral-400">Available Funds</span>
                <p className="text-xl font-black text-emerald-400">{formatMoney(bankBalance)}</p>
              </div>
            </div>

            {/* Custom Team Owner Negotiation Notice Banner */}
            {season.career.customTeam && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-300">Constructor Owner Negotiation Freedom</h4>
                    <p className="text-xs text-neutral-300">
                      You own <strong className="text-white">{season.career.customTeam.name}</strong>. You can <strong className="text-emerald-400">freely negotiate contracts and accept counter-offers</strong> with any team below without selling your team—you only need to sell your team (+$210M) when you are ready to finalize & sign!
                    </p>
                  </div>
                </div>
                {onSellCustomTeam && (
                  <button
                    onClick={() => setShowSellTeamModal(true)}
                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-amber-500/40 font-bold text-xs rounded-xl shrink-0 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                    <span>Sell Franchise ($210M)</span>
                  </button>
                )}
              </div>
            )}

            {/* YOUR ACTIVE TEAM CONTRACT & RENEGOTIATION PANEL OR UNSIGNED FREE AGENT CRISIS PANEL */}
            {!season.career.customTeam && (() => {
              const isUnsigned = Boolean(season.career.isUnsignedFreeAgent);
              const cutCount = season.career.proveItCutCount || 0;
              const cutNotice = season.career.lastProveItCutNotice;

              if (isUnsigned) {
                const payDriverCandidates = TEAMS.filter(
                  (t) => t.performanceTier >= 3 && t.id !== season.career.lastCutByTeamId
                );
                const payDriverTeam =
                  payDriverCandidates[payDriverCandidates.length - 1] || TEAMS[TEAMS.length - 1];
                const payDriverBuyIn = 200000;
                const canAffordPayDriver = bankBalance >= payDriverBuyIn;

                return (
                  <div className="rounded-2xl p-6 border-2 border-red-500 bg-gradient-to-r from-red-950/60 via-neutral-900 to-neutral-900 flex flex-col gap-4 shadow-2xl shadow-red-950/40">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-red-600/30 border border-red-400 flex items-center justify-center font-black text-red-300 text-lg shrink-0">
                          🚨
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded bg-red-500 text-black text-[10px] font-mono font-black uppercase">
                              UNSIGNED FREE AGENT · CUT FROM PROVE-IT CONTRACT ({cutCount}x CUT)
                            </span>
                            {cutNotice?.outcome === 'nobody_signed' ? (
                              <span className="px-2.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-500/60 text-[10px] font-mono font-black uppercase">
                                ❌ PADDOCK BLACKOUT — NOBODY SIGNED YOU
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-black uppercase">
                                ⚠️ ONLY LOWBALL BACKMARKER PROVE-IT OFFERS AVAILABLE
                              </span>
                            )}
                          </div>
                          <h3 className="text-xl font-black text-white mt-1.5">
                            {cutNotice
                              ? `Cut by ${cutNotice.teamName} After Finishing P${cutNotice.finishPosition} (Required P${cutNotice.requiredPosition}+)`
                              : 'You Were Cut From Your Prove-It Contract and Have No Team!'}
                          </h3>
                          <p className="text-xs text-red-200/90 mt-1 max-w-3xl leading-relaxed">
                            {cutNotice?.message ||
                              'Doing badly even for a single race on a Prove-It contract gets you cut immediately! Top and midfield teams have shut their doors.'}{' '}
                            {activeIncomingOffers.length > 0
                              ? `You have ${activeIncomingOffers.length} rock-bottom Prove-It lifeline offer(s) from bad backmarker teams in "Incoming Team Contract Offers" below. Warning: if you accept and do badly again, you will get cut again and keep swapping teams or find nobody willing to sign you!`
                              : 'No team on the grid sent you a contract offer! You must either beg backmarker teams for an Emergency Walk-On Tryout or buy a Pay-Driver seat to get back on the grid.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
                        {onAttemptUnsignedWalkOn && (
                          <button
                            type="button"
                            onClick={() => {
                              setDismissedOfferIds([]);
                              const res = onAttemptUnsignedWalkOn();
                              setNotificationMsg(res.message);
                            }}
                            className="px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 text-black shadow-lg shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>Pitch Backmarkers for Walk-On Tryout</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={!canAffordPayDriver}
                          onClick={() => {
                            const payDriverDisplacedId = payDriverTeam.drivers[1] || payDriverTeam.drivers[0] || season.selectedDriverId;
                            onSelectTeam(
                              payDriverTeam.id,
                              payDriverDisplacedId,
                              payDriverBuyIn,
                              0,
                              15000,
                              1,
                              'Pay-Driver 1-Season Prove-It Seat',
                              true
                            );
                            setNotificationMsg(
                              `PAY-DRIVER SEAT PURCHASED: You paid ${formatMoney(payDriverBuyIn)} to ${payDriverTeam.name} for an emergency $15,000/race Prove-It seat! Don't finish below P15 or they'll cut you too!`
                            );
                          }}
                          className={`px-4 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider border transition-all flex items-center justify-center gap-2 ${
                            canAffordPayDriver
                              ? 'bg-neutral-900 hover:bg-neutral-800 text-emerald-300 border-emerald-500/50 cursor-pointer'
                              : 'bg-neutral-950 text-neutral-600 border-neutral-800 cursor-not-allowed'
                          }`}
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>
                            Pay-Driver Buy-In ({payDriverTeam.shortName} · -{formatMoney(payDriverBuyIn)} for $15K/GP Prove-It)
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              const curTeamObj = TEAMS.find((t) => t.id === season.selectedTeamId) || TEAMS[0];
              const curSalPerRace = season.career.currentSalary || 180000;
              const curAnnualSal = curSalPerRace * 10;
              const yrsRem = season.career.contractYearsRemaining ?? 1;
              const yrsTot = season.career.contractTotalYears ?? 1;
              const cLabel = season.career.contractTypeLabel || '1-Season Prove-It Deal';
              const isProveItActive = Boolean(season.career.isOnProveItContract);
              const proveItTargetPos =
                curTeamObj.performanceTier === 1 ? 10 : curTeamObj.performanceTier === 2 ? 13 : 15;
              const wonCupsSinceSign = careerCups > (season.career.contractSignedAtCups ?? 0);
              const wonRacesSinceSign = careerWins > (season.career.contractSignedAtWins ?? 0);
              const ratingUpSinceSign = driverRating > (season.career.contractSignedAtRating ?? 76);
              const hasOutperformedContract =
                careerCups >= 1 ||
                wonCupsSinceSign ||
                wonRacesSinceSign ||
                ratingUpSinceSign ||
                careerWins >= 1 ||
                careerPodiums >= 1;

              return (
                <div
                  className={`rounded-2xl p-5 border-2 flex flex-col gap-4 shadow-xl transition-all ${
                    careerCups >= 1 || wonCupsSinceSign
                      ? 'bg-gradient-to-r from-amber-950/45 via-neutral-900 to-neutral-900 border-amber-400/80 shadow-amber-950/30'
                      : hasOutperformedContract
                      ? 'bg-gradient-to-r from-emerald-950/40 via-neutral-900 to-neutral-900 border-emerald-400/70'
                      : 'bg-neutral-900 border-neutral-700'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-sm shrink-0 shadow-lg"
                        style={{ backgroundColor: curTeamObj.primaryColor }}
                      >
                        {curTeamObj.shortName.substring(0, 3)}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-black uppercase">
                            ACTIVE DRIVER CONTRACT · {cLabel.toUpperCase()}
                          </span>
                          {isProveItActive && (
                            <span className="px-2.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/50 text-[10px] font-mono font-black uppercase">
                              ⚠️ HIGH-RISK PROVE-IT (FINISH P{proveItTargetPos}+ EVERY RACE OR RISK IMMEDIATE CUT)
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase ${
                              yrsRem <= 0
                                ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            }`}
                          >
                            {yrsRem <= 0
                              ? 'CONTRACT TERM COMPLETED — READY FOR EXTENSION'
                              : `${yrsRem} OF ${yrsTot} SEASON${yrsTot > 1 ? 'S' : ''} REMAINING`}
                          </span>
                          {(careerCups >= 1 || hasOutperformedContract) && (
                            <span className="px-2.5 py-0.5 rounded bg-emerald-400 text-black text-[10px] font-mono font-black uppercase">
                              {careerCups >= 1
                                ? `★ ${careerCups}x DRIVERS' CUP CHAMPION — DEMAND SUPER-MAX RAISE!`
                                : '★ PROVE-IT GOALS MET — ELIGIBLE FOR RAISE!'}
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-black text-white mt-1">
                          {curTeamObj.name} — {formatMoney(curAnnualSal * yrsTot)} for {yrsTot} Year{yrsTot > 1 ? 's' : ''} ({formatMoney(curAnnualSal)}/yr · {formatMoney(curSalPerRace)}/GP)
                        </h3>
                        <p className="text-xs text-neutral-300 mt-0.5 max-w-3xl leading-relaxed">
                          {careerCups >= 1
                            ? `You won ${careerCups} Drivers' Cup(s)! Even if you originally joined ${curTeamObj.name} on a low prove-it offer, you can renegotiate with ${curTeamObj.name} right now to cash in on a massive World Champion contract!`
                            : hasOutperformedContract
                            ? `You've proven your pace (${driverRating} OVR · ${careerWins} Wins · ${careerPodiums} Podiums) since signing! Click Renegotiate below to demand more cash and a multi-year extension from ${curTeamObj.name} and remove your Prove-It cut risk.`
                            : isProveItActive
                            ? `⚠️ PROVE-IT RISK WARNING: Because you are on a Prove-It contract with ${curTeamObj.name}, you MUST finish P${proveItTargetPos} or better every single race! Even ONE bad race can get you immediately cut and left unsigned or forced onto a rock-bottom backmarker team.`
                            : `You are currently racing on a ${yrsTot}-season contract (${formatMoney(curAnnualSal)}/yr). Win races or the Drivers' Cup and renegotiate anytime with ${curTeamObj.name} for massive money!`}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenContract(curTeamObj, false)}
                      className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider shrink-0 transition-all cursor-pointer flex items-center gap-2 shadow-lg ${
                        careerCups >= 1
                          ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 text-black shadow-amber-500/25'
                          : 'bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 text-black shadow-emerald-500/25'
                      }`}
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>
                        {careerCups >= 1
                          ? `Renegotiate Champion Raise with ${curTeamObj.shortName}`
                          : `Renegotiate Contract with ${curTeamObj.shortName}`}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* DRIVER MARKET AVAILABILITY & "ANNOUNCE LOOKING FOR A TEAM" PANEL */}
            <div
              className={`rounded-2xl p-5 border-2 transition-all flex flex-col gap-4 ${
                isLookingForTeam
                  ? 'bg-gradient-to-r from-amber-950/35 via-neutral-900 to-neutral-900 border-amber-400/60 shadow-lg shadow-amber-950/30'
                  : 'bg-neutral-900/95 border-neutral-800'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                      isLookingForTeam
                        ? 'bg-amber-500/20 border-amber-400/50 text-amber-400'
                        : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                    }`}
                  >
                    <Newspaper className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-black tracking-wider ${
                          isLookingForTeam
                            ? 'bg-amber-400 text-black'
                            : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                        }`}
                      >
                        {isLookingForTeam
                          ? '● PUBLICLY LOOKING FOR A TEAM (PADDOCK MEDIA ALERT)'
                          : '○ COMMITTED TO CURRENT SEAT (QUIET MARKET)'}
                      </span>
                      <span className="text-xs text-neutral-400 font-mono">
                        Current Seat: <strong className="text-white">{playerTeam.name}</strong>
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white mt-1">
                      {isLookingForTeam
                        ? 'You Have Announced You Are Looking for a Team!'
                        : 'Announce to the Paddock That You Are Looking for a Team'}
                    </h3>
                    <p className="text-xs text-neutral-300 mt-1 max-w-3xl leading-relaxed">
                      {isLookingForTeam
                        ? 'Paddock News is actively covering your contract search! Offers depend on your Driver Rating, Win Rate, Paddock Reputation, and Drivers\' Cups. Worse & midfield teams have a much higher chance of offering massive war-chest cash to lure a top driver than frontrunners!'
                        : 'While you are already signed to a team, rival Team Principals will rarely send offers unless you announce you are looking for a team. Announcing alerts the Paddock Newsfeed and invites contract offers based on how good you are.'}
                    </p>
                  </div>
                </div>

                {onToggleLookingForTeam && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextState = !isLookingForTeam;
                      setDismissedOfferIds([]);
                      onToggleLookingForTeam(nextState);
                      setNotificationMsg(
                        nextState
                          ? `PADDOCK BREAKING NEWS: You announced you are looking for a team! Check Incoming Offers below and read the Paddock Newsfeed for live media reaction.`
                          : `You withdrew your transfer announcement and reaffirmed your commitment to ${playerTeam.name}.`
                      );
                    }}
                    className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider shrink-0 transition-all cursor-pointer flex items-center gap-2 ${
                      isLookingForTeam
                        ? 'bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-amber-500/40'
                        : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 text-black shadow-lg shadow-amber-500/20'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {isLookingForTeam ? 'Withdraw Announcement' : 'Announce Looking for a Team'}
                    </span>
                  </button>
                )}
              </div>

              {/* Driver Market Leverage Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-neutral-800/80 text-xs">
                <div className="bg-neutral-950 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-neutral-400 uppercase font-bold block">Driver Rating</span>
                  <span className={`font-black text-sm ${driverRating >= 85 ? 'text-amber-400' : driverRating >= 80 ? 'text-emerald-400' : 'text-white'}`}>
                    {driverRating} OVR
                  </span>
                </div>
                <div className="bg-neutral-950 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-neutral-400 uppercase font-bold block">Career Win Rate</span>
                  <span className={`font-black text-sm ${careerWinRate >= 0.2 ? 'text-amber-400' : careerWins >= 1 ? 'text-cyan-400' : 'text-neutral-300'}`}>
                    {careerRacesDriven > 0 ? `${Math.round(careerWinRate * 100)}%` : '0%'} ({careerWins}W / {careerRacesDriven} GP)
                  </span>
                </div>
                <div className="bg-neutral-950 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-neutral-400 uppercase font-bold block">Paddock Reputation</span>
                  <span className={`font-black text-sm ${careerReputation >= 0.6 ? 'text-emerald-400' : 'text-neutral-300'}`}>
                    {Math.round(careerReputation * 100)}%
                  </span>
                </div>
                <div className="bg-neutral-950 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-neutral-400 uppercase font-bold block">Drivers' Cups Won</span>
                  <span className={`font-black text-sm ${careerCups >= 1 ? 'text-amber-400' : 'text-neutral-400'}`}>
                    {careerCups}x World Titles
                  </span>
                </div>
              </div>
            </div>

            {/* INCOMING PADDOCK HEADHUNTER OFFERS */}
            {activeIncomingOffers.length > 0 ? (
              <div className="bg-neutral-900/95 border-2 border-amber-500/40 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase font-black text-amber-400 tracking-wider block">
                        Direct Team Principal Proposals ({activeIncomingOffers.length} Active)
                      </span>
                      <h3 className="text-lg font-black text-white">
                        Incoming Team Contract Offers (Negotiable)
                      </h3>
                    </div>
                  </div>
                  <span className="text-xs text-neutral-400">
                    Click any offer to negotiate salary & signing bonus with the Team Principal!
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeIncomingOffers.map((incOffer) => {
                    const team = TEAMS.find((t) => t.id === incOffer.teamId) || TEAMS[0];
                    const isWarchest = incOffer.offerTier === 'underdog_warchest';
                    const isSuperMax = incOffer.offerTier === 'super_max';
                    const isRegular = incOffer.offerTier === 'regular_poach';
                    const isLowball = incOffer.offerTier === 'backmarker_lowball';
                    return (
                      <div
                        key={incOffer.id}
                        className={`rounded-2xl p-4 border flex flex-col justify-between gap-4 transition-all ${
                          isWarchest
                            ? 'bg-gradient-to-b from-emerald-950/40 to-neutral-950 border-emerald-400/70 shadow-lg shadow-emerald-950/30'
                            : isSuperMax
                            ? 'bg-gradient-to-b from-amber-950/35 to-neutral-950 border-amber-400/60 shadow-lg shadow-amber-950/30'
                            : isRegular
                            ? 'bg-gradient-to-b from-cyan-950/30 to-neutral-950 border-cyan-500/50'
                            : isLowball
                            ? 'bg-neutral-950 border-neutral-700'
                            : 'bg-neutral-950 border-emerald-500/40'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                isWarchest
                                  ? 'bg-emerald-400 text-black'
                                  : isSuperMax
                                  ? 'bg-amber-400 text-black'
                                  : isRegular
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                  : isLowball
                                  ? 'bg-neutral-800 text-neutral-300 border border-neutral-600'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              }`}
                            >
                              {isWarchest
                                ? '★ UNDERDOG MASSIVE-CASH OVERPAY'
                                : isSuperMax
                                ? '★ ELITE SUPER-MAX OFFER'
                                : isRegular
                                ? 'REGULAR OFFER (WAIVES LOCKS)'
                                : isLowball
                                ? 'LOW-MONEY BACKMARKER OFFER'
                                : 'PROVE-IT OFFER (WAIVES LOCKS)'}
                            </span>
                            <button
                              onClick={() => setDismissedOfferIds((prev) => [...prev, incOffer.id])}
                              className="text-[10px] text-neutral-500 hover:text-neutral-300 font-bold cursor-pointer"
                              title="Decline Offer"
                            >
                              Decline ✕
                            </button>
                          </div>

                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm shrink-0"
                              style={{ backgroundColor: team.primaryColor }}
                            >
                              {team.shortName.substring(0, 3)}
                            </div>
                            <div>
                              <h4 className="font-black text-base text-white leading-tight">{team.name}</h4>
                              <p className="text-[11px] text-neutral-400 font-mono">
                                Tier {team.performanceTier} • PU: {team.engine}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 bg-neutral-900/90 rounded-xl border border-white/5 text-xs">
                            <div>
                              <span className="text-[9px] text-neutral-400 uppercase font-bold block">
                                Contract Term ({incOffer.contractYears || 1} Yr{(incOffer.contractYears || 1) > 1 ? 's' : ''})
                              </span>
                              <span className={`font-black text-sm ${isWarchest ? 'text-emerald-400' : isSuperMax ? 'text-amber-400' : 'text-white'}`}>
                                {formatMoney(incOffer.annualSalary * (incOffer.contractYears || 1))} / {incOffer.contractYears || 1}yr
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] text-neutral-400 uppercase font-bold block">Salary / Race</span>
                              <span className="font-bold text-cyan-400">
                                {formatMoney(incOffer.salaryPerRace)}/GP
                              </span>
                            </div>
                            <div className="col-span-2 pt-1 border-t border-neutral-800 flex items-center justify-between">
                              <span className="text-[10px] text-neutral-400">
                                Annual: <strong className="text-neutral-200">{formatMoney(incOffer.annualSalary)}/yr</strong> • Bonus:
                              </span>
                              <span className="font-bold text-emerald-400">+{formatMoney(incOffer.signingBonus)}</span>
                            </div>
                          </div>

                          <p className="text-[11px] text-neutral-300 mt-2.5 leading-relaxed">
                            "{incOffer.pitchMessage}"
                          </p>
                        </div>

                        <div>
                          <button
                            onClick={() => handleAcceptIncomingOffer(incOffer)}
                            className={`w-full py-2.5 font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              isWarchest
                                ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 text-black shadow-lg shadow-emerald-500/20'
                                : isSuperMax
                                ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 text-black shadow-lg shadow-amber-500/20'
                                : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 text-white shadow-md'
                            }`}
                          >
                            <span>Negotiate & Review Offer</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-neutral-900/75 border border-neutral-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-neutral-400">
                <div>
                  <strong className="text-white block text-sm">No Direct Headhunter Proposals Right Now</strong>
                  {isLookingForTeam
                    ? 'You have announced you are looking for a team, but your current Driver Rating, Win Rate, and Paddock Reputation were too low to attract offers (or you declined them). Win races or raise your Driver Rating to trigger big-money offers!'
                    : 'Because you are already signed to a team and have not announced that you are looking for a team, rival Team Principals are holding back their contract offers.'}
                </div>
              </div>
            )}

            {/* 3-Race Paddock Rumor Mill Component */}
            <RumorMill
              season={season}
              onSelectContractTeam={(team) => handleOpenContract(team)}
              onToggleLookingForTeam={onToggleLookingForTeam}
            />

            {/* CPU Drivers Who Announced They Are Looking for a Team (Send Offers as Team Owner!) */}
            {season.career.customTeam && (
              <div className="bg-gradient-to-r from-purple-950/40 via-neutral-900 to-neutral-900 border-2 border-purple-500/40 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="px-2.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-400/40 text-[10px] font-mono font-black uppercase">
                      📢 CPU Free-Agency Wire · Custom Team Owner Access
                    </span>
                    <h3 className="text-lg font-black text-white mt-1">
                      CPU Drivers Who Announced They Are Looking for a Team
                    </h3>
                    <p className="text-xs text-neutral-300 mt-0.5">
                      These CPU drivers have publicly announced they are looking for a new seat! Because you own{' '}
                      <strong className="text-amber-400">{season.career.customTeam.name}</strong>, you can send them contract offers right now with lower salary demands.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(season.career.cpuDriversLookingForTeam || ['perez', 'sainz', 'tsunoda', 'hulkenberg', 'gasly', 'lawson'])
                    .filter(
                      (id) =>
                        id !== season.selectedDriverId &&
                        id !== season.career.customTeam?.teammateDriverId
                    )
                    .map((id) => DRIVERS.find((d) => d.id === id))
                    .filter((d): d is Driver => Boolean(d))
                    .map((cpuDrv) => {
                      const cpuTeam = getDriverCurrentTeam(cpuDrv);
                      const baseAsk = cpuDrv.salaryPerRaceDemand || 450000;
                      const discountedAsk = Math.round((baseAsk * 0.85) / 10000) * 10000;
                      const minFloor = Math.round((baseAsk * 0.68) / 10000) * 10000;
                      return (
                        <div
                          key={cpuDrv.id}
                          className="p-3.5 rounded-xl bg-neutral-950/90 border border-purple-500/30 hover:border-purple-400/60 flex flex-col justify-between gap-3 text-xs transition-all"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-xs text-white shrink-0"
                                style={{ backgroundColor: cpuDrv.color }}
                              >
                                #{cpuDrv.number}
                              </div>
                              <div>
                                <span className="font-black text-white block">{cpuDrv.name}</span>
                                <span className="text-[10px] text-neutral-400 font-mono">
                                  Current: {cpuTeam?.name || 'F1'} • Rating:{' '}
                                  <strong className="text-purple-400">{cpuDrv.rating} OVR</strong>
                                </span>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-mono font-black uppercase shrink-0">
                              LOOKING FOR TEAM
                            </span>
                          </div>

                          <div className="p-2 rounded-lg bg-neutral-900 border border-white/5 flex items-center justify-between text-[11px] font-mono">
                            <span className="text-neutral-400">Target Salary:</span>
                            <span className="text-emerald-400 font-bold">{formatMoney(discountedAsk)}/GP</span>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleOpenDriverOfferModal({
                                driverId: cpuDrv.id,
                                name: cpuDrv.name,
                                rating: cpuDrv.rating,
                                color: cpuDrv.color,
                                number: cpuDrv.number,
                                isAcademyRookie: false,
                                isCurrentTeammateRenegotiation: false,
                                baseSalaryDemand: discountedAsk,
                                minSalaryFloor: minFloor,
                                signingBonusDemand: Math.round(discountedAsk * 1.1),
                              })
                            }
                            className="w-full py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 text-white font-black text-[11px] uppercase tracking-wider cursor-pointer shadow"
                          >
                            {`Send Offer to ${cpuDrv.shortName}`}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Teams Grid sorted by Prestige Tier */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {TEAMS.map((team) => {
                const offer = TEAM_CONTRACTS.find((c) => c.teamId === team.id) || {
                  teamId: team.id,
                  minRating: 75,
                  minPoints: 0,
                  minWins: 0,
                  minPodiums: 0,
                  salaryPerRace: 200000,
                  signingBonus: 500000,
                  midSeasonBuyoutFee: 500000,
                  prestigeTier: 'Rookie' as const,
                  teamExpectation: 'Scoring points.',
                };

                const isCurrentTeam = team.id === season.selectedTeamId;
                const isMidSeason = season.currentRound > 0 && !season.seasonFinished;
                const buyout = isMidSeason ? offer.midSeasonBuyoutFee : 0;
                const canAfford = bankBalance >= buyout;
                const meetsReqs =
                  driverRating >= offer.minRating &&
                  careerWins >= offer.minWins &&
                  careerPodiums >= offer.minPodiums;

                return (
                  <div
                    key={team.id}
                    className={`bg-neutral-900 border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                      isCurrentTeam
                        ? 'border-amber-400/50 shadow-[0_0_20px_rgba(251,191,36,0.15)] ring-1 ring-amber-400/40'
                        : 'border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div>
                      {/* Team Header */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-neutral-800 text-neutral-300">
                          {offer.prestigeTier}
                        </span>
                        {isCurrentTeam && (
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Current Team
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm"
                          style={{ backgroundColor: team.primaryColor }}
                        >
                          {team.shortName.substring(0, 3)}
                        </div>
                        <div>
                          <h3 className="font-black text-lg text-white leading-tight">{team.name}</h3>
                          <p className="text-xs text-neutral-400 font-mono">Engine: {team.engine}</p>
                        </div>
                      </div>

                      {/* Contract Stats */}
                      <div className="grid grid-cols-2 gap-2 mt-4 p-3 bg-neutral-950 rounded-xl border border-white/5 text-xs">
                        <div>
                          <span className="text-[10px] text-neutral-500 uppercase font-bold">
                            {isCurrentTeam && !season.career.customTeam ? 'Your Current Salary' : 'Standard Salary'}
                          </span>
                          <p className="font-bold text-cyan-400">
                            {formatMoney(isCurrentTeam && !season.career.customTeam ? season.career.currentSalary : offer.salaryPerRace)}/GP
                          </p>
                          <span className="text-[10px] text-amber-400 font-mono font-bold">
                            ({formatMoney((isCurrentTeam && !season.career.customTeam ? season.career.currentSalary : offer.salaryPerRace) * 10)}/yr)
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-neutral-500 uppercase font-bold">
                            {isCurrentTeam && !season.career.customTeam ? 'Contract Term' : 'Signing Bonus'}
                          </span>
                          {isCurrentTeam && !season.career.customTeam ? (
                            <p className="font-bold text-amber-400">
                              {season.career.contractYearsRemaining ?? 1} / {season.career.contractTotalYears ?? 1} Yr(s) Left
                            </p>
                          ) : (
                            <p className="font-bold text-emerald-400">{formatMoney(offer.signingBonus)}</p>
                          )}
                        </div>
                        {isMidSeason && !isCurrentTeam && (
                          <div className="col-span-2 pt-1 border-t border-neutral-800">
                            <span className="text-[10px] text-neutral-500 uppercase font-bold">Mid-Season Buyout Penalty</span>
                            <p className="font-bold text-red-400">{formatMoney(offer.midSeasonBuyoutFee)}</p>
                          </div>
                        )}
                      </div>

                      {/* Car Performance Ratings & Strengths/Weaknesses */}
                      {team.carProfile && (
                        <div className="mt-3 p-3 bg-neutral-950 rounded-xl border border-white/5 flex flex-col gap-2">
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div>
                              <div className="flex justify-between text-neutral-400 mb-0.5">
                                <span>Top Speed</span>
                                <span className="font-mono font-bold text-white">
                                  {team.carProfile.topSpeedRating} {team.carProfile.topSpeedRating >= 100 ? '★' : ''}
                                </span>
                              </div>
                              <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-red-500 rounded-full"
                                  style={{ width: `${Math.min(100, (team.carProfile.topSpeedRating / 115) * 100)}%` }}
                                />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-neutral-400 mb-0.5">
                                <span>Acceleration</span>
                                <span className="font-mono font-bold text-white">
                                  {team.carProfile.acceleration} {team.carProfile.acceleration >= 100 ? '★' : ''}
                                </span>
                              </div>
                              <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-amber-400 rounded-full"
                                  style={{ width: `${Math.min(100, (team.carProfile.acceleration / 115) * 100)}%` }}
                                />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-neutral-400 mb-0.5">
                                <span>Handling</span>
                                <span className="font-mono font-bold text-white">
                                  {team.carProfile.handlingRating} {team.carProfile.handlingRating >= 100 ? '★' : ''}
                                </span>
                              </div>
                              <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-cyan-400 rounded-full"
                                  style={{ width: `${Math.min(100, (team.carProfile.handlingRating / 115) * 100)}%` }}
                                />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-neutral-400 mb-0.5">
                                <span>Braking Bite</span>
                                <span className="font-mono font-bold text-white">
                                  {team.carProfile.brakesRating || 85} {(team.carProfile.brakesRating || 85) >= 100 ? '★' : ''}
                                </span>
                              </div>
                              <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-purple-400 rounded-full"
                                  style={{ width: `${Math.min(100, ((team.carProfile.brakesRating || 85) / 115) * 100)}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-900 text-[10px]">
                            <div>
                              <span className="font-black uppercase text-[9px] text-emerald-400 block mb-0.5">
                                Strengths
                              </span>
                              {team.carProfile.strengths.slice(0, 2).map((s, idx) => (
                                <p key={idx} className="text-emerald-300/90 leading-tight flex items-start gap-1">
                                  <span className="text-emerald-400 font-bold shrink-0">✓</span>
                                  <span>{s}</span>
                                </p>
                              ))}
                            </div>
                            <div>
                              <span className="font-black uppercase text-[9px] text-amber-400 block mb-0.5">
                                Weaknesses
                              </span>
                              {team.carProfile.weaknesses.slice(0, 2).map((w, idx) => (
                                <p key={idx} className="text-amber-300/90 leading-tight flex items-start gap-1">
                                  <span className="text-amber-400 font-bold shrink-0">⚠</span>
                                  <span>{w}</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Criteria Checklist (Driver Rating, Wins & Podiums only — zero Career Points needed) */}
                      <div className="mt-3 flex flex-col gap-1 text-[11px]">
                        <div className="flex items-center justify-between text-neutral-400">
                          <span>Min Driver Rating:</span>
                          <span className={driverRating >= offer.minRating ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                            {offer.minRating} (You: {driverRating})
                          </span>
                        </div>
                        {offer.minWins > 0 && (
                          <div className="flex items-center justify-between text-neutral-400">
                            <span>Min Grand Prix Wins:</span>
                            <span className={careerWins >= offer.minWins ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                              {offer.minWins} {offer.minWins === 1 ? 'Win' : 'Wins'} (You: {careerWins})
                            </span>
                          </div>
                        )}
                        {offer.minPodiums > 0 && (
                          <div className="flex items-center justify-between text-neutral-400">
                            <span>Min Podiums:</span>
                            <span className={careerPodiums >= offer.minPodiums ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                              {offer.minPodiums} (You: {careerPodiums})
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button: Allow renegotiating with current team (e.g. after prove-it deal / winning Drivers Cup) OR joining any team on standard or 1-Season Prove-It terms! */}
                    <div className="mt-5 flex flex-col gap-2">
                      {isCurrentTeam && !season.career.customTeam ? (
                        <button
                          type="button"
                          onClick={() => handleOpenContract(team, false)}
                          className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>
                            {careerCups >= 1
                              ? 'Renegotiate Champion Raise'
                              : 'Renegotiate Current Contract'}
                          </span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenContract(team, false)}
                            className={`w-full py-2.5 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              meetsReqs && canAfford
                                ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 text-white shadow-md'
                                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                            }`}
                          >
                            <span>Negotiate Multi-Year / Standard Contract</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenContract(team, true)}
                            className="w-full py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            title="Join on a low 1-Season Prove-It offer (no rating/win locks), then renegotiate for big cash once you win races or the Drivers' Cup!"
                          >
                            <span>
                              1-Season Prove-It Offer (
                              {team.performanceTier === 1
                                ? '$3M / 1 Yr'
                                : team.performanceTier === 2
                                ? '$2M / 1 Yr'
                                : '$1.1M / 1 Yr'}
                              )
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: MY TEAM (11TH CONSTRUCTOR) */}
        {activeTab === 'myteam' && (
          <div className="flex flex-col gap-6">
            {season.career.customTeam ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 flex flex-col gap-5">
                  {/* Team Principal Command Banner */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-xl border border-white/20 shrink-0"
                        style={{ backgroundColor: season.career.customTeam.primaryColor }}
                      >
                        {season.career.customTeam.shortName.substring(0, 3)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono uppercase font-black">
                            11th Constructor Entry
                          </span>
                          <span className="text-xs text-neutral-400 font-mono">
                            Season {season.career.seasonNumber || 1}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5 mt-0.5">
                          <h2 className="text-2xl font-black text-white">{season.career.customTeam.name}</h2>
                          <button
                            onClick={() => {
                              setNewTeamName(season.career.customTeam?.name || '');
                              setNewTeamShort(season.career.customTeam?.shortName || '');
                              setIsRenamingTeam(true);
                            }}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                            title="Rename your team mid-season"
                          >
                            <Pencil className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-[11px] text-neutral-300">Rename Team</span>
                          </button>
                          <button
                            onClick={() => {
                              setEditPrimaryColor(season.career.customTeam?.primaryColor || '#e10600');
                              setEditSecondaryColor(season.career.customTeam?.secondaryColor || '#0d0e12');
                              setEditAccentColor(season.career.customTeam?.accentColor || '#ffd700');
                              setIsEditingTeamColors(true);
                            }}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-cyan-400 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-white/10"
                            title="Switch your custom team's livery colors anytime"
                          >
                            <Palette className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="text-[11px] text-neutral-200">Switch Team Colors</span>
                            <span className="flex items-center gap-0.5 ml-0.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-white/30"
                                style={{ backgroundColor: season.career.customTeam.primaryColor }}
                              />
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-white/30"
                                style={{ backgroundColor: season.career.customTeam.secondaryColor }}
                              />
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-white/30"
                                style={{ backgroundColor: season.career.customTeam.accentColor }}
                              />
                            </span>
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400 mt-0.5">
                          <span className="text-cyan-400 font-semibold font-mono">PU: {season.career.customTeam.engine}</span>
                          <span>•</span>
                          <span>Lead: #{season.career.driverNumber} {season.career.driverName}</span>
                          <span>•</span>
                          <span>Teammate: {activeTeammateDriver.name}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 shrink-0">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-neutral-400 block">Constructors Rank</span>
                        <span className="text-xl font-black text-white">
                          P{sortedConstructors.findIndex((t) => t.id === season.career.customTeam?.id) + 1}
                          <span className="text-xs text-neutral-500 font-normal"> / {sortedConstructors.length}</span>
                        </span>
                      </div>
                      <div className="h-8 w-px bg-neutral-800" />
                      <div>
                        <span className="text-[10px] uppercase font-bold text-neutral-400 block">Constructor Pts</span>
                        <span className="text-xl font-black text-amber-400">
                          {season.constructorPoints[season.career.customTeam.id] || 0} PTS
                        </span>
                      </div>
                      {onSellCustomTeam && (
                        <>
                          <div className="h-8 w-px bg-neutral-800" />
                          <button
                            onClick={() => setShowSellTeamModal(true)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-amber-300 border border-amber-500/30 transition-all cursor-pointer flex items-center gap-1"
                            title="Sell team franchise for $210,000,000 to switch teams"
                          >
                            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                            <span>Sell Team ($210M)</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Department Navigation Tabs */}
                  <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 overflow-x-auto">
                    <button
                      onClick={() => setMyTeamSubTab('finances')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        myTeamSubTab === 'finances'
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-1 ring-emerald-400'
                          : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800'
                      }`}
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Balance Sheet & Expenses</span>
                    </button>

                    <button
                      onClick={() => setMyTeamSubTab('engine')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        myTeamSubTab === 'engine'
                          ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 ring-1 ring-red-400'
                          : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800'
                      }`}
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Power Unit Suppliers</span>
                    </button>

                    <button
                      onClick={() => setMyTeamSubTab('staff')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        myTeamSubTab === 'staff'
                          ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30 ring-1 ring-cyan-400'
                          : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Technical Directors</span>
                    </button>

                    <button
                      onClick={() => setMyTeamSubTab('sponsors')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        myTeamSubTab === 'sponsors'
                          ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30 ring-1 ring-amber-400'
                          : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Title Sponsors</span>
                    </button>

                    <button
                      onClick={() => setMyTeamSubTab('drivers')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        myTeamSubTab === 'drivers'
                          ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-1 ring-purple-400'
                          : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Driver Market</span>
                    </button>

                    {onStartPractice && (
                      <button
                        onClick={() => onStartPractice(OPEN_FIELD_PROVING_GROUND_CIRCUIT, 99, season.difficulty, 0)}
                        className="px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 bg-emerald-600 hover:bg-emerald-500 text-black shadow-lg shadow-emerald-600/25 cursor-pointer ml-auto"
                        title="Take your upgraded custom car out onto the 2.8km Open Field & R&D Proving Ground"
                      >
                        <span>🌾 Test Upgraded Car on Open Field</span>
                      </button>
                    )}
                  </div>

                  {/* SUBTAB 1: BALANCE SHEET & EVERY SINGLE OPERATING EXPENSE */}
                  {myTeamSubTab === 'finances' && (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                            FIA Financial Regulations Cost Cap
                          </span>
                          <h3 className="text-xl font-black text-white mt-0.5">Constructor Race Weekend Balance Sheet</h3>
                        </div>
                        <span className="text-xs font-mono text-neutral-400">
                          Cash Balance: <strong className="text-emerald-400">{formatMoney(bankBalance)}</strong>
                        </span>
                      </div>

                      {/* Revenue Streams */}
                      <div className="flex flex-col gap-3 bg-neutral-950 p-4 rounded-xl border border-white/5">
                        <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
                          <span>Race Weekend Projected Revenue Inflows</span>
                        </span>
                        <div className="space-y-2 text-xs font-mono">
                          <div className="flex justify-between py-1 border-b border-neutral-800">
                            <span className="text-neutral-400">• Title Sponsor Guaranteed Retainer:</span>
                            <span className="text-emerald-400 font-bold">
                              +{formatMoney(season.career.customTeam.sponsorBasePerRace || season.career.customTeam.baseSponsorPerRace || 10500000)}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-neutral-800">
                            <span className="text-neutral-400">• Sponsor Victory Performance Bonus (P1 Finish):</span>
                            <span className="text-emerald-400 font-bold">
                              +{formatMoney(season.career.customTeam.sponsorWinBonus || 15000000)}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-neutral-800">
                            <span className="text-neutral-400">• Sponsor Podium Escalator (P2-P3 Finish):</span>
                            <span className="text-emerald-400 font-bold">
                              +{formatMoney(season.career.customTeam.sponsorPodiumBonus || 8000000)}
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-neutral-400">• FIA Points Finisher Bonus (P4-P10):</span>
                            <span className="text-emerald-400 font-bold">
                              +{formatMoney(season.career.customTeam.sponsorPointsBonus || 2500000)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Itemized Comprehensive Operating Expenses */}
                      <div className="flex flex-col gap-3 bg-neutral-950 p-4 rounded-xl border border-white/5">
                        <span className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <span>Comprehensive Per-Race Operating Expenses</span>
                        </span>
                        <div className="space-y-2 text-xs font-mono">
                          <div className="flex justify-between py-1 border-b border-neutral-800">
                            <span className="text-neutral-400">• Power Unit Lease & Engine Technicians:</span>
                            <span className="text-red-400 font-bold">
                              -{formatMoney(season.career.customTeam.engineCostPerRace || 1600000)}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-neutral-800">
                            <span className="text-neutral-400">• Aerodynamics Dept & Wind Tunnel Staff Salary:</span>
                            <span className="text-red-400 font-bold">
                              -{formatMoney(season.career.customTeam.aeroStaffSalary || 480000)}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-neutral-800">
                            <span className="text-neutral-400">• Vehicle Dynamics & Chassis Chief Salary:</span>
                            <span className="text-red-400 font-bold">
                              -{formatMoney(season.career.customTeam.chassisEngineerSalary || 340000)}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-neutral-800">
                            <span className="text-neutral-400">• Brake-by-Wire & Hydraulic Specialist Salary:</span>
                            <span className="text-red-400 font-bold">
                              -{formatMoney(season.career.customTeam.brakesEngineerSalary || 290000)}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-neutral-800">
                            <span className="text-neutral-400">
                              • Contracted Teammate Driver Salary ({activeTeammateDriver.name}):
                              {(() => {
                                const curS = season.career.customTeam.teammateSalaryPerRace ?? 220000;
                                const baseS = season.career.customTeam.teammateBaselineSalaryPerRace ?? 220000;
                                const saved = Math.max(0, baseS - curS);
                                return saved > 0 ? (
                                  <span className="ml-2 text-emerald-400 font-bold">
                                    (Pay Cut Active: Saving +{formatMoney(saved)}/GP!)
                                  </span>
                                ) : null;
                              })()}
                            </span>
                            <span className="text-red-400 font-bold">
                              -{formatMoney(season.career.customTeam.teammateSalaryPerRace ?? 220000)}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-neutral-800">
                            <span className="text-neutral-400">• Factory Operation & Simulator Rig Upkeep:</span>
                            <span className="text-red-400 font-bold">
                              -{formatMoney(season.career.customTeam.maintenanceCostPerRace || 450000)}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-neutral-800">
                            <span className="text-neutral-400">• Global Freight, Flight Logistics & Fuel Depot:</span>
                            <span className="text-red-400 font-bold">
                              -{formatMoney(season.career.customTeam.logisticsCostPerRace || 350000)}
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-neutral-400">• Paddock Motorhome Hospitality & VIP Media PR:</span>
                            <span className="text-red-400 font-bold">
                              -{formatMoney(season.career.customTeam.hospitalityCostPerRace || 180000)}
                            </span>
                          </div>
                        </div>

                        {/* Total Expenses Sum */}
                        {(() => {
                          const totalExp =
                            (season.career.customTeam.engineCostPerRace || 1600000) +
                            (season.career.customTeam.aeroStaffSalary || 480000) +
                            (season.career.customTeam.chassisEngineerSalary || 340000) +
                            (season.career.customTeam.brakesEngineerSalary || 290000) +
                            (season.career.customTeam.teammateSalaryPerRace ?? 220000) +
                            (season.career.customTeam.maintenanceCostPerRace || 450000) +
                            (season.career.customTeam.logisticsCostPerRace || 350000) +
                            (season.career.customTeam.hospitalityCostPerRace || 180000);

                          const baseSponsor = season.career.customTeam.sponsorBasePerRace || season.career.customTeam.baseSponsorPerRace || 10500000;
                          const winBonus = season.career.customTeam.sponsorWinBonus || 15000000;
                          const podiumBonus = season.career.customTeam.sponsorPodiumBonus || 8000000;

                          const winNet = baseSponsor + winBonus - totalExp;
                          const podiumNet = baseSponsor + podiumBonus - totalExp;
                          const pointsNet = baseSponsor + 2500000 - totalExp;

                          return (
                            <div className="mt-2 pt-3 border-t border-neutral-800 flex flex-col gap-2">
                              <div className="flex justify-between text-xs font-bold text-white font-mono">
                                <span>Total Fixed Expenses Per Grand Prix:</span>
                                <span className="text-red-400">-{formatMoney(totalExp)}</span>
                              </div>

                              <div className="mt-2 grid grid-cols-3 gap-2 bg-neutral-900 p-3 rounded-lg border border-neutral-800 text-center">
                                <div>
                                  <span className="text-[10px] text-neutral-400 uppercase font-bold block">P1 Victory Net</span>
                                  <span className="text-sm font-black text-emerald-400">+{formatMoney(winNet)}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-neutral-400 uppercase font-bold block">Podium Finish Net</span>
                                  <span className="text-sm font-black text-cyan-400">+{formatMoney(podiumNet)}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-neutral-400 uppercase font-bold block">Top 10 Points Net</span>
                                  <span className="text-sm font-black text-amber-400">+{formatMoney(pointsNet)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* SUBTAB 2: POWER UNIT SUPPLIERS & IN-HOUSE WORKS ENGINE BUILDER */}
                  {myTeamSubTab === 'engine' && (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
                        <div>
                          <span className="text-[10px] font-black uppercase text-red-500 tracking-wider">
                            FIA Power Unit Allocation & Engine Works
                          </span>
                          <h3 className="text-xl font-black text-white mt-0.5">Power Unit R&D, Dyno Testing & Customer Engine Supply</h3>
                          <p className="text-xs text-neutral-400 mt-1">
                            Engine performance is completely uncapped (ratings can exceed 100 with advanced Dyno testing, master engineers, and senior scientists). Build bespoke works engines on the dyno bench, manufacture power units to supply customer teams on the F1 grid for tens of millions in GP revenue, or contract official supplier engines!
                          </p>
                        </div>
                      </div>

                      {/* CURRENT EQUIPPED PU BANNER */}
                      <div className="p-4 bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950 border border-neutral-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-lg font-black text-xs ${season.career.customTeam?.isWorksEngine ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                            {season.career.customTeam?.isWorksEngine ? 'WORKS PU' : 'OEM SUPPLIER'}
                          </div>
                          <div>
                            <span className="text-sm font-black text-white block">
                              {season.career.customTeam?.engine || 'Baseline Turbo V6'}
                            </span>
                            <span className="text-xs text-cyan-400 font-mono font-bold">
                              Power Rating: {season.career.customTeam?.enginePower || 84} {(season.career.customTeam?.enginePower || 84) >= 100 ? '★ HYPER-SPEC (MAX CEILING)' : ''} • Top Speed: {formatSpeed(season.career.customTeam?.engineTopSpeed || 340, unitSystem)} • Reliability: {season.career.customTeam?.engineReliability || 80}%
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-mono">
                          <span className="text-neutral-400">
                            R&D Attempts: <strong className="text-white">{season.career.customTeam?.engineDevelopmentAttempts || 0}</strong>
                          </span>
                          <span className="text-amber-400 font-bold">
                            Operating: {formatMoney(season.career.customTeam?.engineCostPerRace || 1800000)}/race
                          </span>
                        </div>
                      </div>

                      {/* SUPER-HIGH POWER RATING NOTICE & RELIABILITY UPGRADE NOTICE */}
                      {(season.career.customTeam?.enginePower || 84) >= 100 && (
                        <div className="p-3.5 bg-amber-500/10 border border-amber-500/40 rounded-xl flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
                              <Zap className="w-5 h-5" />
                            </div>
                            <div>
                              <span className="text-xs font-black text-amber-300 uppercase tracking-wider block">
                                Super-High Engine Rating Ceiling Active (Rating: {season.career.customTeam?.enginePower || 100})
                              </span>
                              <p className="text-xs text-neutral-300 mt-0.5 leading-relaxed">
                                Peak regulatory combustion limit reached! Dyno R&D is now focused entirely on <strong>Component Reliability & Impact Hardening</strong> (Current: {season.career.customTeam?.engineReliability || 80}%). The higher your reliability, the harder the hits your car can withstand without the engine stalling! (Survives light barrier taps and wheel rubs).
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* LAST DYNO TEST RESULT ALERT */}
                      {dynoResultNotice && (
                        <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 animate-fadeIn ${
                          dynoResultNotice.outcome === 'breakthrough'
                            ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                            : dynoResultNotice.outcome === 'upgrade'
                            ? 'bg-cyan-950/40 border-cyan-500/60 text-cyan-200'
                            : dynoResultNotice.outcome === 'downgrade'
                            ? 'bg-red-950/50 border-red-500/60 text-red-200 shadow-lg shadow-red-950/50'
                            : 'bg-neutral-950 border-neutral-700 text-neutral-300'
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">
                              {dynoResultNotice.outcome === 'breakthrough' ? '🚀' : dynoResultNotice.outcome === 'upgrade' ? '⚡' : dynoResultNotice.outcome === 'downgrade' ? '💥' : '⚖️'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-xs uppercase tracking-wider">
                                  {dynoResultNotice.outcome === 'breakthrough' ? 'Breakthrough Dyno Success!' : dynoResultNotice.outcome === 'upgrade' ? 'Successful Upgrade' : dynoResultNotice.outcome === 'downgrade' ? 'DYNO KNOCKING FAILURE - WORSE ENGINE!' : 'Flat Dyno Calibration'}
                                </span>
                                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${dynoResultNotice.powerDelta > 0 ? 'bg-emerald-500/20 text-emerald-400' : dynoResultNotice.powerDelta < 0 ? 'bg-red-500/20 text-red-400' : 'bg-neutral-800 text-neutral-400'}`}>
                                  {dynoResultNotice.powerDelta > 0 ? `+${dynoResultNotice.powerDelta} Power` : dynoResultNotice.powerDelta < 0 ? `${dynoResultNotice.powerDelta} Power` : '±0 Power'}
                                </span>
                              </div>
                              <p className="text-xs mt-1 leading-relaxed">{dynoResultNotice.message}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setDynoResultNotice(null)}
                            className="text-xs font-bold text-neutral-400 hover:text-white px-2 py-1 rounded bg-neutral-800/80 cursor-pointer"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}

                      {/* SECTION 1: HIRE ENGINE ENGINEERS & SCIENTISTS */}
                      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-5">
                        <div>
                          <div className="flex items-center gap-2">
                            <Cpu className="w-5 h-5 text-amber-400" />
                            <h4 className="text-sm font-black text-white uppercase tracking-wider">
                              1. Contract Lead Powertrain Engineers & Scientists
                            </h4>
                          </div>
                          <p className="text-xs text-neutral-400 mt-1">
                            Higher tier engineers and scientists increase the probability of building a stronger engine, and drastically reduce the risk of dyno knocking and building a worse engine!
                          </p>
                        </div>

                        {/* Engine Engineers Grid */}
                        <div>
                          <span className="text-[11px] font-bold uppercase text-amber-400 block mb-2">
                            Chief Powertrain Engineers (Boosts Build Success & Max Power)
                          </span>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {ENGINE_ENGINEER_OPTIONS.map((eng) => {
                              const isCurrent = season.career.customTeam?.engineEngineerId === eng.id;
                              return (
                                <div
                                  key={eng.id}
                                  className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 text-xs ${
                                    isCurrent ? 'bg-amber-950/20 border-amber-500 ring-1 ring-amber-500/40' : 'bg-neutral-900 border-neutral-800'
                                  }`}
                                >
                                  <div>
                                    <span className="font-black text-white block">{eng.title}</span>
                                    <span className="text-[10px] text-amber-400 font-mono">{eng.name}</span>
                                    <div className="mt-2 text-[11px] font-mono space-y-1 text-neutral-300">
                                      <div>Success Odds: <strong className="text-emerald-400">+{eng.successBonus}%</strong></div>
                                      <div>Downgrade Risk: <strong className="text-cyan-400">-{eng.failureReduction}%</strong></div>
                                      <div>Power Bonus: <strong className="text-amber-400">+{eng.powerGainBonus} Power</strong></div>
                                      <div>Salary: <strong className="text-neutral-400">{formatMoney(eng.salaryPerRace)}/GP</strong></div>
                                    </div>
                                    <p className="text-[10px] text-neutral-400 mt-2 leading-relaxed">{eng.description}</p>
                                  </div>
                                  {isCurrent ? (
                                    <div className="py-1.5 text-center text-[10px] text-amber-400 font-bold bg-amber-500/10 rounded-lg">
                                      Contracted
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleHireEngineEngineer(eng)}
                                      disabled={bankBalance < eng.hiringFee}
                                      className={`py-1.5 font-bold text-[10px] rounded-lg transition-colors cursor-pointer ${bankBalance >= eng.hiringFee ? 'bg-neutral-800 hover:bg-neutral-700 text-white' : 'bg-neutral-900 text-neutral-600 cursor-not-allowed'}`}
                                    >
                                      Contract ({formatMoney(eng.hiringFee)})
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Powertrain Scientists Grid */}
                        <div className="pt-4 border-t border-neutral-800/80">
                          <span className="text-[11px] font-bold uppercase text-cyan-400 block mb-2">
                            Combustion & Thermodynamics Scientists (Eliminates Downgrade Risk)
                          </span>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {ENGINE_SCIENTIST_OPTIONS.map((sci) => {
                              const isCurrent = season.career.customTeam?.engineScientistId === sci.id;
                              return (
                                <div
                                  key={sci.id}
                                  className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 text-xs ${
                                    isCurrent ? 'bg-cyan-950/20 border-cyan-500 ring-1 ring-cyan-500/40' : 'bg-neutral-900 border-neutral-800'
                                  }`}
                                >
                                  <div>
                                    <span className="font-black text-white block">{sci.title}</span>
                                    <span className="text-[10px] text-cyan-400 font-mono">{sci.name}</span>
                                    <div className="mt-2 text-[11px] font-mono space-y-1 text-neutral-300">
                                      <div>Success Odds: <strong className="text-emerald-400">+{sci.successBonus}%</strong></div>
                                      <div>Downgrade Risk: <strong className="text-cyan-400">-{sci.failureReduction}%</strong></div>
                                      <div>Ceiling Bonus: <strong className="text-purple-400">+{sci.powerCeilingBonus} Max</strong></div>
                                      <div>Salary: <strong className="text-neutral-400">{formatMoney(sci.salaryPerRace)}/GP</strong></div>
                                    </div>
                                    <p className="text-[10px] text-neutral-400 mt-2 leading-relaxed">{sci.description}</p>
                                  </div>
                                  {isCurrent ? (
                                    <div className="py-1.5 text-center text-[10px] text-cyan-400 font-bold bg-cyan-500/10 rounded-lg">
                                      Contracted
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleHireEngineScientist(sci)}
                                      disabled={bankBalance < sci.hiringFee}
                                      className={`py-1.5 font-bold text-[10px] rounded-lg transition-colors cursor-pointer ${bankBalance >= sci.hiringFee ? 'bg-neutral-800 hover:bg-neutral-700 text-white' : 'bg-neutral-900 text-neutral-600 cursor-not-allowed'}`}
                                    >
                                      Contract ({formatMoney(sci.hiringFee)})
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* SECTION 2: DYNO TEST BENCH (PAY PER ATTEMPT & RISK OF WORSE ENGINE) */}
                      <div className="bg-neutral-950 border-2 border-amber-500/50 rounded-2xl p-5 flex flex-col gap-5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <Flame className="w-5 h-5 text-orange-400" />
                              <h4 className="text-sm font-black text-white uppercase tracking-wider">
                                2. Dyno Test Bench & Power Unit Fabrication (Pay Per Attempt)
                              </h4>
                            </div>
                            <p className="text-xs text-neutral-400 mt-1">
                              Every attempt costs direct development capital. The more you invest per attempt and the better your engineers and scientists, the higher your odds of building a stronger power unit and the lower the risk of building a worse one!
                            </p>
                          </div>
                        </div>

                        {/* Name Input */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] uppercase font-bold text-neutral-400">Power Unit Model Designation</label>
                          <input
                            type="text"
                            value={customEngineNameInput}
                            onChange={(e) => setCustomEngineNameInput(e.target.value)}
                            placeholder={`${season.career.customTeam?.name || 'My Team'} Works V6 Turbo Spec 2`}
                            className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-neutral-600 focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        {/* 4 Investment Tiers */}
                        <div>
                          <span className="text-[11px] font-bold uppercase text-white block mb-2">
                            Select Development Investment Tier (The more you pay, the better the odds):
                          </span>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            {[
                              {
                                id: 'tier_1' as const,
                                name: 'Standard Calibration',
                                cost: 2500000,
                                baseSuccess: 35,
                                baseFailure: 42,
                                desc: 'Basic dyno test run. High failure risk without top scientists!',
                              },
                              {
                                id: 'tier_2' as const,
                                name: 'Rapid Prototyping',
                                cost: 6500000,
                                baseSuccess: 55,
                                baseFailure: 26,
                                desc: 'CNC alloy machining and upgraded intercooler pressure testing.',
                              },
                              {
                                id: 'tier_3' as const,
                                name: 'Titanium Additive Sprint',
                                cost: 14000000,
                                baseSuccess: 74,
                                baseFailure: 14,
                                desc: 'Aerospace 3D printed cylinder heads & MGU-K dyno cell calibration.',
                              },
                              {
                                id: 'tier_4' as const,
                                name: 'Pinnacle Hyper-Tech',
                                cost: 25000000,
                                baseSuccess: 88,
                                baseFailure: 5,
                                desc: 'Maximum works investment. Diamond-coated pistons & zero-lag turbo.',
                              },
                            ].map((tier) => {
                              const isSelected = dynoAttemptTier === tier.id;
                              return (
                                <div
                                  key={tier.id}
                                  onClick={() => setDynoAttemptTier(tier.id)}
                                  className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 cursor-pointer transition-all ${
                                    isSelected
                                      ? 'bg-amber-950/30 border-amber-500 ring-2 ring-amber-500/30'
                                      : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
                                  }`}
                                >
                                  <div>
                                    <span className="font-bold text-xs text-white block">{tier.name}</span>
                                    <span className="text-xs font-mono font-black text-amber-400">{formatMoney(tier.cost)}</span>
                                    <p className="text-[10px] text-neutral-400 mt-1.5 leading-relaxed">{tier.desc}</p>
                                  </div>
                                  <div className="pt-2 border-t border-neutral-800 flex items-center justify-between text-[10px] font-mono">
                                    <span className="text-emerald-400 font-bold">Base: {tier.baseSuccess}%</span>
                                    <span className="text-red-400">Risk: {tier.baseFailure}%</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* LIVE DYNAMIC ODDS METER */}
                        {(() => {
                          const curPower = season.career.customTeam?.enginePower || 84;
                          const hiredEngineer = ENGINE_ENGINEER_OPTIONS.find((e) => e.id === season.career.customTeam?.engineEngineerId);
                          const hiredScientist = ENGINE_SCIENTIST_OPTIONS.find((s) => s.id === season.career.customTeam?.engineScientistId);
                          const selectedTierObj = [
                            { id: 'tier_1', cost: 2500000, name: 'Standard Calibration', baseSuccess: 35, baseFailure: 42 },
                            { id: 'tier_2', cost: 6500000, name: 'Rapid Prototyping', baseSuccess: 55, baseFailure: 26 },
                            { id: 'tier_3', cost: 14000000, name: 'Titanium Additive Sprint', baseSuccess: 74, baseFailure: 14 },
                            { id: 'tier_4', cost: 25000000, name: 'Pinnacle Hyper-Tech', baseSuccess: 88, baseFailure: 5 },
                          ].find((t) => t.id === dynoAttemptTier)!;

                          const engBonus = hiredEngineer?.successBonus || 0;
                          const engCut = hiredEngineer?.failureReduction || 0;
                          const sciBonus = hiredScientist?.successBonus || 0;
                          const sciCut = hiredScientist?.failureReduction || 0;

                          const powerPenalty = Math.max(0, (curPower - 80) * 0.45);
                          const powerRiskBonus = Math.max(0, (curPower - 82) * 0.35);

                          const successRate = Math.round(Math.max(10, Math.min(95, selectedTierObj.baseSuccess + engBonus + sciBonus - powerPenalty)));
                          const failureRate = Math.round(Math.max(2, Math.min(65, selectedTierObj.baseFailure - engCut - sciCut + powerRiskBonus)));
                          const neutralRate = Math.max(3, 100 - successRate - failureRate);

                          return (
                            <div className="p-4 bg-neutral-900 rounded-xl border border-neutral-800 flex flex-col gap-3">
                              <div className="flex flex-col md:flex-row md:items-center justify-between text-xs font-mono gap-2">
                                <div>
                                  <span className="text-neutral-400">Current Engine Power: </span>
                                  <strong className="text-white text-sm">
                                    {curPower} {curPower >= 100 ? '★ (HYPER-SPEC)' : 'Rating'}
                                  </strong>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="text-emerald-400 font-bold">🟢 Upgrade Odds: {successRate}%</span>
                                  <span className="text-neutral-400">⚪ Neutral: {neutralRate}%</span>
                                  <span className="text-red-400 font-bold">🔴 Downgrade Risk: {failureRate}%</span>
                                </div>
                              </div>

                              {/* Visual Probability Bar */}
                              <div className="w-full h-3 rounded-full overflow-hidden flex bg-neutral-950 border border-white/5">
                                <div className="bg-emerald-500 h-full transition-all" style={{ width: `${successRate}%` }} title={`Upgrade: ${successRate}%`} />
                                <div className="bg-neutral-600 h-full transition-all" style={{ width: `${neutralRate}%` }} title={`Neutral: ${neutralRate}%`} />
                                <div className="bg-red-500 h-full transition-all" style={{ width: `${failureRate}%` }} title={`Downgrade: ${failureRate}%`} />
                              </div>

                              {/* Warning Notice if no engineers/scientists */}
                              {(!hiredEngineer || !hiredScientist) && (
                                <div className="text-[11px] text-amber-300/90 flex items-center gap-1.5 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                                  <span>
                                    ⚠️ You have not contracted both a Chief Engineer and a Principal Scientist! You face an elevated risk of engine knocking and building a worse engine.
                                  </span>
                                </div>
                              )}

                              {/* Action Button */}
                              <button
                                onClick={() => handleRunDynoAttempt(selectedTierObj.cost, selectedTierObj.name, selectedTierObj.baseSuccess, selectedTierObj.baseFailure)}
                                disabled={bankBalance < selectedTierObj.cost || dynoTestActive}
                                className={`w-full py-3.5 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer ${
                                  bankBalance >= selectedTierObj.cost && !dynoTestActive
                                    ? 'bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-400 hover:to-yellow-400 text-black shadow-orange-500/30 ring-2 ring-amber-400/50'
                                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                                }`}
                              >
                                <Flame className="w-4 h-4 text-black" />
                                <span>
                                  {dynoTestActive
                                    ? 'CALIBRATING DYNO TEST BENCH...'
                                    : bankBalance >= selectedTierObj.cost
                                    ? `RUN DYNO TEST ATTEMPT (${formatMoney(selectedTierObj.cost)})`
                                    : `INSUFFICIENT R&D FUNDS (${formatMoney(selectedTierObj.cost)} REQUIRED)`}
                                </span>
                              </button>
                            </div>
                          );
                        })()}
                      </div>

                      {/* SECTION 3: OFFICIAL OEM MANUFACTURER POWER UNITS */}
                      <div className="pt-2">
                        <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1">
                          3. Official Manufacturer Power Units (Lease or Purchase)
                        </h4>
                        <p className="text-xs text-neutral-400 mb-4">
                          Prefer proven manufacturer reliability? Contract an official FIA homologated power unit from Ferrari, Mercedes, Honda, or Ford Red Bull with direct cash payment.
                        </p>
                      </div>

                      {/* CURRENT EQUIPPED PU BANNER */}
                      {season.career.customTeam?.isWorksEngine && (
                        <div className="p-3.5 bg-gradient-to-r from-amber-950/40 to-neutral-950 border border-amber-500/40 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400 font-black text-xs">
                              WORKS PU
                            </div>
                            <div>
                              <span className="text-xs font-black text-white block">
                                {season.career.customTeam.engine}
                              </span>
                              <span className="text-[10px] text-amber-400 font-mono">
                                In-House Manufactured • Power Rating: {season.career.customTeam.enginePower || 105} {(season.career.customTeam.enginePower || 105) >= 100 ? '★ HYPER-SPEC' : ''}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-neutral-400">
                            Payroll: {formatMoney(season.career.customTeam.engineCostPerRace || 2900000)}/race
                          </span>
                        </div>
                      )}

                      {/* SUPPLIER ENGINES GRID WITH UNCAPPED RATING */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {ENGINE_OPTIONS.map((engine) => {
                          const isCurrent = season.career.customTeam?.engine === engine.name;
                          return (
                            <div
                              key={engine.id}
                              className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                                isCurrent
                                  ? 'bg-neutral-950 border-red-500 ring-2 ring-red-500/30'
                                  : 'bg-neutral-950/80 border-neutral-800 hover:border-neutral-700'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-white">{engine.name}</span>
                                    {engine.isWorksCustom && (
                                      <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-black uppercase border border-amber-500/30">
                                        Works
                                      </span>
                                    )}
                                  </div>
                                  {isCurrent && (
                                    <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-black uppercase">
                                      Equipped
                                    </span>
                                  )}
                                </div>

                                {/* UNCAPPED RATING METRICS */}
                                <div className="grid grid-cols-3 gap-2 mt-3 p-2.5 bg-neutral-900 rounded-lg text-center font-mono">
                                  <div>
                                    <span className="text-[9px] uppercase text-neutral-500 block">Power Rating</span>
                                    <span className="text-sm font-black text-cyan-400">
                                      {engine.powerRating} {engine.powerRating >= 100 ? '★' : ''}
                                    </span>
                                    <div className="w-full bg-neutral-800 h-1 rounded-full mt-1 overflow-hidden">
                                      <div
                                        className="bg-cyan-400 h-full rounded-full"
                                        style={{ width: `${Math.min(100, (engine.powerRating / 115) * 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-[9px] uppercase text-neutral-500 block">Reliability</span>
                                    <span className="text-sm font-black text-emerald-400">{engine.reliabilityRating}%</span>
                                    <div className="w-full bg-neutral-800 h-1 rounded-full mt-1 overflow-hidden">
                                      <div
                                        className="bg-emerald-400 h-full rounded-full"
                                        style={{ width: `${Math.min(100, engine.reliabilityRating)}%` }}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-[9px] uppercase text-neutral-500 block">Lease/Race</span>
                                    <span className="text-xs font-black text-amber-400 mt-0.5 block">{formatMoney(engine.costPerRace)}</span>
                                  </div>
                                </div>
                                <p className="text-xs text-neutral-400 mt-2.5 leading-relaxed">{engine.description}</p>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreviewingEngineName(engine.name);
                                    soundEngine.previewEngineRev(engine.name, () => setPreviewingEngineName(null));
                                  }}
                                  className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-cyan-400 font-bold text-xs rounded-lg border border-cyan-500/20 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                                  title={`Listen to ${engine.name} exhaust and turbo noise`}
                                >
                                  <Volume2 className={`w-3.5 h-3.5 ${previewingEngineName === engine.name ? 'animate-pulse text-amber-400' : ''}`} />
                                  <span>{previewingEngineName === engine.name ? 'Revving...' : 'Sound'}</span>
                                </button>
                                {isCurrent ? (
                                  <div className="flex-1 py-2 text-center text-xs text-emerald-400 font-bold bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                                    Active Contract
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleBuyEngine(engine)}
                                    className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <span>Contract ({formatMoney(engine.purchaseCost)})</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* SECTION: MANUFACTURE & SUPPLY ENGINES TO OTHER TEAMS (CUSTOMER PU PROGRAM) */}
                      <div className="mt-6 pt-6 border-t border-neutral-800 flex flex-col gap-5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950/40 via-neutral-950 to-neutral-950 p-5 rounded-2xl border border-emerald-500/30">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
                                <Building2 className="w-5 h-5" />
                              </span>
                              <div>
                                <h4 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                                  <span>Customer Engine Supply Program</span>
                                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-black border border-emerald-500/30">
                                    FIA ENGINE MANUFACTURER
                                  </span>
                                </h4>
                                <span className="text-xs text-emerald-400/90 font-medium block mt-0.5">
                                  Manufacture and lease your power units to other F1 constructor teams!
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-neutral-400 mt-2.5 max-w-2xl leading-relaxed">
                              Sign official PU supply agreements with customer teams across the grid. Customer teams will run your manufactured engine during Grand Prix races, inherit your top speed and acceleration performance, and pay you millions in manufacturer lease revenue every single race!
                            </p>
                          </div>

                          <div className="flex items-center gap-4 bg-neutral-950/90 p-3.5 rounded-xl border border-neutral-800 shrink-0">
                            <div>
                              <span className="text-[10px] text-neutral-500 uppercase font-bold block">Customer Teams</span>
                              <span className="text-base font-black text-white font-mono">
                                {(season.career.customTeam?.customerTeamsSupplied?.length || 0)} / {CUSTOMER_PU_OFFERS.length}
                              </span>
                            </div>
                            <div className="h-9 w-px bg-neutral-800" />
                            <div>
                              <span className="text-[10px] text-emerald-500 uppercase font-bold block">Supply Revenue / GP</span>
                              <span className="text-base font-black text-emerald-400 font-mono">
                                +{formatMoney(season.career.customTeam?.customerSupplyRevenuePerRace || 0)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Customer Teams Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {CUSTOMER_PU_OFFERS.map((offer) => {
                            const isSupplied = Boolean(
                              season.career.customTeam?.customerTeamsSupplied?.includes(offer.teamId)
                            );
                            const curPower = season.career.customTeam?.enginePower || 84;
                            const meetsPower = curPower >= offer.minPowerRequired;
                            const gridTeam = TEAMS.find((t) => t.id === offer.teamId);

                            return (
                              <div
                                key={offer.teamId}
                                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                                  isSupplied
                                    ? 'bg-emerald-950/25 border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-950/30'
                                    : 'bg-neutral-950/90 border-neutral-800 hover:border-neutral-700'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-4 h-4 rounded-full border border-white/30 shrink-0 shadow-sm"
                                        style={{ backgroundColor: gridTeam?.primaryColor || '#666' }}
                                      />
                                      <span className="font-bold text-sm text-white">{offer.teamName}</span>
                                    </div>
                                    {isSupplied && (
                                      <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded font-black uppercase flex items-center gap-1">
                                        <Check className="w-3 h-3 text-emerald-400" />
                                        Supplied
                                      </span>
                                    )}
                                  </div>

                                  <div className="mt-3 p-2.5 bg-neutral-900 rounded-lg flex flex-col gap-1.5 font-mono text-xs">
                                    <div className="flex justify-between items-center">
                                      <span className="text-neutral-400 text-[11px]">Upfront Selling Cash:</span>
                                      <span className="text-amber-400 font-black">+{formatMoney(offer.signingBonus)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-neutral-400 text-[11px]">Grand Prix Supply Fee:</span>
                                      <span className="text-emerald-400 font-black">+{formatMoney(offer.feePerRace)}/GP</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-neutral-400 text-[11px]">Min Power Required:</span>
                                      <span className={meetsPower ? 'text-cyan-400 font-bold' : 'text-amber-400 font-bold'}>
                                        {offer.minPowerRequired} {curPower >= offer.minPowerRequired ? '(Met)' : `(You: ${curPower})`}
                                      </span>
                                    </div>
                                  </div>

                                  <p className="text-xs text-neutral-400 mt-2.5 leading-relaxed">
                                    {offer.description}
                                  </p>
                                </div>

                                <div className="mt-2 pt-2 border-t border-neutral-900">
                                  {isSupplied ? (() => {
                                    const curSeason = season.career.seasonNumber || 1;
                                    const signedSeason = season.career.customTeam?.customerContractSeasons?.[offer.teamId] ?? curSeason;
                                    const isEarly = curSeason <= signedSeason;
                                    return (
                                      <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between text-[10px] font-mono">
                                          <span className={isEarly ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                                            {isEarly ? '● 1-Season Active Contract' : '✓ 1-Season Fulfilled'}
                                          </span>
                                          <span className="text-neutral-400">Signed S{signedSeason}</span>
                                        </div>
                                        {isEarly ? (
                                          <>
                                            <p className="text-[10px] text-amber-300/90 leading-tight">
                                              Must keep contract for 1 full season. Early termination requires paying back the {formatMoney(offer.signingBonus)} signing bonus.
                                            </p>
                                            <button
                                              onClick={() => handleToggleCustomerTeamPU(offer)}
                                              className="w-full py-2 bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-red-200 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                                            >
                                              <span>Terminate Early (Refund -{formatMoney(offer.signingBonus)})</span>
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            onClick={() => handleToggleCustomerTeamPU(offer)}
                                            className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                                          >
                                            <span>Conclude Contract (Fulfilled - No Penalty)</span>
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })() : (
                                    <div className="flex flex-col gap-1">
                                      <button
                                        onClick={() => handleToggleCustomerTeamPU(offer)}
                                        disabled={!meetsPower}
                                        className={`w-full py-2.5 font-black text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                          meetsPower
                                            ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 text-white shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-400/50'
                                            : 'bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-60'
                                        }`}
                                      >
                                        <CircleDollarSign className="w-4 h-4" />
                                        <span>
                                          {meetsPower
                                            ? `Sign 1-Season Contract (+${formatMoney(offer.signingBonus)} upfront)`
                                            : `Develop Engine to Power ${offer.minPowerRequired}`}
                                        </span>
                                      </button>
                                      {meetsPower && (
                                        <span className="text-[10px] text-neutral-500 text-center">
                                          1-season commitment required • Early termination refunds signing bonus
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
                    </div>
                  )}

                  {/* SUBTAB 3: TECHNICAL DIRECTORS (AERO, CHASSIS, BRAKES) */}
                  {myTeamSubTab === 'staff' && (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
                      {/* 1. Aerodynamics Staff */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <Wind className="w-4 h-4 text-cyan-400" />
                          <h4 className="font-bold text-sm text-white uppercase tracking-wider">
                            Chief Aerodynamics Staff & CFD
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {AERO_STAFF_OPTIONS.map((staff) => {
                            const isCurrent = season.career.customTeam?.aeroStaffId === staff.id;
                            return (
                              <div
                                key={staff.id}
                                className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 text-xs ${
                                  isCurrent ? 'bg-neutral-950 border-cyan-500 ring-1 ring-cyan-500/40' : 'bg-neutral-950/70 border-neutral-800'
                                }`}
                              >
                                <div>
                                  <span className="font-black text-white block">{staff.title}</span>
                                  <span className="text-[10px] text-cyan-400 font-mono">{staff.name}</span>
                                  <div className="mt-2 text-[11px] font-mono space-y-1 text-neutral-300">
                                    <div>Downforce: <strong className="text-cyan-400">+{Math.round((staff?.downforceBonus || 0) * 100)}%</strong></div>
                                    <div>Handling: <strong className="text-emerald-400">+{staff.handlingBonus} PTS</strong></div>
                                    <div>Salary: <strong className="text-amber-400">{formatMoney(staff.salaryPerRace)}/GP</strong></div>
                                  </div>
                                </div>
                                {isCurrent ? (
                                  <div className="py-1.5 text-center text-[10px] text-cyan-400 font-bold bg-cyan-500/10 rounded-lg">
                                    Hired
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleHireAeroStaff(staff)}
                                    disabled={bankBalance < staff.hiringFee}
                                    className={`py-1.5 font-bold text-[10px] rounded-lg transition-colors cursor-pointer ${
                                      bankBalance >= staff.hiringFee ? 'bg-neutral-800 hover:bg-neutral-700 text-white' : 'bg-neutral-900 text-neutral-600 cursor-not-allowed'
                                    }`}
                                  >
                                    Sign ({formatMoney(staff.hiringFee)})
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. Chassis Dynamics Staff */}
                      <div className="flex flex-col gap-3 pt-4 border-t border-neutral-800">
                        <div className="flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-emerald-400" />
                          <h4 className="font-bold text-sm text-white uppercase tracking-wider">
                            Chassis & Suspension Dynamics Directors
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {CHASSIS_ENGINEER_OPTIONS.map((chassis) => {
                            const isCurrent = season.career.customTeam?.chassisEngineerId === chassis.id;
                            return (
                              <div
                                key={chassis.id}
                                className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 text-xs ${
                                  isCurrent ? 'bg-neutral-950 border-emerald-500 ring-1 ring-emerald-500/40' : 'bg-neutral-950/70 border-neutral-800'
                                }`}
                              >
                                <div>
                                  <span className="font-black text-white block">{chassis.title}</span>
                                  <span className="text-[10px] text-emerald-400 font-mono">{chassis.name}</span>
                                  <div className="mt-2 text-[11px] font-mono space-y-1 text-neutral-300">
                                    <div>Handling: <strong className="text-emerald-400">+{chassis.handlingBonus} PTS</strong></div>
                                    <div>Grip: <strong className="text-cyan-400">+{Math.round(chassis.mechanicalGripBonus * 100)}%</strong></div>
                                    <div>Salary: <strong className="text-amber-400">{formatMoney(chassis.salaryPerRace)}/GP</strong></div>
                                  </div>
                                </div>
                                {isCurrent ? (
                                  <div className="py-1.5 text-center text-[10px] text-emerald-400 font-bold bg-emerald-500/10 rounded-lg">
                                    Hired
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleHireChassisEngineer(chassis)}
                                    disabled={bankBalance < chassis.hiringFee}
                                    className={`py-1.5 font-bold text-[10px] rounded-lg transition-colors cursor-pointer ${
                                      bankBalance >= chassis.hiringFee ? 'bg-neutral-800 hover:bg-neutral-700 text-white' : 'bg-neutral-900 text-neutral-600 cursor-not-allowed'
                                    }`}
                                  >
                                    Sign ({formatMoney(chassis.hiringFee)})
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 3. Brake Systems Staff */}
                      <div className="flex flex-col gap-3 pt-4 border-t border-neutral-800">
                        <div className="flex items-center gap-2">
                          <Gauge className="w-4 h-4 text-purple-400" />
                          <h4 className="font-bold text-sm text-white uppercase tracking-wider">
                            Brake-by-Wire & Hydraulic Brake Engineers
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {BRAKE_ENGINEER_OPTIONS.map((brakes) => {
                            const isCurrent = season.career.customTeam?.brakesEngineerId === brakes.id;
                            return (
                              <div
                                key={brakes.id}
                                className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 text-xs ${
                                  isCurrent ? 'bg-neutral-950 border-purple-500 ring-1 ring-purple-500/40' : 'bg-neutral-950/70 border-neutral-800'
                                }`}
                              >
                                <div>
                                  <span className="font-black text-white block">{brakes.title}</span>
                                  <span className="text-[10px] text-purple-400 font-mono">{brakes.name}</span>
                                  <div className="mt-2 text-[11px] font-mono space-y-1 text-neutral-300">
                                    <div>Stopping Power: <strong className="text-purple-400">+{brakes.brakesBonus} PTS</strong></div>
                                    <div>Heat Dissipation: <strong className="text-cyan-400">+{Math.round(brakes.heatResistance * 100)}%</strong></div>
                                    <div>Salary: <strong className="text-amber-400">{formatMoney(brakes.salaryPerRace)}/GP</strong></div>
                                  </div>
                                </div>
                                {isCurrent ? (
                                  <div className="py-1.5 text-center text-[10px] text-purple-400 font-bold bg-purple-500/10 rounded-lg">
                                    Hired
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleHireBrakeEngineer(brakes)}
                                    disabled={bankBalance < brakes.hiringFee}
                                    className={`py-1.5 font-bold text-[10px] rounded-lg transition-colors cursor-pointer ${
                                      bankBalance >= brakes.hiringFee ? 'bg-neutral-800 hover:bg-neutral-700 text-white' : 'bg-neutral-900 text-neutral-600 cursor-not-allowed'
                                    }`}
                                  >
                                    Sign ({formatMoney(brakes.hiringFee)})
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUBTAB 4: TITLE SPONSORS */}
                  {myTeamSubTab === 'sponsors' && (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col gap-5">
                      <div>
                        <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider">
                          Commercial Partnerships
                        </span>
                        <h3 className="text-xl font-black text-white mt-0.5">Title Sponsor Agreements</h3>
                        <p className="text-xs text-neutral-400 mt-1">
                          Sponsors provide guaranteed baseline income per race plus huge multimillion-dollar bonuses for race victories and podium finishes.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {SPONSOR_OPTIONS.map((sponsor) => {
                          const isCurrent = season.career.customTeam?.sponsorId === sponsor.id;
                          return (
                            <div
                              key={sponsor.id}
                              className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                                isCurrent ? 'bg-neutral-950 border-amber-500 ring-1 ring-amber-500/30' : 'bg-neutral-950/80 border-neutral-800'
                              }`}
                            >
                              <div>
                                <span className="font-bold text-sm text-white block">{sponsor.name}</span>
                                <span className="text-[10px] text-amber-400 uppercase font-mono font-bold">{sponsor.tier} Partner</span>
                                <div className="mt-3 p-2.5 bg-neutral-900 rounded-lg font-mono text-xs space-y-1.5 text-neutral-300">
                                  <div className="flex justify-between">
                                    <span className="text-neutral-500">Base Retainer:</span>
                                    <span className="font-bold text-emerald-400">+{formatMoney(sponsor.basePayPerRace)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-neutral-500">P1 Win Bonus:</span>
                                    <span className="font-bold text-amber-400">+{formatMoney(sponsor.winBonus)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-neutral-500">Podium Bonus:</span>
                                    <span className="font-bold text-cyan-400">+{formatMoney(sponsor.podiumBonus)}</span>
                                  </div>
                                </div>
                                <p className="text-xs text-neutral-400 mt-2 leading-relaxed">{sponsor.description}</p>
                              </div>

                              <div>
                                {isCurrent ? (
                                  <div className="py-2 text-center text-xs text-amber-400 font-bold bg-amber-500/10 rounded-lg border border-amber-500/20">
                                    Active Title Sponsor
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleSignSponsor(sponsor)}
                                    className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                                  >
                                    Sign Sponsor Agreement
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* SUBTAB 5: DRIVER MARKET, ACADEMY ROOKIE PAY-CUT NEGOTIATION & SEND OFFERS TO PLAYERS */}
                  {myTeamSubTab === 'drivers' && season.career.customTeam && (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
                      {/* 1. Active Teammate & Academy Rookie Pay-Cut Negotiation */}
                      <div className="bg-gradient-to-r from-emerald-950/35 via-neutral-950 to-neutral-950 border border-emerald-500/40 rounded-2xl p-5 flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5">
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-sm shrink-0 shadow"
                              style={{ backgroundColor: activeTeammateDriver.color }}
                            >
                              #{activeTeammateDriver.number}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-black uppercase">
                                  Active Car #2 Teammate
                                </span>
                                <span
                                  className="px-2 py-0.5 rounded text-white text-[10px] font-mono font-black uppercase shadow-sm"
                                  style={{ backgroundColor: season.career.customTeam.primaryColor }}
                                >
                                  Team: {season.career.customTeam.name}
                                </span>
                                {(season.career.customTeam.teammateDriverId === 'rookie_teammate' ||
                                  season.career.customTeam.isAcademyRookieTeammate) && (
                                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-black uppercase">
                                    ★ FIA Academy Rookie (Rating Grows on Wins!)
                                  </span>
                                )}
                              </div>
                              <h4 className="text-lg font-black text-white mt-1">
                                {activeTeammateDriver.name}{' '}
                                <span className="text-xs font-mono text-emerald-400 font-bold">
                                  ({season.career.customTeam.name})
                                </span>
                              </h4>
                              <p className="text-xs text-neutral-300 mt-0.5">
                                Live Driver Rating: <strong className="text-emerald-400">{activeTeammateDriver.rating} OVR</strong> • Current Salary: <strong className="text-amber-400">{formatMoney(season.career.customTeam.teammateSalaryPerRace ?? 220000)}/GP ({formatMoney((season.career.customTeam.teammateSalaryPerRace ?? 220000) * 10)}/yr)</strong> • Contract Term: <strong className="text-cyan-300">{season.career.customTeam.teammateContractYearsRemaining ?? 1} of {season.career.customTeam.teammateContractTotalYears ?? 1} Yr(s) Left</strong> • Team Wins: <strong className="text-white">{season.career.customTeam.teammateWins || 0}</strong> • Podiums: <strong className="text-cyan-400">{season.career.customTeam.teammatePodiums || 0}</strong>
                              </p>
                              {(() => {
                                const curS = season.career.customTeam.teammateSalaryPerRace ?? 220000;
                                const baseS = season.career.customTeam.teammateBaselineSalaryPerRace ?? 220000;
                                const saved = Math.max(0, baseS - curS);
                                return saved > 0 ? (
                                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-[11px] font-mono text-emerald-300 font-bold">
                                    <span>💰 Active Pay-Cut Savings: You pay -{formatMoney(saved)}/GP less & earn +{formatMoney(saved)}/GP (+{formatMoney(saved * 10)}/yr) extra profit!</span>
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const curSal = season.career.customTeam?.teammateSalaryPerRace ?? 220000;
                              const winsCount = season.career.customTeam?.teammateWins || 0;
                              const isRookie =
                                season.career.customTeam?.teammateDriverId === 'rookie_teammate' ||
                                Boolean(season.career.customTeam?.isAcademyRookieTeammate);
                              const minFloor = isRookie
                                ? Math.max(25000, Math.round((45000 + winsCount * 40000 + Math.max(0, activeTeammateDriver.rating - 76) * 8000) / 5000) * 5000)
                                : Math.round((curSal * 0.72) / 10000) * 10000;

                              handleOpenDriverOfferModal({
                                driverId: activeTeammateDriver.id,
                                name: activeTeammateDriver.name,
                                rating: activeTeammateDriver.rating,
                                color: activeTeammateDriver.color,
                                number: activeTeammateDriver.number,
                                isAcademyRookie: isRookie,
                                isCurrentTeammateRenegotiation: true,
                                baseSalaryDemand: curSal,
                                minSalaryFloor: minFloor,
                                signingBonusDemand: 0,
                              });
                            }}
                            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-black font-black text-xs uppercase tracking-wider cursor-pointer shrink-0 shadow-lg shadow-emerald-950/40"
                          >
                            Negotiate Pay Cut + Bonus
                          </button>
                        </div>

                        <p className="text-[11px] text-neutral-400 border-t border-neutral-800/80 pt-2.5 leading-relaxed">
                          💡 <strong className="text-neutral-200">Pay Cut & Uncapped Signing Bonus Leverage:</strong> When your teammate accepts a pay cut, their lower salary is immediately deducted from team expenses and added to your race earnings! You can offer an upfront <strong className="text-emerald-400">Signing Bonus (with no limit)</strong> during pay-cut talks to convince any teammate or CPU driver to race for as low as $0/GP.
                        </p>
                      </div>

                      {/* Released / Cut Drivers Pool (Can Join ANY Other Team on the Grid!) */}
                      {season.career.customTeam.cutFreeAgentDrivers &&
                        season.career.customTeam.cutFreeAgentDrivers.length > 0 && (
                          <div className="bg-amber-950/20 border border-amber-500/40 rounded-2xl p-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div>
                                <span className="text-[10px] font-mono uppercase font-black text-amber-400 tracking-wider block">
                                  🔄 Former {season.career.customTeam.name} Drivers · Free Agent & Grid Transfers
                                </span>
                                <h4 className="text-sm font-black text-white">
                                  Cut Drivers — Can Join Any Other Team on the Grid ({season.career.customTeam.cutFreeAgentDrivers.length})
                                </h4>
                              </div>
                              <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold">
                                Cut from {season.career.customTeam.name}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                              {season.career.customTeam.cutFreeAgentDrivers.map((freeAgent) => {
                                const discountedDemand = Math.max(
                                  30000,
                                  Math.round((freeAgent.previousSalary * 0.75) / 5000) * 5000
                                );
                                const discountedFloor = Math.max(
                                  18000,
                                  Math.round((discountedDemand * 0.6) / 5000) * 5000
                                );
                                const assignedTeamId =
                                  season.career.customTeam?.driverTeamOverrides?.[freeAgent.id] ||
                                  freeAgent.joinedTeamId;
                                const assignedTeamObj = TEAMS.find((t) => t.id === assignedTeamId);
                                return (
                                  <div
                                    key={`${freeAgent.id}_${freeAgent.name}`}
                                    className="p-3 rounded-xl bg-neutral-950 border border-amber-500/30 flex flex-col justify-between gap-2.5 text-xs"
                                  >
                                    <div className="flex items-center justify-between gap-2.5">
                                      <div className="flex items-center gap-2.5">
                                        <div
                                          className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white shrink-0"
                                          style={{ backgroundColor: assignedTeamObj?.primaryColor || freeAgent.color }}
                                        >
                                          #{freeAgent.number}
                                        </div>
                                        <div>
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-bold text-white">{freeAgent.name}</span>
                                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-mono font-black uppercase">
                                              {assignedTeamObj
                                                ? `Joined ${assignedTeamObj.name}`
                                                : `🆓 FREE AGENT (CUT R${freeAgent.cutRound})`}
                                            </span>
                                          </div>
                                          <span className="text-[10px] text-neutral-400 font-mono">
                                            Rating: <strong className="text-amber-300">{freeAgent.rating} OVR</strong> • Ask:{' '}
                                            <strong className="text-emerald-400">{formatMoney(discountedDemand)}/GP</strong>
                                          </span>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleOpenDriverOfferModal({
                                            driverId: freeAgent.id,
                                            name: freeAgent.name,
                                            rating: freeAgent.rating,
                                            color: freeAgent.color,
                                            number: freeAgent.number,
                                            isAcademyRookie: Boolean(freeAgent.isAcademyRookie),
                                            isCurrentTeammateRenegotiation: false,
                                            baseSalaryDemand: discountedDemand,
                                            minSalaryFloor: discountedFloor,
                                            signingBonusDemand: 0,
                                          })
                                        }
                                        className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/40 font-black text-[10px] uppercase tracking-wider cursor-pointer shrink-0 transition-colors"
                                      >
                                        Sign to {season.career.customTeam?.shortName}
                                      </button>
                                    </div>

                                    {/* Allow cut driver to join ANY other F1 team on the grid */}
                                    {!freeAgent.isAcademyRookie && (
                                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-800/80 text-[10px]">
                                        <span className="text-neutral-400 font-mono">New Grid Team:</span>
                                        <select
                                          value={assignedTeamId || TEAMS[0].id}
                                          onChange={(e) => {
                                            const nextTeamId = e.target.value;
                                            const nextTeamObj = TEAMS.find((t) => t.id === nextTeamId) || TEAMS[0];
                                            if (!season.career.customTeam || !onUpdateCustomTeam) return;
                                            const cTeam = season.career.customTeam;
                                            onUpdateCustomTeam({
                                              ...cTeam,
                                              driverTeamOverrides: {
                                                ...(cTeam.driverTeamOverrides || {}),
                                                [freeAgent.id]: nextTeamObj.id,
                                              },
                                              cutFreeAgentDrivers: (cTeam.cutFreeAgentDrivers || []).map((fa) =>
                                                fa.id === freeAgent.id
                                                  ? { ...fa, joinedTeamId: nextTeamObj.id, joinedTeamName: nextTeamObj.name }
                                                  : fa
                                              ),
                                            });
                                            setNotificationMsg(
                                              `Cut driver ${freeAgent.name} signed with ${nextTeamObj.name}!`
                                            );
                                          }}
                                          className="bg-neutral-900 border border-neutral-700 rounded px-2 py-0.5 text-[10px] font-bold text-white cursor-pointer"
                                        >
                                          {TEAMS.map((t) => (
                                            <option key={t.id} value={t.id}>
                                              {t.name}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                      {/* 2. Scout & Sign Cheaper Academy Rookies */}
                      <div className="flex flex-col gap-3">
                        <div>
                          <span className="text-[10px] font-black uppercase text-cyan-400 tracking-wider">
                            FIA F2 / F3 Junior Development Pool
                          </span>
                          <h3 className="text-lg font-black text-white mt-0.5">
                            Scout & Negotiate with Cheaper Academy Rookies
                          </h3>
                          <p className="text-xs text-neutral-400 mt-0.5">
                            Need to slash team expenses? Hire a cheaper Academy Rookie starting from just $45,000/race (and negotiate them down even lower!). As they win races in your car, their Driver Rating will climb.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {ACADEMY_ROOKIE_POOL.map((rookie) => {
                            const isCurrentRookie =
                              season.career.customTeam?.teammateDriverId === 'rookie_teammate' &&
                              (season.career.customTeam?.teammateCustomName || 'Luca Sterling (Academy Rookie)') ===
                                rookie.name;
                            return (
                              <div
                                key={rookie.rookieKey}
                                className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 text-xs ${
                                  isCurrentRookie
                                    ? 'bg-neutral-950 border-cyan-500 ring-1 ring-cyan-500/30'
                                    : 'bg-neutral-950/80 border-neutral-800 hover:border-neutral-700'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white shrink-0"
                                      style={{
                                        backgroundColor: isCurrentRookie
                                          ? season.career.customTeam?.primaryColor || rookie.color
                                          : rookie.color,
                                      }}
                                    >
                                      #{rookie.number}
                                    </div>
                                    <div>
                                      <span className="font-bold text-white block">{rookie.name}</span>
                                      <span className="text-[10px] text-neutral-400 font-mono">
                                        Team:{' '}
                                        <strong className={isCurrentRookie ? 'text-emerald-400' : 'text-neutral-300'}>
                                          {isCurrentRookie ? season.career.customTeam?.name : 'FIA Junior Academy'}
                                        </strong>{' '}
                                        • Rating: <strong className="text-cyan-400">{rookie.rating} OVR</strong> • Ask:{' '}
                                        <strong className="text-emerald-400">{formatMoney(rookie.salaryPerRaceDemand)}/GP</strong>
                                      </span>
                                    </div>
                                  </div>
                                  {isCurrentRookie ? (
                                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-mono font-black uppercase">
                                      ON {season.career.customTeam?.name.toUpperCase()}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[9px] font-mono font-bold">
                                      Rookie Prospect
                                    </span>
                                  )}
                                </div>

                                <p className="text-[11px] text-neutral-400 leading-relaxed">{rookie.bio}</p>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenDriverOfferModal({
                                      driverId: 'rookie_teammate',
                                      name: rookie.name,
                                      rating: isCurrentRookie ? activeTeammateDriver.rating : rookie.rating,
                                      color: rookie.color,
                                      number: rookie.number,
                                      isAcademyRookie: true,
                                      isCurrentTeammateRenegotiation: isCurrentRookie,
                                      baseSalaryDemand: rookie.salaryPerRaceDemand,
                                      minSalaryFloor: rookie.minSalaryFloor,
                                      signingBonusDemand: rookie.signingBonusDemand,
                                    })
                                  }
                                  className="w-full py-2 rounded-lg bg-neutral-800 hover:bg-cyan-500 hover:text-black text-cyan-300 font-black text-[11px] uppercase tracking-wider transition-all cursor-pointer"
                                >
                                  {isCurrentRookie
                                    ? 'Renegotiate Rookie Salary (Pay Less)'
                                    : `Negotiate & Sign Rookie (${formatMoney(rookie.salaryPerRaceDemand)}/GP)`}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 3. Send Contract Offers to Official F1 Grid Drivers */}
                      <div className="flex flex-col gap-3 pt-4 border-t border-neutral-800">
                        <div>
                          <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider">
                            Official FIA Driver Market — Send Contract Offers
                          </span>
                          <h3 className="text-xl font-black text-white mt-0.5">
                            Send Contract Offers to F1 Drivers
                          </h3>
                          <p className="text-xs text-neutral-400 mt-1">
                            As Team Owner, you can send custom salary & signing bonus offers to any driver on the grid and accept or counter their contract demands.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[440px] overflow-y-auto pr-1">
                          {DRIVERS.filter((d) => d.id !== season.selectedDriverId)
                            .sort((a, b) => {
                              const lookingIds = (
                                season.career.cpuDriversLookingForTeam || [
                                  'perez',
                                  'sainz',
                                  'tsunoda',
                                  'hulkenberg',
                                  'gasly',
                                  'lawson',
                                ]
                              ).filter((id) => id !== season.career.customTeam?.teammateDriverId);
                              const aTeammate = season.career.customTeam?.teammateDriverId === a.id ? 1 : 0;
                              const bTeammate = season.career.customTeam?.teammateDriverId === b.id ? 1 : 0;
                              if (aTeammate !== bTeammate) return bTeammate - aTeammate;
                              const aLooking = lookingIds.includes(a.id) ? 1 : 0;
                              const bLooking = lookingIds.includes(b.id) ? 1 : 0;
                              if (aLooking !== bLooking) return bLooking - aLooking;
                              return b.rating - a.rating;
                            })
                            .map((driver) => {
                              const isTeammate = season.career.customTeam?.teammateDriverId === driver.id;
                              const lookingIds = (
                                season.career.cpuDriversLookingForTeam || [
                                  'perez',
                                  'sainz',
                                  'tsunoda',
                                  'hulkenberg',
                                  'gasly',
                                  'lawson',
                                ]
                              ).filter((id) => id !== season.career.customTeam?.teammateDriverId);
                              const isCpuLookingForTeam = !isTeammate && lookingIds.includes(driver.id);
                              const drvCurrentTeam = getDriverCurrentTeam(driver);
                              const rawBaseDemand = driver.salaryPerRaceDemand || 450000;
                              const baseDemand = isCpuLookingForTeam
                                ? Math.round((rawBaseDemand * 0.85) / 10000) * 10000
                                : rawBaseDemand;
                              const bonusDemand = Math.round(baseDemand * (isCpuLookingForTeam ? 1.05 : 1.3));
                              const minSal =
                                Math.round(
                                  (rawBaseDemand * (isCpuLookingForTeam ? 0.68 : driver.contractExpiring ? 0.78 : 0.9)) /
                                    10000
                                ) * 10000;
                              return (
                                <div
                                  key={driver.id}
                                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                                    isTeammate
                                      ? 'bg-neutral-950 border-emerald-500 ring-1 ring-emerald-500/40'
                                      : isCpuLookingForTeam
                                      ? 'bg-purple-950/25 border-purple-500/50 hover:border-purple-400'
                                      : 'bg-neutral-950/70 border-neutral-800 hover:border-neutral-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0"
                                      style={{
                                        backgroundColor: isTeammate
                                          ? season.career.customTeam?.primaryColor || driver.color
                                          : drvCurrentTeam?.primaryColor || driver.color,
                                      }}
                                    >
                                      #{driver.number}
                                    </div>
                                    <div>
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-bold text-white">{driver.name}</span>
                                        {isTeammate && season.career.customTeam && (
                                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-mono font-black uppercase">
                                            ★ ON {season.career.customTeam.name.toUpperCase()}
                                          </span>
                                        )}
                                        {season.career.customTeam?.cutFreeAgentDrivers?.some(
                                          (fa) => fa.id === driver.id
                                        ) && !isTeammate && (
                                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-mono font-black uppercase">
                                            JOINED {drvCurrentTeam.name.toUpperCase()}
                                          </span>
                                        )}
                                        {isCpuLookingForTeam && !isTeammate && (
                                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-mono font-black uppercase">
                                            📢 LOOKING FOR TEAM
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-neutral-400 font-mono">
                                        Team:{' '}
                                        <strong className={isTeammate ? 'text-emerald-400' : 'text-neutral-200'}>
                                          {isTeammate && season.career.customTeam
                                            ? season.career.customTeam.name
                                            : drvCurrentTeam.name}
                                        </strong>{' '}
                                        • Rating: <strong className="text-purple-400">{driver.rating}</strong> • Ask:{' '}
                                        <strong className="text-amber-400">
                                          {formatMoney(
                                            isTeammate
                                              ? season.career.customTeam?.teammateSalaryPerRace || baseDemand
                                              : baseDemand
                                          )}
                                          /GP
                                        </strong>
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenDriverOfferModal({
                                        driverId: driver.id,
                                        name: driver.name,
                                        rating: driver.rating,
                                        color: driver.color,
                                        number: driver.number,
                                        isAcademyRookie: false,
                                        isCurrentTeammateRenegotiation: isTeammate,
                                        baseSalaryDemand: isTeammate
                                          ? season.career.customTeam?.teammateSalaryPerRace || baseDemand
                                          : baseDemand,
                                        minSalaryFloor: minSal,
                                        signingBonusDemand: isTeammate ? 0 : bonusDemand,
                                      })
                                    }
                                    className={`px-3 py-1.5 font-black text-[11px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer shrink-0 ${
                                      isTeammate
                                        ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 text-white shadow'
                                    }`}
                                  >
                                    {isTeammate ? 'Pay Cut / Bonus' : 'Send Offer'}
                                  </button>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Live Car Specs & Performance Radar */}
                <div className="flex flex-col gap-6">
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between gap-6">
                    <div>
                      <span className="text-xs uppercase font-bold tracking-wider text-neutral-400">
                        Car Performance Spec Radar
                      </span>
                      <h3 className="text-lg font-black text-white mt-1">FIA Vehicle Dynamics</h3>

                      <div className="mt-4 flex flex-col gap-3 font-mono text-xs">
                        <div>
                          <div className="flex justify-between text-neutral-400 mb-1">
                            <span>Top Speed</span>
                            <span className="font-bold text-white">
                              {formatSpeed(season.career.customTeam.engineTopSpeed || 340, unitSystem)} (Power: {season.career.customTeam.enginePower || 88} {(season.career.customTeam.enginePower || 88) >= 100 ? '★' : ''})
                            </span>
                          </div>
                          <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden border border-white/5">
                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(100, (((season.career.customTeam.engineTopSpeed || 340) - 200) / 200) * 100)}%` }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-neutral-400 mb-1">
                            <span>Downforce Grip</span>
                            <span className="font-bold text-cyan-400">
                              +{Math.round((season.career.customTeam.aeroDownforceBonus || 0.10) * 100)}% Aero
                            </span>
                          </div>
                          <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden border border-white/5">
                            <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${Math.min(100, 50 + (season.career.customTeam.aeroDownforceBonus || 0.10) * 180)}%` }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-neutral-400 mb-1">
                            <span>Handling Rotation</span>
                            <span className="font-bold text-emerald-400">
                              {80 + (season.career.customTeam.handlingBonus || 10)} {80 + (season.career.customTeam.handlingBonus || 10) >= 100 ? '★ HYPER' : 'PTS'}
                            </span>
                          </div>
                          <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden border border-white/5">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(100, ((80 + (season.career.customTeam.handlingBonus || 10)) / 120) * 100)}%` }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-neutral-400 mb-1">
                            <span>Braking Power</span>
                            <span className="font-bold text-purple-400">
                              {80 + (season.career.customTeam.brakesBonus || 10)} {80 + (season.career.customTeam.brakesBonus || 10) >= 100 ? '★ HYPER' : 'PTS'}
                            </span>
                          </div>
                          <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden border border-white/5">
                            <div className="h-full bg-purple-400 rounded-full" style={{ width: `${Math.min(100, ((80 + (season.career.customTeam.brakesBonus || 10)) / 120) * 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Livery Preview */}
                    <div>
                      <span className="text-[10px] uppercase font-bold text-neutral-400 block mb-2">Livery Livery Preview</span>
                      <div
                        className="h-28 rounded-xl p-3 flex flex-col justify-between border border-white/10 shadow-inner"
                        style={{ backgroundColor: season.career.customTeam.secondaryColor }}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-black" style={{ color: season.career.customTeam.primaryColor }}>
                            {season.career.customTeam.shortName}
                          </span>
                          <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: season.career.customTeam.accentColor }} />
                        </div>
                        <div className="text-[10px] font-mono" style={{ color: season.career.customTeam.accentColor }}>
                          PU: {season.career.customTeam.engine}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* FOUND NEW CONSTRUCTOR FORM */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
                  <div>
                    <span className="px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-xs font-bold uppercase tracking-wider">
                      Official FIA Concorde 11th Team Entry
                    </span>
                    <h2 className="text-2xl font-black text-white mt-2">Found Your Own Formula 1 Team ($200M+)</h2>
                    <p className="text-sm text-neutral-400 mt-1 leading-relaxed">
                      Become the Owner, Team Principal, and Lead Driver of the 11th team on the Formula 1 grid.
                      Under official FIA regulations, entering requires the <strong className="text-white">$200,000,000</strong> Anti-Dilution Franchise Fee plus the full upfront purchase of your power unit. <span className="text-red-400 font-bold">Financing and loans are strictly prohibited.</span>
                    </p>
                  </div>

                  <form onSubmit={handleCreateTeamSubmit} className="flex flex-col gap-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 block mb-1">
                          Official Team Name (Spaces Allowed)
                        </label>
                        <input
                          type="text"
                          value={customTeamName}
                          onChange={(e) => setCustomTeamName(e.target.value)}
                          required
                          placeholder="e.g. Apex Grand Prix"
                          className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 block mb-1">
                          Short Name / Code
                        </label>
                        <input
                          type="text"
                          value={customTeamShort}
                          onChange={(e) => setCustomTeamShort(e.target.value)}
                          required
                          maxLength={12}
                          placeholder="e.g. Apex"
                          className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                        />
                      </div>
                    </div>

                    {/* Livery Colors */}
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 block mb-2">
                        Car Livery Colors
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex items-center gap-2 bg-neutral-950 p-2.5 rounded-xl border border-neutral-800">
                          <input
                            type="color"
                            value={customPrimaryColor}
                            onChange={(e) => setCustomPrimaryColor(e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                          />
                          <span className="text-xs text-neutral-300 font-medium">Primary</span>
                        </div>
                        <div className="flex items-center gap-2 bg-neutral-950 p-2.5 rounded-xl border border-neutral-800">
                          <input
                            type="color"
                            value={customSecondaryColor}
                            onChange={(e) => setCustomSecondaryColor(e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                          />
                          <span className="text-xs text-neutral-300 font-medium">Secondary</span>
                        </div>
                        <div className="flex items-center gap-2 bg-neutral-950 p-2.5 rounded-xl border border-neutral-800">
                          <input
                            type="color"
                            value={customAccentColor}
                            onChange={(e) => setCustomAccentColor(e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                          />
                          <span className="text-xs text-neutral-300 font-medium">Accent</span>
                        </div>
                      </div>
                    </div>

                    {/* Engine Selection & Sound Preview */}
                    <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 block">
                            Select Power Unit Supplier (Paid Upfront at Entry)
                          </label>
                          <p className="text-[11px] text-neutral-500">
                            Engines are expensive full-season allocations. Different engines feature distinct sound signatures.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewingEngineName(selectedEngineOpt.name);
                            soundEngine.previewEngineRev(selectedEngineOpt.name, () => setPreviewingEngineName(null));
                          }}
                          className="self-start sm:self-auto px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-cyan-400 font-bold text-xs rounded-lg border border-cyan-500/30 flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Volume2 className={`w-3.5 h-3.5 ${previewingEngineName === selectedEngineOpt.name ? 'animate-pulse text-amber-400' : ''}`} />
                          <span>{previewingEngineName === selectedEngineOpt.name ? 'Revving Engine...' : 'Hear Engine Sound'}</span>
                        </button>
                      </div>

                      <select
                        value={customEngine}
                        onChange={(e) => setCustomEngine(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                      >
                        {ENGINE_OPTIONS.map((eng) => (
                          <option key={eng.id} value={eng.name}>
                            {eng.name} — {formatMoney(eng.purchaseCost)} upfront (Power: {eng.powerRating}, Top Speed: {formatSpeed(eng.topSpeedKmh, unitSystem)})
                          </option>
                        ))}
                      </select>

                      <div className="p-3 bg-neutral-900/60 rounded-lg border border-white/5 text-xs text-neutral-300 flex justify-between items-center">
                        <span className="text-neutral-400">Selected Engine Upfront Fee:</span>
                        <span className="font-bold text-cyan-400 font-mono text-sm">{formatMoney(selectedEngineOpt.purchaseCost)}</span>
                      </div>
                    </div>

                    {/* Starting Teammate Driver Seat */}
                    <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                          Starting Teammate (Car #2)
                        </label>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                          Academy Rookie Assigned
                        </span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-neutral-900 rounded-lg border border-white/5">
                        <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-500/40 flex items-center justify-center font-black text-emerald-400">
                          #88
                        </div>
                        <div className="flex-1">
                          <span className="font-bold text-white text-sm block">Luca Sterling (Academy Rookie)</span>
                          <span className="text-[11px] text-neutral-400">
                            Rating: 78 • Obedience: 95% • Starting Salary: $220,000 / race
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-normal">
                        Per FIA Constructor entry guidelines, new entrants start with an Academy Rookie driver in seat #2. Once your team is established, you can sign experienced drivers from the Driver Market.
                      </p>
                    </div>

                    {/* Entry Cost Breakdown & Zero Financing Enforced */}
                    <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                          FIA Financial Entry Regulations
                        </span>
                        <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                          Zero Financing / 100% Cash Required
                        </span>
                      </div>

                      <div className="flex flex-col gap-2 text-xs font-mono p-3 bg-neutral-900 rounded-lg border border-white/5">
                        <div className="flex justify-between py-1 border-b border-neutral-800">
                          <span className="text-neutral-400">FIA 11th Team Franchise Expansion Fee:</span>
                          <span className="text-white font-bold">{formatMoney(franchisePurchaseCost)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-neutral-800">
                          <span className="text-neutral-400">Power Unit Allocation ({selectedEngineOpt.name}):</span>
                          <span className="text-cyan-400 font-bold">+{formatMoney(selectedEngineOpt.purchaseCost)}</span>
                        </div>
                        <div className="flex justify-between py-1.5 text-sm font-black">
                          <span className="text-amber-400">Total 100% Cash Due Upfront:</span>
                          <span className="text-amber-400">{formatMoney(totalTeamEntryCost)}</span>
                        </div>
                      </div>

                      <div className="p-3 bg-red-950/30 border border-red-500/30 rounded-lg text-xs text-red-300 leading-relaxed">
                        <strong>⚠️ STRICT FIA CONCORDE ANTI-FINANCING RULE:</strong> Financing, bank loans, mortgages, or deferred installments are strictly prohibited. You must have the entire {formatMoney(totalTeamEntryCost)} liquid balance in your career earnings before founding.
                      </div>

                      <div className="flex items-center justify-between bg-neutral-900/80 p-3 rounded-lg border border-white/5 text-xs font-mono">
                        <span className="text-neutral-400">Your Current Liquid Bank Balance:</span>
                        <span className={`font-bold text-sm ${bankBalance >= totalTeamEntryCost ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {formatMoney(bankBalance)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={bankBalance < totalTeamEntryCost}
                      className={`w-full py-4 font-black text-sm uppercase rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                        bankBalance >= totalTeamEntryCost
                          ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 text-white shadow-red-600/30 ring-2 ring-red-400/50'
                          : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                      }`}
                    >
                      <span>
                        {bankBalance >= totalTeamEntryCost
                          ? `FOUND & ENTER FORMULA 1 CONSTRUCTOR (${formatMoney(totalTeamEntryCost)})`
                          : `INSUFFICIENT FUNDS (${formatMoney(totalTeamEntryCost)} REQUIRED IN BANK BALANCE - NO FINANCING)`}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                </div>

                {/* Livery Preview Card */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between gap-6">
                  <div>
                    <span className="text-xs uppercase font-bold tracking-wider text-neutral-400">Livery Preview</span>
                    <div
                      className="mt-3 h-40 rounded-xl p-4 flex flex-col justify-between border border-white/10 shadow-inner"
                      style={{ backgroundColor: customSecondaryColor }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xl font-black" style={{ color: customPrimaryColor }}>
                          {customTeamShort}
                        </span>
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: customAccentColor }} />
                      </div>
                      <div className="text-xs font-mono" style={{ color: customAccentColor }}>
                        FIA Ground Effect Regulations
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-neutral-950 rounded-xl border border-white/5 text-xs text-neutral-400 leading-relaxed">
                    Founding your own team unlocks complete ownership of team liveries, power unit choices, engineering staff hiring, and Constructors' World Championship grand prizes.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: STANDINGS */}
        {activeTab === 'standings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Drivers Championship */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span>World Drivers' Championship Standings</span>
              </h2>
              <div className="flex flex-col gap-2">
                {sortedDrivers.map((driver, idx) => {
                  const pts = season.driverPoints[driver.id] || 0;
                  const isPlayer = driver.id === season.selectedDriverId;
                  const isTeammateInCustomTeam = Boolean(
                    season.career.customTeam &&
                    season.career.customTeam.teammateDriverId === driver.id
                  );

                  const activeDriverTeam = getDriverCurrentTeam(driver);

                  return (
                    <div
                      key={driver.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        isPlayer
                          ? 'bg-amber-500/10 border-amber-400/40 text-amber-200 shadow-md'
                          : isTeammateInCustomTeam
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                          : 'bg-neutral-950/60 border-white/5 text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-6 font-mono font-black text-sm ${idx < 3 ? 'text-amber-400' : 'text-neutral-500'}`}>
                          {idx + 1}
                        </span>
                        <div
                          className="w-1.5 h-6 rounded-full"
                          style={{ backgroundColor: activeDriverTeam?.primaryColor || '#ffffff' }}
                        />
                        <div>
                          <p className="font-bold text-xs text-white leading-tight">
                            {isPlayer
                              ? `${season.career.driverName} (YOU)`
                              : isTeammateInCustomTeam
                              ? `${activeTeammateDriver.name} (TEAMMATE)`
                              : driver.name}
                          </p>
                          <p className="text-[10px] text-neutral-400">
                            {isTeammateInCustomTeam && season.career.customTeam
                              ? season.career.customTeam.name
                              : activeDriverTeam?.name || 'Haas'}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono font-black text-sm text-white">{pts} PTS</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Constructors Championship */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-cyan-400" />
                <span>World Constructors' Championship Standings</span>
              </h2>
              <div className="flex flex-col gap-2">
                {sortedConstructors.map((team, idx) => {
                  const pts = season.constructorPoints[team.id] || 0;
                  const isPlayerTeam = team.id === playerTeam.id;

                  return (
                    <div
                      key={team.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        isPlayerTeam
                          ? 'bg-red-500/10 border-red-400/40 text-red-200 shadow-md'
                          : 'bg-neutral-950/60 border-white/5 text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-6 font-mono font-black text-sm ${idx < 3 ? 'text-cyan-400' : 'text-neutral-500'}`}>
                          {idx + 1}
                        </span>
                        <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: team.primaryColor }} />
                        <div>
                          <p className="font-bold text-xs text-white leading-tight flex items-center gap-2">
                            <span>{team.name}</span>
                            {season.career.customTeam && team.id === season.career.customTeam.id && (
                              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                                11th Entry • Your Team
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-neutral-400">{team.engine}</p>
                        </div>
                      </div>
                      <span className="font-mono font-black text-sm text-white">{pts} PTS</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: CALENDAR */}
        {activeTab === 'calendar' && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-red-500" />
              <span>Official Grand Prix Championship Calendar</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {CIRCUITS.map((circ, idx) => {
                const isCurrent = idx === season.currentRound;
                const isCompleted = idx < season.currentRound;
                const result = season.completedRounds.find((r) => r.round === idx);

                return (
                  <div
                    key={circ.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                      isCurrent
                        ? 'bg-neutral-950 border-red-500 shadow-lg ring-1 ring-red-500/50'
                        : isCompleted
                        ? 'bg-neutral-950/80 border-emerald-500/30'
                        : 'bg-neutral-950/40 border-neutral-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase mb-1">
                        <span className="text-neutral-400">Round {idx + 1}</span>
                        {isCompleted && result ? (
                          <span className="text-emerald-400 font-bold">Finished: P{result.playerFinishedPosition}</span>
                        ) : isCurrent ? (
                          <span className="text-red-400 font-bold">NEXT GRAND PRIX</span>
                        ) : (
                          <span className="text-neutral-500">Upcoming</span>
                        )}
                      </div>
                      <h4 className="font-black text-base text-white">{circ.name}</h4>
                      <p className="text-xs text-neutral-400">{circ.location}</p>

                      {/* Unique authentic track shape for each Grand Prix */}
                      <div className="my-2 p-1 bg-neutral-900/70 rounded-lg border border-white/5">
                        <TrackLayoutPreview
                          circuit={circ}
                          height={115}
                          strokeColor={isCurrent ? '#ef4444' : isCompleted ? '#10b981' : '#38bdf8'}
                          strokeWidth={3}
                          showStartFinish={true}
                          showDirection={true}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400 font-mono">
                      <span>{formatDistance(circ.lengthKm, unitSystem)} • {circ.turns} Turns</span>
                      <button
                        onClick={() => {
                          setPracticeSelectedCircuit(circ);
                          setShowPracticeModal(true);
                        }}
                        className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-sans font-bold text-[11px] border border-amber-400/30 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Play className="w-3 h-3 fill-amber-300" />
                        <span>Practice</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 6: TROPHIES & CAREER RECORDS ACROSS SEASONS */}
        {activeTab === 'records' && (
          <div className="flex flex-col gap-6">
            {/* Header / Trophy Cabinet */}
            <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-amber-950/40 border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-700 flex items-center justify-center text-black shadow-xl shrink-0">
                  <Trophy className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono uppercase font-black">
                      Hall of Champions
                    </span>
                    <span className="text-xs text-neutral-400 font-mono">
                      Career Campaign: Season {season.career.seasonNumber || 1}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-white mt-1">
                    #{season.career.driverNumber} {season.career.driverName} — Trophy Room
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Multi-season historical accolades, FIA World Championship titles, and career race records.
                  </p>
                </div>
              </div>

              {/* Major Titles Highlights */}
              <div className="flex items-center gap-4 bg-neutral-950/80 p-4 rounded-xl border border-white/5">
                <div className="text-center">
                  <span className="text-[10px] uppercase font-bold text-amber-400 block">World Drivers' Titles</span>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <span className="text-2xl font-black text-amber-300">{season.career.championships}</span>
                  </div>
                </div>
                <div className="h-10 w-px bg-neutral-800" />
                <div className="text-center">
                  <span className="text-[10px] uppercase font-bold text-cyan-400 block">Constructors' Cups</span>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <Shield className="w-5 h-5 text-cyan-400" />
                    <span className="text-2xl font-black text-cyan-300">{season.career.constructorsChampionships || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Lifetime Statistical Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Grand Prix Wins</span>
                <span className="text-2xl font-black text-white mt-1 block">{season.career.wins}</span>
                <span className="text-[10px] text-neutral-500 font-mono">
                  {season.career.racesDriven > 0 ? `${Math.round((season.career.wins / season.career.racesDriven) * 100)}% Win Rate` : '0%'}
                </span>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Podium Finishes</span>
                <span className="text-2xl font-black text-cyan-400 mt-1 block">{season.career.podiums}</span>
                <span className="text-[10px] text-neutral-500 font-mono">
                  {season.career.racesDriven > 0 ? `${Math.round((season.career.podiums / season.career.racesDriven) * 100)}% Podium Rate` : '0%'}
                </span>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Races Driven</span>
                <span className="text-2xl font-black text-white mt-1 block">{season.career.racesDriven}</span>
                <span className="text-[10px] text-neutral-500 font-mono">{CIRCUITS.length} GPs per season</span>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Driver Rating</span>
                <span className="text-2xl font-black text-purple-400 mt-1 block">{driverRating}</span>
                <span className="text-[10px] text-neutral-500 font-mono">Max 99 Elite</span>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Paddock Reputation</span>
                <span className="text-2xl font-black text-amber-400 mt-1 block">{season.career.reputation}%</span>
                <span className="text-[10px] text-neutral-500 font-mono">Max 100% Respect</span>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Career Earnings</span>
                <span className="text-lg font-black text-emerald-400 mt-1 block truncate">
                  {formatMoney(bankBalance)}
                </span>
                <span className="text-[10px] text-neutral-500 font-mono">Total Net Balance</span>
              </div>
            </div>

            {/* Multi-Season Career Archive Table */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-white">Championship Season History Log</h3>
                  <p className="text-xs text-neutral-400">
                    Official FIA archive recording each completed world championship season throughout your career.
                  </p>
                </div>
                <span className="text-xs font-mono text-neutral-400 bg-neutral-950 px-3 py-1.5 rounded-lg border border-neutral-800">
                  Active Season: <strong className="text-white">{season.career.seasonNumber || 1}</strong>
                </span>
              </div>

              {season.career.seasonHistory && season.career.seasonHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-neutral-800 text-neutral-400 text-[10px] uppercase tracking-wider">
                        <th className="pb-3 font-bold">Season</th>
                        <th className="pb-3 font-bold">Year</th>
                        <th className="pb-3 font-bold">Constructor</th>
                        <th className="pb-3 font-bold text-center">Drivers' Cup</th>
                        <th className="pb-3 font-bold text-center">Constructors' Cup</th>
                        <th className="pb-3 font-bold text-center">Wins</th>
                        <th className="pb-3 font-bold text-center">Podiums</th>
                        <th className="pb-3 font-bold">Accolades</th>
                        <th className="pb-3 font-bold text-right">Prize Earnings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
                      {season.career.seasonHistory.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-neutral-950/40 transition-colors">
                          <td className="py-3 font-black text-white">Season {entry.seasonNumber}</td>
                          <td className="py-3 text-neutral-400">{entry.year}</td>
                          <td className="py-3 font-bold text-white">{entry.teamName}</td>
                          <td className="py-3 text-center">
                            <span className={entry.finalDriverRank === 1 ? 'text-amber-400 font-black' : 'text-neutral-300'}>
                              P{entry.finalDriverRank} ({entry.driverPoints} PTS)
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <span className={entry.constructorRank === 1 ? 'text-cyan-400 font-black' : 'text-neutral-300'}>
                              P{entry.constructorRank} ({entry.constructorPoints} PTS)
                            </span>
                          </td>
                          <td className="py-3 text-center text-white font-bold">{entry.wins}</td>
                          <td className="py-3 text-center text-cyan-400 font-bold">{entry.podiums}</td>
                          <td className="py-3">
                            <div className="flex flex-wrap items-center gap-1">
                              {entry.isWorldChampion && (
                                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-black uppercase flex items-center gap-1">
                                  <Trophy className="w-2.5 h-2.5 text-amber-400" />
                                  <span>WORLD CHAMPION</span>
                                </span>
                              )}
                              {entry.isConstructorsChampion && (
                                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[9px] font-black uppercase flex items-center gap-1">
                                  <Shield className="w-2.5 h-2.5 text-cyan-400" />
                                  <span>CONSTRUCTORS CUP</span>
                                </span>
                              )}
                              {!entry.isWorldChampion && !entry.isConstructorsChampion && (
                                <span className="text-[10px] text-neutral-500">Championship Contender</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 text-right font-black text-emerald-400">
                            {formatMoney(entry.totalEarnings)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 bg-neutral-950 rounded-xl border border-white/5 text-center flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-white text-sm">Active Championship Campaign in Progress</h4>
                  <p className="text-xs text-neutral-400 max-w-md">
                    You are currently competing in Round {season.currentRound + 1} of 10 in Season 1. When you complete Round 10 at Abu Dhabi, your full season history, championship rank, and trophy accolades will be permanently archived here!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: DEVELOPER NOTES (Dedicated Main Developer Note Page + Bottom PIN-Protected Edit) */}
        {activeTab === 'devnotes' && (
          <DeveloperNotes mode="devnotes" onNavigateTab={(t) => setActiveTab(t)} />
        )}

        {/* TAB 8: GAME UPDATES & PATCH NOTES (Dedicated Patch Notes Page + Bottom PIN-Protected Edit) */}
        {activeTab === 'patchnotes' && (
          <DeveloperNotes mode="patchnotes" onNavigateTab={(t) => setActiveTab(t)} />
        )}

        {/* TAB 9: REPORT BUGS (Anyone Can Submit · PIN Required to View Reported Bugs) */}
        {activeTab === 'bugreports' && (
          <BugReportsPage
            defaultReporterName={
              DRIVERS.find((d) => d.id === season.selectedDriverId)?.name || 'Driver'
            }
          />
        )}

        {/* TAB 10: STANDALONE METRO CITY STREET UNDERGROUND GAME */}
        {activeTab === 'metrocity' && (() => {
          const baseActiveCar =
            CITY_STREET_CARS.find((c) => c.id === citySave.selectedCarId) || CITY_STREET_CARS[0];
          const activeTrimId = citySave.activeTrimByCar?.[baseActiveCar.id] || baseActiveCar.trims[0]?.id;
          const activeCar = getEffectiveStreetCarSpec(baseActiveCar, activeTrimId);
          const activeCarColor =
            citySave.customPaintByCar?.[baseActiveCar.id] || activeCar.defaultColor;
          const ownedCars = CITY_STREET_CARS.filter((c) =>
            citySave.ownedCarIds.includes(c.id)
          );

          return (
            <div className="flex flex-col gap-6">
              {/* Standalone Game Hero Banner */}
              <div className="relative overflow-hidden rounded-3xl border-2 border-sky-500/40 bg-gradient-to-br from-slate-950 via-zinc-900 to-indigo-950/80 p-6 shadow-2xl">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex flex-col gap-2 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-sky-500 text-black font-mono font-black text-[10px] uppercase tracking-widest">
                        STANDALONE OPEN-WORLD STREET GAME
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-red-500/20 border border-red-500/40 text-red-300 font-mono font-bold text-[10px] uppercase">
                        🚨 NO TELEPORTING • NO CALLING OFF CHASES • LINE-OF-SIGHT POLICE
                      </span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                      🌆 METRO CITY: <span className="text-sky-400">STREET UNDERGROUND</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                      Explore a dense downtown metropolis packed with towering 3-tier supertall skyscrapers, 49 working traffic light intersections, civilian traffic, and MCPD Police Interceptors. Complete street contracts to earn <strong className="text-emerald-400">Street Cash ($)</strong>, build your <strong className="text-amber-300">{CITY_STREET_CARS.length}-Car Street Garage</strong> with upgradable Trim Levels, and outrun police pursuits!
                    </p>
                  </div>

                  {/* Player Street Stats & Instant Drive Out Button */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0">
                    <div className="grid grid-cols-3 gap-2.5 bg-black/50 border border-white/10 rounded-2xl p-3">
                      <div className="px-2">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 block">
                          Street Cash
                        </span>
                        <span className="text-lg font-mono font-black text-emerald-400">
                          ${citySave.streetCash.toLocaleString()}
                        </span>
                      </div>
                      <div className="px-2 border-l border-white/10">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 block">
                          Street Rep
                        </span>
                        <span className="text-lg font-mono font-black text-amber-400">
                          LVL {citySave.streetRepLevel}
                        </span>
                      </div>
                      <div className="px-2 border-l border-white/10">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 block">
                          Garage Fleet
                        </span>
                        <span className="text-lg font-mono font-black text-sky-400">
                          {citySave.ownedCarIds.length}/{CITY_STREET_CARS.length}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleLaunchMetroCityWithMission(null)}
                      className="py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400 hover:from-emerald-400 hover:to-sky-300 text-black font-black text-sm uppercase tracking-wider shadow-xl shadow-emerald-500/25 cursor-pointer transition-all flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4 fill-black" />
                      <span>DRIVE OUT INTO METRO CITY ({activeCar.name})</span>
                    </button>
                  </div>
                </div>

                {/* Currently Equipped Street Ride Showcase Bar */}
                <div className="mt-5 pt-4 border-t border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div
                      className="w-12 h-12 rounded-2xl border-2 border-white/30 shadow-lg flex items-center justify-center font-mono font-black text-xs text-white shrink-0"
                      style={{ backgroundColor: activeCarColor }}
                    >
                      {activeCar.topSpeedKmh}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono uppercase font-black text-emerald-400">
                          ACTIVE EQUIPPED STREET CAR
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono font-bold text-sky-300">
                          {activeCar.manufacturer} · {activeCar.category} · {activeCar.drivetrain}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-[10px] font-mono font-black text-rose-300">
                          {activeCar.horsepower} HP · 0-60 in {activeCar.zeroToSixtySec.toFixed(2)}s
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-white">{activeCar.name}</h3>
                      <p className="text-xs text-zinc-400">{activeCar.description}</p>
                    </div>
                  </div>

                  {/* Quick Custom Paint Swatches for Equipped Car */}
                  <div className="flex flex-wrap items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2">
                    <span className="text-[10px] font-mono uppercase text-zinc-400 mr-1">
                      Custom Paint:
                    </span>
                    {[
                      '#ef4444',
                      '#f97316',
                      '#facc15',
                      '#10b981',
                      '#06b6d4',
                      '#3b82f6',
                      '#a855f7',
                      '#ec4899',
                      '#f8fafc',
                      '#18181b',
                    ].map((swatch) => (
                      <button
                        key={swatch}
                        type="button"
                        onClick={() => handlePaintMetroCar(baseActiveCar.id, swatch)}
                        className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                          activeCarColor.toLowerCase() === swatch.toLowerCase()
                            ? 'scale-125 border-white ring-2 ring-sky-400'
                            : 'border-white/30 hover:scale-110'
                        }`}
                        style={{ backgroundColor: swatch }}
                        title={`Paint ${activeCar.name} ${swatch}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Sub-Navigation: My Street Garage | 21-Car Exotic Dealership | Street Contracts & Missions */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/90 border border-white/10 rounded-2xl p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCityHubSubTab('garage')}
                    className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                      cityHubSubTab === 'garage'
                        ? 'bg-emerald-500 text-black shadow-lg'
                        : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <span>🏠 My Street Garage ({ownedCars.length} Owned)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCityHubSubTab('dealership')}
                    className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                      cityHubSubTab === 'dealership'
                        ? 'bg-sky-400 text-black shadow-lg'
                        : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <span>🏎️ Metro Auto Dealership (All {CITY_STREET_CARS.length} Real-World Cars)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCityHubSubTab('missions')}
                    className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                      cityHubSubTab === 'missions'
                        ? 'bg-amber-400 text-black shadow-lg'
                        : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <span>🎯 Street Contracts & Missions ({CITY_MISSIONS_CATALOG.length})</span>
                  </button>
                </div>

                <span className="text-[11px] font-mono text-zinc-400 px-3">
                  Completed Contracts: <strong className="text-white">{citySave.completedMissions}</strong>
                </span>
              </div>

              {/* SUB-TAB 1: MY STREET GARAGE */}
              {cityHubSubTab === 'garage' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-black text-white">Your Personal Street Garage & Trim Tuning</h2>
                      <p className="text-xs text-zinc-400">
                        Select any owned street car to equip it, upgrade or switch its Trim Level, customize its paint finish, and drive it directly out into Metro City.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCityHubSubTab('dealership')}
                      className="px-4 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-300 font-black text-xs uppercase cursor-pointer"
                    >
                      + Buy More Cars at Dealership
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ownedCars.map((car) => {
                      const isEquipped = citySave.selectedCarId === car.id;
                      const carActiveTrimId = citySave.activeTrimByCar?.[car.id] || car.trims[0]?.id;
                      const carUnlockedTrims = citySave.unlockedTrimsByCar?.[car.id] || (car.trims[0] ? [car.trims[0].id] : []);
                      const eff = getEffectiveStreetCarSpec(car, carActiveTrimId);
                      const paintHex = citySave.customPaintByCar?.[car.id] || eff.defaultColor;
                      return (
                        <div
                          key={car.id}
                          className={`rounded-2xl p-5 border transition-all flex flex-col justify-between gap-4 ${
                            isEquipped
                              ? 'bg-emerald-950/35 border-emerald-400/70 ring-1 ring-emerald-400/40 shadow-xl'
                              : 'bg-zinc-900/90 border-white/10 hover:border-white/25'
                          }`}
                        >
                          <div className="flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <span
                                  className="w-10 h-10 rounded-xl border-2 border-white/30 shadow-inner shrink-0"
                                  style={{ backgroundColor: paintHex }}
                                />
                                <div>
                                  <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold block">
                                    {car.manufacturer} • {car.category} • {car.drivetrain}
                                  </span>
                                  <h3 className="text-base font-black text-white">{eff.name}</h3>
                                </div>
                              </div>
                              {isEquipped && (
                                <span className="px-2 py-0.5 rounded bg-emerald-400 text-black font-mono font-black text-[10px] uppercase">
                                  EQUIPPED
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] font-mono text-purple-300 font-bold">{car.engineLayout}</p>
                            <p className="text-xs text-zinc-400 leading-relaxed">{eff.description}</p>

                            {/* Real-World Spec Badges */}
                            <div className="grid grid-cols-3 gap-2 bg-black/40 p-3 rounded-xl border border-white/5 text-[11px] font-mono text-center">
                              <div>
                                <span className="text-zinc-500 block text-[9px]">HORSEPOWER</span>
                                <span className="text-rose-300 font-black">{eff.horsepower} HP</span>
                              </div>
                              <div>
                                <span className="text-zinc-500 block text-[9px]">0–60 MPH</span>
                                <span className="text-amber-300 font-black">{eff.zeroToSixtySec.toFixed(2)}s</span>
                              </div>
                              <div>
                                <span className="text-zinc-500 block text-[9px]">TOP SPEED</span>
                                <span className="text-sky-300 font-black">{eff.topSpeedKmh} KM/H</span>
                              </div>
                            </div>

                            {/* Trim Levels */}
                            <div className="flex flex-col gap-1.5 pt-2 border-t border-white/10">
                              <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold">
                                🔧 Select or Upgrade Trim Level:
                              </span>
                              {car.trims.map((trim) => {
                                const isTrimActive = carActiveTrimId === trim.id;
                                const isTrimOwned = carUnlockedTrims.includes(trim.id) || trim.upgradePrice === 0;
                                const canAffordTrim = citySave.streetCash >= trim.upgradePrice;
                                return (
                                  <button
                                    key={trim.id}
                                    type="button"
                                    onClick={() => handleBuyOrSelectMetroCarTrim(car.id, trim.id)}
                                    disabled={!isTrimOwned && !canAffordTrim}
                                    className={`w-full px-3 py-1.5 rounded-xl border text-left flex items-center justify-between gap-2 text-xs font-mono transition-all cursor-pointer ${
                                      isTrimActive
                                        ? 'bg-emerald-500/20 border-emerald-400 text-white font-black'
                                        : isTrimOwned
                                        ? 'bg-black/50 hover:bg-zinc-800 border-emerald-500/30 text-zinc-200'
                                        : canAffordTrim
                                        ? 'bg-black/50 hover:bg-amber-500/15 border-amber-500/30 text-zinc-200'
                                        : 'bg-black/30 border-white/5 text-zinc-500 cursor-not-allowed'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="truncate font-bold">{trim.name}</div>
                                      <div className="text-[10px] text-zinc-400">
                                        {trim.horsepower} HP · {trim.zeroToSixtySec.toFixed(2)}s · {trim.topSpeedKmh} km/h
                                      </div>
                                    </div>
                                    <span className="px-2 py-0.5 rounded bg-black/60 text-[10px] font-black shrink-0">
                                      {isTrimActive
                                        ? '✓ ACTIVE'
                                        : isTrimOwned
                                        ? 'EQUIP'
                                        : `+$${trim.upgradePrice.toLocaleString()}`}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                            <button
                              type="button"
                              onClick={() => handleBuyOrEquipMetroCar(car.id)}
                              className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider cursor-pointer transition-all ${
                                isEquipped
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-white hover:bg-zinc-200 text-black'
                              }`}
                            >
                              {isEquipped ? '✓ Currently Equipped' : 'Equip Car'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleBuyOrEquipMetroCar(car.id);
                                handleLaunchMetroCityWithMission(null);
                              }}
                              className="py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-black text-xs uppercase tracking-wider cursor-pointer transition-all"
                            >
                              Drive Now →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SUB-TAB 2: 21-CAR EXOTIC AUTO DEALERSHIP */}
              {cityHubSubTab === 'dealership' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-black text-white">
                        Metro City Auto Dealership — All {CITY_STREET_CARS.length} Real-World Cars & Trims
                      </h2>
                      <p className="text-xs text-zinc-400">
                        Start free in a Honda Civic or Toyota Camry and work your way up through JDM legends (Supra Mk4/Mk5, Skyline GT-R R34 & Z-Tune, GT-R R35), V8 muscle, Escalade-V, McMurtry Spéirling, Rimac Nevera, Bugatti Chiron Super Sport, and the #1 most expensive Koenigsegg Jesko Absolut!
                      </p>
                    </div>
                    <div className="px-4 py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 font-mono text-xs text-emerald-300 font-black">
                      Available Street Cash: ${citySave.streetCash.toLocaleString()}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {CITY_STREET_CARS.map((car) => {
                      const isOwned = citySave.ownedCarIds.includes(car.id);
                      const isEquipped = citySave.selectedCarId === car.id;
                      const carActiveTrimId = citySave.activeTrimByCar?.[car.id] || car.trims[0]?.id;
                      const carUnlockedTrims = citySave.unlockedTrimsByCar?.[car.id] || (car.trims[0] ? [car.trims[0].id] : []);
                      const eff = getEffectiveStreetCarSpec(car, carActiveTrimId);
                      const canAfford = citySave.streetCash >= car.price;
                      const paintHex = citySave.customPaintByCar?.[car.id] || eff.defaultColor;

                      return (
                        <div
                          key={car.id}
                          className={`rounded-2xl p-5 border transition-all flex flex-col justify-between gap-4 ${
                            isEquipped
                              ? 'bg-emerald-950/35 border-emerald-400/70 ring-1 ring-emerald-400/40'
                              : isOwned
                              ? 'bg-zinc-900/95 border-sky-500/40'
                              : 'bg-zinc-900/75 border-white/10 hover:border-white/25'
                          }`}
                        >
                          <div className="flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <span
                                  className="w-10 h-10 rounded-xl border-2 border-white/30 shadow-inner shrink-0"
                                  style={{ backgroundColor: paintHex }}
                                />
                                <div>
                                  <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold block">
                                    {car.manufacturer} • {car.category} • {car.drivetrain}
                                  </span>
                                  <h3 className="text-base font-black text-white">{eff.name}</h3>
                                </div>
                              </div>
                              <span
                                className={`px-2.5 py-1 rounded-lg font-mono font-black text-xs shrink-0 ${
                                  isOwned
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : canAfford
                                    ? 'bg-amber-400 text-black'
                                    : 'bg-zinc-800 text-zinc-400'
                                }`}
                              >
                                {isOwned ? 'OWNED' : car.price === 0 ? 'FREE' : `$${car.price.toLocaleString()}`}
                              </span>
                            </div>

                            <p className="text-[11px] font-mono text-purple-300 font-bold">{car.engineLayout}</p>
                            <p className="text-xs text-zinc-400 leading-relaxed">{eff.description}</p>

                            <div className="grid grid-cols-3 gap-2 bg-black/40 p-3 rounded-xl border border-white/5 text-[11px] font-mono text-center">
                              <div>
                                <span className="text-zinc-500 block text-[9px]">POWER</span>
                                <span className="text-rose-300 font-black">{eff.horsepower} HP</span>
                              </div>
                              <div>
                                <span className="text-zinc-500 block text-[9px]">0–60 MPH</span>
                                <span className="text-amber-300 font-black">{eff.zeroToSixtySec.toFixed(2)}s</span>
                              </div>
                              <div>
                                <span className="text-zinc-500 block text-[9px]">TOP SPEED</span>
                                <span className="text-sky-300 font-black">{eff.topSpeedKmh} KM/H</span>
                              </div>
                            </div>

                            {/* Trim Levels */}
                            <div className="flex flex-col gap-1.5 pt-2 border-t border-white/10">
                              <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold">
                                🔧 Trim Levels ({car.trims.length}):
                              </span>
                              {car.trims.map((trim) => {
                                const isTrimActive = carActiveTrimId === trim.id;
                                const isTrimOwned = isOwned && (carUnlockedTrims.includes(trim.id) || trim.upgradePrice === 0);
                                const trimTotalCost = (isOwned ? 0 : car.price) + trim.upgradePrice;
                                const canAffordTrim = citySave.streetCash >= trimTotalCost;
                                return (
                                  <button
                                    key={trim.id}
                                    type="button"
                                    onClick={() => handleBuyOrSelectMetroCarTrim(car.id, trim.id)}
                                    disabled={!isTrimOwned && !canAffordTrim}
                                    className={`w-full px-3 py-1.5 rounded-xl border text-left flex items-center justify-between gap-2 text-xs font-mono transition-all cursor-pointer ${
                                      isTrimActive
                                        ? 'bg-sky-500/20 border-sky-400 text-white font-black'
                                        : isTrimOwned
                                        ? 'bg-black/50 hover:bg-zinc-800 border-emerald-500/30 text-zinc-200'
                                        : canAffordTrim
                                        ? 'bg-black/50 hover:bg-amber-500/15 border-amber-500/30 text-zinc-200'
                                        : 'bg-black/30 border-white/5 text-zinc-500 cursor-not-allowed'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="truncate font-bold">{trim.name}</div>
                                      <div className="text-[10px] text-zinc-400">
                                        {trim.horsepower} HP · {trim.zeroToSixtySec.toFixed(2)}s · {trim.topSpeedKmh} km/h
                                      </div>
                                    </div>
                                    <span className="px-2 py-0.5 rounded bg-black/60 text-[10px] font-black shrink-0">
                                      {isTrimActive
                                        ? '✓ ACTIVE'
                                        : isTrimOwned
                                        ? 'EQUIP'
                                        : trim.upgradePrice === 0 && car.price === 0
                                        ? 'FREE'
                                        : `+$${trim.upgradePrice.toLocaleString()}`}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={!isOwned && !canAfford}
                            onClick={() => handleBuyOrEquipMetroCar(car.id)}
                            className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                              isEquipped
                                ? 'bg-emerald-500 text-black'
                                : isOwned
                                ? 'bg-sky-500 hover:bg-sky-400 text-black'
                                : canAfford
                                ? 'bg-gradient-to-r from-amber-400 to-emerald-400 hover:from-amber-300 hover:to-emerald-300 text-black shadow-lg'
                                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                            }`}
                          >
                            {isEquipped
                              ? '✓ Equipped in Garage'
                              : isOwned
                              ? 'Equip This Car'
                              : canAfford
                              ? car.price === 0
                                ? 'Claim Free Starter Car'
                                : `Buy Base Car ($${car.price.toLocaleString()})`
                              : `Need $${(car.price - citySave.streetCash).toLocaleString()} More Street Cash`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SUB-TAB 3: STREET CONTRACTS & MISSIONS DISPATCHER */}
              {cityHubSubTab === 'missions' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-black text-white">
                        Metro City Street Contracts & Cash Missions
                      </h2>
                      <p className="text-xs text-zinc-400">
                        Pick any contract below to launch directly into Metro City with that mission active on your GPS radar!
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {CITY_MISSIONS_CATALOG.map((mission) => (
                      <div
                        key={mission.id}
                        className="rounded-2xl p-5 bg-zinc-900/90 border border-amber-500/30 hover:border-amber-400/70 transition-all flex flex-col justify-between gap-4 shadow-lg"
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono font-black text-[10px] uppercase">
                              {mission.type.toUpperCase()} CONTRACT • {mission.timeLimitSec}s LIMIT
                            </span>
                            <span className="text-base font-mono font-black text-emerald-400">
                              +${mission.rewardCash.toLocaleString()} CASH
                            </span>
                          </div>
                          <h3 className="text-lg font-black text-white">{mission.title}</h3>
                          <p className="text-xs text-zinc-300 leading-relaxed">{mission.description}</p>
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono text-zinc-400">
                            <span>📍 Checkpoints: <strong className="text-white">{mission.waypoints.length}</strong></span>
                            <span>•</span>
                            <span>
                              🚨 Heat Level:{' '}
                              <strong className={mission.triggerWantedStars ? 'text-red-400' : 'text-emerald-400'}>
                                {mission.triggerWantedStars ? `Triggers ★${mission.triggerWantedStars} Police Pursuit` : 'Clean Legal Run'}
                              </strong>
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleLaunchMetroCityWithMission(mission.id)}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-black font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                          <Play className="w-4 h-4 fill-black" />
                          <span>Accept Contract & Drive Out ({activeCar.name})</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </main>

      {/* Contract Negotiation & Confirmation Modal */}
      {selectedOffer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-700 max-w-xl w-full rounded-2xl p-6 shadow-2xl flex flex-col gap-4 my-auto">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-lg shrink-0"
                  style={{ backgroundColor: selectedOffer.team.primaryColor }}
                >
                  {selectedOffer.team.shortName.substring(0, 3)}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-400 block">
                    {selectedOffer.isHeadhunterOffer
                      ? selectedOffer.offerTitle || 'Direct Headhunter Proposal'
                      : 'FIA Contract Negotiation Table'}
                  </span>
                  <h3 className="text-xl font-black text-white">{selectedOffer.team.name}</h3>
                  <span className="text-[11px] text-neutral-400 font-mono">
                    Constructor Performance Tier {selectedOffer.team.performanceTier} • PU: {selectedOffer.team.engine}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Team Patience</span>
                <div className="flex items-center gap-1 justify-end mt-1">
                  {[1, 2, 3, 4].map((dot) => (
                    <span
                      key={dot}
                      className={`w-2.5 h-2.5 rounded-full ${
                        dot <= negotiationPatience ? 'bg-emerald-400' : 'bg-neutral-800'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Active Approved Contract Terms */}
            <div className="bg-neutral-950 p-4 rounded-xl border border-white/5 flex flex-col gap-2 text-xs">
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-400">Contract Duration & Total Value:</span>
                <span className="font-black text-emerald-400 text-sm">
                  {formatMoney(selectedOffer.salary * 10 * (counterContractYears || selectedOffer.contractYears || 1))} for {counterContractYears || selectedOffer.contractYears || 1} Year{(counterContractYears || selectedOffer.contractYears || 1) > 1 ? 's' : ''} ({counterContractYears || selectedOffer.contractYears || 1} Season{(counterContractYears || selectedOffer.contractYears || 1) > 1 ? 's' : ''})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-400">Approved Annual Salary (10-Race Season):</span>
                <span className="font-black text-amber-400 text-sm">{formatMoney(selectedOffer.salary * 10)} / year</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-400">Approved Salary Per Race:</span>
                <span className="font-bold text-cyan-400">{formatMoney(selectedOffer.salary)} / race</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-400">Approved Signing Bonus:</span>
                <span className="font-bold text-emerald-400">+{formatMoney(selectedOffer.signingBonus)}</span>
              </div>
              {selectedOffer.buyoutFee > 0 && (
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">Mid-Season Buyout Fee:</span>
                  <span className="font-bold text-red-400">-{formatMoney(selectedOffer.buyoutFee)}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-400">Seat Status:</span>
                <span className="font-bold text-neutral-300">
                  {selectedOffer.isCurrentTeamRenegotiation
                    ? `Current Team Contract Renegotiation (${selectedOffer.team.name})`
                    : `Displaces ${selectedOffer.displacedDriverName}`}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-400">Bank Balance after signing:</span>
                <span className="font-bold text-white">
                  {formatMoney(bankBalance - selectedOffer.buyoutFee + selectedOffer.signingBonus)}
                </span>
              </div>
              {selectedOffer.isProveItDeal && (
                <div className="mt-2 p-2.5 rounded-xl bg-red-950/50 border border-red-500/50 text-[11px] text-red-200 leading-relaxed">
                  <strong className="text-red-400 block uppercase font-mono text-[10px]">
                    ⚠️ HIGH-RISK PROVE-IT CONTRACT CLAUSE (SINGLE-RACE CUT RISK):
                  </strong>
                  If you finish worse than{' '}
                  <strong className="text-white">
                    P{selectedOffer.team.performanceTier === 1 ? 10 : selectedOffer.team.performanceTier === 2 ? 13 : 15}
                  </strong>{' '}
                  even in <strong className="text-white">one single race</strong>, {selectedOffer.team.name} can immediately CUT you—leaving you with either a rock-bottom offer from a really bad team or <strong className="text-red-300">nobody signing you at all</strong>!
                </div>
              )}
            </div>

            {/* Interactive Contract Negotiation Controls */}
            {selectedOffer.meetsRating &&
              selectedOffer.meetsWins &&
              selectedOffer.meetsPodiums &&
              selectedOffer.canAffordBuyout && (
                <div className="bg-neutral-950/90 border border-amber-500/30 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4" />
                      <span>
                        {selectedOffer.isCurrentTeamRenegotiation
                          ? 'Renegotiate Salary, Duration & Bonus'
                          : 'Negotiate Contract Terms (Counter-Offer)'}
                      </span>
                    </span>
                    <span className="text-[10px] font-mono text-neutral-400">
                      Your Rating: <strong className="text-white">{driverRating} OVR</strong> • Cups: <strong className="text-amber-400">{careerCups}</strong>
                    </span>
                  </div>

                  {negotiationFeedback && (
                    <div
                      className={`p-2.5 rounded-lg text-[11px] leading-relaxed border ${
                        negotiationStatus === 'accepted'
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                          : negotiationStatus === 'walked_away'
                          ? 'bg-red-950/40 border-red-500/40 text-red-300'
                          : negotiationStatus === 'countered'
                          ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                      }`}
                    >
                      {negotiationFeedback}
                    </div>
                  )}

                  {negotiationStatus !== 'walked_away' && (
                    <>
                      {/* Contract Duration Selector (1, 2, or 3 Years / Seasons + Quick Prove-It / $3M 1-Yr Presets) */}
                      <div className="flex flex-col gap-1.5 pb-2 border-b border-neutral-800/80">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-400 font-bold">Contract Period (Years / Seasons)</span>
                          <span className="font-mono font-black text-amber-400">
                            {counterContractYears} Year{counterContractYears > 1 ? 's' : ''} ({formatMoney(counterSalaryPerRace * 10 * counterContractYears)} Total)
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { yrs: 1, label: '1 Year (1 Season)' },
                            { yrs: 2, label: '2 Years (2 Seasons)' },
                            { yrs: 3, label: '3 Years (3 Seasons)' },
                          ].map((opt) => (
                            <button
                              key={opt.yrs}
                              type="button"
                              onClick={() => {
                                setCounterContractYears(opt.yrs);
                                setSelectedOffer({
                                  ...selectedOffer,
                                  contractYears: opt.yrs,
                                });
                              }}
                              className={`py-2 px-2 rounded-lg font-black text-[11px] uppercase tracking-wider border transition-all cursor-pointer ${
                                counterContractYears === opt.yrs
                                  ? 'bg-amber-400 text-black border-amber-300 shadow'
                                  : 'bg-neutral-900 text-neutral-300 border-neutral-700 hover:bg-neutral-800'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setCounterContractYears(1);
                              setCounterSalaryPerRace(100000);
                              setCounterSigningBonus(100000);
                            }}
                            className="px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-emerald-500/30 text-[10px] font-bold text-emerald-300 cursor-pointer"
                          >
                            1-Season Low Prove-It ($1M / 1 Yr)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCounterContractYears(1);
                              setCounterSalaryPerRace(300000);
                              setCounterSigningBonus(250000);
                            }}
                            className="px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-cyan-500/30 text-[10px] font-bold text-cyan-300 cursor-pointer"
                          >
                            $3,000,000 for 1 Year ($300K/GP)
                          </button>
                          {(careerCups >= 1 || careerWins >= 1 || driverRating >= 80) && (
                            <button
                              type="button"
                              onClick={() => {
                                setCounterSalaryPerRace(maxNegotiableSalary);
                                setCounterSigningBonus(maxNegotiableBonus);
                              }}
                              className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-[10px] font-black text-amber-300 cursor-pointer"
                            >
                              ★ Demand Max Proven Raise ({formatMoney(maxNegotiableSalary * 10)}/yr)
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-400 font-bold">Counter Salary / Race (Annual: {formatMoney(counterSalaryPerRace * 10)}/yr)</span>
                          <span className="font-mono font-black text-cyan-400">{formatMoney(counterSalaryPerRace)} / GP</span>
                        </div>
                        <input
                          type="range"
                          min={Math.max(50000, Math.round(selectedOffer.salary * 0.5))}
                          max={Math.max(selectedOffer.salary * 2.2, maxNegotiableSalary * 1.35)}
                          step={25000}
                          value={counterSalaryPerRace}
                          onChange={(e) => setCounterSalaryPerRace(Number(e.target.value))}
                          className="w-full accent-amber-400 cursor-pointer"
                        />
                        <div className="flex items-center gap-1.5">
                          {[
                            { label: '+10% Salary', mult: 1.1 },
                            { label: '+25% Salary', mult: 1.25 },
                            { label: '+50% Salary', mult: 1.5 },
                          ].map((btn) => (
                            <button
                              key={btn.label}
                              type="button"
                              onClick={() =>
                                setCounterSalaryPerRace(
                                  Math.round((selectedOffer.salary * btn.mult) / 25000) * 25000
                                )
                              }
                              className="px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-[10px] font-bold text-neutral-300 cursor-pointer"
                            >
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-800/80">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-400 font-bold">Counter Signing Bonus</span>
                          <span className="font-mono font-black text-emerald-400">+{formatMoney(counterSigningBonus)}</span>
                        </div>
                        <input
                          type="range"
                          min={Math.max(50000, Math.round(selectedOffer.signingBonus * 0.5))}
                          max={Math.max(selectedOffer.signingBonus * 2.2, maxNegotiableBonus * 1.35)}
                          step={50000}
                          value={counterSigningBonus}
                          onChange={(e) => setCounterSigningBonus(Number(e.target.value))}
                          className="w-full accent-emerald-400 cursor-pointer"
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-2">
                        <button
                          type="button"
                          onClick={handleProposeCounterOffer}
                          className="flex-1 w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                        >
                          Propose Counter ({formatMoney(counterSalaryPerRace * 10 * counterContractYears)} / {counterContractYears}yr + {formatMoney(counterSigningBonus)} Bonus)
                        </button>

                        {negotiationStatus === 'countered' && (
                          <button
                            type="button"
                            onClick={handleAcceptTeamCounterOffer}
                            className="flex-1 w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-1.5"
                          >
                            <Check className="w-4 h-4" />
                            <span>Accept Team's Counter ({formatMoney(selectedOffer.salary * 10)}/yr)</span>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

            {/* Custom Team Owner Notice Inside Negotiation Modal */}
            {season.career.customTeam && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 flex items-center justify-between gap-3">
                <span>
                  You have negotiated terms with <strong className="text-white">{selectedOffer.team.name}</strong> without selling your team! To finalize & sign this contract, you must sell <strong className="text-white">{season.career.customTeam.name}</strong> (+$210M).
                </span>
              </div>
            )}

            {/* Eligibility warnings */}
            <div className="flex flex-col gap-1 text-xs">
              {!selectedOffer.canAffordBuyout && (
                <p className="text-red-400 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>Insufficient funds to pay the FIA mid-season buyout fee!</span>
                </p>
              )}
              {!selectedOffer.meetsRating && (
                <p className="text-red-400 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>Driver rating too low (Requires: {selectedOffer.minRating}, You have: {driverRating}).</span>
                </p>
              )}
              {!selectedOffer.meetsWins && (
                <p className="text-red-400 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>Requires at least {selectedOffer.minWins} Grand Prix Win(s) (You have: {careerWins}).</span>
                </p>
              )}
              {!selectedOffer.meetsPodiums && (
                <p className="text-red-400 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>Requires at least {selectedOffer.minPodiums} Career Podium(s) (You have: {careerPodiums}).</span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={() => setSelectedOffer(null)}
                className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                {negotiationStatus === 'walked_away' ? 'Close' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmContract}
                disabled={
                  negotiationStatus === 'walked_away' ||
                  !selectedOffer.canAffordBuyout ||
                  !selectedOffer.meetsRating ||
                  !selectedOffer.meetsWins ||
                  !selectedOffer.meetsPodiums
                }
                className={`flex-1 py-2.5 font-black uppercase tracking-wider rounded-xl text-xs transition-all cursor-pointer ${
                  negotiationStatus !== 'walked_away' &&
                  selectedOffer.canAffordBuyout &&
                  selectedOffer.meetsRating &&
                  selectedOffer.meetsWins &&
                  selectedOffer.meetsPodiums
                    ? season.career.customTeam
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-black shadow-lg shadow-amber-500/25'
                      : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 text-white shadow-lg shadow-red-600/25'
                    : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                }`}
              >
                {season.career.customTeam
                  ? `Sell Team ($210M) & Accept (${formatMoney(selectedOffer.salary * 10)}/yr · ${counterContractYears || selectedOffer.contractYears || 1}yr)`
                  : selectedOffer.isCurrentTeamRenegotiation
                  ? `Lock In New Contract (${formatMoney(selectedOffer.salary * 10 * (counterContractYears || selectedOffer.contractYears || 1))} / ${counterContractYears || selectedOffer.contractYears || 1}yr)`
                  : `Accept & Sign (${formatMoney(selectedOffer.salary * 10 * (counterContractYears || selectedOffer.contractYears || 1))} / ${counterContractYears || selectedOffer.contractYears || 1}yr)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Owner -> Send Contract Offer / Negotiate with Academy Rookie Modal */}
      {driverOfferModal && season.career.customTeam && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-700 max-w-lg w-full rounded-2xl p-6 shadow-2xl flex flex-col gap-4 my-auto">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-white text-sm shrink-0"
                  style={{ backgroundColor: driverOfferModal.color }}
                >
                  #{driverOfferModal.number}
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase font-black text-purple-400 block">
                    {driverOfferModal.isCurrentTeammateRenegotiation
                      ? 'Teammate Pay-Cut Renegotiation'
                      : driverOfferModal.isAcademyRookie
                      ? 'FIA Academy Rookie Contract Negotiation'
                      : `${season.career.customTeam.name} Driver Contract Offer`}
                  </span>
                  <h3 className="text-lg font-black text-white">{driverOfferModal.name}</h3>
                  <span className="text-xs text-neutral-400 font-mono">
                    Driver Rating: <strong className="text-emerald-400">{driverOfferModal.rating} OVR</strong>
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Driver Patience</span>
                <div className="flex items-center gap-1 justify-end mt-1">
                  {[1, 2, 3, 4].map((dot) => (
                    <span
                      key={dot}
                      className={`w-2.5 h-2.5 rounded-full ${
                        dot <= driverOfferModal.patience ? 'bg-emerald-400' : 'bg-neutral-800'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Warning Banner if signing a NEW driver will cut your current driver into Free Agency */}
            {!driverOfferModal.isCurrentTeammateRenegotiation && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 flex items-start gap-2.5 text-xs text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-black uppercase text-amber-400 block text-[10px] tracking-wider">
                    ⚠️ Roster Cut & Free Agency Warning
                  </span>
                  <span>
                    Signing <strong>{driverOfferModal.name}</strong> will immediately <strong>CUT {activeTeammateDriver.name}</strong> from {season.career.customTeam.name}, making <strong>{activeTeammateDriver.name}</strong> an unemployed <strong>Free Agent</strong>!
                  </span>
                </div>
              </div>
            )}

            <div className="bg-neutral-950 p-3.5 rounded-xl border border-white/5 text-xs flex flex-col gap-1.5">
              <div className="flex justify-between">
                <span className="text-neutral-400">Standard Salary Demand:</span>
                <span className="font-black text-amber-400">
                  {formatMoney(driverOfferModal.currentOrDemandedSalary)} / race ({formatMoney(driverOfferModal.currentOrDemandedSalary * 10)}/yr)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Proposed Contract Duration & Total Value:</span>
                <span className="font-black text-emerald-400">
                  {formatMoney(ownerProposedSalary * 10 * ownerProposedYears)} for {ownerProposedYears} Year{ownerProposedYears > 1 ? 's' : ''} ({ownerProposedYears} Season{ownerProposedYears > 1 ? 's' : ''})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Your Proposed Offer:</span>
                <span className="font-black text-cyan-400">
                  {formatMoney(ownerProposedSalary * 10)}/yr ({formatMoney(ownerProposedSalary)}/GP) + {formatMoney(ownerProposedBonus)} Bonus
                </span>
              </div>
              {ownerProposedSalary < driverOfferModal.currentOrDemandedSalary && (
                <div className="flex justify-between pt-1 border-t border-neutral-800">
                  <span className="text-emerald-400 font-bold">Your Per-Race Payroll Savings:</span>
                  <span className="font-black text-emerald-400">
                    +{formatMoney(driverOfferModal.currentOrDemandedSalary - ownerProposedSalary)}/GP (+{formatMoney((driverOfferModal.currentOrDemandedSalary - ownerProposedSalary) * 10)}/yr extra profit!)
                  </span>
                </div>
              )}
            </div>

            <div
              className={`p-3 rounded-xl text-xs leading-relaxed border ${
                driverOfferModal.status === 'accepted'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : driverOfferModal.status === 'countered'
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                  : driverOfferModal.status === 'rejected'
                  ? 'bg-red-950/40 border-red-500/40 text-red-300'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-300'
              }`}
            >
              {driverOfferModal.feedback}
            </div>

            {driverOfferModal.status !== 'rejected' && !showCutDriverConfirm && (
              <div className="bg-neutral-950/90 border border-purple-500/30 rounded-xl p-4 flex flex-col gap-3">
                {/* Contract Duration (1, 2, or 3 Years / Seasons + Quick 1-Season Prove-It & $3M for 1 Yr Presets) */}
                <div className="flex flex-col gap-1.5 pb-2 border-b border-neutral-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400 font-bold">Contract Period (Years / Seasons)</span>
                    <span className="font-mono font-black text-purple-300">
                      {ownerProposedYears} Year{ownerProposedYears > 1 ? 's' : ''} ({formatMoney(ownerProposedSalary * 10 * ownerProposedYears)} Total)
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { yrs: 1, label: '1 Year (1 Season)' },
                      { yrs: 2, label: '2 Years (2 Seasons)' },
                      { yrs: 3, label: '3 Years (3 Seasons)' },
                    ].map((opt) => (
                      <button
                        key={opt.yrs}
                        type="button"
                        onClick={() => {
                          setOwnerProposedYears(opt.yrs);
                          if (driverOfferModal.status === 'accepted') {
                            setDriverOfferModal({
                              ...driverOfferModal,
                              status: 'initial',
                            });
                          }
                        }}
                        className={`py-2 px-2 rounded-lg font-black text-[11px] uppercase tracking-wider border transition-all cursor-pointer ${
                          ownerProposedYears === opt.yrs
                            ? 'bg-purple-500 text-white border-purple-300 shadow'
                            : 'bg-neutral-900 text-neutral-300 border-neutral-700 hover:bg-neutral-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setOwnerProposedYears(1);
                        setOwnerProposedSalary(
                          Math.max(15000, Math.round((driverOfferModal.currentOrDemandedSalary * 0.45) / 5000) * 5000)
                        );
                        if (driverOfferModal.status === 'accepted') {
                          setDriverOfferModal({ ...driverOfferModal, status: 'initial' });
                        }
                      }}
                      className="px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-amber-500/40 text-[10px] font-bold text-amber-300 cursor-pointer"
                    >
                      1-Season Low Prove-It Offer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOwnerProposedYears(1);
                        setOwnerProposedSalary(300000); // $3,000,000 for 1 Year!
                        if (driverOfferModal.status === 'accepted') {
                          setDriverOfferModal({ ...driverOfferModal, status: 'initial' });
                        }
                      }}
                      className="px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-cyan-500/40 text-[10px] font-bold text-cyan-300 cursor-pointer"
                    >
                      $3,000,000 for 1 Year ($300K/GP)
                    </button>
                  </div>
                </div>

                {/* Offered Salary / Race — No Minimum Floor ($0 and up!) */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-neutral-400 font-bold">
                      Your Offered Salary / Race <span className="text-cyan-400 font-normal">(No Minimum Limit)</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-neutral-500 font-mono text-xs">$</span>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={ownerProposedSalary}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          setOwnerProposedSalary(val);
                          if (driverOfferModal.status === 'accepted') {
                            setDriverOfferModal({
                              ...driverOfferModal,
                              status: 'initial',
                            });
                          }
                        }}
                        className="w-28 bg-neutral-900 border border-cyan-500/40 rounded-lg px-2 py-1 text-right font-mono font-black text-xs text-cyan-300 focus:outline-none focus:border-cyan-400"
                      />
                      <span className="text-[10px] font-mono text-neutral-400">/GP</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(350000, Math.round(driverOfferModal.currentOrDemandedSalary * 1.4))}
                    step={1000}
                    value={Math.min(
                      ownerProposedSalary,
                      Math.max(350000, Math.round(driverOfferModal.currentOrDemandedSalary * 1.4))
                    )}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value));
                      setOwnerProposedSalary(val);
                      if (driverOfferModal.status === 'accepted') {
                        setDriverOfferModal({
                          ...driverOfferModal,
                          status: 'initial',
                        });
                      }
                    }}
                    className="w-full accent-purple-400 cursor-pointer"
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { label: '$0 / Free', mult: 0 },
                      { label: '-90% Cut', mult: 0.1 },
                      { label: '-70% Cut', mult: 0.3 },
                      { label: '-50% Cut', mult: 0.5 },
                      { label: '-25% Cut', mult: 0.75 },
                      { label: 'Full Ask', mult: 1.0 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          const nextSal = Math.max(
                            0,
                            Math.round((driverOfferModal.currentOrDemandedSalary * preset.mult) / 1000) * 1000
                          );
                          setOwnerProposedSalary(nextSal);
                          if (driverOfferModal.status === 'accepted') {
                            setDriverOfferModal({
                              ...driverOfferModal,
                              status: 'initial',
                            });
                          }
                        }}
                        className="px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-[10px] font-bold text-neutral-300 cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Offered Signing Bonus — No Upper Limit & Available for Pay Cuts! */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-800">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-neutral-400 font-bold">
                      Upfront Signing Bonus{' '}
                      <span className="text-emerald-400 font-normal">
                        ({driverOfferModal.isCurrentTeammateRenegotiation ? 'Offer Bonus with Pay Cut — No Limit!' : 'No Upper Limit!'})
                      </span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-neutral-500 font-mono text-xs">$</span>
                      <input
                        type="number"
                        min={0}
                        step={10000}
                        value={ownerProposedBonus}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          setOwnerProposedBonus(val);
                          if (driverOfferModal.status === 'accepted') {
                            setDriverOfferModal({
                              ...driverOfferModal,
                              status: 'initial',
                            });
                          }
                        }}
                        className="w-32 bg-neutral-900 border border-emerald-500/40 rounded-lg px-2 py-1 text-right font-mono font-black text-xs text-emerald-300 focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(
                      bankBalance,
                      ownerProposedBonus,
                      25000000,
                      Math.round(Math.max(driverOfferModal.demandedSigningBonus * 5, driverOfferModal.currentOrDemandedSalary * 20))
                    )}
                    step={25000}
                    value={ownerProposedBonus}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value));
                      setOwnerProposedBonus(val);
                      if (driverOfferModal.status === 'accepted') {
                        setDriverOfferModal({
                          ...driverOfferModal,
                          status: 'initial',
                        });
                      }
                    }}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { label: '$0 Bonus', val: 0 },
                      { label: '+$250K', val: 250000 },
                      { label: '+$1M', val: 1000000 },
                      { label: '+$3M', val: 3000000 },
                      { label: '+$10M', val: 10000000 },
                      { label: '+$25M', val: 25000000 },
                      { label: `Max Bank (${formatMoney(bankBalance)})`, val: Math.max(0, Math.floor(bankBalance)) },
                    ].map((bPreset) => (
                      <button
                        key={bPreset.label}
                        type="button"
                        onClick={() => {
                          setOwnerProposedBonus(bPreset.val);
                          if (driverOfferModal.status === 'accepted') {
                            setDriverOfferModal({
                              ...driverOfferModal,
                              status: 'initial',
                            });
                          }
                        }}
                        className="px-2 py-1 rounded bg-neutral-900 hover:bg-emerald-950/60 border border-emerald-500/30 text-[10px] font-bold text-emerald-300 cursor-pointer"
                      >
                        {bPreset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSendOfferToDriver}
                    className="flex-1 w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow-lg shadow-purple-950/40"
                  >
                    Send {ownerProposedYears}-Yr Offer ({formatMoney(ownerProposedSalary * 10 * ownerProposedYears)} / {ownerProposedYears}yr + {formatMoney(ownerProposedBonus)} Bonus)
                  </button>

                  {driverOfferModal.status === 'countered' && (
                    <button
                      type="button"
                      onClick={handleAcceptDriverCounterOffer}
                      className="flex-1 w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow-lg shadow-emerald-500/20"
                    >
                      ✓ Accept Counter ({formatMoney(driverOfferModal.agreedSalaryPerRace * 10)}/yr · {driverOfferModal.agreedContractYears || 1}yr)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Confirmation Step Warning When Cutting Old Driver into Free Agency */}
            {showCutDriverConfirm && (
              <div className="p-4 rounded-xl bg-red-950/60 border-2 border-red-500/70 flex flex-col gap-3 animate-fadeIn">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
                  <div>
                    <span className="text-[10px] font-mono uppercase font-black text-red-300 tracking-wider block">
                      FINAL ROSTER WARNING — CUTTING CURRENT DRIVER
                    </span>
                    <h4 className="text-sm font-black text-white">
                      Cut {activeTeammateDriver.name} & Sign {driverOfferModal.name} to {season.career.customTeam.name}?
                    </h4>
                  </div>
                </div>
                <p className="text-xs text-neutral-200 leading-relaxed">
                  Signing <strong className="text-white">{driverOfferModal.name}</strong> ({formatMoney(driverOfferModal.agreedSalaryPerRace * 10)}/yr for {driverOfferModal.agreedContractYears || 1} yr{(driverOfferModal.agreedContractYears || 1) > 1 ? 's' : ''}) to <strong className="text-emerald-300">{season.career.customTeam.name}</strong> will immediately <strong>CUT {activeTeammateDriver.name}</strong>. {activeTeammateDriver.name} will become a <strong className="text-amber-300">Free Agent</strong> and can sign with any other F1 team on the grid!
                </p>
                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCutDriverConfirm(false)}
                    className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    Cancel — Keep {activeTeammateDriver.name}
                  </button>
                  <button
                    type="button"
                    onClick={executeFinalizeDriverOffer}
                    className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black uppercase tracking-wider rounded-xl text-xs cursor-pointer shadow-lg"
                  >
                    Confirm Cut & Sign to {season.career.customTeam.name}
                  </button>
                </div>
              </div>
            )}

            {!showCutDriverConfirm && (
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowCutDriverConfirm(false);
                    setDriverOfferModal(null);
                  }}
                  className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Close
                </button>
                {driverOfferModal.status === 'accepted' && (
                  <button
                    type="button"
                    disabled={bankBalance < driverOfferModal.agreedSigningBonus}
                    onClick={handleConfirmDriverOffer}
                    className={`flex-1 py-2.5 font-black uppercase tracking-wider rounded-xl text-xs cursor-pointer ${
                      bankBalance >= driverOfferModal.agreedSigningBonus
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-black shadow-lg'
                        : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                    }`}
                  >
                    {driverOfferModal.isCurrentTeammateRenegotiation
                      ? `Confirm ${driverOfferModal.agreedContractYears || 1}-Yr Contract (${formatMoney(driverOfferModal.agreedSalaryPerRace * 10)}/yr)`
                      : `Confirm & Sign ${driverOfferModal.agreedContractYears || 1}-Yr Deal to ${season.career.customTeam.name}`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sell Custom Team Confirmation Modal ("make it so that when u sell ur team u have to confirm so u dont accidently sell ur team") */}
      {showSellTeamModal && season.career.customTeam && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border-2 border-amber-500/50 max-w-md w-full rounded-2xl p-6 shadow-2xl flex flex-col gap-4 text-center">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-7 h-7" />
              </div>
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase font-black text-amber-400 tracking-wider block">
                Constructor Franchise Liquidation
              </span>
              <h3 className="text-xl font-black text-white mt-0.5">
                Confirm Selling {season.career.customTeam.name}?
              </h3>
              <p className="text-xs text-neutral-300 mt-2 leading-relaxed">
                {selectedOffer
                  ? `To finalize and accept your negotiated ${formatMoney(selectedOffer.salary * 10)}/yr contract with ${selectedOffer.team.name}, confirm selling ${season.career.customTeam.name} for +$210,000,000.`
                  : 'Are you sure you want to sell your 11th Constructor franchise? You will receive +$210,000,000 in liquid cash, your custom team entry and upgrades will be dissolved, and you will be unlocked to sign contracts with any rival F1 team.'}
              </p>
            </div>

            <div className="bg-neutral-950 p-3.5 rounded-xl border border-white/5 text-xs flex flex-col gap-1.5">
              <div className="flex justify-between">
                <span className="text-neutral-400">Franchise Sale Valuation:</span>
                <span className="font-bold text-emerald-400">+$210,000,000</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-neutral-800">
                <span className="text-neutral-400">New Bank Balance After Sale:</span>
                <span className="font-black text-white">{formatMoney(bankBalance + 210000000)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-1">
              <button
                type="button"
                onClick={() => setShowSellTeamModal(false)}
                className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel — Keep Team
              </button>
              <button
                type="button"
                onClick={() => {
                  const teamName = season.career.customTeam?.name || 'Constructor';
                  setShowSellTeamModal(false);
                  if (onSellCustomTeam) {
                    onSellCustomTeam(210000000);
                  }
                  if (selectedOffer) {
                    const team = selectedOffer.team;
                    const targetDriver = DRIVERS.find((d) => d.teamId === team.id) || DRIVERS[0];
                    const finalYrs = Math.max(1, Math.min(5, counterContractYears || selectedOffer.contractYears || 1));
                    onSelectTeam(
                      team.id,
                      targetDriver.id,
                      selectedOffer.buyoutFee,
                      selectedOffer.signingBonus,
                      selectedOffer.salary,
                      finalYrs,
                      `${finalYrs}-Year Contract (${formatMoney(selectedOffer.salary * 10 * finalYrs)} total)`,
                      Boolean(selectedOffer.isProveItDeal && finalYrs === 1)
                    );
                    setNotificationMsg(
                      `SOLD TEAM & SIGNED CONTRACT: Sold ${teamName} for +$210,000,000 and officially signed a ${finalYrs}-Year deal with ${team.name} at ${formatMoney(selectedOffer.salary * 10)}/yr (${formatMoney(selectedOffer.salary)}/race)!`
                    );
                    setSelectedOffer(null);
                  } else {
                    setNotificationMsg(
                      `Confirmed! Sold ${teamName} franchise for $210,000,000. You can now freely sign contracts with rival F1 teams.`
                    );
                  }
                }}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-black font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-amber-500/25"
              >
                {selectedOffer
                  ? `Confirm Sale & Sign with ${selectedOffer.team.shortName}`
                  : 'Confirm Sale ($210M)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Profile Edit Modal */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 max-w-md w-full rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <h3 className="text-xl font-black text-white">Customize Driver Profile</h3>
            <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Driver Name</label>
                <input
                  type="text"
                  value={driverNameInput}
                  onChange={(e) => setDriverNameInput(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Car Number (#)</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={driverNumberInput}
                  onChange={(e) => setDriverNumberInput(parseInt(e.target.value) || 1)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-neutral-400 block mb-1">Nationality</label>
                <input
                  type="text"
                  value={countryInput}
                  onChange={(e) => setCountryInput(e.target.value)}
                  required
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-2 text-sm text-white"
                />
              </div>
              <div className="flex items-center gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => setEditingProfile(false)}
                  className="flex-1 py-2 bg-neutral-800 text-neutral-300 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quit Career Confirmation Modal */}
      {showQuitCareerModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-red-500/50 max-w-md w-full rounded-2xl p-6 shadow-2xl flex flex-col gap-4 text-center">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400">
                <AlertTriangle className="w-7 h-7" />
              </div>
            </div>

            <div>
              <h3 className="text-xl font-black text-white">Quit Career or Start Another Career Slot?</h3>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                You don&apos;t have to quit this career to start a new one! You can create multiple careers under your account and switch between them anytime. Or, if you want to wipe only this career slot back to rookie Haas status, click Confirm Quit below.
              </p>
            </div>

            {onOpenCareerSlots && (
              <button
                type="button"
                onClick={() => {
                  setShowQuitCareerModal(false);
                  onOpenCareerSlots();
                }}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2"
              >
                <FolderKanban className="w-4 h-4" />
                <span>Create / Switch Career Without Quitting</span>
              </button>
            )}

            <div className="flex items-center gap-3 mt-1">
              <button
                type="button"
                onClick={() => setShowQuitCareerModal(false)}
                className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowQuitCareerModal(false);
                  if (onQuitCareer) onQuitCareer();
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-lg shadow-red-600/30"
              >
                Wipe This Slot Only
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Season Standings Confirmation Modal */}
      {showResetStandingsModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 max-w-md w-full rounded-2xl p-6 shadow-2xl flex flex-col gap-4 text-center">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300">
                <RotateCcw className="w-7 h-7" />
              </div>
            </div>

            <div>
              <h3 className="text-xl font-black text-white">Reset Current Season Calendar?</h3>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                This will reset the active 10-race calendar points back to Round 1 in Bahrain. Your lifetime career earnings, driver rating, team ownership, and trophy room history will remain untouched.
              </p>
            </div>

            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={() => setShowResetStandingsModal(false)}
                className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetStandingsModal(false);
                  onResetSeason();
                }}
                className="flex-1 py-2.5 bg-neutral-200 hover:bg-white text-neutral-950 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Reset Season Points
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Free Practice Configuration Modal ("without quitting my career i can do practice on all of the tracks and i can choose my difficulty and laps") */}
      {showPracticeModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 max-w-xl w-full rounded-2xl p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Gauge className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Official FIA Free Practice Session</h3>
                  <p className="text-xs text-neutral-400">Test setups, learn braking points, and practice without risking championship points</p>
                </div>
              </div>
              <button
                onClick={() => setShowPracticeModal(false)}
                className="text-neutral-400 hover:text-white text-xs font-bold px-2 py-1 rounded hover:bg-neutral-800"
              >
                ✕
              </button>
            </div>

            {/* Circuit Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Select Circuit (All 10 Tracks Available)
              </label>
              <select
                value={practiceSelectedCircuit.id}
                onChange={(e) => {
                  const found = CIRCUITS.find((c) => c.id === e.target.value);
                  if (found) setPracticeSelectedCircuit(found);
                }}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              >
                {CIRCUITS.map((circ, idx) => (
                  <option key={circ.id} value={circ.id}>
                    Round {idx + 1}: {circ.name} ({circ.country}) — {formatDistance(circ.lengthKm, unitSystem)}, {circ.turns} Turns
                  </option>
                ))}
              </select>

              {/* Dynamic 2D Track Geometry Outline */}
              <div className="bg-neutral-950/90 rounded-xl p-2.5 border border-white/5">
                <TrackLayoutPreview
                  circuit={practiceSelectedCircuit}
                  height={130}
                  strokeColor="#f59e0b"
                  strokeWidth={3}
                  showStartFinish={true}
                  showDirection={true}
                  showTurnLabels={true}
                />
              </div>
            </div>

            {/* Practice AI Difficulty Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Practice AI Difficulty
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['rookie', 'pro', 'legend'] as const).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setPracticeDifficulty(diff)}
                    className={`py-2.5 rounded-xl font-bold text-xs uppercase transition-all ${
                      practiceDifficulty === diff
                        ? diff === 'legend'
                          ? 'bg-purple-600 text-white shadow-lg ring-2 ring-purple-400'
                          : diff === 'pro'
                          ? 'bg-red-600 text-white shadow-lg ring-2 ring-red-400'
                          : 'bg-emerald-600 text-white shadow-lg ring-2 ring-emerald-400'
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-neutral-400">
                {practiceDifficulty === 'rookie'
                  ? 'Rookie: 0.80x AI pace. Soft braking, forgiving AI lines.'
                  : practiceDifficulty === 'legend'
                  ? 'Legend Simulation: 1.15x fierce AI pace, late-braking passes.'
                  : 'Pro Standard: 0.89x authentic F1 race pace.'}
              </p>
            </div>

            {/* Practice Laps Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Practice Distance: {practiceLaps} Laps
              </label>
              <div className="grid grid-cols-8 gap-1.5">
                {[3, 4, 5, 6, 7, 8, 9, 10].map((laps) => (
                  <button
                    key={laps}
                    type="button"
                    onClick={() => setPracticeLaps(laps)}
                    className={`py-2 rounded-lg font-bold text-xs transition-all ${
                      practiceLaps === laps
                        ? 'bg-amber-500 text-black font-black ring-2 ring-amber-300 shadow-md'
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {laps}L
                  </button>
                ))}
              </div>
            </div>

            {/* Practice AI Traffic / Bot Count Selector ("make it so in practice mode i can remove all bots or some bots") */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  AI Rival Bots on Track: <span className="text-amber-400 font-mono">{practiceBotCount === 0 ? '0 (Solo Track — No Bots)' : `${practiceBotCount} AI Cars`}</span>
                </label>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                  3D Racing Line Assist Included [Key L]
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { count: 0, label: '0 Bots (Solo)' },
                  { count: 5, label: '5 Bots (Light)' },
                  { count: 10, label: '10 Bots (Half)' },
                  { count: 19, label: '19 Bots (Full)' },
                ].map((preset) => (
                  <button
                    key={preset.count}
                    type="button"
                    onClick={() => setPracticeBotCount(preset.count)}
                    className={`py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      practiceBotCount === preset.count
                        ? 'bg-amber-500 text-black font-black ring-2 ring-amber-300 shadow-md'
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 pt-1">
                <span className="text-[10px] font-mono text-neutral-500">0</span>
                <input
                  type="range"
                  min={0}
                  max={19}
                  value={practiceBotCount}
                  onChange={(e) => setPracticeBotCount(Number(e.target.value))}
                  className="flex-1 accent-amber-500 cursor-pointer"
                />
                <span className="text-[10px] font-mono text-neutral-500">19</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowPracticeModal(false)}
                className="w-full sm:w-auto py-3 px-5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPracticeModal(false);
                  if (onStartPractice) {
                    onStartPractice(OPEN_FIELD_PROVING_GROUND_CIRCUIT, 99, practiceDifficulty, 0);
                  }
                }}
                className="w-full sm:w-auto py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-1.5"
              >
                <span>🌾 Open-Field Car Test</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPracticeModal(false);
                  if (onStartPractice) {
                    onStartPractice(practiceSelectedCircuit, practiceLaps, practiceDifficulty, practiceBotCount);
                  }
                }}
                className="flex-1 w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-black font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>Launch Practice ({practiceSelectedCircuit.name})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mid-Season Team Rename Modal */}
      {isRenamingTeam && season.career.customTeam && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 max-w-lg w-full rounded-2xl shadow-2xl p-6 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-base shadow"
                  style={{ backgroundColor: season.career.customTeam.primaryColor }}
                >
                  <Pencil className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase font-bold text-amber-400">Team Identity</span>
                  <h3 className="text-xl font-black text-white">Rename Team Mid-Season</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRenamingTeam(false)}
                className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRenamedTeam} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 block mb-1">
                  Official Team Name
                </label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Scuderia Velocita"
                  required
                  maxLength={60}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 font-sans"
                />
                <span className="text-[10px] text-neutral-500 mt-1 block">
                  Displayed on FIA leaderboards, race results, and constructor standings.
                </span>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 block mb-1">
                  Short Name / Broadcast Code (Max 12 chars)
                </label>
                <input
                  type="text"
                  value={newTeamShort}
                  onChange={(e) => setNewTeamShort(e.target.value)}
                  placeholder="e.g. Velocita"
                  required
                  maxLength={12}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 font-mono uppercase"
                />
                <span className="text-[10px] text-neutral-500 mt-1 block">
                  Displayed on the TV timing tower, mini-leaderboards, and telemetry tags.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsRenamingTeam(false)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTeamName.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-950/40 transition-all cursor-pointer disabled:opacity-50"
                >
                  Save Team Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Anytime Custom Team Color Switcher Modal ("if i own a team allow me to switch my teams colors whenever i want") */}
      {isEditingTeamColors && season.career.customTeam && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 max-w-lg w-full rounded-2xl shadow-2xl p-6 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-white text-sm shadow border-2"
                  style={{
                    backgroundColor: editPrimaryColor,
                    borderColor: editAccentColor,
                  }}
                >
                  {season.career.customTeam.shortName.substring(0, 3).toUpperCase()}
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase font-bold text-cyan-400">Custom Constructor Livery Studio</span>
                  <h3 className="text-xl font-black text-white">Switch {season.career.customTeam.name} Colors</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingTeamColors(false)}
                className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTeamColors} className="flex flex-col gap-4">
              {/* Quick Championship Livery Presets */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">
                  Quick Livery Presets (Or Pick Custom Hex Below)
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    { name: 'Rosso Corsa', p: '#e10600', s: '#0d0e12', a: '#ffd700' },
                    { name: 'Papaya Gold', p: '#ff8000', s: '#111827', a: '#38bdf8' },
                    { name: 'Silver Arrow', p: '#00d2be', s: '#18181b', a: '#e4e4e7' },
                    { name: 'British Green', p: '#006f62', s: '#090d16', a: '#bef264' },
                    { name: 'Midnight Blue', p: '#1d4ed8', s: '#09090b', a: '#f43f5e' },
                    { name: 'Stealth Carbon', p: '#27272a', s: '#09090b', a: '#f59e0b' },
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setEditPrimaryColor(preset.p);
                        setEditSecondaryColor(preset.s);
                        setEditAccentColor(preset.a);
                      }}
                      className="p-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 flex flex-col items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-1">
                        <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: preset.p }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: preset.s }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: preset.a }} />
                      </div>
                      <span className="text-[9px] font-bold text-neutral-300 text-center leading-tight">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase text-neutral-400">Primary Body</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editPrimaryColor}
                      onChange={(e) => setEditPrimaryColor(e.target.value)}
                      className="w-9 h-9 rounded-lg bg-transparent border-0 cursor-pointer shrink-0"
                    />
                    <span className="text-xs font-mono text-white uppercase">{editPrimaryColor}</span>
                  </div>
                </div>

                <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase text-neutral-400">Secondary Wings</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editSecondaryColor}
                      onChange={(e) => setEditSecondaryColor(e.target.value)}
                      className="w-9 h-9 rounded-lg bg-transparent border-0 cursor-pointer shrink-0"
                    />
                    <span className="text-xs font-mono text-white uppercase">{editSecondaryColor}</span>
                  </div>
                </div>

                <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase text-neutral-400">Accent Trim</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editAccentColor}
                      onChange={(e) => setEditAccentColor(e.target.value)}
                      className="w-9 h-9 rounded-lg bg-transparent border-0 cursor-pointer shrink-0"
                    />
                    <span className="text-xs font-mono text-white uppercase">{editAccentColor}</span>
                  </div>
                </div>
              </div>

              {/* Live Livery Preview Bar */}
              <div
                className="p-4 rounded-xl border flex items-center justify-between"
                style={{
                  background: `linear-gradient(135deg, ${editPrimaryColor} 0%, ${editSecondaryColor} 75%)`,
                  borderColor: editAccentColor,
                }}
              >
                <div>
                  <span
                    className="text-[10px] font-mono uppercase font-black px-2 py-0.5 rounded"
                    style={{ backgroundColor: editAccentColor, color: '#000' }}
                  >
                    LIVE LIVERY PREVIEW
                  </span>
                  <h4 className="text-lg font-black text-white mt-1 drop-shadow">
                    {season.career.customTeam.name}
                  </h4>
                </div>
                <span className="text-xs font-mono font-bold text-white/90 bg-black/40 px-2.5 py-1 rounded-lg">
                  #{season.career.driverNumber} {season.career.driverName}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsEditingTeamColors(false)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-300 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-950/40 transition-all cursor-pointer"
                >
                  Apply New Team Colors
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showGoogleMapsModal && (
        <MarylandGoogleMapModal
          isOpen={showGoogleMapsModal}
          onClose={() => setShowGoogleMapsModal(false)}
          onLaunchMarylandDriveWithTarget={
            onStartPractice
              ? (worldX, worldZ, label) => {
                  try {
                    localStorage.setItem(
                      'apex26_pending_md_gps',
                      JSON.stringify({ x: worldX, z: worldZ, label })
                    );
                  } catch {}
                  setShowGoogleMapsModal(false);
                  onStartPractice(CITY_DRIVING_METRO_CIRCUIT, 99, season.difficulty, 0);
                }
              : undefined
          }
        />
      )}
    </div>
  );
};
