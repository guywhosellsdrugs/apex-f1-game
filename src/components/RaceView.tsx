import React, { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CircuitInfo, CameraView, SeasonState, Driver, Team, TelemetryData } from '../types/racing';
import { DRIVERS, TEAMS } from '../constants/f1Data';
import { buildF1Car } from '../game/carBuilder';
import { generateTrack } from '../game/trackGenerator';
import { buildPracticeRacingLine, PracticeLineCoachData, BuiltRacingLine } from '../game/racingLineBuilder';
import { PhysicsEngine } from '../game/physicsEngine';
import {
  ALL_MARYLAND_ROADS,
  MD_LANDMARKS,
  ICM_CAMPUS_ORIGIN,
  REDEEMER_CAMPUS_ORIGIN,
  gx,
  gz,
  CITY_STREET_CARS,
  CITY_MISSIONS_CATALOG,
  CITY_REGULAR_JOBS_CATALOG,
  CITY_HEIST_TARGETS_CATALOG,
  CITY_HOUSES_CATALOG,
  CITY_SPORTS_CATALOG,
  CITY_SERVICE_STATIONS,
  CITY_CAR_MEET_ZONES,
  getEffectiveStreetCarSpec,
  searchMarylandGpsDirectory,
  snapWorldPointToNearestRoad,
  MarylandGpsEntry,
  GpsManeuverType,
} from '../game/cityTrafficBuilder';
import {
  createTireSpraySystem,
  createAtmosphericWeatherSystem,
  createSkyCelestialAndCloudsSystem,
  updateSceneDiurnalLighting,
  TireSpraySystem,
  AtmosphericWeatherSystem,
  SkyCelestialAndCloudsSystem,
} from '../game/weatherParticles';
import { WeatherMode, TimeOfDayPreset, GaithersburgWeather, calculateDrivetrainTractionModifier } from '../services/weatherService';
import { voiceNavigationService, formatGoogleMapsDistance } from '../services/voiceNavigationService';
import { inputManager } from '../services/inputManager';
import { soundEngine } from '../services/soundEngine';
import { BroadcastHUD } from './BroadcastHUD';
import { ControlsSettingsModal } from './ControlsSettingsModal';
import { BankHeistMinigame } from './BankHeistMinigame';
import { LockpickMinigame } from './LockpickMinigame';
import { SportsMinigame } from './SportsMinigame';
import { MarylandGoogleMapModal } from './MarylandGoogleMapModal';
import { multiplayerService, RoomPublicState } from '../services/multiplayerService';
import { recordCircuitLapTime } from '../services/firebase';
import {
  GraphicsQuality,
  GRAPHICS_QUALITY_OPTIONS,
  GRAPHICS_PRESETS,
  isDynamicGraphics,
  getStoredGraphicsQuality,
  setStoredGraphicsQuality,
  onGraphicsQualityChange,
  getGraphicsPresetConfig,
  getStoredDynamicGpuProfile,
  setStoredDynamicGpuProfile,
  getStoredMotionBlur,
  setStoredMotionBlur,
  onMotionBlurChange,
} from '../utils/graphicsSettings';

// High-speed cinematic radial velocity motion blur shader with sharp player-car focus cutout
const MotionBlurShader = {
  uniforms: {
    tDiffuse: { value: null },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uCarUv: { value: new THREE.Vector2(0.5, 0.36) },
    uFocusRadius: { value: 0.23 },
    uIntensity: { value: 0.0 },
    uResolution: { value: new THREE.Vector2(1920, 1080) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uCenter;
    uniform vec2 uCarUv;
    uniform float uFocusRadius;
    uniform float uIntensity;
    uniform vec2 uResolution;
    varying vec2 vUv;

    void main() {
      if (uIntensity <= 0.0005) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      float aspect = max(1.0, uResolution.x / max(1.0, uResolution.y));
      vec2 carDelta = (vUv - uCarUv) * vec2(aspect * 0.72, 1.15);
      float carDist = length(carDelta);
      // Keep ~28% directional speed blur on the car itself so it conveys speed while remaining sharp & clear
      float carMask = mix(0.28, 1.0, smoothstep(uFocusRadius * 0.65, uFocusRadius + 0.22, carDist));

      vec2 dir = (uCenter - vUv);
      float dist = length(dir);
      float edgeMask = smoothstep(0.08, 0.76, dist);
      float strength = uIntensity * carMask * (0.28 + edgeMask * 0.72);

      if (strength <= 0.0005) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      const int SAMPLES = 12;
      vec4 sum = vec4(0.0);
      float totalWeight = 0.0;

      for (int i = 0; i < SAMPLES; i++) {
        float stepFraction = (float(i) / float(SAMPLES - 1)) - 0.5;
        vec2 sampleUv = clamp(vUv + dir * stepFraction * strength, 0.0, 1.0);

        // Subtle peripheral chromatic dispersion scaled down near center car
        float chromatic = strength * 0.004 * float(i - 6) * smoothstep(uFocusRadius, uFocusRadius + 0.25, carDist);
        vec2 uvR = clamp(sampleUv + dir * chromatic, 0.0, 1.0);
        vec2 uvB = clamp(sampleUv - dir * chromatic, 0.0, 1.0);

        float r = texture2D(tDiffuse, uvR).r;
        float g = texture2D(tDiffuse, sampleUv).g;
        float b = texture2D(tDiffuse, uvB).b;
        float a = texture2D(tDiffuse, sampleUv).a;

        float weight = 1.0 - abs(stepFraction) * 0.45;
        sum += vec4(r, g, b, a) * weight;
        totalWeight += weight;
      }

      gl_FragColor = sum / totalWeight;
    }
  `,
};

function renderGoogleMapsManeuverIcon(maneuver: GpsManeuverType | undefined) {
  switch (maneuver) {
    case 'left':
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-white shrink-0" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 20V11a3 3 0 0 0-3-3H5" />
          <path d="M9 4 5 8l4 4" />
        </svg>
      );
    case 'slight_left':
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-white shrink-0" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 20v-6.5L7.5 6" />
          <path d="M7 12V5.5h6.5" />
        </svg>
      );
    case 'right':
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-white shrink-0" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 20V11a3 3 0 0 1 3-3h9" />
          <path d="m15 4 4 4-4 4" />
        </svg>
      );
    case 'slight_right':
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-white shrink-0" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 20v-6.5L16.5 6" />
          <path d="M17 12V5.5h-6.5" />
        </svg>
      );
    case 'uturn':
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-white shrink-0" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 19V9a4 4 0 0 0-8 0v8" />
          <path d="m5 14 3 3 3-3" />
        </svg>
      );
    case 'arrive':
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-white shrink-0" fill="currentColor">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
        </svg>
      );
    case 'straight':
    default:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-white shrink-0" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20V4" />
          <path d="m7 9 5-5 5 5" />
        </svg>
      );
  }
}

interface RaceViewProps {
  circuit: CircuitInfo;
  laps: number;
  season: SeasonState;
  onRaceComplete: (
    finishPosition: number,
    fastestLapTime: number,
    finishedDriversOrder?: string[],
    finalStandingsDetails?: {
      driver: Driver;
      position: number;
      finished: boolean;
      bestLapTime: number;
      gapToLeaderSeconds: number;
      gapToPlayerSeconds: number;
      leadOverP2Seconds: number;
    }[],
    didQuitMidRace?: boolean
  ) => void;
  onExitToPaddock: () => void;
  isPracticeMode?: boolean;
  practiceDifficulty?: 'rookie' | 'pro' | 'legend';
  practiceBotCount?: number;
  isMultiplayer?: boolean;
  multiplayerRoom?: RoomPublicState | null;
  onOpenControls?: () => void;
  isQualifyingMode?: boolean;
  qualifyingGhostDelay3s?: boolean;
  startingGridSlot?: number;
  onQualifyingComplete?: (
    gridSlot: number,
    lapTime: number,
    classification: Array<{ position: number; driver: Driver; team: Team; lapTime: number; gap: number }>
  ) => void;
  tutorialPracticeStage?: {
    id: string;
    title: string;
    subtitle: string;
    objectives: string[];
  } | null;
  onCompleteTutorialStage?: (stageId: string) => void;
  onRecordLaunchReaction?: (data: {
    reactionTimeMs: number | null;
    falseStart: boolean;
    jumpedEarlyByMs?: number | null;
  }) => void;
}

export const RaceView: React.FC<RaceViewProps> = ({
  circuit,
  laps,
  season,
  onRaceComplete,
  onExitToPaddock,
  isPracticeMode = false,
  practiceDifficulty,
  practiceBotCount = 19,
  isMultiplayer = false,
  multiplayerRoom = null,
  onOpenControls,
  isQualifyingMode = false,
  qualifyingGhostDelay3s = true,
  startingGridSlot,
  onQualifyingComplete,
  tutorialPracticeStage = null,
  onCompleteTutorialStage,
  onRecordLaunchReaction,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const physicsRef = useRef<PhysicsEngine | null>(null);

  const [cameraView, setCameraView] = useState<CameraView>('chase');
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [raceState, setRaceState] = useState<'countdown' | 'racing' | 'finished'>('countdown');
  const [lightsLit, setLightsLit] = useState(0);
  const [lightsExtinguished, setLightsExtinguished] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [controllerState, setControllerState] = useState({ connected: false, id: '' });
  const [yellowFlagActive, setYellowFlagActive] = useState(false);
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>(getStoredGraphicsQuality());
  const [liveFps, setLiveFps] = useState<number>(60);
  const [frameTimeMs, setFrameTimeMs] = useState<number>(16.7);
  const [dynamicQualityPct, setDynamicQualityPct] = useState<number>(() =>
    Math.round(getStoredDynamicGpuProfile(getStoredGraphicsQuality()).qualityScore * 100)
  );
  const [dynamicRenderScale, setDynamicRenderScale] = useState<number>(1.0);
  const [dynamicReflectionEvery, setDynamicReflectionEvery] = useState<number>(0);
  const [dynamicFeatureCombo, setDynamicFeatureCombo] = useState<string>(
    'Shadows ON · Refl OFF'
  );
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const [restartQualifyingKey, setRestartQualifyingKey] = useState<number>(0);
  const [isOpenFieldHudCollapsed, setIsOpenFieldHudCollapsed] = useState<boolean>(false);

  const handleSportsMinigameComplete = useCallback((cashEarned: number, summaryBanner: string) => {
    if (physicsRef.current) {
      physicsRef.current.completeSportsMinigame(cashEarned, summaryBanner);
      setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
    }
  }, []);

  const handleSportsMinigameAbort = useCallback(() => {
    if (physicsRef.current) {
      physicsRef.current.abortSportsMinigame();
      setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
    }
  }, []);

  const togglePause = (forceState?: boolean) => {
    if (physicsRef.current?.raceFinished) return;
    setIsPaused((prev) => {
      const next = forceState !== undefined ? forceState : !prev;
      isPausedRef.current = next;
      if (next) {
        soundEngine.stopAll();
      } else {
        soundEngine.resume();
      }
      return next;
    });
  };

  useEffect(() => {
    return onGraphicsQualityChange((q) => setGraphicsQuality(q));
  }, []);

  const [motionBlurEnabled, setMotionBlurEnabled] = useState<boolean>(() =>
    getStoredMotionBlur(getStoredGraphicsQuality())
  );
  const motionBlurEnabledRef = useRef<boolean>(motionBlurEnabled);
  useEffect(() => {
    motionBlurEnabledRef.current = motionBlurEnabled;
  }, [motionBlurEnabled]);

  useEffect(() => {
    return onMotionBlurChange((enabled) => {
      setMotionBlurEnabled(enabled);
      motionBlurEnabledRef.current = enabled;
    });
  }, []);

  // Strictly Practice Mode Only: Optimal Racing Line & Braking/Acceleration Assist + Live Bot Removal
  const isCityDrivingMode = circuit.id === 'city_driving_metro';
  const isOpenFieldMode = circuit.id === 'open_field_proving_ground' || isCityDrivingMode;
  const isStrictPracticeMode = Boolean(isPracticeMode && !isQualifyingMode && !isMultiplayer && !isOpenFieldMode);
  const [showPracticeRacingLine, setShowPracticeRacingLine] = useState<boolean>(isStrictPracticeMode);
  const [practiceLineCoach, setPracticeLineCoach] = useState<PracticeLineCoachData | null>(null);
  const [activePracticeBots, setActivePracticeBots] = useState<number>(isOpenFieldMode ? 0 : (practiceBotCount ?? 19));
  const [openFieldStats, setOpenFieldStats] = useState<PhysicsEngine['openFieldStats'] | null>(null);
  const [cityPursuitStats, setCityPursuitStats] = useState<PhysicsEngine['cityPursuitStats'] | null>(null);
  const [currentWeatherState, setCurrentWeatherState] = useState<GaithersburgWeather | null>(null);
  const [showWeatherSelector, setShowWeatherSelector] = useState<boolean>(false);
  const [cityHudTab, setCityHudTab] = useState<
    'scanner' | 'jobs' | 'heists' | 'houses' | 'missions' | 'garage' | 'dealership'
  >('scanner');
  const [showCityGarageModal, setShowCityGarageModal] = useState<boolean>(false);
  const [cityGarageModalTab, setCityGarageModalTab] = useState<'my_garage' | 'dealership' | 'real_estate'>('my_garage');
  const [showCityTabletModal, setShowCityTabletModal] = useState<boolean>(false);
  const [cityTabletTab, setCityTabletTab] = useState<
    'police' | 'missions' | 'jobs' | 'heists' | 'houses' | 'garage' | 'dealership' | 'graphics'
  >('police');
  const [isTacticalMapExpanded, setIsTacticalMapExpanded] = useState<boolean>(false);
  const [minimapZoom, setMinimapZoom] = useState<'local' | 'metro' | 'state'>('local');
  const [isMinimapHeadingUp, setIsMinimapHeadingUp] = useState<boolean>(true);
  const [mapThemeMode, setMapThemeMode] = useState<'auto' | 'light' | 'dark'>('auto');
  const [isVoiceNavMuted, setIsVoiceNavMuted] = useState<boolean>(false);
  const [gpsAddressQuery, setGpsAddressQuery] = useState<string>('');
  const [gpsDropdownOpen, setGpsDropdownOpen] = useState<boolean>(false);
  const gpsInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isCityDrivingMode) return;
    const tgt = cityPursuitStats?.minimapData?.gpsTarget;
    if (!tgt) {
      voiceNavigationService.updateProgress({ active: false });
      return;
    }
    voiceNavigationService.updateProgress({
      active: true,
      destLabel: tgt.label,
      maneuver: tgt.maneuver,
      nextRoadName: tgt.nextRoadName,
      distToTurnMeters: tgt.distToTurnMeters,
      totalRouteMeters: tgt.routeDistMeters ?? tgt.distMeters,
    });
  }, [
    isCityDrivingMode,
    cityPursuitStats?.minimapData?.gpsTarget?.label,
    cityPursuitStats?.minimapData?.gpsTarget?.maneuver,
    cityPursuitStats?.minimapData?.gpsTarget?.nextRoadName,
    cityPursuitStats?.minimapData?.gpsTarget?.distToTurnMeters,
    cityPursuitStats?.minimapData?.gpsTarget?.routeDistMeters,
  ]);

  useEffect(() => {
    return () => {
      voiceNavigationService.cancel();
    };
  }, []);

  const gpsSuggestions = useMemo(
    () => searchMarylandGpsDirectory(gpsAddressQuery),
    [gpsAddressQuery]
  );

  const handleSelectGpsEntry = (entry: MarylandGpsEntry) => {
    physicsRef.current?.setCityGpsTarget(entry.x, entry.z, `${entry.icon} ${entry.label}`, entry.color);
    if (physicsRef.current) {
      setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
    }
    setGpsAddressQuery(entry.address);
    setGpsDropdownOpen(false);
    gpsInputRef.current?.blur();
  };
  // Universal Widget Minimization & Custom Controls states ("make it so i can open and minimize anything i want")
  const [isCockpitMinimized, setIsCockpitMinimized] = useState<boolean>(false);
  const [isMinimapHidden, setIsMinimapHidden] = useState<boolean>(false);
  const [isRadarGunMinimized, setIsRadarGunMinimized] = useState<boolean>(false);
  const [isMissionHudMinimized, setIsMissionHudMinimized] = useState<boolean>(false);
  const [isApbHudMinimized, setIsApbHudMinimized] = useState<boolean>(false);
  const [isCinematicHudHidden, setIsCinematicHudHidden] = useState<boolean>(false);
  const [showControlsMappingModal, setShowControlsMappingModal] = useState<boolean>(false);
  const [showGoogleMapsModal, setShowGoogleMapsModal] = useState<boolean>(false);

  const openGoogleMapsModal = () => {
    setShowGoogleMapsModal(true);
    isPausedRef.current = true;
    soundEngine.stopAll();
  };

  const closeGoogleMapsModal = () => {
    setShowGoogleMapsModal(false);
    if (!isPaused) {
      isPausedRef.current = false;
      soundEngine.resume();
    }
  };

  const showPracticeRacingLineRef = useRef<boolean>(isStrictPracticeMode);
  useEffect(() => {
    showPracticeRacingLineRef.current = isStrictPracticeMode && showPracticeRacingLine;
  }, [isStrictPracticeMode, showPracticeRacingLine]);

  const handleSetPracticeBotCount = (count: number) => {
    setActivePracticeBots(count);
    if (isStrictPracticeMode && physicsRef.current) {
      physicsRef.current.setPracticeBotCount(count);
    }
  };

  // Stably memoize Player Team & Driver
  const playerTeam: Team = useMemo(() => {
    if (season.career.customTeam && season.selectedTeamId === season.career.customTeam.id) {
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
        baseSalary: 1000000,
      };
    }
    return TEAMS.find((t) => t.id === season.selectedTeamId) || TEAMS.find((t) => t.id === 'haas') || TEAMS[0];
  }, [season.selectedTeamId, season.career.customTeam]);

  // Robust username with spaces support ("allow me to add a space in my username"):
  const playerDriver: Driver = useMemo(() => {
    const rawName = season.career.driverName || 'Rookie Driver';
    const parts = rawName.trim().split(/\s+/);
    const shortCode = parts.length > 1
      ? ((parts[parts.length - 1].length >= 3 ? parts[parts.length - 1].slice(0, 3) : (parts[0][0] + parts[parts.length - 1])).toUpperCase())
      : (rawName.replace(/\s+/g, '').slice(0, 3).toUpperCase() || 'YOU');

    if (season.career.customTeam && season.selectedTeamId === season.career.customTeam.id) {
      return {
        id: season.selectedDriverId,
        name: rawName,
        shortName: shortCode,
        number: season.career.driverNumber,
        country: season.career.country,
        countryCode: season.career.countryCode,
        teamId: season.career.customTeam.id,
        rating: season.career.driverRating || 85,
        aggression: 0.85,
        color: season.career.customTeam.accentColor,
      };
    }
    const d = DRIVERS.find((drv) => drv.id === season.selectedDriverId);
    if (d) {
      return {
        ...d,
        name: rawName || d.name,
        shortName: shortCode,
        number: season.career.driverNumber || d.number,
        rating: season.career.driverRating || d.rating,
      };
    }
    return DRIVERS[0];
  }, [season.selectedDriverId, season.career]);

  const cameraViewRef = useRef<CameraView>('chase');
  useEffect(() => {
    cameraViewRef.current = cameraView;
  }, [cameraView]);

  const [garageCamAngle, setGarageCamAngle] = useState<'front34' | 'front' | 'side' | 'rear' | 'orbit'>('front34');
  const isGarageShowroomOpenRef = useRef<boolean>(false);
  const garageCamAngleRef = useRef<'front34' | 'front' | 'side' | 'rear' | 'orbit'>('front34');
  useEffect(() => {
    const isModalOpen = showCityTabletModal || showCityGarageModal;
    isGarageShowroomOpenRef.current =
      Boolean(isCityDrivingMode && isModalOpen && (cityTabletTab === 'garage' || cityTabletTab === 'dealership'));
  }, [isCityDrivingMode, showCityTabletModal, showCityGarageModal, cityTabletTab]);
  useEffect(() => {
    garageCamAngleRef.current = garageCamAngle;
  }, [garageCamAngle]);

  useEffect(() => {
    if (!containerRef.current) return;

    soundEngine.init();
    soundEngine.resume();
    const activePuIdentifier =
      season.career.customTeam && season.selectedTeamId === season.career.customTeam.id
        ? season.career.customTeam.isWorksEngine
          ? 'works_inhouse'
          : season.career.customTeam.engineId || season.career.customTeam.engine || 'works_inhouse'
        : playerTeam.engine || playerTeam.id;
    soundEngine.setEngineProfile(activePuIdentifier);

    const gfxPreset = getGraphicsPresetConfig(graphicsQuality);

    // 1. Scene, Camera, Renderer configured by GraphicsQuality preset
    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(circuit.skyColor);

    const camera = new THREE.PerspectiveCamera(
      66,
      width / height,
      0.1,
      isCityDrivingMode
        ? gfxPreset.id === 'retro_pixel'
          ? 760
          : gfxPreset.id === 'low'
          ? 820
          : 1350
        : gfxPreset.id === 'retro_pixel'
        ? 1050
        : gfxPreset.id === 'low'
        ? 1400
        : 2400
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: gfxPreset.antialias,
      powerPreference: 'high-performance',
    });
    const glCtx = renderer.getContext();
    const dbgRenderInfo = glCtx?.getExtension('WEBGL_debug_renderer_info');
    const gpuRendererStr = dbgRenderInfo
      ? String(glCtx.getParameter(dbgRenderInfo.UNMASKED_RENDERER_WEBGL) || '')
      : '';
    const isSoftwareGl = /SwiftShader|llvmpipe|Software/i.test(gpuRendererStr);

    const ultraPixelCap = width > 1600 ? 1.5 : 1.65;
    const basePresetPixelRatio =
      gfxPreset.id === 'ultra' ? Math.min(gfxPreset.maxPixelRatio, ultraPixelCap) : gfxPreset.maxPixelRatio;
    const initialPixelRatio = isSoftwareGl
      ? Math.min(1.0, basePresetPixelRatio)
      : Math.min(window.devicePixelRatio || 1, basePresetPixelRatio);

    renderer.setSize(width, height);
    renderer.setPixelRatio(initialPixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = gfxPreset.shadowsEnabled && !isSoftwareGl;
    if (renderer.shadowMap.enabled) {
      renderer.shadowMap.type = gfxPreset.useSoftShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    }
    const isHighOrUltra = gfxPreset.id === 'high' || gfxPreset.id === 'ultra';
    const isRetroAny = gfxPreset.id === 'retro' || gfxPreset.id === 'retro_pixel';
    renderer.toneMapping = isHighOrUltra ? THREE.AgXToneMapping : THREE.NoToneMapping;
    renderer.toneMappingExposure = gfxPreset.id === 'ultra' ? 1.03 : 1.0;

    // Apply crisp nearest-neighbor pixel upscaling ONLY for 'retro_pixel' (leave 'retro' completely untouched)
    renderer.domElement.style.imageRendering = gfxPreset.id === 'retro_pixel' ? 'pixelated' : 'auto';

    containerRef.current.appendChild(renderer.domElement);

    // Dynamic High-Fidelity Circuit Sky Dome
    let skyDomeMesh: THREE.Mesh | null = null;
    const skyRadius = 1900;
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 512;
    skyCanvas.height = 512;
    const sCtx = skyCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createLinearGradient(0, 0, 0, 512);
      if (isRetroAny) {
        // 90s OutRun / Virtua Racing Synthwave Horizon Sky
        grad.addColorStop(0, '#070214');
        grad.addColorStop(0.32, '#1b063b');
        grad.addColorStop(0.58, '#70115c');
        grad.addColorStop(0.78, '#ff2a85');
        grad.addColorStop(0.92, '#ff8800');
        grad.addColorStop(1.0, '#ffe600');
      } else if (circuit.id === 'abudhabi') {
        // Abu Dhabi Championship Twilight: Deep starry indigo -> Royal magenta -> Radiant amber sunset horizon
        grad.addColorStop(0, '#0a041f');
        grad.addColorStop(0.40, '#1c0836');
        grad.addColorStop(0.68, '#881337');
        grad.addColorStop(0.85, '#e11d48');
        grad.addColorStop(0.95, '#ea580c');
        grad.addColorStop(1.0, '#f59e0b');
      } else if (circuit.id === 'bahrain' || circuit.id === 'jeddah') {
        grad.addColorStop(0, '#030712');
        grad.addColorStop(0.55, '#0b132b');
        grad.addColorStop(0.88, '#1e293b');
        grad.addColorStop(1.0, '#334155');
      } else if (circuit.id === 'monaco') {
        grad.addColorStop(0, '#0284c7');
        grad.addColorStop(0.45, '#38bdf8');
        grad.addColorStop(0.82, '#bae6fd');
        grad.addColorStop(1.0, '#f0f9ff');
      } else if (circuit.id === 'spa') {
        grad.addColorStop(0, '#334155');
        grad.addColorStop(0.48, '#64748b');
        grad.addColorStop(0.82, '#94a3b8');
        grad.addColorStop(1.0, '#cbd5e1');
      } else if (circuit.id === 'monza') {
        grad.addColorStop(0, '#0369a1');
        grad.addColorStop(0.52, '#7dd3fc');
        grad.addColorStop(0.82, '#fde68a');
        grad.addColorStop(1.0, '#fed7aa');
      } else {
        grad.addColorStop(0, '#0284c7');
        grad.addColorStop(0.55, '#38bdf8');
        grad.addColorStop(0.88, '#e0f2fe');
        grad.addColorStop(1.0, '#f8fafc');
      }
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 512, 512);

      // Stars & Synthwave bands for Retro or twilight circuits
      if (isRetroAny) {
        sCtx.fillStyle = '#00f0ff';
        for (let s = 0; s < 220; s++) {
          const sx = Math.random() * 512;
          const sy = Math.random() * 260;
          sCtx.fillRect(sx, sy, gfxPreset.id === 'retro_pixel' ? 4 : 2, gfxPreset.id === 'retro_pixel' ? 4 : 2);
        }
        // Horizontal synthwave horizon scan stripes
        sCtx.fillStyle = 'rgba(20, 4, 48, 0.45)';
        for (let y = 340; y < 512; y += 14) {
          sCtx.fillRect(0, y, 512, 5);
        }
      } else if (circuit.timeOfDay === 'twilight' || circuit.id === 'abudhabi' || circuit.id === 'bahrain' || circuit.id === 'jeddah') {
        sCtx.fillStyle = '#ffffff';
        for (let s = 0; s < 240; s++) {
          const sx = Math.random() * 512;
          const sy = Math.random() * 320;
          const sr = Math.random() * 1.5 + 0.4;
          sCtx.beginPath();
          sCtx.arc(sx, sy, sr, 0, Math.PI * 2);
          sCtx.fill();
        }
      }

      const skyTex = new THREE.CanvasTexture(skyCanvas);
      skyTex.colorSpace = THREE.SRGBColorSpace;
      if (gfxPreset.id === 'retro_pixel') {
        skyTex.magFilter = THREE.NearestFilter;
        skyTex.minFilter = THREE.NearestFilter;
      }
      const skyGeom = new THREE.SphereGeometry(skyRadius, 32, 20);
      const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide });
      skyDomeMesh = new THREE.Mesh(skyGeom, skyMat);
      if (isCityDrivingMode) {
        skyDomeMesh.visible = false;
      }
      scene.add(skyDomeMesh);
    }

    let fogDensity = 0.0014;
    let hemiSky = 0xdbeafe;
    let hemiGround = 0x1e293b;
    let sunColor = 0xfffbeb;
    let sunIntensity = 1.65;

    if (isRetroAny) {
      hemiSky = 0xff2a85;
      hemiGround = 0x00f0ff;
      sunColor = 0xffe600;
      sunIntensity = 1.95;
      fogDensity = 0.0008;
    } else if (circuit.id === 'abudhabi') {
      hemiSky = 0x38bdf8;
      hemiGround = 0x451a03;
      sunColor = 0xff9e54;
      sunIntensity = 1.95;
      fogDensity = 0.0010;
    } else if (circuit.id === 'monaco') {
      hemiSky = 0xbae6fd;
      hemiGround = 0x0369a1;
      sunColor = 0xffffff;
      sunIntensity = 1.95;
      fogDensity = 0.0008;
    } else if (circuit.id === 'spa') {
      hemiSky = 0x94a3b8;
      hemiGround = 0x14532d;
      sunColor = 0xfef08a;
      sunIntensity = 1.55;
      fogDensity = 0.0020;
    } else if (circuit.id === 'monza') {
      hemiSky = 0x7dd3fc;
      hemiGround = 0x14532d;
      sunColor = 0xffedd5;
      sunIntensity = 1.8;
    }

    const activeSceneFog = new THREE.FogExp2(circuit.fogColor, fogDensity);
    scene.fog = activeSceneFog;

    // Physically Calibrated 360° PMREM Environment Reflections for High / Ultra Realistic
    let pmremGenerator: THREE.PMREMGenerator | null = null;
    let pmremRenderTarget: THREE.WebGLRenderTarget | null = null;
    const rebuildPmremEnvironment = (skyHex: number, sunHex: number, gndHex: number, glowAlpha = 0.45) => {
      if (!pmremGenerator) return;
      const envScene = new THREE.Scene();
      const envCanvas = document.createElement('canvas');
      envCanvas.width = 512;
      envCanvas.height = 256;
      const eCtx = envCanvas.getContext('2d');
      if (!eCtx) return;

      const skyCol = new THREE.Color(skyHex);
      const sunCol = new THREE.Color(sunHex);
      const gndCol = new THREE.Color(gndHex);
      const eGrad = eCtx.createLinearGradient(0, 0, 0, 256);
      // Photorealistic atmospheric zenith -> horizon scatter -> natural dark ground bounce
      eGrad.addColorStop(0.0, `#${skyCol.clone().multiplyScalar(0.55).getHexString()}`);
      eGrad.addColorStop(0.38, `#${skyCol.clone().multiplyScalar(0.92).getHexString()}`);
      eGrad.addColorStop(0.488, `#${sunCol.clone().lerp(skyCol, 0.42).getHexString()}`);
      eGrad.addColorStop(0.525, glowAlpha <= 0.15 ? '#05070c' : '#1b1f26');
      eGrad.addColorStop(1.0, `#${gndCol.clone().multiplyScalar(glowAlpha <= 0.15 ? 0.18 : 0.32).getHexString()}`);
      eCtx.fillStyle = eGrad;
      eCtx.fillRect(0, 0, 512, 256);

      if (glowAlpha > 0.18) {
        // Soft horizon atmospheric scattering band (zero artificial stripes!)
        const horizonBand = eCtx.createLinearGradient(0, 102, 0, 142);
        horizonBand.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
        horizonBand.addColorStop(0.46, `rgba(255, 248, 236, ${(glowAlpha * 0.65).toFixed(2)})`);
        horizonBand.addColorStop(0.56, `rgba(${Math.round(skyCol.r * 255)}, ${Math.round(skyCol.g * 255)}, ${Math.round(skyCol.b * 255)}, ${(glowAlpha * 0.45).toFixed(2)})`);
        horizonBand.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        eCtx.fillStyle = horizonBand;
        eCtx.fillRect(0, 102, 512, 40);

        // Natural solar aureole glow on sky dome
        const sunGlow = eCtx.createRadialGradient(256, 84, 4, 256, 84, 72);
        sunGlow.addColorStop(0, `rgba(255, 252, 240, ${Math.min(0.85, glowAlpha * 1.15).toFixed(2)})`);
        sunGlow.addColorStop(0.4, `rgba(255, 244, 220, ${(glowAlpha * 0.42).toFixed(2)})`);
        sunGlow.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        eCtx.fillStyle = sunGlow;
        eCtx.fillRect(180, 12, 152, 144);
      }

      const envDomeTex = new THREE.CanvasTexture(envCanvas);
      envDomeTex.colorSpace = THREE.SRGBColorSpace;
      const envSphere = new THREE.Mesh(
        new THREE.SphereGeometry(80, 32, 20),
        new THREE.MeshBasicMaterial({ map: envDomeTex, side: THREE.BackSide })
      );
      envScene.add(envSphere);

      const nextRT = pmremGenerator.fromScene(envScene, 0.035);
      if (pmremRenderTarget) {
        pmremRenderTarget.dispose();
      }
      pmremRenderTarget = nextRT;
      scene.environment = nextRT.texture;

      envSphere.geometry.dispose();
      (envSphere.material as THREE.MeshBasicMaterial).dispose();
      envDomeTex.dispose();
    };

    if (gfxPreset.useEnvironmentReflections) {
      pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileCubemapShader();
      rebuildPmremEnvironment(hemiSky, sunColor, hemiGround, 0.42);
    }

    // Calibrate direct vs ambient contrast for rich photorealistic shadow depth without crushing midtones
    const hemiIntensity = gfxPreset.id === 'ultra' ? 0.66 : gfxPreset.id === 'high' ? 0.64 : 0.92;
    const hemiLight = new THREE.HemisphereLight(hemiSky, hemiGround, hemiIntensity);
    scene.add(hemiLight);

    const baseAmbient = gfxPreset.id === 'ultra' ? 0.34 : gfxPreset.id === 'high' ? 0.38 : Math.max(0.68, circuit.ambientLight * 0.85);
    const ambientLight = new THREE.AmbientLight(0xffffff, baseAmbient);
    scene.add(ambientLight);

    const calibratedSunIntensity =
      gfxPreset.id === 'ultra'
        ? sunIntensity * 1.24
        : gfxPreset.id === 'high'
        ? sunIntensity * 1.12
        : sunIntensity;
    const sunLight = new THREE.DirectionalLight(sunColor, calibratedSunIntensity);
    sunLight.castShadow = renderer.shadowMap.enabled;
    if (renderer.shadowMap.enabled) {
      sunLight.shadow.mapSize.width = gfxPreset.shadowMapSize;
      sunLight.shadow.mapSize.height = gfxPreset.shadowMapSize;
      const shadowRange = gfxPreset.id === 'ultra' ? 64 : isCityDrivingMode ? 80 : 78;
      sunLight.shadow.camera.left = -shadowRange;
      sunLight.shadow.camera.right = shadowRange;
      sunLight.shadow.camera.top = shadowRange;
      sunLight.shadow.camera.bottom = -shadowRange;
      sunLight.shadow.camera.near = 2;
      sunLight.shadow.camera.far = 230;
      sunLight.shadow.bias = -0.00022;
      sunLight.shadow.normalBias = 0.018;
      sunLight.shadow.radius = gfxPreset.id === 'ultra' ? 2.2 : 2.0;
    }
    scene.add(sunLight);
    scene.add(sunLight.target);

    // 3-Point Rim & Specular Fill Directional Light
    const baseRimIntensity = gfxPreset.id === 'ultra' ? 0.52 : gfxPreset.id === 'high' ? 0.56 : 0.72;
    let rimLight: THREE.DirectionalLight | null = null;
    if (gfxPreset.enableRimAndFillLights) {
      rimLight = new THREE.DirectionalLight(
        circuit.id === 'abudhabi' ? 0x38bdf8 : 0xdbeafe,
        baseRimIntensity
      );
      rimLight.castShadow = false;
      scene.add(rimLight);
      scene.add(rimLight.target);
    }

    // 4. Generate Circuit Mesh scaled by GraphicsQuality
    const track = generateTrack(circuit, graphicsQuality);
    scene.add(track.group);

    // 4b. Practice Mode ONLY: 3D Optimal Racing Line & Braking/Acceleration Indicators
    let practiceRacingLine: BuiltRacingLine | null = null;
    if (isStrictPracticeMode) {
      practiceRacingLine = buildPracticeRacingLine(track);
      practiceRacingLine.group.visible = showPracticeRacingLineRef.current;
      scene.add(practiceRacingLine.group);
    }

    // 5. Build Player F1 Car scaled by GraphicsQuality
    const playerCar = buildF1Car(playerTeam, playerDriver, graphicsQuality);
    scene.add(playerCar.root);

    // 5b. Weather Atmosphere, Sky/Sun/Clouds & Ultra-Realistic Tire Rain/Snow Spray Particles (Maryland City Mode)
    let tireSpraySys: TireSpraySystem | null = null;
    let weatherAtmosphereSys: AtmosphericWeatherSystem | null = null;
    let skyCelestialSys: SkyCelestialAndCloudsSystem | null = null;
    if (isCityDrivingMode) {
      const isRetroPixelGfx = gfxPreset.id === 'retro_pixel';
      tireSpraySys = createTireSpraySystem(scene, { isRetroPixel: isRetroPixelGfx });
      weatherAtmosphereSys = createAtmosphericWeatherSystem(scene, { isRetroPixel: isRetroPixelGfx });
      skyCelestialSys = createSkyCelestialAndCloudsSystem(scene, { isRetroPixel: isRetroPixelGfx });
    }

    let composer: EffectComposer | null = null;
    let bloomPassRef: UnrealBloomPass | null = null;
    let motionBlurPass: ShaderPass | null = null;
    let planarReflectionRT: THREE.WebGLRenderTarget | null = null;
    let reflectionCamera: THREE.PerspectiveCamera | null = null;
    let currentRoadWetness = 0.0;

    if ((gfxPreset.id === 'ultra' || gfxPreset.id === 'high') && !isSoftwareGl) {
      const reflScale = gfxPreset.id === 'ultra' ? 0.45 : 0.35;
      planarReflectionRT = new THREE.WebGLRenderTarget(
        Math.max(256, Math.floor(width * reflScale)),
        Math.max(192, Math.floor(height * reflScale)),
        {
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          colorSpace: THREE.NoColorSpace,
          type: gfxPreset.id === 'ultra' ? THREE.HalfFloatType : THREE.UnsignedByteType,
        }
      );
      reflectionCamera = new THREE.PerspectiveCamera(camera.fov, width / height, 0.1, 1600);
      track.setReflectionTexture(planarReflectionRT.texture, gfxPreset.id === 'ultra' ? 0.20 : 0.12);
      track.setRoadWetness?.(0.0);
    }
    const reflectionBgColor = new THREE.Color(0x020308);

    // Dynamic composer factory: creates passes when Ultra HDR bloom OR Motion Blur is active
    const initComposer = (): EffectComposer => {
      if (composer) return composer;
      const isUltra = gfxPreset.id === 'ultra';
      const pixelRatio = renderer.getPixelRatio();
      const rtWidth = Math.max(1, Math.floor(width * pixelRatio));
      const rt = new THREE.WebGLRenderTarget(rtWidth, Math.max(1, Math.floor(height * pixelRatio)), {
        samples: isUltra && rtWidth < 1950 && !isSoftwareGl ? 2 : 0,
        type: isUltra ? THREE.HalfFloatType : THREE.UnsignedByteType,
      });
      const effectivePixelRatio =
        !isUltra && motionBlurEnabledRef.current
          ? Math.min(1.15, pixelRatio * 0.85)
          : pixelRatio;
      composer = new EffectComposer(renderer, rt);
      composer.setSize(width, height);
      composer.setPixelRatio(effectivePixelRatio);

      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      if (isUltra && !isSoftwareGl) {
        bloomPassRef = new UnrealBloomPass(
          new THREE.Vector2(Math.floor(width * 0.5), Math.floor(height * 0.5)),
          0.16, // tight photoreal HDR bloom exclusively on headlights, brake LEDs, and sun glints
          0.38,
          1.08
        );
        composer.addPass(bloomPassRef);
      }

      motionBlurPass = new ShaderPass(MotionBlurShader);
      motionBlurPass.enabled = motionBlurEnabledRef.current;
      composer.addPass(motionBlurPass);

      const outputPass = new OutputPass();
      composer.addPass(outputPass);
      return composer;
    };

    if ((gfxPreset.id === 'ultra' && !isSoftwareGl) || motionBlurEnabledRef.current) {
      initComposer();
    }

    // 6. Initialize Physics & Competitors (Honoring zero bots when requested)
    const effectiveDifficulty = practiceDifficulty || season.difficulty || 'pro';
    const physics = new PhysicsEngine(
      playerCar,
      track,
      laps,
      playerDriver.id,
      effectiveDifficulty,
      playerTeam,
      season.career.customTeam
    );

    // If multiplayer specifies botCount, pass it directly (so 0 bots spawns exactly 0 AI cars)
    const effectiveBotCount = isOpenFieldMode
      ? 0
      : (isMultiplayer && multiplayerRoom)
      ? multiplayerRoom.botCount
      : undefined;

    physics.initGrid(
      playerDriver.id,
      (team, driver) => {
        const aiCar = buildF1Car(team, driver, graphicsQuality);
        scene.add(aiCar.root);
        return aiCar;
      },
      {
        botCount: effectiveBotCount,
        hasTeammates: isOpenFieldMode ? false : (isMultiplayer && multiplayerRoom ? (effectiveBotCount === 0 ? false : multiplayerRoom.hasTeammates) : true),
        playerGridSlot: isQualifyingMode ? 1 : startingGridSlot,
        isQualifyingMode: Boolean(isQualifyingMode),
        qualifyingGhostDelay3s: Boolean(qualifyingGhostDelay3s),
      }
    );
    if (isStrictPracticeMode) {
      physics.setPracticeBotCount(practiceBotCount ?? 19);
    }
    if (isCityDrivingMode) {
      const initCarId = physics.cityPursuitStats.currentStreetCar.id;
      const initTrimId = physics.cityPursuitStats.activeTrimByCar[initCarId];
      soundEngine.setStreetCarEngineProfile(initCarId, initTrimId);
      try {
        const pendingRaw = localStorage.getItem('apex26_pending_md_gps');
        if (pendingRaw) {
          localStorage.removeItem('apex26_pending_md_gps');
          const pending = JSON.parse(pendingRaw) as { x?: number; z?: number; label?: string };
          if (typeof pending.x === 'number' && typeof pending.z === 'number' && pending.label) {
            physics.setCityGpsTarget(pending.x, pending.z, pending.label, '#38bdf8');
          }
        }
      } catch {}
    }
    physicsRef.current = physics;

    // Clean non-obstructive T-Cam marker for multiplayer rivals (never blocks camera lens)
    const createRemotePlayer3DBeacon = (_name: string, _carNum: number, teamColor: string) => {
      const beaconGroup = new THREE.Group();
      const haloGeom = new THREE.BoxGeometry(0.32, 0.045, 0.08);
      const haloMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(teamColor || '#ff2222'),
      });
      const haloMesh = new THREE.Mesh(haloGeom, haloMat);
      haloMesh.position.set(0, 1.06, 0.15);
      beaconGroup.add(haloMesh);

      return { group: beaconGroup, halo: haloMesh };
    };

    // Multiplayer Human Rivals Visualization with Dead-Reckoning smoothing
    const humanRivalCars = new Map<string, {
      car: ReturnType<typeof buildF1Car>;
      targetPos: THREE.Vector3;
      currentPos: THREE.Vector3;
      heading: number;
      targetHeading: number;
      speedKmh: number;
      lastPacketTime: number;
      haloMesh: THREE.Mesh;
    }>();

    const spawnRivalCar = (p: { id: string; name: string; carNumber: number; teamId?: string; teamColor?: string; accentColor?: string; gridSlot?: number }) => {
      const rivalTeam: Team = {
        id: p.teamId || 'rival',
        name: p.name,
        shortName: p.name.slice(0, 3).toUpperCase(),
        engine: 'F1 Turbo Hybrid',
        primaryColor: p.teamColor || '#ff4444',
        secondaryColor: '#111111',
        accentColor: p.accentColor || '#ffffff',
        performanceTier: 1,
        drivers: [p.id, p.id] as [string, string],
        reputationRequired: 0,
        baseSalary: 1000000,
      };
      const rivalDriver: Driver = {
        id: p.id,
        name: p.name,
        shortName: p.name.slice(0, 3).toUpperCase(),
        number: p.carNumber || 99,
        teamId: rivalTeam.id,
        country: 'World',
        countryCode: 'UN',
        rating: 88,
        aggression: 0.85,
        color: p.teamColor || '#ff4444',
      };
      const rivalCar = buildF1Car(rivalTeam, rivalDriver, graphicsQuality);
      const beacon = createRemotePlayer3DBeacon(p.name, p.carNumber || 99, p.teamColor || '#ff4444');
      rivalCar.root.add(beacon.group);
      scene.add(rivalCar.root);

      const startPt = track.getTrackPointAtProgress(0.002 * (p.gridSlot || 2));
      rivalCar.root.position.copy(startPt.position);
      const entry = {
        car: rivalCar,
        targetPos: startPt.position.clone(),
        currentPos: startPt.position.clone(),
        heading: 0,
        targetHeading: 0,
        speedKmh: 0,
        lastPacketTime: performance.now(),
        haloMesh: beacon.halo,
      };
      humanRivalCars.set(p.id, entry);
      return entry;
    };

    if (isMultiplayer && multiplayerRoom) {
      const localId = multiplayerService.getLocalPlayerId();
      multiplayerRoom.players.forEach((p) => {
        if (p.id !== localId) {
          spawnRivalCar(p);
        }
      });
    }

    const unsubTelemetry = isMultiplayer
      ? multiplayerService.onTelemetry((sync) => {
          let rival = humanRivalCars.get(sync.playerId);
          if (!rival) {
            // Dynamically instantiate rival if telemetry arrives from late-joining peer
            const peerPlayer = multiplayerRoom?.players.find((p) => p.id === sync.playerId);
            rival = spawnRivalCar({
              id: sync.playerId,
              name: peerPlayer?.name || 'Rival Driver',
              carNumber: peerPlayer?.carNumber || 99,
              teamColor: peerPlayer?.teamColor || '#ff3b30',
              accentColor: peerPlayer?.accentColor || '#ffffff',
            });
          }

          if (rival) {
            const now = performance.now();
            rival.speedKmh = sync.speedKmh || 0;
            rival.lastPacketTime = now;

            if (sync.x !== undefined && sync.z !== undefined) {
              rival.targetPos.set(sync.x, (sync.y ?? 0) + 0.08, sync.z);
              if (sync.heading !== undefined) {
                rival.targetHeading = sync.heading;
              }
            } else {
              const trackPt = track.getTrackPointAtProgress(sync.progress);
              rival.targetPos.copy(trackPt.position).addScaledVector(trackPt.normal, sync.lateralOffset);
              rival.targetPos.y = trackPt.position.y + 0.08;
              const fwd = trackPt.tangent;
              rival.targetHeading = Math.atan2(-fwd.x, -fwd.z);
            }
          }
        })
      : () => {};

    const currentCamPos = new THREE.Vector3();
    const currentLookAt = new THREE.Vector3();

    // Pre-warm WebGL shaders before the countdown starts so Frame 1 has zero shader-compile stutter
    try {
      renderer.compile(scene, camera);
    } catch {
      // Ignore if context is still initializing
    }

    // 7. Uncapped Render Loop with Dual Dynamic Governors (Conservative Dynamic vs Aggressive Dynamic)
    let lastTime = performance.now();
    let animFrameId: number;
    let lastUiUpdateTime = 0;
    let lastTelemetrySendTime = 0;
    let raceCompleteNotified = false;
    let launchReactionNotified = false;
    let frameCount = 0;

    const isDynamicMode = isDynamicGraphics(gfxPreset.id);
    const isConservativeDynamic = gfxPreset.id === 'dynamic_conservative';
    const isAggressiveDynamic = gfxPreset.id === 'dynamic_aggressive';

    const storedGpuProfile = getStoredDynamicGpuProfile(gfxPreset.id);
    let fpsSampleFrames = 0;
    let lastFpsSampleTime = performance.now();
    let dynamicQualityFactor = storedGpuProfile.qualityScore;
    let preferShadowsOverReflections = storedGpuProfile.preferShadowsOverReflections;
    let appliedPixelRatio = renderer.getPixelRatio();
    let dynamicReflectionCadence = isAggressiveDynamic ? 4 : 0;
    let shadowComboAvgFps = 60;
    let reflComboAvgFps = 60;
    let lastEmergencyDropFrame = -999;

    // Universal Device Struggle Governor (works on ALL quality presets to reduce chunk load automatically)
    let struggleChunkScale = 1.0;
    let emaFrameMs = 16.0;
    let struggleGoodWindows = 0;
    let baseNonDynamicFar = camera.far;
    let cityEnvLastElevDeg = -999;
    let cityEnvLastCond = '';
    let cityEnvLastRebuildTime = -9999;

    const applyContinuousDynamicQuality = (q: number, persistProfile = false) => {
      const minAllowedQ = isConservativeDynamic ? 0.05 : 0.08;
      const clampedQ = Math.max(minAllowedQ, Math.min(1.0, q));
      dynamicQualityFactor = clampedQ;

      // 1. Crisp Native Resolution Lock (NEVER Pixelated!):
      // "dont make conservative dynamic pixelated make it better"
      // Both Conservative Dynamic and Aggressive Dynamic keep pixel ratio >= 1.0x so the car, road, and curbs are ALWAYS 100% razor-sharp!
      // Instead of blurring/pixelating the screen, Conservative Dynamic hits 60+ FPS purely via draw-call, scenery, fog, and LOD distance culling.
      const devicePR = window.devicePixelRatio || 1;
      const desiredScale = isAggressiveDynamic
        ? clampedQ >= 0.78
          ? Math.min(devicePR, 1.4)
          : clampedQ >= 0.45
          ? Math.min(devicePR, 1.2)
          : Math.min(devicePR, 1.0)
        : clampedQ >= 0.72
        ? Math.min(devicePR, 1.15)
        : Math.min(devicePR, 1.0);

      const targetScale = Math.max(1.0, Math.round(desiredScale / 0.05) * 0.05);
      if (Math.abs(targetScale - appliedPixelRatio) >= 0.04) {
        appliedPixelRatio = Number(targetScale.toFixed(2));
        renderer.setPixelRatio(appliedPixelRatio);
      }

      // 2. Smart Scenery, Sky, Fog & Distance Culling Matrix (Zero Pixelation!):
      const sceneryCullThreshold = isAggressiveDynamic ? 0.22 : 0.62;
      const showOuterScenery = clampedQ >= sceneryCullThreshold;
      if (track.sceneryGroup && !track.isCityDriving && track.sceneryGroup.visible !== showOuterScenery) {
        track.sceneryGroup.visible = showOuterScenery;
      }

      const showSkyAndFog = isAggressiveDynamic ? clampedQ >= 0.14 : clampedQ >= 0.32;
      if (skyDomeMesh && skyDomeMesh.visible !== (!isCityDrivingMode && showSkyAndFog)) {
        skyDomeMesh.visible = !isCityDrivingMode && showSkyAndFog;
      }
      scene.fog = isCityDrivingMode || showSkyAndFog ? activeSceneFog : null;

      let comboLabel = 'Crisp 60+ FPS';
      if (isConservativeDynamic) {
        if (clampedQ < 0.25) {
          comboLabel = 'Crisp 1.0x · Max LOD Cull';
        } else if (clampedQ < 0.62) {
          comboLabel = 'Crisp 1.0x · Fast Track';
        } else {
          comboLabel = 'Crisp HD · 60+ FPS';
        }
      } else {
        if (clampedQ >= 0.65) {
          comboLabel = 'High Visuals · Full Scenery';
        } else if (clampedQ >= 0.35) {
          comboLabel = 'Balanced Visuals · Smooth Floor';
        } else {
          comboLabel = 'Playable Floor Guard (Scenery OFF)';
        }
      }

      dynamicReflectionCadence = 0;

      // 3. Continuous Camera Draw Distance (culls distant geometry without lowering screen resolution)
      // In City Driving Mode, preserve far >= 700 so the R=620 atmospheric sky dome and R=540 Sun are never clipped
      const rawFar = showOuterScenery
        ? Math.round(780 + clampedQ * 720)
        : isConservativeDynamic && clampedQ < 0.30
        ? Math.round(340 + clampedQ * 420)
        : Math.round(460 + clampedQ * 520);
      const targetFar = isCityDrivingMode ? Math.max(700, rawFar) : rawFar;
      if (Math.abs(camera.far - targetFar) > 30) {
        camera.far = targetFar;
        camera.updateProjectionMatrix();
      }

      // 4. Rim / Specular Fill Light
      if (rimLight) {
        const rimFactor = Math.max(0, Math.min(1, (clampedQ - 0.50) / 0.50));
        rimLight.visible = rimFactor > 0.02;
        rimLight.intensity = rimFactor * 0.9;
      }

      setDynamicQualityPct(Math.max(5, Math.round(clampedQ * 100)));
      setDynamicRenderScale(Number(appliedPixelRatio.toFixed(2)));
      setDynamicReflectionEvery(0);
      setDynamicFeatureCombo(comboLabel);

      if (persistProfile) {
        setStoredDynamicGpuProfile(
          {
            qualityScore: Number(clampedQ.toFixed(3)),
            preferShadowsOverReflections,
          },
          gfxPreset.id
        );
      }
    };

    if (isDynamicMode) {
      applyContinuousDynamicQuality(dynamicQualityFactor, false);
    }

    // Pre-allocated camera scratch vectors for zero-GC 60-240Hz render loop
    const scratchForward = new THREE.Vector3();
    const scratchUp = new THREE.Vector3(0, 1, 0);
    const scratchTrackAhead = new THREE.Vector3();
    const scratchTargetCamPos = new THREE.Vector3();
    const scratchTargetLook = new THREE.Vector3();
    const scratchExtrapolated = new THREE.Vector3();
    const scratchGarageRight = new THREE.Vector3();
    const scratchCarProj = new THREE.Vector3();
    const cityTrafficProjMatrix = new THREE.Matrix4();
    const cityTrafficFrustum = new THREE.Frustum();
    const cityTrafficSphere = new THREE.Sphere(new THREE.Vector3(), 4.2);

    const renderLoop = (time: number) => {
      animFrameId = requestAnimationFrame(renderLoop);

      // FULLSCREEN MINIGAME GPU SUSPEND: Skip all 3D scene/shadow/reflection GPU draw calls until player exits
      const inFullscreenMinigame = Boolean(
        physics.cityPursuitStats.activeBankMinigameTarget ||
          physics.cityPursuitStats.activeLockpickTarget ||
          physics.cityPursuitStats.activeSportsMinigame
      );
      if (inFullscreenMinigame) {
        lastTime = time;
        lastFpsSampleTime = time;
        fpsSampleFrames = 0;
        return;
      }

      frameCount++;
      fpsSampleFrames++;

      const rawDelta = (time - lastTime) / 1000;
      lastTime = time;

      // PAUSE STATE: Freeze all physics, countdowns, timers, and AI movement while keeping the 3D scene rendered
      if (isPausedRef.current) {
        lastFpsSampleTime = time;
        fpsSampleFrames = 0;
        const isUltra = gfxPreset.id === 'ultra';
        const useComposer = isUltra || motionBlurEnabledRef.current;
        if (useComposer) {
          const comp = initComposer();
          if (motionBlurPass) {
            motionBlurPass.enabled = motionBlurEnabledRef.current;
            motionBlurPass.uniforms.uIntensity.value = 0.0;
          }
          comp.render(0);
        } else {
          renderer.render(scene, camera);
        }
        return;
      }

      const singleFrameMs = rawDelta * 1000;

      // Update rolling frame-time EMA for universal chunk-load struggle detection
      if (frameCount >= 3 && rawDelta > 0.001 && rawDelta < 0.25) {
        emaFrameMs = emaFrameMs * 0.90 + singleFrameMs * 0.10;
      }

      // INSTANT PER-FRAME GOVERNOR (Reacts on the exact nanosecond a single frame drops below target before rendering):
      if (isDynamicMode && frameCount >= 2 && rawDelta > 0.001 && rawDelta < 0.25) {
        if (isConservativeDynamic && singleFrameMs > 16.45) {
          // CONSERVATIVE DYNAMIC INSTANT 60+ FPS GUARD:
          // The nanosecond a single frame exceeds 16.45ms (< 60.8 FPS), immediately slash GPU load (all the way down to 1% Potato mode if needed!) BEFORE rendering!
          lastEmergencyDropFrame = frameCount;
          const instantDrop =
            singleFrameMs > 23.0
              ? 0.55
              : singleFrameMs > 19.0
              ? 0.36
              : singleFrameMs > 17.2
              ? 0.22
              : 0.12;
          applyContinuousDynamicQuality(dynamicQualityFactor - instantDrop, false);
        } else if (isAggressiveDynamic && singleFrameMs > 23.0) {
          // AGGRESSIVE DYNAMIC HARD PLAYABILITY FLOOR GUARD (Never allow drops into 20–30 FPS):
          lastEmergencyDropFrame = frameCount;
          const instantDrop =
            singleFrameMs > 30.0
              ? 0.44
              : singleFrameMs > 26.0
              ? 0.28
              : 0.15;
          applyContinuousDynamicQuality(dynamicQualityFactor - instantDrop, false);
        }
      }

      // Multi-frame sample window for telemetry readout, struggle-based chunk reduction & smooth steady-state tuning
      const fpsElapsed = time - lastFpsSampleTime;
      const sampleWindowMs = isConservativeDynamic
        ? 45
        : isAggressiveDynamic
        ? 95
        : 140;

      if (fpsElapsed >= sampleWindowMs && fpsSampleFrames >= 2) {
        const exactFps = (fpsSampleFrames * 1000) / fpsElapsed;
        const measuredFps = Math.max(1, Math.round(exactFps));
        const measuredMs = Number(
          (fpsElapsed / Math.max(1, fpsSampleFrames)).toFixed(1)
        );
        setLiveFps(measuredFps);
        setFrameTimeMs(measuredMs);
        fpsSampleFrames = 0;
        lastFpsSampleTime = time;

        // Universal Device Struggle Detection: automatically sheds distant chunks & heavy draw load when device lags
        if (frameCount >= 12) {
          if (emaFrameMs > 21.2 || exactFps < 45.0) {
            struggleGoodWindows = 0;
            const drop = exactFps < 30 ? 0.14 : exactFps < 38 ? 0.09 : 0.055;
            struggleChunkScale = Math.max(0.25, struggleChunkScale - drop);
          } else if (emaFrameMs < 16.4 && exactFps >= 57.5) {
            struggleGoodWindows++;
            if (struggleGoodWindows >= 10 && struggleChunkScale < 1.0) {
              struggleChunkScale = Math.min(1.0, struggleChunkScale + 0.025);
            }
          } else {
            struggleGoodWindows = Math.max(0, struggleGoodWindows - 1);
          }

          if (!isDynamicMode && isCityDrivingMode) {
            const desiredFar = Math.max(600, Math.round(baseNonDynamicFar * (0.52 + 0.48 * struggleChunkScale)));
            if (Math.abs(camera.far - desiredFar) > 45) {
              camera.far = desiredFar;
              camera.updateProjectionMatrix();
            }
            if (gfxPreset.id === 'ultra' || gfxPreset.id === 'high') {
              const desiredPR =
                struggleChunkScale < 0.72
                  ? Math.max(1.0, Number((initialPixelRatio * (0.72 + 0.28 * struggleChunkScale)).toFixed(2)))
                  : initialPixelRatio;
              if (Math.abs(renderer.getPixelRatio() - desiredPR) > 0.08) {
                renderer.setPixelRatio(desiredPR);
                composer?.setPixelRatio(desiredPR);
              }
              if (bloomPassRef) {
                bloomPassRef.enabled = struggleChunkScale >= 0.44;
              }
            }
          }
        }

        if (isConservativeDynamic && frameCount >= 2) {
          // CONSERVATIVE DYNAMIC:
          // Does whatever it takes to stay >= 60 FPS at all times, dropping down to 1% Potato mode if needed.
          const guardFps = 61.5;
          if (exactFps < guardFps || measuredMs > 16.25) {
            lastEmergencyDropFrame = frameCount;
            const deficit = Math.max(1, guardFps - exactFps);
            const urgentDrop =
              exactFps < 55 || measuredMs > 18.0
                ? 0.32
                : exactFps < 59.8
                ? 0.18
                : 0.09;
            const dropAmount = Math.min(
              0.55,
              Math.max(0.08, (deficit / 60) * 1.25 + urgentDrop)
            );
            applyContinuousDynamicQuality(dynamicQualityFactor - dropAmount, true);
          } else if (
            frameCount - lastEmergencyDropFrame > 110 &&
            exactFps >= 63.0 &&
            measuredMs <= 15.8 &&
            dynamicQualityFactor < 1.0
          ) {
            // Very cautious upward step (+0.5%) only when effortlessly holding 63+ FPS
            applyContinuousDynamicQuality(dynamicQualityFactor + 0.005, true);
          }
        } else if (isAggressiveDynamic && frameCount >= 3) {
          // AGGRESSIVE DYNAMIC:
          // Prioritizes visual quality in the 46–60+ FPS zone, with a hard playable floor at 43.5 FPS so it NEVER drops to 20–30 FPS!
          const playableFloorFps = 43.8;
          const qualityTargetFps = 50.5;
          if (exactFps < playableFloorFps || measuredMs > 22.8) {
            lastEmergencyDropFrame = frameCount;
            const deficit = Math.max(2, playableFloorFps - exactFps);
            const dropAmount = Math.min(
              0.35,
              Math.max(0.14, (deficit / 45) * 0.70 + (exactFps < 36 ? 0.18 : 0.09))
            );
            applyContinuousDynamicQuality(dynamicQualityFactor - dropAmount, true);
          } else if (exactFps < qualityTargetFps || measuredMs > 19.8) {
            const deficit = Math.max(1, qualityTargetFps - exactFps);
            const dropAmount = Math.min(0.09, Math.max(0.025, (deficit / 60) * 0.28));
            applyContinuousDynamicQuality(dynamicQualityFactor - dropAmount, true);
          } else if (
            frameCount - lastEmergencyDropFrame > 45 &&
            exactFps >= 55.5 &&
            measuredMs <= 18.0 &&
            dynamicQualityFactor < 1.0
          ) {
            applyContinuousDynamicQuality(dynamicQualityFactor + 0.02, true);
          }
        }
      }

      // Uncapped native delta time: supports 60Hz, 120Hz, 144Hz, 240Hz, 360Hz+ with zero artificial frame-rate cap
      const delta = Math.min(0.05, Math.max(0.0002, rawDelta));

      // Update multiplayer rival positions with high-framerate dead-reckoning extrapolation
      if (isMultiplayer) {
        humanRivalCars.forEach((rival) => {
          const timeSincePacket = Math.max(0, (time - rival.lastPacketTime) / 1000);
          const extrapolated = scratchExtrapolated.copy(rival.targetPos);

          // Dead reckoning forward projection (prevents stutter between network packets)
          if (timeSincePacket > 0.005 && timeSincePacket < 0.6 && Math.abs(rival.speedKmh) > 5) {
            const fwdX = -Math.sin(rival.targetHeading);
            const fwdZ = -Math.cos(rival.targetHeading);
            const speedMs = rival.speedKmh / 3.6;
            extrapolated.x += fwdX * speedMs * timeSincePacket;
            extrapolated.z += fwdZ * speedMs * timeSincePacket;
          }

          // Smooth exponential lerp
          const lerpFactor = Math.min(1.0, delta * 18.0);
          rival.currentPos.lerp(extrapolated, lerpFactor);
          rival.car.root.position.copy(rival.currentPos);

          // Smooth angular interpolation
          let diffHeading = rival.targetHeading - rival.heading;
          while (diffHeading > Math.PI) diffHeading -= Math.PI * 2;
          while (diffHeading < -Math.PI) diffHeading += Math.PI * 2;
          rival.heading += diffHeading * Math.min(1.0, delta * 15.0);
          rival.car.root.rotation.y = rival.heading;

          // Wheel spin & halo rotation
          rival.car.setWheelSpin(rival.speedKmh, delta);
          rival.haloMesh.rotation.z += delta * 2.5;
        });

        // Send local player telemetry every 50ms with pinpoint 3D coordinates & heading
        if (time - lastTelemetrySendTime > 50) {
          lastTelemetrySendTime = time;
          multiplayerService.sendTelemetry({
            progress: physics.playerProgress,
            lap: physics.playerLap || physics.telemetry?.currentLap || 1,
            speedKmh: physics.playerSpeedKmh,
            lateralOffset: physics.track.checkSurfaceType(physics.playerPos, physics.playerProgress).lateralOffset || 0,
            position: physics.telemetry?.position || 1,
            x: physics.playerPos.x,
            y: physics.playerPos.y,
            z: physics.playerPos.z,
            heading: physics.playerHeading,
          });
        }
      }

      // Poll Unified Input
      const input = inputManager.poll();

      if (input.switchCamera) {
        if (
          isCityDrivingMode &&
          physics.cityPursuitStats.civilianAtFaultClaim?.active &&
          physics.cityPursuitStats.civilianAtFaultClaim.status === 'CAN_CALL_COPS'
        ) {
          physics.callCopsOnAtFaultCivilian();
          setCityPursuitStats({ ...physics.cityPursuitStats });
        } else {
          setCameraView((prev) => {
            const views: CameraView[] = ['chase', 'close', 'cockpit', 'nose'];
            return views[(views.indexOf(prev) + 1) % views.length];
          });
        }
      }

      // Teammate strategy order controls (1: Block Pack, 2: Yield Position, 3: Push, 4: Free)
      // Disabled in Metro City driving mode to keep City controls completely separate from F1
      if (!isCityDrivingMode) {
        if (input.orderBlock) {
          physics.issueTeamOrder('block');
        }
        if (input.orderYield) {
          physics.issueTeamOrder('yield');
        }
        if (input.orderPush) {
          physics.issueTeamOrder('push');
        }
        if (input.orderNeutral) {
          physics.issueTeamOrder('neutral');
        }
      }

      // Update Physics Simulation
      physics.update(delta, input);

      // Update Practice Mode 3D Optimal Racing Line & Braking/Acceleration Chevrons (ONLY in Practice Mode)
      let latestCoachCue: PracticeLineCoachData | null = null;
      if (practiceRacingLine && isStrictPracticeMode) {
        practiceRacingLine.group.visible = showPracticeRacingLineRef.current;
        if (showPracticeRacingLineRef.current) {
          const playerSurf = track.checkSurfaceType(physics.playerPos, physics.playerProgress);
          latestCoachCue = practiceRacingLine.update(
            physics.playerProgress,
            physics.playerSpeedKmh,
            playerSurf.lateralOffset
          );
        }
      }

      // Dynamic Following Shadow Light, Sky Dome Centering & Real-Time Reflections
      const carPos = physics.playerPos;
      const heading = physics.playerHeading;
      const speed = physics.playerSpeedKmh;

      if (skyDomeMesh) {
        skyDomeMesh.position.set(carPos.x, 0, carPos.z);
      }

      if (isCityDrivingMode && physics.currentWeather) {
        updateSceneDiurnalLighting(
          scene,
          sunLight,
          ambientLight,
          hemiLight,
          physics.currentWeather,
          gfxPreset.id === 'ultra'
        );
        const cond = physics.currentWeather.condition;
        const targetWetness =
          cond === 'heavy_rain' || cond === 'thunderstorm'
            ? 0.95
            : cond === 'rain'
            ? 0.80
            : cond === 'drizzle'
            ? 0.55
            : cond === 'snow' || cond === 'heavy_snow'
            ? 0.30
            : cond === 'fog'
            ? 0.14
            : 0.0;
        currentRoadWetness += (targetWetness - currentRoadWetness) * Math.min(1, rawDelta * 0.8);
        track.setRoadWetness?.(currentRoadWetness);
        const curElevDeg =
          physics.currentWeather.sunElevationDeg ??
          (Math.asin(THREE.MathUtils.clamp(physics.currentWeather.sunAltitude, -1, 1)) * 180) / Math.PI;
        const nightFactor = 1.0 - THREE.MathUtils.smoothstep(curElevDeg, -6.0, 5.5);
        const dayBlend = 1.0 - nightFactor;
        track.setNightIntensity?.(nightFactor);

        if (planarReflectionRT) {
          const baseDry = gfxPreset.id === 'ultra' ? 0.22 : 0.14;
          const nightDry = gfxPreset.id === 'ultra' ? 0.07 : 0.05;
          const dryReflect = THREE.MathUtils.lerp(nightDry, baseDry, dayBlend);
          const wetBoost = gfxPreset.id === 'ultra' ? 0.92 : 0.58;
          track.setReflectionTexture(
            planarReflectionRT.texture,
            THREE.MathUtils.lerp(dryReflect, wetBoost, currentRoadWetness)
          );
        }

        // Attenuate PMREM IBL & rim fill at night so unlit roads/fields stay truly dark while headlights pop
        scene.environmentIntensity = THREE.MathUtils.lerp(gfxPreset.id === 'ultra' ? 0.08 : 0.12, 1.0, dayBlend);
        if (rimLight) {
          rimLight.intensity = THREE.MathUtils.lerp(gfxPreset.id === 'ultra' ? 0.035 : 0.055, baseRimIntensity, dayBlend);
        }
        renderer.toneMappingExposure = THREE.MathUtils.lerp(0.88, gfxPreset.id === 'ultra' ? 1.03 : 1.0, dayBlend);

        // Keep 360° PMREM reflections synced with Gaithersburg time-of-day & weather (only re-bakes on major shifts)
        if (
          pmremGenerator &&
          (Math.abs(curElevDeg - cityEnvLastElevDeg) >= 7.0 || cityEnvLastCond !== cond) &&
          time - cityEnvLastRebuildTime > 2800
        ) {
          cityEnvLastElevDeg = curElevDeg;
          cityEnvLastCond = cond;
          cityEnvLastRebuildTime = time;
          const isTwi = curElevDeg > -5 && curElevDeg < 8;
          const skyC = curElevDeg < -3 ? 0x050914 : isTwi ? 0x5c4b73 : physics.currentWeather.isRaining ? 0x3b495c : 0x5ca4e6;
          const sunC = curElevDeg < -3 ? 0x334155 : isTwi ? 0xfb923c : physics.currentWeather.isRaining ? 0x94a3b8 : 0xfff3db;
          const gndC = curElevDeg < -3 ? 0x020408 : 0x262c28;
          rebuildPmremEnvironment(skyC, sunC, gndC, curElevDeg < -3 ? 0.06 : isTwi ? 0.62 : 0.45);
        }

        const sprayState = physics.getTireSprayState();
        tireSpraySys?.update(carPos, heading, speed, sprayState, rawDelta);
        weatherAtmosphereSys?.update(carPos, physics.currentWeather, rawDelta);
        skyCelestialSys?.update(carPos, physics.currentWeather, rawDelta);
      }

      const shadowWorldSpan = (gfxPreset.id === 'ultra' ? 76 : isCityDrivingMode ? 88 : 84) * 2;
      const texelSize = shadowWorldSpan / Math.max(256, gfxPreset.shadowMapSize);
      const snapX = gfxPreset.shadowsEnabled ? Math.round(carPos.x / texelSize) * texelSize : carPos.x;
      const snapZ = gfxPreset.shadowsEnabled ? Math.round(carPos.z / texelSize) * texelSize : carPos.z;
      sunLight.target.position.set(snapX, carPos.y, snapZ);
      sunLight.target.updateMatrixWorld();

      if (isCityDrivingMode && skyCelestialSys) {
        const sDir = skyCelestialSys.sunDirection;
        const sunElevY = Math.max(18, sDir.y * 95);
        sunLight.position.set(snapX + sDir.x * 85, carPos.y + sunElevY, snapZ + sDir.z * 85);
      } else {
        sunLight.position.set(snapX + 42, carPos.y + 76, snapZ + 32);
      }

      if (rimLight) {
        rimLight.position.set(carPos.x - 40, carPos.y + 38, carPos.z - 42);
        rimLight.target.position.copy(carPos);
        rimLight.target.updateMatrixWorld();
      }

      // Dynamic FOV for speed sensation + aerodynamic DRS/ERS boost surge
      const drsFovBonus = physics.drsActive ? 3.5 : 0;
      const nextFov = 65 + (Math.abs(speed) / 360) * 13 + drsFovBonus;
      if (Math.abs(camera.fov - nextFov) > 0.04) {
        camera.fov += (nextFov - camera.fov) * Math.min(1, delta * 8);
        camera.updateProjectionMatrix();
      }

      // Camera Positioning with dynamic corner-apex look-to-steer & crest sightline compensation (Zero per-frame Vector3 allocations)
      const forward = scratchForward.set(-Math.sin(heading), 0, -Math.cos(heading));
      const up = scratchUp;

      // Multi-point lookahead along track curve so tight corners & crests are 100% visible (Zero Blind Corners!)
      const nowSample = physics.track.getTrackPointAtProgress(physics.playerProgress);
      const nearAheadSample = physics.track.getTrackPointAtProgress((physics.playerProgress + 0.015) % 1.0);
      const farAheadSample = physics.track.getTrackPointAtProgress((physics.playerProgress + 0.028) % 1.0);
      const trackAhead = scratchTrackAhead.copy(nearAheadSample.position).lerp(farAheadSample.position, 0.45);

      // Measure upcoming corner curvature to dynamically increase apex look-in
      const cornerDot = THREE.MathUtils.clamp(nowSample.tangent.dot(farAheadSample.tangent), -1, 1);
      const cornerIntensity = physics.isOpenFieldMode ? 0 : Math.min(1.0, Math.acos(cornerDot) / 0.55);
      const splineBlend = physics.isOpenFieldMode ? 0 : 1;

      const targetCamPos = scratchTargetCamPos;
      const targetLook = scratchTargetLook;

      const activeView = cameraViewRef.current;
      if (isGarageShowroomOpenRef.current) {
        const rightVec = scratchGarageRight.set(Math.cos(heading), 0, -Math.sin(heading));
        const gAngle = garageCamAngleRef.current;
        if (gAngle === 'front') {
          targetCamPos.copy(carPos).addScaledVector(forward, 4.9).addScaledVector(up, 1.15);
        } else if (gAngle === 'side') {
          targetCamPos.copy(carPos).addScaledVector(rightVec, 5.2).addScaledVector(forward, 0.4).addScaledVector(up, 1.35);
        } else if (gAngle === 'rear') {
          targetCamPos.copy(carPos).addScaledVector(forward, -4.8).addScaledVector(rightVec, 2.2).addScaledVector(up, 1.45);
        } else if (gAngle === 'orbit') {
          const orbitAng = time * 0.00055;
          targetCamPos
            .copy(carPos)
            .addScaledVector(forward, Math.cos(orbitAng) * 5.0)
            .addScaledVector(rightVec, Math.sin(orbitAng) * 5.0)
            .addScaledVector(up, 1.45);
        } else {
          // Default 'front34': showcases front grille, LED headlights & hood crown clearly
          targetCamPos.copy(carPos).addScaledVector(forward, 4.5).addScaledVector(rightVec, 2.35).addScaledVector(up, 1.42);
        }
        // Aim slightly below car center so the vehicle projects cleanly in the upper unobstructed viewport above the bottom Garage dock
        targetLook.copy(carPos).addScaledVector(up, -0.45);
      } else if (activeView === 'chase') {
        const camLift = 2.65 + cornerIntensity * 0.35;
        targetCamPos.copy(carPos).addScaledVector(forward, -7.2).addScaledVector(up, camLift);
        targetLook
          .copy(carPos)
          .addScaledVector(forward, 18.0)
          .lerp(trackAhead, (0.48 + cornerIntensity * 0.24) * splineBlend)
          .addScaledVector(up, 0.9);
      } else if (activeView === 'close') {
        const camLift = 1.85 + cornerIntensity * 0.25;
        targetCamPos.copy(carPos).addScaledVector(forward, -4.5).addScaledVector(up, camLift);
        targetLook
          .copy(carPos)
          .addScaledVector(forward, 20.0)
          .lerp(trackAhead, (0.42 + cornerIntensity * 0.24) * splineBlend)
          .addScaledVector(up, 0.78);
      } else if (activeView === 'cockpit') {
        targetCamPos.copy(carPos).addScaledVector(up, 0.84).addScaledVector(forward, -0.05);
        targetLook
          .copy(carPos)
          .addScaledVector(forward, 26.0)
          .lerp(trackAhead, (0.38 + cornerIntensity * 0.22) * splineBlend)
          .addScaledVector(up, 0.72);
      } else if (activeView === 'nose') {
        targetCamPos.copy(carPos).addScaledVector(forward, 2.3).addScaledVector(up, 0.42);
        targetLook
          .copy(carPos)
          .addScaledVector(forward, 30.0)
          .lerp(trackAhead, (0.35 + cornerIntensity * 0.22) * splineBlend)
          .addScaledVector(up, 0.38);
      }

      // Frame-rate independent exponential smoothing for ultra-smooth camera motion
      const safeDt = Math.min(0.05, Math.max(0.001, delta));
      const baseHz = isGarageShowroomOpenRef.current
        ? 14
        : activeView === 'cockpit' || activeView === 'nose'
        ? 36
        : gfxPreset.cameraSmoothingHz;
      const smoothAlpha = currentCamPos.lengthSq() === 0 ? 1.0 : 1.0 - Math.exp(-baseHz * safeDt);
      currentCamPos.lerp(targetCamPos, smoothAlpha);
      currentLookAt.lerp(targetLook, smoothAlpha);

      if (physics.collisionTrauma > 0) {
        const shake = physics.collisionTrauma * 0.35;
        currentCamPos.x += (Math.random() * 2 - 1) * shake;
        currentCamPos.y += (Math.random() * 2 - 1) * shake;
      } else if (Math.abs(speed) > 270) {
        const speedShake = (Math.abs(speed) - 270) * 0.00035;
        currentCamPos.x += (Math.random() * 2 - 1) * speedShake;
        currentCamPos.y += (Math.random() * 2 - 1) * speedShake;
      }

      camera.position.copy(currentCamPos);
      camera.lookAt(currentLookAt);
      camera.updateMatrixWorld();

      // Maryland Open-World Spatial Chunk Streaming & Adaptive Struggle-Based Load Reduction
      if (isCityDrivingMode) {
        track.updateWorldChunks?.(camera, carPos, {
          isDynamicMode,
          qualityFactor: dynamicQualityFactor,
          chunkLoadScale: struggleChunkScale,
        });

        cityTrafficProjMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        cityTrafficFrustum.setFromProjectionMatrix(cityTrafficProjMatrix);
        const baseTrafficDist = isDynamicMode
          ? 145 + dynamicQualityFactor * 185
          : gfxPreset.id === 'ultra'
          ? 420
          : gfxPreset.id === 'high'
          ? 340
          : 250;
        const maxTrafficDist = baseTrafficDist * (0.45 + 0.55 * struggleChunkScale);
        const maxTrafficDistSq = maxTrafficDist * maxTrafficDist;

        for (let i = 0; i < physics.cityCivilianCars.length; i++) {
          const civ = physics.cityCivilianCars[i];
          const dSq = carPos.distanceToSquared(civ.pos);
          let show = false;
          if (dSq < 196) {
            show = true;
          } else if (dSq <= maxTrafficDistSq) {
            cityTrafficSphere.center.copy(civ.pos);
            cityTrafficSphere.radius = 4.2;
            show = cityTrafficFrustum.intersectsSphere(cityTrafficSphere);
          }
          if (civ.built.root.visible !== show) {
            civ.built.root.visible = show;
          }
        }

        for (let i = 0; i < physics.cityPoliceCars.length; i++) {
          const cop = physics.cityPoliceCars[i];
          const dSq = carPos.distanceToSquared(cop.pos);
          let show = false;
          if (dSq < 256) {
            show = true;
          } else if (dSq <= maxTrafficDistSq) {
            cityTrafficSphere.center.copy(cop.pos);
            cityTrafficSphere.radius = 4.5;
            show = cityTrafficFrustum.intersectsSphere(cityTrafficSphere);
          }
          if (cop.built.root.visible !== show) {
            cop.built.root.visible = show;
          }
        }
      }

      // Camera Near-Lens Guard + Potato Mode Distance Culling:
      // 1. Never let any AI car within 3.6m of the camera lens render inside the camera frustum (prevents trailing cars from blocking the camera view!)
      // 2. In Conservative Dynamic below 35% quality (Potato 60+ FPS mode), distance-cull AI cars beyond 75m–130m to save massive draw calls!
      const usePotatoCarCull = isConservativeDynamic && dynamicQualityFactor < 0.35;
      const maxAiDistSq =
        dynamicQualityFactor < 0.16
          ? 70 * 70
          : dynamicQualityFactor < 0.25
          ? 95 * 95
          : 135 * 135;

      for (let i = 0; i < physics.aiCars.length; i++) {
        const ai = physics.aiCars[i];
        if (ai.isHiddenByPracticeFilter) {
          ai.builtCar.root.visible = false;
          continue;
        }
        if (isQualifyingMode && qualifyingGhostDelay3s && physics.raceState === 'racing' && physics.raceTimer < 3.0) {
          ai.builtCar.root.visible = false;
          continue;
        }
        const camDistSq = camera.position.distanceToSquared(ai.pos);
        if (camDistSq < 13.0) {
          // Car is right on top of the camera position: hide mesh so it never creates a dark lens over the screen!
          ai.builtCar.root.visible = false;
        } else if (usePotatoCarCull) {
          const playerDistSq = carPos.distanceToSquared(ai.pos);
          ai.builtCar.root.visible = playerDistSq <= maxAiDistSq;
        } else {
          ai.builtCar.root.visible = true;
        }
      }

      // Real-time planar road reflection pass (every 2nd frame normally on Ultra/High, throttling further under struggle)
      const reflStride = struggleChunkScale < 0.5 ? 4 : struggleChunkScale < 0.78 ? 3 : 2;
      if (planarReflectionRT && reflectionCamera && (frameCount % reflStride === 0)) {
        const trackPlaneY = carPos.y - 0.06;
        reflectionCamera.fov = camera.fov;
        reflectionCamera.aspect = camera.aspect;
        reflectionCamera.updateProjectionMatrix();

        reflectionCamera.position.set(
          currentCamPos.x,
          2 * trackPlaneY - currentCamPos.y,
          currentCamPos.z
        );
        reflectionCamera.up.set(0, -1, 0);
        reflectionCamera.lookAt(
          currentLookAt.x,
          2 * trackPlaneY - currentLookAt.y,
          currentLookAt.z
        );

        track.setReflectionPassMode(true);
        if (isCityDrivingMode) {
          track.setReflectionChunkCull?.(true, carPos);
        }
        const prevBg = scene.background;
        const prevFog = scene.fog;
        const prevSkyVis = skyDomeMesh ? skyDomeMesh.visible : false;
        if (!isCityDrivingMode) {
          scene.background = reflectionBgColor;
          scene.fog = null;
          if (skyDomeMesh) skyDomeMesh.visible = false;
        }

        const prevRenderTarget = renderer.getRenderTarget();
        renderer.setRenderTarget(planarReflectionRT);
        renderer.clear();
        renderer.render(scene, reflectionCamera);
        renderer.setRenderTarget(prevRenderTarget);

        scene.background = prevBg;
        scene.fog = prevFog;
        if (skyDomeMesh) skyDomeMesh.visible = prevSkyVis;
        if (isCityDrivingMode) {
          track.setReflectionChunkCull?.(false);
        }
        track.setReflectionPassMode(false);
      }

      const isUltra = gfxPreset.id === 'ultra';
      const useComposer = isUltra || motionBlurEnabledRef.current;
      if (useComposer) {
        const comp = initComposer();
        if (motionBlurPass) {
          motionBlurPass.enabled = motionBlurEnabledRef.current;
          if (motionBlurPass.enabled) {
            const isCockpitOrShowroom =
              isGarageShowroomOpenRef.current || activeView === 'cockpit' || activeView === 'nose';
            if (isCockpitOrShowroom) {
              motionBlurPass.uniforms.uIntensity.value = 0.0;
            } else {
              const spd = Math.abs(physics.playerSpeedKmh || 0);
              const speedNorm = Math.max(0.0, Math.min(1.0, (spd - 28) / 200));
              motionBlurPass.uniforms.uIntensity.value = speedNorm * 0.165;
              scratchCarProj.set(carPos.x, carPos.y + 0.85, carPos.z).project(camera);
              motionBlurPass.uniforms.uCarUv.value.set(
                THREE.MathUtils.clamp(0.5 * (scratchCarProj.x + 1), 0.15, 0.85),
                THREE.MathUtils.clamp(0.5 * (scratchCarProj.y + 1), 0.1, 0.85)
              );
              motionBlurPass.uniforms.uFocusRadius.value = activeView === 'close' ? 0.24 : 0.19;
              motionBlurPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
            }
          }
        }
        comp.render(delta);
      } else {
        renderer.render(scene, camera);
      }

      // Immediately record start reaction time or false start as soon as the player launches off the line
      if (
        !launchReactionNotified &&
        !isQualifyingMode &&
        (physics.falseStartTriggered || physics.startReactionTimeMs != null)
      ) {
        launchReactionNotified = true;
        if (onRecordLaunchReaction) {
          onRecordLaunchReaction({
            reactionTimeMs: physics.startReactionTimeMs,
            falseStart: physics.falseStartTriggered,
            jumpedEarlyByMs: physics.falseStartEarlyMs,
          });
        }
      }

      // Throttled UI State updates (~18 FPS for UI overlay)
      if (time - lastUiUpdateTime > 55) {
        lastUiUpdateTime = time;
        setTelemetry({ ...physics.telemetry });
        setRaceState(physics.raceState);
        setLightsLit(physics.lightsLit);
        setLightsExtinguished(physics.lightsExtinguished);
        setYellowFlagActive(physics.yellowFlagActive);
        if (isStrictPracticeMode) {
          setPracticeLineCoach(showPracticeRacingLineRef.current ? latestCoachCue : null);
        }
        if (physics.isOpenFieldMode) {
          setOpenFieldStats({ ...physics.openFieldStats });
        }
        if (physics.isCityMode) {
          setCityPursuitStats({ ...physics.cityPursuitStats });
          setCurrentWeatherState({ ...physics.currentWeather });
        }

        const padStatus = inputManager.getControllerStatus();
        setControllerState({ connected: padStatus.connected, id: padStatus.id });
      }

      if (physics.raceFinished && !raceCompleteNotified) {
        raceCompleteNotified = true;

        // Auto-save verified personal best lap record to Firebase Firestore Leaderboard
        if (physics.telemetry.lapTimeBest && physics.telemetry.lapTimeBest > 20 && physics.telemetry.lapTimeBest < 600) {
          const bestSec = physics.telemetry.lapTimeBest;
          const mins = Math.floor(bestSec / 60);
          const secs = (bestSec % 60).toFixed(3).padStart(6, '0');
          recordCircuitLapTime({
            circuitId: circuit.id,
            driverName: playerDriver.name,
            teamId: playerTeam.id,
            lapTimeSeconds: bestSec,
            lapTimeFormatted: `${mins}:${secs}`,
            carNumber: playerDriver.number,
          });
        }

        if (isQualifyingMode && onQualifyingComplete) {
          const playerLap = physics.telemetry.lapTimeBest && physics.telemetry.lapTimeBest > 20
            ? physics.telemetry.lapTimeBest
            : (physics.telemetry.lapTimeCurrent && physics.telemetry.lapTimeCurrent > 20 ? physics.telemetry.lapTimeCurrent : 89.2);

          const finalStandings = physics.getFinalStandings(playerDriver);
          const playerStanding = finalStandings.find((s) => s.driver.id === playerDriver.id);
          const playerPos = playerStanding?.position || physics.telemetry.position || 1;

          // Build classification directly from actual on-track qualifying race against the 19 ghost rivals
          const rawTimes: number[] = [];
          finalStandings.forEach((entry, idx) => {
            const rank = idx + 1;
            if (entry.driver.id === playerDriver.id) {
              rawTimes.push(Number(playerLap.toFixed(3)));
            } else if (rank < playerPos) {
              const aheadDelta = Math.max(
                0.06 * (playerPos - rank),
                entry.bestLapTime > 20 && entry.bestLapTime < playerLap
                  ? playerLap - entry.bestLapTime
                  : Math.abs(entry.gapToPlayerSeconds || (playerPos - rank) * 0.24)
              );
              rawTimes.push(Number(Math.max(35, playerLap - aheadDelta).toFixed(3)));
            } else {
              const behindDelta = Math.max(
                0.06 * (rank - playerPos),
                Math.abs(entry.gapToPlayerSeconds || (rank - playerPos) * 0.24)
              );
              rawTimes.push(Number((playerLap + behindDelta).toFixed(3)));
            }
          });

          for (let i = playerPos - 2; i >= 0; i--) {
            if (rawTimes[i] >= rawTimes[i + 1]) {
              rawTimes[i] = Number(Math.max(30, rawTimes[i + 1] - 0.065).toFixed(3));
            }
          }
          for (let i = playerPos; i < rawTimes.length; i++) {
            if (rawTimes[i] <= rawTimes[i - 1]) {
              rawTimes[i] = Number((rawTimes[i - 1] + 0.065).toFixed(3));
            }
          }

          const poleTime = rawTimes[0] || playerLap;
          const classification = finalStandings.map((entry, idx) => {
            const dTeam = entry.driver.id === playerDriver.id
              ? playerTeam
              : (TEAMS.find((t) => t.id === entry.driver.teamId) || TEAMS[0]);
            const lapTime = rawTimes[idx];
            return {
              position: idx + 1,
              driver: entry.driver,
              team: dTeam,
              lapTime,
              gap: Number((lapTime - poleTime).toFixed(3)),
            };
          });

          setTimeout(() => {
            onQualifyingComplete(playerPos, playerLap, classification);
          }, 2000);
          return;
        }

        setTimeout(() => {
          const finalStandings = physics.getFinalStandings(playerDriver);
          const playerRank =
            finalStandings.find((s) => s.driver.id === playerDriver.id)?.position ||
            physics.telemetry.position;
          onRaceComplete(
            playerRank,
            physics.telemetry.lapTimeBest || 91.5,
            finalStandings.map((s) => s.driver.id),
            finalStandings
          );
        }, 3200);
      }
    };

    animFrameId = requestAnimationFrame(renderLoop);

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (composer) {
        composer.setSize(w, h);
      }
      if (motionBlurPass) {
        motionBlurPass.uniforms.uResolution.value.set(w, h);
      }
      if (planarReflectionRT) {
        const reflScale = gfxPreset.id === 'ultra' ? 0.45 : 0.35;
        planarReflectionRT.setSize(
          Math.max(256, Math.floor(w * reflScale)),
          Math.max(192, Math.floor(h * reflScale))
        );
      }
    };
    window.addEventListener('resize', handleResize);

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (physicsRef.current?.cityPursuitStats.activeBankMinigameTarget) {
        if (e.key === 'Escape' || e.code === 'Escape') {
          e.preventDefault();
          physicsRef.current.abortBankHeistMinigame();
          setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
        }
        return;
      }

      if (physicsRef.current?.cityPursuitStats.activeLockpickTarget) {
        if (e.key === 'Escape' || e.code === 'Escape') {
          e.preventDefault();
          physicsRef.current.abortHouseLockpick();
          setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
        }
        return;
      }

      if (e.key === 'Escape' || e.code === 'Escape') {
        e.preventDefault();
        togglePause();
        return;
      }

      if (isPausedRef.current) {
        return;
      }

      if (physicsRef.current?.cityPursuitStats.activeSportsMinigame) {
        return;
      }

      if (isCityDrivingMode) {
        if (e.key === 'g' || e.key === 'G' || e.code === 'KeyG') {
          e.preventDefault();
          setShowCityGarageModal((prev) => {
            const next = !prev;
            if (next) {
              setCityTabletTab('garage');
              setGarageCamAngle('front34');
            }
            return next;
          });
          return;
        }
        if (e.key === 'b' || e.key === 'B' || e.code === 'KeyB') {
          if (physicsRef.current?.cityPursuitStats.nearbySportsPrompt && !physicsRef.current.cityPursuitStats.activeSportsMinigame) {
            e.preventDefault();
            physicsRef.current.triggerSportsMinigame(
              physicsRef.current.cityPursuitStats.nearbySportsPrompt.venueId
            );
            setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
            return;
          }
        }
        if (e.key === 'c' || e.key === 'C' || e.code === 'KeyC') {
          if (physicsRef.current?.cityPursuitStats.civilianAtFaultClaim?.active) {
            e.preventDefault();
            physicsRef.current.callCopsOnAtFaultCivilian();
            setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
            return;
          }
        }
        if (e.key === 'y' || e.key === 'Y' || e.code === 'KeyY') {
          if (physicsRef.current?.cityPursuitStats.playerAtFaultSettlement?.active) {
            e.preventDefault();
            physicsRef.current.settlePlayerAtFaultCrash(false);
            setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
            return;
          }
        }
        if (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter') {
          const engine = physicsRef.current;
          if (engine) {
            const stats = engine.cityPursuitStats;
            if (stats && (stats.playerBeingPulledOver || (!stats.isPoliceOnDuty && stats.wantedStars > 0))) {
              e.preventDefault();
              engine.complyWithPolicePullOver();
              setCityPursuitStats({ ...engine.cityPursuitStats });
              return;
            }
          }
        }
        if (e.key === 'r' || e.key === 'R' || e.code === 'KeyR') {
          if (
            physicsRef.current?.cityPursuitStats.nearbyHeistPrompt &&
            !physicsRef.current.cityPursuitStats.isPoliceOnDuty
          ) {
            e.preventDefault();
            physicsRef.current.triggerRobberyAtNearestTarget(
              physicsRef.current.cityPursuitStats.nearbyHeistPrompt.targetId
            );
            setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
            return;
          }
          if (
            physicsRef.current?.cityPursuitStats.nearbyHousePrompt &&
            !physicsRef.current.cityPursuitStats.nearbyHousePrompt.isOwned &&
            !physicsRef.current.cityPursuitStats.isPoliceOnDuty
          ) {
            e.preventDefault();
            physicsRef.current.triggerHouseRobbery(
              physicsRef.current.cityPursuitStats.nearbyHousePrompt.houseId
            );
            setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
            return;
          }
        }
        if (e.key === 'v' || e.key === 'V' || e.code === 'KeyV') {
          const stats = physicsRef.current?.cityPursuitStats;
          if (physicsRef.current && stats) {
            if (stats.nearbyHeistPrompt && stats.nearbyHeistPrompt.category !== 'HOUSE') {
              e.preventDefault();
              physicsRef.current.triggerExploreBuilding('heist_target', stats.nearbyHeistPrompt.targetId);
              setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
              return;
            }
            if (stats.nearbyHousePrompt?.isOwned) {
              e.preventDefault();
              physicsRef.current.triggerExploreBuilding('owned_house', stats.nearbyHousePrompt.houseId);
              setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
              return;
            }
            if (stats.nearbyServicePrompt) {
              e.preventDefault();
              physicsRef.current.triggerExploreBuilding('service', stats.nearbyServicePrompt.id);
              setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
              return;
            }
            if (stats.policePrecinctNear) {
              e.preventDefault();
              physicsRef.current.triggerExploreBuilding('police');
              setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
              return;
            }
            if (stats.nearbyCityBuildingPrompt && (!stats.nearbyHousePrompt || stats.nearbyHousePrompt.isOwned)) {
              e.preventDefault();
              physicsRef.current.triggerExploreBuilding('city_building', stats.nearbyCityBuildingPrompt.id);
              setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
              return;
            }
          }
        }
        // Check custom mapped key actions first:
        if (inputManager.isActionPressed('policePullOver') || e.code === 'KeyR' || e.key === 'r' || e.key === 'R') {
          if (physicsRef.current?.cityPursuitStats.isPoliceOnDuty) {
            e.preventDefault();
            physicsRef.current?.pullOverTargetVehicle();
            if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
            return;
          }
        }
        if (inputManager.isActionPressed('policeArrest') || e.code === 'KeyF' || e.key === 'f' || e.key === 'F') {
          if (physicsRef.current?.cityPursuitStats.isPoliceOnDuty) {
            e.preventDefault();
            physicsRef.current?.arrestTargetVehicle();
            if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
            return;
          }
          if (physicsRef.current?.cityPursuitStats.nearbyServicePrompt) {
            e.preventDefault();
            physicsRef.current.triggerServiceStationPitStop(
              physicsRef.current.cityPursuitStats.nearbyServicePrompt.id
            );
            setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
            return;
          }
          if (
            physicsRef.current?.cityPursuitStats.nearbyCarMeetPrompt &&
            physicsRef.current.cityPursuitStats.nearbyCarMeetPrompt.cooldownLeftSec <= 0
          ) {
            e.preventDefault();
            physicsRef.current.triggerCarMeetShowcase(
              physicsRef.current.cityPursuitStats.nearbyCarMeetPrompt.id
            );
            setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
            return;
          }
        }
        if (e.code === 'KeyT' || e.key === 't' || e.key === 'T') {
          if (physicsRef.current?.cityPursuitStats.isPoliceOnDuty) {
            e.preventDefault();
            physicsRef.current?.issueCitationToTarget();
            if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
            return;
          }
        }
        if (inputManager.isActionPressed('policeSiren') || e.code === 'KeyP' || e.key === 'p' || e.key === 'P') {
          if (physicsRef.current?.cityPursuitStats.isPoliceOnDuty) {
            e.preventDefault();
            physicsRef.current?.togglePlayerSiren();
            if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
            return;
          }
        }
        if (inputManager.isActionPressed('horn') || e.code === 'KeyH' || e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          physicsRef.current?.honkCityHorn();
          return;
        }
        if (e.code === 'KeyL' || e.key === 'l' || e.key === 'L') {
          e.preventDefault();
          physicsRef.current?.cycleHeadlightMode();
          if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
          return;
        }
        if (inputManager.isActionPressed('signalLeft') || e.code === 'KeyQ' || e.key === 'q' || e.key === 'Q' || e.code === 'BracketLeft') {
          e.preventDefault();
          physicsRef.current?.toggleTurnSignal('left');
          if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
          return;
        }
        if (inputManager.isActionPressed('signalRight') || e.code === 'KeyE' || e.key === 'e' || e.key === 'E' || e.code === 'BracketRight') {
          e.preventDefault();
          physicsRef.current?.toggleTurnSignal('right');
          if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
          return;
        }
        if (inputManager.isActionPressed('hazards') || e.code === 'KeyX' || e.key === 'x' || e.key === 'X') {
          e.preventDefault();
          physicsRef.current?.toggleTurnSignal('hazards');
          if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
          return;
        }
        if (inputManager.isActionPressed('cityTablet') || e.key === 'Tab' || e.code === 'KeyM' || e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          setShowCityTabletModal((prev) => !prev);
          return;
        }
        if (inputManager.isActionPressed('toggleMinimap') || e.code === 'KeyN' || e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          setIsMinimapHidden((prev) => !prev);
          return;
        }
        if (inputManager.isActionPressed('toggleHud') || e.code === 'KeyU' || e.key === 'u' || e.key === 'U') {
          e.preventDefault();
          setIsCinematicHudHidden((prev) => !prev);
          return;
        }
        if (e.key === 'Escape') {
          setShowCityTabletModal(false);
          setShowCityGarageModal(false);
          setShowControlsMappingModal(false);
        }
        // In Metro City mode, city controls are active; prevent all F1 strategy/pit keys (1-5, P, B, etc.)
        return;
      }

      if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') {
        if (isOpenFieldMode) {
          physicsRef.current?.teleportToOpenFieldZone('drag_strip');
        } else if (!isCityDrivingMode) {
          physicsRef.current?.issueTeamOrder('block');
        }
      } else if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') {
        if (isOpenFieldMode) {
          physicsRef.current?.teleportToOpenFieldZone('open_grass');
        } else if (!isCityDrivingMode) {
          physicsRef.current?.issueTeamOrder('yield');
        }
      } else if (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3') {
        if (isOpenFieldMode) {
          physicsRef.current?.teleportToOpenFieldZone('skidpad');
        } else if (!isCityDrivingMode) {
          physicsRef.current?.issueTeamOrder('push');
        }
      } else if (e.key === '4' || e.code === 'Digit4' || e.code === 'Numpad4') {
        if (isOpenFieldMode) {
          physicsRef.current?.teleportToOpenFieldZone('slalom');
        } else if (!isCityDrivingMode) {
          physicsRef.current?.issueTeamOrder('neutral');
        }
      } else if (e.key === '5' || e.code === 'Digit5' || e.code === 'Numpad5') {
        if (isOpenFieldMode) {
          physicsRef.current?.teleportToOpenFieldZone('brake_test');
        }
      } else if (isOpenFieldMode && (e.key === 'b' || e.key === 'B' || e.code === 'KeyB')) {
        physicsRef.current?.launchAtTopSpeed(300);
      } else if (e.key === 'p' || e.key === 'P' || e.code === 'KeyP') {
        physicsRef.current?.requestPitStop();
      } else if (isStrictPracticeMode && (e.key === 'l' || e.key === 'L' || e.code === 'KeyL')) {
        setShowPracticeRacingLine((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubTelemetry();
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      soundEngine.stopAll();
      track.dispose?.();
      if (skyDomeMesh) {
        skyDomeMesh.geometry.dispose();
        const sMat = skyDomeMesh.material as THREE.MeshBasicMaterial;
        sMat.map?.dispose();
        sMat.dispose();
      }
      tireSpraySys?.dispose();
      weatherAtmosphereSys?.dispose();
      skyCelestialSys?.dispose();
      if (pmremRenderTarget) {
        pmremRenderTarget.dispose();
      }
      if (pmremGenerator) {
        pmremGenerator.dispose();
      }
      if (composer) {
        composer.dispose();
      }
      if (planarReflectionRT) {
        planarReflectionRT.dispose();
      }
      renderer.dispose();
      if (containerRef.current && renderer.domElement && containerRef.current.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [circuit.id, laps, season.selectedTeamId, season.selectedDriverId, season.difficulty, isMultiplayer, multiplayerRoom?.code, graphicsQuality, restartQualifyingKey]);

  const cycleCamera = () => {
    setCameraView((prev) => {
      const views: CameraView[] = ['chase', 'close', 'cockpit', 'nose'];
      return views[(views.indexOf(prev) + 1) % views.length];
    });
  };

  const handleResetCar = () => {
    physicsRef.current?.resetPlayer();
  };

  const handleToggleMute = () => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  };

  const handleIssueTeamOrder = (order: 'block' | 'yield' | 'push' | 'neutral') => {
    physicsRef.current?.issueTeamOrder(order);
  };

  const handleRestartQualifyingLap = () => {
    soundEngine.stopAll();
    isPausedRef.current = false;
    setIsPaused(false);
    setRaceState('countdown');
    setLightsLit(0);
    setLightsExtinguished(false);
    setRestartQualifyingKey((prev) => prev + 1);
  };

  // Quitting mid-race counts as an immediate LOSS (P20 Last Place DNF) for Grand Prix,
  // whereas quitting mid-Qualifying or Practice returns to Paddock so you can freely re-qualify!
  const handleQuitMidRace = () => {
    soundEngine.stopAll();
    isPausedRef.current = false;
    setIsPaused(false);

    // Practice Mode or Qualifying Mode exits cleanly to the Paddock so the player can re-qualify anytime
    if (isPracticeMode || isQualifyingMode) {
      onExitToPaddock();
      return;
    }

    // Grand Prix: Quitting mid-race is an automatic LOSS (P20 Last Place DNF)
    if (physicsRef.current) {
      const currentStandings = physicsRef.current.getFinalStandings(playerDriver);
      const aiStandings = currentStandings.filter((s) => s.driver.id !== playerDriver.id);
      const playerStanding = currentStandings.find((s) => s.driver.id === playerDriver.id);

      const reindexedStandings = aiStandings.map((s, idx) => ({
        ...s,
        position: idx + 1,
        leadOverP2Seconds:
          idx === 0 && aiStandings.length > 1
            ? Math.max(0.45, Math.abs(aiStandings[1].gapToLeaderSeconds - aiStandings[0].gapToLeaderSeconds))
            : s.leadOverP2Seconds,
      }));

      const lastGap =
        reindexedStandings.length > 0
          ? (reindexedStandings[reindexedStandings.length - 1].gapToLeaderSeconds || 25) + 12.0
          : 45.0;

      reindexedStandings.push({
        driver: playerDriver,
        position: reindexedStandings.length + 1,
        finished: false,
        bestLapTime: playerStanding?.bestLapTime || physicsRef.current.telemetry?.lapTimeBest || 0,
        gapToLeaderSeconds: lastGap,
        gapToPlayerSeconds: 0,
        leadOverP2Seconds: 0,
      });

      onRaceComplete(
        reindexedStandings.length,
        physicsRef.current.telemetry?.lapTimeBest || 0,
        reindexedStandings.map((s) => (s.driver.id === playerDriver.id ? 'player' : s.driver.id)),
        reindexedStandings,
        true
      );
    } else {
      onRaceComplete(20, 0, [], undefined, true);
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-black">
      <div ref={containerRef} className={`w-full h-full ${isPaused ? 'cursor-default' : 'cursor-none'}`} />

      {telemetry && (
        <BroadcastHUD
          telemetry={telemetry}
          circuit={circuit}
          raceState={raceState}
          lightsLit={lightsLit}
          lightsExtinguished={lightsExtinguished}
          cameraView={cameraView}
          onCycleCamera={cycleCamera}
          onResetCar={handleResetCar}
          onToggleMute={handleToggleMute}
          isMuted={isMuted}
          isGamepadConnected={controllerState.connected}
          gamepadName={controllerState.id}
          playerDriver={playerDriver}
          yellowFlagActive={yellowFlagActive}
          isPracticeMode={isPracticeMode}
          isQualifyingMode={isQualifyingMode}
          onIssueTeamOrder={isCityDrivingMode ? undefined : handleIssueTeamOrder}
          onOpenControls={onOpenControls}
          showPracticeRacingLine={isStrictPracticeMode ? showPracticeRacingLine : false}
          onTogglePracticeRacingLine={
            isStrictPracticeMode ? () => setShowPracticeRacingLine((prev) => !prev) : undefined
          }
          practiceLineCoach={isStrictPracticeMode && showPracticeRacingLine ? practiceLineCoach : null}
          practiceBotCount={isStrictPracticeMode ? activePracticeBots : undefined}
          onSetPracticeBotCount={isStrictPracticeMode ? handleSetPracticeBotCount : undefined}
          onPitStop={isCityDrivingMode ? undefined : ((comp) => physicsRef.current?.requestPitStop(comp))}
          bestReactionTimeMs={season.career.bestReactionTimeMs}
          onToggleManualGear={() => {
            if (physicsRef.current) {
              physicsRef.current.toggleManualGearMode();
              setTelemetry({ ...physicsRef.current.telemetry, manualGearMode: physicsRef.current.manualGearMode });
            }
          }}
          onForceShiftUp={() => {
            if (physicsRef.current) {
              physicsRef.current.forceShiftUp();
            }
          }}
          onForceShiftDown={() => {
            if (physicsRef.current) {
              physicsRef.current.forceShiftDown();
            }
          }}
          onRequestEngineerReport={(topic) => {
            if (physicsRef.current) {
              physicsRef.current.requestEngineerReport(topic);
              setTelemetry({ ...physicsRef.current.telemetry, raceEngineerRadio: physicsRef.current.raceEngineerRadio });
            }
          }}
        />
      )}

      {/* Guided FIA Academy Tutorial On-Track Practice Drill Banner */}
      {tutorialPracticeStage && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-xl bg-zinc-950/92 border-2 border-emerald-500/60 rounded-2xl px-4 py-3 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-emerald-500 text-black font-mono font-black text-[9px] uppercase">
                ACADEMY DRILL
              </span>
              <span className="text-xs font-black text-white">{tutorialPracticeStage.title}</span>
            </div>
            <p className="text-[11px] text-zinc-300 mt-0.5">{tutorialPracticeStage.subtitle}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {tutorialPracticeStage.objectives.map((obj, idx) => (
                <span
                  key={idx}
                  className="text-[10px] font-mono bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded"
                >
                  • {obj}
                </span>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onCompleteTutorialStage) {
                onCompleteTutorialStage(tutorialPracticeStage.id);
              } else {
                onExitToPaddock();
              }
            }}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-black text-[11px] uppercase tracking-wider shadow-lg cursor-pointer whitespace-nowrap shrink-0"
          >
            Complete Drill & Next Step →
          </button>
        </div>
      )}

      {/* METRO CITY STREET UNDERGROUND: MISSIONS, STREET CAR DEALERSHIP & POLICE SCANNER HUD */}
      {isCityDrivingMode && cityPursuitStats && openFieldStats && !isCinematicHudHidden && (
        <>
          {/* Flashing Top-Center Police Pursuit / Mission / Dealership Alert Banner */}
          {cityPursuitStats.activeAlertTimer > 0 && cityPursuitStats.activeAlertBanner && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-[92%] max-w-xl">
              <div className="px-4 py-2.5 rounded-xl bg-zinc-950/95 border-2 border-amber-400 shadow-[0_0_28px_rgba(251,191,36,0.45)] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping shrink-0" />
                  <span className="text-xs sm:text-sm font-black font-mono text-white tracking-wide truncate">
                    {cityPursuitStats.activeAlertBanner}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-sky-600 text-white font-mono font-black text-[10px] shrink-0">
                  METRO STREET
                </span>
              </div>
            </div>
          )}

          {/* POLICE RADAR DETECTOR EARLY WARNING */}
          {cityPursuitStats.policeRadarWarning && (
            <div className="absolute top-28 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-[90%] max-w-lg">
              <div className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-red-950/95 via-zinc-950/95 to-amber-950/95 border-2 border-red-500 shadow-[0_0_35px_rgba(239,68,68,0.6)] flex items-center justify-between gap-3 font-mono animate-bounce">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-xl bg-red-600/30 border border-red-400 flex items-center justify-center text-base shrink-0 animate-pulse">
                    📡
                  </span>
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                      <span>RADAR DETECTOR ALERT</span>
                      <span className="text-zinc-400">•</span>
                      <span>UNIT {cityPursuitStats.policeRadarWarning.copId} ({cityPursuitStats.policeRadarWarning.distanceMeters}M)</span>
                    </div>
                    <div className="text-xs sm:text-sm font-black text-white truncate">
                      ⚠️ SLOW DOWN TO {cityPursuitStats.policeRadarWarning.zoneLimitMph} MPH! (Currently {cityPursuitStats.policeRadarWarning.currentSpeedMph} MPH)
                    </div>
                  </div>
                </div>
                <span className="px-2 py-1 rounded bg-red-600 text-white font-black text-[9px] uppercase tracking-wider shrink-0 animate-pulse">
                  SLOW DOWN
                </span>
              </div>
            </div>
          )}

          {/* POLICE TRAFFIC STOP & PURSUIT PULL-OVER ORDER */}
          {(cityPursuitStats.playerBeingPulledOver || (!cityPursuitStats.isPoliceOnDuty && cityPursuitStats.wantedStars > 0)) && (
            <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-lg pointer-events-auto">
              <div
                className={`bg-zinc-950/95 border-2 rounded-2xl p-3.5 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 font-mono ${
                  cityPursuitStats.pendingHeistLoot
                    ? 'border-red-500 shadow-[0_0_35px_rgba(239,68,68,0.55)]'
                    : 'border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.55)]'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-black font-black text-[10px] uppercase animate-pulse ${
                        cityPursuitStats.pendingHeistLoot ? 'bg-red-400' : 'bg-emerald-400'
                      }`}
                    >
                      🛑 {cityPursuitStats.wantedStars > 0 ? `WANTED ★${cityPursuitStats.wantedStars} PURSUIT` : 'PULL-OVER ORDER'}
                      {cityPursuitStats.playerBeingPulledOver?.timeLeftSec ? ` (${Math.ceil(cityPursuitStats.playerBeingPulledOver.timeLeftSec)}s)` : ''}
                    </span>
                    <span className="text-xs font-black text-white truncate">
                      {cityPursuitStats.playerBeingPulledOver?.reason || 'Police units in pursuit'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-300 mt-1">
                    {cityPursuitStats.pendingHeistLoot ? (
                      <>
                        ⚠️ <strong className="text-red-400">STOLEN HEIST CASH IN TRUNK!</strong> Pulling over with <strong className="text-amber-300">[Enter]</strong> will <strong className="text-red-300">BUST YOU FOR THE HEIST</strong> (lose trunk cash + 2× fine)! Lose cops &amp; stash it at home!
                      </>
                    ) : (
                      <>
                        Slow down below 45 km/h &amp; pull to the side, then press <strong className="text-emerald-300">[Enter]</strong> to accept ticket — police will issue citation and stop chasing!
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.complyWithPolicePullOver();
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer shrink-0 animate-pulse ${
                    cityPursuitStats.pendingHeistLoot
                      ? 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-400 hover:to-rose-400 text-white'
                      : 'bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-black'
                  }`}
                >
                  {cityPursuitStats.pendingHeistLoot ? '🚨 Surrender (Bust) [Enter]' : '🛑 Pull Over [Enter]'}
                </button>
              </div>
            </div>
          )}

          {/* POLICE MEGAPHONE SUBTITLE BAR */}
          {cityPursuitStats.megaphoneSubtitle && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-[90%] max-w-xl">
              <div className="bg-black/90 border border-sky-400/80 rounded-2xl px-5 py-3 shadow-[0_0_30px_rgba(56,189,248,0.5)] backdrop-blur-md flex items-center gap-3 font-mono">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400 flex items-center justify-center text-xl shrink-0">
                  📢
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-wider text-sky-300">
                    POLICE MEGAPHONE PA • {cityPursuitStats.megaphoneSubtitle.speaker}
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold text-white tracking-wide drop-shadow">
                    {cityPursuitStats.megaphoneSubtitle.text}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Live Street Driving Skill Bonus Popup (+$150 Near Miss, +$250 Drift, +$150 Signaled Turn) */}
          {cityPursuitStats.lastSkillBonusPopup && (
            <div className="absolute top-[108px] right-4 md:right-6 z-50 pointer-events-none">
              <div className="px-3.5 py-2 rounded-xl bg-emerald-950/95 border-2 border-emerald-400 shadow-[0_0_22px_rgba(16,185,129,0.5)] font-mono flex items-center gap-2.5">
                <span className="text-xs font-black text-emerald-300 uppercase">
                  ⚡ {cityPursuitStats.lastSkillBonusPopup.label}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-400 text-black font-black text-xs tabular-nums">
                  +${cityPursuitStats.lastSkillBonusPopup.amount.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* CASE A: SOMEONE CRASHED INTO YOU (THEIR FAULT) -> CALL COPS FOR $2,200 OR CHASE FLEEING HIT-AND-RUN DRIVER */}
          {cityPursuitStats.civilianAtFaultClaim?.active && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-xl pointer-events-auto">
              {cityPursuitStats.civilianAtFaultClaim.status === 'CAN_CALL_COPS' ? (
                <div className="bg-zinc-950/95 border-2 border-sky-400 rounded-2xl p-3.5 shadow-[0_0_30px_rgba(56,189,248,0.45)] backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-sky-400 text-black font-black text-[10px] uppercase">
                        THEIR FAULT CRASH
                      </span>
                      <span className="text-xs font-black text-white">
                        Driver Rear-Ended / Side-Swiped You! ({cityPursuitStats.civilianAtFaultClaim.timeLeftSec.toFixed(0)}s)
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 mt-1">
                      Call Metro PD to force them to pay you <strong className="text-emerald-300">+${cityPursuitStats.civilianAtFaultClaim.payoutAmount.toLocaleString()}</strong> (Warning: they might panic & try to run away!)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      physicsRef.current?.callCopsOnAtFaultCivilian();
                      if (physicsRef.current) {
                        setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-400 to-emerald-400 hover:from-sky-300 hover:to-emerald-300 text-black font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer shrink-0 animate-pulse"
                  >
                    📞 [C] Call Police (+${cityPursuitStats.civilianAtFaultClaim.payoutAmount.toLocaleString()})
                  </button>
                </div>
              ) : (
                <div className="bg-zinc-950/95 border-2 border-rose-500 rounded-2xl p-3.5 shadow-[0_0_30px_rgba(244,63,94,0.5)] backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-rose-500 text-white font-black text-[10px] uppercase animate-pulse">
                        HIT & RUN FUGITIVE FLEEING
                      </span>
                      <span className="text-xs font-black text-amber-300 tabular-nums">
                        📍 {cityPursuitStats.civilianAtFaultClaim.distMeters}m Away · {cityPursuitStats.civilianAtFaultClaim.timeLeftSec.toFixed(0)}s Left
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-200 mt-1">
                      The at-fault driver is trying to run away! Chase & bump the marked car (or let PD intercept them) for <strong className="text-emerald-400">+$5,000 Double Settlement!</strong>
                    </p>
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-black text-xs shrink-0">
                    BOUNTY: +$5,000
                  </span>
                </div>
              )}
            </div>
          )}

          {/* CASE B: YOU CRASHED INTO SOMEBODY (YOUR FAULT) -> EXCHANGE INSURANCE ($0 PAID RIGHT AWAY — PAY LATER!) */}
          {cityPursuitStats.playerAtFaultSettlement?.active && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-xl pointer-events-auto">
              <div className="bg-zinc-950/95 border-2 border-amber-400 rounded-2xl p-3.5 shadow-[0_0_30px_rgba(251,191,36,0.45)] backdrop-blur-md flex flex-col gap-2 font-mono">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-amber-400 text-black font-black text-[10px] uppercase">
                        YOUR FAULT COLLISION
                      </span>
                      <span className="text-xs font-black text-white tabular-nums">
                        Don&apos;t Run Away! ({cityPursuitStats.playerAtFaultSettlement.timeLeftSec.toFixed(1)}s to Exchange Info)
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 mt-1">
                      Stop your car here OR press <strong className="text-amber-300">[Y]</strong> to exchange insurance —{' '}
                      <strong className="text-emerald-400">you pay $0 right now</strong> (${cityPursuitStats.playerAtFaultSettlement.fineAmount} goes on your Ticket Tab to pay later) &{' '}
                      <span className="text-emerald-400 font-bold">the cops WILL NOT chase you!</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      physicsRef.current?.settlePlayerAtFaultCrash(false);
                      if (physicsRef.current) {
                        setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-black font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer shrink-0"
                  >
                    📝 [Y] Exchange Info ($0 Now)
                  </button>
                </div>
                {cityPursuitStats.playerAtFaultSettlement.stoppedProgress > 5 && (
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-75"
                      style={{ width: `${cityPursuitStats.playerAtFaultSettlement.stoppedProgress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PROXIMITY BUILDING EXPLORE / ROBBERY PROMPT */}
          {cityPursuitStats.nearbyHeistPrompt && (
            <div className="absolute bottom-24 right-4 md:right-6 z-50 w-[94%] max-w-lg pointer-events-auto">
              <div
                className={`bg-zinc-950/95 border-2 rounded-2xl p-3.5 backdrop-blur-md flex flex-col gap-2 font-mono ${
                  cityPursuitStats.nearbyHeistPrompt.robbable === false
                    ? 'border-fuchsia-400 shadow-[0_0_32px_rgba(232,121,249,0.45)]'
                    : 'border-amber-400 shadow-[0_0_32px_rgba(250,204,21,0.5)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded text-black font-black text-[10px] uppercase ${
                          cityPursuitStats.nearbyHeistPrompt.robbable === false ? 'bg-fuchsia-400' : 'bg-amber-400'
                        }`}
                      >
                        {cityPursuitStats.nearbyHeistPrompt.icon}{' '}
                        {cityPursuitStats.nearbyHeistPrompt.robbable === false
                          ? 'EXPLORE-ONLY VENUE'
                          : `${cityPursuitStats.nearbyHeistPrompt.category} ${
                              cityPursuitStats.nearbyHeistPrompt.category === 'HOUSE' ? 'HEIST' : 'BUILDING'
                            }`}
                      </span>
                      <span className="text-xs font-black text-white truncate">
                        {cityPursuitStats.nearbyHeistPrompt.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 mt-1">
                      {cityPursuitStats.nearbyHeistPrompt.robbable === false ? (
                        <>
                          Public Family Arcade · Press <strong className="text-emerald-300">[V]</strong> to explore 3 floors, ride elevators &amp; play games!
                        </>
                      ) : cityPursuitStats.nearbyHeistPrompt.cooldownLeftSec > 0 ? (
                        <span className="text-rose-400 font-bold">
                          🔒 Vault in Lockdown ({cityPursuitStats.nearbyHeistPrompt.cooldownLeftSec}s left)
                          {cityPursuitStats.nearbyHeistPrompt.category !== 'HOUSE' && (
                            <span className="text-emerald-300"> · [V] Explore Lobby</span>
                          )}
                        </span>
                      ) : cityPursuitStats.nearbyHeistPrompt.isRobbingNow ? (
                        <span className="text-amber-300 font-bold animate-pulse">
                          🚨 CRACKING VAULT / SMASHING CASES ({cityPursuitStats.nearbyHeistPrompt.robberyProgressPct}%)... STAY IN RING!
                        </span>
                      ) : cityPursuitStats.nearbyHeistPrompt.category === 'HOUSE' ? (
                        <>
                          Private Residence · Press <strong className="text-amber-300">[R]</strong> to break in &amp; rob{' '}
                          <strong className="text-emerald-400">
                            +${cityPursuitStats.nearbyHeistPrompt.payoutCash.toLocaleString()}
                          </strong>{' '}
                          (Clear floor bots to unlock floor vault!)
                        </>
                      ) : cityPursuitStats.isPoliceOnDuty ? (
                        <>
                          Press <strong className="text-emerald-300">[V]</strong> to explore inside, talk to staff &amp; play mini-games!
                        </>
                      ) : (
                        <>
                          Press <strong className="text-emerald-300">[V]</strong> to explore peacefully, or{' '}
                          <strong className="text-amber-300">[R]</strong> to heist{' '}
                          <strong className="text-emerald-400">
                            +${cityPursuitStats.nearbyHeistPrompt.payoutCash.toLocaleString()}
                          </strong>!
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {cityPursuitStats.nearbyHeistPrompt.category !== 'HOUSE' && (
                      <button
                        type="button"
                        onClick={() => {
                          physicsRef.current?.triggerExploreBuilding(
                            'heist_target',
                            cityPursuitStats.nearbyHeistPrompt?.targetId
                          );
                          if (physicsRef.current) {
                            setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                          }
                        }}
                        className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-black font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer shrink-0"
                      >
                        🚪 [V] Explore
                      </button>
                    )}

                    {cityPursuitStats.nearbyHeistPrompt.robbable !== false &&
                      !cityPursuitStats.isPoliceOnDuty &&
                      cityPursuitStats.nearbyHeistPrompt.cooldownLeftSec <= 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            physicsRef.current?.triggerRobberyAtNearestTarget(
                              cityPursuitStats.nearbyHeistPrompt?.targetId
                            );
                            if (physicsRef.current) {
                              setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                            }
                          }}
                          className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-black font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer shrink-0"
                        >
                          {cityPursuitStats.nearbyHeistPrompt.isRobbingNow
                            ? '💰 [R] Grab!'
                            : '🎮 [R] Heist'}
                        </button>
                      )}
                  </div>
                </div>

                {cityPursuitStats.nearbyHeistPrompt.isRobbingNow && (
                  <div className="w-full h-2.5 rounded-full bg-black border border-amber-400/40 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 via-yellow-300 to-emerald-400 transition-all duration-75"
                      style={{ width: `${cityPursuitStats.nearbyHeistPrompt.robberyProgressPct}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PROXIMITY TOP-DOWN RETRO SPORTS MINIGAME PROMPT (BASKETBALL / GOLF / BASEBALL) */}
          {cityPursuitStats.nearbySportsPrompt && !cityPursuitStats.nearbyHeistPrompt && (
            <div className="absolute bottom-24 right-4 md:right-6 z-50 w-[92%] max-w-lg pointer-events-auto">
              <div className="bg-zinc-950/95 border-2 border-emerald-400 rounded-2xl p-3.5 shadow-[0_0_32px_rgba(16,185,129,0.48)] backdrop-blur-md flex items-center justify-between gap-3 font-mono">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-emerald-400 text-black font-black text-[10px] uppercase">
                      {cityPursuitStats.nearbySportsPrompt.icon} RETRO {cityPursuitStats.nearbySportsPrompt.sport.toUpperCase()}
                    </span>
                    <span className="text-xs font-black text-white truncate">
                      {cityPursuitStats.nearbySportsPrompt.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-300 mt-1">
                    {cityPursuitStats.nearbySportsPrompt.rewardDesc} · Press{' '}
                    <strong className="text-emerald-300">[B]</strong> to play
                    {cityPursuitStats.nearbyCityBuildingPrompt && (
                      <>
                        {' '}· <strong className="text-sky-300">[V]</strong> Explore Building
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {cityPursuitStats.nearbyCityBuildingPrompt && (
                    <button
                      type="button"
                      onClick={() => {
                        physicsRef.current?.triggerExploreBuilding(
                          'city_building',
                          cityPursuitStats.nearbyCityBuildingPrompt?.id
                        );
                        if (physicsRef.current) {
                          setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-sky-400 hover:bg-sky-300 text-black font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer shrink-0"
                    >
                      🚪 [V] Explore
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      physicsRef.current?.triggerSportsMinigame(
                        cityPursuitStats.nearbySportsPrompt?.venueId
                      );
                      if (physicsRef.current) {
                        setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-black font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer shrink-0"
                  >
                    {cityPursuitStats.nearbySportsPrompt.icon} [B] PLAY
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PROXIMITY PIT STOP SERVICE / GAS / EV STATION PROMPT */}
          {cityPursuitStats.nearbyServicePrompt &&
            !cityPursuitStats.nearbyHeistPrompt &&
            !cityPursuitStats.nearbySportsPrompt && (
              <div className="absolute bottom-24 right-4 md:right-6 z-50 w-[94%] max-w-lg pointer-events-auto">
                <div className="bg-zinc-950/95 border-2 border-amber-400 rounded-2xl p-3.5 shadow-[0_0_28px_rgba(251,191,36,0.45)] backdrop-blur-md flex items-center justify-between gap-3 font-mono">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-amber-400 text-black font-black text-[10px] uppercase">
                        {cityPursuitStats.nearbyServicePrompt.icon} PIT SERVICE
                      </span>
                      <span className="text-xs font-black text-white truncate">
                        {cityPursuitStats.nearbyServicePrompt.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 mt-1">
                      <strong className="text-amber-300">[F]</strong> Nitro + Wash (
                      {cityPursuitStats.nearbyServicePrompt.cost > 0
                        ? `$${cityPursuitStats.nearbyServicePrompt.cost}`
                        : 'Free'}
                      ) · <strong className="text-emerald-300">[V]</strong> Explore Lounge &amp; Arcade
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        physicsRef.current?.triggerExploreBuilding(
                          'service',
                          cityPursuitStats.nearbyServicePrompt?.id
                        );
                        if (physicsRef.current) {
                          setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-black font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer shrink-0"
                    >
                      🚪 [V] Explore
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        physicsRef.current?.triggerServiceStationPitStop(
                          cityPursuitStats.nearbyServicePrompt?.id
                        );
                        if (physicsRef.current) {
                          setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer shrink-0"
                    >
                      ⛽ [F] SERVICE
                    </button>
                  </div>
                </div>
              </div>
            )}

          {/* PROXIMITY CAR MEET SHOWCASE PROMPT */}
          {cityPursuitStats.nearbyCarMeetPrompt &&
            !cityPursuitStats.nearbyHeistPrompt &&
            !cityPursuitStats.nearbySportsPrompt &&
            !cityPursuitStats.nearbyServicePrompt && (
              <div className="absolute bottom-24 right-4 md:right-6 z-50 w-[92%] max-w-md pointer-events-auto">
                <div className="bg-zinc-950/95 border-2 border-fuchsia-400 rounded-2xl p-3.5 shadow-[0_0_28px_rgba(232,121,249,0.45)] backdrop-blur-md flex items-center justify-between gap-3 font-mono">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-fuchsia-400 text-black font-black text-[10px] uppercase">
                        {cityPursuitStats.nearbyCarMeetPrompt.icon} CAR MEET
                      </span>
                      <span className="text-xs font-black text-white truncate">
                        {cityPursuitStats.nearbyCarMeetPrompt.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 mt-1">
                      Showcase Prize:{' '}
                      <strong className="text-emerald-400">
                        +${cityPursuitStats.nearbyCarMeetPrompt.payoutCash.toLocaleString()}
                      </strong>{' '}
                      + 100% Nitro · Press <strong className="text-fuchsia-300">[F]</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={cityPursuitStats.nearbyCarMeetPrompt.cooldownLeftSec > 0}
                    onClick={() => {
                      physicsRef.current?.triggerCarMeetShowcase(
                        cityPursuitStats.nearbyCarMeetPrompt?.id
                      );
                      if (physicsRef.current) {
                        setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                      }
                    }}
                    className={`px-3.5 py-2 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shrink-0 ${
                      cityPursuitStats.nearbyCarMeetPrompt.cooldownLeftSec > 0
                        ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-fuchsia-400 to-cyan-400 hover:from-fuchsia-300 hover:to-cyan-300 text-black cursor-pointer'
                    }`}
                  >
                    {cityPursuitStats.nearbyCarMeetPrompt.cooldownLeftSec > 0
                      ? `⏳ ${cityPursuitStats.nearbyCarMeetPrompt.cooldownLeftSec}s`
                      : '🏁 [F] SHOW OFF'}
                  </button>
                </div>
              </div>
            )}

          {/* PROXIMITY REAL ESTATE HOUSE / PENTHOUSE BUY, SET HOME, OR ROB PROMPT */}
          {cityPursuitStats.nearbyHousePrompt &&
            !cityPursuitStats.nearbyHeistPrompt &&
            !cityPursuitStats.nearbySportsPrompt &&
            !cityPursuitStats.nearbyServicePrompt &&
            !cityPursuitStats.nearbyCarMeetPrompt && (
            <div className="absolute bottom-24 right-4 md:right-6 z-50 w-[92%] max-w-lg pointer-events-auto">
              <div className="bg-zinc-950/95 border-2 border-emerald-400 rounded-2xl p-3.5 shadow-[0_0_28px_rgba(16,185,129,0.45)] backdrop-blur-md flex items-center justify-between gap-3 font-mono">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-emerald-400 text-black font-black text-[10px] uppercase">
                      {cityPursuitStats.nearbyHousePrompt.icon}{' '}
                      {cityPursuitStats.nearbyHousePrompt.isOwned
                        ? 'OWNED PROPERTY'
                        : cityPursuitStats.nearbyHousePrompt.price > 0
                        ? 'FOR SALE / ROBBABLE'
                        : 'RESIDENCE / ROBBABLE'}
                    </span>
                    <span className="text-xs font-black text-white truncate">
                      {cityPursuitStats.nearbyHousePrompt.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-300 mt-1">
                    {cityPursuitStats.nearbyHousePrompt.isOwned ? (
                      <>
                        Generating <strong className="text-emerald-400">+${Math.round(cityPursuitStats.nearbyHousePrompt.passiveIncomePerMin / 2).toLocaleString()} / 30s</strong> ·{' '}
                        <strong className="text-cyan-300">[V] Explore Inside</strong>
                      </>
                    ) : cityPursuitStats.nearbyHousePrompt.price > 0 ? (
                      <>
                        Buy <strong className="text-amber-300">${cityPursuitStats.nearbyHousePrompt.price.toLocaleString()}</strong> · Rent{' '}
                        <strong className="text-emerald-400">
                          +${Math.round(cityPursuitStats.nearbyHousePrompt.passiveIncomePerMin / 2).toLocaleString()}/30s
                        </strong>
                        {!cityPursuitStats.isPoliceOnDuty && (
                          <>
                            {' '}· Or{' '}
                            <strong className="text-rose-400">
                              {cityPursuitStats.nearbyHousePrompt.hideRobPayout
                                ? '[R] Rob (Loot: ???)'
                                : `[R] Rob +$${(cityPursuitStats.nearbyHousePrompt.robPayoutCash / 1000).toFixed(1)}k`}
                            </strong>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        Private Residence ·{' '}
                        {!cityPursuitStats.isPoliceOnDuty ? (
                          <strong className="text-rose-400">
                            {cityPursuitStats.nearbyHousePrompt.hideRobPayout
                              ? '[R] Break In & Rob (Loot: ???)'
                              : `[R] Rob +$${(cityPursuitStats.nearbyHousePrompt.robPayoutCash / 1000).toFixed(1)}k`}
                          </strong>
                        ) : (
                          <span className="text-zinc-400">On Patrol</span>
                        )}
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {cityPursuitStats.nearbyHousePrompt.isOwned && (
                    <button
                      type="button"
                      onClick={() => {
                        if (cityPursuitStats.nearbyHousePrompt) {
                          physicsRef.current?.triggerExploreBuilding(
                            'owned_house',
                            cityPursuitStats.nearbyHousePrompt.houseId
                          );
                          if (physicsRef.current) {
                            setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                          }
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-black font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer shrink-0"
                    >
                      🚪 [V] Enter Home
                    </button>
                  )}

                  {!cityPursuitStats.nearbyHousePrompt.isOwned && !cityPursuitStats.isPoliceOnDuty && (
                    <button
                      type="button"
                      disabled={cityPursuitStats.nearbyHousePrompt.robCooldownLeftSec > 0}
                      onClick={() => {
                        if (cityPursuitStats.nearbyHousePrompt) {
                          physicsRef.current?.triggerHouseRobbery(cityPursuitStats.nearbyHousePrompt.houseId);
                          if (physicsRef.current) {
                            setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                          }
                        }
                      }}
                      className={`px-3 py-2 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shrink-0 ${
                        cityPursuitStats.nearbyHousePrompt.robCooldownLeftSec > 0
                          ? 'bg-zinc-800 text-zinc-400 border border-white/10 cursor-not-allowed'
                          : 'bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-black cursor-pointer'
                      }`}
                    >
                      {cityPursuitStats.nearbyHousePrompt.robCooldownLeftSec > 0
                        ? `🔒 ${cityPursuitStats.nearbyHousePrompt.robCooldownLeftSec}s`
                        : cityPursuitStats.nearbyHousePrompt.hideRobPayout
                        ? '🏠 [R] Rob House (???)'
                        : `🏠 [R] Rob ($${(cityPursuitStats.nearbyHousePrompt.robPayoutCash / 1000).toFixed(1)}k)`}
                    </button>
                  )}

                  {(cityPursuitStats.nearbyHousePrompt.isOwned || cityPursuitStats.nearbyHousePrompt.price > 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (cityPursuitStats.nearbyHousePrompt) {
                          physicsRef.current?.buyOrSelectCityHouse(cityPursuitStats.nearbyHousePrompt.houseId);
                          if (physicsRef.current) {
                            setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                          }
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-black font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer shrink-0"
                    >
                      {cityPursuitStats.nearbyHousePrompt.isOwned
                        ? '🏡 Set Home'
                        : `Buy ($${(cityPursuitStats.nearbyHousePrompt.price / 1000).toFixed(1)}k)`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PROXIMITY EXPLORABLE CITY BUILDING PROMPT (ANY PUBLIC / LANDMARK BUILDING) */}
          {cityPursuitStats.nearbyCityBuildingPrompt &&
            !cityPursuitStats.nearbyHeistPrompt &&
            !cityPursuitStats.nearbySportsPrompt &&
            !cityPursuitStats.nearbyServicePrompt &&
            !cityPursuitStats.nearbyCarMeetPrompt &&
            !cityPursuitStats.nearbyHousePrompt && (
              <div className="absolute bottom-24 right-4 md:right-6 z-50 w-[92%] max-w-lg pointer-events-auto">
                <div className="bg-zinc-950/95 border-2 border-sky-400 rounded-2xl p-3.5 shadow-[0_0_28px_rgba(56,189,248,0.45)] backdrop-blur-md flex items-center justify-between gap-3 font-mono">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-sky-400 text-black font-black text-[10px] uppercase">
                        {cityPursuitStats.nearbyCityBuildingPrompt.icon}{' '}
                        {cityPursuitStats.nearbyCityBuildingPrompt.categoryLabel}
                      </span>
                      <span className="text-xs font-black text-white truncate">
                        {cityPursuitStats.nearbyCityBuildingPrompt.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 mt-1">
                      {cityPursuitStats.nearbyCityBuildingPrompt.floorsLabel} · Explore-Only Building · Press{' '}
                      <strong className="text-sky-300">[V]</strong> to step inside!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (cityPursuitStats.nearbyCityBuildingPrompt) {
                        physicsRef.current?.triggerExploreBuilding(
                          'city_building',
                          cityPursuitStats.nearbyCityBuildingPrompt.id
                        );
                        if (physicsRef.current) {
                          setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                        }
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-400 to-emerald-400 hover:from-sky-300 hover:to-emerald-300 text-black font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer shrink-0"
                  >
                    🚪 [V] Explore
                  </button>
                </div>
              </div>
            )}

          {/* 5-STAR HEIST SAFEHOUSE ESCAPE BANNER: FLEE BACK TO YOUR HOUSE WITHOUT POLICE SEEING YOU! */}
          {cityPursuitStats.pendingHeistLoot && (
            <div className="absolute top-[110px] left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-xl bg-zinc-950/95 border-2 border-rose-500 rounded-2xl px-4 py-3 shadow-[0_0_32px_rgba(244,63,94,0.55)] backdrop-blur-md flex items-center justify-between gap-3 pointer-events-auto font-mono">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-black text-[10px] uppercase animate-pulse">
                    🚨 ★5 HEIST GETAWAY · +${cityPursuitStats.pendingHeistLoot.amount.toLocaleString()} IN TRUNK
                  </span>
                  <span className="text-xs font-black text-white truncate">
                    Flee to {cityPursuitStats.pendingHeistLoot.homeName}!
                  </span>
                </div>
                <p className="text-[11px] mt-1 font-bold">
                  {cityPursuitStats.pendingHeistLoot.copSeesYouNow ? (
                    <span className="text-rose-400">
                      👁️ POLICE HAVE VISUAL ON YOU! Break Line-of-Sight behind skyscrapers before entering your house!
                    </span>
                  ) : (
                    <span className="text-emerald-400">
                      🕶️ CLEAR OF POLICE VISUAL! Drive into your House ring NOW to bank +$
                      {cityPursuitStats.pendingHeistLoot.amount.toLocaleString()} &amp; clear ★5 heat!
                    </span>
                  )}
                </p>
              </div>

              <div className="text-right shrink-0">
                <div className="flex items-center justify-end gap-1 text-sm font-black text-emerald-300 tabular-nums">
                  <span
                    className="inline-block text-amber-400"
                    style={{
                      transform: `rotate(${-cityPursuitStats.pendingHeistLoot.directionDeg}deg)`,
                    }}
                  >
                    ↑
                  </span>
                  <span>{cityPursuitStats.pendingHeistLoot.distMeters}m</span>
                </div>
                <span className="text-[9px] font-black uppercase text-zinc-400 block">
                  🏡 SAFEHOUSE GPS
                </span>
              </div>
            </div>
          )}

          {/* LIVE ACTIVE REGULAR JOB BANNER (TAXI DRIVER, PIZZA DELIVERY, EXPRESS COURIER, BURGER BLITZ, PARAMEDIC) */}
          {cityPursuitStats.activeRegularJob && !cityPursuitStats.pendingHeistLoot && (
            <div className="absolute top-[112px] left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-lg bg-zinc-950/92 border-2 border-amber-400/80 rounded-2xl px-4 py-2.5 shadow-[0_0_25px_rgba(250,204,21,0.3)] backdrop-blur-md flex items-center justify-between gap-3 pointer-events-auto">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-400 text-black font-mono font-black text-[9px] uppercase">
                    {cityPursuitStats.activeRegularJob.icon} {cityPursuitStats.activeRegularJob.roleLabel} ·{' '}
                    {cityPursuitStats.activeRegularJob.stage}
                  </span>
                  <span className="text-xs font-black text-white truncate">
                    {cityPursuitStats.activeRegularJob.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 font-mono text-[11px]">
                  <span className="text-amber-300 font-bold truncate">
                    📍 {cityPursuitStats.activeRegularJob.targetLabel}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[9px] font-black shrink-0">
                    STREAK x{cityPursuitStats.activeRegularJob.streakCount} · SHIFT: +$
                    {cityPursuitStats.activeRegularJob.shiftEarnedCash.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 font-mono">
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1 text-xs font-black text-cyan-300 tabular-nums">
                    <span
                      className="inline-block text-amber-400"
                      style={{
                        transform: `rotate(${-cityPursuitStats.activeRegularJob.directionDeg}deg)`,
                      }}
                    >
                      ↑
                    </span>
                    <span>{cityPursuitStats.activeRegularJob.distMeters}m</span>
                  </div>
                  <span
                    className={`text-[10px] font-black tabular-nums block ${
                      cityPursuitStats.activeRegularJob.timeLeftSec < 15
                        ? 'text-red-400 animate-pulse'
                        : 'text-emerald-300'
                    }`}
                  >
                    ⏱️ {cityPursuitStats.activeRegularJob.timeLeftSec.toFixed(1)}s
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.stopCityRegularJob();
                    if (physicsRef.current) {
                      setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-red-600 text-zinc-300 hover:text-white border border-white/15 font-mono font-bold text-[10px] cursor-pointer transition-colors"
                >
                  Clock Out
                </button>
              </div>
            </div>
          )}

          {/* Live Active Street Mission Waypoint Compass & Countdown Banner (Top-Center below alerts) */}
          {cityPursuitStats.activeMission && (
            <div className="absolute top-[112px] left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-lg bg-zinc-950/92 border-2 border-emerald-400/70 rounded-2xl px-4 py-2.5 shadow-[0_0_25px_rgba(16,185,129,0.3)] backdrop-blur-md flex items-center justify-between gap-3 pointer-events-auto">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-400 text-black font-mono font-black text-[9px] uppercase">
                    {cityPursuitStats.activeMission.category} · +${cityPursuitStats.activeMission.rewardCash.toLocaleString()}
                  </span>
                  <span className="text-xs font-black text-white truncate">
                    {cityPursuitStats.activeMission.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 font-mono text-[11px]">
                  <span className="text-emerald-300 font-bold truncate">
                    📍 {cityPursuitStats.activeMission.waypointLabel} (
                    {cityPursuitStats.activeMission.waypointIndex}/{cityPursuitStats.activeMission.totalWaypoints})
                  </span>
                  {cityPursuitStats.activeMission.minSpeedKmh && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[9px] font-black">
                      REQ {cityPursuitStats.activeMission.minSpeedKmh}+ KM/H
                    </span>
                  )}
                  {cityPursuitStats.activeMission.maxCrashesAllowed !== undefined && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-400/40 text-rose-300 text-[9px] font-black">
                      CRASHES: {cityPursuitStats.activeMission.crashesTaken}/{cityPursuitStats.activeMission.maxCrashesAllowed}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 font-mono">
                {!cityPursuitStats.activeMission.awaitingEscape && (
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1 text-xs font-black text-cyan-300 tabular-nums">
                      <span
                        className="inline-block text-emerald-400"
                        style={{
                          transform: `rotate(${-cityPursuitStats.activeMission.directionDeg}deg)`,
                        }}
                      >
                        ↑
                      </span>
                      <span>{cityPursuitStats.activeMission.distMeters}m</span>
                    </div>
                    <span
                      className={`text-[10px] font-black tabular-nums block ${
                        cityPursuitStats.activeMission.timeLeftSec < 15 ? 'text-red-400 animate-pulse' : 'text-amber-300'
                      }`}
                    >
                      ⏱️ {cityPursuitStats.activeMission.timeLeftSec.toFixed(1)}s
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.abandonCityMission();
                    if (physicsRef.current) {
                      setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-red-600 text-zinc-300 hover:text-white border border-white/15 font-mono font-bold text-[10px] cursor-pointer transition-colors"
                >
                  Abandon
                </button>
              </div>
            </div>
          )}

          {/* OFFICIAL POLICE BADGE & ACTIVE DUTY STATUS */}
          {cityPursuitStats.isPoliceOnDuty && (
            <div className="absolute top-[18px] left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-blue-950/95 via-indigo-900/95 to-blue-950/95 border-2 border-amber-400/80 rounded-2xl px-4 py-1.5 shadow-[0_0_25px_rgba(59,130,246,0.4)] backdrop-blur-md flex items-center gap-3 pointer-events-auto">
              <div className="w-8 h-8 rounded-full bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-amber-300 shadow-[0_0_12px_#facc15] font-black text-sm">
                ⭐
              </div>
              <div className="flex flex-col text-left font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black tracking-widest text-amber-300 uppercase">
                    MCPD BADGE #{cityPursuitStats.policeRank === 'Sergeant' ? '204' : '108'}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/40 uppercase font-black">
                    ON PATROL
                  </span>
                </div>
                <span className="text-xs font-black text-white uppercase tracking-wider">
                  {cityPursuitStats.policeRank} • SHIFT: +${cityPursuitStats.policeShiftEarnings.toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  physicsRef.current?.togglePlayerSiren();
                  if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                }}
                className={`ml-1 px-3 py-1 rounded-xl font-mono font-black text-[10px] uppercase transition-all cursor-pointer ${
                  cityPursuitStats.policeSirenActive
                    ? 'bg-rose-500 text-white animate-pulse shadow-[0_0_15px_#ef4444]'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-blue-300 border border-blue-400/40'
                }`}
              >
                🚨 {cityPursuitStats.policeSirenActive ? 'SIREN ON' : 'SIREN [P]'}
              </button>
            </div>
          )}

          {/* 3D POLICE PRECINCT DRIVE-IN PORTAL BANNER */}
          {cityPursuitStats.policePrecinctNear && (
            <div className="absolute top-[72px] left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-blue-950/95 via-sky-900/95 to-blue-950/95 border-2 border-sky-400 rounded-2xl px-4 py-2.5 shadow-[0_0_25px_rgba(56,189,248,0.45)] backdrop-blur-md flex items-center gap-3.5 pointer-events-auto">
              <div className="w-9 h-9 rounded-full bg-blue-500/30 border-2 border-sky-300 flex items-center justify-center text-lg shadow-[0_0_12px_#38bdf8]">
                ⭐
              </div>
              <div className="text-left font-mono">
                <div className="text-[10px] font-black tracking-widest text-sky-300 uppercase">
                  MCPD CENTRAL PRECINCT • DRIVE-IN PORTAL ({cityPursuitStats.policeStationPrompt?.distMeters || 0}M)
                </div>
                <div className="text-xs font-black text-white">
                  {cityPursuitStats.isPoliceOnDuty
                    ? `ON POLICE DUTY • SHIFT PAYOUT: +$${cityPursuitStats.policeShiftEarnings.toLocaleString()}`
                    : 'DRIVE INTO GLOWING BEACON TO BECOME POLICE OFFICER & EQUIP SIRENS!'}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.triggerExploreBuilding('police');
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-black font-mono font-black text-[10px] uppercase tracking-wider shadow-lg cursor-pointer"
                >
                  🚪 [V] Explore Precinct
                </button>
                {!cityPursuitStats.isPoliceOnDuty ? (
                  <button
                    type="button"
                    onClick={() => {
                      physicsRef.current?.clockInPoliceDuty();
                      if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-400 to-blue-600 hover:from-sky-300 hover:to-blue-500 text-white font-mono font-black text-[10px] uppercase tracking-wider shadow-lg cursor-pointer"
                  >
                    Clock In [E]
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      physicsRef.current?.clockOutPoliceDuty();
                      if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-rose-600 text-zinc-300 hover:text-white border border-white/20 font-mono font-black text-[10px] uppercase cursor-pointer"
                  >
                    End Shift
                  </button>
                )}
              </div>
            </div>
          )}

          {/* FLOATING POLICE RADAR SPEED GUN TARGET HUD (TOP-CENTER/RIGHT) */}
          {cityPursuitStats.radarTarget && (
            <div className="absolute top-[74px] right-3.5 md:right-5 z-40 w-[320px] sm:w-[360px] bg-zinc-950/95 border-2 border-blue-500/60 rounded-2xl p-3 shadow-2xl backdrop-blur-md flex flex-col gap-2 font-mono text-left pointer-events-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                  <span className="text-[10px] font-black text-blue-300 uppercase tracking-wider">
                    🎯 MCPD RADAR: {cityPursuitStats.radarTarget.modelName}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-white/20 text-white font-black text-[9px]">
                    {cityPursuitStats.radarTarget.licensePlate} ({cityPursuitStats.radarTarget.colorName})
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsRadarGunMinimized((prev) => !prev)}
                    className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[9px] cursor-pointer"
                    title={isRadarGunMinimized ? 'Expand Radar Target' : 'Minimize Radar Target'}
                  >
                    {isRadarGunMinimized ? '▼' : '▲'}
                  </button>
                </div>
              </div>

              {!isRadarGunMinimized && (
                <>
              <div className="flex items-center justify-between text-xs bg-zinc-900/80 rounded-xl p-2 border border-white/5">
                <div className="flex items-baseline gap-1">
                  <span className="text-zinc-400 text-[10px]">RADAR:</span>
                  <span
                    className={`font-black text-sm tabular-nums ${
                      cityPursuitStats.radarTarget.clockedSpeedMph > cityPursuitStats.radarTarget.speedLimitMph + 5
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {cityPursuitStats.radarTarget.clockedSpeedMph} MPH
                  </span>
                  <span className="text-zinc-500 text-[10px]">
                    / {cityPursuitStats.radarTarget.speedLimitMph} Limit ({cityPursuitStats.radarTarget.distMeters}m)
                  </span>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                    cityPursuitStats.radarTarget.probableCauseValid
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {cityPursuitStats.radarTarget.status}
                </span>
              </div>

              {/* Lawful Cause Details */}
              <div className="text-[9px] leading-tight px-1">
                {cityPursuitStats.radarTarget.probableCauseValid ? (
                  <span className="text-emerald-300 font-bold">
                    ✓ Lawful Cause: {cityPursuitStats.radarTarget.probableCauseReason}
                  </span>
                ) : (
                  <span className="text-amber-300/90 font-medium">
                    ⚠️ Probable Cause Required: {cityPursuitStats.radarTarget.probableCauseReason}
                  </span>
                )}
              </div>

              {/* Compliance & Fleeing Status Banner */}
              {cityPursuitStats.radarTarget.isCompliant && (
                <div className="bg-emerald-950/70 border border-emerald-500/50 rounded-lg px-2 py-1 text-[9px] text-emerald-300 font-bold flex items-center justify-between">
                  <span>🟢 PULLED OVER & COMPLIED</span>
                  <span className="text-[8px] text-emerald-400/80">DO NOT RAM (-$5k FINE)</span>
                </div>
              )}
              {cityPursuitStats.radarTarget.isFleeing && (
                <div className="bg-rose-950/70 border border-rose-500/50 rounded-lg px-2 py-1 text-[9px] text-rose-300 font-bold flex items-center justify-between">
                  <span>🔴 FLEEING SUSPECT</span>
                  <span className="text-[8px] text-rose-400/80">PIT AUTHORIZED ($0 LIAB)</span>
                </div>
              )}

              {/* Action Buttons: Pull Over, Ticket, Arrest */}
              {cityPursuitStats.isPoliceOnDuty && (
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    disabled={!cityPursuitStats.radarTarget.probableCauseValid}
                    onClick={() => {
                      physicsRef.current?.pullOverTargetVehicle();
                      if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                    }}
                    className={`py-1.5 px-1 rounded-lg font-black text-[9px] uppercase cursor-pointer transition-all ${
                      cityPursuitStats.radarTarget.probableCauseValid
                        ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-md'
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                    }`}
                  >
                    🛑 Pull Over [R]
                  </button>

                  <button
                    type="button"
                    disabled={!cityPursuitStats.radarTarget.probableCauseValid || cityPursuitStats.radarTarget.isFleeing}
                    onClick={() => {
                      physicsRef.current?.issueCitationToTarget();
                      if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                    }}
                    className={`py-1.5 px-1 rounded-lg font-black text-[9px] uppercase cursor-pointer transition-all ${
                      cityPursuitStats.radarTarget.probableCauseValid && !cityPursuitStats.radarTarget.isFleeing
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-md'
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                    }`}
                    title="Give traffic citation to compliant driver"
                  >
                    📝 Ticket [T]
                  </button>

                  <button
                    type="button"
                    disabled={!cityPursuitStats.radarTarget.probableCauseValid}
                    onClick={() => {
                      physicsRef.current?.arrestTargetVehicle();
                      if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                    }}
                    className={`py-1.5 px-1 rounded-lg font-black text-[9px] uppercase cursor-pointer transition-all ${
                      cityPursuitStats.radarTarget.probableCauseValid
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                    }`}
                  >
                    ⚖️ Arrest [F]
                  </button>
                </div>
              )}
              </>
            )}
            </div>
          )}

          {/* ACTIVE PURSUIT / EVASION / APB BANNER (TOP-CENTER) */}
          {cityPursuitStats.wantedStars > 0 && (
            <div className="absolute top-[74px] left-1/2 -translate-x-1/2 z-40 w-[340px] sm:w-[420px] bg-zinc-950/95 border-2 border-red-500/60 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md flex flex-col gap-1.5 font-mono pointer-events-auto">
              <div className="flex items-center justify-between text-[10px]">
                <span
                  className={`font-black ${
                    cityPursuitStats.bustProgress > 10
                      ? 'text-red-400'
                      : cityPursuitStats.pursuitState === 'COOLDOWN'
                      ? 'text-emerald-400'
                      : 'text-sky-300'
                  }`}
                >
                  {cityPursuitStats.bustProgress > 10
                    ? `⚠️ BUSTING (${Math.round(cityPursuitStats.bustProgress)}%)`
                    : cityPursuitStats.pursuitState === 'COOLDOWN'
                    ? `🕶️ HIDDEN — EVADING (${Math.round(cityPursuitStats.escapeProgress)}%)`
                    : `🚨 ${cityPursuitStats.activePoliceUnitsCount} COPS CHASING (${118 + cityPursuitStats.wantedStars * 13} KM/H)`}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 tabular-nums">
                    PD: {cityPursuitStats.closestCopDistMeters}m
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsApbHudMinimized((prev) => !prev)}
                    className="p-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[9px] cursor-pointer"
                    title={isApbHudMinimized ? 'Expand APB HUD' : 'Minimize APB HUD'}
                  >
                    {isApbHudMinimized ? '▼' : '▲'}
                  </button>
                </div>
              </div>

              {!isApbHudMinimized && (
              <div className="w-full h-2 rounded-full bg-black overflow-hidden border border-white/10">
                <div
                  className={`h-full transition-all duration-100 ${
                    cityPursuitStats.bustProgress > 10
                      ? 'bg-red-500'
                      : 'bg-gradient-to-r from-sky-500 to-emerald-400'
                  }`}
                  style={{
                    width: `${
                      cityPursuitStats.bustProgress > 10
                        ? cityPursuitStats.bustProgress
                        : Math.max(8, cityPursuitStats.escapeProgress)
                    }%`,
                  }}
                />
              </div>
              )}
            </div>
          )}

          {/* GAITHERSBURG, MD LIVE WEATHER & DRIVETRAIN TRACTION HUD + DEFERRED CRASH TAB (TOP-LEFT) */}
          <div className="absolute top-[90px] left-3.5 md:left-5 z-40 flex flex-col gap-2 pointer-events-none max-w-[330px] font-mono">
            {currentWeatherState && (() => {
              const carEff = cityPursuitStats.currentStreetCar;
              const tractionInfo = calculateDrivetrainTractionModifier(
                carEff.drivetrain || 'RWD',
                carEff.groundClearance || 'low',
                currentWeatherState
              );
              const weatherEmoji =
                currentWeatherState.isSnowing
                  ? '❄️'
                  : currentWeatherState.condition === 'thunderstorm'
                  ? '⛈️'
                  : currentWeatherState.isRaining
                  ? '🌧️'
                  : currentWeatherState.isFoggy
                  ? '🌫️'
                  : !currentWeatherState.isDay
                  ? '🌙'
                  : currentWeatherState.condition === 'partly_cloudy' || currentWeatherState.condition === 'overcast'
                  ? '⛅'
                  : '☀️';
              const safeGrip = Number.isFinite(tractionInfo.effectiveGrip) ? tractionInfo.effectiveGrip : 1;
              const gripPct = Math.round(safeGrip * 100);
              const safeTempF = Number.isFinite(currentWeatherState.temperatureF) ? currentWeatherState.temperatureF : 53;
              const safeTempC = Number.isFinite(currentWeatherState.temperatureC) ? currentWeatherState.temperatureC : 11.5;
              const safeWind = Number.isFinite(currentWeatherState.windSpeedKmh) ? Math.round(currentWeatherState.windSpeedKmh) : 8;
              const safeHumidity = Number.isFinite(currentWeatherState.relativeHumidity) ? currentWeatherState.relativeHumidity : 65;
              const safeCloud = Number.isFinite(currentWeatherState.cloudCover) ? currentWeatherState.cloudCover : 40;
              return (
                <div className="bg-zinc-950/92 border border-sky-400/35 rounded-2xl p-2.5 shadow-xl pointer-events-auto text-white">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg leading-none shrink-0">{weatherEmoji}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black text-sky-300 uppercase tracking-wider truncate">
                            Gaithersburg, MD
                          </span>
                          <span
                            className={`px-1 py-0.2 rounded text-[8px] font-black uppercase ${
                              currentWeatherState.source === 'live'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                            }`}
                          >
                            {currentWeatherState.source === 'live' ? 'LIVE' : 'TEST'}
                          </span>
                        </div>
                        <div className="text-xs font-black text-white truncate">
                          {safeTempF}°F ({safeTempC}°C) · {currentWeatherState.conditionLabel}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowWeatherSelector((prev) => !prev)}
                      className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-sky-500 hover:text-black text-sky-300 border border-sky-400/30 text-[9px] font-black uppercase cursor-pointer shrink-0 transition-colors"
                    >
                      {showWeatherSelector ? 'Hide' : 'Weather'}
                    </button>
                  </div>

                  {/* Time & Drivetrain Traction Bar */}
                  <div className="mt-1.5 pt-1.5 border-t border-white/10 flex items-center justify-between gap-2 text-[9px]">
                    <span className="text-zinc-300 font-bold">
                      🕒 {currentWeatherState.localTimeString}
                    </span>
                    <span
                      className={`font-black ${
                        gripPct >= 85
                          ? 'text-emerald-400'
                          : gripPct >= 58
                          ? 'text-amber-300'
                          : 'text-rose-400'
                      }`}
                    >
                      GRIP {gripPct}% ({carEff.drivetrain || 'RWD'} · {(carEff.groundClearance || 'low').toUpperCase()})
                    </span>
                  </div>

                  {(currentWeatherState.isSnowing || currentWeatherState.isRaining) && (
                    <div className="mt-1 text-[9px] font-bold text-amber-300 leading-tight">
                      {tractionInfo.tractionSummary}
                    </div>
                  )}

                  {/* Interactive Weather, Sunrise/Sunset & Time-of-Day Controls */}
                  {showWeatherSelector && (
                    <div className="mt-2 pt-2 border-t border-white/15 flex flex-col gap-1.5 text-[9px]">
                      <div className="grid grid-cols-3 gap-1 text-zinc-300 bg-black/50 p-1.5 rounded-lg border border-white/5">
                        <span>💨 {safeWind} km/h</span>
                        <span>💧 {safeHumidity}% RH</span>
                        <span>☁️ {safeCloud}% Cld</span>
                      </div>
                      {(currentWeatherState.sunriseString || currentWeatherState.sunsetString) && (
                        <div className="flex items-center justify-between text-amber-200/90 bg-black/45 px-2 py-1 rounded-lg border border-amber-400/20 font-bold">
                          <span>🌅 {currentWeatherState.sunriseString || '--:--'}</span>
                          <span className="text-zinc-400">
                            ☀️ {(currentWeatherState.sunElevationDeg ?? 0).toFixed(0)}°
                          </span>
                          <span>🌇 {currentWeatherState.sunsetString || '--:--'}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {(
                          [
                            { id: 'live', label: '🕒 Live' },
                            { id: 'sunrise', label: '🌅 Sunrise' },
                            { id: 'morning', label: '🌤️ AM' },
                            { id: 'noon', label: '☀️ Noon' },
                            { id: 'golden_hour', label: '🌇 Golden' },
                            { id: 'sunset', label: '🌆 Sunset' },
                            { id: 'night', label: '🌙 Night' },
                          ] as { id: TimeOfDayPreset; label: string }[]
                        ).map((tOpt) => {
                          const active = (cityPursuitStats.timeOfDayPreset || 'live') === tOpt.id;
                          return (
                            <button
                              key={tOpt.id}
                              type="button"
                              onClick={() => {
                                physicsRef.current?.setTimeOfDayPreset(tOpt.id);
                                if (physicsRef.current) {
                                  setCurrentWeatherState({ ...physicsRef.current.currentWeather });
                                  setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                                }
                              }}
                              className={`px-1.5 py-0.5 rounded border font-black cursor-pointer transition-colors ${
                                active
                                  ? 'bg-amber-400 text-black border-amber-200'
                                  : 'bg-zinc-900 hover:bg-amber-400/30 text-zinc-200 border-white/15'
                              }`}
                            >
                              {tOpt.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(
                          [
                            { id: 'live_gaithersburg', label: '📡 Live MD' },
                            { id: 'clear', label: '☀️ Clear' },
                            { id: 'fog', label: '🌫️ Fog' },
                            { id: 'rain', label: '🌧️ Rain' },
                            { id: 'heavy_rain', label: '⛈️ Heavy Rain' },
                            { id: 'snow', label: '❄️ Snow' },
                            { id: 'heavy_snow', label: '🌨️ Blizzard' },
                          ] as { id: WeatherMode; label: string }[]
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              physicsRef.current?.setWeatherMode(opt.id);
                              if (physicsRef.current) {
                                setCurrentWeatherState({ ...physicsRef.current.currentWeather });
                              }
                            }}
                            className="px-2 py-1 rounded bg-zinc-900 hover:bg-sky-500 hover:text-black text-zinc-200 border border-white/15 font-black cursor-pointer transition-colors"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* DEFERRED CRASH INSURANCE TAB BANNER (ONLY IF OWED) */}
            {cityPursuitStats.unpaidCrashTicketsTab > 0 && (
              <div className="bg-amber-950/90 border border-amber-400/50 rounded-xl p-2 flex items-center justify-between gap-3 pointer-events-auto">
                <div>
                  <span className="text-[9px] text-amber-300 font-black block uppercase">
                    📝 DEFERRED CRASH INSURANCE TAB
                  </span>
                  <span className="text-xs font-black text-white">
                    ${cityPursuitStats.unpaidCrashTicketsTab.toLocaleString()} Owed
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.payUnpaidCrashTicketsTab();
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-black text-[10px] uppercase cursor-pointer shrink-0"
                >
                  Pay Tab
                </button>
              </div>
            )}
          </div>

          {/* SLEEK IN-CAR DRIVING COCKPIT HUD (BOTTOM-LEFT) — MINIMIZABLE */}
          <div className="absolute bottom-3.5 left-3.5 md:left-5 z-30 w-[340px] sm:w-[410px] bg-zinc-950/95 border border-white/15 rounded-2xl p-3 shadow-2xl backdrop-blur-md flex flex-col gap-2 pointer-events-auto font-mono select-none">
            {/* Top Row: Speedometer, Speed Limit, Zone & Minimize Toggle */}
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
              <div className="flex items-center gap-2.5">
                {/* American Speed Limit Sign */}
                <div className="bg-white border-2 border-black rounded px-1.5 py-0.5 text-center leading-none shadow shrink-0">
                  <span className="text-[7px] font-black text-black block tracking-tighter">SPEED<br/>LIMIT</span>
                  <span className="text-sm font-black text-black tracking-tight">{cityPursuitStats.currentSpeedLimitMph || 55}</span>
                </div>

                {/* Digital Speed & Zone */}
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-white tabular-nums tracking-tight">
                      {Math.round(Math.abs(Number.isFinite(telemetry?.speedKmh ?? 0) ? (telemetry?.speedKmh ?? 0) : 0))}
                    </span>
                    <span className="text-[10px] font-black text-sky-400">KM/H</span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-xs font-bold text-amber-300 tabular-nums">
                      {Math.round(Math.abs(Number.isFinite(telemetry?.speedKmh ?? 0) ? (telemetry?.speedKmh ?? 0) : 0) * 0.621371)} MPH
                    </span>
                  </div>
                  <span className="text-[9px] text-zinc-400 block truncate max-w-[170px] font-bold">
                    {cityPursuitStats.currentZoneName || 'Downtown Financial District'}
                  </span>
                </div>
              </div>

              {/* Wanted Stars & Traffic Signal Bulb */}
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={`text-xs leading-none ${
                        star <= cityPursuitStats.wantedStars
                          ? 'text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.7)]'
                          : 'text-zinc-700'
                      }`}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-black">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      cityPursuitStats.nearestSignalColor === 'RED'
                        ? 'bg-red-500 shadow-[0_0_8px_#ef4444]'
                        : cityPursuitStats.nearestSignalColor === 'YELLOW'
                        ? 'bg-amber-400 shadow-[0_0_8px_#facc15]'
                        : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                    }`}
                  />
                  <span
                    className={
                      cityPursuitStats.nearestSignalColor === 'RED'
                        ? 'text-red-400'
                        : cityPursuitStats.nearestSignalColor === 'YELLOW'
                        ? 'text-amber-300'
                        : 'text-emerald-400'
                    }
                  >
                    {cityPursuitStats.nearestSignalColor} ({cityPursuitStats.nearestSignalSecondsLeft.toFixed(0)}s)
                  </span>

                  {/* Independent Cockpit Minimize Button */}
                  <button
                    type="button"
                    onClick={() => setIsCockpitMinimized((prev) => !prev)}
                    className="ml-1 p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 text-[9px] cursor-pointer"
                    title={isCockpitMinimized ? 'Expand Cockpit HUD' : 'Minimize Cockpit HUD'}
                  >
                    {isCockpitMinimized ? '▼ Expand' : '▲ Min'}
                  </button>
                </div>
              </div>
            </div>

            {!isCockpitMinimized && (
              <>

            {/* Mid Row: Turn Signals, Hazards, Headlights, E-Brake & Horn */}
            <div className="grid grid-cols-6 gap-1 font-mono text-[9px]">
              <button
                type="button"
                onClick={() => {
                  physicsRef.current?.toggleTurnSignal('left');
                  if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                }}
                className={`py-1.5 px-1 rounded-lg border font-black cursor-pointer transition-all flex items-center justify-center gap-0.5 ${
                  (cityPursuitStats.turnSignal === 'left' || cityPursuitStats.turnSignal === 'hazards') &&
                  cityPursuitStats.blinkerFlashOn
                    ? 'bg-emerald-500 text-black border-emerald-300 shadow-[0_0_10px_#10b981]'
                    : cityPursuitStats.turnSignal === 'left'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                    : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                }`}
                title="Toggle Left Turn Signal [Q / []"
              >
                <span>⬅</span>
                <span>[Q]</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  physicsRef.current?.toggleTurnSignal('hazards');
                  if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                }}
                className={`py-1.5 px-1 rounded-lg border font-black cursor-pointer transition-all flex items-center justify-center gap-0.5 ${
                  cityPursuitStats.turnSignal === 'hazards' && cityPursuitStats.blinkerFlashOn
                    ? 'bg-amber-400 text-black border-amber-200 shadow-[0_0_10px_#facc15]'
                    : cityPursuitStats.turnSignal === 'hazards'
                    ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                    : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                }`}
                title="Toggle Hazard Lights [X / Z]"
              >
                <span>⚠️</span>
                <span>[X]</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  physicsRef.current?.toggleTurnSignal('right');
                  if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                }}
                className={`py-1.5 px-1 rounded-lg border font-black cursor-pointer transition-all flex items-center justify-center gap-0.5 ${
                  (cityPursuitStats.turnSignal === 'right' || cityPursuitStats.turnSignal === 'hazards') &&
                  cityPursuitStats.blinkerFlashOn
                    ? 'bg-emerald-500 text-black border-emerald-300 shadow-[0_0_10px_#10b981]'
                    : cityPursuitStats.turnSignal === 'right'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                    : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                }`}
                title="Toggle Right Turn Signal [E / ]]"
              >
                <span>[E]</span>
                <span>➡</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  physicsRef.current?.cycleHeadlightMode();
                  if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                }}
                className={`py-1.5 px-1 rounded-lg border font-black cursor-pointer transition-all flex items-center justify-center gap-0.5 ${
                  cityPursuitStats.effectiveHeadlightState === 'high'
                    ? 'bg-sky-400 text-black border-sky-200 shadow-[0_0_10px_#38bdf8]'
                    : cityPursuitStats.effectiveHeadlightState === 'low'
                    ? 'bg-emerald-500 text-black border-emerald-300 shadow-[0_0_8px_#10b981]'
                    : 'bg-zinc-900 text-zinc-300 border-white/10 hover:text-white'
                }`}
                title="Cycle Headlights: AUTO / LOW / HIGH / OFF [L]"
              >
                <span>💡</span>
                <span>{(cityPursuitStats.headlightMode || 'auto').toUpperCase()}</span>
              </button>

              <div
                className={`py-1.5 px-1 rounded-lg border font-black flex items-center justify-center gap-0.5 transition-all ${
                  cityPursuitStats.handbrakeActive || telemetry?.handbrakeActive
                    ? 'bg-rose-500 text-white border-rose-300 shadow-[0_0_12px_#f43f5e] animate-pulse'
                    : 'bg-zinc-900 text-amber-300 border-white/10'
                }`}
                title="Handbrake / E-Brake Drift & Parking Hold [SPACE]"
              >
                <span>🅿️</span>
                <span>SPC</span>
              </div>

              <button
                type="button"
                onClick={() => physicsRef.current?.honkCityHorn()}
                className="py-1.5 px-1 rounded-lg border border-white/10 bg-zinc-900 hover:bg-sky-500 hover:text-black text-sky-300 font-black cursor-pointer transition-all flex items-center justify-center gap-0.5"
                title="Honk Car Horn [H]"
              >
                <span>📯</span>
                <span>[H]</span>
              </button>
            </div>

            {/* Bottom Row: Police Duty Actions or Quick Tablet Launcher */}
            <div className="flex items-center gap-1.5 pt-1 border-t border-white/10">
              {cityPursuitStats.isPoliceOnDuty ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      physicsRef.current?.togglePlayerSiren();
                      if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-xl font-black text-[9px] uppercase cursor-pointer transition-all ${
                      cityPursuitStats.policeSirenActive
                        ? 'bg-rose-500 text-white animate-pulse shadow-[0_0_10px_#ef4444]'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-blue-300 border border-blue-500/30'
                    }`}
                  >
                    🚨 {cityPursuitStats.policeSirenActive ? 'SIREN ON' : 'SIREN [P]'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      physicsRef.current?.clockOutPoliceDuty();
                      if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                    }}
                    className="py-1.5 px-2.5 rounded-xl bg-zinc-900 hover:bg-rose-600 text-zinc-300 hover:text-white font-black text-[9px] uppercase cursor-pointer border border-white/10"
                  >
                    End Shift
                  </button>
                </>
              ) : cityPursuitStats.policePrecinctNear ? (
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.clockInPoliceDuty();
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-[9px] uppercase cursor-pointer shadow-md animate-pulse"
                >
                  🏢 Clock In MCPD [E]
                </button>
              ) : null}

              {/* MAIN CITY TABLET TRIGGER BUTTON */}
              <button
                type="button"
                onClick={() => {
                  setCityTabletTab('police');
                  setShowCityTabletModal(true);
                }}
                className="flex-1 py-1.5 px-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black text-[10px] uppercase shadow-lg shadow-sky-600/30 ring-1 ring-sky-300/40 cursor-pointer flex items-center justify-between transition-all hover:scale-[1.01]"
              >
                <div className="flex items-center gap-1">
                  <span>📱</span>
                  <span>CITY TABLET [TAB]</span>
                </div>
                <span className={`px-1.5 py-0.2 rounded font-black text-[9px] ${
                  cityPursuitStats.inDebt || cityPursuitStats.streetCash < 0
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-emerald-400 text-black'
                }`}>
                  {cityPursuitStats.streetCash < 0
                    ? `-$${Math.abs(cityPursuitStats.streetCash).toLocaleString()}`
                    : `$${cityPursuitStats.streetCash.toLocaleString()}`}
                </span>
              </button>

              {/* GOOGLE MAPS NAVIGATOR BUTTON */}
              <button
                type="button"
                onClick={openGoogleMapsModal}
                className="py-1.5 px-2.5 rounded-xl bg-sky-600/90 hover:bg-sky-500 text-white border border-sky-300/40 font-black text-[9px] uppercase cursor-pointer shadow-md flex items-center gap-1"
                title="Open interactive Google Maps Navigator with live traffic & route search"
              >
                <span>🗺️</span>
                <span>Maps</span>
              </button>

              {/* CONTROLS & KEYBINDS BUTTON */}
              <button
                type="button"
                onClick={() => setShowControlsMappingModal(true)}
                className="py-1.5 px-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-300 hover:text-white border border-amber-400/40 font-black text-[9px] cursor-pointer"
                title="Customize all keys & gamepad buttons"
              >
                🎮 Keys
              </button>
            </div>
            </>
          )}
          </div>

          {/* GOOGLE MAPS NAVIGATION MINIMAP WITH SPOKEN VOICE TURN-BY-TURN GUIDANCE */}
          {cityPursuitStats.minimapData && !isMinimapHidden && (() => {
            const mm = cityPursuitStats.minimapData;
            const vbW = minimapZoom === 'local' ? 760 : minimapZoom === 'metro' ? 1960 : 5350;
            const vbH = minimapZoom === 'local' ? 450 : minimapZoom === 'metro' ? 1150 : 3150;
            const vbX = minimapZoom === 'state' ? -2650 : mm.playerX - vbW * 0.5;
            const vbZ = minimapZoom === 'state' ? -1050 : mm.playerZ - vbH * 0.5;
            const zs = vbW / 5350;
            const labelZoomScale = minimapZoom === 'local' ? 0.22 : minimapZoom === 'metro' ? 0.48 : 1.0;

            const isHeadingUp = isMinimapHeadingUp && minimapZoom !== 'state';
            const mapWorldRotateDeg = isHeadingUp ? (mm.playerHeading * 180) / Math.PI : 0;
            const playerArrowRotateDeg = isHeadingUp ? 0 : (-mm.playerHeading * 180) / Math.PI;

            const isNightMap =
              mapThemeMode === 'dark' ||
              (mapThemeMode === 'auto' &&
                (!currentWeatherState?.isDay || (currentWeatherState?.sunElevationDeg ?? 15) < 5));

            const pal = isNightMap
              ? {
                  land: '#1c2128',
                  westLand: '#1e2923',
                  centralLand: '#21272e',
                  easternLand: '#1d2522',
                  water: '#0f2d4a',
                  bayWater: '#0c243d',
                  localRoad: '#374151',
                  localOutline: '#111827',
                  arterial: '#4b5563',
                  highway: '#d97706',
                  highwayEdge: '#78350f',
                  bridge: '#64748b',
                  label: '#e5e7eb',
                  parkLabel: '#86efac',
                }
              : {
                  land: '#e8eaed',
                  westLand: '#dcead7',
                  centralLand: '#ebedf0',
                  easternLand: '#e2eadc',
                  water: '#aadaff',
                  bayWater: '#9bd2fb',
                  localRoad: '#ffffff',
                  localOutline: '#dadce0',
                  arterial: '#fefefe',
                  highway: '#fbd34d',
                  highwayEdge: '#d97706',
                  bridge: '#cbd5e1',
                  label: '#3c4043',
                  parkLabel: '#1e8e3e',
                };

            const tgt = mm.gpsTarget;
            const turnDistFmt = tgt ? formatGoogleMapsDistance(tgt.distToTurnMeters ?? tgt.distMeters) : null;
            const totalDistFmt = tgt ? formatGoogleMapsDistance(tgt.routeDistMeters ?? tgt.distMeters) : null;
            const etaMins = tgt ? Math.max(1, Math.round((tgt.etaSeconds ?? 60) / 60)) : 0;
            const arrivalClock = tgt
              ? new Date(Date.now() + (tgt.etaSeconds ?? 60) * 1000).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : '';

            return (
            <div
              className={`absolute bottom-3.5 right-3.5 md:right-5 z-30 rounded-2xl p-2 shadow-[0_8px_32px_rgba(0,0,0,0.65)] backdrop-blur-md flex flex-col gap-1.5 pointer-events-auto font-sans transition-all duration-200 border ${
                isNightMap
                  ? 'bg-[#202124]/95 border-white/15 text-white'
                  : 'bg-white/95 border-zinc-300 text-zinc-900'
              } ${
                isTacticalMapExpanded ? 'w-[350px] sm:w-[410px]' : 'w-[258px] sm:w-[292px]'
              }`}
            >
              {/* Google Maps Green Turn-by-Turn Header Banner */}
              {tgt ? (
                <div className="bg-[#0F9D58] text-white rounded-xl overflow-hidden shadow-md">
                  <div className="px-2.5 py-2 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#0B8043] flex items-center justify-center shrink-0">
                      {renderGoogleMapsManeuverIcon(tgt.maneuver)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5 leading-none">
                        <span className="text-sm font-black tracking-tight tabular-nums">
                          {turnDistFmt?.shortText}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-100 truncate">
                          {tgt.maneuver === 'arrive' ? 'Arrive' : tgt.nextRoadName}
                        </span>
                      </div>
                      <div className="text-[10px] font-semibold text-white/95 truncate mt-0.5">
                        {tgt.turnInstruction}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const muted = voiceNavigationService.toggleMuted();
                          setIsVoiceNavMuted(muted);
                        }}
                        className="w-6 h-6 rounded-md bg-black/25 hover:bg-black/40 text-white flex items-center justify-center text-[11px] cursor-pointer"
                        title={isVoiceNavMuted ? 'Unmute Voice Guidance' : 'Mute Voice Guidance'}
                      >
                        {isVoiceNavMuted ? '🔇' : '🔊'}
                      </button>
                      <button
                        type="button"
                        onClick={() => voiceNavigationService.repeatLast()}
                        className="w-6 h-6 rounded-md bg-black/25 hover:bg-black/40 text-white flex items-center justify-center text-[10px] cursor-pointer"
                        title="Repeat spoken turn instruction"
                      >
                        🔁
                      </button>
                    </div>
                  </div>
                  {tgt.thenInstruction && (
                    <div className="bg-[#0B8043] px-2.5 py-1 text-[9px] font-semibold text-emerald-50 truncate">
                      {tgt.thenInstruction}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className={`flex items-center justify-between gap-1.5 rounded-xl px-2.5 py-1.5 border ${
                    isNightMap
                      ? 'bg-[#292a2d] border-white/10 text-white'
                      : 'bg-zinc-100 border-zinc-200 text-zinc-900'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#1A73E8] shrink-0" />
                      <span className="text-[10px] font-bold tracking-tight truncate">
                        Google Maps · {cityPursuitStats.nearestStreetName}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const muted = voiceNavigationService.toggleMuted();
                      setIsVoiceNavMuted(muted);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer ${
                      isNightMap ? 'bg-zinc-800 text-zinc-200' : 'bg-white text-zinc-700 border border-zinc-300'
                    }`}
                    title={isVoiceNavMuted ? 'Unmute Voice Navigation' : 'Mute Voice Navigation'}
                  >
                    {isVoiceNavMuted ? '🔇' : '🔊'}
                  </button>
                </div>
              )}

              {/* Map Toolbar (Maps Overlay, Local/Metro/State Zoom, Heading-Up, Day/Night, Expand, Hide) */}
              <div className="flex items-center justify-between gap-1 text-[9px] font-bold">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={openGoogleMapsModal}
                    className="px-1.5 py-1 rounded-lg bg-[#1A73E8] hover:bg-[#1557b0] text-white cursor-pointer transition-colors"
                    title="Open interactive Google Maps overlay"
                  >
                    🗺️ Maps
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setMinimapZoom((prev) =>
                        prev === 'local' ? 'metro' : prev === 'metro' ? 'state' : 'local'
                      )
                    }
                    className={`px-1.5 py-1 rounded-lg border cursor-pointer transition-colors ${
                      isNightMap
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-sky-300 border-white/10'
                        : 'bg-zinc-100 hover:bg-zinc-200 text-[#1A73E8] border-zinc-300'
                    }`}
                    title="Cycle Radar Zoom: Local / Metro / State"
                  >
                    {minimapZoom === 'local' ? 'Local' : minimapZoom === 'metro' ? 'Metro' : 'State'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMinimapHeadingUp((prev) => !prev)}
                    className={`px-1.5 py-1 rounded-lg border cursor-pointer transition-colors ${
                      isMinimapHeadingUp
                        ? 'bg-[#1A73E8]/20 text-[#4285F4] border-[#4285F4]/50'
                        : isNightMap
                        ? 'bg-zinc-800 text-zinc-300 border-white/10'
                        : 'bg-zinc-100 text-zinc-700 border-zinc-300'
                    }`}
                    title="Toggle Heading-Up vs North-Up Orientation"
                  >
                    {isMinimapHeadingUp ? '🧭 Car↑' : '🧭 N↑'}
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setMapThemeMode((prev) =>
                        prev === 'auto' ? 'light' : prev === 'light' ? 'dark' : 'auto'
                      )
                    }
                    className={`px-1.5 py-1 rounded-lg border cursor-pointer transition-colors ${
                      isNightMap
                        ? 'bg-zinc-800 text-amber-300 border-white/10'
                        : 'bg-zinc-100 text-zinc-800 border-zinc-300'
                    }`}
                    title={`Map Theme (${mapThemeMode.toUpperCase()})`}
                  >
                    {isNightMap ? '🌙' : '☀️'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTacticalMapExpanded((prev) => !prev)}
                    className={`px-1.5 py-1 rounded-lg border cursor-pointer transition-colors ${
                      isNightMap
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-white/10'
                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300'
                    }`}
                    title="Expand / Shrink Map"
                  >
                    {isTacticalMapExpanded ? '⤡' : '⤢'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMinimapHidden(true)}
                    className={`px-1.5 py-1 rounded-lg border cursor-pointer transition-colors ${
                      isNightMap
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border-white/10'
                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 border-zinc-300'
                    }`}
                    title="Hide Minimap ([N] to toggle)"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Typeable Maryland Address / Street / Landmark GPS Search Bar */}
              <div className="relative">
                <div
                  className={`flex items-center gap-1 rounded-xl px-2 py-1 border focus-within:border-[#1A73E8] ${
                    isNightMap
                      ? 'bg-[#303134] border-white/15'
                      : 'bg-white border-zinc-300 shadow-inner'
                  }`}
                >
                  <span className="text-[10px] shrink-0">🔎</span>
                  <input
                    ref={gpsInputRef}
                    type="text"
                    value={gpsAddressQuery}
                    onFocus={() => setGpsDropdownOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => setGpsDropdownOpen(false), 160);
                    }}
                    onChange={(e) => {
                      setGpsAddressQuery(e.target.value);
                      setGpsDropdownOpen(true);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (gpsSuggestions.length > 0) {
                          handleSelectGpsEntry(gpsSuggestions[0]);
                        } else {
                          setGpsDropdownOpen(false);
                          e.currentTarget.blur();
                        }
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setGpsDropdownOpen(false);
                        e.currentTarget.blur();
                      }
                    }}
                    placeholder="Search MD address or place..."
                    className={`w-full min-w-0 bg-transparent text-[10px] focus:outline-none ${
                      isNightMap
                        ? 'text-white placeholder:text-zinc-400'
                        : 'text-zinc-900 placeholder:text-zinc-500'
                    }`}
                  />
                  {gpsAddressQuery && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setGpsAddressQuery('');
                        setGpsDropdownOpen(true);
                        gpsInputRef.current?.focus();
                      }}
                      className="text-[9px] text-zinc-400 hover:text-white px-1 cursor-pointer shrink-0"
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (gpsSuggestions.length > 0) {
                        handleSelectGpsEntry(gpsSuggestions[0]);
                      }
                    }}
                    disabled={gpsSuggestions.length === 0}
                    className="px-1.5 py-0.5 rounded-md bg-[#1A73E8] hover:bg-[#1557b0] disabled:bg-zinc-700 disabled:text-zinc-400 text-white text-[9px] font-black uppercase cursor-pointer shrink-0"
                  >
                    GO
                  </button>
                </div>

                {gpsDropdownOpen && (
                  <div className="absolute left-0 right-0 bottom-full mb-1.5 max-h-48 overflow-y-auto bg-[#202124]/98 border border-[#4285F4]/60 rounded-xl shadow-[0_0_24px_rgba(0,0,0,0.9)] z-50 divide-y divide-white/10 text-white">
                    {gpsSuggestions.length === 0 ? (
                      <div className="px-2.5 py-2 text-[10px] text-zinc-400">
                        No Maryland street or place matched "{gpsAddressQuery}". Try e.g. "Woodfield Rd", "Potomac", "Baltimore", or "19411".
                      </div>
                    ) : (
                      gpsSuggestions.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectGpsEntry(entry);
                          }}
                          className="w-full text-left px-2.5 py-1.5 hover:bg-[#1A73E8]/25 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-bold text-white truncate">
                              {entry.icon} {entry.label}
                            </div>
                            <div className="text-[9px] text-zinc-400 truncate">
                              {entry.address}
                            </div>
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[8px] font-black text-sky-300 uppercase shrink-0">
                            {entry.category}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Interactive Heading-Up / North-Up Google Maps Canvas */}
              <div
                className="relative w-full aspect-[17/10] rounded-xl overflow-hidden border border-black/20"
                style={{ backgroundColor: pal.land }}
              >
                <svg
                  viewBox={`${vbX} ${vbZ} ${vbW} ${vbH}`}
                  className="w-full h-full cursor-crosshair select-none"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const normX = (e.clientX - rect.left) / rect.width;
                    const normZ = (e.clientY - rect.top) / rect.height;
                    let worldX = vbX + normX * vbW;
                    let worldZ = vbZ + normZ * vbH;
                    if (isHeadingUp) {
                      const rad = (-mapWorldRotateDeg * Math.PI) / 180;
                      const dx = worldX - mm.playerX;
                      const dz = worldZ - mm.playerZ;
                      worldX = mm.playerX + dx * Math.cos(rad) - dz * Math.sin(rad);
                      worldZ = mm.playerZ + dx * Math.sin(rad) + dz * Math.cos(rad);
                    }
                    const snapped = snapWorldPointToNearestRoad(worldX, worldZ, 42);
                    const pinLabel = snapped.snapped
                      ? `Pin · ${snapped.roadName.split('(')[0].trim()}`
                      : 'Dropped Pin';
                    physicsRef.current?.setCityGpsTarget(snapped.x, snapped.z, pinLabel, '#EA4335');
                    if (physicsRef.current) {
                      setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                    }
                  }}
                >
                  <g transform={isHeadingUp ? `rotate(${mapWorldRotateDeg} ${mm.playerX} ${mm.playerZ})` : undefined}>
                    {/* Land & Water Backdrop */}
                    <rect x="-4500" y="-3000" width="9500" height="7500" fill={pal.land} />
                    <rect x="-2650" y="-1050" width="1200" height="1250" fill={pal.westLand} />
                    <rect x="-1450" y="-1050" width="3050" height="3150" fill={pal.centralLand} />

                    {/* Chesapeake Bay & Eastern Shore */}
                    <polygon
                      points="1520,-1050 2700,-1050 2700,2100 1320,2100 1420,1150 1560,650 1520,120 1400,-160 1580,-420"
                      fill={pal.bayWater}
                    />
                    <polygon
                      points="1960,-1050 2450,-1050 2450,2100 1980,2100 2020,1100 1960,550"
                      fill={pal.easternLand}
                    />
                    <rect x="1915" y="610" width="150" height="220" rx="22" fill={pal.easternLand} />
                    <rect x="2420" y="-1050" width="52" height="3150" fill={pal.water} />
                    <rect x="2470" y="700" width="54" height="1050" rx="8" fill={isNightMap ? '#4a4332' : '#f3e5ab'} />
                    <rect x="2524" y="-1050" width="220" height="3150" fill={pal.water} />

                    {/* Deep Creek Lake, Potomac & Patapsco Rivers */}
                    <ellipse cx="-2410" cy="-450" rx="95" ry="70" fill={pal.water} />
                    <polyline
                      fill="none"
                      stroke={pal.water}
                      strokeWidth="44"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points="-2300,-340 -1750,-140 -1220,210 -860,1240 -620,1780 -210,1960 -150,2100"
                    />
                    <polyline
                      fill="none"
                      stroke={pal.water}
                      strokeWidth="36"
                      strokeLinecap="round"
                      points="180,-290 620,-180 1120,-130 1380,-110 1560,-20"
                    />

                    {/* Gaithersburg Lakes, Fairgrounds & Airpark */}
                    <rect x={gx(-354)} y={gz(1667)} width="78" height="56" rx="8" fill={pal.water} />
                    <rect x={gx(-651)} y={gz(2262)} width="82" height="56" rx="8" fill={pal.water} />
                    <rect x={gx(-494)} y={gz(2259)} width="118" height="72" rx="10" fill={pal.water} />
                    <ellipse cx={gx(-148)} cy={gz(1875)} rx="42" ry="29" fill={isNightMap ? '#3b2d1f' : '#e6d7b9'} />
                    <g transform={`translate(${gx(175)}, ${gz(2025)}) rotate(-33.2)`}>
                      <rect x="-11" y="-70" width="22" height="140" fill={pal.arterial} stroke={pal.localOutline} strokeWidth="3" />
                    </g>

                    {/* Google Maps Styled Maryland Road Network (Casing + Fill) */}
                    {ALL_MARYLAND_ROADS.map((road) => {
                      const pts = road.points.map((p) => `${p.x},${p.z}`).join(' ');
                      const baseW = road.isHighway
                        ? 30
                        : road.isResidential
                        ? 12
                        : road.width > 26
                        ? 23
                        : 16;
                      const strokeW = Math.max(road.width * 0.85, baseW * (0.45 + 0.55 * zs));
                      return (
                        <React.Fragment key={`md_rd_${road.id}`}>
                          <polyline
                            fill="none"
                            stroke={road.isHighway ? pal.highwayEdge : pal.localOutline}
                            strokeWidth={strokeW + Math.max(2, 6 * zs)}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={pts}
                          />
                          <polyline
                            fill="none"
                            stroke={road.isBridge ? pal.bridge : road.isHighway ? pal.highway : road.isResidential ? pal.localRoad : pal.arterial}
                            strokeWidth={strokeW}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={pts}
                          />
                        </React.Fragment>
                      );
                    })}

                    {/* ICM & Church of the Redeemer Footprints */}
                    <g transform={`translate(${REDEEMER_CAMPUS_ORIGIN.x}, ${REDEEMER_CAMPUS_ORIGIN.z}) rotate(${(-REDEEMER_CAMPUS_ORIGIN.rotY * 180) / Math.PI})`}>
                      <rect x={97} y={-22} width={58} height={48} rx={4} fill={isNightMap ? '#334155' : '#d2d6dc'} stroke={pal.localOutline} strokeWidth={Math.max(1.5, 4 * zs)} />
                    </g>
                    <g transform={`translate(${ICM_CAMPUS_ORIGIN.x}, ${ICM_CAMPUS_ORIGIN.z}) rotate(${(-ICM_CAMPUS_ORIGIN.rotY * 180) / Math.PI})`}>
                      <rect x={36} y={-3} width={20} height={18} rx={3} fill={isNightMap ? '#334155' : '#d2d6dc'} />
                      <rect x={109} y={-21} width={58} height={54} rx={5} fill="#0F9D58" stroke="#ffffff" strokeWidth={Math.max(1.5, 4 * zs)} />
                    </g>

                    {/* City & Neighborhood Labels (upright counter-rotated in Heading-Up mode!) */}
                    {[
                      { x: -2400, y: -560, txt: 'Deep Creek', col: pal.label, sz: 58 },
                      { x: -1100, y: -335, txt: 'Frederick', col: pal.label, sz: 58 },
                      { x: MD_LANDMARKS.isbCampus.x, y: MD_LANDMARKS.isbCampus.z - 55 * labelZoomScale, txt: 'ISB', col: pal.parkLabel, sz: 48 },
                      { x: MD_LANDMARKS.baltimoreInnerHarbor.x, y: MD_LANDMARKS.baltimoreInnerHarbor.z - 80 * labelZoomScale, txt: 'Baltimore', col: pal.label, sz: 62 },
                      { x: MD_LANDMARKS.bwiAirport.x, y: MD_LANDMARKS.bwiAirport.z + 75 * labelZoomScale, txt: 'BWI', col: pal.label, sz: 46 },
                      { x: MD_LANDMARKS.annapolisStateHouse.x, y: MD_LANDMARKS.annapolisStateHouse.z - 55 * labelZoomScale, txt: 'Annapolis', col: pal.label, sz: 54 },
                      { x: MD_LANDMARKS.oceanCityBoardwalk.x - 160, y: MD_LANDMARKS.oceanCityBoardwalk.z - 55 * labelZoomScale, txt: 'Ocean City', col: pal.label, sz: 52 },
                      { x: gx(356), y: gz(1845) + 55 * labelZoomScale, txt: 'ICM', col: pal.parkLabel, sz: 48 },
                      { x: gx(480), y: gz(1300), txt: 'Hadley Farms', col: pal.parkLabel, sz: 44 },
                      { x: gx(620), y: gz(1692), txt: 'Edinburgh', col: pal.parkLabel, sz: 34 },
                      { x: MD_LANDMARKS.collegeParkUMD.x, y: MD_LANDMARKS.collegeParkUMD.z - 55 * labelZoomScale, txt: 'UMD', col: pal.label, sz: 46 },
                    ].map((lbl) => (
                      <text
                        key={lbl.txt}
                        x={lbl.x}
                        y={lbl.y}
                        fill={lbl.col}
                        fontSize={lbl.sz * labelZoomScale}
                        fontWeight="bold"
                        textAnchor="middle"
                        transform={isHeadingUp ? `rotate(${-mapWorldRotateDeg} ${lbl.x} ${lbl.y})` : undefined}
                      >
                        {lbl.txt}
                      </text>
                    ))}

                    {/* Google Maps Signature Blue Navigation Polyline */}
                    {mm.gpsRoute.length >= 2 && (
                      <>
                        <polyline
                          fill="none"
                          stroke="#185ABC"
                          strokeWidth={Math.max(10, 48 * zs)}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={mm.gpsRoute.map((pt) => `${pt.x},${pt.z}`).join(' ')}
                        />
                        <polyline
                          fill="none"
                          stroke="#4285F4"
                          strokeWidth={Math.max(6, 32 * zs)}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={mm.gpsRoute.map((pt) => `${pt.x},${pt.z}`).join(' ')}
                        />
                      </>
                    )}

                    {/* PD, Bank, Dealership & Houses Pins */}
                    <g transform={`translate(${MD_LANDMARKS.baltimorePoliceHQ.x}, ${MD_LANDMARKS.baltimorePoliceHQ.z}) scale(${Math.max(0.26, zs)})`}>
                      <circle cx={0} cy={0} r={38} fill="#1A73E8" stroke="#ffffff" strokeWidth="8" />
                      <text x={0} y={11} fill="#ffffff" fontSize="30" fontWeight="bold" textAnchor="middle">PD</text>
                    </g>
                    <g transform={`translate(${MD_LANDMARKS.baltimoreBank.x}, ${MD_LANDMARKS.baltimoreBank.z}) scale(${Math.max(0.26, zs)})`}>
                      <circle cx={0} cy={0} r={38} fill="#F9AB00" stroke="#ffffff" strokeWidth="8" />
                      <text x={0} y={12} fill="#000000" fontSize="32" fontWeight="bold" textAnchor="middle">$</text>
                    </g>

                    {CITY_HEIST_TARGETS_CATALOG.map((h) => (
                      <circle
                        key={`mm_heist_${h.id}`}
                        cx={h.x}
                        cy={h.z}
                        r={Math.max(6, 26 * zs)}
                        fill={h.badgeColor}
                        stroke="#ffffff"
                        strokeWidth={Math.max(2, 7 * zs)}
                      />
                    ))}

                    {CITY_SPORTS_CATALOG.map((sp) => (
                      <circle
                        key={`mm_sport_${sp.id}`}
                        cx={sp.x}
                        cy={sp.z}
                        r={Math.max(6.5, 28 * zs)}
                        fill={sp.badgeColor}
                        stroke="#fef08a"
                        strokeWidth={Math.max(2, 7 * zs)}
                      />
                    ))}

                    {CITY_SERVICE_STATIONS.map((svc) => (
                      <rect
                        key={`mm_svc_${svc.id}`}
                        x={svc.x - Math.max(5.5, 20 * zs)}
                        y={svc.z - Math.max(5.5, 20 * zs)}
                        width={Math.max(11, 40 * zs)}
                        height={Math.max(11, 40 * zs)}
                        rx={Math.max(3, 10 * zs)}
                        fill="#0284c7"
                        stroke="#bae6fd"
                        strokeWidth={Math.max(1.5, 6 * zs)}
                      />
                    ))}

                    {CITY_CAR_MEET_ZONES.map((mz) => (
                      <circle
                        key={`mm_meet_${mz.id}`}
                        cx={mz.x}
                        cy={mz.z}
                        r={Math.max(6, 24 * zs)}
                        fill="#9333ea"
                        stroke="#f3e8ff"
                        strokeWidth={Math.max(1.8, 6 * zs)}
                      />
                    ))}

                    {CITY_HOUSES_CATALOG.map((house) => {
                      const isOwned = cityPursuitStats.ownedHouseIds.includes(house.id);
                      const sz = Math.max(9, 44 * zs);
                      return (
                        <rect
                          key={`mm_house_${house.id}`}
                          x={house.x - sz * 0.5}
                          y={house.z - sz * 0.5}
                          width={sz}
                          height={sz}
                          rx={Math.max(2, 9 * zs)}
                          fill={isOwned ? '#0F9D58' : '#64748b'}
                          stroke="#ffffff"
                          strokeWidth={Math.max(1.5, 6 * zs)}
                        />
                      );
                    })}

                    {/* Active Safehouse Highlight */}
                    <circle
                      cx={mm.activeHome.x}
                      cy={mm.activeHome.z}
                      r={Math.max(11, 48 * zs)}
                      fill="none"
                      stroke="#0F9D58"
                      strokeWidth={Math.max(2.5, 11 * zs)}
                      strokeDasharray={`${Math.max(4, 18 * zs)} ${Math.max(3, 12 * zs)}`}
                    />

                    {/* Civilian Traffic Dots */}
                    {mm.civs.map((c, idx) => (
                      <circle
                        key={`mm_civ_${idx}`}
                        cx={c.x}
                        cy={c.z}
                        r={Math.max(3.5, 14 * zs)}
                        fill={isNightMap ? '#9ca3af' : '#5f6368'}
                        opacity="0.78"
                      />
                    ))}

                    {/* Police Units */}
                    {mm.cops.map((cop, idx) => {
                      const deg = (-cop.heading * 180) / Math.PI;
                      const copScale = Math.max(0.26, zs);
                      return (
                        <g key={`mm_cop_${idx}`} transform={`translate(${cop.x}, ${cop.z}) rotate(${deg})`}>
                          {cop.isChasing && (
                            <polygon
                              points="0,0 -90,-220 90,-220"
                              fill={cop.canSeePlayer ? 'rgba(234,67,53,0.38)' : 'rgba(66,133,244,0.25)'}
                            />
                          )}
                          <circle
                            cx={0}
                            cy={0}
                            r={28 * copScale}
                            fill={cop.canSeePlayer ? '#EA4335' : '#1A73E8'}
                            stroke="#ffffff"
                            strokeWidth={8 * copScale}
                          />
                        </g>
                      );
                    })}

                    {/* Google Maps Red Destination Pin */}
                    {mm.gpsTarget && (
                      <g
                        transform={`translate(${mm.gpsTarget.x}, ${mm.gpsTarget.z}) rotate(${isHeadingUp ? -mapWorldRotateDeg : 0}) scale(${Math.max(0.26, zs)})`}
                      >
                        <circle cx={0} cy={0} r={42} fill="#EA4335" stroke="#ffffff" strokeWidth="10" />
                        <circle cx={0} cy={0} r={15} fill="#ffffff" />
                      </g>
                    )}
                  </g>

                  {/* Google Maps Blue Navigation Puck Chevron + Heading Halo (Always Centered Ahead in Heading-Up) */}
                  <g
                    transform={`translate(${mm.playerX}, ${mm.playerZ}) rotate(${playerArrowRotateDeg}) scale(${Math.max(0.26, zs)})`}
                  >
                    <polygon points="0,0 -85,-190 85,-190" fill="rgba(66,133,244,0.28)" />
                    <circle cx={0} cy={0} r={52} fill="#ffffff" stroke="rgba(0,0,0,0.25)" strokeWidth="8" />
                    <polygon points="0,-38 -28,28 0,14 28,28" fill="#1A73E8" />
                  </g>
                </svg>

                {/* Dynamic Rotating Compass Pill */}
                <button
                  type="button"
                  onClick={() => setIsMinimapHeadingUp((prev) => !prev)}
                  className={`absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black shadow border cursor-pointer ${
                    isNightMap
                      ? 'bg-[#202124]/90 text-white border-white/20'
                      : 'bg-white/95 text-zinc-800 border-zinc-300'
                  }`}
                  style={{ transform: `rotate(${Math.round(mapWorldRotateDeg)}deg)` }}
                  title="North Indicator (click to toggle Heading-Up)"
                >
                  <span className="text-[#EA4335]">▲</span>
                </button>
              </div>

              {/* Google Maps Bottom Navigation ETA & Speed Bar */}
              {tgt && (
                <div
                  className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border ${
                    isNightMap
                      ? 'bg-[#292a2d] border-white/10 text-white'
                      : 'bg-zinc-100 border-zinc-200 text-zinc-900'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1.5 leading-none">
                      <span className="text-xs font-black text-[#0F9D58] tabular-nums">
                        {etaMins} min
                      </span>
                      <span className="text-[10px] font-bold opacity-80 tabular-nums">
                        ({totalDistFmt?.shortText})
                      </span>
                      <span className="text-[9px] opacity-65">· {arrivalClock} ETA</span>
                    </div>
                    <div className="text-[9px] opacity-75 truncate mt-0.5">
                      {tgt.label}
                    </div>
                  </div>
                  <div className="bg-white border-2 border-black rounded px-1.5 py-0.5 text-center leading-none shrink-0">
                    <span className="text-[11px] font-black text-black">
                      {cityPursuitStats.currentSpeedLimitMph || 45}
                    </span>
                  </div>
                </div>
              )}

              {/* Quick GPS Shortcut Buttons: Safehouse | Bank | Precinct | Clear */}
              <div className="grid grid-cols-4 gap-1 text-[8px] font-black">
                <button
                  type="button"
                  onClick={() => {
                    const home = cityPursuitStats.minimapData.activeHome;
                    physicsRef.current?.setCityGpsTarget(
                      home.x,
                      home.z,
                      `🏡 ${home.name}`,
                      '#10b981'
                    );
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-1 rounded bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/40 text-emerald-300 cursor-pointer truncate"
                >
                  🏡 Home
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const bank = CITY_HEIST_TARGETS_CATALOG[0];
                    physicsRef.current?.setCityGpsTarget(
                      bank.x,
                      bank.z,
                      `${bank.icon} ${bank.name}`,
                      bank.badgeColor
                    );
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-1 rounded bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-amber-300 cursor-pointer truncate"
                >
                  🏦 Bank
                </button>
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.setCityGpsTarget(
                      MD_LANDMARKS.baltimorePoliceHQ.x,
                      MD_LANDMARKS.baltimorePoliceHQ.z,
                      '🏢 Baltimore Police HQ (601 E Fayette)',
                      '#38bdf8'
                    );
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-1 rounded bg-blue-500/20 hover:bg-blue-500/35 border border-blue-400/40 text-blue-300 cursor-pointer truncate"
                >
                  🏢 Police
                </button>
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.clearCityGpsTarget();
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white cursor-pointer truncate"
                >
                  ✖ Clear
                </button>
              </div>

              {/* Statewide Maryland Landmarks GPS Shortcuts */}
              <div className="grid grid-cols-6 gap-1 text-[8px] font-black">
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.setCityGpsTarget(MD_LANDMARKS.icmCampus.x, MD_LANDMARKS.icmCampus.z, '🕌 ICM · 19411 Woodfield Rd', '#10b981');
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-0.5 rounded bg-emerald-900/50 hover:bg-emerald-500 hover:text-black border border-emerald-400/40 text-emerald-300 cursor-pointer truncate"
                  title="Navigate to Islamic Center of Maryland (19411 Woodfield Rd)"
                >
                  🕌 ICM
                </button>
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.setCityGpsTarget(MD_LANDMARKS.hadleyFarms.x, MD_LANDMARKS.hadleyFarms.z, '🏘️ Hadley Farms · Resnik ES', '#22c55e');
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-0.5 rounded bg-green-900/50 hover:bg-green-400 hover:text-black border border-green-400/40 text-green-300 cursor-pointer truncate"
                  title="Navigate to Hadley Farms & Judith A. Resnik Elementary School"
                >
                  🏘️ Hadley
                </button>
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.setCityGpsTarget(MD_LANDMARKS.isbCampus.x, MD_LANDMARKS.isbCampus.z, '🕌 ISB · 6631 Johnnycake Rd', '#eab308');
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-0.5 rounded bg-amber-900/50 hover:bg-amber-400 hover:text-black border border-amber-400/40 text-amber-300 cursor-pointer truncate"
                  title="Navigate to Islamic Society of Baltimore (6631 Johnnycake Rd)"
                >
                  🕌 ISB
                </button>
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.setCityGpsTarget(MD_LANDMARKS.baltimoreInnerHarbor.x, MD_LANDMARKS.baltimoreInnerHarbor.z, '⚓ Inner Harbor · WTC', '#38bdf8');
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-0.5 rounded bg-sky-900/50 hover:bg-sky-400 hover:text-black border border-sky-400/40 text-sky-300 cursor-pointer truncate"
                  title="Navigate to Baltimore Inner Harbor, WTC & National Aquarium"
                >
                  ⚓ Harbor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.setCityGpsTarget(MD_LANDMARKS.annapolisStateHouse.x, MD_LANDMARKS.annapolisStateHouse.z, '⛵ Annapolis · Naval Academy', '#f59e0b');
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-0.5 rounded bg-amber-950/60 hover:bg-amber-400 hover:text-black border border-amber-400/40 text-amber-200 cursor-pointer truncate"
                  title="Navigate to Annapolis State House & US Naval Academy"
                >
                  ⛵ Annap
                </button>
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.setCityGpsTarget(MD_LANDMARKS.oceanCityBoardwalk.x, MD_LANDMARKS.oceanCityBoardwalk.z, '🏖️ Ocean City Boardwalk', '#06b6d4');
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-0.5 rounded bg-cyan-900/50 hover:bg-cyan-400 hover:text-black border border-cyan-400/40 text-cyan-300 cursor-pointer truncate"
                  title="Navigate across Chesapeake Bay Bridge to Ocean City Boardwalk"
                >
                  🏖️ OC
                </button>
              </div>
              <div className="grid grid-cols-6 gap-1 text-[8px] font-black">
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.setCityGpsTarget(MD_LANDMARKS.frederick.x, MD_LANDMARKS.frederick.z, '⛪ Frederick Clustered Spires', '#fbbf24');
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-0.5 rounded bg-yellow-900/40 hover:bg-yellow-400 hover:text-black border border-yellow-400/40 text-yellow-300 cursor-pointer truncate"
                  title="Navigate to Downtown Frederick"
                >
                  ⛪ Fred
                </button>
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.setCityGpsTarget(MD_LANDMARKS.deepCreekLake.x, MD_LANDMARKS.deepCreekLake.z, '🏔️ Deep Creek & Wisp Resort', '#38bdf8');
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-0.5 rounded bg-indigo-900/50 hover:bg-indigo-400 hover:text-black border border-indigo-400/40 text-indigo-300 cursor-pointer truncate"
                  title="Navigate to Deep Creek Lake & Wisp Resort (Western MD)"
                >
                  🏔️ Wisp
                </button>
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.setCityGpsTarget(MD_LANDMARKS.bwiAirport.x, MD_LANDMARKS.bwiAirport.z, '✈️ BWI Marshall Airport', '#60a5fa');
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-0.5 rounded bg-blue-900/50 hover:bg-blue-400 hover:text-black border border-blue-400/40 text-blue-300 cursor-pointer truncate"
                  title="Navigate to BWI Marshall International Airport"
                >
                  ✈️ BWI
                </button>
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.setCityGpsTarget(MD_LANDMARKS.collegeParkUMD.x, MD_LANDMARKS.collegeParkUMD.z, '🐢 UMD College Park', '#ef4444');
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-0.5 rounded bg-red-900/50 hover:bg-red-400 hover:text-black border border-red-400/40 text-red-300 cursor-pointer truncate"
                  title="Navigate to University of Maryland College Park"
                >
                  🐢 UMD
                </button>
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.setCityGpsTarget(MD_LANDMARKS.shadyGroveMetro.x, MD_LANDMARKS.shadyGroveMetro.z, '🚇 Shady Grove Metro', '#ef4444');
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-0.5 rounded bg-rose-900/50 hover:bg-rose-400 hover:text-black border border-rose-400/40 text-rose-300 cursor-pointer truncate"
                  title="Navigate to Shady Grove Metro & Rockville"
                >
                  🚇 Metro
                </button>
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.setCityGpsTarget(MD_LANDMARKS.rioLakefront.x, MD_LANDMARKS.rioLakefront.z, '🌊 RIO Lakefront (MD)', '#38bdf8');
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-0.5 rounded bg-orange-900/50 hover:bg-orange-400 hover:text-black border border-orange-400/40 text-orange-300 cursor-pointer truncate"
                  title="Navigate to RIO Washingtonian Lakefront"
                >
                  🌊 RIO
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1 text-[8px] font-black">
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.setCityGpsTarget(MD_LANDMARKS.icmBasketballCourt.x, MD_LANDMARKS.icmBasketballCourt.z, '🏀 ICM Basketball Gym', '#f97316');
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-0.5 rounded bg-orange-900/50 hover:bg-orange-400 hover:text-black border border-orange-400/40 text-orange-300 cursor-pointer truncate"
                  title="Navigate to ICM Indoor Gym Basketball Court (Press [B] on court)"
                >
                  🏀 Hoops
                </button>
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.setCityGpsTarget(MD_LANDMARKS.gaithersburgGolfField.x, MD_LANDMARKS.gaithersburgGolfField.z, '⛳ Gaithersburg Golf Field', '#22c55e');
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-0.5 rounded bg-emerald-900/50 hover:bg-emerald-400 hover:text-black border border-emerald-400/40 text-emerald-300 cursor-pointer truncate"
                  title="Navigate to Gaithersburg Country Club Golf Field (Press [B] at tee)"
                >
                  ⛳ Golf
                </button>
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.setCityGpsTarget(MD_LANDMARKS.bohrerBaseballField.x, MD_LANDMARKS.bohrerBaseballField.z, '⚾ Bohrer Park Baseball', '#eab308');
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-0.5 rounded bg-yellow-900/50 hover:bg-yellow-400 hover:text-black border border-yellow-400/40 text-yellow-300 cursor-pointer truncate"
                  title="Navigate to Bohrer Park Baseball Diamond (Press [B])"
                >
                  ⚾ Baseb
                </button>
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.setCityGpsTarget(MD_LANDMARKS.bohrerFootballField.x, MD_LANDMARKS.bohrerFootballField.z, '🏈 Bohrer Football Stadium', '#dc2626');
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-0.5 rounded bg-red-900/50 hover:bg-red-400 hover:text-black border border-red-400/40 text-red-300 cursor-pointer truncate"
                  title="Navigate to Bohrer Park Gridiron Football Stadium (Press [B])"
                >
                  🏈 Footb
                </button>
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.setCityGpsTarget(MD_LANDMARKS.bohrerSoccerField.x, MD_LANDMARKS.bohrerSoccerField.z, '⚽ Bohrer Soccer Pitch', '#10b981');
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-0.5 rounded bg-teal-900/50 hover:bg-teal-400 hover:text-black border border-teal-400/40 text-teal-300 cursor-pointer truncate"
                  title="Navigate to Bohrer Park Turf Soccer Pitch (Press [B])"
                >
                  ⚽ Socc
                </button>
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.setCityGpsTarget(MD_LANDMARKS.rioBowlingArcade.x, MD_LANDMARKS.rioBowlingArcade.z, '🎳 Crown Neon Bowling', '#a855f7');
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-0.5 rounded bg-purple-900/50 hover:bg-purple-400 hover:text-black border border-purple-400/40 text-purple-300 cursor-pointer truncate"
                  title="Navigate to Downtown Crown Neon Bowling Lanes (Press [B])"
                >
                  🎳 Bowl
                </button>
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.setCityGpsTarget(MD_LANDMARKS.rioFishingPier.x, MD_LANDMARKS.rioFishingPier.z, '🎣 RIO Fishing Pier', '#06b6d4');
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-0.5 rounded bg-cyan-900/50 hover:bg-cyan-400 hover:text-black border border-cyan-400/40 text-cyan-300 cursor-pointer truncate"
                  title="Navigate to RIO Lakefront Fishing Pier (Press [B])"
                >
                  🎣 Fish
                </button>
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.setCityGpsTarget(MD_LANDMARKS.baltimoreCamdenYards.x, MD_LANDMARKS.baltimoreCamdenYards.z, '🏟️ Camden Yards / Ravens', '#f59e0b');
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="py-1 px-0.5 rounded bg-amber-900/50 hover:bg-amber-400 hover:text-black border border-amber-400/40 text-amber-300 cursor-pointer truncate"
                  title="Navigate to Baltimore Camden Yards & M&T Bank Stadium"
                >
                  🏟️ Balt
                </button>
              </div>
            </div>
            );
          })()}

          {/* RESTORE MINIMAP BUTTON WHEN HIDDEN */}
          {cityPursuitStats.minimapData && isMinimapHidden && (
            <button
              type="button"
              onClick={() => setIsMinimapHidden(false)}
              className="absolute bottom-3.5 right-3.5 md:right-5 z-30 px-3 py-2 rounded-2xl bg-zinc-950/90 border border-white/20 text-sky-300 hover:text-white font-mono text-xs font-black shadow-xl backdrop-blur-md cursor-pointer flex items-center gap-1.5"
              title="Show Minimap ([N])"
            >
              <span>🗺️ Show Map [N]</span>
            </button>
          )}

          {/* CUSTOM CONTROLS & KEY MAPPING MODAL */}
          <ControlsSettingsModal
            isOpen={showControlsMappingModal}
            onClose={() => setShowControlsMappingModal(false)}
          />

          {/* DEDICATED METRO CITY TABLET / OS MODAL ([TAB / M / G]) — CLEAN, ORGANIZED CAREERS & SHOWROOM GARAGE */}
          {(showCityTabletModal || showCityGarageModal) && (() => {
            const isShowroomDock = cityTabletTab === 'garage' || cityTabletTab === 'dealership';
            return (
            <div
              className={`fixed inset-0 z-50 flex justify-center p-2 sm:p-4 pointer-events-auto ${
                isShowroomDock
                  ? 'items-end bg-gradient-to-t from-black/80 via-black/15 to-transparent'
                  : 'items-center bg-black/85 backdrop-blur-md'
              }`}
            >
              {/* Floating Showroom Angle Controls cleanly in top-center when viewing Garage or Dealership */}
              {isShowroomDock && (
                <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[52] flex flex-wrap items-center gap-1.5 bg-zinc-950/85 border border-sky-400/40 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-2xl">
                  <span className="text-[10px] font-mono font-black text-sky-300 uppercase tracking-wider mr-1">
                    📷 Showroom View:
                  </span>
                  {(
                    [
                      ['front34', 'Front 3/4'],
                      ['front', 'Front Grille'],
                      ['side', 'Side Profile'],
                      ['rear', 'Rear 3/4'],
                      ['orbit', '360° Spin'],
                    ] as const
                  ).map(([angleKey, label]) => (
                    <button
                      key={angleKey}
                      type="button"
                      onClick={() => setGarageCamAngle(angleKey)}
                      className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold cursor-pointer transition-all ${
                        garageCamAngle === angleKey
                          ? 'bg-sky-400 text-black font-black shadow'
                          : 'bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 border border-white/10'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <div
                className={`bg-zinc-950/95 border-2 border-sky-500/50 max-w-5xl w-full rounded-3xl shadow-2xl flex flex-col gap-3 overflow-hidden font-mono transition-all ${
                  isShowroomDock ? 'max-h-[48vh] p-4 sm:p-5 backdrop-blur-md' : 'max-h-[90vh] p-5 sm:p-6'
                }`}
              >
                {/* Header: OS Branding, Cash & Close Button */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/50 text-sky-300 text-[10px] font-black uppercase">
                        📱 METRO CITY OS v2.4
                      </span>
                      {cityPursuitStats.inDebt || cityPursuitStats.streetCash < 0 ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/50 text-rose-300 text-xs font-black animate-pulse">
                          🚨 IN DEBT: -${Math.abs(cityPursuitStats.streetCash).toLocaleString()}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs font-black">
                          STREET CASH: ${cityPursuitStats.streetCash.toLocaleString()}
                        </span>
                      )}
                      {cityPursuitStats.passiveIncomePer30s > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/50 text-teal-300 text-xs font-black">
                          PASSIVE RENT: +${cityPursuitStats.passiveIncomePer30s.toLocaleString()}/30s
                        </span>
                      )}
                      <span className="text-[10px] text-amber-300 font-bold">
                        REP LEVEL {cityPursuitStats.streetRepLevel}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-white mt-1 font-sans">
                      City Careers, Real Estate, Dealership & Garage
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStoredMotionBlur(!motionBlurEnabled)}
                      className={`px-3 py-2 rounded-xl text-xs font-mono font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                        motionBlurEnabled
                          ? 'bg-sky-500/20 text-sky-300 border-sky-400/40 hover:bg-sky-500/30'
                          : 'bg-zinc-800 text-zinc-400 border-white/10 hover:text-white'
                      }`}
                      title={
                        motionBlurEnabled
                          ? 'Motion Blur: ON (Click to disable and optimize FPS)'
                          : 'Motion Blur: OFF (Click to enable cinematic flow)'
                      }
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${motionBlurEnabled ? 'bg-sky-400 animate-pulse' : 'bg-zinc-500'}`} />
                      <span>BLUR: {motionBlurEnabled ? 'ON' : 'OFF'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowCityTabletModal(false);
                        setShowCityGarageModal(false);
                      }}
                      className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-black text-xs uppercase cursor-pointer border border-white/10 transition-colors"
                    >
                      ✕ Close Tablet [ESC]
                    </button>
                  </div>
                </div>

                {/* 8 Category Navigation Tabs */}
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 bg-zinc-900 p-1.5 rounded-2xl border border-white/10 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setCityTabletTab('police')}
                    className={`py-2 px-1 rounded-xl transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 ${
                      cityTabletTab === 'police'
                        ? 'bg-blue-600 text-white shadow-md font-black'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <span>👮</span>
                    <span>Police HQ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCityTabletTab('missions')}
                    className={`py-2 px-1 rounded-xl transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 ${
                      cityTabletTab === 'missions'
                        ? 'bg-indigo-600 text-white shadow-md font-black'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <span>🎯</span>
                    <span>Missions ({cityPursuitStats.completedMissionIds?.length || 0}/20)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCityTabletTab('jobs')}
                    className={`py-2 px-1 rounded-xl transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 ${
                      cityTabletTab === 'jobs'
                        ? 'bg-yellow-400 text-black shadow-md font-black'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <span>🚕</span>
                    <span>City Jobs</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCityTabletTab('heists')}
                    className={`py-2 px-1 rounded-xl transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 ${
                      cityTabletTab === 'heists'
                        ? 'bg-rose-500 text-white shadow-md font-black'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <span>🏦</span>
                    <span>Heists</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCityTabletTab('houses')}
                    className={`py-2 px-1 rounded-xl transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 ${
                      cityTabletTab === 'houses'
                        ? 'bg-teal-400 text-black shadow-md font-black'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <span>🏡</span>
                    <span>Houses ({cityPursuitStats.ownedHouseIds.length}/5)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCityTabletTab('garage')}
                    className={`py-2 px-1 rounded-xl transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 ${
                      cityTabletTab === 'garage'
                        ? 'bg-purple-500 text-white shadow-md font-black'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <span>🏎️</span>
                    <span>Garage ({cityPursuitStats.ownedCarIds.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCityTabletTab('dealership')}
                    className={`py-2 px-1 rounded-xl transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 ${
                      cityTabletTab === 'dealership'
                        ? 'bg-amber-400 text-black shadow-md font-black'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <span>🛒</span>
                    <span>Dealer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCityTabletTab('graphics')}
                    className={`py-2 px-1 rounded-xl transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 ${
                      cityTabletTab === 'graphics'
                        ? 'bg-cyan-500 text-black shadow-md font-black'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <span>⚙️</span>
                    <span>Graphics</span>
                  </button>
                </div>

                {/* TAB 1: POLICE CAREER HQ & DISPATCH */}
                {cityTabletTab === 'police' && (
                  <div className="flex flex-col gap-4 overflow-y-auto pr-1">
                    {/* Shift & Rank Summary Card */}
                    <div className="bg-blue-950/40 border border-blue-400/40 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/50 text-blue-300 text-xs font-black uppercase">
                            🏢 METRO POLICE DEPARTMENT (CENTRAL PRECINCT)
                          </span>
                          <span className="text-zinc-400 text-xs">
                            GPS: [{MD_LANDMARKS.baltimorePoliceHQ.x}, {MD_LANDMARKS.baltimorePoliceHQ.z}]
                          </span>
                        </div>
                        <div className="text-lg font-black text-white mt-1">
                          Officer Rank: <span className="text-blue-300">{cityPursuitStats.policeRank}</span>
                          <span className="text-zinc-400 text-xs font-normal ml-3">
                            ({cityPursuitStats.totalArrestsMade} Arrests · {cityPursuitStats.totalTicketsIssued} Citations)
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 mt-1 max-w-2xl">
                          As an MCPD officer, enforce city traffic laws! Use your radar gun to clock speeders, pull over red-light runners, and apprehend fugitives with active APB warrants.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {cityPursuitStats.isPoliceOnDuty ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                physicsRef.current?.togglePlayerSiren();
                                if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                              }}
                              className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase cursor-pointer transition-all ${
                                cityPursuitStats.policeSirenActive
                                  ? 'bg-rose-500 text-white animate-pulse shadow-[0_0_12px_#ef4444]'
                                  : 'bg-zinc-900 text-blue-300 border border-blue-500/40'
                              }`}
                            >
                              🚨 {cityPursuitStats.policeSirenActive ? 'SIREN ON' : 'SIREN [P]'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                physicsRef.current?.clockOutPoliceDuty();
                                if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                              }}
                              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase cursor-pointer"
                            >
                              End Shift (${cityPursuitStats.policeShiftEarnings.toLocaleString()} Pay)
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              physicsRef.current?.clockInPoliceDuty();
                              if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                            }}
                            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase cursor-pointer shadow-lg animate-pulse"
                          >
                            Clock In On-Duty Cruiser [E] →
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Legal Probable Cause Rules Guide */}
                    <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-4 flex flex-col gap-2">
                      <h4 className="text-sm font-black text-amber-300 flex items-center gap-2">
                        <span>⚖️</span>
                        <span>MCPD LAWFUL PROBABLE CAUSE REQUIREMENTS</span>
                      </h4>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        To maintain public trust and constitutional law, officers can <strong className="text-white">only pull over or cite civilian drivers with legitimate probable cause</strong>:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-1 text-xs">
                        <div className="bg-black/50 p-3 rounded-xl border border-white/5">
                          <span className="text-sky-300 font-bold block">1. Speeding Violation</span>
                          <span className="text-zinc-400 text-[11px] mt-1 block">
                            Target clocked over +5 MPH above the posted zone speed limit (25/35/45/55 MPH).
                          </span>
                        </div>
                        <div className="bg-black/50 p-3 rounded-xl border border-white/5">
                          <span className="text-rose-300 font-bold block">2. Ran Red Traffic Light</span>
                          <span className="text-zinc-400 text-[11px] mt-1 block">
                            Target vehicle blew through an intersection while the signal was solid RED.
                          </span>
                        </div>
                        <div className="bg-black/50 p-3 rounded-xl border border-white/5">
                          <span className="text-amber-300 font-bold block">3. Active APB Warrant</span>
                          <span className="text-zinc-400 text-[11px] mt-1 block">
                            Target fled a hit-and-run, ran multiple red lights, or has a felony bank robbery warrant.
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Fast Route to Precinct */}
                    <div className="flex items-center justify-between bg-zinc-900/60 p-3 rounded-xl border border-white/10">
                      <span className="text-xs text-zinc-300">
                        Need to return to MCPD Central Precinct for cruiser refuel or locker?
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          physicsRef.current?.setCityGpsTarget(
                            MD_LANDMARKS.baltimorePoliceHQ.x,
                            MD_LANDMARKS.baltimorePoliceHQ.z,
                            '🏢 Baltimore Police HQ (601 E Fayette)',
                            '#38bdf8'
                          );
                          if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                          setShowCityTabletModal(false);
                          setShowCityGarageModal(false);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase cursor-pointer"
                      >
                        Set GPS to Precinct →
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB: MISSIONS (LEVEL 1 TO 20 SEQUENTIAL PROGRESSION & REPLAYS) */}
                {cityTabletTab === 'missions' && (
                  <div className="flex flex-col gap-3 overflow-y-auto pr-1">
                    <div className="text-xs text-zinc-300 bg-indigo-950/40 p-3.5 rounded-2xl border border-indigo-500/30 flex flex-wrap items-center justify-between gap-3 font-mono">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/50 text-indigo-300 text-xs font-black uppercase">
                            🏆 SEQUENTIAL CAMPAIGN LEVELS (1–20)
                          </span>
                          <span className="text-zinc-400 text-xs">
                            Progress: {cityPursuitStats.completedMissionIds?.length || 0} / 20 Cleared
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1">
                          Complete each level in order to unlock the next! Once completed, you can replay missions anytime for replay cash (~25% of first-time payout).
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-amber-300">
                          Total Rep: Level {cityPursuitStats.streetRepLevel}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {CITY_MISSIONS_CATALOG.map((mission) => {
                        const completedList = cityPursuitStats.completedMissionIds || [];
                        const isCompleted = completedList.includes(mission.id);
                        const isUnlocked =
                          mission.level === 1 ||
                          CITY_MISSIONS_CATALOG.some((m) => m.level === mission.level - 1 && completedList.includes(m.id));
                        const isCurrentlyActive = cityPursuitStats.activeMission?.id === mission.id;
                        const replayPay = mission.replayCash || Math.round(mission.rewardCash * 0.25);

                        return (
                          <div
                            key={mission.id}
                            className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 ${
                              isCurrentlyActive
                                ? 'bg-indigo-950/60 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                                : isCompleted
                                ? 'bg-zinc-900/90 border-emerald-500/30 hover:border-emerald-500/60'
                                : isUnlocked
                                ? 'bg-zinc-900 border-white/10 hover:border-indigo-400/50'
                                : 'bg-zinc-950/70 border-white/5 opacity-60'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 rounded-md font-mono font-black text-[10px] ${
                                      isCompleted
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                        : isUnlocked
                                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                                        : 'bg-zinc-800 text-zinc-500'
                                    }`}
                                  >
                                    LEVEL {mission.level}
                                  </span>
                                  <span className="text-sm font-black text-white">{mission.title}</span>
                                </div>
                                {isCompleted && (
                                  <span className="text-emerald-400 font-bold text-xs flex items-center gap-1 font-mono">
                                    ✓ Cleared
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                                {mission.description}
                              </p>

                              <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] font-mono">
                                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                                  1st Pay: ${mission.rewardCash.toLocaleString()}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/10">
                                  Replay Pay: ${replayPay.toLocaleString()}
                                </span>
                                <span className="text-zinc-500">
                                  ⏱️ {mission.timeLimitSec}s · {mission.waypoints.length} Checkpoints
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                              {isCurrentlyActive ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    physicsRef.current?.abandonCityMission();
                                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                                  }}
                                  className="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase cursor-pointer"
                                >
                                  🏳️ Abandon Active Mission
                                </button>
                              ) : isUnlocked ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    physicsRef.current?.startCityMission(mission.id);
                                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                                    setShowCityTabletModal(false);
                                    setShowCityGarageModal(false);
                                  }}
                                  className={`w-full py-2 rounded-xl font-black text-xs uppercase cursor-pointer transition-all ${
                                    isCompleted
                                      ? 'bg-zinc-800 hover:bg-zinc-700 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                                  }`}
                                >
                                  {isCompleted
                                    ? `🔄 Replay Level ${mission.level} (+$${replayPay.toLocaleString()})`
                                    : `▶️ Start Level ${mission.level} (+$${mission.rewardCash.toLocaleString()})`}
                                </button>
                              ) : (
                                <div className="w-full py-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-500 text-center font-bold text-xs font-mono">
                                  🔒 Locked — Clear Level {mission.level - 1} First
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 2: CITY JOBS (TAXI, COURIER, PIZZA DELIVERY) */}
                {cityTabletTab === 'jobs' && (
                  <div className="flex flex-col gap-3 overflow-y-auto pr-1">
                    <div className="text-xs text-zinc-300 bg-zinc-900/60 p-3 rounded-xl border border-white/10">
                      Earn honest money across Metro City! Clock into any job, follow the purple 3D sky-beam waypoint from customer pickup to destination, and collect Base Pay plus Clean Driving Tips!
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {CITY_REGULAR_JOBS_CATALOG.map((job) => {
                        const isClockedIn = cityPursuitStats.activeRegularJob?.jobId === job.id;
                        return (
                          <div
                            key={job.id}
                            className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 transition-all ${
                              isClockedIn
                                ? 'bg-yellow-950/50 border-yellow-400 shadow-lg'
                                : 'bg-zinc-900 border-white/10 hover:border-white/20'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-black text-white">
                                  {job.icon} {job.title}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 font-black text-[10px]">
                                  +${job.basePay.toLocaleString()}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{job.description}</p>
                            </div>

                            <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                              <span className="text-[10px] text-zinc-500">
                                ⏱️ {job.timeLimitSec}s · +${job.tipBonusMax} Tip
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isClockedIn) {
                                    physicsRef.current?.stopCityRegularJob();
                                  } else {
                                    physicsRef.current?.startCityRegularJob(job.id);
                                  }
                                  if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                                  setShowCityTabletModal(false);
                                  setShowCityGarageModal(false);
                                }}
                                className={`px-3.5 py-1.5 rounded-xl font-black text-xs uppercase cursor-pointer transition-colors ${
                                  isClockedIn
                                    ? 'bg-rose-500 hover:bg-rose-400 text-white'
                                    : 'bg-yellow-400 hover:bg-yellow-300 text-black'
                                }`}
                              >
                                {isClockedIn ? 'Clock Out' : 'Start Job →'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 3: HEISTS & ROBBERIES (BANKS, JEWELRY, HOUSES & STORES) */}
                {cityTabletTab === 'heists' && (
                  <div className="flex flex-col gap-3 overflow-y-auto pr-1">
                    {/* FBI Criminal Record & Restitution Risk Banner */}
                    <div className="bg-rose-950/50 border border-rose-500/40 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 font-mono">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-black text-[10px] uppercase">
                            ⚖️ FBI HEIST &amp; BURGLARY RECORD
                          </span>
                          <span className="text-zinc-300 text-xs font-bold">
                            Total Robbery Busts: {cityPursuitStats.bankRobberyBustCount || 0}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-300 mt-1.5 leading-relaxed">
                          💰 Rob <strong>Banks, Jewelry Exchanges, Luxury Houses, or Local Stores</strong> (smaller payouts = fewer security bots; huge vaults = heavy bot squads!). You can also drive up to any unowned real-estate house and press <strong>[R]</strong>! ⚠️ <strong>EXTREME RISK:</strong> If captured or busted during a heist, police seize all loot and levy a{' '}
                          <strong className="text-rose-400">
                            ${(500000 + (cityPursuitStats.bankRobberyBustCount || 0) * 250000).toLocaleString()}
                          </strong>{' '}
                          restitution penalty! If you cannot afford it, your balance plunges into <strong>debt</strong> and must be slowly repaid through future earnings.
                        </p>
                      </div>

                      {cityPursuitStats.inDebt && (
                        <div className="px-3 py-1.5 rounded-xl bg-rose-600/30 border border-rose-400 text-rose-300 text-xs font-black animate-pulse font-mono">
                          🚨 ACTIVE COURT RESTITUTION DEBT: -${(cityPursuitStats.heistDebtAmount || 0).toLocaleString()}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {CITY_HEIST_TARGETS_CATALOG.map((target) => {
                        const cd = Math.ceil(cityPursuitStats.heistCooldowns[target.id] || 0);
                        const canRob = target.robbable !== false;
                        return (
                          <div
                            key={target.id}
                            className="p-4 rounded-2xl border bg-zinc-900 border-white/10 hover:border-rose-500/40 flex flex-col justify-between gap-3 transition-all"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-black text-white">
                                  {target.icon} {target.name}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded border font-black text-[10px] ${
                                    canRob
                                      ? 'bg-rose-500/20 border-rose-400/40 text-rose-300'
                                      : 'bg-fuchsia-500/20 border-fuchsia-400/40 text-fuchsia-300'
                                  }`}
                                >
                                  {canRob ? `+$${target.payoutCash.toLocaleString()}` : 'EXPLORE-ONLY'}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{target.description}</p>
                              <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-400">
                                {canRob ? (
                                  <>
                                    <span>Risk: {'★'.repeat(target.wantedStarsTriggered)}</span>
                                    <span>·</span>
                                    <span>{cd > 0 ? `🔒 Lockdown ${cd}s` : `Crack time: ${target.robDurationSec}s`}</span>
                                  </>
                                ) : (
                                  <span className="text-fuchsia-300 font-bold">
                                    3-Floor Family Arcade · Elevators · Not Robbable
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                              <button
                                type="button"
                                onClick={() => {
                                  physicsRef.current?.setCityGpsTarget(target.x, target.z, `${target.icon} ${target.name}`, target.badgeColor);
                                  if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                                  setShowCityTabletModal(false);
                                  setShowCityGarageModal(false);
                                }}
                                className="flex-1 py-1.5 px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sky-300 border border-sky-400/30 font-black text-xs uppercase cursor-pointer text-center"
                              >
                                📍 Route GPS
                              </button>
                              {canRob ? (
                                <button
                                  type="button"
                                  disabled={cd > 0}
                                  onClick={() => {
                                    physicsRef.current?.triggerRobberyAtNearestTarget(target.id);
                                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                                    setShowCityTabletModal(false);
                                    setShowCityGarageModal(false);
                                  }}
                                  className={`py-1.5 px-3 rounded-xl font-black text-xs uppercase cursor-pointer ${
                                    cd > 0 ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-rose-500 hover:bg-rose-400 text-white'
                                  }`}
                                >
                                  {cd > 0 ? `${cd}s` : 'Rob [R]'}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    physicsRef.current?.triggerExploreBuilding('heist_target', target.id);
                                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                                    setShowCityTabletModal(false);
                                    setShowCityGarageModal(false);
                                  }}
                                  className="py-1.5 px-3 rounded-xl font-black text-xs uppercase cursor-pointer bg-fuchsia-500 hover:bg-fuchsia-400 text-white"
                                >
                                  Explore [V]
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 4: REAL ESTATE & HOUSES PORTFOLIO */}
                {cityTabletTab === 'houses' && (
                  <div className="flex flex-col gap-3 overflow-y-auto pr-1">
                    <div className="text-xs text-zinc-300 bg-zinc-900/60 p-3 rounded-xl border border-white/10">
                      Invest in residential homes across Pine Crest Suburbs and Downtown Penthouses! Every owned house pays passive rent income every 30 seconds directly to your account!
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {CITY_HOUSES_CATALOG.map((house) => {
                        const isOwned = cityPursuitStats.ownedHouseIds.includes(house.id);
                        const isActiveHome = cityPursuitStats.activeHomeId === house.id;
                        const canAfford = cityPursuitStats.streetCash >= house.price;
                        const rentPer30s = Math.round(house.passiveIncomePerMin / 2);

                        return (
                          <div
                            key={house.id}
                            className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 transition-all ${
                              isActiveHome
                                ? 'bg-teal-950/50 border-teal-400 shadow-lg'
                                : isOwned
                                ? 'bg-zinc-900 border-emerald-500/40'
                                : 'bg-zinc-900/80 border-white/10'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-black text-white">{house.icon} {house.name}</span>
                                <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
                                  isActiveHome ? 'bg-teal-400 text-black' : isOwned ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-amber-300'
                                }`}>
                                  {isActiveHome ? 'ACTIVE HOME' : isOwned ? 'OWNED' : `$${house.price.toLocaleString()}`}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{house.description}</p>
                              <div className="mt-2 text-xs font-bold text-teal-300">
                                Passive Rent: +${rentPer30s.toLocaleString()} every 30s · {house.garageSlots} Garage Slots
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                              <button
                                type="button"
                                onClick={() => {
                                  physicsRef.current?.setCityGpsTarget(house.x, house.z, `${house.icon} ${house.name}`, house.badgeColor);
                                  if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                                  setShowCityTabletModal(false);
                                  setShowCityGarageModal(false);
                                }}
                                className="flex-1 py-1.5 px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sky-300 border border-sky-400/30 text-xs font-bold cursor-pointer"
                              >
                                📍 Route GPS
                              </button>
                              <button
                                type="button"
                                disabled={!isOwned && !canAfford}
                                onClick={() => {
                                  physicsRef.current?.buyOrSelectCityHouse(house.id);
                                  if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                                }}
                                className={`flex-1 py-1.5 px-2 rounded-xl font-black text-xs uppercase cursor-pointer ${
                                  isOwned ? 'bg-teal-400 hover:bg-teal-300 text-black' : canAfford ? 'bg-amber-400 hover:bg-amber-300 text-black' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                }`}
                              >
                                {isOwned ? 'Set Spawn' : `Buy ($${(house.price / 1000).toFixed(0)}k)`}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 5: MY GARAGE & CUSTOM PAINT SHOP */}
                {cityTabletTab === 'garage' && (
                  <div className="flex flex-col gap-3 overflow-y-auto pr-1">
                    {/* Paint Shop Bar */}
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] text-zinc-400 block">CURRENT VEHICLE & COLOR</span>
                        <span className="text-sm font-black text-white">
                          {cityPursuitStats.currentStreetCar.name} · <span className="text-rose-400">{cityPursuitStats.currentStreetCar.horsepower} HP</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-300">🎨 Body Paint:</span>
                        {[
                          '#ef4444', '#38bdf8', '#10b981', '#facc15', '#f97316', '#a855f7', '#ec4899', '#f8fafc', '#18181b'
                        ].map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => {
                              physicsRef.current?.paintCityStreetCar(hex);
                              if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                            }}
                            className="w-6 h-6 rounded-full border-2 border-white/50 cursor-pointer hover:scale-110 transition-transform"
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Owned Cars Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {CITY_STREET_CARS.filter((car) => cityPursuitStats.ownedCarIds.includes(car.id)).map((car) => {
                        const activeTrimId = cityPursuitStats.activeTrimByCar?.[car.id] || car.trims[0]?.id;
                        const eff = getEffectiveStreetCarSpec(car, activeTrimId);
                        const isEquipped = cityPursuitStats.currentStreetCar.id === car.id;
                        return (
                          <div
                            key={car.id}
                            className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
                              isEquipped ? 'bg-purple-950/50 border-purple-400' : 'bg-zinc-900 border-white/10'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-black text-white">{eff.name}</span>
                                <span className="text-[10px] text-purple-300 font-bold">{car.drivetrain}</span>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5 text-center mt-2 text-xs">
                                <div className="bg-black/60 p-1.5 rounded-lg border border-white/5">
                                  <span className="text-[8px] text-zinc-500 block">POWER</span>
                                  <span className="text-rose-400 font-bold">{eff.horsepower} HP</span>
                                </div>
                                <div className="bg-black/60 p-1.5 rounded-lg border border-white/5">
                                  <span className="text-[8px] text-zinc-500 block">0-60</span>
                                  <span className="text-amber-300 font-bold">{eff.zeroToSixtySec.toFixed(2)}s</span>
                                </div>
                                <div className="bg-black/60 p-1.5 rounded-lg border border-white/5">
                                  <span className="text-[8px] text-zinc-500 block">TOP</span>
                                  <span className="text-sky-400 font-bold">{eff.topSpeedKmh} KM/H</span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                physicsRef.current?.buyOrSelectCityStreetCar(car.id);
                                if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                                setShowCityTabletModal(false);
                                setShowCityGarageModal(false);
                              }}
                              className={`w-full py-2 rounded-xl font-black text-xs uppercase cursor-pointer ${
                                isEquipped ? 'bg-zinc-800 text-sky-300' : 'bg-purple-500 hover:bg-purple-400 text-white'
                              }`}
                            >
                              {isEquipped ? '✓ Currently Driving' : 'Drive Out of Garage →'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 6: AUTO DEALERSHIP SHOWROOM */}
                {cityTabletTab === 'dealership' && (
                  <div className="flex flex-col gap-3 overflow-y-auto pr-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {CITY_STREET_CARS.map((car) => {
                        const isOwned = cityPursuitStats.ownedCarIds.includes(car.id);
                        const isEquipped = cityPursuitStats.currentStreetCar.id === car.id;
                        const activeTrimId = cityPursuitStats.activeTrimByCar?.[car.id] || car.trims[0]?.id;
                        const eff = getEffectiveStreetCarSpec(car, activeTrimId);
                        const canAfford = cityPursuitStats.streetCash >= car.price;

                        return (
                          <div
                            key={car.id}
                            className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
                              isEquipped ? 'bg-amber-950/50 border-amber-400' : isOwned ? 'bg-zinc-900 border-emerald-500/30' : 'bg-zinc-900/80 border-white/10'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-black text-white">{eff.name}</span>
                                <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
                                  isEquipped ? 'bg-amber-400 text-black' : isOwned ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-amber-300'
                                }`}>
                                  {isEquipped ? 'DRIVING' : isOwned ? 'OWNED' : car.price === 0 ? 'FREE' : `$${car.price.toLocaleString()}`}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5 text-center mt-2 text-xs">
                                <div className="bg-black/60 p-1.5 rounded-lg border border-white/5">
                                  <span className="text-[8px] text-zinc-500 block">POWER</span>
                                  <span className="text-rose-400 font-bold">{eff.horsepower} HP</span>
                                </div>
                                <div className="bg-black/60 p-1.5 rounded-lg border border-white/5">
                                  <span className="text-[8px] text-zinc-500 block">0-60</span>
                                  <span className="text-amber-300 font-bold">{eff.zeroToSixtySec.toFixed(2)}s</span>
                                </div>
                                <div className="bg-black/60 p-1.5 rounded-lg border border-white/5">
                                  <span className="text-[8px] text-zinc-500 block">TOP</span>
                                  <span className="text-sky-400 font-bold">{eff.topSpeedKmh} KM/H</span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={!isOwned && !canAfford}
                              onClick={() => {
                                physicsRef.current?.buyOrSelectCityStreetCar(car.id);
                                if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                                setShowCityTabletModal(false);
                                setShowCityGarageModal(false);
                              }}
                              className={`w-full py-2 rounded-xl font-black text-xs uppercase cursor-pointer ${
                                isEquipped ? 'bg-zinc-800 text-sky-300' : isOwned ? 'bg-purple-500 hover:bg-purple-400 text-white' : canAfford ? 'bg-amber-400 hover:bg-amber-300 text-black' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                              }`}
                            >
                              {isEquipped ? '✓ Equipped' : isOwned ? 'Drive Car' : canAfford ? `Purchase ($${car.price.toLocaleString()})` : `Need $${(car.price - cityPursuitStats.streetCash).toLocaleString()}`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 8: GRAPHICS SETTINGS & MOTION BLUR OPTIMIZATION */}
                {cityTabletTab === 'graphics' && (
                  <div className="flex flex-col gap-4 overflow-y-auto pr-1 font-mono">
                    {/* Motion Blur Optimization Card */}
                    <div className="bg-gradient-to-r from-sky-950/60 to-indigo-950/60 border border-sky-400/40 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/50 text-sky-300 text-xs font-black uppercase">
                            ⚡ MOTION BLUR & FILL-RATE OPTIMIZER
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            motionBlurEnabled ? 'bg-sky-500 text-black' : 'bg-zinc-800 text-zinc-400'
                          }`}>
                            {motionBlurEnabled ? 'ACTIVE (Cinematic 12-Tap Blur)' : 'DISABLED'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 mt-2 leading-relaxed">
                          <strong>Cinematic Velocity Streaks:</strong> High-speed 12-tap radial blur with chromatic aberration along peripheral edges.
                        </p>
                        <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                          🚀 <strong>FPS Optimization Engine:</strong> When motion blur is enabled, 3D geometry fill-rate is reduced to 0.82x resolution, freeing up ~35% GPU fragment overhead on dense buildings while the motion blur pass smooths edges at speed! Works with <strong>ALL</strong> graphics levels.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setStoredMotionBlur(!motionBlurEnabled)}
                        className={`px-5 py-3 rounded-xl font-black text-xs uppercase cursor-pointer transition-all shrink-0 flex items-center gap-2 shadow-lg ${
                          motionBlurEnabled
                            ? 'bg-sky-400 hover:bg-sky-300 text-black shadow-sky-500/30 ring-2 ring-sky-300'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/20'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${motionBlurEnabled ? 'bg-black animate-ping' : 'bg-zinc-500'}`} />
                        <span>MOTION BLUR: {motionBlurEnabled ? 'ENABLED' : 'DISABLED'}</span>
                      </button>
                    </div>

                    {/* Graphics Presets Selector */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-white uppercase tracking-wider">
                          🎨 Graphics Quality Presets
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          Active Preset: <strong className="text-cyan-300">{GRAPHICS_PRESETS[graphicsQuality]?.label || graphicsQuality}</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {GRAPHICS_QUALITY_OPTIONS.map((opt) => {
                          const isSelected = graphicsQuality === opt;
                          const preset = GRAPHICS_PRESETS[opt];
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                setStoredGraphicsQuality(opt);
                                setGraphicsQuality(opt);
                              }}
                              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                                isSelected
                                  ? 'bg-cyan-950/70 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400'
                                  : 'bg-zinc-900 border-white/10 hover:border-white/30 hover:bg-zinc-800/80'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-white">{preset?.shortLabel || preset?.label || opt}</span>
                                {isSelected && (
                                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                                )}
                              </div>
                              <p className="text-[10px] text-zinc-400 leading-tight">
                                {preset ? preset.description : 'Optimized configuration'}
                              </p>
                              <div className="text-[9px] text-zinc-500 font-mono mt-1">
                                {opt === 'ultra' ? 'Bloom + Shadows' : opt.includes('dynamic') ? 'Dynamic FPS Target' : 'Preset'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Diagnostics & Performance Info */}
                    <div className="bg-zinc-900/60 p-3.5 rounded-2xl border border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-[9px] text-zinc-500 block">VIEWPORT RESOLUTION</span>
                        <span className="font-black text-white tabular-nums">
                          {typeof window !== 'undefined' ? `${window.innerWidth} × ${window.innerHeight}` : '1920 × 1080'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 block">RENDER SCALE</span>
                        <span className="font-black text-cyan-300 tabular-nums">
                          {motionBlurEnabled ? '0.82x (Motion Blur Optimized)' : '1.0x (Native Fill)'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 block">MOTION BLUR STATUS</span>
                        <span className={`font-black ${motionBlurEnabled ? 'text-emerald-400' : 'text-zinc-400'}`}>
                          {motionBlurEnabled ? '12-Tap Radial / Streak' : 'Off'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-500 block">GPU PROFILE</span>
                        <span className="font-black text-amber-300">
                          {isDynamicGraphics(graphicsQuality) ? 'Dynamic Auto-Scaling' : 'Fixed Quality'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            );
          })()}
        </>
      )}

            {/* INFINITE ROAD PROVING GROUND & R&D DYNO CONTROL DECK (Cleanly docked below Top-Left Header with zero overlap) */}
      {!isCityDrivingMode && isOpenFieldMode && openFieldStats && (
        <div className="absolute top-[74px] left-3.5 md:left-5 z-40 w-[335px] sm:w-[395px] bg-zinc-950/90 border border-white/15 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md flex flex-col gap-3 pointer-events-auto">
          {/* Header Row with Zone, Coordinates, Odometer & Collapse/Reset Controls */}
          <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 font-bold tracking-wider">
                <span className="truncate">{openFieldStats.currentZone}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 tabular-nums mt-0.5">
                <span>HDG {openFieldStats.headingCompass}</span>
                <span>·</span>
                <span>
                  X:{openFieldStats.coordX}m Z:{openFieldStats.coordZ}m
                </span>
                <span>·</span>
                <span className="text-zinc-200 font-semibold">
                  {openFieldStats.totalDistanceKm.toFixed(2)} km
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  physicsRef.current?.resetOpenFieldRecords();
                  if (physicsRef.current) {
                    setOpenFieldStats({ ...physicsRef.current.openFieldStats });
                  }
                }}
                className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-mono text-[10px] font-semibold border border-white/10 cursor-pointer transition-colors whitespace-nowrap"
                title="Reset recorded acceleration, braking & top speed dyno records"
              >
                Reset Dyno
              </button>
              <button
                type="button"
                onClick={() => setIsOpenFieldHudCollapsed((prev) => !prev)}
                className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-mono text-[10px] font-semibold border border-white/10 cursor-pointer transition-colors whitespace-nowrap"
                title={isOpenFieldHudCollapsed ? 'Expand Dyno & Sandbox Controls' : 'Collapse Panel'}
              >
                {isOpenFieldHudCollapsed ? 'Expand' : 'Minimize'}
              </button>
            </div>
          </div>

          {!isOpenFieldHudCollapsed && (
            <>
              {/* 8-Cell Tabular Dyno Telemetry Grid */}
              <div className="grid grid-cols-4 gap-1.5 text-left font-mono tabular-nums">
                <div className="bg-zinc-900/90 border border-white/10 rounded-xl p-2">
                  <span className="text-[9px] text-zinc-400 block">0–100 KM/H</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-400 block mt-0.5">
                    {openFieldStats.zeroTo100Sec !== null ? `${openFieldStats.zeroTo100Sec.toFixed(2)}s` : '—'}
                  </span>
                  <span className="text-[9px] text-zinc-500 block">
                    Best {openFieldStats.bestZeroTo100Sec !== null ? `${openFieldStats.bestZeroTo100Sec.toFixed(2)}s` : '—'}
                  </span>
                </div>

                <div className="bg-zinc-900/90 border border-white/10 rounded-xl p-2">
                  <span className="text-[9px] text-zinc-400 block">0–200 KM/H</span>
                  <span className="text-xs sm:text-sm font-black text-cyan-400 block mt-0.5">
                    {openFieldStats.zeroTo200Sec !== null ? `${openFieldStats.zeroTo200Sec.toFixed(2)}s` : '—'}
                  </span>
                  <span className="text-[9px] text-zinc-500 block">
                    Best {openFieldStats.bestZeroTo200Sec !== null ? `${openFieldStats.bestZeroTo200Sec.toFixed(2)}s` : '—'}
                  </span>
                </div>

                <div className="bg-zinc-900/90 border border-white/10 rounded-xl p-2">
                  <span className="text-[9px] text-zinc-400 block">0–300 KM/H</span>
                  <span className="text-xs sm:text-sm font-black text-amber-400 block mt-0.5">
                    {openFieldStats.zeroTo300Sec !== null ? `${openFieldStats.zeroTo300Sec.toFixed(2)}s` : '—'}
                  </span>
                  <span className="text-[9px] text-zinc-500 block">
                    Best {openFieldStats.bestZeroTo300Sec !== null ? `${openFieldStats.bestZeroTo300Sec.toFixed(2)}s` : '—'}
                  </span>
                </div>

                <div className="bg-zinc-900/90 border border-white/10 rounded-xl p-2">
                  <span className="text-[9px] text-zinc-400 block">100–200 ROLL</span>
                  <span className="text-xs sm:text-sm font-black text-sky-300 block mt-0.5">
                    {openFieldStats.oneHundredTo200Sec !== null
                      ? `${openFieldStats.oneHundredTo200Sec.toFixed(2)}s`
                      : '—'}
                  </span>
                  <span className="text-[9px] text-zinc-500 block">
                    Best{' '}
                    {openFieldStats.bestOneHundredTo200Sec !== null
                      ? `${openFieldStats.bestOneHundredTo200Sec.toFixed(2)}s`
                      : '—'}
                  </span>
                </div>

                <div className="bg-zinc-900/90 border border-white/10 rounded-xl p-2">
                  <span className="text-[9px] text-zinc-400 block">1/4 MILE</span>
                  <span className="text-xs font-black text-purple-300 block mt-0.5">
                    {openFieldStats.quarterMileSec !== null ? `${openFieldStats.quarterMileSec.toFixed(2)}s` : '—'}
                  </span>
                  <span className="text-[9px] text-zinc-500 block">
                    Best {openFieldStats.bestQuarterMileSec !== null ? `${openFieldStats.bestQuarterMileSec.toFixed(2)}s` : '—'}
                  </span>
                </div>

                <div className="bg-zinc-900/90 border border-white/10 rounded-xl p-2">
                  <span className="text-[9px] text-zinc-400 block">100–0 BRAKE</span>
                  <span className="text-xs font-black text-orange-300 block mt-0.5">
                    {openFieldStats.brake100To0Meters !== null ? `${openFieldStats.brake100To0Meters.toFixed(1)}m` : '—'}
                  </span>
                  <span className="text-[9px] text-zinc-500 block">
                    Best{' '}
                    {openFieldStats.bestBrake100To0Meters !== null
                      ? `${openFieldStats.bestBrake100To0Meters.toFixed(1)}m`
                      : '—'}
                  </span>
                </div>

                <div className="bg-zinc-900/90 border border-white/10 rounded-xl p-2">
                  <span className="text-[9px] text-zinc-400 block">PEAK SPEED</span>
                  <span className="text-xs font-black text-rose-400 block mt-0.5">
                    {Math.round(openFieldStats.peakSpeedKmh)} km/h
                  </span>
                  <span className="text-[9px] text-zinc-500 block">
                    {Math.round(openFieldStats.peakSpeedKmh * 0.621371)} mph
                  </span>
                </div>

                <div className="bg-zinc-900/90 border border-white/10 rounded-xl p-2">
                  <span className="text-[9px] text-zinc-400 block">PEAK LAT G</span>
                  <span className="text-xs font-black text-teal-300 block mt-0.5">
                    {openFieldStats.peakLateralG.toFixed(2)} G
                  </span>
                  <span className="text-[9px] text-zinc-500 block">Skidpad</span>
                </div>
              </div>

              {/* Instant Zone Teleports ([1]-[5]) + [B] 300 KM/H Roll Launch */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono font-semibold text-zinc-400">
                    Instant Road Zone Teleport (Keys [1]–[5])
                  </span>
                  <span className="text-[9px] font-mono text-zinc-500">100% Road Tarmac</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => physicsRef.current?.teleportToOpenFieldZone('drag_strip')}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-emerald-300 font-mono font-semibold text-[10px] text-left cursor-pointer transition-colors whitespace-nowrap truncate"
                  >
                    [1] Endless Highway
                  </button>
                  <button
                    type="button"
                    onClick={() => physicsRef.current?.teleportToOpenFieldZone('open_grass')}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-sky-300 font-mono font-semibold text-[10px] text-left cursor-pointer transition-colors whitespace-nowrap truncate"
                  >
                    [2] Open Road Arena
                  </button>
                  <button
                    type="button"
                    onClick={() => physicsRef.current?.teleportToOpenFieldZone('skidpad')}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-cyan-300 font-mono font-semibold text-[10px] text-left cursor-pointer transition-colors whitespace-nowrap truncate"
                  >
                    [3] G-Force Skidpad
                  </button>
                  <button
                    type="button"
                    onClick={() => physicsRef.current?.teleportToOpenFieldZone('slalom')}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-amber-300 font-mono font-semibold text-[10px] text-left cursor-pointer transition-colors whitespace-nowrap truncate"
                  >
                    [4] Slalom Cones
                  </button>
                  <button
                    type="button"
                    onClick={() => physicsRef.current?.teleportToOpenFieldZone('brake_test')}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-orange-300 font-mono font-semibold text-[10px] text-left cursor-pointer transition-colors whitespace-nowrap truncate"
                  >
                    [5] 300–0 Brake Strip
                  </button>
                  <button
                    type="button"
                    onClick={() => physicsRef.current?.launchAtTopSpeed(300)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-black text-[10px] text-center cursor-pointer transition-colors whitespace-nowrap truncate"
                    title="Immediately boost car to 300 km/h in 8th gear (Key [B])"
                  >
                    [B] 300 KM/H Roll
                  </button>
                </div>
              </div>

              {/* Live R&D Car Spec Comparison Switcher + 100% Grip/ERS Lock */}
              <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-semibold text-zinc-400">
                    Live R&D Car Spec Comparison
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      physicsRef.current?.toggleOpenFieldInfiniteLock();
                      if (physicsRef.current) {
                        setOpenFieldStats({ ...physicsRef.current.openFieldStats });
                      }
                    }}
                    className={`px-2 py-0.5 rounded font-mono text-[9px] font-bold transition-colors cursor-pointer border whitespace-nowrap ${
                      openFieldStats.infiniteGripAndBatteryLock
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                    }`}
                    title="Lock tires at 100% optimal grip (90°C) and ERS battery at 100%"
                  >
                    {openFieldStats.infiniteGripAndBatteryLock ? '100% Grip & ERS Locked' : 'Realistic Tire Wear ON'}
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1">
                  {(
                    [
                      { id: 'career_car', label: 'Career Car' },
                      { id: 'stock_baseline', label: 'Stock 80' },
                      { id: 'hyper_prototype', label: 'Hyper 115' },
                      { id: 'unlimited_x', label: 'X-Spec 138' },
                    ] as const
                  ).map((spec) => (
                    <button
                      key={spec.id}
                      type="button"
                      onClick={() => {
                        physicsRef.current?.setOpenFieldSpecMode(spec.id);
                        if (physicsRef.current) {
                          setOpenFieldStats({ ...physicsRef.current.openFieldStats });
                        }
                      }}
                      className={`py-1.5 px-1.5 rounded-lg font-mono font-bold text-[10px] transition-colors cursor-pointer border whitespace-nowrap truncate ${
                        openFieldStats.activeSpecMode === spec.id
                          ? 'bg-emerald-500 text-black border-emerald-300 font-black'
                          : 'bg-zinc-900 text-zinc-400 hover:text-white border-white/10'
                      }`}
                    >
                      {spec.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Top-Right Unified Performance, Graphics, Pause & Forfeit/Exit Dock */}
      <div className="absolute top-3 right-4 z-40 flex items-center gap-2">
        {/* Live Uncapped FPS & Frame-Time Pill */}
        <div
          className="flex items-center gap-2 bg-zinc-950/85 border border-white/10 backdrop-blur-md rounded-lg px-3 py-1.5 font-mono text-[11px] shadow-xl"
          title={`Uncapped Frame Rate: ${liveFps} FPS (${frameTimeMs.toFixed(1)}ms)${
            isDynamicGraphics(graphicsQuality)
              ? ` · ${GRAPHICS_PRESETS[graphicsQuality].shortLabel}: ${dynamicQualityPct}% (${dynamicRenderScale}x) · ${dynamicFeatureCombo}`
              : ''
          }`}
        >
          <span
            className={`font-black tabular-nums ${
              liveFps >= 58
                ? 'text-emerald-400'
                : liveFps >= 45
                ? 'text-amber-400'
                : 'text-red-400'
            }`}
          >
            {liveFps} FPS
          </span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-400 tabular-nums text-[10px]">
            {frameTimeMs.toFixed(1)}ms
          </span>
          {isDynamicGraphics(graphicsQuality) && (
            <>
              <span className="text-zinc-600 hidden sm:inline">·</span>
              <span
                className={`font-semibold text-[10px] tabular-nums hidden sm:inline ${
                  graphicsQuality === 'dynamic_conservative'
                    ? 'text-emerald-300'
                    : 'text-cyan-300'
                }`}
              >
                {dynamicQualityPct}% ({dynamicFeatureCombo})
              </span>
            </>
          )}
        </div>

        {/* Segmented Graphics Quality Selector (Conservative Dynamic, Aggressive Dynamic, Retro Arcade, Retro Pixel, Low, Med, High, Ultra) */}
        <div className="flex items-center gap-0.5 bg-zinc-950/85 border border-white/10 backdrop-blur-md rounded-lg p-1 shadow-xl">
          {GRAPHICS_QUALITY_OPTIONS.map((q) => (
            <button
              key={q}
              onClick={() => setStoredGraphicsQuality(q)}
              className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-colors cursor-pointer whitespace-nowrap ${
                graphicsQuality === q
                  ? q === 'ultra'
                    ? 'bg-amber-500 text-black'
                    : q === 'retro'
                    ? 'bg-[#ff2a85] text-white shadow-[0_0_10px_#ff2a85]'
                    : q === 'retro_pixel'
                    ? 'bg-purple-500 text-white shadow-[0_0_10px_#a855f7]'
                    : q === 'dynamic_conservative'
                    ? 'bg-emerald-400 text-black'
                    : q === 'dynamic_aggressive'
                    ? 'bg-cyan-400 text-black'
                    : 'bg-white text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title={GRAPHICS_PRESETS[q].description}
            >
              {GRAPHICS_PRESETS[q].hudButtonLabel}
            </button>
          ))}
        </div>

        {/* Motion Blur Optimization Toggle */}
        <button
          onClick={() => setStoredMotionBlur(!motionBlurEnabled)}
          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border backdrop-blur-md shadow-xl ${
            motionBlurEnabled
              ? 'bg-sky-500/20 text-sky-300 border-sky-400/50 hover:bg-sky-500/30 shadow-[0_0_10px_rgba(56,189,248,0.35)]'
              : 'bg-zinc-950/85 text-zinc-400 border-white/10 hover:text-white hover:border-zinc-500'
          }`}
          title={
            motionBlurEnabled
              ? 'Motion Blur: ON (Cinematic speed streaks). Click to DISABLE to boost FPS and optimize performance on lower-spec systems.'
              : 'Motion Blur: OFF (Zero blur optimization for max FPS). Click to ENABLE cinematic speed streaks.'
          }
        >
          <span className={`w-1.5 h-1.5 rounded-full ${motionBlurEnabled ? 'bg-sky-400 animate-pulse' : 'bg-zinc-600'}`} />
          <span>BLUR: {motionBlurEnabled ? 'ON' : 'OFF'}</span>
        </button>

        {/* Pause Button ([ESC]) */}
        <button
          onClick={() => togglePause()}
          className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg border backdrop-blur-md transition-colors cursor-pointer shadow-xl whitespace-nowrap flex items-center gap-1.5 ${
            isPaused
              ? 'bg-amber-500 text-black border-amber-300'
              : 'bg-zinc-950/85 hover:bg-amber-500 text-amber-400 hover:text-black border-amber-500/40'
          }`}
          title="Pause or Resume the race (Shortcut: [ESC])"
        >
          <span>{isPaused ? '▶ Resume [ESC]' : '⏸ Pause [ESC]'}</span>
        </button>

        {/* Instant Re-Qualify Button during Qualifying */}
        {isQualifyingMode && (
          <button
            onClick={handleRestartQualifyingLap}
            className="px-3 py-1.5 bg-purple-600/90 hover:bg-purple-500 text-white text-xs font-black uppercase tracking-wider rounded-lg border border-purple-400/50 backdrop-blur-md transition-colors cursor-pointer shadow-xl whitespace-nowrap"
            title="Immediately restart your 1-Lap Qualifying shootout"
          >
            🔄 Re-Qualify
          </button>
        )}

        {/* Exit / Quit Race Button */}
        <button
          onClick={() => {
            if (isPracticeMode) {
              onExitToPaddock();
            } else {
              togglePause(true);
            }
          }}
          className="px-3 py-1.5 bg-zinc-950/85 hover:bg-red-600 text-zinc-200 hover:text-white text-xs font-semibold rounded-lg border border-white/10 hover:border-red-500 backdrop-blur-md transition-colors cursor-pointer shadow-xl whitespace-nowrap"
          title={
            isPracticeMode
              ? 'Exit Practice to Paddock'
              : isQualifyingMode
              ? 'Pause or Quit Qualifying (You can re-qualify anytime!)'
              : 'Open Pause / Quit Menu (Warning: Quitting mid-race counts as a P20 Loss!)'
          }
        >
          {isPracticeMode ? 'Exit Practice' : isQualifyingMode ? 'Quit / Re-Qualify' : 'Quit Race'}
        </button>
      </div>

      {/* PAUSE MENU OVERLAY */}
      {isPaused && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-zinc-900 border-2 border-amber-500/50 max-w-md w-full rounded-3xl p-6 shadow-2xl flex flex-col gap-5 text-center">
            <div>
              <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono font-black text-[10px] uppercase tracking-widest">
                ⏸ SESSION PAUSED
              </span>
              <h2 className="text-2xl font-black text-white mt-2">{circuit.name}</h2>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                {isPracticeMode
                  ? 'Free Practice Session'
                  : isQualifyingMode
                  ? '1-Lap Qualifying Shootout'
                  : `Grand Prix · Lap ${telemetry?.currentLap || 1} of ${laps} · Running P${telemetry?.position || 1}`}
              </p>
            </div>

            {isQualifyingMode ? (
              <div className="p-3.5 rounded-2xl bg-purple-950/60 border border-purple-500/50 text-left text-xs text-purple-200 leading-relaxed">
                <strong className="text-purple-300 uppercase font-mono text-[10px] block mb-0.5">
                  ⏱️ QUALIFYING SHOOTOUT RULE (NO PENALTY TO QUIT):
                </strong>
                If you quit mid-Qualifying lap, there is no penalty—you can restart your flying lap right now or return to the Paddock and re-qualify whenever you are ready!
              </div>
            ) : !isPracticeMode ? (
              <div className="p-3.5 rounded-2xl bg-red-950/70 border border-red-500/60 text-left text-xs text-red-200 leading-relaxed">
                <strong className="text-red-400 uppercase font-mono text-[10px] block mb-0.5">
                  ⚠️ MID-RACE QUIT RULE (FORFEIT = LOSS):
                </strong>
                If you quit mid-race, you automatically LOSE the Grand Prix (classified P20 Last Place, 0 PTS, $0 driver payout)—and if you are on a Prove-It contract, finishing P20 can get you immediately CUT!
              </div>
            ) : null}

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => togglePause(false)}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
              >
                ▶ Resume {isPracticeMode ? 'Practice' : isQualifyingMode ? 'Qualifying' : 'Race'} [ESC]
              </button>

              {isQualifyingMode && (
                <button
                  type="button"
                  onClick={handleRestartQualifyingLap}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider border border-purple-400/50 shadow-lg shadow-purple-950/50 transition-all cursor-pointer"
                >
                  🔄 Restart Qualifying Lap Now (Re-Qualify)
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    cycleCamera();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs border border-white/10 transition-colors cursor-pointer"
                >
                  Camera: {cameraView.toUpperCase()}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleToggleMute();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs border border-white/10 transition-colors cursor-pointer"
                >
                  {isMuted ? '🔇 Audio Muted' : '🔊 Audio On'}
                </button>
              </div>

              {/* In-Session Motion Blur Toggle */}
              <button
                type="button"
                onClick={() => setStoredMotionBlur(!motionBlurEnabled)}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs border transition-all cursor-pointer flex items-center justify-between shadow-md ${
                  motionBlurEnabled
                    ? 'bg-sky-950/70 border-sky-400/50 text-sky-200 shadow-sky-950/40'
                    : 'bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 border-white/10'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${motionBlurEnabled ? 'bg-sky-400 animate-pulse' : 'bg-zinc-500'}`} />
                  <span>💨 Motion Blur:</span>
                  <span
                    className={`font-mono text-[10px] font-black px-1.5 py-0.5 rounded ${
                      motionBlurEnabled ? 'bg-sky-500 text-black' : 'bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    {motionBlurEnabled ? 'ON (Cinematic)' : 'OFF (Optimized)'}
                  </span>
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  {motionBlurEnabled ? 'Disable to boost FPS' : 'Enable speed streaks'}
                </span>
              </button>

              {onOpenControls && (
                <button
                  type="button"
                  onClick={() => onOpenControls()}
                  className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold text-xs uppercase tracking-wider border border-amber-500/30 transition-colors cursor-pointer"
                >
                  ⚙️ Custom Button Mapping & Controls
                </button>
              )}

              <button
                type="button"
                onClick={handleQuitMidRace}
                className={`w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider border shadow-lg transition-all cursor-pointer mt-1 ${
                  isPracticeMode || isQualifyingMode
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-white/20 shadow-black/40'
                    : 'bg-red-600/90 hover:bg-red-500 text-white border-red-400 shadow-red-950/50'
                }`}
              >
                {isPracticeMode
                  ? 'Exit Practice to Paddock'
                  : isQualifyingMode
                  ? '↩ Exit Qualifying to Paddock (Re-Qualify Anytime)'
                  : '🏳️ Quit Mid-Race (Forfeit & Lose — Finish P20 DNF)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP-DOWN RETRO BANK HEIST & BUILDING INTERIOR EXPLORATION OVERLAY */}
      {isCityDrivingMode && cityPursuitStats?.activeBankMinigameTarget && (
        <BankHeistMinigame
          target={cityPursuitStats.activeBankMinigameTarget}
          streetCash={cityPursuitStats.streetCash}
          furnishings={
            cityPursuitStats.houseFurnishings?.[cityPursuitStats.activeBankMinigameTarget.id] || []
          }
          onBuyHouseItem={(itemId) => {
            const houseId = cityPursuitStats.activeBankMinigameTarget?.id;
            if (houseId && physicsRef.current) {
              physicsRef.current.buyHouseFurnishing(houseId, itemId);
              setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
            }
          }}
          onAwardExploreCash={(delta, label) => {
            if (physicsRef.current) {
              physicsRef.current.awardInteriorMinigameCash(delta, label);
              setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
            }
          }}
          onSuccess={(stolenCashOverride) => {
            const targetId = cityPursuitStats.activeBankMinigameTarget?.id;
            if (targetId && physicsRef.current) {
              physicsRef.current.completeBankHeistMinigameWin(targetId, stolenCashOverride);
              setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
            }
          }}
          onCaptured={() => {
            const targetId = cityPursuitStats.activeBankMinigameTarget?.id;
            if (targetId && physicsRef.current) {
              physicsRef.current.completeBankHeistMinigameCaptured(targetId);
              setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
            }
          }}
          onAbort={() => {
            if (physicsRef.current) {
              physicsRef.current.abortBankHeistMinigame();
              setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
            }
          }}
        />
      )}

      {isCityDrivingMode && cityPursuitStats?.activeLockpickTarget && (
        <LockpickMinigame
          target={cityPursuitStats.activeLockpickTarget}
          onUnlocked={() => {
            const houseId = cityPursuitStats.activeLockpickTarget?.houseId;
            if (houseId && physicsRef.current) {
              physicsRef.current.completeHouseLockpick(houseId);
              setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
            }
          }}
          onTriggerAlarm={() => {
            const houseId = cityPursuitStats.activeLockpickTarget?.houseId;
            if (houseId && physicsRef.current) {
              physicsRef.current.triggerHouseSecurityAlarm(houseId);
              setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
            }
          }}
          onAbort={() => {
            if (physicsRef.current) {
              physicsRef.current.abortHouseLockpick();
              setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
            }
          }}
        />
      )}

      {/* TOP-DOWN RETRO SPORTS MINIGAMES (BASKETBALL / GOLF / BASEBALL / SOCCER / BOWLING / FISHING) */}
      {isCityDrivingMode && cityPursuitStats?.activeSportsMinigame && (
        <SportsMinigame
          venue={cityPursuitStats.activeSportsMinigame}
          onComplete={handleSportsMinigameComplete}
          onAbort={handleSportsMinigameAbort}
        />
      )}

      {isCityDrivingMode && showGoogleMapsModal && (
        <MarylandGoogleMapModal
          isOpen={showGoogleMapsModal}
          onClose={closeGoogleMapsModal}
          playerWorldPos={
            cityPursuitStats?.minimapData
              ? {
                  x: cityPursuitStats.minimapData.playerX,
                  z: cityPursuitStats.minimapData.playerZ,
                  heading: cityPursuitStats.minimapData.playerHeading,
                }
              : null
          }
          activeGpsLabel={cityPursuitStats?.minimapData?.gpsTarget?.label || null}
          activeGpsCoords={
            cityPursuitStats?.minimapData?.gpsTarget
              ? {
                  x: cityPursuitStats.minimapData.gpsTarget.x,
                  z: cityPursuitStats.minimapData.gpsTarget.z,
                }
              : null
          }
          onSetInGameGpsTarget={(worldX, worldZ, label, color) => {
            physicsRef.current?.setCityGpsTarget(worldX, worldZ, label, color || '#38bdf8');
            if (physicsRef.current) {
              setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
            }
          }}
          onClearInGameGpsTarget={() => {
            physicsRef.current?.clearCityGpsTarget();
            if (physicsRef.current) {
              setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
            }
          }}
        />
      )}
    </div>
  );
};
