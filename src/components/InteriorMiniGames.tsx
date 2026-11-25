import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  isWorkplaceShiftKind,
  type InteriorMinigameKind,
  type WorkplaceShiftKind,
} from '../game/homeFurnishings';
import type { CityOutdoorJobSpec } from '../game/cityTrafficBuilder';

export type { InteriorMinigameKind, WorkplaceShiftKind };

interface InteriorMiniGameModalProps {
  kind: InteriorMinigameKind | WorkplaceShiftKind;
  venueName: string;
  stationLabel?: string;
  streetCash: number;
  isHomeVenue?: boolean;
  onAwardCash: (delta: number, label: string) => void;
  onCompleteWorkShift?: (delta: number, label: string) => void;
  onClose: () => void;
}

// Shared Web Audio FX helper for snappy arcade feedback
function playArcadeSfx(
  freq: number,
  endFreq: number,
  durationSec = 0.09,
  type: OscillatorType = 'triangle',
  gainPeak = 0.07
) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const winAny = window as unknown as { __arcadeMiniAudioCtx?: AudioContext };
    if (!winAny.__arcadeMiniAudioCtx) {
      winAny.__arcadeMiniAudioCtx = new AudioCtx();
    }
    const ctx = winAny.__arcadeMiniAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(Math.max(40, freq), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + durationSec);
    gain.gain.setValueAtTime(gainPeak, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec);
  } catch {
    // Ignore audio context errors
  }
}

interface FloatingPopup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

interface ParticleSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  size: number;
}

// ============================================================================
// 1. 8-BALL CHAMPIONSHIP BILLIARDS VS CPU (Solids vs Stripes — First to Clear Wins)
// ============================================================================
interface PoolBall {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  owner: 'player' | 'cpu' | 'cue';
  stripe?: boolean;
  sunk: boolean;
  isCue?: boolean;
}

const POOL_W = 540;
const POOL_H = 290;
const BALL_R = 8.8;
const POCKETS = [
  { x: 24, y: 24 },
  { x: POOL_W / 2, y: 20 },
  { x: POOL_W - 24, y: 24 },
  { x: 24, y: POOL_H - 24 },
  { x: POOL_W / 2, y: POOL_H - 20 },
  { x: POOL_W - 24, y: POOL_H - 24 },
];

const PoolMiniGame: React.FC<{
  venueName: string;
  onAwardCash: (delta: number, label: string) => void;
  onClose: () => void;
}> = ({ venueName, onAwardCash, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [turnOwner, setTurnOwner] = useState<'player' | 'cpu'>('player');
  const [playerSunk, setPlayerSunk] = useState(0);
  const [cpuSunk, setCpuSunk] = useState(0);
  const [winner, setWinner] = useState<'player' | 'cpu' | null>(null);
  const [statusMsg, setStatusMsg] = useState('YOUR BREAK! YOU ARE SOLIDS (#1–#5) VS CPU STRIPES (#9–#13). FIRST TO CLEAR WINS!');

  const makeRack = (): PoolBall[] => {
    const cx = 368;
    const cy = POOL_H / 2;
    const dx = BALL_R * 1.82;
    const dy = BALL_R * 1.06;
    return [
      { id: 0, x: 138, y: POOL_H / 2, vx: 0, vy: 0, color: '#f8fafc', owner: 'cue', sunk: false, isCue: true },
      // Row 1 (Apex)
      { id: 1, x: cx, y: cy, vx: 0, vy: 0, color: '#facc15', owner: 'player', sunk: false },
      // Row 2
      { id: 9, x: cx + dx, y: cy - dy, vx: 0, vy: 0, color: '#eab308', owner: 'cpu', stripe: true, sunk: false },
      { id: 2, x: cx + dx, y: cy + dy, vx: 0, vy: 0, color: '#2563eb', owner: 'player', sunk: false },
      // Row 3
      { id: 3, x: cx + dx * 2, y: cy - dy * 2, vx: 0, vy: 0, color: '#ef4444', owner: 'player', sunk: false },
      { id: 10, x: cx + dx * 2, y: cy, vx: 0, vy: 0, color: '#3b82f6', owner: 'cpu', stripe: true, sunk: false },
      { id: 11, x: cx + dx * 2, y: cy + dy * 2, vx: 0, vy: 0, color: '#f97316', owner: 'cpu', stripe: true, sunk: false },
      // Row 4
      { id: 12, x: cx + dx * 3, y: cy - dy * 3, vx: 0, vy: 0, color: '#a855f7', owner: 'cpu', stripe: true, sunk: false },
      { id: 4, x: cx + dx * 3, y: cy - dy, vx: 0, vy: 0, color: '#7c3aed', owner: 'player', sunk: false },
      { id: 13, x: cx + dx * 3, y: cy + dy, vx: 0, vy: 0, color: '#16a34a', owner: 'cpu', stripe: true, sunk: false },
      { id: 5, x: cx + dx * 3, y: cy + dy * 3, vx: 0, vy: 0, color: '#f97316', owner: 'player', sunk: false },
    ];
  };

  const stateRef = useRef<{
    balls: PoolBall[];
    aimAngle: number;
    charging: boolean;
    power: number;
    turn: 'player' | 'cpu';
    cpuThinkTimer: number;
    cpuTargetAngle: number;
    cpuShotPower: number;
    cpuAimReady: boolean;
    sunkOwnThisShot: number;
    scratchedThisShot: boolean;
    moving: boolean;
    winner: 'player' | 'cpu' | null;
    popups: FloatingPopup[];
  }>({
    balls: makeRack(),
    aimAngle: 0,
    charging: false,
    power: 0,
    turn: 'player',
    cpuThinkTimer: 0,
    cpuTargetAngle: 0,
    cpuShotPower: 0.65,
    cpuAimReady: false,
    sunkOwnThisShot: 0,
    scratchedThisShot: false,
    moving: false,
    winner: null,
    popups: [],
  });

  const resetRack = () => {
    stateRef.current = {
      balls: makeRack(),
      aimAngle: 0,
      charging: false,
      power: 0,
      turn: 'player',
      cpuThinkTimer: 0,
      cpuTargetAngle: 0,
      cpuShotPower: 0.65,
      cpuAimReady: false,
      sunkOwnThisShot: 0,
      scratchedThisShot: false,
      moving: false,
      winner: null,
      popups: [],
    };
    setTurnOwner('player');
    setPlayerSunk(0);
    setCpuSunk(0);
    setWinner(null);
    setStatusMsg('NEW VS-CPU MATCH! SINK ALL 5 SOLIDS BEFORE THE CPU SINKS ITS 5 STRIPES!');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isSegmentClear = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      balls: PoolBall[],
      ignoreIds: Set<number>
    ): boolean => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 1) return true;
      for (const ob of balls) {
        if (ob.sunk || ignoreIds.has(ob.id)) continue;
        const t = Math.max(0, Math.min(1, ((ob.x - x1) * dx + (ob.y - y1) * dy) / lenSq));
        const px = x1 + t * dx;
        const py = y1 + t * dy;
        if (Math.hypot(ob.x - px, ob.y - py) < BALL_R * 2.02) return false;
      }
      return true;
    };

    const planCpuShot = (balls: PoolBall[]): { angle: number; power: number } => {
      const cue = balls[0];
      const cpuBalls = balls.filter((b) => b.owner === 'cpu' && !b.sunk);
      if (!cue || cpuBalls.length === 0) return { angle: 0, power: 0.6 };

      let bestScore = -Infinity;
      let bestAngle = Math.atan2(cpuBalls[0].y - cue.y, cpuBalls[0].x - cue.x);
      let bestPower = 0.68;

      const ignore = new Set<number>([0]);
      for (const target of cpuBalls) {
        ignore.add(target.id);
        for (const p of POCKETS) {
          const toPktX = p.x - target.x;
          const toPktY = p.y - target.y;
          const pktDist = Math.hypot(toPktX, toPktY);
          if (pktDist < 4) continue;
          const ux = toPktX / pktDist;
          const uy = toPktY / pktDist;

          // Ghost ball impact point behind target ball
          const ghostX = target.x - ux * (BALL_R * 2);
          const ghostY = target.y - uy * (BALL_R * 2);
          if (ghostX < 28 || ghostX > POOL_W - 28 || ghostY < 28 || ghostY > POOL_H - 28) continue;

          const cueToGhostX = ghostX - cue.x;
          const cueToGhostY = ghostY - cue.y;
          const cueDist = Math.hypot(cueToGhostX, cueToGhostY);
          if (cueDist < 4) continue;

          const cutDot = (cueToGhostX / cueDist) * ux + (cueToGhostY / cueDist) * uy;
          if (cutDot < 0.25) continue; // Skip near-impossible >75deg thin cuts

          const clearCue = isSegmentClear(cue.x, cue.y, ghostX, ghostY, balls, ignore);
          const clearObj = isSegmentClear(target.x, target.y, p.x, p.y, balls, ignore);

          let score = cutDot * 120 - (cueDist + pktDist) * 0.12;
          if (clearCue) score += 110;
          if (clearObj) score += 130;

          if (score > bestScore) {
            bestScore = score;
            bestAngle = Math.atan2(cueToGhostY, cueToGhostX);
            bestPower = Math.max(0.42, Math.min(0.92, 0.36 + (cueDist + pktDist) / 560));
          }
        }
        ignore.delete(target.id);
      }

      // Slight human-like CPU error so CPU is challenging (~65% pot rate) yet beatable
      const variance = (Math.random() - 0.5) * 0.055;
      return { angle: bestAngle + variance, power: bestPower };
    };

    let rafId = 0;
    let last = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.03, Math.max(0.004, (now - last) / 1000));
      last = now;
      const st = stateRef.current;

      if (st.turn === 'player' && st.charging && !st.moving && !st.winner) {
        st.power = Math.min(1, st.power + dt * 1.25);
      }

      // CPU turn decision & telegraph animation
      if (st.turn === 'cpu' && !st.moving && !st.winner) {
        if (!st.cpuAimReady) {
          const plan = planCpuShot(st.balls);
          st.cpuTargetAngle = plan.angle;
          st.cpuShotPower = plan.power;
          st.cpuAimReady = true;
          st.cpuThinkTimer = 0.85;
          st.aimAngle = plan.angle;
          st.power = 0;
        } else {
          st.cpuThinkTimer -= dt;
          // Smooth cue pull-back telegraph during last 0.45s
          if (st.cpuThinkTimer < 0.45) {
            st.power = Math.min(st.cpuShotPower, ((0.45 - st.cpuThinkTimer) / 0.45) * st.cpuShotPower);
          }
          if (st.cpuThinkTimer <= 0) {
            const cue = st.balls[0];
            const spd = 235 + st.cpuShotPower * 610;
            cue.vx = Math.cos(st.cpuTargetAngle) * spd;
            cue.vy = Math.sin(st.cpuTargetAngle) * spd;
            st.moving = true;
            st.power = 0;
            st.cpuAimReady = false;
            st.sunkOwnThisShot = 0;
            st.scratchedThisShot = false;
            playArcadeSfx(220, 130, 0.08, 'triangle', 0.065);
          }
        }
      }

      let anyMoving = false;
      const subSteps = 4;
      const sdt = dt / subSteps;
      for (let s = 0; s < subSteps; s++) {
        for (const b of st.balls) {
          if (b.sunk) continue;
          b.x += b.vx * sdt;
          b.y += b.vy * sdt;
          b.vx *= Math.pow(0.28, sdt);
          b.vy *= Math.pow(0.28, sdt);
          if (Math.hypot(b.vx, b.vy) < 5) {
            b.vx = 0;
            b.vy = 0;
          } else {
            anyMoving = true;
          }

          if (b.x < 24 + BALL_R) {
            b.x = 24 + BALL_R;
            b.vx = Math.abs(b.vx) * 0.87;
          } else if (b.x > POOL_W - 24 - BALL_R) {
            b.x = POOL_W - 24 - BALL_R;
            b.vx = -Math.abs(b.vx) * 0.87;
          }
          if (b.y < 24 + BALL_R) {
            b.y = 24 + BALL_R;
            b.vy = Math.abs(b.vy) * 0.87;
          } else if (b.y > POOL_H - 24 - BALL_R) {
            b.y = POOL_H - 24 - BALL_R;
            b.vy = -Math.abs(b.vy) * 0.87;
          }

          for (const p of POCKETS) {
            if (Math.hypot(b.x - p.x, b.y - p.y) < 16) {
              if (b.isCue) {
                b.x = 138;
                b.y = POOL_H / 2;
                b.vx = 0;
                b.vy = 0;
                st.scratchedThisShot = true;
                playArcadeSfx(220, 120, 0.16, 'sawtooth', 0.06);
                st.popups.push({ x: p.x, y: p.y, text: 'SCRATCH!', color: '#f87171', life: 1.0 });
              } else {
                b.sunk = true;
                b.vx = 0;
                b.vy = 0;
                const pCount = st.balls.filter((x) => x.owner === 'player' && x.sunk).length;
                const cCount = st.balls.filter((x) => x.owner === 'cpu' && x.sunk).length;
                setPlayerSunk(pCount);
                setCpuSunk(cCount);
                if (b.owner === st.turn) {
                  st.sunkOwnThisShot++;
                }
                playArcadeSfx(b.owner === 'player' ? 540 : 420, b.owner === 'player' ? 920 : 620, 0.14, 'triangle', 0.08);
                st.popups.push({
                  x: p.x,
                  y: p.y,
                  text: b.owner === 'player' ? `SOLID #${b.id}!` : `STRIPE #${b.id}!`,
                  color: b.owner === 'player' ? '#4ade80' : '#f43f5e',
                  life: 1.05,
                });
              }
            }
          }
        }

        for (let i = 0; i < st.balls.length; i++) {
          const a = st.balls[i];
          if (a.sunk) continue;
          for (let j = i + 1; j < st.balls.length; j++) {
            const b = st.balls[j];
            if (b.sunk) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy);
            const minD = BALL_R * 2;
            if (dist > 0.001 && dist < minD) {
              const nx = dx / dist;
              const ny = dy / dist;
              const overlap = (minD - dist) * 0.5;
              a.x -= nx * overlap;
              a.y -= ny * overlap;
              b.x += nx * overlap;
              b.y += ny * overlap;
              const dvx = a.vx - b.vx;
              const dvy = a.vy - b.vy;
              const dot = dvx * nx + dvy * ny;
              if (dot > 0) {
                const imp = dot * 0.95;
                a.vx -= imp * nx;
                a.vy -= imp * ny;
                b.vx += imp * nx;
                b.vy += imp * ny;
                if (s === 0 && dot > 45) {
                  playArcadeSfx(680, 320, 0.04, 'triangle', 0.035);
                }
              }
            }
          }
        }
      }

      if (st.moving && !anyMoving) {
        st.moving = false;
        const playerLeft = st.balls.filter((b) => b.owner === 'player' && !b.sunk).length;
        const cpuLeft = st.balls.filter((b) => b.owner === 'cpu' && !b.sunk).length;

        if (playerLeft === 0 && !st.winner) {
          st.winner = 'player';
          setWinner('player');
          const prize = 1600 + cpuLeft * 150;
          onAwardCash(prize, '🎱 BILLIARDS VS CPU CHAMPION');
          playArcadeSfx(523, 1046, 0.25, 'triangle', 0.09);
          setStatusMsg(`🏆 YOU CLEARED ALL 5 SOLIDS FIRST! +$${prize.toLocaleString()} PRIZE!`);
        } else if (cpuLeft === 0 && !st.winner) {
          st.winner = 'cpu';
          setWinner('cpu');
          playArcadeSfx(260, 120, 0.28, 'sawtooth', 0.07);
          setStatusMsg(`🤖 CPU CLEARED ALL 5 STRIPES FIRST! BETTER LUCK NEXT RACK!`);
        } else {
          // Turn resolution: keep turn only if player/CPU sunk their own ball without scratching
          const keepTurn = !st.scratchedThisShot && st.sunkOwnThisShot > 0;
          if (!keepTurn) {
            st.turn = st.turn === 'player' ? 'cpu' : 'player';
            setTurnOwner(st.turn);
          }
          if (st.turn === 'player') {
            setStatusMsg(
              keepTurn
                ? `🔥 NICE SHOT! SINK YOUR REMAINING SOLIDS (${5 - playerLeft}/5)!`
                : st.scratchedThisShot
                ? '⚠️ CPU SCRATCHED! YOUR TURN ON SOLIDS!'
                : '🟢 YOUR TURN · AIM AT A SOLID (#1–#5) & HOLD CLICK TO SHOOT!'
            );
          } else {
            setStatusMsg(
              keepTurn
                ? `🤖 CPU SUNK A STRIPE & SHOOTS AGAIN (${5 - cpuLeft}/5)...`
                : st.scratchedThisShot
                ? '⚠️ YOU SCRATCHED! CPU IS LINING UP A SHOT...'
                : '🤖 CPU TURN · LINING UP A STRIPE SHOT...'
            );
          }
        }
        st.sunkOwnThisShot = 0;
        st.scratchedThisShot = false;
      }

      for (let i = st.popups.length - 1; i >= 0; i--) {
        st.popups[i].y -= 24 * dt;
        st.popups[i].life -= dt;
        if (st.popups[i].life <= 0) st.popups.splice(i, 1);
      }

      // Draw Mahogany Table & Brass Corners
      ctx.fillStyle = '#3b1504';
      ctx.fillRect(0, 0, POOL_W, POOL_H);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(10, 10, POOL_W - 20, POOL_H - 20);
      ctx.fillStyle = '#fbbf24';
      for (let dx = 95; dx < POOL_W - 60; dx += 88) {
        ctx.fillRect(dx - 2, 14, 4, 4);
        ctx.fillRect(dx - 2, POOL_H - 18, 4, 4);
      }
      ctx.fillStyle = '#15803d';
      ctx.fillRect(22, 22, POOL_W - 44, POOL_H - 44);
      ctx.strokeStyle = '#166534';
      ctx.lineWidth = 3;
      ctx.strokeRect(23, 23, POOL_W - 46, POOL_H - 46);

      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(138, 24);
      ctx.lineTo(138, POOL_H - 24);
      ctx.stroke();

      for (const p of POCKETS) {
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 13.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Ghost-ball trajectory raycast preview when aiming (player or CPU telegraph)
      const cue = st.balls[0];
      if (!st.moving && !st.winner && cue) {
        const dirX = Math.cos(st.aimAngle);
        const dirY = Math.sin(st.aimAngle);
        let bestT = 260;
        let hitBall: PoolBall | null = null;
        for (const b of st.balls) {
          if (b.isCue || b.sunk) continue;
          const ox = cue.x - b.x;
          const oy = cue.y - b.y;
          const rSum = BALL_R * 2;
          const proj = -(ox * dirX + oy * dirY);
          if (proj <= 0) continue;
          const distSq = ox * ox + oy * oy - proj * proj;
          if (distSq < rSum * rSum) {
            const thc = Math.sqrt(rSum * rSum - distSq);
            const tHit = proj - thc;
            if (tHit > 0 && tHit < bestT) {
              bestT = tHit;
              hitBall = b;
            }
          }
        }
        if (dirX > 0.001) bestT = Math.min(bestT, (POOL_W - 24 - BALL_R - cue.x) / dirX);
        if (dirX < -0.001) bestT = Math.min(bestT, (24 + BALL_R - cue.x) / dirX);
        if (dirY > 0.001) bestT = Math.min(bestT, (POOL_H - 24 - BALL_R - cue.y) / dirY);
        if (dirY < -0.001) bestT = Math.min(bestT, (24 + BALL_R - cue.y) / dirY);

        const gx = cue.x + dirX * bestT;
        const gy = cue.y + dirY * bestT;

        ctx.strokeStyle = st.turn === 'cpu' ? 'rgba(244,63,94,0.55)' : 'rgba(255,255,255,0.45)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cue.x, cue.y);
        ctx.lineTo(gx, gy);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle =
          st.turn === 'cpu'
            ? 'rgba(244,63,94,0.75)'
            : hitBall
            ? hitBall.owner === 'player'
              ? 'rgba(74, 222, 128, 0.85)'
              : 'rgba(248, 113, 113, 0.8)'
            : 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.arc(gx, gy, BALL_R, 0, Math.PI * 2);
        ctx.stroke();

        if (hitBall) {
          const defAng = Math.atan2(hitBall.y - gy, hitBall.x - gx);
          ctx.strokeStyle = hitBall.owner === 'player' ? '#4ade80' : '#f87171';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(hitBall.x, hitBall.y);
          ctx.lineTo(hitBall.x + Math.cos(defAng) * 62, hitBall.y + Math.sin(defAng) * 62);
          ctx.stroke();
        }
      }

      for (const b of st.balls) {
        if (b.sunk) continue;
        ctx.fillStyle = 'rgba(0,0,0,0.36)';
        ctx.beginPath();
        ctx.arc(b.x + 2, b.y + 3, BALL_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = b.stripe ? '#f8fafc' : b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
        ctx.fill();
        if (b.stripe) {
          ctx.fillStyle = b.color;
          ctx.fillRect(b.x - BALL_R + 1.5, b.y - 4.3, BALL_R * 2 - 3, 8.6);
        }
        ctx.strokeStyle =
          b.isCue
            ? 'rgba(255,255,255,0.65)'
            : b.owner === st.turn && !st.moving && !st.winner
            ? '#ffffff'
            : 'rgba(255,255,255,0.35)';
        ctx.lineWidth = b.owner === st.turn && !b.isCue ? 1.4 : 1;
        ctx.stroke();
        if (!b.isCue) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(b.x, b.y, 4.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 6.5px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(b.id), b.x, b.y + 0.5);
        }
      }

      if (!st.moving && !st.winner && cue) {
        const pullBack = 16 + st.power * 38;
        const sx = cue.x - Math.cos(st.aimAngle) * pullBack;
        const sy = cue.y - Math.sin(st.aimAngle) * pullBack;
        const ex = cue.x - Math.cos(st.aimAngle) * (pullBack + 125);
        const ey = cue.y - Math.sin(st.aimAngle) * (pullBack + 125);
        ctx.strokeStyle = st.turn === 'cpu' ? '#f43f5e' : '#f59e0b';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - Math.cos(st.aimAngle) * 7, sy - Math.sin(st.aimAngle) * 7);
        ctx.stroke();

        if (st.turn === 'player' && st.charging) {
          ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
          ctx.fillRect(14, POOL_H - 22, 130, 12);
          ctx.fillStyle = st.power > 0.78 ? '#f43f5e' : st.power > 0.45 ? '#facc15' : '#22c55e';
          ctx.fillRect(16, POOL_H - 20, Math.round(126 * st.power), 8);
        }
      }

      for (const pop of st.popups) {
        ctx.globalAlpha = Math.max(0, pop.life);
        ctx.fillStyle = pop.color;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pop.text, pop.x, pop.y);
      }
      ctx.globalAlpha = 1;

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [onAwardCash]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const st = stateRef.current;
    if (st.turn !== 'player' || st.moving || st.winner) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * POOL_W;
    const my = ((e.clientY - rect.top) / rect.height) * POOL_H;
    const cue = st.balls[0];
    if (cue) {
      st.aimAngle = Math.atan2(my - cue.y, mx - cue.x);
    }
  };

  const handleMouseDown = () => {
    const st = stateRef.current;
    if (st.turn !== 'player' || st.moving || st.winner) return;
    st.charging = true;
    st.power = 0.22;
  };

  const handleMouseUp = () => {
    const st = stateRef.current;
    if (!st.charging) return;
    st.charging = false;
    if (st.turn !== 'player' || st.moving || st.winner) return;
    const cue = st.balls[0];
    const spd = 235 + st.power * 640;
    cue.vx = Math.cos(st.aimAngle) * spd;
    cue.vy = Math.sin(st.aimAngle) * spd;
    st.moving = true;
    st.power = 0;
    st.sunkOwnThisShot = 0;
    st.scratchedThisShot = false;
    playArcadeSfx(240, 140, 0.08, 'triangle', 0.07);
  };

  return (
    <div className="bg-zinc-950 border-2 border-emerald-400 rounded-2xl p-4 w-full max-w-xl shadow-[0_0_50px_rgba(16,185,129,0.45)] font-mono flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-white/10 pb-2 gap-2">
        <div>
          <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">
            🎱 BILLIARDS VS CPU · {venueName}
          </span>
          <h3 className="text-sm font-black text-white">FIRST TO MAKE ALL 5 SHOTS WINS!</h3>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-black shrink-0">
          <span
            className={`px-2 py-1 rounded-lg border ${
              turnOwner === 'player'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                : 'bg-rose-500/20 border-rose-400 text-rose-300'
            }`}
          >
            {winner
              ? winner === 'player'
                ? '🏆 YOU WIN'
                : '🤖 CPU WINS'
              : turnOwner === 'player'
              ? '🟢 YOUR TURN'
              : '🤖 CPU TURN'}
          </span>
          <span className="px-2 py-1 rounded-lg bg-zinc-900 border border-emerald-500/40 text-emerald-300">
            YOU (SOLIDS): {playerSunk}/5
          </span>
          <span className="px-2 py-1 rounded-lg bg-zinc-900 border border-rose-500/40 text-rose-300">
            CPU (STRIPES): {cpuSunk}/5
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={POOL_W}
        height={POOL_H}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`w-full h-auto rounded-xl border-2 border-amber-700/60 select-none ${
          turnOwner === 'player' && !winner ? 'cursor-crosshair' : 'cursor-wait'
        }`}
      />

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-cyan-300 font-bold truncate">{statusMsg}</span>
        <div className="flex items-center gap-2 shrink-0">
          {winner && (
            <button
              type="button"
              onClick={resetRack}
              className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black font-black uppercase cursor-pointer"
            >
              Play Again
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-black uppercase cursor-pointer"
          >
            Stand Up
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. CYBER BLASTER DX (Moving Waves + Laser Beam + Combo Multiplier + Sparks)
// ============================================================================
interface ArcadeTarget {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: 'drone' | 'speeder' | 'gold';
  life: number;
  maxLife: number;
}

const ARCADE_W = 480;
const ARCADE_H = 270;

const ArcadeMiniGame: React.FC<{
  venueName: string;
  onAwardCash: (delta: number, label: string) => void;
  onClose: () => void;
}> = ({ venueName, onAwardCash, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [timeLeft, setTimeLeft] = useState(22);
  const [done, setDone] = useState(false);

  const ref = useRef<{
    targets: ArcadeTarget[];
    sparks: ParticleSpark[];
    popups: FloatingPopup[];
    laserFlash: { x1: number; y1: number; x2: number; y2: number; life: number; color: string } | null;
    mouseX: number;
    mouseY: number;
    nextId: number;
    spawnTimer: number;
    timeLeft: number;
    score: number;
    combo: number;
    done: boolean;
  }>({
    targets: [],
    sparks: [],
    popups: [],
    laserFlash: null,
    mouseX: ARCADE_W / 2,
    mouseY: ARCADE_H / 2,
    nextId: 1,
    spawnTimer: 0.08,
    timeLeft: 22,
    score: 0,
    combo: 1,
    done: false,
  });

  const restart = () => {
    ref.current = {
      targets: [],
      sparks: [],
      popups: [],
      laserFlash: null,
      mouseX: ARCADE_W / 2,
      mouseY: ARCADE_H / 2,
      nextId: 1,
      spawnTimer: 0.08,
      timeLeft: 22,
      score: 0,
      combo: 1,
      done: false,
    };
    setScore(0);
    setCombo(1);
    setTimeLeft(22);
    setDone(false);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.04, Math.max(0.005, (now - last) / 1000));
      last = now;
      const st = ref.current;

      if (!st.done) {
        st.timeLeft = Math.max(0, st.timeLeft - dt);
        setTimeLeft(Math.ceil(st.timeLeft));
        st.spawnTimer -= dt;
        if (st.spawnTimer <= 0 && st.targets.length < 6) {
          st.spawnTimer = 0.38;
          const roll = Math.random();
          const kind: ArcadeTarget['kind'] = roll < 0.2 ? 'gold' : roll < 0.48 ? 'speeder' : 'drone';
          const spd = kind === 'gold' ? 95 : kind === 'speeder' ? 120 : 48;
          const ang = Math.random() * Math.PI * 2;
          const life = kind === 'gold' ? 1.45 : kind === 'speeder' ? 1.7 : 2.1;
          st.targets.push({
            id: st.nextId++,
            x: 40 + Math.random() * (ARCADE_W - 80),
            y: 36 + Math.random() * (ARCADE_H - 96),
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            r: kind === 'gold' ? 15 : kind === 'speeder' ? 17 : 21,
            kind,
            life,
            maxLife: life,
          });
        }
        for (let i = st.targets.length - 1; i >= 0; i--) {
          const t = st.targets[i];
          t.x += t.vx * dt;
          t.y += t.vy * dt;
          if (t.x < t.r + 12 || t.x > ARCADE_W - t.r - 12) t.vx *= -1;
          if (t.y < t.r + 12 || t.y > ARCADE_H - t.r - 40) t.vy *= -1;
          t.life -= dt;
          if (t.life <= 0) st.targets.splice(i, 1);
        }
        if (st.timeLeft <= 0) {
          st.done = true;
          setDone(true);
          const cash = Math.min(950, Math.round(st.score * 1.4));
          if (cash > 0) {
            onAwardCash(cash, '🕹️ CYBER BLASTER DX PRIZE');
            playArcadeSfx(523, 987, 0.25, 'triangle', 0.08);
          }
        }
      }

      if (st.laserFlash) {
        st.laserFlash.life -= dt;
        if (st.laserFlash.life <= 0) st.laserFlash = null;
      }
      for (let i = st.sparks.length - 1; i >= 0; i--) {
        const sp = st.sparks[i];
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.life -= dt;
        if (sp.life <= 0) st.sparks.splice(i, 1);
      }
      for (let i = st.popups.length - 1; i >= 0; i--) {
        st.popups[i].y -= 28 * dt;
        st.popups[i].life -= dt;
        if (st.popups[i].life <= 0) st.popups.splice(i, 1);
      }

      ctx.fillStyle = '#070b14';
      ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);
      ctx.strokeStyle = 'rgba(56,189,248,0.12)';
      ctx.lineWidth = 1;
      for (let x = 0; x < ARCADE_W; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ARCADE_H);
        ctx.stroke();
      }
      for (let y = 0; y < ARCADE_H; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(ARCADE_W, y);
        ctx.stroke();
      }

      // Targets with radial countdown ring
      for (const t of st.targets) {
        const col = t.kind === 'gold' ? '#facc15' : t.kind === 'speeder' ? '#f472b6' : '#22d3ee';
        ctx.fillStyle = t.kind === 'gold' ? 'rgba(250,204,21,0.2)' : t.kind === 'speeder' ? 'rgba(244,114,182,0.2)' : 'rgba(34,211,238,0.18)';
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r + 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (t.life / t.maxLife));
        ctx.stroke();

        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r - 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }

      // Laser turret at bottom
      const turAng = Math.atan2(st.mouseY - (ARCADE_H - 12), st.mouseX - ARCADE_W / 2);
      ctx.save();
      ctx.translate(ARCADE_W / 2, ARCADE_H - 12);
      ctx.rotate(turAng);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(0, -4, 24, 8);
      ctx.restore();
      ctx.fillStyle = '#0ea5e9';
      ctx.beginPath();
      ctx.arc(ARCADE_W / 2, ARCADE_H - 10, 12, Math.PI, 0);
      ctx.fill();

      if (st.laserFlash) {
        ctx.globalAlpha = Math.min(1, st.laserFlash.life * 8);
        ctx.strokeStyle = st.laserFlash.color;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(st.laserFlash.x1, st.laserFlash.y1);
        ctx.lineTo(st.laserFlash.x2, st.laserFlash.y2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      for (const sp of st.sparks) {
        ctx.globalAlpha = Math.max(0, sp.life * 2.2);
        ctx.fillStyle = sp.color;
        ctx.fillRect(sp.x - sp.size / 2, sp.y - sp.size / 2, sp.size, sp.size);
      }
      ctx.globalAlpha = 1;

      for (const pop of st.popups) {
        ctx.globalAlpha = Math.max(0, pop.life * 1.4);
        ctx.fillStyle = pop.color;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pop.text, pop.x, pop.y);
      }
      ctx.globalAlpha = 1;

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [onAwardCash]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    ref.current.mouseX = ((e.clientX - rect.left) / rect.width) * ARCADE_W;
    ref.current.mouseY = ((e.clientY - rect.top) / rect.height) * ARCADE_H;
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const st = ref.current;
    if (st.done) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * ARCADE_W;
    const my = ((e.clientY - rect.top) / rect.height) * ARCADE_H;
    st.mouseX = mx;
    st.mouseY = my;

    let hitAny = false;
    for (let i = st.targets.length - 1; i >= 0; i--) {
      const t = st.targets[i];
      if (Math.hypot(mx - t.x, my - t.y) <= t.r + 7) {
        hitAny = true;
        const base = t.kind === 'gold' ? 45 : t.kind === 'speeder' ? 25 : 15;
        const gained = base * st.combo;
        st.score += gained;
        st.combo = Math.min(5, st.combo + 1);
        setScore(st.score);
        setCombo(st.combo);
        const col = t.kind === 'gold' ? '#facc15' : t.kind === 'speeder' ? '#f472b6' : '#22d3ee';
        st.laserFlash = { x1: ARCADE_W / 2, y1: ARCADE_H - 12, x2: t.x, y2: t.y, life: 0.14, color: col };
        for (let p = 0; p < 12; p++) {
          const ang = (Math.PI * 2 * p) / 12 + Math.random() * 0.4;
          const spd = 70 + Math.random() * 110;
          st.sparks.push({ x: t.x, y: t.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, color: col, life: 0.42, size: 3 });
        }
        st.popups.push({ x: t.x, y: t.y - 8, text: `+${gained}`, color: col, life: 0.7 });
        st.targets.splice(i, 1);
        playArcadeSfx(620 + st.combo * 85, 290, 0.08, 'square', 0.05);
        break;
      }
    }

    if (!hitAny) {
      st.combo = 1;
      setCombo(1);
      st.laserFlash = { x1: ARCADE_W / 2, y1: ARCADE_H - 12, x2: mx, y2: my, life: 0.1, color: '#ef4444' };
      playArcadeSfx(220, 110, 0.06, 'sawtooth', 0.04);
    }
  };

  return (
    <div className="bg-zinc-950 border-2 border-cyan-400 rounded-2xl p-4 w-full max-w-xl shadow-[0_0_50px_rgba(34,211,238,0.45)] font-mono flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div>
          <span className="text-[10px] font-black uppercase text-cyan-400 tracking-widest">
            🕹️ CYBER BLASTER DX · {venueName}
          </span>
          <h3 className="text-base font-black text-white">ZAP MOVING DRONES · BUILD COMBO STREAKS</h3>
        </div>
        <div className="flex items-center gap-2 text-xs font-black">
          <span className="px-2 py-1 rounded-lg bg-fuchsia-950 border border-fuchsia-400/50 text-fuchsia-300">
            x{combo}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-amber-300">
            TIME: {timeLeft}S
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-cyan-300">
            PTS: {score}
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={ARCADE_W}
        height={ARCADE_H}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        className="w-full h-auto rounded-xl border border-cyan-400/40 cursor-crosshair select-none"
      />

      <div className="flex items-center justify-between text-xs">
        <span className="text-emerald-300 font-bold">
          {done
            ? `🏆 FINAL SCORE: ${score} PTS · PRIZE +$${Math.min(950, Math.round(score * 1.4))}!`
            : 'CYAN +15 · PINK SPEEDER +25 · GOLD +45 · DON’T MISS TO KEEP COMBO!'}
        </span>
        <div className="flex items-center gap-2">
          {done && (
            <button
              type="button"
              onClick={restart}
              className="px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-black uppercase cursor-pointer"
            >
              Play Again
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-black uppercase cursor-pointer"
          >
            Step Off
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. NEON SKEE-BALL ALLEY (Target Reticle + Ramp Gravity + 2X Spotlight + Streaks)
// ============================================================================
const SKEE_W = 460;
const SKEE_H = 310;
const SKEE_RINGS = [
  { x: SKEE_W / 2 - 66, y: 54, r: 17, pts: 100, color: '#facc15', label: '100' },
  { x: SKEE_W / 2 + 66, y: 54, r: 17, pts: 100, color: '#facc15', label: '100' },
  { x: SKEE_W / 2, y: 74, r: 21, pts: 50, color: '#fb7185', label: '50' },
  { x: SKEE_W / 2, y: 118, r: 24, pts: 40, color: '#c084fc', label: '40' },
  { x: SKEE_W / 2, y: 162, r: 27, pts: 30, color: '#38bdf8', label: '30' },
  { x: SKEE_W / 2, y: 205, r: 30, pts: 20, color: '#34d399', label: '20' },
];

const SkeeBallMiniGame: React.FC<{
  venueName: string;
  onAwardCash: (delta: number, label: string) => void;
  onClose: () => void;
}> = ({ venueName, onAwardCash, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onAwardRef = useRef(onAwardCash);
  onAwardRef.current = onAwardCash;

  const [ballsLeft, setBallsLeft] = useState(9);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [statusMsg, setStatusMsg] = useState('AIM & HOLD CLICK (OR [SPACE]) TO LINE UP TARGET RING!');
  const [done, setDone] = useState(false);

  const stRef = useRef({
    aimX: SKEE_W / 2,
    hoverY: 74,
    hoverOnBoard: false,
    chargeStartedAt: 0,
    charging: false,
    chargeDir: 1,
    power: 0.68,
    rolling: false,
    sinking: false,
    sinkTimer: 0,
    sinkTargetX: SKEE_W / 2,
    sinkTargetY: 120,
    bx: SKEE_W / 2,
    by: 282,
    vx: 0,
    vy: 0,
    targetStopY: 120,
    ballsLeft: 9,
    score: 0,
    streak: 0,
    bonusRingIdx: 2,
    bonusTimer: 3.6,
    flashRingIdx: -1,
    flashTimer: 0,
    rollAnimTime: 0,
    popups: [] as FloatingPopup[],
    done: false,
  });

  const resetGame = () => {
    stRef.current = {
      aimX: SKEE_W / 2,
      hoverY: 74,
      hoverOnBoard: false,
      chargeStartedAt: 0,
      charging: false,
      chargeDir: 1,
      power: 0.68,
      rolling: false,
      sinking: false,
      sinkTimer: 0,
      sinkTargetX: SKEE_W / 2,
      sinkTargetY: 120,
      bx: SKEE_W / 2,
      by: 282,
      vx: 0,
      vy: 0,
      targetStopY: 120,
      ballsLeft: 9,
      score: 0,
      streak: 0,
      bonusRingIdx: Math.floor(Math.random() * SKEE_RINGS.length),
      bonusTimer: 3.6,
      flashRingIdx: -1,
      flashTimer: 0,
      rollAnimTime: 0,
      popups: [],
      done: false,
    };
    setBallsLeft(9);
    setScore(0);
    setStreak(0);
    setDone(false);
    setStatusMsg('AIM ON BOARD + CLICK (OR HOLD FOR POWER) · [A/D] + [SPACE]!');
  };

  const fireBall = () => {
    const st = stRef.current;
    if (!st.charging) return;
    st.charging = false;
    if (st.rolling || st.sinking || st.done) return;
    // Quick-click on the board aims directly at cursor depth; holding sweeps the power bar!
    const heldMs = performance.now() - st.chargeStartedAt;
    if (heldMs < 110 && st.hoverOnBoard) {
      st.power = Math.max(0.08, Math.min(1.0, (214 - st.hoverY) / 168));
    }
    const targetY = Math.max(44, 214 - st.power * 168);
    const dx = st.aimX - SKEE_W / 2;
    const dy = targetY - 282;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const speed = 410 + st.power * 230;
    st.vx = (dx / dist) * speed;
    st.vy = (dy / dist) * speed;
    st.targetStopY = targetY;
    st.rolling = true;
    st.rollAnimTime = 0;
    playArcadeSfx(210, 390, 0.09, 'triangle', 0.05);
  };
  const fireBallRef = useRef(fireBall);
  fireBallRef.current = fireBall;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const keysHeld = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.stopPropagation();
        keysHeld.add(e.code);
      }
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        e.stopPropagation();
        const st = stRef.current;
        if (!st.rolling && !st.sinking && !st.done && !st.charging) {
          st.charging = true;
          st.chargeStartedAt = performance.now();
          st.hoverOnBoard = false;
          st.chargeDir = 1;
          st.power = 0.22;
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysHeld.delete(e.code);
      if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        fireBallRef.current();
      }
    };
    const onWinPointerUp = () => {
      if (stRef.current.charging) {
        fireBallRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerup', onWinPointerUp);

    let rafId = 0;
    let last = performance.now();

    const finishRoll = (awardedPts: number, hitLabel: string, hitIdx: number) => {
      const st = stRef.current;
      st.rolling = false;
      st.sinking = false;
      const mult = hitIdx === st.bonusRingIdx ? 2 : 1;
      if (awardedPts >= 40) {
        st.streak += 1;
      } else {
        st.streak = 0;
      }
      const streakBonus = st.streak >= 2 ? 10 * (st.streak - 1) : 0;
      const totalHit = awardedPts * mult + streakBonus;
      st.score += totalHit;
      st.ballsLeft = Math.max(0, st.ballsLeft - 1);
      st.flashRingIdx = hitIdx;
      st.flashTimer = 0.65;
      st.popups.push({
        x: st.bx,
        y: st.by,
        text: mult === 2 ? `2X +${totalHit}!` : streakBonus > 0 ? `🔥 +${totalHit}!` : `+${totalHit}`,
        color: mult === 2 ? '#fde047' : streakBonus > 0 ? '#f472b6' : '#38bdf8',
        life: 1.05,
      });
      playArcadeSfx(totalHit >= 100 ? 780 : 480, totalHit >= 100 ? 1240 : 700, 0.16, 'triangle', 0.08);
      setScore(st.score);
      setStreak(st.streak);
      setBallsLeft(st.ballsLeft);
      st.bx = SKEE_W / 2;
      st.by = 282;

      if (st.ballsLeft <= 0 && !st.done) {
        st.done = true;
        setDone(true);
        const prize = Math.min(1400, Math.max(200, Math.round(st.score * 2.0)));
        onAwardRef.current(prize, '🎳 NEON SKEE-BALL PRIZE');
        setStatusMsg(`🏆 FINAL SCORE ${st.score} PTS! WON +$${prize} PRIZE!`);
      } else {
        setStatusMsg(
          `${hitLabel}${mult === 2 ? ' (2X BONUS!)' : ''}${streakBonus > 0 ? ` · ${st.streak}x STREAK!` : ''} (+${totalHit}) · ${st.ballsLeft} LEFT!`
        );
      }
    };

    const step = (now: number) => {
      const dt = Math.min(0.03, Math.max(0.005, (now - last) / 1000));
      last = now;
      const st = stRef.current;

      if ((keysHeld.has('ArrowLeft') || keysHeld.has('KeyA')) && !st.rolling && !st.sinking) {
        st.aimX = Math.max(122, st.aimX - 185 * dt);
      }
      if ((keysHeld.has('ArrowRight') || keysHeld.has('KeyD')) && !st.rolling && !st.sinking) {
        st.aimX = Math.min(SKEE_W - 122, st.aimX + 185 * dt);
      }

      st.bonusTimer -= dt;
      if (st.bonusTimer <= 0) {
        st.bonusTimer = 3.6;
        st.bonusRingIdx = (st.bonusRingIdx + 1) % SKEE_RINGS.length;
      }
      if (st.flashTimer > 0) st.flashTimer = Math.max(0, st.flashTimer - dt);
      for (let i = st.popups.length - 1; i >= 0; i--) {
        st.popups[i].y -= 26 * dt;
        st.popups[i].life -= dt;
        if (st.popups[i].life <= 0) st.popups.splice(i, 1);
      }

      if (st.charging && !st.rolling && !st.sinking && !st.done) {
        st.power += dt * 0.85 * st.chargeDir;
        if (st.power >= 1) {
          st.power = 1;
          st.chargeDir = -1;
        } else if (st.power <= 0.16) {
          st.power = 0.16;
          st.chargeDir = 1;
        }
      }

      if (st.sinking) {
        st.sinkTimer -= dt;
        st.bx += (st.sinkTargetX - st.bx) * Math.min(1, dt * 16);
        st.by += (st.sinkTargetY - st.by) * Math.min(1, dt * 16);
        if (st.sinkTimer <= 0) {
          const ri = st.flashRingIdx;
          const r = ri >= 0 ? SKEE_RINGS[ri] : null;
          finishRoll(
            r ? r.pts : 10,
            r ? (r.pts === 100 ? '🔥 CORNER 100 JACKPOT!' : `🎯 ${r.pts}-POINT RING!`) : '🟡 OUTER BOARD',
            ri
          );
        }
      } else if (st.rolling) {
        st.rollAnimTime += dt;
        st.bx += st.vx * dt;
        st.by += st.vy * dt;
        // Uniform slight up-ramp friction preserving aimed trajectory line cleanly
        if (st.by < 236) {
          const damp = Math.max(0.86, 1 - dt * 0.25);
          st.vx *= damp;
          st.vy *= damp;
        }
        // Gutter rails bounce
        if (st.bx < 108) {
          st.bx = 108;
          st.vx = Math.abs(st.vx) * 0.72;
          playArcadeSfx(280, 180, 0.04, 'triangle', 0.03);
        } else if (st.bx > SKEE_W - 108) {
          st.bx = SKEE_W - 108;
          st.vx = -Math.abs(st.vx) * 0.72;
          playArcadeSfx(280, 180, 0.04, 'triangle', 0.03);
        }
        // Top backboard bounce instead of clipping out
        if (st.by < 32) {
          st.by = 32;
          st.vy = Math.abs(st.vy) * 0.42 + 45;
          playArcadeSfx(240, 140, 0.05, 'triangle', 0.04);
        }

        // Check pocket drop near target crest OR direct high-accuracy drop inside pocket!
        const crestReached = st.by <= st.targetStopY || st.vy >= -22;
        if (st.by <= 228 && crestReached) {
          let matchedIdx = -1;
          let matchedDist = Infinity;
          for (let ri = 0; ri < SKEE_RINGS.length; ri++) {
            const r = SKEE_RINGS[ri];
            const distToCenter = Math.hypot(st.bx - r.x, st.by - r.y);
            if (distToCenter <= r.r + 5 && distToCenter < matchedDist) {
              matchedDist = distToCenter;
              matchedIdx = ri;
            }
          }
          if (matchedIdx >= 0) {
            st.rolling = false;
            st.sinking = true;
            st.sinkTimer = 0.18;
            st.flashRingIdx = matchedIdx;
            st.sinkTargetX = SKEE_RINGS[matchedIdx].x;
            st.sinkTargetY = SKEE_RINGS[matchedIdx].y;
          } else if (st.by <= st.targetStopY + 2 || st.vy >= 30 || st.rollAnimTime > 2.0) {
            finishRoll(10, '🟡 OUTER BOARD', -1);
          }
        }
      }

      ctx.fillStyle = '#070a12';
      ctx.fillRect(0, 0, SKEE_W, SKEE_H);
      // Neon lane rails & perspective apron
      ctx.fillStyle = '#451a03';
      ctx.fillRect(86, 12, SKEE_W - 172, SKEE_H - 18);
      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 2;
      ctx.strokeRect(86, 12, SKEE_W - 172, SKEE_H - 18);

      ctx.fillStyle = '#78350f';
      ctx.fillRect(96, 18, SKEE_W - 192, SKEE_H - 28);
      // Perspective wood planks
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 1;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(SKEE_W / 2 + i * 32, 224);
        ctx.lineTo(SKEE_W / 2 + i * 36, SKEE_H - 12);
        ctx.stroke();
      }
      // Animated neon lane chevrons
      const chevPhase = Math.floor(now / 180) % 3;
      for (let cy = 248; cy <= 286; cy += 18) {
        const idx = Math.round((286 - cy) / 18);
        ctx.strokeStyle = idx === chevPhase ? 'rgba(56, 189, 248, 0.8)' : 'rgba(56, 189, 248, 0.22)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(SKEE_W / 2 - 22, cy + 6);
        ctx.lineTo(SKEE_W / 2, cy);
        ctx.lineTo(SKEE_W / 2 + 22, cy + 6);
        ctx.stroke();
      }

      // Ramp lip & launch line
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(96, 232);
      ctx.lineTo(SKEE_W - 96, 232);
      ctx.stroke();

      // Target board backdrop
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(102, 22, SKEE_W - 204, 210);
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 2;
      ctx.strokeRect(102, 22, SKEE_W - 204, 210);

      for (let ri = 0; ri < SKEE_RINGS.length; ri++) {
        const r = SKEE_RINGS[ri];
        const isBonus = ri === st.bonusRingIdx;
        const isFlash = ri === st.flashRingIdx && (st.flashTimer > 0 || st.sinking);
        ctx.fillStyle = isFlash ? 'rgba(250, 204, 21, 0.38)' : isBonus ? 'rgba(250, 204, 21, 0.16)' : '#090d16';
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isBonus ? '#fde047' : r.color;
        ctx.lineWidth = isBonus ? 3.5 : 2.5;
        ctx.stroke();
        ctx.fillStyle = isBonus ? '#fde047' : r.color;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isBonus ? `${r.label}*2` : r.label, r.x, r.y);
      }

      // Aim trajectory + Predicted landing reticle while aiming/charging!
      if (!st.rolling && !st.sinking && !st.done) {
        const previewPower =
          st.charging
            ? st.power
            : st.hoverOnBoard
            ? Math.max(0.08, Math.min(1.0, (214 - st.hoverY) / 168))
            : st.power;
        const predY = Math.max(44, 214 - previewPower * 168);
        const predX = Math.max(114, Math.min(SKEE_W - 114, st.aimX));
        ctx.strokeStyle = st.charging ? 'rgba(250,204,21,0.85)' : 'rgba(56,189,248,0.5)';
        ctx.lineWidth = 1.75;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(st.bx, st.by);
        ctx.lineTo(predX, predY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = st.charging ? '#fde047' : '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(predX, predY, st.charging ? 8 + Math.sin(now * 0.015) * 2 : 7, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Skee-Ball scales slightly smaller up-ramp and shrinks smoothly into pocket
      const depthScale = st.sinking
        ? Math.max(0.2, (st.sinkTimer / 0.18) * 0.78)
        : 0.72 + ((st.by - 40) / 245) * 0.35;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(st.bx, st.by, 9.5 * depthScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Power meter with ring target markers
      ctx.fillStyle = '#18181b';
      ctx.fillRect(22, 48, 24, 212);
      ctx.strokeStyle = '#52525b';
      ctx.strokeRect(22, 48, 24, 212);
      const fillH = Math.round(st.power * 208);
      ctx.fillStyle = st.power > 0.88 ? '#facc15' : st.power > 0.75 ? '#fb7185' : '#22d3ee';
      ctx.fillRect(24, 258 - fillH, 20, fillH);
      // Mark 100 & 50 sweet spots on PWR bar
      ctx.fillStyle = '#facc15';
      ctx.fillRect(20, 258 - Math.round(0.95 * 208), 28, 2);
      ctx.fillStyle = '#fb7185';
      ctx.fillRect(20, 258 - Math.round(0.83 * 208), 28, 2);
      ctx.fillStyle = '#e4e4e7';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PWR', 34, 36);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 8px monospace';
      ctx.fillText('100', 60, 62);
      ctx.fillStyle = '#fb7185';
      ctx.fillText('50', 58, 88);

      for (const pop of st.popups) {
        ctx.globalAlpha = Math.max(0, pop.life);
        ctx.fillStyle = pop.color;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pop.text, pop.x, pop.y);
      }
      ctx.globalAlpha = 1;

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerup', onWinPointerUp);
    };
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * SKEE_W;
    const my = ((e.clientY - rect.top) / rect.height) * SKEE_H;
    stRef.current.aimX = Math.max(122, Math.min(SKEE_W - 122, mx));
    stRef.current.hoverY = Math.max(44, Math.min(220, my));
    stRef.current.hoverOnBoard = my < 232;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * SKEE_W;
    const my = ((e.clientY - rect.top) / rect.height) * SKEE_H;
    const st = stRef.current;
    st.aimX = Math.max(122, Math.min(SKEE_W - 122, mx));
    st.hoverY = Math.max(44, Math.min(220, my));
    st.hoverOnBoard = my < 232;
    if (st.rolling || st.sinking || st.done) return;
    st.charging = true;
    st.chargeStartedAt = performance.now();
    st.chargeDir = 1;
    st.power = st.hoverOnBoard ? Math.max(0.16, Math.min(1.0, (214 - st.hoverY) / 168)) : 0.22;
  };

  const handlePointerUp = () => {
    fireBallRef.current();
  };

  return (
    <div className="bg-zinc-950 border-2 border-fuchsia-400 rounded-2xl p-4 w-full max-w-xl shadow-[0_0_50px_rgba(232,121,249,0.45)] font-mono flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div>
          <span className="text-[10px] font-black uppercase text-fuchsia-400 tracking-widest">
            🎳 NEON SKEE-BALL ALLEY · {venueName}
          </span>
          <h3 className="text-base font-black text-white">CLICK ANY RING OR HOLD TO CHARGE POWER!</h3>
        </div>
        <div className="flex items-center gap-2 text-xs font-black">
          {streak >= 2 && (
            <span className="px-2 py-1 rounded-lg bg-pink-500/20 border border-pink-400 text-pink-300">
              🔥 {streak}x
            </span>
          )}
          <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-amber-300">
            BALLS: {ballsLeft}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-fuchsia-300">
            PTS: {score}
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={SKEE_W}
        height={SKEE_H}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        className="w-full h-auto rounded-xl border border-fuchsia-400/40 cursor-crosshair select-none touch-none"
      />

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-emerald-300 font-bold truncate">{statusMsg}</span>
        <div className="flex items-center gap-2 shrink-0">
          {done && (
            <button
              type="button"
              onClick={resetGame}
              className="px-3 py-1.5 rounded-lg bg-fuchsia-400 hover:bg-fuchsia-300 text-black font-black uppercase cursor-pointer"
            >
              Play Again
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-black uppercase cursor-pointer"
          >
            Step Off
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. NEON PRO AIR HOCKEY (Puck Trail + Impact Sparks + Horn Strobe + Smart CPU)
// ============================================================================
const AH_W = 500;
const AH_H = 265;

const AirHockeyMiniGame: React.FC<{
  venueName: string;
  onAwardCash: (delta: number, label: string) => void;
  onClose: () => void;
}> = ({ venueName, onAwardCash, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pScore, setPScore] = useState(0);
  const [cpuScore, setCpuScore] = useState(0);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const ref = useRef({
    px: 84,
    py: AH_H / 2,
    pvx: 0,
    pvy: 0,
    cx: AH_W - 84,
    cy: AH_H / 2,
    cvx: 0,
    cvy: 0,
    bx: AH_W / 2,
    by: AH_H / 2,
    bvx: 240,
    bvy: 145,
    trail: [] as { x: number; y: number }[],
    sparks: [] as ParticleSpark[],
    goalFlash: 0,
    goalFlashColor: '#38bdf8',
    pGoals: 0,
    cGoals: 0,
    done: false,
  });

  const resetMatch = () => {
    ref.current = {
      px: 84,
      py: AH_H / 2,
      pvx: 0,
      pvy: 0,
      cx: AH_W - 84,
      cy: AH_H / 2,
      cvx: 0,
      cvy: 0,
      bx: AH_W / 2,
      by: AH_H / 2,
      bvx: (Math.random() < 0.5 ? 1 : -1) * 240,
      bvy: (Math.random() - 0.5) * 210,
      trail: [],
      sparks: [],
      goalFlash: 0,
      goalFlashColor: '#38bdf8',
      pGoals: 0,
      cGoals: 0,
      done: false,
    };
    setPScore(0);
    setCpuScore(0);
    setDoneMsg(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let last = performance.now();
    const GOAL_TOP = AH_H / 2 - 48;
    const GOAL_BOT = AH_H / 2 + 48;

    const addSparks = (x: number, y: number, col: string, count = 8) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 60 + Math.random() * 120;
        ref.current.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color: col, life: 0.35, size: 3 });
      }
    };

    const collideMallet = (mx: number, my: number, mvx: number, mvy: number, col: string) => {
      const st = ref.current;
      const dx = st.bx - mx;
      const dy = st.by - my;
      const dist = Math.hypot(dx, dy);
      const minD = 30;
      if (dist > 0.001 && dist < minD) {
        const nx = dx / dist;
        const ny = dy / dist;
        st.bx = mx + nx * minD;
        st.by = my + ny * minD;
        const relVx = st.bvx - mvx;
        const relVy = st.bvy - mvy;
        const dot = relVx * nx + relVy * ny;
        if (dot < 0) {
          st.bvx = st.bvx - 1.8 * dot * nx + mvx * 0.45;
          st.bvy = st.bvy - 1.8 * dot * ny + mvy * 0.45;
          addSparks(st.bx - nx * 11, st.by - ny * 11, col, 6);
          playArcadeSfx(520, 260, 0.05, 'triangle', 0.05);
        }
        const spd = Math.hypot(st.bvx, st.bvy);
        if (spd > 620) {
          st.bvx = (st.bvx / spd) * 620;
          st.bvy = (st.bvy / spd) * 620;
        }
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(0.03, Math.max(0.004, (now - last) / 1000));
      last = now;
      const st = ref.current;
      if (st.goalFlash > 0) st.goalFlash = Math.max(0, st.goalFlash - dt * 1.8);

      for (let i = st.sparks.length - 1; i >= 0; i--) {
        st.sparks[i].x += st.sparks[i].vx * dt;
        st.sparks[i].y += st.sparks[i].vy * dt;
        st.sparks[i].life -= dt;
        if (st.sparks[i].life <= 0) st.sparks.splice(i, 1);
      }

      if (!st.done) {
        // Smart CPU AI: attacks puck on its half, otherwise protects crease
        const puckOnCpuSide = st.bx > AH_W * 0.48;
        const targetCx = puckOnCpuSide
          ? Math.max(AH_W / 2 + 24, Math.min(AH_W - 28, st.bx + 18))
          : AH_W - 58;
        const targetCy = puckOnCpuSide
          ? st.by
          : Math.max(GOAL_TOP + 12, Math.min(GOAL_BOT - 12, st.by * 0.65 + (AH_H / 2) * 0.35));
        const prevCx = st.cx;
        const prevCy = st.cy;
        const dxC = targetCx - st.cx;
        const dyC = targetCy - st.cy;
        const stepMax = 285 * dt;
        const cDist = Math.hypot(dxC, dyC);
        if (cDist > 1) {
          const mv = Math.min(stepMax, cDist);
          st.cx += (dxC / cDist) * mv;
          st.cy += (dyC / cDist) * mv;
        }
        st.cx = Math.max(AH_W / 2 + 22, Math.min(AH_W - 26, st.cx));
        st.cy = Math.max(26, Math.min(AH_H - 26, st.cy));
        st.cvx = (st.cx - prevCx) / dt;
        st.cvy = (st.cy - prevCy) / dt;

        st.bx += st.bvx * dt;
        st.by += st.bvy * dt;
        st.bvx *= Math.pow(0.86, dt);
        st.bvy *= Math.pow(0.86, dt);

        st.trail.push({ x: st.bx, y: st.by });
        if (st.trail.length > 10) st.trail.shift();

        if (st.by < 21) {
          st.by = 21;
          st.bvy = Math.abs(st.bvy) * 0.95;
          addSparks(st.bx, 21, '#facc15', 4);
        } else if (st.by > AH_H - 21) {
          st.by = AH_H - 21;
          st.bvy = -Math.abs(st.bvy) * 0.95;
          addSparks(st.bx, AH_H - 21, '#facc15', 4);
        }

        const inGoalY = st.by >= GOAL_TOP && st.by <= GOAL_BOT;
        if (st.bx < 21) {
          if (inGoalY) {
            st.cGoals++;
            st.goalFlash = 1.0;
            st.goalFlashColor = '#ef4444';
            setCpuScore(st.cGoals);
            playArcadeSfx(240, 110, 0.25, 'sawtooth', 0.08);
            st.bx = AH_W / 2;
            st.by = AH_H / 2;
            st.bvx = -230;
            st.bvy = (Math.random() - 0.5) * 180;
            st.trail = [];
            if (st.cGoals >= 5) {
              st.done = true;
              onAwardCash(280, '🏒 AIR HOCKEY PARTICIPATION');
              setDoneMsg(`CPU WINS 5-${st.pGoals}! PARTICIPATION PRIZE +$280!`);
            }
          } else {
            st.bx = 21;
            st.bvx = Math.abs(st.bvx) * 0.95;
          }
        } else if (st.bx > AH_W - 21) {
          if (inGoalY) {
            st.pGoals++;
            st.goalFlash = 1.0;
            st.goalFlashColor = '#22d3ee';
            setPScore(st.pGoals);
            playArcadeSfx(523, 1046, 0.26, 'square', 0.08);
            st.bx = AH_W / 2;
            st.by = AH_H / 2;
            st.bvx = 230;
            st.bvy = (Math.random() - 0.5) * 180;
            st.trail = [];
            if (st.pGoals >= 5) {
              st.done = true;
              const prize = 1050 + (5 - st.cGoals) * 75;
              onAwardCash(prize, '🏒 AIR HOCKEY CHAMPIONSHIP');
              setDoneMsg(`🏆 YOU WIN ${st.pGoals}-${st.cGoals}! JACKPOT +$${prize} PRIZE!`);
            }
          } else {
            st.bx = AH_W - 21;
            st.bvx = -Math.abs(st.bvx) * 0.95;
          }
        }

        collideMallet(st.px, st.py, st.pvx, st.pvy, '#38bdf8');
        collideMallet(st.cx, st.cy, st.cvx, st.cvy, '#f87171');
        st.pvx *= 0.65;
        st.pvy *= 0.65;
      }

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, AH_W, AH_H);
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(10, 10, AH_W - 20, AH_H - 20);

      // Micro air-jet dots
      ctx.fillStyle = 'rgba(14, 165, 233, 0.16)';
      for (let ax = 30; ax < AH_W - 20; ax += 26) {
        for (let ay = 26; ay < AH_H - 16; ay += 26) {
          ctx.fillRect(ax, ay, 2, 2);
        }
      }

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(AH_W / 2, 10);
      ctx.lineTo(AH_W / 2, AH_H - 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(AH_W / 2, AH_H / 2, 42, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, GOAL_TOP, 12, GOAL_BOT - GOAL_TOP);
      ctx.fillRect(AH_W - 12, GOAL_TOP, 12, GOAL_BOT - GOAL_TOP);

      // Puck trail
      for (let ti = 0; ti < st.trail.length; ti++) {
        const pt = st.trail[ti];
        const a = (ti / st.trail.length) * 0.35;
        ctx.fillStyle = `rgba(249, 115, 22, ${a})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 9 * (0.5 + (ti / st.trail.length) * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(st.px, st.py, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(st.px, st.py, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(st.cx, st.cy, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fca5a5';
      ctx.beginPath();
      ctx.arc(st.cx, st.cy, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(st.bx, st.by, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7c2d12';
      ctx.lineWidth = 2;
      ctx.stroke();

      for (const sp of st.sparks) {
        ctx.globalAlpha = Math.max(0, sp.life * 2.5);
        ctx.fillStyle = sp.color;
        ctx.fillRect(sp.x - 1.5, sp.y - 1.5, sp.size, sp.size);
      }
      ctx.globalAlpha = 1;

      if (st.goalFlash > 0) {
        ctx.fillStyle = st.goalFlashColor;
        ctx.globalAlpha = st.goalFlash * 0.28;
        ctx.fillRect(0, 0, AH_W, AH_H);
        ctx.globalAlpha = 1;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [onAwardCash]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * AH_W;
    const my = ((e.clientY - rect.top) / rect.height) * AH_H;
    const nx = Math.max(26, Math.min(AH_W / 2 - 22, mx));
    const ny = Math.max(26, Math.min(AH_H - 26, my));
    ref.current.pvx = (nx - ref.current.px) * 18;
    ref.current.pvy = (ny - ref.current.py) * 18;
    ref.current.px = nx;
    ref.current.py = ny;
  };

  return (
    <div className="bg-zinc-950 border-2 border-sky-400 rounded-2xl p-4 w-full max-w-xl shadow-[0_0_50px_rgba(56,189,248,0.45)] font-mono flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div>
          <span className="text-[10px] font-black uppercase text-sky-400 tracking-widest">
            🏒 NEON PRO AIR HOCKEY · {venueName}
          </span>
          <h3 className="text-base font-black text-white">FIRST TO 5 GOALS WINS CHAMPIONSHIP!</h3>
        </div>
        <div className="flex items-center gap-2 text-xs font-black">
          <span className="px-2.5 py-1 rounded-lg bg-sky-950 border border-sky-400/40 text-sky-300">
            YOU: {pScore}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-rose-950 border border-rose-400/40 text-rose-300">
            CPU: {cpuScore}
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={AH_W}
        height={AH_H}
        onMouseMove={handleMouseMove}
        className="w-full h-auto rounded-xl border-2 border-sky-500/40 cursor-none select-none"
      />

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-emerald-300 font-bold truncate">
          {doneMsg || 'MOVE MOUSE TO STRIKE PUCK INTO RIGHT GOAL!'}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {doneMsg && (
            <button
              type="button"
              onClick={resetMatch}
              className="px-3 py-1.5 rounded-lg bg-sky-400 hover:bg-sky-300 text-black font-black uppercase cursor-pointer"
            >
              Rematch
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-black uppercase cursor-pointer"
          >
            Step Off
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. SUPER PRIZE CLAW MACHINE (9 Prizes + Animated Jaws + Precision Guide)
// ============================================================================
interface ClawPrize {
  id: number;
  x: number;
  y: number;
  label: string;
  color: string;
  value: number;
  grabbed: boolean;
}

const CLAW_W = 460;
const CLAW_H = 295;

const ClawMachineMiniGame: React.FC<{
  venueName: string;
  onAwardCash: (delta: number, label: string) => void;
  onClose: () => void;
}> = ({ venueName, onAwardCash, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [grabsLeft, setGrabsLeft] = useState(3);
  const [totalWon, setTotalWon] = useState(0);
  const [statusMsg, setStatusMsg] = useState('EXPERT CLAW! NO LASER — MASTER TROLLEY COAST, SWAY & MICRO HITBOX!');

  const makePrizes = (): ClawPrize[] => {
    const jx = () => Math.round((Math.random() - 0.5) * 14);
    const jy = () => Math.round((Math.random() - 0.5) * 6);
    return [
      { id: 1, x: 102 + jx(), y: 244 + jy(), label: '🧸', color: '#f472b6', value: 250, grabbed: false },
      { id: 2, x: 156 + jx(), y: 248 + jy(), label: '🏎️', color: '#ef4444', value: 450, grabbed: false },
      { id: 3, x: 210 + jx(), y: 240 + jy(), label: '🏆', color: '#facc15', value: 750, grabbed: false },
      { id: 4, x: 266 + jx(), y: 247 + jy(), label: '🎮', color: '#38bdf8', value: 500, grabbed: false },
      { id: 5, x: 320 + jx(), y: 241 + jy(), label: '🍕', color: '#fb923c', value: 300, grabbed: false },
      { id: 6, x: 374 + jx(), y: 245 + jy(), label: '🚀', color: '#22d3ee', value: 650, grabbed: false },
      { id: 7, x: 130 + jx(), y: 217 + jy(), label: '🤖', color: '#a855f7', value: 550, grabbed: false },
      { id: 8, x: 238 + jx(), y: 215 + jy(), label: '👑', color: '#fde047', value: 900, grabbed: false },
      { id: 9, x: 348 + jx(), y: 218 + jy(), label: '🌟', color: '#34d399', value: 700, grabbed: false },
    ];
  };

  const stRef = useRef({
    clawX: 234,
    clawVx: 0,
    clawY: 44,
    swayAngle: 0,
    swayVel: 0,
    grabOffsetErr: 0,
    slipThresholdY: -1,
    slipThresholdX: -1,
    phase: 'idle' as 'idle' | 'down' | 'up' | 'return',
    dir: 0,
    carried: null as ClawPrize | null,
    prizes: makePrizes(),
    grabsLeft: 3,
    totalWon: 0,
    jawOpen: 1,
    sparks: [] as ParticleSpark[],
  });

  const dropClaw = () => {
    const st = stRef.current;
    if (st.phase !== 'idle' || st.grabsLeft <= 0) return;
    st.phase = 'down';
    st.grabsLeft--;
    setGrabsLeft(st.grabsLeft);
    playArcadeSfx(360, 180, 0.14, 'triangle', 0.06);
  };

  const resetPrizes = () => {
    stRef.current = {
      clawX: 234,
      clawVx: 0,
      clawY: 44,
      swayAngle: 0,
      swayVel: 0,
      grabOffsetErr: 0,
      slipThresholdY: -1,
      slipThresholdX: -1,
      phase: 'idle',
      dir: 0,
      carried: null,
      prizes: makePrizes(),
      grabsLeft: 3,
      totalWon: 0,
      jawOpen: 1,
      sparks: [],
    };
    setGrabsLeft(3);
    setTotalWon(0);
    setStatusMsg('BIN REFILLED! JUDGE MOMENTUM & SWAY — TINY GRAB WINDOW!');
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') stRef.current.dir = -1;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') stRef.current.dir = 1;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        dropClaw();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowRight' || e.code === 'KeyD') {
        stRef.current.dir = 0;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.03, Math.max(0.005, (now - last) / 1000));
      last = now;
      const st = stRef.current;

      for (let i = st.sparks.length - 1; i >= 0; i--) {
        st.sparks[i].x += st.sparks[i].vx * dt;
        st.sparks[i].y += st.sparks[i].vy * dt;
        st.sparks[i].life -= dt;
        if (st.sparks[i].life <= 0) st.sparks.splice(i, 1);
      }

      const ropeLen = Math.max(12, st.clawY - 32);

      if (st.phase === 'idle') {
        // Real gantry trolley momentum + slicker overshoot inertia
        const targetVx = st.dir * 255;
        const accel = st.dir !== 0 ? 840 : 250; // Slicker coast-to-stop requires early release
        const diffV = targetVx - st.clawVx;
        const prevVx = st.clawVx;
        st.clawVx += Math.sign(diffV) * Math.min(Math.abs(diffV), accel * dt);
        const ax = (st.clawVx - prevVx) / dt;
        st.clawX = Math.max(78, Math.min(CLAW_W - 44, st.clawX + st.clawVx * dt));
        if (st.clawX <= 78 || st.clawX >= CLAW_W - 44) st.clawVx = 0;

        // Stronger pendulum cable sway driven by trolley acceleration
        st.swayVel += (-ax * 0.0032 - st.swayAngle * 19.5 - st.swayVel * 1.4) * dt;
        st.swayAngle = Math.max(-0.44, Math.min(0.44, st.swayAngle + st.swayVel * dt));
        st.jawOpen = Math.min(1, st.jawOpen + dt * 4);
      } else {
        st.clawVx *= Math.max(0, 1 - dt * 8);
        st.swayVel += (-st.swayAngle * 15.0 - st.swayVel * 1.2) * dt;
        st.swayAngle = Math.max(-0.44, Math.min(0.44, st.swayAngle + st.swayVel * dt));
      }

      const headX = st.clawX + Math.sin(st.swayAngle) * ropeLen * 0.56;

      if (st.phase === 'down') {
        st.clawY += 245 * dt;
        let hit: ClawPrize | null = null;
        for (const p of st.prizes) {
          if (p.grabbed) continue;
          // Razor-thin precision prong alignment window (dead-center only!)
          if (Math.abs(p.x - headX) < 7.2 && Math.abs(p.y - (st.clawY + 18)) < 11.5) {
            hit = p;
            break;
          }
        }
        if (hit || st.clawY >= 242) {
          if (hit) {
            const centerErr = Math.abs(hit.x - headX);
            const weightPenalty = Math.min(0.32, Math.max(0, (hit.value - 250) / 1600));
            const slipChance = Math.min(0.92, 0.34 + (centerErr / 7.2) * 0.42 + weightPenalty);
            hit.grabbed = true;
            st.carried = hit;
            st.grabOffsetErr = hit.x - headX;
            st.jawOpen = 0.24;
            if (Math.random() < slipChance) {
              // Slips loose either halfway up or mid-return over the prize pit!
              if (Math.random() < 0.58) {
                st.slipThresholdY = 74 + Math.random() * 98;
                st.slipThresholdX = -1;
              } else {
                st.slipThresholdY = -1;
                st.slipThresholdX = 96 + Math.random() * Math.max(30, headX - 115);
              }
            } else {
              st.slipThresholdY = -1;
              st.slipThresholdX = -1;
            }
            playArcadeSfx(520, 740, 0.1, 'triangle', 0.06);
          } else {
            st.jawOpen = 0.08;
            playArcadeSfx(190, 110, 0.08, 'sawtooth', 0.05);
          }
          st.phase = 'up';
        }
      } else if (st.phase === 'up') {
        st.clawY -= 160 * dt;
        if (st.carried) {
          const jitter = Math.sin(now * 0.032) * (1.8 + Math.abs(st.grabOffsetErr) * 0.25);
          st.carried.x = headX + st.grabOffsetErr * 0.5 + jitter;
          st.carried.y = st.clawY + 25;
          if (st.slipThresholdY > 0 && st.clawY <= st.slipThresholdY) {
            // Slips back into the bin!
            const dropped = st.carried;
            dropped.grabbed = false;
            dropped.y = 240 + Math.random() * 8;
            dropped.x = Math.max(96, Math.min(CLAW_W - 52, headX));
            st.carried = null;
            st.slipThresholdY = -1;
            st.jawOpen = 0.9;
            playArcadeSfx(320, 120, 0.18, 'sawtooth', 0.08);
            setStatusMsg(`😬 WEAK CLAW GRIP! ${dropped.label} SLIPPED BACK INTO THE BIN!`);
          }
        }
        if (st.clawY <= 44) {
          st.clawY = 44;
          st.phase = st.carried ? 'return' : 'idle';
          if (!st.carried) {
            setStatusMsg(st.grabsLeft > 0 ? 'EMPTY CLAW! ACCOUNT FOR TROLLEY COAST & SWAY!' : 'ALL 3 TRIES USED! REFILL BIN!');
          }
        }
      } else if (st.phase === 'return') {
        st.clawX -= 185 * dt;
        const returnHeadX = st.clawX + Math.sin(st.swayAngle) * 12;
        if (st.carried) {
          const wobble = Math.sin(now * 0.036) * 2.4;
          st.carried.x = returnHeadX + wobble;
          st.carried.y = st.clawY + 25;
          if (st.slipThresholdX > 0 && st.clawX <= st.slipThresholdX) {
            const dropped = st.carried;
            dropped.grabbed = false;
            dropped.x = Math.max(98, Math.min(CLAW_W - 54, returnHeadX));
            dropped.y = 242 + Math.random() * 6;
            st.carried = null;
            st.slipThresholdX = -1;
            st.jawOpen = 0.95;
            playArcadeSfx(290, 110, 0.2, 'sawtooth', 0.09);
            setStatusMsg(`💔 SO CLOSE! ${dropped.label} DROPPED JUST BEFORE THE CHUTE!`);
          }
        }
        if (st.clawX <= 54) {
          st.clawX = 54;
          st.jawOpen = 1;
          if (st.carried) {
            const won = st.carried;
            st.totalWon += won.value;
            setTotalWon(st.totalWon);
            onAwardCash(won.value, `🧸 CLAW PRIZE (${won.label})`);
            playArcadeSfx(587, 1174, 0.22, 'triangle', 0.09);
            for (let k = 0; k < 14; k++) {
              const a = (Math.PI * 2 * k) / 14;
              st.sparks.push({ x: 54, y: 185, vx: Math.cos(a) * 100, vy: Math.sin(a) * 100, color: won.color, life: 0.55, size: 3 });
            }
            setStatusMsg(`🎉 CLEAN SNAG! ${won.label} CLEARED THE CHUTE (+$${won.value})!`);
            st.carried = null;
          }
          st.phase = 'idle';
        }
      }

      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, CLAW_W, CLAW_H);
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(16, 12, CLAW_W - 32, CLAW_H - 24);
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 3;
      ctx.strokeRect(16, 12, CLAW_W - 32, CLAW_H - 24);

      // Drop chute
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(24, 178, 56, 98);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.strokeRect(24, 178, 56, 98);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CHUTE', 52, 228);

      for (const p of st.prizes) {
        if (p.grabbed && st.carried?.id !== p.id) continue;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '17px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.label, p.x, p.y + 1);
      }

      // Rail, Gantry Carriage & Swaying Articulated Pincers
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(22, 32);
      ctx.lineTo(CLAW_W - 22, 32);
      ctx.stroke();

      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(st.clawX - 10, 26, 20, 9);

      const drawHeadX = st.clawX + Math.sin(st.swayAngle) * ropeLen * 0.56;
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(st.clawX, 34);
      ctx.lineTo(drawHeadX, st.clawY);
      ctx.stroke();

      const spread = 7 + st.jawOpen * 9;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(drawHeadX - spread * 0.7, st.clawY + 20);
      ctx.lineTo(drawHeadX - spread, st.clawY + 8);
      ctx.lineTo(drawHeadX - 5, st.clawY);
      ctx.lineTo(drawHeadX + 5, st.clawY);
      ctx.lineTo(drawHeadX + spread, st.clawY + 8);
      ctx.lineTo(drawHeadX + spread * 0.7, st.clawY + 20);
      ctx.stroke();

      for (const sp of st.sparks) {
        ctx.globalAlpha = Math.max(0, sp.life * 2);
        ctx.fillStyle = sp.color;
        ctx.fillRect(sp.x, sp.y, sp.size, sp.size);
      }
      ctx.globalAlpha = 1;

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [onAwardCash]);

  return (
    <div className="bg-zinc-950 border-2 border-rose-400 rounded-2xl p-4 w-full max-w-xl shadow-[0_0_50px_rgba(244,63,94,0.45)] font-mono flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div>
          <span className="text-[10px] font-black uppercase text-rose-400 tracking-widest">
            🧸 PRO SKILL CLAW · {venueName}
          </span>
          <h3 className="text-base font-black text-white">DEAD-CENTER DROP ONLY · NO LASER!</h3>
        </div>
        <div className="flex items-center gap-2 text-xs font-black">
          <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-amber-300">
            TRIES: {grabsLeft}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-emerald-300">
            WON: ${totalWon}
          </span>
        </div>
      </div>

      <canvas ref={canvasRef} width={CLAW_W} height={CLAW_H} className="w-full h-auto rounded-xl border border-rose-400/40 select-none" />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onMouseDown={() => (stRef.current.dir = -1)}
            onMouseUp={() => (stRef.current.dir = 0)}
            onMouseLeave={() => (stRef.current.dir = 0)}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-black cursor-pointer"
          >
            ◀ LEFT
          </button>
          <button
            type="button"
            onMouseDown={() => (stRef.current.dir = 1)}
            onMouseUp={() => (stRef.current.dir = 0)}
            onMouseLeave={() => (stRef.current.dir = 0)}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-black cursor-pointer"
          >
            RIGHT ▶
          </button>
          <button
            type="button"
            disabled={grabsLeft <= 0}
            onClick={dropClaw}
            className="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-black uppercase cursor-pointer"
          >
            DROP CLAW
          </button>
        </div>
        <div className="flex items-center gap-2">
          {grabsLeft <= 0 && (
            <button
              type="button"
              onClick={resetPrizes}
              className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-black uppercase cursor-pointer"
            >
              Refill Bin
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-black uppercase cursor-pointer"
          >
            Step Off
          </button>
        </div>
      </div>
      <p className="text-[11px] font-bold text-amber-300">{statusMsg}</p>
    </div>
  );
};

// ============================================================================
// 6. WHACK-A-BOT FRENZY (Independent Slot Lifecycles + Hit Flash + Keys 1-9)
// ============================================================================
type WhackHoleKind = 'empty' | 'bot' | 'gold' | 'ninja' | 'bomb';

interface WhackSlotState {
  kind: WhackHoleKind;
  bornAt: number;
  ttlMs: number;
  lastActiveKind?: WhackHoleKind;
  expiredAt?: number;
  feedbackText?: string;
  feedbackColor?: string;
  feedbackUntil?: number;
}

const WhackABotMiniGame: React.FC<{
  venueName: string;
  onAwardCash: (delta: number, label: string) => void;
  onClose: () => void;
}> = ({ venueName, onAwardCash, onClose }) => {
  const onAwardRef = useRef(onAwardCash);
  onAwardRef.current = onAwardCash;

  const makeEmptySlots = (): WhackSlotState[] =>
    Array.from({ length: 9 }, () => ({ kind: 'empty', bornAt: 0, ttlMs: 0 }));

  const [slotsView, setSlotsView] = useState<WhackSlotState[]>(() => makeEmptySlots());
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(24);
  const [done, setDone] = useState(false);

  const simRef = useRef({
    slots: makeEmptySlots(),
    score: 0,
    streak: 0,
    remainingMs: 24000,
    nextSpawnAt: 0,
    awarded: false,
    done: false,
  });

  const reset = () => {
    const empty = makeEmptySlots();
    simRef.current = {
      slots: empty,
      score: 0,
      streak: 0,
      remainingMs: 24000,
      nextSpawnAt: performance.now() + 100,
      awarded: false,
      done: false,
    };
    setSlotsView(empty);
    setScore(0);
    setStreak(0);
    setTimeLeft(24);
    setDone(false);
  };

  const whack = (idx: number) => {
    const sim = simRef.current;
    if (sim.done || idx < 0 || idx > 8) return;
    const now = performance.now();
    const slot = sim.slots[idx];

    // Allow a 160ms forgiving reaction grace window if a bot just ducked down
    let hitKind: WhackHoleKind = slot.kind;
    if (
      hitKind === 'empty' &&
      slot.lastActiveKind &&
      slot.lastActiveKind !== 'bomb' &&
      slot.expiredAt &&
      now - slot.expiredAt <= 160
    ) {
      hitKind = slot.lastActiveKind;
    }

    if (hitKind === 'empty') {
      sim.streak = 0;
      setStreak(0);
      sim.slots[idx] = {
        kind: 'empty',
        bornAt: 0,
        ttlMs: 0,
        feedbackText: 'MISS',
        feedbackColor: 'text-zinc-400',
        feedbackUntil: now + 240,
      };
      setSlotsView([...sim.slots]);
      playArcadeSfx(140, 110, 0.05, 'sine', 0.03);
      return;
    }

    if (hitKind === 'bomb') {
      sim.streak = 0;
      sim.score = Math.max(0, sim.score - 20);
      sim.slots[idx] = {
        kind: 'empty',
        bornAt: 0,
        ttlMs: 0,
        feedbackText: '💥 -20',
        feedbackColor: 'text-red-400',
        feedbackUntil: now + 340,
      };
      playArcadeSfx(180, 75, 0.18, 'sawtooth', 0.08);
    } else {
      sim.streak += 1;
      const mult = sim.streak >= 8 ? 3 : sim.streak >= 4 ? 2 : 1;
      const base = hitKind === 'gold' ? 35 : hitKind === 'ninja' ? 25 : 15;
      const pts = base * mult;
      sim.score += pts;
      sim.slots[idx] = {
        kind: 'empty',
        bornAt: 0,
        ttlMs: 0,
        feedbackText: `💥 +${pts}`,
        feedbackColor: hitKind === 'gold' ? 'text-amber-300' : 'text-emerald-300',
        feedbackUntil: now + 320,
      };
      playArcadeSfx(480 + mult * 140, 720 + mult * 140, 0.08, 'triangle', 0.06);
    }
    setStreak(sim.streak);
    setScore(sim.score);
    setSlotsView([...sim.slots]);
  };

  const whackRef = useRef(whack);
  whackRef.current = whack;

  useEffect(() => {
    if (done) return;
    const sim = simRef.current;
    // Immediately spawn 3 initial targets so board is immediately playable on open
    const startNow = performance.now();
    const usedInit = new Set<number>();
    while (usedInit.size < 3) {
      const pick = Math.floor(Math.random() * 9);
      if (usedInit.has(pick)) continue;
      usedInit.add(pick);
      sim.slots[pick] = {
        kind: usedInit.size === 1 ? 'bot' : usedInit.size === 2 ? 'gold' : 'bot',
        bornAt: startNow,
        ttlMs: 1800,
      };
    }
    sim.nextSpawnAt = startNow + 360;
    setSlotsView([...sim.slots]);

    let lastTs = performance.now();
    let lastSecsShown = Math.ceil(sim.remainingMs / 1000);

    const timer = window.setInterval(() => {
      const now = performance.now();
      const dtMs = Math.min(120, Math.max(10, now - lastTs));
      lastTs = now;
      if (sim.done) return;

      sim.remainingMs = Math.max(0, sim.remainingMs - dtMs);
      const nextSecs = Math.ceil(sim.remainingMs / 1000);
      if (nextSecs !== lastSecsShown) {
        lastSecsShown = nextSecs;
        setTimeLeft(nextSecs);
      }

      let changed = false;
      for (let i = 0; i < 9; i++) {
        const s = sim.slots[i];
        if (s.kind !== 'empty' && now - s.bornAt >= s.ttlMs) {
          sim.slots[i] = {
            kind: 'empty',
            bornAt: 0,
            ttlMs: 0,
            lastActiveKind: s.kind,
            expiredAt: now,
          };
          changed = true;
        } else if (s.feedbackUntil && now >= s.feedbackUntil) {
          sim.slots[i] = { ...s, feedbackText: undefined, feedbackUntil: undefined };
          changed = true;
        }
      }

      const activeCount = sim.slots.filter((s) => s.kind !== 'empty').length;
      const isFrenzy = sim.remainingMs < 10000;
      const maxActive = isFrenzy ? 5 : 4;

      if (now >= sim.nextSpawnAt && activeCount < maxActive) {
        const emptyIndices: number[] = [];
        for (let i = 0; i < 9; i++) {
          if (sim.slots[i].kind === 'empty') emptyIndices.push(i);
        }
        if (emptyIndices.length > 0) {
          const idx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
          const r = Math.random();
          const kind: WhackHoleKind =
            r < 0.17 ? 'gold' : r < 0.36 ? 'ninja' : r < 0.48 ? 'bomb' : 'bot';
          const baseTtl =
            kind === 'ninja'
              ? isFrenzy
                ? 1150
                : 1350
              : kind === 'gold'
              ? 1550
              : isFrenzy
              ? 1350
              : 1750;
          sim.slots[idx] = {
            kind,
            bornAt: now,
            ttlMs: baseTtl + Math.random() * 250,
          };
          changed = true;
        }
        sim.nextSpawnAt = now + (isFrenzy ? 260 + Math.random() * 120 : 340 + Math.random() * 160);
      }

      if (changed) {
        setSlotsView([...sim.slots]);
      }

      if (sim.remainingMs <= 0 && !sim.done) {
        sim.done = true;
        setDone(true);
        setTimeLeft(0);
        if (!sim.awarded) {
          sim.awarded = true;
          const prize = Math.min(1250, Math.max(0, sim.score * 4));
          if (prize > 0) {
            onAwardRef.current(prize, '🔨 WHACK-A-BOT TICKET PRIZE');
            playArcadeSfx(523, 1046, 0.25, 'triangle', 0.08);
          }
        }
      }
    }, 50);

    return () => window.clearInterval(timer);
  }, [done]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      let slotIdx = -1;
      if (e.key >= '1' && e.key <= '9') {
        slotIdx = Number(e.key) - 1;
      } else if (/^Digit[1-9]$/.test(e.code)) {
        slotIdx = Number(e.code.slice(5)) - 1;
      } else if (/^Numpad[1-9]$/.test(e.code)) {
        slotIdx = Number(e.code.slice(6)) - 1;
      }
      if (slotIdx >= 0 && slotIdx <= 8) {
        e.preventDefault();
        e.stopPropagation();
        whackRef.current(slotIdx);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const multBadge = streak >= 8 ? 'x3' : streak >= 4 ? 'x2' : 'x1';

  return (
    <div className="bg-zinc-950 border-2 border-amber-400 rounded-2xl p-4 w-full max-w-md shadow-[0_0_50px_rgba(250,204,21,0.45)] font-mono flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div>
          <span className="text-[10px] font-black uppercase text-amber-400 tracking-widest">
            🔨 WHACK-A-BOT FRENZY · {venueName}
          </span>
          <h3 className="text-base font-black text-white">BOP BOTS · DODGE RED BOMBS!</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-black">
          <span className="px-2 py-1 rounded bg-fuchsia-950 border border-fuchsia-400/50 text-fuchsia-300">
            {multBadge}
          </span>
          <span className="px-2 py-1 rounded bg-zinc-900 border border-white/10 text-amber-300 tabular-nums">{timeLeft}S</span>
          <span className="px-2 py-1 rounded bg-zinc-900 border border-white/10 text-emerald-300 tabular-nums">PTS: {score}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 bg-indigo-950/60 p-4 rounded-xl border border-indigo-400/30 touch-none">
        {slotsView.map((s, i) => {
          const h = s.kind;
          return (
            <button
              key={i}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                whack(i);
              }}
              className={`h-20 rounded-xl border-2 flex flex-col items-center justify-center text-2xl font-black transition-transform active:scale-90 cursor-pointer relative select-none touch-none ${
                h === 'gold'
                  ? 'bg-amber-400/25 border-amber-300 text-amber-200'
                  : h === 'ninja'
                  ? 'bg-fuchsia-500/25 border-fuchsia-400 text-fuchsia-200'
                  : h === 'bomb'
                  ? 'bg-red-600/30 border-red-500 text-red-200'
                  : h === 'bot'
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                  : 'bg-zinc-900/90 border-zinc-700 text-zinc-700'
              }`}
            >
              <span className="absolute top-1 left-1.5 text-[9px] text-zinc-500">{i + 1}</span>
              {s.feedbackText && (
                <span className={`absolute top-1 right-1.5 text-[10px] font-black ${s.feedbackColor || 'text-white'}`}>
                  {s.feedbackText}
                </span>
              )}
              {h === 'gold' ? '👑' : h === 'ninja' ? '🥷' : h === 'bomb' ? '💣' : h === 'bot' ? '🤖' : '•'}
              <span className="text-[9px] uppercase mt-1">
                {h === 'gold' ? '+35 GOLD' : h === 'ninja' ? '+25 FAST' : h === 'bomb' ? 'AVOID -20' : h === 'bot' ? '+15 BOP' : 'EMPTY'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-emerald-300 font-bold">
          {done
            ? `🏆 FINAL SCORE: ${score} PTS · PRIZE +$${Math.min(1250, score * 4)}!`
            : 'CLICK OR KEYS 1–9 · BUILD STREAKS FOR x2 / x3!'}
        </span>
        <div className="flex items-center gap-2">
          {done && (
            <button
              type="button"
              onClick={reset}
              className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-black uppercase cursor-pointer"
            >
              Play Again
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-black uppercase cursor-pointer"
          >
            Step Off
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 7. POP-A-SHOT ARCADE BASKETBALL (Rim Physics + Moneyball 2X + Fire Streak)
// ============================================================================
const POP_W = 480;
const POP_H = 290;

const PopAShotMiniGame: React.FC<{
  venueName: string;
  onAwardCash: (delta: number, label: string) => void;
  onClose: () => void;
}> = ({ venueName, onAwardCash, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(26);
  const [done, setDone] = useState(false);

  const stRef = useRef({
    meter: 0.5,
    meterDir: 1,
    hoopX: POP_W / 2,
    hoopDir: 1,
    netSway: 0,
    ballActive: false,
    bx: POP_W / 2,
    by: 245,
    bvx: 0,
    bvy: 0,
    scoredThisShot: false,
    score: 0,
    streak: 0,
    timeLeft: 26,
    popups: [] as FloatingPopup[],
    done: false,
  });

  const shoot = () => {
    const st = stRef.current;
    if (st.ballActive || st.done) return;
    st.ballActive = true;
    st.scoredThisShot = false;
    st.bx = POP_W / 2;
    st.by = 245;
    const spreadX = (st.meter - 0.5) * 305;
    st.bvx = spreadX * 1.48;
    st.bvy = -485;
    playArcadeSfx(240, 420, 0.08, 'triangle', 0.05);
  };

  const reset = () => {
    stRef.current = {
      meter: 0.5,
      meterDir: 1,
      hoopX: POP_W / 2,
      hoopDir: 1,
      netSway: 0,
      ballActive: false,
      bx: POP_W / 2,
      by: 245,
      bvx: 0,
      bvy: 0,
      scoredThisShot: false,
      score: 0,
      streak: 0,
      timeLeft: 26,
      popups: [],
      done: false,
    };
    setScore(0);
    setStreak(0);
    setTimeLeft(26);
    setDone(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        shoot();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.03, Math.max(0.005, (now - last) / 1000));
      last = now;
      const st = stRef.current;
      const isMoneyTime = st.timeLeft <= 10;

      if (st.netSway > 0) st.netSway = Math.max(0, st.netSway - dt * 2.4);
      for (let i = st.popups.length - 1; i >= 0; i--) {
        st.popups[i].y -= 28 * dt;
        st.popups[i].life -= dt;
        if (st.popups[i].life <= 0) st.popups.splice(i, 1);
      }

      if (!st.done) {
        st.timeLeft = Math.max(0, st.timeLeft - dt);
        setTimeLeft(Math.ceil(st.timeLeft));
        if (st.timeLeft <= 0) {
          st.done = true;
          setDone(true);
          const prize = Math.min(1300, st.score * 38);
          if (prize > 0) {
            onAwardCash(prize, '🏀 POP-A-SHOT ARCADE PRIZE');
            playArcadeSfx(523, 1046, 0.25, 'square', 0.08);
          }
        }

        st.meter += st.meterDir * dt * 1.45;
        if (st.meter >= 1) {
          st.meter = 1;
          st.meterDir = -1;
        } else if (st.meter <= 0) {
          st.meter = 0;
          st.meterDir = 1;
        }

        const hoopSpd = isMoneyTime ? 105 : 64;
        st.hoopX += st.hoopDir * dt * hoopSpd;
        if (st.hoopX > POP_W - 95) {
          st.hoopX = POP_W - 95;
          st.hoopDir = -1;
        } else if (st.hoopX < 95) {
          st.hoopX = 95;
          st.hoopDir = 1;
        }

        if (st.ballActive) {
          const prevY = st.by;
          st.bx += st.bvx * dt;
          st.by += st.bvy * dt;
          st.bvy += 630 * dt;

          // Rim edge bounce if ball clips the rim iron
          const leftRimX = st.hoopX - 31;
          const rightRimX = st.hoopX + 31;
          for (const rx of [leftRimX, rightRimX]) {
            const dRim = Math.hypot(st.bx - rx, st.by - 108);
            if (dRim < 13 && !st.scoredThisShot) {
              const nx = (st.bx - rx) / Math.max(0.01, dRim);
              const ny = (st.by - 108) / Math.max(0.01, dRim);
              st.bvx = nx * 130 + st.bvx * 0.25;
              st.bvy = ny * 130 - 65;
              playArcadeSfx(320, 180, 0.05, 'triangle', 0.05);
            }
          }

          if (!st.scoredThisShot && st.bvy > 0 && prevY <= 108 && st.by >= 108) {
            if (Math.abs(st.bx - st.hoopX) < 28) {
              st.scoredThisShot = true;
              const isSwish = Math.abs(st.bx - st.hoopX) < 14;
              st.streak += 1;
              setStreak(st.streak);
              const fireBonus = st.streak >= 3 ? 2 : 0;
              const pts = ((isSwish ? 3 : 2) + fireBonus) * (isMoneyTime ? 2 : 1);
              st.score += pts;
              st.netSway = 1.0;
              setScore(st.score);
              st.popups.push({
                x: st.hoopX,
                y: 96,
                text: `${isSwish ? 'SWISH!' : 'BUCKET!'} +${pts}`,
                color: isMoneyTime ? '#facc15' : '#34d399',
                life: 0.9,
              });
              playArcadeSfx(587, 987, 0.14, 'triangle', 0.08);
            }
          }

          if (st.by > POP_H + 20) {
            if (!st.scoredThisShot) {
              st.streak = 0;
              setStreak(0);
            }
            st.ballActive = false;
            st.bx = POP_W / 2;
            st.by = 245;
          }
        }
      }

      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, POP_W, POP_H);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let x = 20; x < POP_W; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, POP_H);
        ctx.stroke();
      }

      if (isMoneyTime && !st.done) {
        ctx.fillStyle = 'rgba(250, 204, 21, 0.12)';
        ctx.fillRect(0, 0, POP_W, 24);
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ 2X MONEYBALL BONUS TIME! ⚡', POP_W / 2, 16);
      }

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(st.hoopX - 50, 42, 100, 64);
      ctx.strokeStyle = isMoneyTime ? '#facc15' : '#ef4444';
      ctx.lineWidth = 3;
      ctx.strokeRect(st.hoopX - 24, 66, 48, 32);

      // Swaying net
      const swayOff = Math.sin(now * 0.025) * st.netSway * 10;
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.6;
      for (let n = -24; n <= 24; n += 12) {
        ctx.beginPath();
        ctx.moveTo(st.hoopX + n, 108);
        ctx.lineTo(st.hoopX + n * 0.6 + swayOff, 140);
        ctx.stroke();
      }
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(st.hoopX - 31, 108);
      ctx.lineTo(st.hoopX + 31, 108);
      ctx.stroke();

      // Timing bar
      ctx.fillStyle = '#18181b';
      ctx.fillRect(76, 264, POP_W - 152, 12);
      const sweetW = 76;
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(POP_W / 2 - sweetW / 2, 264, sweetW, 12);
      const markerX = 76 + st.meter * (POP_W - 152);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(markerX - 4, 260, 8, 20);

      // Fire streak aura on basketball
      if (st.streak >= 3) {
        ctx.fillStyle = 'rgba(251, 146, 60, 0.35)';
        ctx.beginPath();
        ctx.arc(st.bx, st.by, 19, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = isMoneyTime ? '#facc15' : '#ea580c';
      ctx.beginPath();
      ctx.arc(st.bx, st.by, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#431407';
      ctx.lineWidth = 2;
      ctx.stroke();

      for (const pop of st.popups) {
        ctx.globalAlpha = Math.max(0, pop.life);
        ctx.fillStyle = pop.color;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pop.text, pop.x, pop.y);
      }
      ctx.globalAlpha = 1;

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [onAwardCash]);

  return (
    <div className="bg-zinc-950 border-2 border-orange-400 rounded-2xl p-4 w-full max-w-xl shadow-[0_0_50px_rgba(251,146,60,0.45)] font-mono flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div>
          <span className="text-[10px] font-black uppercase text-orange-400 tracking-widest">
            🏀 POP-A-SHOT ARCADE HOOPS · {venueName}
          </span>
          <h3 className="text-base font-black text-white">SINK SWISHES · LAST 10S IS 2X MONEYBALL!</h3>
        </div>
        <div className="flex items-center gap-2 text-xs font-black">
          {streak >= 3 && (
            <span className="px-2 py-1 rounded-lg bg-orange-500/25 border border-orange-400 text-orange-300">
              🔥 ON FIRE
            </span>
          )}
          <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-amber-300">
            TIME: {timeLeft}S
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-orange-300">
            PTS: {score}
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={POP_W}
        height={POP_H}
        onClick={shoot}
        className="w-full h-auto rounded-xl border border-orange-400/40 cursor-pointer select-none"
      />

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-emerald-300 font-bold truncate">
          {done
            ? `🏆 FINAL SCORE: ${score} PTS · PRIZE +$${Math.min(1300, score * 38)}!`
            : 'CLICK OR PRESS SPACE WHEN GOLD MARKER CROSSES GREEN!'}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {!done ? (
            <button
              type="button"
              onClick={shoot}
              className="px-4 py-1.5 rounded-lg bg-orange-400 hover:bg-orange-300 text-black font-black uppercase cursor-pointer"
            >
              Shoot Ball
            </button>
          ) : (
            <button
              type="button"
              onClick={reset}
              className="px-3 py-1.5 rounded-lg bg-orange-400 hover:bg-orange-300 text-black font-black uppercase cursor-pointer"
            >
              Play Again
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-black uppercase cursor-pointer"
          >
            Step Off
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 8. CYBER NEON PINBALL MACHINE (NEW!)
// ============================================================================
const PIN_W = 420;
const PIN_H = 380;

const PinballMiniGame: React.FC<{
  venueName: string;
  onAwardCash: (delta: number, label: string) => void;
  onClose: () => void;
}> = ({ venueName, onAwardCash, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [ballsLeft, setBallsLeft] = useState(3);
  const [mult, setMult] = useState(1);
  const [done, setDone] = useState(false);

  const stRef = useRef({
    bx: PIN_W - 28,
    by: PIN_H - 42,
    vx: 0,
    vy: 0,
    inPlunger: true,
    plungerPower: 0,
    charging: false,
    leftFlip: false,
    rightFlip: false,
    leftFlipAngle: 0.42,
    rightFlipAngle: -0.42,
    score: 0,
    mult: 1,
    ballsLeft: 3,
    done: false,
    bumpers: [
      { x: 145, y: 112, r: 21, pts: 60, color: '#22d3ee', flash: 0 },
      { x: 245, y: 112, r: 21, pts: 60, color: '#f472b6', flash: 0 },
      { x: 195, y: 170, r: 23, pts: 100, color: '#facc15', flash: 0 },
      { x: 115, y: 185, r: 16, pts: 50, color: '#a855f7', flash: 0 },
      { x: 275, y: 185, r: 16, pts: 50, color: '#34d399', flash: 0 },
    ],
    drops: [
      { x: 120, y: 58, w: 32, h: 10, hit: false },
      { x: 179, y: 58, w: 32, h: 10, hit: false },
      { x: 238, y: 58, w: 32, h: 10, hit: false },
    ],
    popups: [] as FloatingPopup[],
    sparks: [] as ParticleSpark[],
  });

  const launchPlunger = () => {
    const st = stRef.current;
    if (!st.inPlunger || st.done) return;
    st.inPlunger = false;
    st.vx = -22 - Math.random() * 18;
    st.vy = -590 - st.plungerPower * 160;
    st.plungerPower = 0;
    st.charging = false;
    playArcadeSfx(240, 680, 0.14, 'triangle', 0.08);
  };

  const reset = () => {
    stRef.current.bx = PIN_W - 28;
    stRef.current.by = PIN_H - 42;
    stRef.current.vx = 0;
    stRef.current.vy = 0;
    stRef.current.inPlunger = true;
    stRef.current.score = 0;
    stRef.current.mult = 1;
    stRef.current.ballsLeft = 3;
    stRef.current.done = false;
    stRef.current.drops.forEach((d) => (d.hit = false));
    setScore(0);
    setMult(1);
    setBallsLeft(3);
    setDone(false);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyZ') stRef.current.leftFlip = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Slash') stRef.current.rightFlip = true;
      if (e.code === 'Space') {
        e.preventDefault();
        if (stRef.current.inPlunger) stRef.current.charging = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyZ') stRef.current.leftFlip = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Slash') stRef.current.rightFlip = false;
      if (e.code === 'Space' && stRef.current.inPlunger && stRef.current.charging) {
        launchPlunger();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let last = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.025, Math.max(0.004, (now - last) / 1000));
      last = now;
      const st = stRef.current;

      for (let i = st.popups.length - 1; i >= 0; i--) {
        st.popups[i].y -= 26 * dt;
        st.popups[i].life -= dt;
        if (st.popups[i].life <= 0) st.popups.splice(i, 1);
      }
      for (let i = st.sparks.length - 1; i >= 0; i--) {
        st.sparks[i].x += st.sparks[i].vx * dt;
        st.sparks[i].y += st.sparks[i].vy * dt;
        st.sparks[i].life -= dt;
        if (st.sparks[i].life <= 0) st.sparks.splice(i, 1);
      }
      for (const b of st.bumpers) {
        if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 4);
      }

      // Smooth flipper swing angles
      const targetLeft = st.leftFlip ? -0.48 : 0.42;
      const targetRight = st.rightFlip ? 0.48 : -0.42;
      st.leftFlipAngle += (targetLeft - st.leftFlipAngle) * Math.min(1, dt * 28);
      st.rightFlipAngle += (targetRight - st.rightFlipAngle) * Math.min(1, dt * 28);

      if (st.inPlunger) {
        if (st.charging) {
          st.plungerPower = Math.min(1, st.plungerPower + dt * 1.4);
        }
      } else if (!st.done) {
        const sub = 3;
        const sdt = dt / sub;
        for (let k = 0; k < sub; k++) {
          st.vy += 410 * sdt; // gravity
          st.bx += st.vx * sdt;
          st.by += st.vy * sdt;

          // Plunger lane divider wall (keeps ball in main playfield once launched)
          const dividerX = PIN_W - 46;
          if (st.bx < dividerX && st.by > 88 && st.bx > dividerX - 9) {
            st.bx = dividerX - 9;
            st.vx = -Math.abs(st.vx) * 0.8;
          }

          // Top arch curve & Outer rails
          if (st.bx < 22) {
            st.bx = 22;
            st.vx = Math.abs(st.vx) * 0.85;
          } else if (st.bx > PIN_W - 22) {
            st.bx = PIN_W - 22;
            st.vx = -Math.abs(st.vx) * 0.85;
          }
          if (st.by < 22) {
            st.by = 22;
            st.vy = Math.abs(st.vy) * 0.85;
          }
          // Top-right corner deflector guides ball into playfield
          if (st.by < 82 && st.bx > PIN_W - 82) {
            const dx = st.bx - (PIN_W - 82);
            const dy = st.by - 82;
            if (dx > -dy) {
              st.vx -= 140 * sdt;
              st.vy += 45 * sdt;
            }
          }

          // Angled lower side gutters directing to flippers
          if (st.by > PIN_H - 96 && st.bx < 126) {
            const slopeY = PIN_H - 96 + (st.bx - 22) * 0.56;
            if (st.by > slopeY - 8) {
              st.by = slopeY - 8;
              st.vx = Math.max(st.vx, 120);
              st.vy = -Math.abs(st.vy) * 0.45;
            }
          }
          if (st.by > PIN_H - 96 && st.bx > 264 && st.bx < PIN_W - 46) {
            const slopeY = PIN_H - 96 + (PIN_W - 46 - st.bx) * 0.56;
            if (st.by > slopeY - 8) {
              st.by = slopeY - 8;
              st.vx = Math.min(st.vx, -120);
              st.vy = -Math.abs(st.vy) * 0.45;
            }
          }

          // Bumper collisions
          for (const b of st.bumpers) {
            const dx = st.bx - b.x;
            const dy = st.by - b.y;
            const dist = Math.hypot(dx, dy);
            const minD = b.r + 8;
            if (dist > 0.01 && dist < minD) {
              const nx = dx / dist;
              const ny = dy / dist;
              st.bx = b.x + nx * minD;
              st.by = b.y + ny * minD;
              const boostSpd = 340;
              st.vx = nx * boostSpd;
              st.vy = ny * boostSpd;
              b.flash = 1;
              const pts = b.pts * st.mult;
              st.score += pts;
              setScore(st.score);
              st.popups.push({ x: b.x, y: b.y - b.r, text: `+${pts}`, color: b.color, life: 0.7 });
              for (let sp = 0; sp < 6; sp++) {
                const a = Math.random() * Math.PI * 2;
                st.sparks.push({ x: b.x + nx * b.r, y: b.y + ny * b.r, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, color: b.color, life: 0.3, size: 3 });
              }
              playArcadeSfx(620 + Math.random() * 140, 880, 0.07, 'triangle', 0.05);
            }
          }

          // Top drop targets
          for (const d of st.drops) {
            if (!d.hit && st.bx > d.x - 8 && st.bx < d.x + d.w + 8 && st.by > d.y - 8 && st.by < d.y + d.h + 8) {
              d.hit = true;
              st.vy = Math.abs(st.vy);
              st.score += 120 * st.mult;
              setScore(st.score);
              playArcadeSfx(740, 1080, 0.1, 'square', 0.06);
              if (st.drops.every((dr) => dr.hit)) {
                st.mult = Math.min(4, st.mult + 1);
                setMult(st.mult);
                st.score += 350;
                setScore(st.score);
                st.popups.push({ x: 195, y: 76, text: `DROP BONUS! ${st.mult}X`, color: '#fde047', life: 1.1 });
                st.drops.forEach((dr) => (dr.hit = false));
              }
            }
          }

          // Flipper segment collisions (Left pivot: 126, PIN_H-42; Right pivot: 264, PIN_H-42)
          const checkFlipper = (px: number, py: number, angle: number, len: number, active: boolean, isLeft: boolean) => {
            const ex = px + Math.cos(angle) * len * (isLeft ? 1 : -1);
            const ey = py + Math.sin(angle) * len * (isLeft ? 1 : -1);
            const sx = ex - px;
            const sy = ey - py;
            const t = Math.max(0, Math.min(1, ((st.bx - px) * sx + (st.by - py) * sy) / (sx * sx + sy * sy)));
            const cx = px + sx * t;
            const cy = py + sy * t;
            const dist = Math.hypot(st.bx - cx, st.by - cy);
            if (dist < 13 && st.vy > -120) {
              st.by = cy - 13;
              const kick = active ? 520 : 180;
              st.vy = -kick * (0.75 + t * 0.45);
              st.vx = (isLeft ? 1 : -1) * (160 - t * 90) + (Math.random() - 0.5) * 60;
              if (active) playArcadeSfx(420, 620, 0.07, 'triangle', 0.06);
            }
          };
          checkFlipper(124, PIN_H - 36, st.leftFlipAngle, 58, st.leftFlip, true);
          checkFlipper(266, PIN_H - 36, -st.rightFlipAngle, 58, st.rightFlip, false);

          // Drain check
          if (st.by > PIN_H + 14) {
            st.ballsLeft -= 1;
            setBallsLeft(st.ballsLeft);
            playArcadeSfx(240, 95, 0.25, 'sawtooth', 0.07);
            if (st.ballsLeft <= 0) {
              st.done = true;
              setDone(true);
              const prize = Math.min(1250, Math.round(st.score * 0.7));
              if (prize > 0) onAwardCash(prize, '⚡ CYBER PINBALL PRIZE');
            } else {
              st.inPlunger = true;
              st.bx = PIN_W - 28;
              st.by = PIN_H - 42;
              st.vx = 0;
              st.vy = 0;
              st.mult = 1;
              setMult(1);
            }
            break;
          }
        }
      }

      // Draw Table
      ctx.fillStyle = '#090b16';
      ctx.fillRect(0, 0, PIN_W, PIN_H);
      ctx.fillStyle = '#11162b';
      ctx.fillRect(14, 14, PIN_W - 28, PIN_H - 20);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.strokeRect(14, 14, PIN_W - 28, PIN_H - 20);

      // Plunger divider rail
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(PIN_W - 46, 88);
      ctx.lineTo(PIN_W - 46, PIN_H - 12);
      ctx.stroke();

      // Lower sloped guides
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(22, PIN_H - 96);
      ctx.lineTo(124, PIN_H - 36);
      ctx.moveTo(PIN_W - 48, PIN_H - 96);
      ctx.lineTo(266, PIN_H - 36);
      ctx.stroke();

      // Drop targets
      for (const d of st.drops) {
        ctx.fillStyle = d.hit ? '#334155' : '#fde047';
        ctx.fillRect(d.x, d.y, d.w, d.h);
      }

      // Pop Bumpers
      for (const b of st.bumpers) {
        ctx.fillStyle = b.flash > 0 ? '#ffffff' : b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + b.flash * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = b.color;
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(b.pts), b.x, b.y);
      }

      // Flippers
      const drawFlipper = (px: number, py: number, angle: number, len: number, isLeft: boolean) => {
        const ex = px + Math.cos(angle) * len * (isLeft ? 1 : -1);
        const ey = py + Math.sin(angle) * len * (isLeft ? 1 : -1);
        ctx.strokeStyle = '#facc15';
        ctx.lineCap = 'round';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.lineCap = 'butt';
      };
      drawFlipper(124, PIN_H - 36, st.leftFlipAngle, 58, true);
      drawFlipper(266, PIN_H - 36, -st.rightFlipAngle, 58, false);

      // Plunger spring
      const springTop = PIN_H - 28 + st.plungerPower * 16;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(PIN_W - 36, springTop, 16, PIN_H - springTop - 8);

      // Chrome Pinball
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(st.bx, st.by, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(st.bx - 2, st.by - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();

      for (const sp of st.sparks) {
        ctx.globalAlpha = Math.max(0, sp.life * 3);
        ctx.fillStyle = sp.color;
        ctx.fillRect(sp.x, sp.y, sp.size, sp.size);
      }
      ctx.globalAlpha = 1;
      for (const pop of st.popups) {
        ctx.globalAlpha = Math.max(0, pop.life * 1.4);
        ctx.fillStyle = pop.color;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pop.text, pop.x, pop.y);
      }
      ctx.globalAlpha = 1;

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [onAwardCash]);

  return (
    <div className="bg-zinc-950 border-2 border-cyan-400 rounded-2xl p-4 w-full max-w-md shadow-[0_0_50px_rgba(34,211,238,0.45)] font-mono flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div>
          <span className="text-[10px] font-black uppercase text-cyan-400 tracking-widest">
            ⚡ CYBER NEON PINBALL · {venueName}
          </span>
          <h3 className="text-base font-black text-white">HIT BUMPERS & TOP DROPS FOR {mult}X SCORE!</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-black">
          <span className="px-2 py-1 rounded bg-amber-950 border border-amber-400/50 text-amber-300">x{mult}</span>
          <span className="px-2 py-1 rounded bg-zinc-900 border border-white/10 text-rose-300">BALLS:{ballsLeft}</span>
          <span className="px-2 py-1 rounded bg-zinc-900 border border-white/10 text-cyan-300">{score}</span>
        </div>
      </div>

      <canvas ref={canvasRef} width={PIN_W} height={PIN_H} className="w-full h-auto rounded-xl border border-cyan-400/40 select-none" />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onMouseDown={() => (stRef.current.leftFlip = true)}
            onMouseUp={() => (stRef.current.leftFlip = false)}
            onMouseLeave={() => (stRef.current.leftFlip = false)}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-black cursor-pointer"
          >
            ◀ FLIP (A)
          </button>
          <button
            type="button"
            onMouseDown={() => {
              if (stRef.current.inPlunger) stRef.current.charging = true;
            }}
            onMouseUp={() => launchPlunger()}
            className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-black uppercase cursor-pointer"
          >
            LAUNCH (SPACE)
          </button>
          <button
            type="button"
            onMouseDown={() => (stRef.current.rightFlip = true)}
            onMouseUp={() => (stRef.current.rightFlip = false)}
            onMouseLeave={() => (stRef.current.rightFlip = false)}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-black cursor-pointer"
          >
            FLIP (D) ▶
          </button>
        </div>
        <div className="flex items-center gap-2">
          {done && (
            <button
              type="button"
              onClick={reset}
              className="px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-black uppercase cursor-pointer"
            >
              Play Again
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-black uppercase cursor-pointer"
          >
            Step Off
          </button>
        </div>
      </div>
      {done && (
        <p className="text-xs font-bold text-emerald-300">
          🏆 FINAL PINBALL SCORE: {score} PTS · WON +${Math.min(1250, Math.round(score * 0.7))}!
        </p>
      )}
    </div>
  );
};

// ============================================================================
// 9. NEON DANCE BEAT REVOLUTION (NEW!)
// ============================================================================
const DANCE_W = 420;
const DANCE_H = 340;
const DANCE_LANES = [
  { label: '←', keyLabel: 'A / ←', color: '#f472b6', x: 75, noteFreq: 329.63 },
  { label: '↓', keyLabel: 'S / ↓', color: '#38bdf8', x: 162, noteFreq: 392.0 },
  { label: '↑', keyLabel: 'W / ↑', color: '#34d399', x: 249, noteFreq: 440.0 },
  { label: '→', keyLabel: 'D / →', color: '#facc15', x: 336, noteFreq: 523.25 },
];

const DanceBeatMiniGame: React.FC<{
  venueName: string;
  onAwardCash: (delta: number, label: string) => void;
  onClose: () => void;
}> = ({ venueName, onAwardCash, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(25);
  const [done, setDone] = useState(false);

  const stRef = useRef({
    notes: [] as { id: number; lane: number; y: number }[],
    nextId: 1,
    spawnTimer: 0.3,
    laneFlash: [0, 0, 0, 0],
    popups: [] as FloatingPopup[],
    score: 0,
    combo: 0,
    timeLeft: 25,
    done: false,
  });

  const hitLane = (lane: number) => {
    const st = stRef.current;
    if (st.done) return;
    st.laneFlash[lane] = 0.25;
    const targetY = DANCE_H - 58;
    let bestIdx = -1;
    let bestDist = 42;
    for (let i = 0; i < st.notes.length; i++) {
      const n = st.notes[i];
      if (n.lane !== lane) continue;
      const d = Math.abs(n.y - targetY);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx !== -1) {
      const n = st.notes[bestIdx];
      st.notes.splice(bestIdx, 1);
      st.combo += 1;
      const mult = st.combo >= 12 ? 3 : st.combo >= 6 ? 2 : 1;
      const grade = bestDist <= 14 ? 'PERFECT!' : bestDist <= 26 ? 'GREAT!' : 'GOOD';
      const pts = (bestDist <= 14 ? 100 : bestDist <= 26 ? 65 : 35) * mult;
      st.score += pts;
      setScore(st.score);
      setCombo(st.combo);
      st.popups.push({ x: DANCE_LANES[lane].x, y: targetY - 22, text: `${grade} +${pts}`, color: DANCE_LANES[lane].color, life: 0.7 });
      playArcadeSfx(DANCE_LANES[lane].noteFreq, DANCE_LANES[lane].noteFreq * 1.25, 0.12, 'triangle', 0.08);
    } else {
      st.combo = 0;
      setCombo(0);
      st.popups.push({ x: DANCE_LANES[lane].x, y: targetY - 18, text: 'MISS', color: '#ef4444', life: 0.5 });
      playArcadeSfx(150, 110, 0.08, 'sawtooth', 0.04);
    }
  };

  const reset = () => {
    stRef.current = {
      notes: [],
      nextId: 1,
      spawnTimer: 0.3,
      laneFlash: [0, 0, 0, 0],
      popups: [],
      score: 0,
      combo: 0,
      timeLeft: 25,
      done: false,
    };
    setScore(0);
    setCombo(0);
    setTimeLeft(25);
    setDone(false);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        hitLane(0);
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        hitLane(1);
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        hitLane(2);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        hitLane(3);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.03, Math.max(0.005, (now - last) / 1000));
      last = now;
      const st = stRef.current;
      const targetY = DANCE_H - 58;

      if (!st.done) {
        st.timeLeft = Math.max(0, st.timeLeft - dt);
        setTimeLeft(Math.ceil(st.timeLeft));
        if (st.timeLeft <= 0) {
          st.done = true;
          setDone(true);
          const prize = Math.min(1300, Math.round(st.score * 0.35));
          if (prize > 0) {
            onAwardCash(prize, '🎵 DANCE BEAT STAGE PRIZE');
            playArcadeSfx(523, 1046, 0.25, 'triangle', 0.08);
          }
        }

        st.spawnTimer -= dt;
        if (st.spawnTimer <= 0) {
          st.spawnTimer = 0.42 + Math.random() * 0.14;
          const lane = Math.floor(Math.random() * 4);
          st.notes.push({ id: st.nextId++, lane, y: -16 });
        }

        for (let i = st.notes.length - 1; i >= 0; i--) {
          st.notes[i].y += 175 * dt;
          if (st.notes[i].y > DANCE_H + 18) {
            st.notes.splice(i, 1);
            st.combo = 0;
            setCombo(0);
          }
        }
      }

      for (let l = 0; l < 4; l++) {
        if (st.laneFlash[l] > 0) st.laneFlash[l] = Math.max(0, st.laneFlash[l] - dt);
      }
      for (let i = st.popups.length - 1; i >= 0; i--) {
        st.popups[i].y -= 28 * dt;
        st.popups[i].life -= dt;
        if (st.popups[i].life <= 0) st.popups.splice(i, 1);
      }

      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, DANCE_W, DANCE_H);

      // Fever glow border when combo >= 6
      if (st.combo >= 6) {
        ctx.strokeStyle = 'rgba(232, 121, 249, 0.55)';
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, DANCE_W - 6, DANCE_H - 6);
      }

      // Lanes & Hit Receptors
      for (let l = 0; l < 4; l++) {
        const info = DANCE_LANES[l];
        ctx.fillStyle = st.laneFlash[l] > 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)';
        ctx.fillRect(info.x - 32, 0, 64, DANCE_H);
        ctx.strokeStyle = info.color;
        ctx.lineWidth = st.laneFlash[l] > 0 ? 3.5 : 2;
        ctx.beginPath();
        ctx.arc(info.x, targetY, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = info.color;
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(info.label, info.x, targetY);
      }

      // Falling Notes
      for (const n of st.notes) {
        const info = DANCE_LANES[n.lane];
        ctx.fillStyle = info.color;
        ctx.beginPath();
        ctx.arc(info.x, n.y, 19, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#090d16';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(info.label, info.x, n.y);
      }

      for (const pop of st.popups) {
        ctx.globalAlpha = Math.max(0, pop.life * 1.6);
        ctx.fillStyle = pop.color;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pop.text, pop.x, pop.y);
      }
      ctx.globalAlpha = 1;

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [onAwardCash]);

  return (
    <div className="bg-zinc-950 border-2 border-fuchsia-400 rounded-2xl p-4 w-full max-w-md shadow-[0_0_50px_rgba(232,121,249,0.45)] font-mono flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div>
          <span className="text-[10px] font-black uppercase text-fuchsia-400 tracking-widest">
            🎵 NEON DANCE BEAT · {venueName}
          </span>
          <h3 className="text-base font-black text-white">HIT ARROWS ON THE BEAT!</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-black">
          <span className="px-2 py-1 rounded bg-fuchsia-950 border border-fuchsia-400/50 text-fuchsia-300">
            COMBO {combo}
          </span>
          <span className="px-2 py-1 rounded bg-zinc-900 border border-white/10 text-amber-300">{timeLeft}S</span>
          <span className="px-2 py-1 rounded bg-zinc-900 border border-white/10 text-cyan-300">{score}</span>
        </div>
      </div>

      <canvas ref={canvasRef} width={DANCE_W} height={DANCE_H} className="w-full h-auto rounded-xl border border-fuchsia-400/40 select-none" />

      <div className="grid grid-cols-4 gap-2">
        {DANCE_LANES.map((l, idx) => (
          <button
            key={l.label}
            type="button"
            onClick={() => hitLane(idx)}
            className="py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 font-black text-sm cursor-pointer active:scale-95"
            style={{ color: l.color }}
          >
            {l.keyLabel}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-emerald-300 font-bold truncate">
          {done
            ? `🏆 FINAL BEAT SCORE: ${score} PTS · PRIZE +$${Math.min(1300, Math.round(score * 0.35))}!`
            : 'USE ARROW KEYS / WASD OR TAP PADS!'}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {done && (
            <button
              type="button"
              onClick={reset}
              className="px-3 py-1.5 rounded-lg bg-fuchsia-400 hover:bg-fuchsia-300 text-black font-black uppercase cursor-pointer"
            >
              Play Again
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-black uppercase cursor-pointer"
          >
            Step Off
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 10. TURBO OUTRUN ARCADE RACING SIM (NEW!)
// ============================================================================
const RACE_W = 460;
const RACE_H = 310;

const RacingSimMiniGame: React.FC<{
  venueName: string;
  onAwardCash: (delta: number, label: string) => void;
  onClose: () => void;
}> = ({ venueName, onAwardCash, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [speedMph, setSpeedMph] = useState(145);
  const [timeLeft, setTimeLeft] = useState(24);
  const [done, setDone] = useState(false);

  const stRef = useRef({
    px: RACE_W / 2,
    dir: 0,
    boost: false,
    scrollOffset: 0,
    traffic: [] as { x: number; y: number; color: string; kind: 'car' | 'boost' | 'star'; hit?: boolean }[],
    spawnTimer: 0.25,
    score: 0,
    timeLeft: 24,
    flashRed: 0,
    popups: [] as FloatingPopup[],
    done: false,
  });

  const reset = () => {
    stRef.current = {
      px: RACE_W / 2,
      dir: 0,
      boost: false,
      scrollOffset: 0,
      traffic: [],
      spawnTimer: 0.25,
      score: 0,
      timeLeft: 24,
      flashRed: 0,
      popups: [],
      done: false,
    };
    setScore(0);
    setTimeLeft(24);
    setDone(false);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') stRef.current.dir = -1;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') stRef.current.dir = 1;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        stRef.current.boost = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowRight' || e.code === 'KeyD') {
        stRef.current.dir = 0;
      }
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        stRef.current.boost = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let last = performance.now();
    const laneXs = [142, 230, 318];

    const loop = (now: number) => {
      const dt = Math.min(0.03, Math.max(0.005, (now - last) / 1000));
      last = now;
      const st = stRef.current;

      if (st.flashRed > 0) st.flashRed = Math.max(0, st.flashRed - dt * 3);
      for (let i = st.popups.length - 1; i >= 0; i--) {
        st.popups[i].y -= 26 * dt;
        st.popups[i].life -= dt;
        if (st.popups[i].life <= 0) st.popups.splice(i, 1);
      }

      if (!st.done) {
        st.timeLeft = Math.max(0, st.timeLeft - dt);
        setTimeLeft(Math.ceil(st.timeLeft));
        const speedPx = st.boost ? 440 : 280;
        setSpeedMph(st.boost ? 218 : 145);
        st.scrollOffset = (st.scrollOffset + speedPx * dt) % 48;
        st.px = Math.max(115, Math.min(RACE_W - 115, st.px + st.dir * 260 * dt));

        st.score += Math.round((st.boost ? 32 : 16) * dt);
        setScore(st.score);

        st.spawnTimer -= dt;
        if (st.spawnTimer <= 0) {
          st.spawnTimer = st.boost ? 0.36 : 0.48;
          const laneX = laneXs[Math.floor(Math.random() * laneXs.length)];
          const roll = Math.random();
          const kind: 'car' | 'boost' | 'star' = roll < 0.22 ? 'boost' : roll < 0.42 ? 'star' : 'car';
          const colors = ['#ef4444', '#38bdf8', '#facc15', '#a855f7'];
          st.traffic.push({
            x: laneX,
            y: -26,
            color: colors[Math.floor(Math.random() * colors.length)],
            kind,
          });
        }

        const py = RACE_H - 48;
        for (let i = st.traffic.length - 1; i >= 0; i--) {
          const obj = st.traffic[i];
          obj.y += (obj.kind === 'car' ? speedPx * 0.72 : speedPx) * dt;
          if (!obj.hit && Math.abs(obj.x - st.px) < 26 && Math.abs(obj.y - py) < 34) {
            obj.hit = true;
            if (obj.kind === 'car') {
              st.flashRed = 1;
              st.score = Math.max(0, st.score - 60);
              setScore(st.score);
              st.popups.push({ x: st.px, y: py - 24, text: 'CRASH -60', color: '#ef4444', life: 0.7 });
              playArcadeSfx(160, 80, 0.16, 'sawtooth', 0.07);
            } else if (obj.kind === 'boost') {
              st.score += 120;
              setScore(st.score);
              st.popups.push({ x: st.px, y: py - 24, text: 'NITRO +120', color: '#22d3ee', life: 0.7 });
              playArcadeSfx(540, 960, 0.14, 'triangle', 0.07);
            } else {
              st.score += 150;
              setScore(st.score);
              st.popups.push({ x: st.px, y: py - 24, text: 'STAR +150', color: '#facc15', life: 0.7 });
              playArcadeSfx(660, 1180, 0.14, 'triangle', 0.08);
            }
            st.traffic.splice(i, 1);
            continue;
          }
          if (obj.y > RACE_H + 40) st.traffic.splice(i, 1);
        }

        if (st.timeLeft <= 0) {
          st.done = true;
          setDone(true);
          const prize = Math.min(1350, Math.max(150, Math.round(st.score * 0.55)));
          onAwardCash(prize, '🏎️ TURBO SIMULATOR PRIZE');
          playArcadeSfx(523, 1046, 0.25, 'triangle', 0.08);
        }
      }

      // Draw Highway
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(0, 0, RACE_W, RACE_H);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(92, 0, RACE_W - 184, RACE_H);
      ctx.fillStyle = '#ef4444';
      for (let ry = -48 + st.scrollOffset; ry < RACE_H; ry += 48) {
        ctx.fillRect(88, ry, 6, 24);
        ctx.fillRect(RACE_W - 94, ry, 6, 24);
      }
      ctx.fillStyle = '#f8fafc';
      for (let ry = -48 + st.scrollOffset; ry < RACE_H; ry += 48) {
        ctx.fillRect(184, ry, 4, 24);
        ctx.fillRect(272, ry, 4, 24);
      }

      for (const obj of st.traffic) {
        if (obj.kind === 'car') {
          ctx.fillStyle = obj.color;
          ctx.fillRect(obj.x - 13, obj.y - 20, 26, 40);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(obj.x - 10, obj.y - 10, 20, 14);
        } else if (obj.kind === 'boost') {
          ctx.fillStyle = '#22d3ee';
          ctx.fillRect(obj.x - 14, obj.y - 10, 28, 20);
          ctx.fillStyle = '#090d16';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('⚡', obj.x, obj.y + 4);
        } else {
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(obj.x, obj.y, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#090d16';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('★', obj.x, obj.y + 4);
        }
      }

      // Player F1 / GT Car
      const py = RACE_H - 48;
      if (st.boost) {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(st.px - 6, py + 20, 12, 16);
      }
      ctx.fillStyle = '#e11d48';
      ctx.fillRect(st.px - 14, py - 22, 28, 44);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(st.px - 9, py - 8, 18, 12);
      ctx.fillStyle = '#090d16';
      ctx.fillRect(st.px - 16, py - 18, 4, 12);
      ctx.fillRect(st.px + 12, py - 18, 4, 12);
      ctx.fillRect(st.px - 16, py + 8, 4, 12);
      ctx.fillRect(st.px + 12, py + 8, 4, 12);

      if (st.flashRed > 0) {
        ctx.fillStyle = `rgba(239,68,68,${st.flashRed * 0.35})`;
        ctx.fillRect(0, 0, RACE_W, RACE_H);
      }
      for (const pop of st.popups) {
        ctx.globalAlpha = Math.max(0, pop.life * 1.4);
        ctx.fillStyle = pop.color;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pop.text, pop.x, pop.y);
      }
      ctx.globalAlpha = 1;

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [onAwardCash]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * RACE_W;
    stRef.current.px = Math.max(115, Math.min(RACE_W - 115, mx));
  };

  return (
    <div className="bg-zinc-950 border-2 border-rose-500 rounded-2xl p-4 w-full max-w-xl shadow-[0_0_50px_rgba(244,63,94,0.45)] font-mono flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div>
          <span className="text-[10px] font-black uppercase text-rose-400 tracking-widest">
            🏎️ TURBO OUTRUN SIMULATOR · {venueName}
          </span>
          <h3 className="text-base font-black text-white">WEAVE TRAFFIC · GRAB NITRO PADS & STARS</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-black">
          <span className="px-2 py-1 rounded bg-sky-950 border border-sky-400/50 text-sky-300">{speedMph} MPH</span>
          <span className="px-2 py-1 rounded bg-zinc-900 border border-white/10 text-amber-300">{timeLeft}S</span>
          <span className="px-2 py-1 rounded bg-zinc-900 border border-white/10 text-emerald-300">{score}</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={RACE_W}
        height={RACE_H}
        onMouseMove={handleMouseMove}
        className="w-full h-auto rounded-xl border border-rose-400/40 cursor-ew-resize select-none"
      />

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-emerald-300 font-bold truncate">
          {done
            ? `🏆 FINAL SIM SCORE: ${score} · PRIZE +$${Math.min(1350, Math.max(150, Math.round(score * 0.55)))}!`
            : 'MOUSE OR A/D TO STEER · HOLD SPACE FOR 218 MPH NITRO!'}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {done && (
            <button
              type="button"
              onClick={reset}
              className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-black uppercase cursor-pointer"
            >
              Play Again
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-black uppercase cursor-pointer"
          >
            Step Off
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 11. OLYMPIC TABLE TENNIS RALLY (NEW!)
// ============================================================================
const TT_W = 500;
const TT_H = 265;

const TableTennisMiniGame: React.FC<{
  venueName: string;
  onAwardCash: (delta: number, label: string) => void;
  onClose: () => void;
}> = ({ venueName, onAwardCash, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pPts, setPPts] = useState(0);
  const [cPts, setCPts] = useState(0);
  const [rally, setRally] = useState(0);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const stRef = useRef({
    py: TT_H / 2,
    cy: TT_H / 2,
    bx: TT_W / 2,
    by: TT_H / 2,
    bvx: 250,
    bvy: 110,
    pPts: 0,
    cPts: 0,
    rally: 0,
    smashReady: false,
    done: false,
  });

  const reset = () => {
    stRef.current = {
      py: TT_H / 2,
      cy: TT_H / 2,
      bx: TT_W / 2,
      by: TT_H / 2,
      bvx: 250,
      bvy: (Math.random() - 0.5) * 140,
      pPts: 0,
      cPts: 0,
      rally: 0,
      smashReady: false,
      done: false,
    };
    setPPts(0);
    setCPts(0);
    setRally(0);
    setDoneMsg(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.03, Math.max(0.004, (now - last) / 1000));
      last = now;
      const st = stRef.current;

      if (!st.done) {
        // CPU paddle tracks incoming ball
        const targetCy = st.bvx > 0 ? st.by : TT_H / 2;
        const dyC = targetCy - st.cy;
        st.cy += Math.sign(dyC) * Math.min(Math.abs(dyC), 215 * dt);
        st.cy = Math.max(38, Math.min(TT_H - 38, st.cy));

        st.bx += st.bvx * dt;
        st.by += st.bvy * dt;
        if (st.by < 22) {
          st.by = 22;
          st.bvy = Math.abs(st.bvy);
          playArcadeSfx(460, 320, 0.04, 'triangle', 0.04);
        } else if (st.by > TT_H - 22) {
          st.by = TT_H - 22;
          st.bvy = -Math.abs(st.bvy);
          playArcadeSfx(460, 320, 0.04, 'triangle', 0.04);
        }

        // Player Paddle (left x=36)
        if (st.bvx < 0 && st.bx <= 42 && st.bx >= 24 && Math.abs(st.by - st.py) <= 32) {
          const rel = (st.by - st.py) / 32;
          const spd = Math.min(540, Math.hypot(st.bvx, st.bvy) * 1.05 + (st.smashReady ? 120 : 12));
          const ang = rel * 0.85;
          st.bvx = Math.cos(ang) * spd;
          st.bvy = Math.sin(ang) * spd;
          st.bx = 43;
          st.rally += 1;
          st.smashReady = false;
          setRally(st.rally);
          playArcadeSfx(780, 520, 0.06, 'triangle', 0.07);
        }

        // CPU Paddle (right x=TT_W-36)
        if (st.bvx > 0 && st.bx >= TT_W - 42 && st.bx <= TT_W - 24 && Math.abs(st.by - st.cy) <= 32) {
          const rel = (st.by - st.cy) / 32;
          const spd = Math.min(500, Math.hypot(st.bvx, st.bvy) * 1.03 + 10);
          const ang = rel * 0.85;
          st.bvx = -Math.cos(ang) * spd;
          st.bvy = Math.sin(ang) * spd;
          st.bx = TT_W - 43;
          st.rally += 1;
          setRally(st.rally);
          playArcadeSfx(620, 420, 0.06, 'triangle', 0.06);
        }

        if (st.bx < 10) {
          st.cPts += 1;
          setCPts(st.cPts);
          st.rally = 0;
          setRally(0);
          st.bx = TT_W / 2;
          st.by = TT_H / 2;
          st.bvx = 250;
          st.bvy = (Math.random() - 0.5) * 140;
          playArcadeSfx(220, 130, 0.16, 'sawtooth', 0.06);
          if (st.cPts >= 7) {
            st.done = true;
            onAwardCash(260, '🏓 TABLE TENNIS PARTICIPATION');
            setDoneMsg(`CPU WINS 7-${st.pPts}! PARTICIPATION PRIZE +$260!`);
          }
        } else if (st.bx > TT_W - 10) {
          st.pPts += 1;
          setPPts(st.pPts);
          st.rally = 0;
          setRally(0);
          st.bx = TT_W / 2;
          st.by = TT_H / 2;
          st.bvx = -250;
          st.bvy = (Math.random() - 0.5) * 140;
          playArcadeSfx(523, 880, 0.16, 'triangle', 0.08);
          if (st.pPts >= 7) {
            st.done = true;
            const prize = 980 + (7 - st.cPts) * 60;
            onAwardCash(prize, '🏓 TABLE TENNIS CHAMPION');
            setDoneMsg(`🏆 YOU WIN ${st.pPts}-${st.cPts}! PRIZE +$${prize}!`);
          }
        }
      }

      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, TT_W, TT_H);
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(18, 16, TT_W - 36, TT_H - 32);
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 3;
      ctx.strokeRect(18, 16, TT_W - 36, TT_H - 32);
      ctx.beginPath();
      ctx.moveTo(18, TT_H / 2);
      ctx.lineTo(TT_W - 18, TT_H / 2);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Net
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 4;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(TT_W / 2, 12);
      ctx.lineTo(TT_W / 2, TT_H - 12);
      ctx.stroke();
      ctx.setLineDash([]);

      // Player paddle (Red) & CPU paddle (Amber)
      ctx.fillStyle = st.smashReady ? '#facc15' : '#ef4444';
      ctx.fillRect(30, st.py - 28, 10, 56);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(TT_W - 40, st.cy - 28, 10, 56);

      // Ping-pong ball
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(st.bx, st.by, 7, 0, Math.PI * 2);
      ctx.fill();

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [onAwardCash]);

  return (
    <div className="bg-zinc-950 border-2 border-blue-400 rounded-2xl p-4 w-full max-w-xl shadow-[0_0_50px_rgba(59,130,246,0.45)] font-mono flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div>
          <span className="text-[10px] font-black uppercase text-blue-400 tracking-widest">
            🏓 OLYMPIC TABLE TENNIS · {venueName}
          </span>
          <h3 className="text-base font-black text-white">FIRST TO 7 POINTS · CLICK FOR SMASH RETURN!</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-black">
          <span className="px-2 py-1 rounded bg-zinc-900 border border-white/10 text-amber-300">RALLY {rally}</span>
          <span className="px-2 py-1 rounded bg-blue-950 border border-blue-400/50 text-blue-200">YOU {pPts}</span>
          <span className="px-2 py-1 rounded bg-rose-950 border border-rose-400/50 text-rose-200">BOT {cPts}</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={TT_W}
        height={TT_H}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const my = ((e.clientY - rect.top) / rect.height) * TT_H;
          stRef.current.py = Math.max(38, Math.min(TT_H - 38, my));
        }}
        onClick={() => (stRef.current.smashReady = true)}
        className="w-full h-auto rounded-xl border border-blue-400/40 cursor-ns-resize select-none"
      />

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-emerald-300 font-bold truncate">
          {doneMsg || 'MOVE MOUSE VERTICALLY TO RALLY · CLICK TO ARM POWER SMASH!'}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {doneMsg && (
            <button
              type="button"
              onClick={reset}
              className="px-3 py-1.5 rounded-lg bg-blue-400 hover:bg-blue-300 text-black font-black uppercase cursor-pointer"
            >
              Rematch
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-black uppercase cursor-pointer"
          >
            Step Off
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 12. HEAVYWEIGHT BOXER PUNCH BAG ARCADE (NEW!)
// ============================================================================
const PUNCH_W = 420;
const PUNCH_H = 290;

const PunchBagMiniGame: React.FC<{
  venueName: string;
  onAwardCash: (delta: number, label: string) => void;
  onClose: () => void;
}> = ({ venueName, onAwardCash, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [round, setRound] = useState(1);
  const [bestLbs, setBestLbs] = useState(0);
  const [totalLbs, setTotalLbs] = useState(0);
  const [done, setDone] = useState(false);

  const stRef = useRef({
    meter: 0.1,
    dir: 1,
    bagAngle: 0,
    bagVel: 0,
    round: 1,
    bestLbs: 0,
    totalLbs: 0,
    popups: [] as FloatingPopup[],
    sparks: [] as ParticleSpark[],
    done: false,
  });

  const throwPunch = () => {
    const st = stRef.current;
    if (st.done) return;
    // Sweet spot at center (0.85..0.96 gives maximum punch!) or high peak
    const accuracy = Math.max(0.25, 1 - Math.abs(st.meter - 0.86) * 2.1);
    const lbs = Math.round(320 + accuracy * 675);
    st.bagVel = -6.5 * accuracy;
    if (lbs > st.bestLbs) st.bestLbs = lbs;
    st.totalLbs += lbs;
    setBestLbs(st.bestLbs);
    setTotalLbs(st.totalLbs);
    st.popups.push({ x: PUNCH_W / 2, y: 120, text: `${lbs} LBS!`, color: lbs >= 880 ? '#facc15' : '#38bdf8', life: 1.0 });
    for (let k = 0; k < 14; k++) {
      const a = Math.random() * Math.PI * 2;
      st.sparks.push({ x: PUNCH_W / 2 - 20, y: 145, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, color: lbs >= 880 ? '#facc15' : '#ef4444', life: 0.4, size: 3 });
    }
    playArcadeSfx(180, 65, 0.18, 'sawtooth', 0.1);

    if (st.round >= 3) {
      st.done = true;
      setDone(true);
      const prize = Math.min(1150, Math.round(st.totalLbs * 0.36));
      onAwardCash(prize, '🥊 HEAVYWEIGHT BOXER PRIZE');
    } else {
      st.round += 1;
      setRound(st.round);
    }
  };

  const reset = () => {
    stRef.current = {
      meter: 0.1,
      dir: 1,
      bagAngle: 0,
      bagVel: 0,
      round: 1,
      bestLbs: 0,
      totalLbs: 0,
      popups: [],
      sparks: [],
      done: false,
    };
    setRound(1);
    setBestLbs(0);
    setTotalLbs(0);
    setDone(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        throwPunch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.03, Math.max(0.005, (now - last) / 1000));
      last = now;
      const st = stRef.current;

      if (!st.done) {
        st.meter += st.dir * dt * (1.4 + st.round * 0.28);
        if (st.meter >= 1) {
          st.meter = 1;
          st.dir = -1;
        } else if (st.meter <= 0) {
          st.meter = 0;
          st.dir = 1;
        }
      }

      // Bag spring pendulum
      st.bagVel += -st.bagAngle * 38 * dt;
      st.bagVel *= Math.pow(0.18, dt);
      st.bagAngle += st.bagVel * dt;

      for (let i = st.sparks.length - 1; i >= 0; i--) {
        st.sparks[i].x += st.sparks[i].vx * dt;
        st.sparks[i].y += st.sparks[i].vy * dt;
        st.sparks[i].life -= dt;
        if (st.sparks[i].life <= 0) st.sparks.splice(i, 1);
      }
      for (let i = st.popups.length - 1; i >= 0; i--) {
        st.popups[i].y -= 28 * dt;
        st.popups[i].life -= dt;
        if (st.popups[i].life <= 0) st.popups.splice(i, 1);
      }

      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, PUNCH_W, PUNCH_H);
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(85, 16, PUNCH_W - 170, 38);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.strokeRect(85, 16, PUNCH_W - 170, 38);
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`PEAK: ${st.bestLbs} LBS`, PUNCH_W / 2, 41);

      // Swinging heavy bag
      ctx.save();
      ctx.translate(PUNCH_W / 2, 54);
      ctx.rotate(st.bagAngle);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 48);
      ctx.stroke();
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(-26, 48, 52, 86);
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 2;
      ctx.strokeRect(-26, 48, 52, 86);
      ctx.restore();

      // Timing Power Bar
      ctx.fillStyle = '#18181b';
      ctx.fillRect(46, 232, PUNCH_W - 92, 22);
      // Sweet Gold KO zone (0.78..0.94)
      const barW = PUNCH_W - 92;
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(46 + barW * 0.65, 232, barW * 0.32, 22);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(46 + barW * 0.81, 232, barW * 0.1, 22);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(46 + st.meter * barW - 3, 226, 6, 34);

      for (const sp of st.sparks) {
        ctx.globalAlpha = Math.max(0, sp.life * 2.2);
        ctx.fillStyle = sp.color;
        ctx.fillRect(sp.x, sp.y, sp.size, sp.size);
      }
      ctx.globalAlpha = 1;
      for (const pop of st.popups) {
        ctx.globalAlpha = Math.max(0, pop.life * 1.4);
        ctx.fillStyle = pop.color;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pop.text, pop.x, pop.y);
      }
      ctx.globalAlpha = 1;

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [onAwardCash]);

  return (
    <div className="bg-zinc-950 border-2 border-red-500 rounded-2xl p-4 w-full max-w-md shadow-[0_0_50px_rgba(239,68,68,0.45)] font-mono flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div>
          <span className="text-[10px] font-black uppercase text-red-400 tracking-widest">
            🥊 HEAVYWEIGHT BOXER BAG · {venueName}
          </span>
          <h3 className="text-base font-black text-white">NAIL THE GOLD KO ZONE! (3 PUNCHES)</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-black">
          <span className="px-2 py-1 rounded bg-zinc-900 border border-white/10 text-amber-300">RND {round}/3</span>
          <span className="px-2 py-1 rounded bg-zinc-900 border border-white/10 text-red-300">{bestLbs} LBS</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={PUNCH_W}
        height={PUNCH_H}
        onClick={throwPunch}
        className="w-full h-auto rounded-xl border border-red-400/40 cursor-pointer select-none"
      />

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-emerald-300 font-bold truncate">
          {done
            ? `🏆 3-PUNCH TOTAL: ${totalLbs} LBS · PRIZE +$${Math.min(1150, Math.round(totalLbs * 0.36))}!`
            : 'CLICK OR PRESS SPACE WHEN WHITE BAR HITS GOLD!'}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {!done ? (
            <button
              type="button"
              onClick={throwPunch}
              className="px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-white font-black uppercase cursor-pointer"
            >
              PUNCH!
            </button>
          ) : (
            <button
              type="button"
              onClick={reset}
              className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-black uppercase cursor-pointer"
            >
              Play Again
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-black uppercase cursor-pointer"
          >
            Step Off
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 13. LASER GALLERY SHOOTING BOOTH (NEW!)
// ============================================================================
const RANGE_W = 480;
const RANGE_H = 290;

const TargetRangeMiniGame: React.FC<{
  venueName: string;
  onAwardCash: (delta: number, label: string) => void;
  onClose: () => void;
}> = ({ venueName, onAwardCash, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [ammo, setAmmo] = useState(8);
  const [timeLeft, setTimeLeft] = useState(24);
  const [done, setDone] = useState(false);

  const stRef = useRef({
    targets: [] as { id: number; row: number; x: number; y: number; vx: number; kind: 'duck' | 'star' | 'ufo' | 'decoy'; hit?: boolean }[],
    nextId: 1,
    spawnTimer: 0.15,
    score: 0,
    ammo: 8,
    timeLeft: 24,
    popups: [] as FloatingPopup[],
    sparks: [] as ParticleSpark[],
    done: false,
  });

  const reload = () => {
    stRef.current.ammo = 8;
    setAmmo(8);
    playArcadeSfx(320, 620, 0.1, 'triangle', 0.06);
  };

  const reset = () => {
    stRef.current = {
      targets: [],
      nextId: 1,
      spawnTimer: 0.15,
      score: 0,
      ammo: 8,
      timeLeft: 24,
      popups: [],
      sparks: [],
      done: false,
    };
    setScore(0);
    setAmmo(8);
    setTimeLeft(24);
    setDone(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') reload();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let last = performance.now();
    const rowYs = [66, 136, 206];

    const loop = (now: number) => {
      const dt = Math.min(0.03, Math.max(0.005, (now - last) / 1000));
      last = now;
      const st = stRef.current;

      for (let i = st.sparks.length - 1; i >= 0; i--) {
        st.sparks[i].x += st.sparks[i].vx * dt;
        st.sparks[i].y += st.sparks[i].vy * dt;
        st.sparks[i].life -= dt;
        if (st.sparks[i].life <= 0) st.sparks.splice(i, 1);
      }
      for (let i = st.popups.length - 1; i >= 0; i--) {
        st.popups[i].y -= 26 * dt;
        st.popups[i].life -= dt;
        if (st.popups[i].life <= 0) st.popups.splice(i, 1);
      }

      if (!st.done) {
        st.timeLeft = Math.max(0, st.timeLeft - dt);
        setTimeLeft(Math.ceil(st.timeLeft));
        if (st.timeLeft <= 0) {
          st.done = true;
          setDone(true);
          const prize = Math.min(1200, Math.round(st.score * 1.1));
          if (prize > 0) {
            onAwardCash(prize, '🎯 LASER GALLERY PRIZE');
            playArcadeSfx(523, 1046, 0.25, 'triangle', 0.08);
          }
        }

        st.spawnTimer -= dt;
        if (st.spawnTimer <= 0 && st.targets.length < 8) {
          st.spawnTimer = 0.42;
          const row = Math.floor(Math.random() * 3);
          const dir = row === 1 ? -1 : 1;
          const spd = (80 + row * 32 + Math.random() * 35) * dir;
          const r = Math.random();
          const kind = r < 0.2 ? 'ufo' : r < 0.45 ? 'star' : r < 0.6 ? 'decoy' : 'duck';
          st.targets.push({
            id: st.nextId++,
            row,
            x: dir > 0 ? -24 : RANGE_W + 24,
            y: rowYs[row],
            vx: spd,
            kind,
          });
        }

        for (let i = st.targets.length - 1; i >= 0; i--) {
          const t = st.targets[i];
          t.x += t.vx * dt;
          if (t.x < -36 || t.x > RANGE_W + 36) st.targets.splice(i, 1);
        }
      }

      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, RANGE_W, RANGE_H);
      // 3 Arcade Conveyor Rails
      for (const ry of rowYs) {
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, ry + 18, RANGE_W, 8);
      }

      for (const t of st.targets) {
        const col = t.kind === 'ufo' ? '#facc15' : t.kind === 'star' ? '#22d3ee' : t.kind === 'decoy' ? '#ef4444' : '#fb923c';
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t.kind === 'ufo' ? '🛸' : t.kind === 'star' ? '⭐' : t.kind === 'decoy' ? '🛡️' : '🦆', t.x, t.y + 1);
      }

      // Ammo indicator bar at bottom
      for (let a = 0; a < 8; a++) {
        ctx.fillStyle = a < st.ammo ? '#facc15' : '#27272a';
        ctx.fillRect(16 + a * 18, RANGE_H - 22, 12, 14);
      }

      for (const sp of st.sparks) {
        ctx.globalAlpha = Math.max(0, sp.life * 2.4);
        ctx.fillStyle = sp.color;
        ctx.fillRect(sp.x, sp.y, sp.size, sp.size);
      }
      ctx.globalAlpha = 1;
      for (const pop of st.popups) {
        ctx.globalAlpha = Math.max(0, pop.life * 1.4);
        ctx.fillStyle = pop.color;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pop.text, pop.x, pop.y);
      }
      ctx.globalAlpha = 1;

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [onAwardCash]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const st = stRef.current;
    if (st.done) return;
    if (st.ammo <= 0) {
      reload();
      return;
    }
    st.ammo -= 1;
    setAmmo(st.ammo);
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * RANGE_W;
    const my = ((e.clientY - rect.top) / rect.height) * RANGE_H;
    playArcadeSfx(480, 220, 0.06, 'square', 0.04);

    for (let i = st.targets.length - 1; i >= 0; i--) {
      const t = st.targets[i];
      if (Math.hypot(mx - t.x, my - t.y) <= 23) {
        const pts = t.kind === 'ufo' ? 85 : t.kind === 'star' ? 50 : t.kind === 'decoy' ? -30 : 30;
        st.score = Math.max(0, st.score + pts);
        setScore(st.score);
        st.popups.push({ x: t.x, y: t.y - 12, text: pts > 0 ? `+${pts}` : `${pts}`, color: pts > 0 ? '#facc15' : '#ef4444', life: 0.7 });
        for (let k = 0; k < 10; k++) {
          const a = Math.random() * Math.PI * 2;
          st.sparks.push({ x: t.x, y: t.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, color: pts > 0 ? '#38bdf8' : '#ef4444', life: 0.35, size: 3 });
        }
        st.targets.splice(i, 1);
        break;
      }
    }
  };

  return (
    <div className="bg-zinc-950 border-2 border-emerald-400 rounded-2xl p-4 w-full max-w-xl shadow-[0_0_50px_rgba(16,185,129,0.45)] font-mono flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div>
          <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">
            🎯 LASER GALLERY BOOTH · {venueName}
          </span>
          <h3 className="text-base font-black text-white">ZAP DUCKS, STARS & UFOS · AVOID SHIELDS!</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-black">
          <span className="px-2 py-1 rounded bg-zinc-900 border border-white/10 text-amber-300">AMMO {ammo}/8</span>
          <span className="px-2 py-1 rounded bg-zinc-900 border border-white/10 text-cyan-300">{timeLeft}S</span>
          <span className="px-2 py-1 rounded bg-zinc-900 border border-white/10 text-emerald-300">{score}</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={RANGE_W}
        height={RANGE_H}
        onClick={handleClick}
        className="w-full h-auto rounded-xl border border-emerald-400/40 cursor-crosshair select-none"
      />

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-emerald-300 font-bold truncate">
          {done
            ? `🏆 FINAL SCORE: ${score} PTS · PRIZE +$${Math.min(1200, Math.round(score * 1.1))}!`
            : 'CLICK TO FIRE · PRESS [R] OR CLICK RELOAD WHEN EMPTY!'}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {!done ? (
            <button
              type="button"
              onClick={reload}
              className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-black uppercase cursor-pointer"
            >
              Reload [R]
            </button>
          ) : (
            <button
              type="button"
              onClick={reset}
              className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black font-black uppercase cursor-pointer"
            >
              Play Again
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-black uppercase cursor-pointer"
          >
            Step Off
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// WORKPLACE SHIFT MINI-GAME (OFFICE, CLINIC, LAB, BANK, RETAIL, DISPATCH, KITCHEN, MECHANIC, ATC, STUDIO)
// ============================================================================
interface ShiftTaskSpec {
  category: string;
  prompt: string;
  detail: string;
  options: string[];
  correctIdx: number;
  taskMode?: 'choice' | 'timing_gauge' | 'dual_balance' | 'code_sequence';
  gaugeLabel?: string;
  gaugeTargetCenter?: number;
  gaugeTargetWidth?: number;
  gaugeSpeed?: number;
  balanceParamA?: { label: string; target: number; start: number; unit: string };
  balanceParamB?: { label: string; target: number; start: number; unit: string };
  sequenceTarget?: string[];
}

const SHIFT_THEME_META: Record<
  WorkplaceShiftKind,
  {
    icon: string;
    title: string;
    subtitle: string;
    accentBorder: string;
    accentBg: string;
    accentText: string;
    basePay: number;
    perCorrect: number;
    ranks: string[];
  }
> = {
  work_office: {
    icon: '💼',
    title: 'CORPORATE OFFICE WORKSTATION',
    subtitle: 'Clear quarterly audits, inbox triage & timed trade approvals',
    accentBorder: 'border-blue-400/70',
    accentBg: 'bg-blue-500/20',
    accentText: 'text-blue-300',
    basePay: 1100,
    perCorrect: 360,
    ranks: ['Junior Analyst', 'Senior Associate', 'Suite Lead', 'VP of Operations'],
  },
  work_clinic: {
    icon: '🩺',
    title: 'CLINIC & TRIAGE CHARTING DESK',
    subtitle: 'Sync patient vitals, review labs & sign treatment charts',
    accentBorder: 'border-cyan-400/70',
    accentBg: 'bg-cyan-500/20',
    accentText: 'text-cyan-300',
    basePay: 1200,
    perCorrect: 380,
    ranks: ['Triage Intern', 'Charge Nurse', 'Resident MD', 'Chief of Medicine'],
  },
  work_lab: {
    icon: '🔬',
    title: 'RESEARCH & ASSAY BENCH',
    subtitle: 'Lock centrifuge RPMs, balance pH & clear NIST sample assays',
    accentBorder: 'border-sky-400/70',
    accentBg: 'bg-sky-500/20',
    accentText: 'text-sky-300',
    basePay: 1300,
    perCorrect: 400,
    ranks: ['Lab Tech', 'Research Fellow', 'Lead Scientist', 'Principal Investigator'],
  },
  work_bank: {
    icon: '🏦',
    title: 'TELLER & WIRE AUDIT CONSOLE',
    subtitle: 'Lock time-vault seals, balance drawers & authorize wires',
    accentBorder: 'border-amber-400/70',
    accentBg: 'bg-amber-500/20',
    accentText: 'text-amber-300',
    basePay: 1200,
    perCorrect: 370,
    ranks: ['Branch Teller', 'Senior Cashier', 'Auditing Officer', 'Branch VP'],
  },
  work_retail: {
    icon: '🛒',
    title: 'STORE REGISTER & CLIENT DESK',
    subtitle: 'Punch rapid SKU sequences, verify stock & balance change',
    accentBorder: 'border-pink-400/70',
    accentBg: 'bg-pink-500/20',
    accentText: 'text-pink-300',
    basePay: 980,
    perCorrect: 320,
    ranks: ['Sales Clerk', 'Shift Lead', 'Floor Manager', 'Store Director'],
  },
  work_dispatch: {
    icon: '📻',
    title: 'DISPATCH & OPERATIONS CONSOLE',
    subtitle: 'Lock emergency frequencies & route metro patrol units',
    accentBorder: 'border-indigo-400/70',
    accentBg: 'bg-indigo-500/20',
    accentText: 'text-indigo-300',
    basePay: 1250,
    perCorrect: 380,
    ranks: ['Radio Trainee', 'Senior Dispatcher', 'Watch Supervisor', 'Command Chief'],
  },
  work_kitchen: {
    icon: '👨‍🍳',
    title: 'BISTRO & CRAB HOUSE KITCHEN LINE',
    subtitle: 'Time crab-cake sears, balance twin burners & plate orders',
    accentBorder: 'border-orange-400/70',
    accentBg: 'bg-orange-500/20',
    accentText: 'text-orange-300',
    basePay: 1150,
    perCorrect: 360,
    ranks: ['Line Cook', 'Station Sous', 'Executive Chef', 'Culinary Director'],
  },
  work_mechanic: {
    icon: '🔧',
    title: 'SERVICE BAY & DYNO TUNING LIFT',
    subtitle: 'Hit exact lug torque specs, equalize EV cells & tune ECU boost',
    accentBorder: 'border-yellow-400/70',
    accentBg: 'bg-yellow-500/20',
    accentText: 'text-yellow-300',
    basePay: 1350,
    perCorrect: 410,
    ranks: ['Lube & Tire Tech', 'Master Mechanic', 'Lead Dyno Tuner', 'Motorsport Chief'],
  },
  work_atc: {
    icon: '✈️',
    title: 'AIR TRAFFIC & RAMP CONTROL TOWER',
    subtitle: 'Align ILS glide-slopes, punch squawk codes & clear jet departures',
    accentBorder: 'border-sky-400/70',
    accentBg: 'bg-sky-500/20',
    accentText: 'text-sky-300',
    basePay: 1500,
    perCorrect: 440,
    ranks: ['Ground Trainee', 'Tower Controller', 'TRACON Radar Lead', 'Chief of Operations'],
  },
  work_studio: {
    icon: '🎬',
    title: 'LIVE BROADCAST & AUDIO MIXING STUDIO',
    subtitle: 'Balance dual studio faders, cue live cameras & master feeds',
    accentBorder: 'border-fuchsia-400/70',
    accentBg: 'bg-fuchsia-500/20',
    accentText: 'text-fuchsia-300',
    basePay: 1320,
    perCorrect: 400,
    ranks: ['Boom & Tape Tech', 'Sound Engineer', 'Live Switcher', 'Executive Producer'],
  },
};

function generateWorkplaceTasks(kind: WorkplaceShiftKind, count = 6): ShiftTaskSpec[] {
  const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffleOptions = (correct: string, wrongs: string[]): { options: string[]; correctIdx: number } => {
    const items = [
      { text: correct, ok: true },
      ...wrongs.slice(0, 2).map((w) => ({ text: w, ok: false })),
    ];
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return {
      options: items.map((x) => x.text),
      correctIdx: items.findIndex((x) => x.ok),
    };
  };

  const makeTimingTask = (
    category: string,
    prompt: string,
    detail: string,
    gaugeLabel: string,
    speed = 1.45
  ): ShiftTaskSpec => ({
    category,
    prompt,
    detail,
    options: [],
    correctIdx: 0,
    taskMode: 'timing_gauge',
    gaugeLabel,
    gaugeTargetCenter: randInt(28, 72),
    gaugeTargetWidth: 19,
    gaugeSpeed: speed,
  });

  const makeBalanceTask = (
    category: string,
    prompt: string,
    detail: string,
    labelA: string,
    targetA: number,
    unitA: string,
    labelB: string,
    targetB: number,
    unitB: string
  ): ShiftTaskSpec => ({
    category,
    prompt,
    detail,
    options: [],
    correctIdx: 0,
    taskMode: 'dual_balance',
    balanceParamA: {
      label: labelA,
      target: targetA,
      start: targetA + (Math.random() < 0.5 ? -3 : 3),
      unit: unitA,
    },
    balanceParamB: {
      label: labelB,
      target: targetB,
      start: targetB + (Math.random() < 0.5 ? 2 : -2),
      unit: unitB,
    },
  });

  const makeCodeSequenceTask = (
    category: string,
    prompt: string,
    detail: string,
    pool: string[],
    len = 4
  ): ShiftTaskSpec => {
    const seq: string[] = [];
    for (let k = 0; k < len; k++) {
      seq.push(pool[randInt(0, pool.length - 1)]);
    }
    return {
      category,
      prompt,
      detail,
      options: [],
      correctIdx: 0,
      taskMode: 'code_sequence',
      sequenceTarget: seq,
    };
  };

  const tasks: ShiftTaskSpec[] = [];
  for (let i = 0; i < count; i++) {
    // Inject interactive skill gameplay at indices 1 and 4 of every shift!
    if (i === 1) {
      if (kind === 'work_office') {
        tasks.push(
          makeTimingTask(
            'EXECUTION TIMING',
            'Execute Market Trade at Closing Bell Window',
            'Press [SPACE] or click Lock when the ticker needle enters the green execution zone!',
            'ORDER TIMING WINDOW',
            1.5
          )
        );
        continue;
      } else if (kind === 'work_clinic') {
        tasks.push(
          makeTimingTask(
            'PULSE OX SYNC',
            'Capture Clean ECG Waveform Peak',
            'Press [SPACE] or Lock precisely inside the green sinus capture window!',
            'ECG CAPTURE ZONE',
            1.45
          )
        );
        continue;
      } else if (kind === 'work_lab') {
        tasks.push(
          makeTimingTask(
            'CENTRIFUGE LOCK',
            'Stabilize High-Speed Centrifuge RPM',
            'Lock rotor speed inside the green NIST resonance band!',
            'ROTOR RPM BAND',
            1.55
          )
        );
        continue;
      } else if (kind === 'work_bank') {
        tasks.push(
          makeTimingTask(
            'VAULT SEAL',
            'Sync Armored Time-Vault Seal Pin',
            'Engage deadbolt inside the safe timing zone to verify deposit clearance!',
            'DEADBOLT SEAL',
            1.5
          )
        );
        continue;
      } else if (kind === 'work_retail') {
        tasks.push(
          makeCodeSequenceTask(
            'RAPID SKU SCAN',
            'Enter Express Inventory Verification Code',
            'Tap or click the exact sequence tokens below in order!',
            ['A1', 'B4', 'C7', 'X9'],
            4
          )
        );
        continue;
      } else if (kind === 'work_dispatch') {
        tasks.push(
          makeTimingTask(
            'RADIO SQUELCH',
            'Lock Priority Precinct Dispatch Frequency',
            'Tap [SPACE] when carrier signal crosses the green clear-channel band!',
            'VHF CARRIER LOCK',
            1.5
          )
        );
        continue;
      } else if (kind === 'work_kitchen') {
        tasks.push(
          makeTimingTask(
            'SEAR PERFECTION',
            'Flip Lump Maryland Crab Cake at Golden Sear',
            'Press [SPACE] or Flip inside the golden crust zone without burning!',
            'SKILLET SEAR TEMP',
            1.55
          )
        );
        continue;
      } else if (kind === 'work_mechanic') {
        tasks.push(
          makeTimingTask(
            'TORQUE WRENCH',
            'Hit Exact 115 lb-ft Wheel Stud Torque',
            'Release torque bar cleanly inside the green calibration arc!',
            'TORQUE LB-FT',
            1.55
          )
        );
        continue;
      } else if (kind === 'work_atc') {
        tasks.push(
          makeTimingTask(
            'ILS GLIDE-SLOPE',
            'Align Jet Localizer onto BWI Runway 33L',
            'Lock approach beam inside the green ILS glide-slope window!',
            'ILS APPROACH BEAM',
            1.62
          )
        );
        continue;
      } else if (kind === 'work_studio') {
        tasks.push(
          makeTimingTask(
            'LIVE CAMERA CUT',
            'Hit Exact Broadcast Anchor Cue',
            'Trigger Cam-2 switch cleanly inside the live director sync beat!',
            'DIRECTOR CUE',
            1.55
          )
        );
        continue;
      }
    }

    if (i === 4) {
      if (kind === 'work_office') {
        tasks.push(
          makeCodeSequenceTask(
            'SERVER DEPLOY MACRO',
            'Run Auth Pod Hotfix Command Sequence',
            'Enter the 4 deployment keys in exact order to scale cluster traffic!',
            ['AUTH', 'SYNC', 'SCALE', 'PING'],
            4
          )
        );
        continue;
      } else if (kind === 'work_lab') {
        tasks.push(
          makeBalanceTask(
            'REAGENT BALANCE',
            'Balance Dual Assay Chamber Sensors',
            'Adjust Base Buffer & Temp using - / + until both gauges hit target!',
            'Solution pH',
            74,
            'x0.1',
            'Chamber °C',
            24,
            '°C'
          )
        );
        continue;
      } else if (kind === 'work_kitchen') {
        tasks.push(
          makeBalanceTask(
            'TWIN BURNER LINE',
            'Balance Grill Deck & Steamer Temps',
            'Dial both heat zones cleanly into target service specs before plating!',
            'Flat-Top Grill',
            38,
            '0°F',
            'Crab Steamer',
            22,
            '0°F'
          )
        );
        continue;
      } else if (kind === 'work_mechanic') {
        tasks.push(
          makeBalanceTask(
            'DYNO & BOOST TUNING',
            'Dial Air-Fuel & Turbo Boost Targets',
            'Balance AFR and Peak Boost cleanly for maximum dyno pull!',
            'Target AFR',
            12,
            ':1',
            'Peak Boost',
            19,
            'PSI'
          )
        );
        continue;
      } else if (kind === 'work_atc') {
        tasks.push(
          makeCodeSequenceTask(
            'TRANSPONDER SQUAWK',
            'Assign Departure Clearance Sequence',
            'Punch the 4 beacon codes in order to clear Runway 15R departure!',
            ['SW4', 'RW15', 'ALT9', 'CLR'],
            4
          )
        );
        continue;
      } else if (kind === 'work_studio') {
        tasks.push(
          makeBalanceTask(
            'AUDIO MASTERING',
            'Balance Studio Mic Gain & Master LUFS',
            'Tune both studio board channels cleanly into broadcast spec!',
            'Vocal Gain',
            18,
            'dB',
            'Master Out',
            14,
            'LUFS'
          )
        );
        continue;
      } else {
        tasks.push(
          makeBalanceTask(
            'SYSTEM CALIBRATION',
            'Calibrate Dual Workstation Channels',
            'Tune Primary & Backup dials using - / + until both match target!',
            'Channel A',
            16,
            'Hz',
            'Channel B',
            28,
            'V'
          )
        );
        continue;
      }
    }

    if (kind === 'work_office') {
      const mode = i % 3;
      if (mode === 0) {
        const rev = randInt(48, 120);
        const exp = randInt(16, rev - 9);
        const profit = rev - exp;
        const { options, correctIdx } = shuffleOptions(`$${profit},000 Net`, [
          `$${profit + randInt(4, 9)},000 Net`,
          `$${Math.max(3, profit - randInt(4, 9))},000 Net`,
        ]);
        tasks.push({
          category: 'Q4 LEDGER AUDIT',
          prompt: `Calculate Department Net Profit`,
          detail: `Quarterly Revenue: $${rev},000  |  Operating Expense: $${exp},000`,
          options,
          correctIdx,
        });
      } else if (mode === 1) {
        const scenarios = [
          {
            prompt: 'Inbox Triage: "Wire $85k to external crypto wallet immediately — CEO"',
            detail: 'Sender domain: ceo-urgent-mail99.biz · Requested bypass of CFO sign-off',
            ok: 'Flag Phishing & Quarantine',
            bad: ['Approve Immediate Wire', 'Reply with Bank Routing'],
          },
          {
            prompt: 'Client Brief: "Maryland Lease Renewal #408 expires in 48 hours"',
            detail: 'Signed by Legal Counsel & Regional VP · Rent unchanged',
            ok: 'Execute & Forward to Records',
            bad: ['Discard as Junk Mail', 'Freeze Client Account'],
          },
          {
            prompt: 'IT Alert: "Auth Gateway CPU spiked to 99% during morning login"',
            detail: 'Latency 1,400ms across 4 Baltimore office pods',
            ok: 'Scale Auth Replicas x2',
            bad: ['Shut Down Database', 'Ignore Until Friday'],
          },
          {
            prompt: 'Compliance Memo: "Vendor W-9 tax form missing on Invoice #774"',
            detail: 'Accounts Payable holds payout pending valid tax ID',
            ok: 'Hold & Request Vendor W-9',
            bad: ['Double Payout Anyway', 'Delete Vendor Record'],
          },
        ];
        const s = scenarios[randInt(0, scenarios.length - 1)];
        const { options, correctIdx } = shuffleOptions(s.ok, s.bad);
        tasks.push({ category: 'EXECUTIVE INBOX', prompt: s.prompt, detail: s.detail, options, correctIdx });
      } else {
        const q1 = randInt(22, 45);
        const q2 = randInt(22, 45);
        const q3 = randInt(22, 45);
        const maxQ = Math.max(q1, q2, q3);
        const winner = q1 === maxQ ? 'North Suite' : q2 === maxQ ? 'Harbor Team' : 'Bethesda Branch';
        const { options, correctIdx } = shuffleOptions(
          winner,
          ['North Suite', 'Harbor Team', 'Bethesda Branch'].filter((x) => x !== winner)
        );
        tasks.push({
          category: 'PERFORMANCE REVIEW',
          prompt: 'Which office division hit highest quarterly billings?',
          detail: `North Suite: $${q1}k  |  Harbor Team: $${q2}k  |  Bethesda Branch: $${q3}k`,
          options,
          correctIdx,
        });
      }
    } else if (kind === 'work_clinic') {
      const cases = [
        {
          prompt: 'Patient Vitals: Temp 102.6°F · White Tonsil Exudate',
          detail: 'No drug allergies · Reports 2 days painful swallowing',
          ok: 'Rapid Strep Test & Antipyretic',
          bad: ['Orthopedic Leg Cast', 'Eye Prescription Drops'],
        },
        {
          prompt: 'Triage Alert: BP 174/104 mmHg · Blurred Vision',
          detail: 'Walk-in adult patient reporting sudden headache',
          ok: 'Immediate Hypertensive Eval & ECG',
          bad: ['Send Home Without Check', 'Schedule Dental Cleaning'],
        },
        {
          prompt: 'Orthopedic Exam: Rolled Left Ankle on Stairs',
          detail: 'Localized lateral swelling · Can bear partial weight',
          ok: 'Ankle X-Ray & Compression Wrap',
          bad: ['Prescribe Asthma Inhaler', 'Administer Flu Shot Only'],
        },
        {
          prompt: 'Rx Verification: Patient allergic to Penicillin',
          detail: 'Needs broad-spectrum antibiotic coverage for sinus infection',
          ok: 'Substitute Non-Penicillin Rx',
          bad: ['Dispense Amoxicillin Anyway', 'Skip Allergy Check'],
        },
      ];
      if (i % 2 === 0) {
        const c = cases[randInt(0, cases.length - 1)];
        const { options, correctIdx } = shuffleOptions(c.ok, c.bad);
        tasks.push({ category: 'PATIENT TRIAGE', prompt: c.prompt, detail: c.detail, options, correctIdx });
      } else {
        const hr = randInt(52, 132);
        const status = hr > 100 ? 'Tachycardia (>100 bpm)' : hr < 60 ? 'Bradycardia (<60 bpm)' : 'Normal Sinus (60–100)';
        const { options, correctIdx } = shuffleOptions(
          status,
          ['Tachycardia (>100 bpm)', 'Bradycardia (<60 bpm)', 'Normal Sinus (60–100)'].filter((x) => x !== status)
        );
        tasks.push({
          category: 'VITALS MONITOR',
          prompt: `Classify Resting Heart Rate: ${hr} BPM`,
          detail: 'Standard Adult Resting Range: 60–100 BPM',
          options,
          correctIdx,
        });
      }
    } else if (kind === 'work_lab') {
      if (i % 2 === 0) {
        const curPh = Number((6.2 + randInt(0, 18) * 0.1).toFixed(1));
        const targetPh = 7.4;
        const delta = Number((targetPh - curPh).toFixed(1));
        const ok =
          Math.abs(delta) < 0.05
            ? 'Hold — Sample Calibrated'
            : delta > 0
            ? `Add +${delta.toFixed(1)} Base Buffer`
            : `Add ${delta.toFixed(1)} Acid Buffer`;
        const { options, correctIdx } = shuffleOptions(ok, [
          `Add +${(Math.abs(delta) + 0.8).toFixed(1)} Base Buffer`,
          `Add -${(Math.abs(delta) + 0.9).toFixed(1)} Acid Buffer`,
        ]);
        tasks.push({
          category: 'pH CALIBRATION',
          prompt: `Adjust Assay Solution to Target pH ${targetPh}`,
          detail: `Current Sensor Probe Readout: pH ${curPh.toFixed(1)}`,
          options,
          correctIdx,
        });
      } else {
        const targetMv = randInt(220, 480);
        const { options, correctIdx } = shuffleOptions(`${targetMv} mV (Verified)`, [
          `${targetMv + 45} mV (Drift)`,
          `${targetMv - 55} mV (Noise)`,
        ]);
        tasks.push({
          category: 'SPECTROMETER LOCK',
          prompt: `Select Exact Reference Peak: ${targetMv} mV`,
          detail: 'Match NIST calibration frequency within ±0 mV tolerance',
          options,
          correctIdx,
        });
      }
    } else if (kind === 'work_bank') {
      if (i % 2 === 0) {
        const hundreds = randInt(2, 6);
        const twenties = randInt(1, 5);
        const tens = randInt(1, 4);
        const total = hundreds * 100 + twenties * 20 + tens * 10;
        const { options, correctIdx } = shuffleOptions(`$${total.toLocaleString()}`, [
          `$${(total + 40).toLocaleString()}`,
          `$${(total - 30).toLocaleString()}`,
        ]);
        tasks.push({
          category: 'CASH DRAWER AUDIT',
          prompt: 'Count Teller Vault Deposit Bundle',
          detail: `${hundreds}×$100 bills  +  ${twenties}×$20 bills  +  ${tens}×$10 bills`,
          options,
          correctIdx,
        });
      } else {
        const isValid = i % 4 === 1;
        const written = '$1,450.00';
        const numeric = isValid ? '$1,450.00' : '$14,500.00';
        const ok = isValid ? 'Approve & Clear Check' : 'Hold — Amount Mismatch';
        const { options, correctIdx } = shuffleOptions(ok, [
          isValid ? 'Hold — Amount Mismatch' : 'Approve & Clear Check',
          'Waive Verification & Pay Cash',
        ]);
        tasks.push({
          category: 'CHECK & WIRE AUDIT',
          prompt: `Written Line: "${written}"  |  Numeric Box: "${numeric}"`,
          detail: 'Verify written legal amount matches numeric box before clearing',
          options,
          correctIdx,
        });
      }
    } else if (kind === 'work_retail') {
      const price = randInt(12, 46);
      const paid = price <= 20 ? 20 : price <= 50 ? 50 : 100;
      const change = paid - price;
      const { options, correctIdx } = shuffleOptions(`$${change}.00 Change`, [
        `$${change + randInt(2, 6)}.00 Change`,
        `$${Math.max(1, change - randInt(2, 5))}.00 Change`,
      ]);
      tasks.push({
        category: 'REGISTER CHECKOUT',
        prompt: `Customer Pays $${paid}.00 for $${price}.00 Order`,
        detail: 'Select exact register change to keep drawer balanced',
        options,
        correctIdx,
      });
    } else if (kind === 'work_kitchen') {
      const orders = [
        {
          prompt: 'Table 6 Ticket: Jumbo Lump Maryland Crab Cakes (No Filler)',
          detail: 'Finish with Old Bay aioli + charred lemon on warm plate',
          ok: 'Sauté Golden & Plate w/ Old Bay',
          bad: ['Boil 20 Mins in Plain Water', 'Serve Frozen Without Heat'],
        },
        {
          prompt: 'Allergy Flag: Ticket #19 — Severe Shellfish Allergy',
          detail: 'Guest ordered Grilled Rockfish · Sauté pan shared crab line',
          ok: 'Use Clean Sanitized Pan & Gloves',
          bad: ['Rinse Old Pan Quickly', 'Swap Sauce Only'],
        },
        {
          prompt: 'Morning Barista Rush: Double Espresso Pull Running Too Fast (11s)',
          detail: 'Shot tastes sour & watery at 6 bar pressure',
          ok: 'Finely Grind & Tamp to 9 Bar',
          bad: ['Add Cold Tap Water', 'Coarsen Grind Further'],
        },
      ];
      const o = orders[randInt(0, orders.length - 1)];
      const { options, correctIdx } = shuffleOptions(o.ok, o.bad);
      tasks.push({ category: 'KITCHEN TICKET', prompt: o.prompt, detail: o.detail, options, correctIdx });
    } else if (kind === 'work_mechanic') {
      const specs = [
        {
          prompt: 'Brake Service: Soft Spongy Pedal & Low Fluid Reservoir',
          detail: 'Front calipers just replaced on Dodge Hellcat bay #2',
          ok: 'Pressure-Bleed Brake Lines & Top DOT4',
          bad: ['Grease Brake Rotors', 'Lower Tire Pressure to 14 PSI'],
        },
        {
          prompt: 'Dyno Diagnostics: Knock Sensor Pulls Timing Above 5,500 RPM',
          detail: 'Customer filled 87 octane on high-boost twin-turbo tune',
          ok: 'Drain Tank & Flash 93 Octane Map',
          bad: ['Advance Spark Timing +8°', 'Disconnect Knock Sensor'],
        },
        {
          prompt: 'EV Pack Fault: Module #4 Reads 0.45V Higher Than Rest',
          detail: 'BMS triggered charge current limiter at 72% SoC',
          ok: 'Run Active Cell Balance Cycle',
          bad: ['Jump Directly With 12V Alternator', 'Bypass Coolant Pump'],
        },
      ];
      const s = specs[randInt(0, specs.length - 1)];
      const { options, correctIdx } = shuffleOptions(s.ok, s.bad);
      tasks.push({ category: 'GARAGE DIAGNOSTICS', prompt: s.prompt, detail: s.detail, options, correctIdx });
    } else if (kind === 'work_atc') {
      const calls = [
        {
          prompt: 'BWI Final: Two jets converging at 2.1 NM separation on Runway 33L',
          detail: 'Trailing heavy 767 closing 35 kts faster than regional turboprop',
          ok: 'Instruct Trailing Jet: Go Around',
          bad: ['Turn Off Runway Lights', 'Clear Both to Land Simultaneously'],
        },
        {
          prompt: 'KGAI Tower: Crosswind 24 kts from 320° · Cessna Requesting Touchdown',
          detail: 'Active runway options: RWY 14 vs RWY 32',
          ok: 'Assign Headwind Runway 32',
          bad: ['Assign Tailwind Runway 14', 'Close Airspace Indefinitely'],
        },
        {
          prompt: 'Storm Cell Alert: Severe Microburst Crossing South Approach Corridor',
          detail: 'Visibility dropping below 1/2 mile near Chesapeake Bay',
          ok: 'Hold Departures & Divert Vectors East',
          bad: ['Expedite Low-Altitude Takeoffs', 'Disable Radar Altimeter'],
        },
      ];
      const c = calls[randInt(0, calls.length - 1)];
      const { options, correctIdx } = shuffleOptions(c.ok, c.bad);
      tasks.push({ category: 'ATC TRAFFIC VECTOR', prompt: c.prompt, detail: c.detail, options, correctIdx });
    } else if (kind === 'work_studio') {
      const cues = [
        {
          prompt: 'Audio Feed Check: Harbor Field Reporter Mic Peaking at +3 dB Clipping',
          detail: 'Harbor wind noise saturating live pre-amp input',
          ok: 'Engage High-Pass Filter & Trim -6 dB',
          bad: ['Boost Compressor Gain +12 dB', 'Mute Master Studio Out'],
        },
        {
          prompt: 'Live Switcher: Satellite Feed #2 Dropping Frames 10s Before Package',
          detail: 'Backup fiber link B from WTC roof is 100% locked',
          ok: 'Cut to Backup Fiber Link B',
          bad: ['Roll Dead Air Until Tomorrow', 'Cut Power to Control Room'],
        },
        {
          prompt: 'Color Grade Check: Outdoor Waterfront Cam Overexposed in Sun Glare',
          detail: 'Waveforms hitting 105 IRE highlights on Bay Bridge shot',
          ok: 'Drop ND Filter & Pull Exposure 1.5 Stops',
          bad: ['Max ISO Gain to 12800', 'Unplug SDI Monitor'],
        },
      ];
      const c = cues[randInt(0, cues.length - 1)];
      const { options, correctIdx } = shuffleOptions(c.ok, c.bad);
      tasks.push({ category: 'BROADCAST CONTROL', prompt: c.prompt, detail: c.detail, options, correctIdx });
    } else {
      // work_dispatch
      const calls = [
        {
          prompt: '911 Call: Two-car collision blocking I-270 Southbound Lane 2',
          detail: 'Minor injuries reported · Traffic backing up toward Shady Grove',
          ok: 'Dispatch State Trooper + Tow',
          bad: ['Dispatch Harbor Tugboat', 'Ignore Highway Call'],
        },
        {
          prompt: 'Silent Alarm: Baltimore Federal Reserve Motion Sensor',
          detail: 'Vault Zone 1 triggered after hours · Perimeter locked',
          ok: 'Dispatch Priority Armed Units',
          bad: ['Send Parking Meter Clerk', 'Cancel Alarm Without Check'],
        },
        {
          prompt: 'Transit Alert: Signal Outage at Pratt St & Light St',
          detail: 'Heavy downtown rush hour cross-traffic',
          ok: 'Send Traffic Control & Tech Crew',
          bad: ['Close All Bay Bridges', 'Deploy Coast Guard Cutter'],
        },
      ];
      const c = calls[randInt(0, calls.length - 1)];
      const { options, correctIdx } = shuffleOptions(c.ok, c.bad);
      tasks.push({ category: 'DISPATCH CONSOLE', prompt: c.prompt, detail: c.detail, options, correctIdx });
    }
  }
  return tasks;
}

const WorkplaceShiftMiniGame: React.FC<{
  kind: WorkplaceShiftKind;
  venueName: string;
  stationLabel?: string;
  onCompleteShift: (delta: number, label: string) => void;
  onClose: () => void;
}> = ({ kind, venueName, stationLabel, onCompleteShift, onClose }) => {
  const meta = SHIFT_THEME_META[kind];
  const [tasks, setTasks] = useState<ShiftTaskSpec[]>(() => generateWorkplaceTasks(kind, 6));
  const [stepIdx, setStepIdx] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [shiftsCompletedSession, setShiftsCompletedSession] = useState(0);
  const [sessionCashEarned, setSessionCashEarned] = useState(0);
  const [lastFeedback, setLastFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [phase, setPhase] = useState<'working' | 'summary'>('working');
  const [lastPayout, setLastPayout] = useState(0);
  const lockedRef = useRef(false);

  // Interactive skill task states (Timing Gauge / Dual Balance / Code Sequence)
  const [gaugePos, setGaugePos] = useState(50);
  const gaugePosRef = useRef(50);
  const gaugeDirRef = useRef(1);
  const [balA, setBalA] = useState(0);
  const [balB, setBalB] = useState(0);
  const [seqEntered, setSeqEntered] = useState<string[]>([]);

  const rankName = meta.ranks[Math.min(meta.ranks.length - 1, shiftsCompletedSession)];
  const currentTask = tasks[stepIdx];
  const taskMode = currentTask?.taskMode || 'choice';

  useEffect(() => {
    if (!currentTask) return;
    if (currentTask.taskMode === 'dual_balance') {
      setBalA(currentTask.balanceParamA?.start ?? 0);
      setBalB(currentTask.balanceParamB?.start ?? 0);
    } else if (currentTask.taskMode === 'code_sequence') {
      setSeqEntered([]);
    } else if (currentTask.taskMode === 'timing_gauge') {
      gaugePosRef.current = 10;
      gaugeDirRef.current = 1;
      setGaugePos(10);
    }
  }, [stepIdx, currentTask]);

  // Animate timing_gauge needle smoothly at 60Hz
  useEffect(() => {
    if (phase !== 'working' || taskMode !== 'timing_gauge') return;
    let rafId = 0;
    let lastT = performance.now();
    const speedMult = (currentTask?.gaugeSpeed || 1.45) * 92;
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
      lastT = now;
      if (!lockedRef.current) {
        let next = gaugePosRef.current + gaugeDirRef.current * speedMult * dt;
        if (next >= 98) {
          next = 98;
          gaugeDirRef.current = -1;
        } else if (next <= 2) {
          next = 2;
          gaugeDirRef.current = 1;
        }
        gaugePosRef.current = next;
        setGaugePos(next);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase, taskMode, currentTask]);

  const resolveTaskResult = useCallback(
    (isCorrect: boolean, failHint?: string) => {
      if (phase !== 'working' || lockedRef.current || !currentTask) return;
      lockedRef.current = true;
      const nextCorrect = isCorrect ? correctCount + 1 : correctCount;
      const nextStreak = isCorrect ? streak + 1 : 0;
      const nextBestStreak = Math.max(bestStreak, nextStreak);

      if (isCorrect) {
        playArcadeSfx(540 + nextStreak * 45, 820 + nextStreak * 45, 0.11, 'triangle', 0.075);
        setLastFeedback({ ok: true, text: `✓ SKILL EXECUTED (+${nextStreak} STREAK)` });
      } else {
        playArcadeSfx(240, 140, 0.14, 'sawtooth', 0.06);
        setLastFeedback({
          ok: false,
          text: failHint || `✖ MISTAKE — Needed: ${currentTask.options[currentTask.correctIdx] || 'Exact Target'}`,
        });
      }

      setCorrectCount(nextCorrect);
      setStreak(nextStreak);
      setBestStreak(nextBestStreak);

      window.setTimeout(() => {
        lockedRef.current = false;
        setLastFeedback(null);
        if (stepIdx + 1 >= tasks.length) {
          const rankMult = 1 + Math.min(0.6, shiftsCompletedSession * 0.2);
          const streakBonus = nextBestStreak * 110;
          const accuracyBonus = nextCorrect === tasks.length ? 420 : 0;
          const payout = Math.round(
            (meta.basePay + nextCorrect * meta.perCorrect + streakBonus + accuracyBonus) * rankMult
          );
          setLastPayout(payout);
          setSessionCashEarned((prev) => prev + payout);
          setShiftsCompletedSession((prev) => prev + 1);
          setPhase('summary');
          playArcadeSfx(587, 987, 0.22, 'triangle', 0.09);
          onCompleteShift(payout, `${meta.icon} ${venueName} Shift (${nextCorrect}/${tasks.length})`);
        } else {
          setStepIdx((prev) => prev + 1);
        }
      }, 450);
    },
    [
      bestStreak,
      correctCount,
      currentTask,
      meta.basePay,
      meta.icon,
      meta.perCorrect,
      onCompleteShift,
      phase,
      shiftsCompletedSession,
      stepIdx,
      streak,
      tasks.length,
      venueName,
    ]
  );

  const handleChoose = useCallback(
    (optIdx: number) => {
      if (!currentTask || (currentTask.taskMode && currentTask.taskMode !== 'choice')) return;
      resolveTaskResult(optIdx === currentTask.correctIdx);
    },
    [currentTask, resolveTaskResult]
  );

  const handleLockGauge = useCallback(() => {
    if (!currentTask || currentTask.taskMode !== 'timing_gauge') return;
    const center = currentTask.gaugeTargetCenter ?? 50;
    const halfW = (currentTask.gaugeTargetWidth ?? 18) * 0.5;
    const hit = Math.abs(gaugePosRef.current - center) <= halfW + 1.5;
    resolveTaskResult(hit, `✖ MISSED ZONE — Needed ${Math.round(center - halfW)}–${Math.round(center + halfW)}%`);
  }, [currentTask, resolveTaskResult]);

  const handleConfirmBalance = useCallback(() => {
    if (!currentTask || currentTask.taskMode !== 'dual_balance') return;
    const tA = currentTask.balanceParamA?.target ?? 0;
    const tB = currentTask.balanceParamB?.target ?? 0;
    const hit = balA === tA && balB === tB;
    resolveTaskResult(hit, `✖ OFF SPEC — Needed ${tA} & ${tB}`);
  }, [balA, balB, currentTask, resolveTaskResult]);

  const handlePressSequenceToken = useCallback(
    (tok: string) => {
      if (!currentTask || currentTask.taskMode !== 'code_sequence' || lockedRef.current) return;
      const target = currentTask.sequenceTarget || [];
      const nextIdx = seqEntered.length;
      if (target[nextIdx] !== tok) {
        resolveTaskResult(false, `✖ WRONG SEQUENCE KEY — Expected ${target[nextIdx]}`);
        return;
      }
      playArcadeSfx(620 + nextIdx * 80, 740 + nextIdx * 80, 0.07, 'triangle', 0.06);
      const nextArr = [...seqEntered, tok];
      setSeqEntered(nextArr);
      if (nextArr.length >= target.length) {
        resolveTaskResult(true);
      }
    },
    [currentTask, resolveTaskResult, seqEntered]
  );

  const startNextShift = useCallback(() => {
    setTasks(generateWorkplaceTasks(kind, 6));
    setStepIdx(0);
    setCorrectCount(0);
    setStreak(0);
    setBestStreak(0);
    setLastFeedback(null);
    setPhase('working');
  }, [kind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (phase === 'working') {
        if (taskMode === 'choice') {
          if (e.key === '1' || e.key === '2' || e.key === '3') {
            e.preventDefault();
            handleChoose(Number(e.key) - 1);
          }
        } else if (taskMode === 'timing_gauge') {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            handleLockGauge();
          }
        } else if (taskMode === 'dual_balance') {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirmBalance();
          }
        }
      } else if (phase === 'summary' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        startNextShift();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleChoose, handleConfirmBalance, handleLockGauge, onClose, phase, startNextShift, taskMode]);

  const uniqueSeqTokens = Array.from(new Set(currentTask?.sequenceTarget || []));
  if (taskMode === 'code_sequence' && uniqueSeqTokens.length < 4) {
    for (const fallback of ['A1', 'B4', 'C7', 'X9']) {
      if (!uniqueSeqTokens.includes(fallback) && uniqueSeqTokens.length < 4) uniqueSeqTokens.push(fallback);
    }
  }

  return (
    <div
      className={`w-full max-w-2xl bg-zinc-950 border-2 ${meta.accentBorder} rounded-2xl shadow-2xl overflow-hidden flex flex-col font-mono`}
    >
      {/* Header */}
      <div className="px-5 py-3.5 bg-zinc-900 border-b border-white/10 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-[10px] font-black uppercase tracking-widest ${meta.accentText}`}>
            {meta.icon} {meta.title} · {rankName.toUpperCase()}
          </div>
          <h3 className="text-sm font-black text-white truncate">
            {stationLabel || venueName} — {venueName}
          </h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs font-black tabular-nums">
            SHIFT EARNED: +${sessionCashEarned.toLocaleString()}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-black cursor-pointer"
          >
            Clock Out [ESC]
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col gap-4">
        {phase === 'working' && currentTask ? (
          <>
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded ${meta.accentBg} ${meta.accentText} font-black text-[10px]`}>
                  {currentTask.category}
                </span>
                <span className="text-zinc-400 font-bold">
                  Task {stepIdx + 1} / {tasks.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-300 font-black">✓ {correctCount}</span>
                {streak >= 2 && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-black">
                    🔥 {streak}x STREAK
                  </span>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-200"
                style={{ width: `${((stepIdx + 1) / tasks.length) * 100}%` }}
              />
            </div>

            {/* Task Card */}
            <div className="bg-zinc-900/90 border border-white/10 rounded-xl p-4 flex flex-col gap-1.5">
              <div className="text-sm font-black text-white leading-snug">{currentTask.prompt}</div>
              <div className="text-xs text-zinc-300">{currentTask.detail}</div>
            </div>

            {/* Interactive Skill Mode 1: Timing Gauge */}
            {taskMode === 'timing_gauge' && (
              <div className="flex flex-col gap-3 p-4 rounded-xl bg-zinc-900 border border-emerald-400/35">
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-zinc-400">
                  <span>{currentTask.gaugeLabel || 'PRECISION TARGET'}</span>
                  <span className="text-emerald-300">PRESS [SPACE] IN GREEN ZONE</span>
                </div>
                <div className="relative h-8 bg-black rounded-lg border border-white/15 overflow-hidden">
                  <div
                    className="absolute top-0 bottom-0 bg-emerald-500/45 border-x-2 border-emerald-300"
                    style={{
                      left: `${(currentTask.gaugeTargetCenter ?? 50) - (currentTask.gaugeTargetWidth ?? 18) * 0.5}%`,
                      width: `${currentTask.gaugeTargetWidth ?? 18}%`,
                    }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-1.5 bg-white shadow-[0_0_12px_#ffffff]"
                    style={{ left: `calc(${gaugePos}% - 3px)` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleLockGauge}
                  className="w-full py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-black text-xs uppercase tracking-wider cursor-pointer"
                >
                  🎯 Lock Target Now [SPACE]
                </button>
              </div>
            )}

            {/* Interactive Skill Mode 2: Dual Balance */}
            {taskMode === 'dual_balance' && currentTask.balanceParamA && currentTask.balanceParamB && (
              <div className="flex flex-col gap-3 p-4 rounded-xl bg-zinc-900 border border-sky-400/35">
                {[
                  { spec: currentTask.balanceParamA, val: balA, setVal: setBalA },
                  { spec: currentTask.balanceParamB, val: balB, setVal: setBalB },
                ].map((ch, idx) => {
                  const isMatched = ch.val === ch.spec.target;
                  return (
                    <div key={idx} className="flex items-center justify-between gap-3 bg-black/40 p-2.5 rounded-lg border border-white/10">
                      <div>
                        <div className="text-xs font-black text-white">{ch.spec.label}</div>
                        <div className="text-[10px] text-zinc-400">
                          Target: <strong className="text-sky-300">{ch.spec.target}{ch.spec.unit}</strong>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => ch.setVal((v) => v - 1)}
                          className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-black cursor-pointer"
                        >
                          -
                        </button>
                        <span
                          className={`min-w-[68px] text-center text-sm font-black tabular-nums ${
                            isMatched ? 'text-emerald-300' : 'text-amber-300'
                          }`}
                        >
                          {ch.val}{ch.spec.unit}
                        </span>
                        <button
                          type="button"
                          onClick={() => ch.setVal((v) => v + 1)}
                          className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-black cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={handleConfirmBalance}
                  className="w-full py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-black font-black text-xs uppercase tracking-wider cursor-pointer"
                >
                  ✓ Apply Calibration [ENTER]
                </button>
              </div>
            )}

            {/* Interactive Skill Mode 3: Code Sequence */}
            {taskMode === 'code_sequence' && (
              <div className="flex flex-col gap-3 p-4 rounded-xl bg-zinc-900 border border-indigo-400/35">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {(currentTask.sequenceTarget || []).map((tok, idx) => {
                    const done = idx < seqEntered.length;
                    return (
                      <span
                        key={idx}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black border ${
                          done
                            ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300'
                            : idx === seqEntered.length
                            ? 'bg-indigo-500/30 border-indigo-300 text-white animate-pulse'
                            : 'bg-black/40 border-white/15 text-zinc-400'
                        }`}
                      >
                        {tok}
                      </span>
                    );
                  })}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {uniqueSeqTokens.map((tok) => (
                    <button
                      key={tok}
                      type="button"
                      onClick={() => handlePressSequenceToken(tok)}
                      className="py-2.5 rounded-xl bg-zinc-800 hover:bg-indigo-500 text-white font-black text-xs border border-white/15 cursor-pointer transition-colors"
                    >
                      {tok}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Standard Decision Mode */}
            {taskMode === 'choice' && (
              <div className="grid grid-cols-1 gap-2.5">
                {currentTask.options.map((opt, idx) => (
                  <button
                    key={`${stepIdx}_${idx}`}
                    type="button"
                    onClick={() => handleChoose(idx)}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 hover:border-sky-400 text-left flex items-center justify-between gap-3 transition-all cursor-pointer group"
                  >
                    <span className="text-xs font-black text-white group-hover:text-sky-200">{opt}</span>
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px] font-black shrink-0">
                      [{idx + 1}]
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="min-h-[22px] text-center text-xs font-black">
              {lastFeedback ? (
                <span className={lastFeedback.ok ? 'text-emerald-300' : 'text-rose-400'}>
                  {lastFeedback.text}
                </span>
              ) : (
                <span className="text-zinc-500">
                  {taskMode === 'timing_gauge'
                    ? 'Hit [SPACE] or click Lock Target inside the green bar'
                    : taskMode === 'dual_balance'
                    ? 'Match both readings to their targets, then click Apply'
                    : taskMode === 'code_sequence'
                    ? 'Click the sequence tokens from left to right'
                    : 'Click an action or press [1], [2], [3] to complete task'}
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="py-3 flex flex-col items-center text-center gap-4">
            <div className="text-4xl">{meta.icon}</div>
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-emerald-400">
                SHIFT SPRINT COMPLETE · +1 JOB COMPLETED
              </div>
              <h4 className="text-xl font-black text-white mt-1">
                +${lastPayout.toLocaleString()} Direct Deposit!
              </h4>
              <p className="text-xs text-zinc-400 mt-1">
                Accuracy: {correctCount}/{tasks.length} · Best Streak: {bestStreak}x · Next Rank:{' '}
                <span className="text-amber-300 font-black">
                  {meta.ranks[Math.min(meta.ranks.length - 1, shiftsCompletedSession)]}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 w-full">
              <button
                type="button"
                onClick={startNextShift}
                className="px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg"
              >
                💼 Work Another Shift (+Rank Bonus) [ENTER]
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-black text-xs uppercase tracking-wider cursor-pointer border border-white/10"
              >
                🚪 Clock Out & Return [ESC]
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MODAL SWITCHER
// ============================================================================
export const InteriorMiniGameModal: React.FC<InteriorMiniGameModalProps> = ({
  kind,
  venueName,
  stationLabel,
  isHomeVenue = false,
  onAwardCash,
  onCompleteWorkShift,
  onClose,
}) => {
  const awardRef = useRef({ onAwardCash, onCompleteWorkShift, isHomeVenue });
  awardRef.current = { onAwardCash, onCompleteWorkShift, isHomeVenue };

  const handleAward = useCallback((delta: number, label: string) => {
    const { onAwardCash: awardCb, isHomeVenue: home } = awardRef.current;
    const finalDelta = home ? Math.max(50, Math.round(delta * 0.45)) : delta;
    const finalLabel = home ? `${label} (Home High Score)` : label;
    awardCb(finalDelta, finalLabel);
  }, []);

  const handleWorkShift = useCallback((delta: number, label: string) => {
    const { onCompleteWorkShift: shiftCb, onAwardCash: awardCb } = awardRef.current;
    if (shiftCb) {
      shiftCb(delta, label);
    } else {
      awardCb(delta, label);
    }
  }, []);

  return (
    <div className="absolute inset-0 z-30 bg-black/82 backdrop-blur-sm flex items-center justify-center p-4">
      {isWorkplaceShiftKind(kind) && (
        <WorkplaceShiftMiniGame
          kind={kind}
          venueName={venueName}
          stationLabel={stationLabel}
          onCompleteShift={handleWorkShift}
          onClose={onClose}
        />
      )}
      {kind === 'pool_8ball' && (
        <PoolMiniGame venueName={venueName} onAwardCash={handleAward} onClose={onClose} />
      )}
      {kind === 'arcade' && (
        <ArcadeMiniGame venueName={venueName} onAwardCash={handleAward} onClose={onClose} />
      )}
      {kind === 'skeeball' && (
        <SkeeBallMiniGame venueName={venueName} onAwardCash={handleAward} onClose={onClose} />
      )}
      {kind === 'air_hockey' && (
        <AirHockeyMiniGame venueName={venueName} onAwardCash={handleAward} onClose={onClose} />
      )}
      {kind === 'claw_machine' && (
        <ClawMachineMiniGame venueName={venueName} onAwardCash={handleAward} onClose={onClose} />
      )}
      {kind === 'whack_a_bot' && (
        <WhackABotMiniGame venueName={venueName} onAwardCash={handleAward} onClose={onClose} />
      )}
      {kind === 'pop_a_shot' && (
        <PopAShotMiniGame venueName={venueName} onAwardCash={handleAward} onClose={onClose} />
      )}
      {kind === 'pinball' && (
        <PinballMiniGame venueName={venueName} onAwardCash={handleAward} onClose={onClose} />
      )}
      {kind === 'dance_beat' && (
        <DanceBeatMiniGame venueName={venueName} onAwardCash={handleAward} onClose={onClose} />
      )}
      {kind === 'racing_sim' && (
        <RacingSimMiniGame venueName={venueName} onAwardCash={handleAward} onClose={onClose} />
      )}
      {kind === 'table_tennis' && (
        <TableTennisMiniGame venueName={venueName} onAwardCash={handleAward} onClose={onClose} />
      )}
      {kind === 'punch_bag' && (
        <PunchBagMiniGame venueName={venueName} onAwardCash={handleAward} onClose={onClose} />
      )}
      {kind === 'target_range' && (
        <TargetRangeMiniGame venueName={venueName} onAwardCash={handleAward} onClose={onClose} />
      )}
    </div>
  );
};

// ============================================================================
// OUTDOOR FIELD JOB INTERACTIVE SKILL MODAL (CANVAS ACTION / TIMING / GRID / SEQUENCE)
// ============================================================================
export interface OutdoorFieldJobModalProps {
  job: CityOutdoorJobSpec;
  siteLabel: string;
  skillRankTitle: string;
  payoutMultiplier: number;
  onComplete: (cashEarned: number, tierLabel: string, xpEarned: number) => void;
  onAbort: () => void;
}

export const OutdoorFieldJobModal: React.FC<OutdoorFieldJobModalProps> = ({
  job,
  siteLabel,
  skillRankTitle,
  payoutMultiplier,
  onComplete,
  onAbort,
}) => {
  const [phase, setPhase] = useState<'active' | 'result'>('active');
  const [resultSummary, setResultSummary] = useState<{
    cash: number;
    tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'MASTER';
    xp: number;
    scorePct: number;
    detail: string;
  } | null>(null);

  const finishJob = useCallback(
    (scoreFraction: number, detail: string) => {
      const clamped = Math.max(0, Math.min(1, scoreFraction));
      const tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'MASTER' =
        clamped >= 0.9 ? 'MASTER' : clamped >= 0.72 ? 'GOLD' : clamped >= 0.45 ? 'SILVER' : 'BRONZE';
      const rawPay = job.basePay + job.maxSkillBonus * clamped;
      const finalCash = Math.max(300, Math.round(rawPay * Math.max(1, payoutMultiplier)));
      const finalXp = Math.max(10, Math.round(job.skillXpReward * (0.55 + clamped * 0.75)));
      setResultSummary({
        cash: finalCash,
        tier,
        xp: finalXp,
        scorePct: Math.round(clamped * 100),
        detail,
      });
      setPhase('result');
      playArcadeSfx(587, 987, 0.24, 'triangle', 0.09);
    },
    [job.basePay, job.maxSkillBonus, job.skillXpReward, payoutMultiplier]
  );

  // ---------------- 1) CANVAS ACTION MECHANIC ----------------
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasScore, setCanvasScore] = useState(0);
  const [canvasTimeLeft, setCanvasTimeLeft] = useState(20);
  const keysRef = useRef<Record<string, boolean>>({});
  const pointerPosRef = useRef<{ x: number; y: number } | null>(null);
  const actionTriggerRef = useRef(false);

  useEffect(() => {
    if (phase !== 'active' || job.mechanic !== 'canvas_action') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 640;
    const H = 330;
    let playerX = W * 0.5;
    let playerY = H * 0.65;
    let score = 0;
    let hits = 0;
    let misses = 0;
    let timeLeft = 20.0;
    let lastT = performance.now();
    let rafId = 0;

    interface TargetObj {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      good: boolean;
      value: number;
    }
    const items: TargetObj[] = [];
    const spawnItem = (forceGood = false) => {
      const good = forceGood || Math.random() < 0.74;
      items.push({
        x: 36 + Math.random() * (W - 72),
        y: 36 + Math.random() * (H - 86),
        vx: (Math.random() - 0.5) * (good ? 75 : 105),
        vy: (Math.random() - 0.5) * (good ? 55 : 85),
        r: good ? 17 : 15,
        good,
        value: good && Math.random() < 0.25 ? 200 : 120,
      });
    };
    for (let i = 0; i < 6; i++) spawnItem(i < 4);

    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (e.code === 'Space') {
        e.preventDefault();
        actionTriggerRef.current = true;
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        onAbort();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
      lastT = now;
      timeLeft = Math.max(0, timeLeft - dt);

      // Movement via keys or mouse
      const speed = 310;
      let dx = 0;
      let dy = 0;
      if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) dx -= 1;
      if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) dx += 1;
      if (keysRef.current['ArrowUp'] || keysRef.current['KeyW']) dy -= 1;
      if (keysRef.current['ArrowDown'] || keysRef.current['KeyS']) dy += 1;
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy) || 1;
        playerX += (dx / len) * speed * dt;
        playerY += (dy / len) * speed * dt;
        pointerPosRef.current = null;
      } else if (pointerPosRef.current) {
        playerX += (pointerPosRef.current.x - playerX) * Math.min(1, dt * 14);
        playerY += (pointerPosRef.current.y - playerY) * Math.min(1, dt * 14);
      }
      playerX = Math.max(24, Math.min(W - 24, playerX));
      playerY = Math.max(24, Math.min(H - 24, playerY));

      // Move items & handle proximity / Space action
      const triggerPulse = actionTriggerRef.current;
      actionTriggerRef.current = false;
      const collectRadius = triggerPulse ? 48 : 28;

      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        if (it.x < 24 || it.x > W - 24) it.vx *= -1;
        if (it.y < 24 || it.y > H - 24) it.vy *= -1;

        const d = Math.hypot(it.x - playerX, it.y - playerY);
        if (d <= collectRadius) {
          if (it.good) {
            score += it.value;
            hits += 1;
            playArcadeSfx(620, 880, 0.08, 'triangle', 0.06);
          } else {
            score = Math.max(0, score - 110);
            misses += 1;
            playArcadeSfx(190, 110, 0.12, 'sawtooth', 0.06);
          }
          items.splice(i, 1);
          spawnItem(it.good);
        }
      }
      while (items.filter((x) => x.good).length < 4) spawnItem(true);

      // Draw background theme by kind
      const bgColors: Record<string, string> = {
        harbor_crane: '#0f172a',
        crab_fishing: '#083344',
        wildfire_drop: '#1c1917',
        stadium_turf: '#14532d',
        drone_survey: '#0c4a6e',
      };
      ctx.fillStyle = bgColors[job.kind] || '#0f172a';
      ctx.fillRect(0, 0, W, H);

      // Grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let gx = 40; gx < W; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, H);
        ctx.stroke();
      }
      for (let gy = 40; gy < H; gy += 40) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();
      }

      // Items
      for (const it of items) {
        ctx.beginPath();
        ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2);
        ctx.fillStyle = it.good ? (it.value > 150 ? '#fbbf24' : '#34d399') : '#ef4444';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.fillStyle = '#090d16';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(it.good ? (it.value > 150 ? '★' : '✓') : '✕', it.x, it.y + 0.5);
      }

      // Player Tool Reticle
      ctx.beginPath();
      ctx.arc(playerX, playerY, 24, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#38bdf8';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(job.icon, playerX, playerY + 1);

      setCanvasScore(score);
      setCanvasTimeLeft(Math.ceil(timeLeft));

      if (timeLeft <= 0) {
        const frac = Math.min(1, score / 1600);
        finishJob(frac, `Field Ops Score: ${score} pts · Targets: ${hits} · Hazards Hit: ${misses}`);
        return;
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [finishJob, job.icon, job.kind, job.mechanic, onAbort, phase]);

  // ---------------- 2) TIMING STRIKE MECHANIC ----------------
  const [strikeRound, setStrikeRound] = useState(0);
  const [strikeHits, setStrikeHits] = useState(0);
  const [strikeBarPos, setStrikeBarPos] = useState(50);
  const strikeBarRef = useRef(50);
  const strikeDirRef = useRef(1);
  const [strikeTargetCenter, setStrikeTargetCenter] = useState(52);
  const [strikeFeedback, setStrikeFeedback] = useState<string>('Press [SPACE] or Strike inside green zone!');

  useEffect(() => {
    if (phase !== 'active' || job.mechanic !== 'timing_strike') return;
    let rafId = 0;
    let lastT = performance.now();
    const speed = 118 + strikeRound * 22;
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
      lastT = now;
      let next = strikeBarRef.current + strikeDirRef.current * speed * dt;
      if (next >= 98) {
        next = 98;
        strikeDirRef.current = -1;
      } else if (next <= 2) {
        next = 2;
        strikeDirRef.current = 1;
      }
      strikeBarRef.current = next;
      setStrikeBarPos(next);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [job.mechanic, phase, strikeRound]);

  const handleTriggerTimingStrike = useCallback(() => {
    if (phase !== 'active' || job.mechanic !== 'timing_strike') return;
    const halfW = Math.max(6.5, 11.5 - strikeRound * 1.1);
    const delta = Math.abs(strikeBarRef.current - strikeTargetCenter);
    const hit = delta <= halfW;
    const nextHits = strikeHits + (delta <= halfW * 0.45 ? 1.2 : hit ? 1.0 : 0);
    setStrikeHits(nextHits);
    if (hit) {
      playArcadeSfx(620, 920, 0.1, 'triangle', 0.08);
      setStrikeFeedback(delta <= halfW * 0.45 ? '🌟 PERFECT STRIKE!' : '✓ CLEAN LOCK!');
    } else {
      playArcadeSfx(210, 120, 0.14, 'sawtooth', 0.06);
      setStrikeFeedback('✖ OFF TARGET!');
    }
    if (strikeRound + 1 >= 5) {
      finishJob(Math.min(1, nextHits / 5), `Completed 5 precision field strikes (${nextHits.toFixed(1)}/5.0 rating)`);
    } else {
      setStrikeRound((r) => r + 1);
      setStrikeTargetCenter(25 + Math.floor(Math.random() * 52));
    }
  }, [finishJob, job.mechanic, phase, strikeHits, strikeRound, strikeTargetCenter]);

  // ---------------- 3) WIRE GRID PUZZLE MECHANIC ----------------
  const [gridRound, setGridRound] = useState(0);
  const [gridSuccesses, setGridSuccesses] = useState(0);
  const [gridSwitches, setGridSwitches] = useState<[boolean, boolean, boolean, boolean]>([true, false, true, false]);
  const gridTargets = useRef<Array<{ weights: [number, number, number, number]; targetVolts: number }>>([
    { weights: [120, 80, 40, 240], targetVolts: 320 },
    { weights: [150, 90, 60, 180], targetVolts: 330 },
    { weights: [220, 110, 55, 165], targetVolts: 385 },
  ]).current;

  const currentGridSpec = gridTargets[gridRound % gridTargets.length];
  const currentGridSum = gridSwitches.reduce(
    (sum, on, idx) => (on ? sum + currentGridSpec.weights[idx] : sum),
    0
  );

  const handleLockWireGrid = useCallback(() => {
    if (phase !== 'active' || job.mechanic !== 'wire_grid') return;
    const ok = currentGridSum === currentGridSpec.targetVolts;
    const nextOk = gridSuccesses + (ok ? 1 : 0);
    setGridSuccesses(nextOk);
    if (ok) {
      playArcadeSfx(580, 860, 0.12, 'triangle', 0.08);
    } else {
      playArcadeSfx(220, 130, 0.14, 'sawtooth', 0.06);
    }
    if (gridRound + 1 >= 3) {
      finishJob(nextOk / 3, `Stabilized ${nextOk}/3 Live High-Voltage Field Buses`);
    } else {
      setGridRound((r) => r + 1);
      setGridSwitches([false, false, false, false]);
    }
  }, [currentGridSpec.targetVolts, currentGridSum, finishJob, gridRound, gridSuccesses, job.mechanic, phase]);

  // ---------------- 4) SEQUENCE CALIBRATION MECHANIC ----------------
  const [calRound, setCalRound] = useState(0);
  const [calCorrectRounds, setCalCorrectRounds] = useState(0);
  const [calTargetSeq, setCalTargetSeq] = useState<string[]>(() => ['UP', 'LEFT', 'RIGHT', 'DOWN']);
  const [calInputSeq, setCalInputSeq] = useState<string[]>([]);

  const calSymbols: Record<string, string> = {
    UP: '⬆️ UP',
    DOWN: '⬇️ DOWN',
    LEFT: '⬅️ LEFT',
    RIGHT: '➡️ RIGHT',
  };

  const handleCalPress = useCallback(
    (dir: string) => {
      if (phase !== 'active' || job.mechanic !== 'sequence_cal') return;
      const idx = calInputSeq.length;
      const expected = calTargetSeq[idx];
      if (dir !== expected) {
        playArcadeSfx(210, 120, 0.14, 'sawtooth', 0.06);
        if (calRound + 1 >= 4) {
          finishJob(calCorrectRounds / 4, `Completed ${calCorrectRounds}/4 calibration sequences cleanly`);
        } else {
          setCalRound((r) => r + 1);
          const dirs = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
          setCalTargetSeq(Array.from({ length: 4 }, () => dirs[Math.floor(Math.random() * 4)]));
          setCalInputSeq([]);
        }
        return;
      }
      playArcadeSfx(560 + idx * 75, 760 + idx * 75, 0.08, 'triangle', 0.07);
      const next = [...calInputSeq, dir];
      setCalInputSeq(next);
      if (next.length >= calTargetSeq.length) {
        const nextWins = calCorrectRounds + 1;
        setCalCorrectRounds(nextWins);
        if (calRound + 1 >= 4) {
          finishJob(nextWins / 4, `Completed ${nextWins}/4 calibration sequences cleanly`);
        } else {
          setCalRound((r) => r + 1);
          const dirs = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
          setCalTargetSeq(Array.from({ length: 4 }, () => dirs[Math.floor(Math.random() * 4)]));
          setCalInputSeq([]);
        }
      }
    },
    [calCorrectRounds, calInputSeq, calRound, calTargetSeq, finishJob, job.mechanic, phase]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (phase === 'result' && resultSummary) {
          onComplete(resultSummary.cash, resultSummary.tier, resultSummary.xp);
        } else {
          onAbort();
        }
        return;
      }
      if (phase === 'active') {
        if (job.mechanic === 'timing_strike' && (e.key === ' ' || e.key === 'Enter')) {
          e.preventDefault();
          handleTriggerTimingStrike();
        } else if (job.mechanic === 'sequence_cal') {
          if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
            e.preventDefault();
            handleCalPress('UP');
          } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
            e.preventDefault();
            handleCalPress('DOWN');
          } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            e.preventDefault();
            handleCalPress('LEFT');
          } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            e.preventDefault();
            handleCalPress('RIGHT');
          }
        }
      } else if (phase === 'result' && resultSummary && e.key === 'Enter') {
        e.preventDefault();
        onComplete(resultSummary.cash, resultSummary.tier, resultSummary.xp);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleCalPress, handleTriggerTimingStrike, job.mechanic, onAbort, onComplete, phase, resultSummary]);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 font-mono">
      <div className="w-full max-w-2xl bg-zinc-950 border-2 border-emerald-400/70 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 bg-zinc-900 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
              {job.icon} OUTDOOR FIELD CONTRACT · {job.mechanicLabel.toUpperCase()}
            </div>
            <h3 className="text-sm font-black text-white truncate">
              {job.title} — {siteLabel}
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-black">
              {skillRankTitle} (x{payoutMultiplier.toFixed(2)})
            </span>
            <button
              type="button"
              onClick={onAbort}
              className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-black cursor-pointer"
            >
              Exit [ESC]
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          {phase === 'active' ? (
            <>
              {job.mechanic === 'canvas_action' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="text-emerald-300">FIELD SCORE: {canvasScore} PTS</span>
                    <span className="text-zinc-400">WASD/Arrows or Drag Mouse · [SPACE] Pulse</span>
                    <span className={canvasTimeLeft <= 5 ? 'text-rose-400 animate-pulse' : 'text-cyan-300'}>
                      ⏱️ {canvasTimeLeft}s
                    </span>
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={330}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      pointerPosRef.current = {
                        x: ((e.clientX - rect.left) / rect.width) * 640,
                        y: ((e.clientY - rect.top) / rect.height) * 330,
                      };
                    }}
                    onClick={() => {
                      actionTriggerRef.current = true;
                    }}
                    className="w-full h-auto rounded-xl border border-white/15 cursor-crosshair bg-zinc-900"
                  />
                  <div className="text-[11px] text-zinc-400 text-center">
                    Collect green ✓ and gold ★ field targets · Avoid red ✕ hazards!
                  </div>
                </div>
              )}

              {job.mechanic === 'timing_strike' && (
                <div className="flex flex-col gap-4 p-4 rounded-xl bg-zinc-900 border border-amber-400/40">
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="text-amber-300">STAGE {strikeRound + 1} / 5</span>
                    <span className="text-emerald-300">RATING: {strikeHits.toFixed(1)} / 5.0</span>
                  </div>
                  <div className="relative h-10 bg-black rounded-xl border border-white/15 overflow-hidden">
                    <div
                      className="absolute top-0 bottom-0 bg-emerald-500/45 border-x-2 border-emerald-300"
                      style={{
                        left: `${strikeTargetCenter - Math.max(6.5, 11.5 - strikeRound * 1.1)}%`,
                        width: `${Math.max(6.5, 11.5 - strikeRound * 1.1) * 2}%`,
                      }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-2 bg-white shadow-[0_0_12px_#ffffff]"
                      style={{ left: `calc(${strikeBarPos}% - 4px)` }}
                    />
                  </div>
                  <div className="text-center text-xs font-black text-sky-300">{strikeFeedback}</div>
                  <button
                    type="button"
                    onClick={handleTriggerTimingStrike}
                    className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs uppercase tracking-wider cursor-pointer"
                  >
                    ⚡ EXECUTE FIELD STRIKE [SPACE]
                  </button>
                </div>
              )}

              {job.mechanic === 'wire_grid' && (
                <div className="flex flex-col gap-4 p-4 rounded-xl bg-zinc-900 border border-yellow-400/40">
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="text-yellow-300">BUS PANEL {gridRound + 1} / 3</span>
                    <span className="text-emerald-300">STABILIZED: {gridSuccesses}</span>
                  </div>
                  <div className="bg-black/50 p-3 rounded-xl border border-white/10 flex items-center justify-between">
                    <span className="text-xs text-zinc-300">Target Bus Load:</span>
                    <span className="text-base font-black text-sky-300">{currentGridSpec.targetVolts}V</span>
                    <span className="text-xs text-zinc-300">Current Output:</span>
                    <span
                      className={`text-base font-black ${
                        currentGridSum === currentGridSpec.targetVolts ? 'text-emerald-300' : 'text-amber-300'
                      }`}
                    >
                      {currentGridSum}V
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {currentGridSpec.weights.map((w, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          setGridSwitches((prev) => {
                            const copy: [boolean, boolean, boolean, boolean] = [...prev] as [boolean, boolean, boolean, boolean];
                            copy[idx] = !copy[idx];
                            return copy;
                          })
                        }
                        className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                          gridSwitches[idx]
                            ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                            : 'bg-zinc-950 border-white/15 text-zinc-400 hover:border-white/30'
                        }`}
                      >
                        <div className="text-[10px] font-black">BREAKER {idx + 1}</div>
                        <div className="text-base font-black mt-1">+{w}V</div>
                        <div className="text-[10px] mt-1 font-bold">{gridSwitches[idx] ? '● CLOSED' : '○ OPEN'}</div>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleLockWireGrid}
                    className="w-full py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs uppercase tracking-wider cursor-pointer"
                  >
                    ⚡ ENERGIZE & VERIFY GRID
                  </button>
                </div>
              )}

              {job.mechanic === 'sequence_cal' && (
                <div className="flex flex-col gap-4 p-4 rounded-xl bg-zinc-900 border border-sky-400/40">
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="text-sky-300">SEQUENCE {calRound + 1} / 4</span>
                    <span className="text-emerald-300">CLEARED: {calCorrectRounds}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {calTargetSeq.map((dir, idx) => (
                      <span
                        key={idx}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black border ${
                          idx < calInputSeq.length
                            ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300'
                            : idx === calInputSeq.length
                            ? 'bg-sky-500/30 border-sky-300 text-white animate-pulse'
                            : 'bg-black/40 border-white/15 text-zinc-400'
                        }`}
                      >
                        {calSymbols[dir]}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['LEFT', 'UP', 'DOWN', 'RIGHT'] as const).map((dir) => (
                      <button
                        key={dir}
                        type="button"
                        onClick={() => handleCalPress(dir)}
                        className="py-3 rounded-xl bg-zinc-800 hover:bg-sky-500 text-white font-black text-xs border border-white/15 cursor-pointer"
                      >
                        {calSymbols[dir]}
                      </button>
                    ))}
                  </div>
                  <div className="text-[11px] text-zinc-400 text-center">
                    Match each command from left to right using buttons or Arrow / WASD keys!
                  </div>
                </div>
              )}
            </>
          ) : resultSummary ? (
            <div className="py-4 flex flex-col items-center text-center gap-4">
              <div className="text-4xl">{job.icon}</div>
              <div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-xs font-black uppercase">
                  🏆 {resultSummary.tier} FIELD PERFORMANCE ({resultSummary.scorePct}%)
                </span>
                <h4 className="text-2xl font-black text-white mt-2">
                  +${resultSummary.cash.toLocaleString()} Earned · +{resultSummary.xp} Skill XP!
                </h4>
                <p className="text-xs text-zinc-400 mt-1">{resultSummary.detail}</p>
              </div>
              <button
                type="button"
                onClick={() => onComplete(resultSummary.cash, resultSummary.tier, resultSummary.xp)}
                className="px-6 py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg"
              >
                💵 Collect Payout & Return [ENTER]
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
