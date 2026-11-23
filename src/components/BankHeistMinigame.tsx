import React, { useEffect, useRef, useState } from 'react';
import {
  buildBuildingFloorplan,
  BuildingFloorplan,
  ElevatorPortal,
  FloorActivitySpec,
  FloorNpcSpec,
  HeistFloorData,
  HeistFloorId,
  VaultSpec,
  WallRect,
} from './heistFloorplans';
import { InteriorMiniGameModal, InteriorMinigameKind } from './InteriorMiniGames';
import type { HouseExteriorProfile } from '../game/cityTrafficBuilder';
import { HOME_FURNISHINGS_CATALOG } from '../game/homeFurnishings';

export interface BankMinigameTargetInfo {
  id: string;
  name: string;
  category?: 'BANK' | 'JEWELRY' | 'STORE' | 'HOUSE' | 'SERVICE' | 'POLICE' | 'BUILDING';
  buildingHeight?: number;
  buildingStories?: number;
  payoutCash: number;
  streetLocation: string;
  icon: string;
  hidePayoutUntilStolen?: boolean;
  policeBreach?: boolean;
  breachReason?: string;
  breachDelaySec?: number;
  mode?: 'heist' | 'explore';
  isOwnedHouse?: boolean;
  exteriorProfile?: HouseExteriorProfile;
}

interface BankHeistMinigameProps {
  target: BankMinigameTargetInfo;
  streetCash?: number;
  furnishings?: string[];
  onBuyHouseItem?: (itemId: string) => void;
  onAwardExploreCash?: (delta: number, label: string) => void;
  onSuccess: (stolenCashOverride?: number) => void;
  onCaptured: () => void;
  onAbort: () => void;
}

interface SecurityBot {
  id: number;
  floor: HeistFloorId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  facing: number;
  fireCooldown: number;
  patrolAnchorX: number;
  patrolAnchorY: number;
  patrolPhase: number;
  hitFlash: number;
  walkCycle: number;
  stairTimer: number;
  role: 'GUARD' | 'CAPTAIN' | 'POLICE';
}

interface Bolt {
  floor: HeistFloorId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromPlayer: boolean;
  life: number;
}

interface Spark {
  floor: HeistFloorId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface RuntimeVault extends VaultSpec {
  unlocked: boolean;
  looted: boolean;
  openProgress: number;
}

const CANVAS_W = 800;
const CANVAS_H = 520;
const PLAYER_RADIUS = 13;
const BOT_RADIUS = 14;

function formatFloorTag(f: HeistFloorId): string {
  return f === 0 ? 'B1' : `${f}F`;
}

function playRetroTone(
  freq: number,
  endFreq: number,
  durationSec: number,
  type: OscillatorType = 'square',
  gainPeak = 0.08
) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const winAny = window as unknown as { __bankMinigameAudioCtx?: AudioContext };
    if (!winAny.__bankMinigameAudioCtx) {
      winAny.__bankMinigameAudioCtx = new AudioCtx();
    }
    const ctx = winAny.__bankMinigameAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + durationSec);
    gain.gain.setValueAtTime(gainPeak, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec);
  } catch {
    // Ignore audio errors
  }
}

function circleIntersectsRect(cx: number, cy: number, r: number, rect: WallRect): boolean {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}

function resolveCircleRect(
  cx: number,
  cy: number,
  r: number,
  rect: WallRect
): { x: number; y: number; hit: boolean } {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= r * r) {
    return { x: cx, y: cy, hit: false };
  }
  if (distSq > 0.0001) {
    const dist = Math.sqrt(distSq);
    const push = r - dist;
    return {
      x: cx + (dx / dist) * push,
      y: cy + (dy / dist) * push,
      hit: true,
    };
  }
  const leftPen = cx - rect.x;
  const rightPen = rect.x + rect.w - cx;
  const topPen = cy - rect.y;
  const botPen = rect.y + rect.h - cy;
  const minPen = Math.min(leftPen, rightPen, topPen, botPen);
  if (minPen === leftPen) return { x: rect.x - r, y: cy, hit: true };
  if (minPen === rightPen) return { x: rect.x + rect.w + r, y: cy, hit: true };
  if (minPen === topPen) return { x: cx, y: rect.y - r, hit: true };
  return { x: cx, y: rect.y + rect.h + r, hit: true };
}

function hasLineOfSight(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obstacles: WallRect[],
  lockedVaultDoors: { x: number; y: number; w: number; h: number }[]
): boolean {
  const steps = 16;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    for (let w = 0; w < obstacles.length; w++) {
      const obs = obstacles[w];
      if (px >= obs.x && px <= obs.x + obs.w && py >= obs.y && py <= obs.y + obs.h) {
        return false;
      }
    }
    for (let d = 0; d < lockedVaultDoors.length; d++) {
      const vd = lockedVaultDoors[d];
      if (px >= vd.x && px <= vd.x + vd.w && py >= vd.y && py <= vd.y + vd.h) {
        return false;
      }
    }
  }
  return true;
}

function findNextWaypointToward(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  floorData: HeistFloorData,
  lockedVaultDoors: { x: number; y: number; w: number; h: number }[]
): { x: number; y: number } {
  if (hasLineOfSight(sx, sy, tx, ty, floorData.obstacles, lockedVaultDoors)) {
    return { x: tx, y: ty };
  }
  const wps = floorData.waypoints;
  if (wps.length === 0) return { x: tx, y: ty };

  let startBest = -1;
  let startBestD = Infinity;
  const startVisible: number[] = [];
  const endVisible = new Set<number>();

  for (let i = 0; i < wps.length; i++) {
    const w = wps[i];
    const ds = Math.hypot(w.x - sx, w.y - sy);
    if (ds < startBestD) {
      startBestD = ds;
      startBest = i;
    }
    if (hasLineOfSight(sx, sy, w.x, w.y, floorData.obstacles, lockedVaultDoors)) {
      startVisible.push(i);
    }
    if (hasLineOfSight(w.x, w.y, tx, ty, floorData.obstacles, lockedVaultDoors)) {
      endVisible.add(i);
    }
  }
  if (startVisible.length === 0 && startBest !== -1) startVisible.push(startBest);
  if (endVisible.size === 0) {
    let endBest = 0;
    let endBestD = Infinity;
    for (let i = 0; i < wps.length; i++) {
      const de = Math.hypot(wps[i].x - tx, wps[i].y - ty);
      if (de < endBestD) {
        endBestD = de;
        endBest = i;
      }
    }
    endVisible.add(endBest);
  }

  const prev = new Int32Array(wps.length).fill(-1);
  const visited = new Uint8Array(wps.length);
  const queue: number[] = [];
  for (const sIdx of startVisible) {
    visited[sIdx] = 1;
    queue.push(sIdx);
  }
  let found = -1;
  for (let qi = 0; qi < queue.length; qi++) {
    const u = queue[qi];
    if (endVisible.has(u)) {
      found = u;
      break;
    }
    for (let v = 0; v < wps.length; v++) {
      if (visited[v]) continue;
      if (hasLineOfSight(wps[u].x, wps[u].y, wps[v].x, wps[v].y, floorData.obstacles, lockedVaultDoors)) {
        visited[v] = 1;
        prev[v] = u;
        queue.push(v);
      }
    }
  }

  if (found === -1) {
    return wps[startVisible[0] ?? 0] ?? { x: tx, y: ty };
  }
  let cur = found;
  while (prev[cur] !== -1) {
    cur = prev[cur];
  }
  return wps[cur];
}

function getBotCountForPayout(payoutCash: number, maxAvailable: number): number {
  let count = 2;
  if (payoutCash >= 45000) count = 8;
  else if (payoutCash >= 30000) count = 6;
  else if (payoutCash >= 22000) count = 5;
  else if (payoutCash >= 15000) count = 4;
  else if (payoutCash >= 10000) count = 3;
  return Math.min(maxAvailable, count);
}

function getHouseAlarmDelaySec(botCount: number): number {
  const clamped = Math.min(8, Math.max(2, botCount));
  return Math.round(20 - ((clamped - 2) / 6) * 10);
}

export const BankHeistMinigame: React.FC<BankHeistMinigameProps> = ({
  target,
  streetCash = 0,
  furnishings = [],
  onBuyHouseItem,
  onAwardExploreCash,
  onSuccess,
  onCaptured,
  onAbort,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const callbacksRef = useRef({ onSuccess, onCaptured, onAbort, onAwardExploreCash });
  callbacksRef.current = { onSuccess, onCaptured, onAbort, onAwardExploreCash };

  const isExploreMode = target.mode === 'explore';
  const [activeMiniGame, setActiveMiniGame] = useState<InteriorMinigameKind | null>(null);
  const activeMiniGameRef = useRef<InteriorMinigameKind | null>(null);
  activeMiniGameRef.current = activeMiniGame;

  const [showFurnishShop, setShowFurnishShop] = useState(false);
  const showFurnishShopRef = useRef(false);
  showFurnishShopRef.current = showFurnishShop;

  const [elevatorMenu, setElevatorMenu] = useState<{
    label: string;
    currentFloor: HeistFloorId;
    availableFloors: HeistFloorId[];
    floorNames: Record<number, string>;
    selectedFloor: HeistFloorId;
    typedDigits: string;
  } | null>(null);
  const elevatorMenuRef = useRef(elevatorMenu);
  elevatorMenuRef.current = elevatorMenu;
  const elevatorSelectRef = useRef<(targetFloor: HeistFloorId) => void>(() => {});
  const elevatorCancelRef = useRef<() => void>(() => {});

  const furnishingsKey = furnishings.join('|');
  const furnishingsRef = useRef<string[]>(furnishings);
  furnishingsRef.current = furnishings;

  const [exploreMessage, setExploreMessage] = useState<string | null>(null);

  const initialPlan: BuildingFloorplan = buildBuildingFloorplan({
    id: target.id,
    name: target.name,
    category: target.category,
    buildingHeight: target.buildingHeight,
    buildingStories: target.buildingStories,
    payoutCash: target.payoutCash,
    exteriorProfile: target.exteriorProfile,
    furnishings,
  });
  const floorplanRef = useRef<BuildingFloorplan>(initialPlan);

  const initialBotCount = isExploreMode ? 0 : getBotCountForPayout(target.payoutCash, initialPlan.botSpawns.length);
  const initialBreachDelaySec =
    target.breachDelaySec ??
    (target.category === 'HOUSE' ? getHouseAlarmDelaySec(initialBotCount) : 2.5);

  const [hudState, setHudState] = useState<{
    hp: number;
    maxHp: number;
    botsAlive: number;
    totalBots: number;
    botsByFloor: Record<HeistFloorId, number>;
    currentFloor: HeistFloorId;
    availableFloors: HeistFloorId[];
    floorName: string;
    archetypeLabel: string;
    vaultSummaries: { id: string; floor: HeistFloorId; label: string; unlocked: boolean; looted: boolean; cashShare: number }[];
    collectedCash: number;
    phase: 'playing' | 'knockout' | 'capture' | 'won';
    bannerText: string;
    regenActive: boolean;
    policeBreachActive: boolean;
    breachSecondsLeft: number | null;
    policeBreachCount: number;
    nearbyNpc: FloorNpcSpec | null;
    nearbyActivity: FloorActivitySpec | null;
  }>({
    hp: 100,
    maxHp: 100,
    botsAlive: initialBotCount,
    totalBots: initialBotCount,
    botsByFloor: Object.fromEntries(initialPlan.availableFloors.map((f) => [f, 0])) as Record<HeistFloorId, number>,
    currentFloor: initialPlan.playerSpawn.floor,
    availableFloors: initialPlan.availableFloors,
    floorName: (initialPlan.floorsById[initialPlan.playerSpawn.floor] || initialPlan.floorsById[1])!.floorName,
    archetypeLabel: initialPlan.archetypeLabel,
    vaultSummaries: initialPlan.vaults.map((v) => ({
      id: v.id,
      floor: v.floor,
      label: v.label,
      unlocked: false,
      looted: false,
      cashShare: v.cashShare,
    })),
    collectedCash: 0,
    phase: 'playing',
    bannerText: isExploreMode
      ? target.isOwnedHouse
        ? `🏡 WELCOME HOME! EXPLORE FLOORS, CHILL ON THE SOFA, OR PLAY MINI-GAMES!`
        : `🚪 EXPLORING ${target.name.toUpperCase()} — CHAT WITH NPCS OR PLAY MINI-GAMES!`
      : target.policeBreach
      ? `🚨 ${target.breachReason || `ALARM TRIPPED — ${initialPlan.policeBreachCount} POLICE OFFICERS BREACHING IN ${Math.ceil(initialBreachDelaySec)}S!`}`
      : initialPlan.vaults.length > 1
      ? `MULTI-VAULT HEIST: CLEAR SECURITY BOTS ON EACH FLOOR TO UNLOCK THAT FLOOR'S VAULT!`
      : `DESTROY ALL ${initialBotCount} SECURITY BOTS TO UNLOCK THE ${initialPlan.theme.vaultLabel}`,
    regenActive: false,
    policeBreachActive: !isExploreMode && Boolean(target.policeBreach),
    breachSecondsLeft: !isExploreMode && target.policeBreach ? Math.ceil(initialBreachDelaySec) : null,
    policeBreachCount: initialPlan.policeBreachCount,
    nearbyNpc: null,
    nearbyActivity: null,
  });

  const nearbyNpcRef = useRef<FloorNpcSpec | null>(null);
  const nearbyActivityRef = useRef<FloorActivitySpec | null>(null);
  const claimedNpcServicesRef = useRef<Set<string>>(new Set());

  const triggerInteractRef = useRef<() => void>(() => {});

  useEffect(() => {
    const updatedPlan = buildBuildingFloorplan({
      id: target.id,
      name: target.name,
      category: target.category,
      buildingHeight: target.buildingHeight,
      buildingStories: target.buildingStories,
      payoutCash: target.payoutCash,
      exteriorProfile: target.exteriorProfile,
      furnishings: furnishingsRef.current,
    });
    floorplanRef.current = updatedPlan;
    setHudState((prev) => ({
      ...prev,
      availableFloors: updatedPlan.availableFloors,
      archetypeLabel: updatedPlan.archetypeLabel,
      floorName: (updatedPlan.floorsById[prev.currentFloor] || updatedPlan.floorsById[1])?.floorName || prev.floorName,
    }));
  }, [target.id, target.name, target.category, target.buildingHeight, target.buildingStories, target.payoutCash, target.exteriorProfile, furnishingsKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const initialFloorplan = buildBuildingFloorplan({
      id: target.id,
      name: target.name,
      category: target.category,
      buildingHeight: target.buildingHeight,
      buildingStories: target.buildingStories,
      payoutCash: target.payoutCash,
      exteriorProfile: target.exteriorProfile,
      furnishings: furnishingsRef.current,
    });
    floorplanRef.current = initialFloorplan;

    // Ensure every vault floor gets at least 1 security bot when in Heist mode!
    let selectedSpawns = isExploreMode ? [] : initialFloorplan.botSpawns;
    if (!isExploreMode && selectedSpawns.length > 0) {
      const desired = getBotCountForPayout(target.payoutCash, initialFloorplan.botSpawns.length);
      if (initialFloorplan.vaults.length > 1) {
        // Prioritize covering every vault floor first
        const chosen: typeof selectedSpawns = [];
        const usedIdx = new Set<number>();
        for (const v of initialFloorplan.vaults) {
          const idx = initialFloorplan.botSpawns.findIndex((b, i) => !usedIdx.has(i) && b.floor === v.floor);
          if (idx !== -1) {
            usedIdx.add(idx);
            chosen.push(initialFloorplan.botSpawns[idx]);
          }
        }
        for (let i = 0; i < initialFloorplan.botSpawns.length && chosen.length < desired; i++) {
          if (!usedIdx.has(i)) {
            usedIdx.add(i);
            chosen.push(initialFloorplan.botSpawns[i]);
          }
        }
        selectedSpawns = chosen;
      } else {
        selectedSpawns = initialFloorplan.botSpawns.slice(0, desired);
      }
    }

    const getFloorData = (fl: HeistFloorId): HeistFloorData =>
      floorplanRef.current.floorsById[fl] ||
      floorplanRef.current.floorsById[1] ||
      Object.values(floorplanRef.current.floorsById)[0]!;

    const vaultStates: RuntimeVault[] = initialFloorplan.vaults.map((v) => ({
      ...v,
      unlocked: false,
      looted: false,
      openProgress: 0,
    }));

    const bots: SecurityBot[] = selectedSpawns.map((sp, idx) => ({
      id: idx + 1,
      floor: sp.floor,
      x: sp.x,
      y: sp.y,
      vx: 0,
      vy: 0,
      hp: sp.role === 'CAPTAIN' ? 85 : 55,
      maxHp: sp.role === 'CAPTAIN' ? 85 : 55,
      alive: true,
      facing: Math.PI / 2,
      fireCooldown: 1.0 + (idx % 7) * 0.28,
      patrolAnchorX: sp.x,
      patrolAnchorY: sp.y,
      patrolPhase: idx * 1.15,
      hitFlash: 0,
      walkCycle: idx * 0.8,
      stairTimer: 0,
      role: sp.role,
    }));

    const player = {
      floor: initialFloorplan.playerSpawn.floor,
      x: initialFloorplan.playerSpawn.x,
      y: initialFloorplan.playerSpawn.y,
      hp: 100,
      maxHp: 100,
      aimAngle: -Math.PI / 2,
      fireTimer: 0,
      hurtFlash: 0,
      timeSinceHit: 99,
      walkCycle: 0,
      speed: 215,
      stairCooldown: 0,
    };

    const keys = new Set<string>();
    const moveKeyStack: string[] = [];
    let leftMouseDown = false;
    const bolts: Bolt[] = [];
    const sparks: Spark[] = [];

    const getAngleForMoveKey = (code: string): number | null => {
      if (code === 'KeyW' || code === 'ArrowUp') return -Math.PI / 2;
      if (code === 'KeyS' || code === 'ArrowDown') return Math.PI / 2;
      if (code === 'KeyA' || code === 'ArrowLeft') return Math.PI;
      if (code === 'KeyD' || code === 'ArrowRight') return 0;
      return null;
    };

    let phase: 'playing' | 'knockout' | 'capture' | 'won' = 'playing';
    let phaseTimer = 0;
    let collectedCash = 0;
    let lockedBounceFlash = 0;
    let floorTransitionFlash = 0;
    let screenShake = 0;
    let captureBotId: number | null = null;
    let animTime = 0;
    let callbackFired = false;

    const breachArmed = !isExploreMode && Boolean(target.policeBreach);
    const breachDelaySec =
      target.breachDelaySec ??
      (target.category === 'HOUSE' ? getHouseAlarmDelaySec(selectedSpawns.length) : 2.5);
    let breachTriggered = false;
    let breachDoorOpen = 0;
    let breachOfficersSpawned = 0;
    let breachAlertFlash = 0;
    const totalBreachOfficers = breachArmed ? initialFloorplan.policeBreachCount : 0;

    const spawnSparks = (
      floor: HeistFloorId,
      x: number,
      y: number,
      color: string,
      count: number,
      speed = 150
    ) => {
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const spd = speed * (0.4 + Math.random() * 0.8);
        sparks.push({
          floor,
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0.35 + Math.random() * 0.3,
          maxLife: 0.65,
          color,
          size: 2 + Math.floor(Math.random() * 3),
        });
      }
    };

    triggerInteractRef.current = () => {
      if (!isExploreMode) return;
      const act = nearbyActivityRef.current;
      if (act) {
        if (act.kind === 'rest') {
          player.hp = player.maxHp;
          spawnSparks(player.floor, player.x, player.y, '#34d399', 18, 120);
          playRetroTone(523, 784, 0.22, 'triangle', 0.08);
          setExploreMessage('🛋️ RESTED & REFRESHED! Full stamina restored.');
        } else {
          setActiveMiniGame(act.kind);
        }
        return;
      }
      const npc = nearbyNpcRef.current;
      if (npc) {
        playRetroTone(440, 580, 0.1, 'triangle', 0.06);
        if (npc.serviceAction && !claimedNpcServicesRef.current.has(npc.id)) {
          claimedNpcServicesRef.current.add(npc.id);
          if (npc.serviceAction.rewardCash && npc.serviceAction.rewardCash > 0) {
            callbacksRef.current.onAwardExploreCash?.(
              npc.serviceAction.rewardCash,
              `${npc.name}: ${npc.serviceAction.label}`
            );
            setExploreMessage(
              `💬 ${npc.name}: "${npc.dialogue}" (+$${npc.serviceAction.rewardCash}!)`
            );
            return;
          }
        }
        setExploreMessage(`💬 ${npc.name} (${npc.roleLabel}): "${npc.dialogue}"`);
      }
    };

    const findSafeElevatorExit = (
      el: ElevatorPortal | undefined,
      floorData: HeistFloorData
    ): { x: number; y: number } => {
      if (!el) return { x: 120, y: 120 };
      const candidates = [
        { x: el.x + el.w * 0.5, y: el.y + el.h + 26 },
        { x: el.x + el.w * 0.5, y: el.y - 26 },
        { x: el.x + el.w + 26, y: el.y + el.h * 0.5 },
        { x: el.x - 26, y: el.y + el.h * 0.5 },
      ];
      for (const c of candidates) {
        const insideZone = floorData.playableZones.some(
          (z) => c.x >= z.x + 16 && c.x <= z.x + z.w - 16 && c.y >= z.y + 16 && c.y <= z.y + z.h - 16
        );
        if (!insideZone) continue;
        const hitsObs = floorData.obstacles.some((obs) =>
          circleIntersectsRect(c.x, c.y, PLAYER_RADIUS + 2, obs)
        );
        if (!hitsObs) return c;
      }
      return { x: el.x + el.w * 0.5, y: el.y + el.h * 0.5 };
    };

    elevatorSelectRef.current = (targetFloor: HeistFloorId) => {
      const fp = floorplanRef.current;
      if (!fp.availableFloors.includes(targetFloor)) return;
      if (targetFloor !== player.floor) {
        const destFloorData = getFloorData(targetFloor);
        const destEl = destFloorData.elevators?.[0];
        const exitPt = destEl
          ? findSafeElevatorExit(destEl, destFloorData)
          : destFloorData.stairs[0]
          ? { x: destFloorData.stairs[0].x + destFloorData.stairs[0].w * 0.5, y: destFloorData.stairs[0].y + destFloorData.stairs[0].h + 24 }
          : { x: (fp.worldWidth ?? CANVAS_W) * 0.5, y: (fp.worldHeight ?? CANVAS_H) * 0.5 };
        player.floor = targetFloor;
        player.x = exitPt.x;
        player.y = exitPt.y;
        floorTransitionFlash = 1.0;
        playRetroTone(440, 680, 0.16, 'triangle', 0.08);
      }
      player.stairCooldown = 0.95;
      setElevatorMenu(null);
      pushHud();
    };

    elevatorCancelRef.current = () => {
      player.stairCooldown = 0.85;
      setElevatorMenu(null);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (elevatorMenuRef.current) {
        const menu = elevatorMenuRef.current;
        const k = e.code;
        if (k === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          elevatorCancelRef.current();
          return;
        }
        if (k === 'Enter' || k === 'NumpadEnter' || k === 'Space') {
          e.preventDefault();
          e.stopPropagation();
          elevatorSelectRef.current(menu.selectedFloor);
          return;
        }
        if (k === 'ArrowUp' || k === 'ArrowRight' || k === 'KeyW' || k === 'KeyD') {
          e.preventDefault();
          e.stopPropagation();
          const idx = menu.availableFloors.indexOf(menu.selectedFloor);
          const nextIdx = idx < 0 ? 0 : Math.min(menu.availableFloors.length - 1, idx + 1);
          const nextFloor = menu.availableFloors[nextIdx];
          setElevatorMenu((prev) => (prev ? { ...prev, selectedFloor: nextFloor, typedDigits: '' } : prev));
          return;
        }
        if (k === 'ArrowDown' || k === 'ArrowLeft' || k === 'KeyS' || k === 'KeyA') {
          e.preventDefault();
          e.stopPropagation();
          const idx = menu.availableFloors.indexOf(menu.selectedFloor);
          const prevIdx = idx < 0 ? 0 : Math.max(0, idx - 1);
          const prevFloor = menu.availableFloors[prevIdx];
          setElevatorMenu((prev) => (prev ? { ...prev, selectedFloor: prevFloor, typedDigits: '' } : prev));
          return;
        }
        if (k === 'Home') {
          e.preventDefault();
          e.stopPropagation();
          const firstFloor = menu.availableFloors[0];
          setElevatorMenu((prev) => (prev ? { ...prev, selectedFloor: firstFloor, typedDigits: '' } : prev));
          return;
        }
        if (k === 'End') {
          e.preventDefault();
          e.stopPropagation();
          const topFloor = menu.availableFloors[menu.availableFloors.length - 1];
          setElevatorMenu((prev) => (prev ? { ...prev, selectedFloor: topFloor, typedDigits: '' } : prev));
          return;
        }
        if (k === 'Backspace') {
          e.preventDefault();
          e.stopPropagation();
          const trimmed = menu.typedDigits.slice(0, -1);
          const parsed = trimmed ? Number.parseInt(trimmed, 10) : NaN;
          const nextSel =
            Number.isFinite(parsed) && menu.availableFloors.includes(parsed) ? parsed : menu.selectedFloor;
          setElevatorMenu((prev) => (prev ? { ...prev, typedDigits: trimmed, selectedFloor: nextSel } : prev));
          return;
        }
        const digitCharMatch = /^(?:Digit|Numpad)([0-9])$/.exec(k);
        if (digitCharMatch) {
          e.preventDefault();
          e.stopPropagation();
          const digit = digitCharMatch[1];
          const allSingleDigit = menu.availableFloors.every((f) => f >= 0 && f <= 9);
          if (allSingleDigit) {
            const targetF = Number.parseInt(digit, 10);
            if (menu.availableFloors.includes(targetF)) {
              elevatorSelectRef.current(targetF);
            }
          } else {
            const combined = (menu.typedDigits + digit).slice(-3);
            const exact = Number.parseInt(combined, 10);
            const single = Number.parseInt(digit, 10);
            const nextStr =
              menu.availableFloors.includes(exact)
                ? combined
                : menu.availableFloors.includes(single)
                ? digit
                : combined;
            const resolved = Number.parseInt(nextStr, 10);
            setElevatorMenu((prev) =>
              prev
                ? {
                    ...prev,
                    typedDigits: nextStr,
                    selectedFloor: menu.availableFloors.includes(resolved) ? resolved : prev.selectedFloor,
                  }
                : prev
            );
          }
        }
        return;
      }
      if (activeMiniGameRef.current || showFurnishShopRef.current) return;
      const k = e.code;
      if (isExploreMode && (k === 'KeyE' || k === 'Space')) {
        e.preventDefault();
        e.stopPropagation();
        triggerInteractRef.current();
        return;
      }
      const dirAngle = getAngleForMoveKey(k);
      if (dirAngle !== null || k === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        keys.add(k);
        if (dirAngle !== null) {
          const existingIdx = moveKeyStack.indexOf(k);
          if (existingIdx === -1) {
            moveKeyStack.push(k);
            player.aimAngle = dirAngle;
          } else if (!e.repeat && existingIdx !== moveKeyStack.length - 1) {
            moveKeyStack.splice(existingIdx, 1);
            moveKeyStack.push(k);
            player.aimAngle = dirAngle;
          }
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.code;
      keys.delete(k);
      const idx = moveKeyStack.indexOf(k);
      if (idx !== -1) {
        moveKeyStack.splice(idx, 1);
        if (moveKeyStack.length > 0) {
          const fallbackAngle = getAngleForMoveKey(moveKeyStack[moveKeyStack.length - 1]);
          if (fallbackAngle !== null) {
            player.aimAngle = fallbackAngle;
          }
        }
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && !activeMiniGameRef.current && !showFurnishShopRef.current) leftMouseDown = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) leftMouseDown = false;
    };
    const onWindowBlur = () => {
      keys.clear();
      moveKeyStack.length = 0;
      leftMouseDown = false;
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', onWindowBlur);

    let lastTs = performance.now();
    let hudSyncAccum = 0;
    let rafId = 0;

    const pushHud = (bannerOverride?: string) => {
      const floorplan = floorplanRef.current;
      const aliveList = bots.filter((b) => b.alive);
      const aliveCount = aliveList.length;
      const botsByFloor: Record<HeistFloorId, number> = {};
      for (const f of floorplan.availableFloors) {
        botsByFloor[f] = aliveList.filter((b) => b.floor === f).length;
      }
      const pendingPolice =
        breachArmed && breachTriggered ? Math.max(0, totalBreachOfficers - breachOfficersSpawned) : 0;
      const secsLeft =
        breachArmed && !breachTriggered ? Math.max(0, Math.ceil(breachDelaySec - animTime)) : null;

      let defaultBanner = '';
      if (isExploreMode) {
        if (nearbyActivityRef.current) {
          defaultBanner = `🎮 PRESS [E] OR [SPACE] TO START: ${nearbyActivityRef.current.label}`;
        } else if (nearbyNpcRef.current) {
          defaultBanner = `💬 [E] TALK TO ${nearbyNpcRef.current.name.toUpperCase()} (${nearbyNpcRef.current.roleLabel.toUpperCase()})`;
        } else {
          const floorRangeText =
            floorplan.availableFloors.length > 6
              ? `${formatFloorTag(floorplan.availableFloors[0])}–${formatFloorTag(floorplan.availableFloors[floorplan.availableFloors.length - 1])} · ${floorplan.availableFloors.length} FLOORS`
              : floorplan.availableFloors.map(formatFloorTag).join(' / ');
          defaultBanner = target.isOwnedHouse
            ? `🏡 HOME EXPLORATION MODE — WALK FLOORS (${floorRangeText}) OR PLAY MINI-GAMES!`
            : `🚪 VISITING ${target.name.toUpperCase()} (${floorRangeText}) — TALK TO NPCS, RIDE ELEVATORS, OR EXIT FRONT DOOR!`;
        }
      } else if (phase === 'knockout') {
        defaultBanner = '💫 KNOCKED OUT! SEEING STARS...';
      } else if (phase === 'capture') {
        defaultBanner = '👮 ARRESTED / CAPTURED — RESTITUTION & CUSTODY INCOMING!';
      } else if (phase === 'won') {
        defaultBanner = `💰 +$${collectedCash.toLocaleString()} STOLEN! GET TO YOUR CAR!`;
      } else {
        const curFloorVaults = vaultStates.filter((v) => v.floor === player.floor);
        const curUnlockedUnlooted = curFloorVaults.find((v) => v.unlocked && !v.looted);
        const otherUnlocked = vaultStates.find((v) => v.unlocked && !v.looted && v.floor !== player.floor);
        if (curUnlockedUnlooted) {
          defaultBanner = `🔓 ${curUnlockedUnlooted.label} UNLOCKED! STEP INSIDE TO GRAB +$${curUnlockedUnlooted.cashShare.toLocaleString()}!`;
        } else if (otherUnlocked) {
          defaultBanner = `🔓 ${otherUnlocked.label} UNLOCKED ON ${formatFloorTag(otherUnlocked.floor)}! USE STAIRS TO GRAB IT!`;
        } else if (collectedCash > 0 && vaultStates.some((v) => !v.looted)) {
          defaultBanner = `💰 $${collectedCash.toLocaleString()} BAGGED! CLEAR NEXT FLOOR'S BOTS FOR VAULT #2 OR EXIT FRONT DOOR!`;
        } else if (breachArmed && !breachTriggered) {
          defaultBanner = `🚨 ALARM ACTIVE — ${totalBreachOfficers} POLICE BREACHING IN ${secsLeft}S!`;
        } else {
          const curFloorSecAlive = aliveList.filter((b) => b.role !== 'POLICE' && b.floor === player.floor).length;
          if (curFloorSecAlive === 0 && floorplan.availableFloors.length > 1) {
            const nextFloorWithBots = floorplan.availableFloors.find(
              (f) => f !== player.floor && (botsByFloor[f] ?? 0) > 0
            );
            if (nextFloorWithBots !== undefined) {
              defaultBanner = `✅ ${formatFloorTag(player.floor)} CLEAR! TAKE STAIRS TO ${formatFloorTag(nextFloorWithBots)} (${botsByFloor[nextFloorWithBots] ?? 0} HOSTILES)!`;
            } else {
              defaultBanner = `🤖 ${aliveCount} HOSTILES REMAINING`;
            }
          } else {
            defaultBanner = `🤖 ELIMINATE ALL SECURITY BOTS ON THIS FLOOR (${curFloorSecAlive} LEFT) TO UNLOCK ITS VAULT!`;
          }
        }
      }

      const regenActive = !isExploreMode && phase === 'playing' && player.timeSinceHit >= 2.2 && player.hp < player.maxHp;
      setHudState({
        hp: Math.max(0, Math.ceil(player.hp)),
        maxHp: player.maxHp,
        botsAlive: aliveCount,
        totalBots: bots.length + pendingPolice,
        botsByFloor,
        currentFloor: player.floor,
        availableFloors: floorplan.availableFloors,
        floorName: getFloorData(player.floor).floorName,
        archetypeLabel: floorplan.archetypeLabel,
        vaultSummaries: vaultStates.map((v) => ({
          id: v.id,
          floor: v.floor,
          label: v.label,
          unlocked: v.unlocked,
          looted: v.looted,
          cashShare: v.cashShare,
        })),
        collectedCash,
        phase,
        bannerText: bannerOverride || defaultBanner,
        regenActive,
        policeBreachActive: breachArmed,
        breachSecondsLeft: secsLeft,
        policeBreachCount: totalBreachOfficers,
        nearbyNpc: nearbyNpcRef.current,
        nearbyActivity: nearbyActivityRef.current,
      });
    };

    const drawRobotSprite = (
      x: number,
      y: number,
      facing: number,
      walk: number,
      role: 'GUARD' | 'CAPTAIN' | 'POLICE',
      hitFlash: number,
      alive: boolean,
      isCapturing: boolean,
      tNow: number
    ) => {
      const isCaptain = role === 'CAPTAIN';
      const isPolice = role === 'POLICE';
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));

      if (!alive) {
        ctx.fillStyle = isPolice ? '#172554' : '#1e293b';
        ctx.fillRect(-13, -7, 26, 14);
        ctx.fillStyle = isPolice ? '#1e3a8a' : '#334155';
        ctx.fillRect(-10, -5, 14, 10);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(5, -5, 7, 10);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-12, -2, 3, 2);
        ctx.restore();
        return;
      }

      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.beginPath();
      ctx.ellipse(0, 12, 13, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      const stride = Math.sin(walk * 8) * 3.5;
      ctx.fillStyle = isPolice ? '#0f172a' : '#334155';
      ctx.fillRect(-7, 5 + stride * 0.4, 5, 8);
      ctx.fillRect(2, 5 - stride * 0.4, 5, 8);

      ctx.fillStyle = hitFlash > 0 ? '#ffffff' : isPolice ? '#172554' : isCaptain ? '#991b1b' : '#334155';
      ctx.fillRect(-10, -8, 20, 15);
      ctx.strokeStyle = isPolice ? '#60a5fa' : isCaptain ? '#facc15' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(-10, -8, 20, 15);

      if (isPolice) {
        ctx.fillStyle = '#facc15';
        ctx.fillRect(-7, -5, 5, 5);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(1, -3, 6, 2);
      } else {
        ctx.fillStyle = isCapturing ? '#f97316' : isCaptain ? '#fde047' : '#38bdf8';
        ctx.fillRect(-3, -3, 6, 6);
      }

      ctx.save();
      ctx.rotate(facing);
      ctx.fillStyle = isPolice ? '#1e293b' : '#475569';
      ctx.fillRect(4, -5, 13, 4);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(14, -6, 6, 6);
      ctx.fillStyle = isPolice ? '#3b82f6' : isCapturing ? '#fb923c' : '#ef4444';
      ctx.fillRect(19, -4, 3, 2);
      ctx.restore();

      ctx.fillStyle = hitFlash > 0 ? '#ffffff' : isPolice ? '#1e3a8a' : '#94a3b8';
      ctx.fillRect(-7, -17, 14, 11);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-6, -13, 12, 4);
      ctx.fillStyle = isPolice ? '#93c5fd' : isCapturing ? '#facc15' : '#ef4444';
      ctx.fillRect(-5, -12, 10, 2);

      if (isPolice) {
        const flash = Math.floor(tNow * 10) % 2 === 0;
        ctx.fillStyle = flash ? '#ef4444' : '#3b82f6';
        ctx.fillRect(-5, -20, 4, 3);
        ctx.fillStyle = flash ? '#3b82f6' : '#ef4444';
        ctx.fillRect(1, -20, 4, 3);
      } else {
        ctx.fillStyle = '#64748b';
        ctx.fillRect(-1, -22, 2, 5);
        ctx.fillStyle = isCaptain ? '#facc15' : '#ef4444';
        ctx.fillRect(-2, -23, 4, 2);
      }

      ctx.restore();
    };

    const drawFriendlyNpcSprite = (npc: FloorNpcSpec, isNear: boolean, tNow: number) => {
      const lookAng = isNear ? Math.atan2(player.y - npc.y, player.x - npc.x) : npc.facing;
      ctx.save();
      ctx.translate(Math.round(npc.x), Math.round(npc.y));
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath();
      ctx.ellipse(0, 11, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shoulders / Shirt
      ctx.fillStyle = npc.shirtColor;
      ctx.fillRect(-9, -7, 18, 14);
      ctx.strokeStyle = isNear ? '#fde047' : '#e2e8f0';
      ctx.lineWidth = isNear ? 2.2 : 1.2;
      ctx.strokeRect(-9, -7, 18, 14);

      // Head
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(0, -11, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = npc.hairColor;
      ctx.beginPath();
      ctx.arc(0, -13, 6.5, Math.PI, 0);
      ctx.fill();

      // Subtle facing dot
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(Math.cos(lookAng) * 3 - 1, -11 + Math.sin(lookAng) * 2, 2, 2);

      // Floating name tag
      const bob = isNear ? Math.sin(tNow * 6) * 2 : 0;
      ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
      ctx.fillRect(-34, -34 + bob, 68, 14);
      ctx.fillStyle = isNear ? '#fde047' : '#a7f3d0';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(npc.name.split(' ')[0].toUpperCase(), 0, -24 + bob);
      ctx.restore();
    };

    const drawPlayerSprite = (t: number) => {
      ctx.save();
      ctx.translate(Math.round(player.x), Math.round(player.y));

      if (phase === 'knockout' || phase === 'capture') {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse(0, 5, 18, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-18, -5, 14, 10);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-4, -7, 15, 14);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(0, -4, 4, 8);
        ctx.fillStyle = '#fed7aa';
        ctx.fillRect(11, -5, 9, 10);
        ctx.fillStyle = '#111827';
        ctx.fillRect(13, -4, 4, 8);

        for (let s = 0; s < 5; s++) {
          const ang = t * 4.8 + (s / 5) * Math.PI * 2;
          const sx = 14 + Math.cos(ang) * 16;
          const sy = -20 + Math.sin(ang) * 6.5;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(t * 3 + s);
          ctx.fillStyle = s % 2 === 0 ? '#facc15' : '#fef08a';
          ctx.beginPath();
          for (let p = 0; p < 10; p++) {
            const r = p % 2 === 0 ? 5.2 : 2.3;
            const pa = (p * Math.PI) / 5 - Math.PI / 2;
            if (p === 0) ctx.moveTo(Math.cos(pa) * r, Math.sin(pa) * r);
            else ctx.lineTo(Math.cos(pa) * r, Math.sin(pa) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        if (phase === 'capture') {
          const pulse = 1 + Math.sin(t * 14) * 0.12;
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.arc(0, 0, 25 * pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(239,68,68,0.22)';
          ctx.beginPath();
          ctx.arc(0, 0, 22, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        return;
      }

      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 11, 12, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();

      const stride = Math.sin(player.walkCycle * 9) * 3;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-6, 5 + stride * 0.4, 5, 7);
      ctx.fillRect(1, 5 - stride * 0.4, 5, 7);

      ctx.fillStyle = player.hurtFlash > 0 ? '#ef4444' : isExploreMode ? '#0f766e' : '#1e293b';
      ctx.fillRect(-9, -8, 18, 15);
      ctx.strokeStyle = isExploreMode ? '#34d399' : '#22d3ee';
      ctx.lineWidth = 2;
      ctx.strokeRect(-9, -8, 18, 15);

      ctx.fillStyle = isExploreMode ? '#34d399' : '#eab308';
      ctx.fillRect(-6, -5, 5, 10);

      if (!isExploreMode) {
        ctx.save();
        ctx.rotate(player.aimAngle);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(4, -3, 14, 4);
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(15, -3, 4, 4);
        ctx.restore();
      }

      ctx.fillStyle = isExploreMode ? '#fed7aa' : '#111827';
      ctx.fillRect(-6, -17, 12, 11);
      ctx.fillStyle = isExploreMode ? '#1e293b' : '#22d3ee';
      ctx.fillRect(-5, isExploreMode ? -17 : -13, 10, 3);

      ctx.restore();
    };

    const drawObstacleProp = (obs: WallRect, theme: BuildingFloorplan['theme'], tNow: number) => {
      if (obs.kind === 'wall') {
        ctx.fillStyle = theme.wallFill;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = 'rgba(255,255,255,0.045)';
        ctx.lineWidth = 1;
        for (let hx = obs.x; hx < obs.x + obs.w; hx += 20) {
          ctx.beginPath();
          ctx.moveTo(hx, obs.y);
          ctx.lineTo(hx, obs.y + obs.h);
          ctx.stroke();
        }
        ctx.strokeStyle = theme.wallStroke;
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x + 1, obs.y + 1, Math.max(0, obs.w - 2), Math.max(0, obs.h - 2));
        return;
      }
      if (obs.kind === 'interior_wall') {
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.fillRect(obs.x + 2, obs.y + 3, obs.w, obs.h);
        ctx.fillStyle = theme.interiorWallFill;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = theme.interiorWallStroke;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        return;
      }
      if (obs.kind === 'vault_wall') {
        ctx.fillStyle = '#334155';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        return;
      }
      if (obs.kind === 'pillar') {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(obs.x + 4, obs.y + 5, obs.w, obs.h);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(obs.x + 4, obs.y + 4, obs.w - 8, obs.h - 8);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        return;
      }

      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(obs.x + 3, obs.y + 4, obs.w, obs.h);

      if (obs.kind === 'glass_case') {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.fillStyle = '#083344';
        ctx.fillRect(obs.x + 3, obs.y + 3, obs.w - 6, obs.h - 6);
        for (let gx = obs.x + 10; gx < obs.x + obs.w - 10; gx += 18) {
          const twinkle = Math.sin(tNow * 5 + gx * 0.2) > 0;
          ctx.fillStyle = twinkle ? '#a5f3fc' : '#facc15';
          ctx.fillRect(gx, obs.y + obs.h * 0.5 - 3, 6, 6);
        }
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      } else if (obs.kind === 'air_hockey_table') {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(obs.x + 5, obs.y + 5, obs.w - 10, obs.h - 10);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.w * 0.5, obs.y + 5);
        ctx.lineTo(obs.x + obs.w * 0.5, obs.y + obs.h - 5);
        ctx.stroke();
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(obs.x + obs.w * 0.25, obs.y + obs.h * 0.5, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(obs.x + obs.w * 0.75, obs.y + obs.h * 0.5, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (obs.kind === 'skeeball_lane') {
        ctx.fillStyle = '#451a03';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(obs.x + 6, obs.y + 6, obs.w - 12, obs.h - 12);
        ctx.fillStyle = '#f472b6';
        ctx.beginPath();
        ctx.arc(obs.x + obs.w * 0.5, obs.y + 18, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(obs.x + obs.w * 0.5, obs.y + 18, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (obs.kind === 'arcade_cab') {
        ctx.fillStyle = '#1e1b4b';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(obs.x + 8, obs.y + 8, obs.w - 16, 16);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(obs.x + 14, obs.y + obs.h - 14, 12, 8);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(obs.x + obs.w - 26, obs.y + obs.h - 14, 12, 8);
      } else if (obs.kind === 'claw_box') {
        ctx.fillStyle = '#3b0764';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        for (const [px, py, col] of [
          [0.25, 0.45, '#f472b6'],
          [0.5, 0.55, '#facc15'],
          [0.75, 0.42, '#38bdf8'],
        ] as [number, number, string][]) {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(obs.x + obs.w * px, obs.y + obs.h * py, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (obs.kind === 'hoop_machine') {
        ctx.fillStyle = '#18181b';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.arc(obs.x + obs.w * 0.5, obs.y + obs.h * 0.6, 8, 0, Math.PI * 2);
        ctx.fill();
      } else if (obs.kind === 'pinball_machine') {
        ctx.fillStyle = '#1e1b4b';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = '#e879f9';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(obs.x + 5, obs.y + 6, obs.w - 10, obs.h - 14);
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(obs.x + obs.w * 0.36, obs.y + obs.h * 0.34, 4.5, 0, Math.PI * 2);
        ctx.arc(obs.x + obs.w * 0.64, obs.y + obs.h * 0.34, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(obs.x + obs.w * 0.3, obs.y + obs.h - 13, obs.w * 0.4, 3);
      } else if (obs.kind === 'dance_stage') {
        ctx.fillStyle = '#18181b';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        const beatCols = ['#ec4899', '#22d3ee', '#a855f7', '#4ade80'];
        const cellW = (obs.w - 16) / 4;
        for (let bIdx = 0; bIdx < 4; bIdx++) {
          ctx.fillStyle = beatCols[(bIdx + Math.floor(tNow * 3)) % 4];
          ctx.fillRect(obs.x + 8 + bIdx * cellW + 1, obs.y + 8, cellW - 2, obs.h - 16);
        }
      } else if (obs.kind === 'racing_sim') {
        ctx.fillStyle = '#09090b';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(obs.x + 12, obs.y + obs.h * 0.25, obs.w - 30, obs.h * 0.5);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(obs.x + obs.w - 14, obs.y + 8, 6, obs.h - 16);
      } else if (obs.kind === 'table_tennis_table') {
        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x + 3, obs.y + 3, obs.w - 6, obs.h - 6);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(obs.x + obs.w * 0.5 - 1.5, obs.y + 3, 3, obs.h - 6);
      } else if (obs.kind === 'punch_bag') {
        ctx.fillStyle = '#18181b';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(obs.x + obs.w * 0.5, obs.y + obs.h * 0.45, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#facc15';
        ctx.fillRect(obs.x + obs.w * 0.35, obs.y + obs.h - 10, obs.w * 0.3, 4);
      } else if (obs.kind === 'pool_table') {
        ctx.fillStyle = '#451a03';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.fillStyle = '#059669';
        ctx.fillRect(obs.x + 6, obs.y + 6, obs.w - 12, obs.h - 12);
        for (const [bx, by, col] of [
          [0.3, 0.5, '#f8fafc'],
          [0.65, 0.42, '#facc15'],
          [0.72, 0.58, '#ef4444'],
        ] as [number, number, string][]) {
          ctx.fillStyle = col;
          ctx.fillRect(obs.x + obs.w * bx, obs.y + obs.h * by, 4, 4);
        }
      } else if (obs.kind === 'piano') {
        ctx.fillStyle = '#09090b';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(obs.x + 10, obs.y + obs.h - 11, obs.w - 20, 8);
        ctx.fillStyle = '#09090b';
        for (let kx = obs.x + 14; kx < obs.x + obs.w - 14; kx += 6) {
          ctx.fillRect(kx, obs.y + obs.h - 11, 3, 5);
        }
      } else if (obs.kind === 'bed') {
        ctx.fillStyle = '#451a03';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(obs.x + 4, obs.y + 4, obs.w - 8, obs.h - 8);
        ctx.fillStyle = theme.accentColor;
        ctx.fillRect(obs.x + 4, obs.y + 20, obs.w - 8, obs.h - 24);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(obs.x + 10, obs.y + 7, obs.w * 0.34, 10);
        ctx.fillRect(obs.x + obs.w * 0.54, obs.y + 7, obs.w * 0.34, 10);
      } else if (obs.kind === 'sofa') {
        ctx.fillStyle = '#334155';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.fillStyle = '#64748b';
        ctx.fillRect(obs.x + 4, obs.y + 4, obs.w - 8, obs.h - 8);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(obs.x + 6, obs.y + 5, obs.w - 12, 5);
      } else if (obs.kind === 'cooler') {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(obs.x + 4, obs.y + 4, obs.w - 8, obs.h - 8);
        ctx.fillStyle = '#bae6fd';
        for (let cy = obs.y + 10; cy < obs.y + obs.h - 8; cy += 18) {
          ctx.fillRect(obs.x + 7, cy, obs.w - 14, 10);
        }
      } else if (obs.kind === 'shelf') {
        ctx.fillStyle = '#44403c';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        const colors = ['#ef4444', '#facc15', '#22c55e', '#38bdf8'];
        for (let sy = obs.y + 6; sy < obs.y + obs.h - 8; sy += 14) {
          ctx.fillStyle = colors[(sy >> 3) % colors.length];
          ctx.fillRect(obs.x + 5, sy, obs.w - 10, 8);
        }
      } else if (obs.kind === 'kitchen_island') {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(obs.x + 3, obs.y + 3, obs.w - 6, obs.h - 6);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(obs.x + obs.w * 0.42, obs.y + 8, 18, 14);
      } else if (obs.kind === 'table' || obs.kind === 'desk') {
        ctx.fillStyle = theme.counterWood;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.fillStyle = theme.counterTop;
        ctx.fillRect(obs.x + 4, obs.y + 4, obs.w - 8, obs.h - 8);
        if (obs.kind === 'desk') {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(obs.x + obs.w * 0.35, obs.y + 7, 22, 10);
        }
      } else {
        ctx.fillStyle = theme.counterWood;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.fillStyle = theme.counterTop;
        ctx.fillRect(obs.x + 3, obs.y + 3, obs.w - 6, obs.h - 6);
      }
    };

    const tick = (now: number) => {
      const floorplan = floorplanRef.current;
      const worldW = floorplan.worldWidth ?? CANVAS_W;
      const worldH = floorplan.worldHeight ?? CANVAS_H;
      const dt = Math.min(0.033, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      animTime += dt;

      if (screenShake > 0) screenShake = Math.max(0, screenShake - dt * 18);
      if (lockedBounceFlash > 0) lockedBounceFlash = Math.max(0, lockedBounceFlash - dt);
      if (floorTransitionFlash > 0) floorTransitionFlash = Math.max(0, floorTransitionFlash - dt * 2.5);
      if (player.hurtFlash > 0) player.hurtFlash = Math.max(0, player.hurtFlash - dt);
      if (player.stairCooldown > 0) player.stairCooldown = Math.max(0, player.stairCooldown - dt);
      if (phase === 'playing' && !isExploreMode) {
        player.timeSinceHit += dt;
        if (player.timeSinceHit >= 2.2 && player.hp < player.maxHp) {
          player.hp = Math.min(player.maxHp, player.hp + 11 * dt);
        }
      }
      if (breachAlertFlash > 0) breachAlertFlash = Math.max(0, breachAlertFlash - dt);

      // Police Door Breach Sequence (Heist Mode Only)
      if (!isExploreMode && phase === 'playing' && breachArmed) {
        if (!breachTriggered && animTime >= breachDelaySec) {
          breachTriggered = true;
          breachAlertFlash = 2.0;
          screenShake = Math.max(screenShake, 14);
          const edx = floorplan.entryDoorRect.x + floorplan.entryDoorRect.w * 0.5;
          const edy = floorplan.entryDoorRect.y - 4;
          spawnSparks(1, edx, edy, '#f59e0b', 24, 210);
          spawnSparks(1, edx, edy, '#ef4444', 18, 190);
          spawnSparks(1, edx, edy, '#3b82f6', 18, 190);
          playRetroTone(140, 48, 0.35, 'sawtooth', 0.14);
          setTimeout(() => playRetroTone(740, 520, 0.22, 'square', 0.08), 90);
          pushHud(`🚨 ${totalBreachOfficers} POLICE OFFICERS BUSTED THROUGH THE DOOR!`);
        }
        if (breachTriggered) {
          breachDoorOpen = Math.min(1, breachDoorOpen + dt * 5.0);
          const desiredSpawned = Math.min(
            totalBreachOfficers,
            2 + Math.floor((animTime - breachDelaySec) / 0.28)
          );
          while (breachOfficersSpawned < desiredSpawned) {
            const k = breachOfficersSpawned;
            const lane = (k % 5) - 2;
            const spreadX = floorplan.entryDoorRect.x + floorplan.entryDoorRect.w * 0.5 + lane * 14;
            const rankRow = Math.floor(k / 5);
            bots.push({
              id: 100 + k,
              floor: 1,
              x: spreadX,
              y: floorplan.entryDoorRect.y - 10,
              vx: 0,
              vy: -98,
              hp: k % 4 === 0 ? 85 : 65,
              maxHp: k % 4 === 0 ? 85 : 65,
              alive: true,
              facing: -Math.PI / 2,
              fireCooldown: 0.9 + (k % 5) * 0.26,
              patrolAnchorX: Math.min(worldW - 110, 220 + ((k * 137) % Math.max(200, worldW - 360))),
              patrolAnchorY: Math.min(worldH - 110, 280 + rankRow * 55),
              patrolPhase: k * 0.65,
              hitFlash: 0,
              walkCycle: k * 0.35,
              stairTimer: 0,
              role: 'POLICE',
            });
            spawnSparks(1, spreadX, floorplan.entryDoorRect.y - 10, '#60a5fa', 6, 115);
            breachOfficersSpawned++;
          }
        }
      }

      // 1. Update Simulation
      if (phase === 'playing' && !activeMiniGameRef.current && !showFurnishShopRef.current && !elevatorMenuRef.current) {
        const curFloorData = getFloorData(player.floor);

        let moveX = 0;
        let moveY = 0;
        if (keys.has('KeyW') || keys.has('ArrowUp')) moveY -= 1;
        if (keys.has('KeyS') || keys.has('ArrowDown')) moveY += 1;
        if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
        if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;

        if (moveX !== 0 || moveY !== 0) {
          const len = Math.hypot(moveX, moveY);
          moveX /= len;
          moveY /= len;
          player.x += moveX * player.speed * dt;
          player.y += moveY * player.speed * dt;
          player.walkCycle += dt;
        }
        if (moveKeyStack.length > 0) {
          const lastAngle = getAngleForMoveKey(moveKeyStack[moveKeyStack.length - 1]);
          if (lastAngle !== null) {
            player.aimAngle = lastAngle;
          }
        }

        player.x = Math.max(24 + PLAYER_RADIUS, Math.min(worldW - 24 - PLAYER_RADIUS, player.x));
        player.y = Math.max(20 + PLAYER_RADIUS, Math.min(worldH - 22 - PLAYER_RADIUS, player.y));

        for (const obs of curFloorData.obstacles) {
          const res = resolveCircleRect(player.x, player.y, PLAYER_RADIUS, obs);
          player.x = res.x;
          player.y = res.y;
        }

        // Collide against any locked vaults on this floor
        for (const v of vaultStates) {
          if (v.floor === player.floor && !v.unlocked) {
            const doorWall: WallRect = { ...v.doorRect, kind: 'vault_wall' };
            const res = resolveCircleRect(player.x, player.y, PLAYER_RADIUS, doorWall);
            if (res.hit) {
              player.x = res.x;
              player.y = res.y;
              lockedBounceFlash = 0.7;
            }
          }
        }

        // Check Elevator Portals (opens multi-floor floor selector!)
        let enteredElevator = false;
        if (
          curFloorData.elevators &&
          curFloorData.elevators.length > 0 &&
          floorplan.availableFloors.length > 1 &&
          player.stairCooldown <= 0
        ) {
          for (const el of curFloorData.elevators) {
            if (
              player.x >= el.x &&
              player.x <= el.x + el.w &&
              player.y >= el.y &&
              player.y <= el.y + el.h
            ) {
              enteredElevator = true;
              keys.clear();
              moveKeyStack.length = 0;
              leftMouseDown = false;
              playRetroTone(520, 740, 0.12, 'triangle', 0.06);
              const floorNames: Record<number, string> = {};
              for (const f of floorplan.availableFloors) {
                const rawFn = floorplan.floorsById[f]?.floorName || '';
                const parts = rawFn.split('·');
                floorNames[f] = parts.length > 1 ? parts.slice(1).join('·').trim() : f === 0 ? 'BASEMENT' : `FLOOR ${f}`;
              }
              setElevatorMenu({
                label: el.label || 'EXPRESS ELEVATOR',
                currentFloor: player.floor,
                availableFloors: floorplan.availableFloors,
                floorNames,
                selectedFloor: player.floor,
                typedDigits: '',
              });
              break;
            }
          }
        }

        // Check Staircase Portals (supports B1, 1F, 2F, 3F!)
        if (!enteredElevator && curFloorData.stairs.length > 0 && player.stairCooldown <= 0) {
          for (const st of curFloorData.stairs) {
            if (
              player.x >= st.x &&
              player.x <= st.x + st.w &&
              player.y >= st.y &&
              player.y <= st.y + st.h
            ) {
              player.floor = st.targetFloor;
              player.x = st.exitX;
              player.y = st.exitY;
              player.stairCooldown = 0.7;
              floorTransitionFlash = 1.0;
              playRetroTone(390, 580, 0.14, 'triangle', 0.08);
              pushHud();
              break;
            }
          }
        }

        // Explore Mode Proximity Check (NPCs, Mini-Games, Front Door Exit)
        if (isExploreMode) {
          let nearNpc: FloorNpcSpec | null = null;
          let bestNpcD = 52;
          for (const npc of curFloorData.npcs) {
            const d = Math.hypot(npc.x - player.x, npc.y - player.y);
            if (d < bestNpcD) {
              bestNpcD = d;
              nearNpc = npc;
            }
          }
          nearbyNpcRef.current = nearNpc;

          let nearAct: FloorActivitySpec | null = null;
          let bestActD = Infinity;
          for (const act of curFloorData.activities) {
            const d = Math.hypot(act.x - player.x, act.y - player.y);
            if (d <= act.radius + 14 && d < bestActD) {
              bestActD = d;
              nearAct = act;
            }
          }
          nearbyActivityRef.current = nearAct;

          // Walk onto bottom front door pad on 1F to step back outside cleanly
          const ed = floorplan.entryDoorRect;
          if (
            player.floor === 1 &&
            animTime > 1.2 &&
            player.x >= ed.x + 8 &&
            player.x <= ed.x + ed.w - 8 &&
            player.y >= ed.y - 12 &&
            !callbackFired
          ) {
            callbackFired = true;
            callbacksRef.current.onAbort();
          }
        } else {
          // Heist Mode: Shoot EMP stun-bolts
          player.fireTimer = Math.max(0, player.fireTimer - dt);
          if ((leftMouseDown || keys.has('Space')) && player.fireTimer <= 0) {
            player.fireTimer = 0.16;
            const speed = 540;
            const muzzleX = player.x + Math.cos(player.aimAngle) * 18;
            const muzzleY = player.y + Math.sin(player.aimAngle) * 18;
            bolts.push({
              floor: player.floor,
              x: muzzleX,
              y: muzzleY,
              vx: Math.cos(player.aimAngle) * speed,
              vy: Math.sin(player.aimAngle) * speed,
              fromPlayer: true,
              life: 1.5,
            });
            playRetroTone(740, 260, 0.08, 'square', 0.06);
          }

          // Update Security Bots & Breaching Police Officers AI across B1 / 1F / 2F
          for (const bot of bots) {
            if (!bot.alive) continue;
            if (bot.hitFlash > 0) bot.hitFlash = Math.max(0, bot.hitFlash - dt);
            if (bot.stairTimer > 0) bot.stairTimer = Math.max(0, bot.stairTimer - dt);

            const botFloorData = getFloorData(bot.floor);
            const lockedDoorsForFloor = vaultStates
              .filter((v) => v.floor === bot.floor && !v.unlocked)
              .map((v) => v.doorRect);
            const sameFloor = bot.floor === player.floor;
            const dxP = player.x - bot.x;
            const dyP = player.y - bot.y;
            const distP = Math.hypot(dxP, dyP);
            const seePlayer =
              sameFloor &&
              hasLineOfSight(bot.x, bot.y, player.x, player.y, botFloorData.obstacles, lockedDoorsForFloor);

            bot.patrolPhase += dt * (bot.role === 'POLICE' ? 1.8 : bot.role === 'CAPTAIN' ? 1.45 : 1.1);
            let goalX = bot.patrolAnchorX + Math.sin(bot.patrolPhase) * 38;
            let goalY = bot.patrolAnchorY + Math.cos(bot.patrolPhase * 0.7) * 24;

            if (!sameFloor && bot.role === 'POLICE' && (botFloorData.stairs.length > 0 || (botFloorData.elevators && botFloorData.elevators.length > 0))) {
              // Police hunt across B1 / 1F / 2F / 3F via stairs or elevators!
              const exactStair = botFloorData.stairs.find((s) => s.targetFloor === player.floor);
              const elev = botFloorData.elevators?.[0];
              let targetStair = exactStair;
              if (!targetStair && !elev && botFloorData.stairs.length > 0) {
                if (player.floor > bot.floor) {
                  const upStairs = botFloorData.stairs
                    .filter((s) => s.targetFloor > bot.floor)
                    .sort((a, b) => Math.abs(a.targetFloor - player.floor) - Math.abs(b.targetFloor - player.floor));
                  targetStair = upStairs[0] || botFloorData.stairs[0];
                } else {
                  const downStairs = botFloorData.stairs
                    .filter((s) => s.targetFloor < bot.floor)
                    .sort((a, b) => Math.abs(a.targetFloor - player.floor) - Math.abs(b.targetFloor - player.floor));
                  targetStair = downStairs[0] || botFloorData.stairs[0];
                }
              }
              if (!exactStair && elev) {
                const elCx = elev.x + elev.w * 0.5;
                const elCy = elev.y + elev.h * 0.5;
                const hop = findNextWaypointToward(
                  bot.x,
                  bot.y,
                  elCx,
                  elCy,
                  botFloorData,
                  lockedDoorsForFloor
                );
                goalX = hop.x;
                goalY = hop.y;
                bot.facing = Math.atan2(goalY - bot.y, goalX - bot.x);
                if (Math.hypot(elCx - bot.x, elCy - bot.y) < 34 && bot.stairTimer <= 0) {
                  const destData = getFloorData(player.floor);
                  const destEl = destData.elevators?.[0] || elev;
                  const exitPt = findSafeElevatorExit(destEl, destData);
                  bot.floor = player.floor;
                  bot.x = exitPt.x;
                  bot.y = exitPt.y;
                  bot.stairTimer = 1.4;
                  continue;
                }
              } else if (targetStair) {
                const stCx = targetStair.x + targetStair.w * 0.5;
                const stCy = targetStair.y + targetStair.h * 0.5;
                const hop = findNextWaypointToward(
                  bot.x,
                  bot.y,
                  stCx,
                  stCy,
                  botFloorData,
                  lockedDoorsForFloor
                );
                goalX = hop.x;
                goalY = hop.y;
                bot.facing = Math.atan2(goalY - bot.y, goalX - bot.x);
                if (Math.hypot(stCx - bot.x, stCy - bot.y) < 30 && bot.stairTimer <= 0) {
                  bot.floor = targetStair.targetFloor;
                  bot.x = targetStair.exitX;
                  bot.y = targetStair.exitY;
                  bot.stairTimer = 1.2;
                  continue;
                }
              }
            } else if (sameFloor && seePlayer && distP < 430) {
              bot.facing = Math.atan2(dyP, dxP);
              if (distP > (bot.role === 'POLICE' ? 135 : 195)) {
                goalX = player.x;
                goalY = player.y;
              } else if (distP < 95) {
                goalX = bot.x - dxP * 0.5;
                goalY = bot.y - dyP * 0.5;
              } else {
                goalX = bot.x - dyP * 0.4 * Math.sin(bot.patrolPhase);
                goalY = bot.y + dxP * 0.4 * Math.sin(bot.patrolPhase);
              }
            } else if (sameFloor && bot.role === 'POLICE') {
              const hop = findNextWaypointToward(
                bot.x,
                bot.y,
                player.x,
                player.y,
                botFloorData,
                lockedDoorsForFloor
              );
              goalX = hop.x;
              goalY = hop.y;
              bot.facing = Math.atan2(goalY - bot.y, goalX - bot.x);
            } else {
              bot.facing = Math.atan2(goalY - bot.y, goalX - bot.x);
            }

            const gdx = goalX - bot.x;
            const gdy = goalY - bot.y;
            const gDist = Math.hypot(gdx, gdy);
            const botSpeed = bot.role === 'POLICE' ? 114 : bot.role === 'CAPTAIN' ? 86 : 70;
            if (gDist > 4) {
              bot.x += (gdx / gDist) * botSpeed * dt;
              bot.y += (gdy / gDist) * botSpeed * dt;
              bot.walkCycle += dt;
            }

            bot.x = Math.max(24 + BOT_RADIUS, Math.min(worldW - 24 - BOT_RADIUS, bot.x));
            bot.y = Math.max(20 + BOT_RADIUS, Math.min(worldH - 24 - BOT_RADIUS, bot.y));
            for (const obs of botFloorData.obstacles) {
              const res = resolveCircleRect(bot.x, bot.y, BOT_RADIUS, obs);
              bot.x = res.x;
              bot.y = res.y;
            }
            for (const ld of lockedDoorsForFloor) {
              const res = resolveCircleRect(bot.x, bot.y, BOT_RADIUS, { ...ld, kind: 'vault_wall' });
              bot.x = res.x;
              bot.y = res.y;
            }

            for (const other of bots) {
              if (other.id === bot.id || !other.alive || other.floor !== bot.floor) continue;
              const sdx = bot.x - other.x;
              const sdy = bot.y - other.y;
              const sd = Math.hypot(sdx, sdy);
              if (sd > 0.01 && sd < BOT_RADIUS * 2.2) {
                const push = (BOT_RADIUS * 2.2 - sd) * 0.5;
                bot.x += (sdx / sd) * push;
                bot.y += (sdy / sd) * push;
              }
            }

            bot.fireCooldown -= dt;
            if (seePlayer && distP < 420 && bot.fireCooldown <= 0) {
              bot.fireCooldown =
                bot.role === 'POLICE'
                  ? 1.45 + Math.random() * 0.65
                  : bot.role === 'CAPTAIN'
                  ? 1.45 + Math.random() * 0.45
                  : 1.85 + Math.random() * 0.7;
              const aimSpread = (Math.random() - 0.5) * 0.16;
              const ang = Math.atan2(dyP, dxP) + aimSpread;
              const boltSpd = bot.role === 'POLICE' ? 295 : bot.role === 'CAPTAIN' ? 275 : 235;
              bolts.push({
                floor: bot.floor,
                x: bot.x + Math.cos(ang) * 18,
                y: bot.y + Math.sin(ang) * 18,
                vx: Math.cos(ang) * boltSpd,
                vy: Math.sin(ang) * boltSpd,
                fromPlayer: false,
                life: 2.0,
              });
              playRetroTone(320, 170, 0.09, 'sawtooth', 0.035);
            }
          }

          // PER-FLOOR VAULT UNLOCK CHECK:
          // Eliminating all security bots on floor `v.floor` immediately unlocks `v`!
          for (const v of vaultStates) {
            if (!v.unlocked) {
              const secBotsOnVaultFloor = bots.filter(
                (b) => b.alive && b.role !== 'POLICE' && b.floor === v.floor
              ).length;
              if (secBotsOnVaultFloor === 0) {
                v.unlocked = true;
                playRetroTone(440, 880, 0.25, 'triangle', 0.1);
                setTimeout(() => playRetroTone(660, 1320, 0.3, 'triangle', 0.1), 130);
                spawnSparks(
                  v.floor,
                  v.doorRect.x + v.doorRect.w * 0.5,
                  v.doorRect.y + 10,
                  '#10b981',
                  26,
                  200
                );
                pushHud(`🔓 ${formatFloorTag(v.floor)} SECURITY CLEARED — ${v.label} UNLOCKED!`);
              }
            }
          }

          // Update Bolts
          for (let i = bolts.length - 1; i >= 0; i--) {
            const b = bolts[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;

            const bFloorData = getFloorData(b.floor);
            let remove =
              b.life <= 0 || b.x < 18 || b.x > worldW - 18 || b.y < 14 || b.y > worldH - 14;
            if (!remove) {
              for (const obs of bFloorData.obstacles) {
                if (circleIntersectsRect(b.x, b.y, 3, obs)) {
                  remove = true;
                  spawnSparks(b.floor, b.x, b.y, b.fromPlayer ? '#22d3ee' : '#f87171', 5, 90);
                  break;
                }
              }
            }
            if (!remove) {
              for (const v of vaultStates) {
                if (
                  v.floor === b.floor &&
                  !v.unlocked &&
                  circleIntersectsRect(b.x, b.y, 3, { ...v.doorRect, kind: 'vault_wall' })
                ) {
                  remove = true;
                  spawnSparks(b.floor, b.x, b.y, '#ef4444', 5, 90);
                  break;
                }
              }
            }

            if (!remove && b.fromPlayer) {
              for (const bot of bots) {
                if (!bot.alive || bot.floor !== b.floor) continue;
                if (Math.hypot(b.x - bot.x, b.y - bot.y) <= BOT_RADIUS + 4) {
                  bot.hp -= 25;
                  bot.hitFlash = 0.12;
                  remove = true;
                  spawnSparks(b.floor, b.x, b.y, '#38bdf8', 7, 130);
                  playRetroTone(520, 310, 0.06, 'square', 0.05);
                  if (bot.hp <= 0) {
                    bot.alive = false;
                    screenShake = Math.max(screenShake, 5);
                    spawnSparks(b.floor, bot.x, bot.y, '#facc15', 18, 190);
                    spawnSparks(b.floor, bot.x, bot.y, '#38bdf8', 10, 140);
                    playRetroTone(220, 65, 0.22, 'sawtooth', 0.09);
                    pushHud();
                  }
                  break;
                }
              }
            } else if (!remove && !b.fromPlayer && b.floor === player.floor) {
              if (Math.hypot(b.x - player.x, b.y - player.y) <= PLAYER_RADIUS + 3) {
                player.hp = Math.max(0, player.hp - 20);
                player.hurtFlash = 0.16;
                player.timeSinceHit = 0;
                screenShake = Math.max(screenShake, 7);
                remove = true;
                spawnSparks(b.floor, b.x, b.y, '#ef4444', 9, 135);
                playRetroTone(190, 80, 0.14, 'sawtooth', 0.08);
                pushHud();

                if (player.hp <= 0) {
                  phase = 'knockout';
                  phaseTimer = 0;
                  bolts.length = 0;
                  playRetroTone(420, 110, 0.45, 'triangle', 0.11);
                  pushHud('💫 KNOCKED OUT BY SECURITY!');
                  break;
                }
              }
            }

            if (remove) bolts.splice(i, 1);
          }

          // Check Vault Loots
          for (const v of vaultStates) {
            if (v.unlocked) {
              v.openProgress = Math.min(1, v.openProgress + dt * 2.2);
              if (!v.looted && player.floor === v.floor) {
                const distVault = Math.hypot(player.x - v.lootZone.x, player.y - v.lootZone.y);
                if (distVault <= v.lootZone.radius) {
                  v.looted = true;
                  collectedCash += v.cashShare;
                  spawnSparks(v.floor, v.lootZone.x, v.lootZone.y, '#facc15', 28, 210);
                  playRetroTone(523, 1046, 0.25, 'square', 0.09);
                  setTimeout(() => playRetroTone(784, 1568, 0.35, 'square', 0.09), 150);

                  if (vaultStates.every((vs) => vs.looted)) {
                    phase = 'won';
                    phaseTimer = 0;
                    pushHud(`💰 ALL VAULTS CLEARED (+$${collectedCash.toLocaleString()})! LAUNCHING ★5 GETAWAY!`);
                  } else {
                    pushHud(
                      `💰 +$${v.cashShare.toLocaleString()} GRABBED FROM ${v.label}! CLEAR OTHER FLOORS OR EXIT FRONT DOOR!`
                    );
                  }
                }
              }
            }
          }

          // Allow early getaway through front entry door once at least 1 vault has been looted!
          if (phase === 'playing' && collectedCash > 0 && player.floor === 1) {
            const ed = floorplan.entryDoorRect;
            if (
              player.x >= ed.x + 8 &&
              player.x <= ed.x + ed.w - 8 &&
              player.y >= ed.y - 10
            ) {
              phase = 'won';
              phaseTimer = 0;
              pushHud(`🏃 ESCAPED WITH $${collectedCash.toLocaleString()} IN HAND!`);
            }
          }
        }
      } else if (phase === 'knockout') {
        phaseTimer += dt;
        if (captureBotId === null) {
          let bestDist = Infinity;
          for (const b of bots) {
            if (!b.alive) continue;
            const d = (b.floor === player.floor ? 0 : 1000) + Math.hypot(b.x - player.x, b.y - player.y);
            if (d < bestDist) {
              bestDist = d;
              captureBotId = b.id;
            }
          }
        }
        if (phaseTimer >= 1.7) {
          phase = 'capture';
          phaseTimer = 0;
          const cap = bots.find((b) => b.id === captureBotId && b.alive);
          if (cap && cap.floor !== player.floor) {
            cap.floor = player.floor;
            cap.x = player.x + 80;
            cap.y = player.y + 12;
          }
          playRetroTone(660, 440, 0.18, 'square', 0.08);
          setTimeout(() => playRetroTone(440, 660, 0.18, 'square', 0.08), 190);
          pushHud('🤖 SECURITY CAPTURED YOU — FEDERAL RESTITUTION APPLIED!');
        }
      } else if (phase === 'capture') {
        phaseTimer += dt;
        const captor =
          bots.find((b) => b.id === captureBotId && b.alive && b.floor === player.floor) ||
          bots.find((b) => b.alive && b.floor === player.floor);
        if (captor) {
          const tx = player.x + 24;
          const ty = player.y + 8;
          const dx = tx - captor.x;
          const dy = ty - captor.y;
          const d = Math.hypot(dx, dy);
          captor.facing = Math.atan2(player.y - captor.y, player.x - captor.x);
          if (d > 4) {
            captor.x += (dx / d) * 145 * dt;
            captor.y += (dy / d) * 145 * dt;
            captor.walkCycle += dt;
          }
        }
        if (phaseTimer >= 2.1 && !callbackFired) {
          callbackFired = true;
          callbacksRef.current.onCaptured();
        }
      } else if (phase === 'won') {
        phaseTimer += dt;
        if (phaseTimer >= 1.25 && !callbackFired) {
          callbackFired = true;
          callbacksRef.current.onSuccess(collectedCash);
        }
      }

      // Update Sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 0.92;
        s.vy *= 0.92;
        s.life -= dt;
        if (s.life <= 0) sparks.splice(i, 1);
      }

      hudSyncAccum += dt;
      if (hudSyncAccum >= 0.1) {
        hudSyncAccum = 0;
        pushHud();
      }

      // 2. Render Current Floor (with Smooth Scrolling Camera for Large Multi-Wing Interiors)
      const renderFloorData = getFloorData(player.floor);
      const { theme } = floorplan;
      const camX = Math.max(0, Math.min(Math.max(0, worldW - CANVAS_W), player.x - CANVAS_W * 0.5));
      const camY = Math.max(0, Math.min(Math.max(0, worldH - CANVAS_H), player.y - CANVAS_H * 0.5));
      ctx.save();
      if (screenShake > 0.2) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
      }

      ctx.fillStyle = theme.exteriorBg;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      ctx.save();
      ctx.translate(-Math.round(camX), -Math.round(camY));

      ctx.save();
      ctx.beginPath();
      for (const z of renderFloorData.playableZones) {
        ctx.rect(z.x, z.y, z.w, z.h);
      }
      ctx.clip();

      const ts = theme.tileSize;
      const floorVaults = vaultStates.filter((v) => v.floor === player.floor);
      const startTy = 16 + Math.floor(Math.max(0, camY - 16) / ts) * ts;
      const endTy = Math.min(worldH - 16, camY + CANVAS_H + ts);
      const startTx = 20 + Math.floor(Math.max(0, camX - 20) / ts) * ts;
      const endTx = Math.min(worldW - 20, camX + CANVAS_W + ts);
      for (let ty = startTy; ty < endTy; ty += ts) {
        for (let tx = startTx; tx < endTx; tx += ts) {
          const inVault = floorVaults.some(
            (v) => ty < v.doorRect.y && tx >= v.doorRect.x - 80 && tx <= v.doorRect.x + v.doorRect.w + 80
          );
          const checker = (Math.floor(tx / ts) + Math.floor(ty / ts)) % 2 === 0;
          if (inVault) {
            ctx.fillStyle = checker ? theme.vaultTileA : theme.vaultTileB;
          } else {
            ctx.fillStyle = checker ? theme.floorTileA : theme.floorTileB;
          }
          ctx.fillRect(tx, ty, ts - 1, ts - 1);
        }
      }

      for (const rug of renderFloorData.rugs) {
        ctx.fillStyle = rug.color;
        ctx.fillRect(rug.x, rug.y, rug.w, rug.h);
        ctx.strokeStyle = rug.borderColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(rug.x + 2, rug.y + 2, rug.w - 4, rug.h - 4);
      }

      for (const d of renderFloorData.decors) {
        if (d.kind === 'pool_water') {
          ctx.fillStyle = '#d6d3d1';
          ctx.fillRect(d.x - 8, d.y - 8, d.w + 16, d.h + 16);
          ctx.fillStyle = d.color || '#0284c7';
          ctx.fillRect(d.x, d.y, d.w, d.h);
          const waveOff = Math.sin(animTime * 3) * 6;
          ctx.strokeStyle = d.accent || '#7dd3fc';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(d.x + 12, d.y + 28 + waveOff * 0.3);
          ctx.lineTo(d.x + d.w - 12, d.y + 28 - waveOff * 0.3);
          ctx.moveTo(d.x + 16, d.y + d.h - 28 - waveOff * 0.3);
          ctx.lineTo(d.x + d.w - 16, d.y + d.h - 28 + waveOff * 0.3);
          ctx.stroke();
        } else if (d.kind === 'fireplace_hearth') {
          ctx.fillStyle = d.color || '#44403c';
          ctx.fillRect(d.x, d.y, d.w, d.h);
          const flicker = 0.7 + Math.sin(animTime * 16) * 0.3;
          ctx.fillStyle = `rgba(249, 115, 22, ${flicker})`;
          ctx.fillRect(d.x + 4, d.y + 12, d.w - 8, d.h - 24);
        } else if (d.kind === 'rope_line') {
          ctx.fillStyle = d.color || '#991b1b';
          ctx.fillRect(d.x, d.y + 2, d.w, 4);
          ctx.fillStyle = d.accent || '#facc15';
          ctx.fillRect(d.x, d.y, 7, 8);
          ctx.fillRect(d.x + d.w - 7, d.y, 7, 8);
        } else if (d.kind === 'garage_slab') {
          ctx.fillStyle = d.color || '#334155';
          ctx.fillRect(d.x, d.y, d.w, d.h);
          ctx.strokeStyle = d.accent || '#94a3b8';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([8, 6]);
          ctx.strokeRect(d.x + 8, d.y + 8, d.w - 16, d.h - 16);
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('GARAGE BAY', d.x + d.w * 0.5, d.y + d.h - 14);
        }
      }

      // Staircase Portals (supports B1 / 1F / 2F!)
      for (const st of renderFloorData.stairs) {
        ctx.fillStyle = '#292524';
        ctx.fillRect(st.x, st.y, st.w, st.h);
        const steps = 7;
        const stepH = st.h / steps;
        for (let s = 0; s < steps; s++) {
          ctx.fillStyle = s % 2 === 0 ? '#78350f' : '#92400e';
          ctx.fillRect(st.x + 3, st.y + s * stepH + 1, st.w - 6, stepH - 2);
        }
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(st.x, st.y, st.w, st.h);

        const targetAlive = bots.filter((b) => b.alive && b.floor === st.targetFloor).length;
        const targetUnlocked = vaultStates.some((v) => v.floor === st.targetFloor && v.unlocked && !v.looted);
        const urgent = !isExploreMode && (targetAlive > 0 || targetUnlocked);
        const stairPulse = urgent ? 0.65 + Math.sin(animTime * 8) * 0.35 : 0.9;
        ctx.fillStyle = `rgba(15, 23, 42, 0.9)`;
        ctx.fillRect(st.x - 16, st.y + st.h * 0.5 - 12, st.w + 32, 24);
        ctx.fillStyle = urgent ? `rgba(250, 204, 21, ${stairPulse})` : '#38bdf8';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${st.dir === 'up' ? '▲' : '▼'} ${st.label}`, st.x + st.w * 0.5, st.y + st.h * 0.5 + 3);
      }

      // Elevator Portals (multi-floor express lift!)
      if (renderFloorData.elevators && floorplan.availableFloors.length > 1) {
        for (const el of renderFloorData.elevators) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(el.x, el.y, el.w, el.h);
          ctx.fillStyle = '#334155';
          ctx.fillRect(el.x + 5, el.y + 5, el.w * 0.5 - 6, el.h - 10);
          ctx.fillRect(el.x + el.w * 0.5 + 1, el.y + 5, el.w * 0.5 - 6, el.h - 10);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(el.x, el.y, el.w, el.h);
          ctx.fillStyle = '#22d3ee';
          ctx.fillRect(el.x + el.w * 0.5 - 8, el.y + 8, 6, 4);
          ctx.fillStyle = '#facc15';
          ctx.fillRect(el.x + el.w * 0.5 + 2, el.y + 8, 6, 4);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
          ctx.fillRect(el.x - 10, el.y + el.h * 0.5 - 10, el.w + 20, 20);
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`🛗 ${(el.label || 'ELEVATOR').slice(0, 14)}`, el.x + el.w * 0.5, el.y + el.h * 0.5 + 3);
        }
      }

      // Interactive Mini-Game / Activity Stations (in Explore Mode!)
      if (isExploreMode) {
        for (const act of renderFloorData.activities) {
          const isNear = nearbyActivityRef.current?.id === act.id;
          const pulse = 0.55 + Math.sin(animTime * 6) * 0.35;
          ctx.fillStyle = isNear ? `rgba(34, 211, 238, ${0.28 + pulse * 0.18})` : 'rgba(16, 185, 129, 0.14)';
          ctx.beginPath();
          ctx.arc(act.x, act.y, act.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = isNear ? '#22d3ee' : '#34d399';
          ctx.lineWidth = isNear ? 2.5 : 1.5;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = isNear ? '#fde047' : '#a7f3d0';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(isNear ? '[E] PLAY / USE' : act.label.slice(0, 22), act.x, act.y + 4);
        }
      }

      ctx.restore(); // End floor zone clip

      // Render Vault Loot & Doors on Current Floor
      for (const v of floorVaults) {
        const lx = v.lootZone.x;
        const ly = v.lootZone.y;
        const vRect = v.doorRect;
        if (!v.looted) {
          for (let off = -48; off <= 48; off += 32) {
            if (theme.lootVisual === 'diamonds') {
              ctx.fillStyle = '#0284c7';
              ctx.fillRect(lx + off - 10, ly - 14, 20, 10);
              ctx.fillStyle = '#a5f3fc';
              ctx.fillRect(lx + off - 6, ly - 11, 12, 4);
              ctx.fillStyle = '#facc15';
              ctx.fillRect(lx + off - 9, ly + 4, 18, 9);
            } else if (theme.lootVisual === 'tech_gear') {
              ctx.fillStyle = '#334155';
              ctx.fillRect(lx + off - 10, ly - 14, 20, 10);
              ctx.fillStyle = '#38bdf8';
              ctx.fillRect(lx + off - 7, ly - 11, 14, 5);
              ctx.fillStyle = '#15803d';
              ctx.fillRect(lx + off - 10, ly + 4, 20, 9);
            } else if (theme.lootVisual === 'prize_tickets') {
              ctx.fillStyle = '#facc15';
              ctx.fillRect(lx + off - 10, ly - 14, 18, 10);
              ctx.fillStyle = '#f43f5e';
              ctx.fillRect(lx + off - 6, ly - 11, 10, 4);
              ctx.fillStyle = '#22d3ee';
              ctx.fillRect(lx + off - 10, ly + 4, 20, 9);
            } else {
              ctx.fillStyle = '#ca8a04';
              ctx.fillRect(lx + off - 10, ly - 14, 20, 10);
              ctx.fillStyle = '#facc15';
              ctx.fillRect(lx + off - 8, ly - 12, 16, 5);
              ctx.fillStyle = '#15803d';
              ctx.fillRect(lx + off - 10, ly + 4, 20, 10);
            }
          }
        }

        if (!isExploreMode) {
          if (v.looted) {
            ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('✓ LOOTED', lx, ly + 4);
          } else if (v.unlocked) {
            const pulse = 0.55 + Math.sin(animTime * 8) * 0.35;
            ctx.fillStyle = `rgba(250, 204, 21, ${0.18 + pulse * 0.18})`;
            ctx.beginPath();
            ctx.arc(lx, ly, v.lootZone.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.fillStyle = '#fef08a';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('GRAB LOOT', lx, ly + 4);
          } else {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('LOCKED', lx, ly + 18);
          }
        }

        // Blast Door
        const doorSlide = v.openProgress * (vRect.w * 0.5);
        ctx.fillStyle = '#475569';
        ctx.fillRect(vRect.x - doorSlide, vRect.y, vRect.w / 2, vRect.h);
        ctx.fillRect(vRect.x + vRect.w / 2 + doorSlide, vRect.y, vRect.w / 2, vRect.h);
        if (!v.unlocked) {
          if (!isExploreMode) {
            const laserAlpha = lockedBounceFlash > 0 ? 1 : 0.65 + Math.sin(animTime * 10) * 0.25;
            ctx.fillStyle = `rgba(239, 68, 68, ${laserAlpha})`;
            ctx.fillRect(vRect.x, vRect.y + 6, vRect.w, 3);
            ctx.fillRect(vRect.x, vRect.y + 12, vRect.w, 3);
          }
          ctx.fillStyle = isExploreMode ? '#cbd5e1' : '#fef08a';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`🔒 ${v.label}`, vRect.x + vRect.w / 2, vRect.y - 4);
        } else if (v.openProgress > 0.25) {
          ctx.fillStyle = '#34d399';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(v.looted ? '✓ CLEARED' : '🔓 OPEN', vRect.x + vRect.w / 2, vRect.y - 4);
        }
      }

      for (const obs of renderFloorData.obstacles) {
        drawObstacleProp(obs, theme, animTime);
      }

      ctx.strokeStyle = theme.wallStroke;
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, worldW - 4, worldH - 4);

      // Front Entryway Door on Floor 1
      if (player.floor === 1) {
        const ed = floorplan.entryDoorRect;
        const doorHalfW = ed.w / 2;
        const hingeY = ed.y + 4;
        const swingRad = breachDoorOpen * (Math.PI * 0.62);

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(ed.x, ed.y - 2, ed.w, 16);
        if (breachArmed) {
          const strobeFlip = Math.floor(animTime * 12) % 2 === 0;
          const sirenGlowAlpha = breachTriggered ? 0.28 : 0.42 + Math.sin(animTime * 10) * 0.2;
          ctx.fillStyle = strobeFlip
            ? `rgba(239, 68, 68, ${sirenGlowAlpha})`
            : `rgba(59, 130, 246, ${sirenGlowAlpha})`;
          ctx.beginPath();
          ctx.arc(ed.x + 12, hingeY + 8, 52, Math.PI, 0);
          ctx.fill();
          ctx.fillStyle = strobeFlip
            ? `rgba(59, 130, 246, ${sirenGlowAlpha})`
            : `rgba(239, 68, 68, ${sirenGlowAlpha})`;
          ctx.beginPath();
          ctx.arc(ed.x + ed.w - 12, hingeY + 8, 52, Math.PI, 0);
          ctx.fill();
        }

        const rattleX = breachArmed && !breachTriggered ? Math.sin(animTime * 65) * 2.5 : 0;
        ctx.save();
        ctx.translate(ed.x + rattleX, hingeY);
        ctx.rotate(-swingRad);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(0, -4, doorHalfW - 1, 9);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(0, -4, doorHalfW - 1, 9);
        ctx.restore();

        ctx.save();
        ctx.translate(ed.x + ed.w + rattleX, hingeY);
        ctx.rotate(swingRad);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-(doorHalfW - 1), -4, doorHalfW - 1, 9);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-(doorHalfW - 1), -4, doorHalfW - 1, 9);
        ctx.restore();

        if (isExploreMode || collectedCash > 0) {
          ctx.fillStyle = '#34d399';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(
            collectedCash > 0 ? '🏃 EXIT WITH LOOT' : '🚪 EXIT OUTSIDE',
            ed.x + ed.w * 0.5,
            ed.y - 6
          );
        } else if (breachArmed) {
          const secsLeftDoor = Math.max(0, Math.ceil(breachDelaySec - animTime));
          ctx.fillStyle = breachTriggered ? '#fca5a5' : '#fde047';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(
            breachTriggered
              ? `🚨 ${totalBreachOfficers} POLICE BREACHED DOOR!`
              : `🚨 ${totalBreachOfficers} POLICE BREACHING IN ${secsLeftDoor}S!`,
            ed.x + ed.w * 0.5,
            ed.y - 6
          );
        }
      }

      // Draw NPCs (Explore Mode)
      if (isExploreMode) {
        for (const npc of renderFloorData.npcs) {
          drawFriendlyNpcSprite(npc, nearbyNpcRef.current?.id === npc.id, animTime);
        }
      }

      // Draw Bots (Heist Mode)
      for (const bot of bots) {
        if (!bot.alive && bot.floor === player.floor) {
          drawRobotSprite(bot.x, bot.y, bot.facing, bot.walkCycle, bot.role, 0, false, false, animTime);
        }
      }
      for (const bot of bots) {
        if (!bot.alive || bot.floor !== player.floor) continue;
        const isCapturing = phase === 'capture' && bot.id === captureBotId;
        drawRobotSprite(
          bot.x,
          bot.y,
          bot.facing,
          bot.walkCycle,
          bot.role,
          bot.hitFlash,
          true,
          isCapturing,
          animTime
        );
        const bw = 26;
        const ratio = Math.max(0, bot.hp / bot.maxHp);
        ctx.fillStyle = '#090d16';
        ctx.fillRect(bot.x - bw / 2, bot.y - 29, bw, 4);
        ctx.fillStyle = bot.role === 'POLICE' ? '#60a5fa' : bot.role === 'CAPTAIN' ? '#facc15' : '#ef4444';
        ctx.fillRect(bot.x - bw / 2, bot.y - 29, bw * ratio, 4);
      }

      drawPlayerSprite(animTime);

      for (const b of bolts) {
        if (b.floor !== player.floor) continue;
        ctx.fillStyle = b.fromPlayer ? '#22d3ee' : '#ef4444';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.fromPlayer ? 4 : 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const s of sparks) {
        if (s.floor !== player.floor) continue;
        ctx.globalAlpha = Math.max(0, s.life / s.maxLife);
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
      }
      ctx.globalAlpha = 1;

      if (!isExploreMode && phase === 'playing') {
        const dirX = Math.cos(player.aimAngle);
        const dirY = Math.sin(player.aimAngle);
        ctx.save();
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(player.x + dirX * 20, player.y + dirY * 20);
        ctx.lineTo(player.x + dirX * 44, player.y + dirY * 44);
        ctx.stroke();
        ctx.setLineDash([]);

        const tipX = player.x + dirX * 46;
        const tipY = player.y + dirY * 46;
        ctx.translate(tipX, tipY);
        ctx.rotate(player.aimAngle);
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(-3, -4);
        ctx.lineTo(-3, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      ctx.restore(); // End world camera translate

      if (floorTransitionFlash > 0) {
        ctx.fillStyle = `rgba(250, 204, 21, ${floorTransitionFlash * 0.22})`;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }

      if (phase === 'knockout') {
        ctx.fillStyle = 'rgba(0,0,0,0.42)';
        ctx.fillRect(0, CANVAS_H - 54, CANVAS_W, 38);
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('★ KNOCKED OUT! STARS SPINNING ABOVE YOUR HEAD... ★', CANVAS_W / 2, CANVAS_H - 30);
      } else if (phase === 'capture') {
        ctx.fillStyle = 'rgba(127, 29, 29, 0.72)';
        ctx.fillRect(0, CANVAS_H - 58, CANVAS_W, 42);
        ctx.fillStyle = '#fef2f2';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('🤖 SECURITY CAPTURED YOU — TREATED AS CAUGHT AFTER HEIST!', CANVAS_W / 2, CANVAS_H - 32);
      } else if (phase === 'won') {
        ctx.fillStyle = 'rgba(6, 78, 59, 0.8)';
        ctx.fillRect(0, CANVAS_H / 2 - 36, CANVAS_W, 72);
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`VAULT BREACHED! +$${collectedCash.toLocaleString()} STOLEN!`, CANVAS_W / 2, CANVAS_H / 2 - 4);
        ctx.fillStyle = '#a7f3d0';
        ctx.font = 'bold 13px monospace';
        ctx.fillText('RUSHING TO GETAWAY CAR — ★5 POLICE PURSUIT STARTING!', CANVAS_W / 2, CANVAS_H / 2 + 22);
      }

      ctx.restore();
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [target.id, target.name, target.payoutCash, target.category, target.buildingHeight, target.policeBreach, target.breachDelaySec, isExploreMode]);

  const categoryLabel = isExploreMode
    ? target.isOwnedHouse
      ? 'MY HOUSE · EXPLORE'
      : target.category === 'BUILDING'
      ? 'CITY BUILDING · EXPLORE'
      : 'INTERIOR EXPLORATION'
    : target.category === 'HOUSE'
    ? 'RETRO HOUSE BURGLARY'
    : target.category === 'STORE'
    ? 'RETRO STORE HEIST'
    : target.category === 'JEWELRY'
    ? 'RETRO JEWELRY HEIST'
    : 'RETRO BANK HEIST';

  return (
    <div className="fixed inset-0 z-[90] w-screen h-screen bg-zinc-950 flex flex-col font-mono select-none overflow-hidden">
      <div className={`w-full h-full bg-zinc-950 border-t-2 ${isExploreMode ? 'border-emerald-400/80' : 'border-amber-400/80'} flex flex-col overflow-hidden relative`}>
        {/* Top Header */}
        <div className="bg-zinc-900 border-b border-white/15 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`px-2 py-0.5 rounded font-black text-xs uppercase ${isExploreMode ? 'bg-emerald-400 text-black' : 'bg-amber-400 text-black'}`}>
              {target.icon} {categoryLabel}
            </span>
            <span className="px-2 py-0.5 rounded bg-zinc-800 border border-white/15 text-amber-200 font-bold text-[10px] uppercase">
              {hudState.archetypeLabel}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-black text-white truncate">{target.name}</div>
              <div className="text-[10px] text-zinc-400 truncate">
                {target.streetLocation}
                {!isExploreMode && (
                  <>
                    {' · '}
                    {target.hidePayoutUntilStolen && hudState.phase !== 'won'
                      ? 'Loot Inside: ???'
                      : `Loot: +$${target.payoutCash.toLocaleString()}`}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Multi-Floor Pill (Unlimited Floors) */}
            {hudState.availableFloors.length > 1 && (
              <div className="px-2.5 py-1 rounded-lg border border-sky-400/60 bg-sky-500/15 text-sky-200 text-[10px] font-black">
                🏢 NOW: {formatFloorTag(hudState.currentFloor)} ·{' '}
                {hudState.availableFloors.length <= 6
                  ? hudState.availableFloors
                      .map((f) =>
                        isExploreMode ? formatFloorTag(f) : `${formatFloorTag(f)}:${hudState.botsByFloor[f] ?? 0}`
                      )
                      .join(' · ')
                  : `${formatFloorTag(hudState.availableFloors[0])}–${formatFloorTag(
                      hudState.availableFloors[hudState.availableFloors.length - 1]
                    )} (${hudState.availableFloors.length} FLOORS)`}
              </div>
            )}

            {/* Multi-Vault Status */}
            {!isExploreMode && hudState.vaultSummaries.length > 0 && (
              <div className="flex items-center gap-1.5">
                {hudState.vaultSummaries.map((v) => (
                  <span
                    key={v.id}
                    className={`px-2 py-1 rounded-lg border text-[10px] font-black ${
                      v.looted
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : v.unlocked
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 animate-pulse'
                        : 'bg-zinc-900 border-white/15 text-zinc-400'
                    }`}
                  >
                    {v.looted ? '✓' : v.unlocked ? '🔓' : '🔒'} {formatFloorTag(v.floor)} VAULT
                  </span>
                ))}
              </div>
            )}

            {!isExploreMode && (
              <>
                <div className="flex items-center gap-1.5 bg-black/70 border border-white/15 px-2.5 py-1 rounded-lg">
                  <span className="text-[10px] font-black text-cyan-300">SHIELD</span>
                  <div className="w-20 h-2.5 bg-zinc-800 rounded overflow-hidden border border-white/10">
                    <div
                      className={`h-full transition-all duration-100 ${
                        hudState.hp > 50 ? 'bg-cyan-400' : hudState.hp > 25 ? 'bg-amber-400' : 'bg-red-500'
                      }`}
                      style={{ width: `${(hudState.hp / hudState.maxHp) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-black text-white tabular-nums">{hudState.hp}%</span>
                </div>

                {hudState.breachSecondsLeft !== null && hudState.breachSecondsLeft > 0 && hudState.phase === 'playing' && (
                  <div className="px-2.5 py-1 rounded-lg border border-red-400 bg-red-600/30 text-amber-200 text-[11px] font-black tabular-nums animate-pulse">
                    ⏳ {hudState.policeBreachCount} COPS IN {hudState.breachSecondsLeft}S
                  </div>
                )}

                <div
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-black ${
                    hudState.policeBreachActive
                      ? 'bg-blue-500/20 border-red-400/80 text-amber-300 animate-pulse'
                      : 'bg-rose-500/20 border-rose-400/70 text-rose-300'
                  }`}
                >
                  {hudState.policeBreachActive ? '👮/🤖' : '🤖'} HOSTILES: {hudState.botsAlive}/{hudState.totalBots}
                </div>
              </>
            )}

            {isExploreMode && (
              <>
                {target.isOwnedHouse && onBuyHouseItem && (
                  <button
                    type="button"
                    onClick={() => setShowFurnishShop(true)}
                    className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-[10px] font-black cursor-pointer"
                  >
                    🛋️ BUY HOUSE ITEMS ({furnishings.length}/{HOME_FURNISHINGS_CATALOG.length})
                  </button>
                )}
                {hudState.nearbyActivity && (
                  <button
                    type="button"
                    onClick={() => triggerInteractRef.current()}
                    className="px-3 py-1 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-[10px] font-black cursor-pointer animate-pulse"
                  >
                    🎮 [E] {hudState.nearbyActivity.label}
                  </button>
                )}
                {!hudState.nearbyActivity && hudState.nearbyNpc && (
                  <button
                    type="button"
                    onClick={() => triggerInteractRef.current()}
                    className="px-3 py-1 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black text-[10px] font-black cursor-pointer"
                  >
                    💬 [E] Talk to {hudState.nearbyNpc.name}
                  </button>
                )}
              </>
            )}

            {hudState.phase === 'playing' && (
              <button
                type="button"
                onClick={onAbort}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/15 text-[10px] font-black cursor-pointer"
              >
                {isExploreMode ? '🚪 EXIT BUILDING' : '✖ ABORT'}
              </button>
            )}
          </div>
        </div>

        {/* Status Strip */}
        <div
          className={`px-4 py-1.5 text-center text-xs font-black tracking-wide border-b border-white/10 ${
            isExploreMode
              ? 'bg-emerald-950/70 text-emerald-200'
              : hudState.phase === 'capture' || hudState.phase === 'knockout'
              ? 'bg-red-950/80 text-amber-300'
              : hudState.vaultSummaries.some((v) => v.unlocked && !v.looted)
              ? 'bg-emerald-950/80 text-emerald-300 animate-pulse'
              : hudState.policeBreachActive
              ? 'bg-red-950/75 text-amber-200 animate-pulse'
              : 'bg-amber-950/50 text-amber-200'
          }`}
        >
          [{hudState.floorName}] · {exploreMessage || hudState.bannerText}
        </div>

        {/* Canvas */}
        <div
          style={{ containerType: 'size' }}
          className="flex-1 min-h-0 w-full bg-black flex items-center justify-center overflow-hidden relative"
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{
              imageRendering: 'pixelated',
              width: 'min(100cqw, calc(100cqh * 800 / 520))',
              height: 'min(100cqh, calc(100cqw * 520 / 800))',
            }}
            className="block cursor-pointer bg-zinc-950"
          />

          {activeMiniGame && (
            <InteriorMiniGameModal
              kind={activeMiniGame}
              venueName={target.name}
              streetCash={streetCash}
              isHomeVenue={Boolean(target.isOwnedHouse)}
              onAwardCash={(delta, label) => callbacksRef.current.onAwardExploreCash?.(delta, label)}
              onClose={() => setActiveMiniGame(null)}
            />
          )}

          {elevatorMenu && (
            <div className="absolute inset-0 z-25 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
              <div
                className={`bg-zinc-950 border-2 border-sky-400 rounded-2xl p-5 w-full ${
                  elevatorMenu.availableFloors.length > 6 ? 'max-w-xl' : 'max-w-sm'
                } shadow-[0_0_40px_rgba(56,189,248,0.45)] flex flex-col gap-3`}
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-2 gap-2">
                  <div>
                    <div className="text-[10px] font-black text-sky-400 uppercase tracking-widest">
                      🛗 EXPRESS ELEVATOR · {elevatorMenu.availableFloors.length} FLOORS
                    </div>
                    <h4 className="text-sm font-black text-white">{elevatorMenu.label}</h4>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {elevatorMenu.typedDigits && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400 text-amber-200 text-[10px] font-black tabular-nums">
                        GO: {elevatorMenu.typedDigits}F [ENTER]
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/50 text-sky-200 text-[10px] font-black">
                      NOW: {formatFloorTag(elevatorMenu.currentFloor)}
                    </span>
                  </div>
                </div>

                {elevatorMenu.availableFloors.length > 6 && (
                  <div className="flex items-center justify-between gap-2 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => elevatorSelectRef.current(elevatorMenu.availableFloors[0])}
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-sky-500/25 border border-sky-400/40 text-sky-200 font-black cursor-pointer"
                      >
                        ⬇ {formatFloorTag(elevatorMenu.availableFloors[0])}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          elevatorSelectRef.current(
                            elevatorMenu.availableFloors[Math.floor(elevatorMenu.availableFloors.length / 2)]
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-sky-500/25 border border-sky-400/40 text-sky-200 font-black cursor-pointer"
                      >
                        ◆ {formatFloorTag(
                          elevatorMenu.availableFloors[Math.floor(elevatorMenu.availableFloors.length / 2)]
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          elevatorSelectRef.current(
                            elevatorMenu.availableFloors[elevatorMenu.availableFloors.length - 1]
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/60 text-amber-200 font-black cursor-pointer"
                      >
                        ⬆ TOP ({formatFloorTag(
                          elevatorMenu.availableFloors[elevatorMenu.availableFloors.length - 1]
                        )})
                      </button>
                    </div>
                    <span className="text-zinc-400 font-bold hidden sm:inline">
                      Click Floor or Type # + [ENTER]
                    </span>
                  </div>
                )}

                <div
                  className={`grid gap-2 max-h-[54vh] overflow-y-auto pr-1 ${
                    elevatorMenu.availableFloors.length > 6 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'
                  }`}
                >
                  {[...elevatorMenu.availableFloors].reverse().map((f) => {
                    const isHere = f === elevatorMenu.currentFloor;
                    const isFocused = f === elevatorMenu.selectedFloor;
                    const floorSub = elevatorMenu.floorNames[f] || (f === 0 ? 'BASEMENT' : `FLOOR ${f}`);
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => elevatorSelectRef.current(f)}
                        className={`py-2 px-2.5 rounded-xl font-black text-xs uppercase border transition-all cursor-pointer flex items-center justify-between gap-1.5 text-left ${
                          isHere
                            ? 'bg-sky-400 text-black border-sky-200'
                            : isFocused
                            ? 'bg-sky-500/30 text-white border-sky-300 ring-2 ring-sky-400/60'
                            : 'bg-zinc-900 hover:bg-sky-500/20 text-white border-sky-400/40'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="leading-tight">{formatFloorTag(f)}</div>
                          <div
                            className={`text-[9px] truncate font-bold ${
                              isHere ? 'text-black/75' : 'text-zinc-400'
                            }`}
                          >
                            {floorSub}
                          </div>
                        </div>
                        <span className="text-[10px] opacity-85 shrink-0">
                          {isHere ? 'HERE' : f === 0 ? 'B1' : `FL ${f}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => elevatorCancelRef.current()}
                  className="w-full py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-black uppercase cursor-pointer"
                >
                  Step Off / Cancel [ESC]
                </button>
              </div>
            </div>
          )}

          {showFurnishShop && target.isOwnedHouse && onBuyHouseItem && (
            <div className="absolute inset-0 z-30 bg-black/88 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-4xl max-h-full bg-zinc-900 border border-amber-400/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                <div className="px-4 py-3 bg-zinc-950 border-b border-white/10 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-amber-300">
                      🛋️ HOME RECREATION & ARCADE SHOP — {target.name.toUpperCase()}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Buy tables, cabinets, & simulators! Items automatically appear inside your house for you to play anytime.
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-black text-xs tabular-nums">
                      CASH: ${streetCash.toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFurnishShop(false)}
                      className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-black cursor-pointer"
                    >
                      ✕ CLOSE
                    </button>
                  </div>
                </div>

                <div className="p-4 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {HOME_FURNISHINGS_CATALOG.map((item) => {
                    const isInstalled = furnishings.includes(item.id);
                    const canAfford = streetCash >= item.price;
                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 ${
                          isInstalled
                            ? 'bg-emerald-950/35 border-emerald-500/50'
                            : 'bg-zinc-950/80 border-white/10'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-white">
                              {item.icon} {item.name}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 shrink-0">
                              ${item.price.toLocaleString()}
                            </span>
                          </div>
                          <div className="text-[10px] text-cyan-300 font-bold mt-1">{item.category}</div>
                          <p className="text-[11px] text-zinc-400 mt-1 leading-snug">{item.description}</p>
                        </div>

                        <button
                          type="button"
                          disabled={isInstalled || !canAfford}
                          onClick={() => onBuyHouseItem(item.id)}
                          className={`w-full py-1.5 rounded-lg text-[11px] font-black uppercase cursor-pointer ${
                            isInstalled
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 cursor-default'
                              : canAfford
                              ? 'bg-amber-400 hover:bg-amber-300 text-black'
                              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                          }`}
                        >
                          {isInstalled
                            ? '✓ INSTALLED IN HOUSE'
                            : canAfford
                            ? `BUY & PLACE ($${item.price.toLocaleString()})`
                            : `NEED $${(item.price - streetCash).toLocaleString()} MORE`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Controls Footer */}
        <div className="bg-zinc-900 border-t border-white/10 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-300">
          <div>
            <strong className="text-cyan-300">[WASD / Arrows]</strong> Move ·{' '}
            {isExploreMode ? (
              <>
                <strong className="text-emerald-300">[E / Space]</strong> Talk to NPC / Play Mini-Game
              </>
            ) : (
              <>
                <strong className="text-cyan-300">[Space / Left Click]</strong> Shoot Ahead
              </>
            )}
            {hudState.availableFloors.length > 1 && (
              <>
                {' · '}
                <strong className="text-amber-300">[Stairs / 🛗 Elevator]</strong> Switch Floor (
                {hudState.availableFloors.length <= 6
                  ? hudState.availableFloors.map(formatFloorTag).join(' ↔ ')
                  : `${formatFloorTag(hudState.availableFloors[0])} – ${formatFloorTag(
                      hudState.availableFloors[hudState.availableFloors.length - 1]
                    )} (${hudState.availableFloors.length}F)`}
                )
              </>
            )}
          </div>
          <div className={isExploreMode ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>
            {isExploreMode
              ? '✨ Peaceful Interior Exploration — Walk to Bottom Door or press [ESC] to return to car.'
              : '⚠️ Clear all security bots on a floor to unlock that floor’s vault!'}
          </div>
        </div>
      </div>
    </div>
  );
};
