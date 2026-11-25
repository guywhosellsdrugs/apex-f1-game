import * as THREE from 'three';
import { CircuitInfo } from '../types/racing';
import { buildCircuitScenery } from './environmentBuilder';
import { GraphicsQuality, getGraphicsPresetConfig, isDynamicGraphics } from '../utils/graphicsSettings';
import {
  ALL_MARYLAND_ROADS,
  MARYLAND_SIGNAL_JUNCTIONS,
  renderMarylandRoadSpecs,
  isOnMarylandPavedSurface,
  distSqPointToSeg,
} from './marylandRoadNetwork';
import {
  CityBuildingBox,
  CityTrafficLightGantry,
  getIntersectionSignalState,
  BuiltSuburbanHouse,
  registerSuburbanGpsEntries,
  CITY_SERVICE_STATIONS,
} from './cityTrafficBuilder';
import { buildGaithersburgDistrict } from './gaithersburgBuilder';
import { buildBaltimoreDistrict } from './baltimoreBuilder';
import { buildMarylandStateDistrict } from './marylandStateBuilder';
import { SuburbanBatchBuilder } from './suburbanBatchBuilder';
import { WorldChunkManager } from './worldChunkManager';
import {
  getAsphaltPBRTextures,
  getTerrainPBRTextures,
  getConcretePBRTextures,
} from './pbrTextures';
import { buildDetailedSingleTreeGroup, updateFoliageWindTime } from './foliageBuilder';

export interface SurfaceInfo {
  offTrack: boolean;
  onCurb: boolean;
  distanceToCenterline: number;
  lateralOffset: number; // Signed: negative = left, positive = right
  progress: number; // 0 to 1 along circuit
  trackPoint: THREE.Vector3;
  tangent: THREE.Vector3;
  normal: THREE.Vector3;
  isCollidingWall: boolean;
  wallNormal: THREE.Vector3;
  penetration: number;
  barrierLimit: number;
}

export interface GeneratedTrack {
  group: THREE.Group;
  sceneryGroup: THREE.Group;
  curve: THREE.CatmullRomCurve3;
  trackLength: number;
  barrierLimit: number;
  isOpenField?: boolean;
  isCityDriving?: boolean;
  cityBuildings?: CityBuildingBox[];
  suburbanHouses?: BuiltSuburbanHouse[];
  bankPosition?: { x: number; z: number };
  policeStationPosition?: { x: number; z: number };
  startGantry: THREE.Group;
  startLights: THREE.Mesh[];
  setStartLights: (lightsLitCount: number, lightsOut: boolean) => void;
  setReflectionTexture: (tex: THREE.Texture | null, intensity?: number) => void;
  setReflectionPassMode: (active: boolean) => void;
  setDynamicReflectorsHidden?: (hidden: boolean) => void;
  setRoadWetness?: (wetness: number) => void;
  getTrackPointAtProgress: (t: number) => { position: THREE.Vector3; tangent: THREE.Vector3; normal: THREE.Vector3 };
  getTargetCornerSpeedKmh: (t: number) => number;
  checkSurfaceType: (pos: THREE.Vector3, hintProgress?: number) => SurfaceInfo;
  updateInfiniteRoadOrigin?: (playerX: number, playerZ: number) => void;
  updateCityTrafficLights?: (timeSec: number, playerX: number, playerZ: number) => void;
  updateWorldChunks?: (
    camera: THREE.Camera,
    playerPos: THREE.Vector3,
    opts: { isDynamicMode: boolean; qualityFactor: number; chunkLoadScale?: number; aggressiveDynamic?: boolean }
  ) => void;
  setReflectionChunkCull?: (active: boolean, playerPos?: THREE.Vector3) => void;
  setNightIntensity?: (nightFactor: number) => void;
  dispose?: () => void;
}

/**
 * Attaches a realistic dark asphalt road specular sheen shader
 * to road materials (Metro City streets, Proving Ground, and F1 circuits).
 * - Preserves asphalt aggregate texture and crisp road markings
 * - Provides subtle, diffused grazing specular sheen (reflecting brake lights,
 *   headlights, and ambient city lights at grazing angles without turning the road into a mirror)
 */
function attachBlackScreenRoadReflectionShader(
  mat: THREE.Material,
  reflectionUniforms: {
    uPlanarReflectionMap: { value: THREE.Texture | null };
    uReflectionIntensity: { value: number };
  },
  uvRepeatX: number,
  uvRepeatY: number,
  isUltra: boolean
) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPlanarReflectionMap = reflectionUniforms.uPlanarReflectionMap;
    shader.uniforms.uReflectionIntensity = reflectionUniforms.uReflectionIntensity;

    shader.vertexShader =
      `varying vec2 vTrackUv;\nvarying vec4 vReflClipPos;\nvarying vec3 vReflWorldPos;\n` +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vTrackUv = uv;
        vReflClipPos = gl_Position;
        vReflWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader =
      `uniform sampler2D uPlanarReflectionMap;\nuniform float uReflectionIntensity;\nvarying vec2 vTrackUv;\nvarying vec4 vReflClipPos;\nvarying vec3 vReflWorldPos;\n` +
      shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        vec4 rawTex = texture2D(map, vTrackUv * vec2(${uvRepeatX.toFixed(1)}, ${uvRepeatY.toFixed(1)}));
        float isMarking = smoothstep(0.18, 0.42, max(rawTex.r, max(rawTex.g, rawTex.b)));

        // Polished Nero Marquina Black Marble base with subtle organic mineral veining
        float veinCoord = sin(vReflWorldPos.x * 0.045 + sin(vReflWorldPos.z * 0.035) * 3.4) * 0.5 + 0.5;
        float veinCoord2 = sin(vReflWorldPos.z * 0.065 + cos(vReflWorldPos.x * 0.05) * 2.8) * 0.5 + 0.5;
        float veinPattern = smoothstep(0.72, 0.96, veinCoord) * 0.16 + smoothstep(0.76, 0.98, veinCoord2) * 0.10;
        
        // Deep obsidian-black marble body
        vec3 marbleBaseCol = vec3(0.012, 0.014, 0.018);
        vec3 marbleVeinCol = vec3(0.085, 0.095, 0.115);
        vec3 blackMarbleSurface = mix(marbleBaseCol, marbleVeinCol, veinPattern);
        
        // Retain crisp painted lane markings atop the marble surface
        gl_FragColor.rgb = mix(blackMarbleSurface, gl_FragColor.rgb, isMarking);

        if (uReflectionIntensity > 0.001) {
          vec2 reflUV = (vReflClipPos.xy / max(0.0001, vReflClipPos.w)) * 0.5 + 0.5;
          reflUV.x = 1.0 - reflUV.x;

          // Polished high-gloss marble micro-sheen (minimal distortion, high reflection clarity)
          vec2 microRipple = (sin(vReflWorldPos.xz * 22.0) * 0.0012 + cos(vReflWorldPos.zx * 44.0) * 0.0008) * (1.0 - isMarking * 0.6);
          vec2 uvSample = clamp(reflUV + microRipple, 0.004, 0.996);
          vec2 b1 = vec2(0.0028, 0.0035);
          vec3 reflColor = texture2D(uPlanarReflectionMap, uvSample).rgb * 0.44
            + texture2D(uPlanarReflectionMap, clamp(uvSample + vec2(b1.x, 0.0), 0.004, 0.996)).rgb * 0.14
            + texture2D(uPlanarReflectionMap, clamp(uvSample - vec2(b1.x, 0.0), 0.004, 0.996)).rgb * 0.14
            + texture2D(uPlanarReflectionMap, clamp(uvSample + vec2(0.0, b1.y), 0.004, 0.996)).rgb * 0.14
            + texture2D(uPlanarReflectionMap, clamp(uvSample - vec2(0.0, b1.y), 0.004, 0.996)).rgb * 0.14;

          vec3 viewVec = normalize(cameraPosition - vReflWorldPos);
          float ndotv = clamp(abs(viewVec.y), 0.0, 1.0);
          
          // Polished marble specular Fresnel: lustrous reflection that deepens realistically down the road
          float grazingFresnel = pow(1.0 - ndotv, 2.1);
          float marbleReflFactor = clamp(uReflectionIntensity * (0.18 + 0.52 * grazingFresnel), 0.0, 0.48);
          
          // Painted markings have lower specular polish than the bare stone
          marbleReflFactor *= (1.0 - isMarking * 0.55);
          gl_FragColor.rgb += reflColor * marbleReflFactor;
        }`
      );
  };
  mat.needsUpdate = true;
}

/**
 * Attaches realistic planar Fresnel sheen onto Maryland city asphalt without replacing its charcoal aggregate surface.
 */
function attachCityRoadReflectionShader(
  mat: THREE.Material,
  reflectionUniforms: {
    uPlanarReflectionMap: { value: THREE.Texture | null };
    uReflectionIntensity: { value: number };
    uRoadWetness: { value: number };
  },
  isUltra: boolean
) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPlanarReflectionMap = reflectionUniforms.uPlanarReflectionMap;
    shader.uniforms.uReflectionIntensity = reflectionUniforms.uReflectionIntensity;
    shader.uniforms.uRoadWetness = reflectionUniforms.uRoadWetness;

    shader.vertexShader =
      `varying vec4 vCityReflClipPos;\nvarying vec3 vCityReflWorldPos;\n` +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vCityReflClipPos = gl_Position;
        vCityReflWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader =
      `uniform sampler2D uPlanarReflectionMap;\nuniform float uReflectionIntensity;\nuniform float uRoadWetness;\nvarying vec4 vCityReflClipPos;\nvarying vec3 vCityReflWorldPos;\n` +
      shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        float wet = clamp(uRoadWetness, 0.0, 1.0);
        if (wet > 0.02) {
          float patchNoise = sin(vCityReflWorldPos.x * 0.14) * cos(vCityReflWorldPos.z * 0.14) * 0.5 + 0.5;
          float wetDarken = mix(0.90, 0.68, patchNoise);
          gl_FragColor.rgb *= mix(1.0, wetDarken, wet);
        }
        if (uReflectionIntensity > 0.001) {
          vec2 reflUV = (vCityReflClipPos.xy / max(0.0001, vCityReflClipPos.w)) * 0.5 + 0.5;
          reflUV.x = 1.0 - reflUV.x;
          float rippleAmp = mix(0.0006, 0.0022, wet);
          vec2 microJitter = sin(vCityReflWorldPos.xz * 18.0) * rippleAmp;
          vec2 uvS = clamp(reflUV + microJitter, 0.004, 0.996);
          vec2 bStep = mix(vec2(0.0038, 0.0044), vec2(0.0016, 0.0021), wet);
          vec3 reflSample = texture2D(uPlanarReflectionMap, uvS).rgb * 0.44
            + texture2D(uPlanarReflectionMap, clamp(uvS + vec2(bStep.x, 0.0), 0.004, 0.996)).rgb * 0.14
            + texture2D(uPlanarReflectionMap, clamp(uvS - vec2(bStep.x, 0.0), 0.004, 0.996)).rgb * 0.14
            + texture2D(uPlanarReflectionMap, clamp(uvS + vec2(0.0, bStep.y), 0.004, 0.996)).rgb * 0.14
            + texture2D(uPlanarReflectionMap, clamp(uvS - vec2(0.0, bStep.y), 0.004, 0.996)).rgb * 0.14;
          vec3 viewDir = normalize(cameraPosition - vCityReflWorldPos);
          float ndotv = clamp(abs(viewDir.y), 0.0, 1.0);
          // Dry asphalt uses high Fresnel & minimal grazing sheen; wet/rainy asphalt reflects noticeably across lanes
          float dryFresnel = pow(1.0 - ndotv, ${isUltra ? '4.6' : '5.0'});
          float wetFresnel = pow(1.0 - ndotv, ${isUltra ? '1.85' : '2.3'});
          float dryFactor = ${isUltra ? '0.010 + 0.048 * dryFresnel' : '0.006 + 0.025 * dryFresnel'};
          float wetFactor = ${isUltra ? '0.22 + 0.68 * wetFresnel' : '0.12 + 0.38 * wetFresnel'};
          float puddleNoise = sin(vCityReflWorldPos.x * 0.11 + vCityReflWorldPos.z * 0.09) * 0.5 + 0.5;
          float puddleVar = mix(0.62, 1.32, smoothstep(0.25, 0.85, puddleNoise));
          float combinedFactor = mix(dryFactor, wetFactor * puddleVar, wet);
          float reflWeight = clamp(uReflectionIntensity * combinedFactor, 0.0, mix(${isUltra ? '0.026' : '0.015'}, ${isUltra ? '0.44' : '0.22'}, wet));
          gl_FragColor.rgb += reflSample * reflWeight;
        }`
      );
  };
  mat.needsUpdate = true;
}

export function generateTrack(circuit: CircuitInfo, quality?: GraphicsQuality): GeneratedTrack {
  if (circuit.id === 'open_field_proving_ground') {
    return generateOpenFieldTrack(circuit, quality);
  }
  if (circuit.id === 'city_driving_metro') {
    return generateCityDrivingTrack(circuit, quality);
  }
  const group = new THREE.Group();
  const preset = getGraphicsPresetConfig(quality);
  const isLow = preset.id === 'low';
  const isUltra = preset.id === 'ultra';

  // 1. Build smooth closed 3D Catmull-Rom spline
  const points = circuit.trackPoints.map((p) => new THREE.Vector3(p.x, p.y, p.z));
  const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.25);
  const trackLength = curve.getLength();

  // Curve subdivisions scaled by graphics quality (380 on Low -> 1280 on Ultra Realistic)
  const segments = preset.trackSegments;
  const trackWidth = 22.0; // 22 meters wide
  const curbWidth = 1.8;
  const runoffWidth = 3.6;

  // Geometry buffers
  const trackGeom = new THREE.BufferGeometry();
  const trackVerts: number[] = [];
  const trackUVs: number[] = [];
  const trackIndices: number[] = [];

  const curbGeomL = new THREE.BufferGeometry();
  const curbVertsL: number[] = [];
  const curbColorsL: number[] = [];
  const curbIndicesL: number[] = [];

  const curbGeomR = new THREE.BufferGeometry();
  const curbVertsR: number[] = [];
  const curbColorsR: number[] = [];
  const curbIndicesR: number[] = [];

  const runoffGeomL = new THREE.BufferGeometry();
  const runoffVertsL: number[] = [];
  const runoffColorsL: number[] = [];
  const runoffIndicesL: number[] = [];

  const runoffGeomR = new THREE.BufferGeometry();
  const runoffVertsR: number[] = [];
  const runoffColorsR: number[] = [];
  const runoffIndicesR: number[] = [];

  const barrierGeomL = new THREE.BufferGeometry();
  const barrierVertsL: number[] = [];
  const barrierColorsL: number[] = [];
  const barrierIndicesL: number[] = [];

  const barrierGeomR = new THREE.BufferGeometry();
  const barrierVertsR: number[] = [];
  const barrierColorsR: number[] = [];
  const barrierIndicesR: number[] = [];

  const up = new THREE.Vector3(0, 1, 0);

  // Pre-sample track centerline to guarantee barriers never encroach on any other track section
  const trackCenterSamples = Array.from({ length: 250 }, (_, s) => curve.getPointAt(s / 250));

  // Pre-calculate track ribbons with symmetrical left & right barriers
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pt = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

    // Road vertices
    const pLeft = pt.clone().addScaledVector(right, -trackWidth * 0.5);
    const pRight = pt.clone().addScaledVector(right, trackWidth * 0.5);

    trackVerts.push(pLeft.x, pLeft.y, pLeft.z);
    trackVerts.push(pRight.x, pRight.y, pRight.z);

    const uvY = (t * trackLength) / 24;
    trackUVs.push(0, uvY);
    trackUVs.push(1, uvY);

    // Curbs Left & Right
    const curbOutL = pLeft.clone().addScaledVector(right, -curbWidth);
    curbOutL.y += 0.09;
    curbVertsL.push(pLeft.x, pLeft.y, pLeft.z);
    curbVertsL.push(curbOutL.x, curbOutL.y, curbOutL.z);

    const curbOutR = pRight.clone().addScaledVector(right, curbWidth);
    curbOutR.y += 0.09;
    curbVertsR.push(pRight.x, pRight.y, pRight.z);
    curbVertsR.push(curbOutR.x, curbOutR.y, curbOutR.z);

    // Authentic Circuit Curb Colors:
    // Abu Dhabi: Yas Marina Cyan (#00a3b8) & White
    // Spa: Belgian Yellow (#f59e0b) & Red
    // Monza: Italian Tricolore Green (#16a34a), White, Red
    // Default: FIA Red & White
    const curbStep = Math.floor((t * trackLength) / 2.2);
    let cr = 0.98, cg = 0.98, cb = 0.98;
    if (preset.id === 'retro' || preset.id === 'retro_pixel') {
      const retroMod = curbStep % 3;
      if (retroMod === 0) { cr = 1.0; cg = 0.16; cb = 0.52; } // OutRun Neon Magenta
      else if (retroMod === 1) { cr = 1.0; cg = 0.90; cb = 0.0; } // Arcade Turbo Yellow
      else { cr = 0.0; cg = 0.94; cb = 1.0; } // CRT Electric Cyan
    } else if (circuit.id === 'abudhabi') {
      const isYasCyan = curbStep % 2 === 0;
      cr = isYasCyan ? 0.0 : 0.98;
      cg = isYasCyan ? 0.65 : 0.98;
      cb = isYasCyan ? 0.75 : 0.98;
    } else if (circuit.id === 'spa') {
      const isSpaYellow = curbStep % 2 === 0;
      cr = isSpaYellow ? 0.96 : 0.88;
      cg = isSpaYellow ? 0.72 : 0.12;
      cb = isSpaYellow ? 0.08 : 0.12;
    } else if (circuit.id === 'monza') {
      const monzaMod = curbStep % 3;
      if (monzaMod === 0) { cr = 0.08; cg = 0.65; cb = 0.28; } // Green
      else if (monzaMod === 1) { cr = 0.98; cg = 0.98; cb = 0.98; } // White
      else { cr = 0.90; cg = 0.12; cb = 0.12; } // Red
    } else {
      const isRed = curbStep % 2 === 0;
      cr = isRed ? 0.95 : 0.98;
      cg = isRed ? 0.08 : 0.98;
      cb = isRed ? 0.08 : 0.98;
    }
    curbColorsL.push(cr, cg, cb, cr, cg, cb);
    curbColorsR.push(cr, cg, cb, cr, cg, cb);

    // Check local and lookahead track curvature so inner corner walls never pinch, fold, or block sightlines
    const stepAhead = 0.008;
    const nextT = (t + stepAhead) % 1.0;
    const lookT = (t + 0.022) % 1.0;
    const prevT = ((t - 0.012) % 1.0 + 1.0) % 1.0;
    const nextTangent = curve.getTangentAt(nextT).normalize();
    const lookTangent = curve.getTangentAt(lookT).normalize();
    const prevTangent = curve.getTangentAt(prevT).normalize();

    const turnAngle = tangent.clone().cross(nextTangent).y; // positive = left turn, negative = right turn
    const lookTurnAngle = prevTangent.clone().cross(lookTangent).y;
    const absTurn = Math.abs(turnAngle);
    const absLookTurn = Math.abs(lookTurnAngle);

    // Compact inner runoff on sharp turns prevents inner barrier vertices from crossing the center of curvature
    const isLeftBend = turnAngle > 0.012 || lookTurnAngle > 0.025;
    const isRightBend = turnAngle < -0.012 || lookTurnAngle < -0.025;
    const dynamicRunoffL = isLeftBend
      ? Math.max(2.4, runoffWidth - Math.min(1.1, absTurn * 3.0))
      : runoffWidth + (isRightBend ? Math.min(2.2, absTurn * 3.0) : 0);
    const dynamicRunoffR = isRightBend
      ? Math.max(2.4, runoffWidth - Math.min(1.1, absTurn * 3.0))
      : runoffWidth + (isLeftBend ? Math.min(2.2, absTurn * 3.0) : 0);

    // Painted Runoff borders (Left & Right)
    const runoffOutL = curbOutL.clone().addScaledVector(right, -dynamicRunoffL);
    runoffVertsL.push(curbOutL.x, curbOutL.y - 0.03, curbOutL.z);
    runoffVertsL.push(runoffOutL.x, runoffOutL.y - 0.03, runoffOutL.z);

    const runoffOutR = curbOutR.clone().addScaledVector(right, dynamicRunoffR);
    runoffVertsR.push(curbOutR.x, curbOutR.y - 0.03, curbOutR.z);
    runoffVertsR.push(runoffOutR.x, runoffOutR.y - 0.03, runoffOutR.z);

    let rR = 0.05, rG = 0.35, rB = 0.85;
    if (circuit.id === 'abudhabi') {
      const isAlt = Math.floor((t * trackLength) / 5.0) % 2 === 0;
      rR = isAlt ? 0.0 : 0.05;
      rG = isAlt ? 0.60 : 0.45;
      rB = isAlt ? 0.78 : 0.65;
    } else {
      const isRunoffBlue = Math.floor((t * trackLength) / 6.0) % 2 === 0;
      rR = isRunoffBlue ? 0.05 : 0.85;
      rG = isRunoffBlue ? 0.35 : 0.12;
      rB = isRunoffBlue ? 0.85 : 0.12;
    }
    runoffColorsL.push(rR, rG, rB, rR, rG, rB);
    runoffColorsR.push(rR, rG, rB, rR, rG, rB);

    // Armco & Tecpro Barrier walls on LEFT and RIGHT
    // On the INSIDE of corners (and corner entries/exits), lower the inner barrier height to 0.52m
    // so drivers and cameras have an unobstructed panoramic sightline across every apex (zero blind corners!)
    const barrierBaseL = runoffOutL.clone().addScaledVector(right, -1.0);
    const barrierBaseR = runoffOutR.clone().addScaledVector(right, 1.0);

    const leftInnerBlend = isLeftBend ? Math.min(1.0, Math.max(absTurn * 14.0, absLookTurn * 6.5)) : 0;
    const rightInnerBlend = isRightBend ? Math.min(1.0, Math.max(absTurn * 14.0, absLookTurn * 6.5)) : 0;
    const baseWallHeight = circuit.id === 'monaco' ? 1.55 : 2.0;
    const barrierHeightL = THREE.MathUtils.lerp(baseWallHeight, 0.52, leftInnerBlend);
    const barrierHeightR = THREE.MathUtils.lerp(baseWallHeight, 0.52, rightInnerBlend);

    const barrierTopL = barrierBaseL.clone();
    barrierTopL.y += barrierHeightL;
    barrierVertsL.push(barrierBaseL.x, barrierBaseL.y, barrierBaseL.z);
    barrierVertsL.push(barrierTopL.x, barrierTopL.y, barrierTopL.z);

    const barrierTopR = barrierBaseR.clone();
    barrierTopR.y += barrierHeightR;
    barrierVertsR.push(barrierBaseR.x, barrierBaseR.y, barrierBaseR.z);
    barrierVertsR.push(barrierTopR.x, barrierTopR.y, barrierTopR.z);

    // Sponsor wall alternating pattern (Rolex Green, Pirelli Red, DHL Yellow, White Chevron)
    const sponsorIdx = Math.floor((t * trackLength) / 20) % 4;
    let wr = 0.8, wg = 0.8, wb = 0.8;
    if (sponsorIdx === 0) { wr = 0.02; wg = 0.42; wb = 0.24; } // Rolex British Racing Green
    else if (sponsorIdx === 1) { wr = 0.92; wg = 0.08; wb = 0.08; } // Pirelli Racing Red
    else if (sponsorIdx === 2) { wr = 0.96; wg = 0.82; wb = 0.04; } // DHL Express Yellow
    else { wr = 0.95; wg = 0.95; wb = 0.95; } // FIA White & Black Chevron

    barrierColorsL.push(wr, wg, wb, wr, wg, wb);
    barrierColorsR.push(wr, wg, wb, wr, wg, wb);

    if (i < segments) {
      const idx = i * 2;
      trackIndices.push(idx, idx + 1, idx + 2);
      trackIndices.push(idx + 1, idx + 3, idx + 2);

      curbIndicesL.push(idx, idx + 1, idx + 2);
      curbIndicesL.push(idx + 1, idx + 3, idx + 2);

      curbIndicesR.push(idx, idx + 1, idx + 2);
      curbIndicesR.push(idx + 1, idx + 3, idx + 2);

      runoffIndicesL.push(idx, idx + 1, idx + 2);
      runoffIndicesL.push(idx + 1, idx + 3, idx + 2);

      runoffIndicesR.push(idx, idx + 1, idx + 2);
      runoffIndicesR.push(idx + 1, idx + 3, idx + 2);

      // Symmetrical double-sided triangle indices for both Left and Right barriers
      barrierIndicesL.push(idx, idx + 1, idx + 2);
      barrierIndicesL.push(idx + 1, idx + 3, idx + 2);

      barrierIndicesR.push(idx, idx + 2, idx + 1);
      barrierIndicesR.push(idx + 1, idx + 2, idx + 3);
    }
  }

  // Finalize geometries
  trackGeom.setAttribute('position', new THREE.Float32BufferAttribute(trackVerts, 3));
  trackGeom.setAttribute('uv', new THREE.Float32BufferAttribute(trackUVs, 2));
  trackGeom.setIndex(trackIndices);
  trackGeom.computeVertexNormals();

  // Clean, uniform motorsport asphalt texture + Real-Time Planar Reflection Shader uniforms
  let trackMat: THREE.Material;
  const reflectionUniforms = {
    uPlanarReflectionMap: { value: null as THREE.Texture | null },
    uReflectionIntensity: { value: 0.0 },
  };
  const isRetroAny = preset.id === 'retro' || preset.id === 'retro_pixel';
  const isFastLambertPreset = preset.id === 'low' || preset.id === 'dynamic_conservative' || isRetroAny;
  if (typeof document !== 'undefined') {
    const texSize = preset.id === 'retro_pixel' ? 128 : 512; // 128px with NearestFilter for Retro Pixel '92, 512px for Retro Arcade '89 & HD modes
    const canvas = document.createElement('canvas');
    canvas.width = texSize;
    canvas.height = texSize;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = isRetroAny ? '#1e1638' : '#020204';
    ctx.fillRect(0, 0, texSize, texSize);

    if (!isRetroAny) {
      const imgData = ctx.getImageData(0, 0, texSize, texSize);
      const data = imgData.data;
      for (let p = 0; p < data.length; p += 4) {
        const grain = (Math.random() - 0.5) * 4;
        data[p] = Math.max(1, Math.min(8, data[p] + grain));
        data[p + 1] = Math.max(1, Math.min(8, data[p + 1] + grain));
        data[p + 2] = Math.max(2, Math.min(10, data[p + 2] + grain));
      }
      ctx.putImageData(imgData, 0, 0);
    } else {
      // Classic 90s Arcade OutRun / Virtua Racing striped asphalt bands & dashed center line
      ctx.fillStyle = '#251c44';
      ctx.fillRect(0, 0, texSize, texSize / 2);
      ctx.fillStyle = '#ffe600';
      const dashScale = texSize / 512;
      ctx.fillRect(Math.round(texSize * 0.49), Math.round(40 * dashScale), Math.max(2, Math.round(texSize * 0.02)), Math.round(180 * dashScale));
      ctx.fillRect(Math.round(texSize * 0.49), Math.round(300 * dashScale), Math.max(2, Math.round(texSize * 0.02)), Math.round(180 * dashScale));
    }

    const scale = texSize / 1024;

    // Boundary lines (Electric Cyan in Retro modes, Crisp White in standard modes)
    ctx.fillStyle = isRetroAny ? '#00f0ff' : '#f8fafc';
    ctx.fillRect(Math.round(16 * scale), 0, Math.max(3, Math.round(22 * scale)), texSize);
    ctx.fillRect(Math.round(986 * scale), 0, Math.max(3, Math.round(22 * scale)), texSize);

    // DRS Zone Markings & Lines
    ctx.fillStyle = isRetroAny ? 'rgba(255, 42, 133, 0.9)' : 'rgba(0, 230, 118, 0.85)';
    ctx.fillRect(Math.round(36 * scale), Math.round(120 * scale), Math.round(952 * scale), Math.max(2, Math.round(12 * scale)));

    // Starting grid slot box markings
    ctx.strokeStyle = isRetroAny ? 'rgba(0, 240, 255, 0.9)' : 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = Math.max(2, Math.round(6 * scale));
    ctx.strokeRect(Math.round(320 * scale), Math.round(180 * scale), Math.round(140 * scale), Math.round(90 * scale));
    ctx.strokeRect(Math.round(560 * scale), Math.round(680 * scale), Math.round(140 * scale), Math.round(90 * scale));

    // High-visibility forward directional chevron markings
    [280, 780].forEach((yBase) => {
      [-140, 0, 140].forEach((xOff) => {
        const cx = (512 + xOff) * scale;
        const yb = yBase * scale;
        ctx.fillStyle = isRetroAny ? 'rgba(255, 230, 0, 0.95)' : 'rgba(255, 230, 40, 0.82)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.lineWidth = Math.max(1.5, 4 * scale);
        ctx.beginPath();
        ctx.moveTo(cx - 36 * scale, yb + 42 * scale);
        ctx.lineTo(cx, yb);
        ctx.lineTo(cx + 36 * scale, yb + 42 * scale);
        ctx.lineTo(cx + 22 * scale, yb + 48 * scale);
        ctx.lineTo(cx, yb + 20 * scale);
        ctx.lineTo(cx - 22 * scale, yb + 48 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
    });

    const trackTexture = new THREE.CanvasTexture(canvas);
    trackTexture.wrapS = THREE.RepeatWrapping;
    trackTexture.wrapT = THREE.RepeatWrapping;
    trackTexture.repeat.set(1, 48);
    trackTexture.colorSpace = THREE.SRGBColorSpace;
    if (preset.id === 'retro_pixel') {
      trackTexture.magFilter = THREE.NearestFilter;
      trackTexture.minFilter = THREE.NearestFilter;
      trackTexture.generateMipmaps = false;
    } else {
      trackTexture.anisotropy = Math.max(4, preset.anisotropy);
    }

    if (isFastLambertPreset) {
      trackMat = new THREE.MeshLambertMaterial({
        map: trackTexture,
      });
    } else {
      let asphaltNormalTex: THREE.CanvasTexture | undefined;
      if (isUltra || preset.id === 'high') {
        const nCanvas = document.createElement('canvas');
        nCanvas.width = 256;
        nCanvas.height = 256;
        const nCtx = nCanvas.getContext('2d');
        if (nCtx) {
          const nImg = nCtx.createImageData(256, 256);
          const nData = nImg.data;
          for (let i = 0; i < nData.length; i += 4) {
            nData[i] = 128 + (Math.random() - 0.5) * 28;
            nData[i + 1] = 128 + (Math.random() - 0.5) * 28;
            nData[i + 2] = 255;
            nData[i + 3] = 255;
          }
          nCtx.putImageData(nImg, 0, 0);
          asphaltNormalTex = new THREE.CanvasTexture(nCanvas);
          asphaltNormalTex.wrapS = THREE.RepeatWrapping;
          asphaltNormalTex.wrapT = THREE.RepeatWrapping;
          asphaltNormalTex.repeat.set(6, 260);
          asphaltNormalTex.anisotropy = Math.max(4, preset.anisotropy);
        }
      }

      trackMat = new THREE.MeshStandardMaterial({
        map: trackTexture,
        normalMap: asphaltNormalTex,
        normalScale: new THREE.Vector2(0.08, 0.08),
        roughness: isUltra ? 0.44 : 0.75,
        metalness: isUltra ? 0.08 : 0.0,
        envMapIntensity: isUltra ? 0.18 : 0.0,
      });

      // Initialize default fallback sampler to trackTexture until planar reflection RT is bound
      reflectionUniforms.uPlanarReflectionMap.value = trackTexture;

      // Inject Real-Time Turned-Off Black Screen Planar Road Reflection Shader
      attachBlackScreenRoadReflectionShader(trackMat, reflectionUniforms, 1.0, 48.0, isUltra);
    }
  } else {
    trackMat = new THREE.MeshLambertMaterial({
      color: 0x020204,
    });
  }

  const trackMesh = new THREE.Mesh(trackGeom, trackMat);
  trackMesh.receiveShadow = preset.shadowsEnabled;
  group.add(trackMesh);

  // Curbs with DoubleSide (Glossy painted finish in Ultra Realistic)
  const curbMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: isUltra ? 0.22 : 0.55,
    metalness: isUltra ? 0.08 : 0.06,
    envMapIntensity: isUltra ? 0.85 : 0.0,
    side: THREE.DoubleSide,
  });

  curbGeomL.setAttribute('position', new THREE.Float32BufferAttribute(curbVertsL, 3));
  curbGeomL.setAttribute('color', new THREE.Float32BufferAttribute(curbColorsL, 3));
  curbGeomL.setIndex(curbIndicesL);
  curbGeomL.computeVertexNormals();
  const curbMeshL = new THREE.Mesh(curbGeomL, curbMat);
  curbMeshL.receiveShadow = true;
  group.add(curbMeshL);

  curbGeomR.setAttribute('position', new THREE.Float32BufferAttribute(curbVertsR, 3));
  curbGeomR.setAttribute('color', new THREE.Float32BufferAttribute(curbColorsR, 3));
  curbGeomR.setIndex(curbIndicesR);
  curbGeomR.computeVertexNormals();
  const curbMeshR = new THREE.Mesh(curbGeomR, curbMat);
  curbMeshR.receiveShadow = true;
  group.add(curbMeshR);

  // Runoff Left & Right (Glossy painted FIA apron in Ultra Realistic)
  const runoffMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: isUltra ? 0.30 : 0.78,
    metalness: isUltra ? 0.05 : 0.0,
    envMapIntensity: isUltra ? 0.65 : 0.0,
    side: THREE.DoubleSide,
  });

  runoffGeomL.setAttribute('position', new THREE.Float32BufferAttribute(runoffVertsL, 3));
  runoffGeomL.setAttribute('color', new THREE.Float32BufferAttribute(runoffColorsL, 3));
  runoffGeomL.setIndex(runoffIndicesL);
  runoffGeomL.computeVertexNormals();
  const runoffMeshL = new THREE.Mesh(runoffGeomL, runoffMat);
  runoffMeshL.receiveShadow = true;
  group.add(runoffMeshL);

  runoffGeomR.setAttribute('position', new THREE.Float32BufferAttribute(runoffVertsR, 3));
  runoffGeomR.setAttribute('color', new THREE.Float32BufferAttribute(runoffColorsR, 3));
  runoffGeomR.setIndex(runoffIndicesR);
  runoffGeomR.computeVertexNormals();
  const runoffMeshR = new THREE.Mesh(runoffGeomR, runoffMat);
  runoffMeshR.receiveShadow = true;
  group.add(runoffMeshR);

  // Barriers on Left and Right with DoubleSide so both walls are 100% visible from every angle
  const barrierMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.42,
    metalness: 0.35,
    envMapIntensity: isUltra ? 0.45 : 0.15,
    side: THREE.DoubleSide,
  });

  barrierGeomL.setAttribute('position', new THREE.Float32BufferAttribute(barrierVertsL, 3));
  barrierGeomL.setAttribute('color', new THREE.Float32BufferAttribute(barrierColorsL, 3));
  barrierGeomL.setIndex(barrierIndicesL);
  barrierGeomL.computeVertexNormals();
  const barrierMeshL = new THREE.Mesh(barrierGeomL, barrierMat);
  barrierMeshL.castShadow = true;
  barrierMeshL.receiveShadow = true;
  group.add(barrierMeshL);

  barrierGeomR.setAttribute('position', new THREE.Float32BufferAttribute(barrierVertsR, 3));
  barrierGeomR.setAttribute('color', new THREE.Float32BufferAttribute(barrierColorsR, 3));
  barrierGeomR.setIndex(barrierIndicesR);
  barrierGeomR.computeVertexNormals();
  const barrierMeshR = new THREE.Mesh(barrierGeomR, barrierMat);
  barrierMeshR.castShadow = true;
  barrierMeshR.receiveShadow = true;
  group.add(barrierMeshR);

  // Ground plane with terrain tailored to circuit locale
  const groundGeom = new THREE.PlaneGeometry(3500, 3500, 16, 16);
  groundGeom.rotateX(-Math.PI / 2);
  let groundColor = 0x223824; // Default European grass
  if (circuit.id === 'abudhabi') {
    groundColor = 0xc89f6d; // Warm Arabian desert sand
  } else if (circuit.id === 'bahrain') {
    groundColor = 0xbda27e; // Sakhir desert sand
  } else if (circuit.id === 'monaco') {
    groundColor = 0x334155; // Mediterranean cliffstone & asphalt
  } else if (circuit.id === 'jeddah') {
    groundColor = 0x1e293b; // Coastal corniche night asphalt
  } else if (circuit.id === 'spa') {
    groundColor = 0x16301a; // Ardennes deep forest pine green
  } else if (circuit.id === 'silverstone') {
    groundColor = 0x214422; // British countryside lush grass
  } else if (circuit.id === 'monza') {
    groundColor = 0x1d3d1f; // Royal Monza park lawn
  }

  let groundTex: THREE.CanvasTexture | undefined;
  if (typeof document !== 'undefined' && isRetroAny) {
    const gSize = preset.id === 'retro_pixel' ? 64 : 256;
    const gCanvas = document.createElement('canvas');
    gCanvas.width = gSize;
    gCanvas.height = gSize;
    const gCtx = gCanvas.getContext('2d');
    if (gCtx) {
      gCtx.fillStyle = '#0e0424';
      gCtx.fillRect(0, 0, gSize, gSize);
      // Synthwave OutRun Neon Grid
      gCtx.strokeStyle = 'rgba(255, 42, 133, 0.55)';
      gCtx.lineWidth = preset.id === 'retro_pixel' ? 2 : 4;
      gCtx.strokeRect(0, 0, gSize, gSize);
      gCtx.strokeStyle = 'rgba(0, 240, 255, 0.30)';
      gCtx.lineWidth = preset.id === 'retro_pixel' ? 1 : 2;
      gCtx.beginPath();
      gCtx.moveTo(gSize / 2, 0);
      gCtx.lineTo(gSize / 2, gSize);
      gCtx.moveTo(0, gSize / 2);
      gCtx.lineTo(gSize, gSize / 2);
      gCtx.stroke();
      groundTex = new THREE.CanvasTexture(gCanvas);
      groundTex.wrapS = THREE.RepeatWrapping;
      groundTex.wrapT = THREE.RepeatWrapping;
      groundTex.repeat.set(180, 180);
      groundTex.colorSpace = THREE.SRGBColorSpace;
      if (preset.id === 'retro_pixel') {
        groundTex.magFilter = THREE.NearestFilter;
        groundTex.minFilter = THREE.NearestFilter;
        groundTex.generateMipmaps = false;
      }
    }
  } else if (typeof document !== 'undefined' && (isUltra || preset.id === 'high' || isDynamicGraphics(preset.id))) {
    const gCanvas = document.createElement('canvas');
    gCanvas.width = 256;
    gCanvas.height = 256;
    const gCtx = gCanvas.getContext('2d');
    if (gCtx) {
      const baseCol = new THREE.Color(groundColor);
      gCtx.fillStyle = `#${baseCol.getHexString()}`;
      gCtx.fillRect(0, 0, 256, 256);
      // Mow stripes & natural organic turf/sand grain
      for (let s = 0; s < 256; s += 32) {
        gCtx.fillStyle = (s / 32) % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.045)';
        gCtx.fillRect(s, 0, 16, 256);
      }
      for (let i = 0; i < 1600; i++) {
        gCtx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
        gCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
      }
      groundTex = new THREE.CanvasTexture(gCanvas);
      groundTex.wrapS = THREE.RepeatWrapping;
      groundTex.wrapT = THREE.RepeatWrapping;
      groundTex.repeat.set(140, 140);
      groundTex.colorSpace = THREE.SRGBColorSpace;
    }
  }

  const groundMat = new THREE.MeshStandardMaterial({
    color: groundTex ? 0xffffff : groundColor,
    map: groundTex,
    roughness: 0.94,
    metalness: 0.0,
    envMapIntensity: 0.0,
  });
  const groundMesh = new THREE.Mesh(groundGeom, groundMat);
  groundMesh.position.y = -0.3;
  groundMesh.receiveShadow = preset.shadowsEnabled;
  group.add(groundMesh);

  // 2. Start / Finish Gantry - Pillars placed SAFELY behind barriers (20.5m out), zero encroachment
  const startGantry = new THREE.Group();
  const startPt = curve.getPointAt(0);
  const startTangent = curve.getTangentAt(0).normalize();

  startGantry.position.copy(startPt);
  startGantry.lookAt(startPt.clone().add(startTangent));

  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x2a2b30,
    metalness: 0.72,
    roughness: 0.28,
    envMapIntensity: isUltra ? 0.65 : 0.25,
  });
  const pillarGeom = new THREE.BoxGeometry(1.0, 10.5, 1.0);

  // Pillar positions placed comfortably behind the outer barrier (half road 11 + curb 1.4 + runoff 3.6 + barrier 1.0 = 17m)
  const gantryPillarOffset = trackWidth * 0.5 + curbWidth + runoffWidth + 3.5; // ~20.5m away from centerline!
  const pLeftPillar = new THREE.Mesh(pillarGeom, metalMat);
  pLeftPillar.position.set(-gantryPillarOffset, 5.25, 0);
  pLeftPillar.castShadow = true;
  startGantry.add(pLeftPillar);

  const pRightPillar = new THREE.Mesh(pillarGeom, metalMat);
  pRightPillar.position.set(gantryPillarOffset, 5.25, 0);
  pRightPillar.castShadow = true;
  startGantry.add(pRightPillar);

  const beamGeom = new THREE.BoxGeometry(gantryPillarOffset * 2.1, 1.6, 1.6);
  const beamMesh = new THREE.Mesh(beamGeom, metalMat);
  beamMesh.position.set(0, 10.0, 0);
  startGantry.add(beamMesh);

  const bannerGeom = new THREE.PlaneGeometry(trackWidth * 1.4, 1.5);
  const bannerMat = new THREE.MeshBasicMaterial({ color: 0x003d22, side: THREE.DoubleSide });
  const bannerMesh = new THREE.Mesh(bannerGeom, bannerMat);
  bannerMesh.position.set(0, 10.0, 0.82);
  startGantry.add(bannerMesh);

  // 5 FIA Start Lights
  const startLights: THREE.Mesh[] = [];
  const lightHousingGeom = new THREE.BoxGeometry(8.5, 1.4, 0.6);
  const lightHousingMat = new THREE.MeshStandardMaterial({ color: 0x0f0f12, metalness: 0.5, roughness: 0.5 });
  const housingMesh = new THREE.Mesh(lightHousingGeom, lightHousingMat);
  housingMesh.position.set(0, 8.2, 0);
  startGantry.add(housingMesh);

  for (let i = 0; i < 5; i++) {
    const lightGeom = new THREE.CircleGeometry(0.42, 20);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x200505 });
    const lightMesh = new THREE.Mesh(lightGeom, lightMat);
    lightMesh.position.set(-3.2 + i * 1.6, 8.2, 0.32);
    startGantry.add(lightMesh);
    startLights.push(lightMesh);
  }

  group.add(startGantry);

  // Safety clearance function to guarantee NO prop, building, tower, or wall is EVER inside or near any part of the track
  const isClearOfTrack = (worldPos: THREE.Vector3, minSafeRadius: number = 34.0): boolean => {
    const checkSamples = 1200;
    const minSafeSq = minSafeRadius * minSafeRadius;
    for (let s = 0; s < checkSamples; s++) {
      const tp = curve.getPointAt(s / checkSamples);
      const dx = worldPos.x - tp.x;
      const dz = worldPos.z - tp.z;
      if (dx * dx + dz * dz < minSafeSq) {
        return false;
      }
    }
    return true;
  };

  // 3. Trackside Infrastructure - Verified safe placement strictly outside track limits
  const grandstandGeom = new THREE.BoxGeometry(65, 14, 16);
  const grandstandMat = new THREE.MeshStandardMaterial({ color: 0x3e4450, metalness: 0.3, roughness: 0.8 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x242730, metalness: 0.5, roughness: 0.5 });

  const startNormal = new THREE.Vector3().crossVectors(startTangent, up).normalize();
  const gsPos = startPt.clone().addScaledVector(startNormal, -42);
  if (isClearOfTrack(gsPos, 62.0)) {
    const gs1 = new THREE.Mesh(grandstandGeom, grandstandMat);
    gs1.position.set(gsPos.x, gsPos.y + 7, gsPos.z);
    gs1.lookAt(gsPos.clone().add(startTangent));
    gs1.rotateY(Math.PI / 2);
    gs1.castShadow = true;
    group.add(gs1);

    const gsRoof = new THREE.Mesh(new THREE.BoxGeometry(67, 1.2, 18), roofMat);
    gsRoof.position.set(gsPos.x, gsPos.y + 14.5, gsPos.z);
    gsRoof.lookAt(gsPos.clone().add(startTangent));
    gsRoof.rotateY(Math.PI / 2);
    group.add(gsRoof);
  }

  // Floodlight towers for Night / Twilight Circuits
  const isNightTrack = circuit.timeOfDay === 'twilight';
  const floodTowerGeom = new THREE.CylinderGeometry(0.4, 0.8, 32, 8);
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x555a66, metalness: 0.7, roughness: 0.3 });
  const lightHeadMat = new THREE.MeshBasicMaterial({ color: 0xfffae8 });

  for (let t = 0.05; t < 0.98; t += 0.12) {
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const r = new THREE.Vector3().crossVectors(tan, up).normalize();

    const towerPos = pt.clone().addScaledVector(r, 26);
    // Guarantee tower is never near any other track section
    if (!isClearOfTrack(towerPos, 24.0)) continue;

    const tower = new THREE.Mesh(floodTowerGeom, towerMat);
    tower.position.set(towerPos.x, towerPos.y + 16, towerPos.z);
    tower.castShadow = true;
    group.add(tower);

    const head = new THREE.Mesh(new THREE.BoxGeometry(5.0, 1.8, 1.8), lightHeadMat);
    head.position.set(towerPos.x, towerPos.y + 31, towerPos.z);
    head.lookAt(pt);
    group.add(head);

    if (isNightTrack) {
      const spot = new THREE.SpotLight(0xfffae0, 2.5, 90, Math.PI / 3.5, 0.5);
      spot.position.copy(head.position);
      spot.target.position.copy(pt);
      group.add(spot);
      group.add(spot.target);
    }

    // Distance braking boards: 150m, 100m, 50m boards mounted on the barrier
    const boardDist = [150, 100, 50][Math.floor(t * 30) % 3];
    let boardMat: THREE.Material;
    if (typeof document !== 'undefined') {
      const bCanvas = document.createElement('canvas');
      bCanvas.width = 128;
      bCanvas.height = 80;
      const bCtx = bCanvas.getContext('2d')!;
      bCtx.fillStyle = '#ffffff';
      bCtx.fillRect(0, 0, 128, 80);
      bCtx.lineWidth = 8;
      bCtx.strokeStyle = '#000000';
      bCtx.strokeRect(4, 4, 120, 72);
      bCtx.fillStyle = '#000000';
      bCtx.font = '900 42px sans-serif';
      bCtx.textAlign = 'center';
      bCtx.textBaseline = 'middle';
      bCtx.fillText(String(boardDist), 64, 42);
      const bTex = new THREE.CanvasTexture(bCanvas);
      bTex.colorSpace = THREE.SRGBColorSpace;
      boardMat = new THREE.MeshBasicMaterial({ map: bTex, side: THREE.DoubleSide });
    } else {
      boardMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    }

    const boardGeom = new THREE.PlaneGeometry(1.8, 1.2);
    const board = new THREE.Mesh(boardGeom, boardMat);
    // Safely positioned behind the outer barrier (19.5m away), strictly outside the racing boundaries
    const boardPos = pt.clone().addScaledVector(r, -(trackWidth * 0.5 + curbWidth + runoffWidth + 2.5));
    if (isClearOfTrack(boardPos, 18.5)) {
      board.position.set(boardPos.x, boardPos.y + 2.4, boardPos.z);
      board.lookAt(boardPos.clone().add(tan));
      board.rotateY(Math.PI);
      group.add(board);
    }
  }

  // Realistic Pit Lane Complex & Team Pit Wall along the main straight (Placed safely behind the outer barrier)
  const pitWallGroup = new THREE.Group();
  for (let ptT = 0.012; ptT <= 0.075; ptT += 0.012) {
    const ptPos = curve.getPointAt(ptT);
    const ptTan = curve.getTangentAt(ptT).normalize();
    const ptR = new THREE.Vector3().crossVectors(ptTan, up).normalize();
    // Safely positioned 20.0m away (well behind the 16.6m barrier), strictly outside racing limits
    const wallPos = ptPos.clone().addScaledVector(ptR, 20.0);
    if (!isClearOfTrack(wallPos, 18.5)) continue;

    const pWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.8, 12.0),
      new THREE.MeshStandardMaterial({ color: 0x3d424c, roughness: 0.85 })
    );
    pWall.position.set(wallPos.x, ptPos.y + 0.9, wallPos.z);
    pWall.lookAt(wallPos.clone().add(ptTan));
    pWall.castShadow = true;
    pWall.receiveShadow = true;
    pitWallGroup.add(pWall);

    const perch = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.4, 3.4),
      new THREE.MeshStandardMaterial({ color: 0x181c24, metalness: 0.7, roughness: 0.3 })
    );
    perch.position.set(wallPos.x + ptR.x * 2.2, ptPos.y + 1.8, wallPos.z + ptR.z * 2.2);
    perch.lookAt(wallPos.clone().add(ptTan));
    perch.castShadow = true;
    pitWallGroup.add(perch);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.95),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff })
    );
    screen.position.set(wallPos.x + ptR.x * 0.95, ptPos.y + 2.1, wallPos.z + ptR.z * 0.95);
    screen.lookAt(ptPos);
    pitWallGroup.add(screen);
  }
  group.add(pitWallGroup);

  const sceneryGroup = new THREE.Group();
  sceneryGroup.name = 'outerSceneryGroup';
  group.add(sceneryGroup);

  const castDistantSceneryShadows = preset.shadowsEnabled && !isDynamicGraphics(preset.id);

  // Lush 3D Trackside Trees & Environment
  const isDesert = circuit.id === 'bahrain' || circuit.id === 'jeddah' || circuit.id === 'abudhabi';
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.9 });
  const foliageMat = new THREE.MeshStandardMaterial({
    color: isDesert ? 0x2e6930 : 0x1b4d24,
    roughness: 0.8,
  });

  for (let t = 0.08; t < 0.96; t += 0.04) {
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const nextTan = curve.getTangentAt((t + 0.02) % 1.0).normalize();
    const r = new THREE.Vector3().crossVectors(tan, up).normalize();
    const turnDir = tan.clone().cross(nextTan).y;
    // Place trees on the outside of bends or well clear of inside apex sightlines
    const treeSide = Math.abs(turnDir) > 0.02 ? (turnDir > 0 ? 1 : -1) : (Math.floor(t * 100) % 2 === 0 ? 1 : -1);
    const treeDist = 34 + (Math.floor(t * 70) % 4) * 8;
    const treePos = pt.clone().addScaledVector(r, treeSide * treeDist);
    if (!isClearOfTrack(treePos, 30.0)) continue;

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 6, 6), trunkMat);
    trunk.position.set(treePos.x, pt.y + 3, treePos.z);
    trunk.castShadow = castDistantSceneryShadows;
    sceneryGroup.add(trunk);

    const foliage = new THREE.Mesh(
      isDesert ? new THREE.CylinderGeometry(2.4, 0.2, 3.5, 6) : new THREE.ConeGeometry(2.8, 7.5, 7),
      foliageMat
    );
    foliage.position.set(treePos.x, pt.y + 7.5, treePos.z);
    foliage.castShadow = castDistantSceneryShadows;
    sceneryGroup.add(foliage);
  }

  // High-Visibility FIA Corner Turn-In Chevron Boards along the outside of sharp turns (Zero Blind Corners)
  if (typeof document !== 'undefined') {
    const createTurnChevronTexture = (turnRight: boolean) => {
      const cCanvas = document.createElement('canvas');
      cCanvas.width = 256;
      cCanvas.height = 96;
      const cCtx = cCanvas.getContext('2d')!;
      cCtx.fillStyle = '#0f172a';
      cCtx.fillRect(0, 0, 256, 96);
      cCtx.strokeStyle = '#facc15';
      cCtx.lineWidth = 6;
      cCtx.strokeRect(3, 3, 250, 90);

      cCtx.fillStyle = '#facc15';
      for (let k = 0; k < 3; k++) {
        const bx = 42 + k * 76;
        cCtx.beginPath();
        if (turnRight) {
          cCtx.moveTo(bx - 18, 18);
          cCtx.lineTo(bx + 8, 18);
          cCtx.lineTo(bx + 28, 48);
          cCtx.lineTo(bx + 8, 78);
          cCtx.lineTo(bx - 18, 78);
          cCtx.lineTo(bx + 2, 48);
        } else {
          cCtx.moveTo(bx + 18, 18);
          cCtx.lineTo(bx - 8, 18);
          cCtx.lineTo(bx - 28, 48);
          cCtx.lineTo(bx - 8, 78);
          cCtx.lineTo(bx + 18, 78);
          cCtx.lineTo(bx - 2, 48);
        }
        cCtx.closePath();
        cCtx.fill();
      }
      const tex = new THREE.CanvasTexture(cCanvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    };

    const rightChevronMat = createTurnChevronTexture(true);
    const leftChevronMat = createTurnChevronTexture(false);
    const chevSignGeom = new THREE.PlaneGeometry(4.2, 1.55);

    for (let t = 0.02; t < 0.98; t += 0.018) {
      const pt = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();
      const aheadTan = curve.getTangentAt((t + 0.016) % 1.0).normalize();
      const turnVal = tan.clone().cross(aheadTan).y; // > 0 left turn, < 0 right turn
      if (Math.abs(turnVal) < 0.055) continue;

      const r = new THREE.Vector3().crossVectors(tan, up).normalize();
      const isLeftTurn = turnVal > 0;
      const outsideSign = isLeftTurn ? 1 : -1;
      const outerOffset = trackWidth * 0.5 + curbWidth + runoffWidth + 2.8;
      const signPos = pt.clone().addScaledVector(r, outsideSign * outerOffset);
      if (!isClearOfTrack(signPos, 17.5)) continue;

      const signMesh = new THREE.Mesh(chevSignGeom, isLeftTurn ? leftChevronMat : rightChevronMat);
      signMesh.position.set(signPos.x, pt.y + 2.35, signPos.z);
      signMesh.lookAt(pt.clone().addScaledVector(tan, -18.0));
      group.add(signMesh);
    }
  }

  // 4. Modern Trackside Skyline Architecture (Strictly outside track limits & corner apex sightlines)
  const buildingMats = [
    new THREE.MeshStandardMaterial({ color: 0x2b303c, metalness: 0.6, roughness: 0.35 }),
    new THREE.MeshStandardMaterial({ color: 0x1e2430, metalness: 0.8, roughness: 0.2 }),
    new THREE.MeshStandardMaterial({ color: 0x3d4454, metalness: 0.5, roughness: 0.4 }),
    new THREE.MeshStandardMaterial({ color: 0x181e28, metalness: 0.85, roughness: 0.15 }),
  ];

  const rooftopMat = new THREE.MeshStandardMaterial({ color: 0x252a34, roughness: 0.8 });
  const antennaMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.2 });
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0022 });

  const buildingStep = preset.sceneryMode === 'minimal' ? 999 : preset.sceneryMode === 'standard' ? 0.14 : 0.065;
  for (let t = 0.04; t < 0.98; t += buildingStep) {
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const nextTan = curve.getTangentAt((t + 0.024) % 1.0).normalize();
    const r = new THREE.Vector3().crossVectors(tan, up).normalize();

    const bWidth = 26 + ((t * 60) % 12);
    const bDepth = 20 + ((t * 40) % 10);
    const bHeight = 28 + ((t * 130) % 45); // 28m to 73m tall corporate suites & towers
    const bRadius = Math.hypot(bWidth * 0.5, bDepth * 0.5);

    // Place strictly OUTSIDE the track runoffs and never on the inside apex of a corner
    const turnDir = tan.clone().cross(nextTan).y;
    const side = Math.abs(turnDir) > 0.02 ? (turnDir > 0 ? 1 : -1) : (Math.floor(t * 100) % 2 === 0 ? 1 : -1);
    const distOutside = 38 + bRadius + (Math.floor(t * 100) % 4) * 8;
    const bPos = pt.clone().addScaledVector(r, side * distOutside);

    // CRITICAL: Ensure this building NEVER intersects any segment of the track ribbon or corner sightline!
    if (!isClearOfTrack(bPos, bRadius + 38.0)) continue;

    const bGeom = new THREE.BoxGeometry(bWidth, bHeight, bDepth);
    const bMat = buildingMats[Math.floor(t * 10) % buildingMats.length];
    const building = new THREE.Mesh(bGeom, bMat);
    building.position.set(bPos.x, pt.y + bHeight * 0.5, bPos.z);
    building.lookAt(bPos.clone().add(tan));
    building.castShadow = castDistantSceneryShadows;
    building.receiveShadow = castDistantSceneryShadows;
    sceneryGroup.add(building);

    // Multiple illuminated architectural glass window bands across multiple floors
    const windowColors = [
      circuit.timeOfDay === 'twilight' ? 0xfff2b2 : 0x8ec5fc,
      0x38bdf8,
      0xffffff,
      0xfde047,
    ];
    const numFloors = Math.floor(bHeight / 7.5);
    for (let fl = 1; fl < numFloors; fl++) {
      const windowStripGeom = new THREE.BoxGeometry(bWidth + 0.25, 1.35, bDepth + 0.25);
      const windowMat = new THREE.MeshBasicMaterial({
        color: windowColors[(fl + Math.floor(t * 10)) % windowColors.length],
      });
      const windowStrip = new THREE.Mesh(windowStripGeom, windowMat);
      windowStrip.position.set(bPos.x, pt.y + fl * 7.5, bPos.z);
      windowStrip.rotation.copy(building.rotation);
      sceneryGroup.add(windowStrip);
    }

    // Rooftop mechanical penthouse & HVAC chillers
    const phWidth = bWidth * 0.55;
    const phDepth = bDepth * 0.55;
    const phHeight = 4.5;
    const penthouse = new THREE.Mesh(new THREE.BoxGeometry(phWidth, phHeight, phDepth), rooftopMat);
    penthouse.position.set(bPos.x, pt.y + bHeight + phHeight * 0.5, bPos.z);
    penthouse.rotation.copy(building.rotation);
    penthouse.castShadow = castDistantSceneryShadows;
    sceneryGroup.add(penthouse);

    // Rooftop Communications Antenna Mast with Aircraft Warning Beacon
    const mastHeight = 10 + (Math.floor(t * 50) % 8);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, mastHeight, 6), antennaMat);
    mast.position.set(bPos.x, pt.y + bHeight + phHeight + mastHeight * 0.5, bPos.z);
    sceneryGroup.add(mast);

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), beaconMat);
    beacon.position.set(bPos.x, pt.y + bHeight + phHeight + mastHeight + 0.3, bPos.z);
    sceneryGroup.add(beacon);
  }

  // Authentic Photorealistic Circuit Scenery & Landmarks (Skipped on 'minimal' Low preset for worse devices)
  if (preset.sceneryMode !== 'minimal') {
    buildCircuitScenery(circuit, curve, isClearOfTrack, sceneryGroup);

    // Overhead F1 Sponsor Bridges & Illuminated Light Arches along the circuit
    // (Pillars placed safely 20.5m out behind barriers; overhead arch spans y = 9.8m so it reflects vividly across car bodywork & visor!)
    const archSponsors = [
      { bg: 0x004d2c, strip: 0xfacc15 }, // Rolex Green & Gold
      { bg: 0xd90429, strip: 0xffffff }, // Pirelli Red & White
      { bg: 0x0284c7, strip: 0x38bdf8 }, // Aramco Blue & Cyan
      { bg: 0xeab308, strip: 0xd90429 }, // DHL Yellow & Red
    ];
    [0.20, 0.42, 0.64, 0.84].forEach((archT, idx) => {
      const aPt = curve.getPointAt(archT);
      const aTan = curve.getTangentAt(archT).normalize();
      const aRight = new THREE.Vector3().crossVectors(aTan, up).normalize();
      const leftSupportPos = aPt.clone().addScaledVector(aRight, -gantryPillarOffset);
      const rightSupportPos = aPt.clone().addScaledVector(aRight, gantryPillarOffset);
      // Verify both pillars are completely clear of any other loop of the track
      if (!isClearOfTrack(leftSupportPos, 18.5) || !isClearOfTrack(rightSupportPos, 18.5)) return;

      const archGroup = new THREE.Group();
      archGroup.position.copy(aPt);
      archGroup.lookAt(aPt.clone().add(aTan));

      const pL = new THREE.Mesh(pillarGeom, metalMat);
      pL.position.set(-gantryPillarOffset, 5.25, 0);
      archGroup.add(pL);

      const pR = new THREE.Mesh(pillarGeom, metalMat);
      pR.position.set(gantryPillarOffset, 5.25, 0);
      archGroup.add(pR);

      const sponsorTheme = archSponsors[idx % archSponsors.length];
      const archBeam = new THREE.Mesh(
        new THREE.BoxGeometry(gantryPillarOffset * 2.08, 1.8, 1.8),
        new THREE.MeshStandardMaterial({ color: sponsorTheme.bg, metalness: 0.4, roughness: 0.3 })
      );
      archBeam.position.set(0, 9.8, 0);
      archGroup.add(archBeam);

      // Luminous underside LED light bar (creates realistic moving specular reflection streaks across the F1 car hood & halo)
      const ledBar = new THREE.Mesh(
        new THREE.BoxGeometry(trackWidth * 1.35, 0.22, 0.65),
        new THREE.MeshBasicMaterial({ color: sponsorTheme.strip })
      );
      ledBar.position.set(0, 8.85, 0);
      archGroup.add(ledBar);

      group.add(archGroup);
    });
  }

  // Ensure trackside structures cast & receive rich shadows (skipping distant outer scenery in Dynamic modes to save GPU vertex shadow passes)
  if (preset.shadowsEnabled) {
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj !== groundMesh) {
        if (!castDistantSceneryShadows) {
          let parent: THREE.Object3D | null = obj.parent;
          let inScenery = false;
          while (parent) {
            if (parent === sceneryGroup) {
              inScenery = true;
              break;
            }
            parent = parent.parent;
          }
          if (inScenery) return;
        }
        const mat = obj.material as THREE.Material;
        if (mat && !mat.transparent) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      }
    });
  }

  // 5. 3D Volumetric-Style Cloud Puffs (High up in the sky, y = 145m - 210m; visible in real-time car & road reflections)
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.05,
    emissive: circuit.timeOfDay === 'twilight' ? 0x3b1d5e : 0xdbeafe,
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: circuit.timeOfDay === 'twilight' ? 0.55 : 0.82,
  });

  const cloudPuffsGroup = new THREE.Group();
  for (let c = 0; c < 36; c++) {
    const angle = (c / 36) * Math.PI * 2;
    const radius = 280 + (c % 5) * 90;
    const cloudHeight = 145 + (c % 4) * 20;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(48 + (c % 3) * 16, 10, 10), cloudMat);
    puff.scale.set(2.5, 0.42, 1.5);
    puff.position.set(Math.cos(angle) * radius, cloudHeight, Math.sin(angle) * radius);
    cloudPuffsGroup.add(puff);
  }
  sceneryGroup.add(cloudPuffsGroup);

  const setStartLights = (lightsLitCount: number, lightsOut: boolean) => {
    for (let i = 0; i < startLights.length; i++) {
      const mat = startLights[i].material as THREE.MeshBasicMaterial;
      if (lightsOut) {
        mat.color.setHex(0x180505);
      } else if (i < lightsLitCount) {
        mat.color.setHex(0xff0000);
      } else {
        mat.color.setHex(0x200505);
      }
    }
  };

  const getTrackPointAtProgress = (t: number) => {
    const clampedT = ((t % 1) + 1) % 1;
    const position = curve.getPointAt(clampedT);
    const tangent = curve.getTangentAt(clampedT).normalize();
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    return { position, tangent, normal };
  };

  // Realistic Corner Speed Target based on spline curvature
  const getTargetCornerSpeedKmh = (t: number): number => {
    const clampedT = ((t % 1) + 1) % 1;
    const aheadT = ((t + 0.015) % 1 + 1) % 1;

    const t1 = curve.getTangentAt(clampedT).normalize();
    const t2 = curve.getTangentAt(aheadT).normalize();

    // Dot product between tangents measures track bend angle
    const dot = Math.max(-1, Math.min(1, t1.dot(t2)));
    const angleRad = Math.acos(dot); // 0 = straight, ~0.4 = medium corner, >0.7 = hairpin

    if (angleRad < 0.08) {
      // Full Straightaway - uncapped for true car top speed & engine power differences
      return 440;
    } else if (angleRad < 0.22) {
      // High-speed sweeper
      return 320;
    } else if (angleRad < 0.45) {
      // Medium corner
      return 220;
    } else if (angleRad < 0.75) {
      // Hard braking chicane or corner
      return 140;
    } else {
      // Tight hairpin
      return 90;
    }
  };

  // Robust surface detection with symmetrical left/right barrier boundaries
  const checkSurfaceType = (pos: THREE.Vector3, hintProgress?: number): SurfaceInfo => {
    let bestT = 0;
    let minDistanceSq = Infinity;

    if (hintProgress !== undefined && Number.isFinite(hintProgress)) {
      const localSamples = 45;
      const windowRange = 0.06;
      for (let i = -localSamples; i <= localSamples; i++) {
        const t = ((hintProgress + (i / localSamples) * windowRange) % 1 + 1) % 1;
        const pt = curve.getPointAt(t);
        const dSq = pt.distanceToSquared(pos);
        if (dSq < minDistanceSq) {
          minDistanceSq = dSq;
          bestT = t;
        }
      }
    } else {
      const totalSamples = 160;
      for (let i = 0; i < totalSamples; i++) {
        const t = i / totalSamples;
        const pt = curve.getPointAt(t);
        const dSq = pt.distanceToSquared(pos);
        if (dSq < minDistanceSq) {
          minDistanceSq = dSq;
          bestT = t;
        }
      }
    }

    // Micro refinement
    const microStep = 0.0006;
    for (let offset = -4; offset <= 4; offset++) {
      const t = ((bestT + offset * microStep) % 1 + 1) % 1;
      const pt = curve.getPointAt(t);
      const dSq = pt.distanceToSquared(pos);
      if (dSq < minDistanceSq) {
        minDistanceSq = dSq;
        bestT = t;
      }
    }

    const trackPoint = curve.getPointAt(bestT);
    const tangent = curve.getTangentAt(bestT).normalize();
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

    // Pure 2D perpendicular lateral offset from track centerline
    const diff = new THREE.Vector3().subVectors(pos, trackPoint);
    const lateralOffset = diff.dot(normal);
    const absLateralDist = Math.abs(lateralOffset);

    const halfRoad = trackWidth * 0.5; // 11.0m
    const curbLimit = halfRoad + curbWidth; // 12.8m
    const barrierLimit = curbLimit + runoffWidth + 2.0; // 18.4m safe clearance across all corners!

    const onCurb = absLateralDist > halfRoad - 0.35 && absLateralDist <= curbLimit;
    const offTrack = absLateralDist > curbLimit;

    // A wall collision ONLY occurs if the vehicle has drifted beyond the physical barrier boundary (18.4m+)
    // Eliminates phantom wall crashes on blind corners and apexes:
    const isCollidingWall = absLateralDist >= barrierLimit;
    const penetration = isCollidingWall ? absLateralDist - barrierLimit : 0;
    const wallNormal = normal.clone().multiplyScalar(lateralOffset >= 0 ? -1 : 1);

    return {
      offTrack,
      onCurb,
      distanceToCenterline: absLateralDist,
      lateralOffset,
      progress: bestT,
      trackPoint,
      tangent,
      normal,
      isCollidingWall,
      wallNormal,
      penetration,
      barrierLimit,
    };
  };

  const setReflectionTexture = (tex: THREE.Texture | null, intensity: number = 0.68) => {
    if (tex) {
      reflectionUniforms.uPlanarReflectionMap.value = tex;
      reflectionUniforms.uReflectionIntensity.value = intensity;
    } else {
      reflectionUniforms.uReflectionIntensity.value = 0.0;
    }
  };

  const setReflectionPassMode = (active: boolean) => {
    trackMesh.visible = !active;
    groundMesh.visible = !active;
    runoffMeshL.visible = !active;
    runoffMeshR.visible = !active;
  };

  return {
    group,
    sceneryGroup,
    curve,
    trackLength,
    barrierLimit: 18.4,
    isOpenField: false,
    startGantry,
    startLights,
    setStartLights,
    setReflectionTexture,
    setReflectionPassMode,
    getTrackPointAtProgress,
    getTargetCornerSpeedKmh,
    checkSurfaceType,
  };
}

/**
 * Generates the truly INFINITE Full-Road Car Testing & R&D Proving Ground:
 * - Infinitely long and wide 100% High-Grip Racing Road Tarmac (seamlessly tiled 8,000m × 8,000m road plane that snaps every 50m around the car forever)
 * - Endless Multi-Lane Top-Speed Super-Highway (X = -230) with infinite repeating overhead speed-trap gantries, lane dividers & FIA curbs
 * - Central 560m × 560m Proving Ground Hub with concentric G-force skidpad rings (R = 45m, 95m, 155m, 215m)
 * - High-Speed Slalom Weaving Cone Course (X = +195)
 * - Dedicated 300–0 KM/H Braking Distance Calibration Strip (X = +340) with painted meter markers
 */
function generateOpenFieldTrack(circuit: CircuitInfo, quality?: GraphicsQuality): GeneratedTrack {
  const group = new THREE.Group();
  const sceneryGroup = new THREE.Group();
  group.add(sceneryGroup);
  const preset = getGraphicsPresetConfig(quality);
  const isUltra = preset.id === 'ultra';
  const up = new THREE.Vector3(0, 1, 0);

  const reflectionUniforms = {
    uPlanarReflectionMap: { value: null as THREE.Texture | null },
    uReflectionIntensity: { value: 0.0 },
  };

  const points = circuit.trackPoints.map((p) => new THREE.Vector3(p.x, p.y, p.z));
  const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.25);
  const trackLength = curve.getLength();

  // 1. INFINITE FULL-ROAD RACING ASPHALT TEXTURE (Each 512x512 repeat = 50m × 50m of road tarmac)
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = 512;
  roadCanvas.height = 512;
  const rCtx = roadCanvas.getContext('2d');
  if (rCtx) {
    // Pure obsidian black base in Ultra Realistic mode
    rCtx.fillStyle = isUltra ? '#030306' : '#181c24';
    rCtx.fillRect(0, 0, 512, 512);

    // Subtle alternating asphalt paving lanes so 300-420 km/h speed across the infinite road is visceral
    rCtx.fillStyle = isUltra ? '#05060b' : '#1b2029';
    rCtx.fillRect(0, 0, 256, 512);

    // Crisp 50m tarmac grid lines
    rCtx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    rCtx.lineWidth = 3;
    rCtx.strokeRect(1.5, 1.5, 509, 509);

    // Sub-grid 25m road calibration line
    rCtx.strokeStyle = 'rgba(56, 189, 248, 0.09)';
    rCtx.lineWidth = 2;
    rCtx.beginPath();
    rCtx.moveTo(256, 0);
    rCtx.lineTo(256, 512);
    rCtx.moveTo(0, 256);
    rCtx.lineTo(512, 256);
    rCtx.stroke();

    // Dashed white road lane reference ticks every 12.5m
    rCtx.fillStyle = 'rgba(255, 255, 255, 0.26)';
    for (let y = 16; y < 512; y += 64) {
      rCtx.fillRect(126, y, 4, 28);
      rCtx.fillRect(382, y, 4, 28);
    }

    // Fine asphalt aggregate grain
    for (let i = 0; i < 2400; i++) {
      rCtx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.22)';
      rCtx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
  }

  const infiniteRoadTex = new THREE.CanvasTexture(roadCanvas);
  infiniteRoadTex.wrapS = THREE.RepeatWrapping;
  infiniteRoadTex.wrapT = THREE.RepeatWrapping;
  // 8,000m / 160 repeats = exactly 50.0m per tile
  infiniteRoadTex.repeat.set(160, 160);
  infiniteRoadTex.colorSpace = THREE.SRGBColorSpace;
  reflectionUniforms.uPlanarReflectionMap.value = infiniteRoadTex;

  const openFieldMat = new THREE.MeshStandardMaterial({
    map: infiniteRoadTex,
    roughness: isUltra ? 0.44 : 0.54,
    metalness: isUltra ? 0.08 : 0.1,
  });
  if (isUltra || preset.id === 'high') {
    attachBlackScreenRoadReflectionShader(openFieldMat, reflectionUniforms, 160, 160, isUltra);
  }

  const openFieldMesh = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), openFieldMat);
  openFieldMesh.rotation.x = -Math.PI / 2;
  openFieldMesh.position.y = 0.20;
  group.add(openFieldMesh);

  // 2. High-Contrast Proving Ground Hub & Highway Surface Material
  const padCanvas = document.createElement('canvas');
  padCanvas.width = 512;
  padCanvas.height = 512;
  const pCtx = padCanvas.getContext('2d');
  if (pCtx) {
    pCtx.fillStyle = isUltra ? '#0c0f16' : '#141820';
    pCtx.fillRect(0, 0, 512, 512);
    pCtx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
    pCtx.lineWidth = 2;
    pCtx.strokeRect(0, 0, 512, 512);
    for (let i = 0; i < 2000; i++) {
      pCtx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.22)';
      pCtx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
  }
  const padTex = new THREE.CanvasTexture(padCanvas);
  padTex.wrapS = THREE.RepeatWrapping;
  padTex.wrapT = THREE.RepeatWrapping;
  padTex.repeat.set(28, 28);
  padTex.colorSpace = THREE.SRGBColorSpace;

  const asphaltMat = new THREE.MeshStandardMaterial({
    map: padTex,
    roughness: isUltra ? 0.42 : 0.46,
    metalness: isUltra ? 0.08 : 0.14,
  });
  if (isUltra || preset.id === 'high') {
    attachBlackScreenRoadReflectionShader(asphaltMat, reflectionUniforms, 28, 28, isUltra);
  }

  // Central 560m × 560m Proving Ground Hub at (0, 0.24, 0)
  const centralPadMesh = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), asphaltMat);
  centralPadMesh.rotation.x = -Math.PI / 2;
  centralPadMesh.position.set(0, 0.24, 0);
  group.add(centralPadMesh);

  // Concentric G-Force Skidpad & High-Speed Drift Rings on Central Hub (R = 45m, 95m, 155m, 215m)
  const ringSpecs = [
    { r: 45, color: 0x06b6d4 },
    { r: 95, color: 0xf59e0b },
    { r: 155, color: 0xef4444 },
    { r: 215, color: 0x10b981 },
  ];
  ringSpecs.forEach(({ r, color }) => {
    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(r - 1.3, r + 1.3, 84),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
    );
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(0, 0.26, 0);
    group.add(ringMesh);

    const innerDash = new THREE.Mesh(
      new THREE.RingGeometry(r - 4.4, r - 3.8, 72),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    innerDash.rotation.x = -Math.PI / 2;
    innerDash.position.set(0, 0.258, 0);
    group.add(innerDash);
  });

  // 3. INFINITE MULTI-LANE TOP-SPEED SUPER-HIGHWAY (X = -230, shifts seamlessly every 200m along Z forever!)
  const dragStripX = -230;
  const infiniteHighwayGroup = new THREE.Group();
  infiniteHighwayGroup.position.set(dragStripX, 0, 0);
  group.add(infiniteHighwayGroup);

  const highwaySegmentLen = 4800;
  const dragStripMesh = new THREE.Mesh(new THREE.PlaneGeometry(46, highwaySegmentLen), asphaltMat);
  dragStripMesh.rotation.x = -Math.PI / 2;
  dragStripMesh.position.set(0, 0.242, 0);
  infiniteHighwayGroup.add(dragStripMesh);

  // Highway outer solid white lines & center yellow/cyan speed lanes
  const whiteBasic = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const cyanBasic = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
  const amberBasic = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
  const sideStripeGeom = new THREE.PlaneGeometry(0.65, highwaySegmentLen);

  const leftLine = new THREE.Mesh(sideStripeGeom, whiteBasic);
  leftLine.rotation.x = -Math.PI / 2;
  leftLine.position.set(-19.5, 0.26, 0);
  infiniteHighwayGroup.add(leftLine);

  const rightLine = new THREE.Mesh(sideStripeGeom, whiteBasic);
  rightLine.rotation.x = -Math.PI / 2;
  rightLine.position.set(19.5, 0.26, 0);
  infiniteHighwayGroup.add(rightLine);

  const centerLineL = new THREE.Mesh(new THREE.PlaneGeometry(0.35, highwaySegmentLen), amberBasic);
  centerLineL.rotation.x = -Math.PI / 2;
  centerLineL.position.set(-0.45, 0.26, 0);
  infiniteHighwayGroup.add(centerLineL);

  const centerLineR = new THREE.Mesh(new THREE.PlaneGeometry(0.35, highwaySegmentLen), amberBasic);
  centerLineR.rotation.x = -Math.PI / 2;
  centerLineR.position.set(0.45, 0.26, 0);
  infiniteHighwayGroup.add(centerLineR);

  // Dashed lane dividers & repeating overhead speed-trap gantries every 200m along the 4,800m scrolling highway window
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.85, roughness: 0.22 });
  const pillarGeom = new THREE.CylinderGeometry(0.45, 0.55, 10.5, 10);
  const dashGeom = new THREE.PlaneGeometry(0.35, 12);

  for (let z = -2200; z <= 2200; z += 40) {
    const dL = new THREE.Mesh(dashGeom, cyanBasic);
    dL.rotation.x = -Math.PI / 2;
    dL.position.set(-9.75, 0.262, z);
    infiniteHighwayGroup.add(dL);

    const dR = new THREE.Mesh(dashGeom, cyanBasic);
    dR.rotation.x = -Math.PI / 2;
    dR.position.set(9.75, 0.262, z);
    infiniteHighwayGroup.add(dR);
  }

  const archColors = [0x10b981, 0x38bdf8, 0xf59e0b, 0xa855f7, 0xef4444];
  let archIdx = 0;
  for (let z = -2200; z <= 2200; z += 200) {
    const color = archColors[archIdx % archColors.length];
    archIdx++;
    const stripLine = new THREE.Mesh(
      new THREE.PlaneGeometry(38, 2.0),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
    );
    stripLine.rotation.x = -Math.PI / 2;
    stripLine.position.set(0, 0.265, z);
    infiniteHighwayGroup.add(stripLine);

    const arch = new THREE.Group();
    arch.position.set(0, 0.25, z);
    const aL = new THREE.Mesh(pillarGeom, metalMat);
    aL.position.set(-22, 5.25, 0);
    arch.add(aL);
    const aR = new THREE.Mesh(pillarGeom, metalMat);
    aR.position.set(22, 5.25, 0);
    arch.add(aR);
    const topBar = new THREE.Mesh(
      new THREE.BoxGeometry(46, 1.4, 1.4),
      new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.45 })
    );
    topBar.position.set(0, 9.6, 0);
    arch.add(topBar);
    infiniteHighwayGroup.add(arch);
  }

  // Start Gantry & 5 Green Launch Lights at the Highway Launch Origin (x = -230, z = +450)
  const dragStartZ = 450;
  const startGantry = new THREE.Group();
  const startLights: THREE.Mesh[] = [];
  const pL = new THREE.Mesh(pillarGeom, metalMat);
  pL.position.set(-22, 5.25, 0);
  startGantry.add(pL);
  const pR = new THREE.Mesh(pillarGeom, metalMat);
  pR.position.set(22, 5.25, 0);
  startGantry.add(pR);
  const bridgeBeam = new THREE.Mesh(new THREE.BoxGeometry(46, 1.5, 1.5), metalMat);
  bridgeBeam.position.set(0, 9.6, 0);
  startGantry.add(bridgeBeam);

  for (let i = 0; i < 5; i++) {
    const lMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x10b981 })
    );
    lMesh.position.set(-3.2 + i * 1.6, 8.3, 0.8);
    startLights.push(lMesh);
    startGantry.add(lMesh);
  }
  startGantry.position.set(dragStripX, 0.25, dragStartZ);
  group.add(startGantry);

  // 4. High-Speed Weaving Slalom Cones on East Side of Proving Hub (x = +195, z = +240 to -240)
  const coneOrangeMat = new THREE.MeshStandardMaterial({ color: 0xff5500, roughness: 0.4 });
  const coneWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  for (let c = -6; c <= 6; c++) {
    const coneGroup = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 1.4), coneOrangeMat);
    base.position.y = 0.07;
    coneGroup.add(base);
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.65, 14), coneOrangeMat);
    body.position.y = 0.88;
    coneGroup.add(body);
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.38, 0.42, 14), coneWhiteMat);
    stripe.position.y = 1.02;
    coneGroup.add(stripe);
    coneGroup.position.set(195, 0.25, c * 38);
    group.add(coneGroup);
  }

  // 5. 300–0 KM/H High-Speed Braking Calibration Strip (x = +340, z = +320 to -320)
  const brakeZoneX = 340;
  const brakeStripMesh = new THREE.Mesh(new THREE.PlaneGeometry(32, 700), asphaltMat);
  brakeStripMesh.rotation.x = -Math.PI / 2;
  brakeStripMesh.position.set(brakeZoneX, 0.245, 0);
  group.add(brakeStripMesh);

  // Braking calibration meter lines every 25m from z = +100 (Brake Trigger Line) to z = -150
  for (let dist = 0; dist <= 200; dist += 25) {
    const bz = 100 - dist;
    const isTrigger = dist === 0;
    const barColor = isTrigger ? 0xef4444 : dist % 50 === 0 ? 0xf59e0b : 0xffffff;
    const barMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(28, isTrigger ? 2.4 : 0.9),
      new THREE.MeshBasicMaterial({ color: barColor, side: THREE.DoubleSide })
    );
    barMesh.rotation.x = -Math.PI / 2;
    barMesh.position.set(brakeZoneX, 0.265, bz);
    group.add(barMesh);
  }

  const setStartLights = (_lightsLitCount: number, _lightsOut: boolean) => {
    for (let i = 0; i < startLights.length; i++) {
      const mat = startLights[i].material as THREE.MeshBasicMaterial;
      mat.color.setHex(0x10b981);
    }
  };

  const getTrackPointAtProgress = (t: number) => {
    const clampedT = ((t % 1) + 1) % 1;
    const position = curve.getPointAt(clampedT);
    position.y = 0.25;
    const tangent = curve.getTangentAt(clampedT).normalize();
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    return { position, tangent, normal };
  };

  const getTargetCornerSpeedKmh = (_t: number): number => 460;

  // Seamlessly repositions the 8,000m × 8,000m tiled road plane in 50m steps and the endless highway in 200m steps
  // so the road surface and highway extend infinitely in all directions around the player forever!
  const updateInfiniteRoadOrigin = (playerX: number, playerZ: number) => {
    const snappedX = Math.round(playerX / 50) * 50;
    const snappedZ = Math.round(playerZ / 50) * 50;
    if (openFieldMesh.position.x !== snappedX || openFieldMesh.position.z !== snappedZ) {
      openFieldMesh.position.x = snappedX;
      openFieldMesh.position.z = snappedZ;
    }

    const snappedHighwayZ = Math.round(playerZ / 1000) * 1000;
    if (infiniteHighwayGroup.position.z !== snappedHighwayZ) {
      infiniteHighwayGroup.position.z = snappedHighwayZ;
    }
  };

  // Truly Infinite Full-Road Surface Detection:
  // Never sets offTrack = true and NEVER triggers wall collisions anywhere—drive forever in any direction!
  const checkSurfaceType = (pos: THREE.Vector3): SurfaceInfo => {
    const distToSkidCenter = Math.hypot(pos.x, pos.z);
    const onSkidRing =
      Math.abs(distToSkidCenter - 45) < 1.3 ||
      Math.abs(distToSkidCenter - 95) < 1.3 ||
      Math.abs(distToSkidCenter - 155) < 1.3 ||
      Math.abs(distToSkidCenter - 215) < 1.3;

    return {
      offTrack: false,
      onCurb: onSkidRing,
      distanceToCenterline: 0,
      lateralOffset: 0,
      progress: 0,
      trackPoint: new THREE.Vector3(pos.x, 0.25, pos.z),
      tangent: new THREE.Vector3(0, 0, -1),
      normal: new THREE.Vector3(1, 0, 0),
      isCollidingWall: false,
      wallNormal: new THREE.Vector3(0, 0, 1),
      penetration: 0,
      barrierLimit: 9999999,
    };
  };

  const setReflectionTexture = (tex: THREE.Texture | null, intensity = 0.72) => {
    reflectionUniforms.uPlanarReflectionMap.value = tex;
    reflectionUniforms.uReflectionIntensity.value = tex ? intensity : 0.0;
  };
  const setReflectionPassMode = (active: boolean) => {
    openFieldMesh.visible = !active;
    centralPadMesh.visible = !active;
    dragStripMesh.visible = !active;
  };

  return {
    group,
    sceneryGroup,
    curve,
    trackLength,
    barrierLimit: 9999999,
    isOpenField: true,
    startGantry,
    startLights,
    setStartLights,
    setReflectionTexture,
    setReflectionPassMode,
    getTrackPointAtProgress,
    getTargetCornerSpeedKmh,
    checkSurfaceType,
    updateInfiniteRoadOrigin,
  };
}

/**
 * Generates the Metro City Downtown & Police Pursuit Grid:
 * - 7 North–South Avenues and 7 East–West Boulevards (28m wide each, 49 signalized intersections)
 * - Zebra crosswalks, double-yellow centerlines, and dashed lane dividers
 * - 36 City Blocks with raised sidewalks and illuminated 3D skyscrapers (with AABB collision boxes)
 * - 49 Dynamic 3D Traffic Signal Gantries with cycling Red / Yellow / Green bulbs
 */
function generateCityDrivingTrack(circuit: CircuitInfo, quality?: GraphicsQuality): GeneratedTrack {
  const group = new THREE.Group();
  const sceneryGroup = new THREE.Group();
  sceneryGroup.userData.neverChunkCull = true;
  group.add(sceneryGroup);
  const preset = getGraphicsPresetConfig(quality);
  const isUltra = preset.id === 'ultra';
  const isRetroPixel = preset.id === 'retro_pixel';
  const up = new THREE.Vector3(0, 1, 0);

  // Fast Lambert material builder for Retro Pixel '92 mode (avoids expensive PBR per-fragment math)
  const makeCityMat = (opts: {
    color?: number;
    map?: THREE.Texture;
    normalMap?: THREE.Texture;
    normalScale?: THREE.Vector2;
    bumpMap?: THREE.Texture;
    bumpScale?: number;
    roughnessMap?: THREE.Texture;
    roughness?: number;
    metalness?: number;
    envMapIntensity?: number;
    emissive?: number;
    emissiveMap?: THREE.Texture;
    emissiveIntensity?: number;
  }): THREE.Material =>
    isRetroPixel
      ? new THREE.MeshLambertMaterial({ color: opts.color ?? 0xffffff, map: opts.map })
      : new THREE.MeshStandardMaterial({
          color: opts.color ?? 0xffffff,
          map: opts.map,
          normalMap: opts.normalMap,
          normalScale: opts.normalScale,
          bumpMap: opts.bumpMap,
          bumpScale: opts.bumpScale ?? 0.04,
          roughnessMap: opts.roughnessMap,
          roughness: opts.roughness ?? 0.8,
          metalness: opts.metalness ?? 0.05,
          envMapIntensity: opts.envMapIntensity ?? (isUltra ? 1.05 : 0.72),
          emissive: opts.emissive !== undefined ? new THREE.Color(opts.emissive) : undefined,
          emissiveMap: opts.emissiveMap,
          emissiveIntensity: opts.emissiveIntensity ?? 0.0,
        });

  const disposables: { dispose: () => void }[] = [];
  const reflectorToggleables: THREE.Object3D[] = [];
  const nightWindowMats: THREE.MeshStandardMaterial[] = [];
  const suburbanBatch = new SuburbanBatchBuilder();

  const reflectionUniforms = {
    uPlanarReflectionMap: { value: null as THREE.Texture | null },
    uReflectionIntensity: { value: 0.0 },
    uRoadWetness: { value: 0.0 },
  };

  const points = circuit.trackPoints.map((p) => new THREE.Vector3(p.x, 0.25, p.z));
  const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.25);
  const trackLength = curve.getLength();

  // 1. Natural Maryland Countryside Terrain (Multi-Octave Piedmont Meadow, Soil & Oak Shade Variation)
  const terrainPBR = getTerrainPBRTextures(isRetroPixel, preset.anisotropy);
  const useNormalDetail = !isRetroPixel && (isUltra || preset.id === 'high' || preset.id === 'dynamic_aggressive');
  reflectionUniforms.uPlanarReflectionMap.value = terrainPBR.map;

  const baseAsphaltMat = makeCityMat({
    map: terrainPBR.map,
    normalMap: useNormalDetail ? terrainPBR.normalMap : undefined,
    normalScale: useNormalDetail ? new THREE.Vector2(0.55, 0.55) : undefined,
    roughness: 0.94,
    metalness: 0.0,
    envMapIntensity: isUltra ? 0.55 : 0.4,
  });

  // World-space macro-biome variation breaks up any repeating ground tile pattern across Maryland
  if (!isRetroPixel && baseAsphaltMat instanceof THREE.MeshStandardMaterial) {
    baseAsphaltMat.onBeforeCompile = (shader) => {
      shader.vertexShader =
        `varying vec3 vTerrainWorldPos;\n` +
        shader.vertexShader.replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );
      shader.fragmentShader =
        `varying vec3 vTerrainWorldPos;\n` +
        shader.fragmentShader.replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          float macroA = sin(vTerrainWorldPos.x * 0.011 + sin(vTerrainWorldPos.z * 0.009) * 1.4) * 0.5 + 0.5;
          float macroB = cos(vTerrainWorldPos.z * 0.017 - vTerrainWorldPos.x * 0.008) * 0.5 + 0.5;
          float detailM = sin(vTerrainWorldPos.x * 0.075) * cos(vTerrainWorldPos.z * 0.075) * 0.5 + 0.5;
          vec3 cloverTint = vec3(0.96, 1.06, 0.92);
          vec3 dryPiedmont = vec3(1.12, 1.02, 0.84);
          vec3 oakShade = vec3(0.76, 0.84, 0.72);
          vec3 biomeMod = mix(oakShade, cloverTint, macroA);
          biomeMod = mix(biomeMod, dryPiedmont, smoothstep(0.62, 0.96, macroB) * 0.45);
          biomeMod *= mix(0.90, 1.08, detailM);
          diffuseColor.rgb *= biomeMod;`
        );
    };
    baseAsphaltMat.needsUpdate = true;
  }

  const baseRoadMesh = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), baseAsphaltMat);
  baseRoadMesh.rotation.x = -Math.PI / 2;
  baseRoadMesh.position.y = 0.22;
  baseRoadMesh.receiveShadow = isUltra;
  baseRoadMesh.userData.neverChunkCull = true;
  group.add(baseRoadMesh);

  // 2. Forza-Grade American Asphalt PBR (Aggregate Normal Relief + Tire-Worn Roughness Map + Tar Seams)
  const asphaltPBR = getAsphaltPBRTextures(isRetroPixel, preset.anisotropy);
  const streetAsphaltMat = makeCityMat({
    map: asphaltPBR.map,
    normalMap: useNormalDetail ? asphaltPBR.normalMap : undefined,
    normalScale: useNormalDetail ? new THREE.Vector2(isUltra ? 0.85 : 0.55, isUltra ? 0.85 : 0.55) : undefined,
    roughnessMap: useNormalDetail ? asphaltPBR.roughnessMap : undefined,
    roughness: isUltra ? 0.96 : 0.94,
    metalness: isUltra ? 0.04 : 0.03,
    envMapIntensity: isUltra ? 0.62 : 0.42,
  });
  if (!isRetroPixel && (isUltra || preset.id === 'high')) {
    attachCityRoadReflectionShader(streetAsphaltMat, reflectionUniforms, isUltra);
  }
  const yellowLineMat = makeCityMat({
    color: 0xeab308,
    roughness: 0.62,
    metalness: 0.04,
  });
  if ('side' in yellowLineMat) yellowLineMat.side = THREE.DoubleSide;
  const whiteLineMat = makeCityMat({
    color: 0xe2e8f0,
    roughness: 0.58,
    metalness: 0.04,
  });
  if ('side' in whiteLineMat) whiteLineMat.side = THREE.DoubleSide;
  const stopBarMat = makeCityMat({
    color: 0xf1f5f9,
    roughness: 0.55,
    metalness: 0.04,
  });
  if ('side' in stopBarMat) stopBarMat.side = THREE.DoubleSide;

  const cityStreetRoadMeshes: THREE.Mesh[] = [];
  const cityBuildings: CityBuildingBox[] = [];
  const suburbanHouses: BuiltSuburbanHouse[] = [];

  const concretePBR = getConcretePBRTextures(isRetroPixel, preset.anisotropy);
  const sidewalkMat = makeCityMat({
    color: 0xbac4d0,
    map: concretePBR.map,
    normalMap: useNormalDetail ? concretePBR.normalMap : undefined,
    normalScale: useNormalDetail ? new THREE.Vector2(0.55, 0.55) : undefined,
    roughness: 0.88,
    metalness: 0.03,
    envMapIntensity: isUltra ? 0.55 : 0.4,
  });
  const treeTrunkMat = makeCityMat({ color: 0x4b3322, roughness: 0.94, metalness: 0.0 });
  const treeFoliageMat = makeCityMat({ color: 0x2c5829, roughness: 0.86, metalness: 0.02, envMapIntensity: 0.48 });
  const goldMat = makeCityMat({ color: 0xf59e0b, roughness: 0.18, metalness: 0.88, envMapIntensity: 1.45 });

  // =========================================================================================
  // Procedural Texture Helpers for Authentic Maryland Brick, Windows, Street Signs & Neon
  // =========================================================================================
  const makeTextSignMat = (
    lines: string[],
    bgHex: string,
    fgHex: string,
    borderHex?: string,
    emissiveHex?: string
  ) => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = bgHex;
      ctx.fillRect(0, 0, 512, 128);
      if (borderHex) {
        ctx.strokeStyle = borderHex;
        ctx.lineWidth = 6;
        ctx.strokeRect(5, 5, 502, 118);
      }
      ctx.fillStyle = fgHex;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (lines.length === 1) {
        ctx.font = 'bold 42px system-ui, -apple-system, sans-serif';
        ctx.fillText(lines[0], 256, 64, 480);
      } else {
        ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
        ctx.fillText(lines[0], 256, 42, 480);
        ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
        ctx.fillText(lines[1], 256, 88, 480);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = preset.anisotropy;
    if (isRetroPixel) {
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;
    }
    if (isRetroPixel) {
      return emissiveHex
        ? new THREE.MeshBasicMaterial({ map: tex })
        : new THREE.MeshLambertMaterial({ map: tex });
    }
    if (emissiveHex) {
      return new THREE.MeshStandardMaterial({
        map: tex,
        emissive: new THREE.Color(emissiveHex),
        emissiveMap: tex,
        emissiveIntensity: 1.25,
        roughness: 0.32,
      });
    }
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.48, metalness: 0.14 });
  };

  const makeBrickFacadeMat = (
    brickHex: string,
    mortarHex: string,
    windowColorHex: string,
    cols: number,
    rows: number,
    archedWindows = false
  ) => {
    const dim = isRetroPixel ? 128 : 512;
    const sc = dim / 256;
    const c = document.createElement('canvas');
    c.width = dim;
    c.height = dim;
    const ctx = c.getContext('2d');

    const bumpCanvas = useNormalDetail ? document.createElement('canvas') : null;
    if (bumpCanvas) {
      bumpCanvas.width = dim;
      bumpCanvas.height = dim;
    }
    const bCtx = bumpCanvas ? bumpCanvas.getContext('2d') : null;

    const emCanvas = useNormalDetail ? document.createElement('canvas') : null;
    if (emCanvas) {
      emCanvas.width = dim;
      emCanvas.height = dim;
    }
    const eCtx = emCanvas ? emCanvas.getContext('2d') : null;

    if (ctx) {
      ctx.fillStyle = brickHex;
      ctx.fillRect(0, 0, dim, dim);
      if (bCtx) {
        bCtx.fillStyle = '#c8c8c8';
        bCtx.fillRect(0, 0, dim, dim);
      }
      if (eCtx) {
        eCtx.fillStyle = '#000000';
        eCtx.fillRect(0, 0, dim, dim);
      }

      // Brick courses & subtle per-brick tonal variation
      if (!isRetroPixel) {
        for (let y = 0; y < dim; y += Math.round(8 * sc)) {
          for (let x = 0; x < dim; x += Math.round(16 * sc)) {
            const h = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
            ctx.fillStyle = h > 0.65 ? 'rgba(255,255,255,0.06)' : h < 0.35 ? 'rgba(0,0,0,0.09)' : 'rgba(0,0,0,0)';
            ctx.fillRect(x, y, Math.round(16 * sc), Math.round(8 * sc));
          }
        }
      }

      ctx.fillStyle = mortarHex;
      const stepY = Math.max(4, Math.round(8 * sc));
      for (let y = 0; y < dim; y += stepY) {
        ctx.fillRect(0, y, dim, Math.max(1, 1.2 * sc));
        if (bCtx) {
          bCtx.fillStyle = '#888888';
          bCtx.fillRect(0, y, dim, Math.max(1, 1.2 * sc));
        }
      }
      if (!isRetroPixel) {
        for (let y = 0; y < dim; y += stepY * 2) {
          for (let x = (y % (stepY * 4) === 0 ? 0 : Math.round(10 * sc)); x < dim; x += Math.round(20 * sc)) {
            ctx.fillRect(x, y, 1.2 * sc, stepY);
          }
        }
      }

      // Stone top cornice & ground-floor water table plinth
      if (!isRetroPixel) {
        ctx.fillStyle = '#d6d3d1';
        ctx.fillRect(0, 0, dim, Math.max(4, Math.round(7 * sc)));
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(0, dim - Math.max(5, Math.round(8 * sc)), dim, Math.max(5, Math.round(8 * sc)));
      }

      // Architectural windows with limestone lintels, recessed panes, brick pilasters & glazed retail ground bays
      const cellW = dim / cols;
      const cellH = dim / rows;
      const winW = cellW * 0.52;
      const winH = cellH * 0.56;
      for (let r = 0; r < rows; r++) {
        const isGroundRow = r === rows - 1 && rows >= 2;
        for (let col = 0; col < cols; col++) {
          const wx = col * cellW + (cellW - winW) * 0.5;
          const wy = isGroundRow ? r * cellH + cellH * 0.18 : r * cellH + (cellH - winH) * 0.5;
          const activeW = isGroundRow ? cellW * 0.72 : winW;
          const activeWx = isGroundRow ? col * cellW + (cellW - activeW) * 0.5 : wx;
          const activeH = isGroundRow ? cellH * 0.7 : winH;
          const seed = (r * 31 + col * 17 + cols * 7) % 11;
          const isLitAtNight = isGroundRow || seed < 6;

          if (!isGroundRow) {
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(activeWx - 2 * sc, wy - 3 * sc, activeW + 4 * sc, Math.max(1, 2.8 * sc));
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(activeWx - 2 * sc, wy + activeH, activeW + 4 * sc, Math.max(1, 3.2 * sc));
          } else if (!isRetroPixel) {
            // Retail ground storefront dark bronze aluminum bay surround
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(activeWx - 3 * sc, wy - 3 * sc, activeW + 6 * sc, activeH + 5 * sc);
          }

          if (bCtx) {
            bCtx.fillStyle = '#f2f2f2';
            bCtx.fillRect(activeWx - 2 * sc, wy - 3 * sc, activeW + 4 * sc, 3 * sc);
            bCtx.fillRect(activeWx - 2 * sc, wy + activeH, activeW + 4 * sc, 3.2 * sc);
            bCtx.fillStyle = '#383838';
            bCtx.fillRect(activeWx, wy, activeW, activeH);
          }

          ctx.fillStyle = isGroundRow ? '#0c233c' : windowColorHex;
          if (archedWindows && !isGroundRow && !isRetroPixel) {
            ctx.beginPath();
            ctx.arc(activeWx + activeW * 0.5, wy + activeW * 0.45, activeW * 0.5, Math.PI, 0);
            ctx.lineTo(activeWx + activeW, wy + activeH);
            ctx.lineTo(activeWx, wy + activeH);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.fillRect(activeWx, wy, activeW, activeH);
          }

          if (eCtx && isLitAtNight) {
            eCtx.fillStyle = isGroundRow ? '#ffdf9e' : seed % 2 === 0 ? '#ffd79a' : '#ffedb8';
            eCtx.fillRect(activeWx + 2 * sc, wy + 2 * sc, activeW - 4 * sc, activeH - 4 * sc);
            eCtx.fillStyle = '#000000';
            eCtx.fillRect(activeWx + activeW * 0.48, wy, Math.max(1, 1.5 * sc), activeH);
            eCtx.fillRect(activeWx, wy + activeH * 0.48, activeW, Math.max(1, 1.5 * sc));
          }

          ctx.fillStyle = isGroundRow ? 'rgba(186, 230, 253, 0.34)' : 'rgba(186, 230, 253, 0.24)';
          ctx.fillRect(activeWx + 2 * sc, wy + 2 * sc, activeW - 4 * sc, activeH * 0.42);
          ctx.fillStyle = isGroundRow ? '#334155' : '#64748b';
          ctx.fillRect(activeWx + activeW * 0.48, wy + 2 * sc, Math.max(1, 1.5 * sc), activeH - 2 * sc);
          if (!isGroundRow) {
            ctx.fillRect(activeWx + 2 * sc, wy + activeH * 0.48, activeW - 4 * sc, Math.max(1, 1.2 * sc));
          } else {
            ctx.fillRect(activeWx + 2 * sc, wy + activeH * 0.28, activeW - 4 * sc, Math.max(1, 1.6 * sc));
          }
        }
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = preset.anisotropy;
    if (isRetroPixel) {
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;
    }

    let bumpTex: THREE.CanvasTexture | undefined;
    if (bumpCanvas) {
      bumpTex = new THREE.CanvasTexture(bumpCanvas);
      bumpTex.wrapS = THREE.RepeatWrapping;
      bumpTex.wrapT = THREE.RepeatWrapping;
      bumpTex.anisotropy = preset.anisotropy;
      disposables.push(bumpTex);
    }
    let emTex: THREE.CanvasTexture | undefined;
    if (emCanvas) {
      emTex = new THREE.CanvasTexture(emCanvas);
      emTex.colorSpace = THREE.SRGBColorSpace;
      emTex.wrapS = THREE.RepeatWrapping;
      emTex.wrapT = THREE.RepeatWrapping;
      emTex.anisotropy = preset.anisotropy;
      disposables.push(emTex);
    }
    disposables.push(tex);

    const mat = makeCityMat({
      map: tex,
      bumpMap: bumpTex,
      bumpScale: isUltra ? 0.075 : 0.045,
      emissive: emTex ? 0xffdfb0 : undefined,
      emissiveMap: emTex,
      emissiveIntensity: 0.0,
      roughness: 0.76,
      metalness: 0.1,
    });
    if (mat instanceof THREE.MeshStandardMaterial && emTex) {
      nightWindowMats.push(mat);
    }
    return mat;
  };

  const getNearestRoadClearance = (px: number, pz: number) => {
    let minEdge = Infinity;
    let nearestPtX = px;
    let nearestPtZ = pz;
    let nearestHalfW = 12;
    for (let rIdx = 0; rIdx < ALL_MARYLAND_ROADS.length; rIdx++) {
      const r = ALL_MARYLAND_ROADS[rIdx];
      const hw = r.width * 0.5;
      for (let i = 0; i < r.points.length - 1; i++) {
        const a = r.points[i];
        const b = r.points[i + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const lSq = dx * dx + dz * dz;
        const t = lSq > 0 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / lSq)) : 0;
        const cx = a.x + t * dx;
        const cz = a.z + t * dz;
        const d = Math.hypot(px - cx, pz - cz) - hw;
        if (d < minEdge) {
          minEdge = d;
          nearestPtX = cx;
          nearestPtZ = cz;
          nearestHalfW = hw;
        }
      }
      if (r.culDeSacEndRadius && r.points.length > 0) {
        const endPt = r.points[r.points.length - 1];
        const d = Math.hypot(px - endPt.x, pz - endPt.z) - r.culDeSacEndRadius;
        if (d < minEdge) {
          minEdge = d;
          nearestPtX = endPt.x;
          nearestPtZ = endPt.z;
          nearestHalfW = r.culDeSacEndRadius;
        }
      }
    }
    return { minEdge, nearestPtX, nearestPtZ, nearestHalfW };
  };

  const addStreetNamePost = (x: number, z: number, label: string, rotY = 0) => {
    let px = x;
    let pz = z;
    // Automatically nudge any street post out onto the roadside shoulder (>= 3.2m outside any asphalt)
    for (let pass = 0; pass < 3; pass++) {
      const clr = getNearestRoadClearance(px, pz);
      if (clr.minEdge >= 2.8) break;
      const vx = px - clr.nearestPtX;
      const vz = pz - clr.nearestPtZ;
      const vLen = Math.hypot(vx, vz);
      const pushDist = clr.nearestHalfW + 3.8;
      if (vLen > 0.05) {
        px = clr.nearestPtX + (vx / vLen) * pushDist;
        pz = clr.nearestPtZ + (vz / vLen) * pushDist;
      } else {
        px += pushDist;
      }
    }
    const postGroup = new THREE.Group();
    postGroup.position.set(px, 0.25, pz);
    postGroup.rotation.y = rotY;
    const steelMat = makeCityMat({ color: 0x334155, metalness: 0.7, roughness: 0.35 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 3.1, isRetroPixel ? 5 : 8), steelMat);
    pole.position.y = 1.55;
    postGroup.add(pole);
    const bladeMat = makeTextSignMat([label], '#065f46', '#ffffff', '#e2e8f0');
    const blade = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.55, 0.1), bladeMat);
    blade.position.y = 3.05;
    postGroup.add(blade);
    sceneryGroup.add(postGroup);
  };

  const addLandscapedTree = (tx: number, tz: number, scale = 1.0) => {
    // Safety guard: never allow a landscaped tree to spawn inside or brushing a road corridor
    const clr = getNearestRoadClearance(tx, tz);
    if (clr.minEdge < 3.2 * scale) return;
    const species: 'oak' | 'pine' = Math.abs(Math.round(tx * 0.3 + tz * 0.7)) % 5 === 0 ? 'pine' : 'oak';
    const builtTree = buildDetailedSingleTreeGroup(tx, tz, scale, isRetroPixel, isUltra, species);
    sceneryGroup.add(builtTree.group);
    disposables.push(...builtTree.disposables);
  };

  const drawParkingLotBay = (cx: number, cz: number, width: number, depth: number, rotY = 0) => {
    const lotGroup = new THREE.Group();
    lotGroup.position.set(cx, 0.26, cz);
    lotGroup.rotation.y = rotY;
    const lotMat = new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.85, metalness: 0.08 });
    const lotPlane = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), lotMat);
    lotPlane.rotation.x = -Math.PI / 2;
    lotPlane.receiveShadow = isUltra;
    lotGroup.add(lotPlane);

    const stripeCount = Math.max(4, Math.floor(width / 5.5));
    for (let i = 0; i <= stripeCount; i++) {
      const sx = -width * 0.45 + (i / stripeCount) * width * 0.9;
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.18, depth * 0.36), whiteLineMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(sx, 0.015, -depth * 0.22);
      lotGroup.add(stripe);
      const stripeB = new THREE.Mesh(new THREE.PlaneGeometry(0.18, depth * 0.36), whiteLineMat);
      stripeB.rotation.x = -Math.PI / 2;
      stripeB.position.set(sx, 0.015, depth * 0.22);
      lotGroup.add(stripeB);
    }
    sceneryGroup.add(lotGroup);
  };

  // =========================================================================================
  // 3a. UNIFIED STATEWIDE MARYLAND ROAD NETWORK (Google Maps Geography — No Fake Grid)
  // =========================================================================================
  renderMarylandRoadSpecs(ALL_MARYLAND_ROADS, {
    group,
    sceneryGroup,
    cityStreetRoadMeshes,
    streetAsphaltMat,
    whiteLineMat,
    yellowLineMat,
    sidewalkMat,
    isUltra,
    isRetroPixel,
    makeCityMat,
    makeTextSignMat,
  });

  // =========================================================================================
  // 3b. BALTIMORE HARBOR, DOWNTOWN, CAMDEN YARDS, ROWHOMES & ISB (WOODLAWN)
  // =========================================================================================
  const baltimoreInfo = buildBaltimoreDistrict({
    group,
    sceneryGroup,
    cityBuildings,
    suburbanHouses,
    streetAsphaltMat,
    whiteLineMat,
    sidewalkMat,
    treeTrunkMat,
    treeFoliageMat,
    goldMat,
    isUltra,
    isRetroPixel,
    makeCityMat,
    makeTextSignMat,
    makeBrickFacadeMat,
    addStreetNamePost,
    addLandscapedTree,
    drawParkingLotBay,
    suburbanBatch,
  });
  const bankPosition = baltimoreInfo.bankPosition;
  const policeStationPosition = baltimoreInfo.policeStationPosition;

  // =========================================================================================
  // 3c. GAITHERSBURG, ICM (19411 WOODFIELD RD), EDINBURGH VILLAGE & HADLEY FARMS
  // =========================================================================================
  buildGaithersburgDistrict({
    group,
    sceneryGroup,
    cityStreetRoadMeshes,
    cityBuildings,
    suburbanHouses,
    streetAsphaltMat,
    whiteLineMat,
    yellowLineMat,
    sidewalkMat,
    treeTrunkMat,
    treeFoliageMat,
    goldMat,
    isUltra,
    isRetroPixel,
    makeCityMat,
    makeTextSignMat,
    makeBrickFacadeMat,
    addStreetNamePost,
    addLandscapedTree,
    suburbanBatch,
    disposables,
    reflectorToggleables,
  });

  // =========================================================================================
  // 3d. ENTIRE STATE OF MARYLAND: WESTERN MOUNTAINS TO CHESAPEAKE BAY & OCEAN CITY
  // =========================================================================================
  buildMarylandStateDistrict({
    group,
    sceneryGroup,
    cityBuildings,
    suburbanHouses,
    streetAsphaltMat,
    whiteLineMat,
    treeTrunkMat,
    treeFoliageMat,
    goldMat,
    isUltra,
    isRetroPixel,
    makeCityMat,
    makeTextSignMat,
    makeBrickFacadeMat,
    addStreetNamePost,
    addLandscapedTree,
    drawParkingLotBay,
    suburbanBatch,
    disposables,
  });

  // Commit all batched suburban houses + 2048x2048 street-facing address plaque atlases
  suburbanBatch.commit(sceneryGroup, { isUltra, isRetroPixel, makeCityMat }, disposables);
  registerSuburbanGpsEntries(suburbanHouses);

  // 4. Statewide Maryland Signalized Intersections (Cantilever Traffic Light Gantries)
  const trafficLightGantries: CityTrafficLightGantry[] = [];
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.75, roughness: 0.3 });
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x090d16, metalness: 0.5, roughness: 0.4 });
  const bulbGeom = new THREE.SphereGeometry(0.46, 10, 10);
  const poleGeom = new THREE.CylinderGeometry(0.28, 0.34, 8.2, 10);
  const armGeom = new THREE.CylinderGeometry(0.18, 0.22, 12.5, 8);
  const boxGeom = new THREE.BoxGeometry(1.15, 3.1, 0.9);

  for (const jct of MARYLAND_SIGNAL_JUNCTIONS) {
    const ix = jct.x;
    const iz = jct.z;

    // Collect actual incoming road directions & widths at this junction so stop bars & poles align cleanly
    let maxHalfW = 12;
    const incomingAngles: { angle: number; width: number }[] = [];
    for (const r of ALL_MARYLAND_ROADS) {
      for (let i = 0; i < r.points.length; i++) {
        const pt = r.points[i];
        if (Math.hypot(pt.x - ix, pt.z - iz) < 6) {
          if (r.width * 0.5 > maxHalfW) maxHalfW = r.width * 0.5;
          if (i > 0) {
            const prev = r.points[i - 1];
            incomingAngles.push({ angle: Math.atan2(prev.x - ix, prev.z - iz), width: r.width });
          }
          if (i < r.points.length - 1) {
            const next = r.points[i + 1];
            incomingAngles.push({ angle: Math.atan2(next.x - ix, next.z - iz), width: r.width });
          }
        }
      }
      // Also check junctions where a road passes straight through without sharing a node
      for (let i = 0; i < r.points.length - 1; i++) {
        const a = r.points[i];
        const b = r.points[i + 1];
        if (distSqPointToSeg(ix, iz, a.x, a.z, b.x, b.z) < 9) {
          if (r.width * 0.5 > maxHalfW) maxHalfW = r.width * 0.5;
        }
      }
    }

    const stopDist = maxHalfW + 1.8;
    for (const leg of incomingAngles.slice(0, 4)) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(leg.width * 0.7, 0.65), stopBarMat);
      bar.rotation.order = 'YXZ';
      bar.rotation.y = leg.angle;
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(ix + Math.sin(leg.angle) * stopDist, 0.258, iz + Math.cos(leg.angle) * stopDist);
      group.add(bar);
    }

    const nsBulbs = {
      red: new THREE.MeshBasicMaterial({ color: 0xef4444 }),
      yellow: new THREE.MeshBasicMaterial({ color: 0x332800 }),
      green: new THREE.MeshBasicMaterial({ color: 0x052e16 }),
    };
    const ewBulbs = {
      red: new THREE.MeshBasicMaterial({ color: 0x3b0808 }),
      yellow: new THREE.MeshBasicMaterial({ color: 0x332800 }),
      green: new THREE.MeshBasicMaterial({ color: 0x22c55e }),
    };

    // Search 16 radial directions at increasing radius to find 2 valid OFF-ROAD corners for mast poles
    const chosenCorners: { px: number; pz: number }[] = [];
    const baseRadius = maxHalfW + 5.2;
    for (const radStep of [baseRadius, baseRadius + 4.5, baseRadius + 9.0]) {
      for (let s = 0; s < 16; s++) {
        const ang = (s / 16) * Math.PI * 2 + Math.PI / 8;
        const px = ix + Math.cos(ang) * radStep;
        const pz = iz + Math.sin(ang) * radStep;
        const clr = getNearestRoadClearance(px, pz);
        if (clr.minEdge < 2.2) continue;
        // Pick opposite/well-separated corners
        if (chosenCorners.length === 0) {
          chosenCorners.push({ px, pz });
        } else if (
          chosenCorners.length === 1 &&
          Math.hypot(px - chosenCorners[0].px, pz - chosenCorners[0].pz) > radStep * 1.45
        ) {
          chosenCorners.push({ px, pz });
          break;
        }
      }
      if (chosenCorners.length >= 2) break;
    }

    if (chosenCorners.length > 0) {
      const c1 = chosenCorners[0];
      const nsMastGroup = new THREE.Group();
      nsMastGroup.position.set(c1.px, 0.25, c1.pz);
      nsMastGroup.rotation.y = Math.atan2(ix - c1.px, iz - c1.pz);
      const pole1 = new THREE.Mesh(poleGeom, poleMat);
      pole1.position.y = 4.1;
      nsMastGroup.add(pole1);
      const arm1 = new THREE.Mesh(armGeom, poleMat);
      arm1.rotation.x = Math.PI / 2;
      arm1.position.set(0, 7.6, 6.0);
      nsMastGroup.add(arm1);
      const headNS = new THREE.Group();
      headNS.position.set(0, 6.9, 8.2);
      headNS.rotation.y = Math.PI / 2;
      headNS.add(new THREE.Mesh(boxGeom, housingMat));
      for (const zSide of [-0.46, 0.46]) {
        const rBulb = new THREE.Mesh(bulbGeom, nsBulbs.red);
        rBulb.position.set(0, 0.92, zSide);
        headNS.add(rBulb);
        const yBulb = new THREE.Mesh(bulbGeom, nsBulbs.yellow);
        yBulb.position.set(0, 0, zSide);
        headNS.add(yBulb);
        const gBulb = new THREE.Mesh(bulbGeom, nsBulbs.green);
        gBulb.position.set(0, -0.92, zSide);
        headNS.add(gBulb);
      }
      nsMastGroup.add(headNS);
      group.add(nsMastGroup);
    }

    if (chosenCorners.length > 1) {
      const c2 = chosenCorners[1];
      const ewMastGroup = new THREE.Group();
      ewMastGroup.position.set(c2.px, 0.25, c2.pz);
      ewMastGroup.rotation.y = Math.atan2(ix - c2.px, iz - c2.pz);
      const pole2 = new THREE.Mesh(poleGeom, poleMat);
      pole2.position.y = 4.1;
      ewMastGroup.add(pole2);
      const arm2 = new THREE.Mesh(armGeom, poleMat);
      arm2.rotation.x = Math.PI / 2;
      arm2.position.set(0, 7.6, 6.0);
      ewMastGroup.add(arm2);
      const headEW = new THREE.Group();
      headEW.position.set(0, 6.9, 8.2);
      headEW.rotation.y = Math.PI / 2;
      headEW.add(new THREE.Mesh(boxGeom, housingMat));
      for (const zSide of [-0.46, 0.46]) {
        const rBulb = new THREE.Mesh(bulbGeom, ewBulbs.red);
        rBulb.position.set(0, 0.92, zSide);
        headEW.add(rBulb);
        const yBulb = new THREE.Mesh(bulbGeom, ewBulbs.yellow);
        yBulb.position.set(0, 0, zSide);
        headEW.add(yBulb);
        const gBulb = new THREE.Mesh(bulbGeom, ewBulbs.green);
        gBulb.position.set(0, -0.92, zSide);
        headEW.add(gBulb);
      }
      ewMastGroup.add(headEW);
      group.add(ewMastGroup);
    }

    trafficLightGantries.push({
      ix,
      iz,
      nsBulbs,
      ewBulbs,
    });
  }

  // Partition the 5,200m x 3,150m Maryland world into 240m x 240m spatial chunks + wide road corridors
  const chunkManager = new WorldChunkManager(240);
  chunkManager.partitionStaticGroups([sceneryGroup, group]);

  const baseChunkMaxDistance = isUltra
    ? 820
    : preset.id === 'high'
    ? 720
    : preset.id === 'medium'
    ? 540
    : isRetroPixel
    ? 290
    : preset.id === 'low'
    ? 350
    : preset.id === 'retro'
    ? 380
    : 420;

  // Dummy startGantry for interface compatibility
  const startGantry = new THREE.Group();
  const startLights: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x10b981 })
    );
    startLights.push(m);
  }

  // Updates intersection Red/Yellow/Green traffic signal bulbs within 300m of player (~10Hz) & drives subtle grass/foliage wind sway
  let lastSignalUpdateTick = -1;
  const updateCityTrafficLights = (timeSec: number, playerX: number, playerZ: number) => {
    if (!isRetroPixel && isUltra) {
      updateFoliageWindTime(timeSec);
    }
    const tick = Math.floor(timeSec * 10);
    if (tick === lastSignalUpdateTick) return;
    lastSignalUpdateTick = tick;

    const maxDistSq = isRetroPixel ? 210 * 210 : 300 * 300;
    for (let i = 0; i < trafficLightGantries.length; i++) {
      const g = trafficLightGantries[i];
      const dx = g.ix - playerX;
      const dz = g.iz - playerZ;
      if (dx * dx + dz * dz > maxDistSq) continue;
      const state = getIntersectionSignalState(g.ix, g.iz, timeSec);

      g.nsBulbs.red.color.setHex(state.ns === 'RED' ? 0xff1e1e : 0x2a0808);
      g.nsBulbs.yellow.color.setHex(state.ns === 'YELLOW' ? 0xfacc15 : 0x282004);
      g.nsBulbs.green.color.setHex(state.ns === 'GREEN' ? 0x10b981 : 0x052814);

      g.ewBulbs.red.color.setHex(state.ew === 'RED' ? 0xff1e1e : 0x2a0808);
      g.ewBulbs.yellow.color.setHex(state.ew === 'YELLOW' ? 0xfacc15 : 0x282004);
      g.ewBulbs.green.color.setHex(state.ew === 'GREEN' ? 0x10b981 : 0x052814);
    }
  };

  const updateWorldChunks = (
    camera: THREE.Camera,
    playerPos: THREE.Vector3,
    opts: { isDynamicMode: boolean; qualityFactor: number; chunkLoadScale?: number; aggressiveDynamic?: boolean }
  ) => {
    chunkManager.update(camera, playerPos, {
      isDynamicMode: opts.isDynamicMode,
      qualityFactor: opts.qualityFactor,
      baseMaxDistance: baseChunkMaxDistance,
      chunkLoadScale: opts.chunkLoadScale,
      aggressiveDynamic: opts.aggressiveDynamic,
    });
  };

  const setReflectionChunkCull = (active: boolean, playerPos?: THREE.Vector3) => {
    if (active && playerPos) {
      chunkManager.applyReflectionRange(playerPos, 240);
    } else {
      chunkManager.restoreAfterReflection();
    }
  };

  const updateInfiniteRoadOrigin = (playerX: number, playerZ: number) => {
    const snappedX = Math.round(playerX / 50) * 50;
    const snappedZ = Math.round(playerZ / 50) * 50;
    if (baseRoadMesh.position.x !== snappedX || baseRoadMesh.position.z !== snappedZ) {
      baseRoadMesh.position.x = snappedX;
      baseRoadMesh.position.z = snappedZ;
    }
  };

  const setStartLights = (_lightsLitCount: number, _lightsOut: boolean) => {};
  const getTrackPointAtProgress = (t: number) => {
    const clampedT = ((t % 1) + 1) % 1;
    const position = curve.getPointAt(clampedT);
    position.y = 0.25;
    const tangent = curve.getTangentAt(clampedT).normalize();
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    return { position, tangent, normal };
  };
  const getTargetCornerSpeedKmh = (_t: number): number => 320;

  const _citySurfTrackPt = new THREE.Vector3();
  const _citySurfTangent = new THREE.Vector3(0, 0, -1);
  const _citySurfNormal = new THREE.Vector3(1, 0, 0);
  const _citySurfWallNormal = new THREE.Vector3(0, 0, 1);

  const checkSurfaceType = (pos: THREE.Vector3): SurfaceInfo => {
    const onStreet = isOnMarylandPavedSurface(pos.x, pos.z);
    let onDrivewayOrStation = false;

    if (!onStreet) {
      for (let i = 0; i < suburbanHouses.length; i++) {
        const h = suburbanHouses[i];
        const dc = h.drivewayCoord;
        const dtPt = h.drivewayTarget;
        if (
          (dc && Math.abs(pos.x - dc.x) < 6.5 && Math.abs(pos.z - dc.z) < 6.5 && (pos.x - dc.x) ** 2 + (pos.z - dc.z) ** 2 <= 38.44) ||
          (dtPt && Math.abs(pos.x - dtPt.x) < 6.5 && Math.abs(pos.z - dtPt.z) < 6.5 && (pos.x - dtPt.x) ** 2 + (pos.z - dtPt.z) ** 2 <= 38.44)
        ) {
          onDrivewayOrStation = true;
          break;
        }
      }
      if (!onDrivewayOrStation) {
        for (let i = 0; i < CITY_SERVICE_STATIONS.length; i++) {
          const st = CITY_SERVICE_STATIONS[i];
          if (Math.abs(pos.x - st.x) < 16 && Math.abs(pos.z - st.z) < 16 && (pos.x - st.x) ** 2 + (pos.z - st.z) ** 2 <= 225.0) {
            onDrivewayOrStation = true;
            break;
          }
        }
      }
    }

    const onPaved = onStreet || onDrivewayOrStation;
    _citySurfTrackPt.set(pos.x, 0.25, pos.z);

    return {
      offTrack: !onPaved,
      onCurb: false,
      distanceToCenterline: 0,
      lateralOffset: 0,
      progress: 0,
      trackPoint: _citySurfTrackPt,
      tangent: _citySurfTangent,
      normal: _citySurfNormal,
      isCollidingWall: false,
      wallNormal: _citySurfWallNormal,
      penetration: 0,
      barrierLimit: 9999999,
    };
  };

  const setReflectionTexture = (tex: THREE.Texture | null, intensity = 0.72) => {
    reflectionUniforms.uPlanarReflectionMap.value = tex;
    reflectionUniforms.uReflectionIntensity.value = tex ? intensity : 0.0;
  };
  const setRoadWetness = (wetness: number) => {
    const w = Math.max(0, Math.min(1, wetness));
    reflectionUniforms.uRoadWetness.value = w;
    if (streetAsphaltMat instanceof THREE.MeshStandardMaterial) {
      streetAsphaltMat.roughness = isUltra ? 0.96 - 0.58 * w : 0.94 - 0.44 * w;
      streetAsphaltMat.metalness = isUltra ? 0.04 + 0.16 * w : 0.03 + 0.10 * w;
      streetAsphaltMat.envMapIntensity = isUltra ? 0.62 + 0.95 * w : 0.42 + 0.55 * w;
    }
  };
  let lastAppliedNight = -1;
  const setNightIntensity = (nightFactor: number) => {
    const clamped = Math.max(0, Math.min(1, nightFactor));
    if (Math.abs(clamped - lastAppliedNight) < 0.03) return;
    lastAppliedNight = clamped;
    const emInt = clamped * (isUltra ? 1.15 : 0.85);
    for (let i = 0; i < nightWindowMats.length; i++) {
      nightWindowMats[i].emissiveIntensity = emInt;
    }
  };
  let dynamicReflectorsHidden = false;
  const setDynamicReflectorsHidden = (hidden: boolean) => {
    if (dynamicReflectorsHidden === hidden) return;
    dynamicReflectorsHidden = hidden;
    for (let i = 0; i < reflectorToggleables.length; i++) {
      reflectorToggleables[i].visible = !hidden;
    }
  };
  const setReflectionPassMode = (active: boolean) => {
    baseRoadMesh.visible = !active;
    for (let i = 0; i < cityStreetRoadMeshes.length; i++) {
      cityStreetRoadMeshes[i].visible = !active;
    }
    for (let i = 0; i < reflectorToggleables.length; i++) {
      reflectorToggleables[i].visible = !active && !dynamicReflectorsHidden;
    }
  };

  return {
    group,
    sceneryGroup,
    curve,
    trackLength,
    barrierLimit: 9999999,
    isOpenField: true,
    isCityDriving: true,
    cityBuildings,
    suburbanHouses,
    bankPosition,
    policeStationPosition,
    startGantry,
    startLights,
    setStartLights,
    setReflectionTexture,
    setReflectionPassMode,
    setDynamicReflectorsHidden,
    setRoadWetness,
    setNightIntensity,
    getTrackPointAtProgress,
    getTargetCornerSpeedKmh,
    checkSurfaceType,
    updateInfiniteRoadOrigin,
    updateCityTrafficLights,
    updateWorldChunks,
    setReflectionChunkCull,
    dispose: () => {
      for (let i = 0; i < disposables.length; i++) {
        disposables[i].dispose();
      }
    },
  };
}



