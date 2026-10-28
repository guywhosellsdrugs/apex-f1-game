import * as THREE from 'three';
import { Team, Driver } from '../types/racing';
import { GraphicsQuality, getGraphicsPresetConfig } from '../utils/graphicsSettings';

let cachedCarbonTexture: THREE.CanvasTexture | null = null;

function getCarbonWeaveTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  if (cachedCarbonTexture) return cachedCarbonTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#181a20';
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      const shift = (y / 8) % 2 === 0 ? 0 : 4;
      ctx.fillStyle = '#242730';
      ctx.fillRect((x + shift) % 64, y, 4, 4);
      ctx.fillStyle = '#12141a';
      ctx.fillRect((x + shift + 4) % 64, y + 4, 4, 4);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  cachedCarbonTexture = tex;
  return tex;
}

let cachedFlakeNormalTex: THREE.CanvasTexture | null = null;
function getMetallicFlakeNormalTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  if (cachedFlakeNormalTex) return cachedFlakeNormalTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(128, 128);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const nx = 128 + (Math.random() - 0.5) * 18;
    const ny = 128 + (Math.random() - 0.5) * 18;
    d[i] = nx;
    d[i + 1] = ny;
    d[i + 2] = 255;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  cachedFlakeNormalTex = tex;
  return tex;
}

let cachedTireTex: THREE.CanvasTexture | null = null;
function getTireRubberTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  if (cachedTireTex) return cachedTireTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#18191d';
  ctx.fillRect(0, 0, 256, 256);
  // Subtle heat-cycled slick center band & graining texture
  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, '#121316');
  grad.addColorStop(0.2, '#1f2025');
  grad.addColorStop(0.5, '#15161a');
  grad.addColorStop(0.8, '#1f2025');
  grad.addColorStop(1, '#121316');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(x, y, 2, 6);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  cachedTireTex = tex;
  return tex;
}

export interface BuiltCar {
  root: THREE.Group;
  bodyMesh: THREE.Mesh;
  frontLeftWheel: THREE.Group;
  frontRightWheel: THREE.Group;
  rearLeftWheel: THREE.Group;
  rearRightWheel: THREE.Group;
  frontWheelsPivot: THREE.Group;
  drsFlap: THREE.Mesh;
  tailLight: THREE.Mesh;
  brakeDiscs: THREE.Mesh[];
  steeringWheel: THREE.Group;
  sparksPoints: THREE.Points;
  setWheelSpin: (speedKmh: number, delta: number) => void;
  setSteerAngle: (steerRad: number) => void;
  setDrsActive: (active: boolean) => void;
  setBraking: (braking: boolean) => void;
  flashTailLight: (time: number) => void;
  updateSparks: (speedKmh: number, onCurb: boolean, delta: number) => void;
  setPositionTag: (position: number, name: string, isTeammate?: boolean, isPlayer?: boolean) => void;
}

export function buildF1Car(team: Team, driver?: Driver, quality?: GraphicsQuality): BuiltCar {
  const root = new THREE.Group();
  const preset = getGraphicsPresetConfig(quality);
  const isLow = preset.id === 'low' || preset.id === 'dynamic_conservative' || preset.id === 'retro';
  const isRetro = preset.id === 'retro';
  const isUltra = preset.id === 'ultra';
  const radialSegs = preset.carGeometrySegments;

  // 1. Clean, Vibrant Materials scaled by Graphics Quality Preset (never pitch-black without envMap)
  const primaryColor = new THREE.Color(team.primaryColor || '#E80020');
  const secondaryColor = new THREE.Color(team.secondaryColor || '#1A1A1A');
  const accentColor = new THREE.Color(team.accentColor || '#FFFFFF');
  const isHighOrUltra = preset.id === 'high' || preset.id === 'ultra';
  const carbonTex = isHighOrUltra ? getCarbonWeaveTexture() : null;
  const flakeNormalTex = isUltra ? getMetallicFlakeNormalTexture() : null;
  const tireTex = isHighOrUltra ? getTireRubberTexture() : null;

  const carPaintMat: THREE.Material = isRetro
    ? new THREE.MeshPhongMaterial({
        color: primaryColor,
        flatShading: true,
        shininess: 80,
        specular: 0xffffff,
      })
    : isLow
    ? new THREE.MeshLambertMaterial({ color: primaryColor })
    : preset.usePhysicalClearcoat
    ? new THREE.MeshPhysicalMaterial({
        color: primaryColor,
        metalness: 0.22,
        roughness: 0.16,
        normalMap: flakeNormalTex || undefined,
        normalScale: isUltra ? new THREE.Vector2(0.015, 0.015) : undefined,
        clearcoat: 0.85,
        clearcoatRoughness: 0.08,
      })
    : new THREE.MeshStandardMaterial({
        color: primaryColor,
        metalness: 0.18,
        roughness: 0.22,
      });

  const secondaryPaintMat: THREE.Material = isRetro
    ? new THREE.MeshPhongMaterial({
        color: secondaryColor,
        flatShading: true,
        shininess: 65,
      })
    : isLow
    ? new THREE.MeshLambertMaterial({ color: secondaryColor })
    : new THREE.MeshStandardMaterial({
        color: secondaryColor,
        metalness: 0.18,
        roughness: 0.25,
      });

  const accentPaintMat: THREE.Material = isRetro
    ? new THREE.MeshPhongMaterial({
        color: accentColor,
        flatShading: true,
        shininess: 90,
      })
    : isLow
    ? new THREE.MeshLambertMaterial({ color: accentColor })
    : new THREE.MeshStandardMaterial({
        color: accentColor,
        metalness: 0.16,
        roughness: 0.22,
      });

  const carbonMat: THREE.Material = isRetro
    ? new THREE.MeshPhongMaterial({ color: 0x241c3c, flatShading: true, shininess: 40 })
    : isLow
    ? new THREE.MeshLambertMaterial({ color: 0x1b1d24 })
    : new THREE.MeshStandardMaterial({
        color: 0x1b1d24,
        map: carbonTex || undefined,
        metalness: 0.2,
        roughness: 0.4,
      });

  const matteBlackMat: THREE.Material = isLow
    ? new THREE.MeshLambertMaterial({ color: 0x14151a })
    : new THREE.MeshStandardMaterial({
        color: 0x14151a,
        roughness: 0.85,
      });

  const tireRubberMat: THREE.Material = isRetro
    ? new THREE.MeshPhongMaterial({ color: 0x1c1e26, flatShading: true, shininess: 25 })
    : isLow
    ? new THREE.MeshLambertMaterial({ color: 0x1e2026 })
    : new THREE.MeshStandardMaterial({
        color: 0x1e2026,
        map: tireTex || undefined,
        roughness: 0.78,
        metalness: 0.05,
      });

  const wheelRimMat: THREE.Material = isRetro
    ? new THREE.MeshPhongMaterial({ color: 0xffe600, flatShading: true, shininess: 90 })
    : isLow
    ? new THREE.MeshLambertMaterial({ color: 0x474b57 })
    : new THREE.MeshStandardMaterial({
        color: 0x474b57,
        metalness: 0.35,
        roughness: 0.28,
      });

  const brakeDiscMat = new THREE.MeshStandardMaterial({
    color: 0x444650,
    metalness: 0.35,
    roughness: 0.35,
    emissive: 0x000000,
    emissiveIntensity: 0,
  });

  const haloMat: THREE.Material = isLow
    ? new THREE.MeshLambertMaterial({ color: 0x22242c })
    : new THREE.MeshStandardMaterial({
        color: 0x22242c,
        map: carbonTex || undefined,
        metalness: 0.25,
        roughness: 0.32,
      });

  const helmetColor = driver?.color ? new THREE.Color(driver.color) : accentColor;
  const helmetMat: THREE.Material = isLow
    ? new THREE.MeshLambertMaterial({ color: helmetColor })
    : new THREE.MeshStandardMaterial({
        color: helmetColor,
        metalness: 0.2,
        roughness: 0.18,
      });

  const visorMat: THREE.Material = new THREE.MeshLambertMaterial({ color: 0x1e293b });

  // 2. Main Monocoque & Sleek 2026 Aerodynamic Nose (Scaled Smooth Sculpted Geometry)
  const noseGeom = new THREE.CylinderGeometry(0.18, 0.52, 2.45, radialSegs, isLow ? 3 : isUltra ? 12 : 8);
  noseGeom.rotateX(Math.PI / 2);
  noseGeom.computeVertexNormals();
  const noseMesh = new THREE.Mesh(noseGeom, carPaintMat);
  noseMesh.position.set(0, 0.33, -1.35);
  noseMesh.scale.set(0.92, 0.82, 1.0);
  noseMesh.castShadow = preset.shadowsEnabled;
  root.add(noseMesh);

  // Aerodynamic nose tip cone
  const noseTipGeom = new THREE.ConeGeometry(0.17, 0.35, radialSegs);
  noseTipGeom.computeVertexNormals();
  const noseTip = new THREE.Mesh(noseTipGeom, secondaryPaintMat);
  noseTip.rotateX(-Math.PI / 2);
  noseTip.position.set(0, 0.32, -2.62);
  noseTip.castShadow = preset.shadowsEnabled;
  root.add(noseTip);

  // Smooth Sculpted Cockpit Monocoque & Engine Cover (Subdivided with rounded shoulders & tapered front)
  const cockpitSub = isLow ? 4 : isUltra ? 14 : 10;
  const cockpitGeom = new THREE.BoxGeometry(0.84, 0.56, 1.98, cockpitSub, cockpitSub, cockpitSub + 4);
  {
    const pos = cockpitGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      const z = pos.getZ(i);
      const normZ = z / 0.99; // -1 (front) to +1 (rear)
      // Smooth aerodynamic taper toward front nose bulkhead
      if (normZ < 0) {
        const taper = 1.0 - Math.abs(normZ) * 0.25;
        x *= taper;
        if (y > 0) y *= taper;
      } else if (normZ > 0.3) {
        // Coke-bottle rear engine cover taper
        const rearTaper = 1.0 - (normZ - 0.3) * 0.38;
        x *= rearTaper;
      }
      // Smooth rounded top crest & shoulders
      if (y > 0) {
        const shoulderCurve = 1.0 - Math.pow(Math.abs(x) / 0.42, 2) * 0.26;
        y *= shoulderCurve;
      }
      pos.setXYZ(i, x, y, z);
    }
    cockpitGeom.computeVertexNormals();
  }
  const cockpitMesh = new THREE.Mesh(cockpitGeom, carPaintMat);
  cockpitMesh.position.set(0, 0.44, 0.1);
  cockpitMesh.castShadow = true;
  root.add(cockpitMesh);

  // Overhead Airbox / Engine Intake with smooth rounded roll-hoop and rear spine taper
  const airboxGeom = new THREE.BoxGeometry(0.42, 0.35, 0.92, 8, 8, 10);
  {
    const pos = airboxGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      const z = pos.getZ(i);
      const normZ = z / 0.46;
      if (normZ > -0.2) {
        const spineTaper = 1.0 - ((normZ + 0.2) / 1.2) * 0.52;
        x *= spineTaper;
        if (y > 0) y *= (1.0 - ((normZ + 0.2) / 1.2) * 0.35);
      }
      if (y > 0) {
        const arch = 1.0 - Math.pow(Math.abs(x) / 0.21, 2) * 0.35;
        y *= arch;
      }
      pos.setXYZ(i, x, y, z);
    }
    airboxGeom.computeVertexNormals();
  }
  const airbox = new THREE.Mesh(airboxGeom, carPaintMat);
  airbox.position.set(0, 0.78, 0.25);
  airbox.castShadow = true;
  root.add(airbox);

  const intakeHole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 24), matteBlackMat);
  intakeHole.rotateX(Math.PI / 2);
  intakeHole.scale.set(1.1, 0.85, 1.0);
  intakeHole.position.set(0, 0.81, -0.21);
  root.add(intakeHole);

  // FIA T-Cam on top of roll-hoop
  const tCamBar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.045, 0.06, 4, 2, 2), secondaryPaintMat);
  tCamBar.position.set(0, 0.98, 0.08);
  root.add(tCamBar);

  // Shark Fin along engine spine
  const finGeom = new THREE.BoxGeometry(0.035, 0.48, 1.55, 2, 4, 8);
  finGeom.computeVertexNormals();
  const finMesh = new THREE.Mesh(finGeom, secondaryPaintMat);
  finMesh.position.set(0, 0.82, 0.65);
  finMesh.castShadow = true;
  root.add(finMesh);

  // Sculpted Sidepods with Smooth Ground-Effect Undercut & Coke-Bottle Contour
  const buildSmoothSidepod = (isRight: boolean) => {
    const podGeom = new THREE.BoxGeometry(0.50, 0.42, 1.72, 10, 8, 14);
    const pos = podGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      const z = pos.getZ(i);
      const normZ = z / 0.86; // -1 front to +1 rear
      const isOuter = isRight ? x > 0 : x < 0;

      // Swept-back downwash ramp and rear Coke-bottle taper
      if (normZ > 0.05) {
        const t = (normZ - 0.05) / 0.95;
        x *= 1.0 - t * 0.46;
        if (y > 0) y -= t * 0.14;
      }
      // Deep aerodynamic undercut on lower outer flank
      if (isOuter && y < 0) {
        const undercut = 1.0 - Math.abs(y / 0.21) * 0.34;
        x *= undercut;
      }
      // Smooth rounded top shoulder
      if (y > 0) {
        const curve = 1.0 - Math.pow(Math.abs(x) / 0.25, 2) * 0.28;
        y *= curve;
      }
      pos.setXYZ(i, x, y, z);
    }
    podGeom.computeVertexNormals();
    return podGeom;
  };

  const podLeft = new THREE.Mesh(buildSmoothSidepod(false), carPaintMat);
  podLeft.position.set(-0.64, 0.33, 0.12);
  podLeft.castShadow = true;
  root.add(podLeft);

  const podRight = new THREE.Mesh(buildSmoothSidepod(true), carPaintMat);
  podRight.position.set(0.64, 0.33, 0.12);
  podRight.castShadow = true;
  root.add(podRight);

  // Sidepod radiator intake ducts
  const intakeL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.05), matteBlackMat);
  intakeL.position.set(-0.64, 0.36, -0.74);
  root.add(intakeL);
  const intakeR = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.05), matteBlackMat);
  intakeR.position.set(0.64, 0.36, -0.74);
  root.add(intakeR);

  // Sidepod housings (no metallic mirror lenses that render black without envMap)
  if (!isLow) {
    const mirrorGeom = new THREE.BoxGeometry(0.16, 0.08, 0.06);
    const mirrorL = new THREE.Mesh(mirrorGeom, carPaintMat);
    mirrorL.position.set(-0.52, 0.58, -0.42);
    root.add(mirrorL);
    const mirrorR = new THREE.Mesh(mirrorGeom, carPaintMat);
    mirrorR.position.set(0.52, 0.58, -0.42);
    root.add(mirrorR);
  }

  // Ground Effect Venturi Floor & Diffuser
  const floorGeom = new THREE.BoxGeometry(1.92, 0.06, 3.45);
  const floorMesh = new THREE.Mesh(floorGeom, carbonMat);
  floorMesh.position.set(0, 0.12, 0.1);
  floorMesh.receiveShadow = true;
  root.add(floorMesh);

  const diffuserGeom = new THREE.BoxGeometry(1.65, 0.24, 0.75);
  const diffuserMesh = new THREE.Mesh(diffuserGeom, carbonMat);
  diffuserMesh.position.set(0, 0.22, 1.85);
  diffuserMesh.rotation.x = 0.26;
  diffuserMesh.castShadow = true;
  root.add(diffuserMesh);

  // 3. Multi-Element Front Wing & Endplates with 2026 Over-Wheel Wake Deflectors
  const frontWingGeom = new THREE.BoxGeometry(1.92, 0.08, 0.65);
  const frontWingMesh = new THREE.Mesh(frontWingGeom, carbonMat);
  frontWingMesh.position.set(0, 0.18, -2.4);
  frontWingMesh.castShadow = true;
  root.add(frontWingMesh);

  // Front Wing 3-Tier Aerodynamic Cascade Flaps with Team Accent
  for (let f = 1; f <= 3; f++) {
    const cascadeGeom = new THREE.BoxGeometry(1.86 - f * 0.06, 0.035, 0.22 - f * 0.03);
    const cascadeMat = f === 1 ? secondaryPaintMat : (f === 2 ? accentPaintMat : carbonMat);
    const cascadeMesh = new THREE.Mesh(cascadeGeom, cascadeMat);
    cascadeMesh.position.set(0, 0.22 + f * 0.045, -2.4 + f * 0.06);
    cascadeMesh.rotation.x = -0.12 - f * 0.05;
    root.add(cascadeMesh);
  }

  // Front Endplates with Aerodynamic Dive Planes & S-Duct Fins
  const endplateGeom = new THREE.BoxGeometry(0.04, 0.36, 0.76);
  const endL = new THREE.Mesh(endplateGeom, carPaintMat);
  endL.position.set(-0.96, 0.28, -2.4);
  endL.castShadow = true;
  root.add(endL);

  const endR = new THREE.Mesh(endplateGeom, carPaintMat);
  endR.position.set(0.96, 0.28, -2.4);
  endR.castShadow = true;
  root.add(endR);

  // Aerodynamic dive planes on outside of endplates
  const divePlaneGeom = new THREE.BoxGeometry(0.12, 0.02, 0.28);
  const diveL = new THREE.Mesh(divePlaneGeom, carbonMat);
  diveL.position.set(-1.02, 0.32, -2.42);
  diveL.rotation.z = -0.25;
  root.add(diveL);
  const diveR = new THREE.Mesh(divePlaneGeom, carbonMat);
  diveR.position.set(1.02, 0.32, -2.42);
  diveR.rotation.z = 0.25;
  root.add(diveR);

  // Over-Wheel Wake Deflectors (Front Wheel Winglets)
  const deflectorGeom = new THREE.BoxGeometry(0.26, 0.03, 0.32);
  const deflectorL = new THREE.Mesh(deflectorGeom, carbonMat);
  deflectorL.position.set(-0.92, 0.58, -1.35);
  deflectorL.rotation.z = -0.15;
  root.add(deflectorL);

  const deflectorR = new THREE.Mesh(deflectorGeom, carbonMat);
  deflectorR.position.set(0.92, 0.58, -1.35);
  deflectorR.rotation.z = 0.15;
  root.add(deflectorR);

  if (!isLow) {
    // Front Carbon Suspension Wishbones (Upper & Lower Wishbone Struts + Pushrod)
    const wishboneMat = new THREE.MeshStandardMaterial({ color: 0x1e2028, metalness: 0.4, roughness: 0.35 });
    [-1, 1].forEach((side) => {
      const upperWbF = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.54, 6), wishboneMat);
      upperWbF.position.set(side * 0.58, 0.44, -1.35);
      upperWbF.rotation.z = side * 1.35;
      upperWbF.rotation.y = side * 0.22;
      root.add(upperWbF);

      const lowerWb = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.58, 6), wishboneMat);
      lowerWb.position.set(side * 0.60, 0.24, -1.45);
      lowerWb.rotation.z = side * 1.45;
      root.add(lowerWb);
    });
  }

  // 4. Rear Wing with Swan-Neck Pylons & Active DRS Flap
  const wingPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.08), carbonMat);
  wingPillarL.position.set(-0.25, 0.66, 1.7);
  root.add(wingPillarL);
  const wingPillarR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.08), carbonMat);
  wingPillarR.position.set(0.25, 0.66, 1.7);
  root.add(wingPillarR);

  // Beam Wing (lower wing element above diffuser)
  const beamWing = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.22), carbonMat);
  beamWing.position.set(0, 0.42, 1.82);
  root.add(beamWing);

  const rearWingMain = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.08, 0.46), carbonMat);
  rearWingMain.position.set(0, 0.92, 1.75);
  rearWingMain.castShadow = true;
  root.add(rearWingMain);

  // DRS Flap (can open / rotate flat when active)
  const drsFlap = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.05, 0.28), carPaintMat);
  drsFlap.position.set(0, 1.0, 1.7);
  drsFlap.rotation.x = -0.2;
  drsFlap.castShadow = true;
  root.add(drsFlap);

  // DRS Actuator housing pod in center
  const drsActuator = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.22), carbonMat);
  drsActuator.position.set(0, 0.98, 1.68);
  root.add(drsActuator);

  // Rear Wing Endplates
  const rearEndGeom = new THREE.BoxGeometry(0.04, 0.66, 0.68);
  const rearEndL = new THREE.Mesh(rearEndGeom, carPaintMat);
  rearEndL.position.set(-0.84, 0.86, 1.75);
  rearEndL.castShadow = true;
  root.add(rearEndL);

  const rearEndR = new THREE.Mesh(rearEndGeom, carPaintMat);
  rearEndR.position.set(0.84, 0.86, 1.75);
  rearEndR.castShadow = true;
  root.add(rearEndR);

  // 5. Halo Titanium Safety Structure (Smooth high-segment Torus & Pillar)
  const haloBarGeom = new THREE.TorusGeometry(0.38, 0.042, 24, 48, Math.PI);
  haloBarGeom.rotateX(Math.PI / 2);
  haloBarGeom.computeVertexNormals();
  const haloRing = new THREE.Mesh(haloBarGeom, haloMat);
  haloRing.position.set(0, 0.78, -0.15);
  haloRing.castShadow = true;
  root.add(haloRing);

  const haloCenterPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 24), haloMat);
  haloCenterPillar.position.set(0, 0.62, -0.52);
  haloCenterPillar.rotation.x = 0.35;
  haloCenterPillar.castShadow = true;
  root.add(haloCenterPillar);

  // 6. Driver, Helmet & Detailed Steering Wheel
  const driverGroup = new THREE.Group();
  driverGroup.position.set(0, 0.44, -0.05);

  const helmetGeom = new THREE.SphereGeometry(0.18, 32, 24);
  helmetGeom.computeVertexNormals();
  const helmetMesh = new THREE.Mesh(helmetGeom, helmetMat);
  helmetMesh.position.set(0, 0.26, 0);
  helmetMesh.scale.set(0.9, 1.05, 1.15);
  helmetMesh.castShadow = true;
  driverGroup.add(helmetMesh);

  // Visor
  const visorGeom = new THREE.BoxGeometry(0.24, 0.08, 0.12, 4, 2, 2);
  const visorMesh = new THREE.Mesh(visorGeom, visorMat);
  visorMesh.position.set(0, 0.26, -0.16);
  driverGroup.add(visorMesh);

  // Cockpit headrest safety foam & Shoulder Harness Belts
  const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.32, 4, 2, 4), matteBlackMat);
  headrest.position.set(0, 0.22, 0.18);
  driverGroup.add(headrest);

  // 5-Point Racing Harness Straps across driver's shoulders
  const harnessMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.8 });
  const buckleMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.2 });
  [-1, 1].forEach((side) => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.02, 0.28), harnessMat);
    strap.position.set(side * 0.11, 0.14, 0.02);
    strap.rotation.x = 0.28;
    driverGroup.add(strap);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.04), buckleMat);
    buckle.position.set(side * 0.11, 0.14, 0.08);
    driverGroup.add(buckle);
  });

  // F1 Steering Wheel with Digital LCD Screen, Shift LEDs, and Rotary Dials
  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(0, 0.14, -0.45);
  steeringWheel.rotation.x = -0.3;

  const wheelBody = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.04), carbonMat);
  steeringWheel.add(wheelBody);

  const lcdScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.08), new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
  lcdScreen.position.set(0, 0, -0.022);
  lcdScreen.rotation.y = Math.PI;
  steeringWheel.add(lcdScreen);

  // Shift RPM LED strip along top of steering wheel rim (Green, Red, Blue)
  const shiftColors = [0x00ff00, 0x00ff00, 0xff0000, 0xff0000, 0x0066ff];
  for (let s = 0; s < 5; s++) {
    const sx = -0.07 + s * 0.035;
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.015, 0.01),
      new THREE.MeshBasicMaterial({ color: shiftColors[s] })
    );
    led.position.set(sx, 0.072, -0.021);
    steeringWheel.add(led);
  }

  // Rotary dials on steering wheel
  [-0.08, 0.08].forEach((rx) => {
    const dial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.015, 16),
      new THREE.MeshBasicMaterial({ color: 0xffaa00 })
    );
    dial.rotateX(Math.PI / 2);
    dial.position.set(rx, -0.04, -0.022);
    steeringWheel.add(dial);
  });

  driverGroup.add(steeringWheel);
  root.add(driverGroup);

  // 7. Rear Brake Light Cluster (Central FIA Brake Light + Rear Wing Endplate LED Strips)
  // Starts COMPLETELY OFF (dark lens) and ONLY turns on when the car is actively braking!
  const brakeLightHousing = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.12, 0.08),
    carbonMat
  );
  brakeLightHousing.position.set(0, 0.32, 2.02);
  root.add(brakeLightHousing);

  const tailLightMat = new THREE.MeshStandardMaterial({
    color: 0x180205,
    emissive: 0x000000,
    emissiveIntensity: 0,
    roughness: 0.2,
    metalness: 0.3,
  });
  const tailLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.09, 0.03),
    tailLightMat
  );
  tailLight.position.set(0, 0.32, 2.055);
  root.add(tailLight);

  // Dual Rear Wing Endplate Vertical LED Brake Strips (modern F1 specification)
  const wingBrakeStrips: THREE.Mesh[] = [];
  [-0.5, 0.5].forEach((wx) => {
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0x180205,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.2,
      metalness: 0.3,
    });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.28, 0.022), stripMat);
    strip.position.set(wx, 0.88, 2.09);
    root.add(strip);
    wingBrakeStrips.push(strip);
  });

  // Dynamic Rear Brake Diffuser & Asphalt Glow Light (Only active on High/Ultra when braking)
  let brakeGlowLight: THREE.PointLight | null = null;
  if (!isLow) {
    brakeGlowLight = new THREE.PointLight(0xff0018, 0, isUltra ? 4.2 : 2.8, 2.0);
    brakeGlowLight.position.set(0, 0.34, 2.22);
    root.add(brakeGlowLight);
  }

  // Central Titanium Exhaust Pipe - 24 segments
  const exhaustPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 0.18, 24),
    new THREE.MeshStandardMaterial({ color: 0x444450, metalness: 0.95, roughness: 0.2 })
  );
  exhaustPipe.rotateX(Math.PI / 2);
  exhaustPipe.position.set(0, 0.54, 1.88);
  root.add(exhaustPipe);

  // 8. 18-Inch Pirelli Wheels, Smooth Rounded Shoulders, BBS Wheel Covers & Glowing Brake Discs
  const brakeDiscs: THREE.Mesh[] = [];

  function createWheel(isFront: boolean): { wheelGroup: THREE.Group; brakeDisc: THREE.Mesh } {
    const wheelGroup = new THREE.Group();

    const tireRadius = 0.36;
    const tireWidth = isFront ? 0.32 : 0.42;
    const wheelSegs = isLow ? 16 : 36;

    // Tire Rubber
    const tireGeom = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth - 0.03, wheelSegs);
    tireGeom.rotateZ(Math.PI / 2);
    tireGeom.computeVertexNormals();
    const tireMesh = new THREE.Mesh(tireGeom, tireRubberMat);
    wheelGroup.add(tireMesh);

    if (!isLow) {
      // Rounded Tire Shoulders (Torus bevels on inner & outer tread edges)
      const shoulderRadius = 0.024;
      [-(tireWidth / 2 - 0.02), tireWidth / 2 - 0.02].forEach((sx) => {
        const shoulderGeom = new THREE.TorusGeometry(tireRadius - shoulderRadius, shoulderRadius, 10, 28);
        shoulderGeom.rotateY(Math.PI / 2);
        shoulderGeom.computeVertexNormals();
        const shoulderMesh = new THREE.Mesh(shoulderGeom, tireRubberMat);
        shoulderMesh.position.x = sx;
        wheelGroup.add(shoulderMesh);
      });
    }

    // Pirelli Colored Sidewall Ring (Soft Red)
    const ringGeom = new THREE.RingGeometry(tireRadius * 0.72, tireRadius * 0.83, wheelSegs);
    ringGeom.rotateY(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xe10600 });
    const ringOut = new THREE.Mesh(ringGeom, ringMat);
    ringOut.position.x = isFront ? 0.165 : 0.215;
    wheelGroup.add(ringOut);

    // 18-inch Aerodynamic Wheel Rim Cover
    const rimGeom = new THREE.CylinderGeometry(tireRadius * 0.66, tireRadius * 0.66, tireWidth * 0.88, wheelSegs);
    rimGeom.rotateZ(Math.PI / 2);
    rimGeom.computeVertexNormals();
    const rimMesh = new THREE.Mesh(rimGeom, wheelRimMat);
    wheelGroup.add(rimMesh);

    // Glowing Brake Disc behind the rim
    const discGeom = new THREE.CylinderGeometry(0.24, 0.24, 0.06, isLow ? 12 : 24);
    discGeom.rotateZ(Math.PI / 2);
    const discMat = brakeDiscMat.clone();
    const brakeDisc = new THREE.Mesh(discGeom, discMat);
    brakeDisc.position.x = 0;
    wheelGroup.add(brakeDisc);
    brakeDiscs.push(brakeDisc);

    return { wheelGroup, brakeDisc };
  }

  // Wheel placement coordinates (F1 regulations: 3.6m wheelbase, 2.0m track width)
  const trackWidthHalf = 0.94;
  const frontAxleZ = -1.45;
  const rearAxleZ = 1.45;
  const axleY = 0.36;

  // Front Wheels Pivot Group for realistic steering
  const frontWheelsPivot = new THREE.Group();
  frontWheelsPivot.position.set(0, axleY, frontAxleZ);

  const { wheelGroup: flWheel } = createWheel(true);
  flWheel.position.set(-trackWidthHalf, 0, 0);
  frontWheelsPivot.add(flWheel);

  const { wheelGroup: frWheel } = createWheel(true);
  frWheel.position.set(trackWidthHalf, 0, 0);
  frWheel.rotation.y = Math.PI;
  frontWheelsPivot.add(frWheel);

  root.add(frontWheelsPivot);

  // Rear Wheels
  const { wheelGroup: rlWheel } = createWheel(false);
  rlWheel.position.set(-trackWidthHalf, axleY, rearAxleZ);
  root.add(rlWheel);

  const { wheelGroup: rrWheel } = createWheel(false);
  rrWheel.position.set(trackWidthHalf, axleY, rearAxleZ);
  rrWheel.rotation.y = Math.PI;
  root.add(rrWheel);

  // 9. Titanium Skid-Block Sparks System
  const sparkCount = 45;
  const sparkGeom = new THREE.BufferGeometry();
  const sparkPositions = new Float32Array(sparkCount * 3);
  const sparkVelocities: THREE.Vector3[] = [];
  const sparkLifetimes = new Float32Array(sparkCount);

  for (let i = 0; i < sparkCount; i++) {
    sparkPositions[i * 3] = 0;
    sparkPositions[i * 3 + 1] = -100; // start hidden
    sparkPositions[i * 3 + 2] = 0;
    sparkVelocities.push(new THREE.Vector3());
    sparkLifetimes[i] = 0;
  }

  sparkGeom.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));

  const sparkMat = new THREE.PointsMaterial({
    color: 0xffaa00,
    size: 0.16,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
  });

  const sparksPoints = new THREE.Points(sparkGeom, sparkMat);
  root.add(sparksPoints);

  // Animation & Control Methods
  let wheelRotX = 0;

  const setWheelSpin = (speedKmh: number, delta: number) => {
    const speedMs = speedKmh / 3.6;
    const rotSpeed = speedMs / 0.36;
    wheelRotX += rotSpeed * delta;

    flWheel.children[0].rotation.x = wheelRotX;
    frWheel.children[0].rotation.x = -wheelRotX;
    rlWheel.children[0].rotation.x = wheelRotX;
    rrWheel.children[0].rotation.x = -wheelRotX;
  };

  const setSteerAngle = (steerRad: number) => {
    frontWheelsPivot.rotation.y = steerRad;
    steeringWheel.rotation.z = -steerRad * 2.5;
  };

  const setDrsActive = (active: boolean) => {
    // DRS flap rotates down to horizontal
    drsFlap.rotation.x = active ? 0.35 : -0.2;
    drsFlap.position.y = active ? 1.05 : 1.0;
  };

  const setBraking = (braking: boolean) => {
    // 1. Rear Brake Light & Rear Wing Endplate LED Strips: ONLY turn on when braking!
    const tlMat = tailLight.material as THREE.MeshStandardMaterial;
    if (braking) {
      tlMat.color.setHex(0xff0818);
      tlMat.emissive.setHex(0xff0015);
      tlMat.emissiveIntensity = isUltra ? 4.5 : 2.8;
    } else {
      tlMat.color.setHex(0x180205);
      tlMat.emissive.setHex(0x000000);
      tlMat.emissiveIntensity = 0;
    }

    for (const strip of wingBrakeStrips) {
      const sMat = strip.material as THREE.MeshStandardMaterial;
      if (braking) {
        sMat.color.setHex(0xff0818);
        sMat.emissive.setHex(0xff0015);
        sMat.emissiveIntensity = isUltra ? 4.0 : 2.4;
      } else {
        sMat.color.setHex(0x180205);
        sMat.emissive.setHex(0x000000);
        sMat.emissiveIntensity = 0;
      }
    }

    if (brakeGlowLight) {
      brakeGlowLight.intensity = braking ? (isUltra ? 2.6 : 1.4) : 0;
    }

    // 2. Glowing Carbon-Ceramic Brake Discs inside the wheels
    for (const disc of brakeDiscs) {
      const mat = disc.material as THREE.MeshStandardMaterial;
      if (braking) {
        mat.emissive.setHex(0xff3300);
        mat.emissiveIntensity = isUltra ? 3.2 : 2.4;
      } else {
        mat.emissiveIntensity = Math.max(0, mat.emissiveIntensity - 0.12);
      }
    }
  };

  // Kept for interface compatibility; brake light is now strictly controlled by setBraking(braking)
  const flashTailLight = (_time: number) => {};

  const updateSparks = (speedKmh: number, onCurb: boolean, delta: number) => {
    const positions = sparkGeom.attributes.position.array as Float32Array;
    const shouldSpark = speedKmh > 240 || (onCurb && speedKmh > 120);

    for (let i = 0; i < sparkCount; i++) {
      if (sparkLifetimes[i] > 0) {
        sparkLifetimes[i] -= delta;
        positions[i * 3] += sparkVelocities[i].x * delta;
        positions[i * 3 + 1] += sparkVelocities[i].y * delta;
        positions[i * 3 + 2] += sparkVelocities[i].z * delta;

        if (sparkLifetimes[i] <= 0) {
          positions[i * 3 + 1] = -100;
        }
      } else if (shouldSpark && Math.random() < 0.25) {
        sparkLifetimes[i] = 0.15 + Math.random() * 0.2;
        positions[i * 3] = (Math.random() - 0.5) * 0.45;
        positions[i * 3 + 1] = 0.1;
        positions[i * 3 + 2] = 0.6 + Math.random() * 0.8;

        sparkVelocities[i].set(
          (Math.random() - 0.5) * 4.0,
          Math.random() * 2.2,
          5.0 + Math.random() * 8.0
        );
      }
    }
    sparkGeom.attributes.position.needsUpdate = true;
  };

  // No floating dark 3D overhead sprites on cars so nothing ever blocks the camera view (HUD Timing Tower + Radar show all positions cleanly)
  const setPositionTag = (_pos: number, _name: string, _isTeammate?: boolean, _isPlayer?: boolean) => {};

  return {
    root,
    bodyMesh: cockpitMesh,
    frontLeftWheel: flWheel,
    frontRightWheel: frWheel,
    rearLeftWheel: rlWheel,
    rearRightWheel: rrWheel,
    frontWheelsPivot,
    drsFlap,
    tailLight,
    brakeDiscs,
    steeringWheel,
    sparksPoints,
    setWheelSpin,
    setSteerAngle,
    setDrsActive,
    setBraking,
    flashTailLight,
    updateSparks,
    setPositionTag,
  };
}
