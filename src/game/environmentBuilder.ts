import * as THREE from 'three';
import { CircuitInfo } from '../types/racing';

/**
 * Builds authentic, circuit-specific photorealistic 3D scenery, architecture, and landmarks.
 * GUARANTEED ZERO TRACK ENCROACHMENT:
 * All structures, buildings, wings, grandstands, and towers strictly respect isClearOfTrack
 * with a generous safety margin. Any overhead bridge or canopy provides 15m+ unobstructed
 * vertical air clearance, ensuring the track surface and racing corridor are 100% clean.
 */
export function buildCircuitScenery(
  circuit: CircuitInfo,
  curve: THREE.CatmullRomCurve3,
  isClearOfTrack: (pos: THREE.Vector3, minSafeRadius?: number) => boolean,
  group: THREE.Group
): void {
  if (circuit.id === 'abudhabi') {
    buildYasMarinaEnvironment(curve, isClearOfTrack, group);
  } else if (circuit.id === 'monaco') {
    buildMonacoEnvironment(curve, isClearOfTrack, group);
  } else if (circuit.id === 'spa') {
    buildSpaEnvironment(curve, isClearOfTrack, group);
  } else if (circuit.id === 'monza') {
    buildMonzaEnvironment(curve, isClearOfTrack, group);
  } else if (circuit.id === 'silverstone') {
    buildSilverstoneEnvironment(curve, isClearOfTrack, group);
  } else if (circuit.id === 'suzuka') {
    buildSuzukaEnvironment(curve, isClearOfTrack, group);
  } else if (circuit.id === 'miami') {
    buildMiamiEnvironment(curve, isClearOfTrack, group);
  } else if (circuit.id === 'jeddah') {
    buildJeddahEnvironment(curve, isClearOfTrack, group);
  } else if (circuit.id === 'melbourne') {
    buildMelbourneEnvironment(curve, isClearOfTrack, group);
  } else if (circuit.id === 'bahrain') {
    buildBahrainEnvironment(curve, isClearOfTrack, group);
  } else {
    buildDefaultEnvironment(circuit, curve, isClearOfTrack, group);
  }
}

// ==========================================
// ABU DHABI: YAS MARINA & W HOTEL COMPLEX
// ==========================================
function buildYasMarinaEnvironment(
  curve: THREE.CatmullRomCurve3,
  isClearOfTrack: (pos: THREE.Vector3, minSafeRadius?: number) => boolean,
  group: THREE.Group
) {
  const up = new THREE.Vector3(0, 1, 0);

  // 1. The Iconic W Abu Dhabi (Yas Hotel) Luxury Towers & High-Clearance Skybridge
  const hotelT = 0.905;
  const hPt = curve.getPointAt(hotelT);
  const hTan = curve.getTangentAt(hotelT).normalize();
  const hR = new THREE.Vector3().crossVectors(hTan, up).normalize();

  // Find guaranteed safe positions for Left and Right Hotel Wings (>48m away from track centerline)
  const leftDist = 48;
  const rightDist = 48;
  const leftWingPos = hPt.clone().addScaledVector(hR, -leftDist);
  const rightWingPos = hPt.clone().addScaledVector(hR, rightDist);

  const hotelMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    metalness: 0.85,
    roughness: 0.15,
    clearcoat: 1.0,
    reflectivity: 0.9,
  });

  const hotelGlassMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85,
  });

  const rooftopHelipadMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.8,
  });

  // Spawn Left & Right Hotel Wings if strictly clear
  [
    { pos: leftWingPos, isLeft: true },
    { pos: rightWingPos, isLeft: false },
  ].forEach(({ pos, isLeft }, idx) => {
    // 32m clearance check around building centroid
    if (!isClearOfTrack(pos, 32.0)) return;

    const wingGroup = new THREE.Group();

    // Main 7-story Hotel Tower (28m wide, 46m high, 56m long)
    const wingGeom = new THREE.BoxGeometry(28, 46, 56);
    const wing = new THREE.Mesh(wingGeom, hotelMat);
    wing.position.set(0, 23, 0);
    wing.castShadow = true;
    wing.receiveShadow = true;
    wingGroup.add(wing);

    // Illuminated luxury glass floor bands
    for (let f = 1; f <= 7; f++) {
      const floorStrip = new THREE.Mesh(new THREE.BoxGeometry(28.4, 2.2, 56.4), hotelGlassMat);
      floorStrip.position.set(0, f * 5.8, 0);
      wingGroup.add(floorStrip);
    }

    // Balconies with warm ambient hotel lighting
    for (let f = 2; f <= 6; f++) {
      const balcony = new THREE.Mesh(
        new THREE.BoxGeometry(isLeft ? 2.5 : -2.5, 0.9, 44),
        new THREE.MeshStandardMaterial({ color: 0x334155 })
      );
      balcony.position.set(isLeft ? 14.5 : -14.5, f * 5.8 - 0.8, 0);
      wingGroup.add(balcony);
    }

    // Rooftop Helipad
    const helipad = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 1.2, 24), rooftopHelipadMat);
    helipad.position.set(0, 46.6, 0);
    wingGroup.add(helipad);

    // Helipad 'H' Decal
    const hBar1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 10), new THREE.MeshBasicMaterial({ color: 0xffd000 }));
    hBar1.position.set(-2.8, 47.3, 0);
    wingGroup.add(hBar1);
    const hBar2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 10), new THREE.MeshBasicMaterial({ color: 0xffd000 }));
    hBar2.position.set(2.8, 47.3, 0);
    wingGroup.add(hBar2);
    const hCross = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.2, 1.6), new THREE.MeshBasicMaterial({ color: 0xffd000 }));
    hCross.position.set(0, 47.3, 0);
    wingGroup.add(hCross);

    // Yas Hotel Illuminated Cyan Neon Branding Sign
    const signGeom = new THREE.PlaneGeometry(20, 5);
    const signMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide });
    const sign = new THREE.Mesh(signGeom, signMat);
    sign.position.set(isLeft ? 14.4 : -14.4, 40, 0);
    sign.rotation.y = isLeft ? Math.PI / 2 : -Math.PI / 2;
    wingGroup.add(sign);

    wingGroup.position.set(pos.x, hPt.y, pos.z);
    wingGroup.lookAt(pos.clone().add(hTan));
    group.add(wingGroup);
  });

  // Elevated Connecting Pedestrian Skybridge spanning between the two hotel towers
  // Bottom of bridge sits at y = 17m (safely 17m above the track surface, completely clear of cars)
  const skybridgeY = hPt.y + 19.5;
  const bridgeLength = leftDist + rightDist;
  const bridgeGeom = new THREE.BoxGeometry(bridgeLength, 5.0, 14.0);
  const bridgeMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.9,
    roughness: 0.2,
  });
  const skybridge = new THREE.Mesh(bridgeGeom, bridgeMat);
  skybridge.position.set(hPt.x, skybridgeY, hPt.z);
  skybridge.lookAt(hPt.clone().add(hR)); // Align along the cross-track vector
  group.add(skybridge);

  // Glowing Panoramic Glass Windows along the Skybridge
  const bridgeGlass = new THREE.Mesh(
    new THREE.BoxGeometry(bridgeLength - 8, 2.6, 14.4),
    hotelGlassMat
  );
  bridgeGlass.position.set(hPt.x, skybridgeY, hPt.z);
  bridgeGlass.rotation.copy(skybridge.rotation);
  group.add(bridgeGlass);

  // Crystalline LED Canopy Crown sitting high ON TOP of the skybridge (y = 23m to 31m)
  const canopyArchGeom = new THREE.CylinderGeometry(26, 26, 20, 24, 2, true, 0, Math.PI);
  const canopyMat = new THREE.MeshBasicMaterial({
    color: 0x00d2ff,
    transparent: true,
    opacity: 0.65,
    wireframe: true,
    side: THREE.DoubleSide,
  });
  const canopyArch = new THREE.Mesh(canopyArchGeom, canopyMat);
  canopyArch.position.set(hPt.x, skybridgeY + 4.5, hPt.z);
  canopyArch.rotation.z = Math.PI / 2;
  canopyArch.lookAt(hPt.clone().add(hTan));
  group.add(canopyArch);

  // 2. Stadium Floodlight Towers (High-intensity lighting outside the circuit barriers)
  const floodlightPoleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.2 });
  const floodlightGlowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const floodlightHousingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });

  for (let t = 0.02; t < 0.99; t += 0.045) {
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const r = new THREE.Vector3().crossVectors(tan, up).normalize();

    // Place safely outside the track barriers
    const polePos = pt.clone().addScaledVector(r, 29);
    if (!isClearOfTrack(polePos, 22.0)) continue;

    const tower = new THREE.Group();

    // Tall angled steel mast (28m high)
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 28, 8), floodlightPoleMat);
    mast.position.set(0, 14, 0);
    mast.castShadow = true;
    tower.add(mast);

    // Cantilevered cross-arm angled toward the track
    const crossArm = new THREE.Mesh(new THREE.BoxGeometry(8, 0.8, 1.2), floodlightPoleMat);
    crossArm.position.set(-2.0, 27.5, 0);
    crossArm.rotation.z = -0.22;
    tower.add(crossArm);

    // Bank of 6 high-intensity LED floodlight housings
    for (let f = 0; f < 6; f++) {
      const fx = -5.0 + f * 1.6;
      const housing = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.8), floodlightHousingMat);
      housing.position.set(fx, 27.8, 0);
      tower.add(housing);

      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), floodlightGlowMat);
      lamp.position.set(fx, 27.8, 0.42);
      tower.add(lamp);
    }

    // Ground spotlight glow fixture
    const baseLight = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 0.4, 8), new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
    baseLight.position.set(0, 0.2, 0);
    tower.add(baseLight);

    tower.position.set(polePos.x, pt.y, polePos.z);
    tower.lookAt(pt.clone().add(tan));
    tower.rotateY(Math.PI / 2);
    group.add(tower);
  }

  // 3. Yas Marina Bay Waterfront & Luxury Superyachts (Safely set back > 75m)
  const marinaT = 0.84;
  const mPt = curve.getPointAt(marinaT);
  const mTan = curve.getTangentAt(marinaT).normalize();
  const mR = new THREE.Vector3().crossVectors(mTan, up).normalize();
  const waterCenter = mPt.clone().addScaledVector(mR, 82);

  if (isClearOfTrack(waterCenter, 45.0)) {
    // Reflective Deep Azure Marina Water Basin
    const waterGeom = new THREE.PlaneGeometry(240, 320);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x002c3d,
      roughness: 0.12,
      metalness: 0.85,
    });
    const waterPlane = new THREE.Mesh(waterGeom, waterMat);
    waterPlane.position.set(waterCenter.x, mPt.y - 0.4, waterCenter.z);
    waterPlane.rotation.x = -Math.PI / 2;
    waterPlane.receiveShadow = true;
    group.add(waterPlane);

    // Floating Marina Docks & Piers
    const dockGeom = new THREE.BoxGeometry(6.5, 1.2, 180);
    const dockMat = new THREE.MeshStandardMaterial({ color: 0x4a3c31, roughness: 0.8 });
    const dock = new THREE.Mesh(dockGeom, dockMat);
    dock.position.set(waterCenter.x - 24, mPt.y + 0.2, waterCenter.z);
    group.add(dock);

    // Luxury 3D Superyachts Moored along the Pier
    for (let y = -2; y <= 2; y++) {
      const yachtGroup = new THREE.Group();
      const yachtZ = waterCenter.z + y * 46;
      const yachtX = waterCenter.x + 18;

      const hullGeom = new THREE.BoxGeometry(15, 5.2, 36);
      const hullMat = new THREE.MeshPhysicalMaterial({
        color: y % 2 === 0 ? 0xffffff : 0x0f172a,
        metalness: 0.7,
        roughness: 0.2,
        clearcoat: 1.0,
      });
      const hull = new THREE.Mesh(hullGeom, hullMat);
      hull.position.set(0, 2.6, 0);
      yachtGroup.add(hull);

      const saloonGeom = new THREE.BoxGeometry(11, 4.2, 24);
      const saloonMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.5, roughness: 0.3 });
      const saloon = new THREE.Mesh(saloonGeom, saloonMat);
      saloon.position.set(0, 6.2, -2);
      yachtGroup.add(saloon);

      const winGeom = new THREE.BoxGeometry(11.2, 1.5, 20);
      const winMat = new THREE.MeshBasicMaterial({ color: 0xffe899 });
      const windows = new THREE.Mesh(winGeom, winMat);
      windows.position.set(0, 6.4, -2);
      yachtGroup.add(windows);

      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 5.5, 8), new THREE.MeshStandardMaterial({ color: 0xd1d5db }));
      mast.position.set(0, 10.2, -4);
      yachtGroup.add(mast);

      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      dome.position.set(0, 12.2, -4);
      yachtGroup.add(dome);

      const underGlow = new THREE.Mesh(new THREE.PlaneGeometry(16, 38), new THREE.MeshBasicMaterial({ color: 0x00a3ff, transparent: true, opacity: 0.45 }));
      underGlow.rotation.x = -Math.PI / 2;
      underGlow.position.set(0, 0.1, 0);
      yachtGroup.add(underGlow);

      yachtGroup.position.set(yachtX, mPt.y - 0.2, yachtZ);
      group.add(yachtGroup);
    }
  }

  // 4. Ferrari World Abu Dhabi (Iconic Red Roof placed safely in horizon > 220m away)
  const backStraightPt = curve.getPointAt(0.48);
  const fwPos = backStraightPt.clone().add(new THREE.Vector3(-240, 0, 220));

  if (isClearOfTrack(fwPos, 140.0)) {
    const ferrariWorldGroup = new THREE.Group();

    const fwRoofMat = new THREE.MeshStandardMaterial({
      color: 0xd90429, // Rosso Corsa
      metalness: 0.75,
      roughness: 0.25,
    });
    const fwRoof = new THREE.Mesh(new THREE.CylinderGeometry(95, 120, 28, 6), fwRoofMat);
    fwRoof.position.set(0, 14, 0);
    ferrariWorldGroup.add(fwRoof);

    const fwGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(35, 15, 34, 16),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75, wireframe: true })
    );
    fwGlass.position.set(0, 20, 0);
    ferrariWorldGroup.add(fwGlass);

    const shieldMat = new THREE.MeshBasicMaterial({ color: 0xffd000 });
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 1.5, 16), shieldMat);
    shield.position.set(0, 29, 0);
    ferrariWorldGroup.add(shield);

    ferrariWorldGroup.position.set(fwPos.x, backStraightPt.y, fwPos.z);
    group.add(ferrariWorldGroup);
  }

  // 5. Arabian Date Palms with Golden Ground Uplights
  const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
  const palmFrondMat = new THREE.MeshStandardMaterial({ color: 0x1b4332, roughness: 0.75 });
  const uplightMat = new THREE.MeshBasicMaterial({ color: 0xffb703 });

  for (let t = 0.03; t < 0.98; t += 0.04) {
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const r = new THREE.Vector3().crossVectors(tan, up).normalize();

    const palmPos = pt.clone().addScaledVector(r, 32);
    if (!isClearOfTrack(palmPos, 24.0)) continue;

    const palmGroup = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.65, 8.5, 8), palmTrunkMat);
    trunk.position.set(0, 4.25, 0);
    trunk.rotation.z = (Math.random() - 0.5) * 0.15;
    palmGroup.add(trunk);

    for (let f = 0; f < 8; f++) {
      const frondAngle = (f / 8) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.ConeGeometry(1.7, 7.0, 4), palmFrondMat);
      frond.position.set(Math.sin(frondAngle) * 2.4, 8.2, Math.cos(frondAngle) * 2.4);
      frond.rotation.x = Math.PI / 3.2;
      frond.rotation.y = frondAngle;
      palmGroup.add(frond);
    }

    const uplight = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.4, 8), uplightMat);
    uplight.position.set(0, 0.2, 0);
    palmGroup.add(uplight);

    palmGroup.position.set(palmPos.x, pt.y, palmPos.z);
    group.add(palmGroup);
  }

  // 6. Tensile Sail Canopy Grandstands
  const gsPoints = [0.03, 0.25, 0.55, 0.75];
  gsPoints.forEach((t) => {
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const r = new THREE.Vector3().crossVectors(tan, up).normalize();
    const gsPos = pt.clone().addScaledVector(r, -42);
    if (!isClearOfTrack(gsPos, 36.0)) return;

    const grandstand = new THREE.Group();
    const tiers = new THREE.Mesh(
      new THREE.BoxGeometry(64, 13, 20),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 })
    );
    tiers.position.set(0, 6.5, 0);
    grandstand.add(tiers);

    const roofGeom = new THREE.CylinderGeometry(26, 26, 68, 16, 1, true, 0, Math.PI * 0.45);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.1, side: THREE.DoubleSide });
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.set(0, 17, 2);
    roof.rotation.z = Math.PI / 2;
    grandstand.add(roof);

    grandstand.position.set(gsPos.x, pt.y, gsPos.z);
    grandstand.lookAt(gsPos.clone().add(tan));
    grandstand.rotateY(Math.PI / 2);
    group.add(grandstand);
  });
}

// ==========================================
// MONACO: PORT HERCULE HARBOR & HILLSIDE
// ==========================================
function buildMonacoEnvironment(
  curve: THREE.CatmullRomCurve3,
  isClearOfTrack: (pos: THREE.Vector3, minSafeRadius?: number) => boolean,
  group: THREE.Group
) {
  const up = new THREE.Vector3(0, 1, 0);

  // Mediterranean Deep Azure Harbor Basin
  const harborCenter = curve.getPointAt(0.45).clone().add(new THREE.Vector3(95, -0.4, 60));
  if (isClearOfTrack(harborCenter, 50.0)) {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(320, 360),
      new THREE.MeshStandardMaterial({ color: 0x003f5c, roughness: 0.12, metalness: 0.88 })
    );
    water.position.set(harborCenter.x, -0.2, harborCenter.z);
    water.rotation.x = -Math.PI / 2;
    water.receiveShadow = true;
    group.add(water);

    // Mega-Yachts in Port Hercule
    for (let y = -2; y <= 2; y++) {
      const yacht = new THREE.Group();
      const yPos = harborCenter.clone().add(new THREE.Vector3(y * 42, 0, -30));
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(16, 5.5, 38),
        new THREE.MeshPhysicalMaterial({ color: y % 2 === 0 ? 0xffffff : 0x0e1726, metalness: 0.6, roughness: 0.2 })
      );
      hull.position.set(0, 2.7, 0);
      yacht.add(hull);

      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(11, 4.5, 24),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
      );
      cabin.position.set(0, 6.5, -2);
      yacht.add(cabin);

      yacht.position.copy(yPos);
      group.add(yacht);
    }
  }

  // Riviera Hillside Terracotta Villas & Palace Facades
  for (let i = 0; i < 10; i++) {
    const pt = curve.getPointAt(i / 10);
    const tan = curve.getTangentAt(i / 10).normalize();
    const r = new THREE.Vector3().crossVectors(tan, up).normalize();
    const vPos = pt.clone().addScaledVector(r, -62);
    if (!isClearOfTrack(vPos, 40.0)) continue;

    const villaGroup = new THREE.Group();
    const villa = new THREE.Mesh(
      new THREE.BoxGeometry(26, 22 + (i % 3) * 8, 30),
      new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0xfef08a : 0xfbcfe8, roughness: 0.7 })
    );
    villa.position.set(0, 14, 0);
    villaGroup.add(villa);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(22, 7, 4),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 })
    );
    roof.position.set(0, 28 + (i % 3) * 4, 0);
    roof.rotation.y = Math.PI / 4;
    villaGroup.add(roof);

    villaGroup.position.set(vPos.x, pt.y, vPos.z);
    group.add(villaGroup);
  }
}

// ==========================================
// SPA-FRANCORCHAMPS: ARDENNES PINE FORESTS & EAU ROUGE
// ==========================================
function buildSpaEnvironment(
  curve: THREE.CatmullRomCurve3,
  isClearOfTrack: (pos: THREE.Vector3, minSafeRadius?: number) => boolean,
  group: THREE.Group
) {
  const up = new THREE.Vector3(0, 1, 0);
  const pineTrunkMat = new THREE.MeshStandardMaterial({ color: 0x2e1d10, roughness: 0.9 });
  const pineNeedleMat = new THREE.MeshStandardMaterial({ color: 0x0f381e, roughness: 0.85 });

  for (let t = 0.02; t < 0.98; t += 0.02) {
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const r = new THREE.Vector3().crossVectors(tan, up).normalize();

    [-1, 1].forEach((side) => {
      const treePos = pt.clone().addScaledVector(r, side * (32 + (Math.floor(t * 80) % 3) * 12));
      if (!isClearOfTrack(treePos, 24.0)) return;

      const treeGroup = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 14, 6), pineTrunkMat);
      trunk.position.set(0, 7, 0);
      treeGroup.add(trunk);

      for (let layer = 0; layer < 4; layer++) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(4.2 - layer * 0.8, 6.0, 7),
          pineNeedleMat
        );
        cone.position.set(0, 9.5 + layer * 3.5, 0);
        treeGroup.add(cone);
      }

      treeGroup.position.set(treePos.x, pt.y, treePos.z);
      group.add(treeGroup);
    });
  }

  // Eau Rouge Covered Red-Roofed Grandstand
  const erPt = curve.getPointAt(0.12);
  const erTan = curve.getTangentAt(0.12).normalize();
  const erR = new THREE.Vector3().crossVectors(erTan, up).normalize();
  const erPos = erPt.clone().addScaledVector(erR, -46);
  if (isClearOfTrack(erPos, 38.0)) {
    const gs = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(80, 16, 24), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 }));
    base.position.set(0, 8, 0);
    gs.add(base);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(86, 2, 28), new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 }));
    roof.position.set(0, 18, 0);
    roof.rotation.x = 0.15;
    gs.add(roof);

    gs.position.set(erPos.x, erPt.y, erPos.z);
    gs.lookAt(erPos.clone().add(erTan));
    group.add(gs);
  }
}

// ==========================================
// MONZA: ROYAL PARK OAKS & CLASSIC BANKING
// ==========================================
function buildMonzaEnvironment(
  curve: THREE.CatmullRomCurve3,
  isClearOfTrack: (pos: THREE.Vector3, minSafeRadius?: number) => boolean,
  group: THREE.Group
) {
  const up = new THREE.Vector3(0, 1, 0);
  const oakTrunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.85 });
  const oakFoliageMat = new THREE.MeshStandardMaterial({ color: 0x1e5128, roughness: 0.8 });

  for (let t = 0.02; t < 0.98; t += 0.035) {
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const r = new THREE.Vector3().crossVectors(tan, up).normalize();
    const tPos = pt.clone().addScaledVector(r, 36);
    if (!isClearOfTrack(tPos, 26.0)) continue;

    const oak = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 10, 7), oakTrunkMat);
    trunk.position.set(0, 5, 0);
    oak.add(trunk);

    const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(6.0, 1), oakFoliageMat);
    foliage.position.set(0, 12, 0);
    oak.add(foliage);

    oak.position.set(tPos.x, pt.y, tPos.z);
    group.add(oak);
  }

  // The Historic 1955 High-Banked Oval (Sopraelevata) sweeping behind the modern track
  const bankingPos = new THREE.Vector3(180, 14, 320);
  if (isClearOfTrack(bankingPos, 70.0)) {
    const bankingGeom = new THREE.TorusGeometry(180, 7.5, 8, 48, Math.PI * 0.7);
    const bankingMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.95 });
    const banking = new THREE.Mesh(bankingGeom, bankingMat);
    banking.position.copy(bankingPos);
    banking.rotation.x = Math.PI / 2.3;
    banking.rotation.z = Math.PI / 6;
    group.add(banking);
  }
}

// ==========================================
// SILVERSTONE: THE WING PADDOCK & AIRFIELD
// ==========================================
function buildSilverstoneEnvironment(
  _curve: THREE.CatmullRomCurve3,
  _isClearOfTrack: (pos: THREE.Vector3, minSafeRadius?: number) => boolean,
  _group: THREE.Group
) {
  // Building removed to keep the British GP track completely clear
}

// ==========================================
// SUZUKA: 50M WONDER WHEEL & DUNLOP BRIDGE
// ==========================================
function buildSuzukaEnvironment(
  curve: THREE.CatmullRomCurve3,
  isClearOfTrack: (pos: THREE.Vector3, minSafeRadius?: number) => boolean,
  group: THREE.Group
) {
  const fPt = curve.getPointAt(0.22);
  const fwPos = fPt.clone().add(new THREE.Vector3(140, 0, -110));

  if (isClearOfTrack(fwPos, 45.0)) {
    const wheelGroup = new THREE.Group();
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8, roughness: 0.3 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(36, 1.4, 8, 36), rimMat);
    rim.position.set(0, 42, 0);
    wheelGroup.add(rim);

    for (let s = 0; s < 16; s++) {
      const spoke = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 72, 6),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );
      spoke.position.set(0, 42, 0);
      spoke.rotation.z = (s / 16) * Math.PI;
      wheelGroup.add(spoke);

      const angle = (s / 16) * Math.PI * 2;
      const gondola = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 2.8, 2.0),
        new THREE.MeshStandardMaterial({ color: s % 2 === 0 ? 0xffdd00 : 0xef4444 })
      );
      gondola.position.set(Math.sin(angle) * 36, 42 + Math.cos(angle) * 36, 0);
      wheelGroup.add(gondola);
    }

    const legMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5 });
    const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 48, 8), legMat);
    leg1.position.set(-16, 24, 0);
    leg1.rotation.z = 0.32;
    wheelGroup.add(leg1);

    const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 48, 8), legMat);
    leg2.position.set(16, 24, 0);
    leg2.rotation.z = -0.32;
    wheelGroup.add(leg2);

    wheelGroup.position.set(fwPos.x, fPt.y, fwPos.z);
    group.add(wheelGroup);
  }
}

// ==========================================
// MIAMI: HARD ROCK STADIUM SPIRES & PALMS
// ==========================================
function buildMiamiEnvironment(
  curve: THREE.CatmullRomCurve3,
  isClearOfTrack: (pos: THREE.Vector3, minSafeRadius?: number) => boolean,
  group: THREE.Group
) {
  const sPt = curve.getPointAt(0.5);
  const stadiumCenter = sPt.clone().add(new THREE.Vector3(-180, 0, 130));

  if (isClearOfTrack(stadiumCenter, 115.0)) {
    const stadium = new THREE.Mesh(
      new THREE.CylinderGeometry(85, 95, 36, 24),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.4 })
    );
    stadium.position.set(stadiumCenter.x, sPt.y + 18, stadiumCenter.z);
    group.add(stadium);

    for (let c = 0; c < 4; c++) {
      const angle = (c / 4) * Math.PI * 2 + Math.PI / 4;
      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(2.8, 54, 8),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.85 })
      );
      spire.position.set(
        stadiumCenter.x + Math.sin(angle) * 88,
        sPt.y + 45,
        stadiumCenter.z + Math.cos(angle) * 88
      );
      group.add(spire);
    }
  }
}

// ==========================================
// JEDDAH: CORNICHE RED SEA NIGHT
// ==========================================
function buildJeddahEnvironment(
  curve: THREE.CatmullRomCurve3,
  isClearOfTrack: (pos: THREE.Vector3, minSafeRadius?: number) => boolean,
  group: THREE.Group
) {
  const seaPos = new THREE.Vector3(120, -0.2, 90);
  if (isClearOfTrack(seaPos, 60.0)) {
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(360, 500),
      new THREE.MeshStandardMaterial({ color: 0x011627, roughness: 0.1, metalness: 0.9 })
    );
    sea.position.copy(seaPos);
    sea.rotation.x = -Math.PI / 2;
    group.add(sea);
  }

  // Futuristic Glass Skyscrapers
  for (let b = 0; b < 6; b++) {
    const towerPos = new THREE.Vector3(-180 - b * 32, 45 + b * 9, -90 + b * 45);
    if (!isClearOfTrack(towerPos, 36.0)) continue;

    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(28, 90 + b * 18, 28),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.1 })
    );
    tower.position.copy(towerPos);
    group.add(tower);
  }
}

// ==========================================
// MELBOURNE: ALBERT PARK LAKE & SKYLINE
// ==========================================
function buildMelbourneEnvironment(
  curve: THREE.CatmullRomCurve3,
  isClearOfTrack: (pos: THREE.Vector3, minSafeRadius?: number) => boolean,
  group: THREE.Group
) {
  const lakePos = new THREE.Vector3(0, -0.2, 0);
  if (isClearOfTrack(lakePos, 135.0)) {
    const lake = new THREE.Mesh(
      new THREE.CircleGeometry(125, 36),
      new THREE.MeshStandardMaterial({ color: 0x034078, roughness: 0.2, metalness: 0.8 })
    );
    lake.position.copy(lakePos);
    lake.rotation.x = -Math.PI / 2;
    group.add(lake);
  }

  for (let b = 0; b < 7; b++) {
    const towerPos = new THREE.Vector3(240 + (b % 3) * 45, 40 + (b % 4) * 11, -200 + b * 55);
    if (!isClearOfTrack(towerPos, 38.0)) continue;

    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(32, 80 + (b % 4) * 22, 32),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 })
    );
    tower.position.copy(towerPos);
    group.add(tower);
  }
}

// ==========================================
// BAHRAIN: SAKHIR VIP TOWER & DESERT OASIS
// ==========================================
function buildBahrainEnvironment(
  curve: THREE.CatmullRomCurve3,
  isClearOfTrack: (pos: THREE.Vector3, minSafeRadius?: number) => boolean,
  group: THREE.Group
) {
  const sPt = curve.getPointAt(0.02);
  const towerPos = sPt.clone().add(new THREE.Vector3(-75, 0, 55));

  if (isClearOfTrack(towerPos, 36.0)) {
    const towerGroup = new THREE.Group();
    for (let floor = 0; floor < 8; floor++) {
      const cylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(18 - floor * 0.8, 19 - floor * 0.8, 5.5, 24),
        new THREE.MeshStandardMaterial({ color: floor % 2 === 0 ? 0xffffff : 0x0f172a, metalness: 0.7, roughness: 0.3 })
      );
      cylinder.position.set(0, 3 + floor * 6.0, 0);
      towerGroup.add(cylinder);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(18.5 - floor * 0.8, 0.4, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      ring.position.set(0, 5.8 + floor * 6.0, 0);
      ring.rotation.x = Math.PI / 2;
      towerGroup.add(ring);
    }
    towerGroup.position.set(towerPos.x, sPt.y, towerPos.z);
    group.add(towerGroup);
  }
}

// ==========================================
// DEFAULT ENVIRONMENT
// ==========================================
function buildDefaultEnvironment(
  circuit: CircuitInfo,
  curve: THREE.CatmullRomCurve3,
  isClearOfTrack: (pos: THREE.Vector3, minSafeRadius?: number) => boolean,
  group: THREE.Group
) {
  const up = new THREE.Vector3(0, 1, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.9 });
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x1b4d24, roughness: 0.8 });

  for (let t = 0.05; t < 0.95; t += 0.04) {
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const r = new THREE.Vector3().crossVectors(tan, up).normalize();
    const treePos = pt.clone().addScaledVector(r, 34);
    if (!isClearOfTrack(treePos, 24.0)) continue;

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), trunkMat);
    trunk.position.set(treePos.x, pt.y + 3.5, treePos.z);
    group.add(trunk);

    const foliage = new THREE.Mesh(new THREE.ConeGeometry(3.0, 8.5, 7), foliageMat);
    foliage.position.set(treePos.x, pt.y + 8.5, treePos.z);
    group.add(foliage);
  }
}
