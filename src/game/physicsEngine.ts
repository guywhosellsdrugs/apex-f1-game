import * as THREE from 'three';
import { BuiltCar } from './carBuilder';
import { GeneratedTrack, SurfaceInfo } from './trackGenerator';
import {
  Driver,
  Team,
  TelemetryData,
  TireCompound,
  CarRadarPoint,
  CustomTeamConfig,
  TIRE_COMPOUND_SPECS,
  getStoredStartingTireCompound,
  setStoredStartingTireCompound,
} from '../types/racing';
import { DRIVERS, TEAMS } from '../constants/f1Data';
import { UnifiedInput, inputManager } from '../services/inputManager';
import { soundEngine } from '../services/soundEngine';
import {
  ALL_MARYLAND_ROADS,
  MARYLAND_SIGNAL_JUNCTIONS,
  ICM_PLAYER_SPAWN,
  MD_LANDMARKS,
  getMarylandZoneAndSpeedAt,
  CITY_LANE_OFFSET,
  CITY_STREET_CARS,
  CITY_MISSIONS_CATALOG,
  CITY_REGULAR_JOBS_CATALOG,
  CITY_HEIST_TARGETS_CATALOG,
  CITY_HOUSES_CATALOG,
  StreetCarSpec,
  CityMissionTemplate,
  CityRegularJobSpec,
  CityHeistTargetSpec,
  CityHouseSpec,
  MetroCitySaveState,
  loadMetroCitySave,
  saveMetroCitySave,
  canCopSeePlayer,
  buildCityMissionBeacon,
  buildCityGpsRouteLine,
  computeCityGpsRoute,
  buildCityInteractiveLandmarks,
  applyPlayerStreetCarVisual,
  getEffectiveStreetCarSpec,
  CivilianCarEntity,
  PoliceCarEntity,
  TrafficLightColor,
  getIntersectionSignalState,
  getNearestIntersectionInfo,
  buildCivilianCarMesh,
  buildPoliceInterceptorMesh,
  updateVehicleLighting,
} from './cityTrafficBuilder';
import {
  fetchLiveGaithersburgWeather,
  getOverriddenWeather,
  calculateDrivetrainTractionModifier,
  GaithersburgWeather,
  WeatherConditionType,
  WeatherMode,
  getFallbackGaithersburgWeather,
  getGaithersburgLocalTime,
} from '../services/weatherService';

export interface AICarState {
  driver: Driver;
  team: Team;
  builtCar: BuiltCar;
  progress: number;
  speedKmh: number;
  lateralOffset: number;
  targetOffset: number;
  smoothLateralVel: number;
  steerAngle: number;
  pitchAngle?: number;
  rollAngle?: number;
  smoothEvasiveOffset?: number;
  committedPassSide?: number;
  passTargetId?: string;
  passHoldTimer?: number;
  smoothTargetLateral?: number;
  raceFormPace: number;
  lap: number;
  hasCrossedInitialStartLine: boolean;
  finished: boolean;
  lapTimeCurrent: number;
  bestLapTime: number;
  lastLapTime: number | null;
  totalRaceTime: number;
  pos: THREE.Vector3;
  heading: number;
  isSpinning: boolean;
  spinTimer: number;
  isCrashed: boolean;
  crashTimer: number;
  waitTimer: number; // Duration CPU car must wait after heavy crash
  protectionShieldTimer: number; // 3-second protection shield after recovery
  lineBias?: number;
  apexAmplitude?: number;
  apexFreq?: number;
  apexPhase?: number;
  isHiddenByPracticeFilter?: boolean;
  tireCompound: TireCompound;
  tireLife: number;
  pitStopTimer: number;
  pitStopsCount: number;
}

/**
 * 3D Floating Teammate Marker / Beacon:
 * "and put like a thing so i know who is my teammate so i dont crash in to them"
 */
function createTeammate3DBeacon(_driver: Driver): THREE.Group {
  const group = new THREE.Group();

  // Clean, non-obstructive emerald F1 T-Cam marker above airbox (never blocks camera lens)
  const tCamBarGeom = new THREE.BoxGeometry(0.32, 0.045, 0.08);
  const tCamMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
  const tCamBar = new THREE.Mesh(tCamBarGeom, tCamMat);
  tCamBar.position.set(0, 1.06, 0.15);
  group.add(tCamBar);

  return group;
}

export interface GridOptions {
  botCount?: number;
  hasTeammates?: boolean;
  playerGridSlot?: number;
  isQualifyingMode?: boolean;
  qualifyingGhostDelay3s?: boolean;
  peerPlayers?: {
    id: string;
    name: string;
    carNumber: number;
    teamId: string;
    teamColor: string;
    accentColor: string;
    gridSlot: number;
  }[];
}

export interface PeerCar {
  id: string;
  name: string;
  carNumber: number;
  teamId: string;
  teamColor: string;
  accentColor: string;
  builtCar: BuiltCar;
  pos: THREE.Vector3;
  targetPos: THREE.Vector3;
  heading: number;
  targetHeading: number;
  speedKmh: number;
  progress: number;
  lap: number;
  lateralOffset: number;
  position: number;
  finished: boolean;
}

export class PhysicsEngine {
  public playerPos: THREE.Vector3 = new THREE.Vector3();
  public playerHeading: number = 0; // Radians, 0 = (0, 0, -1)
  public playerSpeedKmh: number = 0;
  public teammateStrategy: 'neutral' | 'block' | 'yield' | 'push' = 'neutral';
  public teammateRadioMsg: string = '';
  public teammateRadioSpeaker: string = '';
  public teammateRadioStatus: 'accepted' | 'refused' | 'idle' = 'idle';
  public teammateRadioTimer: number = 0;
  public playerGear: number = 1;
  public playerRpm: number = 4500;
  public playerLap: number = 1;
  public totalLaps: number = 5;
  public playerProgress: number = 0;
  public prevProgress: number = 0;
  public hasCrossedInitialStartLine: boolean = false;

  public ersBattery: number = 100;
  public drsActive: boolean = false;
  public tireCompound: TireCompound = getStoredStartingTireCompound();
  public tireLife: number = 100; // 100% Fresh -> 0% Punctured
  public tireCorners: { fl: number; fr: number; rl: number; rr: number } = {
    fl: 100,
    fr: 100,
    rl: 100,
    rr: 100,
  };
  public tireTempValue: number = 88;
  public pitStopTimer: number = 0;
  public pitStopsCount: number = 0;
  private warnedGraining: boolean = false;
  private warnedCriticalTires: boolean = false;

  public lapTimeCurrent: number = 0;
  public lapTimeBest: number | null = null;
  public lastLapTime: number | null = null;
  public raceFinished: boolean = false;

  public countdownTimer: number = 0;
  public raceTimer: number = 0;
  public raceState: 'countdown' | 'racing' | 'finished' = 'countdown';
  public lightsLit: number = 0;
  public lightsExtinguished: boolean = false;
  public falseStartTriggered: boolean = false;
  public falseStartPenaltyTimer: number = 0;
  public startReactionTimeMs: number | null = null;
  public falseStartEarlyMs: number | null = null;
  private reactionTimer: number = 0;
  private reactionTimeRecorded: boolean = false;
  public launchBannerTimer: number = 0;

  public aiCars: AICarState[] = [];
  public collisionTrauma: number = 0;
  public reverseHoldTimer: number = 0;

  // Heavy crash wait penalty (Rookie: 2.0s, Pro: 3.5s, Legend: 5.0s)
  public playerCrashWaitTimer: number = 0;
  public playerCrashWaitMax: number = 0;
  public playerProtectionShieldTimer: number = 0; // 3-second shield after recovery
  public slipstreamActive: boolean = false;
  public slipstreamFactor: number = 0;

  // Wrong way detection & 5-second auto-respawn
  public wrongWayWarning: boolean = false;
  public wrongWayTimer: number = 0;
  private hasReachedSector2: boolean = false;
  private hasReachedSector3: boolean = false;

  public getCrashWaitDuration(): number {
    if (this.difficulty === 'rookie') return 2.0;
    if (this.difficulty === 'pro') return 3.5;
    if (this.difficulty === 'legend') return 5.0;
    return 3.5;
  }

  // Real-time race finishing order (Tracks exact order cars cross the finish line!)
  public finishedDriversOrder: string[] = [];
  public yellowFlagActive: boolean = false;
  public yellowFlagTimer: number = 0;

  // Top speed gear ratios: 8th gear can freely reach up to 530+ km/h without artificial limiter
  private gearMaxSpeeds = [0, 95, 160, 225, 285, 345, 400, 455, 530];
  public manualGearMode: boolean = (() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem('apex26_manual_gear_mode') === 'true';
    } catch {
      return false;
    }
  })();
  public manualGearHoldTimer: number = 0;
  private lastAutoForceShiftDir: 'up' | 'down' | null = null;

  // Context-Aware Race Engineer Radio State
  public raceEngineerRadio?: {
    message: string;
    category: 'gap' | 'tires' | 'incident' | 'strategy' | 'start';
    priority: 'normal' | 'warning' | 'critical';
    speaker: string;
    timestamp: number;
  };
  private engineerRadioTimer: number = 0;
  private engineerCalloutCooldowns: Record<string, number> = {};
  private engineerAnnouncedStart: boolean = false;
  private warnBlistering: boolean = false;
  private lastAnnouncedLap: number = 1;

  // Pre-allocated Scratch Vectors for Zero-GC 60-240Hz Physics Loop Optimization
  private readonly _scratchCarFwd = new THREE.Vector3();
  private readonly _scratchForwardVec = new THREE.Vector3();
  private readonly _scratchCurrentVel = new THREE.Vector3();
  private readonly _scratchTargetWorldPos = new THREE.Vector3();
  private readonly _scratchAiSepDiff = new THREE.Vector3();
  private readonly _scratchPFwd = new THREE.Vector3();
  private readonly _scratchAiFwd = new THREE.Vector3();
  private readonly _scratchColDiff = new THREE.Vector3();
  private readonly _scratchContactNorm = new THREE.Vector3();
  private readonly _scratchFallbackNorm = new THREE.Vector3();
  private readonly _scratchPlayerVel = new THREE.Vector3();
  private readonly _scratchAiVel = new THREE.Vector3();
  private readonly _scratchPPts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly _scratchAiPts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  public telemetry: TelemetryData;
  public enginePowerRating: number = 85;
  public engineReliability: number = 80;
  public accelerationScore: number = 85;
  public handlingScore: number = 82;
  public downforceScore: number = 80;
  public brakesScore: number = 85;
  private baseCareerRatings = {
    enginePowerRating: 85,
    engineReliability: 80,
    accelerationScore: 85,
    handlingScore: 82,
    downforceScore: 80,
    brakesScore: 85,
  };
  public customTopSpeedKmh?: number;
  public teammateDriverId?: string;
  public playerDriver: Driver;
  public peerCars: Map<string, PeerCar> = new Map();
  public multiplayerMode: boolean = false;
  public isQualifyingMode: boolean = false;
  public qualifyingGhostDelay3s: boolean = true;
  public isOpenFieldMode: boolean = false;
  public openFieldSpecMode: 'career_car' | 'stock_baseline' | 'hyper_prototype' | 'unlimited_x' = 'career_car';
  private dragRunOrigin: THREE.Vector3 = new THREE.Vector3(-230, 0.25, 450);
  private dragRunActive: boolean = false;
  private dragRunElapsedSec: number = 0;
  private roll100To200Active: boolean = false;
  private roll100To200ElapsedSec: number = 0;
  private brakeTestActive: boolean = false;
  private brakeTestOrigin: THREE.Vector3 = new THREE.Vector3();
  public openFieldStats: {
    zeroTo100Sec: number | null;
    bestZeroTo100Sec: number | null;
    zeroTo200Sec: number | null;
    bestZeroTo200Sec: number | null;
    zeroTo300Sec: number | null;
    bestZeroTo300Sec: number | null;
    oneHundredTo200Sec: number | null;
    bestOneHundredTo200Sec: number | null;
    quarterMileSec: number | null;
    bestQuarterMileSec: number | null;
    oneKmSec: number | null;
    bestOneKmSec: number | null;
    brake100To0Meters: number | null;
    bestBrake100To0Meters: number | null;
    peakSpeedKmh: number;
    peakLateralG: number;
    totalDistanceKm: number;
    coordX: number;
    coordZ: number;
    headingCompass: string;
    infiniteGripAndBatteryLock: boolean;
    currentZone: string;
    surfaceLabel: string;
    activeSpecMode: 'career_car' | 'stock_baseline' | 'hyper_prototype' | 'unlimited_x';
  } = {
    zeroTo100Sec: null,
    bestZeroTo100Sec: null,
    zeroTo200Sec: null,
    bestZeroTo200Sec: null,
    zeroTo300Sec: null,
    bestZeroTo300Sec: null,
    oneHundredTo200Sec: null,
    bestOneHundredTo200Sec: null,
    quarterMileSec: null,
    bestQuarterMileSec: null,
    oneKmSec: null,
    bestOneKmSec: null,
    brake100To0Meters: null,
    bestBrake100To0Meters: null,
    peakSpeedKmh: 0,
    peakLateralG: 0,
    totalDistanceKm: 0,
    coordX: -230,
    coordZ: 450,
    headingCompass: 'N',
    infiniteGripAndBatteryLock: true,
    currentZone: 'INFINITE TOP-SPEED HIGHWAY',
    surfaceLabel: 'HIGH-GRIP RACING ROAD TARMAC',
    activeSpecMode: 'career_car',
  };

  // Metro City Driving, Street Car Dealership, Missions & Police Pursuit State
  public isCityMode: boolean = false;
  public cityCivilianCars: CivilianCarEntity[] = [];
  public cityPoliceCars: PoliceCarEntity[] = [];
  private lastRedLightKey: string = '';
  private playerInsideIntersectionKey: string | null = null;
  private playerApproachAxis: 'ns' | 'ew' = 'ns';
  private playerEntryHeading: number = 0;
  private playerEntrySignal: TrafficLightColor = 'GREEN';
  public citySave: MetroCitySaveState = loadMetroCitySave();
  public cityStreetCarTopSpeedKmh: number = 185;
  private missionBeacon?: ReturnType<typeof buildCityMissionBeacon>;
  private gpsRouteRibbon?: ReturnType<typeof buildCityGpsRouteLine>;
  private cityLandmarks?: ReturnType<typeof buildCityInteractiveLandmarks>;
  private activeMissionTemplate: CityMissionTemplate | null = null;
  private activeMissionWaypointIdx: number = 0;
  private activeMissionTimeLeft: number = 0;
  private activeMissionCrashesStart: number = 0;
  private activeMissionAwaitingEscape: boolean = false;
  private blinkerTickAccum: number = 0;
  private nearMissCooldowns: Map<string, number> = new Map();
  private streetDriftAccum: number = 0;
  private passiveIncomeAccumSec: number = 0;
  private customGpsTarget: { x: number; z: number; label: string; colorHex: string } | null = null;
  private activeRobberyState: {
    target: CityHeistTargetSpec;
    elapsedSec: number;
  } | null = null;
  private pendingHeistLoot: {
    amount: number;
    targetName: string;
    icon: string;
    homeX: number;
    homeZ: number;
    homeName: string;
  } | null = null;
  private activeJobSpec: CityRegularJobSpec | null = null;
  private activeJobRouteIdx: number = 0;
  private activeJobStage: 'PICKUP' | 'DROPOFF' = 'PICKUP';
  private activeJobTimeLeft: number = 0;
  private activeJobStreak: number = 0;
  private activeJobTotalEarned: number = 0;
  private activeJobCrashesStart: number = 0;
  private civEvasiveOffsets: Map<string, number> = new Map();
  private civHornCooldowns: Map<string, number> = new Map();
  public isMinigamePaused: boolean = false;
  private bankMinigameGraceTimer: number = 0;
  public cityPursuitStats: {
    wantedStars: number;
    pursuitState: 'CLEAR' | 'PURSUIT' | 'COOLDOWN' | 'BUSTED';
    redLightsRun: number;
    unpaidRedLightTickets: number;
    hasActiveWarrant: boolean;
    warrantReason: string;
    trafficCarsHit: number;
    policeCarsHit: number;
    totalBountyFines: number;
    bustProgress: number;
    escapeProgress: number;
    activeAlertBanner: string;
    activeAlertTimer: number;
    nearestSignalColor: TrafficLightColor;
    nearestSignalSecondsLeft: number;
    nearestStreetName: string;
    activePoliceUnitsCount: number;
    closestCopDistMeters: number;
    recentViolations: string[];
    copCanSeePlayer: boolean;
    streetCash: number;
    streetRepLevel: number;
    completedMissions: number;
    currentStreetCar: StreetCarSpec;
    ownedCarIds: string[];
    unlockedTrimsByCar: Record<string, string[]>;
    activeTrimByCar: Record<string, string>;
    customPaintByCar: Record<string, string>;
    ownedHouseIds: string[];
    activeHomeId: string | null;
    passiveIncomePer30s: number;
    unpaidCrashTicketsTab: number;
    totalJobsCompleted: number;
    totalHeistsCompleted: number;
    heistCooldowns: Record<string, number>;
    pendingHeistLoot: {
      amount: number;
      targetName: string;
      icon: string;
      homeX: number;
      homeZ: number;
      homeName: string;
      distMeters: number;
      directionDeg: number;
      copSeesYouNow: boolean;
    } | null;
    minimapData: {
      playerX: number;
      playerZ: number;
      playerHeading: number;
      gpsTarget: {
        x: number;
        z: number;
        label: string;
        color: string;
        distMeters: number;
        turnInstruction: string;
      } | null;
      gpsRoute: { x: number; z: number }[];
      cops: { x: number; z: number; heading: number; isChasing: boolean; canSeePlayer: boolean }[];
      civs: { x: number; z: number }[];
      activeHome: { x: number; z: number; name: string };
    };
    nearbyHeistPrompt: {
      targetId: string;
      name: string;
      icon: string;
      category: string;
      payoutCash: number;
      wantedStarsTriggered: number;
      distMeters: number;
      cooldownLeftSec: number;
      robberyProgressPct: number;
      isRobbingNow: boolean;
    } | null;
    nearbyHousePrompt: {
      houseId: string;
      name: string;
      icon: string;
      price: number;
      isOwned: boolean;
      passiveIncomePerMin: number;
      distMeters: number;
      robPayoutCash: number;
      robCooldownLeftSec: number;
    } | null;
    activeRegularJob: {
      jobId: string;
      title: string;
      roleLabel: string;
      icon: string;
      stage: 'PICKUP' | 'DROPOFF';
      targetLabel: string;
      distMeters: number;
      directionDeg: number;
      timeLeftSec: number;
      basePay: number;
      streakCount: number;
      shiftEarnedCash: number;
    } | null;
    turnSignal: 'off' | 'left' | 'right' | 'hazards';
    blinkerFlashOn: boolean;
    lastSkillBonusPopup: {
      label: string;
      amount: number;
      timer: number;
    } | null;
    civilianAtFaultClaim: {
      active: boolean;
      civId: string;
      status: 'CAN_CALL_COPS' | 'FLEEING';
      timeLeftSec: number;
      payoutAmount: number;
      distMeters: number;
    } | null;
    playerAtFaultSettlement: {
      active: boolean;
      fineAmount: number;
      timeLeftSec: number;
      crashX: number;
      crashZ: number;
      stoppedProgress: number;
    } | null;
    activeMission: {
      id: string;
      title: string;
      category: string;
      waypointLabel: string;
      waypointIndex: number;
      totalWaypoints: number;
      distMeters: number;
      directionDeg: number;
      timeLeftSec: number;
      rewardCash: number;
      minSpeedKmh?: number;
      maxCrashesAllowed?: number;
      crashesTaken: number;
      awaitingEscape: boolean;
    } | null;
    // Police Career, Radar Gun & Speed Enforcement
    isPoliceOnDuty: boolean;
    policeRank: 'Officer' | 'Senior Officer' | 'Sergeant' | 'Lieutenant' | 'Captain' | 'Chief';
    policeShiftEarnings: number;
    totalArrestsMade: number;
    totalTicketsIssued: number;
    policeSirenActive: boolean;
    authorizedChaseSuspectId: string | null;
    radarTarget: {
      civId: string;
      modelName: string;
      licensePlate: string;
      colorName: string;
      clockedSpeedMph: number;
      speedLimitMph: number;
      distMeters: number;
      status: 'CLEAN' | 'SPEEDING' | 'RED_LIGHT_RUNNER' | 'WARRANT_ACTIVE' | 'BANK_ROBBER' | 'HIT_AND_RUN';
      probableCauseValid: boolean;
      probableCauseReason: string;
      isStopped: boolean;
      isFleeing: boolean;
      hidingInHouseAddress?: string;
      hasAcceptedPullOver?: boolean;
      isCompliant?: boolean;
      isWarrantFelon?: boolean;
      safehouseAddress?: string;
      escapedToSafehouse?: boolean;
    } | null;
    currentSpeedLimitMph: number;
    currentZoneName: string;
    policePrecinctNear: boolean;
    policeStationPrompt: {
      isOpen: boolean;
      distMeters: number;
    } | null;
    megaphoneSubtitle: {
      text: string;
      timer: number;
      speaker: string;
    } | null;
    policeRadarWarning: {
      active: boolean;
      distanceMeters: number;
      copId: string;
      zoneLimitMph: number;
      currentSpeedMph: number;
      message: string;
    } | null;
    playerBeingPulledOver: {
      active: boolean;
      copId: string;
      reason: string;
      fine: number;
      timeLeftSec: number;
      canComply: boolean;
      complied: boolean;
    } | null;
    bankRobberyBustCount: number;
    inDebt: boolean;
    heistDebtAmount: number;
    completedMissionIds: string[];
    activeBankMinigameTarget: {
      id: string;
      name: string;
      category: 'BANK' | 'JEWELRY' | 'STORE' | 'HOUSE';
      payoutCash: number;
      streetLocation: string;
      icon: string;
    } | null;
  } = {
    wantedStars: 0,
    pursuitState: 'CLEAR',
    redLightsRun: 0,
    unpaidRedLightTickets: 0,
    hasActiveWarrant: false,
    warrantReason: '',
    trafficCarsHit: 0,
    policeCarsHit: 0,
    totalBountyFines: 0,
    bustProgress: 0,
    escapeProgress: 0,
    activeAlertBanner: '',
    activeAlertTimer: 0,
    nearestSignalColor: 'GREEN',
    nearestSignalSecondsLeft: 10,
    nearestStreetName: 'CENTRAL AVE & 1ST BLVD',
    activePoliceUnitsCount: 0,
    closestCopDistMeters: 999,
    recentViolations: [],
    copCanSeePlayer: false,
    streetCash: 5000,
    streetRepLevel: 1,
    completedMissions: 0,
    currentStreetCar: CITY_STREET_CARS[0],
    ownedCarIds: ['honda_civic', 'toyota_camry'],
    unlockedTrimsByCar: {
      honda_civic: ['civic_lx'],
      toyota_camry: ['camry_se'],
    },
    activeTrimByCar: {
      honda_civic: 'civic_lx',
      toyota_camry: 'camry_se',
    },
    customPaintByCar: {},
    ownedHouseIds: [],
    activeHomeId: null,
    passiveIncomePer30s: 0,
    unpaidCrashTicketsTab: 0,
    totalJobsCompleted: 0,
    totalHeistsCompleted: 0,
    heistCooldowns: {},
    pendingHeistLoot: null,
    minimapData: {
      playerX: 6.5,
      playerZ: 225,
      playerHeading: 0,
      gpsTarget: null,
      gpsRoute: [],
      cops: [],
      civs: [],
      activeHome: { x: 6.5, z: 345, name: 'Southside Brick Garage Loft' },
    },
    nearbyHeistPrompt: null,
    nearbyHousePrompt: null,
    activeRegularJob: null,
    turnSignal: 'off',
    blinkerFlashOn: false,
    lastSkillBonusPopup: null,
    civilianAtFaultClaim: null,
    playerAtFaultSettlement: null,
    activeMission: null,
    isPoliceOnDuty: false,
    policeRank: 'Officer',
    policeShiftEarnings: 0,
    totalArrestsMade: 0,
    totalTicketsIssued: 0,
    policeSirenActive: false,
    authorizedChaseSuspectId: null,
    radarTarget: null,
    currentSpeedLimitMph: 45,
    currentZoneName: 'Downtown Financial District',
    policePrecinctNear: false,
    policeStationPrompt: null,
    megaphoneSubtitle: null,
    policeRadarWarning: null,
    playerBeingPulledOver: null,
    bankRobberyBustCount: 0,
    inDebt: false,
    heistDebtAmount: 0,
    completedMissionIds: [],
    activeBankMinigameTarget: null,
  };

  public currentWeather: GaithersburgWeather = (() => {
    const t = getGaithersburgLocalTime();
    return getFallbackGaithersburgWeather(t.localTimeString, t.localHour, t.isDaytime, t.sunAltitude);
  })();
  public weatherMode: WeatherMode = 'live_gaithersburg';
  private weatherRefreshTimer: number = 0;
  private policeDriveThroughCooldown: number = 0;
  private radarWarningBeepTimer: number = 0;

  public async refreshLiveWeather(): Promise<void> {
    if (this.weatherMode !== 'live_gaithersburg') return;
    try {
      const weather = await fetchLiveGaithersburgWeather();
      this.currentWeather = weather;
    } catch (_err) {
      // Keep existing weather or fallback
    }
  }

  public setWeatherMode(mode: WeatherMode): void {
    this.weatherMode = mode;
    if (mode === 'live_gaithersburg') {
      this.refreshLiveWeather();
    } else {
      this.currentWeather = getOverriddenWeather(mode as WeatherConditionType);
    }
  }

  public getTireSprayState(): {
    active: boolean;
    type: 'rain' | 'snow' | 'none';
    intensity: number;
    speedKmh: number;
  } {
    if (!this.isCityMode) {
      return { active: false, type: 'none', intensity: 0, speedKmh: this.playerSpeedKmh };
    }
    const isWet = this.currentWeather.isRaining || this.currentWeather.condition === 'drizzle' || this.currentWeather.condition === 'heavy_rain';
    const isSnow = this.currentWeather.isSnowing;
    if (!isWet && !isSnow) {
      return { active: false, type: 'none', intensity: 0, speedKmh: this.playerSpeedKmh };
    }
    const speedThreshold = 14;
    const active = Math.abs(this.playerSpeedKmh) > speedThreshold;
    return {
      active,
      type: isSnow ? 'snow' : 'rain',
      intensity: this.currentWeather.precipitationRate || 0.65,
      speedKmh: Math.abs(this.playerSpeedKmh),
    };
  }

  constructor(
    public playerCar: BuiltCar,
    public track: GeneratedTrack,
    laps: number = 5,
    public playerDriverId: string = 'bearman',
    public difficulty: 'rookie' | 'pro' | 'legend' = 'pro',
    public playerTeam?: Team,
    public customTeamConfig?: CustomTeamConfig | null
  ) {
    this.totalLaps = laps;
    this.isOpenFieldMode = Boolean(this.track.isOpenField);
    this.isCityMode = Boolean(this.track.isCityDriving);
    this.refreshLiveWeather();
    this.playerDriver = DRIVERS.find((d) => d.id === this.playerDriverId) || DRIVERS[0];

    // Determine player's active teammate
    if (this.customTeamConfig && this.playerTeam?.id === this.customTeamConfig.id) {
      this.teammateDriverId = this.customTeamConfig.teammateDriverId;
      this.customTopSpeedKmh = this.customTeamConfig.engineTopSpeed;
    } else if (this.playerTeam?.drivers) {
      this.teammateDriverId = this.playerTeam.drivers.find((id) => id !== this.playerDriverId) || this.playerTeam.drivers[0];
    }

    // Calculate player car power, acceleration, handling, downforce, brakes based on distinct team profiles & upgrades (Uncapped ratings)
    if (this.customTeamConfig && this.playerTeam?.id === this.customTeamConfig.id) {
      this.enginePowerRating = this.customTeamConfig.enginePower || 88;
      this.engineReliability = this.customTeamConfig.engineReliability ?? 80;
      this.accelerationScore = 80 + (this.customTeamConfig.enginePower ? (this.customTeamConfig.enginePower - 80) * 1.15 : 0);
      this.handlingScore = 80 + (this.customTeamConfig.handlingBonus || 0);
      this.downforceScore = 80 + ((this.customTeamConfig.aeroDownforceBonus || 0) * 55);
      this.brakesScore = 80 + (this.customTeamConfig.brakesBonus || 0);
    } else if (this.playerTeam?.carProfile) {
      this.enginePowerRating = this.playerTeam.carProfile.topSpeedRating;
      this.engineReliability = (this.playerTeam as any).engineReliability || 82;
      this.accelerationScore = this.playerTeam.carProfile.acceleration;
      this.handlingScore = this.playerTeam.carProfile.handlingRating;
      this.downforceScore = this.playerTeam.carProfile.aeroDownforce;
      this.brakesScore = this.playerTeam.carProfile.brakesRating || 85;
    }

    this.baseCareerRatings = {
      enginePowerRating: this.enginePowerRating,
      engineReliability: this.engineReliability,
      accelerationScore: this.accelerationScore,
      handlingScore: this.handlingScore,
      downforceScore: this.downforceScore,
      brakesScore: this.brakesScore,
    };

    // Configure authentic acoustic engine noise profile based on team / constructor power unit:
    const engineIdentifier = this.customTeamConfig?.engineId || this.customTeamConfig?.engine || this.playerTeam?.engine || 'ferrari';
    soundEngine.setEngineProfile(engineIdentifier);

    // Sync initial 3D Pirelli sidewall compound color on player car
    this.tireCompound = getStoredStartingTireCompound();
    this.playerCar.setTireCompound(this.tireCompound);
    this.playerCar.setTireHealthVisuals(100, 88);

    this.telemetry = {
      speedKmh: 0,
      gear: 1,
      rpm: 4500,
      maxRpm: 15000,
      throttle: 0,
      brake: 0,
      steer: 0,
      ersBattery: 100,
      drsActive: false,
      drsAvailable: false,
      tireWear: 0,
      tireLife: 100,
      tireTemp: 90,
      tireCompound: this.tireCompound,
      tireThermalState: 'OPTIMAL_WINDOW',
      currentLap: 1,
      totalLaps: this.totalLaps,
      lapTimeCurrent: 0,
      lapTimeBest: null,
      lastLapTime: null,
      deltaToLeader: 0,
      position: 17,
      trackProgress: 0,
      offTrack: false,
      onCurb: false,
      carsRadar: [],
    };
  }

  public initGrid(
    playerDriverId: string,
    aiCarBuilderFn: (team: Team, driver: Driver) => BuiltCar,
    options?: GridOptions
  ) {
    this.aiCars = [];
    this.peerCars = new Map();
    this.finishedDriversOrder = [];
    const allDrivers = [...DRIVERS];
    const playerDriver = allDrivers.find((d) => d.id === playerDriverId) || allDrivers[0];

    const shouldHaveTeammate = options?.hasTeammates !== false && Boolean(this.teammateDriverId);
    const baseTeammateDriver = shouldHaveTeammate ? allDrivers.find((d) => d.id === this.teammateDriverId) : null;
    const teammateDriver =
      baseTeammateDriver && this.customTeamConfig && this.playerTeam?.id === this.customTeamConfig.id
        ? {
            ...baseTeammateDriver,
            name: this.customTeamConfig.teammateCustomName || baseTeammateDriver.name,
            rating: this.customTeamConfig.teammateCustomRating ?? baseTeammateDriver.rating,
          }
        : baseTeammateDriver;

    // Filter available pool of other AI drivers
    const otherAiDrivers = allDrivers.filter(
      (d) => d.id !== playerDriver.id && d.id !== this.teammateDriverId
    );

    // Dynamic qualifying simulation & balance
    otherAiDrivers.sort((a, b) => {
      const teamA = TEAMS.find((t) => t.id === a.teamId);
      const teamB = TEAMS.find((t) => t.id === b.teamId);
      const tierScoreA = (4 - (teamA?.performanceTier || 3)) * 4.5;
      const tierScoreB = (4 - (teamB?.performanceTier || 3)) * 4.5;
      const randomQFactorA = (Math.random() * 18.0) - 9.0;
      const randomQFactorB = (Math.random() * 18.0) - 9.0;
      const qSpecialistBonusA = (a.id === 'norris' || a.id === 'leclerc') ? 3.0 : 0;
      const qSpecialistBonusB = (b.id === 'norris' || b.id === 'leclerc') ? 3.0 : 0;
      const qualifyA = a.rating + tierScoreA + randomQFactorA + qSpecialistBonusA;
      const qualifyB = b.rating + tierScoreB + randomQFactorB + qSpecialistBonusB;
      return qualifyB - qualifyA;
    });

    // Desired bot count: total human players + bots cannot exceed 20
    const humanPeerCount = options?.peerPlayers?.length || 0;
    const maxBotsAllowed = Math.max(0, 20 - 1 - humanPeerCount);
    const targetBotCount = options?.botCount !== undefined
      ? Math.min(maxBotsAllowed, Math.max(0, options.botCount))
      : maxBotsAllowed;

    // AI Drivers list for this race
    const activeAiDrivers: Driver[] = [];
    if (teammateDriver && targetBotCount > 0) {
      activeAiDrivers.push(teammateDriver);
    }
    for (const d of otherAiDrivers) {
      if (activeAiDrivers.length >= targetBotCount) break;
      activeAiDrivers.push(d);
    }

    // Grid placement
    this.isQualifyingMode = Boolean(options?.isQualifyingMode);
    this.qualifyingGhostDelay3s =
      options?.qualifyingGhostDelay3s !== undefined
        ? Boolean(options.qualifyingGhostDelay3s)
        : true;
    const playerStartingGrid = this.isQualifyingMode
      ? 1
      : (options?.playerGridSlot || (playerDriver.teamId === 'haas' ? 17 : Math.max(1, 21 - Math.floor(playerDriver.rating / 5))));

    // Track slots occupied by remote peer players
    const peerSlotMap = new Map<number, NonNullable<GridOptions['peerPlayers']>[0]>();
    if (options?.peerPlayers) {
      for (const p of options.peerPlayers) {
        peerSlotMap.set(p.gridSlot, p);
      }
    }

    // In Open-Field Proving Ground or Metro City Driving Mode, spawn player with instant green light!
    if (this.isOpenFieldMode) {
      if (this.isCityMode) {
        // Spawn directly inside Islamic Center of Maryland (19411 Woodfield Rd) North lot facing WNW toward Woodfield Rd
        this.playerPos.set(ICM_PLAYER_SPAWN.x, ICM_PLAYER_SPAWN.y, ICM_PLAYER_SPAWN.z);
        this.playerHeading = ICM_PLAYER_SPAWN.heading;
        this.spawnCityTrafficAndPolice();
      } else {
        this.playerPos.set(-230, 0.33, 450);
        this.playerHeading = 0; // Facing North (-Z) straight down the 1.4km Drag Strip toward the Skidpad & Open Field
      }
      this.playerCar.root.position.copy(this.playerPos);
      this.playerCar.root.rotation.y = this.playerHeading;
      this.playerSpeedKmh = 0;
      this.raceState = 'racing';
      this.lightsLit = 5;
      this.lightsExtinguished = true;
      this.track.setStartLights(5, true);
      this.dragRunOrigin.copy(this.playerPos);
      this.dragRunActive = false;
      this.dragRunElapsedSec = 0;
      return;
    }

    let aiIndex = 0;
    for (let gridPos = 1; gridPos <= 20; gridPos++) {
      // In Qualifying Mode, all 20 cars start in the exact same spot (25m behind start line, centerline)
      const slotDistBehind = this.isQualifyingMode ? 25.0 : 16 + gridPos * 9.0;
      const gridT = ((1.0 - slotDistBehind / this.track.trackLength) % 1.0 + 1.0) % 1.0;
      const { position, tangent, normal } = this.track.getTrackPointAtProgress(gridT);
      const sideOffset = this.isQualifyingMode ? 0 : (gridPos % 2 === 1 ? -2.4 : 2.4);
      const carPos = position.clone().addScaledVector(normal, sideOffset);
      carPos.y = position.y + 0.08;
      const heading = Math.atan2(-tangent.x, -tangent.z);

      if (gridPos === playerStartingGrid) {
        this.playerPos.copy(carPos);
        this.playerHeading = heading;
        this.playerCar.root.position.copy(this.playerPos);
        this.playerCar.root.rotation.y = this.playerHeading;
        this.playerProgress = gridT;
        this.prevProgress = gridT;
        this.playerSpeedKmh = 0;
        this.hasCrossedInitialStartLine = false;
        continue;
      }

      // Check if a remote peer human player occupies this slot
      const peerInSlot = peerSlotMap.get(gridPos);
      if (peerInSlot) {
        this.addPeerCar(peerInSlot, aiCarBuilderFn);
        continue;
      }

      if (aiIndex >= activeAiDrivers.length) continue;
      const driver = activeAiDrivers[aiIndex];
      let team = TEAMS.find((t) => t.id === driver.teamId) || TEAMS[0];
      const isTeammate = Boolean(this.teammateDriverId && driver.id === this.teammateDriverId);
      if (isTeammate && this.playerTeam) {
        team = this.playerTeam;
      }
      const builtCar = aiCarBuilderFn(team, driver);

      if (isTeammate) {
        const teammateBeacon = createTeammate3DBeacon(driver);
        builtCar.root.add(teammateBeacon);
      }

      // In Qualifying Mode, render AI cars as pass-through ghost cars (and optionally hide them for the first 3 seconds if 3s delay is enabled)
      if (this.isQualifyingMode) {
        builtCar.root.visible = !this.qualifyingGhostDelay3s;
        builtCar.root.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            if (Array.isArray(mesh.material)) {
              mesh.material = mesh.material.map((m) => {
                const clone = m.clone();
                clone.transparent = true;
                clone.opacity = 0.28;
                clone.depthWrite = false;
                return clone;
              });
            } else if (mesh.material) {
              const clone = mesh.material.clone();
              clone.transparent = true;
              clone.opacity = 0.28;
              clone.depthWrite = false;
              mesh.material = clone;
            }
          }
        });
      }

      builtCar.root.position.copy(carPos);
      builtCar.root.rotation.y = heading;

      // Give every AI driver a distinct racing line preference so not all drivers take the same line
      const distinctLineBias = ((aiIndex % 9) - 4) * 1.45 + (aiIndex >= 9 ? 0.65 : -0.65);
      const distinctApexAmp = 1.8 + (aiIndex % 5) * 0.6;
      const distinctApexFreq = [4.0, 6.0, 8.0, 10.0][aiIndex % 4];
      const distinctApexPhase = aiIndex * 1.15 + (driver.number % 7) * 0.55;

      // Assign authentic starting Pirelli tire compound strategy per AI rival
      const aiCompound: TireCompound = this.isQualifyingMode
        ? 'SOFT'
        : gridPos <= 6
        ? (aiIndex % 2 === 0 ? 'SOFT' : 'MEDIUM')
        : gridPos <= 14
        ? (aiIndex % 3 === 0 ? 'MEDIUM' : aiIndex % 3 === 1 ? 'SOFT' : 'HARD')
        : (aiIndex % 2 === 0 ? 'HARD' : 'MEDIUM');
      builtCar.setTireCompound(aiCompound);
      builtCar.setTireHealthVisuals(100, 90);

      this.aiCars.push({
        driver,
        team,
        builtCar,
        progress: gridT,
        speedKmh: 0,
        lateralOffset: sideOffset,
        targetOffset: distinctLineBias,
        lineBias: distinctLineBias,
        apexAmplitude: distinctApexAmp,
        apexFreq: distinctApexFreq,
        apexPhase: distinctApexPhase,
        isHiddenByPracticeFilter: false,
        smoothLateralVel: 0,
        steerAngle: 0,
        raceFormPace: (Math.random() - 0.5) * 16.0,
        lap: 1,
        hasCrossedInitialStartLine: false,
        finished: false,
        lapTimeCurrent: 0,
        bestLapTime: 999,
        lastLapTime: null,
        totalRaceTime: 0,
        pos: carPos,
        heading,
        isSpinning: false,
        spinTimer: 0,
        isCrashed: false,
        crashTimer: 0,
        waitTimer: 0,
        protectionShieldTimer: 0,
        tireCompound: aiCompound,
        tireLife: 100,
        pitStopTimer: 0,
        pitStopsCount: 0,
      });

      aiIndex++;
    }
  }

  public setPracticeBotCount(count: number) {
    const clamped = Math.max(0, Math.min(this.aiCars.length, count));
    this.aiCars.forEach((ai, idx) => {
      const hidden = idx >= clamped;
      ai.isHiddenByPracticeFilter = hidden;
      ai.builtCar.root.visible = !hidden;
    });
  }

  public addPeerCar(
    peer: { id: string; name: string; carNumber: number; teamId: string; teamColor: string; accentColor: string; gridSlot: number },
    builderFn: (team: Team, driver: Driver) => BuiltCar
  ): PeerCar {
    const slotDistBehind = 16 + peer.gridSlot * 9.0;
    const gridT = ((1.0 - slotDistBehind / this.track.trackLength) % 1.0 + 1.0) % 1.0;
    const { position, tangent, normal } = this.track.getTrackPointAtProgress(gridT);
    const sideOffset = peer.gridSlot % 2 === 1 ? -2.4 : 2.4;
    const carPos = position.clone().addScaledVector(normal, sideOffset);
    carPos.y = position.y + 0.08;
    const heading = Math.atan2(-tangent.x, -tangent.z);

    const peerTeam: Team = TEAMS.find((t) => t.id === peer.teamId) || {
      id: peer.teamId || 'custom',
      name: peer.name + ' Racing',
      shortName: peer.name.slice(0, 3).toUpperCase(),
      engine: 'Mercedes-AMG M17',
      primaryColor: peer.teamColor || '#00e5ff',
      secondaryColor: '#111111',
      accentColor: peer.accentColor || '#ffffff',
      performanceTier: 2,
      drivers: [peer.id, 'dummy'],
      reputationRequired: 0,
      baseSalary: 1000000,
    };

    const peerDriver: Driver = {
      id: peer.id,
      name: peer.name,
      shortName: (peer.name.trim().split(/\s+/).pop()?.slice(0, 3) || 'RIV').toUpperCase(),
      number: peer.carNumber || 7,
      country: 'Global',
      countryCode: 'UN',
      teamId: peer.teamId || 'custom',
      rating: 88,
      aggression: 0.85,
      color: peer.teamColor || '#00e5ff',
    };

    const builtCar = builderFn(peerTeam, peerDriver);
    builtCar.root.position.copy(carPos);
    builtCar.root.rotation.y = heading;

    // Attach 3D multiplayer nametag over peer vehicle
    if (typeof document !== 'undefined') {
      const nameCanvas = document.createElement('canvas');
      nameCanvas.width = 256;
      nameCanvas.height = 72;
      const ctx = nameCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(10, 12, 18, 0.85)';
        ctx.beginPath();
        ctx.roundRect(4, 4, 248, 64, 16);
        ctx.fill();
        ctx.strokeStyle = peer.teamColor || '#00e5ff';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`#${peer.carNumber} ${peer.name}`, 128, 36);
      }
      const nameTex = new THREE.CanvasTexture(nameCanvas);
      const namePlate = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 0.42),
        new THREE.MeshBasicMaterial({ map: nameTex, transparent: true, side: THREE.DoubleSide })
      );
      namePlate.position.set(0, 1.45, 0);
      builtCar.root.add(namePlate);
    }

    const peerCar: PeerCar = {
      id: peer.id,
      name: peer.name,
      carNumber: peer.carNumber,
      teamId: peer.teamId,
      teamColor: peer.teamColor,
      accentColor: peer.accentColor,
      builtCar,
      pos: carPos,
      targetPos: carPos.clone(),
      heading,
      targetHeading: heading,
      speedKmh: 0,
      progress: gridT,
      lap: 1,
      lateralOffset: sideOffset,
      position: peer.gridSlot,
      finished: false,
    };

    this.peerCars.set(peer.id, peerCar);
    return peerCar;
  }

  public updatePeerCar(data: {
    playerId: string;
    progress: number;
    lap: number;
    speedKmh: number;
    lateralOffset: number;
    heading: number;
    carPos: { x: number; y: number; z: number };
    position: number;
  }) {
    const peer = this.peerCars.get(data.playerId);
    if (!peer) return;

    peer.progress = data.progress;
    peer.lap = data.lap;
    peer.speedKmh = data.speedKmh;
    peer.lateralOffset = data.lateralOffset;
    peer.position = data.position;
    peer.targetPos.set(data.carPos.x, data.carPos.y, data.carPos.z);
    peer.targetHeading = data.heading;
  }

  public removePeerCar(playerId: string) {
    const peer = this.peerCars.get(playerId);
    if (peer) {
      this.peerCars.delete(playerId);
      if (peer.builtCar.root.parent) {
        peer.builtCar.root.parent.remove(peer.builtCar.root);
      }
    }
  }

  /**
   * Pit Box / Tire Compound Service:
   * Allows switching between SOFT (Peak Grip, Fast Wear), MEDIUM (Balanced), and HARD (Durable)
   * and replenishing Tire Life back to 100% with a 2.2s FIA Pit Crew stop during racing (or instant pre-start/practice).
   */
  public requestPitStop(newCompound?: TireCompound): void {
    if (newCompound) {
      this.tireCompound = newCompound;
      this.playerCar.setTireCompound(this.tireCompound);
    }

    this.warnedGraining = false;
    this.warnedCriticalTires = false;

    if (this.isQualifyingMode) {
      this.tireLife = 100;
      this.tireCorners = { fl: 100, fr: 100, rl: 100, rr: 100 };
      this.tireTempValue = 92;
      this.playerCar.setTireHealthVisuals(100, 92);
      return;
    }

    // Pre-start grid tire choice: instant swap, saves preference, does not count as an in-race pit stop
    if (this.raceState === 'countdown') {
      this.pitStopTimer = 0;
      this.tireLife = 100;
      this.tireCorners = { fl: 100, fr: 100, rl: 100, rr: 100 };
      this.tireTempValue = 88;
      setStoredStartingTireCompound(this.tireCompound);
      this.playerCar.setTireHealthVisuals(100, 88);
      const spec = TIRE_COMPOUND_SPECS[this.tireCompound];
      this.teammateRadioSpeaker = 'PIT WALL';
      this.teammateRadioStatus = 'accepted';
      this.teammateRadioMsg = `GRID STRATEGY: Starting on ${spec.label} (${spec.summary})!`;
      this.teammateRadioTimer = 3.5;
      return;
    }

    // 2.2s stationary pit crew service during active racing
    this.pitStopTimer = this.playerSpeedKmh < 5 ? 1.8 : 2.2;
    this.tireLife = 100;
    this.tireCorners = { fl: 100, fr: 100, rl: 100, rr: 100 };
    this.tireTempValue = 86;
    this.warnBlistering = false;
    this.pitStopsCount++;
    this.playerCar.setTireHealthVisuals(100, 86);
    const spec = TIRE_COMPOUND_SPECS[this.tireCompound];
    this.triggerEngineerRadio(
      `Box, box! Fresh ${spec.label} fitted—100% tire health, good to go when the jack drops!`,
      'tires',
      'normal',
      true
    );
  }

  /**
   * Issue in-race strategy orders to teammate:
   * "allow me to make stratagies and like for example my teammate is in a higher or lower position then me and i tell him to block for me like block other players for me and yield his position some drivers will listen some wont add like a listening rating or something"
   */
  public issueTeamOrder(order: 'block' | 'yield' | 'push' | 'neutral'): {
    success: boolean;
    message: string;
    speaker: string;
    status: 'accepted' | 'refused';
  } {
    const teammateCar = this.aiCars.find((c) => c.driver.id === this.teammateDriverId);
    const teammateDriver = teammateCar?.driver || DRIVERS.find((d) => d.id === this.teammateDriverId) || DRIVERS[1];
    const speaker = teammateDriver.shortName;

    // Boost obedience for independent champions so they listen reliably:
    // "also make it so like independent champions listen just a bit more because they never listen"
    let effectiveObedience = Math.max(72, teammateDriver.obedienceRating ?? 82);
    if (this.customTeamConfig && this.playerTeam?.id === this.customTeamConfig.id) {
      effectiveObedience = Math.min(98, effectiveObedience + 22); // High Team Owner respect & contractual obligation!
    }
    if (order === 'block') {
      effectiveObedience = Math.min(99, effectiveObedience + 15); // Willingness to defend team track position
    } else if (order === 'yield') {
      effectiveObedience = Math.min(96, effectiveObedience + 12); // Tactical team switch
    } else if (order === 'push') {
      effectiveObedience = Math.min(99, effectiveObedience + 18); // Attack mode
    }

    const obedience = Math.round(effectiveObedience);

    if (order === 'neutral') {
      this.teammateStrategy = 'neutral';
      this.teammateRadioMsg = 'Copy pit wall! Free racing for position!';
      this.teammateRadioSpeaker = speaker;
      this.teammateRadioStatus = 'accepted';
      this.teammateRadioTimer = 5.0;
      return { success: true, message: this.teammateRadioMsg, speaker, status: 'accepted' };
    }

    // Roll against driver obedience / listening rating
    const roll = Math.random() * 100;
    const willListen = roll <= effectiveObedience;

    if (willListen) {
      this.teammateStrategy = order;
      this.teammateRadioStatus = 'accepted';
      this.teammateRadioSpeaker = speaker;
      this.teammateRadioTimer = 5.0;

      if (order === 'yield') {
        const yieldMsgs = [
          `"Copy that! Lifting and letting you through on the straight. Go get them!"`,
          `"Understood, yielding line into Turn 1. Good luck!"`,
          `"Team order acknowledged. Moving wide, pass on the inside!"`,
        ];
        this.teammateRadioMsg = yieldMsgs[Math.floor(Math.random() * yieldMsgs.length)];
      } else if (order === 'block') {
        const blockMsgs = [
          `"Understood! Parking on the apex, nobody gets past me! Pull away!"`,
          `"Copy that! Widening my car to hold up the pack behind!"`,
          `"Defending line engaged. I've got your rear covered!"`,
        ];
        this.teammateRadioMsg = blockMsgs[Math.floor(Math.random() * blockMsgs.length)];
      } else {
        // push
        const pushMsgs = [
          `"Push mode active! Deploying full ERS battery, attacking now!"`,
          `"Turning up the power unit! Let's get both cars on the podium!"`,
        ];
        this.teammateRadioMsg = pushMsgs[Math.floor(Math.random() * pushMsgs.length)];
      }

      return { success: true, message: this.teammateRadioMsg, speaker, status: 'accepted' };
    } else {
      this.teammateRadioStatus = 'refused';
      this.teammateRadioSpeaker = speaker;
      this.teammateRadioTimer = 5.0;

      if (order === 'yield') {
        const refuseYieldMsgs = [
          `"Negative! I have the pace, I'm not giving up my podium! [REFUSED - ${obedience}% Obedience]"`,
          `"No chance mate! I'm fighting for my own championship! [REFUSED - ${obedience}% Obedience]"`,
          `"Tell the pit wall I'm racing! I'm faster! [REFUSED - ${obedience}% Obedience]"`,
        ];
        this.teammateRadioMsg = refuseYieldMsgs[Math.floor(Math.random() * refuseYieldMsgs.length)];
      } else if (order === 'block') {
        const refuseBlockMsgs = [
          `"Negative, I'm hunting down the cars ahead, not defending! [REFUSED - ${obedience}% Obedience]"`,
          `"No! If I defend, I ruin my own race. Racing normally! [REFUSED - ${obedience}% Obedience]"`,
        ];
        this.teammateRadioMsg = refuseBlockMsgs[Math.floor(Math.random() * refuseBlockMsgs.length)];
      } else {
        this.teammateRadioMsg = `"My tires won't take the abuse, managing pace! [REFUSED - ${obedience}% Obedience]"`;
      }

      return { success: false, message: this.teammateRadioMsg, speaker, status: 'refused' };
    }
  }

  public setManualGearMode(manual: boolean): boolean {
    this.manualGearMode = manual;
    this.manualGearHoldTimer = 0;
    this.lastAutoForceShiftDir = null;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('apex26_manual_gear_mode', String(this.manualGearMode));
      }
    } catch {
      // ignore storage errors
    }
    this.triggerEngineerRadio(
      this.manualGearMode
        ? 'Gearbox switched to MANUAL mode. Automatic shifting is disabled — use [F] to shift up and [V] to shift down.'
        : 'Gearbox set to AUTOMATIC mode. Car will shift automatically, and you can still force-shift anytime with [F] and [V].',
      'strategy',
      'normal',
      true
    );
    return this.manualGearMode;
  }

  public toggleManualGearMode(): boolean {
    return this.setManualGearMode(!this.manualGearMode);
  }

  public forceShiftUp() {
    if (this.raceState !== 'racing' && this.raceState !== 'countdown') return;
    if (this.playerGear === -1) {
      this.playerGear = 1;
      this.reverseHoldTimer = 0;
      this.lastAutoForceShiftDir = 'up';
      this.manualGearHoldTimer = this.manualGearMode ? 0 : 1.35;
      soundEngine.playGearShift(false);
      inputManager.rumble(0.25, 0.45, 60);
    } else if (this.playerGear < 8) {
      this.playerGear++;
      this.lastAutoForceShiftDir = 'up';
      this.manualGearHoldTimer = this.manualGearMode ? 0 : 1.35;
      soundEngine.playGearShift(false);
      inputManager.rumble(0.25, 0.45, 60);
    }
  }

  public forceShiftDown() {
    if (this.raceState !== 'racing' && this.raceState !== 'countdown') return;
    if (this.playerGear > 1) {
      this.playerGear--;
      this.lastAutoForceShiftDir = 'down';
      this.manualGearHoldTimer = this.manualGearMode ? 0 : 0.85;
      soundEngine.playGearShift(true);
      inputManager.rumble(0.3, 0.5, 80);
    } else if (this.playerGear === 1 && this.playerSpeedKmh <= 12) {
      this.playerGear = -1;
      this.playerSpeedKmh = Math.min(0, this.playerSpeedKmh);
      this.lastAutoForceShiftDir = 'down';
      this.manualGearHoldTimer = this.manualGearMode ? 0 : 0.85;
      soundEngine.playGearShift(true);
      inputManager.rumble(0.3, 0.5, 80);
    }
  }

  public triggerEngineerRadio(
    message: string,
    category: 'gap' | 'tires' | 'incident' | 'strategy' | 'start',
    priority: 'normal' | 'warning' | 'critical' = 'normal',
    forceImmediate: boolean = false
  ) {
    if (this.isCityMode) return;
    if (!forceImmediate && this.engineerRadioTimer > 1.2 && priority === 'normal') {
      return;
    }
    this.raceEngineerRadio = {
      message,
      category,
      priority,
      speaker: 'RACE ENGINEER · PIT WALL',
      timestamp: Date.now(),
    };
    this.engineerRadioTimer = priority === 'critical' ? 6.5 : 5.2;
    soundEngine.speakRaceEngineer(message, priority);
  }

  public requestEngineerReport(topic: 'gap' | 'tires' | 'incident') {
    if (this.isCityMode) return;
    if (topic === 'gap') {
      const pos = this.telemetry.position || 1;
      const aheadName = this.telemetry.carAheadShortName;
      const aheadGap = this.telemetry.carAheadGapSeconds;
      const behindName = this.telemetry.carBehindShortName;
      const behindGap = this.telemetry.carBehindGapSeconds;

      let msg = `P${pos} on track. `;
      if (pos === 1) {
        msg += `You are leading the Grand Prix by ${(this.currentP1LeadSeconds || 0).toFixed(2)} seconds. `;
      } else if (aheadName && aheadGap !== undefined) {
        msg += `Gap to ${aheadName} ahead is ${aheadGap.toFixed(2)} seconds${aheadGap < 1.0 ? ' — inside DRS range!' : '.'} `;
      }
      if (behindName && behindGap !== undefined) {
        msg += `${behindName} is ${behindGap.toFixed(2)} seconds behind you.`;
      }
      this.triggerEngineerRadio(msg.trim(), 'gap', 'normal', true);
    } else if (topic === 'tires') {
      const life = Math.round(this.tireLife);
      const temp = Math.round(this.tireTempValue);
      const status = this.telemetry.tireStatusLabel || 'OPTIMAL';
      let advice = 'Grip looks solid, keep hitting your marks.';
      if (life <= 22) {
        advice = 'Tires are critical! Box this lap for fresh rubber!';
      } else if (life < 45) {
        advice = 'Blistering is building up—open your pit window soon.';
      } else if (temp > 110) {
        advice = 'Carcass temps are running hot—ease off slightly in fast corners.';
      }
      this.triggerEngineerRadio(
        `${this.tireCompound} compound at ${life}% health (${status}), core temperature ${temp}°C. ${advice}`,
        'tires',
        life <= 22 ? 'critical' : life < 45 ? 'warning' : 'normal',
        true
      );
    } else if (topic === 'incident') {
      const crashedAi = this.aiCars.find((a) => !a.finished && (a.isCrashed || a.isSpinning || a.waitTimer > 0));
      if (this.yellowFlagActive || crashedAi) {
        const who = crashedAi ? `${crashedAi.driver.name} (${crashedAi.driver.shortName})` : 'a car';
        this.triggerEngineerRadio(
          `Yellow flag caution active! Incident involving ${who} on track—watch for stationary traffic and debris.`,
          'incident',
          'warning',
          true
        );
      } else {
        this.triggerEngineerRadio(
          `Green flag, track is clear across all sectors. ERS battery at ${Math.round(this.ersBattery)}%, Lap ${Math.min(this.totalLaps, this.playerLap)} of ${this.totalLaps}.`,
          'incident',
          'normal',
          true
        );
      }
    }
  }

  public update(delta: number, input: UnifiedInput) {
    if (this.isMinigamePaused) {
      soundEngine.updateEngine(0, 0, 0, false, 0, false);
      return;
    }
    const dt = Math.min(delta, 0.035);

    if (this.collisionTrauma > 0) {
      this.collisionTrauma = Math.max(0, this.collisionTrauma - dt * 3.0);
    }

    if (this.yellowFlagTimer > 0) {
      this.yellowFlagTimer -= dt;
      this.yellowFlagActive = this.yellowFlagTimer > 0;
    }

    if (this.teammateRadioTimer > 0) {
      this.teammateRadioTimer = Math.max(0, this.teammateRadioTimer - dt);
    }

    if (this.engineerRadioTimer > 0) {
      this.engineerRadioTimer = Math.max(0, this.engineerRadioTimer - dt);
    }

    if (this.manualGearHoldTimer > 0) {
      this.manualGearHoldTimer = Math.max(0, this.manualGearHoldTimer - dt);
    }

    // Interpolate & animate remote multiplayer peer cars
    for (const peer of this.peerCars.values()) {
      peer.pos.lerp(peer.targetPos, Math.min(1.0, dt * 14.0));
      peer.builtCar.root.position.copy(peer.pos);
      let diffHeading = peer.targetHeading - peer.heading;
      while (diffHeading > Math.PI) diffHeading -= Math.PI * 2;
      while (diffHeading < -Math.PI) diffHeading += Math.PI * 2;
      peer.heading += diffHeading * Math.min(1.0, dt * 12.0);
      peer.builtCar.root.rotation.y = peer.heading;
      peer.builtCar.setWheelSpin(peer.speedKmh, dt);
      peer.builtCar.updateSparks(peer.speedKmh, false, dt);
    }

    // 1. Race Countdown Sequence (Must wait for all 5 red lights to go out! Early throttle triggers False Start!)
    if (this.raceState === 'countdown') {
      this.countdownTimer += dt;
      const newLights = Math.min(5, Math.floor(this.countdownTimer / 0.48));
      if (newLights > this.lightsLit && newLights <= 5) {
        this.lightsLit = newLights;
        soundEngine.playStartLightBeep(false);
      }
      this.track.setStartLights(this.lightsLit, false);
      this.playerCar.setBraking(input.brake > 0.05);

      // Check for False Start (pressing throttle BEFORE all 5 red lights go out!)
      if (!this.isQualifyingMode && input.throttle > 0.05 && this.countdownTimer > 0.12 && this.countdownTimer < 2.85 && !this.falseStartTriggered) {
        this.falseStartTriggered = true;
        this.falseStartPenaltyTimer = 3.2; // 3.2s complete engine stall penalty!
        this.falseStartEarlyMs = Math.max(10, Math.round((2.85 - this.countdownTimer) * 1000));
        this.reactionTimeRecorded = true;
        this.launchBannerTimer = 6.5;
        this.playerSpeedKmh = 0;
        this.playerRpm = 0;
        soundEngine.playCrash(0.45);
        this.teammateRadioSpeaker = 'RACE CONTROL';
        this.teammateRadioStatus = 'refused';
        this.teammateRadioMsg = `⚠️ FALSE START! Throttle pressed ${(this.falseStartEarlyMs / 1000).toFixed(2)}s before lights out — ENGINE STALLED (3.2s Penalty)!`;
        this.teammateRadioTimer = 5.5;
      }

      // Lights go out only after all 5 red lights have illuminated and held (2.85s)
      if (this.countdownTimer >= 2.85) {
        this.lightsExtinguished = true;
        this.track.setStartLights(5, true);
        soundEngine.playStartLightBeep(true);
        this.raceState = 'racing';
        if (!this.isQualifyingMode && !this.falseStartTriggered && input.throttle > 0.05 && !this.reactionTimeRecorded) {
          this.startReactionTimeMs = Math.max(12, Math.round(dt * 1000));
          this.reactionTimeRecorded = true;
          this.launchBannerTimer = 6.5;
        }
      } else {
        if (this.falseStartTriggered) {
          this.playerRpm = 0;
          this.playerSpeedKmh = 0;
          soundEngine.updateEngine(0, 0, 0, false, 0, false);
        } else {
          const isStreet = this.isCityMode && this.cityPursuitStats.currentStreetCar;
          const idleBase = isStreet ? 800 : 4500;
          const revSpan = isStreet ? 5500 : 7500;
          const revRpm = idleBase + input.throttle * revSpan;
          soundEngine.updateEngine(revRpm, input.throttle, 0, false, 0, false);
        }
        return;
      }
    }

    if (this.raceState === 'racing') {
      this.raceTimer += dt;

      if (this.launchBannerTimer > 0) {
        this.launchBannerTimer = Math.max(0, this.launchBannerTimer - dt);
      }

      // Measure start reaction time from lights out until first throttle press
      if (!this.isQualifyingMode && !this.falseStartTriggered && !this.reactionTimeRecorded) {
        this.reactionTimer += dt;
        if (input.throttle > 0.05) {
          this.startReactionTimeMs = Math.max(12, Math.round(this.reactionTimer * 1000));
          this.reactionTimeRecorded = true;
          this.launchBannerTimer = 6.5;
        }
      }

      // False start penalty completely STALLS the car on the grid until the stall timer finishes
      if (this.falseStartPenaltyTimer > 0) {
        this.falseStartPenaltyTimer = Math.max(0, this.falseStartPenaltyTimer - dt);
        this.playerSpeedKmh = 0;
        this.playerRpm = 0;
        if (this.falseStartPenaltyTimer <= 0) {
          this.playerProtectionShieldTimer = 2.5;
          this.playerRpm = 4500;
        }
      }
    }

    // 2. Track Surface Query
    const surface: SurfaceInfo = this.track.checkSurfaceType(this.playerPos, this.playerProgress);
    this.playerProgress = surface.progress;

    // Firm ground contact
    this.playerPos.y = surface.trackPoint.y + 0.08;

    // Calculate Car Heading Vector & Alignment with Track Tangent
    const carFwdX = -Math.sin(this.playerHeading);
    const carFwdZ = -Math.cos(this.playerHeading);
    const carFwdVec = this._scratchCarFwd.set(carFwdX, 0, carFwdZ);
    const forwardAlignment = carFwdVec.dot(surface.tangent);

    // Track sector milestones to ensure honest forward lap progression
    if (this.playerProgress > 0.30 && this.playerProgress < 0.65) {
      this.hasReachedSector2 = true;
    }
    if (this.playerProgress >= 0.65 && this.playerProgress < 0.95) {
      this.hasReachedSector3 = true;
    }

    // Wrong Way Detection & 5-Second Warning / Auto-Respawn (Disabled in Open-Field & City Mode, and never triggered by backing up in Reverse!)
    const isGoingWrongWay =
      !this.isOpenFieldMode &&
      !this.isCityMode &&
      this.playerGear !== -1 &&
      this.playerSpeedKmh > 15 &&
      forwardAlignment < -0.25;

    if (isGoingWrongWay && this.raceState === 'racing') {
      this.wrongWayTimer += dt;
      this.wrongWayWarning = true;

      // After 5 seconds of driving the wrong way, auto-respawn facing forward safely in center of track!
      if (this.wrongWayTimer >= 5.0) {
        const safePt = this.track.getTrackPointAtProgress(this.playerProgress);
        this.playerPos.copy(safePt.position);
        this.playerPos.y = safePt.position.y + 0.08;
        this.playerHeading = Math.atan2(-safePt.tangent.x, -safePt.tangent.z);
        this.playerSpeedKmh = 40; // Gentle forward rolling speed
        this.playerProtectionShieldTimer = 3.0; // Protection shield on respawn
        this.wrongWayTimer = 0;
        this.wrongWayWarning = false;
        soundEngine.playCrash(0.2);
      }
    } else {
      this.wrongWayTimer = Math.max(0, this.wrongWayTimer - dt * 2.5);
      this.wrongWayWarning = false;
    }

    // Robust Lap completion detection for Player (Strict forward crossing & sector requirement; skipped in Open-Field Mode)
    if (!this.isOpenFieldMode && this.prevProgress > 0.85 && this.playerProgress < 0.15) {
      const isForwardCrossing = forwardAlignment > 0.30 && !isGoingWrongWay;
      if (isForwardCrossing) {
        if (!this.hasCrossedInitialStartLine) {
          this.hasCrossedInitialStartLine = true;
          this.lapTimeCurrent = 0;
          this.hasReachedSector2 = false;
          this.hasReachedSector3 = false;
        } else if (this.hasReachedSector2 && this.hasReachedSector3) {
          // Valid full lap!
          this.lastLapTime = this.lapTimeCurrent;
          if (!this.lapTimeBest || this.lapTimeCurrent < this.lapTimeBest) {
            this.lapTimeBest = this.lapTimeCurrent;
          }
          this.lapTimeCurrent = 0;
          this.playerLap++;
          this.hasReachedSector2 = false;
          this.hasReachedSector3 = false;

          // Official Race Completion Order check
          if (this.playerLap > this.totalLaps && !this.finishedDriversOrder.includes('player')) {
            this.finishedDriversOrder.push('player');
            this.raceFinished = true;
            this.raceState = 'finished';
          }
        }
      } else {
        // CROSSING FINISH LINE THE WRONG WAY:
        // Do NOT allow lap completion, do NOT allow winning!
        this.wrongWayWarning = true;
        this.wrongWayTimer = Math.max(this.wrongWayTimer, 2.5);
      }
    }

    // Backwards crossing from 0.05 to 0.95 (reverse crossing)
    if (!this.isOpenFieldMode && this.prevProgress < 0.15 && this.playerProgress > 0.85) {
      this.wrongWayWarning = true;
      this.wrongWayTimer = Math.max(this.wrongWayTimer, 2.5);
    }

    this.prevProgress = this.playerProgress;

    if (!this.raceFinished && (this.hasCrossedInitialStartLine || this.isOpenFieldMode)) {
      this.lapTimeCurrent += dt;
    }

    // 2B. Real-Time Physics-Driven Tire Life, Compound Grip & Thermal Degradation
    if (this.pitStopTimer > 0) {
      this.pitStopTimer = Math.max(0, this.pitStopTimer - dt);
      this.playerSpeedKmh = Math.max(0, this.playerSpeedKmh - 260 * dt * 3.6);
      if (this.pitStopTimer <= 0) {
        this.playerProtectionShieldTimer = 2.5;
        this.playerSpeedKmh = Math.max(this.playerSpeedKmh, 55);
      }
    }

    const compoundSpec = TIRE_COMPOUND_SPECS[this.tireCompound];
    const compoundWearRate = compoundSpec.wearRateMultiplier;
    const compoundBaseGrip = compoundSpec.baseGripMultiplier;

    if (this.raceState === 'racing' && !this.isQualifyingMode && Math.abs(this.playerSpeedKmh) > 8) {
      const absSpeedKmh = Math.abs(this.playerSpeedKmh);
      const speedNorm = Math.min(1.2, absSpeedKmh / 290);
      const steerAbs = Math.abs(input.steer);

      // Easing off the throttle and entering a turn without hitting throttle dramatically reduces cornering tire wear (0.25x vs 1.0x)
      const throttleInTurnFactor = input.throttle > 0.15 ? 0.25 + input.throttle * 0.75 : 0.25;

      // Sharp cornering load: gentle steering causes zero wear; sharp turns scale with throttle input so coasting through turns saves tires
      const sharpCornerFactor = steerAbs > 0.20 ? Math.pow((steerAbs - 0.20) / 0.80, 1.65) : 0;
      const steerLoad = sharpCornerFactor * (0.20 + speedNorm * 0.65) * throttleInTurnFactor;

      // Heavy braking load ONLY applies when going really fast (> 215 km/h) and braking hard (> 60%)
      const highSpeedBrakeFactor =
        absSpeedKmh > 215 && input.brake > 0.60
          ? Math.min(1.3, (absSpeedKmh - 215) / 130) * Math.pow((input.brake - 0.60) / 0.40, 1.4)
          : 0;
      const brakeLockupLoad =
        absSpeedKmh > 245 && input.brake > 0.85 ? (input.brake - 0.80) * 1.1 : 0;

      // Combined high-speed trail-braking scrub (only when going > 200 km/h while braking hard and turning sharply)
      const combinedCornerBrakeScrub =
        absSpeedKmh > 200 && steerAbs > 0.40 && input.brake > 0.55
          ? steerAbs * input.brake * 0.36
          : 0;

      const surfaceAbrasion = surface.offTrack ? 1.85 : surface.onCurb ? 1.18 : 1.0;

      // Target tire temperature rises with hard cornering & high-speed braking, and cools down when coasting or on straights
      const targetTemp =
        79 +
        speedNorm * 6 +
        steerLoad * 26 +
        (highSpeedBrakeFactor + brakeLockupLoad) * 20 +
        (this.tireTempValue > 100 ? 2 : 0) +
        (this.tireCompound === 'SOFT' ? 5 : this.tireCompound === 'HARD' ? -4 : 0);
      this.tireTempValue += (targetTemp - this.tireTempValue) * Math.min(1, dt * 1.8);

      const maxOptTemp = compoundSpec.optimalTempRange[1];
      const thermalOverheatMultiplier =
        this.tireTempValue > maxOptTemp ? 1.0 + (this.tireTempValue - maxOptTemp) * 0.032 : 1.0;

      // Balanced multi-lap wear: straight-line wear is very low (0.012 * speedNorm);
      // coasting into corners wears tires slowly, while hard high-speed braking & aggressive cornering wear tires slightly faster
      const lapScale = Math.max(0.50, Math.min(1.15, 5 / Math.max(3, this.totalLaps)));
      const straightLineWear = 0.012 * speedNorm;
      const corneringAndBrakingWear =
        steerLoad * 0.45 +
        highSpeedBrakeFactor * 0.39 +
        brakeLockupLoad * 0.28 +
        combinedCornerBrakeScrub;

      const wearPerSec =
        (straightLineWear + corneringAndBrakingWear) *
        compoundWearRate *
        surfaceAbrasion *
        thermalOverheatMultiplier *
        lapScale;

      this.tireLife = Math.max(0, this.tireLife - wearPerSec * dt);

      // Individual 4-corner wear based on left/right sharp turn loading & high-speed braking vs acceleration
      const leftTurnLoad = input.steer < -0.15 ? Math.pow(Math.abs(input.steer), 1.4) * 0.45 : 0;
      const rightTurnLoad = input.steer > 0.15 ? Math.pow(Math.abs(input.steer), 1.4) * 0.45 : 0;
      const frontBrakeLoad = absSpeedKmh > 215 && input.brake > 0.55 ? Math.pow(input.brake, 1.4) * 0.45 : 0;
      const rearTractionLoad = input.throttle > 0.5 && steerAbs > 0.25 ? input.throttle * steerAbs * 0.35 : 0.02;

      this.tireCorners.fl = Math.max(0, this.tireCorners.fl - wearPerSec * (0.75 + rightTurnLoad + frontBrakeLoad) * dt);
      this.tireCorners.fr = Math.max(0, this.tireCorners.fr - wearPerSec * (0.75 + leftTurnLoad + frontBrakeLoad) * dt);
      this.tireCorners.rl = Math.max(0, this.tireCorners.rl - wearPerSec * (0.75 + rightTurnLoad + rearTractionLoad) * dt);
      this.tireCorners.rr = Math.max(0, this.tireCorners.rr - wearPerSec * (0.75 + leftTurnLoad + rearTractionLoad) * dt);

      // Proactive Race Engineer tire health & thermal radio warnings
      if (!this.warnedGraining && this.tireLife < 58 && this.tireLife > 35) {
        this.warnedGraining = true;
        this.triggerEngineerRadio(
          `Tire health at ${Math.round(this.tireLife)}% on the ${this.tireCompound}s. Surface graining starting—ease off throttle on turn-in to save rubber.`,
          'tires',
          'normal'
        );
      } else if (!this.warnBlistering && this.tireLife <= 35 && this.tireLife > 22) {
        this.warnBlistering = true;
        this.triggerEngineerRadio(
          `Blistering detected on the ${this.tireCompound}s (${Math.round(this.tireLife)}% life). Grip is dropping—consider boxing soon.`,
          'tires',
          'warning'
        );
      } else if (!this.warnedCriticalTires && this.tireLife <= 20) {
        this.warnedCriticalTires = true;
        this.triggerEngineerRadio(
          `Box, box! Critical tire wear at ${Math.round(this.tireLife)}%—heavy blistering, pit this lap!`,
          'tires',
          'critical',
          true
        );
      } else if (
        this.tireTempValue > compoundSpec.optimalTempRange[1] + 6 &&
        this.raceTimer - (this.engineerCalloutCooldowns['overheat'] || -99) > 25
      ) {
        this.engineerCalloutCooldowns['overheat'] = this.raceTimer;
        this.triggerEngineerRadio(
          `Tire temps spiking at ${Math.round(this.tireTempValue)}°C! Lift and coast into heavy braking zones to cool the carcass.`,
          'tires',
          'warning'
        );
      }
      if (this.isOpenFieldMode && this.openFieldStats.infiniteGripAndBatteryLock) {
        this.tireLife = 100;
        this.tireCorners = { fl: 100, fr: 100, rl: 100, rr: 100 };
        this.tireTempValue = 90;
      }
    }

    // Update 3D tire tread wear gloss & thermal glow
    this.playerCar.setTireHealthVisuals(this.tireLife, this.tireTempValue);

    // Thermal window grip modifier (Cold < minTemp, Optimal Window, Overheating > maxTemp)
    const [minOptTemp, maxOptTemp] = compoundSpec.optimalTempRange;
    const tireThermalState: 'COLD' | 'OPTIMAL_WINDOW' | 'OVERHEATING' =
      this.tireTempValue < minOptTemp
        ? 'COLD'
        : this.tireTempValue > maxOptTemp
        ? 'OVERHEATING'
        : 'OPTIMAL_WINDOW';
    const thermalGripFactor =
      tireThermalState === 'COLD'
        ? Math.max(0.93, 1.0 - (minOptTemp - this.tireTempValue) * 0.005)
        : tireThermalState === 'OVERHEATING'
        ? Math.max(0.88, 1.0 - (this.tireTempValue - maxOptTemp) * 0.007)
        : 1.0;

    // Tire Health Grip Curve:
    // 70–100% Life: Optimal peak grip (1.00x of compound)
    // 40–69% Life: Graining phase (smooth drop to 0.86x)
    // 15–39% Life: Blistering / The Cliff (drops to 0.68x)
    // <15% Life: Critical / Punctured (0.48x grip + top speed drag + vibration)
    let tireLifeGripFactor = 1.0;
    if (this.tireLife >= 70) {
      tireLifeGripFactor = 1.0;
    } else if (this.tireLife >= 40) {
      tireLifeGripFactor = 0.86 + ((this.tireLife - 40) / 30) * 0.14;
    } else if (this.tireLife >= 15) {
      tireLifeGripFactor = 0.68 + ((this.tireLife - 15) / 25) * 0.18;
    } else {
      tireLifeGripFactor = 0.48 + (this.tireLife / 15) * 0.20;
    }

    const effectiveTireGrip = compoundBaseGrip * tireLifeGripFactor * thermalGripFactor;
    let surfaceGrip = surface.offTrack ? 0.45 : surface.onCurb ? 0.9 : 1.0;

    if (this.isCityMode) {
      const eff = this.cityPursuitStats.currentStreetCar;
      const drivetrain = eff.drivetrain || 'RWD';
      const clearance = eff.groundClearance || 'low';
      const traction = calculateDrivetrainTractionModifier(drivetrain, clearance, this.currentWeather);
      surfaceGrip *= traction.effectiveGrip;

      // Realistic fishtailing & oversteer on slippery snow/ice/rain under hard throttle (RWD struggles most):
      if (traction.fishtailFactor > 0.08 && input.throttle > 0.45 && this.playerSpeedKmh > 12 && this.playerSpeedKmh < 185) {
        const fishtailAmt = Math.sin(this.raceTimer * 5.8) * 0.015 * traction.fishtailFactor * input.throttle;
        this.playerHeading += fishtailAmt;
      }
    }

    const gripMultiplier = surfaceGrip * effectiveTireGrip;
    // NO 380 KM/H LIMITER: Top speed is realistically determined by engine power, gear ratio, and aerodynamic drag
    const maxSurfaceSpeed = surface.offTrack ? 135 : 440;

    // Ticking protection shield timer after crash recovery
    if (this.playerProtectionShieldTimer > 0) {
      this.playerProtectionShieldTimer = Math.max(0, this.playerProtectionShieldTimer - dt);
    }

    // ERS Boost & Active Aero DRS (In Open-Field Mode, ERS stays locked at 100% when infiniteGripAndBatteryLock is active or recharges rapidly!)
    const isBoosting = input.boost && this.ersBattery > 0 && this.playerSpeedKmh > 20;
    if (isBoosting) {
      if (this.isOpenFieldMode && this.openFieldStats.infiniteGripAndBatteryLock) {
        this.ersBattery = 100;
      } else {
        this.ersBattery = Math.max(0, this.ersBattery - dt * (this.isOpenFieldMode ? 8 : 16));
      }
      this.drsActive = true;
    } else {
      this.drsActive = false;
      if (this.isOpenFieldMode) {
        this.ersBattery = this.openFieldStats.infiniteGripAndBatteryLock
          ? 100
          : Math.min(100, this.ersBattery + dt * 32);
      } else if (input.brake > 0.2 && this.playerSpeedKmh > 40) {
        this.ersBattery = Math.min(100, this.ersBattery + dt * 20 * input.brake);
      }
    }
    this.playerCar.setDrsActive(this.drsActive);

    // Manual / Force Gear Shift Input Handling ([F] = Shift Up, [V] = Shift Down)
    if (input.shiftUp) {
      this.forceShiftUp();
    }
    if (input.shiftDown) {
      this.forceShiftDown();
    }

    // Always tick crash recovery & false-start timers regardless of whether in forward or reverse gear
    const isCrashingWait = this.playerCrashWaitTimer > 0;
    const isFalseStartStalled = this.falseStartPenaltyTimer > 0;
    if (isCrashingWait) {
      this.playerCrashWaitTimer = Math.max(0, this.playerCrashWaitTimer - dt);
      this.playerSpeedKmh = 0;
      this.playerCar.setBraking(input.brake > 0.05);
      this.playerCar.updateSparks(50, true, dt);

      if (this.playerCrashWaitTimer <= 0) {
        this.playerProtectionShieldTimer = 3.0;
        this.playerGear = 1;
        this.playerSpeedKmh = 40;
      }
    }
    if (isFalseStartStalled) {
      this.playerSpeedKmh = 0;
      this.playerRpm = 0;
    }

    // Smooth, Crash-Free Forward vs Reverse Gear Switching:
    // Pressing Throttle (W / Up) while in Reverse shifts cleanly back to 1st Gear
    if (input.throttle > 0.08 && this.playerGear === -1) {
      if (this.playerSpeedKmh < -8) {
        this.playerSpeedKmh = Math.min(0, this.playerSpeedKmh + 85 * dt * 3.6);
      } else {
        this.playerSpeedKmh = Math.max(0, this.playerSpeedKmh);
        this.playerGear = 1;
        this.reverseHoldTimer = 0;
        soundEngine.playGearShift(false);
      }
    }

    // Holding Brake/Reverse (S / Down) when stopped or nearly stopped shifts smoothly into Reverse (-1)
    const reverseEngageDelay = this.isCityMode || this.isOpenFieldMode ? 0.12 : 0.22;
    if (this.playerSpeedKmh <= 2.5 && input.brake > 0.35 && input.throttle < 0.05) {
      this.reverseHoldTimer += dt;
      if (this.reverseHoldTimer >= reverseEngageDelay && this.playerGear !== -1) {
        this.playerGear = -1;
        this.playerSpeedKmh = 0;
        soundEngine.playGearShift(true);
      }
    } else if (input.brake < 0.15) {
      this.reverseHoldTimer = 0;
    }

    if (this.playerGear !== -1) {
      // FORWARD GEARS (1 to 8)
      this.playerGear = Math.max(1, Math.min(8, this.playerGear));

      let curMax = this.gearMaxSpeeds[this.playerGear] || 400;
      let curMin = this.gearMaxSpeeds[this.playerGear - 1] || 0;
      const prevGearMin = this.gearMaxSpeeds[Math.max(0, this.playerGear - 2)] || 0;

      // In AUTOMATIC mode (!this.manualGearMode), the car ALWAYS keeps shifting automatically,
      // while also letting the player force-shift up ([F]) or down ([V]) at any time!
      if (!this.manualGearMode) {
        const holdUpUndo = this.manualGearHoldTimer > 0 && this.lastAutoForceShiftDir === 'down';
        const holdDownUndo = this.manualGearHoldTimer > 0 && this.lastAutoForceShiftDir === 'up';

        if (this.playerSpeedKmh > curMax - 8 && this.playerGear < 8) {
          if (!holdUpUndo || this.playerSpeedKmh > curMax + 16) {
            this.playerGear++;
            this.manualGearHoldTimer = 0;
            this.lastAutoForceShiftDir = null;
            soundEngine.playGearShift(false);
            inputManager.rumble(0.25, 0.45, 60);
          }
        } else if (this.playerSpeedKmh < curMin - 12 && this.playerGear > 1) {
          if (!holdDownUndo || input.brake > 0.2 || this.playerSpeedKmh < prevGearMin - 6 || this.playerSpeedKmh < 24) {
            this.playerGear--;
            this.manualGearHoldTimer = 0;
            this.lastAutoForceShiftDir = null;
            soundEngine.playGearShift(true);
            inputManager.rumble(0.3, 0.5, 80);
          }
        }
      }

      curMax = this.gearMaxSpeeds[this.playerGear] || 400;
      curMin = this.gearMaxSpeeds[this.playerGear - 1] || 0;

      const gearSpan = Math.max(1, curMax - curMin);
      const speedInGear = this.playerSpeedKmh - curMin;
      const rawRpmFrac = speedInGear / gearSpan;
      const rpmFrac = Math.max(-0.12, Math.min(1.06, rawRpmFrac));
      const limiterJitter = rawRpmFrac > 1.0 ? Math.sin(this.raceTimer * 95) * 280 : 0;

      if (this.isCityMode && this.cityPursuitStats.currentStreetCar) {
        const carId = this.cityPursuitStats.currentStreetCar.id;
        const streetIdle = 800;
        const streetRedline =
          carId === 'porsche_911'
            ? 9000
            : carId === 'lamborghini_huracan' || carId === 'koenigsegg_jesko'
            ? 8500
            : carId.includes('challenger') || carId.includes('charger') || carId.includes('camaro') || carId.includes('escalade')
            ? 6500
            : carId === 'nissan_gtr_r34' || carId === 'nissan_gtr_r34_ztune'
            ? 8200
            : 7000;
        const safeRpmFrac = Math.max(0, rpmFrac);
        this.playerRpm = Math.max(
          streetIdle * 0.9,
          Math.min(streetRedline * 1.06, streetIdle + safeRpmFrac * (streetRedline - streetIdle) + limiterJitter)
        );
      } else {
        this.playerRpm = Math.max(3600, Math.min(15000, 4500 + rpmFrac * 10500 + limiterJitter));
      }

      let gearTorqueMultiplier = 1.0;
      let engineBrakingDrag = 0;
      if (this.manualGearMode || this.manualGearHoldTimer > 0) {
        if (rawRpmFrac < -0.15) {
          gearTorqueMultiplier = Math.max(0.68, 1.0 + (rawRpmFrac + 0.15) * 0.65);
        } else if (rawRpmFrac >= 0.55 && rawRpmFrac <= 0.98) {
          gearTorqueMultiplier = 1.04;
        }
        if (rawRpmFrac > 1.02 && this.playerGear < 8) {
          gearTorqueMultiplier = this.manualGearMode ? 0.15 : 0.65;
          engineBrakingDrag = (this.playerSpeedKmh - curMax) * 0.85;
        }
      }

      const effectiveThrottle = isCrashingWait || isFalseStartStalled ? 0 : input.throttle;
      const effectiveBrake = isCrashingWait || isFalseStartStalled ? 1.0 : input.brake;

      // Dynamic Slipstream / Tow Pocket Detection behind lead cars
      this.slipstreamActive = false;
      this.slipstreamFactor = 0;
      if (this.playerSpeedKmh > 110 && this.raceState === 'racing') {
        for (const ai of this.aiCars) {
          if (ai.finished || ai.isCrashed || ai.isHiddenByPracticeFilter) continue;
          let deltaProgress = ai.progress - this.playerProgress;
          if (deltaProgress < -0.5) deltaProgress += 1.0;
          if (deltaProgress > 0.5) deltaProgress -= 1.0;
          const distMeters = deltaProgress * this.track.trackLength;
          if (distMeters > 3.5 && distMeters < 42.0) {
            const latDelta = Math.abs(ai.lateralOffset - surface.lateralOffset);
            if (latDelta < 2.6) {
              const prox = 1.0 - (distMeters - 3.5) / 38.5;
              const align = 1.0 - (latDelta / 2.6);
              const factor = Math.max(0, prox * align);
              if (factor > this.slipstreamFactor) {
                this.slipstreamFactor = factor;
                this.slipstreamActive = true;
              }
            }
          }
        }
      }

      // Aerodynamics & Power Balancing (Realistic F1 Top Speed or Active Street Car Top Speed in Metro City):
      const baseTerminalKmh =
        this.isCityMode && this.cityStreetCarTopSpeedKmh
          ? this.cityStreetCarTopSpeedKmh
          : 318 + Math.max(0, this.enginePowerRating - 70) * 0.85;
      const drsBonus = this.drsActive ? 14 : 0;
      const boostBonus = (isBoosting ? 16 : 0) + (this.slipstreamActive ? 12 * this.slipstreamFactor : 0);
      const compoundSpeedDelta = this.isCityMode ? 0 : compoundSpec.topSpeedDeltaKmh;
      const tireWearSpeedPenalty =
        this.tireLife < 15
          ? 38 * (1 - this.tireLife / 15) + 14
          : this.tireLife < 40
          ? 14 * (1 - (this.tireLife - 15) / 25)
          : 0;
      const gearSpeedCap = this.manualGearMode && this.playerGear < 8 ? curMax + 6 : 550;
      const minTerminalFloor = this.isCityMode ? 145 : 190;
      const targetTerminalKmh = surface.offTrack
        ? 140
        : Math.min(
            gearSpeedCap,
            Math.max(minTerminalFloor, baseTerminalKmh + compoundSpeedDelta + drsBonus + boostBonus - tireWearSpeedPenalty)
          );

      const accelNorm = Math.max(0.2, (this.accelerationScore - 70) / 30);
      const powerScaling = 1.0 + Math.max(0, this.enginePowerRating - 75) * 0.007;
      let baseAccel = (15.5 + accelNorm * 10.0) * powerScaling;
      if (this.isCityMode && this.cityPursuitStats.currentStreetCar) {
        const zeroToSixty = Math.max(1.30, this.cityPursuitStats.currentStreetCar.zeroToSixtySec || 4.5);
        // Average acceleration to 60 mph (26.8224 m/s) in zeroToSixty seconds:
        const targetAvgAccel = 26.8224 / zeroToSixty;
        // Gear torque mechanical advantage curve (1st gear produces greatest mechanical torque multiplier, tapering across higher gears)
        const streetGearTorque = [1.0, 1.34, 1.15, 0.96, 0.82, 0.70, 0.58, 0.48, 0.40][Math.max(1, Math.min(8, this.playerGear))];
        baseAccel = targetAvgAccel * streetGearTorque;
      }

      const speedRatio = Math.min(1.05, this.playerSpeedKmh / Math.max(80, targetTerminalKmh));
      const availableThrust = Math.max(0, 1.0 - Math.pow(speedRatio, 2.2));
      const boostBonusRate = isBoosting ? 1.35 : 1.0;
      const slipstreamThrustBonus = this.slipstreamActive ? 2.5 * this.slipstreamFactor : 0;
      const forwardAccel =
        baseAccel * availableThrust * boostBonusRate * gripMultiplier * gearTorqueMultiplier + slipstreamThrustBonus;

      const overspeedDrag = this.playerSpeedKmh > targetTerminalKmh
        ? Math.min(18.0, Math.pow((this.playerSpeedKmh - targetTerminalKmh) / 8, 1.8) * 1.6) + engineBrakingDrag
        : engineBrakingDrag;

      if (effectiveThrottle > 0) {
        if (this.playerSpeedKmh < targetTerminalKmh) {
          this.playerSpeedKmh += forwardAccel * effectiveThrottle * dt * 3.6;
        } else {
          this.playerSpeedKmh = Math.max(targetTerminalKmh, this.playerSpeedKmh - overspeedDrag * dt * 3.6);
        }
      } else {
        const manualEngineBrake = (this.manualGearMode || this.manualGearHoldTimer > 0) && rawRpmFrac > 0.7 ? 2.2 : 0;
        const coastDrag = (1.8 + (this.playerSpeedKmh / 350) * 4.5 + manualEngineBrake) * (surface.offTrack ? 3.0 : 1.0);
        this.playerSpeedKmh = Math.max(0, this.playerSpeedKmh - (coastDrag + overspeedDrag) * dt * 3.6);
      }

      if (effectiveBrake > 0) {
        // Calibrated realistic progressive braking deceleration:
        // Baseline street cars (brakes 70): ~9.5 m/s² (~1.0G, 60-0 mph in ~130 ft)
        // Sports/Muscle (brakes 80-88): ~11.5 - 13.0 m/s² (~1.2G - 1.3G, 60-0 mph in ~105-115 ft)
        // Supercars/Hypercars with carbon-ceramics (brakes 95-100): ~14.0 - 16.5 m/s² (~1.5G - 1.7G, 60-0 mph in ~85-95 ft)
        const brakesScoreClamped = Math.max(60, Math.min(105, this.brakesScore));
        const brakePower = (7.5 + ((brakesScoreClamped - 60) / 45) * 8.5) * gripMultiplier;
        this.playerSpeedKmh = Math.max(0, this.playerSpeedKmh - brakePower * effectiveBrake * dt * 3.6);
        // Realistic suspension pitch nose-dive proportional to deceleration
        this.playerCar.root.rotation.x = -Math.min(0.045, (brakePower * effectiveBrake) * 0.0025);
      } else {
        this.playerCar.root.rotation.x = 0;
      }
      this.playerCar.setBraking(input.brake > 0.05);

      this.playerSpeedKmh = Math.max(0, this.playerSpeedKmh);
    } else {
      // REVERSE GEAR (-1): Smooth, responsive backing up with zero lockups
      this.playerRpm = 4600 + Math.min(5000, Math.abs(this.playerSpeedKmh) * 90);
      if (!isCrashingWait && !isFalseStartStalled && input.brake > 0.05 && input.throttle < 0.1) {
        const maxReverseKmh = this.isCityMode ? -48 : -55;
        if (this.playerSpeedKmh > maxReverseKmh) {
          this.playerSpeedKmh = Math.max(maxReverseKmh, this.playerSpeedKmh - 22 * input.brake * dt * 3.6);
        }
      } else {
        // Natural rolling stop when releasing reverse pedal
        this.playerSpeedKmh = Math.min(0, this.playerSpeedKmh + 26 * dt * 3.6);
        if (Math.abs(this.playerSpeedKmh) < 0.4 && input.brake < 0.05) {
          this.playerSpeedKmh = 0;
        }
      }
      this.playerCar.setBraking(input.brake > 0.05);
    }

    // DISTINCT HANDLING & CORNERING / WEAVING DYNAMICS (Uncapped ratings):
    // "ok now fix the handling because just cuz the handling is better doesnt make it so sensitive or so stiff it makes it easier to corner and weave and turn"
    // Better handling does NOT make the car stiff, wooden, or twitchy.
    // Instead, it gives the car agile, fluid chassis response, effortless cornering bite, smooth rapid weaving between traffic,
    // and eliminates heavy understeer pushing wide when carving through turns!
    const handlingScoreClamped = Math.max(70, this.handlingScore);
    const handlingNorm = (handlingScoreClamped - 70) / 30; // 0 at baseline 70, 1.0 at 100, >1.0 for hyper
    const downforceNorm = Math.max(0.1, (this.downforceScore - 70) / 30);

    const speed = Math.abs(this.playerSpeedKmh);

    // Natural, fluid speed-scaled steering authority:
    // Slower speeds (0-140 km/h) allow wide turning lock for tight corners, hairpins and chicane flicks.
    // High speeds down straights (140-360 km/h) transition gently so the car is completely comfortable to weave without snapping or being rigid.
    // Formula 1 steering rack scaling:
    const speedRatio = Math.min(360, speed) / 220;
    const speedDamping = 1.0 / (1.0 + Math.pow(speed / 210, 1.15) * 0.72);
    // Smooth natural turn authority (1.75):
    const naturalSensitivity = 1.75 * speedDamping;

    // Cornering bite & understeer elimination from handling:
    // Baseline cars push heavily when throttle is pinned. Upgraded handling cars carve cleanly without understeer fighting:
    const effectiveThrottleVal = this.playerCrashWaitTimer > 0 ? 0 : input.throttle;
    const understeerMitigation = Math.min(0.44, handlingNorm * 0.32);
    const throttleUndersteer = effectiveThrottleVal > 0.05
      ? Math.max(0.68, 1.0 - (speedRatio * effectiveThrottleVal * Math.max(0.03, 0.40 - understeerMitigation)))
      : 1.0;

    // Fluid weaving agility bonus:
    // Good handling allows crisp, smooth turn-in and effortless direction changes without making straight-line micro-inputs twitchy:
    const corneringAgility = 1.0 + Math.min(0.35, handlingNorm * 0.20);
    const gripHold = Math.min(1.22, 0.95 + Math.min(0.25, downforceNorm * 0.16));

    // Dynamic progressive steering curve:
    // Linear center zone (82%) provides immediate, direct response for smooth weaving between rival cars,
    // with progressive exponent (1.25) so full wheel lock never feels dead or stiff:
    const steerInput = this.playerCrashWaitTimer > 0 ? input.steer * 0.2 : input.steer;
    const steerAbs = Math.abs(steerInput);
    const fluidSteer = Math.sign(steerInput) * (steerAbs * 0.82 + Math.pow(steerAbs, 1.25) * 0.18);

    const turnRate = fluidSteer * naturalSensitivity * throttleUndersteer * corneringAgility * gripHold * gripMultiplier * dt;

    // Asymmetric tire wear pull when tires are critically worn (< 18% health)
    const asymmetricTirePull =
      this.tireLife < 18 && Math.abs(this.playerSpeedKmh) > 60
        ? ((this.tireCorners.fl - this.tireCorners.fr) * 0.0035 + Math.sin(this.raceTimer * 18) * 0.018) * dt
        : 0;

    if (Math.abs(this.playerSpeedKmh) > 1.0) {
      const dirSign = this.playerSpeedKmh >= 0 ? 1 : -1;
      this.playerHeading -= (turnRate + asymmetricTirePull) * dirSign;
    }

    if (this.tireLife <= 8 && Math.abs(this.playerSpeedKmh) > 85) {
      this.playerCar.updateSparks(this.playerSpeedKmh, true, dt);
    }

    this.playerCar.setSteerAngle(-steerInput * 0.38);
    this.playerCar.setWheelSpin(this.playerSpeedKmh, dt);

    // Compute Forward Vector from car heading (zero allocation)
    const forwardX = -Math.sin(this.playerHeading);
    const forwardZ = -Math.cos(this.playerHeading);
    const forwardVec = this._scratchForwardVec.set(forwardX, 0, forwardZ);

    // Continuous Sub-Stepping Movement & Solid Barrier Check (Guaranteed 100% Noclip Prevention):
    const numSubSteps = Math.abs(this.playerSpeedKmh) > 180 ? 5 : Math.abs(this.playerSpeedKmh) > 70 ? 3 : 1;
    const subDt = dt / numSubSteps;

    if (this.isOpenFieldMode) {
      // Truly INFINITE 360° Full-Road Movement (Zero outer walls, zero radius clamps—drive forever in any direction!)
      const speedMs = this.playerSpeedKmh / 3.6;
      this.playerPos.x += forwardVec.x * speedMs * dt;
      this.playerPos.z += forwardVec.z * speedMs * dt;
      this.playerPos.y = 0.33;

      // Seamlessly snap the 8,000m × 8,000m tiled road tarmac & endless highway around the car's coordinates
      this.track.updateInfiniteRoadOrigin?.(this.playerPos.x, this.playerPos.z);

      // Update Live Open-Field Performance Dyno, Odometer, Coordinates & Speed-Trap Timers
      const absSpd = Math.abs(this.playerSpeedKmh);
      this.openFieldStats.totalDistanceKm = Number(
        (this.openFieldStats.totalDistanceKm + (absSpd / 3.6) * dt * 0.001).toFixed(3)
      );
      this.openFieldStats.coordX = Math.round(this.playerPos.x);
      this.openFieldStats.coordZ = Math.round(this.playerPos.z);

      // Compute 8-way compass heading from playerHeading
      const normAngle = (((this.playerHeading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
      const compassDirs = ['N', 'NW', 'W', 'SW', 'S', 'SE', 'E', 'NE'];
      const compassIdx = Math.round((normAngle / (Math.PI * 2)) * 8) % 8;
      this.openFieldStats.headingCompass = compassDirs[compassIdx];

      if (absSpd > this.openFieldStats.peakSpeedKmh) {
        this.openFieldStats.peakSpeedKmh = Math.round(absSpd * 10) / 10;
      }
      const instLatG = Math.round(Math.abs(input.steer) * (absSpd / 52) * 100) / 100;
      if (instLatG > this.openFieldStats.peakLateralG) {
        this.openFieldStats.peakLateralG = instLatG;
      }

      // Detect current Infinite Road Zone
      const onInfiniteHighway = Math.abs(this.playerPos.x - -230) <= 25;
      const onBrakeStrip = Math.abs(this.playerPos.x - 340) <= 20 && Math.abs(this.playerPos.z) <= 360;
      const onCentralPad = Math.abs(this.playerPos.x) <= 280 && Math.abs(this.playerPos.z) <= 280;
      const onSlalomLane = Math.abs(this.playerPos.x - 195) <= 28 && Math.abs(this.playerPos.z) <= 260;
      if (onInfiniteHighway) {
        this.openFieldStats.currentZone = 'INFINITE TOP-SPEED HIGHWAY';
        this.openFieldStats.surfaceLabel = 'HIGH-GRIP HIGHWAY ASPHALT';
      } else if (onBrakeStrip) {
        this.openFieldStats.currentZone = '300–0 KM/H BRAKING STRIP';
        this.openFieldStats.surfaceLabel = 'CALIBRATED BRAKE TARMAC';
      } else if (onSlalomLane) {
        this.openFieldStats.currentZone = 'SLALOM WEAVING CONE COURSE';
        this.openFieldStats.surfaceLabel = 'HIGH-GRIP PROVING TARMAC';
      } else if (onCentralPad) {
        this.openFieldStats.currentZone = 'CONCENTRIC G-FORCE SKIDPAD';
        this.openFieldStats.surfaceLabel = 'HIGH-GRIP SKIDPAD TARMAC';
      } else {
        this.openFieldStats.currentZone = 'INFINITE OPEN ROAD EXPANSE';
        this.openFieldStats.surfaceLabel = 'HIGH-GRIP RACING ROAD TARMAC';
      }

      // Automatic 0-100, 0-200, 0-300 km/h & 400m/1000m Drag Timer from standstill
      if (absSpd < 2.5 && input.throttle < 0.1) {
        this.dragRunActive = false;
        this.dragRunElapsedSec = 0;
        this.dragRunOrigin.copy(this.playerPos);
      } else if (!this.dragRunActive && absSpd < 12 && input.throttle > 0.15) {
        this.dragRunActive = true;
        this.dragRunElapsedSec = 0;
        this.dragRunOrigin.copy(this.playerPos);
        this.openFieldStats.zeroTo100Sec = null;
        this.openFieldStats.zeroTo200Sec = null;
        this.openFieldStats.zeroTo300Sec = null;
        this.openFieldStats.quarterMileSec = null;
        this.openFieldStats.oneKmSec = null;
      }

      if (this.dragRunActive) {
        this.dragRunElapsedSec += dt;
        const distFromLaunch = this.playerPos.distanceTo(this.dragRunOrigin);

        if (this.openFieldStats.zeroTo100Sec === null && absSpd >= 100) {
          const t100 = Number(this.dragRunElapsedSec.toFixed(2));
          this.openFieldStats.zeroTo100Sec = t100;
          if (this.openFieldStats.bestZeroTo100Sec === null || t100 < this.openFieldStats.bestZeroTo100Sec) {
            this.openFieldStats.bestZeroTo100Sec = t100;
          }
        }
        if (this.openFieldStats.zeroTo200Sec === null && absSpd >= 200) {
          const t200 = Number(this.dragRunElapsedSec.toFixed(2));
          this.openFieldStats.zeroTo200Sec = t200;
          if (this.openFieldStats.bestZeroTo200Sec === null || t200 < this.openFieldStats.bestZeroTo200Sec) {
            this.openFieldStats.bestZeroTo200Sec = t200;
          }
        }
        if (this.openFieldStats.zeroTo300Sec === null && absSpd >= 300) {
          const t300 = Number(this.dragRunElapsedSec.toFixed(2));
          this.openFieldStats.zeroTo300Sec = t300;
          if (this.openFieldStats.bestZeroTo300Sec === null || t300 < this.openFieldStats.bestZeroTo300Sec) {
            this.openFieldStats.bestZeroTo300Sec = t300;
          }
        }
        if (this.openFieldStats.quarterMileSec === null && distFromLaunch >= 402.3) {
          const t400 = Number(this.dragRunElapsedSec.toFixed(2));
          this.openFieldStats.quarterMileSec = t400;
          if (this.openFieldStats.bestQuarterMileSec === null || t400 < this.openFieldStats.bestQuarterMileSec) {
            this.openFieldStats.bestQuarterMileSec = t400;
          }
        }
        if (this.openFieldStats.oneKmSec === null && distFromLaunch >= 1000.0) {
          const t1000 = Number(this.dragRunElapsedSec.toFixed(2));
          this.openFieldStats.oneKmSec = t1000;
          if (this.openFieldStats.bestOneKmSec === null || t1000 < this.openFieldStats.bestOneKmSec) {
            this.openFieldStats.bestOneKmSec = t1000;
          }
        }
      }

      // 2. Automatic 100–200 km/h Roll-On Acceleration Timer
      if (absSpd < 98) {
        this.roll100To200Active = false;
        this.roll100To200ElapsedSec = 0;
      } else if (!this.roll100To200Active && absSpd >= 100 && absSpd < 112 && input.throttle > 0.5) {
        this.roll100To200Active = true;
        this.roll100To200ElapsedSec = 0;
      } else if (this.roll100To200Active) {
        if (input.throttle < 0.2) {
          this.roll100To200Active = false;
        } else {
          this.roll100To200ElapsedSec += dt;
          if (absSpd >= 200) {
            const tRoll = Number(this.roll100To200ElapsedSec.toFixed(2));
            this.openFieldStats.oneHundredTo200Sec = tRoll;
            if (
              this.openFieldStats.bestOneHundredTo200Sec === null ||
              tRoll < this.openFieldStats.bestOneHundredTo200Sec
            ) {
              this.openFieldStats.bestOneHundredTo200Sec = tRoll;
            }
            this.roll100To200Active = false;
          }
        }
      }

      // 3. Automatic 100–0 km/h Braking Distance Telemetry (in meters)
      if (!this.brakeTestActive && absSpd >= 100 && absSpd <= 115 && input.brake > 0.65 && input.throttle < 0.05) {
        this.brakeTestActive = true;
        this.brakeTestOrigin.copy(this.playerPos);
      } else if (this.brakeTestActive) {
        if (input.throttle > 0.2 || input.brake < 0.2) {
          this.brakeTestActive = false;
        } else if (absSpd <= 1.5) {
          const stopMeters = Number(this.playerPos.distanceTo(this.brakeTestOrigin).toFixed(1));
          if (stopMeters > 5 && stopMeters < 220) {
            this.openFieldStats.brake100To0Meters = stopMeters;
            if (
              this.openFieldStats.bestBrake100To0Meters === null ||
              stopMeters < this.openFieldStats.bestBrake100To0Meters
            ) {
              this.openFieldStats.bestBrake100To0Meters = stopMeters;
            }
          }
          this.brakeTestActive = false;
        }
      }

      // 4. Metro City Driving Traffic Signals, Civilian Traffic & Police Pursuit Simulation
      if (this.isCityMode) {
        this.updateCityModeSimulation(dt, forwardVec, input);
      }
    } else {
      for (let step = 0; step < numSubSteps; step++) {
        const subSpeedMs = this.playerSpeedKmh / 3.6;
        this.playerPos.x += forwardVec.x * subSpeedMs * subDt;
        this.playerPos.z += forwardVec.z * subSpeedMs * subDt;

        const subSurface = this.track.checkSurfaceType(this.playerPos, this.playerProgress);
        this.playerProgress = subSurface.progress;
        const barrierLimit = subSurface.barrierLimit || 18.4;
        const absLateralDist = Math.abs(subSurface.lateralOffset);

        if ((subSurface.isCollidingWall || absLateralDist >= barrierLimit - 0.2) && (this.raceState === 'racing' || this.countdownTimer > 0.4)) {
          // Absolute clamp inside the barrier (100% NOCLIP PREVENTION)
          const maxAllowedOffset = (barrierLimit - 0.45) * Math.sign(subSurface.lateralOffset || 1);
          this.playerPos.copy(subSurface.trackPoint).addScaledVector(subSurface.normal, maxAllowedOffset);
          this.playerPos.y = subSurface.trackPoint.y + 0.08;

          const currentVel = this._scratchCurrentVel.copy(forwardVec).multiplyScalar(subSpeedMs);
          const normalVel = currentVel.dot(subSurface.wallNormal);

          // Impact speed into wall (direct normal impact or vehicle forward speed)
          const normalImpactSpeed = Math.abs(normalVel) * 3.6;
          const totalImpactSpeed = Math.abs(this.playerSpeedKmh);

          // Reliability impact resilience scaling:
          const relFactor = Math.max(0, Math.min(1.0, ((this.engineReliability || 80) - 75) / 25));
          const wallSpeedStallThreshold = 14 + relFactor * 22;
          const wallNormalStallThreshold = 3.5 + relFactor * 6.5;
          const penetrationStallThreshold = 0.04 + relFactor * 0.04;

          const isWallCrash =
            this.playerGear !== -1 &&
            this.playerSpeedKmh > 0 &&
            (totalImpactSpeed >= wallSpeedStallThreshold ||
              normalImpactSpeed >= wallNormalStallThreshold ||
              subSurface.penetration > penetrationStallThreshold ||
              absLateralDist >= barrierLimit - 0.08);

          if (isWallCrash && this.playerCrashWaitTimer <= 0 && this.playerProtectionShieldTimer <= 0) {
            const waitDuration = this.getCrashWaitDuration();
            this.playerCrashWaitTimer = waitDuration;
            this.playerCrashWaitMax = waitDuration;
            this.playerSpeedKmh = 0;
            this.playerCar.setBraking(input.brake > 0.05);
            soundEngine.playCrash(1.0);
            inputManager.rumble(1.0, 1.0, 400);
            this.collisionTrauma = 1.0;
            this.triggerYellowFlag(waitDuration + 2.0);
            this.triggerEngineerRadio(
              `Heavy barrier impact! Anti-stall engaged—recovering engine in ${waitDuration.toFixed(1)}s. Check front wing once rolling.`,
              'incident',
              'critical',
              true
            );
          } else if (this.playerCrashWaitTimer <= 0) {
            // Very low speed bump or reverse bump
            if (this.playerGear === -1 || this.playerSpeedKmh < 0) {
              this.playerSpeedKmh = 0;
            } else if (normalVel < 0) {
              const restitution = 0.20;
              currentVel.addScaledVector(subSurface.wallNormal, -(1 + restitution) * normalVel);
              const newSpeedMs = currentVel.length();
              this.playerSpeedKmh = Math.max(5, newSpeedMs * 3.6 * 0.50);
            } else {
              this.playerSpeedKmh = Math.max(0, this.playerSpeedKmh * 0.65);
            }
            soundEngine.playCrash(0.4);
            inputManager.rumble(0.5, 0.7, 100);
            this.collisionTrauma = Math.min(1.0, this.collisionTrauma + 0.35);
          }

          if (this.playerGear !== -1) {
            this.playerHeading = Math.atan2(-subSurface.tangent.x, -subSurface.tangent.z);
          }
          break;
        }
      }

      // Failsafe boundary check so car never steps outside track barriers under any frame rate
      const finalSurface = this.track.checkSurfaceType(this.playerPos, this.playerProgress);
      const finalBarrier = finalSurface.barrierLimit || 18.4;
      if (Math.abs(finalSurface.lateralOffset) >= finalBarrier - 0.4) {
        const clampOffset = (finalBarrier - 0.45) * Math.sign(finalSurface.lateralOffset || 1);
        this.playerPos.copy(finalSurface.trackPoint).addScaledVector(finalSurface.normal, clampOffset);
        this.playerPos.y = finalSurface.trackPoint.y + 0.08;
      }

      // 4. Update AI Cars with Smooth Curvature Lines, Proactive Player Weaving & Crash Avoidance
      this.updateAICars(dt);

      // 5. Car-to-Car Collisions (Disabled in Qualifying Mode so player can drive right through all ghost cars)
      if (this.raceState === 'racing' && !this.isQualifyingMode) {
        this.handleCarCollisions(forwardVec, dt);
      }
    }

    // Sync 3D Mesh
    this.playerCar.root.position.copy(this.playerPos);
    this.playerCar.root.rotation.y = this.playerHeading;

    const slope = surface.tangent.y;
    this.playerCar.root.rotation.x = -Math.asin(Math.max(-0.4, Math.min(0.4, slope)));
    this.playerCar.root.rotation.z = -input.steer * Math.min(0.08, (Math.abs(this.playerSpeedKmh) / 300) * 0.08);

    // Titanium Sparks (always pass non-negative speed)
    this.playerCar.updateSparks(Math.abs(this.playerSpeedKmh), surface.onCurb, dt);

    if (surface.onCurb && Math.abs(this.playerSpeedKmh) > 35) {
      inputManager.rumble(0.4, 0.7, 50);
    }

    // Audio
    const lateralG = Math.abs(input.steer) * (Math.abs(this.playerSpeedKmh) / 140);
    const tireSlip = Math.min(1, lateralG * 0.5 + (surface.onCurb ? 0.3 : 0));
    const isStalledNow = this.falseStartPenaltyTimer > 0;
    const safeRpm = isStalledNow ? 0 : Number.isFinite(this.playerRpm) ? this.playerRpm : 5000;
    const safeSpeed = isStalledNow ? 0 : Number.isFinite(this.playerSpeedKmh) ? Math.abs(this.playerSpeedKmh) : 0;

    soundEngine.updateEngine(
      safeRpm,
      isStalledNow ? 0 : input.throttle,
      safeSpeed,
      isStalledNow ? false : isBoosting,
      isStalledNow ? 0 : tireSlip,
      surface.onCurb
    );

    // 6. Compute Real-time Leaderboard
    this.calculateLeaderboard();

    // 7. MiniMap Cars Radar Point Array
    const radar: CarRadarPoint[] = [];
    const playerLeadP2 = this.telemetry.position === 1 ? this.currentP1LeadSeconds : undefined;
    radar.push({
      progress: this.playerProgress,
      lateralOffset: surface.lateralOffset,
      color: '#fbbf24',
      isPlayer: true,
      shortName: 'YOU',
      position: this.telemetry.position,
      gapToLeaderSeconds: this.currentGapsToLeaderMap.get('player') || 0,
      gapToAheadSeconds: this.currentIntervalsMap.get('player') || 0,
      gapToPlayerSeconds: 0,
      leadOverP2Seconds: playerLeadP2,
      tireCompound: this.tireCompound,
      tireLife: Math.round(this.tireLife),
      pitStopsCount: this.pitStopsCount,
    });

    for (const ai of this.aiCars) {
      if (ai.isHiddenByPracticeFilter) continue;
      const isTeammate = Boolean(this.teammateDriverId && ai.driver.id === this.teammateDriverId);
      const aiPos = this.currentPositionsMap.get(ai.driver.id) || 20;
      radar.push({
        progress: ai.progress,
        lateralOffset: ai.lateralOffset,
        color: ai.isCrashed || ai.isSpinning ? '#ef4444' : isTeammate ? '#10b981' : (ai.team.primaryColor || '#00e5ff'),
        isPlayer: false,
        isTeammate,
        shortName: ai.driver.shortName,
        position: aiPos,
        driverName: ai.driver.name,
        driverId: ai.driver.id,
        gapToLeaderSeconds: this.currentGapsToLeaderMap.get(ai.driver.id) || 0,
        gapToAheadSeconds: this.currentIntervalsMap.get(ai.driver.id) || 0,
        gapToPlayerSeconds: this.currentGapsToPlayerMap.get(ai.driver.id) || 0,
        leadOverP2Seconds: aiPos === 1 ? this.currentP1LeadSeconds : undefined,
        tireCompound: ai.tireCompound,
        tireLife: Math.round(ai.tireLife),
        pitStopsCount: ai.pitStopsCount,
        inPit: ai.pitStopTimer > 0,
      });
    }

    for (const peer of this.peerCars.values()) {
      radar.push({
        progress: peer.progress,
        lateralOffset: peer.lateralOffset,
        color: peer.teamColor || '#00e5ff',
        isPlayer: false,
        isTeammate: false,
        shortName: (peer.name || 'RIV').slice(0, 3).toUpperCase(),
        position: peer.position,
        driverName: peer.name,
        driverId: peer.id,
        gapToLeaderSeconds: 0,
        gapToAheadSeconds: 0,
        gapToPlayerSeconds: 0,
        tireCompound: 'SOFT',
        tireLife: 100,
      });
    }

    // Teammate telemetry & live race position tracking
    const teammateAi = this.aiCars.find((c) => c.driver.id === this.teammateDriverId);
    let teammatePos: number | undefined;
    let teammateGap: number | undefined;
    if (teammateAi) {
      teammatePos = this.currentPositionsMap.get(teammateAi.driver.id) || 20;
      teammateGap = this.currentGapsToPlayerMap.get(teammateAi.driver.id);
    }

    // Context-Aware Race Engineer Live Telemetry Triggers (Start, Gap Ahead, Defending, Lap Updates)
    if (this.raceState === 'racing' && !this.isQualifyingMode) {
      // 1. Launch / Turn 1 Callout
      if (!this.engineerAnnouncedStart && this.raceTimer >= 1.1) {
        this.engineerAnnouncedStart = true;
        if (this.falseStartTriggered) {
          this.triggerEngineerRadio(
            `Jump start detected—anti-stall has engaged! Hold position while the ECU resets, then get back on the power.`,
            'start',
            'critical',
            true
          );
        } else if (this.startReactionTimeMs != null) {
          this.triggerEngineerRadio(
            `Clean launch off the grid—${this.startReactionTimeMs}ms reaction time. P${this.telemetry.position} heading into Turn 1, watch the cold tires.`,
            'start',
            'normal'
          );
        }
      }

      // 2. Lap Transition & Final Lap Callout
      if (this.playerLap > this.lastAnnouncedLap && this.playerLap <= this.totalLaps) {
        this.lastAnnouncedLap = this.playerLap;
        const pos = this.telemetry.position || 1;
        if (this.playerLap === this.totalLaps) {
          this.triggerEngineerRadio(
            `Final lap! White flag is out, you are P${pos}. Deploy remaining ERS (${Math.round(this.ersBattery)}%) and bring it home!`,
            'strategy',
            'warning',
            true
          );
        } else {
          const aheadName = this.telemetry.carAheadShortName;
          const aheadGap = this.telemetry.carAheadGapSeconds;
          const gapInfo =
            pos === 1
              ? `leading P2 by ${(this.currentP1LeadSeconds || 0).toFixed(1)}s`
              : aheadName && aheadGap !== undefined
              ? `gap to ${aheadName} ahead is ${aheadGap.toFixed(1)}s`
              : `holding P${pos}`;
          this.triggerEngineerRadio(
            `Lap ${this.playerLap} of ${this.totalLaps}. P${pos}, ${gapInfo}. Tires at ${Math.round(this.tireLife)}%.`,
            'gap',
            'normal'
          );
        }
      }

      // 3. Gap to Car Ahead (DRS Attack Range < 1.0s)
      const aheadName = this.telemetry.carAheadShortName;
      const aheadGap = this.telemetry.carAheadGapSeconds;
      if (
        aheadName &&
        aheadGap !== undefined &&
        aheadGap > 0.08 &&
        aheadGap <= 0.95 &&
        this.raceTimer > 8.0 &&
        this.raceTimer - (this.engineerCalloutCooldowns['drs_attack'] || -99) > 22.0
      ) {
        this.engineerCalloutCooldowns['drs_attack'] = this.raceTimer;
        this.triggerEngineerRadio(
          `Gap to ${aheadName} ahead is ${aheadGap.toFixed(2)}s—you are inside DRS range! Use overtake boost on the straight.`,
          'gap',
          'normal'
        );
      }

      // 4. Car Behind Threat Warning (< 0.65s)
      const behindName = this.telemetry.carBehindShortName;
      const behindGap = this.telemetry.carBehindGapSeconds;
      if (
        behindName &&
        behindGap !== undefined &&
        behindGap > 0.05 &&
        behindGap <= 0.65 &&
        this.raceTimer > 10.0 &&
        this.raceTimer - (this.engineerCalloutCooldowns['defend_behind'] || -99) > 24.0
      ) {
        this.engineerCalloutCooldowns['defend_behind'] = this.raceTimer;
        this.triggerEngineerRadio(
          `Check your mirrors—${behindName} is right on your gearbox (${behindGap.toFixed(2)}s behind). Defend the inside line!`,
          'gap',
          'warning'
        );
      }
    }

    this.telemetry = {
      speedKmh: Math.abs(Math.round(this.playerSpeedKmh)),
      gear: this.playerGear === -1 ? 0 : this.playerGear,
      rpm: Math.round(safeRpm),
      maxRpm: 15000,
      throttle: input.throttle,
      brake: input.brake,
      steer: input.steer,
      ersBattery: Math.round(this.ersBattery),
      drsActive: this.drsActive,
      drsAvailable: this.playerSpeedKmh > 230,
      tireWear: Math.min(100, Math.max(0, Math.round(100 - this.tireLife))),
      tireLife: Math.min(100, Math.max(0, Math.round(this.tireLife))),
      tireGripMultiplier: Number(effectiveTireGrip.toFixed(2)),
      tireThermalState,
      tireStatusLabel:
        this.tireLife <= 5
          ? 'PUNCTURE'
          : this.tireLife < 20
          ? 'CRITICAL'
          : this.tireLife < 42
          ? 'BLISTERING'
          : this.tireLife < 70
          ? 'GRAINING'
          : 'OPTIMAL',
      tireCorners: {
        fl: Math.round(this.tireCorners.fl),
        fr: Math.round(this.tireCorners.fr),
        rl: Math.round(this.tireCorners.rl),
        rr: Math.round(this.tireCorners.rr),
      },
      pitStopActive: this.pitStopTimer > 0,
      pitStopTimer: this.pitStopTimer > 0 ? Number(this.pitStopTimer.toFixed(1)) : 0,
      pitStopsCount: this.pitStopsCount,
      tireTemp: Math.round(this.tireTempValue),
      tireCompound: this.tireCompound,
      currentLap: Math.min(this.totalLaps, this.playerLap),
      totalLaps: this.totalLaps,
      lapTimeCurrent: this.lapTimeCurrent,
      lapTimeBest: this.lapTimeBest,
      lastLapTime: this.lastLapTime,
      deltaToLeader: this.getDeltaToLeader(),
      position: this.telemetry.position,
      trackProgress: this.playerProgress,
      offTrack: surface.offTrack,
      onCurb: surface.onCurb,
      carsRadar: radar,
      p1LeadSeconds: this.currentP1LeadSeconds,
      teammatePosition: teammatePos,
      teammateShortName: teammateAi?.driver.shortName,
      teammateDriverName: teammateAi?.driver.name,
      teammateGapSeconds: teammateGap,
      teammateObedience: teammateAi?.driver.obedienceRating ?? 75,
      teammateCurrentOrder: this.teammateStrategy,
      teammateRadioMessage: this.teammateRadioTimer > 0 ? this.teammateRadioMsg : undefined,
      teammateRadioSpeaker: this.teammateRadioTimer > 0 ? this.teammateRadioSpeaker : undefined,
      teammateRadioStatus: this.teammateRadioTimer > 0 ? this.teammateRadioStatus : undefined,
      teammateDistanceMeters: teammateAi ? this.playerPos.distanceTo(teammateAi.pos) : undefined,
      crashWaitTimer: this.playerCrashWaitTimer > 0 ? this.playerCrashWaitTimer : undefined,
      crashWaitMax: this.playerCrashWaitMax,
      crashWaitMode: this.difficulty,
      engineReliability: this.engineReliability,
      protectionShieldTimer: this.playerProtectionShieldTimer > 0 ? this.playerProtectionShieldTimer : undefined,
      slipstreamActive: this.slipstreamActive,
      slipstreamFactor: this.slipstreamFactor,
      wrongWayWarning: this.wrongWayWarning,
      wrongWayTimer: this.wrongWayTimer,
      falseStartTriggered: this.falseStartTriggered,
      falseStartPenaltyTimer: this.falseStartPenaltyTimer > 0 ? Number(this.falseStartPenaltyTimer.toFixed(1)) : 0,
      startReactionTimeMs: this.startReactionTimeMs,
      falseStartEarlyMs: this.falseStartEarlyMs,
      launchBannerTimer: this.launchBannerTimer > 0 ? Number(this.launchBannerTimer.toFixed(1)) : 0,
      manualGearMode: this.manualGearMode,
      manualGearHoldTimer: this.manualGearHoldTimer > 0 ? Number(this.manualGearHoldTimer.toFixed(1)) : 0,
      raceEngineerRadio: this.engineerRadioTimer > 0 ? this.raceEngineerRadio : undefined,
      leaderShortName: this.telemetry.leaderShortName,
      leaderDriverName: this.telemetry.leaderDriverName,
      carAheadShortName: this.telemetry.carAheadShortName,
      carAheadGapSeconds: this.telemetry.carAheadGapSeconds,
      carBehindShortName: this.telemetry.carBehindShortName,
      carBehindGapSeconds: this.telemetry.carBehindGapSeconds,
      top3Drivers: this.telemetry.top3Drivers,
    };
  }

  private handleCarCollisions(playerForward: THREE.Vector3, dt: number) {
    const pFwd = this._scratchPFwd.copy(playerForward).normalize();
    // 3 bounding spheres along player car length (Front, Cockpit, Rear) - zero allocation
    this._scratchPPts[0].copy(this.playerPos).addScaledVector(pFwd, 1.65);
    this._scratchPPts[1].copy(this.playerPos);
    this._scratchPPts[2].copy(this.playerPos).addScaledVector(pFwd, -1.65);
    const pPts = this._scratchPPts;
    const collisionThreshold = 2.28; // Accurate F1 open-wheel hull width threshold

    for (const ai of this.aiCars) {
      if (ai.finished || ai.isHiddenByPracticeFilter) continue;

      // 3-SECOND PROTECTION SHIELD: If player or CPU recently recovered, protect against getting re-stuck!
      if (this.playerProtectionShieldTimer > 0 || ai.protectionShieldTimer > 0) {
        continue;
      }

      const aiFwd = this._scratchAiFwd.set(-Math.sin(ai.heading), 0, -Math.cos(ai.heading)).normalize();
      this._scratchAiPts[0].copy(ai.pos).addScaledVector(aiFwd, 1.65);
      this._scratchAiPts[1].copy(ai.pos);
      this._scratchAiPts[2].copy(ai.pos).addScaledVector(aiFwd, -1.65);
      const aiPts = this._scratchAiPts;

      let minDist = Infinity;
      const contactNorm = this._scratchContactNorm.set(0, 0, 0);

      for (let pi = 0; pi < 3; pi++) {
        const p = pPts[pi];
        for (let aiIdx = 0; aiIdx < 3; aiIdx++) {
          const a = aiPts[aiIdx];
          const diff = this._scratchColDiff.subVectors(p, a);
          diff.y = 0;
          const dist = diff.length();
          if (dist < minDist) {
            minDist = dist;
            contactNorm.copy(diff);
          }
        }
      }

      if (minDist < collisionThreshold) {
        const penetration = collisionThreshold - minDist;
        const norm =
          contactNorm.length() > 0.001
            ? contactNorm.normalize()
            : this._scratchFallbackNorm.subVectors(this.playerPos, ai.pos).normalize();

        const isTeammateCar = Boolean(this.teammateDriverId && ai.driver.id === this.teammateDriverId);

        // Project collision normal onto track normal so CPU car deflects smoothly in track-lateral space
        const aiTrackPt = this.track.getTrackPointAtProgress(ai.progress);
        const latProj = norm.dot(aiTrackPt.normal);
        const evadeDir = latProj >= 0 ? -1 : 1;

        // 1. SOLID PHYSICAL PUSHBACK: Smoothly separate cars and steer CPU away from player
        this.playerPos.addScaledVector(norm, penetration * 0.45);
        ai.pos.addScaledVector(norm, -penetration * 0.65);
        ai.lateralOffset += evadeDir * Math.max(0.15, Math.abs(latProj)) * penetration * 0.95;
        ai.smoothLateralVel = (ai.smoothLateralVel || 0) + evadeDir * 4.8;
        ai.committedPassSide = evadeDir;
        ai.passTargetId = 'player';
        ai.passHoldTimer = 1.8;
        ai.builtCar.root.position.copy(ai.pos);

        // Teammate Anti-Wrecking Safety Protocol:
        if (isTeammateCar) {
          this.playerSpeedKmh = Math.max(20, this.playerSpeedKmh - 8);
          ai.speedKmh = Math.max(20, ai.speedKmh - 5);
          soundEngine.playCrash(0.25);
          inputManager.rumble(0.25, 0.35, 70);
          continue;
        }

        // 2. Impact speed analysis
        const relSpeedKmh = Math.abs(this.playerSpeedKmh - ai.speedKmh);
        const playerVel = this._scratchPlayerVel.copy(pFwd).multiplyScalar(this.playerSpeedKmh / 3.6);
        const aiVel = this._scratchAiVel.copy(aiFwd).multiplyScalar(ai.speedKmh / 3.6);
        const closingSpeedKmh = Math.abs(playerVel.sub(aiVel).dot(norm)) * 3.6;

        // Reliability resilience for car-to-car impacts:
        // Only trigger a full stall crash on genuinely heavy high-closing-speed impacts,
        // allowing side-by-side wheel rubbing and evasive weaving to deflect smoothly!
        const relFactor = Math.max(0, Math.min(1.0, ((this.engineReliability || 80) - 75) / 25));
        const carRelSpeedStallThreshold = 46 + relFactor * 22;
        const carClosingStallThreshold = 36 + relFactor * 18;

        const isHardImpact =
          this.playerGear !== -1 &&
          this.playerSpeedKmh > 0 &&
          ((closingSpeedKmh >= carClosingStallThreshold && relSpeedKmh >= 32) ||
            relSpeedKmh >= carRelSpeedStallThreshold ||
            (closingSpeedKmh >= 28 && minDist < collisionThreshold * 0.72));

        if (isHardImpact && this.playerCrashWaitTimer <= 0) {
          const waitDuration = this.getCrashWaitDuration();

          // 1. Player penalty: stalled, stopped for waitDuration
          this.playerCrashWaitTimer = waitDuration;
          this.playerCrashWaitMax = waitDuration;
          this.playerSpeedKmh = 0;
          this.playerCar.setBraking(true);

          // 2. Primary Collided CPU penalty: ONLY immediately involved CPU car is impacted!
          ai.waitTimer = waitDuration;
          ai.speedKmh = 0;
          ai.isCrashed = true;
          ai.builtCar.setBraking(true);
          ai.builtCar.updateSparks(180, true, dt);

          soundEngine.playCrash(1.0);
          inputManager.rumble(1.0, 1.0, 350);
          this.collisionTrauma = 1.0;
          this.triggerYellowFlag(waitDuration + 2.0);
          this.triggerEngineerRadio(
            `Heavy contact with ${ai.driver.shortName}! Anti-stall active (${waitDuration.toFixed(1)}s recovery). Yellow flags out in this sector.`,
            'incident',
            'critical',
            true
          );
        } else {
          // Moderate bump / wheel-rubbing (solid elastic deflection without stall penalty)
          if (this.playerGear === -1 || this.playerSpeedKmh < 0) {
            this.playerSpeedKmh = 0;
          } else {
            this.playerSpeedKmh = Math.max(15, this.playerSpeedKmh - 8);
          }
          ai.speedKmh = Math.max(15, ai.speedKmh - 8);
          soundEngine.playCrash(0.28);
          inputManager.rumble(0.35, 0.5, 70);
          this.collisionTrauma = Math.min(0.65, this.collisionTrauma + 0.2);
        }
      }
    }
  }

  private triggerYellowFlag(duration: number) {
    this.yellowFlagTimer = duration;
    this.yellowFlagActive = true;
  }

  private updateAICars(dt: number) {
    // Difficulty speed modifier
    // Rookie: 0.80x, Pro: 0.89x, Legend: 1.22x to 1.26x (Significantly harder, intense championship pace!)
    const baseDifficultyScale =
      this.difficulty === 'rookie' ? 0.80 : this.difficulty === 'legend' ? 1.22 : 0.89;

    // Pre-query player track surface & instantaneous lateral velocity once per frame for all AI cars
    const playerSurf = this.track.checkSurfaceType(this.playerPos, this.playerProgress);
    const playerLatOffset = playerSurf.lateralOffset;
    const playerRealSpeed = Math.abs(this.playerSpeedKmh);
    const pFwdX = -Math.sin(this.playerHeading);
    const pFwdZ = -Math.cos(this.playerHeading);
    const playerLateralVelMs =
      (pFwdX * playerSurf.normal.x + pFwdZ * playerSurf.normal.z) * (this.playerSpeedKmh / 3.6);
    const isPlayerHazard =
      this.playerCrashWaitTimer > 0 ||
      this.falseStartPenaltyTimer > 0 ||
      this.pitStopTimer > 0 ||
      playerRealSpeed < 55;

    const trackBarrierLimit = (this.track.barrierLimit || 18.4) - 2.0;
    // Keep normal AI racing and overtaking comfortably on the paved track surface
    const safeTrackEdge = Math.min(10.4, trackBarrierLimit - 1.2);

    for (const ai of this.aiCars) {
      if (ai.isHiddenByPracticeFilter) {
        ai.builtCar.root.visible = false;
        continue;
      }
      if (ai.finished) continue;

      // In Qualifying Mode: if 3-second ghost delay is enabled, ghost cars come in 3.0 seconds into the lap; otherwise they are visible immediately from the start
      if (this.isQualifyingMode) {
        ai.builtCar.root.visible = this.qualifyingGhostDelay3s
          ? this.raceState === 'racing' && this.raceTimer >= 3.0
          : true;
      } else {
        ai.builtCar.root.visible = true;
      }

      // Tick AI 3-second protection shield & pass commitment hysteresis timer
      if (ai.protectionShieldTimer > 0) {
        ai.protectionShieldTimer = Math.max(0, ai.protectionShieldTimer - dt);
      }
      if (ai.passHoldTimer && ai.passHoldTimer > 0) {
        ai.passHoldTimer = Math.max(0, ai.passHoldTimer - dt);
      }

      // Legend & Car Tier scaling: Tier 1 (Red Bull, McLaren, Ferrari) gets additional performance boost
      const tierFactor = (4 - ai.team.performanceTier) * 0.025;
      const difficultyScale = baseDifficultyScale + (this.difficulty === 'legend' ? Math.max(0.02, tierFactor) : 0);

      // Handle CPU Crash Penalty Wait Timer (Rookie: 2.0s, Pro: 3.5s, Legend: 5.0s)
      if (ai.waitTimer > 0) {
        ai.waitTimer = Math.max(0, ai.waitTimer - dt);
        ai.speedKmh = 0;
        ai.builtCar.setBraking(true);
        if (ai.waitTimer <= 0) {
          ai.isCrashed = false;
          ai.isSpinning = false;
          ai.speedKmh = 45;
          // 3-SECOND PROTECTION SHIELD: CPU recovers and avoids immediate re-collision/getting wedged
          ai.protectionShieldTimer = 3.0;
        }
        continue;
      }

      // Handle AI Spin / Crash Incidents
      if (ai.isSpinning) {
        ai.spinTimer -= dt;
        ai.speedKmh = Math.max(10, ai.speedKmh - 40 * dt * 3.6);
        ai.heading += dt * 5.8; // Visual spin-out
        ai.builtCar.root.rotation.y = ai.heading;
        ai.builtCar.updateSparks(120, true, dt);

        if (ai.spinTimer <= 0) {
          ai.isSpinning = false;
          ai.isCrashed = true;
          ai.crashTimer = 2.0; // Pause to recover and check mirrors
        }
        continue;
      }

      if (ai.isCrashed) {
        ai.crashTimer -= dt;
        ai.speedKmh = Math.max(0, ai.speedKmh - 25 * dt * 3.6);

        if (ai.crashTimer <= 0) {
          ai.isCrashed = false;
          ai.speedKmh = 50;
          ai.protectionShieldTimer = 3.0;
        }
        continue;
      }

      // Realistic Cornering Target Speed based on track curvature & team car profiles
      const cornerBaseKmh = this.track.getTargetCornerSpeedKmh(ai.progress);

      // DISTINCT AI PERFORMANCE & CUSTOMER PU INTEGRATION (Uncapped stats):
      const isTeammateCar = Boolean(this.teammateDriverId && ai.driver.id === this.teammateDriverId);
      const isPlayerCustomerTeam = Boolean(
        this.customTeamConfig?.customerTeamsSupplied?.includes(ai.team.id)
      );

      let effectiveEnginePower = ai.team.carProfile?.topSpeedRating || (80 + (4 - ai.team.performanceTier) * 5);
      let effectiveAccel = ai.team.carProfile?.acceleration || (80 + (4 - ai.team.performanceTier) * 5);
      let handlingRating = ai.team.carProfile?.handlingRating || (80 + (4 - ai.team.performanceTier) * 5);
      let aeroRating = ai.team.carProfile?.aeroDownforce || 82;

      if (isTeammateCar) {
        effectiveEnginePower = this.enginePowerRating;
        effectiveAccel = this.accelerationScore;
        handlingRating = this.handlingScore;
        aeroRating = this.downforceScore;
      } else if (isPlayerCustomerTeam) {
        effectiveEnginePower = this.customTeamConfig?.enginePower || 105;
        effectiveAccel = 80 + ((this.customTeamConfig?.enginePower || 105) - 80) * 0.8;
      }

      // AI Tire Compound & Tire Health Degradation + Pit Stop Simulation:
      const aiSpec = TIRE_COMPOUND_SPECS[ai.tireCompound];
      if (this.raceState === 'racing' && !this.isQualifyingMode && ai.speedKmh > 15) {
        const lapScale = Math.max(0.55, Math.min(1.15, 5 / Math.max(3, this.totalLaps)));
        const cornerWearLoad = cornerBaseKmh < 205 ? 0.28 : cornerBaseKmh < 290 ? 0.12 : 0.02;
        const aggressionWearFactor = 0.85 + (ai.driver.aggression || 0.8) * 0.30;
        const aiWearPerSec =
          (0.033 * (ai.speedKmh / 260) + cornerWearLoad * aggressionWearFactor) *
          aiSpec.wearRateMultiplier *
          lapScale;
        ai.tireLife = Math.max(0, ai.tireLife - aiWearPerSec * dt);
        ai.builtCar.setTireHealthVisuals(ai.tireLife, 95);

        // AI Pit Stop Strategy: when tire health degrades below their pit threshold before the final lap, CPU pits for fresh tires!
        const pitThreshold = 25 + (ai.driver.number % 9); // 25% to 33% tire health pit window
        if (ai.tireLife < pitThreshold && ai.lap < this.totalLaps && ai.pitStopTimer <= 0) {
          ai.pitStopTimer = 2.6;
          ai.pitStopsCount++;
          const nextCompound: TireCompound =
            this.totalLaps - ai.lap <= 2 ? 'SOFT' : ai.tireCompound === 'SOFT' ? 'MEDIUM' : 'HARD';
          ai.tireCompound = nextCompound;
          ai.tireLife = 100;
          ai.builtCar.setTireCompound(nextCompound);
          ai.builtCar.setTireHealthVisuals(100, 88);
          ai.protectionShieldTimer = 2.8;
        }
      }

      if (ai.pitStopTimer > 0) {
        ai.pitStopTimer = Math.max(0, ai.pitStopTimer - dt);
        ai.speedKmh = Math.max(35, ai.speedKmh - 190 * dt * 3.6);
      }

      const aiTireGripFactor =
        ai.tireLife >= 70
          ? 1.0
          : ai.tireLife >= 40
          ? 0.86 + ((ai.tireLife - 40) / 30) * 0.14
          : 0.68 + (ai.tireLife / 40) * 0.18;
      const aiEffectiveTireMod = aiSpec.baseGripMultiplier * aiTireGripFactor;

      // Straightaway top speed based on engine power rating + dynamic race-day form + tire compound delta:
      const formBoost = ai.raceFormPace || 0;
      const straightTopSpeed =
        (318 + Math.max(0, effectiveEnginePower - 70) * 0.85 + aiSpec.topSpeedDeltaKmh + formBoost * 0.3) *
        difficultyScale *
        (ai.tireLife < 30 ? 0.96 : 1.0);
      // High-speed cornering grip bonus based on handling, aero downforce, driver skill, and tire compound/health:
      const cornerBonus =
        ((handlingRating - 78) * 1.8 + (aeroRating - 78) * 1.5 + (ai.driver.rating - 78) * 0.8 + formBoost * 0.4) *
        difficultyScale;
      const targetCornerSpeed = Math.max(75, (cornerBaseKmh + cornerBonus) * aiEffectiveTireMod);

      // Look ahead slightly for upcoming corners so AI brakes smoothly BEFORE the apex
      const brakeLookaheadProg = (ai.progress + 26.0 / this.track.trackLength) % 1.0;
      const upcomingCornerBaseKmh = this.track.getTargetCornerSpeedKmh(brakeLookaheadProg);
      const upcomingTargetSpeed = Math.max(75, (upcomingCornerBaseKmh + cornerBonus) * aiEffectiveTireMod);
      const effectiveCornerTarget = Math.min(targetCornerSpeed, upcomingTargetSpeed * 1.06);

      // On straightaways, car accelerates to straightTopSpeed; in corners, smoothly governed by effectiveCornerTarget:
      let desiredSpeed =
        cornerBaseKmh >= 350 && upcomingCornerBaseKmh >= 340
          ? straightTopSpeed
          : Math.min(straightTopSpeed, effectiveCornerTarget);
      if (ai.pitStopTimer > 0) {
        desiredSpeed = Math.min(desiredSpeed, 65);
      }

      // 1. REALISTIC CURVATURE-DRIVEN RACING LINE (Outside -> Inside Apex -> Exit, steady on straights!):
      const ptNow = this.track.getTrackPointAtProgress(ai.progress);
      const ptNear = this.track.getTrackPointAtProgress((ai.progress + 18.0 / this.track.trackLength) % 1.0);
      const ptFar = this.track.getTrackPointAtProgress((ai.progress + 44.0 / this.track.trackLength) % 1.0);

      // Signed curvature: positive = right-hand turn (+normal is inside apex), negative = left-hand turn (-normal is inside apex)
      const curveNow = ptNow.normal.dot(ptNear.tangent);
      const curveAhead = ptNear.normal.dot(ptFar.tangent);

      // Subtle per-driver baseline lane preference on straights (kept narrow and steady so cars never weave drunkenly)
      const steadyDriverBias = THREE.MathUtils.clamp((ai.lineBias ?? 0) * 0.42, -3.2, 3.2);
      // Clip the inside apex when in the turn, and set up slightly wide on the outside when approaching a turn
      const apexOffset = THREE.MathUtils.clamp(curveNow * 24.0, -5.8, 5.8);
      const entrySetupOffset =
        Math.abs(curveNow) < 0.08 && Math.abs(curveAhead) > 0.10
          ? THREE.MathUtils.clamp(-curveAhead * 12.0, -3.5, 3.5)
          : 0;

      let targetLateral = THREE.MathUtils.clamp(
        steadyDriverBias + apexOffset + entrySetupOffset,
        -safeTrackEdge * 0.82,
        safeTrackEdge * 0.82
      );

      // TEAMMATE STRATEGY EXECUTION:
      if (isTeammateCar) {
        if (this.teammateStrategy === 'yield') {
          let pProgDiff = this.playerProgress - ai.progress;
          if (pProgDiff < -0.5) pProgDiff += 1.0;
          if (pProgDiff > 0.5) pProgDiff -= 1.0;
          const distBehindPlayer = -pProgDiff * this.track.trackLength;
          if (distBehindPlayer > 0 && distBehindPlayer < 65) {
            desiredSpeed = Math.min(desiredSpeed, Math.max(70, playerRealSpeed - 25));
            const yieldSide = playerLatOffset >= 0 ? -1 : 1;
            targetLateral = yieldSide * Math.min(7.2, safeTrackEdge);
          }
        } else if (this.teammateStrategy === 'block') {
          let pProgDiff = this.playerProgress - ai.progress;
          if (pProgDiff < -0.5) pProgDiff += 1.0;
          if (pProgDiff > 0.5) pProgDiff -= 1.0;
          const distBehindPlayer = pProgDiff * this.track.trackLength;

          if (distBehindPlayer < -1.8) {
            desiredSpeed = Math.min(desiredSpeed, Math.max(65, playerRealSpeed - 15));
            const yieldSide = playerLatOffset >= 0 ? -1 : 1;
            targetLateral = yieldSide * Math.min(6.5, safeTrackEdge);
          } else {
            let closestRival: AICarState | null = null;
            let minRivalDist = Infinity;
            for (const rival of this.aiCars) {
              if (rival.driver.id === ai.driver.id || rival.finished) continue;
              let rDiff = ai.progress - rival.progress;
              if (rDiff < -0.5) rDiff += 1.0;
              if (rDiff > 0.5) rDiff -= 1.0;
              const rDist = rDiff * this.track.trackLength;
              if (rDist > 0.5 && rDist < 55.0 && rDist < minRivalDist) {
                minRivalDist = rDist;
                closestRival = rival;
              }
            }

            if (closestRival) {
              targetLateral = THREE.MathUtils.clamp(closestRival.lateralOffset, -7.0, 7.0);
              desiredSpeed = Math.min(desiredSpeed, desiredSpeed * 0.82);
            } else {
              targetLateral = 0;
              desiredSpeed = Math.min(desiredSpeed, desiredSpeed * 0.88);
            }
          }
        } else if (this.teammateStrategy === 'push') {
          desiredSpeed = Math.min(straightTopSpeed + 15, desiredSpeed + 12);
        }
      }

      // Yellow flag compliance: slow down by 18% when caution is active
      if (this.yellowFlagActive) {
        desiredSpeed *= 0.82;
      }

      // 2. PROACTIVE CRASH AVOIDANCE & SMOOTH WEAVING AROUND THE PLAYER & OTHER CARS:
      let directlyBlockedCarSpeed: number | null = null;
      let minDistanceToCarAhead = Infinity;
      let isWeavingAroundTraffic = false;

      if (!this.isQualifyingMode) {
        // --- A. PROACTIVE WEAVING & AVOIDANCE AROUND THE PLAYER CAR ---
        let playerDeltaProg = this.playerProgress - ai.progress;
        if (playerDeltaProg < -0.5) playerDeltaProg += 1.0;
        if (playerDeltaProg > 0.5) playerDeltaProg -= 1.0;
        const playerForwardM = playerDeltaProg * this.track.trackLength;

        // Predict player's lateral offset ~0.38s ahead so AI reacts immediately when player weaves
        const predictedPlayerLat = THREE.MathUtils.clamp(
          playerLatOffset + playerLateralVelMs * 0.38,
          -safeTrackEdge,
          safeTrackEdge
        );
        const safePlayerClearance = isTeammateCar ? 4.8 : 4.4;

        // CASE 1: Player is ahead of AI (up to 95m lookahead) or overlap-ahead (-1.5m to +95m)
        if (playerForwardM > -1.5 && playerForwardM < 95.0) {
          const closingKmh = ai.speedKmh - playerRealSpeed;
          // Check if AI's current position or planned racing line passes near the player's corridor
          const latGapCurrent = Math.abs(ai.lateralOffset - playerLatOffset);
          const latGapPredicted = Math.abs(targetLateral - predictedPlayerLat);
          const needsPlayerWeave =
            (playerForwardM < 55.0 && (latGapCurrent < safePlayerClearance || latGapPredicted < safePlayerClearance)) ||
            (playerForwardM < 95.0 &&
              (closingKmh > 10 || isPlayerHazard) &&
              (latGapCurrent < safePlayerClearance + 0.6 || latGapPredicted < safePlayerClearance + 0.6));

          if (needsPlayerWeave) {
            isWeavingAroundTraffic = true;

            // Calculate available track room on the LEFT (-1) vs RIGHT (+1) of the player
            const leftCandidate = Math.min(playerLatOffset, predictedPlayerLat) - safePlayerClearance;
            const rightCandidate = Math.max(playerLatOffset, predictedPlayerLat) + safePlayerClearance;
            const leftRoom = playerLatOffset - -safeTrackEdge;
            const rightRoom = safeTrackEdge - playerLatOffset;

            // Check if another AI car is flanking the player on left or right
            let leftBlockedByAi = false;
            let rightBlockedByAi = false;
            for (const other of this.aiCars) {
              if (other.driver.id === ai.driver.id || other.finished || other.isHiddenByPracticeFilter) continue;
              let oDiff = other.progress - ai.progress;
              if (oDiff < -0.5) oDiff += 1.0;
              if (oDiff > 0.5) oDiff -= 1.0;
              const oDistM = oDiff * this.track.trackLength;
              if (oDistM > -5.0 && oDistM < playerForwardM + 10.0) {
                if (Math.abs(other.lateralOffset - leftCandidate) < 2.8) leftBlockedByAi = true;
                if (Math.abs(other.lateralOffset - rightCandidate) < 2.8) rightBlockedByAi = true;
              }
            }

            // Determine or maintain committed pass side with strong hysteresis (prevents left-right indecision!)
            let passSide =
              ai.passTargetId === 'player' && ai.passHoldTimer && ai.passHoldTimer > 0
                ? ai.committedPassSide || 0
                : 0;

            // Invalidate existing side only if the player squeezed that side completely against the barrier
            if (passSide === -1 && leftRoom < 3.3) passSide = 0;
            if (passSide === 1 && rightRoom < 3.3) passSide = 0;

            if (passSide === 0) {
              if (leftRoom < 3.8 && rightRoom >= 3.8) {
                passSide = 1;
              } else if (rightRoom < 3.8 && leftRoom >= 3.8) {
                passSide = -1;
              } else if (leftBlockedByAi && !rightBlockedByAi && rightRoom >= 3.6) {
                passSide = 1;
              } else if (rightBlockedByAi && !leftBlockedByAi && leftRoom >= 3.6) {
                passSide = -1;
              } else {
                // Score both sides based on shortest lateral move + wider track margin + opposite of player's lateral drift
                const leftDistCost = Math.abs(ai.lateralOffset - leftCandidate) - leftRoom * 0.28 + (playerLateralVelMs < -0.8 ? 2.2 : 0);
                const rightDistCost = Math.abs(ai.lateralOffset - rightCandidate) - rightRoom * 0.28 + (playerLateralVelMs > 0.8 ? 2.2 : 0);
                passSide = leftDistCost <= rightDistCost ? -1 : 1;
              }
            }

            ai.committedPassSide = passSide;
            ai.passTargetId = 'player';
            ai.passHoldTimer = 1.65;

            const rawPassLane =
              passSide < 0
                ? Math.min(playerLatOffset, predictedPlayerLat) - safePlayerClearance
                : Math.max(playerLatOffset, predictedPlayerLat) + safePlayerClearance;
            const passLaneOffset = THREE.MathUtils.clamp(rawPassLane, -safeTrackEdge, safeTrackEdge);

            // Smoothly ramp weave commitment from 95m out to full lock by 60m
            const weaveAlpha = THREE.MathUtils.clamp(1.0 - Math.max(0, playerForwardM - 58.0) / 37.0, 0.35, 1.0);
            targetLateral = THREE.MathUtils.lerp(targetLateral, passLaneOffset, weaveAlpha);

            // Guarantee strict lateral clearance when within 52m behind the player
            if (playerForwardM < 52.0 && Math.abs(targetLateral - playerLatOffset) < safePlayerClearance) {
              targetLateral = THREE.MathUtils.clamp(
                playerLatOffset + passSide * safePlayerClearance,
                -safeTrackEdge,
                safeTrackEdge
              );
            }

            // SMART ANTI-REAR-END SPEED MODULATION:
            // Only slow down if the AI car has NOT yet cleared the player's rear wing laterally!
            // As soon as the AI weaves out into the open passing lane (latGapCurrent >= 3.15m), it accelerates past cleanly!
            const currentClearance = Math.abs(ai.lateralOffset - playerLatOffset);
            if (playerForwardM > 0 && currentClearance < 3.25) {
              minDistanceToCarAhead = Math.min(minDistanceToCarAhead, playerForwardM);
              if (ai.speedKmh > playerRealSpeed - 5) {
                const clearanceProgress = THREE.MathUtils.clamp((currentClearance - 1.5) / 1.75, 0, 1);
                const baseSafeSpeed = Math.max(
                  isPlayerHazard ? 20 : 45,
                  playerRealSpeed + Math.max(0, playerForwardM - 8.5) * 3.1
                );
                // Blend between safe follow speed (when directly behind) and full passing speed (as lateral clearance opens up)
                const modulatedSpeed = THREE.MathUtils.lerp(baseSafeSpeed, desiredSpeed, clearanceProgress * 0.75);
                directlyBlockedCarSpeed = Math.min(directlyBlockedCarSpeed ?? Infinity, modulatedSpeed);
              }
            }
          }
        }
        // CASE 2: Side-by-Side / Wheel-to-Wheel with the Player (-7.5m to +7.5m)
        else if (Math.abs(playerForwardM) <= 7.5) {
          const latDiff = ai.lateralOffset - playerLatOffset;
          const absLatDiff = Math.abs(latDiff);
          if (absLatDiff < safePlayerClearance + 0.4) {
            isWeavingAroundTraffic = true;
            let sideSign = latDiff >= 0 ? 1 : -1;
            if (ai.passTargetId === 'player' && ai.committedPassSide && absLatDiff < 1.2) {
              sideSign = ai.committedPassSide;
            }
            if (playerLatOffset + sideSign * safePlayerClearance > safeTrackEdge + 0.8) sideSign = -1;
            if (playerLatOffset + sideSign * safePlayerClearance < -safeTrackEdge - 0.8) sideSign = 1;

            const safeSideLane = THREE.MathUtils.clamp(
              playerLatOffset + sideSign * safePlayerClearance,
              -safeTrackEdge,
              safeTrackEdge
            );
            targetLateral = safeSideLane;

            // If player is actively steering/drifting into the AI's side pod, apply immediate smooth lateral dodge
            if (absLatDiff < 3.4) {
              const urgency = (3.4 - absLatDiff) / 3.4;
              ai.smoothLateralVel = (ai.smoothLateralVel || 0) + sideSign * urgency * 18.0 * dt;
            }
          }
        }
        // CASE 3: Player is closely behind AI and closing rapidly (-28m to -7.5m)
        else if (
          playerForwardM >= -28.0 &&
          playerForwardM < -7.5 &&
          playerRealSpeed > ai.speedKmh + 16 &&
          !(isTeammateCar && this.teammateStrategy === 'block')
        ) {
          const latGapRear = Math.abs(playerLatOffset - ai.lateralOffset);
          if (latGapRear < 3.3) {
            // Player is diving fast from behind: smoothly ease toward the side with more room away from player's dive vector
            isWeavingAroundTraffic = true;
            const playerDiveDir =
              Math.abs(playerLateralVelMs) > 0.6
                ? Math.sign(playerLateralVelMs)
                : playerLatOffset >= ai.lateralOffset
                ? 1
                : -1;
            let yieldDir = -playerDiveDir || 1;
            if (ai.lateralOffset + yieldDir * 3.5 > safeTrackEdge) yieldDir = -1;
            if (ai.lateralOffset + yieldDir * 3.5 < -safeTrackEdge) yieldDir = 1;
            targetLateral = THREE.MathUtils.clamp(
              playerLatOffset + yieldDir * 4.0,
              -safeTrackEdge,
              safeTrackEdge
            );
          }
        }

        // --- B. PROACTIVE WEAVING & AVOIDANCE AROUND OTHER CPU CARS ---
        let closestAiThreatDist = Infinity;
        for (const otherAi of this.aiCars) {
          if (otherAi.driver.id === ai.driver.id || otherAi.finished || otherAi.isHiddenByPracticeFilter) continue;
          let aiDeltaProg = otherAi.progress - ai.progress;
          if (aiDeltaProg < -0.5) aiDeltaProg += 1.0;
          if (aiDeltaProg > 0.5) aiDeltaProg -= 1.0;
          const aiForwardM = aiDeltaProg * this.track.trackLength;
          const aiLatDiff = otherAi.lateralOffset - ai.lateralOffset;
          const otherIsHazard = otherAi.isSpinning || otherAi.isCrashed || otherAi.waitTimer > 0 || otherAi.speedKmh < 55;

          if (aiForwardM > 0.2 && aiForwardM < 68.0 && Math.abs(aiLatDiff) < 3.8) {
            const closingOnAi = ai.speedKmh > otherAi.speedKmh - 4 || otherIsHazard;
            if (closingOnAi && aiForwardM < closestAiThreatDist) {
              closestAiThreatDist = aiForwardM;
              isWeavingAroundTraffic = true;

              const leftRoomAi = otherAi.lateralOffset - -safeTrackEdge;
              const rightRoomAi = safeTrackEdge - otherAi.lateralOffset;
              let evadeDir = aiLatDiff >= 0 ? -1 : 1;
              if (leftRoomAi < 3.6) evadeDir = 1;
              else if (rightRoomAi < 3.6) evadeDir = -1;

              // Do not weave back into the player if the player is nearby!
              if (Math.abs(playerForwardM) < 28.0) {
                const candidateLane = otherAi.lateralOffset + evadeDir * 4.0;
                if (Math.abs(candidateLane - playerLatOffset) < 3.6) {
                  const altLane = otherAi.lateralOffset - evadeDir * 4.0;
                  if (Math.abs(altLane) <= safeTrackEdge) {
                    evadeDir = -evadeDir;
                  }
                }
              }

              const aiPassLane = THREE.MathUtils.clamp(
                otherAi.lateralOffset + evadeDir * 4.0,
                -safeTrackEdge,
                safeTrackEdge
              );
              const blend = THREE.MathUtils.clamp(1.0 - Math.max(0, aiForwardM - 42.0) / 26.0, 0.35, 1.0);
              // Only override targetLateral if we aren't already executing an urgent weave around the player
              if (Math.abs(playerForwardM) > 35.0 || Math.abs(targetLateral - playerLatOffset) >= safePlayerClearance) {
                targetLateral = THREE.MathUtils.lerp(targetLateral, aiPassLane, blend);
              }

              const isOtherBlockingTeammate = Boolean(
                this.teammateDriverId &&
                  otherAi.driver.id === this.teammateDriverId &&
                  this.teammateStrategy === 'block'
              );

              if (isOtherBlockingTeammate) {
                minDistanceToCarAhead = Math.min(minDistanceToCarAhead, aiForwardM);
                const blockedSpeed = Math.min(otherAi.speedKmh * 0.94, Math.max(45, ai.speedKmh * 0.88));
                directlyBlockedCarSpeed = Math.min(directlyBlockedCarSpeed ?? Infinity, blockedSpeed);
              } else if (Math.abs(aiLatDiff) < 2.95 && ai.speedKmh > otherAi.speedKmh) {
                minDistanceToCarAhead = Math.min(minDistanceToCarAhead, aiForwardM);
                const safeSpeed = Math.max(
                  otherIsHazard ? 25 : 55,
                  otherAi.speedKmh + Math.max(0, aiForwardM - 7.0) * 3.4
                );
                directlyBlockedCarSpeed = Math.min(directlyBlockedCarSpeed ?? Infinity, safeSpeed);
              }
            }
          } else if (Math.abs(aiForwardM) <= 5.5 && Math.abs(aiLatDiff) < 3.0) {
            const sideDir = aiLatDiff >= 0 ? -1 : 1;
            const nudged = THREE.MathUtils.clamp(ai.lateralOffset + sideDir * 2.2, -safeTrackEdge, safeTrackEdge);
            if (Math.abs(playerForwardM) > 14.0 || Math.abs(nudged - playerLatOffset) >= 3.8) {
              targetLateral = THREE.MathUtils.lerp(targetLateral, nudged, 0.65);
            }
          }
        }
      }

      // Smoothly feather speed when blocked by slower traffic directly ahead
      if (directlyBlockedCarSpeed !== null) {
        desiredSpeed = Math.min(desiredSpeed, directlyBlockedCarSpeed);
      }

      // 3. SMOOTH LONGITUDINAL ACCELERATION & PROGRESSIVE BRAKING (Zero jerky speed jumps)
      if (ai.speedKmh < desiredSpeed) {
        const speedDiff = desiredSpeed - ai.speedKmh;
        const smoothThrottle = THREE.MathUtils.clamp(speedDiff / 18.0, 0.25, 1.0);
        const powerCurve = Math.max(0.30, 1.0 - (ai.speedKmh / (straightTopSpeed + 35)) * 0.58);
        const aiAccelNorm = Math.max(0.25, (effectiveAccel - 70) / 25);
        const aiAccelMultiplier = (this.difficulty === 'legend' ? 25.0 : 18.0) * aiAccelNorm;
        ai.speedKmh += aiAccelMultiplier * powerCurve * smoothThrottle * dt * 3.6;
        ai.builtCar.setBraking(false);
      } else {
        const isBrakingForObstacle = directlyBlockedCarSpeed !== null && minDistanceToCarAhead < 28.0;
        const speedExcess = ai.speedKmh - desiredSpeed;
        const progressiveBrake = THREE.MathUtils.clamp(speedExcess / 22.0, 0.20, 1.0);
        const baseBrake = isBrakingForObstacle ? 48.0 : (this.difficulty === 'legend' ? 40.0 : 32.0);
        ai.speedKmh = Math.max(desiredSpeed, ai.speedKmh - baseBrake * progressiveBrake * dt * 3.6);
        ai.builtCar.setBraking(isBrakingForObstacle || speedExcess > 9.0);

        if (directlyBlockedCarSpeed !== null && minDistanceToCarAhead < 5.5) {
          ai.speedKmh = Math.max(25, Math.min(ai.speedKmh, directlyBlockedCarSpeed));
        }
      }

      // AI Rare Corner Lock-up Simulation (Only when far away from player so AI never randomly spins into the player!)
      const isHardCorner = cornerBaseKmh < 145;
      const distToPlayerSq = this.playerPos.distanceToSquared(ai.pos);
      if (
        !this.isQualifyingMode &&
        isHardCorner &&
        distToPlayerSq > 45 * 45 &&
        !ai.isSpinning &&
        !ai.isCrashed &&
        this.raceTimer > 6.0
      ) {
        const difficultyMistakeDamp = this.difficulty === 'legend' ? 0.15 : this.difficulty === 'pro' ? 0.55 : 0.90;
        const mistakeChance =
          ((100 - ai.driver.rating) * 0.00018 + ai.driver.aggression * 0.0009) * difficultyMistakeDamp * dt;
        if (Math.random() < mistakeChance) {
          if (Math.random() < 0.18) {
            ai.isSpinning = true;
            ai.spinTimer = 1.8 + Math.random() * 1.0;
            this.triggerYellowFlag(4.0);
            soundEngine.playCrash(0.45);
            if (this.raceTimer - (this.engineerCalloutCooldowns['ai_incident'] || -99) > 18.0) {
              this.engineerCalloutCooldowns['ai_incident'] = this.raceTimer;
              this.triggerEngineerRadio(
                `Yellow flag! ${ai.driver.name} (${ai.driver.shortName}) has spun in the corner—watch for slow traffic ahead!`,
                'incident',
                'warning'
              );
            }
          } else {
            ai.speedKmh = Math.max(45, ai.speedKmh - 10);
            ai.builtCar.updateSparks(50, true, dt);
          }
        }
      }

      // 4. CRITICALLY DAMPED SECOND-ORDER LATERAL DYNAMICS:
      // Low-pass filter targetLateral so target changes never introduce acceleration spikes
      const targetFilterRate = isWeavingAroundTraffic ? 14.0 : 7.5;
      ai.smoothTargetLateral = THREE.MathUtils.lerp(
        ai.smoothTargetLateral ?? ai.lateralOffset,
        targetLateral,
        Math.min(1.0, dt * targetFilterRate)
      );
      ai.smoothTargetLateral = THREE.MathUtils.clamp(ai.smoothTargetLateral, -trackBarrierLimit, trackBarrierLimit);

      const latDiff = ai.smoothTargetLateral - ai.lateralOffset;
      // Critically damped spring:zeta ~ 1.0 -> dampingCoeff ~= 2 * sqrt(springStiffness)
      const springStiffness = isWeavingAroundTraffic
        ? 19.5
        : this.difficulty === 'legend'
        ? 11.5
        : 9.5;
      const dampingCoeff = isWeavingAroundTraffic ? 8.8 : 6.4;
      const maxLatVel = isWeavingAroundTraffic ? 7.8 : 4.6;

      const springAccel = latDiff * springStiffness - (ai.smoothLateralVel || 0) * dampingCoeff;
      ai.smoothLateralVel = (ai.smoothLateralVel || 0) + springAccel * dt;
      ai.smoothLateralVel = THREE.MathUtils.clamp(ai.smoothLateralVel, -maxLatVel, maxLatVel);
      ai.lateralOffset += ai.smoothLateralVel * dt;
      ai.lateralOffset = THREE.MathUtils.clamp(ai.lateralOffset, -trackBarrierLimit, trackBarrierLimit);

      // Track progress advancement
      const speedMs = ai.speedKmh / 3.6;
      const progressDelta = (speedMs * dt) / this.track.trackLength;
      const oldProgress = ai.progress;
      ai.progress = (ai.progress + progressDelta) % 1.0;

      // Lap completion logic for AI
      if (oldProgress > 0.85 && ai.progress < 0.15) {
        if (!ai.hasCrossedInitialStartLine) {
          ai.hasCrossedInitialStartLine = true;
          ai.lapTimeCurrent = 0;
        } else {
          ai.lastLapTime = ai.lapTimeCurrent;
          if (ai.lapTimeCurrent < ai.bestLapTime) {
            ai.bestLapTime = ai.lapTimeCurrent;
          }
          ai.lapTimeCurrent = 0;
          ai.lap++;

          // Official Race Finish Order for AI
          if (ai.lap > this.totalLaps && !this.finishedDriversOrder.includes(ai.driver.id)) {
            this.finishedDriversOrder.push(ai.driver.id);
            ai.finished = true;
          }
        }
      }

      if (ai.hasCrossedInitialStartLine) {
        ai.lapTimeCurrent += dt;
        ai.totalRaceTime += dt;
      }

      // Clamp within barrier limits
      const maxAiOffset = (this.track.barrierLimit || 18.4) - 0.7;
      if (Math.abs(ai.lateralOffset) > maxAiOffset) {
        ai.lateralOffset = Math.sign(ai.lateralOffset) * maxAiOffset;
        ai.smoothLateralVel = 0;
        ai.speedKmh = Math.max(20, ai.speedKmh * 0.75);
      }

      // Position in 3D world
      const pt = this.track.getTrackPointAtProgress(ai.progress);
      const normal = pt.normal;
      ai.pos.copy(pt.position).addScaledVector(normal, ai.lateralOffset);
      ai.pos.y = pt.position.y + 0.08;

      // 5. PURE PURSUIT LOOKAHEAD + LATERAL WEAVE HEADING ORIENTATION:
      const lookaheadMeters = THREE.MathUtils.clamp((ai.speedKmh / 320) * 22.0, 11.0, 24.0);
      const lookaheadProg = (ai.progress + lookaheadMeters / this.track.trackLength) % 1.0;
      const ptAhead = this.track.getTrackPointAtProgress(lookaheadProg);
      const aheadLateral = THREE.MathUtils.clamp(
        ai.lateralOffset + (ai.smoothTargetLateral - ai.lateralOffset) * 0.75,
        -trackBarrierLimit,
        trackBarrierLimit
      );
      const targetWorldPos = this._scratchTargetWorldPos
        .copy(ptAhead.position)
        .addScaledVector(ptAhead.normal, aheadLateral);

      const dirX = targetWorldPos.x - ai.pos.x;
      const dirZ = targetWorldPos.z - ai.pos.z;
      const naturalHeading = Math.atan2(-dirX, -dirZ);

      // Frame-rate independent exponential smoothing on heading so cars carve and weave with zero angular jitter
      let headingDelta = naturalHeading - ai.heading;
      while (headingDelta > Math.PI) headingDelta -= Math.PI * 2;
      while (headingDelta < -Math.PI) headingDelta += Math.PI * 2;

      const headingSmoothAlpha = 1.0 - Math.exp(-(isWeavingAroundTraffic ? 14.5 : 11.0) * dt);
      ai.heading += headingDelta * headingSmoothAlpha;

      // Realistic front-wheel steering angle based on curvature and lateral weave velocity
      const weaveSteerComponent = Math.atan2(-(ai.smoothLateralVel || 0), Math.max(14.0, speedMs)) * 1.4;
      const targetSteerAngle = THREE.MathUtils.clamp(headingDelta * 2.2 + weaveSteerComponent, -0.58, 0.58);
      const steerAlpha = 1.0 - Math.exp(-15.0 * dt);
      ai.steerAngle = (ai.steerAngle || 0) + (targetSteerAngle - (ai.steerAngle || 0)) * steerAlpha;

      // Organic chassis suspension dynamics: smooth body roll into turns and pitch under acceleration/braking
      const speedFactor = Math.min(1.0, ai.speedKmh / 240);
      const targetRoll = -ai.steerAngle * 0.14 * speedFactor;
      const rollAlpha = 1.0 - Math.exp(-10.0 * dt);
      ai.rollAngle = (ai.rollAngle || 0) + (targetRoll - (ai.rollAngle || 0)) * rollAlpha;

      const isBraking = ai.speedKmh > desiredSpeed + 6;
      const isAccelerating = ai.speedKmh < desiredSpeed - 6 && ai.speedKmh > 30;
      const targetPitch = isBraking ? 0.018 : isAccelerating ? -0.010 : 0;
      const pitchAlpha = 1.0 - Math.exp(-8.5 * dt);
      ai.pitchAngle = (ai.pitchAngle || 0) + (targetPitch - (ai.pitchAngle || 0)) * pitchAlpha;

      // Set root position & rotation using 3D Euler angles (pitch, yaw, roll)
      ai.builtCar.root.position.copy(ai.pos);
      ai.builtCar.root.rotation.set(ai.pitchAngle || 0, ai.heading, ai.rollAngle || 0, 'YXZ');

      ai.builtCar.setSteerAngle(-ai.steerAngle * 1.1);
      ai.builtCar.setWheelSpin(ai.speedKmh, dt);
    }

    // AI-to-AI separation (Fluid soft physical pushback projected onto track normal velocity - zero allocation)
    for (let i = 0; i < this.aiCars.length; i++) {
      const a = this.aiCars[i];
      if (a.finished || a.isHiddenByPracticeFilter) continue;
      for (let j = i + 1; j < this.aiCars.length; j++) {
        const b = this.aiCars[j];
        if (b.finished || b.isHiddenByPracticeFilter) continue;
        const diff = this._scratchAiSepDiff.subVectors(a.pos, b.pos);
        diff.y = 0;
        const d = diff.length();
        if (d < 3.5 && d > 0.05) {
          const push = (3.5 - d) * 0.55;
          const n = diff.normalize();

          // Project push along the track normal to smoothly deflect lateral velocity without position jumping
          const ptA = this.track.getTrackPointAtProgress(a.progress);
          const latPush = n.dot(ptA.normal);
          const pushVel = (latPush >= 0 ? 1 : -1) * push * 3.8;
          a.smoothLateralVel = (a.smoothLateralVel || 0) + pushVel * dt * 8.0;
          b.smoothLateralVel = (b.smoothLateralVel || 0) - pushVel * dt * 8.0;

          if (a.protectionShieldTimer > 0 || b.protectionShieldTimer > 0) {
            a.smoothLateralVel += pushVel * dt * 10.0;
            b.smoothLateralVel -= pushVel * dt * 10.0;
          }
        }
      }
    }
  }

  public currentPositionsMap: Map<string, number> = new Map();
  public currentGapsToLeaderMap: Map<string, number> = new Map();
  public currentIntervalsMap: Map<string, number> = new Map();
  public currentGapsToPlayerMap: Map<string, number> = new Map();
  public currentP1LeadSeconds: number = 0;

  private calculateLeaderboard() {
    interface StandingsEntry {
      id: string;
      isPlayer: boolean;
      score: number;
    }

    const entries: StandingsEntry[] = [];

    // 1. Cars that have finished are ranked strictly in the order they crossed the chequered flag!
    this.finishedDriversOrder.forEach((id, rankIdx) => {
      entries.push({
        id,
        isPlayer: id === 'player',
        score: 1000000 - rankIdx * 1000,
      });
    });

    // 2. Cars still racing are ranked by total completed laps + current track progress
    if (!this.finishedDriversOrder.includes('player')) {
      const playerLapProg = (this.playerLap - 1) + this.playerProgress;
      entries.push({ id: 'player', isPlayer: true, score: playerLapProg });
    }

    for (const ai of this.aiCars) {
      if (ai.isHiddenByPracticeFilter) continue;
      if (!this.finishedDriversOrder.includes(ai.driver.id)) {
        const aiLapProg = (ai.lap - 1) + ai.progress;
        entries.push({ id: ai.driver.id, isPlayer: false, score: aiLapProg });
      }
    }

    entries.sort((a, b) => b.score - a.score);

    // Compute realistic pace speed in m/s (average ~60 m/s = 216 km/h)
    const avgSpeedMs = Math.max(38, (Math.abs(this.playerSpeedKmh) + 215) / 7.2);

    this.currentPositionsMap.clear();
    this.currentGapsToLeaderMap.clear();
    this.currentIntervalsMap.clear();
    this.currentGapsToPlayerMap.clear();

    const p1Score = entries[0]?.score || 0;
    const p2Score = entries[1]?.score || p1Score;
    this.currentP1LeadSeconds = Math.max(0, Math.round(((p1Score - p2Score) * this.track.trackLength) / avgSpeedMs * 100) / 100);

    const playerEntry = entries.find((e) => e.isPlayer);
    const playerScore = playerEntry?.score || 0;

    entries.forEach((e, idx) => {
      const pos = idx + 1;
      this.currentPositionsMap.set(e.id, pos);

      // Accurate seconds gap to P1
      const gapToLeader = Math.max(0, Math.round(((p1Score - e.score) * this.track.trackLength) / avgSpeedMs * 100) / 100);
      this.currentGapsToLeaderMap.set(e.id, gapToLeader);

      // Accurate interval to car directly ahead
      const prevScore = entries[idx - 1]?.score ?? e.score;
      const interval = Math.max(0, Math.round(((prevScore - e.score) * this.track.trackLength) / avgSpeedMs * 100) / 100);
      this.currentIntervalsMap.set(e.id, interval);

      // Accurate seconds gap relative to player:
      // Positive = player is ahead (this car trails player by X seconds)
      // Negative = this car is ahead of player by X seconds
      const gapToPlayer = Math.round(((playerScore - e.score) * this.track.trackLength) / avgSpeedMs * 100) / 100;
      this.currentGapsToPlayerMap.set(e.id, gapToPlayer);

      // 3D In-World Broadcast Position Tag updates on cars
      if (!e.isPlayer) {
        const aiCar = this.aiCars.find((a) => a.driver.id === e.id);
        if (aiCar) {
          const isTeammate = Boolean(this.teammateDriverId && aiCar.driver.id === this.teammateDriverId);
          aiCar.builtCar.setPositionTag(pos, aiCar.driver.shortName, isTeammate, false);
        }
      }
    });

    const playerIndex = entries.findIndex((e) => e.isPlayer);
    const pPos = playerIndex !== -1 ? playerIndex + 1 : 1;
    this.telemetry.position = pPos;
    this.telemetry.p1LeadSeconds = this.currentP1LeadSeconds;
    this.telemetry.deltaToLeader = this.currentGapsToLeaderMap.get('player') || 0;

    // Leader Information for HUD
    const p1Entry = entries[0];
    if (p1Entry) {
      if (p1Entry.isPlayer) {
        this.telemetry.leaderShortName = this.playerDriver?.shortName || 'YOU';
        this.telemetry.leaderDriverName = this.playerDriver?.name || 'You';
      } else {
        const p1Ai = this.aiCars.find((a) => a.driver.id === p1Entry.id);
        this.telemetry.leaderShortName = p1Ai?.driver.shortName;
        this.telemetry.leaderDriverName = p1Ai?.driver.name;
      }
    }

    // Car Directly Ahead & Behind
    if (playerIndex > 0) {
      const carAheadEntry = entries[playerIndex - 1];
      const aheadAi = this.aiCars.find((a) => a.driver.id === carAheadEntry?.id);
      this.telemetry.carAheadShortName = aheadAi?.driver.shortName || carAheadEntry?.id?.slice(0, 3)?.toUpperCase();
      this.telemetry.carAheadGapSeconds = this.currentIntervalsMap.get('player') || 0;
    } else {
      this.telemetry.carAheadShortName = undefined;
      this.telemetry.carAheadGapSeconds = undefined;
    }

    if (playerIndex >= 0 && playerIndex < entries.length - 1) {
      const carBehindEntry = entries[playerIndex + 1];
      const behindAi = this.aiCars.find((a) => a.driver.id === carBehindEntry?.id);
      this.telemetry.carBehindShortName = behindAi?.driver.shortName || carBehindEntry?.id?.slice(0, 3)?.toUpperCase();
      this.telemetry.carBehindGapSeconds = this.currentIntervalsMap.get(carBehindEntry?.id) || 0;
    } else {
      this.telemetry.carBehindShortName = undefined;
      this.telemetry.carBehindGapSeconds = undefined;
    }

    // Top 3 Drivers Summary for Instant HUD Visibility
    this.telemetry.top3Drivers = entries.slice(0, 3).map((e, idx) => {
      if (e.isPlayer) {
        return {
          position: idx + 1,
          shortName: this.playerDriver?.shortName || 'YOU',
          teamColor: this.playerTeam?.primaryColor || '#ff8000',
          gapSeconds: this.currentGapsToLeaderMap.get('player') || 0,
        };
      }
      const aiCar = this.aiCars.find((a) => a.driver.id === e.id);
      return {
        position: idx + 1,
        shortName: aiCar?.driver.shortName || e.id.slice(0, 3).toUpperCase(),
        teamColor: aiCar?.team.primaryColor || '#ffffff',
        gapSeconds: this.currentGapsToLeaderMap.get(e.id) || 0,
      };
    });
  }

  public getFinalStandings(playerDriver: Driver): {
    driver: Driver;
    position: number;
    finished: boolean;
    bestLapTime: number;
    gapToLeaderSeconds: number;
    gapToPlayerSeconds: number;
    leadOverP2Seconds: number;
  }[] {
    interface StandingsEntry {
      id: string;
      isPlayer: boolean;
      score: number;
      bestLap: number;
    }

    const entries: StandingsEntry[] = [];

    // 1. Official finished cars in chequered flag crossing order
    this.finishedDriversOrder.forEach((id, rankIdx) => {
      const isPlayer = id === 'player' || id === playerDriver.id;
      const bestLap = isPlayer
        ? (this.lapTimeBest || 92.4)
        : (this.aiCars.find((a) => a.driver.id === id)?.bestLapTime || 93.1);
      entries.push({
        id,
        isPlayer,
        score: 1000000 - rankIdx * 1000,
        bestLap: bestLap > 500 ? 93.2 : bestLap,
      });
    });

    // 2. Cars that did not cross before race conclusion, ordered by completed distance
    if (!this.finishedDriversOrder.includes('player') && !this.finishedDriversOrder.includes(playerDriver.id)) {
      const playerLapProg = (this.playerLap - 1) + this.playerProgress;
      entries.push({
        id: playerDriver.id,
        isPlayer: true,
        score: playerLapProg,
        bestLap: this.lapTimeBest || 92.4,
      });
    }

    for (const ai of this.aiCars) {
      if (!this.finishedDriversOrder.includes(ai.driver.id)) {
        const aiLapProg = (ai.lap - 1) + ai.progress;
        entries.push({
          id: ai.driver.id,
          isPlayer: false,
          score: aiLapProg,
          bestLap: ai.bestLapTime < 500 ? ai.bestLapTime : 93.5,
        });
      }
    }

    entries.sort((a, b) => b.score - a.score);

    const avgSpeedMs = Math.max(38, (Math.abs(this.playerSpeedKmh) + 215) / 7.2);
    const finalLeaderScore = entries[0]?.score || 0;
    const finalP2Score = entries[1]?.score || finalLeaderScore;
    const finalP1Lead = Math.max(0, Math.round(((finalLeaderScore - finalP2Score) * this.track.trackLength) / avgSpeedMs * 1000) / 1000);
    const finalPlayerScore = entries.find((e) => e.isPlayer)?.score || 0;

    return entries.map((entry, idx) => {
      const driver = entry.isPlayer
        ? playerDriver
        : DRIVERS.find((d) => d.id === entry.id) || DRIVERS[0];
      const gapToLeader = Math.max(0, Math.round(((finalLeaderScore - entry.score) * this.track.trackLength) / avgSpeedMs * 1000) / 1000);
      const gapToPlayer = Math.round(((finalPlayerScore - entry.score) * this.track.trackLength) / avgSpeedMs * 1000) / 1000;

      return {
        driver,
        position: idx + 1,
        finished: idx < this.finishedDriversOrder.length,
        bestLapTime: entry.bestLap,
        gapToLeaderSeconds: gapToLeader,
        gapToPlayerSeconds: gapToPlayer,
        leadOverP2Seconds: idx === 0 ? finalP1Lead : 0,
      };
    });
  }

  private getDeltaToLeader(): number {
    return this.currentGapsToLeaderMap.get('player') || 0;
  }

  public teleportToOpenFieldZone(zone: 'drag_strip' | 'open_grass' | 'skidpad' | 'slalom' | 'brake_test') {
    if (!this.isOpenFieldMode) return;
    if (zone === 'drag_strip') {
      this.playerPos.set(-230, 0.33, 450);
      this.playerHeading = 0;
    } else if (zone === 'open_grass') {
      this.playerPos.set(600, 0.33, 250);
      this.playerHeading = 0;
    } else if (zone === 'skidpad') {
      this.playerPos.set(-95, 0.33, 0);
      this.playerHeading = 0;
    } else if (zone === 'slalom') {
      this.playerPos.set(195, 0.33, 265);
      this.playerHeading = 0;
    } else if (zone === 'brake_test') {
      this.playerPos.set(340, 0.33, 310);
      this.playerHeading = 0;
    }
    this.playerSpeedKmh = 0;
    this.playerGear = 1;
    this.ersBattery = 100;
    this.tireLife = 100;
    this.tireCorners = { fl: 100, fr: 100, rl: 100, rr: 100 };
    this.tireTempValue = 90;
    this.playerCar.setTireHealthVisuals(100, 90);
    this.playerCar.root.position.copy(this.playerPos);
    this.playerCar.root.rotation.y = this.playerHeading;
    this.track.updateInfiniteRoadOrigin?.(this.playerPos.x, this.playerPos.z);
    this.dragRunOrigin.copy(this.playerPos);
    this.dragRunActive = false;
    this.dragRunElapsedSec = 0;
    this.roll100To200Active = false;
    this.brakeTestActive = false;
  }

  public launchAtTopSpeed(targetSpeedKmh: number = 300) {
    if (!this.isOpenFieldMode) return;
    this.playerSpeedKmh = targetSpeedKmh;
    this.playerGear = 8;
    this.ersBattery = 100;
    this.drsActive = true;
    this.playerCar.setDrsActive(true);
    this.dragRunActive = false;
  }

  public toggleOpenFieldInfiniteLock() {
    this.openFieldStats.infiniteGripAndBatteryLock = !this.openFieldStats.infiniteGripAndBatteryLock;
    if (this.openFieldStats.infiniteGripAndBatteryLock) {
      this.ersBattery = 100;
      this.tireLife = 100;
      this.tireCorners = { fl: 100, fr: 100, rl: 100, rr: 100 };
      this.tireTempValue = 90;
      this.playerCar.setTireHealthVisuals(100, 90);
    }
  }

  public setOpenFieldSpecMode(mode: 'career_car' | 'stock_baseline' | 'hyper_prototype' | 'unlimited_x') {
    this.openFieldSpecMode = mode;
    this.openFieldStats.activeSpecMode = mode;
    if (mode === 'career_car') {
      this.enginePowerRating = this.baseCareerRatings.enginePowerRating;
      this.engineReliability = this.baseCareerRatings.engineReliability;
      this.accelerationScore = this.baseCareerRatings.accelerationScore;
      this.handlingScore = this.baseCareerRatings.handlingScore;
      this.downforceScore = this.baseCareerRatings.downforceScore;
      this.brakesScore = this.baseCareerRatings.brakesScore;
    } else if (mode === 'stock_baseline') {
      this.enginePowerRating = 80;
      this.engineReliability = 80;
      this.accelerationScore = 80;
      this.handlingScore = 80;
      this.downforceScore = 80;
      this.brakesScore = 80;
    } else if (mode === 'hyper_prototype') {
      this.enginePowerRating = 115;
      this.engineReliability = 100;
      this.accelerationScore = 115;
      this.handlingScore = 112;
      this.downforceScore = 115;
      this.brakesScore = 112;
    } else if (mode === 'unlimited_x') {
      this.enginePowerRating = 142;
      this.engineReliability = 100;
      this.accelerationScore = 138;
      this.handlingScore = 130;
      this.downforceScore = 132;
      this.brakesScore = 135;
    }
    this.ersBattery = 100;
    this.tireLife = 100;
    this.tireCorners = { fl: 100, fr: 100, rl: 100, rr: 100 };
  }

  public resetOpenFieldRecords() {
    this.openFieldStats.zeroTo100Sec = null;
    this.openFieldStats.bestZeroTo100Sec = null;
    this.openFieldStats.zeroTo200Sec = null;
    this.openFieldStats.bestZeroTo200Sec = null;
    this.openFieldStats.zeroTo300Sec = null;
    this.openFieldStats.bestZeroTo300Sec = null;
    this.openFieldStats.oneHundredTo200Sec = null;
    this.openFieldStats.bestOneHundredTo200Sec = null;
    this.openFieldStats.quarterMileSec = null;
    this.openFieldStats.bestQuarterMileSec = null;
    this.openFieldStats.oneKmSec = null;
    this.openFieldStats.bestOneKmSec = null;
    this.openFieldStats.brake100To0Meters = null;
    this.openFieldStats.bestBrake100To0Meters = null;
    this.openFieldStats.peakSpeedKmh = 0;
    this.openFieldStats.peakLateralG = 0;
    this.openFieldStats.totalDistanceKm = 0;
  }

  public resetPlayer() {
    if (this.isCityMode) {
      // No teleporting away in City Mode! Simply unstick the car in place on the current street.
      this.resolveBuildingCollision(this.playerPos, 2.8);
      this.playerSpeedKmh = 0;
      this.playerGear = 1;
      this.playerCar.root.position.copy(this.playerPos);
      this.playerCar.root.rotation.y = this.playerHeading;
      return;
    }
    if (this.isOpenFieldMode) {
      this.teleportToOpenFieldZone('drag_strip');
      return;
    }
    const { position, tangent } = this.track.getTrackPointAtProgress(this.playerProgress);
    this.playerPos.copy(position);
    this.playerPos.y = position.y + 0.08;
    this.playerHeading = Math.atan2(-tangent.x, -tangent.z);
    this.playerSpeedKmh = 45;
    this.playerGear = 2;
    this.playerCar.root.position.copy(this.playerPos);
    this.playerCar.root.rotation.y = this.playerHeading;
  }

  /**
   * Spawns 28 Civilian Traffic Cars across all 7 Avenues & 7 Boulevards,
   * 6 Metro Police Interceptors with roof strobe lightbars,
   * the 3D Mission Waypoint Beacon, and equips the player's Street Car.
   */
  private spawnCityTrafficAndPolice() {
    for (const c of this.cityCivilianCars) {
      this.track.group.remove(c.built.root);
    }
    for (const p of this.cityPoliceCars) {
      this.track.group.remove(p.built.root);
    }
    if (this.missionBeacon) {
      this.track.group.remove(this.missionBeacon.group);
    }
    if (this.gpsRouteRibbon) {
      this.track.group.remove(this.gpsRouteRibbon.group);
    }
    if (this.cityLandmarks) {
      this.track.group.remove(this.cityLandmarks.group);
    }
    this.cityCivilianCars = [];
    this.cityPoliceCars = [];
    this.civEvasiveOffsets.clear();
    this.civHornCooldowns.clear();

    // Load saved Street Cash, Owned Cars, Owned Houses, Unpaid Tickets, and Selected Street Car
    this.citySave = loadMetroCitySave();
    this.cityPursuitStats.streetCash = this.citySave.streetCash;
    this.cityPursuitStats.inDebt = this.citySave.streetCash < 0;
    this.cityPursuitStats.heistDebtAmount = Math.max(0, -this.citySave.streetCash);
    this.cityPursuitStats.bankRobberyBustCount = this.citySave.bankRobberyBustCount || 0;
    this.cityPursuitStats.completedMissionIds = [...(this.citySave.completedMissionIds || [])];
    this.cityPursuitStats.streetRepLevel = this.citySave.streetRepLevel;
    this.cityPursuitStats.completedMissions = this.citySave.completedMissionIds?.length || this.citySave.completedMissions || 0;
    this.cityPursuitStats.ownedCarIds = [...this.citySave.ownedCarIds];
    this.cityPursuitStats.unlockedTrimsByCar = { ...(this.citySave.unlockedTrimsByCar || {}) };
    this.cityPursuitStats.activeTrimByCar = { ...(this.citySave.activeTrimByCar || {}) };
    this.cityPursuitStats.customPaintByCar = { ...this.citySave.customPaintByCar };
    this.cityPursuitStats.ownedHouseIds = [...(this.citySave.ownedHouseIds || [])];
    this.cityPursuitStats.activeHomeId = this.citySave.activeHomeId || null;
    this.cityPursuitStats.unpaidCrashTicketsTab = this.citySave.unpaidCrashTicketsTab || 0;
    this.cityPursuitStats.totalJobsCompleted = this.citySave.totalJobsCompleted || 0;
    this.cityPursuitStats.totalHeistsCompleted = this.citySave.totalHeistsCompleted || 0;
    this.recomputePassiveRealEstateIncome();
    this.equipCityStreetCar(this.citySave.selectedCarId);

    // Initial city spawn always originates from ICM (19411 Woodfield Rd);
    // owned houses remain quick-warpable via buyOrSelectCityHouse and act as heist safehouses.

    // Create 3D glowing mission waypoint beacon, 3D GPS route ribbon & 3D Banks/Jewelry Stores/Houses Landmarks
    this.missionBeacon = buildCityMissionBeacon();
    this.track.group.add(this.missionBeacon.group);

    this.gpsRouteRibbon = buildCityGpsRouteLine();
    this.track.group.add(this.gpsRouteRibbon.group);

    this.cityLandmarks = buildCityInteractiveLandmarks();
    this.track.group.add(this.cityLandmarks.group);

    if (this.citySave.pendingMissionId) {
      const pendingId = this.citySave.pendingMissionId;
      this.citySave.pendingMissionId = null;
      saveMetroCitySave(this.citySave);
      this.startCityMission(pendingId);
    }

    const civilianModels = [
      { name: 'Toyota Camry SE', style: 'sedan' as const },
      { name: 'Honda Civic Sport', style: 'sedan' as const },
      { name: 'BMW 330i M-Sport', style: 'sedan' as const },
      { name: 'Chevrolet Tahoe LTZ', style: 'suv' as const },
      { name: 'Ford Mustang GT', style: 'coupe' as const },
      { name: 'Tesla Model 3 Performance', style: 'sedan' as const },
      { name: 'Cadillac Escalade Sport', style: 'suv' as const },
      { name: 'Nissan 370Z Nismo', style: 'coupe' as const },
      { name: 'Audi A4 Quattro S-Line', style: 'sedan' as const },
      { name: 'Subaru WRX STI', style: 'sedan' as const },
      { name: 'Dodge Challenger Scat Pack', style: 'coupe' as const },
      { name: 'Porsche Cayenne GTS', style: 'suv' as const },
    ];
    const colorSpecs = [
      { hex: 0xe2e8f0, name: 'Pearl White' },
      { hex: 0x38bdf8, name: 'Sky Blue' },
      { hex: 0xef4444, name: 'Crimson Red' },
      { hex: 0xfbbf24, name: 'Amber Gold' },
      { hex: 0x10b981, name: 'Emerald Metallic' },
      { hex: 0x94a3b8, name: 'Slate Gray' },
      { hex: 0xf97316, name: 'Sunset Orange' },
      { hex: 0x1e293b, name: 'Midnight Onyx' },
      { hex: 0x6366f1, name: 'Indigo Metallic' },
      { hex: 0xd97706, name: 'Sunset Bronze' },
    ];

    // Spawn civilian cars distributed across the statewide Google Maps Maryland road network
    let carIdx = 0;

    for (let rIdx = 0; rIdx < ALL_MARYLAND_ROADS.length; rIdx++) {
      const road = ALL_MARYLAND_ROADS[rIdx];
      const pts = road.points;
      if (pts.length < 2) continue;
      // Skip tiny residential cul-de-sac loops so neighborhood streets stay calm & realistic
      if (road.isResidential && road.id !== 'edinburgh_brenish_dr' && road.id !== 'hadley_farms_dr') continue;

      const carsOnRoad = road.isHighway ? 4 : road.region === 'gaithersburg' || road.region === 'baltimore' ? 2 : 2;
      for (let slot = 0; slot < carsOnRoad; slot++) {
        const segIdx = Math.min(pts.length - 2, Math.floor(((slot + 0.5) / carsOnRoad) * (pts.length - 1)));
        const routeDir: 1 | -1 = slot % 2 === 0 ? 1 : -1;
        const t = 0.2 + ((slot * 0.23 + rIdx * 0.11) % 0.6);
        const aPt = pts[segIdx];
        const bPt = pts[segIdx + 1];
        const dx = bPt.x - aPt.x;
        const dz = bPt.z - aPt.z;
        const len = Math.hypot(dx, dz) || 1;
        const dirX = (dx / len) * routeDir;
        const dirZ = (dz / len) * routeDir;
        const laneOff = road.dividedMedianWidth
          ? road.dividedMedianWidth * 0.5 + 3.4
          : Math.min(CITY_LANE_OFFSET, road.width * 0.24);
        const cx = aPt.x + dx * t + -dirZ * laneOff;
        const cz = aPt.z + dz * t + dirX * laneOff;
        const heading = Math.atan2(-dirX, -dirZ);

        const model = civilianModels[carIdx % civilianModels.length];
        const colorSpec = colorSpecs[carIdx % colorSpecs.length];
        const built = buildCivilianCarMesh(colorSpec.hex, model.style);
        const pos = new THREE.Vector3(cx, 0.25, cz);
        built.root.position.copy(pos);
        built.root.rotation.y = heading;
        this.track.group.add(built.root);

        let crimeType: 'none' | 'speeding' | 'red_light' | 'bank_robber' | 'wanted_felon' | 'hit_and_run' = 'none';
        let hasActiveWarrant = false;
        let warrantReason = '';
        let cruiseSpeedKmh = Math.min(110, Math.round(road.speedLimitMph * 1.60934 * (0.92 + (carIdx % 3) * 0.06)));

        if (carIdx % 7 === 2) {
          crimeType = 'speeding';
          cruiseSpeedKmh = Math.max(112, cruiseSpeedKmh + 34);
        } else if (carIdx % 17 === 4) {
          crimeType = 'red_light';
          cruiseSpeedKmh = 76;
        } else if (carIdx % 19 === 9) {
          crimeType = 'wanted_felon';
          hasActiveWarrant = true;
          warrantReason = 'Grand Theft Auto & Maryland State Felony Evasion';
          cruiseSpeedKmh = 84;
        } else if (carIdx === 14 || carIdx === 48 || carIdx === 84) {
          crimeType = 'bank_robber';
          hasActiveWarrant = true;
          warrantReason = 'Maryland Bank Armed Robbery';
          cruiseSpeedKmh = 128;
        } else if (carIdx === 22 || carIdx === 66) {
          crimeType = 'hit_and_run';
          cruiseSpeedKmh = 95;
        }

        const plateNum = 100 + ((carIdx * 137) % 899);
        const plateLetters = ['MD', 'BAL', 'GBG', 'MTG', 'USA', 'V8R', 'POL', 'SPD', 'ANN', 'BAY'][carIdx % 10];
        const licensePlate = `${plateNum}-${plateLetters}`;

        const mappedRegion: 'baltimore' | 'gaithersburg' | 'corridor' =
          road.region === 'gaithersburg'
            ? 'gaithersburg'
            : road.region === 'baltimore'
            ? 'baltimore'
            : 'corridor';

        this.cityCivilianCars.push({
          id: `civ_${carIdx}`,
          built,
          pos,
          heading,
          speedKmh: cruiseSpeedKmh,
          cruiseSpeedKmh,
          axis: Math.abs(dirZ) >= Math.abs(dirX) ? 'ns' : 'ew',
          dir: Math.abs(dirZ) >= Math.abs(dirX) ? (dirZ >= 0 ? 1 : -1) : dirX >= 0 ? 1 : -1,
          lineCoord: 0,
          laneOffset: laneOff,
          hitCooldown: 0,
          spinTimer: 0,
          hitVelX: 0,
          hitVelZ: 0,
          modelName: model.name,
          licensePlate,
          colorName: colorSpec.name,
          crimeType,
          hasActiveWarrant,
          warrantReason,
          clockedSpeedMph: 0,
          redLightRunWitnessed: false,
          isFleeingFromOtherCop: false,
          isFleeing: false,
          isStopped: false,
          leftSignalActive: false,
          rightSignalActive: false,
          hazardActive: false,
          region: mappedRegion,
          routePoints: pts,
          routeSegIdx: segIdx,
          routeSegProgress: t,
          routeDir,
        });
        carIdx++;
      }
    }

    // Spawn 10 Maryland State & County Police Interceptors patrolling across all MD regions
    const patrolRoadIds = [
      'woodfield_rd',
      'md_355',
      'i270_express',
      'johnnycake_rd',
      'baltimore_charles_st',
      'baltimore_pratt_st',
      'i95_md',
      'us50_east',
      'i70_md',
      'oc_coastal_hwy',
    ];

    for (let pIdx = 0; pIdx < patrolRoadIds.length; pIdx++) {
      const road = ALL_MARYLAND_ROADS.find((r) => r.id === patrolRoadIds[pIdx]) || ALL_MARYLAND_ROADS[pIdx % ALL_MARYLAND_ROADS.length];
      const pts = road.points;
      if (pts.length < 2) continue;

      const segIdx = Math.floor((pts.length - 1) * 0.45);
      const routeDir: 1 | -1 = pIdx % 2 === 0 ? 1 : -1;
      const t = 0.4;
      const aPt = pts[segIdx];
      const bPt = pts[segIdx + 1];
      const dx = bPt.x - aPt.x;
      const dz = bPt.z - aPt.z;
      const len = Math.hypot(dx, dz) || 1;
      const dirX = (dx / len) * routeDir;
      const dirZ = (dz / len) * routeDir;
      const laneOff = road.dividedMedianWidth
        ? road.dividedMedianWidth * 0.5 + 3.4
        : Math.min(CITY_LANE_OFFSET, road.width * 0.24);
      const cx = aPt.x + dx * t + -dirZ * laneOff;
      const cz = aPt.z + dz * t + dirX * laneOff;
      const heading = Math.atan2(-dirX, -dirZ);

      const built = buildPoliceInterceptorMesh();
      const pos = new THREE.Vector3(cx, 0.25, cz);
      built.root.position.copy(pos);
      built.root.rotation.y = heading;
      this.track.group.add(built.root);

      this.cityPoliceCars.push({
        id: `pd_${pIdx + 1}`,
        built,
        pos,
        heading,
        speedKmh: 76,
        patrolAxis: Math.abs(dirZ) >= Math.abs(dirX) ? 'ns' : 'ew',
        patrolDir: Math.abs(dirZ) >= Math.abs(dirX) ? (dirZ >= 0 ? 1 : -1) : dirX >= 0 ? 1 : -1,
        patrolLineCoord: laneOff,
        hitCooldown: 0,
        stuckTimer: 0,
        routePoints: pts,
        routeSegIdx: segIdx,
        routeSegProgress: t,
        routeDir,
      });
    }
  }

  public equipCityStreetCar(carId: string) {
    const baseSpec = CITY_STREET_CARS.find((c) => c.id === carId) || CITY_STREET_CARS[0];
    if (!this.citySave.unlockedTrimsByCar) this.citySave.unlockedTrimsByCar = {};
    if (!this.citySave.activeTrimByCar) this.citySave.activeTrimByCar = {};

    const defaultTrimId = baseSpec.trims[0]?.id || '';
    if (!this.citySave.unlockedTrimsByCar[baseSpec.id] || this.citySave.unlockedTrimsByCar[baseSpec.id].length === 0) {
      this.citySave.unlockedTrimsByCar[baseSpec.id] = defaultTrimId ? [defaultTrimId] : [];
    }
    if (!this.citySave.activeTrimByCar[baseSpec.id]) {
      this.citySave.activeTrimByCar[baseSpec.id] = defaultTrimId;
    }

    const activeTrimId = this.citySave.activeTrimByCar[baseSpec.id] || defaultTrimId;
    const effectiveSpec = getEffectiveStreetCarSpec(baseSpec, activeTrimId);

    this.citySave.selectedCarId = baseSpec.id;
    saveMetroCitySave(this.citySave);

    this.cityStreetCarTopSpeedKmh = effectiveSpec.topSpeedKmh;
    const vTop = Math.max(160, effectiveSpec.topSpeedKmh);
    this.gearMaxSpeeds = [
      0,
      Math.round(vTop * 0.26),
      Math.round(vTop * 0.44),
      Math.round(vTop * 0.60),
      Math.round(vTop * 0.76),
      Math.round(vTop * 0.88),
      Math.round(vTop * 1.00),
      Math.round(vTop * 1.06),
      Math.round(vTop * 1.12),
    ];
    this.enginePowerRating = effectiveSpec.enginePowerRating;
    this.accelerationScore = effectiveSpec.accelerationScore;
    this.handlingScore = effectiveSpec.handlingScore;
    this.brakesScore = effectiveSpec.brakesScore;
    if (baseSpec.id === 'mcmurtry_speirling') {
      this.downforceScore = 128; // 2,000kg ground-effect suction fan grip at any speed
    } else {
      this.downforceScore = Math.max(76, effectiveSpec.handlingScore);
    }

    const customHexStr = this.citySave.customPaintByCar[baseSpec.id];
    applyPlayerStreetCarVisual(this.playerCar, baseSpec, customHexStr, activeTrimId);
    soundEngine.setStreetCarEngineProfile(baseSpec.id, activeTrimId);

    this.cityPursuitStats.currentStreetCar = effectiveSpec;
    this.cityPursuitStats.ownedCarIds = [...this.citySave.ownedCarIds];
    this.cityPursuitStats.unlockedTrimsByCar = { ...this.citySave.unlockedTrimsByCar };
    this.cityPursuitStats.activeTrimByCar = { ...this.citySave.activeTrimByCar };
    this.cityPursuitStats.customPaintByCar = { ...this.citySave.customPaintByCar };
    this.cityPursuitStats.streetCash = this.citySave.streetCash;
  }

  public buyOrSelectCityStreetCar(carId: string): { success: boolean; message: string } {
    if (!this.isCityMode) return { success: false, message: 'Not in Metro City Mode' };
    const spec = CITY_STREET_CARS.find((c) => c.id === carId);
    if (!spec) return { success: false, message: 'Car not found' };

    if (this.citySave.ownedCarIds.includes(spec.id)) {
      this.equipCityStreetCar(spec.id);
      const eff = this.cityPursuitStats.currentStreetCar;
      this.cityPursuitStats.activeAlertBanner = `🚗 EQUIPPED ${eff.name.toUpperCase()} (${eff.horsepower} HP · ${eff.topSpeedKmh} KM/H)`;
      this.cityPursuitStats.activeAlertTimer = 3.5;
      return { success: true, message: `Equipped ${eff.name}` };
    }

    if (this.citySave.streetCash < spec.price) {
      const needed = spec.price - this.citySave.streetCash;
      this.cityPursuitStats.activeAlertBanner = `❌ INSUFFICIENT STREET CASH — NEED $${needed.toLocaleString()} MORE FOR ${spec.name.toUpperCase()}`;
      this.cityPursuitStats.activeAlertTimer = 3.5;
      return { success: false, message: `Need $${needed.toLocaleString()} more Street Cash` };
    }

    this.citySave.streetCash -= spec.price;
    this.citySave.ownedCarIds.push(spec.id);
    const baseTrimId = spec.trims[0]?.id;
    if (baseTrimId) {
      if (!this.citySave.unlockedTrimsByCar[spec.id]) {
        this.citySave.unlockedTrimsByCar[spec.id] = [baseTrimId];
      }
      this.citySave.activeTrimByCar[spec.id] = baseTrimId;
    }
    saveMetroCitySave(this.citySave);
    this.equipCityStreetCar(spec.id);

    soundEngine.playStartLightBeep(true);
    this.cityPursuitStats.activeAlertBanner = `🎉 PURCHASED & EQUIPPED ${spec.name.toUpperCase()}! (-$${spec.price.toLocaleString()})`;
    this.cityPursuitStats.activeAlertTimer = 4.5;
    return { success: true, message: `Purchased ${spec.name}!` };
  }

  public buyOrSelectCityCarTrim(carId: string, trimId: string): { success: boolean; message: string } {
    if (!this.isCityMode) return { success: false, message: 'Not in Metro City Mode' };
    const spec = CITY_STREET_CARS.find((c) => c.id === carId);
    if (!spec) return { success: false, message: 'Car not found' };
    const trim = spec.trims.find((t) => t.id === trimId);
    if (!trim) return { success: false, message: 'Trim level not found' };

    if (!this.citySave.unlockedTrimsByCar) this.citySave.unlockedTrimsByCar = {};
    if (!this.citySave.activeTrimByCar) this.citySave.activeTrimByCar = {};

    const isCarOwned = this.citySave.ownedCarIds.includes(spec.id);
    const unlockedTrims = this.citySave.unlockedTrimsByCar[spec.id] || (spec.trims[0] ? [spec.trims[0].id] : []);
    const isTrimUnlocked = isCarOwned && (unlockedTrims.includes(trim.id) || trim.upgradePrice === 0);

    if (isTrimUnlocked) {
      if (!unlockedTrims.includes(trim.id)) {
        unlockedTrims.push(trim.id);
        this.citySave.unlockedTrimsByCar[spec.id] = unlockedTrims;
      }
      this.citySave.activeTrimByCar[spec.id] = trim.id;
      saveMetroCitySave(this.citySave);
      this.equipCityStreetCar(spec.id);
      this.cityPursuitStats.activeAlertBanner = `🔧 EQUIPPED TRIM: ${spec.name.toUpperCase()} — ${trim.name.toUpperCase()} (${trim.horsepower} HP · ${trim.topSpeedKmh} KM/H)`;
      this.cityPursuitStats.activeAlertTimer = 3.5;
      return { success: true, message: `Equipped ${trim.name}` };
    }

    const totalCost = (isCarOwned ? 0 : spec.price) + trim.upgradePrice;
    if (this.citySave.streetCash < totalCost) {
      const needed = totalCost - this.citySave.streetCash;
      this.cityPursuitStats.activeAlertBanner = `❌ NEED $${needed.toLocaleString()} MORE FOR ${spec.name.toUpperCase()} (${trim.name.toUpperCase()})`;
      this.cityPursuitStats.activeAlertTimer = 3.5;
      return { success: false, message: `Need $${needed.toLocaleString()} more Street Cash` };
    }

    this.citySave.streetCash -= totalCost;
    if (!isCarOwned) {
      this.citySave.ownedCarIds.push(spec.id);
    }
    const baseTrimId = spec.trims[0]?.id;
    const nextUnlocked = new Set(unlockedTrims);
    if (baseTrimId) nextUnlocked.add(baseTrimId);
    nextUnlocked.add(trim.id);
    this.citySave.unlockedTrimsByCar[spec.id] = Array.from(nextUnlocked);
    this.citySave.activeTrimByCar[spec.id] = trim.id;
    saveMetroCitySave(this.citySave);
    this.equipCityStreetCar(spec.id);

    soundEngine.playStartLightBeep(true);
    this.cityPursuitStats.activeAlertBanner = `🏆 UNLOCKED & EQUIPPED ${spec.name.toUpperCase()} [${trim.name.toUpperCase()}]! (-$${totalCost.toLocaleString()})`;
    this.cityPursuitStats.activeAlertTimer = 4.5;
    return { success: true, message: `Unlocked ${trim.name}!` };
  }

  public paintCityStreetCar(colorHex: string) {
    if (!this.isCityMode) return;
    const currentId = this.cityPursuitStats.currentStreetCar.id;
    this.citySave.customPaintByCar[currentId] = colorHex;
    saveMetroCitySave(this.citySave);
    this.equipCityStreetCar(currentId);
    this.cityPursuitStats.activeAlertBanner = `🎨 CUSTOM RESPRAY APPLIED TO ${this.cityPursuitStats.currentStreetCar.name.toUpperCase()}`;
    this.cityPursuitStats.activeAlertTimer = 2.8;
  }

  public startCityMission(missionId: string) {
    if (!this.isCityMode) return;
    const template = CITY_MISSIONS_CATALOG.find((m) => m.id === missionId);
    if (!template) return;

    const completedList = this.citySave.completedMissionIds || [];
    const isLevelUnlocked =
      template.level === 1 ||
      CITY_MISSIONS_CATALOG.some((m) => m.level === template.level - 1 && completedList.includes(m.id));

    if (!isLevelUnlocked) {
      soundEngine.playCrash(0.2);
      this.cityPursuitStats.activeAlertBanner = `🔒 LEVEL ${template.level} LOCKED! Complete Level ${template.level - 1} first to unlock!`;
      this.cityPursuitStats.activeAlertTimer = 4.0;
      return;
    }

    const isReplay = completedList.includes(template.id);
    const expectedPay = isReplay
      ? template.replayCash || Math.round(template.rewardCash * 0.25)
      : template.rewardCash;

    this.activeMissionTemplate = template;
    this.activeMissionWaypointIdx = 0;
    this.activeMissionTimeLeft = template.timeLimitSec;
    this.activeMissionCrashesStart = this.cityPursuitStats.trafficCarsHit + this.cityPursuitStats.policeCarsHit;
    this.activeMissionAwaitingEscape = false;

    const firstWp = template.waypoints[0];
    if (this.missionBeacon) {
      this.missionBeacon.setWaypoint(firstWp.x, firstWp.z, template.badgeColor, true, this.raceTimer);
    }

    soundEngine.playStartLightBeep(true);
    this.cityPursuitStats.activeAlertBanner = isReplay
      ? `🏁 REPLAYING LEVEL ${template.level}: ${template.title.toUpperCase()} (REPLAY PAY: $${expectedPay.toLocaleString()})`
      : `🏁 LEVEL ${template.level} STARTED: ${template.title.toUpperCase()} (PAYOUT: $${expectedPay.toLocaleString()})`;
    this.cityPursuitStats.activeAlertTimer = 4.5;
  }

  public abandonCityMission() {
    this.activeMissionTemplate = null;
    this.activeMissionAwaitingEscape = false;
    this.cityPursuitStats.activeMission = null;
    if (this.missionBeacon) {
      this.missionBeacon.setWaypoint(0, 0, '#10b981', false, 0);
    }
    this.cityPursuitStats.activeAlertBanner = '🏳️ STREET MISSION ABANDONED';
    this.cityPursuitStats.activeAlertTimer = 2.5;
  }

  private addCityViolationAlert(bannerText: string, logItem: string, addStars: number, fineAmount: number) {
    const prevStars = this.cityPursuitStats.wantedStars;
    this.cityPursuitStats.wantedStars = Math.min(5, Math.max(1, prevStars + addStars));
    this.cityPursuitStats.pursuitState = 'PURSUIT';
    this.cityPursuitStats.escapeProgress = 0;
    this.cityPursuitStats.totalBountyFines += fineAmount;
    this.cityPursuitStats.activeAlertBanner = bannerText;
    this.cityPursuitStats.activeAlertTimer = 4.8;
    this.cityPursuitStats.recentViolations = [
      logItem,
      ...this.cityPursuitStats.recentViolations.slice(0, 4),
    ];
  }

  private resolveBuildingCollision(pos: THREE.Vector3, radius: number): { hit: boolean; normalX: number; normalZ: number } {
    const buildings = this.track.cityBuildings;
    if (!buildings) return { hit: false, normalX: 0, normalZ: 0 };

    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if (
        pos.x > b.minX - radius &&
        pos.x < b.maxX + radius &&
        pos.z > b.minZ - radius &&
        pos.z < b.maxZ + radius
      ) {
        const penLeft = pos.x - (b.minX - radius);
        const penRight = b.maxX + radius - pos.x;
        const penTop = pos.z - (b.minZ - radius);
        const penBottom = b.maxZ + radius - pos.z;
        const minPen = Math.min(penLeft, penRight, penTop, penBottom);

        if (minPen === penLeft) {
          pos.x = b.minX - radius;
          return { hit: true, normalX: -1, normalZ: 0 };
        } else if (minPen === penRight) {
          pos.x = b.maxX + radius;
          return { hit: true, normalX: 1, normalZ: 0 };
        } else if (minPen === penTop) {
          pos.z = b.minZ - radius;
          return { hit: true, normalX: 0, normalZ: -1 };
        } else {
          pos.z = b.maxZ + radius;
          return { hit: true, normalX: 0, normalZ: 1 };
        }
      }
    }
    return { hit: false, normalX: 0, normalZ: 0 };
  }

  public awardStreetSkillBonus(label: string, amount: number) {
    if (!this.isCityMode) return;
    this.citySave.streetCash += amount;
    saveMetroCitySave(this.citySave);
    this.cityPursuitStats.streetCash = this.citySave.streetCash;
    this.cityPursuitStats.lastSkillBonusPopup = {
      label,
      amount,
      timer: 2.8,
    };
  }

  public toggleTurnSignal(mode: 'left' | 'right' | 'hazards') {
    if (!this.isCityMode) return;
    if (this.cityPursuitStats.turnSignal === mode) {
      this.cityPursuitStats.turnSignal = 'off';
      this.cityPursuitStats.blinkerFlashOn = false;
    } else {
      this.cityPursuitStats.turnSignal = mode;
      this.cityPursuitStats.blinkerFlashOn = true;
      this.blinkerTickAccum = 0;
      soundEngine.playBlinkerTick(true);
    }
  }

  public honkCityHorn() {
    if (!this.isCityMode) return;
    soundEngine.playCarHorn();
    // Honking alerts civilian cars ahead to speed up and clear the lane
    for (let i = 0; i < this.cityCivilianCars.length; i++) {
      const civ = this.cityCivilianCars[i];
      const dist = Math.hypot(civ.pos.x - this.playerPos.x, civ.pos.z - this.playerPos.z);
      if (dist < 34) {
        civ.speedKmh = Math.max(civ.speedKmh, civ.cruiseSpeedKmh + 22);
        civ.distractedTimer = 0;
      }
    }
  }

  /**
   * Called when someone crashes into you (their fault) and you press [C] / click "Call Police":
   * - 65% chance the at-fault driver pulls over & pays you $2,200 insurance on the spot!
   * - 35% chance they panic and try to RUN AWAY (Hit-and-Run fugitive)! Catching/bumping them or letting PD intercept them pays $5,000!
   */
  public callCopsOnAtFaultCivilian() {
    if (!this.isCityMode) return;
    const claim = this.cityPursuitStats.civilianAtFaultClaim;
    if (!claim || !claim.active || claim.status !== 'CAN_CALL_COPS') return;

    const targetCiv = this.cityCivilianCars.find((c) => c.id === claim.civId);
    soundEngine.playStartLightBeep(true);

    // 35% chance the at-fault driver panics and tries to run away!
    const triesToRunAway = targetCiv ? Math.random() < 0.38 : false;

    if (triesToRunAway && targetCiv) {
      targetCiv.isFleeingHitAndRun = true;
      targetCiv.fleeTimer = 28.0;
      targetCiv.spinTimer = 0;
      targetCiv.speedKmh = 115;
      claim.status = 'FLEEING';
      claim.timeLeftSec = 28.0;
      claim.payoutAmount = 5000;

      this.cityPursuitStats.activeAlertBanner = `🚨 AT-FAULT DRIVER IS RUNNING AWAY! CHASE & BUMP THEM (OR LET PD INTERCEPT) FOR $5,000!`;
      this.cityPursuitStats.activeAlertTimer = 5.5;
      this.cityPursuitStats.recentViolations = [
        `911 Dispatch: At-Fault Driver (${targetCiv.id.toUpperCase()}) Fleeing Scene — $5,000 Bounty`,
        ...this.cityPursuitStats.recentViolations.slice(0, 4),
      ];
    } else {
      // Driver complies and pays you $2,200 insurance payout on the spot!
      const payout = claim.payoutAmount || 2200;
      this.citySave.streetCash += payout;
      saveMetroCitySave(this.citySave);
      this.cityPursuitStats.streetCash = this.citySave.streetCash;
      this.cityPursuitStats.civilianAtFaultClaim = null;

      this.awardStreetSkillBonus('AT-FAULT INSURANCE PAYOUT', payout);
      this.cityPursuitStats.activeAlertBanner = `👮 METRO PD CITED THE AT-FAULT DRIVER! YOU RECEIVED +$${payout.toLocaleString()} DAMAGES!`;
      this.cityPursuitStats.activeAlertTimer = 5.0;
      this.cityPursuitStats.recentViolations = [
        `PD Citation Issued to At-Fault Driver — Received +$${payout.toLocaleString()}`,
        ...this.cityPursuitStats.recentViolations.slice(0, 4),
      ];
    }
  }

  /**
   * Called when YOU crash into a civilian car (your fault) and choose not to run away
   * (either by stopping at the scene or pressing [Y] / clicking "Exchange Insurance").
   * "also once i crash dont make me pay right away"
   * By default (payNow = false), $0 is deducted right now — the $600 is added to your Unpaid Crash Ticket Tab
   * so you can pay it off later whenever you want, and the police WILL NOT chase you!
   */
  public settlePlayerAtFaultCrash(payNow: boolean = false) {
    if (!this.isCityMode) return;
    const settlement = this.cityPursuitStats.playerAtFaultSettlement;
    if (!settlement || !settlement.active) return;

    const amount = settlement.fineAmount;
    this.cityPursuitStats.playerAtFaultSettlement = null;
    soundEngine.playStartLightBeep(false);

    if (payNow && this.citySave.streetCash >= amount) {
      this.citySave.streetCash = Math.max(0, this.citySave.streetCash - amount);
      saveMetroCitySave(this.citySave);
      this.cityPursuitStats.streetCash = this.citySave.streetCash;
      this.cityPursuitStats.activeAlertBanner = `🤝 PAID $${amount.toLocaleString()} DAMAGES ON SCENE — NO POLICE CHASE!`;
      this.cityPursuitStats.activeAlertTimer = 4.2;
      this.cityPursuitStats.recentViolations = [
        `Paid Fender-Bender Damages (-$${amount.toLocaleString()}) — No Pursuit`,
        ...this.cityPursuitStats.recentViolations.slice(0, 4),
      ];
    } else {
      // Defer payment to Unpaid Crash Ticket Tab — $0 deducted right away!
      this.citySave.unpaidCrashTicketsTab = (this.citySave.unpaidCrashTicketsTab || 0) + amount;
      saveMetroCitySave(this.citySave);
      this.cityPursuitStats.unpaidCrashTicketsTab = this.citySave.unpaidCrashTicketsTab;
      this.cityPursuitStats.activeAlertBanner = `📝 INSURANCE EXCHANGED ($0 PAID NOW)! +$${amount} ADDED TO TICKET TAB — NO POLICE CHASE!`;
      this.cityPursuitStats.activeAlertTimer = 4.5;
      this.cityPursuitStats.recentViolations = [
        `Exchanged Insurance ($0 Now, +$${amount} to Ticket Tab) — No Pursuit`,
        ...this.cityPursuitStats.recentViolations.slice(0, 4),
      ];
    }
  }

  public payUnpaidCrashTicketsTab(): { success: boolean; message: string } {
    if (!this.isCityMode) return { success: false, message: 'Not in City Mode' };
    const tab = this.citySave.unpaidCrashTicketsTab || 0;
    if (tab <= 0) return { success: false, message: 'No unpaid crash tickets!' };

    if (this.citySave.streetCash <= 0) {
      this.cityPursuitStats.activeAlertBanner = `❌ NO STREET CASH AVAILABLE TO PAY TICKET TAB ($${tab.toLocaleString()})`;
      this.cityPursuitStats.activeAlertTimer = 3.2;
      return { success: false, message: 'Not enough cash' };
    }

    const paid = Math.min(this.citySave.streetCash, tab);
    this.citySave.streetCash -= paid;
    this.citySave.unpaidCrashTicketsTab = Math.max(0, tab - paid);
    saveMetroCitySave(this.citySave);
    this.cityPursuitStats.streetCash = this.citySave.streetCash;
    this.cityPursuitStats.unpaidCrashTicketsTab = this.citySave.unpaidCrashTicketsTab;

    soundEngine.playStartLightBeep(true);
    this.cityPursuitStats.activeAlertBanner = `✅ PAID $${paid.toLocaleString()} TOWARD INSURANCE TICKET TAB! (REMAINING: $${this.citySave.unpaidCrashTicketsTab.toLocaleString()})`;
    this.cityPursuitStats.activeAlertTimer = 4.0;
    return { success: true, message: `Paid $${paid.toLocaleString()}` };
  }

  public getSpeedLimitAtPosition(x: number, z: number): { limitMph: number; zoneName: string } {
    return getMarylandZoneAndSpeedAt(x, z);
  }

  public checkProbableCauseForCar(civ: CivilianCarEntity): { valid: boolean; reason: string } {
    if (civ.hasActiveWarrant) {
      return { valid: true, reason: `ACTIVE FELONY WARRANT: ${civ.warrantReason || 'Court Bench Warrant & Evading'}` };
    }
    if (civ.crimeType === 'bank_robber') {
      return { valid: true, reason: '911 DISPATCH: Armed Robbery Suspect Fleeing Metro City Bank!' };
    }
    if (civ.isFleeingHitAndRun) {
      return { valid: true, reason: 'HIT & RUN: Fleeing Scene of Traffic Collision Without Stopping!' };
    }
    const zone = this.getSpeedLimitAtPosition(civ.pos.x, civ.pos.z);
    const speedMph = civ.clockedSpeedMph || Math.round(civ.speedKmh * 0.621371);
    if (speedMph > zone.limitMph + 4) {
      return {
        valid: true,
        reason: `RADAR CLOCKED: ${Math.round(speedMph)} MPH in a ${zone.limitMph} MPH Zone (+${Math.round(speedMph - zone.limitMph)} MPH Over Speed Limit)`,
      };
    }
    if (civ.crimeType === 'speeding') {
      if (civ.isFleeingFromOtherCop) {
        return { valid: true, reason: 'RADIO APB: Suspect Actively Fleeing Metro PD Interceptor for Excessive Speed' };
      }
      return { valid: false, reason: 'NO RADAR EVIDENCE: Must clock vehicle with Radar Gun first before stop!' };
    }
    if (civ.crimeType === 'red_light') {
      if (civ.redLightRunWitnessed) {
        return { valid: true, reason: 'TRAFFIC INFRACTION WITNESSED: Driver Blew Through Red Light at Intersection' };
      }
      if (civ.isFleeingFromOtherCop) {
        return { valid: true, reason: 'RADIO APB: Suspect Actively Fleeing Metro PD for Running Red Signal' };
      }
      return { valid: false, reason: 'NO INFRACTION WITNESSED: Red light violation not personally witnessed!' };
    }
    return { valid: false, reason: 'NO REASONABLE SUSPICION OR PROBABLE CAUSE: Driver has no infractions or active warrants' };
  }

  public clockInPoliceDuty(): { success: boolean; message: string } {
    if (!this.isCityMode) return { success: false, message: 'Not in Metro City Mode' };
    const hq = MD_LANDMARKS.baltimorePoliceHQ;
    const distToPrecinct = Math.hypot(this.playerPos.x - hq.x, this.playerPos.z - hq.z);
    if (distToPrecinct > 28 && !this.cityPursuitStats.isPoliceOnDuty) {
      this.setCityGpsTarget(hq.x, hq.z, '⭐ Baltimore Police HQ (601 E Fayette St)', '#38bdf8');
      this.cityPursuitStats.activeAlertBanner = `🏢 DRIVE TO THE GLOWING BALTIMORE POLICE HQ BEACON (E FAYETTE ST) TO BECOME A POLICE OFFICER! (GPS SET)`;
      this.cityPursuitStats.activeAlertTimer = 5.0;
      return { success: false, message: 'Too far from Police Precinct Glowing Spot' };
    }

    this.cityPursuitStats.isPoliceOnDuty = true;
    this.cityPursuitStats.policeShiftEarnings = 0;
    this.cityPursuitStats.policeSirenActive = true;
    this.cityPursuitStats.authorizedChaseSuspectId = null;

    // Immediately trigger vehicle police livery decals, push bumper, and rooftop siren lightbar!
    updateVehicleLighting(
      this.playerCar.root,
      this.raceTimer,
      false,
      false,
      false,
      true,
      true
    );

    soundEngine.playStartLightBeep(true);
    this.cityPursuitStats.activeAlertBanner = `⭐ BADGE AWARDED: MCPD ${this.cityPursuitStats.policeRank.toUpperCase()}! PATROL CRUISER EQUIPPED! SIRENS & SPEED RADAR READY!`;
    this.cityPursuitStats.activeAlertTimer = 6.0;
    return { success: true, message: `Clocked in as ${this.cityPursuitStats.policeRank}` };
  }

  public clockOutPoliceDuty(): { success: boolean; message: string } {
    if (!this.isCityMode) return { success: false, message: 'Not in Metro City Mode' };
    if (!this.cityPursuitStats.isPoliceOnDuty) return { success: false, message: 'Not on duty' };

    const baseStipend = 2500;
    const payout = this.cityPursuitStats.policeShiftEarnings + baseStipend;
    this.citySave.streetCash += payout;
    saveMetroCitySave(this.citySave);
    this.cityPursuitStats.streetCash = this.citySave.streetCash;
    this.cityPursuitStats.isPoliceOnDuty = false;
    this.cityPursuitStats.policeSirenActive = false;
    this.cityPursuitStats.authorizedChaseSuspectId = null;
    this.cityPursuitStats.policeShiftEarnings = 0;

    // Immediately return car to civilian street livery
    updateVehicleLighting(
      this.playerCar.root,
      this.raceTimer,
      false,
      false,
      false,
      false,
      false
    );

    soundEngine.playStartLightBeep(true);
    this.cityPursuitStats.activeAlertBanner = `📋 MCPD SHIFT ENDED! COLLECTED +$${payout.toLocaleString()} (+$${baseStipend.toLocaleString()} BASE STIPEND + EARNINGS)!`;
    this.cityPursuitStats.activeAlertTimer = 5.5;
    return { success: true, message: `Shift ended. Payout: $${payout}` };
  }

  public togglePlayerSiren() {
    if (!this.isCityMode || !this.cityPursuitStats.isPoliceOnDuty) return;

    this.cityPursuitStats.policeSirenActive = !this.cityPursuitStats.policeSirenActive;
    soundEngine.playStartLightBeep(this.cityPursuitStats.policeSirenActive);
    if (this.cityPursuitStats.policeSirenActive) {
      this.cityPursuitStats.activeAlertBanner = `🚨 CODE 3: LIGHTBAR & SIRENS ACTIVATED! BACKUP UNITS EN ROUTE TO ASSIST!`;
    } else {
      this.cityPursuitStats.activeAlertBanner = `🚨 SIRENS CODE 1 DISENGAGED (PATROL MODE - MARKED POLICE CRUISER)`;
    }
    this.cityPursuitStats.activeAlertTimer = 3.0;
  }

  public pullOverTargetVehicle(): { success: boolean; message: string } {
    if (!this.isCityMode || !this.cityPursuitStats.isPoliceOnDuty) {
      return { success: false, message: 'Must be on police duty' };
    }
    const target = this.cityPursuitStats.radarTarget;
    if (!target) return { success: false, message: 'No target vehicle locked on radar' };

    try {
      const civ = this.cityCivilianCars.find((c) => c.id === target.civId);
      if (!civ) return { success: false, message: 'Vehicle not found' };

      const pc = this.checkProbableCauseForCar(civ);
      if (!pc.valid) {
        soundEngine.playCrash(0.25);
        this.cityPursuitStats.activeAlertBanner = `❌ UNLAWFUL STOP DENIED: No Probable Cause! (${pc.reason})`;
        this.cityPursuitStats.activeAlertTimer = 4.5;
        return { success: false, message: pc.reason };
      }

      // Lawful stop initiated!
      this.cityPursuitStats.authorizedChaseSuspectId = civ.id;
      target.status = civ.crimeType === 'none' ? 'CLEAN' : (civ.crimeType.toUpperCase() as any);
      target.probableCauseValid = true;
      target.probableCauseReason = pc.reason;

      // Megaphone Voice & Subtitle Announcement:
      // "also make it so when i press the pullover button i have to click the button and then u hear a voice from a megaphone and some subtitles that say pull over"
      try {
        soundEngine.playMegaphonePullOverVoice();
      } catch {
        // Safe audio fallback
      }
      this.cityPursuitStats.megaphoneSubtitle = {
        text: "📢 MEGAPHONE: 'DRIVER, PULL OVER TO THE SIDE OF THE ROAD IMMEDIATELY! METRO POLICE DEPARTMENT!'",
        timer: 5.5,
        speaker: 'MCPD UNIT',
      };

      // Determine if driver complies or refuses pull-over:
      // "some cars speed some cars dont and some cars pull over some cars dont"
      const willRefuse =
        civ.crimeType === 'bank_robber' ||
        civ.crimeType === 'wanted_felon' ||
        civ.isFleeingHitAndRun ||
        civ.personality === 'felon' ||
        civ.personality === 'reckless_speeder' ||
        civ.hasActiveWarrant ||
        Math.random() < 0.45; // 45% of traffic stops turn into active evading pursuits!

      if (willRefuse) {
        civ.pulloverRefused = true;
        civ.pulloverAccepted = false;
        civ.isFleeing = true;
        civ.isStopped = false;
        civ.speedKmh = 145;
        civ.hazardActive = true;
        target.isStopped = false;
        target.isFleeing = true;
        target.hasAcceptedPullOver = false;
        target.isCompliant = false;
        target.isWarrantFelon = Boolean(civ.hasActiveWarrant || civ.crimeType === 'wanted_felon' || civ.crimeType === 'bank_robber');
        if (!civ.fleeingToHouse && this.track.suburbanHouses && this.track.suburbanHouses.length > 0) {
          civ.fleeingToHouse = this.track.suburbanHouses[Math.floor(Math.random() * this.track.suburbanHouses.length)];
          target.safehouseAddress = civ.fleeingToHouse.name || 'Suburban Safehouse';
        }
        this.cityPursuitStats.policeSirenActive = true;
        soundEngine.playStartLightBeep(true);
        this.cityPursuitStats.activeAlertBanner = `🚨 SUSPECT REFUSES TO PULL OVER & IS FLEEING! PURSUIT & PIT MANEUVER AUTHORIZED ($0 LIABILITY)!`;
        this.cityPursuitStats.activeAlertTimer = 6.0;
        return { success: true, message: 'Suspect refused pull over and is fleeing!' };
      }

      // Compliant driver: signals right, pulls over to curb, hazards on
      civ.pulloverRefused = false;
      civ.pulloverAccepted = true;
      civ.isStopped = true;
      civ.isFleeing = false;
      civ.hazardActive = true;
      civ.speedKmh = 0;
      target.isStopped = true;
      target.isFleeing = false;
      target.hasAcceptedPullOver = true;
      target.isCompliant = true;
      target.isWarrantFelon = Boolean(civ.hasActiveWarrant || civ.crimeType === 'wanted_felon' || civ.crimeType === 'bank_robber');
      soundEngine.playStartLightBeep(false);
      this.cityPursuitStats.activeAlertBanner = target.isWarrantFelon
        ? `🛑 SUSPECT COMPLIED & PULLED OVER! ACTIVE FELONY WARRANT — PULL UP CLOSER & PRESS [F] TO ARREST!`
        : `🛑 DRIVER PULLED OVER SAFELY! PULL UP & PRESS [T] TO ISSUE TICKET (DO NOT RAM / PIT: -$5,000 FINE)!`;
      this.cityPursuitStats.activeAlertTimer = 5.5;
      return { success: true, message: 'Driver pulled over' };
    } catch (err: any) {
      console.error('Error during traffic stop pull-over:', err);
      return { success: false, message: 'Unable to execute stop' };
    }
  }

  /**
   * Issue a traffic ticket/citation to a compliant driver who pulled over safely
   */
  public issueCitationToTarget(): { success: boolean; message: string } {
    if (!this.isCityMode || !this.cityPursuitStats.isPoliceOnDuty) {
      return { success: false, message: 'Must be on police duty' };
    }
    const target = this.cityPursuitStats.radarTarget;
    if (!target) return { success: false, message: 'No vehicle selected' };

    const civ = this.cityCivilianCars.find((c) => c.id === target.civId);
    if (!civ) return { success: false, message: 'Vehicle not found' };

    const dist = Math.hypot(civ.pos.x - this.playerPos.x, civ.pos.z - this.playerPos.z);
    if (dist > 16) {
      this.cityPursuitStats.activeAlertBanner = `⚠️ TOO FAR AWAY (${Math.round(dist)}M)! PULL UP WITHIN 14M TO ISSUE CITATION.`;
      this.cityPursuitStats.activeAlertTimer = 3.0;
      return { success: false, message: 'Too far away' };
    }

    if (civ.isFleeing || civ.pulloverRefused) {
      this.cityPursuitStats.activeAlertBanner = `⚠️ CANNOT ISSUE TICKET: SUSPECT IS ACTIVELY FLEEING! USE PIT MANEUVER TO ARREST!`;
      this.cityPursuitStats.activeAlertTimer = 3.5;
      return { success: false, message: 'Suspect is fleeing' };
    }

    // Award citation pay
    const citationPayout =
      target.status === 'RED_LIGHT_RUNNER'
        ? 1800
        : target.clockedSpeedMph > 65
        ? 2400
        : 1400;

    this.cityPursuitStats.policeShiftEarnings += citationPayout;
    this.cityPursuitStats.totalTicketsIssued++;
    this.citySave.streetCash += citationPayout;
    saveMetroCitySave(this.citySave);
    this.cityPursuitStats.streetCash = this.citySave.streetCash;
    this.cityPursuitStats.inDebt = this.citySave.streetCash < 0;
    this.cityPursuitStats.heistDebtAmount = Math.max(0, -this.citySave.streetCash);

    // Reset vehicle to resume driving
    civ.crimeType = 'none';
    civ.hasActiveWarrant = false;
    civ.clockedSpeedMph = 0;
    civ.redLightRunWitnessed = false;
    civ.isFleeing = false;
    civ.pulloverRefused = false;
    civ.pulloverAccepted = false;
    civ.isStopped = true;
    civ.resumeDriveDelay = 2.5;
    civ.hazardActive = false;
    civ.leftSignalActive = true;

    this.cityPursuitStats.authorizedChaseSuspectId = null;
    this.cityPursuitStats.radarTarget = null;
    soundEngine.playStartLightBeep(true);
    this.cityPursuitStats.activeAlertBanner = `📝 CITATION ISSUED: Driver accepted ticket and paid +$${citationPayout.toLocaleString()} fine!`;
    this.cityPursuitStats.activeAlertTimer = 5.0;
    return { success: true, message: 'Citation issued' };
  }

  /**
   * Player compliance when caught by police:
   * "make it so if i pull over the police dont chase me or anything and make it so to accept that im pulling over i have to press the enter key"
   * "also when i pull over for an officer make it so they give me a ticket and i have to pay"
   */
  public complyWithPolicePullOver(): { success: boolean; message: string } {
    if (!this.isCityMode) return { success: false, message: 'Not in Metro City Mode' };
    const pullOver = this.cityPursuitStats.playerBeingPulledOver;
    const isWanted = this.cityPursuitStats.wantedStars > 0;
    if (!pullOver && !isWanted) {
      return { success: false, message: 'No active police pursuit or pull-over order' };
    }

    const playerSpeedKmh = Math.abs(this.playerSpeedKmh);
    if (playerSpeedKmh > 48) {
      soundEngine.playCrash(0.2);
      this.cityPursuitStats.activeAlertBanner = `⚠️ SLOW DOWN (< 45 KM/H / 28 MPH) & PULL TO THE SIDE BEFORE PRESSING [ENTER] TO PULL OVER!`;
      this.cityPursuitStats.activeAlertTimer = 4.0;
      return { success: false, message: 'Speed too high to pull over' };
    }

    // Successfully pulled over and complied!
    this.playerSpeedKmh = 0;
    this.cityPursuitStats.turnSignal = 'hazards';

    const fine = pullOver ? pullOver.fine : Math.round(350 + Math.random() * 450);
    this.citySave.streetCash -= fine; // Deduct ticket fine (can push into debt if needed)
    saveMetroCitySave(this.citySave);
    this.cityPursuitStats.streetCash = this.citySave.streetCash;
    this.cityPursuitStats.inDebt = this.citySave.streetCash < 0;
    this.cityPursuitStats.heistDebtAmount = Math.max(0, -this.citySave.streetCash);

    this.cityPursuitStats.wantedStars = 0;
    this.cityPursuitStats.pursuitState = 'CLEAR';
    this.cityPursuitStats.playerBeingPulledOver = null;
    this.cityPursuitStats.activePoliceUnitsCount = 0;

    // Disengage ALL cop sirens and set cooldowns so no police chase player
    for (const cop of this.cityPoliceCars) {
      cop.hitCooldown = 40.0;
      cop.isChasing = false;
      cop.built.setSirenActive(false, 0);
    }

    soundEngine.playStartLightBeep(true);
    this.cityPursuitStats.megaphoneSubtitle = {
      text: "📢 MCPD OFFICER: 'Driver complied and pulled over safely. Speeding citation issued. You are free to go — drive safe.'",
      timer: 6.0,
      speaker: 'MCPD UNIT',
    };
    this.cityPursuitStats.activeAlertBanner = `📝 CITATION ISSUED: Officer gave you a ticket (-$${fine}). Paid fine. Police cleared pursuit and will not chase you!`;
    this.cityPursuitStats.activeAlertTimer = 6.5;
    return { success: true, message: 'Complied with police pull-over order' };
  }

  public arrestTargetVehicle(): { success: boolean; message: string } {
    if (!this.isCityMode || !this.cityPursuitStats.isPoliceOnDuty) {
      return { success: false, message: 'Must be on police duty' };
    }
    const target = this.cityPursuitStats.radarTarget;
    if (!target) return { success: false, message: 'No vehicle selected' };

    const civ = this.cityCivilianCars.find((c) => c.id === target.civId);
    if (!civ) return { success: false, message: 'Vehicle not found' };

    const dist = Math.hypot(civ.pos.x - this.playerPos.x, civ.pos.z - this.playerPos.z);
    if (dist > 14) {
      this.cityPursuitStats.activeAlertBanner = `⚠️ TOO FAR AWAY (${Math.round(dist)}M)! PULL UP CLOSER WITHIN 12M TO ISSUE CITATION OR ARREST.`;
      this.cityPursuitStats.activeAlertTimer = 3.0;
      return { success: false, message: 'Too far away' };
    }

    if (Math.abs(this.playerSpeedKmh) > 25) {
      this.cityPursuitStats.activeAlertBanner = `⚠️ SLOW DOWN (< 25 KM/H) TO EXECUTE TRAFFIC STOP OR ARREST!`;
      this.cityPursuitStats.activeAlertTimer = 3.0;
      return { success: false, message: 'Slow down' };
    }

    const pc = this.checkProbableCauseForCar(civ);
    if (!pc.valid) {
      soundEngine.playCrash(0.25);
      this.cityPursuitStats.activeAlertBanner = `❌ UNLAWFUL ARREST DENIED: No Lawful Probable Cause! (${pc.reason})`;
      this.cityPursuitStats.activeAlertTimer = 4.5;
      return { success: false, message: pc.reason };
    }

    // Determine payout and citation type (vastly boosted police payouts)
    let payout = 1250;
    let crimeLabel = 'SPEEDING CITATION';
    let isArrest = false;

    if (civ.crimeType === 'bank_robber') {
      payout = 22500;
      crimeLabel = 'BANK ROBBERY APPREHENSION';
      isArrest = true;
    } else if (civ.crimeType === 'wanted_felon' || civ.hasActiveWarrant) {
      payout = 9500;
      crimeLabel = 'WANTED FELON ARREST';
      isArrest = true;
    } else if (civ.isFleeingHitAndRun) {
      payout = 5500;
      crimeLabel = 'HIT & RUN SUSPECT ARREST';
      isArrest = true;
    } else if (civ.crimeType === 'red_light') {
      payout = 1500;
      crimeLabel = 'RED LIGHT INFRACTION CITATION';
    } else {
      payout = 1250;
      crimeLabel = 'RADAR SPEEDING CITATION';
    }

    this.cityPursuitStats.policeShiftEarnings += payout;
    this.citySave.streetCash += payout;
    saveMetroCitySave(this.citySave);
    this.cityPursuitStats.streetCash = this.citySave.streetCash;
    this.cityPursuitStats.inDebt = this.citySave.streetCash < 0;
    this.cityPursuitStats.heistDebtAmount = Math.max(0, -this.citySave.streetCash);

    if (isArrest) {
      this.cityPursuitStats.totalArrestsMade++;
    } else {
      this.cityPursuitStats.totalTicketsIssued++;
    }

    // Rank Promotion calculation
    const totalOps = this.cityPursuitStats.totalArrestsMade * 2 + this.cityPursuitStats.totalTicketsIssued;
    if (totalOps >= 15) this.cityPursuitStats.policeRank = 'Chief';
    else if (totalOps >= 10) this.cityPursuitStats.policeRank = 'Captain';
    else if (totalOps >= 6) this.cityPursuitStats.policeRank = 'Lieutenant';
    else if (totalOps >= 3) this.cityPursuitStats.policeRank = 'Sergeant';
    else if (totalOps >= 1) this.cityPursuitStats.policeRank = 'Senior Officer';

    soundEngine.playStartLightBeep(true);
    const houseMsg = civ.hidingInHouseAddress ? ` (CAUGHT HIDING IN ${civ.hidingInHouseAddress.toUpperCase()})` : '';
    this.cityPursuitStats.activeAlertBanner = `⚖️ ${crimeLabel}${houseMsg}! +$${payout.toLocaleString()} ADDED TO SHIFT PAYCHECK!`;
    this.cityPursuitStats.activeAlertTimer = 5.5;

    // Reset suspect back to peaceful lawful civilian and schedule them to resume driving!
    civ.crimeType = 'none';
    civ.hasActiveWarrant = false;
    civ.warrantReason = '';
    civ.clockedSpeedMph = 0;
    civ.redLightRunWitnessed = false;
    civ.isFleeing = false;
    civ.pulloverRefused = false;
    civ.isStopped = true;
    civ.resumeDriveDelay = 2.8; // Brief 2.8s pause to accept paperwork, then merges and drives!
    civ.hazardActive = false;
    civ.leftSignalActive = true; // Signal left to merge smoothly into traffic
    civ.rightSignalActive = false;
    civ.hidingInHouseAddress = undefined;
    civ.fleeingToHouse = undefined;
    civ.speedKmh = 0;

    this.cityPursuitStats.authorizedChaseSuspectId = null;
    this.cityPursuitStats.radarTarget = null;

    return { success: true, message: `${crimeLabel} completed` };
  }

  private recomputePassiveRealEstateIncome() {
    let totalPerMin = 0;
    for (const id of this.citySave.ownedHouseIds || []) {
      const h = CITY_HOUSES_CATALOG.find((item) => item.id === id);
      if (h) totalPerMin += h.passiveIncomePerMin;
    }
    this.cityPursuitStats.passiveIncomePer30s = Math.round(totalPerMin / 2);
  }

  /**
   * Buy or set as Active Home any of the 5 Metro City Real Estate properties
   */
  public buyOrSelectCityHouse(houseId: string): { success: boolean; message: string } {
    if (!this.isCityMode) return { success: false, message: 'Not in Metro City Mode' };
    const spec = CITY_HOUSES_CATALOG.find((h) => h.id === houseId);
    if (!spec) return { success: false, message: 'Property not found' };

    if (this.citySave.ownedHouseIds.includes(spec.id)) {
      this.citySave.activeHomeId = spec.id;
      saveMetroCitySave(this.citySave);
      this.cityPursuitStats.activeHomeId = spec.id;
      this.recomputePassiveRealEstateIncome();

      if (this.cityPursuitStats.wantedStars === 0) {
        this.playerPos.set(spec.x, 0.33, spec.z);
        this.playerHeading = spec.spawnHeading;
        this.playerSpeedKmh = 0;
        this.cityPursuitStats.activeAlertBanner = `🏡 ARRIVED AT YOUR ${spec.name.toUpperCase()} (${spec.garageSlots}-CAR GARAGE)`;
      } else {
        this.cityPursuitStats.activeAlertBanner = `🏡 SET ${spec.name.toUpperCase()} AS ACTIVE HOME (LOSE COPS TO FAST-TRAVEL)`;
      }
      this.cityPursuitStats.activeAlertTimer = 4.0;
      return { success: true, message: `Set ${spec.name} as Active Home` };
    }

    if (this.citySave.streetCash < spec.price) {
      const needed = spec.price - this.citySave.streetCash;
      this.cityPursuitStats.activeAlertBanner = `❌ NEED $${needed.toLocaleString()} MORE TO BUY ${spec.name.toUpperCase()}`;
      this.cityPursuitStats.activeAlertTimer = 3.5;
      return { success: false, message: `Need $${needed.toLocaleString()} more` };
    }

    this.citySave.streetCash -= spec.price;
    this.citySave.ownedHouseIds.push(spec.id);
    this.citySave.activeHomeId = spec.id;
    saveMetroCitySave(this.citySave);

    this.cityPursuitStats.streetCash = this.citySave.streetCash;
    this.cityPursuitStats.ownedHouseIds = [...this.citySave.ownedHouseIds];
    this.cityPursuitStats.activeHomeId = spec.id;
    this.recomputePassiveRealEstateIncome();

    soundEngine.playStartLightBeep(true);
    this.awardStreetSkillBonus(`PURCHASED ${spec.icon} ${spec.name.toUpperCase()}`, 0);
    this.cityPursuitStats.activeAlertBanner = `🏡 PURCHASED ${spec.name.toUpperCase()}! PASSIVE RENT: +$${Math.round(spec.passiveIncomePerMin / 2).toLocaleString()} EVERY 30S!`;
    this.cityPursuitStats.activeAlertTimer = 5.0;
    return { success: true, message: `Purchased ${spec.name}!` };
  }

  /**
   * Start or switch to a Legal Street Job (Taxi Driver, Pizza Delivery, Express Courier, Burger Blitz, Paramedic)
   */
  public startCityRegularJob(jobId: string) {
    if (!this.isCityMode) return;
    const spec = CITY_REGULAR_JOBS_CATALOG.find((j) => j.id === jobId);
    if (!spec) return;

    // Cancel any active illegal street contract or GPS marker so the beacon guides your job
    this.activeMissionTemplate = null;
    this.cityPursuitStats.activeMission = null;
    this.customGpsTarget = null;

    this.activeJobSpec = spec;
    this.activeJobRouteIdx = Math.floor(Math.random() * spec.routes.length);
    this.activeJobStage = 'PICKUP';
    this.activeJobTimeLeft = spec.timeLimitSec;
    this.activeJobStreak = 0;
    this.activeJobTotalEarned = 0;
    this.activeJobCrashesStart = this.cityPursuitStats.trafficCarsHit + this.cityPursuitStats.policeCarsHit;

    const route = spec.routes[this.activeJobRouteIdx];
    this.missionBeacon?.setWaypoint(route.pickupX, route.pickupZ, spec.badgeColor, true, this.raceTimer);

    soundEngine.playStartLightBeep(true);
    this.cityPursuitStats.activeAlertBanner = `${spec.icon} CLOCKED IN: ${spec.title.toUpperCase()} — DRIVE TO ${route.pickupLabel}`;
    this.cityPursuitStats.activeAlertTimer = 4.5;
  }

  public stopCityRegularJob() {
    if (!this.activeJobSpec) return;
    const earned = this.activeJobTotalEarned;
    const role = this.activeJobSpec.roleLabel;
    this.activeJobSpec = null;
    this.cityPursuitStats.activeRegularJob = null;
    if (!this.activeMissionTemplate && !this.customGpsTarget) {
      this.missionBeacon?.setWaypoint(0, 0, '#10b981', false, 0);
    }
    this.cityPursuitStats.activeAlertBanner = `💼 CLOCKED OUT OF ${role.toUpperCase()} SHIFT (EARNED +$${earned.toLocaleString()})`;
    this.cityPursuitStats.activeAlertTimer = 3.8;
  }

  public setCityGpsTarget(x: number, z: number, label: string, colorHex: string = '#facc15') {
    if (!this.isCityMode) return;
    this.customGpsTarget = { x, z, label, colorHex };
    if (!this.activeMissionTemplate && !this.activeJobSpec) {
      this.missionBeacon?.setWaypoint(x, z, colorHex, true, this.raceTimer);
    }
    soundEngine.playStartLightBeep(false);
    this.cityPursuitStats.activeAlertBanner = `📍 GPS WAYPOINT SET: ${label.toUpperCase()}`;
    this.cityPursuitStats.activeAlertTimer = 3.5;
  }

  private computeHouseRobPayout(house: CityHouseSpec): number {
    return Math.round(Math.max(4500, Math.min(34000, house.price * 0.22)));
  }

  private resolveMinigameTargetSpec(targetId: string): CityHeistTargetSpec | undefined {
    const direct = CITY_HEIST_TARGETS_CATALOG.find((h) => h.id === targetId);
    if (direct) return direct;

    if (targetId.startsWith('house_rob_')) {
      const houseId = targetId.slice('house_rob_'.length);
      const house = CITY_HOUSES_CATALOG.find((h) => h.id === houseId);
      if (house) {
        return {
          id: targetId,
          name: house.name,
          category: 'HOUSE',
          icon: '🏠',
          x: house.x,
          z: house.z,
          streetLocation: house.streetLocation,
          payoutCash: this.computeHouseRobPayout(house),
          robDurationSec: 3.0,
          wantedStarsTriggered: 5,
          cooldownSec: 70,
          badgeColor: '#22c55e',
          description: house.description,
        };
      }
    }
    return undefined;
  }

  /**
   * Rob an unowned real-estate house directly at its driveway
   */
  public triggerHouseRobbery(houseId: string) {
    if (!this.isCityMode) return;

    if (this.cityPursuitStats.isPoliceOnDuty) {
      soundEngine.playCrash(0.25);
      this.cityPursuitStats.activeAlertBanner = `❌ SWORN OFFICER: Officers of the law protect Maryland and cannot rob residences!`;
      this.cityPursuitStats.activeAlertTimer = 4.5;
      return;
    }

    const house = CITY_HOUSES_CATALOG.find((h) => h.id === houseId);
    if (!house) return;

    if ((this.citySave.ownedHouseIds || []).includes(house.id)) {
      this.cityPursuitStats.activeAlertBanner = `🏡 YOU ALREADY OWN ${house.name.toUpperCase()} — YOU CAN'T ROB YOUR OWN HOUSE!`;
      this.cityPursuitStats.activeAlertTimer = 3.5;
      return;
    }

    const dist = Math.hypot(house.x - this.playerPos.x, house.z - this.playerPos.z);
    if (dist > 32) {
      this.setCityGpsTarget(house.x, house.z, `🏠 ${house.name}`, house.badgeColor);
      this.cityPursuitStats.activeAlertBanner = `📍 GPS SET TO ${house.name.toUpperCase()} (${Math.round(dist)}M AWAY) — DRIVE THERE TO ROB IT!`;
      this.cityPursuitStats.activeAlertTimer = 4.0;
      return;
    }

    const robTargetId = `house_rob_${house.id}`;
    const cd = this.cityPursuitStats.heistCooldowns[robTargetId] || 0;
    if (cd > 0) {
      this.cityPursuitStats.activeAlertBanner = `🔒 ${house.name.toUpperCase()} ALARM IS ON LOCKDOWN (${Math.ceil(cd)}S REMAINING)`;
      this.cityPursuitStats.activeAlertTimer = 3.5;
      return;
    }

    this.activeRobberyState = null;
    this.playerSpeedKmh = 0;
    this.isMinigamePaused = true;
    this.cityPursuitStats.activeBankMinigameTarget = {
      id: robTargetId,
      name: house.name,
      category: 'HOUSE',
      payoutCash: this.computeHouseRobPayout(house),
      streetLocation: house.streetLocation,
      icon: '🏠',
    };
    soundEngine.playStartLightBeep(true);
  }

  /**
   * Rob a nearby Bank, Jewelry Store, House, or Storefront (launches scaled top-down minigame)
   */
  public triggerRobberyAtNearestTarget(targetId?: string) {
    if (!this.isCityMode) return;

    // "once i am an officer i cannot rob any places"
    if (this.cityPursuitStats.isPoliceOnDuty) {
      soundEngine.playCrash(0.25);
      this.cityPursuitStats.activeAlertBanner = `❌ SWORN OFFICER: Officers of the law protect Metro City and cannot commit robberies or heists!`;
      this.cityPursuitStats.activeAlertTimer = 4.5;
      return;
    }

    let target: CityHeistTargetSpec | undefined;

    if (targetId) {
      target = this.resolveMinigameTargetSpec(targetId);
    } else {
      let bestDist = 45;
      for (const h of CITY_HEIST_TARGETS_CATALOG) {
        const d = Math.hypot(h.x - this.playerPos.x, h.z - this.playerPos.z);
        if (d < bestDist) {
          bestDist = d;
          target = h;
        }
      }
      if (!target) {
        let bestHouseDist = 24;
        let nearbyUnownedHouse: CityHouseSpec | null = null;
        for (const house of CITY_HOUSES_CATALOG) {
          if ((this.citySave.ownedHouseIds || []).includes(house.id)) continue;
          const d = Math.hypot(house.x - this.playerPos.x, house.z - this.playerPos.z);
          if (d < bestHouseDist) {
            bestHouseDist = d;
            nearbyUnownedHouse = house;
          }
        }
        if (nearbyUnownedHouse) {
          this.triggerHouseRobbery(nearbyUnownedHouse.id);
          return;
        }
      }
    }

    if (!target) {
      this.cityPursuitStats.activeAlertBanner = `🏦 DRIVE WITHIN 35M OF A BANK, JEWELRY EXCHANGE, HOUSE, OR STORE TO ROB IT (OR CLICK ROUTE GPS)!`;
      this.cityPursuitStats.activeAlertTimer = 3.8;
      return;
    }

    const dist = Math.hypot(target.x - this.playerPos.x, target.z - this.playerPos.z);
    if (dist > 45) {
      this.setCityGpsTarget(target.x, target.z, `${target.icon} ${target.name}`, target.badgeColor);
      this.cityPursuitStats.activeAlertBanner = `📍 GPS SET TO ${target.name.toUpperCase()} (${Math.round(dist)}M AWAY) — DRIVE THERE TO ROB IT!`;
      this.cityPursuitStats.activeAlertTimer = 4.2;
      return;
    }

    const cd = this.cityPursuitStats.heistCooldowns[target.id] || 0;
    if (cd > 0) {
      this.cityPursuitStats.activeAlertBanner = `🔒 ${target.name.toUpperCase()} VAULT IS ON LOCKDOWN (${Math.ceil(cd)}S REMAINING)`;
      this.cityPursuitStats.activeAlertTimer = 3.5;
      return;
    }

    // Launch Top-Down Retro Heist Shooter Minigame for ALL robberies (bot count scales by payout!)
    this.activeRobberyState = null;
    this.playerSpeedKmh = 0;
    this.isMinigamePaused = true;
    this.cityPursuitStats.activeBankMinigameTarget = {
      id: target.id,
      name: target.name,
      category: target.category,
      payoutCash: target.payoutCash,
      streetLocation: target.streetLocation,
      icon: target.icon,
    };
    soundEngine.playStartLightBeep(true);
    return;
  }

  public completeBankHeistMinigameWin(targetId: string) {
    this.isMinigamePaused = false;
    this.cityPursuitStats.activeBankMinigameTarget = null;
    this.bankMinigameGraceTimer = 8.0;
    const target = this.resolveMinigameTargetSpec(targetId);
    if (target) {
      this.completeActiveHeistRobbery(target);
    }
  }

  public completeBankHeistMinigameCaptured(targetId: string) {
    this.isMinigamePaused = false;
    this.cityPursuitStats.activeBankMinigameTarget = null;
    this.bankMinigameGraceTimer = 6.5;
    this.activeRobberyState = null;

    const target = this.resolveMinigameTargetSpec(targetId);
    if (target) {
      this.cityPursuitStats.heistCooldowns[target.id] = target.cooldownSec;
    }

    // Same Federal Restitution Bust Penalty as getting caught fleeing after robbing a bank!
    this.pendingHeistLoot = null;
    this.cityPursuitStats.pendingHeistLoot = null;

    const priorBusts = this.citySave.bankRobberyBustCount || 0;
    this.citySave.bankRobberyBustCount = priorBusts + 1;
    const fineTaken = 500000 + priorBusts * 250000;
    this.citySave.streetCash -= fineTaken;

    saveMetroCitySave(this.citySave);
    this.cityPursuitStats.streetCash = this.citySave.streetCash;
    this.cityPursuitStats.bankRobberyBustCount = this.citySave.bankRobberyBustCount || 0;
    this.cityPursuitStats.inDebt = this.citySave.streetCash < 0;
    this.cityPursuitStats.heistDebtAmount = Math.max(0, -this.citySave.streetCash);

    this.cityPursuitStats.pursuitState = 'BUSTED';
    this.cityPursuitStats.wantedStars = 0;
    this.cityPursuitStats.hasActiveWarrant = false;
    this.cityPursuitStats.unpaidRedLightTickets = 0;
    this.cityPursuitStats.bustProgress = 0;
    this.cityPursuitStats.escapeProgress = 0;
    this.playerSpeedKmh = 0;

    const debtStr = this.citySave.streetCash < 0
      ? ` | IN DEBT: -$${Math.abs(this.citySave.streetCash).toLocaleString()}`
      : '';
    this.cityPursuitStats.activeAlertBanner = `🤖 KNOCKED OUT & CAPTURED BY SECURITY BOTS! Treated as Caught in Heist Chase — -$${fineTaken.toLocaleString()} RESTITUTION FINE! (Bust Record: #${this.citySave.bankRobberyBustCount}${debtStr})`;
    this.cityPursuitStats.activeAlertTimer = 7.0;
    this.playerPos.set(ICM_PLAYER_SPAWN.x, ICM_PLAYER_SPAWN.y, ICM_PLAYER_SPAWN.z);
    this.playerHeading = ICM_PLAYER_SPAWN.heading;
    soundEngine.playCrash(0.5);
  }

  public abortBankHeistMinigame() {
    this.isMinigamePaused = false;
    this.cityPursuitStats.activeBankMinigameTarget = null;
    this.bankMinigameGraceTimer = 6.5;
  }

  private getPlayerSafehouseTarget(): { x: number; z: number; name: string } {
    const activeId = this.citySave.activeHomeId;
    if (activeId && this.citySave.ownedHouseIds.includes(activeId)) {
      const found = CITY_HOUSES_CATALOG.find((h) => h.id === activeId);
      if (found) return { x: found.x, z: found.z, name: found.name };
    }
    if (this.citySave.ownedHouseIds.length > 0) {
      const firstOwned = CITY_HOUSES_CATALOG.find((h) => h.id === this.citySave.ownedHouseIds[0]);
      if (firstOwned) return { x: firstOwned.x, z: firstOwned.z, name: firstOwned.name };
    }
    const starterSafehouse = CITY_HOUSES_CATALOG[0];
    return {
      x: starterSafehouse.x,
      z: starterSafehouse.z,
      name: `${starterSafehouse.name} (Safehouse)`,
    };
  }

  private completeActiveHeistRobbery(target: CityHeistTargetSpec) {
    this.activeRobberyState = null;
    this.cityPursuitStats.heistCooldowns[target.id] = target.cooldownSec;

    const home = this.getPlayerSafehouseTarget();
    const totalCarryAmount = (this.pendingHeistLoot?.amount || 0) + target.payoutCash;

    this.pendingHeistLoot = {
      amount: totalCarryAmount,
      targetName: target.name,
      icon: target.icon,
      homeX: home.x,
      homeZ: home.z,
      homeName: home.name,
    };

    // Every robbery triggers a 5-Star Police Chase and requires fleeing back to your House unseen!
    this.cityPursuitStats.wantedStars = 5;
    this.cityPursuitStats.pursuitState = 'PURSUIT';
    this.cityPursuitStats.escapeProgress = 0;
    this.cityPursuitStats.bustProgress = 0;

    soundEngine.playStartLightBeep(true);
    this.addCityViolationAlert(
      `🚨 ROBBED ${target.name.toUpperCase()} ($${totalCarryAmount.toLocaleString()} IN TRUNK)! ★5 CHASE — FLEE TO YOUR HOUSE (${home.name.toUpperCase()}) UNSEEN BY POLICE!`,
      `Armed Heist @ ${target.name} ($${target.payoutCash.toLocaleString()} Loot) — ★5 Manhunt Active`,
      5,
      target.payoutCash
    );
  }

  private updateCityModeSimulation(dt: number, playerFwd: THREE.Vector3, input?: UnifiedInput) {
    if (this.bankMinigameGraceTimer > 0) {
      this.bankMinigameGraceTimer = Math.max(0, this.bankMinigameGraceTimer - dt);
    }
    // 0. Update Turn Signal Blinker Relay & Skill Bonus Popup Timer
    if (this.cityPursuitStats.turnSignal !== 'off') {
      this.blinkerTickAccum += dt;
      if (this.blinkerTickAccum >= 0.38) {
        this.blinkerTickAccum = 0;
        this.cityPursuitStats.blinkerFlashOn = !this.cityPursuitStats.blinkerFlashOn;
        soundEngine.playBlinkerTick(this.cityPursuitStats.blinkerFlashOn);
      }
    } else {
      this.cityPursuitStats.blinkerFlashOn = false;
    }

    if (this.cityPursuitStats.lastSkillBonusPopup) {
      this.cityPursuitStats.lastSkillBonusPopup.timer -= dt;
      if (this.cityPursuitStats.lastSkillBonusPopup.timer <= 0) {
        this.cityPursuitStats.lastSkillBonusPopup = null;
      }
    }

    // 0b. Update 3D Banks, Jewelry Stores & Real Estate Landmarks + Passive Property Income
    for (const hId of Object.keys(this.cityPursuitStats.heistCooldowns)) {
      if (this.cityPursuitStats.heistCooldowns[hId] > 0) {
        this.cityPursuitStats.heistCooldowns[hId] = Math.max(0, this.cityPursuitStats.heistCooldowns[hId] - dt);
      }
    }
    this.cityLandmarks?.update(
      this.raceTimer,
      this.cityPursuitStats.heistCooldowns,
      this.citySave.ownedHouseIds || []
    );

    if (this.cityPursuitStats.passiveIncomePer30s > 0) {
      this.passiveIncomeAccumSec += dt;
      if (this.passiveIncomeAccumSec >= 30.0) {
        this.passiveIncomeAccumSec = 0;
        const rent = this.cityPursuitStats.passiveIncomePer30s;
        this.citySave.streetCash += rent;
        saveMetroCitySave(this.citySave);
        this.cityPursuitStats.streetCash = this.citySave.streetCash;
        this.awardStreetSkillBonus('🏡 REAL ESTATE PASSIVE INCOME', rent);
      }
    }

    // 0c. Check Proximity to Banks & Jewelry Stores (Robbery Trigger & Progress Bar)
    if (this.cityPursuitStats.isPoliceOnDuty) {
      this.activeRobberyState = null;
      this.cityPursuitStats.nearbyHeistPrompt = null;
    } else {
      let closestHeist: CityHeistTargetSpec | null = null;
      let closestHeistDist = 26.0;
      for (let i = 0; i < CITY_HEIST_TARGETS_CATALOG.length; i++) {
        const h = CITY_HEIST_TARGETS_CATALOG[i];
        const d = Math.hypot(h.x - this.playerPos.x, h.z - this.playerPos.z);
        if (d < closestHeistDist) {
          closestHeistDist = d;
          closestHeist = h;
        }
      }

      if (closestHeist) {
        const cd = this.cityPursuitStats.heistCooldowns[closestHeist.id] || 0;
        // Auto-rob when parked inside the 14.5m glowing ring OR if triggered via [R] / button within 24m
        const isParkedInsideVaultZone = closestHeistDist < 14.5 && Math.abs(this.playerSpeedKmh) < 18 && cd <= 0;
        if (
          isParkedInsideVaultZone &&
          this.bankMinigameGraceTimer <= 0 &&
          !this.cityPursuitStats.activeBankMinigameTarget
        ) {
          this.triggerRobberyAtNearestTarget(closestHeist.id);
        }

        if (this.activeRobberyState && this.activeRobberyState.target.id === closestHeist.id) {
          if (closestHeistDist <= 22.0 && cd <= 0) {
            this.activeRobberyState.elapsedSec += dt;
            const pct = Math.min(100, (this.activeRobberyState.elapsedSec / closestHeist.robDurationSec) * 100);
            this.cityPursuitStats.nearbyHeistPrompt = {
              targetId: closestHeist.id,
              name: closestHeist.name,
              icon: closestHeist.icon,
              category: closestHeist.category,
              payoutCash: closestHeist.payoutCash,
              wantedStarsTriggered: closestHeist.wantedStarsTriggered,
              distMeters: Math.round(closestHeistDist),
              cooldownLeftSec: 0,
              robberyProgressPct: Math.round(pct),
              isRobbingNow: true,
            };
            if (this.activeRobberyState.elapsedSec >= closestHeist.robDurationSec) {
              this.completeActiveHeistRobbery(closestHeist);
            }
          } else {
            this.activeRobberyState = null;
          }
        } else {
          this.cityPursuitStats.nearbyHeistPrompt = {
            targetId: closestHeist.id,
            name: closestHeist.name,
            icon: closestHeist.icon,
            category: closestHeist.category,
            payoutCash: closestHeist.payoutCash,
            wantedStarsTriggered: closestHeist.wantedStarsTriggered,
            distMeters: Math.round(closestHeistDist),
            cooldownLeftSec: Math.ceil(cd),
            robberyProgressPct: 0,
            isRobbingNow: false,
          };
        }
      } else {
        this.activeRobberyState = null;
        this.cityPursuitStats.nearbyHeistPrompt = null;
      }
    }

    // 0d. Check Proximity to Buyable Houses / Real Estate Properties
    let closestHouse: CityHouseSpec | null = null;
    let closestHouseDist = 24.0;
    for (let i = 0; i < CITY_HOUSES_CATALOG.length; i++) {
      const house = CITY_HOUSES_CATALOG[i];
      const d = Math.hypot(house.x - this.playerPos.x, house.z - this.playerPos.z);
      if (d < closestHouseDist) {
        closestHouseDist = d;
        closestHouse = house;
      }
    }
    if (closestHouse) {
      const robId = `house_rob_${closestHouse.id}`;
      this.cityPursuitStats.nearbyHousePrompt = {
        houseId: closestHouse.id,
        name: closestHouse.name,
        icon: closestHouse.icon,
        price: closestHouse.price,
        isOwned: (this.citySave.ownedHouseIds || []).includes(closestHouse.id),
        passiveIncomePerMin: closestHouse.passiveIncomePerMin,
        distMeters: Math.round(closestHouseDist),
        robPayoutCash: this.computeHouseRobPayout(closestHouse),
        robCooldownLeftSec: Math.ceil(this.cityPursuitStats.heistCooldowns[robId] || 0),
      };
    } else {
      this.cityPursuitStats.nearbyHousePrompt = null;
    }

    // 1. Solid Skyscraper / Building Footprint Collision Check for Player
    const bHit = this.resolveBuildingCollision(this.playerPos, 2.15);
    if (bHit.hit) {
      if (Math.abs(this.playerSpeedKmh) > 35) {
        soundEngine.playCrash(Math.min(0.85, Math.abs(this.playerSpeedKmh) / 220));
        this.playerCar.updateSparks(Math.abs(this.playerSpeedKmh), true, dt);
        this.collisionTrauma = Math.min(1.0, this.collisionTrauma + 0.35);
      }
      this.playerSpeedKmh *= 0.45;
    }

    // 2. Update 3D Traffic Signal Gantries & Nearest Intersection Telemetry
    this.track.updateCityTrafficLights?.(this.raceTimer, this.playerPos.x, this.playerPos.z);

    const nearestInfo = getNearestIntersectionInfo(this.playerPos.x, this.playerPos.z, this.raceTimer);
    const isDrivingNS = Math.abs(playerFwd.z) >= Math.abs(playerFwd.x);
    const activePlayerSignal: TrafficLightColor = isDrivingNS ? nearestInfo.state.ns : nearestInfo.state.ew;
    const activePhaseRem = isDrivingNS ? nearestInfo.state.nsRemainingSec : nearestInfo.state.ewRemainingSec;

    this.cityPursuitStats.nearestSignalColor = activePlayerSignal;
    this.cityPursuitStats.nearestSignalSecondsLeft = Number(activePhaseRem.toFixed(1));

    // Keep Gaithersburg, MD Eastern Time clock and live weather synchronized
    this.weatherRefreshTimer += dt;
    if (this.weatherRefreshTimer >= 10) {
      this.weatherRefreshTimer = 0;
      const mdTime = getGaithersburgLocalTime();
      this.currentWeather = {
        ...this.currentWeather,
        localTimeString: mdTime.localTimeString,
        localHour: mdTime.localHour,
        isDay: mdTime.isDaytime,
        sunAltitude: mdTime.sunAltitude,
      };
      if (this.weatherMode === 'live_gaithersburg') {
        void this.refreshLiveWeather();
      }
    }

    const streetLabel = getMarylandZoneAndSpeedAt(this.playerPos.x, this.playerPos.z).zoneName.toUpperCase();
    this.cityPursuitStats.nearestStreetName = streetLabel;
    this.openFieldStats.currentZone = streetLabel;

    // Check which police units currently have unobstructed Line-of-Sight (LOS) to the player
    let witnessCop: PoliceCarEntity | null = null;
    for (let i = 0; i < this.cityPoliceCars.length; i++) {
      const cop = this.cityPoliceCars[i];
      if (canCopSeePlayer(cop.pos, this.playerPos, this.track.cityBuildings, 115)) {
        witnessCop = cop;
        break;
      }
    }
    this.cityPursuitStats.copCanSeePlayer = witnessCop !== null;

    // 2b. ACTIVE APB WARRANT CHECK:
    // "also if u run a bunch of red lights then once the cops see u they will start chasing u"
    if (
      witnessCop &&
      this.cityPursuitStats.wantedStars === 0 &&
      this.cityPursuitStats.hasActiveWarrant
    ) {
      const warrantStars = this.cityPursuitStats.unpaidRedLightTickets >= 4 ? 2 : 1;
      const reason = this.cityPursuitStats.warrantReason || `${this.cityPursuitStats.unpaidRedLightTickets} Red-Light Violations`;
      this.cityPursuitStats.hasActiveWarrant = false;
      this.cityPursuitStats.unpaidRedLightTickets = 0;
      this.cityPursuitStats.warrantReason = '';
      soundEngine.playStartLightBeep(true);
      this.addCityViolationAlert(
        `🚨 OFFICER ${witnessCop.id.toUpperCase()} SPOTTED YOUR WARRANT VEHICLE (${reason.toUpperCase()})! PURSUIT ★${warrantStars}`,
        `APB Warrant Executed by ${witnessCop.id.toUpperCase()} (${reason})`,
        warrantStars,
        2500 * warrantStars
      );
    }

    this.openFieldStats.surfaceLabel =
      this.cityPursuitStats.wantedStars > 0
        ? `WANTED ★${this.cityPursuitStats.wantedStars} — ${witnessCop ? 'COP HAS VISUAL' : 'OUT OF SIGHT'}`
        : this.cityPursuitStats.hasActiveWarrant
        ? `⚠️ APB WARRANT ACTIVE (${this.cityPursuitStats.warrantReason}) — AVOID COPS!`
        : `SIGNAL: ${activePlayerSignal} (${activePhaseRem.toFixed(0)}S) · ${witnessCop ? '👁️ COP IN SIGHT' : '🕶️ NO COP IN SIGHT'}`;

    if (this.cityPursuitStats.activeAlertTimer > 0) {
      this.cityPursuitStats.activeAlertTimer = Math.max(0, this.cityPursuitStats.activeAlertTimer - dt);
    }

    // 2c. Update Player-At-Fault Pull-Over & Exchange Insurance Window:
    // "and if i crash somebody and dont run away then the cops wont chase me i will jst have to pay"
    // "also once i crash dont make me pay right away"
    if (this.cityPursuitStats.playerAtFaultSettlement?.active) {
      const settlement = this.cityPursuitStats.playerAtFaultSettlement;
      settlement.timeLeftSec = Math.max(0, settlement.timeLeftSec - dt);
      const distFromCrash = Math.hypot(
        this.playerPos.x - settlement.crashX,
        this.playerPos.z - settlement.crashZ
      );

      // If you slow down / stop near the crash (< 22 km/h within 62m), you exchange insurance ($0 paid right away!)
      if (Math.abs(this.playerSpeedKmh) < 22 && distFromCrash <= 62) {
        settlement.stoppedProgress = Math.min(100, settlement.stoppedProgress + 125 * dt);
        if (settlement.stoppedProgress >= 100) {
          this.settlePlayerAtFaultCrash(false);
        }
      } else if (distFromCrash > 65 || settlement.timeLeftSec <= 0) {
        // Player ran away from the crash scene! Trigger Hit-and-Run!
        this.cityPursuitStats.playerAtFaultSettlement = null;
        if (witnessCop || this.cityPursuitStats.wantedStars > 0) {
          const addStar = this.cityPursuitStats.wantedStars < 4 ? 1 : 0;
          const nextStars = Math.min(5, Math.max(1, this.cityPursuitStats.wantedStars + addStar));
          soundEngine.playStartLightBeep(true);
          this.addCityViolationAlert(
            `🚨 HIT-AND-RUN! YOU FLED THE CRASH SCENE — POLICE CHASE ACTIVE (★${nextStars})`,
            `Hit-and-Run Traffic Collision @ ${streetLabel} — $5,000 Fine`,
            addStar,
            5000
          );
        } else {
          // No cop saw you flee right now, but the victim reported your plates -> Active APB Warrant!
          this.cityPursuitStats.hasActiveWarrant = true;
          this.cityPursuitStats.warrantReason = 'Hit-and-Run Collision';
          this.cityPursuitStats.activeAlertBanner = `⚠️ YOU FLED THE CRASH! HIT-AND-RUN APB WARRANT ISSUED — COPS WILL CHASE ON SIGHT!`;
          this.cityPursuitStats.activeAlertTimer = 4.5;
        }
      }
    }

    // 2d. Update Civilian-At-Fault Insurance / Police Claim & Fleeing Hit-and-Run Driver
    if (this.cityPursuitStats.civilianAtFaultClaim?.active) {
      const claim = this.cityPursuitStats.civilianAtFaultClaim;
      claim.timeLeftSec = Math.max(0, claim.timeLeftSec - dt);
      const targetCiv = this.cityCivilianCars.find((c) => c.id === claim.civId);

      if (targetCiv) {
        claim.distMeters = Math.round(
          Math.hypot(targetCiv.pos.x - this.playerPos.x, targetCiv.pos.z - this.playerPos.z)
        );
      }

      if (claim.timeLeftSec <= 0 || (claim.status === 'FLEEING' && claim.distMeters > 260)) {
        if (targetCiv) {
          targetCiv.isFleeingHitAndRun = false;
          targetCiv.built.setFleeingBeacon?.(false, 0);
        }
        if (claim.status === 'FLEEING') {
          this.cityPursuitStats.activeAlertBanner = `💨 HIT-AND-RUN DRIVER GOT AWAY!`;
          this.cityPursuitStats.activeAlertTimer = 3.5;
        }
        this.cityPursuitStats.civilianAtFaultClaim = null;
      }
    }

    // 3. Turn-Aware & Witness/Camera Red-Light Enforcement:
    const inIntersectionBox =
      Math.abs(this.playerPos.x - nearestInfo.ix) < 12.0 &&
      Math.abs(this.playerPos.z - nearestInfo.iz) < 12.0;
    const currentIntKey = `${nearestInfo.ix}_${nearestInfo.iz}`;

    if (!inIntersectionBox) {
      // Check if player just completed a clean signaled turn out of an intersection!
      if (this.playerInsideIntersectionKey !== null) {
        let exitHeadingDiff = this.playerHeading - this.playerEntryHeading;
        while (exitHeadingDiff > Math.PI) exitHeadingDiff -= Math.PI * 2;
        while (exitHeadingDiff < -Math.PI) exitHeadingDiff += Math.PI * 2;
        if (Math.abs(exitHeadingDiff) > 0.55 && this.cityPursuitStats.turnSignal !== 'off') {
          this.awardStreetSkillBonus('SIGNALED TURN BONUS', 150);
          if (this.cityPursuitStats.turnSignal !== 'hazards') {
            this.cityPursuitStats.turnSignal = 'off';
            this.cityPursuitStats.blinkerFlashOn = false;
          }
        }
      }
      this.playerInsideIntersectionKey = null;
      this.playerApproachAxis = isDrivingNS ? 'ns' : 'ew';
      this.playerEntryHeading = this.playerHeading;
      this.playerEntrySignal = activePlayerSignal;
    } else {
      if (this.playerInsideIntersectionKey !== currentIntKey) {
        this.playerInsideIntersectionKey = currentIntKey;
        this.playerEntrySignal =
          this.playerApproachAxis === 'ns' ? nearestInfo.state.ns : nearestInfo.state.ew;
        this.playerEntryHeading = this.playerHeading;
      }

      let headingDiff = this.playerHeading - this.playerEntryHeading;
      while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
      while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
      const isTurningAtIntersection =
        Math.abs(headingDiff) > 0.18 ||
        (this.playerApproachAxis === 'ns' && !isDrivingNS) ||
        (this.playerApproachAxis === 'ew' && isDrivingNS);

      const nearIntersectionCenter =
        this.playerApproachAxis === 'ns'
          ? Math.abs(this.playerPos.z - nearestInfo.iz) < 4.5
          : Math.abs(this.playerPos.x - nearestInfo.ix) < 4.5;

      if (
        this.playerEntrySignal === 'RED' &&
        !isTurningAtIntersection &&
        nearIntersectionCenter &&
        this.playerSpeedKmh > 38
      ) {
        const cycleKey = `${currentIntKey}_${Math.floor(this.raceTimer / 14)}`;
        if (this.lastRedLightKey !== cycleKey) {
          this.lastRedLightKey = cycleKey;
          this.cityPursuitStats.redLightsRun++;

          if (witnessCop) {
            const addStar = this.cityPursuitStats.wantedStars < 3 ? 1 : 0;
            const newStars = Math.min(5, Math.max(1, this.cityPursuitStats.wantedStars + addStar));
            this.cityPursuitStats.unpaidRedLightTickets = 0;
            this.cityPursuitStats.hasActiveWarrant = false;
            soundEngine.playStartLightBeep(true);
            this.addCityViolationAlert(
              `🚨 PATROL UNIT ${witnessCop.id.toUpperCase()} SAW YOU RUN A RED LIGHT! (★${newStars})`,
              `Spotted Running Red Light @ ${streetLabel} — $2,500 Fine`,
              addStar,
              2500
            );
          } else {
            this.cityPursuitStats.unpaidRedLightTickets++;
            if (this.cityPursuitStats.unpaidRedLightTickets >= 2) {
              this.cityPursuitStats.hasActiveWarrant = true;
              this.cityPursuitStats.warrantReason = `${this.cityPursuitStats.unpaidRedLightTickets} Red Lights Run`;
              this.cityPursuitStats.activeAlertBanner = `📸 RAN ${this.cityPursuitStats.unpaidRedLightTickets} RED LIGHTS! APB WARRANT ISSUED — COPS WILL CHASE ONCE THEY SEE YOU!`;
              this.cityPursuitStats.activeAlertTimer = 4.2;
              this.cityPursuitStats.recentViolations = [
                `APB Warrant Issued (${this.cityPursuitStats.unpaidRedLightTickets} Red Lights Run) — Cops Chase on Sight`,
                ...this.cityPursuitStats.recentViolations.slice(0, 4),
              ];
            } else {
              this.cityPursuitStats.activeAlertBanner = `🚦 RAN RED LIGHT AT ${streetLabel} (1/2 BEFORE APB WARRANT)`;
              this.cityPursuitStats.activeAlertTimer = 3.2;
            }
          }
        }
      }
    }

    // Street Drift Skill Check
    if (Math.abs(this.playerSpeedKmh) > 72 && Math.abs(this.telemetry?.steer || 0) > 0.65) {
      this.streetDriftAccum += dt;
      if (this.streetDriftAccum >= 0.85) {
        this.streetDriftAccum = 0;
        this.awardStreetSkillBonus('STREET DRIFT SLIDE', 250);
      }
    } else {
      this.streetDriftAccum = Math.max(0, this.streetDriftAccum - dt * 2);
    }

    // 3b. Vehicle Lighting: Flashing Turn Signals, Hazard Flashers, Crimson Brake Lights & Police Strobes
    const isPlayerBraking = this.playerSpeedKmh > 4 && Boolean(input && input.brake > 0.05);
    const sigMode = this.cityPursuitStats.turnSignal;
    const playerLeftSignal = sigMode === 'left' || sigMode === 'hazards';
    const playerRightSignal = sigMode === 'right' || sigMode === 'hazards';
    const playerSirenActive = this.cityPursuitStats.isPoliceOnDuty && this.cityPursuitStats.policeSirenActive;

    updateVehicleLighting(
      this.playerCar.root,
      this.raceTimer,
      isPlayerBraking,
      playerLeftSignal,
      playerRightSignal,
      playerSirenActive,
      this.cityPursuitStats.isPoliceOnDuty
    );

    // 3c. Current Speed Limit, Zone & Police Precinct Proximity
    const currentZone = this.getSpeedLimitAtPosition(this.playerPos.x, this.playerPos.z);
    this.cityPursuitStats.currentSpeedLimitMph = currentZone.limitMph;
    this.cityPursuitStats.currentZoneName = currentZone.zoneName;

    const distToPrecinct = Math.hypot(
      this.playerPos.x - MD_LANDMARKS.baltimorePoliceHQ.x,
      this.playerPos.z - MD_LANDMARKS.baltimorePoliceHQ.z
    );
    this.cityPursuitStats.policePrecinctNear = distToPrecinct < 28;
    this.cityPursuitStats.policeStationPrompt = distToPrecinct < 28 ? { isOpen: true, distMeters: Math.round(distToPrecinct) } : null;

    // Automatic Drive-Through Glowing Beacon Activation:
    // Driving directly into the curbside beacon outside MCPD (within 12m) immediately clocks player into police duty!
    if (distToPrecinct < 12.0 && !this.cityPursuitStats.isPoliceOnDuty && this.policeDriveThroughCooldown <= 0) {
      this.clockInPoliceDuty();
      this.policeDriveThroughCooldown = 6.0;
    }
    if (this.policeDriveThroughCooldown > 0) {
      this.policeDriveThroughCooldown -= dt;
    }

    // 3d. Police Officer Radar Speed Gun Target Cone Scanning
    let bestRadarTarget: CivilianCarEntity | null = null;
    let bestRadarDist = 65.0;

    for (let rIdx = 0; rIdx < this.cityCivilianCars.length; rIdx++) {
      const civ = this.cityCivilianCars[rIdx];
      const dx = civ.pos.x - this.playerPos.x;
      const dz = civ.pos.z - this.playerPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < bestRadarDist) {
        const forwardDot = (-dx * Math.sin(this.playerHeading) + -dz * Math.cos(this.playerHeading)) / dist;
        if (forwardDot > 0.65) {
          bestRadarDist = dist;
          bestRadarTarget = civ;
        }
      }
    }

    if (bestRadarTarget) {
      const clockedMph = Math.round(bestRadarTarget.speedKmh * 0.621371);
      bestRadarTarget.clockedSpeedMph = clockedMph;
      const pc = this.checkProbableCauseForCar(bestRadarTarget);
      const targetZone = this.getSpeedLimitAtPosition(bestRadarTarget.pos.x, bestRadarTarget.pos.z);

      this.cityPursuitStats.radarTarget = {
        civId: bestRadarTarget.id,
        modelName: bestRadarTarget.modelName,
        licensePlate: bestRadarTarget.licensePlate,
        colorName: bestRadarTarget.colorName,
        clockedSpeedMph: clockedMph,
        speedLimitMph: targetZone.limitMph,
        distMeters: Math.round(bestRadarDist),
        status: bestRadarTarget.crimeType === 'none' ? 'CLEAN' : (bestRadarTarget.crimeType.toUpperCase() as any),
        probableCauseValid: pc.valid,
        probableCauseReason: pc.reason,
        isStopped: Boolean(bestRadarTarget.isStopped),
        isFleeing: Boolean(bestRadarTarget.isFleeing || bestRadarTarget.isFleeingHitAndRun),
        hidingInHouseAddress: bestRadarTarget.hidingInHouseAddress,
      };
    } else {
      this.cityPursuitStats.radarTarget = null;
    }

    // 4. Update 28 Civilian Traffic Cars (Defensive Accident-Avoidance Radar, Emergency Braking & Lateral Swerving)
    // "also make it so drivers try to avoid accidents"
    for (let i = 0; i < this.cityCivilianCars.length; i++) {
      const civ = this.cityCivilianCars[i];
      if (civ.hitCooldown > 0) civ.hitCooldown = Math.max(0, civ.hitCooldown - dt);

      const isClaimTargetWaiting =
        this.cityPursuitStats.civilianAtFaultClaim?.active &&
        this.cityPursuitStats.civilianAtFaultClaim.civId === civ.id &&
        this.cityPursuitStats.civilianAtFaultClaim.status === 'CAN_CALL_COPS';

      civ.built.setFleeingBeacon?.(Boolean(civ.isFleeingHitAndRun), this.raceTimer);

      if (civ.resumeDriveDelay && civ.resumeDriveDelay > 0) {
        civ.resumeDriveDelay = Math.max(0, civ.resumeDriveDelay - dt);
        if (civ.resumeDriveDelay === 0) {
          civ.isStopped = false;
          civ.hazardActive = false;
          civ.leftSignalActive = false;
          civ.rightSignalActive = false;
          civ.speedKmh = civ.cruiseSpeedKmh || 48;
        }
      }

      if (civ.spinTimer > 0) {
        civ.spinTimer = Math.max(0, civ.spinTimer - dt);
        civ.pos.x += civ.hitVelX * dt;
        civ.pos.z += civ.hitVelZ * dt;
        civ.hitVelX *= Math.pow(0.18, dt);
        civ.hitVelZ *= Math.pow(0.18, dt);
        civ.heading += 2.6 * dt;
        this.resolveBuildingCollision(civ.pos, 2.0);
      } else if (civ.isStopped && (!civ.resumeDriveDelay || civ.resumeDriveDelay > 0)) {
        civ.speedKmh = 0;
        civ.built.setBraking(true);
      } else if (civ.fleeingToHouse && (civ.isFleeing || civ.crimeType === 'bank_robber' || civ.crimeType === 'wanted_felon')) {
        // Criminal is fleeing towards a suburban residential house in Pine Crest Suburbs to hide!
        const houseTarget = civ.fleeingToHouse.drivewayCoord || civ.fleeingToHouse.drivewayTarget || { x: civ.pos.x, z: civ.pos.z };
        const hx = typeof houseTarget.x === 'number' ? houseTarget.x : civ.pos.x;
        const hz = typeof houseTarget.z === 'number' ? houseTarget.z : civ.pos.z;
        const dHouse = Math.hypot(hx - civ.pos.x, hz - civ.pos.z);
        if (dHouse < 8.5) {
          civ.pos.x = hx;
          civ.pos.z = hz;
          civ.speedKmh = 0;
          civ.isStopped = true;
          civ.isFleeing = false;
          civ.hazardActive = true;
          civ.hidingInHouseAddress = civ.fleeingToHouse.address || 'Suburban Residence';
          this.cityPursuitStats.activeAlertBanner = `📻 DISPATCH APB: Suspect in ${civ.colorName} ${civ.modelName} (Plate: ${civ.licensePlate}) seen running inside house at ${civ.hidingInHouseAddress}!`;
          this.cityPursuitStats.activeAlertTimer = 6.0;
        } else {
          const targetHeading = Math.atan2(-(hx - civ.pos.x), -(hz - civ.pos.z));
          civ.heading = targetHeading;
          civ.speedKmh = 120;
          const step = (civ.speedKmh / 3.6) * dt;
          civ.pos.x += -Math.sin(civ.heading) * step;
          civ.pos.z += -Math.cos(civ.heading) * step;
          this.resolveBuildingCollision(civ.pos, 2.2);
        }
      } else if (civ.routePoints && civ.routePoints.length >= 2) {
        // Polyline Road-Following AI for Real-World Angled/Curved Gaithersburg Roads
        const pts = civ.routePoints;
        let segIdx = Math.max(0, Math.min(pts.length - 2, civ.routeSegIdx ?? 0));
        let routeDir: 1 | -1 = civ.routeDir ?? 1;
        let segA = pts[segIdx];
        let segB = pts[segIdx + 1];
        let segDx = segB.x - segA.x;
        let segDz = segB.z - segA.z;
        let segLen = Math.hypot(segDx, segDz) || 1;
        let dirX = (segDx / segLen) * routeDir;
        let dirZ = (segDz / segLen) * routeDir;

        let mustStopForLight = false;
        const ignoresLights =
          civ.isFleeingHitAndRun || civ.isFleeing || civ.crimeType === 'red_light' || civ.crimeType === 'bank_robber';

        for (let g = 0; g < MARYLAND_SIGNAL_JUNCTIONS.length; g++) {
          const jct = MARYLAND_SIGNAL_JUNCTIONS[g];
          const dxJ = jct.x - civ.pos.x;
          const dzJ = jct.z - civ.pos.z;
          const fwdDist = dxJ * dirX + dzJ * dirZ;
          const latDist = Math.abs(-dxJ * dirZ + dzJ * dirX);
          if (latDist < 14.0 && fwdDist > 12.0 && fwdDist < 38.0) {
            const sigState = getIntersectionSignalState(jct.x, jct.z, this.raceTimer);
            const myLight = Math.abs(dirZ) >= Math.abs(dirX) ? sigState.ns : sigState.ew;
            if (!ignoresLights) {
              if (myLight === 'RED' || (myLight === 'YELLOW' && fwdDist > 18.0)) {
                mustStopForLight = true;
                break;
              }
            } else if (civ.crimeType === 'red_light' && fwdDist < 20.0 && myLight === 'RED') {
              const distToPlayer = Math.hypot(civ.pos.x - this.playerPos.x, civ.pos.z - this.playerPos.z);
              if (distToPlayer < 75) civ.redLightRunWitnessed = true;
            }
          }
        }

        let carAheadStopped = false;
        if (!ignoresLights) {
          for (let j = 0; j < this.cityCivilianCars.length; j++) {
            if (i === j) continue;
            const other = this.cityCivilianCars[j];
            const dxO = other.pos.x - civ.pos.x;
            const dzO = other.pos.z - civ.pos.z;
            const fwdGap = dxO * dirX + dzO * dirZ;
            const latGap = Math.abs(-dxO * dirZ + dzO * dirX);
            if (fwdGap > 0 && fwdGap < 16.0 && latGap < 3.4) {
              carAheadStopped = true;
              break;
            }
          }
        }

        let slowPassForStationaryPlayer = false;
        let targetEvasiveOffset = 0;
        const hornCd = Math.max(0, (this.civHornCooldowns.get(civ.id) || 0) - dt);
        this.civHornCooldowns.set(civ.id, hornCd);

        const predPlayerX = this.playerPos.x + playerFwd.x * (this.playerSpeedKmh / 3.6) * 0.35;
        const predPlayerZ = this.playerPos.z + playerFwd.z * (this.playerSpeedKmh / 3.6) * 0.35;

        const rightX = -dirZ;
        const rightZ = dirX;
        const segT = civ.routeSegProgress ?? 0.5;
        const laneCenterX = segA.x + segDx * segT + rightX * civ.laneOffset;
        const laneCenterZ = segA.z + segDz * segT + rightZ * civ.laneOffset;

        const dpx = this.playerPos.x - civ.pos.x;
        const dpz = this.playerPos.z - civ.pos.z;
        const forwardDistNow = dpx * dirX + dpz * dirZ;
        const lateralSignedNow = (this.playerPos.x - laneCenterX) * rightX + (this.playerPos.z - laneCenterZ) * rightZ;
        const lateralDistNow = Math.abs(lateralSignedNow);
        const lateralDistPred = Math.abs((predPlayerX - laneCenterX) * rightX + (predPlayerZ - laneCenterZ) * rightZ);
        const forwardDistPred = (predPlayerX - civ.pos.x) * dirX + (predPlayerZ - civ.pos.z) * dirZ;
        const minLatClearance = Math.min(lateralDistNow, lateralDistPred);
        const isPlayerStationary = Math.abs(this.playerSpeedKmh) < 15;

        if (isPlayerStationary) {
          if (forwardDistNow > -2.5 && forwardDistNow < 48.0 && lateralDistNow < 6.4) {
            targetEvasiveOffset = (lateralSignedNow >= 0 ? -1 : 1) * 4.6;
            slowPassForStationaryPlayer = forwardDistNow < 26.0;
            if (forwardDistNow > 8.0 && forwardDistNow < 36.0 && hornCd <= 0) {
              this.civHornCooldowns.set(civ.id, 4.2 + (i % 4) * 0.9);
              soundEngine.playCarHorn(0.9 + (i % 5) * 0.045);
            }
          }
        } else {
          const effFwd = Math.min(forwardDistNow > -1.5 ? forwardDistNow : 999, forwardDistPred > -1.5 ? forwardDistPred : 999);
          if (i % 3 === 0 && effFwd > 0 && effFwd < 18.0 && minLatClearance < 4.5) {
            targetEvasiveOffset = (lateralSignedNow >= 0 ? -1 : 1) * 2.1;
          }
        }

        const isFleeingSuspect = civ.isFleeing || civ.isFleeingHitAndRun || civ.pulloverRefused;
        if (isFleeingSuspect) {
          civ.jukeTimer = (civ.jukeTimer !== undefined ? civ.jukeTimer : 1.0 + Math.random() * 1.5) - dt;
          if (civ.jukeTimer <= 0) {
            civ.jukeTimer = 0.9 + Math.random() * 1.5;
            civ.jukeOffset = (Math.random() < 0.5 ? -1 : 1) * (3.0 + Math.random() * 2.2);
          }
          const dToPolice = Math.hypot(this.playerPos.x - civ.pos.x, this.playerPos.z - civ.pos.z);
          const weave = dToPolice < 45 ? Math.sin(this.raceTimer * 7.5) * 2.4 : 0;
          targetEvasiveOffset = (civ.jukeOffset || 0) + weave;
        }

        const prevEvasive = this.civEvasiveOffsets.get(civ.id) || 0;
        const nextEvasive =
          prevEvasive + (targetEvasiveOffset - prevEvasive) * Math.min(1, dt * (targetEvasiveOffset !== 0 ? 7.2 : 3.2));
        this.civEvasiveOffsets.set(civ.id, nextEvasive);

        const desiredCruise =
          civ.isFleeingHitAndRun || civ.isFleeing
            ? 142
            : civ.crimeType === 'speeding'
            ? 118
            : slowPassForStationaryPlayer
            ? civ.cruiseSpeedKmh * 0.68
            : civ.cruiseSpeedKmh;
        const targetSpeed = mustStopForLight || carAheadStopped ? 0 : desiredCruise;

        if (civ.speedKmh > targetSpeed) {
          civ.speedKmh = Math.max(targetSpeed, civ.speedKmh - 90 * dt);
          civ.built.setBraking(true);
        } else {
          civ.speedKmh = Math.min(targetSpeed, civ.speedKmh + (civ.isFleeingHitAndRun || civ.isFleeing ? 70 : 38) * dt);
          civ.built.setBraking(false);
        }

        const stepMeters = (civ.speedKmh / 3.6) * dt;
        let nextT = segT + (routeDir * stepMeters) / segLen;
        if (nextT > 1) {
          if (segIdx < pts.length - 2) {
            const overflow = (nextT - 1) * segLen;
            segIdx += 1;
            const nLen = Math.hypot(pts[segIdx + 1].x - pts[segIdx].x, pts[segIdx + 1].z - pts[segIdx].z) || 1;
            nextT = Math.min(1, overflow / nLen);
          } else {
            routeDir = -1;
            nextT = 1;
          }
        } else if (nextT < 0) {
          if (segIdx > 0) {
            const overflow = -nextT * segLen;
            segIdx -= 1;
            const pLen = Math.hypot(pts[segIdx + 1].x - pts[segIdx].x, pts[segIdx + 1].z - pts[segIdx].z) || 1;
            nextT = Math.max(0, 1 - overflow / pLen);
          } else {
            routeDir = 1;
            nextT = 0;
          }
        }

        civ.routeSegIdx = segIdx;
        civ.routeSegProgress = nextT;
        civ.routeDir = routeDir;

        segA = pts[segIdx];
        segB = pts[segIdx + 1];
        segDx = segB.x - segA.x;
        segDz = segB.z - segA.z;
        segLen = Math.hypot(segDx, segDz) || 1;
        dirX = (segDx / segLen) * routeDir;
        dirZ = (segDz / segLen) * routeDir;

        const targetX = segA.x + segDx * nextT + -dirZ * (civ.laneOffset + nextEvasive);
        const targetZ = segA.z + segDz * nextT + dirX * (civ.laneOffset + nextEvasive);
        civ.pos.x += (targetX - civ.pos.x) * Math.min(1, dt * 8.5);
        civ.pos.z += (targetZ - civ.pos.z) * Math.min(1, dt * 8.5);

        const desiredHeading = Math.atan2(-dirX, -dirZ);
        let hDiff = desiredHeading - civ.heading;
        while (hDiff > Math.PI) hDiff -= Math.PI * 2;
        while (hDiff < -Math.PI) hDiff += Math.PI * 2;
        civ.heading += hDiff * Math.min(1, dt * 10);
        this.resolveBuildingCollision(civ.pos, 2.2);
      } else {
        let mustStopForLight = false;
        const stopLineOffset = 16.8;

        const ignoresLights = civ.isFleeingHitAndRun || civ.isFleeing || civ.crimeType === 'red_light' || civ.crimeType === 'bank_robber';
        if (!ignoresLights) {
          for (let g = 0; g < MARYLAND_SIGNAL_JUNCTIONS.length; g++) {
            const jct = MARYLAND_SIGNAL_JUNCTIONS[g];
            const intCoord = civ.axis === 'ns' ? jct.z : jct.x;
            const crossDist = civ.axis === 'ns' ? Math.abs(civ.pos.x - jct.x) : Math.abs(civ.pos.z - jct.z);
            if (crossDist > 18.0) continue;
            const stopCoord = intCoord - civ.dir * stopLineOffset;
            const currentCoord = civ.axis === 'ns' ? civ.pos.z : civ.pos.x;
            const distToStop = (stopCoord - currentCoord) * civ.dir;

            if (distToStop > -1.5 && distToStop < 32.0) {
              const sigState = getIntersectionSignalState(jct.x, jct.z, this.raceTimer);
              const myLight = civ.axis === 'ns' ? sigState.ns : sigState.ew;
              if (myLight === 'RED' || (myLight === 'YELLOW' && distToStop > 5.0)) {
                mustStopForLight = true;
                break;
              }
            }
          }
        } else if (civ.crimeType === 'red_light') {
          for (let g = 0; g < MARYLAND_SIGNAL_JUNCTIONS.length; g++) {
            const jct = MARYLAND_SIGNAL_JUNCTIONS[g];
            const intCoord = civ.axis === 'ns' ? jct.z : jct.x;
            const crossDist = civ.axis === 'ns' ? Math.abs(civ.pos.x - jct.x) : Math.abs(civ.pos.z - jct.z);
            if (crossDist > 18.0) continue;
            const stopCoord = intCoord - civ.dir * stopLineOffset;
            const currentCoord = civ.axis === 'ns' ? civ.pos.z : civ.pos.x;
            const distToStop = (stopCoord - currentCoord) * civ.dir;
            if (distToStop > -3.0 && distToStop < 5.0) {
              const sigState = getIntersectionSignalState(jct.x, jct.z, this.raceTimer);
              const myLight = civ.axis === 'ns' ? sigState.ns : sigState.ew;
              if (myLight === 'RED') {
                const distToPlayer = Math.hypot(civ.pos.x - this.playerPos.x, civ.pos.z - this.playerPos.z);
                if (distToPlayer < 75) {
                  civ.redLightRunWitnessed = true;
                }
              }
            }
          }
        }

        let carAheadStopped = false;
        if (!ignoresLights) {
          for (let j = 0; j < this.cityCivilianCars.length; j++) {
            if (i === j) continue;
            const other = this.cityCivilianCars[j];
            if (other.axis === civ.axis && other.lineCoord === civ.lineCoord && other.dir === civ.dir) {
              const myCoord = civ.axis === 'ns' ? civ.pos.z : civ.pos.x;
              const otherCoord = other.axis === 'ns' ? other.pos.z : other.pos.x;
              const gap = (otherCoord - myCoord) * civ.dir;
              if (gap > 0 && gap < 16.0) {
                carAheadStopped = true;
                break;
              }
            }
          }
        }

        let slowPassForStationaryPlayer = false;
        let targetEvasiveOffset = 0;

        const hornCd = Math.max(0, (this.civHornCooldowns.get(civ.id) || 0) - dt);
        this.civHornCooldowns.set(civ.id, hornCd);

        const predPlayerX = this.playerPos.x + playerFwd.x * (this.playerSpeedKmh / 3.6) * 0.35;
        const predPlayerZ = this.playerPos.z + playerFwd.z * (this.playerSpeedKmh / 3.6) * 0.35;

        const baseLaneCoord =
          civ.axis === 'ns'
            ? civ.lineCoord + (civ.dir === -1 ? CITY_LANE_OFFSET : -CITY_LANE_OFFSET)
            : civ.lineCoord + (civ.dir === 1 ? CITY_LANE_OFFSET : -CITY_LANE_OFFSET);

        const forwardDistNow =
          civ.axis === 'ns'
            ? (this.playerPos.z - civ.pos.z) * civ.dir
            : (this.playerPos.x - civ.pos.x) * civ.dir;
        const forwardDistPred =
          civ.axis === 'ns'
            ? (predPlayerZ - civ.pos.z) * civ.dir
            : (predPlayerX - civ.pos.x) * civ.dir;

        const lateralSignedNow =
          civ.axis === 'ns'
            ? this.playerPos.x - baseLaneCoord
            : this.playerPos.z - baseLaneCoord;
        const lateralDistNow = Math.abs(lateralSignedNow);
        const lateralDistPred =
          civ.axis === 'ns'
            ? Math.abs(predPlayerX - baseLaneCoord)
            : Math.abs(predPlayerZ - baseLaneCoord);

        const minLatClearance = Math.min(lateralDistNow, lateralDistPred);
        const isPlayerStationary = Math.abs(this.playerSpeedKmh) < 15;

        if (isPlayerStationary) {
          if (forwardDistNow > -2.5 && forwardDistNow < 48.0 && lateralDistNow < 6.4) {
            const dodgeDir = lateralSignedNow >= 0 ? -1 : 1;
            targetEvasiveOffset = dodgeDir * 4.6;
            slowPassForStationaryPlayer = forwardDistNow < 26.0;

            if (forwardDistNow > 8.0 && forwardDistNow < 36.0 && hornCd <= 0) {
              this.civHornCooldowns.set(civ.id, 4.2 + (i % 4) * 0.9);
              soundEngine.playCarHorn(0.9 + (i % 5) * 0.045);
            }
          }
        } else {
          const effectiveForwardDist = Math.min(
            forwardDistNow > -1.5 ? forwardDistNow : 999,
            forwardDistPred > -1.5 ? forwardDistPred : 999
          );
          if (i % 3 === 0 && effectiveForwardDist > 0 && effectiveForwardDist < 18.0 && minLatClearance < 4.5) {
            const dodgeDir = lateralSignedNow >= 0 ? -1 : 1;
            targetEvasiveOffset = dodgeDir * 2.1;
          }
        }

        const isFleeingSuspect = civ.isFleeing || civ.isFleeingHitAndRun || civ.pulloverRefused;
        if (isFleeingSuspect) {
          // Suspect tactical evasion: sudden jukes into opposite lanes and high-speed zigzagging
          civ.jukeTimer = (civ.jukeTimer !== undefined ? civ.jukeTimer : (1.0 + Math.random() * 1.5)) - dt;
          if (civ.jukeTimer <= 0) {
            civ.jukeTimer = 0.9 + Math.random() * 1.5;
            const jukeSign = Math.random() < 0.5 ? -1 : 1;
            civ.jukeOffset = jukeSign * (3.0 + Math.random() * 2.4); // juke across lanes
          }
          const dToPolice = Math.hypot(this.playerPos.x - civ.pos.x, this.playerPos.z - civ.pos.z);
          // High-intensity zigzag wave when police officer is chasing closely behind (< 45m)
          const weave = dToPolice < 45 ? Math.sin(this.raceTimer * 7.5) * 2.5 : 0;
          targetEvasiveOffset = (civ.jukeOffset || 0) + weave;
        }

        const prevEvasive = this.civEvasiveOffsets.get(civ.id) || 0;
        const nextEvasive =
          prevEvasive + (targetEvasiveOffset - prevEvasive) * Math.min(1, dt * (targetEvasiveOffset !== 0 ? 7.2 : 3.2));
        this.civEvasiveOffsets.set(civ.id, nextEvasive);

        const desiredCruise = civ.isFleeingHitAndRun || civ.isFleeing
          ? 142
          : civ.crimeType === 'speeding'
          ? 118 // 73 mph in 35 zone!
          : slowPassForStationaryPlayer
          ? civ.cruiseSpeedKmh * 0.68
          : civ.cruiseSpeedKmh;
        const targetSpeed = mustStopForLight || carAheadStopped ? 0 : desiredCruise;

        if (civ.speedKmh > targetSpeed) {
          const decelRate = 90;
          civ.speedKmh = Math.max(targetSpeed, civ.speedKmh - decelRate * dt);
          civ.built.setBraking(true);
        } else {
          civ.speedKmh = Math.min(targetSpeed, civ.speedKmh + (civ.isFleeingHitAndRun || civ.isFleeing ? 70 : 38) * dt);
          civ.built.setBraking(false);
        }

        if (civ.turnCooldown && civ.turnCooldown > 0) {
          civ.turnCooldown -= dt;
        }

        // Fleeing suspect dynamic pathing: turns onto cross-streets at intersections & targets safehouse
        if ((civ.isFleeing || civ.isFleeingHitAndRun) && (!civ.turnCooldown || civ.turnCooldown <= 0)) {
          if (!civ.fleeingToHouse && this.track.suburbanHouses && this.track.suburbanHouses.length > 0) {
            civ.fleeingToHouse = this.track.suburbanHouses[(i * 3 + 1) % this.track.suburbanHouses.length];
          }

          // Check if suspect reached safehouse!
          if (civ.fleeingToHouse) {
            const dxSafe = civ.fleeingToHouse.x - civ.pos.x;
            const dzSafe = civ.fleeingToHouse.z - civ.pos.z;
            const distSafe = Math.hypot(dxSafe, dzSafe);
            if (distSafe < 18.0) {
              civ.isFleeing = false;
              civ.pulloverRefused = false;
              civ.speedKmh = 0;
              civ.isStopped = true;
              civ.escapedToSafehouse = true;
              civ.hidingInHouseAddress = civ.fleeingToHouse.name;
              const hName = civ.fleeingToHouse.name || 'Safehouse';
              this.cityPursuitStats.activeAlertBanner = `🚪 SUSPECT ESCAPED INTO SAFEHOUSE (${hName.toUpperCase()})! THE FUGITIVE GOT AWAY!`;
              this.cityPursuitStats.activeAlertTimer = 6.0;
              this.cityPursuitStats.authorizedChaseSuspectId = null;
              if (this.cityPursuitStats.radarTarget?.civId === civ.id) {
                this.cityPursuitStats.radarTarget = null;
              }
            }
          }

          // Check if near a signal junction to turn toward safehouse
          for (let g = 0; g < MARYLAND_SIGNAL_JUNCTIONS.length; g++) {
            const jct = MARYLAND_SIGNAL_JUNCTIONS[g];
            if (Math.hypot(civ.pos.x - jct.x, civ.pos.z - jct.z) < 7.0) {
              civ.axis = civ.axis === 'ns' ? 'ew' : 'ns';
              civ.lineCoord = civ.axis === 'ns' ? jct.x : jct.z;
              civ.turnCooldown = 5.0;
              if (civ.fleeingToHouse) {
                civ.dir = civ.axis === 'ns'
                  ? (civ.fleeingToHouse.z >= civ.pos.z ? 1 : -1)
                  : (civ.fleeingToHouse.x >= civ.pos.x ? 1 : -1);
              } else {
                civ.dir = Math.random() < 0.5 ? 1 : -1;
              }
              if (civ.axis === 'ns') {
                civ.pos.x = jct.x + (civ.dir === -1 ? CITY_LANE_OFFSET : -CITY_LANE_OFFSET);
                civ.heading = civ.dir === -1 ? 0 : Math.PI;
              } else {
                civ.pos.z = jct.z + (civ.dir === 1 ? CITY_LANE_OFFSET : -CITY_LANE_OFFSET);
                civ.heading = civ.dir === 1 ? -Math.PI / 2 : Math.PI / 2;
              }
              break;
            }
          }
        }

        const stepMeters = (civ.speedKmh / 3.6) * dt;
        if (civ.axis === 'ns') {
          const targetLaneX = baseLaneCoord + nextEvasive;
          civ.pos.x += (targetLaneX - civ.pos.x) * Math.min(1, dt * 6.5);
          civ.pos.z += civ.dir * stepMeters;
          const baseHeading = civ.dir === -1 ? 0 : Math.PI;
          const swerveYaw = ((targetLaneX - civ.pos.x) * -0.09) * civ.dir;
          civ.heading = baseHeading + Math.max(-0.28, Math.min(0.28, swerveYaw));
          if (civ.pos.z > 2050) civ.dir = -1;
          if (civ.pos.z < -950) civ.dir = 1;
        } else {
          const targetLaneZ = baseLaneCoord + nextEvasive;
          civ.pos.z += (targetLaneZ - civ.pos.z) * Math.min(1, dt * 6.5);
          civ.pos.x += civ.dir * stepMeters;
          const baseHeading = civ.dir === 1 ? -Math.PI / 2 : Math.PI / 2;
          const swerveYaw = ((targetLaneZ - civ.pos.z) * 0.09) * civ.dir;
          civ.heading = baseHeading + Math.max(-0.28, Math.min(0.28, swerveYaw));
          if (civ.pos.x > 2600) civ.dir = -1;
          if (civ.pos.x < -2550) civ.dir = 1;
        }
        // Suspects and traffic vehicles MUST NOT drive through buildings:
        this.resolveBuildingCollision(civ.pos, 2.2);
      }

      civ.built.setWheelSpin(civ.speedKmh, dt);
      civ.built.root.position.copy(civ.pos);
      civ.built.root.rotation.y = civ.heading;

      // Animate civilian vehicle lighting (signals, hazards, brake lights)
      civ.built.setTurnSignals?.(
        Boolean(civ.leftSignalActive || civ.hazardActive),
        Boolean(civ.rightSignalActive || civ.hazardActive),
        Boolean(civ.hazardActive),
        this.raceTimer
      );
      updateVehicleLighting(
        civ.built.root,
        this.raceTimer,
        civ.speedKmh > 0 && Boolean(civ.built.root.userData?.isBraking),
        civ.leftSignalActive || civ.hazardActive,
        civ.rightSignalActive || civ.hazardActive,
        false
      );

      // Player-to-Civilian Car Distance & Near-Miss / Collision Check
      const dx = this.playerPos.x - civ.pos.x;
      const dz = this.playerPos.z - civ.pos.z;
      const dist = Math.hypot(dx, dz);

      // Street Driving Near-Miss Overtake Bonus (+$150)
      if (dist >= 3.95 && dist < 5.35 && Math.abs(this.playerSpeedKmh) > 95) {
        const lastNearMiss = this.nearMissCooldowns.get(civ.id) || -99;
        if (this.raceTimer - lastNearMiss > 8.0) {
          this.nearMissCooldowns.set(civ.id, this.raceTimer);
          this.awardStreetSkillBonus('NEAR MISS OVERTAKE', 150);
        }
      }

      const minSep = 3.85;
      if (dist < minSep) {
        const nx = dist > 0.001 ? dx / dist : 1;
        const nz = dist > 0.001 ? dz / dist : 0;
        const overlap = minSep - dist;

        this.playerPos.x += nx * overlap * 0.55;
        this.playerPos.z += nz * overlap * 0.55;
        civ.pos.x -= nx * overlap * 0.45;
        civ.pos.z -= nz * overlap * 0.45;

        const impactSpeed = Math.max(30, Math.abs(this.playerSpeedKmh), civ.speedKmh);
        civ.hitVelX = -nx * (impactSpeed / 3.6) * 0.65;
        civ.hitVelZ = -nz * (impactSpeed / 3.6) * 0.65;
        civ.spinTimer = 1.1;
        this.playerSpeedKmh *= 0.72;
        this.collisionTrauma = Math.min(1.0, this.collisionTrauma + 0.4);
        this.playerCar.updateSparks(impactSpeed, true, dt);

        // Check if this civilian is a FLEEING HIT-AND-RUN driver whom the player just caught & bumped!
        if (
          civ.isFleeingHitAndRun &&
          this.cityPursuitStats.civilianAtFaultClaim?.civId === civ.id
        ) {
          civ.isFleeingHitAndRun = false;
          civ.built.setFleeingBeacon?.(false, 0);
          civ.speedKmh = 0;
          const bounty = 5000;
          this.citySave.streetCash += bounty;
          saveMetroCitySave(this.citySave);
          this.cityPursuitStats.streetCash = this.citySave.streetCash;
          this.cityPursuitStats.civilianAtFaultClaim = null;

          soundEngine.playStartLightBeep(true);
          this.awardStreetSkillBonus('HIT & RUN FUGITIVE CAUGHT', bounty);
          this.cityPursuitStats.activeAlertBanner = `💥 CAUGHT THE FLEEING DRIVER! FORCED TO PAY +$${bounty.toLocaleString()} DOUBLE DAMAGES!`;
          this.cityPursuitStats.activeAlertTimer = 5.5;
          continue;
        }

        if (civ.hitCooldown <= 0) {
          civ.hitCooldown = 2.4;
          soundEngine.playCrash(Math.min(0.9, impactSpeed / 180));
          this.cityPursuitStats.trafficCarsHit++;

          // DETERMINE FAULT: Was it THEIR fault or YOUR fault?
          const toCivDotPlayerFwd = (-nx) * playerFwd.x + (-nz) * playerFwd.z;
          const civFwdX = -Math.sin(civ.heading);
          const civFwdZ = -Math.cos(civ.heading);
          const civMovingTowardPlayer = civ.speedKmh > 12 && (civFwdX * nx + civFwdZ * nz) > 0.25;

          const isCivilianAtFault =
            (Math.abs(this.playerSpeedKmh) < 58 && civ.speedKmh > 18) ||
            (toCivDotPlayerFwd < 0.38 && civMovingTowardPlayer);

          // POLICE TRAFFIC STOP & TACTICAL PIT MANEUVER CHECK:
          // "and if somebody accepts to pull over i have an option to give them a ticket but if i pit munever them then i have to pay if they pull over but if they dont then i can pit menuaver them"
          const isSuspectCompliantAndStopped =
            this.cityPursuitStats.isPoliceOnDuty &&
            civ.isStopped &&
            (civ.pulloverAccepted || !civ.pulloverRefused);

          const isFleeingOrRefused =
            civ.isFleeing ||
            civ.pulloverRefused ||
            civ.crimeType === 'bank_robber' ||
            civ.crimeType === 'wanted_felon' ||
            civ.isFleeingHitAndRun;

          const isOfficerTacticalPIT =
            this.cityPursuitStats.isPoliceOnDuty &&
            isFleeingOrRefused;

          if (isSuspectCompliantAndStopped) {
            // UNLAWFUL RAMMING OF DRIVER WHO PULLED OVER COMPLIANTLY!
            // Officer is penalised -$5,000 fine for excessive force / police brutality!
            civ.hitCooldown = 2.5;
            const excessiveForceFine = 5000;
            this.cityPursuitStats.policeShiftEarnings -= excessiveForceFine;
            this.citySave.streetCash -= excessiveForceFine;
            saveMetroCitySave(this.citySave);
            this.cityPursuitStats.streetCash = this.citySave.streetCash;
            this.cityPursuitStats.inDebt = this.citySave.streetCash < 0;
            this.cityPursuitStats.heistDebtAmount = Math.max(0, -this.citySave.streetCash);

            soundEngine.playCrash(0.85);
            this.cityPursuitStats.activeAlertBanner = `❌ INTERNAL AFFAIRS PENALTY: -$${excessiveForceFine.toLocaleString()}! DRIVER PULLED OVER SAFELY — DO NOT RAM COMPLIANT VEHICLES (PRESS [T] FOR TICKET)!`;
            this.cityPursuitStats.activeAlertTimer = 6.0;
          } else if (isOfficerTacticalPIT) {
            // Lawful PIT maneuver executed on fleeing suspect! Zero accident liability, zero fine, suspect disabled/spun!
            civ.spinTimer = 1.3;
            civ.speedKmh *= 0.15;
            civ.hitVelX = -nx * 15;
            civ.hitVelZ = -nz * 15;
            civ.disableDamage = (civ.disableDamage || 0) + 45;

            const pitBounty = civ.crimeType === 'bank_robber' ? 18000 : (civ.crimeType === 'wanted_felon' ? 8500 : 4500);
            this.cityPursuitStats.policeShiftEarnings += pitBounty;
            this.citySave.streetCash += pitBounty;
            saveMetroCitySave(this.citySave);
            this.cityPursuitStats.streetCash = this.citySave.streetCash;
            this.cityPursuitStats.inDebt = this.citySave.streetCash < 0;
            this.cityPursuitStats.heistDebtAmount = Math.max(0, -this.citySave.streetCash);
            this.cityPursuitStats.totalArrestsMade++;

            // Suspect apprehended via PIT: paid bounty, hazards on, then restarts and continues driving after 3.8s!
            civ.isFleeing = false;
            civ.pulloverRefused = false;
            civ.pulloverAccepted = false;
            civ.crimeType = 'none';
            civ.hasActiveWarrant = false;
            civ.isStopped = true;
            civ.hazardActive = true;
            civ.resumeDriveDelay = 3.8;

            soundEngine.playCrash(0.85);
            soundEngine.playStartLightBeep(true);
            this.cityPursuitStats.activeAlertBanner = `🚔 TACTICAL PIT SUCCESS ($0 LIABILITY)! FLEEING SUSPECT DISABLED & PAID +$${pitBounty.toLocaleString()} TAKEDOWN BOUNTY!`;
            this.cityPursuitStats.activeAlertTimer = 5.5;
          } else if (this.cityPursuitStats.wantedStars > 0) {
            const addStar = this.cityPursuitStats.wantedStars < 4 ? 1 : 0;
            const nextStars = Math.min(5, Math.max(1, this.cityPursuitStats.wantedStars + addStar));
            this.addCityViolationAlert(
              `💥 TRAFFIC CRASH DURING PURSUIT! (★${nextStars})`,
              `Crashed Civilian Vehicle @ ${streetLabel} — $5,000 Fine`,
              addStar,
              5000
            );
          } else if (isCivilianAtFault) {
            // CASE A: SOMEONE CRASHED INTO YOU & IT'S THEIR FAULT!
            civ.speedKmh = 0;
            civ.spinTimer = 0.4;
            this.cityPursuitStats.civilianAtFaultClaim = {
              active: true,
              civId: civ.id,
              status: 'CAN_CALL_COPS',
              timeLeftSec: 15.0,
              payoutAmount: 2200,
              distMeters: Math.round(dist),
            };
            this.cityPursuitStats.activeAlertBanner = `💥 DRIVER CRASHED INTO YOU (THEIR FAULT)! PRESS [C] TO CALL COPS FOR $2,200!`;
            this.cityPursuitStats.activeAlertTimer = 5.5;
          } else {
            // CASE B: YOU CRASHED INTO SOMEBODY (YOUR FAULT)!
            // "also once i crash dont make me pay right away"
            if (!this.cityPursuitStats.playerAtFaultSettlement?.active) {
              this.cityPursuitStats.playerAtFaultSettlement = {
                active: true,
                fineAmount: 600,
                timeLeftSec: 9.0,
                crashX: this.playerPos.x,
                crashZ: this.playerPos.z,
                stoppedProgress: 0,
              };
            }
            this.cityPursuitStats.activeAlertBanner = `💥 YOUR FAULT CRASH! STOP CAR OR PRESS [Y] TO EXCHANGE INSURANCE ($0 PAID NOW — PAY LATER)!`;
            this.cityPursuitStats.activeAlertTimer = 5.0;
          }
        }
      }
    }

    // 5. Update 6 Metro Police Interceptors (Balanced Realistic Speeds: 131–183 km/h, Zero Teleporting Ahead!)
    const wanted = this.cityPursuitStats.wantedStars;
    const activePursuitQuota = wanted > 0 ? Math.min(this.cityPoliceCars.length, 1 + wanted) : 0;
    this.cityPursuitStats.activePoliceUnitsCount = activePursuitQuota;

    // Check if player is a Police Officer actively chasing an authorized suspect with sirens on:
    // "and if my sirens are on then other police officers will either help me but they definetly wont arrest me"
    const authorizedSuspect =
      this.cityPursuitStats.isPoliceOnDuty &&
      this.cityPursuitStats.policeSirenActive &&
      this.cityPursuitStats.authorizedChaseSuspectId
        ? this.cityCivilianCars.find((c) => c.id === this.cityPursuitStats.authorizedChaseSuspectId)
        : undefined;

    // Check if there is an active Fleeing Hit-and-Run Civilian that police should also intercept
    const fleeingCiv =
      this.cityPursuitStats.civilianAtFaultClaim?.status === 'FLEEING'
        ? this.cityCivilianCars.find((c) => c.id === this.cityPursuitStats.civilianAtFaultClaim?.civId)
        : undefined;

    // Advance Radar Detector Warning for Civilian Player:
    // "and if ur not an officer before the police catches u with the radar it gives u a warning police radar coming up or speeding near police so u have time to slow down"
    if (!this.cityPursuitStats.isPoliceOnDuty && this.cityPursuitStats.wantedStars === 0 && !this.cityPursuitStats.playerBeingPulledOver) {
      const playerMph = Math.abs(this.playerSpeedKmh) * 0.621371;
      const zoneLimit = this.cityPursuitStats.currentSpeedLimitMph || 35;
      if (playerMph > zoneLimit + 5) {
        let nearestRadarCop: { id: string; dist: number } | null = null;
        for (const cop of this.cityPoliceCars) {
          const d = Math.hypot(cop.pos.x - this.playerPos.x, cop.pos.z - this.playerPos.z);
          if (d < 140 && (nearestRadarCop === null || d < nearestRadarCop.dist)) {
            nearestRadarCop = { id: cop.id, dist: d };
          }
        }
        if (nearestRadarCop && nearestRadarCop.dist >= 68) {
          this.cityPursuitStats.policeRadarWarning = {
            active: true,
            distanceMeters: Math.round(nearestRadarCop.dist),
            copId: nearestRadarCop.id.toUpperCase(),
            zoneLimitMph: zoneLimit,
            currentSpeedMph: Math.round(playerMph),
            message: `⚠️ POLICE RADAR DETECTED AHEAD (${Math.round(nearestRadarCop.dist)}M)! SLOW DOWN TO ${zoneLimit} MPH!`,
          };
          if (this.radarWarningBeepTimer <= 0) {
            soundEngine.playRadarWarningBeep();
            this.radarWarningBeepTimer = 1.35;
          }
        } else {
          this.cityPursuitStats.policeRadarWarning = null;
        }
      } else {
        this.cityPursuitStats.policeRadarWarning = null;
      }
    } else {
      this.cityPursuitStats.policeRadarWarning = null;
    }
    if (this.radarWarningBeepTimer > 0) {
      this.radarWarningBeepTimer -= dt;
    }

    // Subtitle & Pullover Timer update
    if (this.cityPursuitStats.megaphoneSubtitle) {
      this.cityPursuitStats.megaphoneSubtitle.timer -= dt;
      if (this.cityPursuitStats.megaphoneSubtitle.timer <= 0) {
        this.cityPursuitStats.megaphoneSubtitle = null;
      }
    }
    if (this.cityPursuitStats.playerBeingPulledOver && this.cityPursuitStats.playerBeingPulledOver.active) {
      this.cityPursuitStats.playerBeingPulledOver.timeLeftSec -= dt;
      // Allow player ample time (30s) to decelerate and pull over; only trigger evasion if deliberately speeding away over 120 km/h or time fully expires
      if (Math.abs(this.playerSpeedKmh) > 120 || this.cityPursuitStats.playerBeingPulledOver.timeLeftSec <= 0) {
        this.cityPursuitStats.playerBeingPulledOver = null;
        this.triggerCityPolicePursuit(2);
        this.cityPursuitStats.activeAlertBanner = `🚨 SUSPECT EVADING POLICE! FAILED TO COMPLY WITH PULL-OVER ORDER! WANTED ★2 PURSUIT ENGAGED!`;
        this.cityPursuitStats.activeAlertTimer = 5.5;
      }
    }

    let closestCopDist = 999;
    let anyChasingCopSeesPlayer = false;

    for (let pIdx = 0; pIdx < this.cityPoliceCars.length; pIdx++) {
      const cop = this.cityPoliceCars[pIdx];
      if (cop.hitCooldown > 0) cop.hitCooldown = Math.max(0, cop.hitCooldown - dt);

      // If player is an on-duty police officer, cops NEVER chase or arrest player!
      const playerIsProtectedOfficer = this.cityPursuitStats.isPoliceOnDuty;
      const isChasing = !playerIsProtectedOfficer && wanted > 0 && pIdx < activePursuitQuota;
      const isChasingFleeingCiv = !isChasing && Boolean(fleeingCiv) && pIdx < 2;
      const isBackupAssistingPlayer = !isChasing && Boolean(authorizedSuspect) && pIdx < 3;

      cop.built.setSirenActive(isChasing || isChasingFleeingCiv || isBackupAssistingPlayer, this.raceTimer + pIdx * 0.19);

      if (isChasing) {
        const dxToPlayer = this.playerPos.x - cop.pos.x;
        const dzToPlayer = this.playerPos.z - cop.pos.z;
        const distToPlayer = Math.hypot(dxToPlayer, dzToPlayer);

        if (canCopSeePlayer(cop.pos, this.playerPos, this.track.cityBuildings, 130)) {
          anyChasingCopSeesPlayer = true;
        }

        const leadFactor = Math.min(10, distToPlayer * 0.14);
        const flankOffset = (pIdx % 2 === 0 ? 1 : -1) * (pIdx > 1 ? 2.8 : 0);
        const targetX = this.playerPos.x + playerFwd.x * leadFactor + flankOffset;
        const targetZ = this.playerPos.z + playerFwd.z * leadFactor;

        const desiredHeading = Math.atan2(-(targetX - cop.pos.x), -(targetZ - cop.pos.z));
        let angleDiff = desiredHeading - cop.heading;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const maxTurnRate = 2.35 * dt;
        cop.heading += Math.max(-maxTurnRate, Math.min(maxTurnRate, angleDiff));
        cop.built.setSteerAngle(-Math.max(-0.38, Math.min(0.38, angleDiff)));

        const targetCopSpeed = 118 + wanted * 13;

        if (cop.speedKmh < targetCopSpeed) {
          cop.speedKmh = Math.min(targetCopSpeed, cop.speedKmh + (34 + wanted * 4) * dt);
        } else {
          cop.speedKmh = Math.max(targetCopSpeed, cop.speedKmh - 42 * dt);
        }

        const copStep = (cop.speedKmh / 3.6) * dt;
        cop.pos.x += -Math.sin(cop.heading) * copStep;
        cop.pos.z += -Math.cos(cop.heading) * copStep;

        const copBuildingHit = this.resolveBuildingCollision(cop.pos, 2.1);
        if (copBuildingHit.hit) {
          cop.stuckTimer += dt;
          cop.speedKmh *= 0.65;
          if (Math.abs(copBuildingHit.normalX) > 0.5) {
            cop.heading = dzToPlayer < 0 ? 0 : Math.PI;
          } else {
            cop.heading = dxToPlayer > 0 ? -Math.PI / 2 : Math.PI / 2;
          }
        } else {
          cop.stuckTimer = 0;
        }
      } else if (isBackupAssistingPlayer && authorizedSuspect) {
        // Backup Police Interceptor AI coordinates with player to intercept authorized suspect!
        const dxToSuspect = authorizedSuspect.pos.x - cop.pos.x;
        const dzToSuspect = authorizedSuspect.pos.z - cop.pos.z;
        const distToSuspect = Math.hypot(dxToSuspect, dzToSuspect);

        const desiredHeading = Math.atan2(-dxToSuspect, -dzToSuspect);
        let angleDiff = desiredHeading - cop.heading;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        const maxTurnRate = 2.6 * dt;
        cop.heading += Math.max(-maxTurnRate, Math.min(maxTurnRate, angleDiff));
        cop.speedKmh = Math.min(150, cop.speedKmh + 50 * dt);
        const copStep = (cop.speedKmh / 3.6) * dt;
        cop.pos.x += -Math.sin(cop.heading) * copStep;
        cop.pos.z += -Math.cos(cop.heading) * copStep;
        this.resolveBuildingCollision(cop.pos, 2.1);

        if (distToSuspect < 6.5 && !authorizedSuspect.isStopped) {
          authorizedSuspect.isStopped = true;
          authorizedSuspect.speedKmh = 0;
          authorizedSuspect.hazardActive = true;
          this.cityPursuitStats.activeAlertBanner = `🚓 BACKUP UNIT PINNED SUSPECT'S VEHICLE! APPROACH TO MAKE ARREST!`;
          this.cityPursuitStats.activeAlertTimer = 4.5;
        }
      } else if (isChasingFleeingCiv && fleeingCiv) {
        // Police unit intercepts the fleeing hit-and-run civilian on your behalf!
        const dxToCiv = fleeingCiv.pos.x - cop.pos.x;
        const dzToCiv = fleeingCiv.pos.z - cop.pos.z;
        const distToCiv = Math.hypot(dxToCiv, dzToCiv);

        const desiredHeading = Math.atan2(-dxToCiv, -dzToCiv);
        let angleDiff = desiredHeading - cop.heading;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        const maxTurnRate = 2.6 * dt;
        cop.heading += Math.max(-maxTurnRate, Math.min(maxTurnRate, angleDiff));
        cop.speedKmh = Math.min(155, cop.speedKmh + 55 * dt);
        const copStep = (cop.speedKmh / 3.6) * dt;
        cop.pos.x += -Math.sin(cop.heading) * copStep;
        cop.pos.z += -Math.cos(cop.heading) * copStep;
        this.resolveBuildingCollision(cop.pos, 2.1);

        if (distToCiv < 6.5) {
          fleeingCiv.isFleeingHitAndRun = false;
          fleeingCiv.built.setFleeingBeacon?.(false, 0);
          fleeingCiv.speedKmh = 0;
          const bounty = 5000;
          this.citySave.streetCash += bounty;
          saveMetroCitySave(this.citySave);
          this.cityPursuitStats.streetCash = this.citySave.streetCash;
          this.cityPursuitStats.civilianAtFaultClaim = null;
          soundEngine.playStartLightBeep(true);
          this.awardStreetSkillBonus('PD INTERCEPTED FUGITIVE', bounty);
          this.cityPursuitStats.activeAlertBanner = `🚓 METRO PD INTERCEPTED THE HIT-AND-RUN DRIVER! YOU RECEIVED +$${bounty.toLocaleString()}!`;
          this.cityPursuitStats.activeAlertTimer = 5.5;
        }
      } else {
        // Peaceful Street Patrol when Wanted = 0 (following statewide Maryland road polylines)
        const targetSpeed = 72;
        cop.speedKmh += (targetSpeed - cop.speedKmh) * Math.min(1, dt * 3);
        const stepMeters = (cop.speedKmh / 3.6) * dt;
        if (cop.routePoints && cop.routePoints.length >= 2) {
          const pts = cop.routePoints;
          let segIdx = Math.max(0, Math.min(pts.length - 2, cop.routeSegIdx ?? 0));
          let routeDir: 1 | -1 = cop.routeDir ?? 1;
          const segA = pts[segIdx];
          const segB = pts[segIdx + 1];
          const segDx = segB.x - segA.x;
          const segDz = segB.z - segA.z;
          const segLen = Math.hypot(segDx, segDz) || 1;
          const curT = cop.routeSegProgress ?? 0.5;
          let nextT = curT + (routeDir * stepMeters) / segLen;
          if (nextT > 1) {
            if (segIdx < pts.length - 2) {
              const overflow = (nextT - 1) * segLen;
              segIdx += 1;
              const nLen = Math.hypot(pts[segIdx + 1].x - pts[segIdx].x, pts[segIdx + 1].z - pts[segIdx].z) || 1;
              nextT = Math.min(1, overflow / nLen);
            } else {
              routeDir = -1;
              nextT = 1;
            }
          } else if (nextT < 0) {
            if (segIdx > 0) {
              const overflow = -nextT * segLen;
              segIdx -= 1;
              const pLen = Math.hypot(pts[segIdx + 1].x - pts[segIdx].x, pts[segIdx + 1].z - pts[segIdx].z) || 1;
              nextT = Math.max(0, 1 - overflow / pLen);
            } else {
              routeDir = 1;
              nextT = 0;
            }
          }
          cop.routeSegIdx = segIdx;
          cop.routeSegProgress = nextT;
          cop.routeDir = routeDir;

          const pA = pts[segIdx];
          const pB = pts[segIdx + 1];
          const dX = pB.x - pA.x;
          const dZ = pB.z - pA.z;
          const dLen = Math.hypot(dX, dZ) || 1;
          const dirX = (dX / dLen) * routeDir;
          const dirZ = (dZ / dLen) * routeDir;
          const laneOff = cop.patrolLineCoord || CITY_LANE_OFFSET;
          const targetX = pA.x + dX * nextT + -dirZ * laneOff;
          const targetZ = pA.z + dZ * nextT + dirX * laneOff;
          cop.pos.x += (targetX - cop.pos.x) * Math.min(1, dt * 6);
          cop.pos.z += (targetZ - cop.pos.z) * Math.min(1, dt * 6);
          const desiredHeading = Math.atan2(-dirX, -dirZ);
          let hDiff = desiredHeading - cop.heading;
          while (hDiff > Math.PI) hDiff -= Math.PI * 2;
          while (hDiff < -Math.PI) hDiff += Math.PI * 2;
          cop.heading += hDiff * Math.min(1, dt * 8);
        } else if (cop.patrolAxis === 'ns') {
          const laneX = cop.patrolLineCoord + (cop.patrolDir === -1 ? CITY_LANE_OFFSET : -CITY_LANE_OFFSET);
          cop.pos.x += (laneX - cop.pos.x) * Math.min(1, dt * 4);
          cop.pos.z += cop.patrolDir * stepMeters;
          cop.heading = cop.patrolDir === -1 ? 0 : Math.PI;
          if (cop.pos.z > 2050) cop.patrolDir = -1;
          if (cop.pos.z < -950) cop.patrolDir = 1;
        } else {
          const laneZ = cop.patrolLineCoord + (cop.patrolDir === 1 ? CITY_LANE_OFFSET : -CITY_LANE_OFFSET);
          cop.pos.z += (laneZ - cop.pos.z) * Math.min(1, dt * 4);
          cop.pos.x += cop.patrolDir * stepMeters;
          cop.heading = cop.patrolDir === 1 ? -Math.PI / 2 : Math.PI / 2;
          if (cop.pos.x > 2600) cop.patrolDir = -1;
          if (cop.pos.x < -2550) cop.patrolDir = 1;
        }

        // SPEEDING ACCOUNTABILITY & POLICE TRAFFIC STOP:
        // "make it so police dont chase me when im an officer"
        // "also make it so if a cop ctaches me and tells me to pull over i can pull over so he doesnt chase me if i slow down and pull to the side of the road that counts as pulling over and i have to press eneter to accept that im pulling over"
        const playerMph = Math.abs(this.playerSpeedKmh) * 0.621371;
        const zoneLimit = this.cityPursuitStats.currentSpeedLimitMph || 35;
        if (!this.cityPursuitStats.isPoliceOnDuty && playerMph > zoneLimit + 14 && cop.hitCooldown <= 0) {
          const distToPlayer = Math.hypot(cop.pos.x - this.playerPos.x, cop.pos.z - this.playerPos.z);
          if (distToPlayer < 72 && canCopSeePlayer(cop.pos, this.playerPos, this.track.cityBuildings, 80)) {
            if (!this.cityPursuitStats.playerBeingPulledOver && this.cityPursuitStats.wantedStars === 0) {
              cop.hitCooldown = 18.0;
              cop.built.setSirenActive(true, this.raceTimer);
              this.cityPursuitStats.playerBeingPulledOver = {
                active: true,
                copId: cop.id,
                reason: `Radar clocked at ${Math.round(playerMph)} MPH in a ${zoneLimit} MPH zone`,
                fine: 200,
                timeLeftSec: 30.0,
                canComply: true,
                complied: false,
              };
              soundEngine.playMegaphonePullOverVoice();
              this.cityPursuitStats.megaphoneSubtitle = {
                text: `📢 POLICE MEGAPHONE (${cop.id.toUpperCase()}): 'DRIVER, PULL OVER TO THE SIDE AND STOP! PRESS [ENTER] TO COMPLY!'`,
                timer: 7.5,
                speaker: cop.id.toUpperCase(),
              };
              this.cityPursuitStats.activeAlertBanner = `🚨 POLICE TRAFFIC STOP: SLOW DOWN (< 45 KM/H) & PRESS [ENTER] TO PULL OVER SAFELY!`;
              this.cityPursuitStats.activeAlertTimer = 6.5;
            }
          }
        }
      }

      cop.built.setWheelSpin(cop.speedKmh, dt);
      cop.built.root.position.copy(cop.pos);
      cop.built.root.rotation.y = cop.heading;

      const distNow = Math.hypot(this.playerPos.x - cop.pos.x, this.playerPos.z - cop.pos.z);
      if (isChasing && distNow < closestCopDist) {
        closestCopDist = distNow;
      }

      // Police-to-Player Collision
      const minCopSep = 3.95;
      if (distNow < minCopSep) {
        const nx = distNow > 0.001 ? (this.playerPos.x - cop.pos.x) / distNow : 1;
        const nz = distNow > 0.001 ? (this.playerPos.z - cop.pos.z) / distNow : 0;
        const overlap = minCopSep - distNow;

        this.playerPos.x += nx * overlap * 0.65;
        this.playerPos.z += nz * overlap * 0.65;
        cop.pos.x -= nx * overlap * 0.35;
        cop.pos.z -= nz * overlap * 0.35;

        this.playerSpeedKmh *= 0.82;
        this.collisionTrauma = Math.min(1.0, this.collisionTrauma + 0.4);
        this.playerCar.updateSparks(120, true, dt);

        if (cop.hitCooldown <= 0) {
          cop.hitCooldown = 2.4;
          soundEngine.playCrash(0.75);
          if (!this.cityPursuitStats.isPoliceOnDuty) {
            this.cityPursuitStats.policeCarsHit++;
            const starBump = 1;
            const nextStars = Math.min(5, this.cityPursuitStats.wantedStars + starBump);
            this.addCityViolationAlert(
              `🚨 RAMMED METRO PD INTERCEPTOR! WANTED ★${nextStars}`,
              `Rammed Metro PD Unit (${cop.id.toUpperCase()}) — $8,500 Fine`,
              starBump,
              8500
            );
          }
        }
      }
    }

    this.cityPursuitStats.closestCopDistMeters = Math.round(closestCopDist);

    // 6. Pursuit Bust Meter vs Line-of-Sight Escape Cooldown
    if (this.cityPursuitStats.wantedStars > 0) {
      if (closestCopDist < 12.5 && Math.abs(this.playerSpeedKmh) < 16) {
        this.cityPursuitStats.bustProgress = Math.min(100, this.cityPursuitStats.bustProgress + 28 * dt);
        this.cityPursuitStats.escapeProgress = Math.max(0, this.cityPursuitStats.escapeProgress - 25 * dt);
        if (this.cityPursuitStats.bustProgress >= 100) {
          const isHeistBust = Boolean(this.pendingHeistLoot) || this.cityPursuitStats.wantedStars >= 4;
          const confiscatedLoot = this.pendingHeistLoot ? this.pendingHeistLoot.amount : 0;
          this.pendingHeistLoot = null;
          this.cityPursuitStats.pendingHeistLoot = null;

          let fineTaken = 0;
          if (isHeistBust) {
            const priorBusts = this.citySave.bankRobberyBustCount || 0;
            this.citySave.bankRobberyBustCount = priorBusts + 1;
            // Federal restitution penalty: $500k base + $250k per prior bust ($500k, $750k, $1M, $1.25M...)
            fineTaken = 500000 + priorBusts * 250000;
            // Plunge balance directly into debt if player does not have enough money!
            this.citySave.streetCash -= fineTaken;
          } else {
            fineTaken = Math.min(this.citySave.streetCash, 2500 * this.cityPursuitStats.wantedStars);
            this.citySave.streetCash = Math.max(0, this.citySave.streetCash - fineTaken);
          }

          saveMetroCitySave(this.citySave);
          this.cityPursuitStats.streetCash = this.citySave.streetCash;
          this.cityPursuitStats.bankRobberyBustCount = this.citySave.bankRobberyBustCount || 0;
          this.cityPursuitStats.inDebt = this.citySave.streetCash < 0;
          this.cityPursuitStats.heistDebtAmount = Math.max(0, -this.citySave.streetCash);

          this.cityPursuitStats.pursuitState = 'BUSTED';
          this.cityPursuitStats.wantedStars = 0;
          this.cityPursuitStats.hasActiveWarrant = false;
          this.cityPursuitStats.unpaidRedLightTickets = 0;
          this.cityPursuitStats.bustProgress = 0;
          this.cityPursuitStats.escapeProgress = 0;
          this.playerSpeedKmh = 0;

          if (isHeistBust) {
            const debtStr = this.citySave.streetCash < 0
              ? ` | IN DEBT: -$${Math.abs(this.citySave.streetCash).toLocaleString()}`
              : '';
            this.cityPursuitStats.activeAlertBanner = `🚨 BUSTED BY FBI/SWAT! Stolen loot confiscated + -$${fineTaken.toLocaleString()} RESTITUTION FINE! (Bust Record: #${this.citySave.bankRobberyBustCount}${debtStr})`;
          } else {
            this.cityPursuitStats.activeAlertBanner = `🚓 BUSTED BY METRO PD! BAIL FINE: -$${fineTaken.toLocaleString()}`;
          }
          this.cityPursuitStats.activeAlertTimer = 6.5;
          this.playerPos.set(ICM_PLAYER_SPAWN.x, ICM_PLAYER_SPAWN.y, ICM_PLAYER_SPAWN.z);
          this.playerHeading = ICM_PLAYER_SPAWN.heading;
        }
      } else {
        this.cityPursuitStats.bustProgress = Math.max(0, this.cityPursuitStats.bustProgress - 32 * dt);

        if (this.pendingHeistLoot) {
          // During a 5-Star Heist Getaway, you MUST flee back to your House without police seeing you!
          this.cityPursuitStats.pursuitState = anyChasingCopSeesPlayer ? 'PURSUIT' : 'COOLDOWN';
          this.cityPursuitStats.escapeProgress = anyChasingCopSeesPlayer ? 15 : 85;
        } else {
          const isEvading =
            closestCopDist > 125 || (!anyChasingCopSeesPlayer && closestCopDist > 75);
          if (isEvading) {
            this.cityPursuitStats.pursuitState = 'COOLDOWN';
            const escapeRate = !anyChasingCopSeesPlayer ? 16.5 : 12.5;
            this.cityPursuitStats.escapeProgress = Math.min(100, this.cityPursuitStats.escapeProgress + escapeRate * dt);
            if (this.cityPursuitStats.escapeProgress >= 100) {
              this.cityPursuitStats.wantedStars = 0;
              this.cityPursuitStats.hasActiveWarrant = false;
              this.cityPursuitStats.unpaidRedLightTickets = 0;
              this.cityPursuitStats.pursuitState = 'CLEAR';
              this.cityPursuitStats.escapeProgress = 0;
              this.cityPursuitStats.bustProgress = 0;
              const escapeBonus = 1500;
              this.citySave.streetCash += escapeBonus;
              saveMetroCitySave(this.citySave);
              this.cityPursuitStats.streetCash = this.citySave.streetCash;
              this.cityPursuitStats.activeAlertBanner = `✅ PURSUIT EVADED! LOST VISUAL CONTACT (+$${escapeBonus.toLocaleString()} REP BONUS)`;
              this.cityPursuitStats.activeAlertTimer = 4.5;
            }
          } else {
            this.cityPursuitStats.pursuitState = 'PURSUIT';
            this.cityPursuitStats.escapeProgress = Math.max(0, this.cityPursuitStats.escapeProgress - 4.5 * dt);
          }
        }
      }
    } else {
      this.cityPursuitStats.pursuitState = 'CLEAR';
      this.cityPursuitStats.bustProgress = 0;
      this.cityPursuitStats.escapeProgress = 0;
    }

    // 6b. 5-Star Heist Getaway to Your House / Safehouse Unseen by Police
    if (this.pendingHeistLoot) {
      const loot = this.pendingHeistLoot;
      const dxHome = loot.homeX - this.playerPos.x;
      const dzHome = loot.homeZ - this.playerPos.z;
      const distHome = Math.hypot(dxHome, dzHome);

      const homeAngle = Math.atan2(-dxHome, -dzHome);
      let relAngleDeg = ((this.playerHeading - homeAngle) * 180) / Math.PI;
      while (relAngleDeg > 180) relAngleDeg -= 360;
      while (relAngleDeg < -180) relAngleDeg += 360;

      this.cityPursuitStats.pendingHeistLoot = {
        amount: loot.amount,
        targetName: loot.targetName,
        icon: loot.icon,
        homeX: loot.homeX,
        homeZ: loot.homeZ,
        homeName: loot.homeName,
        distMeters: Math.round(distHome),
        directionDeg: Math.round(relAngleDeg),
        copSeesYouNow: anyChasingCopSeesPlayer,
      };

      if (distHome < 20.0) {
        if (anyChasingCopSeesPlayer) {
          this.cityPursuitStats.activeAlertBanner = `👁️ POLICE CAN SEE YOU! BREAK LINE-OF-SIGHT BEHIND BUILDINGS BEFORE ENTERING ${loot.homeName.toUpperCase()}!`;
          this.cityPursuitStats.activeAlertTimer = 2.2;
        } else {
          // Clean Safehouse Getaway! Bank the stolen cash and clear all 5 Wanted Stars!
          const bankedCash = loot.amount;
          const targetLabel = loot.targetName;
          const houseLabel = loot.homeName;

          this.pendingHeistLoot = null;
          this.cityPursuitStats.pendingHeistLoot = null;

          this.citySave.streetCash += bankedCash;
          this.citySave.totalHeistsCompleted = (this.citySave.totalHeistsCompleted || 0) + 1;
          this.citySave.streetRepLevel =
            1 +
            Math.floor(
              (this.citySave.completedMissions +
                (this.citySave.totalHeistsCompleted || 0) +
                (this.citySave.totalJobsCompleted || 0)) /
                2
            );
          saveMetroCitySave(this.citySave);

          this.cityPursuitStats.streetCash = this.citySave.streetCash;
          this.cityPursuitStats.totalHeistsCompleted = this.citySave.totalHeistsCompleted;
          this.cityPursuitStats.streetRepLevel = this.citySave.streetRepLevel;

          this.cityPursuitStats.wantedStars = 0;
          this.cityPursuitStats.hasActiveWarrant = false;
          this.cityPursuitStats.unpaidRedLightTickets = 0;
          this.cityPursuitStats.pursuitState = 'CLEAR';
          this.cityPursuitStats.escapeProgress = 0;
          this.cityPursuitStats.bustProgress = 0;
          for (const cop of this.cityPoliceCars) {
            cop.built.setSirenActive(false, 0);
          }

          soundEngine.playStartLightBeep(true);
          this.awardStreetSkillBonus(`🏡 SAFEHOUSE GETAWAY: ${targetLabel}`, bankedCash);
          this.cityPursuitStats.activeAlertBanner = `🏡 HID IN ${houseLabel.toUpperCase()} UNSEEN! BANKED +$${bankedCash.toLocaleString()} HEIST LOOT & CLEARED ★5 HEAT!`;
          this.cityPursuitStats.activeAlertTimer = 6.0;
        }
      }
    } else {
      this.cityPursuitStats.pendingHeistLoot = null;
    }

    // 7. Interactive Street Missions & 3D Waypoint Beacon Progression
    let activeBeaconSet = false;
    let activeGpsInfo: { x: number; z: number; label: string; color: string } | null = null;

    if (this.pendingHeistLoot) {
      const beaconColor = anyChasingCopSeesPlayer ? '#ef4444' : '#10b981';
      this.missionBeacon?.setWaypoint(
        this.pendingHeistLoot.homeX,
        this.pendingHeistLoot.homeZ,
        beaconColor,
        true,
        this.raceTimer
      );
      activeBeaconSet = true;
      activeGpsInfo = {
        x: this.pendingHeistLoot.homeX,
        z: this.pendingHeistLoot.homeZ,
        label: `FLEE TO ${this.pendingHeistLoot.homeName.toUpperCase()}`,
        color: beaconColor,
      };
    }

    if (this.activeMissionTemplate) {
      this.activeMissionTimeLeft = Math.max(0, this.activeMissionTimeLeft - dt);
      const totalCrashesNow = this.cityPursuitStats.trafficCarsHit + this.cityPursuitStats.policeCarsHit;
      const crashesDuringMission = Math.max(0, totalCrashesNow - this.activeMissionCrashesStart);
      const maxCrashesAllowed = this.activeMissionTemplate.requireZeroCrashes ? 0 : undefined;

      if (this.activeMissionTimeLeft <= 0) {
        const failedTitle = this.activeMissionTemplate.title;
        this.activeMissionTemplate = null;
        this.cityPursuitStats.activeMission = null;
        if (!activeBeaconSet) this.missionBeacon?.setWaypoint(0, 0, '#10b981', false, 0);
        this.cityPursuitStats.activeAlertBanner = `⏱️ MISSION FAILED (${failedTitle.toUpperCase()}): OUT OF TIME!`;
        this.cityPursuitStats.activeAlertTimer = 4.5;
        return;
      }

      if (maxCrashesAllowed !== undefined && crashesDuringMission > maxCrashesAllowed) {
        const failedTitle = this.activeMissionTemplate.title;
        this.activeMissionTemplate = null;
        this.cityPursuitStats.activeMission = null;
        if (!activeBeaconSet) this.missionBeacon?.setWaypoint(0, 0, '#10b981', false, 0);
        this.cityPursuitStats.activeAlertBanner = `💥 MISSION FAILED (${failedTitle.toUpperCase()}): VIP VEHICLE DAMAGED!`;
        this.cityPursuitStats.activeAlertTimer = 4.5;
        return;
      }

      if (this.activeMissionAwaitingEscape) {
        if (!activeBeaconSet) this.missionBeacon?.setWaypoint(0, 0, '#10b981', false, 0);
        if (this.cityPursuitStats.wantedStars === 0) {
          this.completeActiveCityMission();
          return;
        }
        this.cityPursuitStats.activeMission = {
          id: this.activeMissionTemplate.id,
          title: this.activeMissionTemplate.title,
          category: this.activeMissionTemplate.type.toUpperCase(),
          waypointLabel: 'EVADE POLICE PURSUIT (HIDE BEHIND BUILDINGS)',
          waypointIndex: this.activeMissionTemplate.waypoints.length,
          totalWaypoints: this.activeMissionTemplate.waypoints.length,
          distMeters: this.cityPursuitStats.closestCopDistMeters,
          directionDeg: 0,
          timeLeftSec: Number(this.activeMissionTimeLeft.toFixed(1)),
          rewardCash: this.activeMissionTemplate.rewardCash,
          crashesTaken: crashesDuringMission,
          awaitingEscape: true,
        };
      } else {
        const wp = this.activeMissionTemplate.waypoints[this.activeMissionWaypointIdx];
        if (!activeBeaconSet) {
          this.missionBeacon?.setWaypoint(
            wp.x,
            wp.z,
            this.activeMissionTemplate.badgeColor,
            true,
            this.raceTimer
          );
          activeBeaconSet = true;
          activeGpsInfo = {
            x: wp.x,
            z: wp.z,
            label: wp.label,
            color: this.activeMissionTemplate.badgeColor,
          };
        }

        const dxWp = wp.x - this.playerPos.x;
        const dzWp = wp.z - this.playerPos.z;
        const distToWp = Math.hypot(dxWp, dzWp);

        const wpAngle = Math.atan2(-dxWp, -dzWp);
        let relAngleDeg = ((this.playerHeading - wpAngle) * 180) / Math.PI;
        while (relAngleDeg > 180) relAngleDeg -= 360;
        while (relAngleDeg < -180) relAngleDeg += 360;

        this.cityPursuitStats.activeMission = {
          id: this.activeMissionTemplate.id,
          title: this.activeMissionTemplate.title,
          category: this.activeMissionTemplate.type.toUpperCase(),
          waypointLabel: wp.label,
          waypointIndex: this.activeMissionWaypointIdx + 1,
          totalWaypoints: this.activeMissionTemplate.waypoints.length,
          distMeters: Math.round(distToWp),
          directionDeg: Math.round(relAngleDeg),
          timeLeftSec: Number(this.activeMissionTimeLeft.toFixed(1)),
          rewardCash: this.activeMissionTemplate.rewardCash,
          minSpeedKmh: wp.minSpeedKmh,
          maxCrashesAllowed,
          crashesTaken: crashesDuringMission,
          awaitingEscape: false,
        };

        if (distToWp < 16.0) {
          const minReqSpeed = wp.minSpeedKmh || 0;
          if (Math.abs(this.playerSpeedKmh) < minReqSpeed) {
            this.cityPursuitStats.activeAlertBanner = `⚡ SPEED TRAP REQUIREMENT: HIT ${minReqSpeed}+ KM/H THROUGH CHECKPOINT! (NOW ${Math.round(Math.abs(this.playerSpeedKmh))} KM/H)`;
            this.cityPursuitStats.activeAlertTimer = 2.5;
          } else {
            soundEngine.playStartLightBeep(false);
            if (this.activeMissionWaypointIdx === 0 && this.activeMissionTemplate.triggerWantedStars) {
              this.triggerCityPolicePursuit(this.activeMissionTemplate.triggerWantedStars);
            }

            this.activeMissionWaypointIdx++;
            if (this.activeMissionWaypointIdx >= this.activeMissionTemplate.waypoints.length) {
              if (this.activeMissionTemplate.type === 'getaway' && this.cityPursuitStats.wantedStars > 0) {
                this.activeMissionAwaitingEscape = true;
                this.cityPursuitStats.activeAlertBanner = `🚨 DROP COMPLETED! NOW LOSE THE COPS TO COLLECT $${this.activeMissionTemplate.rewardCash.toLocaleString()}!`;
                this.cityPursuitStats.activeAlertTimer = 4.5;
              } else {
                this.completeActiveCityMission();
              }
            } else {
              const nextWp = this.activeMissionTemplate.waypoints[this.activeMissionWaypointIdx];
              this.cityPursuitStats.activeAlertBanner = `✅ CHECKPOINT CLEAR! NEXT: ${nextWp.label} (+8S BONUS)`;
              this.cityPursuitStats.activeAlertTimer = 3.0;
              this.activeMissionTimeLeft += 8;
            }
          }
        }
      }
    } else if (this.activeJobSpec) {
      // 7b. Regular Street Job Shift Progression (Taxi, Pizza Delivery, Courier, Burger Blitz, Paramedic)
      this.cityPursuitStats.activeMission = null;
      this.activeJobTimeLeft = Math.max(0, this.activeJobTimeLeft - dt);
      const route = this.activeJobSpec.routes[this.activeJobRouteIdx];
      const targetX = this.activeJobStage === 'PICKUP' ? route.pickupX : route.dropoffX;
      const targetZ = this.activeJobStage === 'PICKUP' ? route.pickupZ : route.dropoffZ;
      const targetLabel = this.activeJobStage === 'PICKUP' ? route.pickupLabel : route.dropoffLabel;
      const jobColor = this.activeJobStage === 'PICKUP' ? '#38bdf8' : this.activeJobSpec.badgeColor;

      if (!activeBeaconSet) {
        this.missionBeacon?.setWaypoint(targetX, targetZ, jobColor, true, this.raceTimer);
        activeBeaconSet = true;
        activeGpsInfo = {
          x: targetX,
          z: targetZ,
          label: `${this.activeJobStage}: ${targetLabel}`,
          color: jobColor,
        };
      }

      const dxJob = targetX - this.playerPos.x;
      const dzJob = targetZ - this.playerPos.z;
      const distJob = Math.hypot(dxJob, dzJob);

      const jobAngle = Math.atan2(-dxJob, -dzJob);
      let relAngleDeg = ((this.playerHeading - jobAngle) * 180) / Math.PI;
      while (relAngleDeg > 180) relAngleDeg -= 360;
      while (relAngleDeg < -180) relAngleDeg += 360;

      this.cityPursuitStats.activeRegularJob = {
        jobId: this.activeJobSpec.id,
        title: this.activeJobSpec.title,
        roleLabel: this.activeJobSpec.roleLabel,
        icon: this.activeJobSpec.icon,
        stage: this.activeJobStage,
        targetLabel,
        distMeters: Math.round(distJob),
        directionDeg: Math.round(relAngleDeg),
        timeLeftSec: Number(this.activeJobTimeLeft.toFixed(1)),
        basePay: this.activeJobSpec.basePay,
        streakCount: this.activeJobStreak,
        shiftEarnedCash: this.activeJobTotalEarned,
      };

      if (this.activeJobTimeLeft <= 0) {
        this.activeJobRouteIdx = (this.activeJobRouteIdx + 1) % this.activeJobSpec.routes.length;
        this.activeJobStage = 'PICKUP';
        this.activeJobTimeLeft = this.activeJobSpec.timeLimitSec;
        this.activeJobStreak = 0;
        const nextRoute = this.activeJobSpec.routes[this.activeJobRouteIdx];
        this.cityPursuitStats.activeAlertBanner = `⏱️ ORDER EXPIRED! NEW DISPATCH: ${nextRoute.pickupLabel}`;
        this.cityPursuitStats.activeAlertTimer = 3.8;
      } else if (distJob < 16.5) {
        if (this.activeJobStage === 'PICKUP') {
          this.activeJobStage = 'DROPOFF';
          this.activeJobTimeLeft = this.activeJobSpec.timeLimitSec;
          this.activeJobCrashesStart = this.cityPursuitStats.trafficCarsHit + this.cityPursuitStats.policeCarsHit;
          soundEngine.playStartLightBeep(false);
          this.cityPursuitStats.activeAlertBanner = `${this.activeJobSpec.icon} PICKED UP! DELIVER TO ${route.dropoffLabel} FOR +$${this.activeJobSpec.basePay.toLocaleString()} + TIP!`;
          this.cityPursuitStats.activeAlertTimer = 4.2;
        } else {
          const crashesDuringOrder = Math.max(
            0,
            this.cityPursuitStats.trafficCarsHit + this.cityPursuitStats.policeCarsHit - this.activeJobCrashesStart
          );
          const speedRatio = Math.min(1, this.activeJobTimeLeft / (this.activeJobSpec.timeLimitSec * 0.65));
          const cleanlinessFactor = crashesDuringOrder === 0 ? 1.0 : Math.max(0.25, 1.0 - crashesDuringOrder * 0.35);
          const tip = Math.round(this.activeJobSpec.tipBonusMax * speedRatio * cleanlinessFactor);
          this.activeJobStreak += 1;
          const streakBonus = Math.min(1500, (this.activeJobStreak - 1) * 250);
          const totalPayout = this.activeJobSpec.basePay + tip + streakBonus;

          this.activeJobTotalEarned += totalPayout;
          this.citySave.streetCash += totalPayout;
          this.citySave.totalJobsCompleted = (this.citySave.totalJobsCompleted || 0) + 1;
          saveMetroCitySave(this.citySave);

          this.cityPursuitStats.streetCash = this.citySave.streetCash;
          this.cityPursuitStats.totalJobsCompleted = this.citySave.totalJobsCompleted;

          this.activeJobRouteIdx = (this.activeJobRouteIdx + 1) % this.activeJobSpec.routes.length;
          this.activeJobStage = 'PICKUP';
          this.activeJobTimeLeft = this.activeJobSpec.timeLimitSec;
          const nextRoute = this.activeJobSpec.routes[this.activeJobRouteIdx];

          soundEngine.playStartLightBeep(true);
          this.awardStreetSkillBonus(`${this.activeJobSpec.icon} JOB PAY + $${tip} TIP`, totalPayout);
          this.cityPursuitStats.activeAlertBanner = `💵 ${this.activeJobSpec.roleLabel.toUpperCase()} COMPLETED (+$${totalPayout.toLocaleString()})! NEXT PICKUP: ${nextRoute.pickupLabel}`;
          this.cityPursuitStats.activeAlertTimer = 4.8;
        }
      }
    } else if (this.customGpsTarget) {
      this.cityPursuitStats.activeMission = null;
      this.cityPursuitStats.activeRegularJob = null;
      if (!activeBeaconSet) {
        this.missionBeacon?.setWaypoint(
          this.customGpsTarget.x,
          this.customGpsTarget.z,
          this.customGpsTarget.colorHex,
          true,
          this.raceTimer
        );
        activeBeaconSet = true;
        activeGpsInfo = {
          x: this.customGpsTarget.x,
          z: this.customGpsTarget.z,
          label: this.customGpsTarget.label,
          color: this.customGpsTarget.colorHex,
        };
      }
      const distGps = Math.hypot(
        this.customGpsTarget.x - this.playerPos.x,
        this.customGpsTarget.z - this.playerPos.z
      );
      if (distGps < 18.0) {
        this.customGpsTarget = null;
        if (!this.pendingHeistLoot) {
          this.missionBeacon?.setWaypoint(0, 0, '#10b981', false, 0);
        }
      }
    } else {
      if (!activeBeaconSet) {
        this.missionBeacon?.setWaypoint(0, 0, '#10b981', false, 0);
      }
      this.cityPursuitStats.activeMission = null;
      this.cityPursuitStats.activeRegularJob = null;
    }

    // 8. Compute Turn-by-Turn Manhattan GPS Route & Update 3D Road Ribbon + 2D Radar Mini-Map Data
    const safehouse = this.getPlayerSafehouseTarget();
    let gpsRoutePts: { x: number; z: number }[] = [];
    let gpsTargetSummary: {
      x: number;
      z: number;
      label: string;
      color: string;
      distMeters: number;
      turnInstruction: string;
    } | null = null;

    if (activeGpsInfo) {
      gpsRoutePts = computeCityGpsRoute(
        this.playerPos.x,
        this.playerPos.z,
        activeGpsInfo.x,
        activeGpsInfo.z
      );
      this.gpsRouteRibbon?.updateRoute(gpsRoutePts, activeGpsInfo.color, true);

      const totalDist = Math.round(
        Math.hypot(activeGpsInfo.x - this.playerPos.x, activeGpsInfo.z - this.playerPos.z)
      );
      // Calculate exact turn instruction using XZ vector cross product (handles +Y CCW heading cleanly)
      let turnInstruction = `⬆️ PROCEED ${totalDist}M TO DESTINATION`;
      if (gpsRoutePts.length >= 2) {
        const nextCorner = gpsRoutePts[1];
        const inDx = nextCorner.x - this.playerPos.x;
        const inDz = nextCorner.z - this.playerPos.z;
        const distToCorner = Math.hypot(inDx, inDz);
        const distToTurn = Math.round(distToCorner);
        const inLen = Math.max(0.001, distToCorner);
        const inUx = inDx / inLen;
        const inUz = inDz / inLen;

        // Player forward unit vector in Three.js (heading=0 points North / -Z, +heading turns CCW / West)
        const fwdX = -Math.sin(this.playerHeading);
        const fwdZ = -Math.cos(this.playerHeading);
        const fwdDotIn = fwdX * inUx + fwdZ * inUz;

        if (fwdDotIn < -0.35 && distToCorner > 14) {
          turnInstruction = `🔄 MAKE U-TURN (${totalDist}M)`;
        } else if (gpsRoutePts.length >= 3) {
          const afterCorner = gpsRoutePts[2];
          const legDx = afterCorner.x - nextCorner.x;
          const legDz = afterCorner.z - nextCorner.z;
          const legLen = Math.max(0.001, Math.hypot(legDx, legDz));
          const legUx = legDx / legLen;
          const legUz = legDz / legLen;
          // In XZ screen space (+X East, +Z South): cross = inUx * legUz - inUz * legUx
          // cross < 0 => Left turn, cross > 0 => Right turn
          const cross = inUx * legUz - inUz * legUx;

          if (distToTurn < 12) {
            if (cross < -0.25) turnInstruction = `⬅️ TURN LEFT NOW`;
            else if (cross > 0.25) turnInstruction = `➡️ TURN RIGHT NOW`;
            else turnInstruction = `⬆️ STRAIGHT AHEAD (${totalDist}M)`;
          } else if (cross < -0.25) {
            turnInstruction = `⬅️ TURN LEFT IN ${distToTurn}M`;
          } else if (cross > 0.25) {
            turnInstruction = `➡️ TURN RIGHT IN ${distToTurn}M`;
          } else {
            turnInstruction = `⬆️ STRAIGHT ${distToTurn}M`;
          }
        }
      }

      gpsTargetSummary = {
        x: activeGpsInfo.x,
        z: activeGpsInfo.z,
        label: activeGpsInfo.label,
        color: activeGpsInfo.color,
        distMeters: totalDist,
        turnInstruction,
      };
    } else {
      this.gpsRouteRibbon?.updateRoute([], '#38bdf8', false);
    }

    this.cityPursuitStats.minimapData = {
      playerX: this.playerPos.x,
      playerZ: this.playerPos.z,
      playerHeading: this.playerHeading,
      gpsTarget: gpsTargetSummary,
      gpsRoute: gpsRoutePts,
      cops: this.cityPoliceCars.map((c) => ({
        x: c.pos.x,
        z: c.pos.z,
        heading: c.heading,
        isChasing: this.cityPursuitStats.wantedStars > 0,
        canSeePlayer:
          this.cityPursuitStats.wantedStars > 0 &&
          canCopSeePlayer(c.pos, this.playerPos, this.track.cityBuildings),
      })),
      civs: this.cityCivilianCars.map((c) => ({ x: c.pos.x, z: c.pos.z })),
      activeHome: safehouse,
    };
  }

  public clearCityGpsTarget() {
    this.customGpsTarget = null;
    if (!this.pendingHeistLoot && !this.activeMissionTemplate && !this.activeJobSpec) {
      this.missionBeacon?.setWaypoint(0, 0, '#10b981', false, 0);
      this.gpsRouteRibbon?.updateRoute([], '#38bdf8', false);
    }
  }

  private completeActiveCityMission() {
    if (!this.activeMissionTemplate) return;
    const template = this.activeMissionTemplate;
    const completedList = this.citySave.completedMissionIds || [];
    const isReplay = completedList.includes(template.id);
    const reward = isReplay
      ? template.replayCash || Math.round(template.rewardCash * 0.25)
      : template.rewardCash;
    const title = template.title;

    if (!isReplay) {
      if (!this.citySave.completedMissionIds) this.citySave.completedMissionIds = [];
      this.citySave.completedMissionIds.push(template.id);
    }

    this.citySave.streetCash += reward;
    this.citySave.completedMissions = (this.citySave.completedMissionIds || []).length;
    this.citySave.streetRepLevel = 1 + Math.floor(this.citySave.completedMissions / 2);
    saveMetroCitySave(this.citySave);

    this.cityPursuitStats.streetCash = this.citySave.streetCash;
    this.cityPursuitStats.inDebt = this.citySave.streetCash < 0;
    this.cityPursuitStats.heistDebtAmount = Math.max(0, -this.citySave.streetCash);
    this.cityPursuitStats.completedMissions = this.citySave.completedMissions;
    this.cityPursuitStats.completedMissionIds = [...(this.citySave.completedMissionIds || [])];
    this.cityPursuitStats.streetRepLevel = this.citySave.streetRepLevel;

    this.activeMissionTemplate = null;
    this.activeMissionAwaitingEscape = false;
    this.cityPursuitStats.activeMission = null;
    this.missionBeacon?.setWaypoint(0, 0, '#10b981', false, 0);

    soundEngine.playStartLightBeep(true);
    this.cityPursuitStats.activeAlertBanner = isReplay
      ? `💰 LEVEL ${template.level} REPLAY COMPLETE: +$${reward.toLocaleString()} REPLAY CASH`
      : `🎉 LEVEL ${template.level} COMPLETE: ${title.toUpperCase()}! EARNED +$${reward.toLocaleString()} STREET CASH!`;
    this.cityPursuitStats.activeAlertTimer = 5.5;
  }

  public triggerCityPolicePursuit(stars: number = 3) {
    if (!this.isCityMode || this.cityPursuitStats.isPoliceOnDuty) return;
    const clampedStars = Math.max(1, Math.min(5, stars));
    this.cityPursuitStats.wantedStars = clampedStars;
    this.cityPursuitStats.pursuitState = 'PURSUIT';
    this.cityPursuitStats.escapeProgress = 0;
    this.cityPursuitStats.bustProgress = 0;
    this.cityPursuitStats.activeAlertBanner = `🚨 ALL UNITS DISPATCHED! WANTED LEVEL ★${clampedStars} PURSUIT ACTIVE`;
    this.cityPursuitStats.activeAlertTimer = 5.0;
    soundEngine.playStartLightBeep(true);
  }

  public clearCityWantedHeat() {
    if (!this.isCityMode) return;
    this.cityPursuitStats.wantedStars = 0;
    this.cityPursuitStats.hasActiveWarrant = false;
    this.cityPursuitStats.unpaidRedLightTickets = 0;
    this.cityPursuitStats.pursuitState = 'CLEAR';
    this.cityPursuitStats.escapeProgress = 0;
    this.cityPursuitStats.bustProgress = 0;
    this.cityPursuitStats.activeAlertBanner = '🛡️ POLICE SCANNER JAMMED — WANTED HEAT CLEARED';
    this.cityPursuitStats.activeAlertTimer = 3.5;
    for (const cop of this.cityPoliceCars) {
      cop.built.setSirenActive(false, 0);
    }
  }

  public teleportToCityLandmark(landmark: 'downtown_plaza' | 'north_blvd' | 'west_highway' | 'south_station') {
    if (!this.isCityMode) return;
    if (landmark === 'downtown_plaza') {
      this.playerPos.set(CITY_LANE_OFFSET, 0.33, 225);
      this.playerHeading = 0;
    } else if (landmark === 'north_blvd') {
      this.playerPos.set(CITY_LANE_OFFSET, 0.33, -260);
      this.playerHeading = Math.PI;
    } else if (landmark === 'west_highway') {
      this.playerPos.set(-320 + CITY_LANE_OFFSET, 0.33, 95);
      this.playerHeading = 0;
    } else if (landmark === 'south_station') {
      this.playerPos.set(220, 0.33, 320 + CITY_LANE_OFFSET);
      this.playerHeading = -Math.PI / 2;
    }
    this.playerSpeedKmh = 0;
    this.playerGear = 1;
    this.ersBattery = 100;
    this.tireLife = 100;
    this.tireCorners = { fl: 100, fr: 100, rl: 100, rr: 100 };
    this.playerCar.root.position.copy(this.playerPos);
    this.playerCar.root.rotation.y = this.playerHeading;
  }
}

