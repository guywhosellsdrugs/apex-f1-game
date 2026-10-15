import React, { useRef, useEffect } from 'react';
import { CircuitInfo, CarRadarPoint } from '../types/racing';

interface TrackMiniMapProps {
  circuit: CircuitInfo;
  carsRadar: CarRadarPoint[];
}

export const TrackMiniMap: React.FC<TrackMiniMapProps> = ({ circuit, carsRadar }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Pre-calculate normalized 2D track contour
  const normalizedPoints = React.useMemo(() => {
    const pts = circuit.trackPoints;
    if (!pts || pts.length === 0) return [];

    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    pts.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    });

    const rangeX = Math.max(1, maxX - minX);
    const rangeZ = Math.max(1, maxZ - minZ);
    const maxRange = Math.max(rangeX, rangeZ);

    const padding = 22;
    const size = 190;
    const scale = (size - padding * 2) / maxRange;

    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    return pts.map((p) => ({
      x: size / 2 + (p.x - centerX) * scale,
      y: size / 2 + (p.z - centerZ) * scale,
    }));
  }, [circuit]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || normalizedPoints.length < 3) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // 1. Circuit Contour
    ctx.beginPath();
    ctx.moveTo(normalizedPoints[0].x, normalizedPoints[0].y);
    for (let i = 1; i < normalizedPoints.length; i++) {
      ctx.lineTo(normalizedPoints[i].x, normalizedPoints[i].y);
    }
    ctx.closePath();

    // Subtle outer halo
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Crisp white circuit line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 3.2;
    ctx.stroke();

    // Directional flow chevrons along the track line ("easy to tell which way r supposed to go")
    const numArrows = 7;
    for (let a = 0; a < numArrows; a++) {
      const frac = (a + 0.35) / numArrows;
      const count = normalizedPoints.length;
      const idx = Math.floor(frac * count) % count;
      const nextIdx = (idx + 1) % count;
      const p1 = normalizedPoints[idx];
      const p2 = normalizedPoints[nextIdx];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      if (len > 0.001) {
        const nx = dx / len;
        const ny = dy / len;
        const perpX = -ny;
        const perpY = nx;
        const midX = (p1.x + p2.x) * 0.5;
        const midY = (p1.y + p2.y) * 0.5;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(midX + nx * 4.5, midY + ny * 4.5);
        ctx.lineTo(midX - nx * 3.5 + perpX * 3.2, midY - ny * 3.5 + perpY * 3.2);
        ctx.lineTo(midX - nx * 1.5, midY - ny * 1.5);
        ctx.lineTo(midX - nx * 3.5 - perpX * 3.2, midY - ny * 3.5 - perpY * 3.2);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 2. Start / Finish Line marker
    if (normalizedPoints.length > 0) {
      const startPt = normalizedPoints[0];
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(startPt.x, startPt.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Render Cars
    const getPosFromProgress = (progress: number) => {
      const pClamped = ((progress % 1) + 1) % 1;
      const count = normalizedPoints.length;
      const exactIdx = pClamped * count;
      const idx = Math.floor(exactIdx) % count;
      const nextIdx = (idx + 1) % count;
      const frac = exactIdx - Math.floor(exactIdx);

      const p1 = normalizedPoints[idx];
      const p2 = normalizedPoints[nextIdx];

      return {
        x: p1.x + (p2.x - p1.x) * frac,
        y: p1.y + (p2.y - p1.y) * frac,
      };
    };

    // Draw AI cars first (with special highlight for Teammate)
    for (const car of carsRadar) {
      if (car.isPlayer) continue;

      const pos = getPosFromProgress(car.progress);
      if (car.isTeammate) {
        // Glowing double emerald beacon for teammate
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 8.0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5.5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 3.8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = car.color || '#00e5ff';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw Player Car with prominent glowing golden ping
    const playerCar = carsRadar.find((c) => c.isPlayer);
    if (playerCar) {
      const pos = getPosFromProgress(playerCar.progress);

      // Pulse ring
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 7.5, 0, Math.PI * 2);
      ctx.stroke();

      // Core dot
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [normalizedPoints, carsRadar]);

  return (
    <div className="relative flex flex-col items-center bg-neutral-950/80 backdrop-blur-md rounded-xl p-2.5 border border-white/10 shadow-2xl">
      <div className="w-full flex items-center justify-between px-1 mb-1 text-[10px] uppercase font-bold tracking-wider text-neutral-400">
        <span className="truncate max-w-[120px]">{circuit.name}</span>
        <span className="text-red-400 font-mono">S/F</span>
      </div>
      <canvas ref={canvasRef} width={190} height={190} className="w-[170px] h-[170px]" />
      <div className="w-full flex items-center justify-between px-1 mt-1 text-[9px] font-bold text-neutral-400">
        <span className="flex items-center gap-1 text-amber-300">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> You
        </span>
        <span className="flex items-center gap-1 text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" /> Teammate
        </span>
        <span className="flex items-center gap-1 text-neutral-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Rivals
        </span>
      </div>
    </div>
  );
};
