import * as THREE from 'three';
import { CircuitInfo } from '../types/racing';
import { buildCircuitScenery } from './environmentBuilder';
import { GraphicsQuality, getGraphicsPresetConfig, isDynamicGraphics } from '../utils/graphicsSettings';

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
  startGantry: THREE.Group;
  startLights: THREE.Mesh[];
  setStartLights: (lightsLitCount: number, lightsOut: boolean) => void;
  getTrackPointAtProgress: (t: number) => { position: THREE.Vector3; tangent: THREE.Vector3; normal: THREE.Vector3 };
  getTargetCornerSpeedKmh: (t: number) => number;
  checkSurfaceType: (pos: THREE.Vector3, hintProgress?: number) => SurfaceInfo;
}

export function generateTrack(circuit: CircuitInfo, quality?: GraphicsQuality): GeneratedTrack {
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
    if (preset.id === 'retro') {
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

  // Clean, uniform motorsport asphalt texture (zero dark groove band or reflection smudge)
  let trackMat: THREE.Material;
  const isFastLambertPreset = preset.id === 'low' || preset.id === 'dynamic_conservative' || preset.id === 'retro';
  if (typeof document !== 'undefined') {
    const texSize = 512; // Always crisp 512px+ canvas so road markings are never pixelated
    const canvas = document.createElement('canvas');
    canvas.width = texSize;
    canvas.height = texSize;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = preset.id === 'retro' ? '#1e1638' : '#2a2e37';
    ctx.fillRect(0, 0, texSize, texSize);

    if (preset.id !== 'retro') {
      const imgData = ctx.getImageData(0, 0, texSize, texSize);
      const data = imgData.data;
      for (let p = 0; p < data.length; p += 4) {
        const grain = (Math.random() - 0.5) * 14;
        data[p] = Math.max(30, Math.min(68, data[p] + grain));
        data[p + 1] = Math.max(32, Math.min(72, data[p + 1] + grain));
        data[p + 2] = Math.max(38, Math.min(80, data[p + 2] + grain));
      }
      ctx.putImageData(imgData, 0, 0);
    } else {
      // Classic 90s Arcade OutRun / Virtua Racing striped asphalt bands & dashed center line
      ctx.fillStyle = '#251c44';
      ctx.fillRect(0, 0, texSize, texSize / 2);
      ctx.fillStyle = '#ffe600';
      ctx.fillRect(Math.round(texSize * 0.49), 40, Math.round(texSize * 0.02), 180);
      ctx.fillRect(Math.round(texSize * 0.49), 300, Math.round(texSize * 0.02), 180);
    }

    const scale = texSize / 1024;

    // Boundary lines (Electric Cyan in Retro mode, Crisp White in standard modes)
    ctx.fillStyle = preset.id === 'retro' ? '#00f0ff' : '#f8fafc';
    ctx.fillRect(Math.round(16 * scale), 0, Math.max(4, Math.round(22 * scale)), texSize);
    ctx.fillRect(Math.round(986 * scale), 0, Math.max(4, Math.round(22 * scale)), texSize);

    // DRS Zone Markings & Lines
    ctx.fillStyle = preset.id === 'retro' ? 'rgba(255, 42, 133, 0.9)' : 'rgba(0, 230, 118, 0.85)';
    ctx.fillRect(Math.round(36 * scale), Math.round(120 * scale), Math.round(952 * scale), Math.max(3, Math.round(12 * scale)));

    // Starting grid slot box markings
    ctx.strokeStyle = preset.id === 'retro' ? 'rgba(0, 240, 255, 0.9)' : 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = Math.max(2, Math.round(6 * scale));
    ctx.strokeRect(Math.round(320 * scale), Math.round(180 * scale), Math.round(140 * scale), Math.round(90 * scale));
    ctx.strokeRect(Math.round(560 * scale), Math.round(680 * scale), Math.round(140 * scale), Math.round(90 * scale));

    // High-visibility forward directional chevron markings
    [280, 780].forEach((yBase) => {
      [-140, 0, 140].forEach((xOff) => {
        const cx = (512 + xOff) * scale;
        const yb = yBase * scale;
        ctx.fillStyle = preset.id === 'retro' ? 'rgba(255, 230, 0, 0.95)' : 'rgba(255, 230, 40, 0.82)';
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
    trackTexture.anisotropy = Math.max(4, preset.anisotropy);

    if (isFastLambertPreset) {
      trackMat = new THREE.MeshLambertMaterial({
        map: trackTexture,
      });
    } else {
      trackMat = new THREE.MeshStandardMaterial({
        map: trackTexture,
        roughness: 0.88,
        metalness: 0.0,
        envMapIntensity: 0.0,
      });
    }
  } else {
    trackMat = new THREE.MeshLambertMaterial({
      color: 0x2a2e37,
    });
  }

  const trackMesh = new THREE.Mesh(trackGeom, trackMat);
  trackMesh.receiveShadow = false;
  group.add(trackMesh);

  // Curbs with DoubleSide
  const curbMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.45,
    metalness: 0.1,
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

  // Runoff Left & Right
  const runoffMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.65,
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
    roughness: 0.35,
    metalness: 0.45,
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
  if (typeof document !== 'undefined' && preset.id === 'retro') {
    const gCanvas = document.createElement('canvas');
    gCanvas.width = 256;
    gCanvas.height = 256;
    const gCtx = gCanvas.getContext('2d');
    if (gCtx) {
      gCtx.fillStyle = '#0e0424';
      gCtx.fillRect(0, 0, 256, 256);
      // Synthwave OutRun Neon Grid
      gCtx.strokeStyle = 'rgba(255, 42, 133, 0.55)';
      gCtx.lineWidth = 4;
      gCtx.strokeRect(0, 0, 256, 256);
      gCtx.strokeStyle = 'rgba(0, 240, 255, 0.30)';
      gCtx.lineWidth = 2;
      gCtx.beginPath();
      gCtx.moveTo(128, 0);
      gCtx.lineTo(128, 256);
      gCtx.moveTo(0, 128);
      gCtx.lineTo(256, 128);
      gCtx.stroke();
      groundTex = new THREE.CanvasTexture(gCanvas);
      groundTex.wrapS = THREE.RepeatWrapping;
      groundTex.wrapT = THREE.RepeatWrapping;
      groundTex.repeat.set(180, 180);
      groundTex.colorSpace = THREE.SRGBColorSpace;
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
    roughness: 0.92,
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

  const metalMat = new THREE.MeshStandardMaterial({ color: 0x2a2b30, metalness: 0.85, roughness: 0.25 });
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

  return {
    group,
    sceneryGroup,
    curve,
    trackLength,
    barrierLimit: 18.4,
    startGantry,
    startLights,
    setStartLights,
    getTrackPointAtProgress,
    getTargetCornerSpeedKmh,
    checkSurfaceType,
  };
}
