import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as THREE from 'three';
import { CircuitInfo, CameraView, SeasonState, Driver, Team } from '../types/racing';
import { DRIVERS, TEAMS } from '../constants/f1Data';
import { buildF1Car } from '../game/carBuilder';
import { generateTrack } from '../game/trackGenerator';
import { PhysicsEngine } from '../game/physicsEngine';
import { inputManager } from '../services/inputManager';
import { soundEngine } from '../services/soundEngine';
import { BroadcastHUD } from './BroadcastHUD';
import { multiplayerService, RoomPublicState } from '../services/multiplayerService';

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
  isMultiplayer?: boolean;
  multiplayerRoom?: RoomPublicState | null;
  onOpenControls?: () => void;
}

export const RaceView: React.FC<RaceViewProps> = ({
  circuit,
  laps,
  season,
  onRaceComplete,
  onExitToPaddock,
  isPracticeMode = false,
  practiceDifficulty,
  isMultiplayer = false,
  multiplayerRoom = null,
  onOpenControls,
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
    scene.fog = new THREE.FogExp2(circuit.fogColor, 0.0016);

    const camera = new THREE.PerspectiveCamera(66, width / height, 0.1, 2400);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    containerRef.current.appendChild(renderer.domElement);

    // 2. Load Circuit Skybox
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      '/src/assets/images/skybox_f1_circuit_1791403761165.jpg',
      (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = tex;
      },
      undefined,
      () => {
        // Fallback ambient
      }
    );

    // 3. Dynamic Sunlight & Skylight
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.9);
    scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, circuit.ambientLight * 0.75);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.85);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0003;
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

    // 5. Build Player F1 Car
    const playerCar = buildF1Car(playerTeam, playerDriver);
    scene.add(playerCar.root);

    // 6. Initialize Physics & 19 AI Competitors
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
    physics.initGrid(playerDriver.id, (team, driver) => {
      const aiCar = buildF1Car(team, driver);
      scene.add(aiCar.root);
      return aiCar;
    });
    physicsRef.current = physics;

    // Multiplayer Human Rivals Visualization
    const humanRivalCars = new Map<string, {
      car: ReturnType<typeof buildF1Car>;
      targetPos: THREE.Vector3;
      currentPos: THREE.Vector3;
      heading: number;
    }>();

    if (isMultiplayer && multiplayerRoom) {
      const localId = multiplayerService.getLocalPlayerId();
      multiplayerRoom.players.forEach((p) => {
        if (p.id !== localId) {
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
            rating: 88,
            color: p.teamColor || '#ff4444',
          };
          const rivalCar = buildF1Car(rivalTeam, rivalDriver);
          scene.add(rivalCar.root);

          const startPt = track.getTrackPointAtProgress(0.002 * (p.gridSlot || 2));
          rivalCar.root.position.copy(startPt.position);
          humanRivalCars.set(p.id, {
            car: rivalCar,
            targetPos: startPt.position.clone(),
            currentPos: startPt.position.clone(),
            heading: 0,
          });
        }
      });
    }

    const unsubTelemetry = isMultiplayer
      ? multiplayerService.onTelemetry((sync) => {
          const rival = humanRivalCars.get(sync.playerId);
          if (rival) {
            const trackPt = track.getTrackPointAtProgress(sync.progress);
            rival.targetPos.copy(trackPt.position).addScaledVector(trackPt.normal, sync.lateralOffset);
            rival.targetPos.y = trackPt.position.y + 0.08;
            const fwd = trackPt.tangent;
            rival.heading = Math.atan2(-fwd.x, -fwd.z);
          }
        })
      : () => {};

    const currentCamPos = new THREE.Vector3();
    const currentLookAt = new THREE.Vector3();

    // 7. Render Loop with throttled UI state dispatches
    let lastTime = performance.now();
    let animFrameId: number;
    let lastUiUpdateTime = 0;
    let lastTelemetrySendTime = 0;
    let raceCompleteNotified = false;

    const renderLoop = (time: number) => {
      animFrameId = requestAnimationFrame(renderLoop);

      const delta = (time - lastTime) / 1000;
      lastTime = time;

      // Update multiplayer rival positions
      if (isMultiplayer) {
        humanRivalCars.forEach((rival) => {
          rival.currentPos.lerp(rival.targetPos, 0.25);
          rival.car.root.position.copy(rival.currentPos);
          rival.car.root.rotation.y = rival.heading;
        });

        // Send local player telemetry every 50ms
        if (time - lastTelemetrySendTime > 50) {
          lastTelemetrySendTime = time;
          multiplayerService.sendTelemetry({
            progress: physics.playerProgress,
            lap: physics.telemetry?.lapCurrent || 1,
            speedKmh: physics.playerSpeedKmh,
            lateralOffset: physics.telemetry?.lateralOffset || 0,
            position: physics.telemetry?.position || 1,
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

      if (input.reset) {
        physics.resetPlayer();
      }

      // Update Physics Simulation
      physics.update(delta, input);

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

      // Camera Positioning
      const forward = new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading));
      const up = new THREE.Vector3(0, 1, 0);

      // Dynamic lookahead along track curve to give wide, open sightlines around every corner (No Blind Corners!)
      const lookaheadT = (physics.playerProgress + 0.024) % 1.0;
      const trackAhead = physics.track.getTrackPointAtProgress(lookaheadT).position;

      let targetCamPos = new THREE.Vector3();
      let targetLook = new THREE.Vector3();

      const activeView = cameraViewRef.current;
      if (activeView === 'chase') {
        targetCamPos = carPos.clone().addScaledVector(forward, -7.2).addScaledVector(up, 2.6);
        // Blend forward projection with track curvature lookahead to see clearly through the apex
        targetLook = carPos.clone().addScaledVector(forward, 16.0).lerp(trackAhead, 0.4).addScaledVector(up, 0.95);
      } else if (activeView === 'close') {
        targetCamPos = carPos.clone().addScaledVector(forward, -4.5).addScaledVector(up, 1.8);
        targetLook = carPos.clone().addScaledVector(forward, 20.0).lerp(trackAhead, 0.35).addScaledVector(up, 0.8);
      } else if (activeView === 'cockpit') {
        targetCamPos = carPos.clone().addScaledVector(up, 0.78).addScaledVector(forward, -0.05);
        targetLook = carPos.clone().addScaledVector(forward, 28.0).lerp(trackAhead, 0.25).addScaledVector(up, 0.72);
      } else if (activeView === 'nose') {
        targetCamPos = carPos.clone().addScaledVector(forward, 2.3).addScaledVector(up, 0.35);
        targetLook = carPos.clone().addScaledVector(forward, 32.0).lerp(trackAhead, 0.25).addScaledVector(up, 0.35);
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

        const padStatus = inputManager.getControllerStatus();
        setControllerState({ connected: padStatus.connected, id: padStatus.id });
      }

      if (physics.raceFinished && !raceCompleteNotified) {
        raceCompleteNotified = true;
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
      if (e.key === '1') {
        physicsRef.current?.issueTeamOrder('block');
      } else if (e.key === '2') {
        physicsRef.current?.issueTeamOrder('yield');
      } else if (e.key === '3') {
        physicsRef.current?.issueTeamOrder('push');
      } else if (e.key === '4') {
        physicsRef.current?.issueTeamOrder('neutral');
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
          onIssueTeamOrder={handleIssueTeamOrder}
          onOpenControls={onOpenControls}
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
