import * as THREE from 'three';
import type { StreetCarModelArchetype } from './cityTrafficBuilder';

export type SculptSilhouetteKey =
  | 'civic_hatch'
  | 'camry_sedan'
  | 'supra_mk5'
  | 'supra_mk4'
  | 'gtr_r34'
  | 'gtr_r35'
  | 'camaro'
  | 'challenger'
  | 'charger'
  | 'bmw_m4'
  | 'escalade'
  | 'porsche_911'
  | 'huracan'
  | 'mcmurtry'
  | 'chiron'
  | 'chiron_ss'
  | 'koenigsegg'
  | 'koenigsegg_absolut'
  | 'nevera'
  | 'civ_sedan'
  | 'civ_suv'
  | 'civ_coupe'
  | 'police_cruiser';

export interface BodyDimensions {
  length: number;
  width: number;
  lowerH: number;
  cabinH: number;
  cabinLen: number;
  cabinZ: number;
  cabinWidthRatio: number;
  wheelRadius: number;
  baseY: number;
  frontAxleZ: number;
  rearAxleZ: number;
  tireWidth: number;
  wheelCenterX: number;
}

interface SilhouetteProfileSpec {
  noseLowY: number;
  noseBrowY: number;
  cowlY: number;
  beltRearY: number;
  tailY: number;
  diffuserY: number;
  hoodCrown: number;
  fenderRidge: number;
  powerDome: number;
  noseTaper: number;
  tailTaper: number;
  frontSweep: number;
  rearSweep: number;
  fenderFlare: number;
  waistPinch: number;
  doorScallop: number;
  tumblehome: number;
  roofStyle: 'fastback' | 'teardrop' | 'notchback' | 'hatch' | 'suv' | 'canopy';
  doubleBubble?: boolean;
  rearHaunchSwell: number;
}

const hullGeoCache = new Map<string, THREE.BufferGeometry>();
const glassGeoCache = new Map<string, THREE.BufferGeometry>();
const pillarGeoCache = new Map<string, THREE.BufferGeometry>();
const archWellGeoCache = new Map<string, THREE.BufferGeometry>();
const wingGeoCache = new Map<string, THREE.BufferGeometry>();
const wheelTireGeoCache = new Map<string, THREE.BufferGeometry>();
const wheelRimGeoCache = new Map<string, THREE.BufferGeometry>();
const caliperGeoCache = new Map<string, THREE.BufferGeometry>();
const headlightBezelGeoCache = new Map<string, THREE.BufferGeometry>();
const headlightLensGeoCache = new Map<string, THREE.BufferGeometry>();
const splitterGeoCache = new Map<string, THREE.BufferGeometry>();

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0 || 1e-6)));
  return t * t * (3 - 2 * t);
}

function getWheelTrackMetrics(key: SculptSilhouetteKey, width: number): {
  tireWidth: number;
  outerTireX: number;
  wheelCenterX: number;
  innerTireX: number;
} {
  const isSuv = key === 'escalade' || key === 'civ_suv';
  const isWideHyper =
    key === 'huracan' ||
    key === 'chiron' ||
    key === 'chiron_ss' ||
    key === 'koenigsegg' ||
    key === 'koenigsegg_absolut' ||
    key === 'nevera' ||
    key === 'porsche_911' ||
    key === 'supra_mk5';
  const tireWidth = isSuv ? 0.29 : isWideHyper ? 0.27 : key === 'mcmurtry' ? 0.24 : 0.25;
  const halfW = width * 0.5;
  // Outer sidewall sits cleanly inside the flared wheel arch lip with zero poke
  const outerTireX = halfW * 0.935;
  const wheelCenterX = outerTireX - tireWidth * 0.5;
  const innerTireX = wheelCenterX - tireWidth * 0.5;
  return { tireWidth, outerTireX, wheelCenterX, innerTireX };
}

function getProfileSpec(key: SculptSilhouetteKey, dim: BodyDimensions): SilhouetteProfileSpec {
  const H = dim.lowerH;
  const isSuv = key === 'escalade' || key === 'civ_suv';
  const isPorsche = key === 'porsche_911';
  const isWedge =
    key === 'huracan' ||
    key === 'koenigsegg' ||
    key === 'koenigsegg_absolut' ||
    key === 'nevera' ||
    key === 'mcmurtry';
  const isBugatti = key === 'chiron' || key === 'chiron_ss';
  const isMuscle = key === 'challenger' || key === 'charger' || key === 'camaro';
  const isSupra = key === 'supra_mk5' || key === 'supra_mk4';

  if (isSuv) {
    return {
      noseLowY: H * 0.22,
      noseBrowY: H * 0.86,
      cowlY: H * 0.99,
      beltRearY: H * 0.98,
      tailY: H * 0.90,
      diffuserY: H * 0.16,
      hoodCrown: 0.04,
      fenderRidge: 0.025,
      powerDome: 0.02,
      noseTaper: 0.06,
      tailTaper: 0.04,
      frontSweep: 0.09,
      rearSweep: 0.06,
      fenderFlare: 0.075,
      waistPinch: 0.01,
      doorScallop: 0.025,
      tumblehome: 0.045,
      roofStyle: 'suv',
      rearHaunchSwell: 0.02,
    };
  }
  if (isPorsche) {
    return {
      noseLowY: H * 0.14,
      noseBrowY: H * 0.54,
      cowlY: H * 0.92,
      beltRearY: H * 0.98,
      tailY: H * 0.86,
      diffuserY: H * 0.20,
      hoodCrown: 0.018,
      fenderRidge: 0.105, // Signature sloped 911 hood valley between raised frog-eye fenders
      powerDome: 0.0,
      noseTaper: 0.13,
      tailTaper: 0.10,
      frontSweep: 0.22,
      rearSweep: 0.18,
      fenderFlare: 0.095,
      waistPinch: 0.07,
      doorScallop: 0.045,
      tumblehome: 0.11,
      roofStyle: 'teardrop',
      rearHaunchSwell: 0.10,
    };
  }
  if (isWedge) {
    return {
      noseLowY: H * 0.10,
      noseBrowY: H * 0.48,
      cowlY: H * 0.90,
      beltRearY: H * 1.06,
      tailY: H * 0.95,
      diffuserY: H * 0.22,
      hoodCrown: 0.025,
      fenderRidge: 0.09,
      powerDome: 0.0,
      noseTaper: 0.17,
      tailTaper: 0.10,
      frontSweep: 0.26,
      rearSweep: 0.15,
      fenderFlare: 0.105,
      waistPinch: 0.07,
      doorScallop: 0.065,
      tumblehome: 0.115,
      roofStyle: 'canopy',
      doubleBubble: key === 'koenigsegg' || key === 'koenigsegg_absolut',
      rearHaunchSwell: 0.09,
    };
  }
  if (isBugatti) {
    return {
      noseLowY: H * 0.12,
      noseBrowY: H * 0.54,
      cowlY: H * 0.92,
      beltRearY: H * 1.04,
      tailY: H * 0.92,
      diffuserY: H * 0.20,
      hoodCrown: 0.045,
      fenderRidge: 0.075,
      powerDome: 0.0,
      noseTaper: 0.15,
      tailTaper: 0.09,
      frontSweep: 0.23,
      rearSweep: 0.16,
      fenderFlare: 0.105,
      waistPinch: 0.06,
      doorScallop: 0.055,
      tumblehome: 0.11,
      roofStyle: 'canopy',
      rearHaunchSwell: 0.095,
    };
  }
  if (isSupra) {
    return {
      noseLowY: H * 0.14,
      noseBrowY: H * 0.60,
      cowlY: H * 0.96,
      beltRearY: H * 1.04,
      tailY: H * 0.94,
      diffuserY: H * 0.20,
      hoodCrown: 0.05,
      fenderRidge: 0.065,
      powerDome: 0.02,
      noseTaper: 0.14,
      tailTaper: 0.10,
      frontSweep: 0.22,
      rearSweep: 0.15,
      fenderFlare: 0.095,
      waistPinch: 0.08,
      doorScallop: 0.055,
      tumblehome: 0.10,
      roofStyle: 'fastback',
      doubleBubble: key === 'supra_mk5',
      rearHaunchSwell: 0.105,
    };
  }
  if (isMuscle) {
    return {
      noseLowY: H * 0.19,
      noseBrowY: H * 0.78,
      cowlY: H * 0.99,
      beltRearY: H * 1.03,
      tailY: H * 0.94,
      diffuserY: H * 0.18,
      hoodCrown: 0.042,
      fenderRidge: 0.038,
      powerDome: 0.05,
      noseTaper: 0.075,
      tailTaper: 0.055,
      frontSweep: 0.11,
      rearSweep: 0.085,
      fenderFlare: 0.09,
      waistPinch: 0.04,
      doorScallop: 0.038,
      tumblehome: 0.075,
      roofStyle: key === 'charger' ? 'notchback' : 'fastback',
      rearHaunchSwell: 0.08,
    };
  }
  // BMW M4, GT-R, Civic, Camry, Civilian Sedans/Coupes, Police Charger
  const isSedan =
    key === 'camry_sedan' || key === 'civ_sedan' || key === 'police_cruiser' || key === 'civic_hatch';
  return {
    noseLowY: H * 0.16,
    noseBrowY: H * 0.70,
    cowlY: H * 0.96,
    beltRearY: H * 1.01,
    tailY: H * 0.93,
    diffuserY: H * 0.18,
    hoodCrown: 0.045,
    fenderRidge: 0.045,
    powerDome: key === 'bmw_m4' || key === 'gtr_r35' ? 0.03 : 0.012,
    noseTaper: 0.11,
    tailTaper: 0.085,
    frontSweep: 0.16,
    rearSweep: 0.12,
    fenderFlare: key === 'bmw_m4' || key === 'gtr_r35' || key === 'gtr_r34' ? 0.09 : 0.065,
    waistPinch: isSedan ? 0.025 : 0.05,
    doorScallop: 0.038,
    tumblehome: isSedan ? 0.072 : 0.09,
    roofStyle: key === 'civic_hatch' ? 'hatch' : isSedan ? 'notchback' : 'fastback',
    doubleBubble: key === 'bmw_m4',
    rearHaunchSwell: isSedan ? 0.035 : 0.075,
  };
}

/**
 * Evaluates the sculpted hull's front fascia position & wraparound yaw tangent at a given lateral fraction
 */
export function evalFasciaAnchor(
  key: SculptSilhouetteKey,
  dim: BodyDimensions,
  side: number,
  xFracOfHalfW: number,
  heightFrac: number,
  end: 'front' | 'rear'
): { x: number; y: number; z: number; yaw: number } {
  const spec = getProfileSpec(key, dim);
  const halfW = dim.width * 0.5;
  const halfL = dim.length * 0.5;
  const ax = Math.min(0.95, Math.max(0, xFracOfHalfW));

  if (end === 'front') {
    const taper = 1.0 - spec.noseTaper * 0.85;
    const x = side * ax * halfW * taper;
    const sweepZ = -halfL + ax * ax * spec.frontSweep + 0.02;
    const y = dim.baseY + spec.noseLowY + (spec.noseBrowY - spec.noseLowY) * heightFrac;
    // Derivative dZ/dX for wraparound yaw tangent
    const dzdx = (2 * ax * spec.frontSweep) / Math.max(0.3, halfW * taper);
    const yaw = Math.atan(dzdx);
    return { x, y, z: sweepZ, yaw: side * yaw };
  }

  const taper = 1.0 - spec.tailTaper * 0.80;
  const x = side * ax * halfW * taper;
  const sweepZ = halfL - ax * ax * spec.rearSweep - 0.02;
  const y = dim.baseY + spec.diffuserY + (spec.tailY - spec.diffuserY) * heightFrac;
  const dzdx = (2 * ax * spec.rearSweep) / Math.max(0.3, halfW * taper);
  const yaw = Math.atan(dzdx);
  return { x, y, z: sweepZ, yaw: -side * yaw };
}

/**
 * Parametric 3D Multi-Station Lofted Automotive Lower Hull Builder
 * Generates genuine compound-curved hoods, raised fender arches that mathematically clear every tire,
 * deeply recessed wheelhouse pockets, coke-bottle door waistlines, and wraparound bumper fascia.
 */
function buildLoftedLowerHullGeometry(
  key: SculptSilhouetteKey,
  dim: BodyDimensions
): THREE.BufferGeometry {
  const cacheKey = `loftHull_v3_${key}_${dim.length.toFixed(2)}_${dim.width.toFixed(2)}_${dim.lowerH.toFixed(2)}_${dim.wheelRadius.toFixed(3)}_${dim.baseY.toFixed(2)}`;
  const cached = hullGeoCache.get(cacheKey);
  if (cached) return cached;

  const spec = getProfileSpec(key, dim);
  const L = dim.length;
  const halfL = L * 0.5;
  const halfW = dim.width * 0.5;
  const cowlZ = dim.cabinZ - dim.cabinLen * 0.48;
  const rearDeckZ = dim.cabinZ + dim.cabinLen * 0.44;
  const rArch = dim.wheelRadius * 1.145;
  const fAxle = dim.frontAxleZ;
  const rAxle = dim.rearAxleZ;
  const archCenterY = Math.max(0.02, dim.wheelRadius - dim.baseY);
  const { innerTireX, outerTireX } = getWheelTrackMetrics(key, dim.width);

  // Build non-uniform longitudinal Z stations using COSINE spacing across wheel arches
  // so the semi-circular cutout stays razor-smooth with zero chord clipping on tire shoulders!
  const rawZ: number[] = [];
  const pushZ = (z: number) => rawZ.push(Math.max(-halfL, Math.min(halfL, z)));
  const addRange = (a: number, b: number, steps: number) => {
    for (let i = 0; i <= steps; i++) pushZ(a + ((b - a) * i) / steps);
  };
  const addCosineArch = (axleZ: number, radius: number, steps: number) => {
    pushZ(axleZ - radius - 0.07);
    pushZ(axleZ - radius - 0.02);
    for (let i = 0; i <= steps; i++) {
      const theta = (Math.PI * i) / steps;
      pushZ(axleZ - radius * Math.cos(theta));
    }
    pushZ(axleZ + radius + 0.02);
    pushZ(axleZ + radius + 0.07);
  };

  addRange(-halfL, Math.max(-halfL + 0.05, fAxle - rArch - 0.08), 5);
  addCosineArch(fAxle, rArch, 14);
  addRange(fAxle + rArch + 0.08, rAxle - rArch - 0.08, 7);
  addCosineArch(rAxle, rArch, 14);
  addRange(Math.min(halfL - 0.05, rAxle + rArch + 0.08), halfL, 5);

  rawZ.sort((a, b) => a - b);
  const zStations: number[] = [];
  for (const z of rawZ) {
    if (zStations.length === 0 || Math.abs(z - zStations[zStations.length - 1]) > 0.012) {
      zStations.push(z);
    }
  }
  if (Math.abs(zStations[0] + halfL) > 0.008) zStations[0] = -halfL;
  if (Math.abs(zStations[zStations.length - 1] - halfL) > 0.008) zStations[zStations.length - 1] = halfL;

  const evalUpperDeckY = (z: number): number => {
    if (z < cowlZ) {
      const t = (z - -halfL) / Math.max(0.2, cowlZ - -halfL);
      const rise = smoothstep(0.0, 0.22, t) * (spec.noseBrowY - spec.noseLowY) + spec.noseLowY;
      const hoodBlend = smoothstep(0.14, 1.0, t);
      return rise + (spec.cowlY - spec.noseBrowY) * Math.pow(hoodBlend, 0.78);
    }
    if (z <= rearDeckZ) {
      const t = (z - cowlZ) / Math.max(0.2, rearDeckZ - cowlZ);
      return spec.cowlY + (spec.beltRearY - spec.cowlY) * smoothstep(0, 1, t);
    }
    const t = (z - rearDeckZ) / Math.max(0.2, halfL - rearDeckZ);
    return spec.beltRearY + (spec.tailY - spec.beltRearY) * Math.pow(t, 1.25);
  };

  const evalArchCutY = (z: number): { cutY: number; inArch: number; minAxleDist: number } => {
    const df = Math.abs(z - fAxle);
    const dr = Math.abs(z - rAxle);
    const minAxleDist = Math.min(df, dr);
    if (df < rArch) {
      const h = archCenterY + Math.sqrt(Math.max(0, rArch * rArch - df * df));
      return { cutY: Math.max(0.02, h), inArch: 1 - df / rArch, minAxleDist };
    }
    if (dr < rArch) {
      const h = archCenterY + Math.sqrt(Math.max(0, rArch * rArch - dr * dr));
      return { cutY: Math.max(0.02, h), inArch: 1 - dr / rArch, minAxleDist };
    }
    return { cutY: 0.02, inArch: 0, minAxleDist };
  };

  const HALF_SEGS = 14;
  const RING_PTS = HALF_SEGS * 2 + 1;

  const sampleCrossSectionPoint = (z: number, ringIdx: number): [number, number, number] => {
    const isEndFront = z <= -halfL + 0.02;
    const isEndRear = z >= halfL - 0.02;

    const topBaseY = evalUpperDeckY(z);
    const { cutY, inArch, minAxleDist } = evalArchCutY(z);

    // Smooth wheel-pocket transition begins just outside rArch before the tire edge starts
    const wellPocketBlend = smoothstep(rArch * 1.15, rArch * 0.96, minAxleDist);
    // Fender arch vertical envelope clears top of arch by +5.8cm so tires NEVER poke through fenders
    const archCrownEnv = smoothstep(rArch * 1.48, rArch * 0.85, minAxleDist);
    const fenderTopY = topBaseY + Math.max(0, cutY + 0.058 - topBaseY) * archCrownEnv;

    // Front/rear plan-view nose & tail tapers wait until clear of the wheel arches
    const noseStartZ = Math.min(-halfL * 0.55, fAxle - rArch * 0.35);
    const tailStartZ = Math.max(halfL * 0.55, rAxle + rArch * 0.35);
    const fT = z < noseStartZ ? smoothstep(noseStartZ, -halfL, z) : 0;
    const rT = z > tailStartZ ? smoothstep(tailStartZ, halfL, z) : 0;
    const midDoor = 1.0 - Math.min(1.0, Math.abs(z - 0.05) / (halfL * 0.34));

    const fFlare = Math.exp(-Math.pow((z - fAxle) / (rArch * 1.12), 2));
    const rFlare = Math.exp(-Math.pow((z - rAxle) / (rArch * 1.18), 2));
    const flareX = Math.max(fFlare, rFlare) * spec.fenderFlare;
    const rearSwell =
      z > 0.1 ? smoothstep(0.1, rearDeckZ + 0.25, z) * (1 - rT * 0.7) * spec.rearHaunchSwell : 0;

    let planScaleX =
      1.0 -
      fT * fT * spec.noseTaper -
      rT * rT * spec.tailTaper -
      midDoor * spec.waistPinch +
      flareX +
      rearSwell;

    // Guarantee flared outer arch lip clears the tire outer sidewall by >= 4.5cm across the wheel opening
    const minArchPlanScale = (outerTireX + 0.048) / halfW;
    if (wellPocketBlend > 0.01) {
      planScaleX = Math.max(planScaleX, planScaleX * (1 - wellPocketBlend) + minArchPlanScale * wellPocketBlend);
    }

    if (isEndFront) planScaleX *= 0.86;
    if (isEndRear) planScaleX *= 0.88;

    const sideSign = ringIdx <= HALF_SEGS ? 1 : -1;
    const localIdx = ringIdx <= HALF_SEGS ? ringIdx : RING_PTS - 1 - ringIdx;
    const u = localIdx / HALF_SEGS; // 0 = floor center, 1 = hood centerline

    const floorY =
      z > halfL * 0.72 ? spec.diffuserY : z < -halfL * 0.85 ? spec.noseLowY * 0.32 : 0.02;
    const archLipY = Math.max(floorY + 0.01, cutY);

    // Compute exact normalized X that stays >= 5.5cm STRICTLY INBOARD of the inner tire face!
    const currentHalfWidth = Math.max(0.25, halfW * planScaleX);
    const maxSafeInnerXNorm = Math.max(0.28, (innerTireX - 0.055) / currentHalfWidth);
    const wellInnerXNorm = 0.74 + (Math.min(0.62, maxSafeInnerXNorm) - 0.74) * wellPocketBlend;
    const lipOutXNorm = 0.97 + 0.025 * wellPocketBlend;
    const midSideY = Math.max(archLipY + 0.02, fenderTopY * 0.64);
    const upperShoulderY = Math.max(midSideY + 0.015, fenderTopY * 0.95);

    let xNorm = 0;
    let vy = floorY;

    if (u <= 0.14) {
      // Flat floor pan out to inner wheelhouse floor edge
      const k = u / 0.14;
      xNorm = k * wellInnerXNorm;
      vy = floorY;
    } else if (u <= 0.24) {
      // Inside arch: rise strictly vertically along recessed inner bulkhead wall (inboard of tire!)
      // Outside arch: smoothly curve out to lower rocker sill
      const k = (u - 0.14) / 0.10;
      const outRockerX = wellInnerXNorm + k * (lipOutXNorm - wellInnerXNorm) * 0.88;
      xNorm = wellPocketBlend * wellInnerXNorm + (1 - wellPocketBlend) * outRockerX;
      vy = floorY + (archLipY - floorY) * smoothstep(0, 1, k);
    } else if (u <= 0.34) {
      // Inside arch: sweep horizontally OUTWARD above the arch cutout archLipY out to the rolled fender lip
      const k = (u - 0.24) / 0.10;
      const archStartX = wellPocketBlend * wellInnerXNorm + (1 - wellPocketBlend) * (wellInnerXNorm + (lipOutXNorm - wellInnerXNorm) * 0.88);
      xNorm = archStartX + (lipOutXNorm - archStartX) * smoothstep(0, 1, k);
      const nonArchY = archLipY + (midSideY - archLipY) * 0.35 * k;
      vy = wellPocketBlend * Math.max(archLipY, archLipY + 0.008 * Math.sin(k * Math.PI)) + (1 - wellPocketBlend) * nonArchY;
    } else if (u <= 0.52) {
      // Lower door scallop / quarter panel swelling monotonically upward above archLipY
      const k = (u - 0.34) / 0.18;
      const scallop = -midDoor * spec.doorScallop * Math.sin(k * Math.PI) * (1 - wellPocketBlend);
      const bellyOut = Math.sin(k * Math.PI * 0.8) * 0.04;
      xNorm = lipOutXNorm + bellyOut - scallop;
      const startY = wellPocketBlend * archLipY + (1 - wellPocketBlend) * (archLipY + (midSideY - archLipY) * 0.35);
      vy = startY + (midSideY - startY) * k;
    } else if (u <= 0.70) {
      // Upper shoulder tumblehome rounding strictly above midSideY
      const k = (u - 0.52) / 0.18;
      const startX = lipOutXNorm;
      const endX = 1.0 - spec.tumblehome;
      xNorm = startX + (endX - startX) * k;
      vy = midSideY + (upperShoulderY - midSideY) * Math.pow(k, 0.85);
    } else if (u <= 0.84) {
      // Fender ridge crest arching cleanly over tire shoulder (e.g. 911 / Huracan / Supra fenders)
      const k = (u - 0.70) / 0.14;
      const shoulderX = 1.0 - spec.tumblehome;
      xNorm = shoulderX * (1 - k * 0.42);
      const isHoodZone = z < cowlZ + 0.25 ? 1.0 : 0.25;
      const ridgeBump = Math.sin(k * Math.PI) * spec.fenderRidge * isHoodZone;
      vy = upperShoulderY + k * (fenderTopY - upperShoulderY) + ridgeBump;
    } else {
      // Hood centerline (strictly inboard of inner tire well, smoothly blends from raised fender down to sculpted center hood)
      const k = (u - 0.84) / 0.16;
      const edgeX = (1.0 - spec.tumblehome) * 0.58;
      xNorm = edgeX * (1 - k);
      const isHoodZone = z < cowlZ + 0.1 ? 1.0 : 0.2;
      const dome =
        Math.sin(k * Math.PI * 0.5) *
        (spec.hoodCrown + spec.powerDome * (z < cowlZ && z > -halfL * 0.8 ? 1 : 0)) *
        isHoodZone;
      const centerTargetY = topBaseY + dome;
      vy = fenderTopY + (centerTargetY - fenderTopY) * smoothstep(0, 1, k);
    }

    let vx = sideSign * xNorm * halfW * planScaleX;
    let vz = z;

    // Plan-view wraparound curvature at front nose & rear bumper
    const absXNorm = Math.min(1, Math.abs(vx) / Math.max(0.2, halfW));
    if (fT > 0.001) {
      vz += absXNorm * absXNorm * fT * spec.frontSweep;
    }
    if (rT > 0.001) {
      vz -= absXNorm * absXNorm * rT * spec.rearSweep;
    }

    if (isEndFront) {
      vy = floorY + (vy - floorY) * 0.72 + spec.noseLowY * 0.22;
      vz += 0.025 * (1 - absXNorm * 0.5);
    }
    if (isEndRear) {
      vy = spec.diffuserY + (vy - spec.diffuserY) * 0.76;
      vz -= 0.025 * (1 - absXNorm * 0.5);
    }

    vy = Math.max(0.015, vy) + dim.baseY;
    return [vx, vy, vz];
  };

  const NZ = zStations.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let zi = 0; zi < NZ; zi++) {
    const z = zStations[zi];
    const vCoord = (z + halfL) / L;
    for (let si = 0; si < RING_PTS; si++) {
      const [px, py, pz] = sampleCrossSectionPoint(z, si);
      positions.push(px, py, pz);
      uvs.push(si / (RING_PTS - 1), vCoord);
    }
  }

  for (let zi = 0; zi < NZ - 1; zi++) {
    const rowA = zi * RING_PTS;
    const rowB = (zi + 1) * RING_PTS;
    for (let si = 0; si < RING_PTS - 1; si++) {
      const v00 = rowA + si;
      const v01 = rowA + si + 1;
      const v10 = rowB + si;
      const v11 = rowB + si + 1;
      indices.push(v00, v01, v11);
      indices.push(v00, v11, v10);
    }
  }

  const frontCenterIdx = positions.length / 3;
  const fCenterY = dim.baseY + (spec.noseLowY + spec.noseBrowY) * 0.45;
  positions.push(0, fCenterY, -halfL - 0.03);
  uvs.push(0.5, 0);
  for (let si = 0; si < RING_PTS - 1; si++) {
    indices.push(frontCenterIdx, si + 1, si);
  }

  const rearCenterIdx = positions.length / 3;
  const rCenterY = dim.baseY + (spec.diffuserY + spec.tailY) * 0.50;
  positions.push(0, rCenterY, halfL + 0.028);
  uvs.push(0.5, 1);
  const lastRow = (NZ - 1) * RING_PTS;
  for (let si = 0; si < RING_PTS - 1; si++) {
    indices.push(rearCenterIdx, lastRow + si, lastRow + si + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  hullGeoCache.set(cacheKey, geo);
  return geo;
}

/**
 * Concave inner wheel-well arch liners (open-ended barrel + inboard bulkhead disc only)
 * Never uses flat outer caps, guaranteeing zero intersection with tires, rims, or outer fenders!
 */
function buildWheelWellLinersGeometry(dim: BodyDimensions): THREE.BufferGeometry {
  const key = `wells_v2_${dim.width.toFixed(2)}_${dim.wheelRadius.toFixed(3)}_${dim.frontAxleZ.toFixed(2)}_${dim.tireWidth.toFixed(2)}`;
  const cached = archWellGeoCache.get(key);
  if (cached) return cached;

  const r = dim.wheelRadius * 1.135;
  const wellWidth = dim.tireWidth + 0.085;
  const archCenterY = Math.max(dim.baseY + 0.02, dim.wheelRadius);
  const parts: THREE.BufferGeometry[] = [];

  for (const axZ of [dim.frontAxleZ, dim.rearAxleZ]) {
    for (const side of [-1, 1]) {
      // Open-ended dark arch sleeve directly over tire tread
      const sleeve = new THREE.CylinderGeometry(r, r, wellWidth, 18, 1, true, 0, Math.PI);
      sleeve.rotateZ(Math.PI / 2);
      sleeve.translate(side * dim.wheelCenterX, archCenterY, axZ);
      parts.push(sleeve);

      // Inboard dark inner wheelhouse bulkhead backing (strictly inboard of inner tire sidewall)
      const innerX = side * (dim.wheelCenterX - dim.tireWidth * 0.5 - 0.045);
      const backDisc = new THREE.CircleGeometry(r, 18, 0, Math.PI);
      backDisc.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2);
      backDisc.translate(innerX, archCenterY, axZ);
      parts.push(backDisc);
    }
  }

  const merged = mergeSimpleGeometries(parts);
  parts.forEach((p) => p.dispose());
  archWellGeoCache.set(key, merged);
  return merged;
}

function mergeSimpleGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIdx = 0;
  const normalized = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of normalized) {
    totalVerts += g.attributes.position.count;
  }
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  let offset = 0;
  for (const g of normalized) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const pos = g.attributes.position as THREE.BufferAttribute;
    const norm = g.attributes.normal as THREE.BufferAttribute;
    positions.set(pos.array as Float32Array, offset * 3);
    normals.set(norm.array as Float32Array, offset * 3);
    offset += pos.count;
    totalIdx += pos.count;
  }
  void totalIdx;
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return out;
}

/**
 * Compound-curved Lofted Glass Greenhouse + Body-Colored A/B/C Pillars & Contoured Roof Shell!
 */
function buildLoftedGreenhouseParts(
  key: SculptSilhouetteKey,
  dim: BodyDimensions
): { glassGeo: THREE.BufferGeometry; pillarRoofGeo: THREE.BufferGeometry } {
  const cacheKey = `loftCab_v2_${key}_${dim.cabinLen.toFixed(2)}_${dim.cabinH.toFixed(2)}_${dim.width.toFixed(2)}`;
  const cachedGlass = glassGeoCache.get(cacheKey);
  const cachedPillar = pillarGeoCache.get(cacheKey);
  if (cachedGlass && cachedPillar) {
    return { glassGeo: cachedGlass, pillarRoofGeo: cachedPillar };
  }

  const spec = getProfileSpec(key, dim);
  const cabW = dim.width * dim.cabinWidthRatio;
  const halfCabW = cabW * 0.5;
  const cLen = dim.cabinLen;
  const cH = dim.cabinH;
  const cZ = dim.cabinZ;
  const baseY = dim.baseY + dim.lowerH * 0.90;

  const evalRoofH = (t: number): number => {
    // t in [0..1] from front windshield base (0) to rear window base (1)
    if (spec.roofStyle === 'suv') {
      if (t < 0.20) return smoothstep(0, 0.20, t) * cH;
      if (t > 0.88) return (1 - smoothstep(0.88, 1.0, t)) * cH * 0.96;
      return cH * (1 - (t - 0.20) * 0.04);
    }
    if (spec.roofStyle === 'teardrop') {
      if (t < 0.36) return Math.pow(smoothstep(0, 0.36, t), 0.85) * cH;
      return Math.cos(((t - 0.36) / 0.64) * Math.PI * 0.5) * cH;
    }
    if (spec.roofStyle === 'canopy') {
      if (t < 0.38) return Math.sin((t / 0.38) * Math.PI * 0.5) * cH;
      if (t < 0.56) return cH;
      return Math.cos(((t - 0.56) / 0.44) * Math.PI * 0.5) * cH;
    }
    if (spec.roofStyle === 'hatch') {
      if (t < 0.30) return Math.pow(smoothstep(0, 0.30, t), 0.85) * cH;
      if (t < 0.72) return cH * (1 - (t - 0.30) * 0.06);
      return cH * 0.97 * (1 - Math.pow((t - 0.72) / 0.28, 1.3));
    }
    if (spec.roofStyle === 'notchback') {
      if (t < 0.28) return smoothstep(0, 0.28, t) * cH;
      if (t < 0.70) return cH * (1 - Math.abs(t - 0.49) * 0.06);
      return cH * 0.98 * (1 - smoothstep(0.70, 1.0, t));
    }
    // fastback
    if (t < 0.32) return smoothstep(0, 0.32, t) * cH;
    if (t < 0.52) return cH;
    return cH * (1 - Math.pow((t - 0.52) / 0.48, 1.45));
  };

  const NZ = 18;
  const HALF_S = 8;
  const RING = HALF_S * 2 + 1;
  const gPos: number[] = [];
  const gIdx: number[] = [];

  for (let zi = 0; zi < NZ; zi++) {
    const t = zi / (NZ - 1);
    const zBase = cZ - cLen * 0.54 + t * cLen * 1.08;
    const h = evalRoofH(t);
    const hNorm = Math.min(1, h / Math.max(0.1, cH));
    // Plan-view oval cabin taper at front & rear
    const endTaper = 1.0 - Math.pow(Math.abs(t - 0.48) * 1.9, 2.2) * (spec.roofStyle === 'suv' ? 0.14 : 0.28);
    const tumbleScale = 1.0 - hNorm * (spec.roofStyle === 'suv' ? 0.15 : 0.24);
    const ringW = halfCabW * Math.max(0.42, endTaper);

    for (let si = 0; si < RING; si++) {
      const sign = si <= HALF_S ? 1 : -1;
      const li = si <= HALF_S ? si : RING - 1 - si;
      const u = li / HALF_S; // 0 = sill edge, 1 = roof centerline

      let x = 0;
      let y = 0;
      if (u <= 0.45) {
        // Sloped side glass window rising with tumblehome
        const k = u / 0.45;
        x = sign * ringW * (1 - (1 - tumbleScale) * k);
        y = h * k * 0.90;
      } else {
        // Curved roof header arch
        const k = (u - 0.45) / 0.55;
        const sideX = ringW * tumbleScale;
        x = sign * sideX * Math.cos(k * Math.PI * 0.5);
        let dome = Math.sin(k * Math.PI * 0.5) * 0.045;
        if (spec.doubleBubble && Math.abs(x) > 0.08 && Math.abs(x) < sideX * 0.82 && t > 0.28 && t < 0.72) {
          dome += 0.028 * Math.sin(((Math.abs(x) / sideX) - 0.1) * Math.PI);
        }
        y = h * (0.90 + 0.10 * Math.sin(k * Math.PI * 0.5)) + dome;
      }

      // Wraparound curvature at front windshield & rear glass!
      const xFrac = Math.min(1, Math.abs(x) / Math.max(0.2, halfCabW));
      let vz = zBase;
      if (t < 0.35) {
        vz += xFrac * xFrac * (1 - t / 0.35) * (spec.roofStyle === 'suv' ? 0.08 : 0.16);
      } else if (t > 0.65) {
        vz -= xFrac * xFrac * ((t - 0.65) / 0.35) * (spec.roofStyle === 'suv' ? 0.06 : 0.14);
      }

      gPos.push(x, baseY + y, vz);
    }
  }

  for (let zi = 0; zi < NZ - 1; zi++) {
    const a = zi * RING;
    const b = (zi + 1) * RING;
    for (let si = 0; si < RING - 1; si++) {
      // Closed bottom floor tie across si=0 and si=RING-1
      const v00 = a + si;
      const v01 = a + si + 1;
      const v10 = b + si;
      const v11 = b + si + 1;
      gIdx.push(v00, v01, v11, v00, v11, v10);
    }
  }

  // Cap front & rear base ends
  const fCap = gPos.length / 3;
  gPos.push(0, baseY + 0.01, cZ - cLen * 0.54);
  for (let si = 0; si < RING - 1; si++) gIdx.push(fCap, si + 1, si);

  const rCap = gPos.length / 3;
  gPos.push(0, baseY + 0.01, cZ + cLen * 0.54);
  const lastR = (NZ - 1) * RING;
  for (let si = 0; si < RING - 1; si++) gIdx.push(rCap, lastR + si, lastR + si + 1);

  const glassGeo = new THREE.BufferGeometry();
  glassGeo.setAttribute('position', new THREE.Float32BufferAttribute(gPos, 3));
  glassGeo.setIndex(gIdx);
  glassGeo.computeVertexNormals();

  // Build authentic body-colored Painted Greenhouse Frame (Roof Crown Shell + A-Pillars + C-Pillars / Buttresses)
  const pParts: THREE.BufferGeometry[] = [];
  // 1. Curved contoured roof panel hugging the glass crown cleanly
  const roofStart = spec.roofStyle === 'suv' ? 0.21 : 0.30;
  const roofEnd = spec.roofStyle === 'suv' ? 0.88 : spec.roofStyle === 'teardrop' ? 0.66 : 0.72;
  const roofN = 8;
  const rPositions: number[] = [];
  const rIndices: number[] = [];
  const rRing = 7;
  for (let i = 0; i < roofN; i++) {
    const t = roofStart + ((roofEnd - roofStart) * i) / (roofN - 1);
    const zBase = cZ - cLen * 0.54 + t * cLen * 1.08;
    const h = evalRoofH(t);
    const endTaper = 1.0 - Math.pow(Math.abs(t - 0.48) * 1.9, 2.2) * (spec.roofStyle === 'suv' ? 0.14 : 0.28);
    const tumbleScale = 1.0 - Math.min(1, h / cH) * (spec.roofStyle === 'suv' ? 0.15 : 0.24);
    const roofHalfW = halfCabW * Math.max(0.42, endTaper) * tumbleScale * 0.98;
    for (let j = 0; j < rRing; j++) {
      const xf = -1 + (2 * j) / (rRing - 1); // -1 left .. +1 right
      const px = -xf * roofHalfW; // Right-to-left for outward top normal
      let dome = Math.cos(xf * Math.PI * 0.5) * 0.048 + 0.014;
      if (spec.doubleBubble && Math.abs(xf) > 0.15 && Math.abs(xf) < 0.85) {
        dome += 0.032 * Math.sin(((Math.abs(xf) - 0.15) / 0.7) * Math.PI);
      }
      rPositions.push(px, baseY + h + dome, zBase);
    }
  }
  for (let i = 0; i < roofN - 1; i++) {
    const a = i * rRing;
    const b = (i + 1) * rRing;
    for (let j = 0; j < rRing - 1; j++) {
      rIndices.push(a + j, a + j + 1, b + j + 1, a + j, b + j + 1, b + j);
    }
  }
  const roofSkinGeo = new THREE.BufferGeometry();
  roofSkinGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPositions, 3));
  roofSkinGeo.setIndex(rIndices);
  roofSkinGeo.computeVertexNormals();
  pParts.push(roofSkinGeo);

  // 2. Sculpted A-Pillars & C-Pillars / Sail Buttresses linking roof down to beltline shoulders
  for (const side of [-1, 1]) {
    // A-pillar strut
    const aBotZ = cZ - cLen * 0.50;
    const aTopZ = cZ - cLen * 0.54 + roofStart * cLen * 1.08 + 0.04;
    const aBotX = side * (halfCabW * 0.90);
    const aTopX = side * (halfCabW * 0.74);
    const aTopY = baseY + evalRoofH(roofStart);
    const aCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(aBotX, baseY + 0.02, aBotZ),
      new THREE.Vector3((aBotX + aTopX) * 0.52, baseY + (aTopY - baseY) * 0.55, (aBotZ + aTopZ) * 0.5),
      new THREE.Vector3(aTopX, aTopY + 0.015, aTopZ),
    ]);
    pParts.push(new THREE.TubeGeometry(aCurve, 6, 0.032, 6, false));

    // C-pillar / Flying Rear Buttress
    const cTopZ = cZ - cLen * 0.54 + roofEnd * cLen * 1.08 - 0.04;
    const cBotZ = cZ + cLen * 0.51;
    const cTopX = side * (halfCabW * 0.72);
    const cBotX = side * (halfCabW * 0.92);
    const cTopY = baseY + evalRoofH(roofEnd);
    const cCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cTopX, cTopY + 0.015, cTopZ),
      new THREE.Vector3((cTopX + cBotX) * 0.52, baseY + (cTopY - baseY) * 0.54, (cTopZ + cBotZ) * 0.5),
      new THREE.Vector3(cBotX, baseY + 0.02, cBotZ),
    ]);
    pParts.push(new THREE.TubeGeometry(cCurve, 6, spec.roofStyle === 'notchback' || spec.roofStyle === 'suv' ? 0.052 : 0.046, 6, false));
  }

  const pillarRoofGeo = mergeSimpleGeometries(pParts);
  pParts.forEach((p) => p.dispose());

  glassGeoCache.set(cacheKey, glassGeo);
  pillarGeoCache.set(cacheKey, pillarRoofGeo);
  return { glassGeo, pillarRoofGeo };
}

/**
 * Airfoil wing blade ExtrudeGeometry (real cambered downforce wing profile)
 */
function buildAirfoilWingGeometry(width: number, chord: number, thickness: number): THREE.BufferGeometry {
  const key = `${width.toFixed(2)}_${chord.toFixed(2)}_${thickness.toFixed(2)}`;
  const cached = wingGeoCache.get(key);
  if (cached) return cached;

  const s = new THREE.Shape();
  s.moveTo(-chord * 0.5, 0);
  s.quadraticCurveTo(-chord * 0.1, thickness * 0.65, chord * 0.5, thickness * 0.92);
  s.quadraticCurveTo(0, -thickness * 0.45, -chord * 0.5, 0);

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 8,
  });
  geo.translate(0, 0, -width * 0.5);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  wingGeoCache.set(key, geo);
  return geo;
}

/**
 * Contoured LatheGeometry realistic automotive tire profile with curved shoulder & sidewall bulge
 */
function buildContouredTireGeometry(wheelRadius: number, tireWidth = 0.28): THREE.BufferGeometry {
  const key = `tire_${wheelRadius.toFixed(3)}_${tireWidth.toFixed(2)}`;
  const cached = wheelTireGeoCache.get(key);
  if (cached) return cached;

  const rRim = wheelRadius * 0.72;
  const hw = tireWidth * 0.5;
  const pts = [
    new THREE.Vector2(rRim, -hw * 0.92),
    new THREE.Vector2(wheelRadius * 0.88, -hw * 1.03), // lower curved sidewall bulge
    new THREE.Vector2(wheelRadius * 0.985, -hw * 0.88), // curved tread shoulder
    new THREE.Vector2(wheelRadius, -hw * 0.42),
    new THREE.Vector2(wheelRadius, hw * 0.42),
    new THREE.Vector2(wheelRadius * 0.985, hw * 0.88),
    new THREE.Vector2(wheelRadius * 0.88, hw * 1.03),
    new THREE.Vector2(rRim, hw * 0.92),
    new THREE.Vector2(rRim, -hw * 0.92),
  ];
  const geo = new THREE.LatheGeometry(pts, 24);
  geo.rotateZ(Math.PI / 2);
  geo.computeVertexNormals();
  wheelTireGeoCache.set(key, geo);
  return geo;
}

/**
 * Stepped concave alloy wheel lip barrel + hub geometry
 */
function buildSteppedRimLipGeometry(wheelRadius: number, tireWidth = 0.28): THREE.BufferGeometry {
  const key = `rim_${wheelRadius.toFixed(3)}_${tireWidth.toFixed(2)}`;
  const cached = wheelRimGeoCache.get(key);
  if (cached) return cached;

  const rRim = wheelRadius * 0.73;
  const rInner = wheelRadius * 0.64;
  const hw = tireWidth * 0.48;
  const pts = [
    new THREE.Vector2(rInner, -hw),
    new THREE.Vector2(rRim, -hw * 0.98),
    new THREE.Vector2(rRim, -hw * 0.82),
    new THREE.Vector2(rInner, -hw * 0.68),
    new THREE.Vector2(rInner, hw * 0.68),
    new THREE.Vector2(rRim, hw * 0.82),
    new THREE.Vector2(rRim, hw * 0.98),
    new THREE.Vector2(rInner, hw),
  ];
  const geo = new THREE.LatheGeometry(pts, 22);
  geo.rotateZ(Math.PI / 2);
  geo.computeVertexNormals();
  wheelRimGeoCache.set(key, geo);
  return geo;
}

function buildCurvedCaliperGeometry(wheelRadius: number): THREE.BufferGeometry {
  const key = `cal_${wheelRadius.toFixed(3)}`;
  const cached = caliperGeoCache.get(key);
  if (cached) return cached;
  const geo = new THREE.CylinderGeometry(wheelRadius * 0.56, wheelRadius * 0.56, 0.06, 10, 1, false, 0, Math.PI * 0.36);
  geo.rotateZ(Math.PI / 2);
  caliperGeoCache.set(key, geo);
  return geo;
}

export interface SculptedCarMaterials {
  bodyMat: THREE.Material;
  accentMat: THREE.Material;
  glassMat: THREE.Material;
  carbonMat: THREE.Material;
  darkGrilleMat: THREE.Material;
  chromeMat: THREE.Material;
  goldMat: THREE.Material;
  rotorMat: THREE.Material;
  headMat: THREE.Material;
  yellowDrlMat: THREE.Material;
  amberMat: THREE.Material;
  brakeMat: THREE.Material;
  leftAmberMat: THREE.Material;
  rightAmberMat: THREE.Material;
}

export type HeadlightDesignId =
  | 'civic_hatch'
  | 'camry_sedan'
  | 'supra_mk5'
  | 'supra_mk4'
  | 'gtr_r34'
  | 'gtr_r35'
  | 'camaro'
  | 'challenger'
  | 'charger'
  | 'bmw_m4'
  | 'escalade'
  | 'porsche_911'
  | 'huracan'
  | 'bugatti_chiron'
  | 'koenigsegg'
  | 'nevera'
  | 'civ_sedan'
  | 'civ_suv'
  | 'civ_coupe';

/**
 * Maps any StreetCarModelArchetype + trim into its real-world SilhouetteKey & proportions
 */
export function resolveStreetCarSilhouette(
  archetype: StreetCarModelArchetype,
  trimId: string,
  aeroStyle: string
): { key: SculptSilhouetteKey; dim: BodyDimensions } {
  let carWidth = 1.96;
  let carLen = 4.6;
  let lowerH = 0.56;
  let cabinH = 0.44;
  let cabinLen = 2.15;
  let cabinZ = 0.08;
  let cabinWidthRatio = 0.82;
  let wheelRadius = 0.34;
  let baseY = 0.14;
  let key: SculptSilhouetteKey = 'camry_sedan';

  if (archetype === 'honda_civic') {
    key = 'civic_hatch';
    carWidth = aeroStyle === 'gt_wing' ? 1.92 : 1.85;
    carLen = 4.55;
    lowerH = 0.60;
    cabinH = 0.44;
    cabinLen = 2.34;
    cabinZ = 0.16;
    cabinWidthRatio = 0.82;
    wheelRadius = 0.335;
    baseY = 0.14;
  } else if (archetype === 'toyota_camry') {
    key = 'camry_sedan';
    carWidth = 1.88;
    carLen = 4.78;
    lowerH = 0.61;
    cabinH = 0.44;
    cabinLen = 2.38;
    cabinZ = 0.10;
    cabinWidthRatio = 0.81;
    wheelRadius = 0.34;
    baseY = 0.15;
  } else if (archetype === 'toyota_supra_mk5') {
    key = 'supra_mk5';
    carWidth = 1.96;
    carLen = 4.38;
    lowerH = 0.57;
    cabinH = 0.39;
    cabinLen = 1.78;
    cabinZ = 0.30;
    cabinWidthRatio = 0.76;
    wheelRadius = 0.335;
    baseY = 0.13;
  } else if (archetype === 'toyota_supra_mk4') {
    key = 'supra_mk4';
    carWidth = 1.94;
    carLen = 4.52;
    lowerH = 0.57;
    cabinH = 0.40;
    cabinLen = 1.94;
    cabinZ = 0.20;
    cabinWidthRatio = 0.78;
    wheelRadius = 0.335;
    baseY = 0.13;
  } else if (archetype === 'nissan_gtr_r34' || archetype === 'nissan_gtr_r34_ztune') {
    key = 'gtr_r34';
    carWidth = archetype === 'nissan_gtr_r34_ztune' ? 1.98 : 1.90;
    carLen = 4.60;
    lowerH = 0.61;
    cabinH = 0.43;
    cabinLen = 2.04;
    cabinZ = 0.14;
    cabinWidthRatio = 0.80;
    wheelRadius = 0.34;
    baseY = 0.14;
  } else if (archetype === 'nissan_gtr_r35') {
    key = 'gtr_r35';
    carWidth = 1.99;
    carLen = 4.71;
    lowerH = 0.62;
    cabinH = 0.42;
    cabinLen = 2.06;
    cabinZ = 0.10;
    cabinWidthRatio = 0.79;
    wheelRadius = 0.345;
    baseY = 0.13;
  } else if (archetype === 'chevy_camaro' || archetype === 'dodge_challenger' || archetype === 'dodge_charger') {
    key = archetype === 'chevy_camaro' ? 'camaro' : archetype === 'dodge_challenger' ? 'challenger' : 'charger';
    carWidth = aeroStyle === 'widebody_gt' ? 2.10 : 2.02;
    carLen = archetype === 'dodge_charger' ? 4.94 : 4.82;
    lowerH = 0.65;
    cabinH = 0.42;
    cabinLen = archetype === 'dodge_charger' ? 2.38 : 1.98;
    cabinZ = 0.16;
    cabinWidthRatio = 0.79;
    wheelRadius = 0.35;
    baseY = 0.15;
  } else if (archetype === 'bmw_m4') {
    key = 'bmw_m4';
    carWidth = 1.96;
    carLen = 4.72;
    lowerH = 0.60;
    cabinH = 0.43;
    cabinLen = 2.14;
    cabinZ = 0.12;
    cabinWidthRatio = 0.80;
    wheelRadius = 0.34;
    baseY = 0.13;
  } else if (archetype === 'cadillac_escalade' || archetype === 'cadillac_escalade_v') {
    key = 'escalade';
    carWidth = 2.16;
    carLen = trimId.includes('esv') ? 5.26 : 4.98;
    lowerH = 0.80;
    cabinH = 0.66;
    cabinLen = trimId.includes('esv') ? 3.50 : 3.22;
    cabinZ = 0.34;
    cabinWidthRatio = 0.87;
    wheelRadius = 0.41;
    baseY = 0.21;
  } else if (archetype === 'porsche_911') {
    key = 'porsche_911';
    carWidth = 2.02;
    carLen = 4.54;
    lowerH = 0.56;
    cabinH = 0.39;
    cabinLen = 2.04;
    cabinZ = 0.04;
    cabinWidthRatio = 0.77;
    wheelRadius = 0.34;
    baseY = 0.12;
  } else if (archetype === 'lamborghini_huracan') {
    key = 'huracan';
    carWidth = 2.08;
    carLen = 4.52;
    lowerH = 0.52;
    cabinH = 0.34;
    cabinLen = 1.95;
    cabinZ = -0.12;
    cabinWidthRatio = 0.75;
    wheelRadius = 0.335;
    baseY = 0.12;
  } else if (archetype === 'mcmurtry_speirling') {
    key = 'mcmurtry';
    carWidth = 1.66;
    carLen = 3.55;
    lowerH = 0.48;
    cabinH = 0.34;
    cabinLen = 1.48;
    cabinZ = 0.0;
    cabinWidthRatio = 0.56;
    wheelRadius = 0.30;
    baseY = 0.10;
  } else if (archetype === 'bugatti_chiron_pur_sport' || archetype === 'bugatti_chiron_super_sport') {
    key = archetype === 'bugatti_chiron_super_sport' ? 'chiron_ss' : 'chiron';
    carWidth = 2.14;
    carLen = archetype === 'bugatti_chiron_super_sport' ? 4.92 : 4.68;
    lowerH = 0.53;
    cabinH = 0.35;
    cabinLen = 1.84;
    cabinZ = -0.06;
    cabinWidthRatio = 0.74;
    wheelRadius = 0.345;
    baseY = 0.12;
  } else if (archetype === 'rimac_nevera') {
    key = 'nevera';
    carWidth = 2.12;
    carLen = 4.74;
    lowerH = 0.52;
    cabinH = 0.35;
    cabinLen = 1.86;
    cabinZ = -0.06;
    cabinWidthRatio = 0.74;
    wheelRadius = 0.34;
    baseY = 0.12;
  } else {
    key = aeroStyle === 'absolut_fins' ? 'koenigsegg_absolut' : 'koenigsegg';
    carWidth = 2.14;
    carLen = aeroStyle === 'absolut_fins' ? 4.92 : 4.68;
    lowerH = 0.51;
    cabinH = 0.34;
    cabinLen = 1.82;
    cabinZ = -0.08;
    cabinWidthRatio = 0.74;
    wheelRadius = 0.34;
    baseY = 0.12;
  }

  const { tireWidth, wheelCenterX } = getWheelTrackMetrics(key, carWidth);

  return {
    key,
    dim: {
      length: carLen,
      width: carWidth,
      lowerH,
      cabinH,
      cabinLen,
      cabinZ,
      cabinWidthRatio,
      wheelRadius,
      baseY,
      frontAxleZ: -carLen * 0.31,
      rearAxleZ: carLen * 0.31,
      tireWidth,
      wheelCenterX,
    },
  };
}

function getHeadlightClearLensMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0xdbeafe,
    roughness: 0.04,
    metalness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    envMapIntensity: 2.0,
  });
}

function buildCurvedShapeExtrudeGeometry(
  ptsCanon: Array<[number, number]>,
  side: number,
  depth: number,
  bevelThickness: number,
  bevelSize: number,
  wrapStrength: number,
  cacheMap: Map<string, THREE.BufferGeometry>,
  cacheKey: string
): THREE.BufferGeometry {
  const cached = cacheMap.get(cacheKey);
  if (cached) return cached;

  // Map canonical coordinates (-inner..+outer) into car local X (`side * canonX`) and keep CCW winding
  const mapped: Array<[number, number]> = ptsCanon.map(([cx, cy]) => [side * cx, cy]);
  if (side < 0) {
    mapped.reverse();
  }
  const shape = new THREE.Shape();
  shape.moveTo(mapped[0][0], mapped[0][1]);
  for (let i = 1; i < mapped.length; i++) {
    shape.lineTo(mapped[i][0], mapped[i][1]);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevelSize > 0,
    bevelThickness,
    bevelSize,
    bevelSegments: 2,
    curveSegments: 8,
  });
  geo.translate(0, 0, -depth * 0.5);

  if (wrapStrength > 0.001) {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      // Curve gently backward toward outer fender edge (px * side > 0)
      const outBias = Math.max(0, px * side + 0.08);
      pos.setZ(i, pos.getZ(i) + outBias * outBias * wrapStrength);
    }
    pos.needsUpdate = true;
  }
  geo.computeVertexNormals();
  cacheMap.set(cacheKey, geo);
  return geo;
}

function getHeadlightSilhouettePoints(design: HeadlightDesignId): {
  pts: Array<[number, number]>;
  wrap: number;
  tiltBack: number;
} {
  switch (design) {
    case 'supra_mk5':
      return {
        pts: [
          [-0.20, -0.068],
          [-0.08, -0.042],
          [0.14, -0.015],
          [0.21, 0.032],
          [0.18, 0.068],
          [0.02, 0.045],
          [-0.14, 0.018],
          [-0.21, -0.032],
        ],
        wrap: 0.95,
        tiltBack: 0.24,
      };
    case 'supra_mk4':
      return {
        pts: [
          [-0.18, -0.035],
          [-0.06, -0.052],
          [0.12, -0.048],
          [0.20, -0.012],
          [0.19, 0.045],
          [0.08, 0.062],
          [-0.08, 0.052],
          [-0.19, 0.015],
        ],
        wrap: 0.72,
        tiltBack: 0.22,
      };
    case 'gtr_r35':
      return {
        pts: [
          [-0.19, -0.048],
          [0.02, -0.045],
          [0.20, 0.015],
          [0.23, 0.082],
          [0.12, 0.092],
          [-0.04, 0.038],
          [-0.20, -0.008],
        ],
        wrap: 1.05,
        tiltBack: 0.34,
      };
    case 'gtr_r34':
      return {
        pts: [
          [-0.18, -0.042],
          [0.16, -0.046],
          [0.20, 0.028],
          [0.15, 0.058],
          [-0.16, 0.048],
          [-0.20, 0.002],
        ],
        wrap: 0.52,
        tiltBack: 0.14,
      };
    case 'bmw_m4':
      return {
        pts: [
          [-0.19, -0.040],
          [0.04, -0.044],
          [0.21, 0.004],
          [0.22, 0.056],
          [0.08, 0.058],
          [-0.15, 0.030],
          [-0.21, -0.005],
        ],
        wrap: 0.85,
        tiltBack: 0.20,
      };
    case 'camaro':
      return {
        pts: [
          [-0.19, -0.024],
          [0.14, -0.032],
          [0.21, 0.012],
          [0.16, 0.036],
          [-0.18, 0.028],
          [-0.21, 0.004],
        ],
        wrap: 0.65,
        tiltBack: 0.12,
      };
    case 'challenger':
      return {
        pts: [
          [-0.20, -0.046],
          [0.18, -0.048],
          [0.21, 0.026],
          [0.16, 0.052],
          [-0.18, 0.048],
          [-0.21, 0.002],
        ],
        wrap: 0.32,
        tiltBack: 0.06,
      };
    case 'charger':
      return {
        pts: [
          [-0.19, -0.038],
          [0.12, -0.046],
          [0.21, -0.008],
          [0.19, 0.050],
          [0.02, 0.048],
          [-0.17, 0.028],
          [-0.21, -0.005],
        ],
        wrap: 0.72,
        tiltBack: 0.14,
      };
    case 'porsche_911':
      return {
        pts: [
          [-0.11, -0.085],
          [0.02, -0.105],
          [0.12, -0.052],
          [0.13, 0.055],
          [0.04, 0.112],
          [-0.08, 0.088],
          [-0.13, 0.005],
        ],
        wrap: 0.55,
        tiltBack: 0.64,
      };
    case 'huracan':
      return {
        pts: [
          [-0.20, -0.028],
          [0.02, -0.042],
          [0.21, 0.012],
          [0.18, 0.056],
          [0.01, 0.046],
          [-0.17, 0.008],
        ],
        wrap: 1.15,
        tiltBack: 0.42,
      };
    case 'bugatti_chiron':
      return {
        pts: [
          [-0.18, -0.030],
          [0.17, -0.038],
          [0.20, 0.020],
          [0.14, 0.040],
          [-0.17, 0.028],
        ],
        wrap: 0.72,
        tiltBack: 0.18,
      };
    case 'koenigsegg':
      return {
        pts: [
          [-0.10, -0.095],
          [0.04, -0.065],
          [0.14, 0.035],
          [0.12, 0.125],
          [0.01, 0.115],
          [-0.08, 0.015],
          [-0.12, -0.055],
        ],
        wrap: 1.05,
        tiltBack: 0.58,
      };
    case 'nevera':
      return {
        pts: [
          [-0.21, -0.038],
          [0.04, -0.040],
          [0.21, 0.012],
          [0.19, 0.050],
          [-0.05, 0.036],
          [-0.19, 0.002],
        ],
        wrap: 1.0,
        tiltBack: 0.34,
      };
    case 'escalade':
      return {
        pts: [
          [-0.055, -0.17],
          [0.045, -0.17],
          [0.062, 0.13],
          [0.045, 0.17],
          [-0.055, 0.15],
        ],
        wrap: 0.45,
        tiltBack: 0.08,
      };
    case 'civic_hatch':
      return {
        pts: [
          [-0.19, -0.036],
          [0.11, -0.040],
          [0.20, 0.010],
          [0.16, 0.048],
          [-0.15, 0.038],
          [-0.20, -0.004],
        ],
        wrap: 0.78,
        tiltBack: 0.20,
      };
    case 'camry_sedan':
      return {
        pts: [
          [-0.20, -0.042],
          [0.05, -0.034],
          [0.21, 0.022],
          [0.16, 0.056],
          [-0.06, 0.024],
          [-0.21, -0.008],
        ],
        wrap: 0.88,
        tiltBack: 0.24,
      };
    case 'civ_suv':
      return {
        pts: [
          [-0.18, -0.052],
          [0.15, -0.050],
          [0.19, 0.015],
          [0.15, 0.062],
          [-0.17, 0.054],
          [-0.19, 0.002],
        ],
        wrap: 0.56,
        tiltBack: 0.12,
      };
    case 'civ_coupe':
      return {
        pts: [
          [-0.19, -0.040],
          [0.08, -0.042],
          [0.20, 0.018],
          [0.17, 0.058],
          [-0.05, 0.032],
          [-0.20, -0.008],
        ],
        wrap: 0.86,
        tiltBack: 0.28,
      };
    case 'civ_sedan':
    default:
      return {
        pts: [
          [-0.18, -0.042],
          [0.10, -0.044],
          [0.19, 0.008],
          [0.16, 0.052],
          [-0.14, 0.038],
          [-0.19, -0.004],
        ],
        wrap: 0.72,
        tiltBack: 0.18,
      };
  }
}

/**
 * Adds a sculpted, non-generic 3D contoured headlight assembly (beveled extruded housing,
 * glossy clear polycarbonate lens cover, inner dark reflector bucket, model-accurate LED DRL light pipes,
 * and projector optics) mounted tangentially along the hull's wraparound front fender curve.
 */
function addSignatureHeadlightCluster(
  targetGroup: THREE.Group,
  side: number,
  cx: number,
  cy: number,
  cz: number,
  yaw: number,
  mats: SculptedCarMaterials,
  design: HeadlightDesignId,
  options?: { yellowDrl?: boolean; demonAmberHalo?: boolean; drlOverrideMat?: THREE.Material }
): void {
  const { pts, wrap, tiltBack } = getHeadlightSilhouettePoints(design);
  const pod = new THREE.Group();
  pod.position.set(cx, cy, cz);
  pod.rotation.order = 'YXZ';
  pod.rotation.y = yaw;
  pod.rotation.x = tiltBack;

  // 1. Dark beveled inner reflector bezel housing
  const bezelGeo = buildCurvedShapeExtrudeGeometry(
    pts,
    side,
    0.046,
    0.008,
    0.006,
    wrap,
    headlightBezelGeoCache,
    `hl_bezel_${design}_${side}`
  );
  const bezel = new THREE.Mesh(bezelGeo, mats.darkGrilleMat);
  pod.add(bezel);

  // 2. Curved glossy polycarbonate outer lens cover
  const lensGeo = buildCurvedShapeExtrudeGeometry(
    pts,
    side,
    0.014,
    0.005,
    0.002,
    wrap,
    headlightLensGeoCache,
    `hl_lens_${design}_${side}`
  );
  const clearLens = new THREE.Mesh(lensGeo, getHeadlightClearLensMaterial());
  clearLens.position.set(0, 0, -0.022);
  clearLens.renderOrder = 2;
  pod.add(clearLens);

  const drlMat = options?.drlOverrideMat || (options?.yellowDrl ? mats.yellowDrlMat : mats.headMat);

  // 3. Model-specific optical projectors + signature LED DRL light guides
  if (design === 'porsche_911') {
    const centerOrb = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 10), mats.headMat);
    centerOrb.position.set(0, 0.004, -0.018);
    pod.add(centerOrb);

    const trimRing = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.007, 8, 20), mats.chromeMat);
    trimRing.position.set(0, 0.004, -0.016);
    pod.add(trimRing);

    // 4-point Porsche PDLS Matrix LED spots around center projector
    for (const [dx, dy] of [
      [-0.044, 0.046],
      [0.044, 0.046],
      [-0.046, -0.044],
      [0.046, -0.044],
    ]) {
      const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.024, 8), drlMat);
      dot.rotation.x = Math.PI / 2;
      dot.position.set(side * dx, dy, -0.02);
      pod.add(dot);
    }
  } else if (design === 'bugatti_chiron') {
    // 4 iconic backlit Bugatti square LED matrix cubes
    for (const qx of [-0.115, -0.038, 0.038, 0.115]) {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.032, 0.028), drlMat);
      cube.position.set(side * qx, 0, -0.018 + qx * qx * wrap * 0.45);
      pod.add(cube);
    }
  } else if (design === 'challenger') {
    // Deep dual circular Dodge Challenger Hellcat / Demon Halo rings
    for (const [idx, hx] of [-0.095, 0.095].entries()) {
      const useDemonAmber = options?.demonAmberHalo && idx === 0;
      const ringMat = useDemonAmber ? mats.amberMat : drlMat;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.009, 8, 18), ringMat);
      ring.position.set(side * hx, 0.002, -0.02);
      pod.add(ring);

      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.03, 12),
        useDemonAmber ? mats.darkGrilleMat : mats.headMat
      );
      core.rotation.x = Math.PI / 2;
      core.position.set(side * hx, 0.002, -0.016);
      pod.add(core);
    }
  } else if (design === 'charger') {
    // Signature Dodge Charger / Police Pursuit full-loop C-bracket DRLs around twin projectors
    for (const px of [-0.075, 0.065]) {
      const proj = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.032, 12), mats.headMat);
      proj.rotation.x = Math.PI / 2;
      proj.position.set(side * px, 0.003, -0.017);
      pod.add(proj);
    }
    const topPipe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.011, 0.022), drlMat);
    topPipe.position.set(0, 0.034, -0.021);
    pod.add(topPipe);
    const botPipe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.011, 0.022), drlMat);
    botPipe.position.set(0, -0.030, -0.021);
    pod.add(botPipe);
    const outerLoop = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.006, 6, 12, Math.PI), drlMat);
    outerLoop.rotation.z = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    outerLoop.position.set(side * 0.14, 0.002, -0.021);
    pod.add(outerLoop);
  } else if (design === 'huracan') {
    // Sharp Lamborghini Y-motif light pipes inside dark hex wedge
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.013, 0.024), drlMat);
    stem.rotation.z = side * 0.10;
    stem.position.set(-side * 0.055, -0.006, -0.018);
    pod.add(stem);

    const upperFork = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.012, 0.024), drlMat);
    upperFork.rotation.z = side * 0.44;
    upperFork.position.set(side * 0.09, 0.018, -0.016);
    pod.add(upperFork);

    const lowerFork = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.012, 0.024), drlMat);
    lowerFork.rotation.z = side * -0.26;
    lowerFork.position.set(side * 0.09, -0.018, -0.016);
    pod.add(lowerFork);

    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.028, 0.024), mats.headMat);
    eye.position.set(side * 0.02, 0.005, -0.015);
    pod.add(eye);
  } else if (design === 'bmw_m4') {
    // G82 twin angled C-hook / chevron LED tubes + twin laser projectors
    for (const px of [-0.075, 0.075]) {
      const proj = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.03, 12), mats.headMat);
      proj.rotation.x = Math.PI / 2;
      proj.position.set(side * px, 0.006, -0.016);
      pod.add(proj);

      const hookB = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.022), drlMat);
      hookB.rotation.z = side * 0.25;
      hookB.position.set(side * px, -0.022, -0.02);
      pod.add(hookB);

      const hookV = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.048, 0.022), drlMat);
      hookV.rotation.z = side * -0.35;
      hookV.position.set(side * (px + 0.038), -0.002, -0.02);
      pod.add(hookV);
    }
  } else if (design === 'gtr_r35') {
    // GT-R R35 lightning-bolt DRL + triple stacked projectors
    for (const [idx, px] of [-0.055, 0.035, 0.115].entries()) {
      const proj = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.03, 12), mats.headMat);
      proj.rotation.x = Math.PI / 2;
      proj.position.set(side * px, 0.004 + idx * 0.012, -0.016 + px * px * wrap * 0.4);
      pod.add(proj);
    }
    const bolt1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.013, 0.024), drlMat);
    bolt1.rotation.z = side * 0.22;
    bolt1.position.set(-side * 0.04, -0.024, -0.02);
    pod.add(bolt1);
    const bolt2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.013, 0.024), drlMat);
    bolt2.rotation.z = side * 0.45;
    bolt2.position.set(side * 0.11, 0.006, -0.014);
    pod.add(bolt2);
  } else if (design === 'supra_mk5') {
    // 6-LED upper cube strip + downward inner fang DRL
    for (const sx of [-0.06, 0.02, 0.10]) {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.022, 0.026), mats.headMat);
      cube.position.set(side * sx, 0.016, -0.016 + sx * sx * wrap * 0.35);
      pod.add(cube);
    }
    const lowerBlade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.012, 0.024), drlMat);
    lowerBlade.rotation.z = side * 0.16;
    lowerBlade.position.set(side * 0.02, -0.014, -0.02);
    pod.add(lowerBlade);
    const fang = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.013, 0.024), drlMat);
    fang.rotation.z = side * 0.58;
    fang.position.set(-side * 0.13, -0.036, -0.02);
    pod.add(fang);
  } else if (design === 'supra_mk4') {
    // 4 classic round reflector barrels inside smoked teardrop pod
    for (const [idx, px] of [-0.11, -0.02, 0.07, 0.14].entries()) {
      const rad = idx === 0 ? 0.018 : idx === 3 ? 0.021 : 0.028;
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(rad, rad, 0.032, 12),
        idx === 0 ? mats.amberMat : mats.headMat
      );
      lens.rotation.x = Math.PI / 2;
      lens.position.set(side * px, 0.002, -0.015);
      pod.add(lens);
    }
  } else if (design === 'koenigsegg') {
    // Vertical stacked twin pearl projectors + crescent boomerang DRL blade
    for (const [py, px] of [
      [-0.042, -0.035],
      [0.032, 0.025],
    ]) {
      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), mats.headMat);
      pearl.position.set(side * px, py, -0.018);
      pod.add(pearl);
    }
    const crescent = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.19, 0.024), drlMat);
    crescent.rotation.z = side * -0.56;
    crescent.position.set(side * 0.032, 0.008, -0.02);
    pod.add(crescent);
  } else if (design === 'escalade') {
    // 3 stacked vertical crystal LED cubes inside tall Escalade tower
    for (const cyOff of [-0.09, 0.0, 0.09]) {
      const crystal = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.065, 0.032), mats.headMat);
      crystal.position.set(0, cyOff, -0.018);
      pod.add(crystal);
    }
    const pipe = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.28, 0.024), drlMat);
    pipe.position.set(side * 0.032, 0, -0.022);
    pod.add(pipe);
  } else if (design === 'camry_sedan') {
    // Dual projectors + 3 signature Camry feather-tick DRL blades
    for (const px of [-0.08, 0.01]) {
      const proj = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.03, 12), mats.headMat);
      proj.rotation.x = Math.PI / 2;
      proj.position.set(side * px, 0.004, -0.017);
      pod.add(proj);
    }
    for (const [idx, tx] of [0.07, 0.115, 0.16].entries()) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.010, 0.022), drlMat);
      tick.rotation.z = side * 0.42;
      tick.position.set(side * tx, -0.012 + idx * 0.014, -0.016);
      pod.add(tick);
    }
  } else {
    // Swept dual/triple projector pods + upper/lower L-blade DRL (Civic, R34, Camaro, Nevera, Civilians)
    for (const px of [-0.075, 0.065]) {
      const proj = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.03, 12), mats.headMat);
      proj.rotation.x = Math.PI / 2;
      proj.position.set(side * px, 0.005, -0.017);
      pod.add(proj);
    }
    const drlRibbon = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.013, 0.024), drlMat);
    drlRibbon.rotation.z = side * (design === 'camaro' ? 0.08 : 0.14);
    drlRibbon.position.set(0, -0.022, -0.02);
    pod.add(drlRibbon);

    if (design === 'gtr_r34') {
      const amberCorner = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.024), mats.amberMat);
      amberCorner.position.set(side * 0.145, 0.004, -0.016);
      pod.add(amberCorner);
    }
  }

  targetGroup.add(pod);
}

/**
 * Contoured wraparound front aerodynamic splitter matching nose taper & sweep
 */
function buildContouredSplitterGeometry(key: SculptSilhouetteKey, dim: BodyDimensions): THREE.BufferGeometry {
  const cacheKey = `splitter_${key}_${dim.width.toFixed(2)}_${dim.length.toFixed(2)}`;
  const cached = splitterGeoCache.get(cacheKey);
  if (cached) return cached;

  const spec = getProfileSpec(key, dim);
  const hw = dim.width * 0.465 * (1 - spec.noseTaper * 0.65);
  const depth = dim.length * 0.11;
  const sweep = spec.frontSweep * 0.85;

  const shape = new THREE.Shape();
  shape.moveTo(-hw, sweep + depth);
  shape.quadraticCurveTo(0, depth * 0.6, hw, sweep + depth);
  shape.lineTo(hw * 0.96, sweep);
  shape.quadraticCurveTo(0, -0.04, -hw * 0.96, sweep);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.028,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 1,
    curveSegments: 8,
  });
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  splitterGeoCache.set(cacheKey, geo);
  return geo;
}

/**
 * Adds a sculpted 3D real-world street/hypercar bodywork mesh + accurate signature front/side/rear styling.
 */
export function buildSculptedStreetCarBody(
  targetGroup: THREE.Group,
  archetype: StreetCarModelArchetype,
  trimId: string,
  aeroStyle: string,
  mats: SculptedCarMaterials
): BodyDimensions {
  const { key, dim } = resolveStreetCarSilhouette(archetype, trimId, aeroStyle);
  const {
    length: carLen,
    width: carWidth,
    lowerH,
    cabinH,
    cabinLen,
    cabinZ,
    wheelRadius,
    baseY: baseChassisY,
  } = dim;

  // 1. Compound-Curved 3D Multi-Station Lofted Hull + Dark Concave Wheel Wells
  const hullGeo = buildLoftedLowerHullGeometry(key, dim);
  const hullMesh = new THREE.Mesh(hullGeo, mats.bodyMat);
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  targetGroup.add(hullMesh);

  const wellMesh = new THREE.Mesh(buildWheelWellLinersGeometry(dim), mats.darkGrilleMat);
  targetGroup.add(wellMesh);

  // Sculpted Side Carbon Rocker Skirts (cleanly sized between front and rear wheel arches)
  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.045, carLen * 0.37),
      mats.carbonMat
    );
    skirt.position.set(side * (carWidth * 0.465), baseChassisY + 0.032, 0.0);
    targetGroup.add(skirt);
  }

  // Contoured Tapered Front Aero Splitter Lip + Rear Venturi Diffuser with vertical aero strakes
  const splitterMat =
    archetype === 'toyota_camry' && trimId === 'camry_trd_v6' ? mats.accentMat : mats.carbonMat;
  const splitter = new THREE.Mesh(buildContouredSplitterGeometry(key, dim), splitterMat);
  splitter.position.set(0, baseChassisY + 0.025, -carLen * 0.50);
  targetGroup.add(splitter);

  const diffuser = new THREE.Mesh(
    new THREE.BoxGeometry(carWidth * 0.76, 0.11, 0.18),
    mats.carbonMat
  );
  diffuser.position.set(0, baseChassisY + 0.075, carLen * 0.455);
  targetGroup.add(diffuser);
  for (const fx of [-0.42, -0.18, 0.18, 0.42]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.10, 0.16), mats.carbonMat);
    fin.position.set(fx * carWidth * 0.48, baseChassisY + 0.075, carLen * 0.475);
    targetGroup.add(fin);
  }

  // 2. Compound-Curved Lofted Greenhouse Glass + Painted Roof & A/C Pillars
  const { glassGeo, pillarRoofGeo } = buildLoftedGreenhouseParts(key, dim);
  const canopyMesh = new THREE.Mesh(glassGeo, mats.glassMat);
  canopyMesh.castShadow = true;
  targetGroup.add(canopyMesh);

  const useCarbonRoof =
    archetype === 'bmw_m4' ||
    trimId === 'camry_xse_v6' ||
    trimId === 'camry_trd_v6' ||
    trimId === 'gtr_r35_nismo' ||
    trimId === 'jesko_absolut_knc_gold';

  const roofMesh = new THREE.Mesh(pillarRoofGeo, useCarbonRoof ? mats.carbonMat : mats.bodyMat);
  roofMesh.castShadow = true;
  targetGroup.add(roofMesh);

  // Contoured Aero Side Mirrors on Stalks
  if (archetype !== 'mcmurtry_speirling') {
    for (const side of [-1, 1]) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.09, 6), mats.carbonMat);
      stalk.rotation.z = side * -0.55;
      stalk.position.set(side * (carWidth * 0.42), baseChassisY + lowerH + 0.04, cabinZ - cabinLen * 0.34);
      targetGroup.add(stalk);

      const mirrorCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.072, 10, 8),
        useCarbonRoof ? mats.carbonMat : mats.bodyMat
      );
      mirrorCap.scale.set(1.25, 0.68, 0.85);
      mirrorCap.rotation.y = side * 0.22;
      mirrorCap.position.set(side * (carWidth * 0.48), baseChassisY + lowerH + 0.075, cabinZ - cabinLen * 0.34);
      targetGroup.add(mirrorCap);
    }
  }

  // ============================================================================
  // SIGNATURE FRONT GRILLES, SCULPTED CONTOURED HEADLIGHTS, TAILLIGHTS & EXHAUSTS
  // ============================================================================
  const frontZ = -carLen * 0.485;
  const rearZ = carLen * 0.485;
  const tlY = baseChassisY + lowerH * 0.68;

  if (archetype === 'honda_civic') {
    const upperGrille = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.44, 0.06, 0.065), mats.darkGrilleMat);
    upperGrille.position.set(0, baseChassisY + lowerH * 0.60, frontZ - 0.008);
    targetGroup.add(upperGrille);

    const lowerHoneycomb = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.68, 0.15, 0.065), mats.darkGrilleMat);
    lowerHoneycomb.position.set(0, baseChassisY + lowerH * 0.25, frontZ);
    targetGroup.add(lowerHoneycomb);

    const badgeMat = trimId === 'civic_type_r' ? new THREE.MeshBasicMaterial({ color: 0xdc2626 }) : mats.chromeMat;
    const frontBadge = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.072, 0.065), badgeMat);
    frontBadge.position.set(0, baseChassisY + lowerH * 0.62, frontZ - 0.016);
    targetGroup.add(frontBadge);

    for (const side of [-1, 1]) {
      const hl = evalFasciaAnchor(key, dim, side, 0.67, 0.78, 'front');
      addSignatureHeadlightCluster(targetGroup, side, hl.x, hl.y, hl.z, hl.yaw, mats, 'civic_hatch');
      const tlPos = evalFasciaAnchor(key, dim, side, 0.66, 0.72, 'rear');
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.09, 0.055), mats.brakeMat);
      tl.rotation.y = tlPos.yaw;
      tl.position.set(tlPos.x, tlPos.y, tlPos.z);
      targetGroup.add(tl);
    }

    if (trimId === 'civic_type_r') {
      const hoodVent = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.024, 0.28), mats.carbonMat);
      hoodVent.position.set(0, baseChassisY + lowerH * 0.89, -carLen * 0.29);
      targetGroup.add(hoodVent);

      for (const exX of [-0.13, 0, 0.13]) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.12, 10), mats.chromeMat);
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(exX, baseChassisY + 0.11, rearZ + 0.01);
        targetGroup.add(pipe);
      }
    }
  } else if (archetype === 'toyota_camry') {
    const trapGrille = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.70, 0.20, 0.065), mats.darkGrilleMat);
    trapGrille.position.set(0, baseChassisY + lowerH * 0.29, frontZ);
    targetGroup.add(trapGrille);

    const upperVBar = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.40, 0.05, 0.065), mats.chromeMat);
    upperVBar.position.set(0, baseChassisY + lowerH * 0.62, frontZ - 0.008);
    targetGroup.add(upperVBar);

    for (const side of [-1, 1]) {
      const hl = evalFasciaAnchor(key, dim, side, 0.67, 0.78, 'front');
      addSignatureHeadlightCluster(targetGroup, side, hl.x, hl.y, hl.z, hl.yaw, mats, 'camry_sedan');
      const tlPos = evalFasciaAnchor(key, dim, side, 0.66, 0.72, 'rear');
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.085, 0.055), mats.brakeMat);
      tl.rotation.y = tlPos.yaw;
      tl.position.set(tlPos.x, tlPos.y, tlPos.z);
      targetGroup.add(tl);
    }

    if (trimId === 'camry_trd_v6') {
      const redLip = new THREE.Mesh(
        new THREE.BoxGeometry(carWidth * 0.84, 0.022, 0.065),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      redLip.position.set(0, baseChassisY + 0.024, frontZ + 0.01);
      targetGroup.add(redLip);
    }
  } else if (archetype === 'toyota_supra_mk5') {
    const centerNose = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.17, 0.15, 12), mats.bodyMat);
    centerNose.rotation.x = Math.PI / 2;
    centerNose.position.set(0, baseChassisY + lowerH * 0.40, frontZ - 0.035);
    targetGroup.add(centerNose);

    for (const side of [-1, 1]) {
      const intake = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.15, 0.06), mats.darkGrilleMat);
      intake.rotation.y = side * 0.22;
      intake.position.set(side * 0.43, baseChassisY + lowerH * 0.28, frontZ + 0.05);
      targetGroup.add(intake);

      const hl = evalFasciaAnchor(key, dim, side, 0.66, 0.80, 'front');
      addSignatureHeadlightCluster(targetGroup, side, hl.x, hl.y, hl.z + 0.02, hl.yaw, mats, 'supra_mk5');

      const tlPos = evalFasciaAnchor(key, dim, side, 0.66, 0.72, 'rear');
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.072, 0.055), mats.brakeMat);
      tl.rotation.y = tlPos.yaw;
      tl.position.set(tlPos.x, tlPos.y, tlPos.z);
      targetGroup.add(tl);
    }
    const ducktail = new THREE.Mesh(
      buildAirfoilWingGeometry(carWidth * 0.78, 0.15, 0.055),
      mats.bodyMat
    );
    ducktail.position.set(0, baseChassisY + lowerH * 0.98, carLen * 0.45);
    targetGroup.add(ducktail);
  } else if (archetype === 'toyota_supra_mk4') {
    const frontMouth = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.54, 0.16, 0.065), mats.darkGrilleMat);
    frontMouth.position.set(0, baseChassisY + lowerH * 0.29, frontZ);
    targetGroup.add(frontMouth);

    for (const side of [-1, 1]) {
      const hl = evalFasciaAnchor(key, dim, side, 0.66, 0.78, 'front');
      addSignatureHeadlightCluster(targetGroup, side, hl.x, hl.y, hl.z + 0.015, hl.yaw, mats, 'supra_mk4');

      const tlPos = evalFasciaAnchor(key, dim, side, 0.65, 0.70, 'rear');
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.11, 0.05), mats.darkGrilleMat);
      housing.rotation.y = tlPos.yaw;
      housing.position.set(tlPos.x, tlPos.y, tlPos.z - 0.01);
      targetGroup.add(housing);
      for (const ringOff of [-0.105, 0.0, 0.105]) {
        const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.055, 12), mats.brakeMat);
        bulb.rotation.x = Math.PI / 2;
        bulb.position.set(tlPos.x + ringOff, tlPos.y, tlPos.z);
        targetGroup.add(bulb);
      }

      const hoopSide = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.27, 0.19), mats.bodyMat);
      hoopSide.rotation.z = side * -0.14;
      hoopSide.position.set(side * (carWidth * 0.37), baseChassisY + lowerH + 0.12, carLen * 0.42);
      targetGroup.add(hoopSide);
    }
    const hoopTop = new THREE.Mesh(
      buildAirfoilWingGeometry(carWidth * 0.80, 0.23, 0.042),
      mats.bodyMat
    );
    hoopTop.position.set(0, baseChassisY + lowerH + 0.25, carLen * 0.42);
    targetGroup.add(hoopTop);
  } else if (
    archetype === 'nissan_gtr_r34' ||
    archetype === 'nissan_gtr_r34_ztune' ||
    archetype === 'nissan_gtr_r35'
  ) {
    const intercooler = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.50, 0.17, 0.065), mats.chromeMat);
    intercooler.position.set(0, baseChassisY + lowerH * 0.26, frontZ + 0.01);
    targetGroup.add(intercooler);

    const upperGrille = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.44, 0.095, 0.065), mats.darkGrilleMat);
    upperGrille.position.set(0, baseChassisY + lowerH * 0.60, frontZ - 0.005);
    targetGroup.add(upperGrille);

    const gtrDesign: HeadlightDesignId = archetype === 'nissan_gtr_r35' ? 'gtr_r35' : 'gtr_r34';
    for (const side of [-1, 1]) {
      const hl = evalFasciaAnchor(key, dim, side, 0.68, 0.82, 'front');
      addSignatureHeadlightCluster(
        targetGroup,
        side,
        hl.x,
        hl.y,
        hl.z + (gtrDesign === 'gtr_r35' ? 0.025 : 0.01),
        hl.yaw,
        mats,
        gtrDesign
      );

      for (const [idx, ringOff] of [-0.115, 0.115].entries()) {
        const isOuter = (side < 0 && idx === 0) || (side > 0 && idx === 1);
        const rRadius = isOuter ? 0.065 : 0.050;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(rRadius, 0.015, 8, 16), mats.brakeMat);
        ring.position.set(side * (carWidth * 0.30) + ringOff, tlY - 0.02, rearZ + 0.005);
        targetGroup.add(ring);
      }
    }
  } else if (
    archetype === 'chevy_camaro' ||
    archetype === 'dodge_challenger' ||
    archetype === 'dodge_charger'
  ) {
    const recessedGrille = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.74, 0.145, 0.065), mats.darkGrilleMat);
    recessedGrille.position.set(0, baseChassisY + lowerH * 0.60, frontZ);
    targetGroup.add(recessedGrille);

    const scoopMat =
      trimId === 'camaro_zl1_1le' || trimId === 'challenger_demon_170' || trimId === 'charger_king_daytona'
        ? mats.carbonMat
        : mats.bodyMat;
    const hoodScoop = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.35, 0.065, carLen * 0.22), scoopMat);
    hoodScoop.position.set(0, baseChassisY + lowerH * 0.99, -carLen * 0.22);
    targetGroup.add(hoodScoop);

    const muscleDesign: HeadlightDesignId =
      archetype === 'dodge_challenger'
        ? 'challenger'
        : archetype === 'dodge_charger'
        ? 'charger'
        : 'camaro';

    for (const side of [-1, 1]) {
      const hl = evalFasciaAnchor(key, dim, side, 0.66, 0.78, 'front');
      addSignatureHeadlightCluster(targetGroup, side, hl.x, hl.y, hl.z + 0.005, hl.yaw, mats, muscleDesign, {
        demonAmberHalo: archetype === 'dodge_challenger' && (trimId.includes('demon') || trimId.includes('hellcat')),
      });
    }

    if (archetype === 'dodge_charger') {
      const racetrackBar = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.80, 0.11, 0.055), mats.brakeMat);
      racetrackBar.position.set(0, tlY - 0.02, rearZ);
      targetGroup.add(racetrackBar);
    } else {
      for (const side of [-1, 1]) {
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.105, 0.055), mats.brakeMat);
        tl.position.set(side * (carWidth * 0.31), tlY - 0.02, rearZ);
        targetGroup.add(tl);
      }
    }
  } else if (archetype === 'bmw_m4') {
    for (const kSide of [-1, 1]) {
      const kidney = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.27, 0.065), mats.darkGrilleMat);
      kidney.position.set(kSide * 0.125, baseChassisY + lowerH * 0.44, frontZ - 0.014);
      targetGroup.add(kidney);

      if (trimId === 'bmw_m4_csl') {
        const redTrim = new THREE.Mesh(
          new THREE.BoxGeometry(0.215, 0.295, 0.052),
          new THREE.MeshBasicMaterial({ color: 0xef4444 })
        );
        redTrim.position.set(kSide * 0.125, baseChassisY + lowerH * 0.44, frontZ);
        targetGroup.add(redTrim);
      }

      const hl = evalFasciaAnchor(key, dim, kSide, 0.68, 0.80, 'front');
      addSignatureHeadlightCluster(targetGroup, kSide, hl.x, hl.y, hl.z + 0.01, hl.yaw, mats, 'bmw_m4', {
        yellowDrl: trimId === 'bmw_m4_csl',
      });

      const tlPos = evalFasciaAnchor(key, dim, kSide, 0.66, 0.72, 'rear');
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.09, 0.055), mats.brakeMat);
      tl.rotation.y = tlPos.yaw;
      tl.position.set(tlPos.x, tlPos.y, tlPos.z);
      targetGroup.add(tl);
    }
  } else if (archetype === 'cadillac_escalade' || archetype === 'cadillac_escalade_v') {
    const shieldGrille = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.56, lowerH * 0.54, 0.075),
      archetype === 'cadillac_escalade_v' || trimId === 'escalade_sport_platinum'
        ? mats.darkGrilleMat
        : mats.chromeMat
    );
    shieldGrille.position.set(0, baseChassisY + lowerH * 0.50, frontZ - 0.01);
    targetGroup.add(shieldGrille);

    for (const side of [-1, 1]) {
      const tower = evalFasciaAnchor(key, dim, side, 0.78, 0.56, 'front');
      addSignatureHeadlightCluster(targetGroup, side, tower.x, tower.y, tower.z, tower.yaw, mats, 'escalade');

      // Razor horizontal upper brow LED bar & corner wing
      const brow = evalFasciaAnchor(key, dim, side, 0.67, 0.90, 'front');
      const upperBrow = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.036, 0.055), mats.headMat);
      upperBrow.rotation.y = brow.yaw;
      upperBrow.position.set(brow.x, brow.y, brow.z - 0.006);
      targetGroup.add(upperBrow);

      const pillarTl = new THREE.Mesh(
        new THREE.BoxGeometry(0.082, lowerH * 0.52 + cabinH * 0.76, 0.065),
        mats.brakeMat
      );
      pillarTl.position.set(side * (carWidth * 0.40), baseChassisY + lowerH * 0.66 + cabinH * 0.34, rearZ);
      targetGroup.add(pillarTl);
    }

    if (archetype === 'cadillac_escalade_v') {
      for (const exX of [-0.62, -0.48, 0.48, 0.62]) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.13, 10), mats.chromeMat);
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(exX, baseChassisY + 0.12, rearZ);
        targetGroup.add(pipe);
      }
    }
  } else if (archetype === 'porsche_911') {
    const centralRad = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.42, 0.13, 0.055), mats.darkGrilleMat);
    centralRad.position.set(0, baseChassisY + lowerH * 0.25, frontZ + 0.015);
    targetGroup.add(centralRad);

    for (const side of [-1, 1]) {
      // Porsche 992 fender-mounted canted oval PDLS Matrix pods
      const hl = evalFasciaAnchor(key, dim, side, 0.66, 0.92, 'front');
      addSignatureHeadlightCluster(
        targetGroup,
        side,
        hl.x,
        hl.y + 0.035,
        hl.z + 0.085,
        hl.yaw * 0.85,
        mats,
        'porsche_911'
      );
    }
    const rearLightStrip = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.78, 0.05, 0.055), mats.brakeMat);
    rearLightStrip.position.set(0, tlY - 0.02, rearZ);
    targetGroup.add(rearLightStrip);
  } else if (archetype === 'lamborghini_huracan') {
    const yIntake = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.68, 0.14, 0.065), mats.darkGrilleMat);
    yIntake.position.set(0, baseChassisY + lowerH * 0.25, frontZ + 0.025);
    targetGroup.add(yIntake);

    for (const side of [-1, 1]) {
      const hl = evalFasciaAnchor(key, dim, side, 0.64, 0.88, 'front');
      addSignatureHeadlightCluster(targetGroup, side, hl.x, hl.y + 0.02, hl.z + 0.045, hl.yaw, mats, 'huracan');

      const tlPos = evalFasciaAnchor(key, dim, side, 0.64, 0.72, 'rear');
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.058, 0.055), mats.brakeMat);
      tl.rotation.y = tlPos.yaw;
      tl.position.set(tlPos.x, tlPos.y - 0.01, tlPos.z);
      targetGroup.add(tl);
    }
    if (trimId === 'huracan_sto') {
      const roofScoop = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.11, 0.48), mats.accentMat);
      roofScoop.position.set(0, baseChassisY + lowerH * 0.90 + cabinH + 0.05, cabinZ + 0.20);
      targetGroup.add(roofScoop);

      const sharkFin = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.19, 0.86), mats.accentMat);
      sharkFin.position.set(0, baseChassisY + lowerH + 0.15, carLen * 0.26);
      targetGroup.add(sharkFin);
    }
  } else if (archetype === 'mcmurtry_speirling') {
    const dorsalFin = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.22, 1.02), mats.accentMat);
    dorsalFin.position.set(0, baseChassisY + lowerH + 0.17, carLen * 0.24);
    targetGroup.add(dorsalFin);

    for (const side of [-1, 1]) {
      const hl = evalFasciaAnchor(key, dim, side, 0.64, 0.82, 'front');
      addSignatureHeadlightCluster(targetGroup, side, hl.x, hl.y + 0.01, hl.z + 0.04, hl.yaw, mats, 'koenigsegg');
      const fanHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.14, 16), mats.carbonMat);
      fanHousing.rotation.x = Math.PI / 2;
      fanHousing.position.set(side * 0.28, baseChassisY + 0.21, rearZ - 0.02);
      targetGroup.add(fanHousing);

      const fanGoldRing = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.16, 16), mats.goldMat);
      fanGoldRing.rotation.x = Math.PI / 2;
      fanGoldRing.position.set(side * 0.28, baseChassisY + 0.21, rearZ - 0.01);
      targetGroup.add(fanGoldRing);
    }
  } else if (archetype === 'bugatti_chiron_pur_sport' || archetype === 'bugatti_chiron_super_sport') {
    const horseshoeRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.030, 10, 20), mats.chromeMat);
    horseshoeRing.scale.set(0.95, 1.24, 1.0);
    horseshoeRing.position.set(0, baseChassisY + lowerH * 0.40, frontZ - 0.018);
    targetGroup.add(horseshoeRing);

    const horseshoeCore = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.075, 16), mats.darkGrilleMat);
    horseshoeCore.rotation.x = Math.PI / 2;
    horseshoeCore.scale.set(0.95, 1.0, 1.20);
    horseshoeCore.position.set(0, baseChassisY + lowerH * 0.40, frontZ - 0.012);
    targetGroup.add(horseshoeCore);

    for (const side of [-1, 1]) {
      const hl = evalFasciaAnchor(key, dim, side, 0.65, 0.80, 'front');
      addSignatureHeadlightCluster(targetGroup, side, hl.x, hl.y, hl.z + 0.015, hl.yaw, mats, 'bugatti_chiron');

      const cLineArch = new THREE.Mesh(
        new THREE.TorusGeometry(cabinH * 0.88, 0.030, 8, 18, Math.PI * 1.12),
        mats.accentMat
      );
      cLineArch.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      cLineArch.rotation.z = -Math.PI * 0.55;
      cLineArch.position.set(side * (carWidth * 0.455), baseChassisY + lowerH * 0.82, cabinZ + 0.10);
      targetGroup.add(cLineArch);
    }

    const rearBlade = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.80, 0.052, 0.055), mats.brakeMat);
    rearBlade.position.set(0, tlY - 0.02, rearZ);
    targetGroup.add(rearBlade);

    if (trimId === 'chiron_ss_300plus') {
      for (const sOff of [-0.14, 0.14]) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.018, carLen * 0.88), mats.accentMat);
        stripe.position.set(sOff, baseChassisY + lowerH + 0.03, 0);
        targetGroup.add(stripe);
      }
    }
  } else {
    // Koenigsegg Regera / Agera RS / Jesko & Rimac Nevera
    const centerStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.018, carLen * 0.85),
      trimId === 'jesko_absolut_knc_gold' || trimId === 'agera_rs_gryphon' ? mats.goldMat : mats.accentMat
    );
    centerStrip.position.set(0, baseChassisY + lowerH + 0.02, 0);
    targetGroup.add(centerStrip);

    const hyperDesign: HeadlightDesignId = archetype === 'rimac_nevera' ? 'nevera' : 'koenigsegg';
    for (const side of [-1, 1]) {
      const hl = evalFasciaAnchor(key, dim, side, 0.65, 0.88, 'front');
      addSignatureHeadlightCluster(
        targetGroup,
        side,
        hl.x,
        hl.y + 0.02,
        hl.z + (hyperDesign === 'koenigsegg' ? 0.075 : 0.035),
        hl.yaw,
        mats,
        hyperDesign
      );
      const tlPos = evalFasciaAnchor(key, dim, side, 0.65, 0.72, 'rear');
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.072, 0.055), mats.brakeMat);
      tl.rotation.y = tlPos.yaw;
      tl.position.set(tlPos.x, tlPos.y - 0.01, tlPos.z);
      targetGroup.add(tl);
    }
  }

  // ============================================================================
  // CAMBERED AIRFOIL GT WINGS / ABSOLUT DORSAL FINS / TRUNK LIP SPOILERS
  // ============================================================================
  if (aeroStyle === 'absolut_fins') {
    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.036, 0.29, 0.88),
        trimId === 'jesko_absolut_knc_gold' ? mats.goldMat : mats.accentMat
      );
      fin.position.set(side * 0.30, baseChassisY + lowerH + 0.14, carLen * 0.33);
      targetGroup.add(fin);
    }
  } else if (aeroStyle === 'gt_wing' || aeroStyle === 'widebody_gt') {
    const wingHeight = aeroStyle === 'widebody_gt' ? 0.33 : 0.23;
    const wingWidth = aeroStyle === 'widebody_gt' ? carWidth * 0.94 : carWidth * 0.86;
    const wingMat = trimId === 'jesko_attack' || trimId === 'agera_rs_gryphon' ? mats.accentMat : mats.carbonMat;

    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.042, wingHeight, 0.15), mats.carbonMat);
      strut.position.set(side * (carWidth * 0.26), baseChassisY + lowerH + wingHeight * 0.5, carLen * 0.41);
      targetGroup.add(strut);

      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.17, 0.32), wingMat);
      endplate.position.set(side * (wingWidth * 0.5), baseChassisY + lowerH + wingHeight, carLen * 0.42);
      targetGroup.add(endplate);
    }

    const wingBlade = new THREE.Mesh(buildAirfoilWingGeometry(wingWidth, 0.28, 0.042), wingMat);
    wingBlade.position.set(0, baseChassisY + lowerH + wingHeight, carLen * 0.42);
    targetGroup.add(wingBlade);
  } else if (
    aeroStyle === 'sport_spoiler' &&
    archetype !== 'cadillac_escalade' &&
    archetype !== 'cadillac_escalade_v'
  ) {
    const lipSpoiler = new THREE.Mesh(
      buildAirfoilWingGeometry(carWidth * 0.80, 0.15, 0.04),
      mats.carbonMat
    );
    lipSpoiler.position.set(0, baseChassisY + lowerH + 0.02, carLen * 0.44);
    targetGroup.add(lipSpoiler);
  }

  // ============================================================================
  // 4 CONTOURED LATHE TIRES + STEPPED ALLOY LIPS + Y-SPOKE WHEELS + CALIPERS
  // ============================================================================
  const { tireWidth, wheelCenterX } = dim;
  const wheelGeom = buildContouredTireGeometry(wheelRadius, tireWidth);
  const rimBarrelGeom = buildSteppedRimLipGeometry(wheelRadius, tireWidth);
  const brakeDiscGeom = new THREE.CylinderGeometry(wheelRadius * 0.57, wheelRadius * 0.57, 0.04, 18);
  brakeDiscGeom.rotateZ(Math.PI / 2);
  const caliperGeom = buildCurvedCaliperGeometry(wheelRadius);

  const rimMaterial =
    trimId === 'jesko_absolut_knc_gold' ||
    trimId === 'agera_rs_gryphon' ||
    archetype === 'mcmurtry_speirling'
      ? mats.goldMat
      : aeroStyle === 'widebody_gt'
      ? mats.carbonMat
      : mats.chromeMat;

  const caliperColorHex =
    archetype === 'koenigsegg_jesko'
      ? 0x84cc16
      : archetype === 'porsche_911' || archetype === 'nissan_gtr_r34_ztune' || archetype === 'nissan_gtr_r35'
      ? 0xfbbf24
      : archetype === 'bugatti_chiron_pur_sport' || archetype === 'rimac_nevera'
      ? 0x38bdf8
      : 0xef4444;
  const caliperMat = new THREE.MeshStandardMaterial({
    color: caliperColorHex,
    metalness: 0.65,
    roughness: 0.22,
  });

  const wheelCoords = [
    [-wheelCenterX, wheelRadius, dim.frontAxleZ],
    [wheelCenterX, wheelRadius, dim.frontAxleZ],
    [-wheelCenterX, wheelRadius, dim.rearAxleZ],
    [wheelCenterX, wheelRadius, dim.rearAxleZ],
  ];
  for (const [wx, wy, wz] of wheelCoords) {
    const tireMesh = new THREE.Mesh(wheelGeom, mats.darkGrilleMat);
    tireMesh.position.set(wx, wy, wz);

    const rimMesh = new THREE.Mesh(rimBarrelGeom, rimMaterial);
    tireMesh.add(rimMesh);

    const outX = wx < 0 ? -0.10 : 0.10;
    const discMesh = new THREE.Mesh(brakeDiscGeom, mats.rotorMat);
    discMesh.position.set(outX * 0.62, 0, 0);
    tireMesh.add(discMesh);

    const caliperMesh = new THREE.Mesh(caliperGeom, caliperMat);
    caliperMesh.position.set(outX * 0.68, 0, 0);
    caliperMesh.rotation.x = wz < 0 ? 0.35 : -2.25;
    tireMesh.add(caliperMesh);

    for (let sIdx = 0; sIdx < 5; sIdx++) {
      const baseAng = (sIdx * Math.PI * 2) / 5;
      for (const ySplit of [-0.14, 0.14]) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.020, wheelRadius * 0.65, 0.022), rimMaterial);
        const a = baseAng + ySplit;
        spoke.rotation.x = a;
        spoke.position.set(outX * 1.12, Math.cos(a) * wheelRadius * 0.32, Math.sin(a) * wheelRadius * 0.32);
        tireMesh.add(spoke);
      }
    }

    const centerCap = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.035, 12), rimMaterial);
    centerCap.rotation.z = Math.PI / 2;
    centerCap.position.set(outX * 1.15, 0, 0);
    tireMesh.add(centerCap);

    targetGroup.add(tireMesh);
  }

  return dim;
}

/**
 * Attaches sculpted civilian traffic bodywork (cached smooth 3D lofted hulls + signature headlights)
 */
export function buildSculptedCivilianHull(
  targetGroup: THREE.Group,
  style: 'sedan' | 'suv' | 'coupe',
  bodyMat: THREE.Material,
  glassMat: THREE.Material,
  trimMat: THREE.Material,
  chromeMat: THREE.Material,
  carbonMat: THREE.Material,
  headMat: THREE.Material,
  drlMat: THREE.Material,
  brakeLightMatL: THREE.Material,
  brakeLightMatR: THREE.Material,
  leftAmberMat: THREE.Material,
  rightAmberMat: THREE.Material
): {
  dim: BodyDimensions;
  taillightBar: THREE.Mesh;
  wheels: THREE.Mesh[];
} {
  const key: SculptSilhouetteKey =
    style === 'suv' ? 'civ_suv' : style === 'coupe' ? 'civ_coupe' : 'civ_sedan';
  const carLen = style === 'suv' ? 4.92 : style === 'coupe' ? 4.52 : 4.74;
  const carWidth = style === 'suv' ? 2.10 : style === 'coupe' ? 2.00 : 1.94;
  const lowerH = style === 'suv' ? 0.76 : style === 'coupe' ? 0.56 : 0.60;
  const cabinH = style === 'suv' ? 0.64 : style === 'coupe' ? 0.39 : 0.48;
  const cabinLen = style === 'suv' ? 3.00 : style === 'coupe' ? 2.12 : 2.50;
  const cabinZ = style === 'suv' ? 0.14 : style === 'coupe' ? 0.22 : 0.08;
  const wheelRadius = style === 'suv' ? 0.39 : 0.34;
  const { tireWidth, wheelCenterX } = getWheelTrackMetrics(key, carWidth);

  const dim: BodyDimensions = {
    length: carLen,
    width: carWidth,
    lowerH,
    cabinH,
    cabinLen,
    cabinZ,
    cabinWidthRatio: style === 'suv' ? 0.86 : 0.80,
    wheelRadius,
    baseY: style === 'suv' ? 0.20 : 0.14,
    frontAxleZ: -carLen * 0.32,
    rearAxleZ: carLen * 0.31,
    tireWidth,
    wheelCenterX,
  };

  const hullMesh = new THREE.Mesh(buildLoftedLowerHullGeometry(key, dim), bodyMat);
  targetGroup.add(hullMesh);

  const wellMesh = new THREE.Mesh(buildWheelWellLinersGeometry(dim), trimMat);
  targetGroup.add(wellMesh);

  const { glassGeo, pillarRoofGeo } = buildLoftedGreenhouseParts(key, dim);
  const canopyMesh = new THREE.Mesh(glassGeo, glassMat);
  targetGroup.add(canopyMesh);

  const roofPillars = new THREE.Mesh(pillarRoofGeo, bodyMat);
  targetGroup.add(roofPillars);

  if (style === 'suv') {
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, cabinLen * 0.64), chromeMat);
      rail.position.set(side * (carWidth * 0.32), dim.baseY + lowerH * 0.90 + cabinH + 0.04, cabinZ);
      targetGroup.add(rail);
    }
  }

  // Front Grille + Emblem
  const grille = new THREE.Mesh(
    new THREE.BoxGeometry(carWidth * (style === 'suv' ? 0.58 : 0.50), style === 'suv' ? 0.26 : 0.17, 0.065),
    trimMat
  );
  grille.position.set(0, dim.baseY + lowerH * 0.42, -carLen * 0.49);
  targetGroup.add(grille);

  const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.065, 12), chromeMat);
  emblem.rotation.x = Math.PI / 2;
  emblem.position.set(0, dim.baseY + lowerH * 0.46, -carLen * 0.498);
  targetGroup.add(emblem);

  const civHeadMats: SculptedCarMaterials = {
    bodyMat,
    accentMat: bodyMat,
    glassMat,
    carbonMat,
    darkGrilleMat: trimMat,
    chromeMat,
    goldMat: chromeMat,
    rotorMat: chromeMat,
    headMat,
    yellowDrlMat: drlMat,
    amberMat: leftAmberMat,
    brakeMat: brakeLightMatL,
    leftAmberMat,
    rightAmberMat,
  };

  // Side Mirrors, Contoured Headlights & Flush Turn Signals
  for (const side of [-1, 1]) {
    const mirrorCap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), bodyMat);
    mirrorCap.scale.set(1.2, 0.65, 0.85);
    mirrorCap.position.set(side * (carWidth * 0.47), dim.baseY + lowerH + 0.06, cabinZ - cabinLen * 0.34);
    targetGroup.add(mirrorCap);

    const hl = evalFasciaAnchor(key, dim, side, 0.66, 0.80, 'front');
    addSignatureHeadlightCluster(targetGroup, side, hl.x, hl.y, hl.z + 0.008, hl.yaw, civHeadMats, key, {
      drlOverrideMat: drlMat,
    });

    const sigPos = evalFasciaAnchor(key, dim, side, 0.84, 0.72, 'front');
    const sigMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, 0.055, 0.05),
      side < 0 ? leftAmberMat : rightAmberMat
    );
    sigMesh.rotation.y = sigPos.yaw;
    sigMesh.position.set(sigPos.x, sigPos.y, sigPos.z + 0.005);
    targetGroup.add(sigMesh);
  }

  // Rear Taillight Bar + Brake Pods + Diffuser
  const taillightBar = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.76, 0.04, 0.055), brakeLightMatL);
  taillightBar.position.set(0, dim.baseY + lowerH * 0.66, carLen * 0.484);
  targetGroup.add(taillightBar);

  const brakePosL = evalFasciaAnchor(key, dim, -1, 0.65, 0.72, 'rear');
  const brakePodL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.055), brakeLightMatL);
  brakePodL.rotation.y = brakePosL.yaw;
  brakePodL.position.set(brakePosL.x, brakePosL.y, brakePosL.z);
  targetGroup.add(brakePodL);

  const brakePosR = evalFasciaAnchor(key, dim, 1, 0.65, 0.72, 'rear');
  const brakePodR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.055), brakeLightMatR);
  brakePodR.rotation.y = brakePosR.yaw;
  brakePodR.position.set(brakePosR.x, brakePosR.y, brakePosR.z);
  targetGroup.add(brakePodR);

  const rearSigPosL = evalFasciaAnchor(key, dim, -1, 0.83, 0.72, 'rear');
  const rearSigL = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.06, 0.055), leftAmberMat);
  rearSigL.rotation.y = rearSigPosL.yaw;
  rearSigL.position.set(rearSigPosL.x, rearSigPosL.y, rearSigPosL.z);
  targetGroup.add(rearSigL);

  const rearSigPosR = evalFasciaAnchor(key, dim, 1, 0.83, 0.72, 'rear');
  const rearSigR = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.06, 0.055), rightAmberMat);
  rearSigR.rotation.y = rearSigPosR.yaw;
  rearSigR.position.set(rearSigPosR.x, rearSigPosR.y, rearSigPosR.z);
  targetGroup.add(rearSigR);

  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.74, 0.12, 0.13), carbonMat);
  diffuser.position.set(0, dim.baseY + 0.075, carLen * 0.46);
  targetGroup.add(diffuser);

  const wheels: THREE.Mesh[] = [];
  const tireGeom = buildContouredTireGeometry(wheelRadius, tireWidth);
  const rimGeom = buildSteppedRimLipGeometry(wheelRadius, tireWidth);

  const wheelPositions = [
    [-wheelCenterX, wheelRadius, dim.frontAxleZ],
    [wheelCenterX, wheelRadius, dim.frontAxleZ],
    [-wheelCenterX, wheelRadius, dim.rearAxleZ],
    [wheelCenterX, wheelRadius, dim.rearAxleZ],
  ];
  for (const [wx, wy, wz] of wheelPositions) {
    const tire = new THREE.Mesh(tireGeom, trimMat);
    tire.position.set(wx, wy, wz);
    const rim = new THREE.Mesh(rimGeom, chromeMat);
    tire.add(rim);
    wheels.push(tire);
    targetGroup.add(tire);
  }

  return { dim, taillightBar, wheels };
}

/**
 * Attaches sculpted Charger Pursuit-style Police Interceptor bodywork
 */
export function buildSculptedPoliceHull(
  targetGroup: THREE.Group,
  blackMat: THREE.Material,
  whiteDoorsMat: THREE.Material,
  glassMat: THREE.Material,
  steelMat: THREE.Material,
  chromeMat: THREE.Material,
  headMat: THREE.Material,
  tailMat: THREE.Material,
  redStrobeMat: THREE.Material,
  blueStrobeMat: THREE.Material
): { wheels: THREE.Mesh[]; dim: BodyDimensions } {
  const carLen = 4.86;
  const carWidth = 2.02;
  const lowerH = 0.63;
  const cabinH = 0.46;
  const cabinLen = 2.42;
  const cabinZ = 0.10;
  const wheelRadius = 0.345;
  const { tireWidth, wheelCenterX } = getWheelTrackMetrics('police_cruiser', carWidth);

  const dim: BodyDimensions = {
    length: carLen,
    width: carWidth,
    lowerH,
    cabinH,
    cabinLen,
    cabinZ,
    cabinWidthRatio: 0.80,
    wheelRadius,
    baseY: 0.15,
    frontAxleZ: -carLen * 0.31,
    rearAxleZ: carLen * 0.31,
    tireWidth,
    wheelCenterX,
  };

  const hull = new THREE.Mesh(buildLoftedLowerHullGeometry('police_cruiser', dim), blackMat);
  targetGroup.add(hull);

  const wellMesh = new THREE.Mesh(buildWheelWellLinersGeometry(dim), steelMat);
  targetGroup.add(wellMesh);

  // Classic white police door panels sculpted cleanly to fit waist curves without boxy overhang
  for (const side of [-1, 1]) {
    const doorPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, lowerH * 0.54, 1.82),
      whiteDoorsMat
    );
    doorPanel.position.set(side * (carWidth * 0.482), dim.baseY + lowerH * 0.48, 0.04);
    targetGroup.add(doorPanel);
  }

  const { glassGeo, pillarRoofGeo } = buildLoftedGreenhouseParts('police_cruiser', dim);
  const canopy = new THREE.Mesh(glassGeo, glassMat);
  targetGroup.add(canopy);

  const roof = new THREE.Mesh(pillarRoofGeo, whiteDoorsMat);
  targetGroup.add(roof);

  // Heavy-duty PIT push bumper
  const pushBar = new THREE.Mesh(new THREE.BoxGeometry(1.30, 0.40, 0.15), steelMat);
  pushBar.position.set(0, dim.baseY + 0.25, -carLen * 0.505);
  targetGroup.add(pushBar);

  // Cambered Police Pursuit Trunk Spoiler
  const spoiler = new THREE.Mesh(buildAirfoilWingGeometry(carWidth * 0.80, 0.17, 0.038), blackMat);
  spoiler.position.set(0, dim.baseY + lowerH + 0.04, carLen * 0.44);
  targetGroup.add(spoiler);

  // Aerodynamic Low-Profile Whelen Lightbar
  const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.052, 0.23), steelMat);
  barBase.position.set(0, dim.baseY + lowerH * 0.90 + cabinH + 0.06, cabinZ);
  targetGroup.add(barBase);

  const redPod = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 0.20), redStrobeMat);
  redPod.position.set(-0.33, dim.baseY + lowerH * 0.90 + cabinH + 0.105, cabinZ);
  targetGroup.add(redPod);

  const bluePod = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 0.20), blueStrobeMat);
  bluePod.position.set(0.33, dim.baseY + lowerH * 0.90 + cabinH + 0.105, cabinZ);
  targetGroup.add(bluePod);

  const polHeadMats: SculptedCarMaterials = {
    bodyMat: blackMat,
    accentMat: whiteDoorsMat,
    glassMat,
    carbonMat: steelMat,
    darkGrilleMat: steelMat,
    chromeMat,
    goldMat: chromeMat,
    rotorMat: chromeMat,
    headMat,
    yellowDrlMat: headMat,
    amberMat: headMat,
    brakeMat: tailMat,
    leftAmberMat: headMat,
    rightAmberMat: headMat,
  };
  for (const side of [-1, 1]) {
    const hl = evalFasciaAnchor('police_cruiser', dim, side, 0.66, 0.78, 'front');
    addSignatureHeadlightCluster(targetGroup, side, hl.x, hl.y, hl.z + 0.008, hl.yaw, polHeadMats, 'charger');
  }
  const racetrackTl = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.80, 0.095, 0.055), tailMat);
  racetrackTl.position.set(0, dim.baseY + lowerH * 0.66, carLen * 0.484);
  targetGroup.add(racetrackTl);

  const wheels: THREE.Mesh[] = [];
  const wheelGeom = buildContouredTireGeometry(wheelRadius, tireWidth);
  const rimGeom = buildSteppedRimLipGeometry(wheelRadius, tireWidth);
  const wheelPositions = [
    [-wheelCenterX, wheelRadius, dim.frontAxleZ],
    [wheelCenterX, wheelRadius, dim.frontAxleZ],
    [-wheelCenterX, wheelRadius, dim.rearAxleZ],
    [wheelCenterX, wheelRadius, dim.rearAxleZ],
  ];
  for (const [wx, wy, wz] of wheelPositions) {
    const w = new THREE.Mesh(wheelGeom, blackMat);
    w.position.set(wx, wy, wz);
    const rimFace = new THREE.Mesh(rimGeom, chromeMat);
    w.add(rimFace);
    wheels.push(w);
    targetGroup.add(w);
  }

  return { wheels, dim };
}
