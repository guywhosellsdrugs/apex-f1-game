import React, { useEffect, useRef, useState } from 'react';

export interface BankMinigameTargetInfo {
  id: string;
  name: string;
  category?: 'BANK' | 'JEWELRY' | 'STORE' | 'HOUSE';
  payoutCash: number;
  streetLocation: string;
  icon: string;
  hidePayoutUntilStolen?: boolean;
  policeBreach?: boolean;
  breachReason?: string;
}

interface BankHeistMinigameProps {
  target: BankMinigameTargetInfo;
  onSuccess: () => void;
  onCaptured: () => void;
  onAbort: () => void;
}

interface WallRect {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'wall' | 'pillar' | 'counter' | 'vault_wall';
}

interface SecurityBot {
  id: number;
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
  role: 'GUARD' | 'CAPTAIN' | 'POLICE';
}

interface Bolt {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromPlayer: boolean;
  life: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

const CANVAS_W = 800;
const CANVAS_H = 520;
const PLAYER_RADIUS = 13;
const BOT_RADIUS = 14;

const VAULT_DOOR_RECT = { x: 348, y: 92, w: 104, h: 20 };
const VAULT_LOOT_ZONE = { x: 400, y: 54, radius: 34 };

const STATIC_OBSTACLES: WallRect[] = [
  // Outer vault room walls (top y=14..108, flanking blast door)
  { x: 236, y: 14, w: 20, h: 98, kind: 'vault_wall' },
  { x: 544, y: 14, w: 20, h: 98, kind: 'vault_wall' },
  { x: 236, y: 92, w: 112, h: 20, kind: 'vault_wall' },
  { x: 452, y: 92, w: 112, h: 20, kind: 'vault_wall' },
  // 4 Marble Hall Pillars
  { x: 208, y: 210, w: 40, h: 40, kind: 'pillar' },
  { x: 552, y: 210, w: 40, h: 40, kind: 'pillar' },
  { x: 208, y: 344, w: 40, h: 40, kind: 'pillar' },
  { x: 552, y: 344, w: 40, h: 40, kind: 'pillar' },
  // Left & Right Bank Teller Counters
  { x: 64, y: 256, w: 92, h: 26, kind: 'counter' },
  { x: 644, y: 256, w: 92, h: 26, kind: 'counter' },
  // Central Security Desk Cover
  { x: 356, y: 286, w: 88, h: 24, kind: 'counter' },
];

function playRetroTone(
  freq: number,
  endFreq: number,
  durationSec: number,
  type: OscillatorType = 'square',
  gainPeak = 0.08
) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
    // Ignore audio errors if blocked by browser autoplay policy
  }
}

function circleIntersectsRect(cx: number, cy: number, r: number, rect: WallRect): boolean {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}

function resolveCircleRect(cx: number, cy: number, r: number, rect: WallRect): { x: number; y: number; hit: boolean } {
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
  // Center is inside rect
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

function hasLineOfSight(x1: number, y1: number, x2: number, y2: number, vaultLocked: boolean): boolean {
  const steps = 16;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    for (let w = 0; w < STATIC_OBSTACLES.length; w++) {
      const obs = STATIC_OBSTACLES[w];
      if (px >= obs.x && px <= obs.x + obs.w && py >= obs.y && py <= obs.y + obs.h) {
        return false;
      }
    }
    if (
      vaultLocked &&
      px >= VAULT_DOOR_RECT.x &&
      px <= VAULT_DOOR_RECT.x + VAULT_DOOR_RECT.w &&
      py >= VAULT_DOOR_RECT.y &&
      py <= VAULT_DOOR_RECT.y + VAULT_DOOR_RECT.h
    ) {
      return false;
    }
  }
  return true;
}

const ENTRY_DOOR_RECT = { x: 344, y: 498, w: 112, h: 16 };

function getBotSpawnsForTarget(payoutCash: number): Array<{ x: number; y: number; role: 'GUARD' | 'CAPTAIN' }> {
  const pool: Array<{ x: number; y: number; role: 'GUARD' | 'CAPTAIN' }> = [
    // Inner hall & side wings (away from player spawn at x=400, y=454)
    { x: 160, y: 175, role: 'GUARD' },
    { x: 640, y: 175, role: 'GUARD' },
    { x: 310, y: 165, role: 'GUARD' },
    { x: 490, y: 165, role: 'GUARD' },
    { x: 120, y: 320, role: 'GUARD' },
    { x: 680, y: 320, role: 'GUARD' },
    { x: 400, y: 155, role: 'CAPTAIN' },
    { x: 88, y: 145, role: 'GUARD' },
    { x: 712, y: 145, role: 'GUARD' },
    { x: 285, y: 245, role: 'GUARD' },
    { x: 515, y: 245, role: 'GUARD' },
    { x: 96, y: 410, role: 'GUARD' },
    { x: 704, y: 410, role: 'GUARD' },
    { x: 205, y: 135, role: 'CAPTAIN' },
    { x: 595, y: 135, role: 'CAPTAIN' },
    { x: 170, y: 315, role: 'GUARD' },
    { x: 630, y: 315, role: 'GUARD' },
    { x: 335, y: 205, role: 'GUARD' },
    { x: 465, y: 205, role: 'GUARD' },
    { x: 72, y: 220, role: 'GUARD' },
    { x: 728, y: 220, role: 'GUARD' },
    { x: 270, y: 330, role: 'CAPTAIN' },
    { x: 530, y: 330, role: 'CAPTAIN' },
    { x: 165, y: 430, role: 'GUARD' },
    { x: 635, y: 430, role: 'GUARD' },
    { x: 118, y: 148, role: 'GUARD' },
    { x: 682, y: 148, role: 'GUARD' },
    { x: 182, y: 138, role: 'CAPTAIN' },
    { x: 618, y: 138, role: 'CAPTAIN' },
    { x: 295, y: 142, role: 'GUARD' },
    { x: 505, y: 142, role: 'GUARD' },
    { x: 400, y: 228, role: 'CAPTAIN' },
  ];

  let count = 2;
  if (payoutCash >= 45000) count = 8;
  else if (payoutCash >= 30000) count = 6;
  else if (payoutCash >= 22000) count = 5;
  else if (payoutCash >= 15000) count = 4;
  else if (payoutCash >= 10000) count = 3;

  return pool.slice(0, count);
}

export const BankHeistMinigame: React.FC<BankHeistMinigameProps> = ({
  target,
  onSuccess,
  onCaptured,
  onAbort,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const callbacksRef = useRef({ onSuccess, onCaptured, onAbort });
  callbacksRef.current = { onSuccess, onCaptured, onAbort };

  const initialSpawns = getBotSpawnsForTarget(target.payoutCash);
  const initialBotCount = initialSpawns.length;

  const [hudState, setHudState] = useState<{
    hp: number;
    maxHp: number;
    botsAlive: number;
    totalBots: number;
    vaultUnlocked: boolean;
    phase: 'playing' | 'knockout' | 'capture' | 'won';
    bannerText: string;
    regenActive: boolean;
    policeBreachActive: boolean;
  }>({
    hp: 100,
    maxHp: 100,
    botsAlive: initialBotCount,
    totalBots: initialBotCount,
    vaultUnlocked: false,
    phase: 'playing',
    bannerText: target.policeBreach
      ? `🚨 ${target.breachReason || 'POLICE APPROACHING DOOR — PREPARE FOR BREACH!'}`
      : `DESTROY ALL ${initialBotCount} SECURITY BOTS TO UNLOCK THE VAULT`,
    regenActive: false,
    policeBreachActive: Boolean(target.policeBreach),
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const botSpawns = getBotSpawnsForTarget(target.payoutCash);

    const bots: SecurityBot[] = botSpawns.map((sp, idx) => ({
      id: idx + 1,
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
      role: sp.role,
    }));

    const player = {
      x: CANVAS_W / 2,
      y: 454,
      hp: 100,
      maxHp: 100,
      aimAngle: -Math.PI / 2,
      fireTimer: 0,
      hurtFlash: 0,
      timeSinceHit: 99,
      walkCycle: 0,
      speed: 215,
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
    let vaultUnlocked = false;
    let vaultDoorOpenProgress = 0;
    let lockedBounceFlash = 0;
    let screenShake = 0;
    let captureBotId: number | null = null;
    let animTime = 0;
    let callbackFired = false;

    // Animated Police Door Breach state (ONLY escalates hostile force when police break in!)
    const breachArmed = Boolean(target.policeBreach);
    let breachTriggered = false;
    let breachDoorOpen = 0;
    let breachOfficersSpawned = 0;
    let breachAlertFlash = 0;
    const totalBreachOfficers = breachArmed ? 14 : 0;

    const spawnSparks = (x: number, y: number, color: string, count: number, speed = 150) => {
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const spd = speed * (0.4 + Math.random() * 0.8);
        sparks.push({
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

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.code;
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
      if (e.button === 0) {
        leftMouseDown = true;
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        leftMouseDown = false;
      }
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
      const aliveCount = bots.filter((b) => b.alive).length;
      const pendingPolice = breachArmed ? Math.max(0, totalBreachOfficers - breachOfficersSpawned) : 0;
      const defaultBanner =
        phase === 'knockout'
          ? '💫 KNOCKED OUT! SEEING STARS...'
          : phase === 'capture'
          ? '👮 ARRESTED / CAPTURED — RESTITUTION & CUSTODY INCOMING!'
          : phase === 'won'
          ? `💰 VAULT LOOT STOLEN (+$${target.payoutCash.toLocaleString()})! GET TO YOUR CAR!`
          : breachTriggered && pendingPolice === 0 && aliveCount > 0 && animTime < 6.5
          ? `🚨 ${totalBreachOfficers} POLICE SWAT OFFICERS BURST THROUGH THE DOOR! CLEAR ALL HOSTILES!`
          : vaultUnlocked
          ? '🔓 ALL HOSTILES CLEARED — ENTER THE TOP VAULT TO STEAL THE LOOT!'
          : breachArmed && !breachTriggered
          ? `🚨 ${target.breachReason || 'SIRENS OUTSIDE! HEAVY SWAT BREACH IMMINENT!'}`
          : `🤖 ELIMINATE ALL ${aliveCount} SECURITY BOTS TO UNLOCK THE VAULT`;
      const regenActive = phase === 'playing' && player.timeSinceHit >= 2.2 && player.hp < player.maxHp;
      setHudState({
        hp: Math.max(0, Math.ceil(player.hp)),
        maxHp: player.maxHp,
        botsAlive: aliveCount,
        totalBots: bots.length + pendingPolice,
        vaultUnlocked,
        phase,
        bannerText: bannerOverride || defaultBanner,
        regenActive,
        policeBreachActive: breachArmed,
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

      // Drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.beginPath();
      ctx.ellipse(0, 12, 13, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      const stride = Math.sin(walk * 8) * 3.5;

      // Legs
      ctx.fillStyle = isPolice ? '#0f172a' : '#334155';
      ctx.fillRect(-7, 5 + stride * 0.4, 5, 8);
      ctx.fillRect(2, 5 - stride * 0.4, 5, 8);

      // Torso armor (Police SWAT = deep Metro PD navy + gold badge; Captain = crimson/gold; Guard = slate/cobalt)
      ctx.fillStyle = hitFlash > 0 ? '#ffffff' : isPolice ? '#172554' : isCaptain ? '#991b1b' : '#334155';
      ctx.fillRect(-10, -8, 20, 15);
      ctx.strokeStyle = isPolice ? '#60a5fa' : isCaptain ? '#facc15' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(-10, -8, 20, 15);

      if (isPolice) {
        // Gold Police Star Badge on Tactical Vest
        ctx.fillStyle = '#facc15';
        ctx.fillRect(-7, -5, 5, 5);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(1, -3, 6, 2);
      } else {
        ctx.fillStyle = isCapturing ? '#f97316' : isCaptain ? '#fde047' : '#38bdf8';
        ctx.fillRect(-3, -3, 6, 6);
      }

      // Weapon arm rotating toward player
      ctx.save();
      ctx.rotate(facing);
      ctx.fillStyle = isPolice ? '#1e293b' : '#475569';
      ctx.fillRect(4, -5, 13, 4);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(14, -6, 6, 6);
      ctx.fillStyle = isPolice ? '#3b82f6' : isCapturing ? '#fb923c' : '#ef4444';
      ctx.fillRect(19, -4, 3, 2);
      ctx.restore();

      // Helmet / Head + Flashing Red/Blue Police Strobe on SWAT Officers!
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

    const drawPlayerSprite = (t: number) => {
      ctx.save();
      ctx.translate(Math.round(player.x), Math.round(player.y));

      if (phase === 'knockout' || phase === 'capture') {
        // Player fell flat down on the bank floor!
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse(0, 5, 18, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Horizontal fallen operative body
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-18, -5, 14, 10); // legs
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-4, -7, 15, 14); // jacket torso
        ctx.fillStyle = '#facc15';
        ctx.fillRect(0, -4, 4, 8); // heist bag strap
        ctx.fillStyle = '#fed7aa';
        ctx.fillRect(11, -5, 9, 10); // head on floor
        ctx.fillStyle = '#111827';
        ctx.fillRect(13, -4, 4, 8); // ski mask / visor closed

        // 5 spinning golden stars above player's knocked-out head!
        const starOrbitCenterX = 14;
        const starOrbitCenterY = -20;
        for (let s = 0; s < 5; s++) {
          const ang = t * 4.8 + (s / 5) * Math.PI * 2;
          const sx = starOrbitCenterX + Math.cos(ang) * 16;
          const sy = starOrbitCenterY + Math.sin(ang) * 6.5;
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

        // Security Bot Capture Containment Ring when bot walks up & captures you
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

      // Standing Player Operative
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 11, 12, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();

      const stride = Math.sin(player.walkCycle * 9) * 3;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-6, 5 + stride * 0.4, 5, 7);
      ctx.fillRect(1, 5 - stride * 0.4, 5, 7);

      // Tactical Heist Suit
      ctx.fillStyle = player.hurtFlash > 0 ? '#ef4444' : '#1e293b';
      ctx.fillRect(-9, -8, 18, 15);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.strokeRect(-9, -8, 18, 15);

      // Gold Duffel Bag on Back
      ctx.fillStyle = '#eab308';
      ctx.fillRect(-6, -5, 5, 10);

      // Aimed EMP Blaster Arm
      ctx.save();
      ctx.rotate(player.aimAngle);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(4, -3, 14, 4);
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(15, -3, 4, 4);
      ctx.restore();

      // Head & Night-Vision Heist Visor
      ctx.fillStyle = '#111827';
      ctx.fillRect(-6, -17, 12, 11);
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(-5, -13, 10, 3);

      ctx.restore();
    };

    const tick = (now: number) => {
      const dt = Math.min(0.033, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      animTime += dt;

      if (screenShake > 0) screenShake = Math.max(0, screenShake - dt * 18);
      if (lockedBounceFlash > 0) lockedBounceFlash = Math.max(0, lockedBounceFlash - dt);
      if (player.hurtFlash > 0) player.hurtFlash = Math.max(0, player.hurtFlash - dt);
      if (phase === 'playing') {
        player.timeSinceHit += dt;
        if (player.timeSinceHit >= 2.2 && player.hp < player.maxHp) {
          player.hp = Math.min(player.maxHp, player.hp + 11 * dt);
        }
      }

      if (breachAlertFlash > 0) breachAlertFlash = Math.max(0, breachAlertFlash - dt);

      // Police Door Breach Sequence (door kicks open & escalated SWAT force charges inside!)
      if (phase === 'playing' && breachArmed) {
        if (!breachTriggered && animTime >= 1.75) {
          breachTriggered = true;
          breachAlertFlash = 2.0;
          screenShake = Math.max(screenShake, 16);
          spawnSparks(400, ENTRY_DOOR_RECT.y - 4, '#f59e0b', 28, 220);
          spawnSparks(400, ENTRY_DOOR_RECT.y - 4, '#ef4444', 22, 200);
          spawnSparks(400, ENTRY_DOOR_RECT.y - 4, '#3b82f6', 22, 200);
          playRetroTone(140, 48, 0.35, 'sawtooth', 0.14);
          setTimeout(() => playRetroTone(740, 520, 0.22, 'square', 0.08), 90);
          pushHud(`🚨 ${totalBreachOfficers} POLICE SWAT OFFICERS BURST THROUGH THE DOOR!`);
        }
        if (breachTriggered) {
          breachDoorOpen = Math.min(1, breachDoorOpen + dt * 5.0);
          // Spawn escalated 14-officer SWAT squad charging through the breached doorway in waves
          const desiredSpawned = Math.min(totalBreachOfficers, 2 + Math.floor((animTime - 1.75) / 0.22));
          while (breachOfficersSpawned < desiredSpawned) {
            const k = breachOfficersSpawned;
            const lane = (k % 5) - 2;
            const spreadX = 400 + lane * 18;
            const rankRow = Math.floor(k / 5);
            bots.push({
              id: 100 + k,
              x: spreadX,
              y: ENTRY_DOOR_RECT.y - 4,
              vx: 0,
              vy: -98,
              hp: k % 4 === 0 ? 85 : 65,
              maxHp: k % 4 === 0 ? 85 : 65,
              alive: true,
              facing: -Math.PI / 2,
              fireCooldown: 0.9 + (k % 5) * 0.26,
              patrolAnchorX: 160 + ((k * 137) % 480),
              patrolAnchorY: 265 + rankRow * 58,
              patrolPhase: k * 0.65,
              hitFlash: 0,
              walkCycle: k * 0.35,
              role: 'POLICE',
            });
            spawnSparks(spreadX, ENTRY_DOOR_RECT.y - 8, '#60a5fa', 6, 115);
            breachOfficersSpawned++;
          }
        }
      }

      // 1. Update Simulation
      if (phase === 'playing') {
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
        // Facing/shooting direction always snaps to the last-pressed directional key (never diagonal midpoint)
        if (moveKeyStack.length > 0) {
          const lastAngle = getAngleForMoveKey(moveKeyStack[moveKeyStack.length - 1]);
          if (lastAngle !== null) {
            player.aimAngle = lastAngle;
          }
        }

        // Clamp within outer bank walls (leaving open room inside vault when unlocked)
        player.x = Math.max(28 + PLAYER_RADIUS, Math.min(CANVAS_W - 28 - PLAYER_RADIUS, player.x));
        player.y = Math.max(24 + PLAYER_RADIUS, Math.min(CANVAS_H - 24 - PLAYER_RADIUS, player.y));

        // Obstacles + locked vault door collision
        for (const obs of STATIC_OBSTACLES) {
          const res = resolveCircleRect(player.x, player.y, PLAYER_RADIUS, obs);
          player.x = res.x;
          player.y = res.y;
        }
        if (!vaultUnlocked) {
          const doorWall: WallRect = { ...VAULT_DOOR_RECT, kind: 'vault_wall' };
          const res = resolveCircleRect(player.x, player.y, PLAYER_RADIUS, doorWall);
          if (res.hit) {
            player.x = res.x;
            player.y = res.y;
            lockedBounceFlash = 0.7;
          }
        }

        // Shoot cyan EMP stun-bolts strictly along facing direction (Space OR Left Mouse Button)
        player.fireTimer = Math.max(0, player.fireTimer - dt);
        if ((leftMouseDown || keys.has('Space')) && player.fireTimer <= 0) {
          player.fireTimer = 0.16;
          const speed = 540;
          const muzzleX = player.x + Math.cos(player.aimAngle) * 18;
          const muzzleY = player.y + Math.sin(player.aimAngle) * 18;
          bolts.push({
            x: muzzleX,
            y: muzzleY,
            vx: Math.cos(player.aimAngle) * speed,
            vy: Math.sin(player.aimAngle) * speed,
            fromPlayer: true,
            life: 1.5,
          });
          playRetroTone(740, 260, 0.08, 'square', 0.06);
        }

        // Update Security Bots & Breaching Police Officers AI
        let aliveCount = 0;
        for (const bot of bots) {
          if (!bot.alive) continue;
          aliveCount++;
          if (bot.hitFlash > 0) bot.hitFlash = Math.max(0, bot.hitFlash - dt);

          const dxP = player.x - bot.x;
          const dyP = player.y - bot.y;
          const distP = Math.hypot(dxP, dyP);
          const seePlayer = hasLineOfSight(bot.x, bot.y, player.x, player.y, !vaultUnlocked);

          bot.patrolPhase += dt * (bot.role === 'POLICE' ? 1.8 : bot.role === 'CAPTAIN' ? 1.45 : 1.1);
          let goalX = bot.patrolAnchorX + Math.sin(bot.patrolPhase) * 44;
          let goalY = bot.patrolAnchorY + Math.cos(bot.patrolPhase * 0.7) * 26;

          if ((seePlayer && distP < 430) || bot.role === 'POLICE') {
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
          } else {
            bot.facing = Math.atan2(goalY - bot.y, goalX - bot.x);
          }

          const gdx = goalX - bot.x;
          const gdy = goalY - bot.y;
          const gDist = Math.hypot(gdx, gdy);
          const botSpeed = bot.role === 'POLICE' ? 112 : bot.role === 'CAPTAIN' ? 86 : 70;
          if (gDist > 4) {
            bot.x += (gdx / gDist) * botSpeed * dt;
            bot.y += (gdy / gDist) * botSpeed * dt;
            bot.walkCycle += dt;
          }

          // Keep bots inside arena walls
          bot.x = Math.max(28 + BOT_RADIUS, Math.min(CANVAS_W - 28 - BOT_RADIUS, bot.x));
          bot.y = Math.max(122 + BOT_RADIUS, Math.min(CANVAS_H - 30 - BOT_RADIUS, bot.y));
          for (const obs of STATIC_OBSTACLES) {
            const res = resolveCircleRect(bot.x, bot.y, BOT_RADIUS, obs);
            bot.x = res.x;
            bot.y = res.y;
          }

          // Separate bots from each other slightly
          for (const other of bots) {
            if (other.id === bot.id || !other.alive) continue;
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
                ? 1.5 + Math.random() * 0.65
                : bot.role === 'CAPTAIN'
                ? 1.45 + Math.random() * 0.45
                : 1.85 + Math.random() * 0.7;
            const aimSpread = (Math.random() - 0.5) * 0.16;
            const ang = Math.atan2(dyP, dxP) + aimSpread;
            const boltSpd = bot.role === 'POLICE' ? 295 : bot.role === 'CAPTAIN' ? 275 : 235;
            bolts.push({
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

        // Check Vault Unlock condition: ALL bots AND any breached Police Officers must be neutralized!
        const allBreachCleared = !breachArmed || (breachTriggered && breachOfficersSpawned >= totalBreachOfficers);
        if (!vaultUnlocked && aliveCount === 0 && allBreachCleared) {
          vaultUnlocked = true;
          playRetroTone(440, 880, 0.25, 'triangle', 0.1);
          setTimeout(() => playRetroTone(660, 1320, 0.3, 'triangle', 0.1), 130);
          spawnSparks(400, 102, '#10b981', 26, 200);
          pushHud('🔓 ALL HOSTILES NEUTRALIZED — VAULT UNLOCKED! STEAL THE LOOT!');
        }

        // Update Bolts
        for (let i = bolts.length - 1; i >= 0; i--) {
          const b = bolts[i];
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.life -= dt;

          let remove = b.life <= 0 || b.x < 24 || b.x > CANVAS_W - 24 || b.y < 18 || b.y > CANVAS_H - 18;
          if (!remove) {
            for (const obs of STATIC_OBSTACLES) {
              if (circleIntersectsRect(b.x, b.y, 3, obs)) {
                remove = true;
                spawnSparks(b.x, b.y, b.fromPlayer ? '#22d3ee' : '#f87171', 5, 90);
                break;
              }
            }
          }
          if (!remove && !vaultUnlocked && circleIntersectsRect(b.x, b.y, 3, { ...VAULT_DOOR_RECT, kind: 'vault_wall' })) {
            remove = true;
            spawnSparks(b.x, b.y, '#ef4444', 5, 90);
          }

          if (!remove && b.fromPlayer) {
            for (const bot of bots) {
              if (!bot.alive) continue;
              if (Math.hypot(b.x - bot.x, b.y - bot.y) <= BOT_RADIUS + 4) {
                bot.hp -= 25;
                bot.hitFlash = 0.12;
                remove = true;
                spawnSparks(b.x, b.y, '#38bdf8', 7, 130);
                playRetroTone(520, 310, 0.06, 'square', 0.05);
                if (bot.hp <= 0) {
                  bot.alive = false;
                  screenShake = Math.max(screenShake, 5);
                  spawnSparks(bot.x, bot.y, '#facc15', 18, 190);
                  spawnSparks(bot.x, bot.y, '#38bdf8', 10, 140);
                  playRetroTone(220, 65, 0.22, 'sawtooth', 0.09);
                  pushHud();
                }
                break;
              }
            }
          } else if (!remove && !b.fromPlayer) {
            if (Math.hypot(b.x - player.x, b.y - player.y) <= PLAYER_RADIUS + 3) {
              player.hp = Math.max(0, player.hp - 20);
              player.hurtFlash = 0.16;
              player.timeSinceHit = 0;
              screenShake = Math.max(screenShake, 7);
              remove = true;
              spawnSparks(b.x, b.y, '#ef4444', 9, 135);
              playRetroTone(190, 80, 0.14, 'sawtooth', 0.08);
              pushHud();

              if (player.hp <= 0) {
                // Transition to Knockout ("fell down + stars spinning above head")!
                phase = 'knockout';
                phaseTimer = 0;
                bolts.length = 0;
                playRetroTone(420, 110, 0.45, 'triangle', 0.11);
                pushHud('💫 KNOCKED OUT BY SECURITY BOT!');
                break;
              }
            }
          }

          if (remove) {
            bolts.splice(i, 1);
          }
        }

        // Check Win Condition: Enter Vault Loot Zone after unlocking
        if (vaultUnlocked) {
          vaultDoorOpenProgress = Math.min(1, vaultDoorOpenProgress + dt * 2.2);
          const distVault = Math.hypot(player.x - VAULT_LOOT_ZONE.x, player.y - VAULT_LOOT_ZONE.y);
          if (distVault <= VAULT_LOOT_ZONE.radius) {
            phase = 'won';
            phaseTimer = 0;
            spawnSparks(VAULT_LOOT_ZONE.x, VAULT_LOOT_ZONE.y, '#facc15', 30, 220);
            playRetroTone(523, 1046, 0.25, 'square', 0.09);
            setTimeout(() => playRetroTone(784, 1568, 0.35, 'square', 0.09), 150);
            pushHud(`💰 +$${target.payoutCash.toLocaleString()} STOLEN! LAUNCHING ★5 GETAWAY!`);
          }
        }
      } else if (phase === 'knockout') {
        phaseTimer += dt;
        // Pick closest living bot to walk in and capture fallen player
        if (captureBotId === null) {
          let bestDist = Infinity;
          for (const b of bots) {
            if (!b.alive) continue;
            const d = Math.hypot(b.x - player.x, b.y - player.y);
            if (d < bestDist) {
              bestDist = d;
              captureBotId = b.id;
            }
          }
        }
        if (phaseTimer >= 1.7) {
          phase = 'capture';
          phaseTimer = 0;
          playRetroTone(660, 440, 0.18, 'square', 0.08);
          setTimeout(() => playRetroTone(440, 660, 0.18, 'square', 0.08), 190);
          pushHud('🤖 SECURITY BOT CAPTURED YOU — FEDERAL RESTITUTION APPLIED!');
        }
      } else if (phase === 'capture') {
        phaseTimer += dt;
        const captor = bots.find((b) => b.id === captureBotId && b.alive) || bots.find((b) => b.alive);
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
          callbacksRef.current.onSuccess();
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

      // 2. Render Retro Pixel Top-Down Bank Floorplan
      ctx.save();
      if (screenShake > 0.2) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
      }

      // Outer Dark Security Wall Frame
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Lobby / Residence Tile or Hardwood Floor
      const isHouseHeist = target.category === 'HOUSE';
      for (let ty = 22; ty < CANVAS_H - 22; ty += 32) {
        for (let tx = 26; tx < CANVAS_W - 26; tx += 32) {
          const isVaultArea = ty < 96 && tx >= 246 && tx <= 544;
          const checker = ((tx >> 5) + (ty >> 5)) % 2 === 0;
          if (isVaultArea) {
            ctx.fillStyle = checker ? '#1e293b' : '#0f172a';
          } else if (isHouseHeist) {
            ctx.fillStyle = checker ? '#3b281c' : '#312117';
          } else {
            ctx.fillStyle = checker ? '#1f2937' : '#263142';
          }
          ctx.fillRect(tx, ty, 31, 31);
        }
      }

      // Red/Emerald Runner leading toward the Vault / Safe Room
      ctx.fillStyle = isHouseHeist ? '#14532d' : '#7f1d1d';
      ctx.fillRect(366, 114, 68, 384);
      ctx.fillStyle = isHouseHeist ? '#34d399' : '#eab308';
      ctx.fillRect(366, 114, 3, 384);
      ctx.fillRect(431, 114, 3, 384);

      // Outer Wall Border Trim
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 4;
      ctx.strokeRect(24, 16, CANVAS_W - 48, CANVAS_H - 34);

      // Vault Gold Bullion & Cash Stacks inside the Top Vault Room
      for (let gx = 292; gx <= 488; gx += 32) {
        // Gold bars
        ctx.fillStyle = '#ca8a04';
        ctx.fillRect(gx, 32, 22, 12);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(gx + 2, 34, 18, 7);
        // Emerald cash bundles
        ctx.fillStyle = '#15803d';
        ctx.fillRect(gx, 52, 22, 12);
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(gx + 4, 55, 14, 6);
      }

      // Vault Loot Extraction Ring
      if (vaultUnlocked) {
        const pulse = 0.55 + Math.sin(animTime * 8) * 0.35;
        ctx.fillStyle = `rgba(250, 204, 21, ${0.18 + pulse * 0.18})`;
        ctx.beginPath();
        ctx.arc(VAULT_LOOT_ZONE.x, VAULT_LOOT_ZONE.y, VAULT_LOOT_ZONE.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GRAB LOOT', VAULT_LOOT_ZONE.x, VAULT_LOOT_ZONE.y + 4);
      } else {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('VAULT LOCKED', VAULT_LOOT_ZONE.x, 78);
      }

      // Draw Vault Door / Laser Security Barrier
      const doorSlide = vaultDoorOpenProgress * 52;
      ctx.fillStyle = '#475569';
      ctx.fillRect(VAULT_DOOR_RECT.x - doorSlide, VAULT_DOOR_RECT.y, VAULT_DOOR_RECT.w / 2, VAULT_DOOR_RECT.h);
      ctx.fillRect(
        VAULT_DOOR_RECT.x + VAULT_DOOR_RECT.w / 2 + doorSlide,
        VAULT_DOOR_RECT.y,
        VAULT_DOOR_RECT.w / 2,
        VAULT_DOOR_RECT.h
      );
      if (!vaultUnlocked) {
        const laserAlpha = lockedBounceFlash > 0 ? 1 : 0.65 + Math.sin(animTime * 10) * 0.25;
        ctx.fillStyle = `rgba(239, 68, 68, ${laserAlpha})`;
        ctx.fillRect(VAULT_DOOR_RECT.x, VAULT_DOOR_RECT.y + 6, VAULT_DOOR_RECT.w, 3);
        ctx.fillRect(VAULT_DOOR_RECT.x, VAULT_DOOR_RECT.y + 12, VAULT_DOOR_RECT.w, 3);
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('🔒 LOCKED', VAULT_DOOR_RECT.x + VAULT_DOOR_RECT.w / 2, VAULT_DOOR_RECT.y - 4);
      } else if (vaultDoorOpenProgress > 0.25) {
        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('🔓 OPEN', VAULT_DOOR_RECT.x + VAULT_DOOR_RECT.w / 2, VAULT_DOOR_RECT.y - 4);
      }

      // Draw Obstacles (Marble Pillars, Teller Counters, Steel Vault Walls)
      for (const obs of STATIC_OBSTACLES) {
        if (obs.kind === 'vault_wall') {
          ctx.fillStyle = '#334155';
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 2;
          ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        } else if (obs.kind === 'pillar') {
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillRect(obs.x + 4, obs.y + 5, obs.w, obs.h);
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(obs.x + 4, obs.y + 4, obs.w - 8, obs.h - 8);
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 2;
          ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        } else {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(obs.x + 3, obs.y + 4, obs.w, obs.h);
          ctx.fillStyle = '#78350f';
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
          ctx.fillStyle = '#b45309';
          ctx.fillRect(obs.x + 3, obs.y + 3, obs.w - 6, obs.h - 6);
        }
      }

      // Outer Wall Border Trim + Animated Entry Double Doorway (bottom center)
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 4;
      ctx.strokeRect(24, 16, CANVAS_W - 48, CANVAS_H - 34);

      // Animated Front Entryway Door (Closed -> Bursts Open when Police Breach!)
      const doorHalfW = ENTRY_DOOR_RECT.w / 2;
      const hingeY = ENTRY_DOOR_RECT.y + 4;
      const swingRad = breachDoorOpen * (Math.PI * 0.62);

      // Door threshold sill & flashing police strobes outside if breachArmed
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(ENTRY_DOOR_RECT.x, ENTRY_DOOR_RECT.y - 2, ENTRY_DOOR_RECT.w, 16);
      if (breachArmed) {
        const strobeFlip = Math.floor(animTime * 12) % 2 === 0;
        const sirenGlowAlpha = breachTriggered ? 0.28 : 0.42 + Math.sin(animTime * 10) * 0.2;
        ctx.fillStyle = strobeFlip
          ? `rgba(239, 68, 68, ${sirenGlowAlpha})`
          : `rgba(59, 130, 246, ${sirenGlowAlpha})`;
        ctx.beginPath();
        ctx.arc(ENTRY_DOOR_RECT.x + 12, hingeY + 8, 52, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = strobeFlip
          ? `rgba(59, 130, 246, ${sirenGlowAlpha})`
          : `rgba(239, 68, 68, ${sirenGlowAlpha})`;
        ctx.beginPath();
        ctx.arc(ENTRY_DOOR_RECT.x + ENTRY_DOOR_RECT.w - 12, hingeY + 8, 52, Math.PI, 0);
        ctx.fill();
      }

      // Left hinged door leaf
      const rattleX = breachArmed && !breachTriggered ? Math.sin(animTime * 65) * 2.5 : 0;
      ctx.save();
      ctx.translate(ENTRY_DOOR_RECT.x + rattleX, hingeY);
      ctx.rotate(-swingRad);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, -4, doorHalfW - 1, 9);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0, -4, doorHalfW - 1, 9);
      ctx.restore();

      // Right hinged door leaf
      ctx.save();
      ctx.translate(ENTRY_DOOR_RECT.x + ENTRY_DOOR_RECT.w + rattleX, hingeY);
      ctx.rotate(swingRad);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-(doorHalfW - 1), -4, doorHalfW - 1, 9);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-(doorHalfW - 1), -4, doorHalfW - 1, 9);
      ctx.restore();

      if (breachArmed) {
        ctx.fillStyle = breachTriggered ? '#fca5a5' : '#fde047';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          breachTriggered ? '🚨 POLICE BREACHED DOOR!' : '🚨 POLICE OUTSIDE DOOR!',
          400,
          ENTRY_DOOR_RECT.y - 6
        );
      }

      // Draw Destroyed Bots & Officers Underneath Standing Entities
      for (const bot of bots) {
        if (!bot.alive) {
          drawRobotSprite(bot.x, bot.y, bot.facing, bot.walkCycle, bot.role, 0, false, false, animTime);
        }
      }

      // Draw Living Security Bots & Police Officers + HP Bars
      for (const bot of bots) {
        if (!bot.alive) continue;
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

        // Overhead Bot HP Bar
        const bw = 26;
        const ratio = Math.max(0, bot.hp / bot.maxHp);
        ctx.fillStyle = '#090d16';
        ctx.fillRect(bot.x - bw / 2, bot.y - 29, bw, 4);
        ctx.fillStyle = bot.role === 'POLICE' ? '#60a5fa' : bot.role === 'CAPTAIN' ? '#facc15' : '#ef4444';
        ctx.fillRect(bot.x - bw / 2, bot.y - 29, bw * ratio, 4);
      }

      // Draw Player Sprite (Standing or Fallen + Spinning Stars + Bot Capture Ring)
      drawPlayerSprite(animTime);

      // Draw Blaster Bolts
      for (const b of bolts) {
        ctx.fillStyle = b.fromPlayer ? '#22d3ee' : '#ef4444';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.fromPlayer ? 4 : 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Impact Sparks
      for (const s of sparks) {
        ctx.globalAlpha = Math.max(0, s.life / s.maxLife);
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
      }
      ctx.globalAlpha = 1;

      // Forward Directional Facing Sight (shows exact firing line along character facing angle)
      if (phase === 'playing') {
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

        // Crisp pixel forward chevron tip
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

      // Knockout / Capture Overlay Banner inside Canvas
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
        ctx.fillText('🤖 SECURITY BOT CAPTURED YOU — TREATED AS CAUGHT AFTER HEIST!', CANVAS_W / 2, CANVAS_H - 32);
      } else if (phase === 'won') {
        ctx.fillStyle = 'rgba(6, 78, 59, 0.8)';
        ctx.fillRect(0, CANVAS_H / 2 - 36, CANVAS_W, 72);
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`VAULT BREACHED! +$${target.payoutCash.toLocaleString()} STOLEN!`, CANVAS_W / 2, CANVAS_H / 2 - 4);
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
  }, [target.id, target.payoutCash, target.category]);

  const categoryLabel =
    target.category === 'HOUSE'
      ? 'RETRO HOUSE BURGLARY'
      : target.category === 'STORE'
      ? 'RETRO STORE HEIST'
      : target.category === 'JEWELRY'
      ? 'RETRO JEWELRY HEIST'
      : 'RETRO BANK HEIST';

  return (
    <div className="fixed inset-0 z-[90] bg-black/88 backdrop-blur-md flex items-center justify-center p-3 font-mono select-none">
      <div className="w-full max-w-[860px] bg-zinc-950 border-2 border-amber-400/80 rounded-2xl shadow-[0_0_50px_rgba(250,204,21,0.35)] overflow-hidden flex flex-col">
        {/* Top Retro Arcade Header */}
        <div className="bg-zinc-900 border-b border-white/15 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="px-2 py-0.5 rounded bg-amber-400 text-black font-black text-xs uppercase">
              {target.icon} {categoryLabel}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-black text-white truncate">{target.name}</div>
              <div className="text-[10px] text-zinc-400 truncate">
                {target.streetLocation} ·{' '}
                {target.hidePayoutUntilStolen && hudState.phase !== 'won'
                  ? 'Loot Inside: ??? (Steal Vault/Safe to Reveal)'
                  : `Loot: +$${target.payoutCash.toLocaleString()}`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Player Shield / HP */}
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
              {hudState.regenActive && (
                <span className="text-[9px] font-black text-emerald-400 animate-pulse">+REGEN</span>
              )}
            </div>

            {/* Security Bots & Police Counter */}
            <div
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-black ${
                hudState.vaultUnlocked
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : hudState.policeBreachActive
                  ? 'bg-blue-500/20 border-red-400/80 text-amber-300 animate-pulse'
                  : 'bg-rose-500/20 border-rose-400/70 text-rose-300'
              }`}
            >
              {hudState.policeBreachActive ? '👮/🤖' : '🤖'} HOSTILES: {hudState.botsAlive}/{hudState.totalBots}
            </div>

            {hudState.phase === 'playing' && (
              <button
                type="button"
                onClick={onAbort}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/15 text-[10px] font-black cursor-pointer"
              >
                ✖ ABORT
              </button>
            )}
          </div>
        </div>

        {/* Mission Objective Status Strip */}
        <div
          className={`px-4 py-1.5 text-center text-xs font-black tracking-wide border-b border-white/10 ${
            hudState.phase === 'capture' || hudState.phase === 'knockout'
              ? 'bg-red-950/80 text-amber-300'
              : hudState.vaultUnlocked
              ? 'bg-emerald-950/80 text-emerald-300 animate-pulse'
              : hudState.policeBreachActive
              ? 'bg-red-950/75 text-amber-200 animate-pulse'
              : 'bg-amber-950/50 text-amber-200'
          }`}
        >
          {hudState.bannerText}
        </div>

        {/* Top-Down Retro Pixel Shooter Canvas */}
        <div className="bg-black flex items-center justify-center p-2">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ imageRendering: 'pixelated' }}
            className="w-full max-w-[800px] aspect-[800/520] rounded-lg border border-white/15 cursor-pointer bg-zinc-950"
          />
        </div>

        {/* Controls Footer */}
        <div className="bg-zinc-900 border-t border-white/10 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-300">
          <div>
            <strong className="text-cyan-300">[WASD / Arrows]</strong> Move &amp; Face Direction ·{' '}
            <strong className="text-cyan-300">[Space / Left Click]</strong> Shoot Ahead
          </div>
          <div className="text-amber-300 font-bold">
            ⚠️ Getting knocked out &amp; captured by bots triggers the full Heist Busted Penalty!
          </div>
        </div>
      </div>
    </div>
  );
};
