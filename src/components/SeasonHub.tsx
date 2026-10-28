import React, { useState, useMemo } from 'react';
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
} from '../types/racing';
import {
  CIRCUITS,
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
} from 'lucide-react';
import { soundEngine } from '../services/soundEngine';
import { TrackLayoutPreview } from './TrackLayoutPreview';
import { Newsfeed, BreakingNewsTicker } from './Newsfeed';
import { PerformanceAnalytics } from './PerformanceAnalytics';
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

interface SeasonHubProps {
  season: SeasonState;
  currentCircuit: CircuitInfo;
  onStartRace: (laps: number) => void;
  onStartPractice?: (circuit: CircuitInfo, laps: number, difficulty: 'rookie' | 'pro' | 'legend', botCount?: number) => void;
  onChangeDifficulty?: (difficulty: 'rookie' | 'pro' | 'legend') => void;
  onSelectTeam: (teamId: string, driverId: string, buyoutFee: number, signingBonus: number, salary: number) => void;
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
}) => {
  const [activeTab, setActiveTab] = useState<'weekend' | 'newsfeed' | 'analytics' | 'offseason' | 'contracts' | 'myteam' | 'standings' | 'calendar' | 'records'>('weekend');
  const [selectedLaps, setSelectedLaps] = useState<number>(season.lapCount || 5);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(getStoredUnitSystem());
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>(getStoredGraphicsQuality());
  const [appTheme, setAppTheme] = useState<AppThemeId>(getStoredTheme());

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

  const handleChangeGraphicsQuality = (q: GraphicsQuality) => {
    setGraphicsQuality(q);
    setStoredGraphicsQuality(q);
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

  // Contract Modal
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
  } | null>(null);

  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const [showQuitCareerModal, setShowQuitCareerModal] = useState(false);
  const [showResetStandingsModal, setShowResetStandingsModal] = useState(false);
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
    if (season.career.customTeam && season.selectedTeamId === season.career.customTeam.id) {
      const tId = season.career.customTeam.teammateDriverId;
      return (
        DRIVERS.find((d) => d.id === tId) || {
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
  }, [season.career.customTeam, season.selectedTeamId, season.selectedDriverId, playerTeam.drivers]);

  const [previewingEngineName, setPreviewingEngineName] = useState<string | null>(null);

  const careerPoints = season.driverPoints[season.selectedDriverId] || 0;
  const careerWins = season.career.wins;
  const careerPodiums = season.career.podiums;
  const driverRating = season.career.driverRating || 76;
  const bankBalance = season.career.careerEarnings;

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  const handleOpenContract = (team: Team) => {
    if (team.id === season.selectedTeamId) return;

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
    const buyout = isMidSeason ? offer.midSeasonBuyoutFee : 0;
    const canAfford = bankBalance >= buyout;

    const meetsRating = driverRating >= offer.minRating;
    const meetsPoints = careerPoints >= offer.minPoints;
    const meetsWins = careerWins >= offer.minWins;
    const meetsPodiums = careerPodiums >= offer.minPodiums;

    const displacedDriver = DRIVERS.find((d) => d.id === team.drivers[1]) || DRIVERS.find((d) => d.teamId === team.id) || DRIVERS[0];

    setSelectedOffer({
      team,
      salary: offer.salaryPerRace,
      signingBonus: offer.signingBonus,
      buyoutFee: buyout,
      minRating: offer.minRating,
      minPoints: offer.minPoints,
      minWins: offer.minWins,
      minPodiums: offer.minPodiums,
      expectation: offer.teamExpectation,
      canAffordBuyout: canAfford,
      meetsRating,
      meetsPoints,
      meetsWins,
      meetsPodiums,
      displacedDriverName: displacedDriver.name,
    });
  };

  const handleConfirmContract = () => {
    if (!selectedOffer) return;
    const eligible =
      selectedOffer.canAffordBuyout &&
      selectedOffer.meetsRating &&
      selectedOffer.meetsPoints &&
      selectedOffer.meetsWins &&
      selectedOffer.meetsPodiums;

    if (!eligible) return;

    const team = selectedOffer.team;
    const targetDriver = DRIVERS.find((d) => d.teamId === team.id) || DRIVERS[0];

    onSelectTeam(team.id, targetDriver.id, selectedOffer.buyoutFee, selectedOffer.signingBonus, selectedOffer.salary);
    setNotificationMsg(
      `OFFICIAL FIA PRESS: You have signed with ${team.name}! Contract Salary: ${formatMoney(selectedOffer.salary)}/race. Displacing ${selectedOffer.displacedDriverName}.`
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
    return [...DRIVERS].sort((a, b) => {
      const ptsA = season.driverPoints[a.id] || 0;
      const ptsB = season.driverPoints[b.id] || 0;
      return ptsB - ptsA;
    });
  }, [season.driverPoints]);

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
                <span className="font-semibold text-zinc-300 truncate max-w-[160px]">{playerTeam.name}</span>
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

      {/* 2. TAB NAVIGATION BAR */}
      <nav className="h-12 bg-zinc-900/80 border-b border-white/10 px-6 flex items-center justify-between gap-4 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('weekend')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'weekend'
                ? 'bg-red-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Race Weekend</span>
          </button>

          <button
            onClick={() => setActiveTab('newsfeed')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'newsfeed'
                ? 'bg-red-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
            }`}
          >
            <Newspaper className="w-3.5 h-3.5" />
            <span>Paddock News</span>
          </button>

          <button
            onClick={() => setActiveTab('contracts')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'contracts'
                ? 'bg-red-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Contracts & Teams</span>
          </button>

          <button
            onClick={() => setActiveTab('myteam')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'myteam'
                ? 'bg-red-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>My Team</span>
          </button>

          <button
            onClick={() => setActiveTab('standings')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'standings'
                ? 'bg-red-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Standings</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-red-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('offseason')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'offseason'
                ? 'bg-amber-500 text-black font-black'
                : season.seasonFinished
                ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
            }`}
          >
            <Wind className="w-3.5 h-3.5" />
            <span>
              {season.seasonFinished ? 'Off-Season Hub (Active)' : 'Off-Season'}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'calendar'
                ? 'bg-red-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Calendar</span>
          </button>

          <button
            onClick={() => setActiveTab('records')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'records'
                ? 'bg-amber-500 text-black font-black'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Records</span>
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
            onClick={toggleUnits}
            className="text-xs font-mono font-bold text-zinc-200 hover:text-white bg-zinc-950 hover:bg-zinc-800 border border-white/10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            title="Switch between American (MPH / Miles / °F) and Metric (KM/H / KM / °C)"
          >
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span>{unitSystem === 'imperial' ? 'MPH' : 'KM/H'}</span>
          </button>

          <button
            onClick={() => setShowResetStandingsModal(true)}
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer whitespace-nowrap"
            title="Reset current 10-race calendar standings"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden 2xl:inline">Reset</span>
          </button>

          <button
            onClick={() => setShowQuitCareerModal(true)}
            className="text-xs text-red-400 hover:text-white hover:bg-red-600/30 border border-red-500/30 flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors font-semibold cursor-pointer whitespace-nowrap"
            title="Quit active career to choose a new AI difficulty"
          >
            <Lock className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden 2xl:inline">Quit</span>
          </button>
        </div>
      </nav>

      {/* Active Off-Season Banner when Season is Finished */}
      {season.seasonFinished && (
        <div className="bg-amber-500/15 border-b border-amber-400/40 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-white font-bold">
              SEASON {season.career.seasonNumber || 1} ({2026 + (season.career.seasonNumber || 1) - 1}) COMPLETE — WELCOME TO THE FIA WINTER OFF-SEASON!
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
                    FIA Formula 1 World Championship 2026
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
                      Official 2026 Circuit Geometry Layout
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
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
                  {GRAPHICS_QUALITY_OPTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleChangeGraphicsQuality(q)}
                      className={`py-2 px-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer border ${
                        graphicsQuality === q
                          ? q === 'ultra'
                            ? 'bg-amber-500 text-black border-amber-300 shadow-md'
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
                      className={`py-2 rounded-lg font-bold text-xs transition-all ${
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
              ) : (
                <>
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

                  {/* Launch Race & Practice Buttons */}
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
                      className="w-full sm:w-auto px-6 py-4 bg-neutral-800 hover:bg-neutral-750 text-amber-300 hover:text-white font-black text-sm tracking-wider uppercase rounded-xl border border-amber-400/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Gauge className="w-5 h-5 text-amber-400" />
                      <span>FREE PRACTICE</span>
                    </button>
                  </div>
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
            </div>
          </div>
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
                  Season {season.career.seasonNumber || 1} ({2026 + (season.career.seasonNumber || 1) - 1})
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
                      `Launched Season ${(season.career.seasonNumber || 1) + 1} (${2026 + (season.career.seasonNumber || 1)})! Paddock media will continue discussing Season ${season.career.seasonNumber || 1} until Round 1 at Bahrain concludes.`
                    );
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-amber-400 hover:from-emerald-400 hover:to-amber-300 text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Trophy className="w-4 h-4" />
                  <span>
                    Launch Season {(season.career.seasonNumber || 1) + 1} ({2026 + (season.career.seasonNumber || 1)}) →
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
                  Win races, score points, and build your reputation to earn contract offers with top Formula 1 teams.
                  <strong className="text-amber-400"> Mid-season transfers require paying the official FIA contract buyout fee from your bank balance!</strong>
                </p>
              </div>
              <div className="bg-neutral-950 p-4 rounded-xl border border-white/5 text-right shrink-0">
                <span className="text-[10px] uppercase font-bold text-neutral-400">Available Funds</span>
                <p className="text-xl font-black text-emerald-400">{formatMoney(bankBalance)}</p>
              </div>
            </div>

            {/* Custom Team Owner Lock Banner */}
            {season.career.customTeam && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-300">Constructor Owner Contract Lock</h4>
                    <p className="text-xs text-neutral-300">
                      You are Owner & Team Principal of <strong className="text-white">{season.career.customTeam.name}</strong>. In Formula 1, team owners cannot drive for rival constructors without selling their constructor franchise first.
                    </p>
                  </div>
                </div>
                {onSellCustomTeam && (
                  <button
                    onClick={() => {
                      const teamName = season.career.customTeam?.name || 'Constructor';
                      onSellCustomTeam(210000000);
                      setNotificationMsg(`Sold ${teamName} franchise for $210,000,000! You can now freely negotiate with rival teams.`);
                    }}
                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-amber-500/40 font-bold text-xs rounded-xl shrink-0 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                    <span>Sell Franchise ($210M)</span>
                  </button>
                )}
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
                  careerPoints >= offer.minPoints &&
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
                          <span className="text-[10px] text-neutral-500 uppercase font-bold">Salary / Race</span>
                          <p className="font-bold text-cyan-400">{formatMoney(offer.salaryPerRace)}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-neutral-500 uppercase font-bold">Signing Bonus</span>
                          <p className="font-bold text-emerald-400">{formatMoney(offer.signingBonus)}</p>
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

                      {/* Criteria Checklist */}
                      <div className="mt-3 flex flex-col gap-1 text-[11px]">
                        <div className="flex items-center justify-between text-neutral-400">
                          <span>Min Driver Rating:</span>
                          <span className={driverRating >= offer.minRating ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                            {offer.minRating} (You: {driverRating})
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-neutral-400">
                          <span>Min Career Points:</span>
                          <span className={careerPoints >= offer.minPoints ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                            {offer.minPoints} PTS (You: {careerPoints})
                          </span>
                        </div>
                        {offer.minWins > 0 && (
                          <div className="flex items-center justify-between text-neutral-400">
                            <span>Min Grand Prix Wins:</span>
                            <span className={careerWins >= offer.minWins ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                              {offer.minWins} Win (You: {careerWins})
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="mt-5">
                      {isCurrentTeam ? (
                        <div className="py-2.5 bg-neutral-800 text-neutral-400 text-center font-bold text-xs rounded-xl">
                          Under Contract
                        </div>
                      ) : season.career.customTeam ? (
                        <div className="py-2.5 bg-neutral-900 border border-amber-500/30 text-amber-400/90 text-center font-bold text-xs rounded-xl flex items-center justify-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Must Sell Team First</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleOpenContract(team)}
                          className={`w-full py-2.5 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                            meetsReqs && canAfford
                              ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 text-white shadow-md'
                              : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-750'
                          }`}
                        >
                          <span>Negotiate Contract</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
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
                        <div className="flex items-center gap-2.5 mt-0.5">
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
                            onClick={() => {
                              onSellCustomTeam(210000000);
                              setNotificationMsg(`Successfully sold ${season.career.customTeam?.name} franchise for $210,000,000! You can now freely negotiate driver contracts with rival F1 teams.`);
                            }}
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
                            <span className="text-neutral-400">• Contracted Teammate Driver Salary Demand:</span>
                            <span className="text-red-400 font-bold">
                              -{formatMoney(season.career.customTeam.teammateSalaryPerRace || 450000)}
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
                            (season.career.customTeam.teammateSalaryPerRace || 450000) +
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
                                    <div>Downforce: <strong className="text-cyan-400">+{Math.round(staff.downforceBonus * 100)}%</strong></div>
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

                  {/* SUBTAB 5: DRIVER MARKET */}
                  {myTeamSubTab === 'drivers' && (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col gap-5">
                      <div>
                        <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider">
                          Paddock Driver Market
                        </span>
                        <h3 className="text-xl font-black text-white mt-0.5">Sign Teammate Driver</h3>
                        <p className="text-xs text-neutral-400 mt-1">
                          Contract an elite teammate driver to score vital Constructors' Championship points for your team each weekend.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                        {DRIVERS.filter((d) => d.id !== season.selectedDriverId).map((driver) => {
                          const isTeammate = season.career.customTeam?.teammateDriverId === driver.id;
                          return (
                            <div
                              key={driver.id}
                              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                                isTeammate ? 'bg-neutral-950 border-purple-500 ring-1 ring-purple-500/30' : 'bg-neutral-950/70 border-neutral-800'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white" style={{ backgroundColor: driver.color }}>
                                  #{driver.number}
                                </div>
                                <div>
                                  <span className="font-bold text-white block">{driver.name}</span>
                                  <span className="text-[10px] text-neutral-400 font-mono">
                                    Rating: <strong className="text-purple-400">{driver.rating}</strong> • Demand: <strong className="text-amber-400">{formatMoney(driver.salaryPerRaceDemand || 450000)}/GP</strong>
                                  </span>
                                </div>
                              </div>

                              {isTeammate ? (
                                <span className="text-[10px] text-purple-400 font-bold bg-purple-500/10 px-2 py-1 rounded">
                                  Under Contract
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleSignTeammate(driver)}
                                  disabled={bankBalance < Math.round((driver.salaryPerRaceDemand || 450000) * 1.5)}
                                  className={`px-3 py-1.5 font-bold text-xs rounded-lg transition-colors cursor-pointer ${
                                    bankBalance >= Math.round((driver.salaryPerRaceDemand || 450000) * 1.5)
                                      ? 'bg-neutral-800 hover:bg-neutral-700 text-white'
                                      : 'bg-neutral-900 text-neutral-600 cursor-not-allowed'
                                  }`}
                                >
                                  Hire ({formatMoney(Math.round((driver.salaryPerRaceDemand || 450000) * 1.5))})
                                </button>
                              )}
                            </div>
                          );
                        })}
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
                      <h3 className="text-lg font-black text-white mt-1">2026 Vehicle Dynamics</h3>

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
                        FIA 2026 Regulations Ground Effect
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
                    season.career.customTeam.teammateDriverId === driver.id &&
                    season.selectedTeamId === season.career.customTeam.id
                  );

                  let activeDriverTeam: Team | undefined;
                  if (isPlayer) {
                    activeDriverTeam = playerTeam;
                  } else if (isTeammateInCustomTeam) {
                    activeDriverTeam = playerTeam;
                  } else {
                    activeDriverTeam = TEAMS.find((t) => t.id === driver.teamId) || TEAMS[0];
                  }

                  return (
                    <div
                      key={driver.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        isPlayer
                          ? 'bg-amber-500/10 border-amber-400/40 text-amber-200 shadow-md'
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
                            {isPlayer ? `${season.career.driverName} (YOU)` : driver.name}
                          </p>
                          <p className="text-[10px] text-neutral-400">{activeDriverTeam?.name || 'Haas'}</p>
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
              <span>Official 2026 Grand Prix Championship Calendar</span>
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
                    You are currently competing in Round {season.currentRound + 1} of 10 in Season 1 (2026). When you complete Round 10 at Abu Dhabi, your full season history, championship rank, and trophy accolades will be permanently archived here!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Contract Negotiation Confirmation Modal */}
      {selectedOffer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 max-w-lg w-full rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-lg"
                style={{ backgroundColor: selectedOffer.team.primaryColor }}
              >
                {selectedOffer.team.shortName.substring(0, 3)}
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-400">FIA Contract Proposal</span>
                <h3 className="text-xl font-black text-white">{selectedOffer.team.name}</h3>
              </div>
            </div>

            <div className="bg-neutral-950 p-4 rounded-xl border border-white/5 flex flex-col gap-2 text-xs">
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-400">Offered Salary:</span>
                <span className="font-bold text-cyan-400">{formatMoney(selectedOffer.salary)} / race</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-400">Signing Bonus:</span>
                <span className="font-bold text-emerald-400">+{formatMoney(selectedOffer.signingBonus)}</span>
              </div>
              {selectedOffer.buyoutFee > 0 && (
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">Mid-Season Buyout Fee:</span>
                  <span className="font-bold text-red-400">-{formatMoney(selectedOffer.buyoutFee)}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-400">Displaced Driver:</span>
                <span className="font-bold text-neutral-300">{selectedOffer.displacedDriverName}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-400">Bank Balance after signing:</span>
                <span className="font-bold text-white">
                  {formatMoney(bankBalance - selectedOffer.buyoutFee + selectedOffer.signingBonus)}
                </span>
              </div>
            </div>

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
              {!selectedOffer.meetsPoints && (
                <p className="text-red-400 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>Requires at least {selectedOffer.minPoints} Career Points (You have: {careerPoints}).</span>
                </p>
              )}
              {!selectedOffer.meetsWins && (
                <p className="text-red-400 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>Requires at least {selectedOffer.minWins} Grand Prix Win(s).</span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => setSelectedOffer(null)}
                className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmContract}
                disabled={
                  !selectedOffer.canAffordBuyout ||
                  !selectedOffer.meetsRating ||
                  !selectedOffer.meetsPoints ||
                  !selectedOffer.meetsWins ||
                  !selectedOffer.meetsPodiums
                }
                className={`flex-1 py-2.5 font-bold rounded-xl text-xs transition-all ${
                  selectedOffer.canAffordBuyout &&
                  selectedOffer.meetsRating &&
                  selectedOffer.meetsPoints &&
                  selectedOffer.meetsWins &&
                  selectedOffer.meetsPodiums
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                }`}
              >
                Sign Contract
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
              <h3 className="text-xl font-black text-white">Quit Career & Reset Difficulty?</h3>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                Quitting your career will reset all career earnings, driver statistics, championships, and custom teams back to rookie Haas status. This allows you to choose a new AI difficulty from the beginning.
              </p>
            </div>

            <div className="flex items-center gap-3 mt-2">
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
                Confirm Quit Career
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
            <div className="flex items-center gap-3 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowPracticeModal(false)}
                className="py-3 px-5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPracticeModal(false);
                  if (onStartPractice) {
                    onStartPractice(practiceSelectedCircuit, practiceLaps, practiceDifficulty, practiceBotCount);
                  }
                }}
                className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-black font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>Launch Practice Session ({practiceSelectedCircuit.name})</span>
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
    </div>
  );
};
