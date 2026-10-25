import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
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

    // 1. Scene, Camera, Renderer
    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(circuit.skyColor);

    const camera = new THREE.PerspectiveCamera(66, width / height, 0.1, 2400);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = circuit.id === 'abudhabi' ? 1.25 : 1.15;

    // Studio & Sky Environment Reflection Probe for smooth metallic bodywork & clearcoat
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

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

    scene.fog = new THREE.FogExp2(circuit.fogColor, fogDensity);

    const hemiLight = new THREE.HemisphereLight(hemiSky, hemiGround, 0.95);
    scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, Math.max(0.68, circuit.ambientLight * 0.82));
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(sunColor, sunIntensity);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0003;
    sunLight.shadow.normalBias = 0.02;
    sunLight.shadow.radius = 1.5;
    const shadowSpan = 38;
    sunLight.shadow.camera.left = -shadowSpan;
    sunLight.shadow.camera.right = shadowSpan;
    sunLight.shadow.camera.top = shadowSpan;
    sunLight.shadow.camera.bottom = -shadowSpan;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 190;
    scene.add(sunLight);
    scene.add(sunLight.target);

    // 4. Generate Circuit Mesh
    const track = generateTrack(circuit);
    scene.add(track.group);

    // 4b. Practice Mode ONLY: 3D Optimal Racing Line & Braking/Acceleration Indicators
    let practiceRacingLine: BuiltRacingLine | null = null;
    if (isStrictPracticeMode) {
      practiceRacingLine = buildPracticeRacingLine(track);
      practiceRacingLine.group.visible = showPracticeRacingLineRef.current;
      scene.add(practiceRacingLine.group);
    }

    // 5. Build Player F1 Car
    const playerCar = buildF1Car(playerTeam, playerDriver);
    scene.add(playerCar.root);

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
        const aiCar = buildF1Car(team, driver);
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
      const rivalCar = buildF1Car(rivalTeam, rivalDriver);
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

    // 7. Render Loop with dead-reckoning lag reduction and throttled UI updates
    let lastTime = performance.now();
    let animFrameId: number;
    let lastUiUpdateTime = 0;
    let lastTelemetrySendTime = 0;
    let raceCompleteNotified = false;

    const renderLoop = (time: number) => {
      animFrameId = requestAnimationFrame(renderLoop);

      const delta = (time - lastTime) / 1000;
      lastTime = time;

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

      // Tail light flashing
      playerCar.flashTailLight(time / 1000);

      // Dynamic Following Shadow Light
      const carPos = physics.playerPos;
      const heading = physics.playerHeading;
      const speed = physics.playerSpeedKmh;

      sunLight.position.set(carPos.x + 45, carPos.y + 80, carPos.z + 35);
      sunLight.target.position.copy(carPos);
      sunLight.target.updateMatrixWorld();

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

      const lerpSpeed = activeView === 'cockpit' || activeView === 'nose' ? 0.35 : 0.14;
      currentCamPos.lerp(targetCamPos, lerpSpeed);
      currentLookAt.lerp(targetLook, lerpSpeed);

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

      renderer.render(scene, camera);

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
      renderer.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [circuit.id, laps, season.selectedTeamId, season.selectedDriverId, season.difficulty, isMultiplayer, multiplayerRoom?.code]);

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

      <button
        onClick={onExitToPaddock}
        className="absolute top-4 right-4 z-40 px-3 py-1.5 bg-black/75 hover:bg-black/95 text-neutral-300 hover:text-white text-xs font-semibold rounded-lg border border-white/10 backdrop-blur transition-colors cursor-pointer"
      >
        Exit to Paddock
      </button>
    </div>
  );
};
