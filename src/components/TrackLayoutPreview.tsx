import React, { useMemo } from 'react';
import { CircuitInfo } from '../types/racing';

interface TrackLayoutPreviewProps {
  circuit: CircuitInfo;
  width?: number | string;
  height?: number | string;
  strokeColor?: string;
  strokeWidth?: number;
  showStartFinish?: boolean;
  showDirection?: boolean;
  showTurnLabels?: boolean;
  className?: string;
}

export const TrackLayoutPreview: React.FC<TrackLayoutPreviewProps> = ({
  circuit,
  width = '100%',
  height = 140,
  strokeColor = '#ef4444',
  strokeWidth = 3,
  showStartFinish = true,
  showDirection = true,
  showTurnLabels = false,
  className = '',
}) => {
  const { pathData, startPoint, nextPoint, turnPoints, viewBox } = useMemo(() => {
    const pts = circuit.trackPoints;
    if (!pts || pts.length < 3) {
      return { pathData: '', startPoint: null, nextPoint: null, turnPoints: [], viewBox: '0 0 200 140' };
    }

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

    const pad = 24;
    const baseW = 240;
    const baseH = 160;
    const availW = baseW - pad * 2;
    const availH = baseH - pad * 2;
    const scale = Math.min(availW, availH) / maxRange;

    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    const mapped = pts.map((p) => ({
      x: baseW / 2 + (p.x - centerX) * scale,
      y: baseH / 2 + (p.z - centerZ) * scale,
    }));

    // Generate smooth SVG Catmull-Rom path
    let d = `M ${mapped[0].x.toFixed(1)} ${mapped[0].y.toFixed(1)}`;
    const n = mapped.length;
    for (let i = 0; i < n; i++) {
      const p0 = mapped[(i - 1 + n) % n];
      const p1 = mapped[i];
      const p2 = mapped[(i + 1) % n];
      const p3 = mapped[(i + 2) % n];

      // Standard cubic Bezier approximation of Catmull-Rom spline
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    d += ' Z';

    // Key turn points for markers
    const turns = mapped.filter((_, idx) => idx % Math.max(1, Math.floor(mapped.length / Math.min(8, circuit.turns))) === 0);

    return {
      pathData: d,
      startPoint: mapped[0],
      nextPoint: mapped[1],
      turnPoints: turns,
      viewBox: `0 0 ${baseW} ${baseH}`,
    };
  }, [circuit]);

  if (!pathData || !startPoint) {
    return (
      <div className={`flex items-center justify-center text-neutral-600 text-xs font-mono ${className}`}>
        No Track Shape
      </div>
    );
  }

  // Calculate start finish line perpendicular tick
  const dx = nextPoint ? nextPoint.x - startPoint.x : 1;
  const dy = nextPoint ? nextPoint.y - startPoint.y : 0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  const px = -ny * 7;
  const py = nx * 7;

  return (
    <div className={`relative overflow-hidden flex items-center justify-center ${className}`}>
      <svg
        viewBox={viewBox}
        className="w-full h-full drop-shadow-md select-none pointer-events-none"
        style={{ maxWidth: typeof width === 'number' ? `${width}px` : width, maxHeight: typeof height === 'number' ? `${height}px` : height }}
      >
        <defs>
          <linearGradient id={`trackGlow-${circuit.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.4" />
          </linearGradient>
          <filter id={`blur-${circuit.id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient track glow */}
        <path
          d={pathData}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth + 5}
          strokeOpacity="0.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Outer track border */}
        <path
          d={pathData}
          fill="none"
          stroke="#000000"
          strokeWidth={strokeWidth + 2.5}
          strokeOpacity="0.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Core track ribbon */}
        <path
          d={pathData}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Start / Finish line bar */}
        {showStartFinish && (
          <g>
            <line
              x1={startPoint.x - px}
              y1={startPoint.y - py}
              x2={startPoint.x + px}
              y2={startPoint.y + py}
              stroke="#ffffff"
              strokeWidth={3}
              strokeLinecap="square"
            />
            <circle cx={startPoint.x} cy={startPoint.y} r={3} fill="#ffffff" />
          </g>
        )}

        {/* Direction Indicator Chevron */}
        {showDirection && nextPoint && (
          <polygon
            points={`
              ${startPoint.x + nx * 14},${startPoint.y + ny * 14}
              ${startPoint.x + nx * 5 + px * 0.6},${startPoint.y + ny * 5 + py * 0.6}
              ${startPoint.x + nx * 7},${startPoint.y + ny * 7}
              ${startPoint.x + nx * 5 - px * 0.6},${startPoint.y + ny * 5 - py * 0.6}
            `}
            fill="#fbbf24"
          />
        )}

        {/* Corner Apex dots */}
        {showTurnLabels && turnPoints.map((pt, i) => (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r={2.5} fill="#ffffff" opacity={0.7} />
          </g>
        ))}
      </svg>
    </div>
  );
};
