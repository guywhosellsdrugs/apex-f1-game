import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CircuitInfo, CameraView, SeasonState, Driver, Team } from '../types/racing';
import { DRIVERS, TEAMS } from '../constants/f1Data';
import { buildF1Car } from '../game/carBuilder';
import { generateTrack } from '../game/trackGenerator';
import { buildPracticeRacingLine, PracticeLineCoachData, BuiltRacingLine } from '../game/racingLineBuilder';
import { PhysicsEngine } from '../game/physicsEngine';
import { inputManager } from '../services/inputManager';
import { soundEngine } from '../services/soundEngine';
import { BroadcastHUD } from './BroadcastHUD';
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
} from '../utils/graphicsSettings';

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
    }[]
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const physicsRef = useRef<PhysicsEngine | null>(null);

  const [cameraView, setCameraView] = useState<CameraView>('chase');
  const [telemetry, setTelemetry] = useState<any>(null);
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

  useEffect(() => {
    return onGraphicsQualityChange((q) => setGraphicsQuality(q));
  }, []);

  // Strictly Practice Mode Only: Optimal Racing Line & Braking/Acceleration Assist + Live Bot Removal
  const isStrictPracticeMode = Boolean(isPracticeMode && !isQualifyingMode && !isMultiplayer);
  const [showPracticeRacingLine, setShowPracticeRacingLine] = useState<boolean>(isStrictPracticeMode);
  const [practiceLineCoach, setPracticeLineCoach] = useState<PracticeLineCoachData | null>(null);
  const [activePracticeBots, setActivePracticeBots] = useState<number>(practiceBotCount ?? 19);
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

    const gfxPreset = getGraphicsPresetConfig(graphicsQuality);

    // 1. Scene, Camera, Renderer configured by GraphicsQuality preset
    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(circuit.skyColor);

    const camera = new THREE.PerspectiveCamera(66, width / height, 0.1, gfxPreset.id === 'low' ? 1400 : 2400);

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

    let composer: EffectComposer | null = null;
    let planarReflectionRT: THREE.WebGLRenderTarget | null = null;
    let reflectionCamera: THREE.PerspectiveCamera | null = null;

    if (gfxPreset.id === 'ultra' || gfxPreset.id === 'high') {
      const reflScale = gfxPreset.id === 'ultra' ? 0.75 : 0.5;
      planarReflectionRT = new THREE.WebGLRenderTarget(
        Math.max(256, Math.floor(width * reflScale)),
        Math.max(256, Math.floor(height * reflScale)),
        {
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          colorSpace: THREE.SRGBColorSpace,
        }
      );
      reflectionCamera = new THREE.PerspectiveCamera(camera.fov, width / height, 0.1, 1800);
      track.setReflectionTexture(planarReflectionRT.texture, gfxPreset.id === 'ultra' ? 0.24 : 0.15);
    }
    const reflectionBgColor = new THREE.Color(0x000000);

    // Only allocate 4x MSAA HalfFloat Post-Processing Composer in Ultra mode (pure crystal-clear HDR bloom with zero dark lens vignette!)
    if (gfxPreset.id === 'ultra') {
      const pixelRatio = renderer.getPixelRatio();
      const rt = new THREE.WebGLRenderTarget(width * pixelRatio, height * pixelRatio, {
        samples: 4,
        type: THREE.HalfFloatType,
      });
      composer = new EffectComposer(renderer, rt);
      composer.setSize(width, height);
      composer.setPixelRatio(pixelRatio);

      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.22, // clean specular bloom on sunlit bodywork & red brake lights without darkening the screen
        0.45,
        0.88
      );
      composer.addPass(bloomPass);

      const outputPass = new OutputPass();
      composer.addPass(outputPass);
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
    const effectiveBotCount = (isMultiplayer && multiplayerRoom)
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
        hasTeammates: isMultiplayer && multiplayerRoom ? (effectiveBotCount === 0 ? false : multiplayerRoom.hasTeammates) : true,
        playerGridSlot: isQualifyingMode ? 1 : startingGridSlot,
        isQualifyingMode: Boolean(isQualifyingMode),
        qualifyingGhostDelay3s: Boolean(qualifyingGhostDelay3s),
      }
    );
    if (isStrictPracticeMode) {
      physics.setPracticeBotCount(practiceBotCount ?? 19);
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
      if (track.sceneryGroup && track.sceneryGroup.visible !== showOuterScenery) {
        track.sceneryGroup.visible = showOuterScenery;
      }

      const showSkyAndFog = isAggressiveDynamic ? clampedQ >= 0.14 : clampedQ >= 0.32;
      if (skyDomeMesh && skyDomeMesh.visible !== showSkyAndFog) {
        skyDomeMesh.visible = showSkyAndFog;
      }
      scene.fog = showSkyAndFog ? activeSceneFog : null;

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
      const targetFar = showOuterScenery
        ? Math.round(900 + clampedQ * 1150)
        : isConservativeDynamic && clampedQ < 0.30
        ? Math.round(340 + clampedQ * 500)
        : Math.round(480 + clampedQ * 650);
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

    const renderLoop = (time: number) => {
      animFrameId = requestAnimationFrame(renderLoop);
      frameCount++;
      fpsSampleFrames++;

      const rawDelta = (time - lastTime) / 1000;
      lastTime = time;
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
          const extrapolated = rival.targetPos.clone();

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
        setCameraView((prev) => {
          const views: CameraView[] = ['chase', 'close', 'cockpit', 'nose'];
          return views[(views.indexOf(prev) + 1) % views.length];
        });
      }

      // Teammate strategy order controls (1: Block Pack, 2: Yield Position, 3: Push, 4: Free)
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

      // Dynamic Following Shadow Light & Real-Time Reflections
      const carPos = physics.playerPos;
      const heading = physics.playerHeading;
      const speed = physics.playerSpeedKmh;

      sunLight.position.set(carPos.x + 42, carPos.y + 76, carPos.z + 32);
      sunLight.target.position.copy(carPos);
      sunLight.target.updateMatrixWorld();

      if (rimLight) {
        rimLight.position.set(carPos.x - 40, carPos.y + 38, carPos.z - 42);
        rimLight.target.position.copy(carPos);
        rimLight.target.updateMatrixWorld();
      }

      // Dynamic FOV for speed sensation
      camera.fov = 65 + (Math.abs(speed) / 360) * 12;
      camera.updateProjectionMatrix();

      // Camera Positioning with dynamic corner-apex look-to-steer & crest sightline compensation
      const forward = new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading));
      const up = new THREE.Vector3(0, 1, 0);

      // Multi-point lookahead along track curve so tight corners & crests are 100% visible (Zero Blind Corners!)
      const nowSample = physics.track.getTrackPointAtProgress(physics.playerProgress);
      const nearAheadSample = physics.track.getTrackPointAtProgress((physics.playerProgress + 0.015) % 1.0);
      const farAheadSample = physics.track.getTrackPointAtProgress((physics.playerProgress + 0.028) % 1.0);
      const trackAhead = nearAheadSample.position.clone().lerp(farAheadSample.position, 0.45);

      // Measure upcoming corner curvature to dynamically increase apex look-in
      const cornerDot = THREE.MathUtils.clamp(nowSample.tangent.dot(farAheadSample.tangent), -1, 1);
      const cornerIntensity = Math.min(1.0, Math.acos(cornerDot) / 0.55);

      let targetCamPos = new THREE.Vector3();
      let targetLook = new THREE.Vector3();

      const activeView = cameraViewRef.current;
      if (activeView === 'chase') {
        const camLift = 2.65 + cornerIntensity * 0.35;
        targetCamPos = carPos.clone().addScaledVector(forward, -7.2).addScaledVector(up, camLift);
        targetLook = carPos
          .clone()
          .addScaledVector(forward, 16.0)
          .lerp(trackAhead, 0.48 + cornerIntensity * 0.24)
          .addScaledVector(up, 0.9);
      } else if (activeView === 'close') {
        const camLift = 1.85 + cornerIntensity * 0.25;
        targetCamPos = carPos.clone().addScaledVector(forward, -4.5).addScaledVector(up, camLift);
        targetLook = carPos
          .clone()
          .addScaledVector(forward, 20.0)
          .lerp(trackAhead, 0.42 + cornerIntensity * 0.24)
          .addScaledVector(up, 0.78);
      } else if (activeView === 'cockpit') {
        targetCamPos = carPos.clone().addScaledVector(up, 0.84).addScaledVector(forward, -0.05);
        targetLook = carPos
          .clone()
          .addScaledVector(forward, 26.0)
          .lerp(trackAhead, 0.38 + cornerIntensity * 0.22)
          .addScaledVector(up, 0.72);
      } else if (activeView === 'nose') {
        targetCamPos = carPos.clone().addScaledVector(forward, 2.3).addScaledVector(up, 0.42);
        targetLook = carPos
          .clone()
          .addScaledVector(forward, 30.0)
          .lerp(trackAhead, 0.35 + cornerIntensity * 0.22)
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

      if (composer && gfxPreset.id === 'ultra') {
        composer.render(delta);
      } else {
        renderer.render(scene, camera);
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

      if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') {
        physicsRef.current?.issueTeamOrder('block');
      } else if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') {
        physicsRef.current?.issueTeamOrder('yield');
      } else if (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3') {
        physicsRef.current?.issueTeamOrder('push');
      } else if (e.key === '4' || e.code === 'Digit4' || e.code === 'Numpad4') {
        physicsRef.current?.issueTeamOrder('neutral');
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
  }, [circuit.id, laps, season.selectedTeamId, season.selectedDriverId, season.difficulty, isMultiplayer, multiplayerRoom?.code, graphicsQuality]);

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

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-black">
      <div ref={containerRef} className="w-full h-full cursor-none" />

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
          onIssueTeamOrder={handleIssueTeamOrder}
          onOpenControls={onOpenControls}
          showPracticeRacingLine={isStrictPracticeMode ? showPracticeRacingLine : false}
          onTogglePracticeRacingLine={
            isStrictPracticeMode ? () => setShowPracticeRacingLine((prev) => !prev) : undefined
          }
          practiceLineCoach={isStrictPracticeMode && showPracticeRacingLine ? practiceLineCoach : null}
          practiceBotCount={isStrictPracticeMode ? activePracticeBots : undefined}
          onSetPracticeBotCount={isStrictPracticeMode ? handleSetPracticeBotCount : undefined}
          onPitStop={(comp) => physicsRef.current?.requestPitStop(comp)}
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

      {/* Top-Right Unified Performance, Graphics & Exit Dock */}
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

        <button
          onClick={onExitToPaddock}
          className="px-3 py-1.5 bg-zinc-950/85 hover:bg-red-600 text-zinc-200 hover:text-white text-xs font-semibold rounded-lg border border-white/10 hover:border-red-500 backdrop-blur-md transition-colors cursor-pointer shadow-xl whitespace-nowrap"
        >
          Exit Race
        </button>
      </div>
    </div>
  );
};
