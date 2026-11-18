import * as THREE from 'three';

function hash2D(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise2D(x: number, y: number, period: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  const x0 = ((xi % period) + period) % period;
  const y0 = ((yi % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;

  const a = hash2D(x0, y0);
  const b = hash2D(x1, y0);
  const c = hash2D(x0, y1);
  const d = hash2D(x1, y1);

  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

function fbmTileable(u: number, v: number, baseFreq: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = baseFreq;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise2D(u * freq, v * freq, Math.max(2, Math.round(freq)));
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return norm > 0 ? sum / norm : 0;
}

function buildNormalDataTextureFromHeight(
  size: number,
  heights: Float32Array,
  strength: number
): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;

      const hL = heights[y * size + xm];
      const hR = heights[y * size + xp];
      const hD = heights[ym * size + x];
      const hU = heights[yp * size + x];

      const dx = (hL - hR) * strength;
      const dy = (hD - hU) * strength;
      const dz = 1.0;
      const invLen = 1 / Math.hypot(dx, dy, dz);

      const idx = (y * size + x) * 4;
      data[idx] = Math.max(0, Math.min(255, Math.round((dx * invLen * 0.5 + 0.5) * 255)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round((dy * invLen * 0.5 + 0.5) * 255)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round((dz * invLen * 0.5 + 0.5) * 255)));
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export interface AsphaltPBRSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
}

const cachedAsphaltSets = new Map<string, AsphaltPBRSet>();
export function getAsphaltPBRTextures(isRetroPixel: boolean, anisotropy: number): AsphaltPBRSet {
  const key = `${isRetroPixel ? 'r' : 'p'}_${anisotropy}`;
  const existing = cachedAsphaltSets.get(key);
  if (existing) return existing;

  const size = isRetroPixel ? 128 : 512;
  const hMap = new Float32Array(size * size);
  const roughData = new Uint8Array(size * size * 4);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx ? ctx.createImageData(size, size) : null;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      const pIdx = idx * 4;

      const macro = fbmTileable(u, v, 4, 3);
      const med = fbmTileable(u, v, 16, 2);
      const grain = hash2D(x * 1.13, y * 1.71);
      const stone = grain > 0.88 ? (grain - 0.88) * 3.5 : grain * 0.35;

      // Realistic twin tire-wear polish lanes along U (~0.27 & ~0.73)
      const laneA = Math.exp(-Math.pow((u - 0.27) / 0.11, 2));
      const laneB = Math.exp(-Math.pow((u - 0.73) / 0.11, 2));
      const centerCrown = Math.exp(-Math.pow((u - 0.5) / 0.06, 2));
      const tirePolish = Math.min(1, laneA + laneB);

      // Subtle hairline tar seam along V with slight organic wander
      const seamOffset = Math.sin(v * Math.PI * 4) * 0.015 + Math.cos(v * Math.PI * 10) * 0.005;
      const tarDist = Math.abs(u - (0.48 + seamOffset));
      const tarCrack = tarDist < 0.006 ? (1 - tarDist / 0.006) : 0;

      const hVal = macro * 0.25 + med * 0.32 + stone * 0.43 - tirePolish * 0.14 - tarCrack * 0.22;
      hMap[idx] = hVal;

      // Albedo: deep weathered charcoal-slate aggregate
      let lum = 38 + macro * 13 + med * 9 + (stone - 0.18) * 26 - tirePolish * 7 - centerCrown * 3;
      if (tarCrack > 0.05) {
        lum = lum * (1 - tarCrack * 0.55) + 12 * tarCrack * 0.55;
      }
      const r = Math.max(10, Math.min(92, Math.round(lum * 0.97)));
      const g = Math.max(11, Math.min(94, Math.round(lum * 1.0)));
      const b = Math.max(14, Math.min(100, Math.round(lum * 1.06)));

      if (img) {
        img.data[pIdx] = r;
        img.data[pIdx + 1] = g;
        img.data[pIdx + 2] = b;
        img.data[pIdx + 3] = 255;
      }

      // Roughness: tire polish tracks smoother (~0.56), shoulders & rough aggregate (~0.94), tar seams slightly glossy (~0.45)
      const roughNorm = Math.max(
        0.38,
        Math.min(0.98, 0.88 - tirePolish * 0.26 - tarCrack * 0.35 + (grain - 0.5) * 0.12 + (macro - 0.5) * 0.08)
      );
      const rByte = Math.round(roughNorm * 255);
      roughData[pIdx] = rByte;
      roughData[pIdx + 1] = rByte;
      roughData[pIdx + 2] = rByte;
      roughData[pIdx + 3] = 255;
    }
  }

  if (ctx && img) ctx.putImageData(img, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(4, 48);
  map.anisotropy = anisotropy;
  if (isRetroPixel) {
    map.minFilter = THREE.NearestFilter;
    map.magFilter = THREE.NearestFilter;
  }

  const normalMap = buildNormalDataTextureFromHeight(size, hMap, isRetroPixel ? 1.0 : 2.3);
  normalMap.repeat.set(4, 48);
  normalMap.anisotropy = anisotropy;

  const roughnessMap = new THREE.DataTexture(roughData, size, size, THREE.RGBAFormat);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(4, 48);
  roughnessMap.anisotropy = anisotropy;
  roughnessMap.needsUpdate = true;

  const set: AsphaltPBRSet = { map, normalMap, roughnessMap };
  cachedAsphaltSets.set(key, set);
  return set;
}

export interface TerrainPBRSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.DataTexture;
}

const cachedTerrainSets = new Map<string, TerrainPBRSet>();
export function getTerrainPBRTextures(isRetroPixel: boolean, anisotropy: number): TerrainPBRSet {
  const key = `${isRetroPixel ? 'r' : 'p'}_${anisotropy}`;
  const existing = cachedTerrainSets.get(key);
  if (existing) return existing;

  const size = isRetroPixel ? 128 : 512;
  const hMap = new Float32Array(size * size);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx ? ctx.createImageData(size, size) : null;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      const macro = fbmTileable(u, v, 5, 3);
      const blade = fbmTileable(u, v, 24, 2);
      const micro = hash2D(x * 0.91, y * 1.37);

      const dryPatch = Math.max(0, macro - 0.62) * 2.2;
      hMap[idx] = macro * 0.35 + blade * 0.4 + micro * 0.25;

      // Rich natural Maryland Piedmont meadow tones (never neon toy green)
      const r = Math.round(38 + macro * 26 + blade * 10 + dryPatch * 28 + micro * 8);
      const g = Math.round(64 + macro * 30 + blade * 16 + dryPatch * 10 + micro * 9);
      const b = Math.round(31 + macro * 14 + blade * 8 + dryPatch * 8 + micro * 5);

      if (img) {
        const p = idx * 4;
        img.data[p] = Math.max(16, Math.min(135, r));
        img.data[p + 1] = Math.max(30, Math.min(150, g));
        img.data[p + 2] = Math.max(14, Math.min(95, b));
        img.data[p + 3] = 255;
      }
    }
  }
  if (ctx && img) ctx.putImageData(img, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(95, 95);
  map.anisotropy = anisotropy;
  if (isRetroPixel) {
    map.minFilter = THREE.NearestFilter;
    map.magFilter = THREE.NearestFilter;
  }

  const normalMap = buildNormalDataTextureFromHeight(size, hMap, isRetroPixel ? 0.8 : 2.1);
  normalMap.repeat.set(95, 95);
  normalMap.anisotropy = anisotropy;

  const set: TerrainPBRSet = { map, normalMap };
  cachedTerrainSets.set(key, set);
  return set;
}

export interface ConcretePBRSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.DataTexture;
}

const cachedConcreteSets = new Map<string, ConcretePBRSet>();
export function getConcretePBRTextures(isRetroPixel: boolean, anisotropy: number): ConcretePBRSet {
  const key = `${isRetroPixel ? 'r' : 'p'}_${anisotropy}`;
  const existing = cachedConcreteSets.get(key);
  if (existing) return existing;

  const size = isRetroPixel ? 64 : 256;
  const hMap = new Float32Array(size * size);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx ? ctx.createImageData(size, size) : null;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      const n = fbmTileable(u, v, 6, 3);
      const grit = hash2D(x * 1.4, y * 1.9);
      // Expansion joint grid every 0.5 UV
      const seamX = Math.min(u % 0.5, 0.5 - (u % 0.5));
      const seamY = Math.min(v % 0.5, 0.5 - (v % 0.5));
      const seam = seamX < 0.014 || seamY < 0.014 ? 1.0 : 0.0;

      hMap[idx] = n * 0.45 + grit * 0.25 - seam * 0.65;
      const base = 150 + (n - 0.5) * 26 + (grit - 0.5) * 14 - seam * 42;
      if (img) {
        const p = idx * 4;
        img.data[p] = Math.max(60, Math.min(220, Math.round(base * 0.99)));
        img.data[p + 1] = Math.max(60, Math.min(220, Math.round(base * 1.0)));
        img.data[p + 2] = Math.max(60, Math.min(220, Math.round(base * 1.02)));
        img.data[p + 3] = 255;
      }
    }
  }
  if (ctx && img) ctx.putImageData(img, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 16);
  map.anisotropy = anisotropy;

  const normalMap = buildNormalDataTextureFromHeight(size, hMap, 2.0);
  normalMap.repeat.set(2, 16);
  normalMap.anisotropy = anisotropy;

  const set: ConcretePBRSet = { map, normalMap };
  cachedConcreteSets.set(key, set);
  return set;
}

export interface RoofShinglePBRSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.DataTexture;
}

let cachedRoofSet: RoofShinglePBRSet | null = null;
export function getRoofShinglePBRTextures(isRetroPixel: boolean): RoofShinglePBRSet {
  if (cachedRoofSet) return cachedRoofSet;
  const size = isRetroPixel ? 64 : 256;
  const hMap = new Float32Array(size * size);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx ? ctx.createImageData(size, size) : null;

  const rows = 8;
  const cols = 4;
  for (let y = 0; y < size; y++) {
    const v = y / size;
    const rowIdx = Math.floor(v * rows);
    const rowFrac = (v * rows) % 1;
    const stagger = (rowIdx % 2) * 0.5;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const colCoord = (u * cols + stagger) % 1;
      const grit = hash2D(x * 1.2, y * 1.6);
      const tileTone = hash2D(Math.floor(u * cols + stagger), rowIdx) * 0.16;
      const horizGap = rowFrac < 0.08 ? 1 : 0;
      const vertGap = colCoord < 0.04 ? 1 : 0;
      const gap = Math.max(horizGap, vertGap);

      hMap[y * size + x] = (1 - rowFrac) * 0.45 + grit * 0.25 - gap * 0.6;
      const lum = Math.round(215 * (0.86 + tileTone + (grit - 0.5) * 0.12 - gap * 0.36));
      if (img) {
        const p = (y * size + x) * 4;
        img.data[p] = lum;
        img.data[p + 1] = lum;
        img.data[p + 2] = lum;
        img.data[p + 3] = 255;
      }
    }
  }
  if (ctx && img) ctx.putImageData(img, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 3);

  const normalMap = buildNormalDataTextureFromHeight(size, hMap, 2.4);
  normalMap.repeat.set(3, 3);

  cachedRoofSet = { map, normalMap };
  return cachedRoofSet;
}

let cachedSidingNormal: THREE.DataTexture | null = null;
export function getSuburbanSidingNormalTexture(): THREE.DataTexture {
  if (cachedSidingNormal) return cachedSidingNormal;
  const size = 128;
  const hMap = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const plank = ((y / size) * 8) % 1;
    const bevel = plank < 0.14 ? plank / 0.14 : 1.0 - (plank - 0.14) * 0.35;
    for (let x = 0; x < size; x++) {
      const grain = (hash2D(x * 0.4, y * 1.8) - 0.5) * 0.06;
      hMap[y * size + x] = bevel + grain;
    }
  }
  const tex = buildNormalDataTextureFromHeight(size, hMap, 2.6);
  tex.repeat.set(3, 3);
  cachedSidingNormal = tex;
  return tex;
}

let cachedAutoFlakeNormal: THREE.DataTexture | null = null;
export function getCarPaintFlakeNormalTexture(): THREE.DataTexture {
  if (cachedAutoFlakeNormal) return cachedAutoFlakeNormal;
  const size = 128;
  const hMap = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    hMap[i] = hash2D(i % size, Math.floor(i / size));
  }
  const tex = buildNormalDataTextureFromHeight(size, hMap, 0.35);
  tex.repeat.set(22, 22);
  cachedAutoFlakeNormal = tex;
  return tex;
}

let cachedHeadlightPatternTex: THREE.CanvasTexture | null = null;
/**
 * Real-world ECE/SAE automotive dual-projector SpotLight projection map:
 * Features sharp horizontal upper cutoff (no sky bleed), bright central hotspot,
 * and wide lateral shoulder spill onto road curbs and lane lines.
 */
export function getAutomotiveHeadlightPatternTexture(): THREE.CanvasTexture {
  if (cachedHeadlightPatternTex) return cachedHeadlightPatternTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 256);

    // Wide foreground shoulder & asphalt spread
    const wideGrad = ctx.createRadialGradient(128, 152, 12, 128, 152, 118);
    wideGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.92)');
    wideGrad.addColorStop(0.45, 'rgba(220, 238, 255, 0.52)');
    wideGrad.addColorStop(0.82, 'rgba(170, 210, 255, 0.14)');
    wideGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = wideGrad;
    ctx.fillRect(0, 0, 256, 256);

    // Twin left & right LED projector hot-spots
    for (const cx of [92, 164]) {
      const spot = ctx.createRadialGradient(cx, 134, 4, cx, 134, 54);
      spot.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
      spot.addColorStop(0.45, 'rgba(240, 248, 255, 0.65)');
      spot.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = spot;
      ctx.fillRect(0, 0, 256, 256);
    }

    // Sharp ECE low-beam horizontal upper cutoff (darkens upper 36% smoothly so beams don't blind oncoming sky)
    const cutoff = ctx.createLinearGradient(0, 74, 0, 118);
    cutoff.addColorStop(0.0, 'rgba(0, 0, 0, 0.96)');
    cutoff.addColorStop(0.65, 'rgba(0, 0, 0, 0.45)');
    cutoff.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = cutoff;
    ctx.fillRect(0, 0, 256, 122);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedHeadlightPatternTex = tex;
  return tex;
}

let cachedHeadlightHaloTex: THREE.CanvasTexture | null = null;
/**
 * Soft feathered optical lens flare / headlight bulb halo mounted flush on the car lens.
 */
export function getHeadlightHaloTexture(): THREE.CanvasTexture {
  if (cachedHeadlightHaloTex) return cachedHeadlightHaloTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    const rad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    rad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    rad.addColorStop(0.18, 'rgba(240, 249, 255, 0.85)');
    rad.addColorStop(0.42, 'rgba(195, 226, 255, 0.34)');
    rad.addColorStop(0.75, 'rgba(155, 205, 255, 0.08)');
    rad.addColorStop(1.0, 'rgba(155, 205, 255, 0.0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, 128, 128);

    // Subtle horizontal anamorphic automotive lens streak
    const streak = ctx.createLinearGradient(4, 64, 124, 64);
    streak.addColorStop(0.0, 'rgba(220, 240, 255, 0.0)');
    streak.addColorStop(0.35, 'rgba(235, 248, 255, 0.28)');
    streak.addColorStop(0.5, 'rgba(255, 255, 255, 0.65)');
    streak.addColorStop(0.65, 'rgba(235, 248, 255, 0.28)');
    streak.addColorStop(1.0, 'rgba(220, 240, 255, 0.0)');
    ctx.fillStyle = streak;
    ctx.fillRect(4, 58, 120, 12);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedHeadlightHaloTex = tex;
  return tex;
}

let cachedGroundPoolTex: THREE.CanvasTexture | null = null;
/**
 * Ground-hugging feathered twin headlight wash pool (replaces fake floating 3D cones).
 */
export function getHeadlightGroundPoolTexture(): THREE.CanvasTexture {
  if (cachedGroundPoolTex) return cachedGroundPoolTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256);
    // Plane local +Y maps to front of car (near edge) or far edge; use UV V=1 near bumper, V=0 far ahead
    for (const bx of [96, 160]) {
      const grad = ctx.createRadialGradient(bx, 224, 8, bx, 128, 122);
      grad.addColorStop(0.0, 'rgba(245, 250, 255, 0.85)');
      grad.addColorStop(0.35, 'rgba(225, 242, 255, 0.42)');
      grad.addColorStop(0.75, 'rgba(195, 225, 255, 0.11)');
      grad.addColorStop(1.0, 'rgba(180, 215, 255, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(bx, 134, 72, 118, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fade crisp edges cleanly near all borders so quad bounds are invisible
    const edgeMask = ctx.createLinearGradient(0, 0, 0, 256);
    edgeMask.addColorStop(0.0, 'rgba(0, 0, 0, 0)');
    edgeMask.addColorStop(0.18, 'rgba(0, 0, 0, 1)');
    edgeMask.addColorStop(0.92, 'rgba(0, 0, 0, 1)');
    edgeMask.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = edgeMask;
    ctx.fillRect(0, 0, 256, 256);
    ctx.globalCompositeOperation = 'source-over';
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedGroundPoolTex = tex;
  return tex;
}

export interface BarkPBRSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.DataTexture;
}

const cachedBarkSets = new Map<string, BarkPBRSet>();
export function getBarkPBRTextures(isRetroPixel: boolean, anisotropy: number): BarkPBRSet {
  const key = `${isRetroPixel ? 'r' : 'p'}_${anisotropy}`;
  const existing = cachedBarkSets.get(key);
  if (existing) return existing;

  const size = isRetroPixel ? 64 : 256;
  const hMap = new Float32Array(size * size);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx ? ctx.createImageData(size, size) : null;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      // Vertically elongated furrowed oak/pine bark ridges
      const furrow = fbmTileable(u * 3.2, v * 0.55, 6, 3);
      const ridge = Math.abs(Math.sin((u * 14 + furrow * 2.4) * Math.PI));
      const plate = fbmTileable(u, v * 0.4, 18, 2);
      const h = furrow * 0.45 + ridge * 0.38 + plate * 0.17;
      hMap[idx] = h;

      const lichen = plate > 0.72 && furrow > 0.52 ? (plate - 0.72) * 2.5 : 0;
      const lum = 46 + h * 48;
      const r = Math.max(22, Math.min(130, Math.round(lum * 1.15 - lichen * 10)));
      const g = Math.max(18, Math.min(125, Math.round(lum * 0.92 + lichen * 16)));
      const b = Math.max(14, Math.min(110, Math.round(lum * 0.72 + lichen * 6)));
      if (img) {
        const p = idx * 4;
        img.data[p] = r;
        img.data[p + 1] = g;
        img.data[p + 2] = b;
        img.data[p + 3] = 255;
      }
    }
  }
  if (ctx && img) ctx.putImageData(img, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 3);
  map.anisotropy = anisotropy;
  if (isRetroPixel) {
    map.minFilter = THREE.NearestFilter;
    map.magFilter = THREE.NearestFilter;
  }

  const normalMap = buildNormalDataTextureFromHeight(size, hMap, isRetroPixel ? 1.0 : 2.6);
  normalMap.repeat.set(2, 3);
  normalMap.anisotropy = anisotropy;

  const set: BarkPBRSet = { map, normalMap };
  cachedBarkSets.set(key, set);
  return set;
}

const cachedLeafClusterTex = new Map<boolean, THREE.CanvasTexture>();
export function getLeafClusterTexture(isRetroPixel: boolean): THREE.CanvasTexture {
  const existing = cachedLeafClusterTex.get(isRetroPixel);
  if (existing) return existing;

  const dim = isRetroPixel ? 64 : 256;
  const sc = dim / 256;
  const c = document.createElement('canvas');
  c.width = dim;
  c.height = dim;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, dim, dim);

    // Draw 52 overlapping organic oak/maple leaves packed tightly near center with irregular lacy outer edge
    for (let i = 0; i < 52; i++) {
      const a = i * 2.39996; // golden angle phyllotaxis
      const rad = Math.sqrt(i / 52) * 92 * sc;
      const cx = (128 + Math.cos(a) * rad + (hash2D(i, 3) - 0.5) * 14 * sc) * sc;
      const cy = (128 + Math.sin(a) * rad + (hash2D(3, i) - 0.5) * 14 * sc) * sc;
      const rot = a + (hash2D(i, 7) - 0.5) * 1.1;
      const lw = (18 + hash2D(i, 11) * 14) * sc;
      const lh = (27 + hash2D(i, 17) * 16) * sc;
      const depthLayer = i < 20 ? 0.58 : i < 38 ? 0.82 : 1.04;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);

      const gBase = Math.round((98 + hash2D(i, 23) * 56) * depthLayer);
      const rBase = Math.round((56 + hash2D(i, 29) * 34) * depthLayer);
      const bBase = Math.round((32 + hash2D(i, 31) * 20) * depthLayer);

      // Serrated oak/maple leaf silhouette
      ctx.fillStyle = `rgb(${Math.min(255, rBase)}, ${Math.min(255, gBase)}, ${Math.min(255, bBase)})`;
      ctx.beginPath();
      ctx.moveTo(0, -lh);
      ctx.bezierCurveTo(lw * 0.72, -lh * 0.65, lw * 0.98, -lh * 0.1, lw * 0.76, lh * 0.38);
      ctx.bezierCurveTo(lw * 0.5, lh * 0.82, lw * 0.15, lh, 0, lh);
      ctx.bezierCurveTo(-lw * 0.15, lh, -lw * 0.5, lh * 0.82, -lw * 0.76, lh * 0.38);
      ctx.bezierCurveTo(-lw * 0.98, -lh * 0.1, -lw * 0.72, -lh * 0.65, 0, -lh);
      ctx.closePath();
      ctx.fill();

      // Subtle central midrib vein highlight on outer canopy leaves
      if (i >= 18) {
        ctx.strokeStyle = `rgba(195, 224, 145, 0.28)`;
        ctx.lineWidth = Math.max(1, 1.3 * sc);
        ctx.beginPath();
        ctx.moveTo(0, -lh * 0.78);
        ctx.lineTo(0, lh * 0.78);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  if (isRetroPixel) {
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
  }
  cachedLeafClusterTex.set(isRetroPixel, tex);
  return tex;
}

const cachedPineNeedleTex = new Map<boolean, THREE.CanvasTexture>();
export function getPineNeedleTexture(isRetroPixel: boolean): THREE.CanvasTexture {
  const existing = cachedPineNeedleTex.get(isRetroPixel);
  if (existing) return existing;

  const dim = isRetroPixel ? 64 : 256;
  const sc = dim / 256;
  const c = document.createElement('canvas');
  c.width = dim;
  c.height = dim;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, dim, dim);
    for (let i = 0; i < 110; i++) {
      const a = (i / 110) * Math.PI * 2 + hash2D(i, 5) * 0.4;
      const dist = (14 + hash2D(i, 9) * 86) * sc;
      const x0 = 128 * sc + Math.cos(a) * dist * 0.38;
      const y0 = 128 * sc + Math.sin(a) * dist * 0.38;
      const len = (36 + hash2D(i, 13) * 44) * sc;
      const x1 = x0 + Math.cos(a) * len;
      const y1 = y0 + Math.sin(a) * len;
      const shade = 0.65 + (i / 110) * 0.45;
      ctx.strokeStyle = `rgb(${Math.round(34 * shade)}, ${Math.round(78 * shade)}, ${Math.round(40 * shade)})`;
      ctx.lineWidth = Math.max(1.5, 3.2 * sc);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (isRetroPixel) {
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
  }
  cachedPineNeedleTex.set(isRetroPixel, tex);
  return tex;
}

const cachedGrassTuftTex = new Map<boolean, THREE.CanvasTexture>();
export function getGrassTuftTexture(isRetroPixel: boolean): THREE.CanvasTexture {
  const existing = cachedGrassTuftTex.get(isRetroPixel);
  if (existing) return existing;

  const dim = isRetroPixel ? 64 : 256;
  const sc = dim / 256;
  const c = document.createElement('canvas');
  c.width = dim;
  c.height = dim;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, dim, dim);
    const bladeCount = isRetroPixel ? 20 : 38;
    for (let i = 0; i < bladeCount; i++) {
      const bx = (26 + (i / (bladeCount - 1)) * 204 + (hash2D(i, 2) - 0.5) * 14) * sc;
      const h = (128 + hash2D(i, 6) * 106) * sc;
      const bend = (hash2D(i, 12) - 0.5) * 74 * sc;
      const baseW = (6.5 + hash2D(i, 18) * 5.0) * sc;
      const isDry = hash2D(i, 21) > 0.84;

      const grad = ctx.createLinearGradient(bx, dim, bx + bend, dim - h);
      if (isDry) {
        grad.addColorStop(0, '#3e4f23');
        grad.addColorStop(0.55, '#7c8239');
        grad.addColorStop(1, '#b8a85a');
      } else {
        grad.addColorStop(0, '#24471b');
        grad.addColorStop(0.5, '#467d2d');
        grad.addColorStop(1, '#7bb146');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(bx - baseW * 0.5, dim);
      ctx.quadraticCurveTo(bx + bend * 0.35 - baseW * 0.25, dim - h * 0.55, bx + bend, dim - h);
      ctx.quadraticCurveTo(bx + bend * 0.45 + baseW * 0.28, dim - h * 0.52, bx + baseW * 0.5, dim);
      ctx.closePath();
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  if (isRetroPixel) {
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
  }
  cachedGrassTuftTex.set(isRetroPixel, tex);
  return tex;
}

export interface LawnPBRSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.DataTexture;
}

const cachedLawnSets = new Map<string, LawnPBRSet>();
export function getLawnPBRTextures(isRetroPixel: boolean, anisotropy: number): LawnPBRSet {
  const key = `${isRetroPixel ? 'r' : 'p'}_${anisotropy}`;
  const existing = cachedLawnSets.get(key);
  if (existing) return existing;

  const size = isRetroPixel ? 64 : 256;
  const hMap = new Float32Array(size * size);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx ? ctx.createImageData(size, size) : null;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      const stripe = Math.sin((u + v * 0.25) * Math.PI * 6) > 0 ? 1.0 : 0.91;
      const blade = fbmTileable(u, v, 20, 2);
      const micro = hash2D(x * 1.1, y * 1.7);
      hMap[idx] = blade * 0.55 + micro * 0.45;

      const r = Math.round((46 + blade * 24 + micro * 10) * stripe);
      const g = Math.round((88 + blade * 34 + micro * 12) * stripe);
      const b = Math.round((34 + blade * 16 + micro * 6) * stripe);
      if (img) {
        const p = idx * 4;
        img.data[p] = Math.max(20, Math.min(180, r));
        img.data[p + 1] = Math.max(40, Math.min(200, g));
        img.data[p + 2] = Math.max(18, Math.min(140, b));
        img.data[p + 3] = 255;
      }
    }
  }
  if (ctx && img) ctx.putImageData(img, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);
  map.anisotropy = anisotropy;
  if (isRetroPixel) {
    map.minFilter = THREE.NearestFilter;
    map.magFilter = THREE.NearestFilter;
  }

  const normalMap = buildNormalDataTextureFromHeight(size, hMap, isRetroPixel ? 0.7 : 1.7);
  normalMap.repeat.set(2, 2);
  normalMap.anisotropy = anisotropy;

  const set: LawnPBRSet = { map, normalMap };
  cachedLawnSets.set(key, set);
  return set;
}

