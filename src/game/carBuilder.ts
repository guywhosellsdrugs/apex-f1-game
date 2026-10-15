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
}

export function buildF1Car(team: Team, driver?: Driver): BuiltCar {
  const root = new THREE.Group();

  // 1. High-Fidelity Materials with Metallic Flake & Gloss Clearcoat
  const primaryColor = new THREE.Color(team.primaryColor);
  const secondaryColor = new THREE.Color(team.secondaryColor);
  const accentColor = new THREE.Color(team.accentColor);

  const carPaintMat = new THREE.MeshPhysicalMaterial({
    color: primaryColor,
    metalness: 0.85,
    roughness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    reflectivity: 0.95,
  });

  const secondaryPaintMat = new THREE.MeshPhysicalMaterial({
    color: secondaryColor,
    metalness: 0.78,
    roughness: 0.16,
    clearcoat: 0.95,
    clearcoatRoughness: 0.05,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x111114,
    metalness: 0.5,
    roughness: 0.45,
  });

  const tireRubberMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.92,
    metalness: 0.05,
  });

  const wheelRimMat = new THREE.MeshStandardMaterial({
    color: 0x222228,
    metalness: 0.95,
    roughness: 0.15,
  });

  const brakeDiscMat = new THREE.MeshStandardMaterial({
    color: 0x333338,
    metalness: 0.95,
    roughness: 0.25,
    emissive: 0x000000,
    emissiveIntensity: 0,
  });

  const haloMat = new THREE.MeshStandardMaterial({
    color: 0x121215,
    metalness: 0.88,
    roughness: 0.2,
  });

  const helmetColor = driver?.color ? new THREE.Color(driver.color) : accentColor;
  const helmetMat = new THREE.MeshPhysicalMaterial({
    color: helmetColor,
    metalness: 0.6,
    roughness: 0.15,
    clearcoat: 1.0,
  });

  const visorMat = new THREE.MeshPhysicalMaterial({
    color: 0x050508,
    metalness: 0.95,
    roughness: 0.05,
    reflectivity: 1.0,
    clearcoat: 1.0,
  });

  // 2. Main Monocoque & Sleek 2026 Aerodynamic Nose
  // Nose Cone (front extends in -Z)
  const noseGeom = new THREE.CylinderGeometry(0.24, 0.54, 2.4, 18);
  noseGeom.rotateX(Math.PI / 2);
  const noseMesh = new THREE.Mesh(noseGeom, carPaintMat);
  noseMesh.position.set(0, 0.34, -1.35);
  noseMesh.castShadow = true;
  root.add(noseMesh);

  // Cockpit area & Engine cover
  const cockpitGeom = new THREE.BoxGeometry(0.84, 0.56, 1.9);
  const cockpitMesh = new THREE.Mesh(cockpitGeom, carPaintMat);
  cockpitMesh.position.set(0, 0.46, 0.1);
  cockpitMesh.castShadow = true;
  root.add(cockpitMesh);

  // Shark Fin along engine spine
  const finGeom = new THREE.BoxGeometry(0.04, 0.48, 1.5);
  const finMesh = new THREE.Mesh(finGeom, secondaryPaintMat);
  finMesh.position.set(0, 0.82, 0.65);
  finMesh.castShadow = true;
  root.add(finMesh);

  // Sculpted Sidepods with Ground-Effect Undercut
  const sidepodGeom = new THREE.BoxGeometry(0.48, 0.42, 1.6);
  const podLeft = new THREE.Mesh(sidepodGeom, carPaintMat);
  podLeft.position.set(-0.64, 0.34, 0.1);
  podLeft.castShadow = true;
  root.add(podLeft);

  const podRight = new THREE.Mesh(sidepodGeom, carPaintMat);
  podRight.position.set(0.64, 0.34, 0.1);
  podRight.castShadow = true;
  root.add(podRight);

  // Ground Effect Venturi Floor & Diffuser
  const floorGeom = new THREE.BoxGeometry(1.92, 0.06, 3.4);
  const floorMesh = new THREE.Mesh(floorGeom, carbonMat);
  floorMesh.position.set(0, 0.12, 0.1);
  floorMesh.receiveShadow = true;
  root.add(floorMesh);

  const diffuserGeom = new THREE.BoxGeometry(1.6, 0.22, 0.7);
  const diffuserMesh = new THREE.Mesh(diffuserGeom, carbonMat);
  diffuserMesh.position.set(0, 0.22, 1.85);
  diffuserMesh.rotation.x = 0.25;
  diffuserMesh.castShadow = true;
  root.add(diffuserMesh);

  // 3. Multi-Element Front Wing & Endplates
  const frontWingGeom = new THREE.BoxGeometry(1.88, 0.08, 0.6);
  const frontWingMesh = new THREE.Mesh(frontWingGeom, carbonMat);
  frontWingMesh.position.set(0, 0.18, -2.4);
  frontWingMesh.castShadow = true;
  root.add(frontWingMesh);

  // Front Wing Upper Flap with Team Accent
  const flapGeom = new THREE.BoxGeometry(1.8, 0.05, 0.25);
  const flapMesh = new THREE.Mesh(flapGeom, secondaryPaintMat);
  flapMesh.position.set(0, 0.26, -2.35);
  flapMesh.rotation.x = -0.15;
  root.add(flapMesh);

  // Front Endplates
  const endplateGeom = new THREE.BoxGeometry(0.04, 0.32, 0.72);
  const endL = new THREE.Mesh(endplateGeom, carPaintMat);
  endL.position.set(-0.94, 0.26, -2.4);
  endL.castShadow = true;
  root.add(endL);

  const endR = new THREE.Mesh(endplateGeom, carPaintMat);
  endR.position.set(0.94, 0.26, -2.4);
  endR.castShadow = true;
  root.add(endR);

  // 4. Rear Wing with Active DRS Flap
  const wingPillars = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), carbonMat);
  wingPillars.position.set(-0.25, 0.65, 1.7);
  root.add(wingPillars);
  const wingPillarR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), carbonMat);
  wingPillarR.position.set(0.25, 0.65, 1.7);
  root.add(wingPillarR);

  const rearWingMain = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.08, 0.45), carbonMat);
  rearWingMain.position.set(0, 0.9, 1.75);
  rearWingMain.castShadow = true;
  root.add(rearWingMain);

  // DRS Flap (can open / rotate flat when active)
  const drsFlap = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.28), carPaintMat);
  drsFlap.position.set(0, 0.98, 1.7);
  drsFlap.rotation.x = -0.2;
  drsFlap.castShadow = true;
  root.add(drsFlap);

  // Rear Wing Endplates
  const rearEndGeom = new THREE.BoxGeometry(0.04, 0.65, 0.65);
  const rearEndL = new THREE.Mesh(rearEndGeom, carPaintMat);
  rearEndL.position.set(-0.83, 0.85, 1.75);
  rearEndL.castShadow = true;
  root.add(rearEndL);

  const rearEndR = new THREE.Mesh(rearEndGeom, carPaintMat);
  rearEndR.position.set(0.83, 0.85, 1.75);
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

  // 6. Driver & Helmet & Steering Wheel
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

  // F1 Steering Wheel with Digital Screen
  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(0, 0.14, -0.45);
  steeringWheel.rotation.x = -0.3;

  const wheelBody = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.04), carbonMat);
  steeringWheel.add(wheelBody);

  const lcdScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.07), new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
  lcdScreen.position.set(0, 0, -0.022);
  lcdScreen.rotation.y = Math.PI;
  steeringWheel.add(lcdScreen);

  driverGroup.add(steeringWheel);
  root.add(driverGroup);

  // 7. Flashing Rain / Safety Rear Tail Light
  const tailLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.1, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  );
  tailLight.position.set(0, 0.32, 2.05);
  root.add(tailLight);

  // 8. 18-Inch Pirelli Wheels & Glowing Brake Discs
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

    // Rim Hub
    const rimGeom = new THREE.CylinderGeometry(tireRadius * 0.65, tireRadius * 0.65, tireWidth * 0.88, 16);
    rimGeom.rotateZ(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimGeom, wheelRimMat);
    wheelGroup.add(rimMesh);

    // Central Wheel Lock Nut
    const nutGeom = new THREE.CylinderGeometry(0.05, 0.05, tireWidth + 0.04, 12);
    nutGeom.rotateZ(Math.PI / 2);
    const nutMesh = new THREE.Mesh(nutGeom, new THREE.MeshStandardMaterial({ color: 0x990000, metalness: 0.9 }));
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

  // Front Wheels Pivot (for steering angle)
  const frontWheelsPivot = new THREE.Group();
  frontWheelsPivot.position.set(0, 0.36, -1.75);
  root.add(frontWheelsPivot);

  const frontTrackHalf = 0.96;
  const rearTrackHalf = 0.98;

  const { wheelGroup: frontLeftWheel } = createWheel(true);
  frontLeftWheel.position.set(-frontTrackHalf, 0, 0);
  frontWheelsPivot.add(frontLeftWheel);

  const { wheelGroup: frontRightWheel } = createWheel(true);
  frontRightWheel.position.set(frontTrackHalf, 0, 0);
  frontWheelsPivot.add(frontRightWheel);

  // Rear Wheels
  const { wheelGroup: rearLeftWheel } = createWheel(false);
  rearLeftWheel.position.set(-rearTrackHalf, 0.36, 1.55);
  root.add(rearLeftWheel);

  const { wheelGroup: rearRightWheel } = createWheel(false);
  rearRightWheel.position.set(rearTrackHalf, 0.36, 1.55);
  root.add(rearRightWheel);

  // 9. Titanium Sparks Particle System
  const sparkCount = 45;
  const sparkGeom = new THREE.BufferGeometry();
  const sparkPositions = new Float32Array(sparkCount * 3);
  for (let i = 0; i < sparkCount * 3; i++) {
    sparkPositions[i] = 0;
  }
  sparkGeom.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));

  const sparkMat = new THREE.PointsMaterial({
    color: 0xffe680,
    size: 0.18,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
  });

  const sparksPoints = new THREE.Points(sparkGeom, sparkMat);
  sparksPoints.position.set(0, 0.08, 1.9);
  root.add(sparksPoints);

  // Spark velocity vectors for physics simulation
  const sparkVelocities: THREE.Vector3[] = [];
  for (let i = 0; i < sparkCount; i++) {
    sparkVelocities.push(new THREE.Vector3());
  }

  // 10. Dynamic Controllers
  const setWheelSpin = (speedKmh: number, delta: number) => {
    const radPerSec = (speedKmh / 3.6) / 0.36;
    const spinDelta = radPerSec * delta;
    frontLeftWheel.rotation.x += spinDelta;
    frontRightWheel.rotation.x += spinDelta;
    rearLeftWheel.rotation.x += spinDelta;
    rearRightWheel.rotation.x += spinDelta;
  };

  const setSteerAngle = (steerRad: number) => {
    frontWheelsPivot.rotation.y = steerRad;
    steeringWheel.rotation.z = -steerRad * 2.8;
  };

  const setDrsActive = (active: boolean) => {
    drsFlap.rotation.x = active ? 0.05 : -0.2;
    drsFlap.position.y = active ? 1.05 : 0.98;
  };

  const setBraking = (braking: boolean) => {
    for (const disc of brakeDiscs) {
      const mat = disc.material as THREE.MeshStandardMaterial;
      if (braking) {
        mat.emissive.setHex(0xff4400);
        mat.emissiveIntensity = 2.4;
      } else {
        mat.emissiveIntensity = Math.max(0, mat.emissiveIntensity - 0.12);
      }
    }
  };

  const flashTailLight = (time: number) => {
    const isFlashing = Math.sin(time * 16) > 0;
    (tailLight.material as THREE.MeshBasicMaterial).color.setHex(isFlashing ? 0xff0000 : 0x440000);
  };

  const updateSparks = (speedKmh: number, onCurb: boolean, delta: number) => {
    const isSparking = (speedKmh > 275 && Math.random() > 0.45) || (onCurb && speedKmh > 70);
    const posAttr = sparkGeom.getAttribute('position') as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;

    if (isSparking) {
      sparkMat.opacity = Math.min(1.0, sparkMat.opacity + 0.3);
      for (let i = 0; i < sparkCount; i++) {
        if (Math.random() > 0.6) {
          const idx = i * 3;
          array[idx] = (Math.random() - 0.5) * 0.7;
          array[idx + 1] = 0.02 + Math.random() * 0.08;
          array[idx + 2] = 0;
          sparkVelocities[i].set(
            (Math.random() - 0.5) * 3.5,
            Math.random() * 2.5 + 0.8,
            Math.random() * 12 + 8
          );
        }
      }
    } else {
      sparkMat.opacity = Math.max(0, sparkMat.opacity - delta * 4);
    }

    for (let i = 0; i < sparkCount; i++) {
      const idx = i * 3;
      array[idx] += sparkVelocities[i].x * delta;
      array[idx + 1] += sparkVelocities[i].y * delta;
      array[idx + 2] += sparkVelocities[i].z * delta;
      sparkVelocities[i].y -= 9.8 * delta; // Gravity
    }
    posAttr.needsUpdate = true;
  };

  return {
    root,
    bodyMesh: cockpitMesh,
    frontLeftWheel,
    frontRightWheel,
    rearLeftWheel,
    rearRightWheel,
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
  };
}
