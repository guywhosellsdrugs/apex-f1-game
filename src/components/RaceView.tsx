import React, { useEffect, useRef, useMemo, useState } from 'react';
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
  getEffectiveStreetCarSpec,
  searchMarylandGpsDirectory,
  MarylandGpsEntry,
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
import { WeatherMode, GaithersburgWeather, calculateDrivetrainTractionModifier } from '../services/weatherService';
import { inputManager } from '../services/inputManager';
import { soundEngine } from '../services/soundEngine';
import { BroadcastHUD } from './BroadcastHUD';
import { ControlsSettingsModal } from './ControlsSettingsModal';
import { BankHeistMinigame } from './BankHeistMinigame';
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

// High-speed radial/velocity motion blur shader for cinematic flow and sense of speed
const MotionBlurShader = {
  uniforms: {
    tDiffuse: { value: null },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
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
    uniform float uIntensity;
    uniform vec2 uResolution;
    varying vec2 vUv;

    void main() {
      if (uIntensity <= 0.0005) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      vec2 dir = (uCenter - vUv);
      float dist = length(dir);

      // Keep center of screen (cockpit/road ahead) clear; peripheral edges blur along velocity
      float mask = smoothstep(0.06, 0.72, dist);
      float strength = uIntensity * (0.35 + mask * 0.65);

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

        // Chromatic split on peripheral streaks for high-speed cinematic optics
        float chromatic = strength * 0.018 * float(i - 6);
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
  const [gpsAddressQuery, setGpsAddressQuery] = useState<string>('');
  const [gpsDropdownOpen, setGpsDropdownOpen] = useState<boolean>(false);
  const gpsInputRef = useRef<HTMLInputElement>(null);

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
      gfxPreset.id === 'retro_pixel' ? 1050 : gfxPreset.id === 'low' ? 1400 : 2400
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: gfxPreset.antialias,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, gfxPreset.maxPixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;
    const isHighOrUltra = gfxPreset.id === 'high' || gfxPreset.id === 'ultra';
    const isRetroAny = gfxPreset.id === 'retro' || gfxPreset.id === 'retro_pixel';
    renderer.toneMapping = isHighOrUltra ? THREE.NeutralToneMapping : THREE.NoToneMapping;
    renderer.toneMappingExposure = gfxPreset.id === 'ultra' ? 0.96 : 1.0;

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
    // Uses a smooth sky + horizon + soft studio bounce dome (zero harsh sun disk, so no circular lens ever forms)
    let pmremGenerator: THREE.PMREMGenerator | null = null;
    let pmremRenderTarget: THREE.WebGLRenderTarget | null = null;
    if (gfxPreset.useEnvironmentReflections) {
      pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileCubemapShader();

      const envScene = new THREE.Scene();
      const envCanvas = document.createElement('canvas');
      envCanvas.width = 512;
      envCanvas.height = 256;
      const eCtx = envCanvas.getContext('2d');
      if (eCtx) {
        const skyCol = new THREE.Color(hemiSky);
        const sunCol = new THREE.Color(sunColor);
        const gndCol = new THREE.Color(hemiGround);
        const eGrad = eCtx.createLinearGradient(0, 0, 0, 256);
        // Smooth zenith -> soft sky -> natural horizon glow -> dark track asphalt bounce
        eGrad.addColorStop(0.0, `#${skyCol.clone().multiplyScalar(0.55).getHexString()}`);
        eGrad.addColorStop(0.36, `#${skyCol.clone().multiplyScalar(0.88).getHexString()}`);
        eGrad.addColorStop(0.49, `#${sunCol.clone().lerp(skyCol, 0.45).multiplyScalar(0.92).getHexString()}`);
        eGrad.addColorStop(0.53, '#222630');
        eGrad.addColorStop(1.0, `#${gndCol.clone().multiplyScalar(0.35).getHexString()}`);
        eCtx.fillStyle = eGrad;
        eCtx.fillRect(0, 0, 512, 256);

        // Subtle soft-edged horizon atmospheric band + circuit floodlight / grandstand reflection accents
        const horizonBand = eCtx.createLinearGradient(0, 106, 0, 138);
        horizonBand.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
        horizonBand.addColorStop(0.48, 'rgba(255, 248, 235, 0.42)');
        horizonBand.addColorStop(0.55, 'rgba(56, 189, 248, 0.25)');
        horizonBand.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        eCtx.fillStyle = horizonBand;
        eCtx.fillRect(0, 106, 512, 32);

        // Soft circuit floodlight & grandstand reflection pillars along the horizon so the glossy track reflects varied light streaks
        for (let x = 16; x < 512; x += 48) {
          const beamGrad = eCtx.createLinearGradient(x, 82, x, 134);
          beamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
          beamGrad.addColorStop(0.65, 'rgba(255, 250, 235, 0.38)');
          beamGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
          eCtx.fillStyle = beamGrad;
          eCtx.fillRect(x, 82, 18, 52);
        }

        const envDomeTex = new THREE.CanvasTexture(envCanvas);
        envDomeTex.colorSpace = THREE.SRGBColorSpace;
        const envSphere = new THREE.Mesh(
          new THREE.SphereGeometry(80, 32, 20),
          new THREE.MeshBasicMaterial({ map: envDomeTex, side: THREE.BackSide })
        );
        envScene.add(envSphere);

        // Soft diffused overhead broadcast gantry light panels for natural automotive & glossy track reflections
        const softPanelMat = new THREE.MeshBasicMaterial({
          color: sunCol.clone().lerp(new THREE.Color(0xffffff), 0.65).multiplyScalar(0.88),
          side: THREE.DoubleSide,
        });
        const panelLeft = new THREE.Mesh(new THREE.PlaneGeometry(38, 7.5), softPanelMat);
        panelLeft.position.set(-28, 32, 0);
        panelLeft.lookAt(0, 0, 0);
        envScene.add(panelLeft);

        const panelRight = new THREE.Mesh(new THREE.PlaneGeometry(38, 7.5), softPanelMat);
        panelRight.position.set(28, 28, -10);
        panelRight.lookAt(0, 0, 0);
        envScene.add(panelRight);

        const panelFront = new THREE.Mesh(new THREE.PlaneGeometry(32, 6), softPanelMat);
        panelFront.position.set(0, 26, -34);
        panelFront.lookAt(0, 0, 0);
        envScene.add(panelFront);

        pmremRenderTarget = pmremGenerator.fromScene(envScene, 0.032);
        scene.environment = pmremRenderTarget.texture;
        envSphere.geometry.dispose();
        (envSphere.material as THREE.MeshBasicMaterial).dispose();
        envDomeTex.dispose();
        panelLeft.geometry.dispose();
        panelRight.geometry.dispose();
        panelFront.geometry.dispose();
        softPanelMat.dispose();
      }
    }

    // Calibrate direct light intensities in High/Ultra so they complement the 360° PMREM reflections without over-bright specular glare
    const hemiIntensity = gfxPreset.id === 'ultra' ? 0.72 : gfxPreset.id === 'high' ? 0.82 : 0.95;
    const hemiLight = new THREE.HemisphereLight(hemiSky, hemiGround, hemiIntensity);
    scene.add(hemiLight);

    const baseAmbient = Math.max(0.75, circuit.ambientLight * 0.88);
    const ambientIntensity = gfxPreset.id === 'ultra' ? baseAmbient * 0.68 : gfxPreset.id === 'high' ? baseAmbient * 0.78 : baseAmbient;
    const ambientLight = new THREE.AmbientLight(0xffffff, ambientIntensity);
    scene.add(ambientLight);

    const calibratedSunIntensity =
      gfxPreset.id === 'ultra'
        ? sunIntensity * 0.68
        : gfxPreset.id === 'high'
        ? sunIntensity * 0.78
        : sunIntensity;
    const sunLight = new THREE.DirectionalLight(sunColor, calibratedSunIntensity);
    sunLight.castShadow = false;
    scene.add(sunLight);
    scene.add(sunLight.target);

    // 3-Point Rim & Specular Fill Directional Light — softly balanced in Ultra so it never causes white blowouts
    let rimLight: THREE.DirectionalLight | null = null;
    if (gfxPreset.enableRimAndFillLights) {
      rimLight = new THREE.DirectionalLight(
        circuit.id === 'abudhabi' ? 0x38bdf8 : 0xe0f2fe,
        gfxPreset.id === 'ultra' ? 0.44 : gfxPreset.id === 'high' ? 0.56 : 0.75
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
    let motionBlurPass: ShaderPass | null = null;
    let planarReflectionRT: THREE.WebGLRenderTarget | null = null;
    let reflectionCamera: THREE.PerspectiveCamera | null = null;

    if (gfxPreset.id === 'ultra' || gfxPreset.id === 'high') {
      const reflScale = gfxPreset.id === 'ultra' ? 0.85 : 0.5;
      planarReflectionRT = new THREE.WebGLRenderTarget(
        Math.max(256, Math.floor(width * reflScale)),
        Math.max(256, Math.floor(height * reflScale)),
        {
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          colorSpace: THREE.SRGBColorSpace,
        }
      );
      reflectionCamera = new THREE.PerspectiveCamera(camera.fov, width / height, 0.1, 2200);
      track.setReflectionTexture(planarReflectionRT.texture, gfxPreset.id === 'ultra' ? 0.20 : 0.12);
    }
    const reflectionBgColor = new THREE.Color(0x020308);

    // Dynamic composer factory: creates passes when Ultra HDR bloom OR Motion Blur is active
    const initComposer = (): EffectComposer => {
      if (composer) return composer;
      const isUltra = gfxPreset.id === 'ultra';
      const pixelRatio = renderer.getPixelRatio();
      const rt = new THREE.WebGLRenderTarget(width * pixelRatio, height * pixelRatio, {
        samples: isUltra ? 4 : 0,
        type: isUltra ? THREE.HalfFloatType : THREE.UnsignedByteType,
      });
      const effectivePixelRatio = motionBlurEnabledRef.current
        ? Math.min(1.2, pixelRatio * 0.82)
        : pixelRatio;
      composer = new EffectComposer(renderer, rt);
      composer.setSize(width, height);
      composer.setPixelRatio(effectivePixelRatio);

      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      if (isUltra) {
        const bloomPass = new UnrealBloomPass(
          new THREE.Vector2(width, height),
          0.18, // clean, natural specular bloom on LED headlights, taillights, and street lights
          0.42,
          0.88
        );
        composer.addPass(bloomPass);
      }

      motionBlurPass = new ShaderPass(MotionBlurShader);
      motionBlurPass.enabled = motionBlurEnabledRef.current;
      composer.addPass(motionBlurPass);

      const outputPass = new OutputPass();
      composer.addPass(outputPass);
      return composer;
    };

    if (gfxPreset.id === 'ultra' || motionBlurEnabledRef.current) {
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
      soundEngine.setStreetCarEngineProfile(physics.cityPursuitStats.currentStreetCar.id);
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
      // In City Driving Mode, preserve far >= 1060 so the R=920 atmospheric sky dome and R=780 Sun are never far-clipped
      const rawFar = showOuterScenery
        ? Math.round(900 + clampedQ * 1150)
        : isConservativeDynamic && clampedQ < 0.30
        ? Math.round(340 + clampedQ * 500)
        : Math.round(480 + clampedQ * 650);
      const targetFar = isCityDrivingMode ? Math.max(1060, rawFar) : rawFar;
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

    const renderLoop = (time: number) => {
      animFrameId = requestAnimationFrame(renderLoop);
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

      // Multi-frame sample window for telemetry readout & smooth steady-state tuning
      const fpsElapsed = time - lastFpsSampleTime;
      const sampleWindowMs = isConservativeDynamic
        ? 45
        : isAggressiveDynamic
        ? 95
        : 120;

      if (fpsElapsed >= sampleWindowMs && fpsSampleFrames >= 2) {
        const exactFps = (fpsSampleFrames * 1000) / fpsElapsed;
        // Completely UNCAPPED FPS readout (supports 60Hz, 120Hz, 144Hz, 240Hz, 360Hz, 500Hz+)
        const measuredFps = Math.max(1, Math.round(exactFps));
        const measuredMs = Number(
          (fpsElapsed / Math.max(1, fpsSampleFrames)).toFixed(1)
        );
        setLiveFps(measuredFps);
        setFrameTimeMs(measuredMs);
        fpsSampleFrames = 0;
        lastFpsSampleTime = time;

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
        const sprayState = physics.getTireSprayState();
        tireSpraySys?.update(carPos, heading, speed, sprayState, rawDelta);
        weatherAtmosphereSys?.update(carPos, physics.currentWeather, rawDelta);
        skyCelestialSys?.update(carPos, physics.currentWeather, rawDelta);
      }

      if (isCityDrivingMode && skyCelestialSys) {
        const sDir = skyCelestialSys.sunDirection;
        const sunElevY = Math.max(18, sDir.y * 95);
        sunLight.position.set(carPos.x + sDir.x * 85, carPos.y + sunElevY, carPos.z + sDir.z * 85);
      } else {
        sunLight.position.set(carPos.x + 42, carPos.y + 76, carPos.z + 32);
      }
      sunLight.target.position.copy(carPos);
      sunLight.target.updateMatrixWorld();

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
      if (activeView === 'chase') {
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
      const baseHz = activeView === 'cockpit' || activeView === 'nose' ? 36 : gfxPreset.cameraSmoothingHz;
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

      // Real-time planar road reflection pass (mirrors F1 cars, barriers, grandstands, trees, gantry, and sky across the asphalt plane)
      if (planarReflectionRT && reflectionCamera) {
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
        const prevBg = scene.background;
        const prevFog = scene.fog;
        const prevSkyVis = skyDomeMesh ? skyDomeMesh.visible : false;
        scene.background = reflectionBgColor;
        scene.fog = null;
        if (skyDomeMesh) skyDomeMesh.visible = false;

        const prevRenderTarget = renderer.getRenderTarget();
        renderer.setRenderTarget(planarReflectionRT);
        renderer.clear();
        renderer.render(scene, reflectionCamera);
        renderer.setRenderTarget(prevRenderTarget);

        scene.background = prevBg;
        scene.fog = prevFog;
        if (skyDomeMesh) skyDomeMesh.visible = prevSkyVis;
        track.setReflectionPassMode(false);
      }

      const isUltra = gfxPreset.id === 'ultra';
      const useComposer = isUltra || motionBlurEnabledRef.current;
      if (useComposer) {
        const comp = initComposer();
        if (motionBlurPass) {
          motionBlurPass.enabled = motionBlurEnabledRef.current;
          if (motionBlurPass.enabled) {
            const spd = Math.abs(physics.playerSpeedKmh || 0);
            // Smoothly ramp up above 28 km/h, reaching full cinematic feel at 200+ km/h
            const speedNorm = Math.max(0.0, Math.min(1.0, (spd - 28) / 210));
            motionBlurPass.uniforms.uIntensity.value = speedNorm * 0.17;
            motionBlurPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
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
        const reflScale = gfxPreset.id === 'ultra' ? 0.75 : 0.5;
        planarReflectionRT.setSize(
          Math.max(256, Math.floor(w * reflScale)),
          Math.max(256, Math.floor(h * reflScale))
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

      if (e.key === 'Escape' || e.code === 'Escape') {
        e.preventDefault();
        togglePause();
        return;
      }

      if (isPausedRef.current) {
        return;
      }

      if (isCityDrivingMode) {
        if (e.key === 'g' || e.key === 'G' || e.code === 'KeyG') {
          e.preventDefault();
          setShowCityGarageModal((prev) => !prev);
          return;
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
          if (physicsRef.current?.cityPursuitStats.nearbyHeistPrompt) {
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
        if (e.key === 'g' || e.key === 'G' || e.code === 'KeyG') {
          e.preventDefault();
          setCityTabletTab('garage');
          setShowCityTabletModal(true);
          return;
        }
        if (e.key === 'Escape') {
          setShowCityTabletModal(false);
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
              <div className="bg-zinc-950/95 border-2 border-emerald-400 rounded-2xl p-3.5 shadow-[0_0_35px_rgba(16,185,129,0.55)] backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-400 text-black font-black text-[10px] uppercase animate-pulse">
                      🛑 {cityPursuitStats.wantedStars > 0 ? `WANTED ★${cityPursuitStats.wantedStars} PURSUIT` : 'PULL-OVER ORDER'}
                      {cityPursuitStats.playerBeingPulledOver?.timeLeftSec ? ` (${Math.ceil(cityPursuitStats.playerBeingPulledOver.timeLeftSec)}s)` : ''}
                    </span>
                    <span className="text-xs font-black text-white truncate">
                      {cityPursuitStats.playerBeingPulledOver?.reason || 'Police units in pursuit'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-300 mt-1">
                    Slow down below 45 km/h & pull to the side, then press <strong className="text-emerald-300">[Enter]</strong> to accept ticket — police will issue citation and stop chasing!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    physicsRef.current?.complyWithPolicePullOver();
                    if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                  }}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-black font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer shrink-0 animate-pulse"
                >
                  🛑 Pull Over [Enter]
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

          {/* PROXIMITY BANK / JEWELRY STORE ROBBERY PROMPT & LIVE VAULT PROGRESS BAR */}
          {cityPursuitStats.nearbyHeistPrompt && (
            <div className="absolute bottom-24 right-4 md:right-6 z-50 w-[92%] max-w-md pointer-events-auto">
              <div className="bg-zinc-950/95 border-2 border-amber-400 rounded-2xl p-3.5 shadow-[0_0_32px_rgba(250,204,21,0.5)] backdrop-blur-md flex flex-col gap-2 font-mono">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-amber-400 text-black font-black text-[10px] uppercase">
                        {cityPursuitStats.nearbyHeistPrompt.icon} {cityPursuitStats.nearbyHeistPrompt.category} HEIST
                      </span>
                      <span className="text-xs font-black text-white truncate">
                        {cityPursuitStats.nearbyHeistPrompt.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 mt-1">
                      {cityPursuitStats.nearbyHeistPrompt.cooldownLeftSec > 0 ? (
                        <span className="text-rose-400 font-bold">
                          🔒 Vault in Lockdown ({cityPursuitStats.nearbyHeistPrompt.cooldownLeftSec}s left)
                        </span>
                      ) : cityPursuitStats.nearbyHeistPrompt.isRobbingNow ? (
                        <span className="text-amber-300 font-bold animate-pulse">
                          🚨 CRACKING VAULT / SMASHING CASES ({cityPursuitStats.nearbyHeistPrompt.robberyProgressPct}%)... STAY IN RING!
                        </span>
                      ) : (
                        <>
                          Park inside ring or press <strong className="text-amber-300">[R]</strong> to launch the{' '}
                          <strong className="text-cyan-300">Top-Down Heist Shooter</strong> for{' '}
                          <strong className="text-emerald-400">
                            +${cityPursuitStats.nearbyHeistPrompt.payoutCash.toLocaleString()}
                          </strong>{' '}
                          (Destroy all security bots to unlock the vault!)
                        </>
                      )}
                    </p>
                  </div>

                  {cityPursuitStats.nearbyHeistPrompt.cooldownLeftSec <= 0 && (
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
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-black font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer shrink-0"
                    >
                      {cityPursuitStats.nearbyHeistPrompt.isRobbingNow
                        ? '💰 [R] Grab Faster!'
                        : '🎮 [R] Start Heist'}
                    </button>
                  )}
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

          {/* PROXIMITY REAL ESTATE HOUSE / PENTHOUSE BUY, SET HOME, OR ROB PROMPT */}
          {cityPursuitStats.nearbyHousePrompt && !cityPursuitStats.nearbyHeistPrompt && (
            <div className="absolute bottom-24 right-4 md:right-6 z-50 w-[92%] max-w-lg pointer-events-auto">
              <div className="bg-zinc-950/95 border-2 border-emerald-400 rounded-2xl p-3.5 shadow-[0_0_28px_rgba(16,185,129,0.45)] backdrop-blur-md flex items-center justify-between gap-3 font-mono">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-emerald-400 text-black font-black text-[10px] uppercase">
                      {cityPursuitStats.nearbyHousePrompt.icon}{' '}
                      {cityPursuitStats.nearbyHousePrompt.isOwned ? 'OWNED PROPERTY' : 'FOR SALE / ROBBABLE'}
                    </span>
                    <span className="text-xs font-black text-white truncate">
                      {cityPursuitStats.nearbyHousePrompt.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-300 mt-1">
                    {cityPursuitStats.nearbyHousePrompt.isOwned ? (
                      <>
                        Generating <strong className="text-emerald-400">+${Math.round(cityPursuitStats.nearbyHousePrompt.passiveIncomePerMin / 2).toLocaleString()} / 30s</strong> passive income!
                      </>
                    ) : (
                      <>
                        Buy <strong className="text-amber-300">${cityPursuitStats.nearbyHousePrompt.price.toLocaleString()}</strong> · Rent{' '}
                        <strong className="text-emerald-400">
                          +${Math.round(cityPursuitStats.nearbyHousePrompt.passiveIncomePerMin / 2).toLocaleString()}/30s
                        </strong>
                        {!cityPursuitStats.isPoliceOnDuty && (
                          <>
                            {' '}· Or <strong className="text-rose-400">[R] Rob +${(cityPursuitStats.nearbyHousePrompt.robPayoutCash / 1000).toFixed(1)}k</strong>
                          </>
                        )}
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
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
                        : `🏠 [R] Rob ($${(cityPursuitStats.nearbyHousePrompt.robPayoutCash / 1000).toFixed(1)}k)`}
                    </button>
                  )}

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
                </div>
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

                  {/* Interactive Weather Check & Test Controls */}
                  {showWeatherSelector && (
                    <div className="mt-2 pt-2 border-t border-white/15 flex flex-col gap-1.5 text-[9px]">
                      <div className="grid grid-cols-3 gap-1 text-zinc-300 bg-black/50 p-1.5 rounded-lg border border-white/5">
                        <span>💨 {safeWind} km/h</span>
                        <span>💧 {safeHumidity}% RH</span>
                        <span>☁️ {safeCloud}% Cld</span>
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

            {/* Mid Row: Turn Signals, Hazards, Horn & Police Siren */}
            <div className="grid grid-cols-4 gap-1.5 font-mono text-[9px]">
              <button
                type="button"
                onClick={() => {
                  physicsRef.current?.toggleTurnSignal('left');
                  if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                }}
                className={`py-1.5 px-1 rounded-lg border font-black cursor-pointer transition-all flex items-center justify-center gap-1 ${
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
                <span>[Q] Left</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  physicsRef.current?.toggleTurnSignal('hazards');
                  if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                }}
                className={`py-1.5 px-1 rounded-lg border font-black cursor-pointer transition-all flex items-center justify-center gap-1 ${
                  cityPursuitStats.turnSignal === 'hazards' && cityPursuitStats.blinkerFlashOn
                    ? 'bg-amber-400 text-black border-amber-200 shadow-[0_0_10px_#facc15]'
                    : cityPursuitStats.turnSignal === 'hazards'
                    ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                    : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                }`}
                title="Toggle Hazard Lights [X / Z]"
              >
                <span>⚠️</span>
                <span>[X] Haz</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  physicsRef.current?.toggleTurnSignal('right');
                  if (physicsRef.current) setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                }}
                className={`py-1.5 px-1 rounded-lg border font-black cursor-pointer transition-all flex items-center justify-center gap-1 ${
                  (cityPursuitStats.turnSignal === 'right' || cityPursuitStats.turnSignal === 'hazards') &&
                  cityPursuitStats.blinkerFlashOn
                    ? 'bg-emerald-500 text-black border-emerald-300 shadow-[0_0_10px_#10b981]'
                    : cityPursuitStats.turnSignal === 'right'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                    : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                }`}
                title="Toggle Right Turn Signal [E / ]]"
              >
                <span>[E] Right</span>
                <span>➡</span>
              </button>

              <button
                type="button"
                onClick={() => physicsRef.current?.honkCityHorn()}
                className="py-1.5 px-1 rounded-lg border border-white/10 bg-zinc-900 hover:bg-sky-500 hover:text-black text-sky-300 font-black cursor-pointer transition-all flex items-center justify-center gap-1"
                title="Honk Car Horn [H]"
              >
                <span>📯</span>
                <span>[H] Horn</span>
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

          {/* OVERHAULED ZOOMABLE FOLLOW-PLAYER RADAR MINIMAP & TURN-BY-TURN GPS NAVIGATOR */}
          {cityPursuitStats.minimapData && !isMinimapHidden && (() => {
            const mm = cityPursuitStats.minimapData;
            const vbW = minimapZoom === 'local' ? 850 : minimapZoom === 'metro' ? 2040 : 5350;
            const vbH = minimapZoom === 'local' ? 500 : minimapZoom === 'metro' ? 1200 : 3150;
            const vbX = minimapZoom === 'state' ? -2650 : mm.playerX - vbW * 0.5;
            const vbZ = minimapZoom === 'state' ? -1050 : mm.playerZ - vbH * 0.5;
            const zs = vbW / 5350;
            const labelZoomScale = minimapZoom === 'local' ? 0.24 : minimapZoom === 'metro' ? 0.48 : 1.0;

            return (
            <div
              className={`absolute bottom-3.5 right-3.5 md:right-5 z-30 bg-zinc-950/95 border-2 border-white/20 rounded-2xl p-2.5 shadow-[0_0_28px_rgba(0,0,0,0.85)] backdrop-blur-md flex flex-col gap-1.5 pointer-events-auto font-mono transition-all duration-200 ${
                isTacticalMapExpanded ? 'w-[340px] sm:w-[400px]' : 'w-[244px] sm:w-[276px]'
              }`}
            >
              {/* Top GPS Turn-by-Turn Instruction Header + Local/Metro/State Zoom Toggle */}
              <div className="flex items-center justify-between gap-1.5 bg-zinc-900/95 border border-white/10 rounded-xl px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-purple-400 truncate">
                      {mm.gpsTarget
                        ? mm.gpsTarget.turnInstruction
                        : '📡 MARYLAND GPS RADAR'}
                    </span>
                    {mm.gpsTarget && (
                      <span className="text-[10px] font-black text-emerald-300 tabular-nums shrink-0">
                        {mm.gpsTarget.distMeters}m
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] text-zinc-400 truncate mt-0.5">
                    {mm.gpsTarget
                      ? `📍 ${mm.gpsTarget.label}`
                      : `📍 ${cityPursuitStats.nearestStreetName}`}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setMinimapZoom((prev) =>
                        prev === 'local' ? 'metro' : prev === 'metro' ? 'state' : 'local'
                      )
                    }
                    className="px-1.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-400/40 text-[9px] font-black cursor-pointer transition-colors"
                    title="Cycle Radar Zoom: Local (Follow Player) / Metro / State"
                  >
                    {minimapZoom === 'local' ? '⌖ Local' : minimapZoom === 'metro' ? '⌖ Metro' : '🗺 State'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTacticalMapExpanded((prev) => !prev)}
                    className="px-1.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sky-300 border border-sky-400/30 text-[9px] font-black cursor-pointer transition-colors"
                    title="Toggle between Compact Radar and Large Tactical Map"
                  >
                    {isTacticalMapExpanded ? '🔍 Norm' : '🔍 Tac'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMinimapHidden(true)}
                    className="px-1.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-white/10 text-[9px] font-black cursor-pointer transition-colors"
                    title="Hide Minimap ([N] to toggle)"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Typeable Maryland Address / Street / Landmark GPS Search Bar */}
              <div className="relative">
                <div className="flex items-center gap-1 bg-zinc-900/95 border border-purple-400/35 focus-within:border-purple-400 rounded-xl px-2 py-1">
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
                    placeholder="Type MD address, street, or target..."
                    className="w-full min-w-0 bg-transparent text-[10px] text-white placeholder:text-zinc-500 focus:outline-none"
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
                    className="px-1.5 py-0.5 rounded-md bg-purple-500 hover:bg-purple-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-[9px] font-black uppercase cursor-pointer shrink-0"
                  >
                    GO
                  </button>
                </div>

                {gpsDropdownOpen && (
                  <div className="absolute left-0 right-0 bottom-full mb-1.5 max-h-48 overflow-y-auto bg-zinc-950/98 border border-purple-400/50 rounded-xl shadow-[0_0_24px_rgba(0,0,0,0.9)] z-50 divide-y divide-white/10">
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
                          className="w-full text-left px-2.5 py-1.5 hover:bg-purple-500/20 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-bold text-white truncate">
                              {entry.icon} {entry.label}
                            </div>
                            <div className="text-[9px] text-zinc-400 truncate">
                              {entry.address}
                            </div>
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[8px] font-black text-purple-300 uppercase shrink-0">
                            {entry.category}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Interactive Follow-Player / Statewide Maryland Google-Maps Minimap */}
              <div className="relative w-full aspect-[17/10] bg-zinc-950 rounded-xl overflow-hidden border border-white/15">
                <svg
                  viewBox={`${vbX} ${vbZ} ${vbW} ${vbH}`}
                  className="w-full h-full cursor-crosshair select-none"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const normX = (e.clientX - rect.left) / rect.width;
                    const normZ = (e.clientY - rect.top) / rect.height;
                    const worldX = Math.round(vbX + normX * vbW);
                    const worldZ = Math.round(vbZ + normZ * vbH);
                    physicsRef.current?.setCityGpsTarget(worldX, worldZ, 'CUSTOM GPS PIN', '#a855f7');
                    if (physicsRef.current) {
                      setCityPursuitStats({ ...physicsRef.current.cityPursuitStats });
                    }
                  }}
                >
                  {/* Statewide Ocean & Chesapeake Backdrop */}
                  <rect x="-4000" y="-2500" width="8500" height="6500" fill="#091318" />

                  {/* Western Garrett & Allegany Mountain Terrain */}
                  <rect x="-2650" y="-1050" width="1200" height="1250" fill="#0e1e15" opacity="0.82" />
                  {/* Piedmont & Central Maryland Terrain (Frederick -> Gaithersburg -> Baltimore -> DC) */}
                  <rect x="-1450" y="-1050" width="3050" height="3150" fill="#0c1c16" opacity="0.72" />

                  {/* Chesapeake Bay Waters & Eastern Shore Landmass */}
                  <polygon
                    points="1520,-1050 2700,-1050 2700,2100 1320,2100 1420,1150 1560,650 1520,120 1400,-160 1580,-420"
                    fill="#064e78"
                    opacity="0.78"
                  />
                  {/* Delmarva / Eastern Shore Mainland */}
                  <polygon
                    points="1960,-1050 2450,-1050 2450,2100 1980,2100 2020,1100 1960,550"
                    fill="#0d1e15"
                    opacity="0.92"
                  />
                  {/* Kent Island at East End of Chesapeake Bay Bridge */}
                  <rect x="1915" y="610" width="150" height="220" rx="22" fill="#0f2419" />
                  {/* Isle of Wight Bay & Ocean City Atlantic Barrier Island */}
                  <rect x="2420" y="-1050" width="52" height="3150" fill="#075985" opacity="0.88" />
                  <rect x="2470" y="700" width="54" height="1050" rx="8" fill="#c2a376" opacity="0.85" />
                  <rect x="2524" y="-1050" width="220" height="3150" fill="#0369a1" opacity="0.9" />

                  {/* Deep Creek Lake, Patapsco River & Potomac River */}
                  <ellipse cx="-2410" cy="-450" rx="95" ry="70" fill="#0284c7" opacity="0.82" />
                  <polyline
                    fill="none"
                    stroke="#0369a1"
                    strokeWidth="44"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.75"
                    points="-2300,-340 -1750,-140 -1220,210 -860,1240 -620,1780 -210,1960 -150,2100"
                  />
                  <polyline
                    fill="none"
                    stroke="#0369a1"
                    strokeWidth="36"
                    strokeLinecap="round"
                    opacity="0.72"
                    points="180,-290 620,-180 1120,-130 1380,-110 1560,-20"
                  />

                  {/* Shifted Gaithersburg Water Features, Fairgrounds & KGAI Airpark */}
                  <rect x={gx(-354)} y={gz(1667)} width="78" height="56" rx="8" fill="#0369a1" opacity="0.82" />
                  <rect x={gx(-651)} y={gz(2262)} width="82" height="56" rx="8" fill="#0369a1" opacity="0.82" />
                  <rect x={gx(-494)} y={gz(2259)} width="118" height="72" rx="10" fill="#0369a1" opacity="0.88" />
                  <ellipse cx={gx(-148)} cy={gz(1875)} rx="42" ry="29" fill="#92400e" opacity="0.58" />
                  <g transform={`translate(${gx(175)}, ${gz(2025)}) rotate(-33.2)`}>
                    <rect x="-11" y="-70" width="22" height="140" fill="#334155" stroke="#94a3b8" strokeWidth="3" />
                  </g>

                  {/* Entire Maryland Google Maps Road Network */}
                  {ALL_MARYLAND_ROADS.map((road) => {
                    const pts = road.points.map((p) => `${p.x},${p.z}`).join(' ');
                    const baseW = road.isHighway
                      ? 32
                      : road.isResidential
                      ? 12
                      : road.width > 26
                      ? 24
                      : 17;
                    const strokeW = Math.max(road.width * 0.85, baseW * (0.45 + 0.55 * zs));
                    return (
                      <React.Fragment key={`md_rd_${road.id}`}>
                        <polyline
                          fill="none"
                          stroke={road.isBridge ? '#94a3b8' : road.isHighway ? '#475569' : '#334155'}
                          strokeWidth={strokeW}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={pts}
                        />
                        {road.isHighway && (
                          <polyline
                            fill="none"
                            stroke="#facc15"
                            strokeWidth={Math.max(2.2, 6 * zs)}
                            strokeDasharray={`${Math.max(8, 24 * zs)} ${Math.max(6, 18 * zs)}`}
                            opacity="0.72"
                            points={pts}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* ICM & Church of the Redeemer Scaled Footprints */}
                  <g transform={`translate(${REDEEMER_CAMPUS_ORIGIN.x}, ${REDEEMER_CAMPUS_ORIGIN.z}) rotate(${(-REDEEMER_CAMPUS_ORIGIN.rotY * 180) / Math.PI})`}>
                    <rect x={97} y={-22} width={58} height={48} rx={4} fill="#b89f80" stroke="#f8fafc" strokeWidth={Math.max(1.5, 4 * zs)} />
                  </g>
                  <g transform={`translate(${ICM_CAMPUS_ORIGIN.x}, ${ICM_CAMPUS_ORIGIN.z}) rotate(${(-ICM_CAMPUS_ORIGIN.rotY * 180) / Math.PI})`}>
                    <rect x={36} y={-3} width={20} height={18} rx={3} fill="#d6c8b2" stroke="#065f46" strokeWidth={Math.max(1.5, 4 * zs)} />
                    <rect x={109} y={-21} width={58} height={54} rx={5} fill="#047857" stroke="#f2ebdc" strokeWidth={Math.max(1.5, 4 * zs)} />
                  </g>

                  {/* Regional City & Landmark Labels */}
                  <text x="-2400" y="-560" fill="#38bdf8" fontSize={64 * labelZoomScale} fontWeight="black" textAnchor="middle">WISP / DEEP CREEK</text>
                  <text x="-2080" y="-610" fill="#cbd5e1" fontSize={56 * labelZoomScale} fontWeight="bold" textAnchor="middle">CUMBERLAND</text>
                  <text x="-1600" y="-550" fill="#cbd5e1" fontSize={56 * labelZoomScale} fontWeight="bold" textAnchor="middle">HAGERSTOWN</text>
                  <text x="-1100" y="-335" fill="#fde047" fontSize={64 * labelZoomScale} fontWeight="black" textAnchor="middle">FREDERICK</text>
                  <text x={MD_LANDMARKS.isbCampus.x} y={MD_LANDMARKS.isbCampus.z - 55 * labelZoomScale} fill="#facc15" fontSize={52 * labelZoomScale} fontWeight="black" textAnchor="middle">ISB</text>
                  <text x={MD_LANDMARKS.baltimoreInnerHarbor.x} y={MD_LANDMARKS.baltimoreInnerHarbor.z - 80 * labelZoomScale} fill="#38bdf8" fontSize={68 * labelZoomScale} fontWeight="black" textAnchor="middle">BALTIMORE</text>
                  <text x={MD_LANDMARKS.bwiAirport.x} y={MD_LANDMARKS.bwiAirport.z + 75 * labelZoomScale} fill="#93c5fd" fontSize={52 * labelZoomScale} fontWeight="bold" textAnchor="middle">BWI</text>
                  <text x={MD_LANDMARKS.annapolisStateHouse.x} y={MD_LANDMARKS.annapolisStateHouse.z - 55 * labelZoomScale} fill="#fbbf24" fontSize={58 * labelZoomScale} fontWeight="black" textAnchor="middle">ANNAPOLIS</text>
                  <text x={MD_LANDMARKS.chesapeakeBayBridgeMid.x} y={MD_LANDMARKS.chesapeakeBayBridgeMid.z - 55 * labelZoomScale} fill="#bae6fd" fontSize={52 * labelZoomScale} fontWeight="bold" textAnchor="middle">BAY BRIDGE</text>
                  <text x={MD_LANDMARKS.oceanCityBoardwalk.x - 160} y={MD_LANDMARKS.oceanCityBoardwalk.z - 55 * labelZoomScale} fill="#38bdf8" fontSize={58 * labelZoomScale} fontWeight="black" textAnchor="middle">OCEAN CITY</text>
                  <text x={gx(356)} y={gz(1845) + 55 * labelZoomScale} fill="#10b981" fontSize={54 * labelZoomScale} fontWeight="black" textAnchor="middle">ICM</text>
                  <text x={gx(595)} y={gz(1455) - 42 * labelZoomScale} fill="#22c55e" fontSize={50 * labelZoomScale} fontWeight="bold" textAnchor="middle">HADLEY FARMS</text>
                  <text x={gx(486)} y={gz(1652) + 28 * labelZoomScale} fill="#4ade80" fontSize={36 * labelZoomScale} fontWeight="bold" textAnchor="middle">EDINBURGH</text>
                  <text x={MD_LANDMARKS.collegeParkUMD.x} y={MD_LANDMARKS.collegeParkUMD.z - 55 * labelZoomScale} fill="#f87171" fontSize={50 * labelZoomScale} fontWeight="black" textAnchor="middle">UMD</text>
                  <text x={MD_LANDMARKS.nationalHarbor.x} y={MD_LANDMARKS.nationalHarbor.z - 55 * labelZoomScale} fill="#a855f7" fontSize={46 * labelZoomScale} fontWeight="bold" textAnchor="middle">NAT HARBOR</text>

                  {/* Turn-by-Turn GPS Route Polyline */}
                  {mm.gpsRoute.length >= 2 && (
                    <>
                      <polyline
                        fill="none"
                        stroke={mm.gpsTarget?.color || '#a855f7'}
                        strokeWidth={Math.max(10, 52 * zs)}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.35"
                        points={mm.gpsRoute.map((pt) => `${pt.x},${pt.z}`).join(' ')}
                      />
                      <polyline
                        fill="none"
                        stroke={mm.gpsTarget?.color || '#a855f7'}
                        strokeWidth={Math.max(5, 26 * zs)}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={mm.gpsRoute.map((pt) => `${pt.x},${pt.z}`).join(' ')}
                      />
                    </>
                  )}

                  {/* Baltimore Police HQ Marker */}
                  <g transform={`translate(${MD_LANDMARKS.baltimorePoliceHQ.x}, ${MD_LANDMARKS.baltimorePoliceHQ.z}) scale(${Math.max(0.28, zs)})`}>
                    <circle cx={0} cy={0} r={42} fill="#2563eb" stroke="#ffffff" strokeWidth="8" />
                    <text x={0} y={12} fill="#ffffff" fontSize="34" fontWeight="bold" textAnchor="middle">PD</text>
                  </g>

                  {/* Baltimore Reserve Bank Marker */}
                  <g transform={`translate(${MD_LANDMARKS.baltimoreBank.x}, ${MD_LANDMARKS.baltimoreBank.z}) scale(${Math.max(0.28, zs)})`}>
                    <circle cx={0} cy={0} r={42} fill="#eab308" stroke="#000000" strokeWidth="8" />
                    <text x={0} y={13} fill="#000000" fontSize="34" fontWeight="black" textAnchor="middle">$</text>
                  </g>

                  {/* Baltimore Dealership Marker */}
                  <g transform={`translate(${MD_LANDMARKS.baltimoreDealership.x}, ${MD_LANDMARKS.baltimoreDealership.z}) scale(${Math.max(0.28, zs)})`}>
                    <circle cx={0} cy={0} r={36} fill="#ec4899" stroke="#ffffff" strokeWidth="7" />
                    <text x={0} y={10} fill="#ffffff" fontSize="26" fontWeight="bold" textAnchor="middle">CAR</text>
                  </g>

                  {/* Banks & Jewelry Store Heist Blips */}
                  {CITY_HEIST_TARGETS_CATALOG.map((h) => (
                    <circle
                      key={`mm_heist_${h.id}`}
                      cx={h.x}
                      cy={h.z}
                      r={Math.max(7, 30 * zs)}
                      fill={h.badgeColor}
                      stroke="#000"
                      strokeWidth={Math.max(2, 8 * zs)}
                    />
                  ))}

                  {/* Buyable Houses & Safehouses Blips */}
                  {CITY_HOUSES_CATALOG.map((house) => {
                    const isOwned = cityPursuitStats.ownedHouseIds.includes(house.id);
                    const sz = Math.max(10, 52 * zs);
                    return (
                      <rect
                        key={`mm_house_${house.id}`}
                        x={house.x - sz * 0.5}
                        y={house.z - sz * 0.5}
                        width={sz}
                        height={sz}
                        rx={Math.max(2, 10 * zs)}
                        fill={isOwned ? '#10b981' : '#64748b'}
                        stroke="#000"
                        strokeWidth={Math.max(1.5, 7 * zs)}
                      />
                    );
                  })}

                  {/* Active Safehouse Highlight Ring */}
                  <circle
                    cx={mm.activeHome.x}
                    cy={mm.activeHome.z}
                    r={Math.max(12, 54 * zs)}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={Math.max(2.5, 12 * zs)}
                    strokeDasharray={`${Math.max(4, 20 * zs)} ${Math.max(3, 14 * zs)}`}
                  />

                  {/* Civilian Traffic Blips */}
                  {mm.civs.map((c, idx) => (
                    <circle
                      key={`mm_civ_${idx}`}
                      cx={c.x}
                      cy={c.z}
                      r={Math.max(4, 16 * zs)}
                      fill="#94a3b8"
                      opacity="0.82"
                    />
                  ))}

                  {/* Maryland State & Local Police Interceptor Blips + Vision Cones */}
                  {mm.cops.map((cop, idx) => {
                    const deg = (-cop.heading * 180) / Math.PI;
                    const copScale = Math.max(0.28, zs);
                    return (
                      <g
                        key={`mm_cop_${idx}`}
                        transform={`translate(${cop.x}, ${cop.z}) rotate(${deg})`}
                      >
                        {cop.isChasing && (
                          <polygon
                            points="0,0 -90,-220 90,-220"
                            fill={cop.canSeePlayer ? 'rgba(239,68,68,0.42)' : 'rgba(56,189,248,0.25)'}
                          />
                        )}
                        <circle
                          cx={0}
                          cy={0}
                          r={30 * copScale}
                          fill={cop.canSeePlayer ? '#ef4444' : '#38bdf8'}
                          stroke="#ffffff"
                          strokeWidth={8 * copScale}
                        />
                      </g>
                    );
                  })}

                  {/* Active GPS Destination Target Bullseye */}
                  {mm.gpsTarget && (
                    <g transform={`translate(${mm.gpsTarget.x}, ${mm.gpsTarget.z}) scale(${Math.max(0.26, zs)})`}>
                      <circle
                        cx={0}
                        cy={0}
                        r={60}
                        fill="none"
                        stroke={mm.gpsTarget.color}
                        strokeWidth="14"
                      />
                      <circle
                        cx={0}
                        cy={0}
                        r={24}
                        fill={mm.gpsTarget.color}
                      />
                    </g>
                  )}

                  {/* Player Vehicle Arrow */}
                  <g
                    transform={`translate(${mm.playerX}, ${mm.playerZ}) rotate(${
                      (-mm.playerHeading * 180) / Math.PI
                    }) scale(${Math.max(0.24, zs)})`}
                  >
                    <polygon
                      points="0,-68 -46,48 0,24 46,48"
                      fill="#facc15"
                      stroke="#000000"
                      strokeWidth="12"
                    />
                  </g>
                </svg>

                {/* Compass North Badge */}
                <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 border border-white/15 text-[8px] font-black text-amber-400 pointer-events-none">
                  N ↑
                </span>
              </div>

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

          {/* DEDICATED METRO CITY TABLET / OS MODAL ([TAB / M / G]) — CLEAN, ORGANIZED CAREERS & ACTIVITIES */}
          {(showCityTabletModal || showCityGarageModal) && (
            <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 pointer-events-auto">
              <div className="bg-zinc-950 border-2 border-sky-500/50 max-w-5xl w-full max-h-[90vh] rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 overflow-hidden font-mono">
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
                                <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-400/40 text-rose-300 font-black text-[10px]">
                                  +${target.payoutCash.toLocaleString()}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{target.description}</p>
                              <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-400">
                                <span>Risk: {'★'.repeat(target.wantedStarsTriggered)}</span>
                                <span>·</span>
                                <span>{cd > 0 ? `🔒 Lockdown ${cd}s` : `Crack time: ${target.robDurationSec}s`}</span>
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
          )}
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

      {/* TOP-DOWN RETRO BANK HEIST MINIGAME OVERLAY */}
      {isCityDrivingMode && cityPursuitStats?.activeBankMinigameTarget && (
        <BankHeistMinigame
          target={cityPursuitStats.activeBankMinigameTarget}
          onSuccess={() => {
            const targetId = cityPursuitStats.activeBankMinigameTarget?.id;
            if (targetId && physicsRef.current) {
              physicsRef.current.completeBankHeistMinigameWin(targetId);
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
    </div>
  );
};
