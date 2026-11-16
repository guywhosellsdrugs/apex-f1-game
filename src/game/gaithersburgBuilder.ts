import * as THREE from 'three';
import {
  ALL_MARYLAND_ROADS,
  GAITHERSBURG_SIGNAL_JUNCTIONS,
  ICM_CAMPUS_ORIGIN,
  REDEEMER_CAMPUS_ORIGIN,
  gx,
  gz,
  distSqPointToSeg,
  isOnMarylandPavedSurface,
  buildPitchedRoofGroup,
  boxWithRoofMat,
} from './marylandRoadNetwork';
import {
  CityBuildingBox,
  BuiltSuburbanHouse,
  buildSuburbanHouseMesh,
} from './cityTrafficBuilder';

export interface GaithersburgBuilderContext {
  group: THREE.Group;
  sceneryGroup: THREE.Group;
  cityStreetRoadMeshes: THREE.Mesh[];
  cityBuildings: CityBuildingBox[];
  suburbanHouses: BuiltSuburbanHouse[];
  streetAsphaltMat: THREE.Material;
  whiteLineMat: THREE.Material;
  yellowLineMat: THREE.Material;
  sidewalkMat: THREE.Material;
  treeTrunkMat: THREE.Material;
  treeFoliageMat: THREE.Material;
  goldMat: THREE.Material;
  isUltra: boolean;
  isRetroPixel: boolean;
  makeCityMat: (opts: { color?: number; map?: THREE.Texture; roughness?: number; metalness?: number }) => THREE.Material;
  makeTextSignMat: (lines: string[], bgHex: string, fgHex: string, borderHex?: string) => THREE.Material;
  makeBrickFacadeMat: (
    brickHex: string,
    mortarHex: string,
    windowHex: string,
    cols: number,
    rows: number,
    warmLit?: boolean
  ) => THREE.Material;
  addStreetNamePost: (x: number, z: number, label: string, rotY?: number) => void;
  addLandscapedTree: (tx: number, tz: number, scale?: number) => void;
}

export function isOnGaithersburgPavedSurface(px: number, pz: number): boolean {
  if (pz < gz(1470) || pz > gz(2500) || px < gx(-740) || px > gx(740)) return false;
  return isOnMarylandPavedSurface(px, pz);
}

export function buildGaithersburgDistrict(ctx: GaithersburgBuilderContext): void {
  const {
    sceneryGroup,
    cityBuildings,
    suburbanHouses,
    streetAsphaltMat,
    whiteLineMat,
    treeTrunkMat,
    treeFoliageMat,
    isUltra,
    isRetroPixel,
    makeCityMat,
    makeTextSignMat,
    makeBrickFacadeMat,
    addStreetNamePost,
    addLandscapedTree,
  } = ctx;

  const waterMat = makeCityMat({ color: 0x075985, roughness: 0.16, metalness: 0.68 });
  const flatRoofMat = makeCityMat({ color: 0x334155, roughness: 0.86, metalness: 0.08 });

  const addRotatedCollider = (
    ox: number,
    oz: number,
    rotY: number,
    lx: number,
    lz: number,
    w: number,
    d: number,
    height: number,
    name: string
  ) => {
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    const wx = ox + lx * c + lz * s;
    const wz = oz - lx * s + lz * c;
    const hw = Math.abs(w * 0.5 * c) + Math.abs(d * 0.5 * s);
    const hd = Math.abs(w * 0.5 * s) + Math.abs(d * 0.5 * c);
    cityBuildings.push({
      minX: wx - hw,
      maxX: wx + hw,
      minZ: wz - hd,
      maxZ: wz + hd,
      height,
      name,
    });
  };

  const drawGaithParkingLot = (
    cx: number,
    cz: number,
    width: number,
    depth: number,
    rotY = 0,
    parent: THREE.Object3D = sceneryGroup,
    yPos = 0.25
  ) => {
    const lotGroup = new THREE.Group();
    lotGroup.position.set(cx, yPos, cz);
    lotGroup.rotation.y = rotY;
    const lotMat = makeCityMat({ color: 0x1e2430, roughness: 0.85, metalness: 0.08 });
    const lotPlane = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), lotMat);
    lotPlane.rotation.x = -Math.PI / 2;
    lotPlane.receiveShadow = !isUltra && !isRetroPixel;
    lotGroup.add(lotPlane);

    const stripeCount = Math.max(4, Math.floor(width / 6.0));
    for (let i = 0; i <= stripeCount; i++) {
      const sx = -width * 0.44 + (i / stripeCount) * width * 0.88;
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.18, depth * 0.34), whiteLineMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(sx, 0.016, -depth * 0.22);
      lotGroup.add(stripe);
      const stripeB = new THREE.Mesh(new THREE.PlaneGeometry(0.18, depth * 0.34), whiteLineMat);
      stripeB.rotation.x = -Math.PI / 2;
      stripeB.position.set(sx, 0.016, depth * 0.22);
      lotGroup.add(stripeB);
    }
    parent.add(lotGroup);
  };

  // Overhead I-270 Exit Green Highway Gantries aligned squarely across the I-270 centerline
  const i270GantryMat = makeCityMat({ color: 0x475569, roughness: 0.5, metalness: 0.7 });
  const i270RoadSpec = ALL_MARYLAND_ROADS.find((r) => r.id === 'i270_express');
  for (const gSpec of [
    { targetX: gx(-440), targetZ: gz(1620), lines: ['I-270 EXIT 11 · MONTGOMERY VILLAGE AVE', 'LAKEFOREST · LAKE WHETSTONE'] },
    { targetX: gx(-375), targetZ: gz(1850), lines: ['I-270 EXIT 10 · CLOPPER RD / DIAMOND AVE', 'OLDE TOWNE GAITHERSBURG · NIST'] },
    { targetX: gx(-295), targetZ: gz(2130), lines: ['I-270 EXIT 9 · I-370 / SAM EIG HWY', 'RIO LAKEFRONT · DOWNTOWN CROWN'] },
  ]) {
    let cx = gSpec.targetX;
    let cz = gSpec.targetZ;
    let roadAng = -0.28;
    if (i270RoadSpec) {
      let bestD = Infinity;
      for (let i = 0; i < i270RoadSpec.points.length - 1; i++) {
        const a = i270RoadSpec.points[i];
        const b = i270RoadSpec.points[i + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const lSq = dx * dx + dz * dz;
        const t = lSq > 0 ? Math.max(0, Math.min(1, ((gSpec.targetX - a.x) * dx + (gSpec.targetZ - a.z) * dz) / lSq)) : 0;
        const px = a.x + t * dx;
        const pz = a.z + t * dz;
        const d = (px - gSpec.targetX) * (px - gSpec.targetX) + (pz - gSpec.targetZ) * (pz - gSpec.targetZ);
        if (d < bestD) {
          bestD = d;
          cx = px;
          cz = pz;
          roadAng = Math.atan2(dx, dz);
        }
      }
    }
    const gWrap = new THREE.Group();
    gWrap.position.set(cx, 0.25, cz);
    gWrap.rotation.y = roadAng;
    for (const sx of [-21.5, 21.5]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 9.6, 8), i270GantryMat);
      leg.position.set(sx, 4.8, 0);
      gWrap.add(leg);
    }
    const truss = new THREE.Mesh(new THREE.BoxGeometry(44, 0.7, 0.7), i270GantryMat);
    truss.position.set(0, 9.2, 0);
    gWrap.add(truss);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(28, 3.3, 0.28),
      makeTextSignMat(gSpec.lines, '#065f46', '#ffffff', '#e2e8f0')
    );
    board.position.set(0, 9.2, 0.45);
    gWrap.add(board);
    sceneryGroup.add(gWrap);
  }

  // Late-1980s Gaithersburg Colonial / Split-Level Siding Materials & Detached Home Builder
  const makeSidingMat = (hexStr: string) => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const gCtx = c.getContext('2d');
    if (gCtx) {
      gCtx.fillStyle = hexStr;
      gCtx.fillRect(0, 0, 64, 64);
      gCtx.fillStyle = 'rgba(0, 0, 0, 0.14)';
      for (let y = 0; y < 64; y += 8) gCtx.fillRect(0, y, 64, 2);
      gCtx.fillStyle = 'rgba(255, 255, 255, 0.10)';
      for (let y = 2; y < 64; y += 8) gCtx.fillRect(0, y, 64, 1);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    tex.colorSpace = THREE.SRGBColorSpace;
    if (isRetroPixel) {
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;
    }
    return makeCityMat({ map: tex, roughness: 0.68, metalness: 0.04 });
  };

  const edSharedGrassMat = makeCityMat({ color: 0x26642b, roughness: 0.92 });
  const edSharedWhiteTrimMat = makeCityMat({ color: 0xf8fafc, roughness: 0.35 });
  const edSharedConcreteMat = makeCityMat({ color: 0x94a3b8, roughness: 0.78 });
  const edSharedFenceMat = makeCityMat({ color: 0x8d6e4c, roughness: 0.85 });
  const edSharedGlassMat = makeCityMat({ color: 0x1e3a5f, roughness: 0.16, metalness: 0.76 });
  const edSharedBrickAccMat = makeBrickFacadeMat('#8b3728', '#d6c8b8', '#0f172a', 4, 1, false);
  const edSharedMasonryMat = makeCityMat({ color: 0x8b3728, roughness: 0.78 });

  const buildEdinburghSingleFamilyHome = (opts: {
    x: number;
    z: number;
    rotY: number;
    houseNum: string;
    street: string;
    style: 'colonial' | 'split';
    sidingHex: string;
    roofColor: number;
    shutterColor: number;
    doorColor: number;
    brickFront?: boolean;
  }) => {
    const hGroup = new THREE.Group();
    hGroup.position.set(opts.x, 0.25, opts.z);
    hGroup.rotation.y = opts.rotY;

    const sidingMat = makeSidingMat(opts.sidingHex);
    const roofMat = makeCityMat({ color: opts.roofColor, roughness: 0.78 });
    const shutterMat = makeCityMat({ color: opts.shutterColor, roughness: 0.55 });
    const doorMat = makeCityMat({ color: opts.doorColor, roughness: 0.45 });

    const lawn = new THREE.Mesh(new THREE.BoxGeometry(17.5, 0.02, 17.5), edSharedGrassMat);
    lawn.position.set(0, -0.02, 0);
    hGroup.add(lawn);

    const driveway = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.02, 8.8), edSharedConcreteMat);
    driveway.position.set(3.8, -0.016, 4.4);
    hGroup.add(driveway);

    const walkPath = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.02, 7.2), edSharedConcreteMat);
    walkPath.position.set(-2.5, -0.016, 5.4);
    hGroup.add(walkPath);

    const isSplit = opts.style === 'split';
    const bodyW = 9.0;
    const bodyH = isSplit ? 4.7 : 5.7;
    const bodyD = 8.0;

    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyD), sidingMat);
    mainBody.position.set(-2.4, bodyH * 0.5 + 0.06, -1.6);
    mainBody.castShadow = !isRetroPixel;
    hGroup.add(mainBody);

    if (opts.brickFront) {
      const brickLower = new THREE.Mesh(new THREE.BoxGeometry(bodyW + 0.12, 2.7, 0.26), edSharedMasonryMat);
      brickLower.position.set(-2.4, 1.4, -1.6 + bodyD * 0.5 + 0.08);
      hGroup.add(brickLower);
    }

    const mainRoof = buildPitchedRoofGroup(bodyW + 0.3, bodyD + 0.3, 2.65, sidingMat, roofMat, 'x');
    mainRoof.position.set(-2.4, bodyH + 0.06, -1.6);
    hGroup.add(mainRoof);

    const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.05, 4.2, 1.25), edSharedMasonryMat);
    chimney.position.set(-7.25, bodyH + 1.15, -1.6);
    hGroup.add(chimney);

    const garW = 5.9;
    const garH = 3.5;
    const garD = 7.2;
    const garageBox = new THREE.Mesh(new THREE.BoxGeometry(garW, garH, garD), sidingMat);
    garageBox.position.set(3.9, garH * 0.5 + 0.06, -1.0);
    garageBox.castShadow = !isRetroPixel;
    hGroup.add(garageBox);

    const garRoof = buildPitchedRoofGroup(garW + 0.3, garD + 0.3, 2.0, sidingMat, roofMat, 'z');
    garRoof.position.set(3.9, garH + 0.06, -1.0);
    hGroup.add(garRoof);

    const gDoorZ = -1.0 + garD * 0.5;
    const garageDoor = new THREE.Mesh(new THREE.BoxGeometry(4.9, 2.5, 0.16), edSharedWhiteTrimMat);
    garageDoor.position.set(3.9, 1.3, gDoorZ + 0.04);
    hGroup.add(garageDoor);
    const gWindowStrip = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.36, 0.18), edSharedGlassMat);
    gWindowStrip.position.set(3.9, 2.2, gDoorZ + 0.06);
    hGroup.add(gWindowStrip);

    const frontZ = -1.6 + bodyD * 0.5;
    const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.26, 1.8), roofMat);
    porchRoof.position.set(-2.4, 3.0, frontZ + 0.85);
    hGroup.add(porchRoof);
    for (const px of [-3.75, -1.05]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.7, 0.22), edSharedWhiteTrimMat);
      col.position.set(px, 1.5, frontZ + 1.55);
      hGroup.add(col);
    }
    const porchStoop = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 1.8), edSharedConcreteMat);
    porchStoop.position.set(-2.4, 0.15, frontZ + 0.85);
    hGroup.add(porchStoop);

    const entryDoor = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.14), doorMat);
    entryDoor.position.set(-2.4, 1.2, frontZ + 0.05);
    hGroup.add(entryDoor);

    const winPositions: [number, number][] = isSplit
      ? [[-4.9, 2.8], [0.1, 2.8]]
      : [[-4.9, 1.6], [0.1, 1.6], [-4.9, 4.25], [-2.4, 4.25], [0.1, 4.25]];
    for (const [wx, wy] of winPositions) {
      const wFrame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.45, 0.1), edSharedWhiteTrimMat);
      wFrame.position.set(wx, wy + 0.06, frontZ + 0.03);
      hGroup.add(wFrame);
      const wGlass = new THREE.Mesh(new THREE.BoxGeometry(1.04, 1.18, 0.13), edSharedGlassMat);
      wGlass.position.set(wx, wy + 0.06, frontZ + 0.05);
      hGroup.add(wGlass);
      for (const shSide of [-1, 1]) {
        const shutter = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.42, 0.09), shutterMat);
        shutter.position.set(wx + shSide * 0.84, wy + 0.06, frontZ + 0.04);
        hGroup.add(shutter);
      }
    }

    if (!isRetroPixel) {
      const backFence = new THREE.Mesh(new THREE.BoxGeometry(17.2, 1.7, 0.2), edSharedFenceMat);
      backFence.position.set(0, 0.9, -7.8);
      hGroup.add(backFence);
    }

    // Realistic compact curbside mailbox (replaces giant yard/garage text sign spam)
    const mbPost = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.05, 0.1), edSharedWhiteTrimMat);
    mbPost.position.set(0.7, 0.52, 8.6);
    hGroup.add(mbPost);
    const mbBoxMat = makeCityMat({ color: 0x1e293b, roughness: 0.55, metalness: 0.35 });
    const mbBox = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.52), mbBoxMat);
    mbBox.position.set(0.7, 1.12, 8.6);
    hGroup.add(mbBox);

    sceneryGroup.add(hGroup);
    const dLocal = new THREE.Vector3(3.8, 0, 7.6);
    dLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), opts.rotY);

    const fullAddress = `${opts.houseNum} ${opts.street}`;
    const cRot = Math.cos(opts.rotY);
    const sRot = Math.sin(opts.rotY);
    const halfExtX = Math.abs(8.2 * cRot) + Math.abs(7.2 * sRot);
    const halfExtZ = Math.abs(8.2 * sRot) + Math.abs(7.2 * cRot);
    const collider = {
      minX: opts.x - halfExtX,
      maxX: opts.x + halfExtX,
      minZ: opts.z - halfExtZ,
      maxZ: opts.z + halfExtZ,
      height: 9.5,
      name: fullAddress,
    };
    suburbanHouses.push({
      group: hGroup,
      collider,
      drivewayTarget: { x: opts.x + dLocal.x, z: opts.z + dLocal.z },
      drivewayCoord: { x: opts.x + dLocal.x, z: opts.z + dLocal.z },
      address: fullAddress,
    });
    cityBuildings.push(collider);
  };

  // =========================================================================================
  // 4. ISLAMIC CENTER OF MARYLAND (19411 Woodfield Rd) — EAST SIDE OF DIAGONAL WOODFIELD RD
  //    Smaller Front Musalla -> Outdoor Basketball Court -> Bigger 2-Story Back Center (NO DOME)
  // =========================================================================================
  {
    const icmGroup = new THREE.Group();
    icmGroup.position.set(ICM_CAMPUS_ORIGIN.x, 0.25, ICM_CAMPUS_ORIGIN.z);
    icmGroup.rotation.y = ICM_CAMPUS_ORIGIN.rotY;

    const icmStuccoWallMat = makeCityMat({ color: 0xe6dac4, roughness: 0.72 });
    const icmWarmAccentMat = makeCityMat({ color: 0xc2ab8a, roughness: 0.68 });
    const icmSandBrickMat = makeCityMat({ color: 0xbfa07e, roughness: 0.76 });
    const icmLimestoneMat = makeCityMat({ color: 0xefe7d6, roughness: 0.62 });
    const icmDarkParapetMat = makeCityMat({ color: 0x262d38, roughness: 0.65, metalness: 0.18 });
    const icmSlateRoofMat = makeCityMat({ color: 0x2b323d, roughness: 0.78 });
    const icmGlassMat = makeCityMat({ color: 0x162b42, roughness: 0.16, metalness: 0.82 });

    drawGaithParkingLot(86, -32, 120, 26, 0, icmGroup, 0.008);
    drawGaithParkingLot(66, 32, 78, 18, 0, icmGroup, 0.008);
    const westApron = new THREE.Mesh(new THREE.PlaneGeometry(14, 80), streetAsphaltMat);
    westApron.rotation.x = -Math.PI / 2;
    westApron.position.set(30, -0.006, -2);
    icmGroup.add(westApron);
    for (const dz of [-34, 32]) {
      const drive = new THREE.Mesh(new THREE.PlaneGeometry(18, 12), streetAsphaltMat);
      drive.rotation.x = -Math.PI / 2;
      drive.position.set(18, -0.006, dz);
      icmGroup.add(drive);
    }

    // 4A. Smaller Front Musalla Building (pitched gable roof, NO dome)
    const musalla = new THREE.Group();
    musalla.position.set(46, 0, 6);
    const mBase = new THREE.Mesh(new THREE.BoxGeometry(19, 1.5, 17), icmSandBrickMat);
    mBase.position.set(0, 0.75, 0);
    musalla.add(mBase);
    const mWalls = new THREE.Mesh(new THREE.BoxGeometry(18.5, 4.4, 16.5), icmStuccoWallMat);
    mWalls.position.set(0, 3.6, 0);
    mWalls.castShadow = !isRetroPixel;
    musalla.add(mWalls);
    const mGable = buildPitchedRoofGroup(18.8, 16.8, 3.4, icmStuccoWallMat, icmSlateRoofMat, 'x');
    mGable.position.set(0, 5.8, 0);
    musalla.add(mGable);
    const mPorch = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.45, 7.2), icmWarmAccentMat);
    mPorch.position.set(-10.8, 3.6, 0);
    musalla.add(mPorch);
    for (const pz of [-2.8, 2.8]) {
      const porchCol = new THREE.Mesh(new THREE.BoxGeometry(0.45, 3.6, 0.45), icmLimestoneMat);
      porchCol.position.set(-12.2, 1.8, pz);
      musalla.add(porchCol);
    }
    const mDoor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.0, 3.4), icmGlassMat);
    mDoor.position.set(-9.3, 1.8, 0);
    musalla.add(mDoor);
    // Crisp windows along Front Musalla North, South, East, West walls
    for (const wx of [-5.2, 0, 5.2]) {
      for (const wz of [-8.3, 8.3]) {
        const winSide = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.0, 0.2), icmGlassMat);
        winSide.position.set(wx, 3.6, wz);
        musalla.add(winSide);
      }
    }
    for (const wz of [-5.2, 5.2]) {
      const winEnd = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.0, 2.4), icmGlassMat);
      winEnd.position.set(-9.3, 3.6, wz);
      musalla.add(winEnd);
    }
    const mSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 1.3, 10.6),
      makeTextSignMat(['ICM FRONT MUSALLA', '19411 WOODFIELD RD · DAILY PRAYERS'], '#064e3b', '#fef3c7', '#e7dcc8')
    );
    mSign.position.set(-12.7, 4.05, 0);
    musalla.add(mSign);
    icmGroup.add(musalla);
    addRotatedCollider(ICM_CAMPUS_ORIGIN.x, ICM_CAMPUS_ORIGIN.z, ICM_CAMPUS_ORIGIN.rotY, 46, 6, 20, 18, 10, 'ICM Front Musalla (19411 Woodfield Rd)');

    // 4B. Outdoor Fenced Basketball Court directly between Front Musalla & Back Main Building
    const courtGroup = new THREE.Group();
    courtGroup.position.set(82, 0.02, 6);
    const courtSurf = new THREE.Mesh(new THREE.BoxGeometry(30, 0.08, 19), makeCityMat({ color: 0x1e3a5f, roughness: 0.72 }));
    courtGroup.add(courtSurf);
    const courtOuter = new THREE.Mesh(new THREE.BoxGeometry(33, 0.06, 21.5), makeCityMat({ color: 0x166534, roughness: 0.85 }));
    courtOuter.position.set(0, -0.01, 0);
    courtGroup.add(courtOuter);
    const halfLine = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 18.6), whiteLineMat);
    halfLine.rotation.x = -Math.PI / 2;
    halfLine.position.set(0, 0.05, 0);
    courtGroup.add(halfLine);
    const cRing = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.3, 20), whiteLineMat);
    cRing.rotation.x = -Math.PI / 2;
    cRing.position.set(0, 0.05, 0);
    courtGroup.add(cRing);
    // Chain-link perimeter fence posts & rails around court
    for (const fz of [-10.7, 10.7]) {
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(33.2, 0.14, 0.14), icmDarkParapetMat);
      topRail.position.set(0, 2.6, fz);
      courtGroup.add(topRail);
      for (let fx = -16.5; fx <= 16.5; fx += 5.5) {
        const fPost = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.7, 6), icmDarkParapetMat);
        fPost.position.set(fx, 1.35, fz);
        courtGroup.add(fPost);
      }
    }
    for (const endDir of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 3.7, 8), icmDarkParapetMat);
      post.position.set(endDir * 14.5, 1.85, 0);
      courtGroup.add(post);
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.35, 2.0), edSharedWhiteTrimMat);
      board.position.set(endDir * 13.4, 3.4, 0);
      courtGroup.add(board);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 6, 12), makeCityMat({ color: 0xf97316 }));
      rim.rotation.x = Math.PI / 2;
      rim.position.set(endDir * 13.0, 2.95, 0);
      courtGroup.add(rim);
    }
    icmGroup.add(courtGroup);

    // 4C. Bigger 2-Story Sand-Beige Back Main Center Building (Academy, Multipurpose Hall, Clinic — NO dome)
    const backBody = new THREE.Mesh(new THREE.BoxGeometry(58, 12.6, 54), boxWithRoofMat(icmStuccoWallMat, flatRoofMat));
    backBody.position.set(138, 6.8, 6);
    backBody.castShadow = !isRetroPixel;
    icmGroup.add(backBody);
    const backSkirt = new THREE.Mesh(new THREE.BoxGeometry(58.3, 4.2, 54.3), icmSandBrickMat);
    backSkirt.position.set(138, 2.6, 6);
    icmGroup.add(backSkirt);
    const backBelt = new THREE.Mesh(new THREE.BoxGeometry(58.8, 0.7, 54.8), icmLimestoneMat);
    backBelt.position.set(138, 5.1, 6);
    icmGroup.add(backBelt);
    const backParapet = new THREE.Mesh(new THREE.BoxGeometry(59.2, 1.0, 55.2), icmDarkParapetMat);
    backParapet.position.set(138, 13.4, 6);
    icmGroup.add(backParapet);
    const backCanopy = new THREE.Mesh(new THREE.BoxGeometry(7.8, 1.0, 16), icmLimestoneMat);
    backCanopy.position.set(105, 5.6, 6);
    icmGroup.add(backCanopy);
    for (const px of [102.2, 102.2]) {
      for (const pz of [-0.8, 12.8]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.7, 5.1, 0.7), icmLimestoneMat);
        col.position.set(px, 2.55, pz);
        icmGroup.add(col);
      }
    }
    for (const wz of [-16, -6, 18, 26]) {
      const bayGlass = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7.2, 3.8), icmGlassMat);
      bayGlass.position.set(108.8, 7.5, wz);
      icmGroup.add(bayGlass);
    }
    // 2nd-story windows along North & South elevations + rooftop HVAC units (flat roof, NO dome)
    for (let bx = 116; bx <= 160; bx += 11) {
      for (const bz of [-21.1, 33.1]) {
        const win2 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.8, 0.25), icmGlassMat);
        win2.position.set(bx, 9.2, bz);
        icmGroup.add(win2);
      }
    }
    for (const hx of [128, 148]) {
      const hvac = new THREE.Mesh(new THREE.BoxGeometry(5.5, 1.8, 4.5), icmDarkParapetMat);
      hvac.position.set(hx, 14.3, 6);
      icmGroup.add(hvac);
    }
    const backSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 1.8, 14.8),
      makeTextSignMat(['ISLAMIC CENTER OF MARYLAND · MAIN CENTER', 'ICM ACADEMY · HALL & COMMUNITY CLINIC'], '#064e3b', '#fef3c7', '#e7dcc8')
    );
    backSign.position.set(101.0, 5.75, 6);
    icmGroup.add(backSign);
    addRotatedCollider(ICM_CAMPUS_ORIGIN.x, ICM_CAMPUS_ORIGIN.z, ICM_CAMPUS_ORIGIN.rotY, 138, 6, 60, 56, 15, 'Islamic Center of Maryland — Main Center');

    const icmMonBase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 12.5), icmSandBrickMat);
    icmMonBase.position.set(25.5, 1.2, 0);
    icmGroup.add(icmMonBase);
    const icmMonFace = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 1.75, 11.4),
      makeTextSignMat(['ISLAMIC CENTER OF MARYLAND', '19411 WOODFIELD RD · MUSALLA & MAIN CENTER'], '#064e3b', '#fef3c7', '#e5dccb')
    );
    icmMonFace.position.set(24.6, 1.6, 0);
    icmGroup.add(icmMonFace);

    sceneryGroup.add(icmGroup);
  }

  // =========================================================================================
  // 5. CHURCH OF THE REDEEMER (19425 Woodfield Rd) — IMMEDIATELY NNE OF ICM (ZERO STEEPLE!)
  // =========================================================================================
  {
    const redGroup = new THREE.Group();
    redGroup.position.set(REDEEMER_CAMPUS_ORIGIN.x, 0.25, REDEEMER_CAMPUS_ORIGIN.z);
    redGroup.rotation.y = REDEEMER_CAMPUS_ORIGIN.rotY;

    const redBeigeBrickMat = makeBrickFacadeMat('#c2a889', '#e5dccb', '#1e293b', 8, 2, false);
    const redMasonryMat = makeCityMat({ color: 0xc2a889, roughness: 0.76 });
    const redStonePanelMat = makeCityMat({ color: 0xddd2be, roughness: 0.64 });
    const redAtriumGlassMat = makeCityMat({ color: 0x16324f, roughness: 0.14, metalness: 0.82 });

    for (const lx of [28, 56, 86, 116, 146]) {
      const c = Math.cos(REDEEMER_CAMPUS_ORIGIN.rotY);
      const s = Math.sin(REDEEMER_CAMPUS_ORIGIN.rotY);
      const wx = REDEEMER_CAMPUS_ORIGIN.x + lx * c + 46 * s;
      const wz = REDEEMER_CAMPUS_ORIGIN.z - lx * s + 46 * c;
      addLandscapedTree(wx, wz, 0.94);
    }

    drawGaithParkingLot(64, -4, 52, 58, 0, redGroup, 0.008);
    drawGaithParkingLot(114, -29, 48, 16, 0, redGroup, 0.008);
    for (const dz of [-24, 20]) {
      const rDrive = new THREE.Mesh(new THREE.PlaneGeometry(24, 12), streetAsphaltMat);
      rDrive.rotation.x = -Math.PI / 2;
      rDrive.position.set(22, -0.006, dz);
      redGroup.add(rDrive);
    }

    const redAudit = new THREE.Mesh(new THREE.BoxGeometry(58, 13.8, 48), boxWithRoofMat(redBeigeBrickMat, flatRoofMat));
    redAudit.position.set(126, 6.9, 2);
    redAudit.castShadow = !isRetroPixel;
    redGroup.add(redAudit);
    const redClerestory = new THREE.Mesh(new THREE.BoxGeometry(50, 3.0, 40), redStonePanelMat);
    redClerestory.position.set(130, 15.0, 2);
    redGroup.add(redClerestory);
    const redNorthWing = new THREE.Mesh(new THREE.BoxGeometry(38, 9.2, 18), redStonePanelMat);
    redNorthWing.position.set(132, 4.6, -29);
    redGroup.add(redNorthWing);

    const redAtrium = new THREE.Mesh(new THREE.BoxGeometry(7.2, 11.0, 30), redAtriumGlassMat);
    redAtrium.position.set(93.5, 5.5, 2);
    redGroup.add(redAtrium);
    const porteRoof = new THREE.Mesh(new THREE.BoxGeometry(13.5, 1.0, 22), redStonePanelMat);
    porteRoof.position.set(84, 5.2, 2);
    redGroup.add(porteRoof);
    for (const pz of [-7.5, 11.5]) {
      for (const px of [78.5, 89.0]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(1.0, 5.0, 1.0), redMasonryMat);
        col.position.set(px, 2.5, pz);
        redGroup.add(col);
      }
    }
    const redSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 1.7, 16.5),
      makeTextSignMat(['CHURCH OF THE REDEEMER', '19425 WOODFIELD RD · WORSHIP & RKIDS'], '#1e293b', '#f8fafc', '#cbd5e1')
    );
    redSign.position.set(77.0, 5.4, 2);
    redGroup.add(redSign);
    const redMonBase = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 12.0), redMasonryMat);
    redMonBase.position.set(20, 1.1, -2);
    redGroup.add(redMonBase);
    const redMonFace = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 1.65, 11.2),
      makeTextSignMat(['CHURCH OF THE REDEEMER', '19425 WOODFIELD RD'], '#1e293b', '#f8fafc', '#cbd5e1')
    );
    redMonFace.position.set(19.1, 1.4, -2);
    redGroup.add(redMonFace);

    addRotatedCollider(REDEEMER_CAMPUS_ORIGIN.x, REDEEMER_CAMPUS_ORIGIN.z, REDEEMER_CAMPUS_ORIGIN.rotY, 126, 2, 60, 50, 17, 'Church of the Redeemer (19425 Woodfield Rd)');
    sceneryGroup.add(redGroup);
  }

  // =========================================================================================
  // 6. EMORY GROVE & EMORY CHURCH RD
  // =========================================================================================
  {
    const railWoodMat = makeCityMat({ color: 0x6b4c35, roughness: 0.88 });
    for (const [fx, fz] of [[gx(338), gz(1808)], [gx(314), gz(1884)]] as [number, number][]) {
      const fTop = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 24), railWoodMat);
      fTop.rotation.y = -0.336;
      fTop.position.set(fx, 1.2, fz);
      sceneryGroup.add(fTop);
    }
    const emoryPlots: [number, number, number][] = [
      [gx(304), gz(1826), -0.24],
      [gx(252), gz(1840), -0.24],
      [gx(204), gz(1854), -0.24],
      [gx(296), gz(1888), Math.PI - 0.24],
      [gx(246), gz(1900), Math.PI - 0.24],
      [gx(196), gz(1914), Math.PI - 0.24],
    ];
    emoryPlots.forEach(([ex, ez, rotY], idx) => {
      buildEdinburghSingleFamilyHome({
        x: ex,
        z: ez,
        rotY,
        houseNum: `${7204 + idx * 4}`,
        street: 'Emory Church Rd',
        style: idx % 2 === 0 ? 'colonial' : 'split',
        sidingHex: ['#e7dec8', '#cbd5e1', '#d6ccb8'][idx % 3],
        roofColor: 0x292524,
        shutterColor: 0x14532d,
        doorColor: 0x7f1d1d,
        brickFront: idx % 2 === 0,
      });
    });
    addStreetNamePost(gx(326), gz(1860), 'EMORY CHURCH RD', 0);
  }

  // =========================================================================================
  // 7. EDINBURGH VILLAGE (Compact Pocket Community: ~9 Detached 1986-1988 Homes — ZERO Townhomes)
  // =========================================================================================
  {
    const edBrickMat = makeCityMat({ color: 0x8f3a2e, roughness: 0.65 });
    for (const [px, pz] of [[gx(434), gz(1656)], [gx(430), gz(1672)]] as [number, number][]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.9, 1.4), edBrickMat);
      p.position.set(px, 1.15, pz);
      sceneryGroup.add(p);
    }
    const edSignFace = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.95, 3.8),
      makeTextSignMat(['EDINBURGH VILLAGE', 'BRENISH DR · KILDONAN DR'], '#14532d', '#f8fafc', '#d4d4d8')
    );
    edSignFace.rotation.y = -0.336;
    edSignFace.position.set(gx(434), 1.25, gz(1652));
    sceneryGroup.add(edSignFace);

    const totMulch = new THREE.Mesh(new THREE.BoxGeometry(10, 0.02, 8), makeCityMat({ color: 0x78350f, roughness: 0.95 }));
    totMulch.position.set(gx(490), 0.232, gz(1642));
    sceneryGroup.add(totMulch);
    const pergolaRoof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.5, 4), makeCityMat({ color: 0x0ea5e9, roughness: 0.5 }));
    pergolaRoof.rotation.y = Math.PI / 4;
    pergolaRoof.position.set(gx(490), 3.2, gz(1642));
    sceneryGroup.add(pergolaRoof);

    const edinburghDetachedHomes: Parameters<typeof buildEdinburghSingleFamilyHome>[0][] = [
      { x: gx(468), z: gz(1599), rotY: 0, houseNum: '19620', street: 'Kildonan Dr', style: 'colonial', sidingHex: '#94a3b8', roofColor: 0x1e293b, shutterColor: 0x1e3a8a, doorColor: 0x1e3a8a, brickFront: true },
      { x: gx(492), z: gz(1598), rotY: 0, houseNum: '19622', street: 'Kildonan Dr', style: 'colonial', sidingHex: '#cbd5e1', roofColor: 0x1e293b, shutterColor: 0x0f172a, doorColor: 0x7f1d1d, brickFront: true },
      { x: gx(516), z: gz(1602), rotY: -0.25, houseNum: '19628', street: 'Kildonan Dr', style: 'split', sidingHex: '#e7dec8', roofColor: 0x3b2f2f, shutterColor: 0x14532d, doorColor: 0x14532d },
      { x: gx(543), z: gz(1632), rotY: -Math.PI / 2, houseNum: '19615', street: 'Kildonan Dr', style: 'split', sidingHex: '#e2d9c8', roofColor: 0x3f2e21, shutterColor: 0x14532d, doorColor: 0x14532d, brickFront: true },
      { x: gx(544), z: gz(1656), rotY: -Math.PI / 2, houseNum: '19611', street: 'Kildonan Dr', style: 'colonial', sidingHex: '#cbd5e1', roofColor: 0x0f172a, shutterColor: 0x1e293b, doorColor: 0x7f1d1d },

      { x: gx(448), z: gz(1685), rotY: Math.PI, houseNum: '7421', street: 'Brenish Dr', style: 'colonial', sidingHex: '#e5dec9', roofColor: 0x3b2f2f, shutterColor: 0x14532d, doorColor: 0x14532d },
      { x: gx(472), z: gz(1685), rotY: Math.PI, houseNum: '7508', street: 'Brenish Dr', style: 'colonial', sidingHex: '#b8c4d0', roofColor: 0x1e293b, shutterColor: 0x1e3a8a, doorColor: 0x1e3a8a },
      { x: gx(515), z: gz(1687), rotY: -Math.PI / 2, houseNum: '7528', street: 'Tarfside Ln', style: 'split', sidingHex: '#d6ccb8', roofColor: 0x292524, shutterColor: 0x0f172a, doorColor: 0x7f1d1d, brickFront: true },
      { x: gx(494), z: gz(1711), rotY: Math.PI, houseNum: '7530', street: 'Tarfside Ln', style: 'colonial', sidingHex: '#f1f5f9', roofColor: 0x1e293b, shutterColor: 0x1e3a8a, doorColor: 0x1e3a8a, brickFront: true },
    ];
    for (const eh of edinburghDetachedHomes) buildEdinburghSingleFamilyHome(eh);
    addStreetNamePost(gx(426), gz(1660), 'BRENISH DR', 0);
  }

  // =========================================================================================
  // 8. HADLEY FARMS (Expansive Master Community: 25 Detached Homes, 5 Brick Townhome Rows,
  //    Judith A. Resnik Elementary School, Community Pool & Tennis Courts)
  // =========================================================================================
  {
    const hfBrickMat = makeCityMat({ color: 0x8f3a2e, roughness: 0.65 });
    for (const [px, pz] of [[gx(464), gz(1572)], [gx(470), gz(1564)]] as [number, number][]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.0, 1.5), hfBrickMat);
      p.position.set(px, 1.2, pz);
      sceneryGroup.add(p);
    }
    const hfSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 1.0, 4.6),
      makeTextSignMat(['HADLEY FARMS', 'HADLEY FARMS DR · RESNIK ES'], '#14532d', '#f8fafc', '#d4d4d8')
    );
    hfSign.rotation.y = -0.336;
    hfSign.position.set(gx(467), 1.25, gz(1568));
    sceneryGroup.add(hfSign);

    const tennis = new THREE.Mesh(new THREE.BoxGeometry(14, 0.02, 14), makeCityMat({ color: 0x15803d, roughness: 0.88 }));
    tennis.position.set(gx(526), 0.232, gz(1532));
    sceneryGroup.add(tennis);
    const clubWallMat = makeSidingMat('#e6decb');
    const clubRoofMat = makeCityMat({ color: 0x292524, roughness: 0.78 });
    const clubHouse = new THREE.Mesh(new THREE.BoxGeometry(16, 4.8, 10), clubWallMat);
    clubHouse.position.set(gx(526), 2.65, gz(1552));
    sceneryGroup.add(clubHouse);
    const clubRoof = buildPitchedRoofGroup(16.4, 10.4, 2.2, clubWallMat, clubRoofMat, 'x');
    clubRoof.position.set(gx(526), 5.05, gz(1552));
    sceneryGroup.add(clubRoof);
    const poolWater = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), makeCityMat({ color: 0x0ea5e9, roughness: 0.14, metalness: 0.45 }));
    poolWater.rotation.x = -Math.PI / 2;
    poolWater.position.set(gx(526), 0.28, gz(1568));
    sceneryGroup.add(poolWater);
    cityBuildings.push({ minX: gx(518), maxX: gx(534), minZ: gz(1546), maxZ: gz(1558), height: 7, name: 'Hadley Farms Community Pool & Clubhouse' });

    drawGaithParkingLot(gx(578), gz(1554), 22, 34, 0);
    const schGroup = new THREE.Group();
    schGroup.position.set(gx(610), 0.25, gz(1552));
    const schBrickMat = makeBrickFacadeMat('#9b3b2c', '#e5e7eb', '#1e3a5f', 7, 2, false);
    const schTrimMat = makeCityMat({ color: 0xede5d4, roughness: 0.58 });
    const mainWing = new THREE.Mesh(new THREE.BoxGeometry(30, 7.4, 20), boxWithRoofMat(schBrickMat, flatRoofMat));
    mainWing.position.set(0, 3.7, -3);
    mainWing.castShadow = !isRetroPixel;
    schGroup.add(mainWing);
    const gymWing = new THREE.Mesh(new THREE.BoxGeometry(20, 8.8, 14), schTrimMat);
    gymWing.position.set(-5, 4.4, 11);
    schGroup.add(gymWing);
    const schSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 1.2, 9.6),
      makeTextSignMat(['JUDITH A. RESNIK ES', '7301 HADLEY FARMS DR'], '#1e3a8a', '#f8fafc', '#fde047')
    );
    schSign.position.set(-15.4, 4.6, -3);
    schGroup.add(schSign);
    sceneryGroup.add(schGroup);
    cityBuildings.push({ minX: gx(594), maxX: gx(626), minZ: gz(1538), maxZ: gz(1572), height: 10, name: 'Judith A. Resnik Elementary School (7301 Hadley Farms Dr)' });

    const hadleyHomes: Parameters<typeof buildEdinburghSingleFamilyHome>[0][] = [
      // Pompano Ter
      { x: gx(514), z: gz(1476), rotY: Math.PI / 2, houseNum: '19702', street: 'Pompano Ter', style: 'colonial', sidingHex: '#e7dec8', roofColor: 0x1e293b, shutterColor: 0x14532d, doorColor: 0x14532d, brickFront: true },
      { x: gx(520), z: gz(1444), rotY: Math.PI / 2, houseNum: '19708', street: 'Pompano Ter', style: 'split', sidingHex: '#cbd5e1', roofColor: 0x292524, shutterColor: 0x0f172a, doorColor: 0x7f1d1d },
      { x: gx(544), z: gz(1420), rotY: 0, houseNum: '19714', street: 'Pompano Ter', style: 'colonial', sidingHex: '#f1f5f9', roofColor: 0x1e293b, shutterColor: 0x1e3a8a, doorColor: 0x1e3a8a, brickFront: true },
      { x: gx(558), z: gz(1452), rotY: -Math.PI / 2, houseNum: '19711', street: 'Pompano Ter', style: 'colonial', sidingHex: '#d6ccb8', roofColor: 0x3b2f2f, shutterColor: 0x14532d, doorColor: 0x7c2d12 },
      // Filbert Ter
      { x: gx(584), z: gz(1391), rotY: 0, houseNum: '7312', street: 'Filbert Ter', style: 'colonial', sidingHex: '#f1f5f9', roofColor: 0x292524, shutterColor: 0x1e3a8a, doorColor: 0x1e3a8a, brickFront: true },
      { x: gx(600), z: gz(1416), rotY: -Math.PI / 2, houseNum: '7315', street: 'Filbert Ter', style: 'split', sidingHex: '#e2d9c8', roofColor: 0x3b2f2f, shutterColor: 0x14532d, doorColor: 0x14532d },
      { x: gx(600), z: gz(1444), rotY: -Math.PI / 2, houseNum: '7319', street: 'Filbert Ter', style: 'colonial', sidingHex: '#b8c4d0', roofColor: 0x1e293b, shutterColor: 0x0f172a, doorColor: 0x7f1d1d, brickFront: true },
      // Cinnabar Ter
      { x: gx(621), z: gz(1428), rotY: Math.PI / 2, houseNum: '19708', street: 'Cinnabar Ter', style: 'split', sidingHex: '#cbd5e1', roofColor: 0x292524, shutterColor: 0x0f172a, doorColor: 0x7f1d1d },
      { x: gx(638), z: gz(1391), rotY: 0, houseNum: '19712', street: 'Cinnabar Ter', style: 'colonial', sidingHex: '#d6ccb8', roofColor: 0x1e293b, shutterColor: 0x1e3a8a, doorColor: 0x1e3a8a, brickFront: true },
      { x: gx(654), z: gz(1416), rotY: -Math.PI / 2, houseNum: '19715', street: 'Cinnabar Ter', style: 'colonial', sidingHex: '#f1f5f9', roofColor: 0x1f2937, shutterColor: 0x7f1d1d, doorColor: 0x7f1d1d, brickFront: true },
      // Barcellona Dr
      { x: gx(674), z: gz(1422), rotY: 0, houseNum: '19808', street: 'Barcellona Dr', style: 'split', sidingHex: '#e5dec9', roofColor: 0x3b2f2f, shutterColor: 0x14532d, doorColor: 0x14532d },
      { x: gx(694), z: gz(1445), rotY: -Math.PI / 2, houseNum: '19812', street: 'Barcellona Dr', style: 'colonial', sidingHex: '#f1f5f9', roofColor: 0x1e293b, shutterColor: 0x1e3a8a, doorColor: 0x7f1d1d, brickFront: true },
      // Hadley Farms Dr (Outer East & South Perimeter)
      { x: gx(698), z: gz(1498), rotY: -Math.PI / 2, houseNum: '7310', street: 'Hadley Farms Dr', style: 'colonial', sidingHex: '#cbd5e1', roofColor: 0x1e293b, shutterColor: 0x0f172a, doorColor: 0x1e3a8a, brickFront: true },
      { x: gx(704), z: gz(1528), rotY: -Math.PI / 2, houseNum: '7314', street: 'Hadley Farms Dr', style: 'colonial', sidingHex: '#f1f5f9', roofColor: 0x1f2937, shutterColor: 0x111827, doorColor: 0x7f1d1d, brickFront: true },
      { x: gx(704), z: gz(1562), rotY: -Math.PI / 2, houseNum: '7318', street: 'Hadley Farms Dr', style: 'split', sidingHex: '#d9d0be', roofColor: 0x292524, shutterColor: 0x78350f, doorColor: 0x7c2d12 },
      { x: gx(704), z: gz(1602), rotY: -Math.PI / 2, houseNum: '7322', street: 'Hadley Farms Dr', style: 'split', sidingHex: '#e2d9c8', roofColor: 0x3b2f2f, shutterColor: 0x14532d, doorColor: 0x14532d },
      { x: gx(694), z: gz(1642), rotY: -Math.PI / 2, houseNum: '7326', street: 'Hadley Farms Dr', style: 'colonial', sidingHex: '#94a3b8', roofColor: 0x1e293b, shutterColor: 0x0f172a, doorColor: 0x7f1d1d, brickFront: true },
      { x: gx(672), z: gz(1682), rotY: Math.PI, houseNum: '7330', street: 'Hadley Farms Dr', style: 'colonial', sidingHex: '#e7dec8', roofColor: 0x292524, shutterColor: 0x14532d, doorColor: 0x14532d, brickFront: true },
      { x: gx(642), z: gz(1692), rotY: Math.PI, houseNum: '7334', street: 'Hadley Farms Dr', style: 'split', sidingHex: '#cbd5e1', roofColor: 0x1e293b, shutterColor: 0x7f1d1d, doorColor: 0x7f1d1d },
      { x: gx(612), z: gz(1695), rotY: Math.PI, houseNum: '7338', street: 'Hadley Farms Dr', style: 'colonial', sidingHex: '#f1f5f9', roofColor: 0x1e293b, shutterColor: 0x1e3a8a, doorColor: 0x1e3a8a, brickFront: true },
      { x: gx(582), z: gz(1690), rotY: Math.PI, houseNum: '7342', street: 'Hadley Farms Dr', style: 'colonial', sidingHex: '#d6ccb8', roofColor: 0x3b2f2f, shutterColor: 0x14532d, doorColor: 0x7c2d12 },
      // Bitterroot Ct & Elioak Ter cul-de-sac homes
      { x: gx(588), z: gz(1608), rotY: 0, houseNum: '19705', street: 'Bitterroot Ct', style: 'colonial', sidingHex: '#ede6d8', roofColor: 0x1e293b, shutterColor: 0x14532d, doorColor: 0x14532d, brickFront: true },
      { x: gx(606), z: gz(1653), rotY: -Math.PI / 2, houseNum: '19709', street: 'Elioak Ter', style: 'split', sidingHex: '#93a8bd', roofColor: 0x292524, shutterColor: 0x0f172a, doorColor: 0x1e3a8a },
    ];
    for (const hh of hadleyHomes) buildEdinburghSingleFamilyHome(hh);

    const hfThBrick = makeBrickFacadeMat('#8b3728', '#f1f5f9', '#1e293b', 6, 3, false);
    const hfThRoof = makeCityMat({ color: 0x1e293b, roughness: 0.75 });
    for (const [tx, tz, rotY, label] of [
      [gx(674), gz(1474), 0, 'Barcellona Dr Townhomes (Hadley Farms)'],
      [gx(656), gz(1556), 0, 'Plum Orchard Ct Townhomes (Hadley Farms)'],
      [gx(614), gz(1622), 0, 'Elioak Terrace Townhomes (Hadley Farms)'],
      [gx(554), gz(1614), 0, 'Hadley Farms Village Townhomes'],
      [gx(564), gz(1510), 0, 'Hadley Farms North Townhomes'],
    ] as [number, number, number, string][]) {
      const thGrp = new THREE.Group();
      thGrp.position.set(tx, 0.25, tz);
      thGrp.rotation.y = rotY;
      const thRow = new THREE.Mesh(new THREE.BoxGeometry(22, 8.0, 10), boxWithRoofMat(hfThBrick, flatRoofMat));
      thRow.position.set(0, 4.0, 0);
      thGrp.add(thRow);
      const thRoof = buildPitchedRoofGroup(22.4, 10.4, 2.8, hfThBrick, hfThRoof, 'x');
      thRoof.position.set(0, 8.0, 0);
      thGrp.add(thRoof);
      sceneryGroup.add(thGrp);
      cityBuildings.push({ minX: tx - 12, maxX: tx + 12, minZ: tz - 6, maxZ: tz + 6, height: 11, name: label });
    }
    addStreetNamePost(gx(466), gz(1548), 'HADLEY FARMS DR', 0);
  }

  // =========================================================================================
  // 9. KGAI MONTGOMERY COUNTY AIRPARK & FLOWER HILL SHOPPING CENTER
  // =========================================================================================
  {
    const airCx = gx(410);
    const airCz = gz(1990);
    const rwyWrap = new THREE.Group();
    rwyWrap.position.set(airCx, 0.242, airCz);
    rwyWrap.rotation.y = -0.35;
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(20, 120), makeCityMat({ color: 0x1e2430, roughness: 0.85 }));
    runway.rotation.x = -Math.PI / 2;
    rwyWrap.add(runway);
    for (let rz = -48; rz <= 48; rz += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 5.8), whiteLineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.014, rz);
      rwyWrap.add(dash);
    }
    sceneryGroup.add(rwyWrap);

    const hangarMat = makeCityMat({ color: 0x94a3b8, metalness: 0.45, roughness: 0.5 });
    const hangar = new THREE.Mesh(new THREE.BoxGeometry(28, 9.5, 36), hangarMat);
    hangar.position.set(gx(364), 5.0, gz(1994));
    sceneryGroup.add(hangar);
    const hangarRoof = new THREE.Mesh(new THREE.CylinderGeometry(14.5, 14.5, 36, 12, 1, false, 0, Math.PI), hangarMat);
    hangarRoof.rotation.x = Math.PI / 2;
    hangarRoof.rotation.z = Math.PI / 2;
    hangarRoof.scale.set(0.32, 1.0, 1.0);
    hangarRoof.position.set(gx(364), 9.75, gz(1994));
    sceneryGroup.add(hangarRoof);
    const kgaiSign = new THREE.Mesh(
      new THREE.BoxGeometry(36, 3.0, 0.45),
      makeTextSignMat(['MONTGOMERY COUNTY AIRPARK (KGAI)', 'RUNWAY 14/32 · AIRPARK RD'], '#0f172a', '#fde047', '#38bdf8')
    );
    kgaiSign.position.set(gx(364), 11.2, gz(2012.5));
    sceneryGroup.add(kgaiSign);
    cityBuildings.push({ minX: gx(349), maxX: gx(379), minZ: gz(1975), maxZ: gz(2013), height: 14, name: 'Montgomery County Airpark (KGAI) Hangar' });

    drawGaithParkingLot(gx(162), gz(2176), 72, 36, 0);
    const fhBrick = makeBrickFacadeMat('#7c2d12', '#f8fafc', '#fde047', 8, 2, false);
    const fhTrimMat = makeCityMat({ color: 0xe2e8f0, roughness: 0.6 });
    const fhCanopyMat = makeCityMat({ color: 0x064e3b, roughness: 0.55 });
    const fhPlaza = new THREE.Mesh(new THREE.BoxGeometry(68, 11, 24), boxWithRoofMat(fhBrick, flatRoofMat));
    fhPlaza.position.set(gx(174), 5.75, gz(2142));
    fhPlaza.castShadow = !isRetroPixel;
    sceneryGroup.add(fhPlaza);
    const fhParapet = new THREE.Mesh(new THREE.BoxGeometry(69, 1.1, 25), fhTrimMat);
    fhParapet.position.set(gx(174), 11.4, gz(2142));
    sceneryGroup.add(fhParapet);
    const fhCanopy = new THREE.Mesh(new THREE.BoxGeometry(66, 0.7, 4.2), fhCanopyMat);
    fhCanopy.position.set(gx(174), 4.8, gz(2156));
    sceneryGroup.add(fhCanopy);
    const fhCenterVest = new THREE.Mesh(new THREE.BoxGeometry(20, 12.8, 25.4), boxWithRoofMat(fhBrick, flatRoofMat));
    fhCenterVest.position.set(gx(174), 6.65, gz(2142));
    sceneryGroup.add(fhCenterVest);
    const fhSign = new THREE.Mesh(
      new THREE.BoxGeometry(44, 2.8, 0.45),
      makeTextSignMat(['FLOWER HILL SHOPPING CENTER', 'GIANT · WOODFIELD RD & FLOWER HILL WAY'], '#064e3b', '#ffffff', '#10b981')
    );
    fhSign.position.set(gx(174), 10.6, gz(2155.1));
    sceneryGroup.add(fhSign);
    cityBuildings.push({ minX: gx(139), maxX: gx(209), minZ: gz(2129), maxZ: gz(2155), height: 14, name: 'Flower Hill Shopping Center (Giant)' });
  }

  // =========================================================================================
  // 10. GOSHEN GIANT, LAKE WHETSTONE, LAKEFOREST, FAIRGROUNDS, OLDE TOWNE MARC & BOHRER PARK
  // =========================================================================================
  {
    const retailTrimMat = makeCityMat({ color: 0xe5e7eb, roughness: 0.6 });
    const retailDarkMat = makeCityMat({ color: 0x1e293b, roughness: 0.65 });
    drawGaithParkingLot(gx(-296), gz(1560), 68, 46, 0);
    const giantAnchor = new THREE.Mesh(new THREE.BoxGeometry(60, 10, 26), boxWithRoofMat(makeBrickFacadeMat('#a16244', '#e5e7eb', '#1e293b', 8, 2, false), flatRoofMat));
    giantAnchor.position.set(gx(-296), 5.25, gz(1520));
    sceneryGroup.add(giantAnchor);
    const giantCrown = new THREE.Mesh(new THREE.BoxGeometry(61, 1.0, 27), retailTrimMat);
    giantCrown.position.set(gx(-296), 10.6, gz(1520));
    sceneryGroup.add(giantCrown);
    const giantCanopy = new THREE.Mesh(new THREE.BoxGeometry(58, 0.65, 3.8), makeCityMat({ color: 0x065f46, roughness: 0.55 }));
    giantCanopy.position.set(gx(-296), 4.5, gz(1534.5));
    sceneryGroup.add(giantCanopy);
    const giantSign = new THREE.Mesh(
      new THREE.BoxGeometry(44, 2.8, 0.45),
      makeTextSignMat(['GOSHEN CROSSING · GIANT FOOD', '20044 GOSHEN RD & WIGHTMAN RD'], '#064e3b', '#fde047', '#22c55e')
    );
    giantSign.position.set(gx(-296), 8.8, gz(1533.4));
    sceneryGroup.add(giantSign);
    cityBuildings.push({ minX: gx(-327), maxX: gx(-265), minZ: gz(1506), maxZ: gz(1534), height: 12, name: 'Goshen Crossing Shopping Center (Giant)' });

    const whetstoneLake = new THREE.Mesh(new THREE.PlaneGeometry(78, 56), waterMat);
    whetstoneLake.rotation.x = -Math.PI / 2;
    whetstoneLake.position.set(gx(-315), 0.232, gz(1695));
    sceneryGroup.add(whetstoneLake);

    drawGaithParkingLot(gx(-224), gz(1754), 56, 46, 0);
    const lfMall = new THREE.Mesh(new THREE.BoxGeometry(56, 11.5, 28), boxWithRoofMat(makeBrickFacadeMat('#57534e', '#e2e8f0', '#38bdf8', 8, 2, false), flatRoofMat));
    lfMall.position.set(gx(-286), 6.0, gz(1754));
    sceneryGroup.add(lfMall);
    const lfPent = new THREE.Mesh(new THREE.BoxGeometry(28, 3.2, 18), retailDarkMat);
    lfPent.position.set(gx(-286), 13.3, gz(1754));
    sceneryGroup.add(lfPent);
    cityBuildings.push({ minX: gx(-315), maxX: gx(-257), minZ: gz(1739), maxZ: gz(1769), height: 15, name: 'Lakeforest / Lost Knife Plaza' });

    const fgOval = new THREE.Mesh(new THREE.CircleGeometry(24, 24), makeCityMat({ color: 0x926843, roughness: 0.95 }));
    fgOval.rotation.x = -Math.PI / 2;
    fgOval.scale.set(1.2, 1.0, 0.8);
    fgOval.position.set(gx(-265), 0.238, gz(1845));
    sceneryGroup.add(fgOval);
    const grandstand = new THREE.Mesh(new THREE.BoxGeometry(50, 11, 20), boxWithRoofMat(makeBrickFacadeMat('#b91c1c', '#ffffff', '#0f172a', 6, 2, false), flatRoofMat));
    grandstand.position.set(gx(-265), 5.75, gz(1795));
    sceneryGroup.add(grandstand);
    const fgRoof = new THREE.Mesh(new THREE.BoxGeometry(52, 1.1, 22), retailTrimMat);
    fgRoof.position.set(gx(-265), 11.6, gz(1795));
    sceneryGroup.add(fgRoof);
    const fgSign = new THREE.Mesh(
      new THREE.BoxGeometry(44, 3.0, 0.45),
      makeTextSignMat(['MONTGOMERY COUNTY FAIRGROUNDS', 'PERRY PKWY · FREDERICK AVE (MD-355)'], '#991b1b', '#ffffff', '#fde047')
    );
    fgSign.position.set(gx(-265), 9.6, gz(1805.4));
    sceneryGroup.add(fgSign);
    cityBuildings.push({ minX: gx(-291), maxX: gx(-239), minZ: gz(1784), maxZ: gz(1806), height: 13, name: 'Montgomery County Fairgrounds Pavilion' });

    // Historic 1884 B&O / MARC Depot with pitched gable roof & west-bay clock spire
    const depotBrickMat = makeBrickFacadeMat('#991b1b', '#f8fafc', '#fde68a', 6, 2, true);
    const depotSolidBrickMat = makeCityMat({ color: 0x991b1b, roughness: 0.76 });
    const depotRoofMat = makeCityMat({ color: 0x1e293b, roughness: 0.72 });
    const depotBody = new THREE.Mesh(new THREE.BoxGeometry(54, 10, 20), boxWithRoofMat(depotBrickMat, flatRoofMat));
    depotBody.position.set(gx(-125), 5.25, gz(1956));
    sceneryGroup.add(depotBody);
    const depotRoof = buildPitchedRoofGroup(54.8, 20.8, 4.2, depotBrickMat, depotRoofMat, 'x');
    depotRoof.position.set(gx(-125), 10.25, gz(1956));
    sceneryGroup.add(depotRoof);
    const depotTower = new THREE.Mesh(new THREE.BoxGeometry(10, 17, 10), depotSolidBrickMat);
    depotTower.position.set(gx(-125) - 18, 8.75, gz(1956) - 6);
    sceneryGroup.add(depotTower);
    const depotTowerCollar = new THREE.Mesh(new THREE.BoxGeometry(11.0, 0.8, 11.0), retailTrimMat);
    depotTowerCollar.position.set(gx(-125) - 18, 17.5, gz(1956) - 6);
    sceneryGroup.add(depotTowerCollar);
    const depotTowerRoof = new THREE.Mesh(new THREE.ConeGeometry(7.8, 6.2, 4), depotRoofMat);
    depotTowerRoof.rotation.y = Math.PI / 4;
    depotTowerRoof.position.set(gx(-125) - 18, 20.9, gz(1956) - 6);
    sceneryGroup.add(depotTowerRoof);
    const depotSign = new THREE.Mesh(
      new THREE.BoxGeometry(44, 2.6, 0.45),
      makeTextSignMat(['OLDE TOWNE GAITHERSBURG · 1884 MARC'], '#7c2d12', '#fef3c7', '#fde047')
    );
    depotSign.position.set(gx(-125), 9.2, gz(1966.5));
    sceneryGroup.add(depotSign);
    cityBuildings.push({ minX: gx(-153), maxX: gx(-97), minZ: gz(1945), maxZ: gz(1967), height: 24, name: 'Gaithersburg 1884 B&O / MARC Station' });

    const ballast = new THREE.Mesh(new THREE.PlaneGeometry(580, 11.5), makeCityMat({ color: 0x57534e, roughness: 0.95 }));
    ballast.rotation.order = 'YXZ';
    ballast.rotation.y = -0.14;
    ballast.rotation.x = -Math.PI / 2;
    ballast.position.set(gx(-220), 0.238, gz(1952));
    sceneryGroup.add(ballast);

    const bohrerPool = new THREE.Mesh(new THREE.PlaneGeometry(46, 30), makeCityMat({ color: 0x0284c7, roughness: 0.15 }));
    bohrerPool.rotation.x = -Math.PI / 2;
    bohrerPool.position.set(gx(-48), 0.236, gz(2138));
    sceneryGroup.add(bohrerPool);
    const bohrerBrick = makeBrickFacadeMat('#9a3412', '#f1f5f9', '#38bdf8', 7, 2, false);
    const bohrerHall = new THREE.Mesh(new THREE.BoxGeometry(46, 10, 26), boxWithRoofMat(bohrerBrick, flatRoofMat));
    bohrerHall.position.set(gx(-48), 5.25, gz(2102));
    sceneryGroup.add(bohrerHall);
    const bohrerRoof = buildPitchedRoofGroup(46.8, 26.8, 3.8, bohrerBrick, retailDarkMat, 'x');
    bohrerRoof.position.set(gx(-48), 10.25, gz(2102));
    sceneryGroup.add(bohrerRoof);
    cityBuildings.push({ minX: gx(-72), maxX: gx(-24), minZ: gz(2088), maxZ: gz(2116), height: 14, name: 'Bohrer Park Activity Center' });
  }

  // =========================================================================================
  // 11. NIST, RIO LAKEFRONT & CAROUSEL, DOWNTOWN CROWN, KENTLANDS & LAKELANDS
  // =========================================================================================
  {
    const campusTrimMat = makeCityMat({ color: 0xe2e8f0, roughness: 0.55 });
    const campusDarkMat = makeCityMat({ color: 0x1e293b, roughness: 0.65 });
    const nistLab = new THREE.Mesh(new THREE.BoxGeometry(58, 20, 42), boxWithRoofMat(makeBrickFacadeMat('#cbd5e1', '#94a3b8', '#0284c7', 8, 4, false), flatRoofMat));
    nistLab.position.set(gx(-522), 10.25, gz(2045));
    sceneryGroup.add(nistLab);
    const nistRoofCap = new THREE.Mesh(new THREE.BoxGeometry(38, 4.2, 24), campusDarkMat);
    nistRoofCap.position.set(gx(-522), 22.3, gz(2045));
    sceneryGroup.add(nistRoofCap);
    const nistParapet = new THREE.Mesh(new THREE.BoxGeometry(59.2, 1.2, 43.2), campusTrimMat);
    nistParapet.position.set(gx(-522), 20.4, gz(2045));
    sceneryGroup.add(nistParapet);
    const nistSign = new THREE.Mesh(
      new THREE.BoxGeometry(50, 3.0, 0.45),
      makeTextSignMat(['NIST · NATIONAL INSTITUTE OF STANDARDS', '100 BUREAU DR · GAITHERSBURG'], '#0f172a', '#ffffff', '#38bdf8')
    );
    nistSign.position.set(gx(-522), 18.0, gz(2066.4));
    sceneryGroup.add(nistSign);
    cityBuildings.push({ minX: gx(-552), maxX: gx(-492), minZ: gz(2023), maxZ: gz(2067), height: 24, name: 'NIST Federal Research Campus' });

    const rioX = gx(-466);
    const rioZ = gz(2292);
    const rioLake = new THREE.Mesh(new THREE.PlaneGeometry(102, 68), waterMat);
    rioLake.rotation.x = -Math.PI / 2;
    rioLake.position.set(rioX, 0.232, rioZ + 22);
    sceneryGroup.add(rioLake);
    const rioBoardwalk = new THREE.Mesh(new THREE.BoxGeometry(100, 0.45, 10), makeCityMat({ color: 0x7c4a26, roughness: 0.8 }));
    rioBoardwalk.position.set(rioX, 0.45, rioZ - 14);
    sceneryGroup.add(rioBoardwalk);
    const carouselPier = new THREE.Mesh(new THREE.CylinderGeometry(10.5, 10.5, 0.6, 18), makeCityMat({ color: 0x7c4a26, roughness: 0.8 }));
    carouselPier.position.set(rioX, 0.55, rioZ + 14);
    sceneryGroup.add(carouselPier);
    const carouselCanopy = new THREE.Mesh(new THREE.ConeGeometry(8.8, 4.8, 16), makeCityMat({ color: 0xef4444, roughness: 0.45 }));
    carouselCanopy.position.set(rioX, 6.8, rioZ + 14);
    sceneryGroup.add(carouselCanopy);
    const rioCinema = new THREE.Mesh(new THREE.BoxGeometry(74, 15, 26), boxWithRoofMat(makeBrickFacadeMat('#9a3412', '#fef3c7', '#fbbf24', 8, 3, false), flatRoofMat));
    rioCinema.position.set(rioX, 7.75, rioZ - 38);
    sceneryGroup.add(rioCinema);
    const rioMarquee = new THREE.Mesh(new THREE.BoxGeometry(46, 1.0, 5.2), campusDarkMat);
    rioMarquee.position.set(rioX, 5.6, rioZ - 22.5);
    sceneryGroup.add(rioMarquee);
    const rioCrown = new THREE.Mesh(new THREE.BoxGeometry(75.5, 1.3, 27.5), campusTrimMat);
    rioCrown.position.set(rioX, 15.6, rioZ - 38);
    sceneryGroup.add(rioCrown);
    const rioSign = new THREE.Mesh(
      new THREE.BoxGeometry(54, 3.4, 0.5),
      makeTextSignMat(['RIO LAKEFRONT · WASHINGTONIAN', 'AMC DINE-IN · BOARDWALK CAROUSEL'], '#0f172a', '#fde047', '#38bdf8')
    );
    rioSign.position.set(rioX, 13.5, rioZ - 24.6);
    sceneryGroup.add(rioSign);
    cityBuildings.push({ minX: rioX - 38, maxX: rioX + 38, minZ: rioZ - 52, maxZ: rioZ - 24, height: 17, name: 'RIO Lakefront AMC & Promenade' });

    const crownBrickMat = makeBrickFacadeMat('#57534e', '#e2e8f0', '#fde047', 7, 3, false);
    const crownBlock = new THREE.Mesh(new THREE.BoxGeometry(64, 16, 36), boxWithRoofMat(crownBrickMat, flatRoofMat));
    crownBlock.position.set(gx(-302), 8.25, gz(2318));
    sceneryGroup.add(crownBlock);
    const crownPent = new THREE.Mesh(new THREE.BoxGeometry(40, 4.5, 22), boxWithRoofMat(makeBrickFacadeMat('#7c2d12', '#f8fafc', '#fde68a', 5, 1, false), flatRoofMat));
    crownPent.position.set(gx(-302), 18.5, gz(2318));
    sceneryGroup.add(crownPent);
    const crownCanopy = new THREE.Mesh(new THREE.BoxGeometry(62, 0.7, 4.2), campusDarkMat);
    crownCanopy.position.set(gx(-302), 4.6, gz(2298.5));
    sceneryGroup.add(crownCanopy);
    cityBuildings.push({ minX: gx(-335), maxX: gx(-269), minZ: gz(2299), maxZ: gz(2337), height: 21, name: 'Downtown Crown Urban Village' });

    drawGaithParkingLot(gx(-630), gz(2095), 72, 54, 0);
    const kmPlaza = new THREE.Mesh(new THREE.BoxGeometry(66, 12, 28), boxWithRoofMat(makeBrickFacadeMat('#9a3412', '#fef3c7', '#38bdf8', 7, 2, false), flatRoofMat));
    kmPlaza.position.set(gx(-630), 6.25, gz(2046));
    sceneryGroup.add(kmPlaza);
    const kmParapet = new THREE.Mesh(new THREE.BoxGeometry(67.2, 1.1, 29.2), campusTrimMat);
    kmParapet.position.set(gx(-630), 12.6, gz(2046));
    sceneryGroup.add(kmParapet);
    const kmCanopy = new THREE.Mesh(new THREE.BoxGeometry(64, 0.65, 3.8), makeCityMat({ color: 0x14532d, roughness: 0.55 }));
    kmCanopy.position.set(gx(-630), 4.6, gz(2061.5));
    sceneryGroup.add(kmCanopy);
    const kmSign = new THREE.Mesh(
      new THREE.BoxGeometry(46, 3.0, 0.45),
      makeTextSignMat(['KENTLANDS MARKET SQUARE', 'WHOLE FOODS · CINEPOLIS · MAIN ST'], '#0f172a', '#fde047', '#f59e0b')
    );
    kmSign.position.set(gx(-630), 10.6, gz(2060.4));
    sceneryGroup.add(kmSign);
    cityBuildings.push({ minX: gx(-664), maxX: gx(-596), minZ: gz(2031), maxZ: gz(2061), height: 14, name: 'Kentlands Market Square' });

    const kLake = new THREE.Mesh(new THREE.PlaneGeometry(82, 56), waterMat);
    kLake.rotation.x = -Math.PI / 2;
    kLake.position.set(gx(-610), 0.232, gz(2290));
    sceneryGroup.add(kLake);
    const kMansionBrick = makeBrickFacadeMat('#991b1b', '#f8fafc', '#1e293b', 5, 2, true);
    const kMansion = new THREE.Mesh(new THREE.BoxGeometry(40, 11, 22), boxWithRoofMat(kMansionBrick, flatRoofMat));
    kMansion.position.set(gx(-610), 5.75, gz(2246));
    sceneryGroup.add(kMansion);
    const kMansionRoof = buildPitchedRoofGroup(40.6, 22.6, 4.4, kMansionBrick, makeCityMat({ color: 0x1e293b, roughness: 0.74 }), 'x');
    kMansionRoof.position.set(gx(-610), 11.25, gz(2246));
    sceneryGroup.add(kMansionRoof);
    cityBuildings.push({ minX: gx(-631), maxX: gx(-589), minZ: gz(2234), maxZ: gz(2258), height: 16, name: 'Historic Kentlands Mansion' });
  }

  // =========================================================================================
  // 12. ARCHITECTURAL HOMES ALIGNED CLEANLY ALONG MONTGOMERY VILLAGE, KENTLANDS & FLOWER HILL
  // =========================================================================================
  {
    const gaithSuburbs = [
      { x: gx(-510), z: gz(1898), rotY: 0, addr: '112 Clopper Rd', col: 0xe2e8f0, roof: 0x1e293b, tier: 'regular' as const },
      { x: gx(-598), z: gz(1898), rotY: Math.PI / 2, addr: '118 Lakelands Dr', col: 0x881337, roof: 0x1e1b4b, tier: 'luxury' as const },
      { x: gx(-530), z: gz(2175), rotY: 0, addr: '208 Kentlands Blvd', col: 0xd97706, roof: 0x451a03, tier: 'luxury' as const },
      { x: gx(-472), z: gz(2352), rotY: Math.PI, addr: '308 Kent Oaks Way', col: 0xe2e8f0, roof: 0x0f172a, tier: 'luxury' as const },
      { x: gx(-340), z: gz(1596), rotY: 0, addr: '19104 Whetstone Dr', col: 0x881337, roof: 0x1e1b4b, tier: 'regular' as const },
      { x: gx(176), z: gz(1602), rotY: -Math.PI / 2, addr: '19116 Centerway Rd', col: 0xe2e8f0, roof: 0x1e293b, tier: 'regular' as const },
      { x: gx(245), z: gz(1602), rotY: Math.PI / 2, addr: '19128 Shadow Oak Dr', col: 0x78716c, roof: 0x292524, tier: 'regular' as const },
      { x: gx(255), z: gz(2236), rotY: Math.PI, addr: '412 Muncaster Mill Rd', col: 0xe2e8f0, roof: 0x1e293b, tier: 'luxury' as const },
      { x: gx(330), z: gz(2225), rotY: Math.PI, addr: '420 Redland Rd', col: 0x78716c, roof: 0x292524, tier: 'regular' as const },
      { x: gx(40), z: gz(2242), rotY: Math.PI, addr: '312 E Deer Park Dr', col: 0xd97706, roof: 0x451a03, tier: 'regular' as const },
    ];
    for (const gH of gaithSuburbs) {
      const builtHome = buildSuburbanHouseMesh(gH.x, gH.z, gH.rotY, {
        address: gH.addr,
        wallColor: gH.col,
        roofColor: gH.roof,
        tier: gH.tier,
      });
      sceneryGroup.add(builtHome.group);
      suburbanHouses.push(builtHome);
      cityBuildings.push(builtHome.collider);
    }
  }

  // =========================================================================================
  // 13. INSTANCED MARYLAND WOODED GREENBELT TREES IN GAITHERSBURG
  // =========================================================================================
  {
    const treePlacements: { x: number; z: number; s: number }[] = [];
    for (let i = 0; i < 360; i++) {
      const tx = gx(-690 + ((i * 97) % 1380));
      const tz = gz(1500 + ((i * 73) % 940));
      if (isOnGaithersburgPavedSurface(tx, tz)) continue;
      let nearRoadOrFeature = false;
      for (const r of ALL_MARYLAND_ROADS) {
        const minClr = r.width * 0.5 + 8.5;
        const clrSq = minClr * minClr;
        for (let k = 0; k < r.points.length - 1; k++) {
          if (distSqPointToSeg(tx, tz, r.points[k].x, r.points[k].z, r.points[k + 1].x, r.points[k + 1].z) < clrSq) {
            nearRoadOrFeature = true;
            break;
          }
        }
        if (nearRoadOrFeature) break;
      }
      if (nearRoadOrFeature) continue;
      if (
        (tx >= gx(360) && tx <= gx(735) && tz >= gz(1375) && tz <= gz(1925)) ||
        (tx >= gx(95) && tx <= gx(255) && tz >= gz(1940) && tz <= gz(2105)) ||
        (tx >= gx(-365) && tx <= gx(-265) && tz >= gz(1655) && tz <= gz(1735)) ||
        (tx >= gx(-510) && tx <= gx(-365) && tz >= gz(2225) && tz <= gz(2345)) ||
        (tx >= gx(-665) && tx <= gx(-555) && tz >= gz(2245) && tz <= gz(2335)) ||
        (tx >= gx(-205) && tx <= gx(-95) && tz >= gz(1825) && tz <= gz(1920))
      ) {
        continue;
      }
      let hitsBldg = false;
      for (let b = 0; b < cityBuildings.length; b++) {
        const box = cityBuildings[b];
        if (tx >= box.minX - 6 && tx <= box.maxX + 6 && tz >= box.minZ - 6 && tz <= box.maxZ + 6) {
          hitsBldg = true;
          break;
        }
      }
      if (hitsBldg) continue;
      treePlacements.push({ x: tx, z: tz, s: 0.85 + (i % 4) * 0.2 });
    }
    if (treePlacements.length > 0) {
      const trunkGeo = new THREE.CylinderGeometry(0.3, 0.44, 4.2, isRetroPixel ? 5 : 6);
      const crownGeo = new THREE.DodecahedronGeometry(3.0, isRetroPixel ? 0 : 1);
      const trunkInst = new THREE.InstancedMesh(trunkGeo, treeTrunkMat, treePlacements.length);
      const crownInst = new THREE.InstancedMesh(crownGeo, treeFoliageMat, treePlacements.length);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < treePlacements.length; i++) {
        const tp = treePlacements[i];
        dummy.position.set(tp.x, 0.22 + 2.1 * tp.s, tp.z);
        dummy.scale.set(tp.s, tp.s, tp.s);
        dummy.rotation.y = i * 0.8;
        dummy.updateMatrix();
        trunkInst.setMatrixAt(i, dummy.matrix);

        dummy.position.set(tp.x, 0.22 + 5.2 * tp.s, tp.z);
        dummy.scale.set(tp.s * 1.15, tp.s * 1.05, tp.s * 1.15);
        dummy.updateMatrix();
        crownInst.setMatrixAt(i, dummy.matrix);
      }
      trunkInst.instanceMatrix.needsUpdate = true;
      crownInst.instanceMatrix.needsUpdate = true;
      trunkInst.computeBoundingSphere();
      crownInst.computeBoundingSphere();
      sceneryGroup.add(trunkInst);
      sceneryGroup.add(crownInst);
    }
  }

  for (const jct of GAITHERSBURG_SIGNAL_JUNCTIONS.slice(0, 4)) {
    addStreetNamePost(jct.x - 18, jct.z - 14, jct.name.toUpperCase(), 0);
  }
}
