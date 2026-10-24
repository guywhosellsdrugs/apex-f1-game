import * as THREE from 'three';
import { BuiltCar } from './carBuilder';
import { GeneratedTrack, SurfaceInfo } from './trackGenerator';
import { Driver, Team, TelemetryData, TireCompound, CarRadarPoint, CustomTeamConfig } from '../types/racing';
import { DRIVERS, TEAMS } from '../constants/f1Data';
import { UnifiedInput, inputManager } from '../services/inputManager';
import { soundEngine } from '../services/soundEngine';

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
}

/**
 * 3D Floating Teammate Marker / Beacon:
 * "and put like a thing so i know who is my teammate so i dont crash in to them"
 */
function createTeammate3DBeacon(driver: Driver): THREE.Group {
  const group = new THREE.Group();

  // 1. High-resolution canvas billboard with clear teammate callout
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Glowing emerald badge with high contrast
    ctx.fillStyle = 'rgba(5, 46, 22, 0.96)';
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.roundRect(16, 16, 480, 120, 24);
    ctx.fill();
    ctx.stroke();

    // Inverted green pointer triangle / chevron pointing directly to car
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.moveTo(256 - 42, 136);
    ctx.lineTo(256 + 42, 136);
    ctx.lineTo(256, 188);
    ctx.closePath();
    ctx.fill();

    // Top Header: TEAMMATE
    ctx.fillStyle = '#6ee7b7';
    ctx.font = '900 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★ TEAMMATE ★', 256, 58);

    // Driver Callout
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 46px sans-serif';
    ctx.fillText(`${driver.shortName} #${driver.number}`, 256, 108);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(4.0, 1.5, 1.0);
    sprite.position.set(0, 3.2, 0);
    group.add(sprite);
  }

  // 2. Pulsing emerald halo ring above cockpit
  const haloGeom = new THREE.RingGeometry(1.2, 1.55, 32);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.90,
  });
  const haloMesh = new THREE.Mesh(haloGeom, haloMat);
  haloMesh.rotation.x = Math.PI / 2;
  haloMesh.position.set(0, 0.65, 0);
  group.add(haloMesh);

  // 3. Chassis underglow beacon
  const underglowGeom = new THREE.RingGeometry(1.6, 2.0, 32);
  const underglowMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.55,
  });
  const underglowMesh = new THREE.Mesh(underglowGeom, underglowMat);
  underglowMesh.rotation.x = Math.PI / 2;
  underglowMesh.position.set(0, 0.05, 0);
  group.add(underglowMesh);

  return group;
}

export interface GridOptions {
  botCount?: number;
  hasTeammates?: boolean;
  playerGridSlot?: number;
  isQualifyingMode?: boolean;
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
  public tireCompound: TireCompound = 'SOFT';

  public lapTimeCurrent: number = 0;
  public lapTimeBest: number | null = null;
  public lastLapTime: number | null = null;
  public raceFinished: boolean = false;

  public countdownTimer: number = 0;
  public raceTimer: number = 0;
  public raceState: 'countdown' | 'racing' | 'finished' = 'countdown';
  public lightsLit: number = 0;
  public lightsExtinguished: boolean = false;

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

  public telemetry: TelemetryData;
  public enginePowerRating: number = 85;
  public engineReliability: number = 80;
  public accelerationScore: number = 85;
  public handlingScore: number = 82;
  public downforceScore: number = 80;
  public brakesScore: number = 85;
  public customTopSpeedKmh?: number;
  public teammateDriverId?: string;
  public playerDriver: Driver;
  public peerCars: Map<string, PeerCar> = new Map();
  public multiplayerMode: boolean = false;
  public isQualifyingMode: boolean = false;

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

    // Configure authentic acoustic engine noise profile based on team / constructor power unit:
    const engineIdentifier = this.customTeamConfig?.engineId || this.customTeamConfig?.engine || this.playerTeam?.engine || 'ferrari';
    soundEngine.setEngineProfile(engineIdentifier);

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
      tireTemp: 90,
      tireCompound: 'SOFT',
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
    const teammateDriver = shouldHaveTeammate ? allDrivers.find((d) => d.id === this.teammateDriverId) : null;

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

      // In Qualifying Mode, render AI cars as pass-through ghost cars and hide them for the first few seconds
      if (this.isQualifyingMode) {
        builtCar.root.visible = false;
        builtCar.root.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            if (Array.isArray(mesh.material)) {
              mesh.material = mesh.material.map((m) => {
                const clone = m.clone();
                clone.transparent = true;
                clone.opacity = 0.52;
                clone.depthWrite = false;
                return clone;
              });
            } else if (mesh.material) {
              const clone = mesh.material.clone();
              clone.transparent = true;
              clone.opacity = 0.52;
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

  public update(delta: number, input: UnifiedInput) {
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

    // 1. Race Countdown Sequence
    if (this.raceState === 'countdown') {
      this.countdownTimer += dt;
      const newLights = Math.min(5, Math.floor(this.countdownTimer / 0.35));
      if (newLights > this.lightsLit && newLights <= 5) {
        this.lightsLit = newLights;
        soundEngine.playStartLightBeep(false);
      }
      this.track.setStartLights(this.lightsLit, false);

      // Instant start if throttle pressed OR after 1.8 seconds
      if ((input.throttle > 0.05 && this.countdownTimer > 0.35) || this.countdownTimer > 1.8) {
        this.lightsExtinguished = true;
        this.track.setStartLights(5, true);
        soundEngine.playStartLightBeep(true);
        this.raceState = 'racing';
      } else {
        const revRpm = 4500 + input.throttle * 7500;
        soundEngine.updateEngine(revRpm, input.throttle, 0, false, 0, false);
        return;
      }
    }

    if (this.raceState === 'racing') {
      this.raceTimer += dt;
    }

    // 2. Track Surface Query
    const surface: SurfaceInfo = this.track.checkSurfaceType(this.playerPos, this.playerProgress);
    this.playerProgress = surface.progress;

    // Firm ground contact
    this.playerPos.y = surface.trackPoint.y + 0.08;

    // Calculate Car Heading Vector & Alignment with Track Tangent
    const carFwdX = -Math.sin(this.playerHeading);
    const carFwdZ = -Math.cos(this.playerHeading);
    const carFwdVec = new THREE.Vector3(carFwdX, 0, carFwdZ);
    const forwardAlignment = carFwdVec.dot(surface.tangent);

    // Track sector milestones to ensure honest forward lap progression
    if (this.playerProgress > 0.30 && this.playerProgress < 0.65) {
      this.hasReachedSector2 = true;
    }
    if (this.playerProgress >= 0.65 && this.playerProgress < 0.95) {
      this.hasReachedSector3 = true;
    }

    // Wrong Way Detection & 5-Second Warning / Auto-Respawn
    // "also if a player crosses the finish linegoing the wrong way dont allow them to win and give a wrong way warning for 5 seconds then respawn them"
    const isGoingWrongWay = forwardAlignment < -0.22 || (this.playerSpeedKmh < -12 && forwardAlignment > 0.2);

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

    // Robust Lap completion detection for Player (Strict forward crossing & sector requirement)
    if (this.prevProgress > 0.85 && this.playerProgress < 0.15) {
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
    if (this.prevProgress < 0.15 && this.playerProgress > 0.85) {
      this.wrongWayWarning = true;
      this.wrongWayTimer = Math.max(this.wrongWayTimer, 2.5);
    }

    this.prevProgress = this.playerProgress;

    if (!this.raceFinished && this.hasCrossedInitialStartLine) {
      this.lapTimeCurrent += dt;
    }

    const gripMultiplier = surface.offTrack ? 0.45 : surface.onCurb ? 0.9 : 1.0;
    // NO 380 KM/H LIMITER: Top speed is realistically determined by engine power, gear ratio, and aerodynamic drag
    const maxSurfaceSpeed = surface.offTrack ? 135 : 440;

    // Ticking protection shield timer after crash recovery
    if (this.playerProtectionShieldTimer > 0) {
      this.playerProtectionShieldTimer = Math.max(0, this.playerProtectionShieldTimer - dt);
    }

    // ERS Boost & Active Aero DRS
    const isBoosting = input.boost && this.ersBattery > 0 && this.playerSpeedKmh > 20;
    if (isBoosting) {
      this.ersBattery = Math.max(0, this.ersBattery - dt * 16);
      this.drsActive = true;
    } else {
      this.drsActive = false;
      if (input.brake > 0.2 && this.playerSpeedKmh > 40) {
        this.ersBattery = Math.min(100, this.ersBattery + dt * 20 * input.brake);
      }
    }
    this.playerCar.setDrsActive(this.drsActive);

    // Forward vs Reverse Gear
    if (input.throttle > 0 && this.playerGear === -1) {
      this.playerGear = 1;
      this.reverseHoldTimer = 0;
      soundEngine.playGearShift(false);
    }

    if (Math.abs(this.playerSpeedKmh) < 0.5 && input.brake > 0.6 && input.throttle < 0.05) {
      this.reverseHoldTimer += dt;
      if (this.reverseHoldTimer > 0.65 && this.playerGear !== -1) {
        this.playerGear = -1;
        soundEngine.playGearShift(true);
      }
    } else if (input.brake < 0.2) {
      this.reverseHoldTimer = 0;
    }

    if (this.playerGear !== -1) {
      // FORWARD GEARS (1 to 8)
      this.playerGear = Math.max(1, Math.min(8, this.playerGear));

      const curMax = this.gearMaxSpeeds[this.playerGear] || 400;
      const curMin = this.gearMaxSpeeds[this.playerGear - 1] || 0;

      if (this.playerSpeedKmh > curMax - 8 && this.playerGear < 8) {
        this.playerGear++;
        soundEngine.playGearShift(false);
        inputManager.rumble(0.25, 0.45, 60);
      } else if (this.playerSpeedKmh < curMin - 12 && this.playerGear > 1) {
        this.playerGear--;
        soundEngine.playGearShift(true);
        inputManager.rumble(0.3, 0.5, 80);
      }

      const gearSpan = Math.max(1, curMax - curMin);
      const speedInGear = Math.max(0, this.playerSpeedKmh - curMin);
      const rpmFrac = Math.max(0, Math.min(1, speedInGear / gearSpan));
      this.playerRpm = 4500 + rpmFrac * 10500;

      const isCrashingWait = this.playerCrashWaitTimer > 0;
      if (isCrashingWait) {
        this.playerCrashWaitTimer = Math.max(0, this.playerCrashWaitTimer - dt);
        // Engine stalled from heavy impact - car is completely stopped
        this.playerSpeedKmh = Math.max(0, this.playerSpeedKmh - 220 * dt * 3.6);
        this.playerCar.setBraking(true);
        this.playerCar.updateSparks(50, true, dt);

        if (this.playerCrashWaitTimer <= 0) {
          // "once u crash immieadtly after ur car recovers u and the cpus have a 3 second protection shield so they dont keep getting stuck"
          this.playerProtectionShieldTimer = 3.0;
          this.playerSpeedKmh = 40;
        }
      }

      const effectiveThrottle = isCrashingWait ? 0 : input.throttle;
      const effectiveBrake = isCrashingWait ? 1.0 : input.brake;

      // Dynamic Slipstream / Tow Pocket Detection behind lead cars
      // "also add slipstream and stuff"
      this.slipstreamActive = false;
      this.slipstreamFactor = 0;
      if (this.playerSpeedKmh > 110 && this.raceState === 'racing') {
        for (const ai of this.aiCars) {
          if (ai.finished || ai.isCrashed || ai.isHiddenByPracticeFilter) continue;
          let deltaProgress = ai.progress - this.playerProgress;
          if (deltaProgress < -0.5) deltaProgress += 1.0;
          if (deltaProgress > 0.5) deltaProgress -= 1.0;
          const distMeters = deltaProgress * this.track.trackLength;
          // In the slipstream bubble: between 3.5m and 42m directly ahead
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

      // Aerodynamics & Power Balancing (Realistic F1 Top Speed and Acceleration):
      // "and also u made the car engines a bit too fast now its 600kmh like for example if some one has a 105 engine rating and i have a 115 engine rating my engine should be faster but not 2x faster just a bit faster"
      // Baseline terminal velocity scales realistically with engine rating:
      // Rating 80: ~326.5 km/h, Rating 95: ~339.2 km/h, Rating 105: ~347.8 km/h, Rating 115: ~356.3 km/h (~8.5 km/h difference: noticeable advantage without 2x hyper-distortion)
      const baseTerminalKmh = 318 + Math.max(0, this.enginePowerRating - 70) * 0.85;
      const drsBonus = this.drsActive ? 14 : 0;
      const boostBonus = (isBoosting ? 16 : 0) + (this.slipstreamActive ? 12 * this.slipstreamFactor : 0);
      const targetTerminalKmh = surface.offTrack ? 140 : (baseTerminalKmh + drsBonus + boostBonus);

      // Progressive acceleration punch: 0-100 in ~2.4s, 100-200 in ~2.8s
      const accelNorm = Math.max(0.2, (this.accelerationScore - 70) / 30);
      const powerScaling = 1.0 + Math.max(0, this.enginePowerRating - 75) * 0.007; // subtle punch scaling
      const baseAccel = (15.5 + accelNorm * 10.0) * powerScaling;

      // Available forward thrust tapers smoothly as vehicle approaches its terminal velocity
      const speedRatio = Math.min(1.05, this.playerSpeedKmh / Math.max(80, targetTerminalKmh));
      const availableThrust = Math.max(0, 1.0 - Math.pow(speedRatio, 2.2));
      const boostBonusRate = isBoosting ? 1.35 : 1.0;
      const slipstreamThrustBonus = this.slipstreamActive ? 2.5 * this.slipstreamFactor : 0;
      const forwardAccel = (baseAccel * availableThrust * boostBonusRate * gripMultiplier) + slipstreamThrustBonus;

      // Natural aerodynamic drag when exceeding terminal speed (e.g. exiting DRS zone or boost)
      const overspeedDrag = this.playerSpeedKmh > targetTerminalKmh
        ? Math.min(18.0, Math.pow((this.playerSpeedKmh - targetTerminalKmh) / 8, 1.8) * 1.6)
        : 0;

      if (effectiveThrottle > 0) {
        if (this.playerSpeedKmh < targetTerminalKmh) {
          this.playerSpeedKmh += forwardAccel * effectiveThrottle * dt * 3.6;
        } else {
          // Smooth aerodynamic equilibrium (prevents runaways to 600 km/h)
          this.playerSpeedKmh = Math.max(targetTerminalKmh, this.playerSpeedKmh - overspeedDrag * dt * 3.6);
        }
      } else {
        // Natural rolling coasting drag
        const coastDrag = (1.8 + (this.playerSpeedKmh / 350) * 4.5) * (surface.offTrack ? 3.0 : 1.0);
        this.playerSpeedKmh = Math.max(0, this.playerSpeedKmh - (coastDrag + overspeedDrag) * dt * 3.6);
      }

      if (effectiveBrake > 0) {
        // DISTINCT BRAKING POWER:
        // Mercedes (108) & McLaren (97) stop with hyper-bite; Haas (79) requires earlier braking
        const brakesNorm = Math.max(0.2, (this.brakesScore - 70) / 25);
        const brakePower = (18 + brakesNorm * 36) * gripMultiplier;
        this.playerSpeedKmh = Math.max(0, this.playerSpeedKmh - brakePower * effectiveBrake * dt * 3.6);
        this.playerCar.setBraking(true);
      } else {
        this.playerCar.setBraking(false);
      }

      this.playerSpeedKmh = Math.max(0, this.playerSpeedKmh);
    } else {
      // REVERSE GEAR
      this.playerRpm = 4800 + Math.abs(this.playerSpeedKmh) * 120;
      if (input.brake > 0) {
        if (this.playerSpeedKmh > -55) {
          this.playerSpeedKmh -= 18 * input.brake * dt * 3.6;
        }
      } else {
        this.playerSpeedKmh = Math.min(0, this.playerSpeedKmh + 15 * dt * 3.6);
      }
      this.playerCar.setBraking(false);
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

    if (Math.abs(this.playerSpeedKmh) > 1.0) {
      const dirSign = this.playerSpeedKmh >= 0 ? 1 : -1;
      this.playerHeading -= turnRate * dirSign;
    }

    this.playerCar.setSteerAngle(-steerInput * 0.38);
    this.playerCar.setWheelSpin(this.playerSpeedKmh, dt);

    // Compute Forward Vector from car heading
    const forwardX = -Math.sin(this.playerHeading);
    const forwardZ = -Math.cos(this.playerHeading);
    const forwardVec = new THREE.Vector3(forwardX, 0, forwardZ);

    // Continuous Sub-Stepping Movement & Solid Barrier Check (Guaranteed 100% Noclip Prevention):
    // "also there is a glitch that if i am going super fast and hit a wall i just noclip through it"
    // 5 sub-steps at high speeds ensure the vehicle never penetrates the Armco/Tecpro barrier
    const numSubSteps = Math.abs(this.playerSpeedKmh) > 180 ? 5 : Math.abs(this.playerSpeedKmh) > 70 ? 3 : 1;
    const subDt = dt / numSubSteps;

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

        const currentVel = forwardVec.clone().multiplyScalar(subSpeedMs);
        const normalVel = currentVel.dot(subSurface.wallNormal);

        // Impact speed into wall (direct normal impact or vehicle forward speed)
        const normalImpactSpeed = Math.abs(normalVel) * 3.6;
        const totalImpactSpeed = Math.abs(this.playerSpeedKmh);

        // Reliability impact resilience scaling:
        // "the more reliable an engine the harder the hits the car can take with out stalling but DONT make it fully immune to hits its just that it can survive like a light tap."
        const relFactor = Math.max(0, Math.min(1.0, ((this.engineReliability || 80) - 75) / 25));
        const wallSpeedStallThreshold = 14 + relFactor * 22; // 14 km/h (baseline) up to 36 km/h (~22 mph for a light tap/brush)
        const wallNormalStallThreshold = 3.5 + relFactor * 6.5; // 3.5 up to 10.0 km/h normal component
        const penetrationStallThreshold = 0.04 + relFactor * 0.04;

        const isWallCrash =
          totalImpactSpeed >= wallSpeedStallThreshold ||
          normalImpactSpeed >= wallNormalStallThreshold ||
          subSurface.penetration > penetrationStallThreshold ||
          absLateralDist >= barrierLimit - 0.08;

        if (isWallCrash && this.playerCrashWaitTimer <= 0 && this.playerProtectionShieldTimer <= 0) {
          const waitDuration = this.getCrashWaitDuration();
          this.playerCrashWaitTimer = waitDuration;
          this.playerCrashWaitMax = waitDuration;
          this.playerSpeedKmh = 0;
          this.playerCar.setBraking(true);
          soundEngine.playCrash(1.0);
          inputManager.rumble(1.0, 1.0, 400);
          this.collisionTrauma = 1.0;
          this.triggerYellowFlag(waitDuration + 2.0);
        } else if (this.playerCrashWaitTimer <= 0) {
          // Very low speed bump under 14 km/h
          if (normalVel < 0) {
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

        // Re-orient car heading safely along track tangent
        this.playerHeading = Math.atan2(-subSurface.tangent.x, -subSurface.tangent.z);
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

    // 4. Car-to-Car Collisions (Disabled in Qualifying Mode so player can drive right through all ghost cars)
    if (this.raceState === 'racing' && !this.isQualifyingMode) {
      this.handleCarCollisions(forwardVec, dt);
    }

    // Sync 3D Mesh
    this.playerCar.root.position.copy(this.playerPos);
    this.playerCar.root.rotation.y = this.playerHeading;

    const slope = surface.tangent.y;
    this.playerCar.root.rotation.x = -Math.asin(Math.max(-0.4, Math.min(0.4, slope)));
    this.playerCar.root.rotation.z = -input.steer * Math.min(0.08, (Math.abs(this.playerSpeedKmh) / 300) * 0.08);

    // Titanium Sparks
    this.playerCar.updateSparks(this.playerSpeedKmh, surface.onCurb, dt);

    if (surface.onCurb && Math.abs(this.playerSpeedKmh) > 35) {
      inputManager.rumble(0.4, 0.7, 50);
    }

    // Audio
    const lateralG = Math.abs(input.steer) * (Math.abs(this.playerSpeedKmh) / 140);
    const tireSlip = Math.min(1, lateralG * 0.5 + (surface.onCurb ? 0.3 : 0));
    const safeRpm = Number.isFinite(this.playerRpm) ? this.playerRpm : 5000;
    const safeSpeed = Number.isFinite(this.playerSpeedKmh) ? Math.abs(this.playerSpeedKmh) : 0;

    soundEngine.updateEngine(safeRpm, input.throttle, safeSpeed, isBoosting, tireSlip, surface.onCurb);

    // 5. Update AI Cars with Realistic Cornering Speeds, Braking, and Crash Incidents
    this.updateAICars(dt);

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

    this.telemetry = {
      speedKmh: Math.round(this.playerSpeedKmh),
      gear: this.playerGear === -1 ? 0 : this.playerGear,
      rpm: Math.round(safeRpm),
      maxRpm: 15000,
      throttle: input.throttle,
      brake: input.brake,
      steer: input.steer,
      ersBattery: Math.round(this.ersBattery),
      drsActive: this.drsActive,
      drsAvailable: this.playerSpeedKmh > 230,
      tireWear: Math.min(100, Math.round(this.playerLap * 8.5)),
      tireTemp: Math.round(85 + (safeSpeed / 350) * 25 + lateralG * 15),
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
    };
  }

  private handleCarCollisions(playerForward: THREE.Vector3, dt: number) {
    const pFwd = playerForward.clone().normalize();
    // 3 bounding spheres along player car length (Front, Cockpit, Rear)
    const pPts = [
      this.playerPos.clone().addScaledVector(pFwd, 1.65),
      this.playerPos.clone(),
      this.playerPos.clone().addScaledVector(pFwd, -1.65),
    ];
    const collisionThreshold = 2.55; // Firm 2.55m vehicle hull threshold

    for (const ai of this.aiCars) {
      if (ai.finished || ai.isHiddenByPracticeFilter) continue;

      // 3-SECOND PROTECTION SHIELD: If player or CPU recently recovered, protect against getting re-stuck!
      if (this.playerProtectionShieldTimer > 0 || ai.protectionShieldTimer > 0) {
        continue;
      }

      const aiFwd = new THREE.Vector3(-Math.sin(ai.heading), 0, -Math.cos(ai.heading)).normalize();
      const aiPts = [
        ai.pos.clone().addScaledVector(aiFwd, 1.65),
        ai.pos.clone(),
        ai.pos.clone().addScaledVector(aiFwd, -1.65),
      ];

      let minDist = Infinity;
      let contactNorm = new THREE.Vector3();

      for (const p of pPts) {
        for (const a of aiPts) {
          const diff = new THREE.Vector3().subVectors(p, a);
          diff.y = 0;
          const dist = diff.length();
          if (dist < minDist) {
            minDist = dist;
            contactNorm = diff;
          }
        }
      }

      if (minDist < collisionThreshold) {
        const penetration = collisionThreshold - minDist;
        const norm =
          contactNorm.length() > 0.001
            ? contactNorm.normalize()
            : new THREE.Vector3().subVectors(this.playerPos, ai.pos).normalize();

        const isTeammateCar = Boolean(this.teammateDriverId && ai.driver.id === this.teammateDriverId);

        // 1. SOLID PHYSICAL PUSHBACK: Prevents any car-to-car noclipping!
        this.playerPos.addScaledVector(norm, penetration * 0.55);
        ai.pos.addScaledVector(norm, -penetration * 0.55);
        ai.lateralOffset += -norm.x * penetration * 0.5;

        // "put like a thing so i know who is my teammate so i dont crash in to them"
        // Teammate Anti-Wrecking Safety Protocol:
        if (isTeammateCar) {
          // Soft elastic buffer: smooth pushback without heavy crash stall penalty!
          this.playerSpeedKmh = Math.max(20, this.playerSpeedKmh - 10);
          ai.speedKmh = Math.max(20, ai.speedKmh - 6);
          soundEngine.playCrash(0.3);
          inputManager.rumble(0.3, 0.4, 80);
          continue;
        }

        // 2. Impact speed analysis
        const relSpeedKmh = Math.abs(this.playerSpeedKmh - ai.speedKmh);
        const playerVel = pFwd.clone().multiplyScalar(this.playerSpeedKmh / 3.6);
        const aiVel = aiFwd.clone().multiplyScalar(ai.speedKmh / 3.6);
        const closingSpeedKmh = Math.abs(playerVel.sub(aiVel).dot(norm)) * 3.6;

        // Reliability resilience for car-to-car impacts:
        // "the more reliable an engine the harder the hits the car can take with out stalling but DONT make it fully immune to hits its just that it can survive like a light tap."
        const relFactor = Math.max(0, Math.min(1.0, ((this.engineReliability || 80) - 75) / 25));
        const carRelSpeedStallThreshold = 22 + relFactor * 16; // 22 -> 38 km/h
        const carClosingStallThreshold = 14 + relFactor * 14; // 14 -> 28 km/h

        const isHardImpact =
          relSpeedKmh >= carRelSpeedStallThreshold ||
          closingSpeedKmh >= carClosingStallThreshold ||
          (Math.abs(this.playerSpeedKmh) > 42 && minDist < collisionThreshold * 0.90);

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
        } else {
          // Moderate bump / wheel-rubbing (solid elastic deflection without stall penalty)
          this.playerSpeedKmh = Math.max(12, this.playerSpeedKmh - 14);
          ai.speedKmh = Math.max(12, ai.speedKmh - 14);
          soundEngine.playCrash(0.35);
          inputManager.rumble(0.4, 0.6, 80);
          this.collisionTrauma = Math.min(1.0, this.collisionTrauma + 0.3);
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

    for (const ai of this.aiCars) {
      if (ai.isHiddenByPracticeFilter) {
        ai.builtCar.root.visible = false;
        continue;
      }
      if (ai.finished) continue;

      // In Qualifying Mode: hide ghost cars during countdown and for the first 3.5 seconds of the lap, then reveal them
      if (this.isQualifyingMode) {
        ai.builtCar.root.visible = this.raceState === 'racing' && this.raceTimer >= 3.5;
      } else {
        ai.builtCar.root.visible = true;
      }

      // Tick AI 3-second protection shield
      if (ai.protectionShieldTimer > 0) {
        ai.protectionShieldTimer = Math.max(0, ai.protectionShieldTimer - dt);
      }

      // Legend & Car Tier scaling: Tier 1 (Red Bull, McLaren, Ferrari) gets additional performance boost
      // "make legend mode significantly harder"
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
          // Return to track centerline
          ai.lateralOffset = (Math.random() - 0.5) * 3.0;
          ai.speedKmh = 50;
          ai.protectionShieldTimer = 3.0;
        }
        continue;
      }

      // Realistic Cornering Target Speed based on track curvature & team car profiles
      const cornerBaseKmh = this.track.getTargetCornerSpeedKmh(ai.progress);

      // DISTINCT AI PERFORMANCE & CUSTOMER PU INTEGRATION (Uncapped stats):
      const isTeammateCar = Boolean(this.teammateDriverId && ai.driver.id === this.teammateDriverId);
      // Check if this AI car's team is supplied by the player's manufactured engine!
      const isPlayerCustomerTeam = Boolean(
        this.customTeamConfig?.customerTeamsSupplied?.includes(ai.team.id)
      );
      
      let effectiveEnginePower = ai.team.carProfile?.topSpeedRating || (80 + (4 - ai.team.performanceTier) * 5);
      let effectiveAccel = ai.team.carProfile?.acceleration || (80 + (4 - ai.team.performanceTier) * 5);
      let handlingRating = ai.team.carProfile?.handlingRating || (80 + (4 - ai.team.performanceTier) * 5);
      let aeroRating = ai.team.carProfile?.aeroDownforce || 82;

      // "also remember my team mates car is the exact same as mine"
      if (isTeammateCar) {
        effectiveEnginePower = this.enginePowerRating;
        effectiveAccel = this.accelerationScore;
        handlingRating = this.handlingScore;
        aeroRating = this.downforceScore;
      } else if (isPlayerCustomerTeam) {
        effectiveEnginePower = this.customTeamConfig?.enginePower || 105;
        effectiveAccel = 80 + ((this.customTeamConfig?.enginePower || 105) - 80) * 0.8;
      }

      // Straightaway top speed based on engine power rating + dynamic race-day form:
      // "dont always make max verstappen win make other people win too"
      // Top drivers (Norris, Leclerc, Hamilton, Piastri, Russell, Sainz, Alonso, Verstappen) have balanced championship parity
      const formBoost = ai.raceFormPace || 0;
      const straightTopSpeed = (318 + Math.max(0, effectiveEnginePower - 70) * 0.85 + formBoost * 0.3) * difficultyScale;
      // High-speed cornering grip bonus based on handling, aero downforce, and driver skill:
      const cornerBonus = ((handlingRating - 78) * 1.8 + (aeroRating - 78) * 1.5 + (ai.driver.rating - 78) * 0.8 + formBoost * 0.4) * difficultyScale;
      let targetCornerSpeed = Math.max(75, cornerBaseKmh + cornerBonus);

      // On straightaways (cornerBaseKmh >= 350), car unleashed to straightTopSpeed!
      // In bends & corners, governed by targetCornerSpeed:
      let desiredSpeed = cornerBaseKmh >= 350 ? straightTopSpeed : Math.min(straightTopSpeed, targetCornerSpeed);

      // TEAMMATE STRATEGY EXECUTION:
      // "allow me to make stratagies and like for example my teammate is in a higher or lower position then me and i tell him to block for me like block other players for me and yield his position some drivers will listen some wont add like a listening rating or something"
      if (isTeammateCar) {
        if (this.teammateStrategy === 'yield') {
          // If teammate is ahead of player, lift throttle and move to side of track so player passes cleanly!
          let pProgDiff = this.playerProgress - ai.progress;
          if (pProgDiff < -0.5) pProgDiff += 1.0;
          if (pProgDiff > 0.5) pProgDiff -= 1.0;
          const distBehindPlayer = -pProgDiff * this.track.trackLength;
          if (distBehindPlayer > 0 && distBehindPlayer < 55) {
            desiredSpeed = Math.min(desiredSpeed, Math.max(70, Math.abs(this.playerSpeedKmh) - 25));
            ai.targetOffset = ai.lateralOffset >= 0 ? 6.5 : -6.5; // yield line
          }
        } else if (this.teammateStrategy === 'block') {
          // Teammate actively executes team blocking orders:
          // "also make it so that if my team mate actually listens to what i tell him he actually does the thing for example i tell to block for me he actually blocks"
          let pProgDiff = this.playerProgress - ai.progress;
          if (pProgDiff < -0.5) pProgDiff += 1.0;
          if (pProgDiff > 0.5) pProgDiff -= 1.0;
          const distBehindPlayer = pProgDiff * this.track.trackLength;

          if (distBehindPlayer < -1.8) {
            // Teammate is ahead of player: yield line into turn to let player pass, then slot behind to block
            desiredSpeed = Math.min(desiredSpeed, Math.max(65, Math.abs(this.playerSpeedKmh) - 15));
            ai.targetOffset = ai.lateralOffset >= 0 ? 5.5 : -5.5;
          } else {
            // Teammate is behind player: actively detect trailing rival and mirror their racing line to block them!
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
              // Actively mirror rival's lateral offset so they cannot slipstream or dive down the inside!
              ai.targetOffset = THREE.MathUtils.clamp(closestRival.lateralOffset, -7.0, 7.0);
              // Reduce speed by 18% to form a rolling DRS roadblock that backs up the chasing pack!
              desiredSpeed = Math.min(desiredSpeed, desiredSpeed * 0.82);
            } else {
              // Guard the centerline
              ai.targetOffset = 0;
              desiredSpeed = Math.min(desiredSpeed, desiredSpeed * 0.88);
            }
          }
        } else if (this.teammateStrategy === 'push') {
          // Attack mode: extra 12 km/h and aggressive overtaking
          desiredSpeed = Math.min(straightTopSpeed + 15, desiredSpeed + 12);
        }
      }

      // Yellow flag compliance: slow down by 18% when caution is active
      if (this.yellowFlagActive) {
        desiredSpeed *= 0.82;
      }

      // FLUID RACING AI & ENHANCED CRASH AVOIDANCE:
      // In Qualifying Ghost Mode, cars pass right through each other without obstacle braking or spin-outs
      let activeEvasiveSteer = 0;
      let directlyBlockedCarSpeed: number | null = null;
      let minDistanceToCarAhead = Infinity;
      const trackBarrierLimit = (this.track.barrierLimit || 18.4) - 2.0;

      if (!this.isQualifyingMode) {
        // 1. Proactively avoid Player Car (Lookahead up to 68 meters, early deceleration & fluid evasion)
        let playerDeltaProg = this.playerProgress - ai.progress;
        if (playerDeltaProg < -0.5) playerDeltaProg += 1.0;
        if (playerDeltaProg > 0.5) playerDeltaProg -= 1.0;
        const playerForwardM = playerDeltaProg * this.track.trackLength;
        const playerLatOffset = this.track.checkSurfaceType(this.playerPos, this.playerProgress).lateralOffset;
        const playerLatDiff = playerLatOffset - ai.lateralOffset;
        const playerRealSpeed = Math.abs(this.playerSpeedKmh);
        const isPlayerHazard = this.playerCrashWaitTimer > 0 || playerRealSpeed < 50;
        const isPlayerTeammate = Boolean(this.teammateDriverId && ai.driver.id === this.teammateDriverId);

        // Scan up to 68 meters ahead for player car (extra lookahead for high-speed safety)
        if (playerForwardM > 0.3 && playerForwardM < 68.0 && Math.abs(playerLatDiff) < 4.2) {
          // Optimal evasion lane (favor open track side away from barriers)
          let evadeDir = playerLatDiff >= 0 ? -1 : 1;
          if (ai.lateralOffset < -trackBarrierLimit + 3.0) evadeDir = 1;
          if (ai.lateralOffset > trackBarrierLimit - 3.0) evadeDir = -1;

          const proximity = Math.max(0.25, 1.0 - playerForwardM / 68.0);
          // Extra respectful clearance for teammate so player and teammate never collide
          const steerStrength = isPlayerTeammate ? 16.0 : 13.0;
          activeEvasiveSteer += evadeDir * (steerStrength * proximity);
          minDistanceToCarAhead = Math.min(minDistanceToCarAhead, playerForwardM);

          // Proactive, progressive deceleration curve (no abrupt spikes, early speed matching)
          if (ai.speedKmh > playerRealSpeed) {
            const safeSpeed = Math.max(isPlayerHazard ? 25 : 55, playerRealSpeed + Math.max(0, playerForwardM - 7.0) * 3.8);
            directlyBlockedCarSpeed = Math.min(directlyBlockedCarSpeed ?? Infinity, safeSpeed);
          }
        } else if (Math.abs(playerForwardM) <= 5.5 && Math.abs(playerLatDiff) < 3.2) {
          // Side-by-side room courtesy
          const sideDir = playerLatDiff >= 0 ? -1 : 1;
          activeEvasiveSteer += sideDir * (isPlayerTeammate ? 9.0 : 6.5);
        }

        // 2. Proactively avoid & smoothly weave around other CPU cars
        for (const otherAi of this.aiCars) {
          if (otherAi.driver.id === ai.driver.id || otherAi.finished) continue;
          let aiDeltaProg = otherAi.progress - ai.progress;
          if (aiDeltaProg < -0.5) aiDeltaProg += 1.0;
          if (aiDeltaProg > 0.5) aiDeltaProg -= 1.0;
          const aiForwardM = aiDeltaProg * this.track.trackLength;
          const aiLatDiff = otherAi.lateralOffset - ai.lateralOffset;
          const otherIsHazard = otherAi.isSpinning || otherAi.isCrashed || otherAi.speedKmh < 50;

          if (aiForwardM > 0.3 && aiForwardM < 62.0 && Math.abs(aiLatDiff) < 4.0) {
            let evadeDir = aiLatDiff >= 0 ? -1 : 1;
            if (ai.lateralOffset < -trackBarrierLimit + 3.0) evadeDir = 1;
            if (ai.lateralOffset > trackBarrierLimit - 3.0) evadeDir = -1;

            const proximity = Math.max(0.25, 1.0 - aiForwardM / 62.0);
            activeEvasiveSteer += evadeDir * (12.0 * proximity);
            minDistanceToCarAhead = Math.min(minDistanceToCarAhead, aiForwardM);

            // If the car ahead is the player's teammate executing a team BLOCK order, hold up the rival!
            const isOtherBlockingTeammate = Boolean(
              this.teammateDriverId &&
              otherAi.driver.id === this.teammateDriverId &&
              this.teammateStrategy === 'block'
            );

            if (isOtherBlockingTeammate) {
              // Rival cannot easily blast past the defensive line: forced to check up and brake!
              const blockedSpeed = Math.min(otherAi.speedKmh * 0.94, Math.max(45, ai.speedKmh * 0.88));
              directlyBlockedCarSpeed = Math.min(directlyBlockedCarSpeed ?? Infinity, blockedSpeed);
            } else if (ai.speedKmh > otherAi.speedKmh) {
              const safeSpeed = Math.max(otherIsHazard ? 25 : 55, otherAi.speedKmh + Math.max(0, aiForwardM - 6.0) * 3.8);
              directlyBlockedCarSpeed = Math.min(directlyBlockedCarSpeed ?? Infinity, safeSpeed);
            }
          } else if (Math.abs(aiForwardM) <= 5.2 && Math.abs(aiLatDiff) < 2.8) {
            const sideDir = aiLatDiff >= 0 ? -1 : 1;
            activeEvasiveSteer += sideDir * 6.0;
          }
        }
      }

      // Smoothly feather speed when approaching slower traffic
      if (directlyBlockedCarSpeed !== null) {
        desiredSpeed = Math.min(desiredSpeed, directlyBlockedCarSpeed);
      }

      // Realistic Acceleration vs Progressive Braking
      if (ai.speedKmh < desiredSpeed) {
        const powerCurve = Math.max(0.30, 1.0 - (ai.speedKmh / (straightTopSpeed + 35)) * 0.58);
        const aiAccelNorm = Math.max(0.25, (effectiveAccel - 70) / 25);
        const aiAccelMultiplier = (this.difficulty === 'legend' ? 26.0 : 18.0) * aiAccelNorm;
        ai.speedKmh += aiAccelMultiplier * powerCurve * dt * 3.6;
        ai.builtCar.setBraking(false);
      } else {
        // Responsive racing line and obstacle braking
        const isBrakingForObstacle = directlyBlockedCarSpeed !== null && minDistanceToCarAhead < 30.0;
        const baseBrake = isBrakingForObstacle ? 52.0 : (this.difficulty === 'legend' ? 42.0 : 32.0);
        ai.speedKmh -= baseBrake * dt * 3.6;
        ai.builtCar.setBraking(true);

        if (directlyBlockedCarSpeed !== null && minDistanceToCarAhead < 4.5) {
          ai.speedKmh = Math.max(25, Math.min(ai.speedKmh, directlyBlockedCarSpeed));
        }
      }

      // AI Crash / Mistake / Lock-up Simulation (Disabled in Qualifying Ghost Mode)
      const isHardCorner = cornerBaseKmh < 150;
      if (!this.isQualifyingMode && isHardCorner && !ai.isSpinning && !ai.isCrashed && (this.raceTimer > 1.5 || this.countdownTimer > 2.0)) {
        const difficultyMistakeDamp = this.difficulty === 'legend' ? 0.20 : this.difficulty === 'pro' ? 0.75 : 1.25;
        const mistakeChance = ((100 - ai.driver.rating) * 0.00025 + ai.driver.aggression * 0.0014) * difficultyMistakeDamp * dt;
        if (Math.random() < mistakeChance) {
          if (Math.random() < 0.20) {
            ai.isSpinning = true;
            ai.spinTimer = 2.0 + Math.random() * 1.2;
            this.triggerYellowFlag(4.0);
            soundEngine.playCrash(0.45);
          } else {
            ai.targetOffset += (Math.random() > 0.5 ? 1.5 : -1.5);
            ai.speedKmh = Math.max(40, ai.speedKmh - 12);
            ai.builtCar.updateSparks(60, true, dt);
          }
        }
      }

      // ULTRA-FLUID RACING LINE & DISTINCT PER-DRIVER TRAJECTORIES:
      // Smoothly blend evasive offsets over time instead of single-frame step jumps
      const desiredEvasive = activeEvasiveSteer !== 0 ? Math.max(-4.0, Math.min(4.0, activeEvasiveSteer * 0.22)) : 0;
      ai.smoothEvasiveOffset = THREE.MathUtils.lerp(ai.smoothEvasiveOffset || 0, desiredEvasive, Math.min(1.0, dt * 5.0));

      // Each driver follows their own distinct racing line (unique baseline bias, apex swing amplitude, frequency, and phase)
      const driverLineBias = ai.lineBias ?? ai.targetOffset;
      const primaryApexWave = Math.sin(ai.progress * Math.PI * (ai.apexFreq || 6.0) + (ai.apexPhase || 0)) * (ai.apexAmplitude || 2.5);
      const secondaryCornerWave = Math.cos(ai.progress * Math.PI * 10.0 + (ai.driver.number * 1.3)) * 1.35;
      let targetLateral = driverLineBias + primaryApexWave + secondaryCornerWave + (ai.smoothEvasiveOffset || 0);
      targetLateral = Math.max(-trackBarrierLimit, Math.min(trackBarrierLimit, targetLateral));

      // Silky-smooth critically damped spring transition (ultra-fluid, zero jerk or stepping)
      const latDiff = targetLateral - ai.lateralOffset;
      const springStiffness = this.difficulty === 'legend' ? 14.0 : 11.5;
      const dampingCoeff = this.difficulty === 'legend' ? 7.2 : 6.5;
      const springAccel = latDiff * springStiffness - (ai.smoothLateralVel || 0) * dampingCoeff;
      ai.smoothLateralVel = (ai.smoothLateralVel || 0) + springAccel * dt;
      ai.smoothLateralVel = Math.max(-4.2, Math.min(4.2, ai.smoothLateralVel));
      ai.lateralOffset += ai.smoothLateralVel * dt;
      ai.lateralOffset = Math.max(-trackBarrierLimit - 0.5, Math.min(trackBarrierLimit + 0.5, ai.lateralOffset));

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
        ai.speedKmh = Math.max(20, ai.speedKmh * 0.7);
      }

      // Position in 3D world
      const pt = this.track.getTrackPointAtProgress(ai.progress);
      const normal = pt.normal;
      ai.pos.copy(pt.position).addScaledVector(normal, ai.lateralOffset);
      ai.pos.y = pt.position.y + 0.08;

      // PURE PURSUIT LOOKAHEAD TRAJECTORY (Dynamic Lookahead for ultra-fluid, natural cornering arcs):
      // Instead of deriving heading only from the instant spline tangent beneath the centroid,
      // project forward to a target point 10m to 26m ahead along the racing line.
      const lookaheadMeters = THREE.MathUtils.clamp((ai.speedKmh / 320) * 24.0, 10.0, 26.0);
      const lookaheadProg = (ai.progress + lookaheadMeters / this.track.trackLength) % 1.0;
      const ptAhead = this.track.getTrackPointAtProgress(lookaheadProg);
      const aheadLateral = THREE.MathUtils.clamp(targetLateral * 0.85, -trackBarrierLimit, trackBarrierLimit);
      const targetWorldPos = ptAhead.position.clone().addScaledVector(ptAhead.normal, aheadLateral);

      // Smooth forward trajectory vector from current position to lookahead point
      const dirX = targetWorldPos.x - ai.pos.x;
      const dirZ = targetWorldPos.z - ai.pos.z;
      const naturalHeading = Math.atan2(-dirX, -dirZ);

      // Smooth yaw rotation towards target heading with angle normalization to [-PI, PI]
      let headingDelta = naturalHeading - ai.heading;
      while (headingDelta > Math.PI) headingDelta -= Math.PI * 2;
      while (headingDelta < -Math.PI) headingDelta += Math.PI * 2;

      const headingDamping = this.difficulty === 'legend' ? 12.0 : 9.5;
      ai.heading += headingDelta * Math.min(1.0, dt * headingDamping);

      // Realistic front-wheel steering angle based on curvature and lateral transition:
      const targetSteerAngle = THREE.MathUtils.clamp(headingDelta * 2.8, -0.65, 0.65);
      ai.steerAngle = (ai.steerAngle || 0) + (targetSteerAngle - (ai.steerAngle || 0)) * Math.min(1.0, dt * 14.0);

      // Organic chassis suspension dynamics: body roll into turns and pitch under acceleration/braking
      const speedFactor = Math.min(1.0, ai.speedKmh / 240);
      const targetRoll = -ai.steerAngle * 0.16 * speedFactor;
      ai.rollAngle = (ai.rollAngle || 0) + (targetRoll - (ai.rollAngle || 0)) * Math.min(1.0, dt * 10.0);

      const isBraking = ai.speedKmh > desiredSpeed + 4;
      const isAccelerating = ai.speedKmh < desiredSpeed - 4 && ai.speedKmh > 30;
      const targetPitch = isBraking ? 0.022 : (isAccelerating ? -0.012 : 0);
      ai.pitchAngle = (ai.pitchAngle || 0) + (targetPitch - (ai.pitchAngle || 0)) * Math.min(1.0, dt * 8.0);

      // Set root position & rotation using 3D Euler angles (pitch, yaw, roll)
      ai.builtCar.root.position.copy(ai.pos);
      ai.builtCar.root.rotation.set(ai.pitchAngle || 0, ai.heading, ai.rollAngle || 0, 'YXZ');

      ai.builtCar.setSteerAngle(-ai.steerAngle * 1.1);
      ai.builtCar.setWheelSpin(ai.speedKmh, dt);
    }

    // AI-to-AI separation (Fluid soft physical pushback projected onto track normal velocity)
    for (let i = 0; i < this.aiCars.length; i++) {
      const a = this.aiCars[i];
      if (a.finished) continue;
      for (let j = i + 1; j < this.aiCars.length; j++) {
        const b = this.aiCars[j];
        if (b.finished) continue;
        const diff = new THREE.Vector3().subVectors(a.pos, b.pos);
        diff.y = 0;
        const d = diff.length();
        if (d < 3.4 && d > 0.05) {
          const push = (3.4 - d) * 0.55;
          const n = diff.normalize();

          // Project push along the track normal to smoothly deflect lateral velocity without position jumping
          const ptA = this.track.getTrackPointAtProgress(a.progress);
          const latPush = n.dot(ptA.normal);
          const pushVel = (latPush >= 0 ? 1 : -1) * push * 3.5;
          a.smoothLateralVel = (a.smoothLateralVel || 0) + pushVel * dt * 8.0;
          b.smoothLateralVel = (b.smoothLateralVel || 0) - pushVel * dt * 8.0;

          if (a.protectionShieldTimer > 0 || b.protectionShieldTimer > 0) {
            a.smoothLateralVel += pushVel * dt * 12.0;
            b.smoothLateralVel -= pushVel * dt * 12.0;
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

  public resetPlayer() {
    const { position, tangent } = this.track.getTrackPointAtProgress(this.playerProgress);
    this.playerPos.copy(position);
    this.playerPos.y = position.y + 0.08;
    this.playerHeading = Math.atan2(-tangent.x, -tangent.z);
    this.playerSpeedKmh = 45;
    this.playerGear = 2;
    this.playerCar.root.position.copy(this.playerPos);
    this.playerCar.root.rotation.y = this.playerHeading;
  }
}
