import * as THREE from 'three';
import { CircuitInfo } from '../types/racing';

/**
 * Builds authentic, circuit-specific photorealistic 3D scenery, architecture, and landmarks.
 * - Abu Dhabi (Yas Marina): Iconic W Abu Dhabi (Yas Hotel) LED Canopy Bridge spanning the track,
 *   Yas Marina Basin with moored luxury superyachts, towering stadium floodlight pylons,
 *   the massive Ferrari World red aerodynamic sweeping roof with the yellow prancing horse shield,
 *   tensile sail canopy grandstands, Arabian date palms with golden uplights, desert dunes, and fireworks.
 * - Monaco: Port Hercule azure harbor with luxury mega-yachts against armco, terraced pastel Riviera villas,
 *   casino terrace promenade, Mediterranean sparkling water and palm trees.
 * - Spa-Francorchamps: Dense multi-layered Ardennes pine forests, Eau Rouge / Raidillon iconic red-roofed grandstands,
 *   rolling Belgian hill topography, and forest mist.
 * - Monza: Royal Parco di Monza dense oak canopy, legendary 1955 concrete banked oval (Sopraelevata) relic,
 *   Italian tricolore kerbs, and classic grandstands.
 * - Silverstone: The soaring angular "Silverstone Wing" pit complex, WWII intersecting airfield runways, and countryside.
 * - Suzuka: Glowing 50m "Wonder Wheel" Ferris wheel with 24 gondolas, Dunlop footbridge, and Japanese hills.
 * - Miami: Hard Rock Stadium with four 100m teal cable spires, pastel marina yacht basin, and Florida palms.
 * - Jeddah: Coastal Red Sea night race with floodlight gantries, reflective water, and illuminated modern skyscrapers.
 * - Melbourne: Central Albert Park lake with reflective water and Melbourne downtown glass towers skyline.
 * - Bahrain: The iconic 8-floor circular Sakhir VIP Tower glowing with LED lights, desert sands, and night floodlights.
 */
export function buildCircuitScenery(
  circuit: CircuitInfo,
  curve: THREE.CatmullRomCurve3,
  isClearOfTrack: (pos: THREE.Vector3, minSafeRadius?: number) => boolean,
  group: THREE.Group
): void {
  // 1. ABU DHABI GRAND PRIX (YAS MARINA CIRCUIT)
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

  // 1. The Iconic W Abu Dhabi (Yas Hotel) LED Canopy Bridge
  // Located around t = 0.905 where the track runs through the hotel marina complex
  const hotelT = 0.905;
  const hPt = curve.getPointAt(hotelT);
  const hTan = curve.getTangentAt(hotelT).normalize();
  const hR = new THREE.Vector3().crossVectors(hTan, up).normalize();

  // Left & Right Hotel Wings (Placed safely outside track boundaries)
  const leftWingPos = hPt.clone().addScaledVector(hR, -38);
  const rightWingPos = hPt.clone().addScaledVector(hR, 38);

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

  // Hotel Wings
  [leftWingPos, rightWingPos].forEach((pos, idx) => {
    const wingGeom = new THREE.BoxGeometry(28, 42, 54);
    const wing = new THREE.Mesh(wingGeom, hotelMat);
    wing.position.set(pos.x, hPt.y + 21, pos.z);
    wing.lookAt(pos.clone().add(hTan));
    group.add(wing);

    // Illuminated glass floors
    for (let f = 1; f <= 6; f++) {
      const floorStrip = new THREE.Mesh(new THREE.BoxGeometry(28.4, 2.2, 54.4), hotelGlassMat);
      floorStrip.position.set(pos.x, hPt.y + f * 6.5, pos.z);
      floorStrip.rotation.copy(wing.rotation);
      group.add(floorStrip);
    }

    // Yas Hotel branding signage
    const signGeom = new THREE.PlaneGeometry(18, 4.5);
    const signMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide });
    const sign = new THREE.Mesh(signGeom, signMat);
    sign.position.set(pos.x + (idx === 0 ? 14.5 : -14.5), hPt.y + 38, pos.z);
    sign.rotation.y = idx === 0 ? Math.PI / 2 : -Math.PI / 2;
    group.add(sign);
  });

  // The Grand Crystalline LED Canopy Arch spanning over the track with 16m+ vertical clearance
  const archGeom = new THREE.TorusGeometry(40, 3.2, 12, 32, Math.PI);
  const canopyLatticeMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.9,
    roughness: 0.2,
  });
  const arch1 = new THREE.Mesh(archGeom, canopyLatticeMat);
  arch1.position.set(hPt.x, hPt.y + 3.0, hPt.z - 10);
  arch1.lookAt(hPt.clone().add(hTan));
  group.add(arch1);

  const arch2 = new THREE.Mesh(archGeom, canopyLatticeMat);
  arch2.position.set(hPt.x, hPt.y + 3.0, hPt.z + 10);
  arch2.lookAt(hPt.clone().add(hTan));
  group.add(arch2);

  // Dynamic LED Grid Panels on Canopy (Cybernetic Yas Blue / Magenta glow)
  const ledCanopyGeom = new THREE.CylinderGeometry(39.5, 39.5, 22, 24, 6, true, Math.PI * 0.1, Math.PI * 0.8);
  const ledCanopyMat = new THREE.MeshBasicMaterial({
    color: 0x00d2ff,
    transparent: true,
    opacity: 0.65,
    wireframe: true,
    side: THREE.DoubleSide,
  });
  const ledCanopy = new THREE.Mesh(ledCanopyGeom, ledCanopyMat);
  ledCanopy.position.set(hPt.x, hPt.y + 3.0, hPt.z);
  ledCanopy.rotation.z = Math.PI / 2;
  ledCanopy.lookAt(hPt.clone().add(hTan));
  group.add(ledCanopy);

  // 2. Stadium Floodlight Towers (The Soul of Abu Dhabi Night Racing!)
  // Placed regularly along the circuit perimeter outside the track
  const floodlightPoleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.2 });
  const floodlightGlowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const floodlightHousingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });

  for (let t = 0.02; t < 0.99; t += 0.045) {
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const r = new THREE.Vector3().crossVectors(tan, up).normalize();

    // Place on the outside curve of the track
    const polePos = pt.clone().addScaledVector(r, 26);
    if (!isClearOfTrack(polePos, 20.0)) continue;

    const tower = new THREE.Group();

    // Tall angled steel mast (26m high)
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 26, 8), floodlightPoleMat);
    mast.position.set(0, 13, 0);
    mast.castShadow = true;
    tower.add(mast);

    // Cantilevered cross-arm angled toward the track
    const crossArm = new THREE.Mesh(new THREE.BoxGeometry(7, 0.8, 1.2), floodlightPoleMat);
    crossArm.position.set(-1.8, 25.5, 0);
    crossArm.rotation.z = -0.25;
    tower.add(crossArm);

    // Bank of 6 high-intensity LED floodlight housings
    for (let f = 0; f < 6; f++) {
      const fx = -4.5 + f * 1.6;
      const housing = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.8), floodlightHousingMat);
      housing.position.set(fx, 25.8, 0);
      tower.add(housing);

      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), floodlightGlowMat);
      lamp.position.set(fx, 25.8, 0.42);
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

  // 3. Yas Marina Bay Waterfront & Luxury Superyachts
  // Placed alongside t = 0.80 to 0.89 on the marina complex side
  const marinaT = 0.84;
  const mPt = curve.getPointAt(marinaT);
  const mTan = curve.getTangentAt(marinaT).normalize();
  const mR = new THREE.Vector3().crossVectors(mTan, up).normalize();
  const waterCenter = mPt.clone().addScaledVector(mR, 75);

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
  dock.position.set(waterCenter.x - 22, mPt.y + 0.2, waterCenter.z);
  group.add(dock);

  // Luxury 3D Superyachts Moored along the Pier
  for (let y = -2; y <= 2; y++) {
    const yachtGroup = new THREE.Group();
    const yachtZ = waterCenter.z + y * 46;
    const yachtX = waterCenter.x + 18;

    // Sleek Hull
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

    // Multi-tier Superstructure / Saloon
    const saloonGeom = new THREE.BoxGeometry(11, 4.2, 24);
    const saloonMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.5, roughness: 0.3 });
    const saloon = new THREE.Mesh(saloonGeom, saloonMat);
    saloon.position.set(0, 6.2, -2);
    yachtGroup.add(saloon);

    // Glowing Yacht Windows
    const winGeom = new THREE.BoxGeometry(11.2, 1.5, 20);
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffe899 });
    const windows = new THREE.Mesh(winGeom, winMat);
    windows.position.set(0, 6.4, -2);
    yachtGroup.add(windows);

    // Radar Mast & Satellite Domes
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 5.5, 8), new THREE.MeshStandardMaterial({ color: 0xd1d5db }));
    mast.position.set(0, 10.2, -4);
    yachtGroup.add(mast);

    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    dome.position.set(0, 12.2, -4);
    yachtGroup.add(dome);

    // Underwater blue LED hull glow
    const underGlow = new THREE.Mesh(new THREE.PlaneGeometry(16, 38), new THREE.MeshBasicMaterial({ color: 0x00a3ff, transparent: true, opacity: 0.45 }));
    underGlow.rotation.x = -Math.PI / 2;
    underGlow.position.set(0, 0.1, 0);
    yachtGroup.add(underGlow);

    yachtGroup.position.set(yachtX, mPt.y - 0.2, yachtZ);
    group.add(yachtGroup);
  }

  // 4. Ferrari World Abu Dhabi (Iconic Red Aerodynamic Roof on Horizon!)
  // Placed in the distance beyond the 1.2km back straight
  const backStraightPt = curve.getPointAt(0.48);
  const fwPos = backStraightPt.clone().add(new THREE.Vector3(-180, 0, 160));

  const ferrariWorldGroup = new THREE.Group();

  // Giant sweeping Ferrari Red roof structure (220m wide)
  const fwRoofMat = new THREE.MeshStandardMaterial({
    color: 0xd90429, // Rosso Corsa
    metalness: 0.75,
    roughness: 0.25,
  });
  const fwRoof = new THREE.Mesh(new THREE.CylinderGeometry(95, 120, 28, 6), fwRoofMat);
  fwRoof.position.set(0, 14, 0);
  ferrariWorldGroup.add(fwRoof);

  // Central Glass Atrium Funnel
  const fwGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(35, 15, 34, 16),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75, wireframe: true })
  );
  fwGlass.position.set(0, 20, 0);
  ferrariWorldGroup.add(fwGlass);

  // Ferrari Yellow Emblem Shield on Roof
  const shieldMat = new THREE.MeshBasicMaterial({ color: 0xffd000 });
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 1.5, 16), shieldMat);
  shield.position.set(0, 29, 0);
  ferrariWorldGroup.add(shield);

  ferrariWorldGroup.position.set(fwPos.x, backStraightPt.y, fwPos.z);
  group.add(ferrariWorldGroup);

  // 5. Arabian Date Palms with Golden Ground Uplights
  const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
  const palmFrondMat = new THREE.MeshStandardMaterial({ color: 0x1b4332, roughness: 0.75 });
  const uplightMat = new THREE.MeshBasicMaterial({ color: 0xffb703 });

  for (let t = 0.03; t < 0.98; t += 0.04) {
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const r = new THREE.Vector3().crossVectors(tan, up).normalize();

    const palmPos = pt.clone().addScaledVector(r, 29);
    if (!isClearOfTrack(palmPos, 22.0)) continue;

    const palmGroup = new THREE.Group();
    // Curved trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.65, 8.5, 8), palmTrunkMat);
    trunk.position.set(0, 4.25, 0);
    trunk.rotation.z = (Math.random() - 0.5) * 0.15;
    palmGroup.add(trunk);

    // Drooping Palm Fronds
    for (let f = 0; f < 8; f++) {
      const frondAngle = (f / 8) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.ConeGeometry(1.7, 7.0, 4), palmFrondMat);
      frond.position.set(Math.sin(frondAngle) * 2.4, 8.2, Math.cos(frondAngle) * 2.4);
      frond.rotation.x = Math.PI / 3.2;
      frond.rotation.y = frondAngle;
      palmGroup.add(frond);
    }

    // Golden Ground Uplight Fixture
    const uplight = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.4, 8), uplightMat);
    uplight.position.set(0, 0.2, 0);
    palmGroup.add(uplight);

    palmGroup.position.set(palmPos.x, pt.y, palmPos.z);
    group.add(palmGroup);
  }

  // 6. Tensile Sail Canopy Grandstands (Ferrari World & Yas Marina style)
  const gsPoints = [0.03, 0.25, 0.55, 0.75];
  gsPoints.forEach((t) => {
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const r = new THREE.Vector3().crossVectors(tan, up).normalize();
    const gsPos = pt.clone().addScaledVector(r, -38);
    if (!isClearOfTrack(gsPos, 34.0)) return;

    const grandstand = new THREE.Group();
    // Stepped Seating Tier
    const tiers = new THREE.Mesh(
      new THREE.BoxGeometry(64, 13, 20),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 })
    );
    tiers.position.set(0, 6.5, 0);
    grandstand.add(tiers);

    // Curved Tensile Fabric Membrane Roof
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

  // 7. Desert Sand Dunes along the perimeter
  const duneMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.95 });
  for (let d = 0; d < 8; d++) {
    const angle = (d / 8) * Math.PI * 2;
    const duneRadius = 420 + (d % 3) * 60;
    const dune = new THREE.Mesh(new THREE.ConeGeometry(85, 26, 12), duneMat);
    dune.position.set(Math.sin(angle) * duneRadius, -2, Math.cos(angle) * duneRadius);
    dune.scale.set(1.8, 0.6, 2.2);
    group.add(dune);
  }

  // 8. Championship Celebration Fireworks in the Abu Dhabi Twilight Sky
  const fireworksGroup = new THREE.Group();
  const fireworkColors = [0x00f0ff, 0xff0055, 0xffb703, 0x7000ff, 0x00ff88];

  for (let fw = 0; fw < 8; fw++) {
    const fwAngle = (fw / 8) * Math.PI * 2;
    const fwRadius = 360 + (fw % 2) * 80;
    const fwHeight = 150 + (fw % 3) * 35;
    const fwColor = fireworkColors[fw % fireworkColors.length];

    const particleGeom = new THREE.BufferGeometry();
    const count = 54;
    const posArr = new Float32Array(count * 3);

    for (let p = 0; p < count; p++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 14.0 + Math.random() * 20.0;

      posArr[p * 3] = r * Math.sin(phi) * Math.cos(theta);
      posArr[p * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      posArr[p * 3 + 2] = r * Math.cos(phi);
    }

    particleGeom.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    const particleMat = new THREE.PointsMaterial({
      color: fwColor,
      size: 4.0,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
    });

    const firework = new THREE.Points(particleGeom, particleMat);
    firework.position.set(
      Math.sin(fwAngle) * fwRadius,
      fwHeight,
      Math.cos(fwAngle) * fwRadius
    );
    fireworksGroup.add(firework);
  }
  group.add(fireworksGroup);
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
  const harborCenter = curve.getPointAt(0.45).clone().add(new THREE.Vector3(80, -0.4, 50));
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

  // Riviera Hillside Terracotta Villas & Palace Facades
  for (let i = 0; i < 10; i++) {
    const pt = curve.getPointAt(i / 10);
    const tan = curve.getTangentAt(i / 10).normalize();
    const r = new THREE.Vector3().crossVectors(tan, up).normalize();
    const vPos = pt.clone().addScaledVector(r, -55);
    if (!isClearOfTrack(vPos, 35)) continue;

    const villaGroup = new THREE.Group();
    const villa = new THREE.Mesh(
      new THREE.BoxGeometry(26, 22 + (i % 3) * 8, 30),
      new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0xfef08a : 0xfbcfe8, roughness: 0.7 })
    );
    villa.position.set(0, 14, 0);
    villaGroup.add(villa);

    // Terracotta roof
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
      const treePos = pt.clone().addScaledVector(r, side * (28 + (Math.floor(t * 80) % 3) * 12));
      if (!isClearOfTrack(treePos, 22.0)) return;

      const treeGroup = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 14, 6), pineTrunkMat);
      trunk.position.set(0, 7, 0);
      treeGroup.add(trunk);

      // Layered pine cones
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
  const erPos = erPt.clone().addScaledVector(erR, -42);
  if (isClearOfTrack(erPos, 34)) {
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
    const tPos = pt.clone().addScaledVector(r, 34);
    if (!isClearOfTrack(tPos, 24.0)) continue;

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
  const bankingGeom = new THREE.TorusGeometry(180, 7.5, 8, 48, Math.PI * 0.7);
  const bankingMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.95 });
  const banking = new THREE.Mesh(bankingGeom, bankingMat);
  banking.position.set(120, 14, 280);
  banking.rotation.x = Math.PI / 2.3;
  banking.rotation.z = Math.PI / 6;
  group.add(banking);
}

// ==========================================
// SILVERSTONE: THE WING PADDOCK & AIRFIELD
// ==========================================
function buildSilverstoneEnvironment(
  curve: THREE.CatmullRomCurve3,
  isClearOfTrack: (pos: THREE.Vector3, minSafeRadius?: number) => boolean,
  group: THREE.Group
) {
  const up = new THREE.Vector3(0, 1, 0);
  // Silverstone Wing Architectural Paddock Complex
  const sPt = curve.getPointAt(0.01);
  const sTan = curve.getTangentAt(0.01).normalize();
  const sR = new THREE.Vector3().crossVectors(sTan, up).normalize();
  const wingPos = sPt.clone().addScaledVector(sR, -38);

  if (isClearOfTrack(wingPos, 34.0)) {
    const wingBuilding = new THREE.Group();
    // Angular Pit Building
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(95, 15, 24),
      new THREE.MeshStandardMaterial({ color: 0x1f242d, metalness: 0.75, roughness: 0.25 })
    );
    base.position.set(0, 7.5, 0);
    wingBuilding.add(base);

    // Iconic Soaring Asymmetric Roof
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(105, 2.0, 32),
      new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.85, roughness: 0.2 })
    );
    roof.position.set(0, 16.5, 0);
    roof.rotation.x = 0.14;
    wingBuilding.add(roof);

    wingBuilding.position.set(wingPos.x, sPt.y, wingPos.z);
    wingBuilding.lookAt(wingPos.clone().add(sTan));
    group.add(wingBuilding);
  }

  // Intersecting WWII RAF Airfield Runways
  const runwayGeom = new THREE.PlaneGeometry(38, 480);
  const runwayMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.9 });
  const runway = new THREE.Mesh(runwayGeom, runwayMat);
  runway.position.set(-60, 0.05, 120);
  runway.rotation.x = -Math.PI / 2;
  runway.rotation.z = Math.PI / 4;
  group.add(runway);
}

// ==========================================
// SUZUKA: 50M WONDER WHEEL & DUNLOP BRIDGE
// ==========================================
function buildSuzukaEnvironment(
  curve: THREE.CatmullRomCurve3,
  isClearOfTrack: (pos: THREE.Vector3, minSafeRadius?: number) => boolean,
  group: THREE.Group
) {
  // Giant Ferris Wheel behind the Esses (t = 0.22)
  const fPt = curve.getPointAt(0.22);
  const fwPos = fPt.clone().add(new THREE.Vector3(130, 0, -90));

  const wheelGroup = new THREE.Group();
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8, roughness: 0.3 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(36, 1.4, 8, 36), rimMat);
  rim.position.set(0, 42, 0);
  wheelGroup.add(rim);

  // Spokes & Hub
  for (let s = 0; s < 16; s++) {
    const spoke = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 72, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    spoke.position.set(0, 42, 0);
    spoke.rotation.z = (s / 16) * Math.PI;
    wheelGroup.add(spoke);

    // Gondola
    const angle = (s / 16) * Math.PI * 2;
    const gondola = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.8, 2.0),
      new THREE.MeshStandardMaterial({ color: s % 2 === 0 ? 0xffdd00 : 0xef4444 })
    );
    gondola.position.set(Math.sin(angle) * 36, 42 + Math.cos(angle) * 36, 0);
    wheelGroup.add(gondola);
  }

  // Support A-Frame legs
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

// ==========================================
// MIAMI: HARD ROCK STADIUM SPIRES & PALMS
// ==========================================
function buildMiamiEnvironment(
  curve: THREE.CatmullRomCurve3,
  isClearOfTrack: (pos: THREE.Vector3, minSafeRadius?: number) => boolean,
  group: THREE.Group
) {
  const sPt = curve.getPointAt(0.5);
  const stadiumCenter = sPt.clone().add(new THREE.Vector3(-150, 0, 100));

  // Hard Rock Stadium Structure
  const stadium = new THREE.Mesh(
    new THREE.CylinderGeometry(85, 95, 36, 24),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.4 })
  );
  stadium.position.set(stadiumCenter.x, sPt.y + 18, stadiumCenter.z);
  group.add(stadium);

  // 4 Iconic White Cable Spires
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

// ==========================================
// JEDDAH: CORNICHE RED SEA NIGHT
// ==========================================
function buildJeddahEnvironment(
  curve: THREE.CatmullRomCurve3,
  isClearOfTrack: (pos: THREE.Vector3, minSafeRadius?: number) => boolean,
  group: THREE.Group
) {
  // Red Sea Water alongside coastal stretch
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(360, 500),
    new THREE.MeshStandardMaterial({ color: 0x011627, roughness: 0.1, metalness: 0.9 })
  );
  sea.position.set(90, -0.2, 60);
  sea.rotation.x = -Math.PI / 2;
  group.add(sea);

  // Futuristic Glass Skyscrapers with Glowing Lines
  for (let b = 0; b < 6; b++) {
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(28, 90 + b * 18, 28),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.1 })
    );
    tower.position.set(-160 - b * 32, 45 + b * 9, -80 + b * 45);
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
  // Central Albert Park Lake
  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(130, 36),
    new THREE.MeshStandardMaterial({ color: 0x034078, roughness: 0.2, metalness: 0.8 })
  );
  lake.position.set(0, -0.2, 0);
  lake.rotation.x = -Math.PI / 2;
  group.add(lake);

  // Melbourne Glass High-Rise Towers on the Horizon
  for (let b = 0; b < 7; b++) {
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(32, 80 + (b % 4) * 22, 32),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 })
    );
    tower.position.set(220 + (b % 3) * 45, 40 + (b % 4) * 11, -180 + b * 55);
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
  // Sakhir Iconic 8-Floor Circular VIP Tower
  const sPt = curve.getPointAt(0.02);
  const towerPos = sPt.clone().add(new THREE.Vector3(-60, 0, 45));

  const towerGroup = new THREE.Group();
  for (let floor = 0; floor < 8; floor++) {
    const cylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(18 - floor * 0.8, 19 - floor * 0.8, 5.5, 24),
      new THREE.MeshStandardMaterial({ color: floor % 2 === 0 ? 0xffffff : 0x0f172a, metalness: 0.7, roughness: 0.3 })
    );
    cylinder.position.set(0, 3 + floor * 6.0, 0);
    towerGroup.add(cylinder);

    // Glowing LED rings
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
    const treePos = pt.clone().addScaledVector(r, 30);
    if (!isClearOfTrack(treePos, 22.0)) continue;

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), trunkMat);
    trunk.position.set(treePos.x, pt.y + 3.5, treePos.z);
    group.add(trunk);

    const foliage = new THREE.Mesh(new THREE.ConeGeometry(3.0, 8.5, 7), foliageMat);
    foliage.position.set(treePos.x, pt.y + 8.5, treePos.z);
    group.add(foliage);
  }
}
