import * as THREE from 'three';
import { Team, Driver } from '../types/racing';

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

export function buildF1Car(team: Team, driver?: Driver): BuiltCar {
  const root = new THREE.Group();

  // 1. High-Fidelity Materials with Metallic Flake & Gloss Clearcoat
  const primaryColor = new THREE.Color(team.primaryColor || '#E80020');
  const secondaryColor = new THREE.Color(team.secondaryColor || '#1A1A1A');
  const accentColor = new THREE.Color(team.accentColor || '#FFFFFF');

  const carPaintMat = new THREE.MeshPhysicalMaterial({
    color: primaryColor,
    metalness: 0.88,
    roughness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    reflectivity: 0.95,
  });

  const secondaryPaintMat = new THREE.MeshPhysicalMaterial({
    color: secondaryColor,
    metalness: 0.82,
    roughness: 0.16,
    clearcoat: 0.95,
    clearcoatRoughness: 0.05,
  });

  const accentPaintMat = new THREE.MeshPhysicalMaterial({
    color: accentColor,
    metalness: 0.75,
    roughness: 0.18,
    clearcoat: 1.0,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x111114,
    metalness: 0.55,
    roughness: 0.4,
  });

  const matteBlackMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0c,
    roughness: 0.85,
  });

  const tireRubberMat = new THREE.MeshStandardMaterial({
    color: 0x18181c,
    roughness: 0.92,
    metalness: 0.04,
  });

  const wheelRimMat = new THREE.MeshStandardMaterial({
    color: 0x24242a,
    metalness: 0.95,
    roughness: 0.18,
  });

  const brakeDiscMat = new THREE.MeshStandardMaterial({
    color: 0x333338,
    metalness: 0.95,
    roughness: 0.25,
    emissive: 0x000000,
    emissiveIntensity: 0,
  });

  const haloMat = new THREE.MeshStandardMaterial({
    color: 0x141418,
    metalness: 0.88,
    roughness: 0.2,
  });

  const helmetColor = driver?.color ? new THREE.Color(driver.color) : accentColor;
  const helmetMat = new THREE.MeshPhysicalMaterial({
    color: helmetColor,
    metalness: 0.65,
    roughness: 0.14,
    clearcoat: 1.0,
  });

  const visorMat = new THREE.MeshPhysicalMaterial({
    color: 0x08080f,
    metalness: 0.98,
    roughness: 0.03,
    reflectivity: 1.0,
    clearcoat: 1.0,
  });

  // 2. Main Monocoque & Sleek 2026 Aerodynamic Nose
  // Tapered Nose Cone (front extends in -Z)
  const noseGeom = new THREE.CylinderGeometry(0.18, 0.52, 2.45, 18);
  noseGeom.rotateX(Math.PI / 2);
  const noseMesh = new THREE.Mesh(noseGeom, carPaintMat);
  noseMesh.position.set(0, 0.33, -1.35);
  noseMesh.scale.set(0.92, 0.82, 1.0);
  noseMesh.castShadow = true;
  root.add(noseMesh);

  // Aerodynamic nose tip cone
  const noseTip = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.35, 16), secondaryPaintMat);
  noseTip.rotateX(-Math.PI / 2);
  noseTip.position.set(0, 0.32, -2.62);
  noseTip.castShadow = true;
  root.add(noseTip);

  // Cockpit area & Engine cover
  const cockpitGeom = new THREE.BoxGeometry(0.82, 0.54, 1.95);
  const cockpitMesh = new THREE.Mesh(cockpitGeom, carPaintMat);
  cockpitMesh.position.set(0, 0.44, 0.1);
  cockpitMesh.castShadow = true;
  root.add(cockpitMesh);

  // Overhead Airbox / Engine Intake with realistic triangular duct
  const airboxGeom = new THREE.BoxGeometry(0.42, 0.34, 0.85);
  const airbox = new THREE.Mesh(airboxGeom, carPaintMat);
  airbox.position.set(0, 0.78, 0.25);
  airbox.castShadow = true;
  root.add(airbox);

  const intakeHole = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.08), matteBlackMat);
  intakeHole.position.set(0, 0.82, -0.18);
  root.add(intakeHole);

  // FIA T-Cam on top of roll-hoop
  const tCamBar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.06), secondaryPaintMat);
  tCamBar.position.set(0, 0.98, 0.08);
  root.add(tCamBar);

  // Shark Fin along engine spine
  const finGeom = new THREE.BoxGeometry(0.04, 0.48, 1.55);
  const finMesh = new THREE.Mesh(finGeom, secondaryPaintMat);
  finMesh.position.set(0, 0.82, 0.65);
  finMesh.castShadow = true;
  root.add(finMesh);

  // Sculpted Sidepods with Ground-Effect Undercut
  const sidepodGeom = new THREE.BoxGeometry(0.48, 0.40, 1.65);
  const podLeft = new THREE.Mesh(sidepodGeom, carPaintMat);
  podLeft.position.set(-0.64, 0.33, 0.12);
  podLeft.castShadow = true;
  root.add(podLeft);

  const podRight = new THREE.Mesh(sidepodGeom, carPaintMat);
  podRight.position.set(0.64, 0.33, 0.12);
  podRight.castShadow = true;
  root.add(podRight);

  // Sidepod radiator intake ducts
  const intakeL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.05), matteBlackMat);
  intakeL.position.set(-0.64, 0.36, -0.71);
  root.add(intakeL);
  const intakeR = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.05), matteBlackMat);
  intakeR.position.set(0.64, 0.36, -0.71);
  root.add(intakeR);

  // Rear view mirrors
  const mirrorGeom = new THREE.BoxGeometry(0.16, 0.08, 0.06);
  const mirrorL = new THREE.Mesh(mirrorGeom, carPaintMat);
  mirrorL.position.set(-0.52, 0.58, -0.42);
  root.add(mirrorL);
  const mirrorR = new THREE.Mesh(mirrorGeom, carPaintMat);
  mirrorR.position.set(0.52, 0.58, -0.42);
  root.add(mirrorR);

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

  // Front Wing Upper Flap with Team Accent
  const flapGeom = new THREE.BoxGeometry(1.84, 0.05, 0.26);
  const flapMesh = new THREE.Mesh(flapGeom, secondaryPaintMat);
  flapMesh.position.set(0, 0.25, -2.35);
  flapMesh.rotation.x = -0.15;
  root.add(flapMesh);

  // Front Endplates with Aerodynamic Dive Planes
  const endplateGeom = new THREE.BoxGeometry(0.04, 0.32, 0.74);
  const endL = new THREE.Mesh(endplateGeom, carPaintMat);
  endL.position.set(-0.96, 0.26, -2.4);
  endL.castShadow = true;
  root.add(endL);

  const endR = new THREE.Mesh(endplateGeom, carPaintMat);
  endR.position.set(0.96, 0.26, -2.4);
  endR.castShadow = true;
  root.add(endR);

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

  // 5. Halo Titanium Safety Structure
  const haloBarGeom = new THREE.TorusGeometry(0.38, 0.045, 8, 24, Math.PI);
  haloBarGeom.rotateX(Math.PI / 2);
  const haloRing = new THREE.Mesh(haloBarGeom, haloMat);
  haloRing.position.set(0, 0.78, -0.15);
  haloRing.castShadow = true;
  root.add(haloRing);

  const haloCenterPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 10), haloMat);
  haloCenterPillar.position.set(0, 0.62, -0.52);
  haloCenterPillar.rotation.x = 0.35;
  haloCenterPillar.castShadow = true;
  root.add(haloCenterPillar);

  // 6. Driver, Helmet & Detailed Steering Wheel
  const driverGroup = new THREE.Group();
  driverGroup.position.set(0, 0.44, -0.05);

  const helmetGeom = new THREE.SphereGeometry(0.18, 18, 18);
  const helmetMesh = new THREE.Mesh(helmetGeom, helmetMat);
  helmetMesh.position.set(0, 0.26, 0);
  helmetMesh.scale.set(0.9, 1.05, 1.15);
  helmetMesh.castShadow = true;
  driverGroup.add(helmetMesh);

  // Visor
  const visorGeom = new THREE.BoxGeometry(0.24, 0.08, 0.12);
  const visorMesh = new THREE.Mesh(visorGeom, visorMat);
  visorMesh.position.set(0, 0.26, -0.16);
  driverGroup.add(visorMesh);

  // Cockpit headrest safety foam
  const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.32), matteBlackMat);
  headrest.position.set(0, 0.22, 0.18);
  driverGroup.add(headrest);

  // F1 Steering Wheel with Digital LCD Screen
  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(0, 0.14, -0.45);
  steeringWheel.rotation.x = -0.3;

  const wheelBody = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.04), carbonMat);
  steeringWheel.add(wheelBody);

  const lcdScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.08), new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
  lcdScreen.position.set(0, 0, -0.022);
  lcdScreen.rotation.y = Math.PI;
  steeringWheel.add(lcdScreen);

  driverGroup.add(steeringWheel);
  root.add(driverGroup);

  // 7. Flashing Rain / Safety Rear Tail Light & Exhaust
  const tailLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.1, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  );
  tailLight.position.set(0, 0.32, 2.05);
  root.add(tailLight);

  // Central Titanium Exhaust Pipe
  const exhaustPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 0.18, 12),
    new THREE.MeshStandardMaterial({ color: 0x444450, metalness: 0.95, roughness: 0.2 })
  );
  exhaustPipe.rotateX(Math.PI / 2);
  exhaustPipe.position.set(0, 0.54, 1.88);
  root.add(exhaustPipe);

  // 8. 18-Inch Pirelli Wheels, BBS Wheel Covers & Glowing Brake Discs
  const brakeDiscs: THREE.Mesh[] = [];

  function createWheel(isFront: boolean): { wheelGroup: THREE.Group; brakeDisc: THREE.Mesh } {
    const wheelGroup = new THREE.Group();

    const tireRadius = 0.36;
    const tireWidth = isFront ? 0.32 : 0.42;

    // Tire Rubber
    const tireGeom = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 24);
    tireGeom.rotateZ(Math.PI / 2);
    const tireMesh = new THREE.Mesh(tireGeom, tireRubberMat);
    tireMesh.castShadow = true;
    wheelGroup.add(tireMesh);

    // Pirelli Colored Sidewall Ring (Soft Red)
    const ringGeom = new THREE.RingGeometry(tireRadius * 0.72, tireRadius * 0.82, 24);
    ringGeom.rotateY(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xe10600 });
    const ringOut = new THREE.Mesh(ringGeom, ringMat);
    ringOut.position.x = isFront ? 0.165 : 0.215;
    wheelGroup.add(ringOut);

    // 18-inch Aerodynamic Wheel Rim Cover
    const rimGeom = new THREE.CylinderGeometry(tireRadius * 0.66, tireRadius * 0.66, tireWidth * 0.88, 16);
    rimGeom.rotateZ(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimGeom, wheelRimMat);
    wheelGroup.add(rimMesh);

    // BBS Spoke design ring
    const spokeGeom = new THREE.RingGeometry(0.08, tireRadius * 0.64, 12);
    spokeGeom.rotateY(Math.PI / 2);
    const spokeMesh = new THREE.Mesh(spokeGeom, carbonMat);
    spokeMesh.position.x = isFront ? 0.162 : 0.212;
    wheelGroup.add(spokeMesh);

    // Central Wheel Lock Nut (Team colored)
    const nutGeom = new THREE.CylinderGeometry(0.05, 0.05, tireWidth + 0.04, 12);
    nutGeom.rotateZ(Math.PI / 2);
    const nutMesh = new THREE.Mesh(nutGeom, new THREE.MeshStandardMaterial({ color: 0xcc1111, metalness: 0.9 }));
    wheelGroup.add(nutMesh);

    // Glowing Brake Disc behind the rim
    const discGeom = new THREE.CylinderGeometry(0.24, 0.24, 0.06, 16);
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
    for (const disc of brakeDiscs) {
      const mat = disc.material as THREE.MeshStandardMaterial;
      if (braking) {
        mat.emissive.setHex(0xff3300);
        mat.emissiveIntensity = 2.4;
      } else {
        mat.emissiveIntensity = Math.max(0, mat.emissiveIntensity - 0.08);
      }
    }
  };

  const flashTailLight = (time: number) => {
    const flash = Math.sin(time * 16) > 0;
    const mat = tailLight.material as THREE.MeshBasicMaterial;
    mat.color.setHex(flash ? 0xff0000 : 0x220000);
  };

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

  // 3D In-World Broadcast Overhead Halo Position Tag
  const tagCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (tagCanvas) {
    tagCanvas.width = 256;
    tagCanvas.height = 72;
  }
  const tagTexture = tagCanvas ? new THREE.CanvasTexture(tagCanvas) : null;
  const tagMat = new THREE.SpriteMaterial({
    map: tagTexture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const tagSprite = new THREE.Sprite(tagMat);
  tagSprite.position.set(0, 1.85, -0.2);
  tagSprite.scale.set(2.4, 0.68, 1);
  root.add(tagSprite);

  let lastTagPos = -1;
  let lastTagName = '';
  let lastTagTeam = false;
  let lastTagPlayer = false;

  const setPositionTag = (pos: number, name: string, isTeammate?: boolean, isPlayer?: boolean) => {
    if (!tagCanvas || !tagTexture) return;
    if (pos === lastTagPos && name === lastTagName && isTeammate === lastTagTeam && isPlayer === lastTagPlayer) {
      return;
    }
    lastTagPos = pos;
    lastTagName = name;
    lastTagTeam = !!isTeammate;
    lastTagPlayer = !!isPlayer;

    const ctx = tagCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 256, 72);

    // Pill background
    const bgGrad = ctx.createLinearGradient(0, 0, 256, 0);
    bgGrad.addColorStop(0, 'rgba(8, 12, 22, 0.92)');
    bgGrad.addColorStop(1, 'rgba(15, 23, 42, 0.90)');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(4, 6, 248, 60, 16);
    ctx.fill();

    // Border styling
    let borderColor = team.primaryColor || '#00e5ff';
    let posBgColor = '#1e293b';
    let posTextColor = '#ffffff';

    if (pos === 1) {
      borderColor = '#fbbf24';
      posBgColor = '#d97706';
      posTextColor = '#ffffff';
    } else if (pos === 2) {
      borderColor = '#cbd5e1';
      posBgColor = '#64748b';
      posTextColor = '#ffffff';
    } else if (pos === 3) {
      borderColor = '#f97316';
      posBgColor = '#b45309';
      posTextColor = '#ffffff';
    } else if (isPlayer) {
      borderColor = '#38bdf8';
      posBgColor = '#0284c7';
    } else if (isTeammate) {
      borderColor = '#10b981';
      posBgColor = '#059669';
    }

    ctx.lineWidth = 3;
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    // Position Badge Box
    ctx.fillStyle = posBgColor;
    ctx.beginPath();
    ctx.roundRect(10, 12, 62, 48, 10);
    ctx.fill();

    ctx.fillStyle = posTextColor;
    ctx.font = '900 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`P${pos}`, 41, 36);

    // Team Accent Bar
    ctx.fillStyle = team.primaryColor || '#ef4444';
    ctx.fillRect(78, 16, 4, 40);

    // Driver Name & Role
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px sans-serif';
    const cleanName = (name || driver?.shortName || 'DRV').toUpperCase().slice(0, 4);
    ctx.fillText(cleanName, 90, 36);

    // Subtag for YOU or TEAM
    if (isPlayer) {
      ctx.fillStyle = '#38bdf8';
      ctx.font = '800 13px sans-serif';
      ctx.fillText('YOU', 175, 36);
    } else if (isTeammate) {
      ctx.fillStyle = '#10b981';
      ctx.font = '800 13px sans-serif';
      ctx.fillText('TEAM', 165, 36);
    }

    tagTexture.needsUpdate = true;
  };

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
