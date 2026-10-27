import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
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
  startingGridSlot?: number;
  onQualifyingComplete?: (
    gridSlot: number,
    lapTime: number,
    classification: Array<{ position: number; driver: Driver; team: Team; lapTime: number; gap: number }>
  ) => void;
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
  startingGridSlot,
  onQualifyingComplete,
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
    Math.round(getStoredDynamicGpuProfile().qualityScore * 100)
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
      powerPreference: gfxPreset.id === 'low' ? 'low-power' : 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, gfxPreset.maxPixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = gfxPreset.shadowsEnabled;
    if (gfxPreset.shadowsEnabled) {
      renderer.shadowMap.type = gfxPreset.useSoftShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure =
      circuit.id === 'abudhabi' ? 1.25 : gfxPreset.id === 'ultra' ? 1.18 : 1.15;

    // Studio & Outdoor Sky/Sun + Live 3D Scene PMREM Environment Reflection Probe
    let pmremGenerator: THREE.PMREMGenerator | null = null;
    let activePmremTarget: THREE.WebGLRenderTarget | null = null;
    if (gfxPreset.useEnvironmentReflections) {
      pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();
      pmremGenerator.compileCubemapShader();

      // Initial fallback sky/sun reflection probe before the first CubeCamera frame renders
      const envCanvas = document.createElement('canvas');
      envCanvas.width = 512;
      envCanvas.height = 256;
      const eCtx = envCanvas.getContext('2d');
      if (eCtx) {
        const eGrad = eCtx.createLinearGradient(0, 0, 0, 256);
        if (circuit.id === 'abudhabi') {
          eGrad.addColorStop(0, '#0f0728');
          eGrad.addColorStop(0.35, '#881337');
          eGrad.addColorStop(0.48, '#f59e0b');
          eGrad.addColorStop(0.51, '#18181b');
          eGrad.addColorStop(1.0, '#090a0f');
        } else if (circuit.id === 'bahrain' || circuit.id === 'jeddah') {
          eGrad.addColorStop(0, '#030712');
          eGrad.addColorStop(0.45, '#1e293b');
          eGrad.addColorStop(0.5, '#f8fafc');
          eGrad.addColorStop(0.53, '#111827');
          eGrad.addColorStop(1.0, '#05070b');
        } else {
          eGrad.addColorStop(0, '#0284c7');
          eGrad.addColorStop(0.36, '#7dd3fc');
          eGrad.addColorStop(0.49, '#ffffff');
          eGrad.addColorStop(0.52, '#1e293b');
          eGrad.addColorStop(1.0, '#0f172a');
        }
        eCtx.fillStyle = eGrad;
        eCtx.fillRect(0, 0, 512, 256);

        const sunGrad = eCtx.createRadialGradient(360, 72, 2, 360, 72, 48);
        sunGrad.addColorStop(0, '#ffffff');
        sunGrad.addColorStop(0.3, '#fef08a');
        sunGrad.addColorStop(1, 'rgba(255,255,255,0)');
        eCtx.fillStyle = sunGrad;
        eCtx.fillRect(300, 16, 120, 120);

        const eqTex = new THREE.CanvasTexture(envCanvas);
        eqTex.mapping = THREE.EquirectangularReflectionMapping;
        eqTex.colorSpace = THREE.SRGBColorSpace;
        activePmremTarget = pmremGenerator.fromEquirectangular(eqTex);
        scene.environment = activePmremTarget.texture;
        eqTex.dispose();
      } else {
        activePmremTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.025);
        scene.environment = activePmremTarget.texture;
      }
    }

    containerRef.current.appendChild(renderer.domElement);

    // Dynamic High-Fidelity Circuit Sky Dome
    const skyRadius = 1900;
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 1024;
    skyCanvas.height = 1024;
    const sCtx = skyCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createLinearGradient(0, 0, 0, 1024);
      if (circuit.id === 'abudhabi') {
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
      sCtx.fillRect(0, 0, 1024, 1024);

      // Stars for twilight & night circuits
      if (circuit.timeOfDay === 'twilight' || circuit.id === 'abudhabi' || circuit.id === 'bahrain' || circuit.id === 'jeddah') {
        sCtx.fillStyle = '#ffffff';
        for (let s = 0; s < 280; s++) {
          const sx = Math.random() * 1024;
          const sy = Math.random() * 640;
          const sr = Math.random() * 1.6 + 0.4;
          sCtx.beginPath();
          sCtx.arc(sx, sy, sr, 0, Math.PI * 2);
          sCtx.fill();
        }
      }

      const skyTex = new THREE.CanvasTexture(skyCanvas);
      skyTex.colorSpace = THREE.SRGBColorSpace;
      const skyGeom = new THREE.SphereGeometry(skyRadius, 48, 32);
      const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide });
      const skyMesh = new THREE.Mesh(skyGeom, skyMat);
      scene.add(skyMesh);
    }

    let fogDensity = 0.0014;
    let hemiSky = 0xdbeafe;
    let hemiGround = 0x1e293b;
    let sunColor = 0xfffbeb;
    let sunIntensity = 1.85;

    if (circuit.id === 'abudhabi') {
      hemiSky = 0x38bdf8;
      hemiGround = 0x451a03;
      sunColor = 0xff9e54; // Warm sunset gold
      sunIntensity = 2.2;
      fogDensity = 0.0010;
    } else if (circuit.id === 'monaco') {
      hemiSky = 0xbae6fd;
      hemiGround = 0x0369a1;
      sunColor = 0xffffff;
      sunIntensity = 2.25;
      fogDensity = 0.0008;
    } else if (circuit.id === 'spa') {
      hemiSky = 0x94a3b8;
      hemiGround = 0x14532d;
      sunColor = 0xfef08a;
      sunIntensity = 1.65;
      fogDensity = 0.0020;
    } else if (circuit.id === 'monza') {
      hemiSky = 0x7dd3fc;
      hemiGround = 0x14532d;
      sunColor = 0xffedd5;
      sunIntensity = 2.0;
    }

    const activeSceneFog = new THREE.FogExp2(circuit.fogColor, fogDensity);
    scene.fog = activeSceneFog;

    const hemiLight = new THREE.HemisphereLight(hemiSky, hemiGround, 0.95);
    scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, Math.max(0.68, circuit.ambientLight * 0.82));
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(sunColor, sunIntensity);
    sunLight.castShadow = gfxPreset.shadowsEnabled;
    if (gfxPreset.shadowsEnabled) {
      sunLight.shadow.mapSize.width = gfxPreset.shadowMapSize;
      sunLight.shadow.mapSize.height = gfxPreset.shadowMapSize;
      sunLight.shadow.bias = -0.00025;
      sunLight.shadow.normalBias = 0.018;
      sunLight.shadow.radius = gfxPreset.id === 'ultra' ? 2.2 : 1.5;
      const shadowSpan = gfxPreset.id === 'ultra' ? 32 : 38;
      sunLight.shadow.camera.left = -shadowSpan;
      sunLight.shadow.camera.right = shadowSpan;
      sunLight.shadow.camera.top = shadowSpan;
      sunLight.shadow.camera.bottom = -shadowSpan;
      sunLight.shadow.camera.near = 8;
      sunLight.shadow.camera.far = 185;
    }
    scene.add(sunLight);
    scene.add(sunLight.target);

    // 3-Point Rim & Specular Fill Directional Light for High / Ultra Realistic presets
    let rimLight: THREE.DirectionalLight | null = null;
    if (gfxPreset.enableRimAndFillLights) {
      rimLight = new THREE.DirectionalLight(
        circuit.id === 'abudhabi' ? 0x38bdf8 : 0xe0f2fe,
        gfxPreset.id === 'ultra' ? 1.15 : 0.75
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

    // 5b. Real-Time 360° Dynamic CubeCamera + PMREM Reflection Probe (Medium, High & Ultra) & Post-Processing (Ultra)
    // Calibrated so all modes run smoothly on 60Hz monitors while reflecting real 3D trees, buildings, bridges, curbs, barriers & rival cars!
    let cubeRenderTarget: THREE.WebGLCubeRenderTarget | null = null;
    let carCubeCamera: THREE.CubeCamera | null = null;
    let composer: EffectComposer | null = null;
    let broadcastLensPass: ShaderPass | null = null;

    if (gfxPreset.useEnvironmentReflections) {
      // Dynamic uses a fast 128x128 cubemap so live 360° reflections never lag the GPU
      const cubeRes =
        gfxPreset.id === 'ultra' ? 256 : gfxPreset.id === 'high' ? 192 : 128;
      cubeRenderTarget = new THREE.WebGLCubeRenderTarget(cubeRes, {
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
        colorSpace: THREE.SRGBColorSpace,
      });
      // near=0.15 captures adjacent curbs, barriers & rival cars; far=2600 captures the full 1900m sky dome, clouds, bridges & skyscrapers!
      carCubeCamera = new THREE.CubeCamera(0.15, 2600, cubeRenderTarget);
      scene.add(carCubeCamera);
    }

    // Only allocate heavy 4x MSAA HalfFloat Post-Processing Composer in Ultra mode (keeps Dynamic race start 100% lag-free and sharp!)
    if (gfxPreset.id === 'ultra') {
      // Multi-sampled HDR Post-Processing Composer (RenderPass -> UnrealBloomPass -> Broadcast Lens ShaderPass -> OutputPass)
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
        0.32, // subtle broadcast HDR bloom on sunlit specular edges & red brake lights
        0.55,
        0.86
      );
      composer.addPass(bloomPass);

      broadcastLensPass = new ShaderPass({
        uniforms: {
          tDiffuse: { value: null },
          uSpeedFactor: { value: 0.0 },
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
          uniform float uSpeedFactor;
          varying vec2 vUv;
          void main() {
            vec2 uv = vUv;
            vec2 centerDiff = uv - vec2(0.5);
            float dist = length(centerDiff);

            // Subtle optical lens chromatic aberration at edges (amplified at high F1 speeds)
            float caOffset = dist * dist * (0.0018 + uSpeedFactor * 0.0042);
            vec2 dir = dist > 0.0001 ? normalize(centerDiff) : vec2(0.0);
            float r = texture2D(tDiffuse, uv + dir * caOffset).r;
            float g = texture2D(tDiffuse, uv).g;
            float b = texture2D(tDiffuse, uv - dir * caOffset).b;
            vec3 col = vec3(r, g, b);

            // Broadcast camera micro-contrast S-curve & rich shadow depth
            col = mix(col, smoothstep(0.0, 1.0, col), 0.14);

            // Natural optical lens vignette
            float vignette = smoothstep(0.95, 0.32, dist);
            col *= mix(0.76, 1.03, vignette);

            gl_FragColor = vec4(col, 1.0);
          }
        `,
      });
      composer.addPass(broadcastLensPass);

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
      }
    );
    if (isStrictPracticeMode) {
      physics.setPracticeBotCount(practiceBotCount ?? 19);
    }
    physicsRef.current = physics;

    // Helper: Build a prominent 3D hovering indicator & beacon over opponent's car
    const createRemotePlayer3DBeacon = (name: string, carNum: number, teamColor: string) => {
      const beaconGroup = new THREE.Group();

      // 1. High-contrast billboard canvas with glow border, name, and downward chevron
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Dark translucent carbon panel with bright colored neon border
        ctx.fillStyle = 'rgba(8, 9, 14, 0.94)';
        ctx.strokeStyle = teamColor || '#ff2222';
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.roundRect(14, 14, 484, 122, 22);
        ctx.fill();
        ctx.stroke();

        // Inverted pointer triangle directly above car roof
        ctx.fillStyle = teamColor || '#ff2222';
        ctx.beginPath();
        ctx.moveTo(256 - 38, 138);
        ctx.lineTo(256 + 38, 138);
        ctx.lineTo(256, 188);
        ctx.closePath();
        ctx.fill();

        // Top Header: ONLINE RIVAL
        ctx.fillStyle = '#fef08a';
        ctx.font = '900 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ MULTIPLAYER RIVAL ⚡', 256, 56);

        // Driver Name & Number
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 48px sans-serif';
        ctx.fillText(`#${carNum} ${name.toUpperCase()}`, 256, 110);

        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        const spriteMat = new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          depthTest: false,
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(4.4, 1.7, 1.0);
        sprite.position.set(0, 3.2, 0);
        beaconGroup.add(sprite);
      }

      // 2. Cockpit halo beacon ring
      const haloGeom = new THREE.RingGeometry(1.25, 1.6, 32);
      const haloMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(teamColor || '#ff2222'),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const haloMesh = new THREE.Mesh(haloGeom, haloMat);
      haloMesh.rotation.x = Math.PI / 2;
      haloMesh.position.set(0, 0.75, 0);
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

    // 7. Render Loop with 60Hz Monitor Frame-Pacing Stabilization, Live FPS Counter & Smart 60 FPS Clear Governor
    let lastTime = performance.now();
    let animFrameId: number;
    let lastUiUpdateTime = 0;
    let lastTelemetrySendTime = 0;
    let raceCompleteNotified = false;
    let frameCount = 0;

    // Smart 60 FPS Clear Governor:
    // - Keeps screen resolution crisp & clear (1.0x–1.25x native clarity, never blurry!)
    // - Eliminates race-start lag by starting from the learned GPU profile (defaulting to a fast 65% Hybrid profile with live CubeCamera deferred during initial grid load)
    // - Independently toggles Shadows ON + Reflections OFF vs Reflections ON + Shadows OFF (or Both ON / Both OFF) to hold a locked 60 FPS
    const storedGpuProfile = getStoredDynamicGpuProfile();
    let fpsSampleFrames = 0;
    let lastFpsSampleTime = performance.now();
    let dynamicQualityFactor = storedGpuProfile.qualityScore;
    let preferShadowsOverReflections = storedGpuProfile.preferShadowsOverReflections;
    let appliedPixelRatio = renderer.getPixelRatio();
    let dynamicReflectionCadence = 0; // 0 = live CubeCamera off (uses pre-baked sky/horizon PMREM reflection with 0 GPU cost)
    let shadowComboAvgFps = 60;
    let reflComboAvgFps = 60;

    const applyContinuousDynamicQuality = (q: number, persistProfile = false) => {
      const clampedQ = Math.max(0.15, Math.min(1.0, q));
      dynamicQualityFactor = clampedQ;

      // 1. Keep Screen Resolution Crisp & Clear!
      // Instead of dropping resolution to a blurry 0.55x when the GPU struggles, we keep pixel ratio sharp (1.0x native at >= 35%, 0.92x floor in extreme emergencies, up to 1.25x at 100%)
      // and shed heavy GPU passes (CubeCamera 6-face reflections or Shadow Map depth pass) first!
      const devicePR = window.devicePixelRatio || 1;
      const desiredScale =
        clampedQ >= 0.85
          ? Math.min(devicePR, 1.25)
          : clampedQ >= 0.35
          ? Math.min(devicePR, 1.0)
          : Math.min(devicePR, 0.92);
      const targetScale = Math.round(desiredScale / 0.04) * 0.04;
      if (Math.abs(targetScale - appliedPixelRatio) >= 0.035) {
        appliedPixelRatio = Number(targetScale.toFixed(2));
        renderer.setPixelRatio(appliedPixelRatio);
      }

      // 2. Smart Independent Feature Matrix:
      //    - [78% – 100%]: BOTH ON (Shadows ON + Live 360° Reflections ON, cadence 3 to 10 frames)
      //    - [58% – 77%]:  HYBRID A — Preferred feature ON, secondary heavy feature OFF
      //                    (Default: Shadows ON + Live Reflections OFF [uses fast cached sky/horizon reflection],
      //                     or Reflections ON + Shadows OFF if GPU benchmarked faster with reflections)
      //    - [46% – 57%]:  HYBRID B — Alternate single feature ON (tests the opposite combo: e.g. Reflections ON [every 8f] + Shadows OFF, or Shadows ON + Reflections OFF)
      //    - [15% – 45%]:  60 FPS CLEAR MODE — Both Live Reflections OFF & Dynamic Shadows OFF (cars keep contact shadow + cached sky reflection while screen stays 1.0x crystal clear!)
      let enableShadows = false;
      let reflCadence = 0;
      let comboLabel = '60FPS Clear (Shd OFF · Refl OFF)';

      if (clampedQ >= 0.78) {
        enableShadows = true;
        reflCadence = Math.max(
          3,
          Math.min(10, Math.round(10 - ((clampedQ - 0.78) / 0.22) * 7))
        );
        comboLabel = `Shadows ON · Refl ON (${reflCadence}f)`;
      } else if (clampedQ >= 0.58) {
        if (preferShadowsOverReflections) {
          enableShadows = true;
          reflCadence = 0; // Turn off live 6-face CubeCamera, keep crisp shadows!
          comboLabel = 'Shadows ON · Refl OFF';
        } else {
          enableShadows = false; // Turn off shadow depth pass, keep live reflections!
          reflCadence = 6;
          comboLabel = 'Refl ON (6f) · Shadows OFF';
        }
      } else if (clampedQ >= 0.46) {
        if (preferShadowsOverReflections) {
          // Try the inverse hybrid: Reflections ON (every 8 frames) + Dynamic Shadows OFF
          enableShadows = false;
          reflCadence = 8;
          comboLabel = 'Refl ON (8f) · Shadows OFF';
        } else {
          enableShadows = true;
          reflCadence = 0;
          comboLabel = 'Shadows ON · Refl OFF';
        }
      } else {
        // Maximum FPS protection while keeping 1.0x crisp resolution
        enableShadows = false;
        reflCadence = 0;
        comboLabel = '60FPS Clear (Shd OFF · Refl OFF)';
      }

      dynamicReflectionCadence = reflCadence;

      if (renderer.shadowMap.enabled !== enableShadows) {
        renderer.shadowMap.enabled = enableShadows;
        sunLight.castShadow = enableShadows;
        renderer.shadowMap.needsUpdate = true;
      }
      if (enableShadows) {
        sunLight.shadow.radius = 1.0 + clampedQ * 1.1;
      }

      // 3. Continuous Camera Draw Distance (900m at 15% up to 2200m at 100%)
      const targetFar = Math.round(900 + clampedQ * 1300);
      if (Math.abs(camera.far - targetFar) > 45) {
        camera.far = targetFar;
        camera.updateProjectionMatrix();
      }

      // 4. Rim / Specular Fill Light (Active when >= 50%)
      if (rimLight) {
        const rimFactor = Math.max(0, Math.min(1, (clampedQ - 0.45) / 0.55));
        rimLight.visible = rimFactor > 0.02;
        rimLight.intensity = rimFactor * 1.1;
      }

      setDynamicQualityPct(Math.round(clampedQ * 100));
      setDynamicRenderScale(Number(appliedPixelRatio.toFixed(2)));
      setDynamicReflectionEvery(dynamicReflectionCadence);
      setDynamicFeatureCombo(comboLabel);

      if (persistProfile) {
        setStoredDynamicGpuProfile({
          qualityScore: Number(clampedQ.toFixed(3)),
          preferShadowsOverReflections,
        });
      }
    };

    if (gfxPreset.id === 'dynamic') {
      // Start at the learned GPU profile (or 0.65 fast hybrid on first boot) so the 20-car race start never lags on Frame 1!
      applyContinuousDynamicQuality(dynamicQualityFactor, false);
    }

    const renderLoop = (time: number) => {
      animFrameId = requestAnimationFrame(renderLoop);
      frameCount++;
      fpsSampleFrames++;

      const rawDelta = (time - lastTime) / 1000;
      lastTime = time;

      // Fast 110ms FPS check starting right at Frame 3 (~50ms after race launch) so Dynamic reacts immediately if FPS dips at race start
      const fpsElapsed = time - lastFpsSampleTime;
      const sampleWindowMs = gfxPreset.id === 'dynamic' && frameCount < 45 ? 90 : 120;
      if (fpsElapsed >= sampleWindowMs && fpsSampleFrames >= 2) {
        const exactFps = (fpsSampleFrames * 1000) / fpsElapsed;
        const measuredFps = Math.min(240, Math.max(1, Math.round(exactFps)));
        const measuredMs = Number(
          (fpsElapsed / Math.max(1, fpsSampleFrames)).toFixed(1)
        );
        setLiveFps(measuredFps);
        setFrameTimeMs(measuredMs);
        fpsSampleFrames = 0;
        lastFpsSampleTime = time;

        // Track which hybrid mode (Shadows ON/Refl OFF vs Refl ON/Shadows OFF) runs faster on this PC's GPU
        if (renderer.shadowMap.enabled && dynamicReflectionCadence === 0) {
          shadowComboAvgFps = shadowComboAvgFps * 0.7 + exactFps * 0.3;
        } else if (!renderer.shadowMap.enabled && dynamicReflectionCadence > 0) {
          reflComboAvgFps = reflComboAvgFps * 0.7 + exactFps * 0.3;
          // If Reflections-only consistently beats Shadows-only by > 4 FPS, remember that preference for this GPU
          if (reflComboAvgFps > shadowComboAvgFps + 4 && preferShadowsOverReflections) {
            preferShadowsOverReflections = false;
          } else if (shadowComboAvgFps > reflComboAvgFps + 4 && !preferShadowsOverReflections) {
            preferShadowsOverReflections = true;
          }
        }

        // Smart 60 FPS Governor: Checks from Frame 3 onwards and immediately sheds reflections or shadows if FPS is below 58
        if (gfxPreset.id === 'dynamic' && frameCount >= 3) {
          const targetFps = 60.0;
          const fpsDeficit = targetFps - exactFps; // positive when lagging (< 60 FPS)

          if (fpsDeficit > 1.5 || measuredMs > 17.4) {
            // GPU struggling (< 58.5 FPS): immediately step down quality to turn off reflections or shadows while keeping resolution sharp
            const emergencyBoost = exactFps < 48 || measuredMs > 21 ? 0.14 : 0.04;
            const dropAmount = Math.min(
              0.28,
              Math.max(0.035, (fpsDeficit / 60) * 0.65 + emergencyBoost)
            );
            applyContinuousDynamicQuality(dynamicQualityFactor - dropAmount, true);
          } else if (
            frameCount > 35 &&
            exactFps >= 58.8 &&
            measuredMs <= 16.9 &&
            dynamicQualityFactor < 1.0
          ) {
            // Holding steady ~60 FPS after the race start grid settles: gently step quality upward (+1.5%) to test enabling shadows/reflections
            applyContinuousDynamicQuality(dynamicQualityFactor + 0.015, true);
          }
        }
      }

      // 60Hz monitor frame-pacing lock: if running near 60Hz (16.67ms ± 3.5ms), snap delta smoothly to 1/60s to eliminate browser timer jitter on 60Hz displays
      const clampedDelta = Math.min(0.05, Math.max(0.001, rawDelta));
      const delta = Math.abs(clampedDelta - 1 / 60) < 0.0035 ? 1 / 60 : clampedDelta;

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

      // Update real-time 360° CubeCamera + PMREM environment reflections (Dynamic smart cadence, Medium, High & Ultra)
      // On Dynamic mode, skip live CubeCamera capture during the first 25 frames of the race countdown so the race starts at an instant 60 FPS with zero Frame-1 stall (cars already reflect the pre-baked sky/horizon PMREM texture!)
      if (carCubeCamera && cubeRenderTarget && pmremGenerator && gfxPreset.useEnvironmentReflections) {
        const reflectionInterval =
          gfxPreset.id === 'dynamic'
            ? dynamicReflectionCadence
            : gfxPreset.id === 'ultra'
            ? 2
            : gfxPreset.id === 'high'
            ? 3
            : 6;
        const shouldCaptureCube =
          gfxPreset.id === 'dynamic'
            ? frameCount > 25 && reflectionInterval > 0 && frameCount % reflectionInterval === 0
            : frameCount === 1 || (reflectionInterval > 0 && frameCount % reflectionInterval === 0);

        if (shouldCaptureCube) {
          playerCar.root.visible = false;
          scene.fog = null;
          carCubeCamera.position.set(carPos.x, carPos.y + 0.68, carPos.z);
          carCubeCamera.update(renderer, scene);
          scene.fog = activeSceneFog;
          playerCar.root.visible = true;

          const nextPmrem = pmremGenerator.fromCubemap(cubeRenderTarget.texture);
          if (activePmremTarget) {
            activePmremTarget.dispose();
          }
          activePmremTarget = nextPmrem;
          scene.environment = activePmremTarget.texture;
        }
      }

      if (composer && broadcastLensPass && gfxPreset.id === 'ultra') {
        broadcastLensPass.uniforms.uSpeedFactor.value = Math.min(1.0, Math.abs(speed) / 340);
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
      if (composer) {
        composer.dispose();
      }
      if (activePmremTarget) {
        activePmremTarget.dispose();
      }
      if (pmremGenerator) {
        pmremGenerator.dispose();
      }
      if (cubeRenderTarget) {
        cubeRenderTarget.dispose();
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

      {/* Cinematic High-Velocity Speed Tunnel Overlay (>240 km/h) */}
      {telemetry && Math.abs(telemetry.speedKmh) > 240 && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300 z-10"
          style={{
            opacity: Math.min(0.6, (Math.abs(telemetry.speedKmh) - 240) / 110),
            background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0, 0, 0, 0.4) 80%, rgba(0, 0, 0, 0.75) 100%)',
          }}
        />
      )}

      {/* Heavy Impact Crash Trauma Vignette */}
      {telemetry && telemetry.speedKmh === 0 && (telemetry.wrongWayWarning || (physicsRef.current && physicsRef.current.playerCrashWaitTimer > 0)) && (
        <div className="absolute inset-0 pointer-events-none z-10 bg-red-950/25 ring-8 ring-red-600/30 animate-pulse" />
      )}

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
        />
      )}

      {/* Top-Right Live FPS Counter, Dynamic Graphics Selector & Exit to Paddock Bar */}
      <div className="absolute top-4 right-4 z-40 flex flex-col items-end gap-1.5">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Live Real-Time FPS & Frame-Time Counter */}
          <div
            className="flex items-center gap-2 bg-black/80 border border-white/15 backdrop-blur-md rounded-lg px-2.5 py-1 font-mono text-[11px] shadow-lg"
            title="Live Frame Rate (FPS) & Frame Render Time (ms)"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                liveFps >= 55
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                  : liveFps >= 40
                  ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                  : 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.9)]'
              }`}
            />
            <span
              className={`font-black tabular-nums ${
                liveFps >= 55
                  ? 'text-emerald-400'
                  : liveFps >= 40
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}
            >
              {liveFps} FPS
            </span>
            <span className="text-neutral-500">·</span>
            <span className="text-neutral-300 tabular-nums text-[10px]">
              {frameTimeMs.toFixed(1)}ms
            </span>
            {graphicsQuality === 'dynamic' && (
              <>
                <span className="text-neutral-500">·</span>
                <div
                  className="flex items-center gap-1.5"
                  title={`Smart 60 FPS Governor: ${dynamicQualityPct}% · Crisp ${dynamicRenderScale}x Resolution · ${dynamicFeatureCombo} · Reflections ${
                    dynamicReflectionEvery > 0 ? `every ${dynamicReflectionEvery}f` : 'cached sky probe'
                  }`}
                >
                  <span className="text-cyan-300 font-bold text-[10px] tabular-nums">
                    DYN {dynamicQualityPct}% · {dynamicFeatureCombo}
                  </span>
                  <div className="w-12 h-1.5 bg-neutral-800 rounded-full overflow-hidden hidden sm:block">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-amber-400 transition-all duration-150"
                      style={{ width: `${dynamicQualityPct}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 bg-black/75 border border-white/10 backdrop-blur rounded-lg px-2 py-1">
            <span className="text-[10px] font-mono text-neutral-400 uppercase mr-1 hidden sm:inline">
              Graphics:
            </span>
            {GRAPHICS_QUALITY_OPTIONS.map((q) => (
              <button
                key={q}
                onClick={() => setStoredGraphicsQuality(q)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                  graphicsQuality === q
                    ? q === 'ultra'
                      ? 'bg-amber-500 text-black'
                      : q === 'dynamic'
                      ? 'bg-cyan-400 text-black'
                      : q === 'low'
                      ? 'bg-emerald-500 text-black'
                      : 'bg-red-600 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title={GRAPHICS_PRESETS[q].description}
              >
                {GRAPHICS_PRESETS[q].shortLabel}
              </button>
            ))}
          </div>

          <button
            onClick={onExitToPaddock}
            className="px-3 py-1.5 bg-black/75 hover:bg-black/95 text-neutral-300 hover:text-white text-xs font-semibold rounded-lg border border-white/10 backdrop-blur transition-colors cursor-pointer"
          >
            Exit to Paddock
          </button>
        </div>
      </div>
    </div>
  );
};
