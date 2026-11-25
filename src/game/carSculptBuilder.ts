import * as THREE from 'three';
import type { StreetCarModelArchetype } from './cityTrafficBuilder';
import { getGraphicsPresetConfig } from '../utils/graphicsSettings';

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
  | 'corvette_c8'
  | 'escalade'
  | 'pickup_crew'
  | 'suv_offroad'
  | 'suv_sport'
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

export interface StreetCarWheelCorner {
  suspGroup: THREE.Group;
  steerGroup: THREE.Group;
  spinGroup: THREE.Group;
  baseY: number;
  radius: number;
  isFront: boolean;
  isLeft: boolean;
}

export interface StreetCarWheelRig {
  fl: StreetCarWheelCorner;
  fr: StreetCarWheelCorner;
  rl: StreetCarWheelCorner;
  rr: StreetCarWheelCorner;
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
const archTrimGeoCache = new Map<string, THREE.BufferGeometry>();
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
  const isSuvOrTruck =
    key === 'escalade' ||
    key === 'civ_suv' ||
    key === 'pickup_crew' ||
    key === 'suv_offroad' ||
    key === 'suv_sport';
  const isWideHyper =
    key === 'huracan' ||
    key === 'corvette_c8' ||
    key === 'chiron' ||
    key === 'chiron_ss' ||
    key === 'koenigsegg' ||
    key === 'koenigsegg_absolut' ||
    key === 'nevera' ||
    key === 'porsche_911' ||
    key === 'supra_mk5';
  const tireWidth = isSuvOrTruck
    ? key === 'pickup_crew' || key === 'suv_offroad'
      ? 0.295
      : 0.275
    : isWideHyper
    ? 0.255
    : key === 'mcmurtry'
    ? 0.215
    : 0.238;
  const halfW = width * 0.5;
  // Position tires flush with outer fender lips (slightly wider on trucks/SUVs) so all 4 wheels, sidewalls, and rims are clearly visible
  const outerTireX = isSuvOrTruck ? halfW * 0.965 : halfW * 0.945;
  const wheelCenterX = outerTireX - tireWidth * 0.5;
  const innerTireX = wheelCenterX - tireWidth * 0.5;
  return { tireWidth, outerTireX, wheelCenterX, innerTireX };
}

function getProfileSpec(key: SculptSilhouetteKey, dim: BodyDimensions): SilhouetteProfileSpec {
  const H = dim.lowerH;
  const isSuv = key === 'escalade' || key === 'civ_suv' || key === 'suv_offroad' || key === 'suv_sport';
  const isPickup = key === 'pickup_crew';
  const isEscalade = key === 'escalade';
  const isPorsche = key === 'porsche_911';
  const isCorvette = key === 'corvette_c8';
  const isNevera = key === 'nevera';
  const isKoenigsegg = key === 'koenigsegg' || key === 'koenigsegg_absolut';
  const isR34 = key === 'gtr_r34';
  const isWedge = key === 'huracan' || isKoenigsegg || key === 'mcmurtry';
  const isBugatti = key === 'chiron' || key === 'chiron_ss';
  const isMuscle = key === 'challenger' || key === 'charger' || key === 'camaro';
  const isSupra = key === 'supra_mk5' || key === 'supra_mk4';

  if (isPickup) {
    return {
      noseLowY: H * 0.28,
      noseBrowY: H * 0.94,
      cowlY: H * 1.0,
      beltRearY: H * 0.96,
      tailY: H * 0.93,
      diffuserY: H * 0.26,
      hoodCrown: 0.022,
      fenderRidge: 0.018,
      powerDome: 0.028,
      noseTaper: 0.025,
      tailTaper: 0.012,
      frontSweep: 0.032,
      rearSweep: 0.015,
      fenderFlare: 0.058,
      waistPinch: 0.0,
      doorScallop: 0.014,
      tumblehome: 0.03,
      roofStyle: 'suv',
      rearHaunchSwell: 0.016,
    };
  }
  if (isEscalade || key === 'suv_offroad') {
    return {
      noseLowY: H * 0.26,
      noseBrowY: H * 0.93,
      cowlY: H * 1.0,
      beltRearY: H * 1.0,
      tailY: H * 0.98,
      diffuserY: H * 0.22,
      hoodCrown: 0.020,
      fenderRidge: 0.016,
      powerDome: 0.024,
      noseTaper: 0.024,
      tailTaper: 0.014,
      frontSweep: 0.032,
      rearSweep: 0.020,
      fenderFlare: key === 'suv_offroad' ? 0.058 : 0.048,
      waistPinch: 0.0,
      doorScallop: 0.014,
      tumblehome: 0.028,
      roofStyle: 'suv',
      rearHaunchSwell: 0.014,
    };
  }
  if (isSuv) {
    return {
      noseLowY: H * 0.20,
      noseBrowY: H * 0.85,
      cowlY: H * 0.99,
      beltRearY: H * 0.98,
      tailY: H * 0.91,
      diffuserY: H * 0.16,
      hoodCrown: 0.028,
      fenderRidge: 0.020,
      powerDome: 0.016,
      noseTaper: key === 'suv_sport' ? 0.085 : 0.065,
      tailTaper: 0.050,
      frontSweep: key === 'suv_sport' ? 0.12 : 0.09,
      rearSweep: key === 'suv_sport' ? 0.085 : 0.065,
      fenderFlare: 0.052,
      waistPinch: 0.016,
      doorScallop: 0.022,
      tumblehome: key === 'suv_sport' ? 0.058 : 0.045,
      roofStyle: 'suv',
      rearHaunchSwell: 0.032,
    };
  }
  if (isCorvette) {
    return {
      noseLowY: H * 0.10,
      noseBrowY: H * 0.48,
      cowlY: H * 0.90,
      beltRearY: H * 1.05,
      tailY: H * 0.95,
      diffuserY: H * 0.22,
      hoodCrown: 0.018,
      fenderRidge: 0.115,
      powerDome: 0.0,
      noseTaper: 0.145,
      tailTaper: 0.065,
      frontSweep: 0.22,
      rearSweep: 0.105,
      fenderFlare: 0.058,
      waistPinch: 0.065,
      doorScallop: 0.058,
      tumblehome: 0.095,
      roofStyle: 'canopy',
      doubleBubble: true,
      rearHaunchSwell: 0.075,
    };
  }
  if (isNevera) {
    return {
      noseLowY: H * 0.10,
      noseBrowY: H * 0.50,
      cowlY: H * 0.92,
      beltRearY: H * 1.05,
      tailY: H * 0.94,
      diffuserY: H * 0.21,
      hoodCrown: 0.025,
      fenderRidge: 0.095,
      powerDome: 0.0,
      noseTaper: 0.135,
      tailTaper: 0.08,
      frontSweep: 0.21,
      rearSweep: 0.125,
      fenderFlare: 0.055,
      waistPinch: 0.06,
      doorScallop: 0.055,
      tumblehome: 0.098,
      roofStyle: 'canopy',
      rearHaunchSwell: 0.072,
    };
  }
  if (isR34) {
    return {
      noseLowY: H * 0.15,
      noseBrowY: H * 0.72,
      cowlY: H * 0.97,
      beltRearY: H * 1.01,
      tailY: H * 0.94,
      diffuserY: H * 0.18,
      hoodCrown: 0.028,
      fenderRidge: 0.032,
      powerDome: 0.02,
      noseTaper: 0.055,
      tailTaper: 0.045,
      frontSweep: 0.078,
      rearSweep: 0.052,
      fenderFlare: 0.055,
      waistPinch: 0.025,
      doorScallop: 0.026,
      tumblehome: 0.07,
      roofStyle: 'notchback',
      rearHaunchSwell: 0.048,
    };
  }
  if (isPorsche) {
    return {
      noseLowY: H * 0.13,
      noseBrowY: H * 0.50,
      cowlY: H * 0.91,
      beltRearY: H * 1.0,
      tailY: H * 0.87,
      diffuserY: H * 0.20,
      hoodCrown: 0.012,
      fenderRidge: 0.128, // Classic 911 lowered hood trunk between iconic upright frog-eye fenders
      powerDome: 0.0,
      noseTaper: 0.115,
      tailTaper: 0.08,
      frontSweep: 0.19,
      rearSweep: 0.145,
      fenderFlare: 0.052,
      waistPinch: 0.058,
      doorScallop: 0.032,
      tumblehome: 0.095,
      roofStyle: 'teardrop',
      rearHaunchSwell: 0.082,
    };
  }
  if (isWedge) {
    return {
      noseLowY: isKoenigsegg ? H * 0.08 : H * 0.09,
      noseBrowY: isKoenigsegg ? H * 0.44 : H * 0.46,
      cowlY: H * 0.90,
      beltRearY: H * 1.06,
      tailY: H * 0.95,
      diffuserY: H * 0.22,
      hoodCrown: 0.018,
      fenderRidge: 0.115,
      powerDome: 0.0,
      noseTaper: isKoenigsegg ? 0.155 : 0.14,
      tailTaper: 0.085,
      frontSweep: isKoenigsegg ? 0.24 : 0.21,
      rearSweep: 0.125,
      fenderFlare: 0.055,
      waistPinch: 0.06,
      doorScallop: 0.052,
      tumblehome: 0.098,
      roofStyle: 'canopy',
      doubleBubble: isKoenigsegg,
      rearHaunchSwell: 0.068,
    };
  }
  if (isBugatti) {
    return {
      noseLowY: H * 0.11,
      noseBrowY: H * 0.52,
      cowlY: H * 0.92,
      beltRearY: H * 1.04,
      tailY: H * 0.92,
      diffuserY: H * 0.20,
      hoodCrown: 0.036,
      fenderRidge: 0.098,
      powerDome: 0.015,
      noseTaper: 0.13,
      tailTaper: 0.075,
      frontSweep: 0.19,
      rearSweep: 0.135,
      fenderFlare: 0.056,
      waistPinch: 0.052,
      doorScallop: 0.048,
      tumblehome: 0.095,
      roofStyle: 'canopy',
      rearHaunchSwell: 0.072,
    };
  }
  if (isSupra) {
    return {
      noseLowY: H * 0.14,
      noseBrowY: H * 0.58,
      cowlY: H * 0.96,
      beltRearY: H * 1.04,
      tailY: H * 0.94,
      diffuserY: H * 0.20,
      hoodCrown: 0.034,
      fenderRidge: 0.072,
      powerDome: 0.016,
      noseTaper: 0.12,
      tailTaper: 0.08,
      frontSweep: 0.18,
      rearSweep: 0.12,
      fenderFlare: 0.052,
      waistPinch: 0.062,
      doorScallop: 0.045,
      tumblehome: 0.088,
      roofStyle: 'fastback',
      doubleBubble: key === 'supra_mk5',
      rearHaunchSwell: 0.072,
    };
  }
  if (isMuscle) {
    return {
      noseLowY: H * 0.18,
      noseBrowY: H * 0.77,
      cowlY: H * 0.99,
      beltRearY: H * 1.03,
      tailY: H * 0.94,
      diffuserY: H * 0.18,
      hoodCrown: 0.032,
      fenderRidge: 0.030,
      powerDome: 0.038,
      noseTaper: 0.065,
      tailTaper: 0.048,
      frontSweep: 0.095,
      rearSweep: 0.075,
      fenderFlare: 0.052,
      waistPinch: 0.028,
      doorScallop: 0.03,
      tumblehome: 0.068,
      roofStyle: key === 'charger' ? 'notchback' : 'fastback',
      rearHaunchSwell: 0.055,
    };
  }
  const isSedan =
    key === 'camry_sedan' || key === 'civ_sedan' || key === 'police_cruiser' || key === 'civic_hatch';
  return {
    noseLowY: H * 0.15,
    noseBrowY: H * 0.68,
    cowlY: H * 0.96,
    beltRearY: H * 1.01,
    tailY: H * 0.93,
    diffuserY: H * 0.18,
    hoodCrown: 0.032,
    fenderRidge: 0.042,
    powerDome: key === 'bmw_m4' || key === 'gtr_r35' ? 0.024 : 0.01,
    noseTaper: 0.095,
    tailTaper: 0.072,
    frontSweep: 0.135,
    rearSweep: 0.10,
    fenderFlare: key === 'bmw_m4' || key === 'gtr_r35' ? 0.052 : 0.04,
    waistPinch: isSedan ? 0.018 : 0.04,
    doorScallop: 0.028,
    tumblehome: isSedan ? 0.064 : 0.08,
    roofStyle: key === 'civic_hatch' ? 'hatch' : isSedan ? 'notchback' : 'fastback',
    doubleBubble: key === 'bmw_m4',
    rearHaunchSwell: isSedan ? 0.026 : 0.055,
  };
}

/**
 * Evaluates the sculpted hull's front/rear fascia anchor position & wraparound yaw tangent
 * matching the extruded body's exact morph curve so headlights, grilles, and taillights sit 100% flush.
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
    const taper = 1.0 - spec.noseTaper * 0.92;
    const x = side * ax * halfW * taper;
    const sweepZ = -halfL + ax * ax * spec.frontSweep + 0.012;
    const y = dim.baseY + spec.noseLowY + (spec.noseBrowY - spec.noseLowY) * heightFrac;
    const dzdx = (2 * ax * spec.frontSweep) / Math.max(0.3, halfW * taper);
    const yaw = Math.atan(dzdx);
    return { x, y, z: sweepZ, yaw: side * yaw };
  }

  const taper = 1.0 - spec.tailTaper * 0.88;
  const x = side * ax * halfW * taper;
  const sweepZ = halfL - ax * ax * spec.rearSweep - 0.012;
  const y = dim.baseY + spec.diffuserY + (spec.tailY - spec.diffuserY) * heightFrac;
  const dzdx = (2 * ax * spec.rearSweep) / Math.max(0.3, halfW * taper);
  const yaw = Math.atan(dzdx);
  return { x, y, z: sweepZ, yaw: -side * yaw };
}

/**
 * Merges a list of non-indexed or indexed BufferGeometries into one clean BufferGeometry
 */
function mergeSimpleGeometries(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const nonIdx = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  let totalVerts = 0;
  for (const g of nonIdx) {
    totalVerts += g.attributes.position.count;
  }
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  let offset = 0;
  for (const g of nonIdx) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const pos = g.attributes.position.array as Float32Array;
    const norm = g.attributes.normal.array as Float32Array;
    positions.set(pos, offset);
    normals.set(norm, offset);
    offset += pos.length;
  }
  nonIdx.forEach((g, idx) => {
    if (g !== parts[idx]) g.dispose();
  });
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return merged;
}

/**
 * Evaluates the outer fender-crest top height Y(z) along the car length,
 * guaranteeing clean sheetmetal clearance above front and rear wheels.
 */
function evalSideProfileTopY(
  key: SculptSilhouetteKey,
  dim: BodyDimensions,
  spec: SilhouetteProfileSpec,
  z: number
): number {
  const halfL = dim.length * 0.5;
  const cowlZ = dim.cabinZ - dim.cabinLen * 0.46;
  const rearDeckZ = dim.cabinZ + dim.cabinLen * 0.42;
  const archR = dim.wheelRadius * 1.24;
  const minArchFenderTop = dim.wheelRadius + archR + 0.065;

  let y: number;
  if (z <= cowlZ) {
    const t = smoothstep(-halfL, cowlZ, z);
    y = dim.baseY + spec.noseBrowY + (spec.cowlY - spec.noseBrowY) * Math.pow(t, 0.85);
  } else if (z <= rearDeckZ) {
    const t = smoothstep(cowlZ, rearDeckZ, z);
    y = dim.baseY + spec.cowlY + (spec.beltRearY - spec.cowlY) * t;
  } else {
    const t = smoothstep(rearDeckZ, halfL, z);
    y = dim.baseY + spec.beltRearY + (spec.tailY - spec.beltRearY) * Math.pow(t, 1.15);
  }

  // Smooth muscular arch crest over both axles so tires NEVER poke through top of fenders
  const fInfluence = 1.0 - smoothstep(archR * 0.45, archR * 1.45, Math.abs(z - dim.frontAxleZ));
  const rInfluence = 1.0 - smoothstep(archR * 0.45, archR * 1.45, Math.abs(z - dim.rearAxleZ));
  const archFloor = minArchFenderTop;
  if (fInfluence > 0.001) {
    const targetF = Math.max(y, archFloor);
    y = y + (targetF - y) * fInfluence;
  }
  if (rInfluence > 0.001) {
    const targetR = Math.max(y, archFloor);
    y = y + (targetR - y) * rInfluence;
  }
  return y;
}

/**
 * NEW AUTOMOTIVE SIDE-PROFILE EXTRUDED + SCULPTED CHASSIS BUILDER
 * Replaces the old single-point-pinched Z-loft hull with an authentic side-elevation ExtrudeGeometry
 * that physically cuts circular wheel-arch openings out of the body shell (0% tire clipping!),
 * then applies clean 3D automotive compound curvature (bumper corner wrap, nose/tail taper,
 * beltline tumblehome, door rocker scallops, fender haunches, and recessed center hood valleys).
 */
function buildSculptedLowerHullGeometry(
  key: SculptSilhouetteKey,
  dim: BodyDimensions
): THREE.BufferGeometry {
  const cacheKey = `extrudeHull_v5_${key}_${dim.length.toFixed(2)}_${dim.width.toFixed(2)}_${dim.lowerH.toFixed(2)}_${dim.wheelRadius.toFixed(3)}_${dim.baseY.toFixed(2)}`;
  const cached = hullGeoCache.get(cacheKey);
  if (cached) return cached;

  const spec = getProfileSpec(key, dim);
  const L = dim.length;
  const halfL = L * 0.5;
  const halfW = dim.width * 0.5;
  const cowlZ = dim.cabinZ - dim.cabinLen * 0.46;
  const rearDeckZ = dim.cabinZ + dim.cabinLen * 0.42;

  const bevelT = 0.044;
  const bevelS = 0.024;
  const archR = dim.wheelRadius * 1.27;
  const cutR = archR + bevelS;
  const archCy = dim.wheelRadius;

  // Build CCW 2D side-elevation profile in (z, y): bottom edge left->right with circular wheel cutouts,
  // rear fascia bottom->top, top hood/belt/deck right->left, front nose top->bottom.
  const shape = new THREE.Shape();

  const fStartZ = dim.frontAxleZ - cutR;
  const fEndZ = dim.frontAxleZ + cutR;
  const rStartZ = dim.rearAxleZ - cutR;
  const rEndZ = dim.rearAxleZ + cutR;

  const noseTipZ = -halfL + bevelS;
  const tailTipZ = halfL - bevelS;
  const botNoseY = dim.baseY + spec.noseLowY * 0.45 + bevelS;
  const botSillY = dim.baseY + bevelS;
  const botTailY = dim.baseY + spec.diffuserY + bevelS;

  shape.moveTo(noseTipZ, botNoseY);
  shape.lineTo(fStartZ - 0.06, botSillY);

  // Carve Front Circular Wheel Arch Opening (bottom edge -> up over tire -> back to sill)
  const archSegs = 16;
  for (let i = 0; i <= archSegs; i++) {
    const ang = Math.PI - (i / archSegs) * Math.PI;
    const az = dim.frontAxleZ + Math.cos(ang) * cutR;
    const ay = Math.max(botSillY, archCy + Math.sin(ang) * cutR);
    shape.lineTo(az, ay);
  }

  shape.lineTo(rStartZ, botSillY);

  // Carve Rear Circular Wheel Arch Opening
  for (let i = 0; i <= archSegs; i++) {
    const ang = Math.PI - (i / archSegs) * Math.PI;
    const az = dim.rearAxleZ + Math.cos(ang) * cutR;
    const ay = Math.max(botSillY, archCy + Math.sin(ang) * cutR);
    shape.lineTo(az, ay);
  }

  // Rear lower diffuser rake up to rear bumper bottom
  shape.lineTo(tailTipZ - 0.10, botSillY + 0.02);
  shape.lineTo(tailTipZ, botTailY);

  // Rear bumper vertical/canted fascia up to decklid lip
  const rearLipZ = tailTipZ - (key === 'escalade' || key === 'civ_suv' ? 0.04 : 0.08);
  const topTailY = evalSideProfileTopY(key, dim, spec, rearLipZ) - bevelS;
  shape.lineTo(tailTipZ - 0.015, botTailY + (topTailY - botTailY) * 0.55);
  shape.lineTo(rearLipZ, topTailY);

  // Sample top silhouette smoothly from rear -> cowl -> front nose brow
  const topSamples = 26;
  for (let i = 1; i <= topSamples; i++) {
    const u = i / topSamples;
    const z = rearLipZ + (noseTipZ + 0.06 - rearLipZ) * u;
    const ty = evalSideProfileTopY(key, dim, spec, z) - bevelS;
    shape.lineTo(z, ty);
  }

  // Front nose brow down to front splitter chin
  const noseBrowZ = noseTipZ + 0.03;
  const noseBrowY = dim.baseY + spec.noseBrowY - bevelS;
  shape.lineTo(noseBrowZ, noseBrowY);
  shape.lineTo(noseTipZ, dim.baseY + spec.noseLowY + (spec.noseBrowY - spec.noseLowY) * 0.38);
  shape.closePath();

  const coreDepth = Math.max(0.6, dim.width - bevelT * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: coreDepth,
    steps: 14,
    bevelEnabled: true,
    bevelThickness: bevelT,
    bevelSize: bevelS,
    bevelSegments: 3,
    curveSegments: 10,
  });

  // Map extrusion X across [-halfW .. +halfW] and shape to Z (length), Y (height)
  geo.translate(0, 0, -coreDepth * 0.5);
  geo.rotateY(-Math.PI / 2);

  // Apply 3D compound automotive sculpting morphs across X, Y, Z
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const xSign = x >= 0 ? 1 : -1;
    const absX = Math.abs(x);
    const xFrac = Math.min(1.0, absX / Math.max(0.1, halfW));
    const sideMask = smoothstep(0.55, 0.98, xFrac);

    const topBoundY = evalSideProfileTopY(key, dim, spec, z);
    const yNorm = Math.max(0, Math.min(1, (y - dim.baseY) / Math.max(0.25, topBoundY - dim.baseY)));

    // 1. Plan-view Nose & Tail Width Taper + Rocker Tuck
    let widthScale = 1.0;
    if (z < dim.frontAxleZ) {
      const fZone = smoothstep(dim.frontAxleZ + 0.15, -halfL, z);
      widthScale -= spec.noseTaper * Math.pow(fZone, 1.35);
    } else if (z > dim.rearAxleZ) {
      const rZone = smoothstep(dim.rearAxleZ - 0.15, halfL, z);
      widthScale -= spec.tailTaper * Math.pow(rZone, 1.3);
    }

    // Coke-bottle door waist + sculpted rear quarter haunch swell
    const doorBand =
      smoothstep(dim.frontAxleZ + archR * 0.75, dim.frontAxleZ + archR * 1.45, z) *
      (1.0 - smoothstep(dim.rearAxleZ - archR * 1.45, dim.rearAxleZ - archR * 0.75, z));
    widthScale -= spec.waistPinch * doorBand * (0.45 + 0.55 * yNorm);

    const haunchBand =
      smoothstep(dim.rearAxleZ - archR * 1.8, dim.rearAxleZ - archR * 0.1, z) *
      (1.0 - smoothstep(dim.rearAxleZ + archR * 0.5, halfL, z));
    widthScale += spec.rearHaunchSwell * 0.35 * haunchBand * smoothstep(0.25, 0.85, yNorm);

    // Lower door aero scallop & beltline tumblehome
    const lowerScallopBand = Math.sin(Math.max(0, Math.min(1, (yNorm - 0.15) / 0.55)) * Math.PI);
    widthScale -= spec.doorScallop * 0.45 * doorBand * lowerScallopBand;
    widthScale -= spec.tumblehome * 0.52 * Math.pow(Math.max(0, (yNorm - 0.52) / 0.48), 1.35);

    // Crisp Fender Arch Flare Lip around Front & Rear Wheel Cutouts
    const distFA = Math.hypot(z - dim.frontAxleZ, y - archCy);
    const distRA = Math.hypot(z - dim.rearAxleZ, y - archCy);
    const fLip = 1.0 - smoothstep(archR * 0.96, archR * 1.32, distFA);
    const rLip = 1.0 - smoothstep(archR * 0.96, archR * 1.32, distRA);
    const archLipBump = Math.max(fLip, rLip) * (y >= dim.baseY + 0.04 ? 1 : 0);
    widthScale += (spec.fenderFlare * 0.42) * archLipBump * sideMask;

    x = xSign * absX * Math.max(0.55, widthScale);

    // 2. Plan-view Curved Bumper Corner Wraparound (Front & Rear)
    if (z < dim.frontAxleZ - archR * 0.4) {
      const noseProx = smoothstep(dim.frontAxleZ - archR * 0.4, -halfL, z);
      z += xFrac * xFrac * spec.frontSweep * noseProx;
    } else if (z > dim.rearAxleZ + archR * 0.4) {
      const tailProx = smoothstep(dim.rearAxleZ + archR * 0.4, halfL, z);
      z -= xFrac * xFrac * spec.rearSweep * tailProx;
    }

    // 3. Compound Sculpted Center Hood Crown / Power Dome vs Raised Exotic Fender Peaks
    if (yNorm > 0.72 && z < cowlZ + 0.05) {
      const topWeight = smoothstep(0.72, 1.0, yNorm);
      const hoodSpan = 1.0 - smoothstep(-halfL + 0.10, -halfL + 0.45, z);
      const hoodMask = (1.0 - hoodSpan) * (1.0 - smoothstep(cowlZ - 0.25, cowlZ + 0.08, z));
      // Drop center hood slightly on mid-engine / 911 / exotic wedge cars so outer fenders stand proud!
      const centerDip = -spec.fenderRidge * (1.0 - smoothstep(0.0, 0.68, xFrac)) * hoodMask;
      const domeBump = spec.powerDome * (1.0 - smoothstep(0.0, 0.36, xFrac)) * hoodMask;
      const gentleCrown = spec.hoodCrown * Math.cos(xFrac * Math.PI * 0.5) * hoodMask;
      // Guarantee center hood never drops below arch clearance near axle if wide
      y += topWeight * (centerDip + domeBump + gentleCrown);
    }

    // 4. Gentle Rear Deck Crown
    if (yNorm > 0.78 && z > rearDeckZ - 0.05) {
      const topWeight = smoothstep(0.78, 1.0, yNorm);
      y += topWeight * (spec.hoodCrown * 0.55) * Math.cos(xFrac * Math.PI * 0.5);
    }

    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  hullGeoCache.set(cacheKey, geo);
  return geo;
}

/**
 * Generates dark concave wheel-well liners + inner vertical wheelhouse backplates
 * so you never see through the car under the wheel arches.
 */
function buildWheelWellLinersGeometry(dim: BodyDimensions): THREE.BufferGeometry {
  const key = `wells_v5_${dim.length.toFixed(2)}_${dim.width.toFixed(2)}_${dim.wheelRadius.toFixed(3)}_${dim.wheelCenterX.toFixed(3)}`;
  const cached = archWellGeoCache.get(key);
  if (cached) return cached;

  const archR = dim.wheelRadius * 1.22;
  const wellOuterX = dim.width * 0.48;
  const wellInnerX = Math.max(0.18, dim.wheelCenterX - dim.tireWidth * 0.5 - 0.04);
  const wellDepth = Math.max(0.12, wellOuterX - wellInnerX);
  const midX = (wellOuterX + wellInnerX) * 0.5;
  const parts: THREE.BufferGeometry[] = [];

  for (const side of [-1, 1]) {
    for (const axleZ of [dim.frontAxleZ, dim.rearAxleZ]) {
      // Dark semicircular arch barrel lining the wheel cutout
      const liner = new THREE.CylinderGeometry(archR, archR, wellDepth, 18, 1, true, 0, Math.PI);
      liner.rotateZ(Math.PI / 2);
      liner.rotateX(-Math.PI / 2);
      liner.translate(side * midX, dim.wheelRadius, axleZ);
      parts.push(liner);

      // Solid dark inner backing shield behind the wheel & brake disc
      const innerPlate = new THREE.CylinderGeometry(archR * 0.98, archR * 0.98, 0.024, 18, 1, false, 0, Math.PI);
      innerPlate.rotateZ(Math.PI / 2);
      innerPlate.rotateX(-Math.PI / 2);
      innerPlate.translate(side * wellInnerX, dim.wheelRadius, axleZ);
      parts.push(innerPlate);
    }
  }

  const merged = mergeSimpleGeometries(parts);
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  archWellGeoCache.set(key, merged);
  return merged;
}

/**
 * Crisp outer fender-arch eyebrow trim rings hugging each circular wheel cutout
 */
function buildFenderArchTrimGeometry(dim: BodyDimensions): THREE.BufferGeometry {
  const key = `archTrim_v5_${dim.length.toFixed(2)}_${dim.width.toFixed(2)}_${dim.wheelRadius.toFixed(3)}`;
  const cached = archTrimGeoCache.get(key);
  if (cached) return cached;

  const archR = dim.wheelRadius * 1.24;
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    for (const axleZ of [dim.frontAxleZ, dim.rearAxleZ]) {
      const lip = new THREE.TorusGeometry(archR, 0.019, 6, 18, Math.PI);
      lip.rotateY(Math.PI / 2);
      lip.translate(side * (dim.width * 0.482), dim.wheelRadius, axleZ);
      parts.push(lip);
    }
  }
  const merged = mergeSimpleGeometries(parts);
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  archTrimGeoCache.set(key, merged);
  return merged;
}

/**
 * Builds an exact 3D structural pillar/beam connecting two endpoints with automotive chamfer thickness.
 */
function createStructuralBeam(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  widthX: number,
  depthZ: number
): THREE.BufferGeometry {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = Math.max(0.05, dir.length());
  const box = new THREE.BoxGeometry(widthX, len, depthZ);
  const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const mat4 = new THREE.Matrix4().compose(mid, quat, new THREE.Vector3(1, 1, 1));
  box.applyMatrix4(mat4);
  return box;
}

/**
 * Creates a mildly curved 4-corner glass pane from a bottom-edge pair and top-edge pair
 */
function createCurvedQuadPane(
  bL: THREE.Vector3,
  bR: THREE.Vector3,
  tL: THREE.Vector3,
  tR: THREE.Vector3,
  bowVec: THREE.Vector3,
  segsU = 6
): THREE.BufferGeometry {
  const positions: number[] = [];
  const evalPt = (u: number, v: number): THREE.Vector3 => {
    const bot = new THREE.Vector3().lerpVectors(bL, bR, u);
    const top = new THREE.Vector3().lerpVectors(tL, tR, u);
    const p = new THREE.Vector3().lerpVectors(bot, top, v);
    const crown = Math.sin(u * Math.PI) * (0.45 + 0.55 * (1 - v * 0.35));
    p.addScaledVector(bowVec, crown);
    return p;
  };
  for (let i = 0; i < segsU; i++) {
    const u0 = i / segsU;
    const u1 = (i + 1) / segsU;
    const p00 = evalPt(u0, 0);
    const p10 = evalPt(u1, 0);
    const p01 = evalPt(u0, 1);
    const p11 = evalPt(u1, 1);
    positions.push(
      p00.x, p00.y, p00.z,
      p10.x, p10.y, p10.z,
      p11.x, p11.y, p11.z,
      p00.x, p00.y, p00.z,
      p11.x, p11.y, p11.z,
      p01.x, p01.y, p01.z
    );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * NEW FLUSH FACETED AUTOMOTIVE GREENHOUSE & PILLARS BUILDER
 * Eliminates the old egg dome + floating round tubes!
 * Builds crisp curved auto-glass panes framed by flush painted A/B/C/D pillars and a cambered roof panel.
 */
function buildLoftedGreenhouseParts(
  key: SculptSilhouetteKey,
  dim: BodyDimensions
): { glassGeo: THREE.BufferGeometry; pillarRoofGeo: THREE.BufferGeometry } {
  const cacheKey = `greenhouse_v4_${key}_${dim.length.toFixed(2)}_${dim.width.toFixed(2)}_${dim.cabinH.toFixed(2)}_${dim.cabinLen.toFixed(2)}_${dim.cabinZ.toFixed(2)}`;
  const cGlass = glassGeoCache.get(cacheKey);
  const cPillar = pillarGeoCache.get(cacheKey);
  if (cGlass && cPillar) return { glassGeo: cGlass, pillarRoofGeo: cPillar };

  const spec = getProfileSpec(key, dim);
  const cLen = dim.cabinLen;
  const cZ = dim.cabinZ;
  const cH = dim.cabinH;

  // Compute beltline anchor heights directly from the hull's cowl and rear deck
  const wsBotZ = cZ - cLen * 0.48;
  const rwBotZ = cZ + cLen * 0.48;
  const cowlY = evalSideProfileTopY(key, dim, spec, wsBotZ) - 0.02;
  const beltRearY = evalSideProfileTopY(key, dim, spec, rwBotZ) - 0.02;
  const roofPeakY = Math.max(cowlY, beltRearY) + cH;

  const isSuv = spec.roofStyle === 'suv';
  const isHatch = spec.roofStyle === 'hatch';
  const isNotch = spec.roofStyle === 'notchback';
  const isCanopy = spec.roofStyle === 'canopy';
  const isTeardrop = spec.roofStyle === 'teardrop';
  const isJetVisor = key === 'koenigsegg' || key === 'koenigsegg_absolut' || key === 'mcmurtry';

  // Windshield top Z, rear window top Z, roof height drop
  const wsTopZ = isSuv
    ? wsBotZ + cLen * 0.165
    : isNotch
    ? wsBotZ + cLen * 0.27
    : wsBotZ + cLen * 0.34;
  const rwTopZ =
    key === 'pickup_crew'
      ? rwBotZ - cLen * 0.055
      : key === 'escalade' || key === 'suv_offroad'
      ? rwBotZ - cLen * 0.055
      : isSuv
      ? rwBotZ - cLen * 0.095
      : isHatch
      ? rwBotZ - cLen * 0.20
      : isNotch
      ? rwBotZ - cLen * 0.24
      : isTeardrop
      ? rwBotZ - cLen * 0.42
      : rwBotZ - cLen * 0.35;

  const wsTopY = isSuv ? roofPeakY - 0.020 : roofPeakY - 0.035;
  const rwTopY = isSuv
    ? roofPeakY - 0.010
    : isTeardrop || isCanopy
    ? roofPeakY - cH * 0.14
    : roofPeakY - cH * 0.05;

  // Beltline vs Roof widths (true automotive tumblehome!)
  const beltHalfW = dim.width * 0.5 * (1 - spec.tumblehome * 0.72) * (dim.cabinWidthRatio / 0.80);
  const roofHalfW = beltHalfW * (isSuv ? 0.90 : isNotch ? 0.80 : 0.76);
  const wsBotHalfW = beltHalfW * (isJetVisor ? 0.90 : 0.94);
  const rwBotHalfW = beltHalfW * (key === 'escalade' ? 0.955 : isSuv ? 0.93 : isTeardrop ? 0.78 : 0.88);
  const wsTopHalfW = roofHalfW * (isJetVisor ? 0.92 : 0.96);
  const rwTopHalfW = roofHalfW * (key === 'escalade' ? 0.985 : isSuv ? 0.97 : isTeardrop ? 0.84 : 0.92);

  const gParts: THREE.BufferGeometry[] = [];
  const pParts: THREE.BufferGeometry[] = [];

  // Corner coordinates
  const wsBL = new THREE.Vector3(-wsBotHalfW, cowlY, wsBotZ);
  const wsBR = new THREE.Vector3(wsBotHalfW, cowlY, wsBotZ);
  const wsTL = new THREE.Vector3(-wsTopHalfW, wsTopY, wsTopZ);
  const wsTR = new THREE.Vector3(wsTopHalfW, wsTopY, wsTopZ);

  const rwTL = new THREE.Vector3(-rwTopHalfW, rwTopY, rwTopZ);
  const rwTR = new THREE.Vector3(rwTopHalfW, rwTopY, rwTopZ);
  const rwBL = new THREE.Vector3(-rwBotHalfW, beltRearY, rwBotZ);
  const rwBR = new THREE.Vector3(rwBotHalfW, beltRearY, rwBotZ);

  // Mid-roof vertex for curved side windows & roof crown
  const midZ = (wsTopZ + rwTopZ) * 0.5;
  const midBeltY = (cowlY + beltRearY) * 0.5;
  const midBeltHalfW = beltHalfW * 0.99;
  const midRoofHalfW = roofHalfW;

  // 1. Curved Front Windshield (bow forward toward nose!)
  gParts.push(
    createCurvedQuadPane(
      wsBR,
      wsBL,
      wsTR,
      wsTL,
      new THREE.Vector3(0, 0.015, isJetVisor ? -0.14 : -0.055),
      8
    )
  );

  // 2. Rear Window Glass (bow outward toward tail)
  gParts.push(
    createCurvedQuadPane(
      rwBL,
      rwBR,
      rwTL,
      rwTR,
      new THREE.Vector3(0, 0.02, isSuv ? 0.025 : 0.045),
      6
    )
  );

  // 3. Left & Right Flush Side Windows (split cleanly at B-pillar!)
  for (const side of [-1, 1]) {
    const sWsB = new THREE.Vector3(side * wsBotHalfW, cowlY + 0.01, wsBotZ + 0.02);
    const sWsT = new THREE.Vector3(side * wsTopHalfW, wsTopY - 0.015, wsTopZ + 0.02);
    const sMidB = new THREE.Vector3(side * midBeltHalfW, midBeltY + 0.01, midZ);
    const sMidT = new THREE.Vector3(side * midRoofHalfW, roofPeakY - 0.015, midZ);
    const sRwT = new THREE.Vector3(side * rwTopHalfW, rwTopY - 0.015, rwTopZ - 0.02);
    const sRwB = new THREE.Vector3(side * rwBotHalfW, beltRearY + 0.01, rwBotZ - 0.03);

    const bowOut = new THREE.Vector3(side * 0.024, 0, 0);
    if (side > 0) {
      gParts.push(createCurvedQuadPane(sWsB, sMidB, sWsT, sMidT, bowOut, 3));
      gParts.push(createCurvedQuadPane(sMidB, sRwB, sMidT, sRwT, bowOut, 3));
    } else {
      gParts.push(createCurvedQuadPane(sMidB, sWsB, sMidT, sWsT, bowOut, 3));
      gParts.push(createCurvedQuadPane(sRwB, sMidB, sRwT, sMidT, bowOut, 3));
    }
  }

  // 4. Sculpted Painted Roof Cap (Extruded/lofted with double-bubble option & curved perimeter)
  const roofSegsZ = 10;
  const roofSegsX = 8;
  const roofPts: number[] = [];
  const evalRoofSurface = (uX: number, uZ: number): THREE.Vector3 => {
    const z = wsTopZ + (rwTopZ - wsTopZ) * uZ;
    const hw = wsTopHalfW + (rwTopHalfW - wsTopHalfW) * uZ;
    const midBell = Math.sin(uZ * Math.PI);
    const baseY = wsTopY + (rwTopY - wsTopY) * uZ + midBell * (roofPeakY - (wsTopY + rwTopY) * 0.5);
    const x = uX * hw;
    const edgeDrop = -0.028 * (uX * uX);
    const bubble = spec.doubleBubble
      ? Math.sin(Math.abs(uX) * Math.PI) * 0.024 * midBell
      : 0.016 * (1 - uX * uX) * midBell;
    return new THREE.Vector3(x, baseY + edgeDrop + bubble + 0.012, z);
  };
  for (let iz = 0; iz < roofSegsZ; iz++) {
    const uz0 = iz / roofSegsZ;
    const uz1 = (iz + 1) / roofSegsZ;
    for (let ix = 0; ix < roofSegsX; ix++) {
      const ux0 = -1 + (ix / roofSegsX) * 2;
      const ux1 = -1 + ((ix + 1) / roofSegsX) * 2;
      const p00 = evalRoofSurface(ux0, uz0);
      const p10 = evalRoofSurface(ux1, uz0);
      const p01 = evalRoofSurface(ux0, uz1);
      const p11 = evalRoofSurface(ux1, uz1);
      roofPts.push(
        p00.x, p00.y, p00.z,
        p01.x, p01.y, p01.z,
        p11.x, p11.y, p11.z,
        p00.x, p00.y, p00.z,
        p11.x, p11.y, p11.z,
        p10.x, p10.y, p10.z
      );
    }
  }
  const roofSkinGeo = new THREE.BufferGeometry();
  roofSkinGeo.setAttribute('position', new THREE.Float32BufferAttribute(roofPts, 3));
  roofSkinGeo.computeVertexNormals();
  pParts.push(roofSkinGeo);

  // Thin dark lower glasshouse base gasket + roof edge headers
  const wsHeader = new THREE.Mesh(new THREE.BoxGeometry(wsTopHalfW * 2.02, 0.036, 0.07)).geometry;
  wsHeader.translate(0, wsTopY, wsTopZ + 0.01);
  pParts.push(wsHeader);

  const rwHeader = new THREE.Mesh(new THREE.BoxGeometry(rwTopHalfW * 2.02, 0.036, 0.07)).geometry;
  rwHeader.translate(0, rwTopY, rwTopZ - 0.01);
  pParts.push(rwHeader);

  // 5. Integrated Chamfered A-Pillars, B-Pillars, C-Pillars & SUV D-Pillars
  for (const side of [-1, 1]) {
    // A-Pillar (recessed slightly behind wraparound jet visor on Koenigsegg/McMurtry)
    const aBot = new THREE.Vector3(
      side * wsBotHalfW * (isJetVisor ? 0.88 : 0.99),
      cowlY,
      wsBotZ + (isJetVisor ? 0.14 : 0.01)
    );
    const aTop = new THREE.Vector3(side * wsTopHalfW * 0.99, wsTopY - 0.008, wsTopZ + 0.01);
    pParts.push(createStructuralBeam(aBot, aTop, isJetVisor ? 0.032 : 0.058, 0.068));

    // Subtle B-Pillar divider (dark/body accent along mid door)
    const bBot = new THREE.Vector3(side * midBeltHalfW * 0.97, midBeltY + 0.01, midZ);
    const bTop = new THREE.Vector3(side * midRoofHalfW * 0.97, roofPeakY - 0.015, midZ);
    pParts.push(createStructuralBeam(bBot, bTop, 0.035, 0.052));

    // C-Pillar (muscular on Challenger/Charger/R34/911/Corvette; slim D-pillar on Escalade/SUV)
    const cPillarBot = new THREE.Vector3(side * rwBotHalfW * 0.99, beltRearY, rwBotZ - 0.015);
    const cPillarTop = new THREE.Vector3(side * rwTopHalfW * 0.99, rwTopY - 0.008, rwTopZ - 0.01);
    const cWidth = isSuv ? 0.068 : isNotch || key === 'camaro' || key === 'challenger' ? 0.088 : 0.072;
    const cDepth = isSuv ? 0.12 : isNotch ? 0.16 : 0.14;
    pParts.push(createStructuralBeam(cPillarBot, cPillarTop, cWidth, cDepth));

    // Roof side cantrail connecting A-top -> B-top -> C-top cleanly
    pParts.push(createStructuralBeam(aTop, bTop, 0.056, 0.052));
    pParts.push(createStructuralBeam(bTop, cPillarTop, 0.058, 0.052));

    if (isSuv) {
      // Intermediate SUV C-pillar post between 2nd & 3rd row glass
      const suvCZ = (midZ + rwTopZ) * 0.52;
      const suvCBot = new THREE.Vector3(side * beltHalfW * 0.97, beltRearY + 0.01, suvCZ);
      const suvCTop = new THREE.Vector3(side * roofHalfW * 0.97, roofPeakY - 0.018, suvCZ);
      pParts.push(createStructuralBeam(suvCBot, suvCTop, 0.044, 0.078));
    }
  }

  const glassGeo = mergeSimpleGeometries(gParts);
  gParts.forEach((p) => p.dispose());

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
    new THREE.Vector2(wheelRadius * 0.88, -hw * 1.03),
    new THREE.Vector2(wheelRadius * 0.985, -hw * 0.88),
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
  | 'corvette_c8'
  | 'escalade'
  | 'pickup_truck'
  | 'suv_offroad'
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
  let lowerH = 0.58;
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
    lowerH = 0.62;
    cabinH = 0.45;
    cabinLen = 2.38;
    cabinZ = 0.14;
    cabinWidthRatio = 0.82;
    wheelRadius = 0.335;
    baseY = 0.14;
  } else if (archetype === 'toyota_camry') {
    key = 'camry_sedan';
    carWidth = 1.88;
    carLen = 4.78;
    lowerH = 0.62;
    cabinH = 0.44;
    cabinLen = 2.42;
    cabinZ = 0.08;
    cabinWidthRatio = 0.81;
    wheelRadius = 0.34;
    baseY = 0.15;
  } else if (archetype === 'toyota_supra_mk5') {
    key = 'supra_mk5';
    carWidth = 1.96;
    carLen = 4.38;
    lowerH = 0.60;
    cabinH = 0.39;
    cabinLen = 1.80;
    cabinZ = 0.28;
    cabinWidthRatio = 0.77;
    wheelRadius = 0.335;
    baseY = 0.13;
  } else if (archetype === 'toyota_supra_mk4') {
    key = 'supra_mk4';
    carWidth = 1.94;
    carLen = 4.52;
    lowerH = 0.60;
    cabinH = 0.41;
    cabinLen = 1.94;
    cabinZ = 0.18;
    cabinWidthRatio = 0.78;
    wheelRadius = 0.335;
    baseY = 0.13;
  } else if (archetype === 'nissan_gtr_r34' || archetype === 'nissan_gtr_r34_ztune') {
    key = 'gtr_r34';
    carWidth = archetype === 'nissan_gtr_r34_ztune' ? 1.98 : 1.90;
    carLen = 4.60;
    lowerH = 0.64;
    cabinH = 0.45;
    cabinLen = 2.02;
    cabinZ = 0.10;
    cabinWidthRatio = 0.80;
    wheelRadius = 0.34;
    baseY = 0.14;
  } else if (archetype === 'nissan_gtr_r35') {
    key = 'gtr_r35';
    carWidth = 1.99;
    carLen = 4.71;
    lowerH = 0.64;
    cabinH = 0.42;
    cabinLen = 2.08;
    cabinZ = 0.08;
    cabinWidthRatio = 0.79;
    wheelRadius = 0.345;
    baseY = 0.13;
  } else if (archetype === 'chevy_corvette') {
    key = 'corvette_c8';
    carWidth = aeroStyle === 'widebody_gt' ? 2.08 : 2.02;
    carLen = 4.69;
    lowerH = 0.56;
    cabinH = 0.37;
    cabinLen = 1.88;
    cabinZ = -0.18;
    cabinWidthRatio = 0.75;
    wheelRadius = 0.335;
    baseY = 0.12;
  } else if (archetype === 'chevy_camaro' || archetype === 'dodge_challenger' || archetype === 'dodge_charger') {
    key = archetype === 'chevy_camaro' ? 'camaro' : archetype === 'dodge_challenger' ? 'challenger' : 'charger';
    carWidth = aeroStyle === 'widebody_gt' ? 2.10 : 2.02;
    carLen = archetype === 'dodge_charger' ? 4.94 : 4.82;
    lowerH = 0.66;
    cabinH = 0.43;
    cabinLen = archetype === 'dodge_charger' ? 2.42 : 2.02;
    cabinZ = 0.14;
    cabinWidthRatio = 0.79;
    wheelRadius = 0.35;
    baseY = 0.15;
  } else if (archetype === 'bmw_m4') {
    key = 'bmw_m4';
    carWidth = 1.96;
    carLen = 4.72;
    lowerH = 0.62;
    cabinH = 0.43;
    cabinLen = 2.16;
    cabinZ = 0.10;
    cabinWidthRatio = 0.80;
    wheelRadius = 0.34;
    baseY = 0.13;
  } else if (archetype === 'cadillac_escalade' || archetype === 'cadillac_escalade_v') {
    key = 'escalade';
    carWidth = 2.16;
    carLen = trimId.includes('esv') ? 5.44 : 5.14;
    lowerH = 0.88;
    cabinH = 0.78;
    cabinLen = trimId.includes('esv') ? 4.28 : 3.92;
    cabinZ = trimId.includes('esv') ? 0.60 : 0.56;
    cabinWidthRatio = 0.88;
    wheelRadius = 0.415;
    baseY = 0.24;
  } else if (archetype === 'pickup_crew') {
    key = 'pickup_crew';
    const isHeavy = trimId.includes('trx') || trimId.includes('raptor_r') || trimId.includes('hummer') || trimId.includes('mammoth');
    const isCompact = trimId.includes('maverick');
    carWidth = isHeavy ? 2.26 : isCompact ? 1.98 : 2.12;
    carLen = isHeavy ? 5.56 : isCompact ? 5.02 : 5.32;
    lowerH = isHeavy ? 0.90 : 0.82;
    cabinH = 0.66;
    cabinLen = 2.08;
    cabinZ = -0.34; // Crew cab set ahead of rear open cargo bed
    cabinWidthRatio = 0.84;
    wheelRadius = isHeavy ? 0.465 : 0.425;
    baseY = isHeavy ? 0.34 : 0.28;
  } else if (archetype === 'suv_offroad') {
    key = 'suv_offroad';
    const isExtremeLift =
      trimId.includes('4x4') ||
      trimId.includes('brabus') ||
      trimId.includes('r1s') ||
      trimId.includes('bronco') ||
      trimId.includes('wrangler') ||
      trimId.includes('392');
    carWidth = isExtremeLift ? 2.18 : 2.08;
    carLen = trimId.includes('wrangler') ? 4.82 : 5.08;
    lowerH = 0.86;
    cabinH = 0.74;
    cabinLen = trimId.includes('wrangler') ? 3.25 : 3.65;
    cabinZ = 0.44;
    cabinWidthRatio = 0.87;
    wheelRadius = isExtremeLift ? 0.455 : 0.42;
    baseY = isExtremeLift ? 0.33 : 0.27;
  } else if (archetype === 'suv_sport') {
    key = 'suv_sport';
    carWidth = 2.12;
    carLen = 5.02;
    lowerH = 0.78;
    cabinH = 0.60;
    cabinLen = 3.22;
    cabinZ = 0.36;
    cabinWidthRatio = 0.84;
    wheelRadius = 0.405;
    baseY = 0.24;
  } else if (archetype === 'porsche_911') {
    key = 'porsche_911';
    carWidth = 2.02;
    carLen = 4.54;
    lowerH = 0.58;
    cabinH = 0.40;
    cabinLen = 2.08;
    cabinZ = 0.04;
    cabinWidthRatio = 0.77;
    wheelRadius = 0.335;
    baseY = 0.12;
  } else if (archetype === 'lamborghini_huracan') {
    key = 'huracan';
    carWidth = 2.08;
    carLen = 4.52;
    lowerH = 0.55;
    cabinH = 0.35;
    cabinLen = 1.94;
    cabinZ = -0.14;
    cabinWidthRatio = 0.75;
    wheelRadius = 0.33;
    baseY = 0.12;
  } else if (archetype === 'mcmurtry_speirling') {
    key = 'mcmurtry';
    carWidth = 1.66;
    carLen = 3.55;
    lowerH = 0.50;
    cabinH = 0.34;
    cabinLen = 1.48;
    cabinZ = 0.0;
    cabinWidthRatio = 0.58;
    wheelRadius = 0.295;
    baseY = 0.10;
  } else if (archetype === 'bugatti_chiron_pur_sport' || archetype === 'bugatti_chiron_super_sport') {
    key = archetype === 'bugatti_chiron_super_sport' ? 'chiron_ss' : 'chiron';
    carWidth = 2.14;
    carLen = archetype === 'bugatti_chiron_super_sport' ? 4.92 : 4.68;
    lowerH = 0.56;
    cabinH = 0.36;
    cabinLen = 1.84;
    cabinZ = -0.06;
    cabinWidthRatio = 0.74;
    wheelRadius = 0.34;
    baseY = 0.12;
  } else if (archetype === 'rimac_nevera') {
    key = 'nevera';
    carWidth = 2.12;
    carLen = 4.74;
    lowerH = 0.55;
    cabinH = 0.36;
    cabinLen = 1.86;
    cabinZ = -0.08;
    cabinWidthRatio = 0.75;
    wheelRadius = 0.335;
    baseY = 0.12;
  } else {
    key = aeroStyle === 'absolut_fins' ? 'koenigsegg_absolut' : 'koenigsegg';
    carWidth = 2.14;
    carLen = aeroStyle === 'absolut_fins' ? 4.92 : 4.68;
    lowerH = 0.53;
    cabinH = 0.35;
    cabinLen = 1.76;
    cabinZ = -0.22;
    cabinWidthRatio = 0.73;
    wheelRadius = 0.335;
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

let cachedClearLensPbrMat: THREE.MeshPhysicalMaterial | null = null;
let cachedClearLensFastMat: THREE.MeshLambertMaterial | null = null;
function getHeadlightClearLensMaterial(): THREE.Material {
  const preset = getGraphicsPresetConfig();
  const isFast = preset.id === 'retro' || preset.id === 'retro_pixel' || preset.id === 'low' || preset.id === 'dynamic_conservative';
  if (isFast) {
    if (!cachedClearLensFastMat) {
      cachedClearLensFastMat = new THREE.MeshLambertMaterial({
        color: 0xdbeafe,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      });
    }
    return cachedClearLensFastMat;
  }
  if (!cachedClearLensPbrMat) {
    cachedClearLensPbrMat = new THREE.MeshPhysicalMaterial({
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
  return cachedClearLensPbrMat;
}

let cachedManifoldPbrMat: THREE.MeshStandardMaterial | null = null;
let cachedManifoldFastMat: THREE.MeshLambertMaterial | null = null;
function getSharedManifoldMat(): THREE.Material {
  const preset = getGraphicsPresetConfig();
  const isFast = preset.id === 'retro' || preset.id === 'retro_pixel' || preset.id === 'low' || preset.id === 'dynamic_conservative';
  if (isFast) {
    if (!cachedManifoldFastMat) {
      cachedManifoldFastMat = new THREE.MeshLambertMaterial({ color: 0xdc2626 });
    }
    return cachedManifoldFastMat;
  }
  if (!cachedManifoldPbrMat) {
    cachedManifoldPbrMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.45 });
  }
  return cachedManifoldPbrMat;
}

const sharedCaliperMatCache = new Map<string, THREE.Material>();
function getSharedCaliperMat(colorHex: number): THREE.Material {
  const preset = getGraphicsPresetConfig();
  const isFast = preset.id === 'retro' || preset.id === 'retro_pixel' || preset.id === 'low' || preset.id === 'dynamic_conservative';
  const key = `${colorHex}_${isFast ? 1 : 0}`;
  let m = sharedCaliperMatCache.get(key);
  if (!m) {
    m = isFast
      ? new THREE.MeshLambertMaterial({ color: colorHex })
      : new THREE.MeshStandardMaterial({
          color: colorHex,
          metalness: 0.65,
          roughness: 0.22,
        });
    sharedCaliperMatCache.set(key, m);
  }
  return m;
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
          [-0.19, -0.036],
          [0.08, -0.044],
          [0.20, -0.022],
          [0.21, 0.036],
          [0.12, 0.058],
          [-0.14, 0.046],
          [-0.20, 0.004],
        ],
        wrap: 0.48,
        tiltBack: 0.14,
      };
    case 'corvette_c8':
      return {
        pts: [
          [-0.21, -0.040],
          [-0.04, -0.032],
          [0.16, 0.018],
          [0.22, 0.095],
          [0.12, 0.105],
          [-0.08, 0.032],
          [-0.22, -0.014],
        ],
        wrap: 1.15,
        tiltBack: 0.48,
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
          [-0.19, -0.028],
          [0.18, -0.036],
          [0.21, 0.018],
          [0.15, 0.038],
          [-0.18, 0.028],
        ],
        wrap: 0.72,
        tiltBack: 0.18,
      };
    case 'koenigsegg':
      return {
        pts: [
          [-0.14, -0.085],
          [-0.02, -0.068],
          [0.14, 0.025],
          [0.14, 0.115],
          [0.03, 0.125],
          [-0.10, 0.018],
          [-0.15, -0.045],
        ],
        wrap: 1.08,
        tiltBack: 0.56,
      };
    case 'nevera':
      return {
        pts: [
          [-0.21, -0.034],
          [0.02, -0.042],
          [0.21, 0.016],
          [0.19, 0.058],
          [-0.04, 0.038],
          [-0.20, 0.002],
        ],
        wrap: 1.02,
        tiltBack: 0.36,
      };
    case 'escalade':
      return {
        pts: [
          [-0.044, -0.235],
          [0.044, -0.235],
          [0.052, 0.195],
          [0.036, 0.235],
          [-0.044, 0.205],
        ],
        wrap: 0.34,
        tiltBack: 0.04,
      };
    case 'pickup_truck':
    case 'suv_offroad':
      return {
        pts: [
          [-0.21, -0.065],
          [0.21, -0.065],
          [0.22, 0.065],
          [-0.22, 0.065],
        ],
        wrap: 0.24,
        tiltBack: 0.05,
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

  const bezelGeo = buildCurvedShapeExtrudeGeometry(
    pts,
    side,
    0.052,
    0.008,
    0.006,
    wrap,
    headlightBezelGeoCache,
    `hl_bezel_v2_${design}_${side}`
  );
  const bezel = new THREE.Mesh(bezelGeo, mats.darkGrilleMat);
  pod.add(bezel);

  // Subtle recessed chrome/metallic reflector bowl inside every headlight housing
  const reflectorGeo = buildCurvedShapeExtrudeGeometry(
    pts.map(([px, py]) => [px * 0.82, py * 0.80]),
    side,
    0.012,
    0.003,
    0.001,
    wrap * 0.92,
    headlightLensGeoCache,
    `hl_refl_v2_${design}_${side}`
  );
  const reflector = new THREE.Mesh(reflectorGeo, mats.chromeMat);
  reflector.position.set(0, 0, -0.009);
  pod.add(reflector);

  const lensGeo = buildCurvedShapeExtrudeGeometry(
    pts,
    side,
    0.014,
    0.005,
    0.002,
    wrap,
    headlightLensGeoCache,
    `hl_lens_v2_${design}_${side}`
  );
  const clearLens = new THREE.Mesh(lensGeo, getHeadlightClearLensMaterial());
  clearLens.position.set(0, 0, -0.025);
  clearLens.renderOrder = 2;
  pod.add(clearLens);

  const drlMat = options?.drlOverrideMat || (options?.yellowDrl ? mats.yellowDrlMat : mats.headMat);

  if (design === 'porsche_911') {
    const centerOrb = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 10), mats.headMat);
    centerOrb.position.set(0, 0.004, -0.018);
    pod.add(centerOrb);

    const trimRing = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.007, 8, 20), mats.chromeMat);
    trimRing.position.set(0, 0.004, -0.016);
    pod.add(trimRing);

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
    for (const qx of [-0.115, -0.038, 0.038, 0.115]) {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.032, 0.028), drlMat);
      cube.position.set(side * qx, 0, -0.018 + qx * qx * wrap * 0.45);
      pod.add(cube);
    }
  } else if (design === 'challenger') {
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
  } else if (design === 'corvette_c8') {
    for (const [idx, px] of [-0.085, 0.045].entries()) {
      const proj = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.024, 0.028), mats.headMat);
      proj.rotation.z = side * 0.25;
      proj.position.set(side * px, 0.006 + idx * 0.022, -0.016);
      pod.add(proj);
    }
    const lowerCheck = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.013, 0.024), drlMat);
    lowerCheck.rotation.z = side * 0.24;
    lowerCheck.position.set(-side * 0.015, -0.016, -0.020);
    pod.add(lowerCheck);
    const outerWingDrl = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.013, 0.024), drlMat);
    outerWingDrl.rotation.z = side * 0.56;
    outerWingDrl.position.set(side * 0.125, 0.042, -0.014);
    pod.add(outerWingDrl);
  } else if (design === 'nevera') {
    for (const px of [-0.075, 0.045]) {
      const proj = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.026, 0.028), mats.headMat);
      proj.position.set(side * px, 0.008, -0.017);
      pod.add(proj);
    }
    const upperBlade = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.012, 0.024), drlMat);
    upperBlade.rotation.z = side * 0.20;
    upperBlade.position.set(side * 0.01, 0.024, -0.020);
    pod.add(upperBlade);
    const lowerSlash = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.011, 0.024), drlMat);
    lowerSlash.rotation.z = side * 0.12;
    lowerSlash.position.set(-side * 0.03, -0.020, -0.020);
    pod.add(lowerSlash);
  } else if (design === 'gtr_r34') {
    const outerXenon = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.034, 0.032, 12), mats.headMat);
    outerXenon.rotation.x = Math.PI / 2;
    outerXenon.position.set(side * 0.06, 0.008, -0.016);
    pod.add(outerXenon);

    const innerHigh = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.032, 12), mats.headMat);
    innerHigh.rotation.x = Math.PI / 2;
    innerHigh.position.set(-side * 0.065, 0.005, -0.016);
    pod.add(innerHigh);

    const upperBrowBar = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.009, 0.022), drlMat);
    upperBrowBar.position.set(-side * 0.01, 0.036, -0.019);
    pod.add(upperBrowBar);

    const amberCorner = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.062, 0.026), mats.amberMat);
    amberCorner.position.set(side * 0.145, 0.002, -0.015);
    pod.add(amberCorner);
  } else if (design === 'koenigsegg') {
    for (const [py, px] of [
      [-0.042, -0.035],
      [0.032, 0.025],
    ]) {
      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), mats.headMat);
      pearl.position.set(side * px, py, -0.018);
      pod.add(pearl);
    }
    const crescent = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.21, 0.024), drlMat);
    crescent.rotation.z = side * -0.56;
    crescent.position.set(side * 0.032, 0.008, -0.02);
    pod.add(crescent);
  } else if (design === 'escalade') {
    for (const cyOff of [-0.11, 0.0, 0.11]) {
      const crystal = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.075, 0.030), mats.headMat);
      crystal.position.set(-side * 0.008, cyOff, -0.017);
      pod.add(crystal);
    }
    const pipe = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.36, 0.026), drlMat);
    pipe.position.set(side * 0.028, 0, -0.022);
    pod.add(pipe);
  } else if (design === 'camry_sedan') {
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
  }

  targetGroup.add(pod);
}

/**
 * Contoured wraparound front aerodynamic splitter matching nose taper & sweep
 */
function buildContouredSplitterGeometry(key: SculptSilhouetteKey, dim: BodyDimensions): THREE.BufferGeometry {
  const cacheKey = `splitter_v4_${key}_${dim.width.toFixed(2)}_${dim.length.toFixed(2)}`;
  const cached = splitterGeoCache.get(cacheKey);
  if (cached) return cached;

  const spec = getProfileSpec(key, dim);
  const hw = dim.width * 0.465 * (1 - spec.noseTaper * 0.72);
  const depth = dim.length * 0.095;
  const sweep = spec.frontSweep * 0.85;

  const shape = new THREE.Shape();
  shape.moveTo(-hw, sweep + depth);
  shape.quadraticCurveTo(0, depth * 0.65, hw, sweep + depth);
  shape.lineTo(hw * 0.96, sweep);
  shape.quadraticCurveTo(0, -0.035, -hw * 0.96, sweep);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.026,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.005,
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

  // 1. Extruded Side-Profile Automotive Lower Body with True Wheel-Arch Cutouts + Dark Liners
  const hullGeo = buildSculptedLowerHullGeometry(key, dim);
  const hullMesh = new THREE.Mesh(hullGeo, mats.bodyMat);
  const presetCfg = getGraphicsPresetConfig();
  hullMesh.castShadow = presetCfg.shadowsEnabled;
  hullMesh.receiveShadow = presetCfg.shadowsEnabled;
  targetGroup.add(hullMesh);

  const wellMesh = new THREE.Mesh(buildWheelWellLinersGeometry(dim), mats.darkGrilleMat);
  targetGroup.add(wellMesh);

  const isTruckOrSuv =
    archetype === 'cadillac_escalade' ||
    archetype === 'cadillac_escalade_v' ||
    archetype === 'pickup_crew' ||
    archetype === 'suv_offroad' ||
    archetype === 'suv_sport';

  const archLipMat =
    archetype === 'cadillac_escalade' ||
    archetype === 'honda_civic' ||
    archetype === 'pickup_crew' ||
    archetype === 'suv_offroad'
      ? mats.darkGrilleMat
      : mats.bodyMat;
  const archLipMesh = new THREE.Mesh(buildFenderArchTrimGeometry(dim), archLipMat);
  targetGroup.add(archLipMesh);

  // Sculpted Side Carbon Rocker Skirts or Rugged Truck/SUV Running Boards
  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(
      new THREE.BoxGeometry(isTruckOrSuv ? 0.11 : 0.055, 0.042, carLen * (isTruckOrSuv ? 0.38 : 0.34)),
      isTruckOrSuv ? mats.darkGrilleMat : mats.carbonMat
    );
    skirt.position.set(side * (carWidth * 0.455), baseChassisY + 0.026, 0.0);
    targetGroup.add(skirt);
  }

  // Contoured Tapered Front Aero Splitter Lip + Rear Venturi Diffuser (omitted on trucks & off-road SUVs)
  if (!isTruckOrSuv) {
    const splitterMat =
      archetype === 'toyota_camry' && trimId === 'camry_trd_v6' ? mats.accentMat : mats.carbonMat;
    const splitter = new THREE.Mesh(buildContouredSplitterGeometry(key, dim), splitterMat);
    splitter.position.set(0, baseChassisY + 0.022, -carLen * 0.495);
    targetGroup.add(splitter);
  }

  if (archetype === 'pickup_crew' || archetype === 'suv_offroad') {
    // Rugged Skid Plate + Rear Steel Bumper Step instead of track venturi diffuser
    const frontBashPlate = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.56, 0.075, 0.36),
      mats.rotorMat
    );
    frontBashPlate.rotation.x = 0.28;
    frontBashPlate.position.set(0, baseChassisY + 0.04, -carLen * 0.488 + 0.14);
    targetGroup.add(frontBashPlate);

    const rearStepBumper = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.88, 0.14, 0.18),
      mats.darkGrilleMat
    );
    rearStepBumper.position.set(0, baseChassisY + 0.09, carLen * 0.488 - 0.01);
    targetGroup.add(rearStepBumper);
  } else {
    const diffuser = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.72, 0.10, 0.16),
      mats.carbonMat
    );
    diffuser.position.set(0, baseChassisY + 0.072, carLen * 0.462);
    targetGroup.add(diffuser);
    for (const fx of [-0.40, -0.16, 0.16, 0.40]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.095, 0.14), mats.carbonMat);
      fin.position.set(fx * carWidth * 0.46, baseChassisY + 0.072, carLen * 0.478);
      targetGroup.add(fin);
    }
  }

  // 2. Flush Curved Glass Greenhouse + Integrated Painted Roof & A/B/C/D Pillars
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
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.085, 6), mats.carbonMat);
      stalk.rotation.z = side * -0.55;
      stalk.position.set(side * (carWidth * 0.42), baseChassisY + lowerH + 0.035, cabinZ - cabinLen * 0.34);
      targetGroup.add(stalk);

      const mirrorCap = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.072, 0.095),
        useCarbonRoof ? mats.carbonMat : mats.bodyMat
      );
      mirrorCap.rotation.y = side * 0.24;
      mirrorCap.position.set(side * (carWidth * 0.48), baseChassisY + lowerH + 0.07, cabinZ - cabinLen * 0.33);
      targetGroup.add(mirrorCap);
    }
  }

  // ============================================================================
  // SIGNATURE FRONT GRILLES, SCULPTED CONTOURED HEADLIGHTS, TAILLIGHTS & EXHAUSTS
  // ============================================================================
  const frontZ = -carLen * 0.488;
  const rearZ = carLen * 0.488;
  const tlY = baseChassisY + lowerH * 0.68;

  if (archetype === 'honda_civic') {
    const upperGrille = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.44, 0.06, 0.065), mats.darkGrilleMat);
    upperGrille.position.set(0, baseChassisY + lowerH * 0.60, frontZ - 0.005);
    targetGroup.add(upperGrille);

    const lowerHoneycomb = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.66, 0.145, 0.065), mats.darkGrilleMat);
    lowerHoneycomb.position.set(0, baseChassisY + lowerH * 0.24, frontZ);
    targetGroup.add(lowerHoneycomb);

    const badgeMat = trimId === 'civic_type_r' ? new THREE.MeshBasicMaterial({ color: 0xdc2626 }) : mats.chromeMat;
    const frontBadge = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.072, 0.065), badgeMat);
    frontBadge.position.set(0, baseChassisY + lowerH * 0.62, frontZ - 0.014);
    targetGroup.add(frontBadge);

    for (const side of [-1, 1]) {
      const hl = evalFasciaAnchor(key, dim, side, 0.66, 0.78, 'front');
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
    const trapGrille = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.68, 0.19, 0.065), mats.darkGrilleMat);
    trapGrille.position.set(0, baseChassisY + lowerH * 0.28, frontZ);
    targetGroup.add(trapGrille);

    const upperVBar = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.40, 0.048, 0.065), mats.chromeMat);
    upperVBar.position.set(0, baseChassisY + lowerH * 0.62, frontZ - 0.008);
    targetGroup.add(upperVBar);

    for (const side of [-1, 1]) {
      const hl = evalFasciaAnchor(key, dim, side, 0.66, 0.78, 'front');
      addSignatureHeadlightCluster(targetGroup, side, hl.x, hl.y, hl.z, hl.yaw, mats, 'camry_sedan');
      const tlPos = evalFasciaAnchor(key, dim, side, 0.66, 0.72, 'rear');
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.085, 0.055), mats.brakeMat);
      tl.rotation.y = tlPos.yaw;
      tl.position.set(tlPos.x, tlPos.y, tlPos.z);
      targetGroup.add(tl);
    }

    if (trimId === 'camry_trd_v6') {
      const redLip = new THREE.Mesh(
        new THREE.BoxGeometry(carWidth * 0.80, 0.022, 0.065),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      redLip.position.set(0, baseChassisY + 0.024, frontZ + 0.01);
      targetGroup.add(redLip);
    }
  } else if (archetype === 'toyota_supra_mk5') {
    const centerNose = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.10), mats.bodyMat);
    centerNose.position.set(0, baseChassisY + lowerH * 0.40, frontZ - 0.01);
    targetGroup.add(centerNose);

    for (const side of [-1, 1]) {
      const intake = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.145, 0.06), mats.darkGrilleMat);
      intake.rotation.y = side * 0.22;
      intake.position.set(side * 0.43, baseChassisY + lowerH * 0.28, frontZ + 0.045);
      targetGroup.add(intake);

      const hl = evalFasciaAnchor(key, dim, side, 0.65, 0.80, 'front');
      addSignatureHeadlightCluster(targetGroup, side, hl.x, hl.y, hl.z + 0.018, hl.yaw, mats, 'supra_mk5');

      const tlPos = evalFasciaAnchor(key, dim, side, 0.66, 0.72, 'rear');
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.072, 0.055), mats.brakeMat);
      tl.rotation.y = tlPos.yaw;
      tl.position.set(tlPos.x, tlPos.y, tlPos.z);
      targetGroup.add(tl);
    }
    const ducktail = new THREE.Mesh(
      buildAirfoilWingGeometry(carWidth * 0.76, 0.15, 0.055),
      mats.bodyMat
    );
    ducktail.position.set(0, baseChassisY + lowerH * 0.98, carLen * 0.45);
    targetGroup.add(ducktail);
  } else if (archetype === 'toyota_supra_mk4') {
    const frontMouth = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.54, 0.16, 0.065), mats.darkGrilleMat);
    frontMouth.position.set(0, baseChassisY + lowerH * 0.29, frontZ);
    targetGroup.add(frontMouth);

    for (const side of [-1, 1]) {
      const hl = evalFasciaAnchor(key, dim, side, 0.65, 0.78, 'front');
      addSignatureHeadlightCluster(targetGroup, side, hl.x, hl.y, hl.z + 0.014, hl.yaw, mats, 'supra_mk4');

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
    intercooler.position.set(0, baseChassisY + lowerH * 0.26, frontZ + 0.008);
    targetGroup.add(intercooler);

    const upperGrille = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.44, 0.095, 0.065), mats.darkGrilleMat);
    upperGrille.position.set(0, baseChassisY + lowerH * 0.60, frontZ - 0.005);
    targetGroup.add(upperGrille);

    if (archetype !== 'nissan_gtr_r35') {
      const gtrBadge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.052, 0.068), mats.brakeMat);
      gtrBadge.position.set(0, baseChassisY + lowerH * 0.61, frontZ - 0.012);
      targetGroup.add(gtrBadge);

      if (archetype === 'nissan_gtr_r34_ztune' || trimId === 'r34_vspec_ii') {
        const hoodVent = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.022, 0.34), mats.carbonMat);
        hoodVent.position.set(0, baseChassisY + lowerH * 0.96, -carLen * 0.25);
        targetGroup.add(hoodVent);
      }

      const rearPanel = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.84, 0.18, 0.04), mats.bodyMat);
      rearPanel.position.set(0, tlY - 0.02, rearZ - 0.015);
      targetGroup.add(rearPanel);
    }

    const gtrDesign: HeadlightDesignId = archetype === 'nissan_gtr_r35' ? 'gtr_r35' : 'gtr_r34';
    for (const side of [-1, 1]) {
      const hl = evalFasciaAnchor(key, dim, side, 0.67, 0.82, 'front');
      addSignatureHeadlightCluster(
        targetGroup,
        side,
        hl.x,
        hl.y,
        hl.z + (gtrDesign === 'gtr_r35' ? 0.02 : 0.006),
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
  } else if (archetype === 'chevy_corvette') {
    const centerSplitterStrut = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.10, 0.065), mats.carbonMat);
    centerSplitterStrut.position.set(0, baseChassisY + lowerH * 0.26, frontZ + 0.02);
    targetGroup.add(centerSplitterStrut);

    // Clear Rear Engine Showcase Window + Red LT2/LT6 V8 Intake Manifold Visible Inside
    const engineBayGlass = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.042, 0.86), mats.glassMat);
    engineBayGlass.rotation.x = 0.08;
    engineBayGlass.position.set(0, baseChassisY + lowerH * 0.99, carLen * 0.22);
    targetGroup.add(engineBayGlass);

    const v8Manifold = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.04, 0.48),
      getSharedManifoldMat()
    );
    v8Manifold.position.set(0, baseChassisY + lowerH * 0.94, carLen * 0.22);
    targetGroup.add(v8Manifold);

    for (const side of [-1, 1]) {
      const intakeL = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.135, 0.065), mats.darkGrilleMat);
      intakeL.rotation.y = side * 0.22;
      intakeL.position.set(side * 0.45, baseChassisY + lowerH * 0.26, frontZ + 0.055);
      targetGroup.add(intakeL);

      const boomTop = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.20, 0.56), mats.carbonMat);
      boomTop.rotation.x = -0.26;
      boomTop.position.set(side * (carWidth * 0.47), baseChassisY + lowerH * 0.66, 0.20);
      targetGroup.add(boomTop);

      const boomPocket = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.32, 0.34), mats.darkGrilleMat);
      boomPocket.position.set(side * (carWidth * 0.465), baseChassisY + lowerH * 0.52, 0.24);
      targetGroup.add(boomPocket);

      const louverVent = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.70), mats.darkGrilleMat);
      louverVent.position.set(side * 0.44, baseChassisY + lowerH * 0.97, carLen * 0.22);
      targetGroup.add(louverVent);

      const hl = evalFasciaAnchor(key, dim, side, 0.64, 0.88, 'front');
      addSignatureHeadlightCluster(targetGroup, side, hl.x, hl.y + 0.015, hl.z + 0.035, hl.yaw, mats, 'corvette_c8');

      const tlPos = evalFasciaAnchor(key, dim, side, 0.62, 0.72, 'rear');
      for (const lOff of [-0.085, 0.085]) {
        const lBar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.048, 0.052), mats.brakeMat);
        lBar.rotation.y = tlPos.yaw;
        lBar.position.set(tlPos.x + lOff, tlPos.y - 0.01, tlPos.z);
        targetGroup.add(lBar);
      }
    }

    if (trimId === 'corvette_z06' || trimId === 'corvette_z06_z07') {
      for (const exX of [-0.14, -0.05, 0.05, 0.14]) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.12, 10), mats.chromeMat);
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(exX, baseChassisY + 0.11, rearZ + 0.008);
        targetGroup.add(pipe);
      }
    } else {
      for (const exX of [-0.72, -0.60, 0.60, 0.72]) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 10), mats.chromeMat);
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(exX, baseChassisY + 0.11, rearZ + 0.008);
        targetGroup.add(pipe);
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
    const hoodScoop = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.35, 0.062, carLen * 0.22), scoopMat);
    hoodScoop.position.set(0, baseChassisY + lowerH * 0.99, -carLen * 0.22);
    targetGroup.add(hoodScoop);

    const muscleDesign: HeadlightDesignId =
      archetype === 'dodge_challenger'
        ? 'challenger'
        : archetype === 'dodge_charger'
        ? 'charger'
        : 'camaro';

    for (const side of [-1, 1]) {
      const hl = evalFasciaAnchor(key, dim, side, 0.65, 0.78, 'front');
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
      kidney.position.set(kSide * 0.125, baseChassisY + lowerH * 0.44, frontZ - 0.012);
      targetGroup.add(kidney);

      if (trimId === 'bmw_m4_csl') {
        const redTrim = new THREE.Mesh(
          new THREE.BoxGeometry(0.215, 0.295, 0.052),
          new THREE.MeshBasicMaterial({ color: 0xef4444 })
        );
        redTrim.position.set(kSide * 0.125, baseChassisY + lowerH * 0.44, frontZ);
        targetGroup.add(redTrim);
      }

      const hl = evalFasciaAnchor(key, dim, kSide, 0.67, 0.80, 'front');
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
    const isV = archetype === 'cadillac_escalade_v' || trimId === 'escalade_sport_platinum';
    const trimAccentMat = isV ? mats.carbonMat : mats.chromeMat;

    // 1. Recessed Dark Mesh Pentagon Shield Grille + Angled Perimeter Frame
    const grilleBacking = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.44, lowerH * 0.49, 0.055),
      mats.darkGrilleMat
    );
    grilleBacking.position.set(0, baseChassisY + lowerH * 0.56, frontZ - 0.008);
    targetGroup.add(grilleBacking);

    // Sculpted horizontal grille louvers (Platinum/Luxury) or V-Series sport mesh bars
    const barCount = isV ? 4 : 5;
    for (let bi = 0; bi < barCount; bi++) {
      const frac = bi / Math.max(1, barCount - 1);
      const barY = baseChassisY + lowerH * (0.37 + frac * 0.36);
      const barW = carWidth * (0.33 + frac * 0.12);
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(barW, 0.016, 0.068),
        isV ? mats.darkGrilleMat : mats.chromeMat
      );
      bar.position.set(0, barY, frontZ - 0.013);
      targetGroup.add(bar);
    }

    // Outer Pentagon Shield Perimeter Trim (Top Brow, Lower Chin, Angled Side Cheeks)
    const grilleTopFrame = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.49, 0.032, 0.074),
      trimAccentMat
    );
    grilleTopFrame.position.set(0, baseChassisY + lowerH * 0.815, frontZ - 0.016);
    targetGroup.add(grilleTopFrame);

    const grilleBotFrame = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.34, 0.028, 0.072),
      trimAccentMat
    );
    grilleBotFrame.position.set(0, baseChassisY + lowerH * 0.315, frontZ - 0.014);
    targetGroup.add(grilleBotFrame);

    for (const side of [-1, 1]) {
      const sideCheek = new THREE.Mesh(
        new THREE.BoxGeometry(0.032, lowerH * 0.50, 0.072),
        trimAccentMat
      );
      sideCheek.rotation.z = side * -0.15;
      sideCheek.position.set(side * (carWidth * 0.215), baseChassisY + lowerH * 0.565, frontZ - 0.014);
      targetGroup.add(sideCheek);
    }

    // Multi-color Cadillac Wreath & Crest Emblem centered on grille
    const crestBack = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.088, 0.08), trimAccentMat);
    crestBack.position.set(0, baseChassisY + lowerH * 0.62, frontZ - 0.018);
    targetGroup.add(crestBack);
    const crestInlay = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.052, 0.084), mats.goldMat);
    crestInlay.position.set(0, baseChassisY + lowerH * 0.62, frontZ - 0.020);
    targetGroup.add(crestInlay);

    // Lower Bumper Air Dam & Satin Valance
    const lowerAirDam = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.64, 0.145, 0.065),
      mats.darkGrilleMat
    );
    lowerAirDam.position.set(0, baseChassisY + lowerH * 0.145, frontZ + 0.014);
    targetGroup.add(lowerAirDam);

    const frontSkidValance = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.44, 0.052, 0.072),
      trimAccentMat
    );
    frontSkidValance.position.set(0, baseChassisY + 0.055, frontZ + 0.018);
    targetGroup.add(frontSkidValance);

    for (const side of [-1, 1]) {
      // Sculpted Upper Slim Horizontal Brow Headlight + Outer Vertical Crystal DRL Tower
      const brow = evalFasciaAnchor(key, dim, side, 0.68, 0.87, 'front');
      const browHousing = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.062, 0.064), mats.darkGrilleMat);
      browHousing.rotation.y = brow.yaw;
      browHousing.position.set(brow.x, brow.y, brow.z - 0.002);
      targetGroup.add(browHousing);

      const upperBrowLed = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.024, 0.072), mats.headMat);
      upperBrowLed.rotation.y = brow.yaw;
      upperBrowLed.position.set(brow.x, brow.y + 0.006, brow.z - 0.008);
      targetGroup.add(upperBrowLed);

      const tower = evalFasciaAnchor(key, dim, side, 0.80, 0.50, 'front');
      addSignatureHeadlightCluster(targetGroup, side, tower.x, tower.y, tower.z - 0.004, tower.yaw, mats, 'escalade');

      // Vertical Corner Side Air Curtain Intake beneath Brow
      const cornerIntake = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.24, 0.065), mats.darkGrilleMat);
      cornerIntake.rotation.y = tower.yaw;
      cornerIntake.position.set(side * (carWidth * 0.415), baseChassisY + lowerH * 0.26, frontZ + 0.036);
      targetGroup.add(cornerIntake);

      // Iconic Full-Height D-Pillar Vertical Cadillac OLED Taillight Blades
      const pillarTlHousing = new THREE.Mesh(
        new THREE.BoxGeometry(0.108, lowerH * 0.58 + cabinH * 0.84, 0.076),
        mats.darkGrilleMat
      );
      pillarTlHousing.position.set(side * (carWidth * 0.425), baseChassisY + lowerH * 0.68 + cabinH * 0.41, rearZ - 0.006);
      targetGroup.add(pillarTlHousing);

      const pillarTl = new THREE.Mesh(
        new THREE.BoxGeometry(0.068, lowerH * 0.54 + cabinH * 0.79, 0.082),
        mats.brakeMat
      );
      pillarTl.position.set(side * (carWidth * 0.425), baseChassisY + lowerH * 0.68 + cabinH * 0.41, rearZ);
      targetGroup.add(pillarTl);

      // Crisp Beltline Window Trim & Roof Rails & Power-Deployable Running Boards
      const roofRail = new THREE.Mesh(
        new THREE.BoxGeometry(0.052, 0.048, cabinLen * 0.78),
        trimAccentMat
      );
      roofRail.position.set(side * (carWidth * 0.345), baseChassisY + lowerH * 0.96 + cabinH + 0.025, cabinZ);
      targetGroup.add(roofRail);

      const runningBoard = new THREE.Mesh(
        new THREE.BoxGeometry(0.115, 0.042, carLen * 0.42),
        trimAccentMat
      );
      runningBoard.position.set(side * (carWidth * 0.455), baseChassisY + 0.015, 0.02);
      targetGroup.add(runningBoard);
    }

    // Rear Roof Tailgate Spoiler + Brushed Tailgate Trim Strip
    const rearRoofWing = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.84, 0.065, 0.24),
      mats.bodyMat
    );
    rearRoofWing.position.set(0, baseChassisY + lowerH * 0.96 + cabinH - 0.01, rearZ - 0.08);
    targetGroup.add(rearRoofWing);

    const tailgateBar = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.74, 0.046, 0.065),
      trimAccentMat
    );
    tailgateBar.position.set(0, baseChassisY + lowerH * 0.80, rearZ);
    targetGroup.add(tailgateBar);

    if (archetype === 'cadillac_escalade_v' || trimId === 'escalade_sport_platinum') {
      for (const exX of [-0.66, -0.52, 0.52, 0.66]) {
        const pipe = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.058, 0.14), mats.chromeMat);
        pipe.position.set(exX, baseChassisY + 0.14, rearZ + 0.005);
        targetGroup.add(pipe);
      }
    } else {
      for (const exX of [-0.62, 0.62]) {
        const pipe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.062, 0.13), mats.chromeMat);
        pipe.position.set(exX, baseChassisY + 0.14, rearZ + 0.005);
        targetGroup.add(pipe);
      }
    }
  } else if (archetype === 'porsche_911') {
    const centralRad = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.42, 0.125, 0.055), mats.darkGrilleMat);
    centralRad.position.set(0, baseChassisY + lowerH * 0.25, frontZ + 0.015);
    targetGroup.add(centralRad);

    for (const side of [-1, 1]) {
      const hl = evalFasciaAnchor(key, dim, side, 0.65, 0.92, 'front');
      addSignatureHeadlightCluster(
        targetGroup,
        side,
        hl.x,
        hl.y + 0.038,
        hl.z + 0.065,
        hl.yaw * 0.85,
        mats,
        'porsche_911'
      );
    }
    const rearLightStrip = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.78, 0.05, 0.055), mats.brakeMat);
    rearLightStrip.position.set(0, tlY - 0.02, rearZ);
    targetGroup.add(rearLightStrip);
  } else if (archetype === 'lamborghini_huracan') {
    const yIntake = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.66, 0.135, 0.065), mats.darkGrilleMat);
    yIntake.position.set(0, baseChassisY + lowerH * 0.25, frontZ + 0.025);
    targetGroup.add(yIntake);

    for (const side of [-1, 1]) {
      const hl = evalFasciaAnchor(key, dim, side, 0.64, 0.88, 'front');
      addSignatureHeadlightCluster(targetGroup, side, hl.x, hl.y + 0.02, hl.z + 0.035, hl.yaw, mats, 'huracan');

      const tlPos = evalFasciaAnchor(key, dim, side, 0.64, 0.72, 'rear');
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.058, 0.055), mats.brakeMat);
      tl.rotation.y = tlPos.yaw;
      tl.position.set(tlPos.x, tlPos.y - 0.01, tlPos.z);
      targetGroup.add(tl);
    }
    if (trimId === 'huracan_sto') {
      const roofScoop = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.11, 0.48), mats.accentMat);
      roofScoop.position.set(0, baseChassisY + lowerH * 0.94 + cabinH + 0.04, cabinZ + 0.20);
      targetGroup.add(roofScoop);

      const sharkFin = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.19, 0.86), mats.accentMat);
      sharkFin.position.set(0, baseChassisY + lowerH + 0.14, carLen * 0.26);
      targetGroup.add(sharkFin);
    }
  } else if (archetype === 'mcmurtry_speirling') {
    const dorsalFin = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.22, 1.02), mats.accentMat);
    dorsalFin.position.set(0, baseChassisY + lowerH + 0.16, carLen * 0.24);
    targetGroup.add(dorsalFin);

    for (const side of [-1, 1]) {
      const hl = evalFasciaAnchor(key, dim, side, 0.64, 0.82, 'front');
      addSignatureHeadlightCluster(targetGroup, side, hl.x, hl.y + 0.01, hl.z + 0.035, hl.yaw, mats, 'koenigsegg');
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
    const horseshoeRing = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.028, 10, 22), mats.chromeMat);
    horseshoeRing.scale.set(0.95, 1.24, 1.0);
    horseshoeRing.position.set(0, baseChassisY + lowerH * 0.42, frontZ - 0.016);
    targetGroup.add(horseshoeRing);

    const horseshoeCore = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.075, 16), mats.darkGrilleMat);
    horseshoeCore.rotation.x = Math.PI / 2;
    horseshoeCore.scale.set(0.95, 1.0, 1.20);
    horseshoeCore.position.set(0, baseChassisY + lowerH * 0.42, frontZ - 0.012);
    targetGroup.add(horseshoeCore);

    const hoodSpine = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.026, carLen * 0.34), mats.accentMat);
    hoodSpine.position.set(0, baseChassisY + lowerH * 0.82, -carLen * 0.30);
    targetGroup.add(hoodSpine);

    for (const side of [-1, 1]) {
      const hl = evalFasciaAnchor(key, dim, side, 0.64, 0.80, 'front');
      addSignatureHeadlightCluster(targetGroup, side, hl.x, hl.y, hl.z + 0.015, hl.yaw, mats, 'bugatti_chiron');

      const cX = side * (carWidth * 0.472);
      const cCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(cX * 0.94, baseChassisY + lowerH * 0.95, cabinZ - 0.42),
        new THREE.Vector3(cX * 0.96, baseChassisY + lowerH * 1.18, cabinZ + 0.18),
        new THREE.Vector3(cX * 0.98, baseChassisY + lowerH * 0.92, cabinZ + 0.64),
        new THREE.Vector3(cX * 0.99, baseChassisY + lowerH * 0.42, cabinZ + 0.52),
        new THREE.Vector3(cX * 0.98, baseChassisY + 0.11, cabinZ + 0.04),
      ]);
      const cBar = new THREE.Mesh(
        new THREE.TubeGeometry(cCurve, 18, 0.022, 8, false),
        mats.chromeMat
      );
      targetGroup.add(cBar);

      const sideScoop = new THREE.Mesh(new THREE.BoxGeometry(0.04, lowerH * 0.54, 0.44), mats.darkGrilleMat);
      sideScoop.position.set(cX * 0.95, baseChassisY + lowerH * 0.50, cabinZ + 0.34);
      targetGroup.add(sideScoop);

      if (archetype === 'bugatti_chiron_super_sport') {
        for (let vRow = 0; vRow < 3; vRow++) {
          for (let vCol = 0; vCol < 3; vCol++) {
            const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 8), mats.darkGrilleMat);
            hole.position.set(side * (carWidth * 0.415 - vCol * 0.045), baseChassisY + lowerH * 0.88, dim.frontAxleZ - 0.10 + vRow * 0.055);
            targetGroup.add(hole);
          }
        }
      }
    }

    const rearBlade = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.80, 0.052, 0.055), mats.brakeMat);
    rearBlade.position.set(0, tlY - 0.02, rearZ);
    targetGroup.add(rearBlade);

    if (archetype === 'bugatti_chiron_super_sport') {
      for (const side of [-1, 1]) {
        for (const eyOff of [0.10, 0.19]) {
          const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.12, 10), mats.chromeMat);
          pipe.rotation.x = Math.PI / 2;
          pipe.position.set(side * 0.38, baseChassisY + eyOff, rearZ + 0.008);
          targetGroup.add(pipe);
        }
      }
    }

    if (trimId === 'chiron_ss_300plus') {
      for (const sOff of [-0.14, 0.14]) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.018, carLen * 0.88), mats.accentMat);
        stripe.position.set(sOff, baseChassisY + lowerH + 0.03, 0);
        targetGroup.add(stripe);
      }
    }
  } else if (archetype === 'rimac_nevera') {
    const frontAeroMouth = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.62, 0.115, 0.065), mats.darkGrilleMat);
    frontAeroMouth.position.set(0, baseChassisY + lowerH * 0.24, frontZ + 0.018);
    targetGroup.add(frontAeroMouth);

    for (const side of [-1, 1]) {
      const hl = evalFasciaAnchor(key, dim, side, 0.64, 0.85, 'front');
      addSignatureHeadlightCluster(targetGroup, side, hl.x, hl.y + 0.015, hl.z + 0.032, hl.yaw, mats, 'nevera');

      const cravatBlade = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.24, 0.72), mats.carbonMat);
      cravatBlade.rotation.x = -0.32;
      cravatBlade.position.set(side * (carWidth * 0.47), baseChassisY + lowerH * 0.44, 0.16);
      targetGroup.add(cravatBlade);

      const cravatPocket = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.38), mats.darkGrilleMat);
      cravatPocket.position.set(side * (carWidth * 0.465), baseChassisY + lowerH * 0.48, 0.36);
      targetGroup.add(cravatPocket);

      const tlPos = evalFasciaAnchor(key, dim, side, 0.65, 0.72, 'rear');
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.055, 0.055), mats.brakeMat);
      tl.rotation.y = tlPos.yaw;
      tl.position.set(tlPos.x, tlPos.y - 0.01, tlPos.z);
      targetGroup.add(tl);
    }
  } else {
    const frontMouth = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.60, 0.11, 0.065), mats.darkGrilleMat);
    frontMouth.position.set(0, baseChassisY + lowerH * 0.22, frontZ + 0.018);
    targetGroup.add(frontMouth);

    const engineSpine = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 0.055, carLen * 0.36),
      trimId === 'jesko_absolut_knc_gold' || trimId === 'agera_rs_gryphon' ? mats.goldMat : mats.carbonMat
    );
    engineSpine.position.set(0, baseChassisY + lowerH * 0.98, carLen * 0.22);
    targetGroup.add(engineSpine);

    for (const side of [-1, 1]) {
      const hl = evalFasciaAnchor(key, dim, side, 0.64, 0.88, 'front');
      addSignatureHeadlightCluster(
        targetGroup,
        side,
        hl.x,
        hl.y + 0.02,
        hl.z + 0.06,
        hl.yaw,
        mats,
        'koenigsegg'
      );

      const sideScoop = new THREE.Mesh(new THREE.BoxGeometry(0.055, lowerH * 0.54, 0.48), mats.darkGrilleMat);
      sideScoop.position.set(side * (carWidth * 0.468), baseChassisY + lowerH * 0.52, 0.28);
      targetGroup.add(sideScoop);

      const sideVane = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.028, 0.52), mats.carbonMat);
      sideVane.position.set(side * (carWidth * 0.475), baseChassisY + lowerH * 0.52, 0.28);
      targetGroup.add(sideVane);

      const tlPos = evalFasciaAnchor(key, dim, side, 0.64, 0.72, 'rear');
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.068, 0.055), mats.brakeMat);
      tl.rotation.y = tlPos.yaw;
      tl.position.set(tlPos.x, tlPos.y - 0.01, tlPos.z);
      targetGroup.add(tl);
    }
  }

  // Dedicated 3D Styling for Pickup Trucks & Off-Road / Sport SUVs
  if (archetype === 'pickup_crew') {
    // Open Cargo Bed Liner Floor + Side Bed Rails + Tailgate Seam
    const bedStartZ = cabinZ + cabinLen * 0.52;
    const bedLen = Math.max(1.15, rearZ - bedStartZ - 0.14);
    const bedCenterZ = bedStartZ + bedLen * 0.5;
    const bedY = baseChassisY + lowerH * 0.90;

    const bedFloor = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.74, 0.05, bedLen),
      mats.darkGrilleMat
    );
    bedFloor.position.set(0, bedY + 0.015, bedCenterZ);
    targetGroup.add(bedFloor);

    // Bedliner floor ribs
    for (const rx of [-0.42, -0.21, 0, 0.21, 0.42]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.035, bedLen * 0.88), mats.carbonMat);
      rib.position.set(rx, bedY + 0.04, bedCenterZ);
      targetGroup.add(rib);
    }

    // Raised bed side coamings & sport bar / tonneau detail
    for (const side of [-1, 1]) {
      const sideRail = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.09, bedLen + 0.06),
        mats.darkGrilleMat
      );
      sideRail.position.set(side * (carWidth * 0.40), bedY + 0.05, bedCenterZ);
      targetGroup.add(sideRail);

      const hl = evalFasciaAnchor(key, dim, side, 0.72, 0.74, 'front');
      addSignatureHeadlightCluster(
        targetGroup,
        side,
        hl.x,
        hl.y,
        hl.z + 0.01,
        hl.yaw,
        mats,
        'pickup_truck'
      );

      // Vertical Pickup Taillight Stacks
      const rearStack = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.34, 0.06), mats.brakeMat);
      rearStack.position.set(side * (carWidth * 0.42), baseChassisY + lowerH * 0.66, rearZ);
      targetGroup.add(rearStack);
    }

    // Aggressive Pickup Grille + 3 Amber Raptor Marker Lamps
    const truckGrille = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.62, lowerH * 0.38, 0.07),
      mats.darkGrilleMat
    );
    truckGrille.position.set(0, baseChassisY + lowerH * 0.62, frontZ - 0.005);
    targetGroup.add(truckGrille);
    for (const mx of [-0.16, 0, 0.16]) {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.032, 0.08), mats.amberMat);
      marker.position.set(mx, baseChassisY + lowerH * 0.78, frontZ - 0.012);
      targetGroup.add(marker);
    }
    // Roof Baja LED Lightbar on extreme offroad trims
    if (trimId.includes('raptor') || trimId.includes('trx') || trimId.includes('hummer')) {
      const roofLightHousing = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.56, 0.06, 0.10), mats.darkGrilleMat);
      roofLightHousing.position.set(0, baseChassisY + lowerH + cabinH + 0.03, cabinZ - cabinLen * 0.24);
      targetGroup.add(roofLightHousing);
      const roofLedStrip = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.50, 0.035, 0.04), mats.headMat);
      roofLedStrip.position.set(0, baseChassisY + lowerH + cabinH + 0.03, cabinZ - cabinLen * 0.28);
      targetGroup.add(roofLedStrip);
    }
  } else if (archetype === 'suv_offroad' || archetype === 'suv_sport') {
    const isOffroad = archetype === 'suv_offroad';
    const suvGrille = new THREE.Mesh(
      new THREE.BoxGeometry(carWidth * 0.56, lowerH * 0.38, 0.07),
      mats.darkGrilleMat
    );
    suvGrille.position.set(0, baseChassisY + lowerH * 0.58, frontZ - 0.005);
    targetGroup.add(suvGrille);

    for (const side of [-1, 1]) {
      const hl = evalFasciaAnchor(key, dim, side, 0.70, 0.72, 'front');
      addSignatureHeadlightCluster(
        targetGroup,
        side,
        hl.x,
        hl.y,
        hl.z + 0.01,
        hl.yaw,
        mats,
        isOffroad ? 'suv_offroad' : 'camry_sedan'
      );

      const suvTl = new THREE.Mesh(
        new THREE.BoxGeometry(isOffroad ? 0.13 : 0.34, isOffroad ? 0.32 : 0.085, 0.06),
        mats.brakeMat
      );
      suvTl.position.set(side * (carWidth * (isOffroad ? 0.41 : 0.32)), baseChassisY + lowerH * 0.70, rearZ);
      targetGroup.add(suvTl);

      if (isOffroad) {
        const roofRail = new THREE.Mesh(
          new THREE.BoxGeometry(0.052, 0.052, cabinLen * 0.72),
          mats.carbonMat
        );
        roofRail.position.set(side * (carWidth * 0.33), baseChassisY + lowerH * 0.96 + cabinH + 0.028, cabinZ);
        targetGroup.add(roofRail);
      }
    }

    // Rear tailgate-mounted full-size spare tire carrier on Trail/Rock-Crawler SUVs
    if (isOffroad && (trimId.includes('bronco') || trimId.includes('wrangler') || trimId.includes('392') || trimId.includes('g63') || trimId.includes('defender'))) {
      const spareTire = new THREE.Mesh(
        new THREE.CylinderGeometry(wheelRadius * 0.88, wheelRadius * 0.88, 0.24, 18),
        mats.darkGrilleMat
      );
      spareTire.rotation.x = Math.PI / 2;
      spareTire.position.set(0, baseChassisY + lowerH * 0.76, rearZ + 0.14);
      targetGroup.add(spareTire);

      const spareHub = new THREE.Mesh(
        new THREE.CylinderGeometry(wheelRadius * 0.42, wheelRadius * 0.42, 0.26, 12),
        mats.chromeMat
      );
      spareHub.rotation.x = Math.PI / 2;
      spareHub.position.set(0, baseChassisY + lowerH * 0.76, rearZ + 0.14);
      targetGroup.add(spareHub);
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
    const isTopMountJesko = archetype === 'koenigsegg_jesko' || archetype === 'koenigsegg_agera_rs';

    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(0.042, wingHeight + (isTopMountJesko ? 0.06 : 0), 0.15),
        mats.carbonMat
      );
      strut.rotation.x = isTopMountJesko ? -0.35 : 0;
      strut.position.set(
        side * (carWidth * (isTopMountJesko ? 0.14 : 0.26)),
        baseChassisY + lowerH + wingHeight * 0.5,
        carLen * (isTopMountJesko ? 0.35 : 0.41)
      );
      targetGroup.add(strut);

      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.17, 0.32), wingMat);
      endplate.position.set(side * (wingWidth * 0.5), baseChassisY + lowerH + wingHeight, carLen * 0.42);
      targetGroup.add(endplate);
    }

    const wingBlade = new THREE.Mesh(buildAirfoilWingGeometry(wingWidth, 0.28, 0.042), wingMat);
    wingBlade.position.set(0, baseChassisY + lowerH + wingHeight, carLen * 0.42);
    targetGroup.add(wingBlade);
  } else if (aeroStyle === 'sport_spoiler' && !isTruckOrSuv) {
    const lipSpoiler = new THREE.Mesh(
      buildAirfoilWingGeometry(carWidth * 0.80, 0.15, 0.04),
      mats.carbonMat
    );
    lipSpoiler.position.set(0, baseChassisY + lowerH + 0.02, carLen * 0.44);
    targetGroup.add(lipSpoiler);
  } else if (aeroStyle === 'sport_spoiler' && archetype === 'suv_sport') {
    const suvRoofWing = new THREE.Mesh(
      buildAirfoilWingGeometry(carWidth * 0.76, 0.18, 0.045),
      mats.carbonMat
    );
    suvRoofWing.position.set(0, baseChassisY + lowerH * 0.96 + cabinH - 0.02, rearZ - 0.12);
    targetGroup.add(suvRoofWing);
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
  const caliperMat = getSharedCaliperMat(caliperColorHex);

  const cornerSpecs: Array<{
    key: keyof StreetCarWheelRig;
    wx: number;
    wy: number;
    wz: number;
    isFront: boolean;
    isLeft: boolean;
  }> = [
    { key: 'fl', wx: -wheelCenterX, wy: wheelRadius, wz: dim.frontAxleZ, isFront: true, isLeft: true },
    { key: 'fr', wx: wheelCenterX, wy: wheelRadius, wz: dim.frontAxleZ, isFront: true, isLeft: false },
    { key: 'rl', wx: -wheelCenterX, wy: wheelRadius, wz: dim.rearAxleZ, isFront: false, isLeft: true },
    { key: 'rr', wx: wheelCenterX, wy: wheelRadius, wz: dim.rearAxleZ, isFront: false, isLeft: false },
  ];

  const rigCorners: Partial<StreetCarWheelRig> = {};

  for (const specCorner of cornerSpecs) {
    const { key: cKey, wx, wy, wz, isFront, isLeft } = specCorner;
    const suspGroup = new THREE.Group();
    suspGroup.name = `street_wheel_susp_${cKey}`;
    suspGroup.position.set(wx, wy, wz);

    const steerGroup = new THREE.Group();
    steerGroup.name = `street_wheel_steer_${cKey}`;
    suspGroup.add(steerGroup);

    const spinGroup = new THREE.Group();
    spinGroup.name = `street_wheel_spin_${cKey}`;
    steerGroup.add(spinGroup);

    const outX = wx < 0 ? -0.095 : 0.095;
    // Caliper stays mounted on steerGroup so it steers with front wheels without spinning
    const caliperMesh = new THREE.Mesh(caliperGeom, caliperMat);
    caliperMesh.position.set(outX * 0.68, 0, 0);
    caliperMesh.rotation.x = wz < 0 ? 0.35 : -2.25;
    steerGroup.add(caliperMesh);

    const tireMesh = new THREE.Mesh(wheelGeom, mats.darkGrilleMat);
    spinGroup.add(tireMesh);

    const rimMesh = new THREE.Mesh(rimBarrelGeom, rimMaterial);
    spinGroup.add(rimMesh);

    const discMesh = new THREE.Mesh(brakeDiscGeom, mats.rotorMat);
    discMesh.position.set(outX * 0.62, 0, 0);
    spinGroup.add(discMesh);

    for (let sIdx = 0; sIdx < 5; sIdx++) {
      const baseAng = (sIdx * Math.PI * 2) / 5;
      for (const ySplit of [-0.14, 0.14]) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.020, wheelRadius * 0.65, 0.022), rimMaterial);
        const a = baseAng + ySplit;
        spoke.rotation.x = a;
        spoke.position.set(outX * 1.12, Math.cos(a) * wheelRadius * 0.32, Math.sin(a) * wheelRadius * 0.32);
        spinGroup.add(spoke);
      }
    }

    const centerCap = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.035, 12), rimMaterial);
    centerCap.rotation.z = Math.PI / 2;
    centerCap.position.set(outX * 1.15, 0, 0);
    spinGroup.add(centerCap);

    targetGroup.add(suspGroup);

    rigCorners[cKey] = {
      suspGroup,
      steerGroup,
      spinGroup,
      baseY: wy,
      radius: wheelRadius,
      isFront,
      isLeft,
    };
  }

  targetGroup.userData.streetWheelRig = rigCorners as StreetCarWheelRig;

  return dim;
}

/**
 * Attaches sculpted civilian traffic bodywork (extruded wheel-arch hull + flush glasshouse)
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
  const lowerH = style === 'suv' ? 0.76 : style === 'coupe' ? 0.58 : 0.62;
  const cabinH = style === 'suv' ? 0.64 : style === 'coupe' ? 0.40 : 0.48;
  const cabinLen = style === 'suv' ? 3.04 : style === 'coupe' ? 2.12 : 2.50;
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

  const hullMesh = new THREE.Mesh(buildSculptedLowerHullGeometry(key, dim), bodyMat);
  targetGroup.add(hullMesh);

  const wellMesh = new THREE.Mesh(buildWheelWellLinersGeometry(dim), trimMat);
  targetGroup.add(wellMesh);

  const archLipMesh = new THREE.Mesh(buildFenderArchTrimGeometry(dim), style === 'suv' ? trimMat : bodyMat);
  targetGroup.add(archLipMesh);

  const { glassGeo, pillarRoofGeo } = buildLoftedGreenhouseParts(key, dim);
  const canopyMesh = new THREE.Mesh(glassGeo, glassMat);
  targetGroup.add(canopyMesh);

  const roofPillars = new THREE.Mesh(pillarRoofGeo, bodyMat);
  targetGroup.add(roofPillars);

  if (style === 'suv') {
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, cabinLen * 0.64), chromeMat);
      rail.position.set(side * (carWidth * 0.32), dim.baseY + lowerH * 0.94 + cabinH + 0.03, cabinZ);
      targetGroup.add(rail);
    }
  }

  const grille = new THREE.Mesh(
    new THREE.BoxGeometry(carWidth * (style === 'suv' ? 0.56 : 0.48), style === 'suv' ? 0.25 : 0.16, 0.065),
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

  for (const side of [-1, 1]) {
    const mirrorCap = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.07, 0.09), bodyMat);
    mirrorCap.rotation.y = side * 0.2;
    mirrorCap.position.set(side * (carWidth * 0.47), dim.baseY + lowerH + 0.06, cabinZ - cabinLen * 0.34);
    targetGroup.add(mirrorCap);

    const hl = evalFasciaAnchor(key, dim, side, 0.65, 0.80, 'front');
    addSignatureHeadlightCluster(targetGroup, side, hl.x, hl.y, hl.z + 0.008, hl.yaw, civHeadMats, key, {
      drlOverrideMat: drlMat,
    });

    const sigPos = evalFasciaAnchor(key, dim, side, 0.83, 0.72, 'front');
    const sigMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, 0.055, 0.05),
      side < 0 ? leftAmberMat : rightAmberMat
    );
    sigMesh.rotation.y = sigPos.yaw;
    sigMesh.position.set(sigPos.x, sigPos.y, sigPos.z + 0.005);
    targetGroup.add(sigMesh);
  }

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

  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(carWidth * 0.74, 0.11, 0.13), carbonMat);
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
  const lowerH = 0.65;
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

  const hull = new THREE.Mesh(buildSculptedLowerHullGeometry('police_cruiser', dim), blackMat);
  targetGroup.add(hull);

  const wellMesh = new THREE.Mesh(buildWheelWellLinersGeometry(dim), steelMat);
  targetGroup.add(wellMesh);

  for (const side of [-1, 1]) {
    const doorPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, lowerH * 0.54, 1.80),
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

  const pushBar = new THREE.Mesh(new THREE.BoxGeometry(1.30, 0.40, 0.15), steelMat);
  pushBar.position.set(0, dim.baseY + 0.25, -carLen * 0.505);
  targetGroup.add(pushBar);

  const spoiler = new THREE.Mesh(buildAirfoilWingGeometry(carWidth * 0.80, 0.17, 0.038), blackMat);
  spoiler.position.set(0, dim.baseY + lowerH + 0.04, carLen * 0.44);
  targetGroup.add(spoiler);

  const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.052, 0.23), steelMat);
  barBase.position.set(0, dim.baseY + lowerH * 0.94 + cabinH + 0.05, cabinZ);
  targetGroup.add(barBase);

  const redPod = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 0.20), redStrobeMat);
  redPod.position.set(-0.33, dim.baseY + lowerH * 0.94 + cabinH + 0.095, cabinZ);
  targetGroup.add(redPod);

  const bluePod = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 0.20), blueStrobeMat);
  bluePod.position.set(0.33, dim.baseY + lowerH * 0.94 + cabinH + 0.095, cabinZ);
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
    const hl = evalFasciaAnchor('police_cruiser', dim, side, 0.65, 0.78, 'front');
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
