import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import {
  ALL_MARYLAND_ROADS,
  GAITHERSBURG_SIGNAL_JUNCTIONS,
  ICM_CAMPUS_ORIGIN,
  REDEEMER_CAMPUS_ORIGIN,
  MAYHILL_CT_ROUNDABOUT,
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
import { SuburbanBatchBuilder } from './suburbanBatchBuilder';
import {
  GrassPatchPlacement,
  WoodlandTreePlacement,
  populateChunkedGrassAndShrubs,
  populateInstancedWoodlandTrees,
} from './foliageBuilder';

export interface GaithersburgBuilderContext {
  group: THREE.Group;
  sceneryGroup: THREE.Group;
  cityStreetRoadMeshes: THREE.Mesh[];
  cityBuildings: CityBuildingBox[];
  suburbanHouses: BuiltSuburbanHouse[];
  suburbanBatch: SuburbanBatchBuilder;
  disposables: { dispose: () => void }[];
  reflectorToggleables: THREE.Object3D[];
  streetAsphaltMat: THREE.Material;
  whiteLineMat: THREE.Material;
  yellowLineMat: THREE.Material;
  sidewalkMat: THREE.Material;
  treeTrunkMat: THREE.Material;
  treeFoliageMat: THREE.Material;
  goldMat: THREE.Material;
  isUltra: boolean;
  isRetroPixel: boolean;
  makeCityMat: (opts: { color?: number; map?: THREE.Texture; roughness?: number; metalness?: number; envMapIntensity?: number }) => THREE.Material;
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
  if (pz < gz(1020) || pz > gz(2500) || px < gx(-740) || px > gx(860)) return false;
  return isOnMarylandPavedSurface(px, pz);
}

export function buildGaithersburgDistrict(ctx: GaithersburgBuilderContext): void {
  const {
    sceneryGroup,
    cityBuildings,
    suburbanHouses,
    suburbanBatch,
    disposables,
    reflectorToggleables,
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
    name: string,
    stories?: number
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
      stories,
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
    lotPlane.receiveShadow = isUltra;
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

  const edSharedWhiteTrimMat = makeCityMat({ color: 0xf8fafc, roughness: 0.35 });

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
    mWalls.castShadow = isUltra;
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
    addRotatedCollider(ICM_CAMPUS_ORIGIN.x, ICM_CAMPUS_ORIGIN.z, ICM_CAMPUS_ORIGIN.rotY, 46, 6, 20, 18, 10, 'ICM Front Musalla (19411 Woodfield Rd)', 1);

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
    const courtSign = new THREE.Mesh(
      new THREE.BoxGeometry(10.5, 1.4, 0.28),
      makeTextSignMat(['ICM BASKETBALL COURT', 'PRESS [B] · 1v1 TO 5v5'], '#7c2d12', '#fde047', '#f97316')
    );
    courtSign.position.set(0, 3.35, -10.8);
    courtGroup.add(courtSign);
    const bballRingMat = new THREE.MeshBasicMaterial({ color: 0xf97316, side: THREE.DoubleSide, transparent: true, opacity: 0.72 });
    disposables.push(bballRingMat);
    const bballRing = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.4, 24), bballRingMat);
    bballRing.rotation.x = -Math.PI / 2;
    bballRing.position.set(0, 0.06, -13.6);
    courtGroup.add(bballRing);
    icmGroup.add(courtGroup);

    // 4C. Bigger 2-Story Sand-Beige Back Main Center Building (Academy, Multipurpose Hall, Clinic — NO dome)
    const backBody = new THREE.Mesh(new THREE.BoxGeometry(58, 12.6, 54), boxWithRoofMat(icmStuccoWallMat, flatRoofMat));
    backBody.position.set(138, 6.8, 6);
    backBody.castShadow = isUltra;
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
    addRotatedCollider(ICM_CAMPUS_ORIGIN.x, ICM_CAMPUS_ORIGIN.z, ICM_CAMPUS_ORIGIN.rotY, 138, 6, 60, 56, 15, 'Islamic Center of Maryland — Main Center', 2);

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
    redAudit.castShadow = isUltra;
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

    addRotatedCollider(REDEEMER_CAMPUS_ORIGIN.x, REDEEMER_CAMPUS_ORIGIN.z, REDEEMER_CAMPUS_ORIGIN.rotY, 126, 2, 60, 50, 17, 'Church of the Redeemer (19425 Woodfield Rd)', 2);
    sceneryGroup.add(redGroup);
  }

  // =========================================================================================
  // 6. EMORY GROVE, WHETSTONE (MONTGOMERY VILLAGE) & FLOWER HILL SUBDIVISIONS
  // =========================================================================================
  {
    const paletteCycle = [
      { siding: '#e7dec8', roof: 0x1e293b, shutter: 0x14532d, door: 0x7f1d1d, brick: true },
      { siding: '#cbd5e1', roof: 0x292524, shutter: 0x0f172a, door: 0x1e3a8a, brick: false },
      { siding: '#d6ccb8', roof: 0x3b2f2f, shutter: 0x1e3a8a, door: 0x14532d, brick: true },
      { siding: '#f1f5f9', roof: 0x1f2937, shutter: 0x7f1d1d, door: 0x7f1d1d, brick: false },
      { siding: '#94a3b8', roof: 0x0f172a, shutter: 0x1e293b, door: 0x7c2d12, brick: true },
      { siding: '#e2d9c8', roof: 0x292524, shutter: 0x14532d, door: 0x1e3a8a, brick: false },
    ];
    const addSuburbanSlot = (
      x: number,
      z: number,
      rotY: number,
      houseNum: string,
      street: string,
      idx: number
    ) => {
      const p = paletteCycle[idx % paletteCycle.length];
      return suburbanBatch.addHouse(
        {
          x,
          z,
          rotY,
          houseNum,
          street,
          cityTag: 'Gaithersburg',
          style: idx % 3 === 0 ? 'split' : 'colonial',
          sidingHex: p.siding,
          roofColor: p.roof,
          shutterColor: p.shutter,
          doorColor: p.door,
          brickFront: p.brick,
        },
        suburbanHouses,
        cityBuildings
      );
    };

    // 6A. Emory Grove Rd & Emory Woods Ct (~18 detached homes with real 20877 ranges)
    const railWoodMat = makeCityMat({ color: 0x6b4c35, roughness: 0.88 });
    for (const [fx, fz] of [[gx(338), gz(1808)], [gx(314), gz(1884)]] as [number, number][]) {
      const fTop = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 24), railWoodMat);
      fTop.rotation.y = -0.336;
      fTop.position.set(fx, 1.2, fz);
      sceneryGroup.add(fTop);
    }
    let emIdx = 0;
    for (let k = 0; k < 5; k++) {
      const ex = gx(228 + k * 17);
      addSuburbanSlot(ex, gz(1800.5), 0, `${9402 + k * 6}`, 'Emory Grove Rd', emIdx++);
    }
    for (let k = 0; k < 5; k++) {
      const ex = gx(220 + k * 17);
      addSuburbanSlot(ex, gz(1831.5), Math.PI, `${9403 + k * 6}`, 'Emory Grove Rd', emIdx++);
    }
    for (let k = 0; k < 4; k++) {
      const t = 0.14 + k * 0.18;
      const rx = gx(255 + (160 - 255) * t);
      const rz = gz(1868 + (1900 - 1868) * t);
      // Perpendicular to Emory Woods Ct (-95, 32): North normal ~ (-0.319, -0.948)
      addSuburbanSlot(rx - 0.319 * 15.5, rz - 0.948 * 15.5, -0.32, `${18402 + k * 4}`, 'Emory Woods Ct', emIdx++);
      addSuburbanSlot(rx + 0.319 * 15.5, rz + 0.948 * 15.5, Math.PI - 0.32, `${18403 + k * 4}`, 'Emory Woods Ct', emIdx++);
    }
    addStreetNamePost(gx(326), gz(1860), 'EMORY WOODS CT', 0);

    // 6B. Whetstone Dr (Montgomery Village: 14 homes, real range 9500-9768)
    for (let k = 0; k < 7; k++) {
      const wx = gx(-172 + k * 16);
      addSuburbanSlot(wx, gz(1544.5), 0, `${9702 + k * 6}`, 'Whetstone Dr', k);
      addSuburbanSlot(wx, gz(1575.5), Math.PI, `${9703 + k * 6}`, 'Whetstone Dr', k + 7);
    }

    // 6C. Flower Hill Way (Flower Hill neighborhood: 16 homes, real range 18400-18520)
    for (let k = 0; k < 8; k++) {
      const fx = gx(264 + k * 17);
      addSuburbanSlot(fx, gz(2259.5), 0, `${18402 + k * 6}`, 'Flower Hill Way', k);
      addSuburbanSlot(fx, gz(2290.5), Math.PI, `${18403 + k * 6}`, 'Flower Hill Way', k + 8);
    }

    // =======================================================================================
    // 7. EDINBURGH VILLAGE (Spacious Real-Street Community — Including 19624, 19625, 19626, 19627 Kildonan Dr)
    // =======================================================================================
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

    // Spacious Edinburgh Community Pocket Park & Playground in wide 78m center greenbelt
    const totMulch = new THREE.Mesh(new THREE.BoxGeometry(12, 0.02, 9), makeCityMat({ color: 0x78350f, roughness: 0.95 }));
    totMulch.position.set(gx(535), 0.232, gz(1653));
    sceneryGroup.add(totMulch);
    const pergolaRoof = new THREE.Mesh(new THREE.ConeGeometry(3.0, 1.6, 4), makeCityMat({ color: 0x0ea5e9, roughness: 0.5 }));
    pergolaRoof.rotation.y = Math.PI / 4;
    pergolaRoof.position.set(gx(535), 3.2, gz(1653));
    sceneryGroup.add(pergolaRoof);

    let edinburghCount = 0;
    const addEdinburghLot = (x: number, z: number, rotY: number, houseNum: string, street: string) => {
      if (addSuburbanSlot(x, z, rotY, houseNum, street, edinburghCount)) {
        edinburghCount++;
      }
    };

    // Featured Estate: 19624 Kildonan Dr on wide, airy lot right alongside 19622, 19625, 19626, 19627 Kildonan Dr
    {
      const estateX = gx(556);
      const estateZ = gz(1594.5);
      const estate = buildSuburbanHouseMesh(estateX, estateZ, 0, {
        address: '19624 Kildonan Dr',
        wallColor: 0x991b1b,
        roofColor: 0x0f172a,
        tier: 'luxury',
      });
      estate.group.scale.set(1.36, 1.30, 1.26);
      estate.collider = {
        minX: estateX - 11.2,
        maxX: estateX + 11.2,
        minZ: estateZ - 8.0,
        maxZ: estateZ + 8.2,
        height: 12.5,
        name: '19624 Kildonan Dr',
      };
      const estateStoneMat = makeCityMat({ color: 0xd6d3d1, roughness: 0.78 });
      const motorCourt = new THREE.Mesh(new THREE.BoxGeometry(19.0, 0.08, 7.0), estateStoneMat);
      motorCourt.position.set(estateX, 0.27, estateZ + 10.4);
      motorCourt.receiveShadow = isUltra;
      sceneryGroup.add(motorCourt);

      const cornerHedgeMat = makeCityMat({ color: 0x14532d, roughness: 0.88 });
      const eastCornerHedge = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.05, 16.0), cornerHedgeMat);
      eastCornerHedge.position.set(estateX + 13.4, 0.72, estateZ + 1.5);
      sceneryGroup.add(eastCornerHedge);

      for (const [px, pz] of [
        [estateX - 9.0, estateZ + 13.2],
        [estateX + 9.0, estateZ + 13.2],
        [estateX + 13.4, estateZ - 6.2],
      ] as [number, number][]) {
        const pil = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.85, 0.95), edBrickMat);
        pil.position.set(px, 1.15, pz);
        sceneryGroup.add(pil);
      }

      const estatePlaque = new THREE.Mesh(
        new THREE.BoxGeometry(4.6, 0.95, 0.3),
        makeTextSignMat(['19624 KILDONAN DR', 'EDINBURGH VILLAGE'], '#1e293b', '#fde047', '#d97706')
      );
      estatePlaque.position.set(estateX + 11.0, 1.35, estateZ + 13.1);
      sceneryGroup.add(estatePlaque);

      sceneryGroup.add(estate.group);
      suburbanHouses.push(estate);
      cityBuildings.push(estate.collider);
      edinburghCount++;
    }

    // 7A. Kildonan Dr (z=1614 main stretch + West/East loops) — 19620..19635 in clean even/odd facing order!
    const kildonanMainLots: [number, string, string][] = [
      [500, '19620', '19621'],
      [526, '19622', '19623'],
      // x=556 North is 19624 Kildonan Dr (Estate above); x=556 South is 19625 Kildonan Dr!
      [588, '19626', '19627'],
      // Kilcreggan Way intersects at x=620
      [648, '19628', '19629'],
      [676, '19630', '19631'],
      [704, '19632', '19633'],
      [732, '19634', '19635'],
    ];
    for (const [kx, evenNum, oddNum] of kildonanMainLots) {
      addEdinburghLot(gx(kx), gz(1596.5), 0, evenNum, 'Kildonan Dr');
      addEdinburghLot(gx(kx), gz(1631.5), Math.PI, oddNum, 'Kildonan Dr');
    }
    // 19625 Kildonan Dr sits directly across Kildonan Dr from 19624 Kildonan Dr
    addEdinburghLot(gx(556), gz(1631.5), Math.PI, '19625', 'Kildonan Dr');

    // West & East N-S legs of Kildonan Dr (spacious 24-27m lot spacing)
    addEdinburghLot(gx(457.5), gz(1638), Math.PI / 2, '19616', 'Kildonan Dr');
    addEdinburghLot(gx(457.5), gz(1662), Math.PI / 2, '19618', 'Kildonan Dr');
    for (const [kz, num] of [
      [1640, '19636'],
      [1666, '19638'],
      [1717, '19640'],
      [1743, '19642'],
    ] as [number, string][]) {
      addEdinburghLot(gx(792.5), gz(kz), -Math.PI / 2, num, 'Kildonan Dr');
    }

    // 7B. Brenish Dr (z=1692): spacious 28m lots on North & South sides
    const brenishNorthCols: [number, string][] = [
      [500, '7404'],
      [528, '7408'],
      [556, '7412'],
      [584, '7416'],
      [648, '7420'],
      [676, '7424'],
      [704, '7428'],
      [732, '7432'],
    ];
    for (const [bx, num] of brenishNorthCols) {
      addEdinburghLot(gx(bx), gz(1674.5), 0, num, 'Brenish Dr');
    }
    const brenishSouthCols: [number, string][] = [
      [508, '7405'],
      [536, '7409'],
      [648, '7421'],
      [676, '7425'],
      [704, '7429'],
      [732, '7433'],
    ];
    for (const [bx, num] of brenishSouthCols) {
      addEdinburghLot(gx(bx), gz(1709.5), Math.PI, num, 'Brenish Dr');
    }

    // 7C. Tarfside Ln Cul-de-Sac (x=574, z=1692..1736)
    addEdinburghLot(gx(556.5), gz(1722), Math.PI / 2, '7404', 'Tarfside Ln');
    addEdinburghLot(gx(591.5), gz(1718), -Math.PI / 2, '7406', 'Tarfside Ln');
    addEdinburghLot(gx(591.5), gz(1742), -Math.PI / 2, '7410', 'Tarfside Ln');
    addEdinburghLot(gx(574), gz(1754), Math.PI, '7408', 'Tarfside Ln');

    // 7D. Kilcreggan Way (z=1768)
    for (const [kx, num] of [
      [648, '19520'],
      [676, '19524'],
      [704, '19528'],
      [732, '19532'],
    ] as [number, string][]) {
      addEdinburghLot(gx(kx), gz(1750.5), 0, num, 'Kilcreggan Way');
    }
    addEdinburghLot(gx(648), gz(1785.5), Math.PI, '19521', 'Kilcreggan Way');
    addEdinburghLot(gx(674), gz(1785.5), Math.PI, '19525', 'Kilcreggan Way');
    addEdinburghLot(gx(738), gz(1785.5), Math.PI, '19533', 'Kilcreggan Way');

    // 7E. Kilcreggan Ter Cul-de-Sac (x=706, z=1768..1808 bulb)
    addEdinburghLot(gx(686), gz(1816), Math.PI * 0.65, '7406', 'Kilcreggan Ter');
    addEdinburghLot(gx(706), gz(1827), Math.PI, '7408', 'Kilcreggan Ter');
    addEdinburghLot(gx(726), gz(1816), -Math.PI * 0.65, '7410', 'Kilcreggan Ter');

    addStreetNamePost(gx(426), gz(1660), 'BRENISH DR', 0);
    addStreetNamePost(gx(568), gz(1605), 'KILDONAN DR · 19624', 0);

    // =======================================================================================
    // 8. HADLEY FARMS (Spacious Master-Planned Community + 2 Mayhill Ct + Resnik ES + Pool)
    // =======================================================================================
    const hfBrickMat = makeCityMat({ color: 0x8f3a2e, roughness: 0.65 });
    for (const [px, pz] of [[gx(464), gz(1572)], [gx(470), gz(1564)]] as [number, number][]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.0, 1.5), hfBrickMat);
      p.position.set(px, 1.2, pz);
      sceneryGroup.add(p);
    }
    const hfSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 1.0, 4.6),
      makeTextSignMat(['HADLEY FARMS', 'HADLEY FARMS DR · MAYHILL CT'], '#14532d', '#f8fafc', '#d4d4d8')
    );
    hfSign.rotation.y = -0.336;
    hfSign.position.set(gx(467), 1.25, gz(1568));
    sceneryGroup.add(hfSign);

    const tennis = new THREE.Mesh(new THREE.BoxGeometry(14, 0.02, 12), makeCityMat({ color: 0x15803d, roughness: 0.88 }));
    tennis.position.set(gx(524), 0.232, gz(1552));
    sceneryGroup.add(tennis);
    const clubWallMat = makeSidingMat('#e6decb');
    const clubRoofMat = makeCityMat({ color: 0x292524, roughness: 0.78 });
    const clubHouse = new THREE.Mesh(new THREE.BoxGeometry(16, 4.8, 10), clubWallMat);
    clubHouse.position.set(gx(524), 2.65, gz(1565));
    clubHouse.castShadow = isUltra;
    sceneryGroup.add(clubHouse);
    const clubRoof = buildPitchedRoofGroup(16.4, 10.4, 2.2, clubWallMat, clubRoofMat, 'x');
    clubRoof.position.set(gx(524), 5.05, gz(1565));
    sceneryGroup.add(clubRoof);
    const poolWater = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), makeCityMat({ color: 0x0ea5e9, roughness: 0.14, metalness: 0.45 }));
    poolWater.rotation.x = -Math.PI / 2;
    poolWater.position.set(gx(524), 0.28, gz(1577));
    sceneryGroup.add(poolWater);
    cityBuildings.push({ minX: gx(515), maxX: gx(533), minZ: gz(1559), maxZ: gz(1571), height: 7, stories: 1, name: 'Hadley Farms Community Pool & Clubhouse' });

    drawGaithParkingLot(gx(577), gz(1565), 22, 30, 0);
    const schGroup = new THREE.Group();
    schGroup.position.set(gx(610), 0.25, gz(1564));
    const schBrickMat = makeBrickFacadeMat('#9b3b2c', '#e5e7eb', '#1e3a5f', 7, 1, false);
    const schTrimMat = makeCityMat({ color: 0xede5d4, roughness: 0.58 });
    const mainWing = new THREE.Mesh(new THREE.BoxGeometry(30, 7.4, 18), boxWithRoofMat(schBrickMat, flatRoofMat));
    mainWing.position.set(0, 3.7, -2);
    mainWing.castShadow = isUltra;
    schGroup.add(mainWing);
    const gymWing = new THREE.Mesh(new THREE.BoxGeometry(20, 8.8, 12), schTrimMat);
    gymWing.position.set(-5, 4.4, 8);
    gymWing.castShadow = isUltra;
    schGroup.add(gymWing);
    const schSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 1.2, 9.6),
      makeTextSignMat(['JUDITH A. RESNIK ES', '7301 HADLEY FARMS DR'], '#1e3a8a', '#f8fafc', '#fde047')
    );
    schSign.position.set(-15.4, 4.6, -2);
    schGroup.add(schSign);
    sceneryGroup.add(schGroup);
    cityBuildings.push({ minX: gx(594), maxX: gx(626), minZ: gz(1552), maxZ: gz(1579), height: 10, stories: 1, name: 'Judith A. Resnik Elementary School (7301 Hadley Farms Dr)' });

    let hadleyCount = 0;
    const addHadleyLot = (x: number, z: number, rotY: number, houseNum: string, street: string) => {
      if (addSuburbanSlot(x, z, rotY, houseNum, street, hadleyCount + 100)) {
        hadleyCount++;
      }
    };

    // 8A. Hadley Farms West (Spacious 76m E-W corridors & 28-32m lot spacing across x=130..492)
    const hfWestBayA = [160, 192, 224]; // 32m lot spacing between Electra Dr (130) & Cinnabar Dr (260)
    const hfWestBayB = [288, 316, 344]; // 28m lot spacing between Cinnabar Dr (260) & Tygart Ct (372)
    const hfWestBayC = [400, 428, 456]; // 28m lot spacing between Tygart Ct (372) & Woodfield Rd (492)
    for (const [stName, stZ, baseNum, hasBayA] of [
      ['Filbert Dr', 1160, 19700, false],
      ['Boxberry Dr', 1236, 19701, true],
      ['Mayhill Ter', 1312, 19702, true],
      ['Tygart Ln', 1388, 19901, true],
      ['Mattingly Ter', 1464, 20001, false],
    ] as [string, number, number, boolean][]) {
      let n = baseNum;
      const cols = hasBayA ? [...hfWestBayA, ...hfWestBayB, ...hfWestBayC] : [...hfWestBayB, ...hfWestBayC];
      for (const xOff of cols) {
        n += 2;
        addHadleyLot(gx(xOff), gz(stZ - 17.5), 0, String(n), stName);
        n += 2;
        addHadleyLot(gx(xOff), gz(stZ + 17.5), Math.PI, String(n), stName);
      }
    }
    // Filbert Dr West Bay North-West corner (200..260) + Midas Ct Cul-de-Sac (1..5 Midas Ct)
    addHadleyLot(gx(224), gz(1142.5), 0, '19702', 'Filbert Dr');
    addHadleyLot(gx(224), gz(1177.5), Math.PI, '19703', 'Filbert Dr');
    addHadleyLot(gx(206), gz(1450), -0.22, '2', 'Midas Ct');
    addHadleyLot(gx(178), gz(1446), -0.22, '4', 'Midas Ct');
    addHadleyLot(gx(200), gz(1486), Math.PI - 0.22, '1', 'Midas Ct');
    addHadleyLot(gx(172), gz(1482), Math.PI - 0.22, '3', 'Midas Ct');
    addHadleyLot(gx(146), gz(1460), Math.PI / 2, '5', 'Midas Ct');

    // 8B. Hadley Farms East & North (Spacious 76m E-W corridors & 26-30m lot spacing)
    const hfEastBayA = [518, 546, 574]; // 28m spacing (492..600)
    const hfEastBayB = [626, 652, 678]; // 26m spacing (600..702)
    const hfEastBayC = [732, 762];      // 30m spacing (702..792)
    for (const [stName, stZ, baseNum, cols] of [
      ['Cliff Pine Dr', 1084, 7100, [...hfEastBayA, ...hfEastBayB, ...hfEastBayC]],
      ['Barcellona Dr', 1160, 7200, [...hfEastBayA, ...hfEastBayB, ...hfEastBayC]],
      ['Torran Rocks Way', 1236, 7300, [...hfEastBayA, ...hfEastBayB, ...hfEastBayC]],
      ['Cinnabar Ter', 1312, 7404, [...hfEastBayA, ...hfEastBayB]],
      ['Elioak Ter', 1388, 7400, hfEastBayA],
    ] as [string, number, number, number[]][]) {
      let n = baseNum;
      for (const xOff of cols) {
        n += 2;
        addHadleyLot(gx(xOff), gz(stZ - 17.5), 0, String(n), stName);
        n += 2;
        addHadleyLot(gx(xOff), gz(stZ + 17.5), Math.PI, String(n), stName);
      }
    }

    // Electra Ct Cul-de-Sac (z=1388, x=600..676)
    addHadleyLot(gx(624), gz(1370.5), 0, '2', 'Electra Ct');
    addHadleyLot(gx(650), gz(1370.5), 0, '4', 'Electra Ct');
    addHadleyLot(gx(676), gz(1370.5), 0, '6', 'Electra Ct');
    addHadleyLot(gx(624), gz(1405.5), Math.PI, '1', 'Electra Ct');
    addHadleyLot(gx(650), gz(1405.5), Math.PI, '3', 'Electra Ct');
    addHadleyLot(gx(676), gz(1405.5), Math.PI, '5', 'Electra Ct');
    addHadleyLot(gx(695), gz(1388), -Math.PI / 2, '7', 'Electra Ct');

    // Harkness Ct Cul-de-Sac (z=1464, x=482..562)
    addHadleyLot(gx(510), gz(1446.5), 0, '2', 'Harkness Ct');
    addHadleyLot(gx(538), gz(1446.5), 0, '4', 'Harkness Ct');
    addHadleyLot(gx(510), gz(1481.5), Math.PI, '1', 'Harkness Ct');
    addHadleyLot(gx(538), gz(1481.5), Math.PI, '3', 'Harkness Ct');
    addHadleyLot(gx(579), gz(1464), -Math.PI / 2, '5', 'Harkness Ct');

    // Mayhill Ct Circular Roundabout (Center gx(714), gz(1464), Ring R=28m) — 12 Homes (1–12 Mayhill Ct)!
    {
      const { cx, cz, ringRadius, houseRadius, numbers, thetaStart, thetaEnd } = MAYHILL_CT_ROUNDABOUT;
      // Landscaped circular center island + stone curb ring + center tree & plaque
      const islandGrass = new THREE.Mesh(
        new THREE.CircleGeometry(ringRadius - 5.6, 28),
        makeCityMat({ color: 0x15803d, roughness: 0.9 })
      );
      islandGrass.rotation.x = -Math.PI / 2;
      islandGrass.position.set(cx, 0.27, cz);
      islandGrass.receiveShadow = isUltra;
      sceneryGroup.add(islandGrass);

      const islandCurb = new THREE.Mesh(
        new THREE.RingGeometry(ringRadius - 6.0, ringRadius - 5.3, 28),
        makeCityMat({ color: 0xd6d3d1, roughness: 0.78 })
      );
      islandCurb.rotation.x = -Math.PI / 2;
      islandCurb.position.set(cx, 0.285, cz);
      sceneryGroup.add(islandCurb);

      addLandscapedTree(cx, cz, 1.15);
      addStreetNamePost(cx - 2.5, cz - 3.5, 'MAYHILL CT · 1–12', 0);

      const step = (thetaEnd - thetaStart) / Math.max(1, numbers.length - 1);
      numbers.forEach((hNum, idx) => {
        const theta = thetaStart + idx * step;
        const hx = cx + Math.cos(theta) * houseRadius;
        const hz = cz + Math.sin(theta) * houseRadius;
        const rotY = Math.atan2(-Math.cos(theta), -Math.sin(theta));
        addHadleyLot(hx, hz, rotY, hNum, 'Mayhill Ct');
      });
    }

    // Hadley Farms Dr North-Side Homes (z=1540, facing South)
    for (const [hx, hz, rotY, hNum, hSt] of [
      [gx(522), gz(1522.5), 0, '7302', 'Hadley Farms Dr'],
      [gx(554), gz(1522.5), 0, '7306', 'Hadley Farms Dr'],
      [gx(630), gz(1522.5), 0, '7310', 'Hadley Farms Dr'],
      [gx(658), gz(1522.5), 0, '7314', 'Hadley Farms Dr'],
      [gx(686), gz(1522.5), 0, '7318', 'Hadley Farms Dr'],
    ] as [number, number, number, string, string][]) {
      addHadleyLot(hx, hz, rotY, hNum, hSt);
    }

    // Hadley Farms South Townhomes (along south edge of Hadley Farms Dr, clear of Resnik ES & Kildonan Dr)
    const hfThBrick = makeBrickFacadeMat('#8b3728', '#f1f5f9', '#1e293b', 6, 3, false);
    const hfThRoof = makeCityMat({ color: 0x1e293b, roughness: 0.75 });
    for (const [tx, tz, rotY, label] of [
      [gx(656), gz(1560), 0, 'Barcellona Dr Townhomes (Hadley Farms)'],
      [gx(656), gz(1576), 0, 'Filbert Ter Townhomes (Hadley Farms)'],
      [gx(690), gz(1560), 0, 'Elioak Ter Townhomes (Hadley Farms)'],
      [gx(690), gz(1576), 0, 'Hadley Farms Dr Townhomes'],
      [gx(496), gz(1572), 0, 'Torran Rocks Way Townhomes'],
    ] as [number, number, number, string][]) {
      const thGrp = new THREE.Group();
      thGrp.position.set(tx, 0.25, tz);
      thGrp.rotation.y = rotY;
      const thRow = new THREE.Mesh(new THREE.BoxGeometry(22, 8.0, 10), boxWithRoofMat(hfThBrick, flatRoofMat));
      thRow.position.set(0, 4.0, 0);
      thRow.castShadow = isUltra;
      thGrp.add(thRow);
      const thRoof = buildPitchedRoofGroup(22.4, 10.4, 2.8, hfThBrick, hfThRoof, 'x');
      thRoof.position.set(0, 8.0, 0);
      thGrp.add(thRoof);
      sceneryGroup.add(thGrp);
      const halfX = Math.abs(Math.cos(rotY)) > 0.5 ? 12 : 6;
      const halfZ = Math.abs(Math.cos(rotY)) > 0.5 ? 6 : 12;
      cityBuildings.push({ minX: tx - halfX, maxX: tx + halfX, minZ: tz - halfZ, maxZ: tz + halfZ, height: 11, stories: 3, name: label });
    }
    addStreetNamePost(gx(466), gz(1552), 'HADLEY FARMS DR', 0);
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
    cityBuildings.push({ minX: gx(349), maxX: gx(379), minZ: gz(1975), maxZ: gz(2013), height: 14, stories: 1, name: 'Montgomery County Airpark (KGAI) Hangar' });

    drawGaithParkingLot(gx(162), gz(2176), 72, 36, 0);
    const fhBrick = makeBrickFacadeMat('#7c2d12', '#f8fafc', '#fde047', 8, 1, false);
    const fhTrimMat = makeCityMat({ color: 0xe2e8f0, roughness: 0.6 });
    const fhCanopyMat = makeCityMat({ color: 0x064e3b, roughness: 0.55 });
    const fhPlaza = new THREE.Mesh(new THREE.BoxGeometry(68, 11, 24), boxWithRoofMat(fhBrick, flatRoofMat));
    fhPlaza.position.set(gx(174), 5.75, gz(2142));
    fhPlaza.castShadow = isUltra;
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
    cityBuildings.push({ minX: gx(139), maxX: gx(209), minZ: gz(2129), maxZ: gz(2155), height: 14, stories: 1, name: 'Flower Hill Shopping Center (Giant)' });
  }

  // =========================================================================================
  // 10. GOSHEN GIANT, LAKE WHETSTONE, LAKEFOREST, FAIRGROUNDS, OLDE TOWNE MARC & BOHRER PARK
  // =========================================================================================
  {
    const retailTrimMat = makeCityMat({ color: 0xe5e7eb, roughness: 0.6 });
    const retailDarkMat = makeCityMat({ color: 0x1e293b, roughness: 0.65 });
    drawGaithParkingLot(gx(-296), gz(1560), 68, 46, 0);
    const giantAnchor = new THREE.Mesh(new THREE.BoxGeometry(60, 10, 26), boxWithRoofMat(makeBrickFacadeMat('#a16244', '#e5e7eb', '#1e293b', 8, 1, false), flatRoofMat));
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
    cityBuildings.push({ minX: gx(-327), maxX: gx(-265), minZ: gz(1506), maxZ: gz(1534), height: 12, stories: 1, name: 'Goshen Crossing Shopping Center (Giant)' });

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
    cityBuildings.push({ minX: gx(-315), maxX: gx(-257), minZ: gz(1739), maxZ: gz(1769), height: 15, stories: 2, name: 'Lakeforest / Lost Knife Plaza' });

    // Chuck E. Cheese's Fun Center & Arcade (3-Story Landmark Building matching 3F Interior!)
    {
      const cx = gx(-224);
      const cz = gz(1720);
      const cecGroup = new THREE.Group();
      cecGroup.position.set(cx, 0.25, cz);
      const cecWallMat = makeBrickFacadeMat('#581c87', '#facc15', '#38bdf8', 7, 3, true);
      const cecBody = new THREE.Mesh(new THREE.BoxGeometry(32, 13.8, 18), boxWithRoofMat(cecWallMat, flatRoofMat));
      cecBody.position.set(0, 6.9, 0);
      cecBody.castShadow = isUltra;
      cecGroup.add(cecBody);
      const cecCrown = new THREE.Mesh(
        new THREE.BoxGeometry(33.2, 1.3, 19.2),
        makeCityMat({ color: 0xfacc15, roughness: 0.38 })
      );
      cecCrown.position.set(0, 14.3, 0);
      cecGroup.add(cecCrown);
      const cecCanopy = new THREE.Mesh(
        new THREE.BoxGeometry(18, 0.7, 3.8),
        makeCityMat({ color: 0x7e22ce, roughness: 0.45 })
      );
      cecCanopy.position.set(0, 4.1, 10.4);
      cecGroup.add(cecCanopy);
      const cecSign = new THREE.Mesh(
        new THREE.BoxGeometry(24, 3.0, 0.45),
        makeTextSignMat(["CHUCK E. CHEESE'S", '3 FLOORS · ARCADE · SKEE-BALL · CLAW'], '#4c1d95', '#fde047', '#facc15')
      );
      cecSign.position.set(0, 11.4, 9.3);
      cecGroup.add(cecSign);
      const cecRingMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
      disposables.push(cecRingMat);
      const cecRing = new THREE.Mesh(new THREE.RingGeometry(3.2, 4.2, 24), cecRingMat);
      cecRing.rotation.x = -Math.PI / 2;
      cecRing.position.set(0, 0.05, 18); // gz(1738) inside parking lot
      cecGroup.add(cecRing);
      sceneryGroup.add(cecGroup);
      cityBuildings.push({ minX: cx - 16.5, maxX: cx + 16.5, minZ: cz - 9.5, maxZ: cz + 9.5, height: 15.5, stories: 3, name: "Chuck E. Cheese's Fun Center & Arcade" });
    }

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
    cityBuildings.push({ minX: gx(-291), maxX: gx(-239), minZ: gz(1784), maxZ: gz(1806), height: 13, stories: 2, name: 'Montgomery County Fairgrounds Pavilion' });

    // Historic 1884 Queen Anne B&O / MARC Station (red common-bond brick, projecting trackside bay gable, arched window, wood platform canopy & chimneys)
    const depotBrickMat = makeBrickFacadeMat('#991b1b', '#f8fafc', '#fde68a', 6, 2, true);
    const depotSolidBrickMat = makeCityMat({ color: 0x991b1b, roughness: 0.78 });
    const depotRoofMat = makeCityMat({ color: 0x1e293b, roughness: 0.72 });
    const depotWoodTrimMat = makeCityMat({ color: 0xfef3c7, roughness: 0.55 });
    const depotGlassMat = new THREE.MeshPhysicalMaterial({ color: 0x0f2942, roughness: 0.08, clearcoat: 0.9 });
    disposables.push(depotGlassMat);

    const depotBody = new THREE.Mesh(new THREE.BoxGeometry(54, 10, 20), boxWithRoofMat(depotBrickMat, flatRoofMat));
    depotBody.position.set(gx(-125), 5.25, gz(1956));
    depotBody.castShadow = isUltra;
    depotBody.receiveShadow = isUltra;
    sceneryGroup.add(depotBody);

    const depotRoof = buildPitchedRoofGroup(55.4, 21.4, 4.4, depotBrickMat, depotRoofMat, 'x');
    depotRoof.position.set(gx(-125), 10.25, gz(1956));
    sceneryGroup.add(depotRoof);

    // Projecting South-Track Queen Anne Center Gable Bay + Semicircular Arched Window
    const depotCenterBay = new THREE.Mesh(new THREE.BoxGeometry(12.2, 11.4, 5.2), depotSolidBrickMat);
    depotCenterBay.position.set(gx(-125), 5.95, gz(1956) + 9.2);
    depotCenterBay.castShadow = isUltra;
    sceneryGroup.add(depotCenterBay);
    const depotCenterRoof = buildPitchedRoofGroup(12.6, 5.6, 4.2, depotWoodTrimMat, depotRoofMat, 'z');
    depotCenterRoof.position.set(gx(-125), 11.65, gz(1956) + 9.2);
    sceneryGroup.add(depotCenterRoof);
    const depotArchWin = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 0.35, 14, 1, false, 0, Math.PI), depotGlassMat);
    depotArchWin.rotation.z = Math.PI / 2;
    depotArchWin.rotation.y = Math.PI / 2;
    depotArchWin.position.set(gx(-125), 10.4, gz(1956) + 11.82);
    sceneryGroup.add(depotArchWin);

    // Trackside Covered Timber Platform Canopy with Turned Bracket Posts
    const canopyRoof = new THREE.Mesh(new THREE.BoxGeometry(58, 0.42, 6.4), depotRoofMat);
    canopyRoof.position.set(gx(-125), 4.65, gz(1956) + 12.6);
    canopyRoof.rotation.x = 0.14;
    sceneryGroup.add(canopyRoof);
    for (let px = -24; px <= 24; px += 8) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 4.3, 8), depotWoodTrimMat);
      post.position.set(gx(-125) + px, 2.35, gz(1956) + 15.2);
      sceneryGroup.add(post);
    }

    // Twin brick end chimneys + West clock spire
    for (const cx of [-18, 18]) {
      const chim = new THREE.Mesh(new THREE.BoxGeometry(1.8, 5.4, 1.8), depotSolidBrickMat);
      chim.position.set(gx(-125) + cx, 14.5, gz(1956) - 2);
      sceneryGroup.add(chim);
    }
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
    cityBuildings.push({ minX: gx(-153), maxX: gx(-97), minZ: gz(1945), maxZ: gz(1972), height: 24, stories: 2, name: 'Gaithersburg 1884 B&O / MARC Station' });

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
    cityBuildings.push({ minX: gx(-72), maxX: gx(-24), minZ: gz(2088), maxZ: gz(2116), height: 14, stories: 2, name: 'Bohrer Park Activity Center' });

    // 10B. BOHRER PARK BASEBALL DIAMOND (East of Bohrer Park Activity Center, gx(32), gz(2096))
    {
      const bbGroup = new THREE.Group();
      bbGroup.position.set(gx(32), 0.24, gz(2096));
      const outfieldGrassMat = makeCityMat({ color: 0x15803d, roughness: 0.9 });
      const infieldGrassMat = makeCityMat({ color: 0x22c55e, roughness: 0.88 });
      const clayMat = makeCityMat({ color: 0xc27849, roughness: 0.92 });
      const chalkMat = makeCityMat({ color: 0xf8fafc, roughness: 0.65 });
      const fenceWallMat = makeCityMat({ color: 0x14532d, roughness: 0.72 });
      const fenceCapMat = makeCityMat({ color: 0xfacc15, roughness: 0.55 });

      const turfBase = new THREE.Mesh(new THREE.CircleGeometry(33.5, 28), outfieldGrassMat);
      turfBase.rotation.x = -Math.PI / 2;
      turfBase.receiveShadow = isUltra;
      bbGroup.add(turfBase);

      // Mowed outfield stripes
      for (let s = -2; s <= 2; s += 2) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 52), infieldGrassMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(s * 7.2, 0.008, -2);
        bbGroup.add(stripe);
      }

      // Clay infield diamond & basepath arc
      const clayArc = new THREE.Mesh(new THREE.CircleGeometry(19.5, 24), clayMat);
      clayArc.rotation.x = -Math.PI / 2;
      clayArc.position.set(0, 0.015, 7);
      bbGroup.add(clayArc);

      const innerDiamondGrass = new THREE.Mesh(new THREE.PlaneGeometry(17.5, 17.5), infieldGrassMat);
      innerDiamondGrass.rotation.order = 'YXZ';
      innerDiamondGrass.rotation.y = Math.PI / 4;
      innerDiamondGrass.rotation.x = -Math.PI / 2;
      innerDiamondGrass.position.set(0, 0.022, 6);
      bbGroup.add(innerDiamondGrass);

      // Pitcher's mound + rubber
      const mound = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 0.28, 14), clayMat);
      mound.position.set(0, 0.14, 6);
      bbGroup.add(mound);
      const rubber = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.28), chalkMat);
      rubber.position.set(0, 0.29, 6);
      bbGroup.add(rubber);

      // Home plate & 3 bases (1B, 2B, 3B)
      const baseCoords: [number, number][] = [
        [0, 18.2],
        [12.2, 6.0],
        [0, -6.2],
        [-12.2, 6.0],
      ];
      for (const [bx, bz] of baseCoords) {
        const bag = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.95), chalkMat);
        bag.rotation.y = Math.PI / 4;
        bag.position.set(bx, 0.06, bz);
        bbGroup.add(bag);
      }

      // Crisp chalk foul lines
      for (const side of [-1, 1]) {
        const foul = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 38), chalkMat);
        foul.rotation.order = 'YXZ';
        foul.rotation.y = side * (Math.PI / 4);
        foul.rotation.x = -Math.PI / 2;
        foul.position.set(side * 13.4, 0.028, 4.8);
        bbGroup.add(foul);
      }

      // Outfield perimeter fence & yellow HR cap along northern arc
      const segs = 14;
      for (let i = 0; i < segs; i++) {
        const a0 = -Math.PI * 0.85 + (i / segs) * Math.PI * 0.7;
        const aMid = a0 + (Math.PI * 0.7) / (segs * 2);
        const fx = Math.cos(aMid) * 32.8;
        const fz = Math.sin(aMid) * 32.8;
        const panel = new THREE.Mesh(new THREE.BoxGeometry(5.3, 2.2, 0.35), fenceWallMat);
        panel.position.set(fx, 1.1, fz);
        panel.rotation.y = -aMid + Math.PI / 2;
        bbGroup.add(panel);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(5.35, 0.24, 0.42), fenceCapMat);
        cap.position.set(fx, 2.24, fz);
        cap.rotation.y = -aMid + Math.PI / 2;
        bbGroup.add(cap);
      }

      // Dugouts & Backstop
      for (const side of [-1, 1]) {
        const dugout = new THREE.Mesh(new THREE.BoxGeometry(8.5, 2.4, 2.6), makeCityMat({ color: 0x334155, roughness: 0.7 }));
        dugout.rotation.y = side * (Math.PI / 4);
        dugout.position.set(side * 16.5, 1.2, 16.5);
        bbGroup.add(dugout);
      }
      const backstop = new THREE.Mesh(new THREE.BoxGeometry(9.2, 3.6, 0.35), makeCityMat({ color: 0x64748b, roughness: 0.4, metalness: 0.6 }));
      backstop.position.set(0, 1.8, 24.5);
      bbGroup.add(backstop);

      const bbSign = new THREE.Mesh(
        new THREE.BoxGeometry(14, 2.0, 0.4),
        makeTextSignMat(['BOHRER PARK BASEBALL', 'GAITHERSBURG · PRESS [B] TO PLAY'], '#14532d', '#fde047', '#ffffff')
      );
      bbSign.position.set(0, 4.4, -31.5);
      bbGroup.add(bbSign);

      // Glowing yellow sport interaction ring at home-plate entrance
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
      disposables.push(ringMat);
      const bbRing = new THREE.Mesh(new THREE.RingGeometry(4.2, 5.2, 24), ringMat);
      bbRing.rotation.x = -Math.PI / 2;
      bbRing.position.set(0, 0.05, 0);
      bbGroup.add(bbRing);

      sceneryGroup.add(bbGroup);
    }

    // 10B2. BOHRER PARK TURF SOCCER PITCH (South of Baseball Diamond at gx(32), gz(2152))
    {
      const scGroup = new THREE.Group();
      scGroup.position.set(gx(32), 0.24, gz(2152));
      const pitchDark = makeCityMat({ color: 0x15803d, roughness: 0.88 });
      const pitchLight = makeCityMat({ color: 0x22c55e, roughness: 0.86 });
      const chalkMat = makeCityMat({ color: 0xf8fafc, roughness: 0.6 });
      const goalPostMat = makeCityMat({ color: 0xf8fafc, roughness: 0.35, metalness: 0.35 });
      const netMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, wireframe: true, transparent: true, opacity: 0.5 });
      disposables.push(netMat);

      const turfPad = new THREE.Mesh(new THREE.PlaneGeometry(48, 30), pitchDark);
      turfPad.rotation.x = -Math.PI / 2;
      turfPad.receiveShadow = isUltra;
      scGroup.add(turfPad);

      for (let s = -3; s <= 3; s += 2) {
        const band = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 26), pitchLight);
        band.rotation.x = -Math.PI / 2;
        band.position.set(s * 6.0, 0.008, 0);
        scGroup.add(band);
      }

      // Chalk touchlines & center circle
      for (const zLine of [-13, 13]) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(42, 0.26), chalkMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(0, 0.015, zLine);
        scGroup.add(line);
      }
      for (const xLine of [-21, 0, 21]) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 26), chalkMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(xLine, 0.015, 0);
        scGroup.add(line);
      }
      const centerRing = new THREE.Mesh(new THREE.RingGeometry(4.0, 4.3, 24), chalkMat);
      centerRing.rotation.x = -Math.PI / 2;
      centerRing.position.set(0, 0.016, 0);
      scGroup.add(centerRing);

      // Twin 3D Soccer Goals (West & East ends)
      for (const side of [-1, 1]) {
        const gxGoal = side * 21.6;
        for (const gzPost of [-3.4, 3.4]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.5, 8), goalPostMat);
          post.position.set(gxGoal, 1.25, gzPost);
          scGroup.add(post);
        }
        const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 6.9, 8), goalPostMat);
        crossbar.rotation.x = Math.PI / 2;
        crossbar.position.set(gxGoal, 2.5, 0);
        scGroup.add(crossbar);
        const netBox = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 6.7), netMat);
        netBox.position.set(gxGoal + side * 0.9, 1.2, 0);
        scGroup.add(netBox);
      }

      const scSign = new THREE.Mesh(
        new THREE.BoxGeometry(13, 1.8, 0.35),
        makeTextSignMat(['BOHRER SOCCER PITCH', 'PRESS [B] · STRIKER SHOOTOUT'], '#065f46', '#fde047', '#10b981')
      );
      scSign.position.set(0, 3.8, -16.5);
      scGroup.add(scSign);

      const scRingMat = new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide, transparent: true, opacity: 0.78 });
      disposables.push(scRingMat);
      const scRing = new THREE.Mesh(new THREE.RingGeometry(4.0, 5.0, 24), scRingMat);
      scRing.rotation.x = -Math.PI / 2;
      scRing.position.set(0, 0.04, 0);
      scGroup.add(scRing);

      sceneryGroup.add(scGroup);
    }

    // 10B3. BOHRER PARK GRIDIRON FOOTBALL STADIUM (gx(-42), gz(2242))
    {
      const fbGroup = new THREE.Group();
      fbGroup.position.set(gx(-42), 0.24, gz(2242));
      const turfDark = makeCityMat({ color: 0x15803d, roughness: 0.88 });
      const turfLight = makeCityMat({ color: 0x16a34a, roughness: 0.86 });
      const endzoneMat = makeCityMat({ color: 0x991b1b, roughness: 0.85 });
      const yardMat = makeCityMat({ color: 0xf8fafc, roughness: 0.6 });
      const postMat = makeCityMat({ color: 0xfacc15, roughness: 0.35, metalness: 0.4 });
      const bleacherMat = makeCityMat({ color: 0x334155, roughness: 0.7 });

      const fbPad = new THREE.Mesh(new THREE.PlaneGeometry(54, 30), turfDark);
      fbPad.rotation.x = -Math.PI / 2;
      fbPad.receiveShadow = isUltra;
      fbGroup.add(fbPad);

      // Alternating 10-yard turf bands + crisp white yard lines
      for (let yIdx = -4; yIdx <= 4; yIdx++) {
        if (yIdx % 2 === 0) {
          const band = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 24), turfLight);
          band.rotation.x = -Math.PI / 2;
          band.position.set(yIdx * 4.2, 0.008, 0);
          fbGroup.add(band);
        }
        const yLine = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 24), yardMat);
        yLine.rotation.x = -Math.PI / 2;
        yLine.position.set(yIdx * 4.2 - 2.1, 0.015, 0);
        fbGroup.add(yLine);
      }
      // Midfield 50-yd accent + endzones + yellow goalposts
      const midLogo = new THREE.Mesh(new THREE.CircleGeometry(2.6, 16), endzoneMat);
      midLogo.rotation.x = -Math.PI / 2;
      midLogo.position.set(0, 0.016, 0);
      fbGroup.add(midLogo);

      for (const side of [-1, 1]) {
        const ez = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 24), endzoneMat);
        ez.rotation.x = -Math.PI / 2;
        ez.position.set(side * 22.8, 0.012, 0);
        fbGroup.add(ez);

        const gxPost = side * 25.4;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.2, 8), postMat);
        stem.position.set(gxPost, 1.1, 0);
        fbGroup.add(stem);
        const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.2, 8), postMat);
        cross.rotation.x = Math.PI / 2;
        cross.position.set(gxPost, 2.2, 0);
        fbGroup.add(cross);
        for (const zUp of [-2.1, 2.1]) {
          const upright = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.6, 8), postMat);
          upright.position.set(gxPost, 4.0, zUp);
          fbGroup.add(upright);
        }
      }

      // North sideline bleachers & scoreboard sign
      const stand = new THREE.Mesh(new THREE.BoxGeometry(34, 3.2, 3.6), bleacherMat);
      stand.position.set(0, 1.6, -15.2);
      fbGroup.add(stand);

      const fbSign = new THREE.Mesh(
        new THREE.BoxGeometry(15, 2.0, 0.4),
        makeTextSignMat(['BOHRER GRIDIRON STADIUM', 'PRESS [B] · RETRO FOOTBALL'], '#450a0a', '#fde047', '#ef4444')
      );
      fbSign.position.set(0, 4.6, -15.2);
      fbGroup.add(fbSign);

      const fbRingMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0.78 });
      disposables.push(fbRingMat);
      const fbRing = new THREE.Mesh(new THREE.RingGeometry(4.0, 5.0, 24), fbRingMat);
      fbRing.rotation.x = -Math.PI / 2;
      fbRing.position.set(0, 0.05, 0);
      fbGroup.add(fbRing);

      sceneryGroup.add(fbGroup);
      cityBuildings.push({ minX: gx(-60), maxX: gx(-24), minZ: gz(2225), maxZ: gz(2229), height: 5, stories: 1, name: 'Bohrer Gridiron Bleachers' });
    }

    // 10C. GAITHERSBURG COUNTRY CLUB GOLF FIELD (Clean open meadow at gx(515), gz(2275))
    {
      const golfGroup = new THREE.Group();
      golfGroup.position.set(gx(515), 0.24, gz(2275));
      const roughMat = makeCityMat({ color: 0x166534, roughness: 0.92 });
      const fairwayDarkMat = makeCityMat({ color: 0x15803d, roughness: 0.88 });
      const fairwayLightMat = makeCityMat({ color: 0x22c55e, roughness: 0.86 });
      const greenMat = makeCityMat({ color: 0x4ade80, roughness: 0.78 });
      const sandMat = makeCityMat({ color: 0xfde68a, roughness: 0.95 });
      const golfWaterMat = makeCityMat({ color: 0x0284c7, roughness: 0.14, metalness: 0.4 });

      const linksBase = new THREE.Mesh(new THREE.PlaneGeometry(116, 64), roughMat);
      linksBase.rotation.x = -Math.PI / 2;
      linksBase.receiveShadow = isUltra;
      golfGroup.add(linksBase);

      // Alternating mowed fairway stripes running West-to-East toward the green
      for (let i = 0; i < 10; i++) {
        const fStripe = new THREE.Mesh(
          new THREE.PlaneGeometry(9.2, 32),
          i % 2 === 0 ? fairwayLightMat : fairwayDarkMat
        );
        fStripe.rotation.x = -Math.PI / 2;
        fStripe.position.set(-40 + i * 9.2, 0.014, 0);
        golfGroup.add(fStripe);
      }

      // Putting green oval + pin + fluttering red pennant on the East end
      const puttingGreen = new THREE.Mesh(new THREE.CircleGeometry(14, 24), greenMat);
      puttingGreen.rotation.x = -Math.PI / 2;
      puttingGreen.scale.set(1.25, 0.95, 1);
      puttingGreen.position.set(36, 0.024, 0);
      golfGroup.add(puttingGreen);

      const cupMesh = new THREE.Mesh(new THREE.CircleGeometry(0.45, 12), makeCityMat({ color: 0x0f172a, roughness: 0.8 }));
      cupMesh.rotation.x = -Math.PI / 2;
      cupMesh.position.set(38, 0.032, 0);
      golfGroup.add(cupMesh);

      const pinPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.2, 8), makeCityMat({ color: 0xf8fafc, roughness: 0.3 }));
      pinPole.position.set(38, 2.6, 0);
      golfGroup.add(pinPole);

      const flagCloth = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 0.08), makeCityMat({ color: 0xef4444, roughness: 0.45 }));
      flagCloth.position.set(38.9, 4.65, 0);
      golfGroup.add(flagCloth);

      // 3 Golden Sand Bunkers
      for (const [bx, bz, rx, rz] of [
        [24, -14, 6.2, 4.2],
        [34, 15, 7.0, 4.4],
        [-4, -13, 5.5, 3.8],
      ] as [number, number, number, number][]) {
        const sand = new THREE.Mesh(new THREE.CircleGeometry(1, 16), sandMat);
        sand.rotation.x = -Math.PI / 2;
        sand.scale.set(rx, rz, 1);
        sand.position.set(bx, 0.02, bz);
        golfGroup.add(sand);
      }

      // Scenic Water Hazard Pond on South Edge
      const golfPond = new THREE.Mesh(new THREE.CircleGeometry(1, 18), golfWaterMat);
      golfPond.rotation.x = -Math.PI / 2;
      golfPond.scale.set(14, 7.5, 1);
      golfPond.position.set(4, 0.018, 20);
      golfGroup.add(golfPond);

      // Tee box + Asphalt Cart Apron + Pro Shop Starter Kiosk at West Entrance (gx(468), gz(2275))
      const teePad = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), fairwayLightMat);
      teePad.rotation.x = -Math.PI / 2;
      teePad.position.set(-46, 0.024, 0);
      golfGroup.add(teePad);

      const kioskMat = makeSidingMat('#f1f5f9');
      const kioskRoofMat = makeCityMat({ color: 0x14532d, roughness: 0.65 });
      const kiosk = new THREE.Mesh(new THREE.BoxGeometry(8, 3.8, 6), kioskMat);
      kiosk.position.set(-51, 1.9, -12);
      golfGroup.add(kiosk);
      const kioskRoof = buildPitchedRoofGroup(8.6, 6.6, 2.0, kioskMat, kioskRoofMat, 'x');
      kioskRoof.position.set(-51, 3.8, -12);
      golfGroup.add(kioskRoof);
      const golfSign = new THREE.Mesh(
        new THREE.BoxGeometry(12, 1.8, 0.35),
        makeTextSignMat(['GAITHERSBURG GOLF FIELD', 'PRESS [B] · 3-HOLE RETRO LINKS'], '#064e3b', '#fde047', '#22c55e')
      );
      golfSign.rotation.y = Math.PI / 2;
      golfSign.position.set(-55.4, 3.2, -12);
      golfGroup.add(golfSign);

      const golfRingMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide, transparent: true, opacity: 0.72 });
      disposables.push(golfRingMat);
      const golfRing = new THREE.Mesh(new THREE.RingGeometry(4.2, 5.2, 24), golfRingMat);
      golfRing.rotation.x = -Math.PI / 2;
      golfRing.position.set(-47, 0.05, 0);
      golfGroup.add(golfRing);

      sceneryGroup.add(golfGroup);
      cityBuildings.push({ minX: gx(460), maxX: gx(468), minZ: gz(2260), maxZ: gz(2266), height: 6, stories: 1, name: 'Gaithersburg Golf Starter Kiosk' });
    }
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
    cityBuildings.push({ minX: gx(-552), maxX: gx(-492), minZ: gz(2023), maxZ: gz(2067), height: 24, stories: 4, name: 'NIST Federal Research Campus' });

    // RIO Lakefront: Genuine Planar Reflective Water, Small Visible Perimeter Barrier & Waterfront Stores
    const rioX = gx(-464);
    const rioLakeZ = gz(2304);
    const lakeW = 78;
    const lakeD = 48;

    if (!isRetroPixel) {
      const lakeGeo = new THREE.PlaneGeometry(lakeW, lakeD);
      disposables.push(lakeGeo);
      const rioReflector = new Reflector(lakeGeo, {
        clipBias: 0.003,
        textureWidth: isUltra ? 1024 : 512,
        textureHeight: isUltra ? 1024 : 512,
        color: 0x3b6e8c,
      });
      rioReflector.rotation.x = -Math.PI / 2;
      rioReflector.position.set(rioX, 0.236, rioLakeZ);
      sceneryGroup.add(rioReflector);
      reflectorToggleables.push(rioReflector);
      disposables.push(rioReflector);

      const rioTintOverlay = new THREE.Mesh(
        new THREE.PlaneGeometry(lakeW, lakeD),
        new THREE.MeshStandardMaterial({
          color: 0x0e7490,
          transparent: true,
          opacity: 0.24,
          roughness: 0.08,
          metalness: 0.42,
        })
      );
      rioTintOverlay.rotation.x = -Math.PI / 2;
      rioTintOverlay.position.set(rioX, 0.244, rioLakeZ);
      sceneryGroup.add(rioTintOverlay);
    } else {
      const rioLake = new THREE.Mesh(new THREE.PlaneGeometry(lakeW, lakeD), waterMat);
      rioLake.rotation.x = -Math.PI / 2;
      rioLake.position.set(rioX, 0.236, rioLakeZ);
      sceneryGroup.add(rioLake);
    }

    // Small Visible Wrought-Iron & Stone Bollard Perimeter Barrier around all 4 sides of RIO Lake
    const barHalfW = lakeW * 0.5 + 0.45;
    const barHalfD = lakeD * 0.5 + 0.45;
    const ironRailMat = makeCityMat({ color: 0x1e293b, roughness: 0.35, metalness: 0.72 });
    const bollardMat = makeCityMat({ color: 0x94a3b8, roughness: 0.65, metalness: 0.12 });
    for (const [bx, bz, bw, bd, label] of [
      [rioX, rioLakeZ - barHalfD, lakeW + 1.2, 0.24, 'North'],
      [rioX, rioLakeZ + barHalfD, lakeW + 1.2, 0.24, 'South'],
      [rioX - barHalfW, rioLakeZ, 0.24, lakeD + 1.2, 'West'],
      [rioX + barHalfW, rioLakeZ, 0.24, lakeD + 1.2, 'East'],
    ] as [number, number, number, number, string][]) {
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.14, bd), ironRailMat);
      topRail.position.set(bx, 1.05, bz);
      sceneryGroup.add(topRail);
      const midRail = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.1, bd), ironRailMat);
      midRail.position.set(bx, 0.72, bz);
      sceneryGroup.add(midRail);
      cityBuildings.push({
        minX: bx - Math.max(0.65, bw * 0.5),
        maxX: bx + Math.max(0.65, bw * 0.5),
        minZ: bz - Math.max(0.65, bd * 0.5),
        maxZ: bz + Math.max(0.65, bd * 0.5),
        height: 1.5,
        name: `RIO Lakefront ${label} Barrier`,
      });
    }
    const postPositions: [number, number][] = [];
    for (let px = -barHalfW; px <= barHalfW + 0.1; px += 6.5) {
      postPositions.push([rioX + Math.min(barHalfW, px), rioLakeZ - barHalfD]);
      postPositions.push([rioX + Math.min(barHalfW, px), rioLakeZ + barHalfD]);
    }
    for (let pz = -barHalfD + 6; pz <= barHalfD - 5.9; pz += 6.0) {
      postPositions.push([rioX - barHalfW, rioLakeZ + pz]);
      postPositions.push([rioX + barHalfW, rioLakeZ + pz]);
    }
    const postGeo = new THREE.BoxGeometry(0.42, 1.15, 0.42);
    const postInst = new THREE.InstancedMesh(postGeo, bollardMat, postPositions.length);
    const pDummy = new THREE.Object3D();
    postPositions.forEach(([px, pz], idx) => {
      pDummy.position.set(px, 0.25 + 0.575, pz);
      pDummy.updateMatrix();
      postInst.setMatrixAt(idx, pDummy.matrix);
    });
    postInst.instanceMatrix.needsUpdate = true;
    postInst.computeBoundingSphere();
    sceneryGroup.add(postInst);

    // Central Dancing Lake Fountain + Timber Pier Fishing Jetty + Arched Footbridge
    const limestoneMat = makeCityMat({ color: 0xe2e8f0, roughness: 0.52 });
    const fountainFoamMat = new THREE.MeshBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.85 });
    const fountainGlowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.72 });
    disposables.push(fountainFoamMat, fountainGlowMat);

    const fountainRing = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.2, 0.85, 22), limestoneMat);
    fountainRing.position.set(rioX - 10, 0.48, rioLakeZ + 4);
    sceneryGroup.add(fountainRing);
    const fountainPlume = new THREE.Mesh(new THREE.ConeGeometry(1.8, 5.8, 12), fountainFoamMat);
    fountainPlume.position.set(rioX - 10, 3.6, rioLakeZ + 4);
    sceneryGroup.add(fountainPlume);
    const fountainCrownJet = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.65, 7.6, 10), fountainGlowMat);
    fountainCrownJet.position.set(rioX - 10, 4.4, rioLakeZ + 4);
    sceneryGroup.add(fountainCrownJet);

    // Timber Boardwalk promenade, Fishing Pier Jetty, Waterfront Pergolas & Americana Carousel
    const woodDeckMat = makeCityMat({ color: 0x7c4a26, roughness: 0.78 });
    const whitePergolaMat = makeCityMat({ color: 0xf8fafc, roughness: 0.45 });
    const brassPoleMat = makeCityMat({ color: 0xfbbf24, roughness: 0.25, metalness: 0.85 });
    const warmStringBulbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    disposables.push(warmStringBulbMat);

    const rioBoardwalk = new THREE.Mesh(new THREE.BoxGeometry(96, 0.44, 11), woodDeckMat);
    rioBoardwalk.position.set(rioX, 0.42, rioLakeZ - 30);
    rioBoardwalk.receiveShadow = isUltra;
    sceneryGroup.add(rioBoardwalk);

    // Timber Lakeside Patio Deck along South & West restaurants
    const southPatioDeck = new THREE.Mesh(new THREE.BoxGeometry(76, 0.36, 7.5), woodDeckMat);
    southPatioDeck.position.set(rioX + 2, 0.38, rioLakeZ + 29);
    southPatioDeck.receiveShadow = isUltra;
    sceneryGroup.add(southPatioDeck);

    // Scenic Pedestrian Arch Bridge across East end of RIO Lake (gx(-432), gz(2304))
    {
      const brX = gx(-432);
      const brDeck = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.4, 24), woodDeckMat);
      brDeck.position.set(brX, 1.45, rioLakeZ);
      sceneryGroup.add(brDeck);
      for (const side of [-2.1, 2.1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 24), ironRailMat);
        rail.position.set(brX + side, 2.05, rioLakeZ);
        sceneryGroup.add(rail);
      }
      for (const endZ of [-12, 12]) {
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.36, 9.5), woodDeckMat);
        ramp.rotation.x = endZ < 0 ? -0.14 : 0.14;
        ramp.position.set(brX, 0.88, rioLakeZ + endZ * 1.25);
        sceneryGroup.add(ramp);
      }
    }

    // RIO Lakefront Fishing Pier Jetty at MD_LANDMARKS.rioFishingPier (gx(-464), gz(2274))
    {
      const pierX = gx(-464);
      const pierZ = gz(2274);
      const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.42, 12), woodDeckMat);
      pierDeck.position.set(pierX, 0.56, pierZ + 3.5);
      sceneryGroup.add(pierDeck);
      for (const px of [-2.8, 2.8]) {
        for (const pz of [-1, 4, 8.5]) {
          const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 1.8, 8), makeCityMat({ color: 0x451a03, roughness: 0.9 }));
          piling.position.set(pierX + px, 0.72, pierZ + pz);
          sceneryGroup.add(piling);
        }
      }
      const fishSign = new THREE.Mesh(
        new THREE.BoxGeometry(8.5, 1.4, 0.3),
        makeTextSignMat(['RIO FISHING PIER', 'PRESS [B] · BASS & CRAB'], '#0e7490', '#f8fafc', '#22d3ee')
      );
      fishSign.position.set(pierX, 3.1, pierZ - 2.2);
      sceneryGroup.add(fishSign);
      const fishRingMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
      disposables.push(fishRingMat);
      const fishRing = new THREE.Mesh(new THREE.RingGeometry(3.5, 4.4, 24), fishRingMat);
      fishRing.rotation.x = -Math.PI / 2;
      fishRing.position.set(pierX, 0.29, pierZ - 3.5);
      sceneryGroup.add(fishRing);
    }

    // Waterfront Umbrella Cafe Tables along North & South Boardwalk
    const umbColors = [0xdc2626, 0x0284c7, 0xd97706, 0x059669];
    for (let u = 0; u < 8; u++) {
      const ux = rioX - 31 + u * 8.8;
      const uz = u % 2 === 0 ? rioLakeZ - 28.5 : rioLakeZ + 28.5;
      const uPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), whitePergolaMat);
      uPole.position.set(ux, 1.5, uz);
      sceneryGroup.add(uPole);
      const uCanopy = new THREE.Mesh(new THREE.ConeGeometry(1.65, 0.75, 8), makeCityMat({ color: umbColors[u % umbColors.length], roughness: 0.55 }));
      uCanopy.position.set(ux, 2.85, uz);
      sceneryGroup.add(uCanopy);
    }

    // Architectural Timber Pergolas & Warm String-Light Lantern Poles along RIO Boardwalk
    for (const px of [-34, 0, 34]) {
      const pergX = rioX + px;
      const pergZ = rioLakeZ - 30;
      for (const ox of [-4.2, 4.2]) {
        for (const oz of [-3.2, 3.2]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, 4.2, 0.32), whitePergolaMat);
          post.position.set(pergX + ox, 2.5, pergZ + oz);
          sceneryGroup.add(post);
        }
      }
      for (let b = -3.6; b <= 3.6; b += 1.44) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 7.2), woodDeckMat);
        beam.position.set(pergX + b, 4.65, pergZ);
        sceneryGroup.add(beam);
      }
    }
    for (let lx = -38; lx <= 38; lx += 9.5) {
      const lPost = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.6, 6), ironRailMat);
      lPost.position.set(rioX + lx, 2.0, rioLakeZ - 24.5);
      sceneryGroup.add(lPost);
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), warmStringBulbMat);
      lantern.position.set(rioX + lx, 3.9, rioLakeZ - 24.5);
      sceneryGroup.add(lantern);
    }

    // Authentic Multi-Ring Carousel Pavilion with Striped Canopy, Golden Finial & Brass Poles
    const carouselPier = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 9.5, 0.58, 22), woodDeckMat);
    carouselPier.position.set(rioX, 0.52, rioLakeZ - 15);
    sceneryGroup.add(carouselPier);
    const carouselPlatform = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.4, 0.38, 20), whitePergolaMat);
    carouselPlatform.position.set(rioX, 0.95, rioLakeZ - 15);
    sceneryGroup.add(carouselPlatform);
    const carouselCore = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 4.8, 12), makeCityMat({ color: 0xfef3c7, roughness: 0.35 }));
    carouselCore.position.set(rioX, 3.4, rioLakeZ - 15);
    sceneryGroup.add(carouselCore);
    for (let p = 0; p < 8; p++) {
      const ang = (p / 8) * Math.PI * 2;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.5, 6), brassPoleMat);
      pole.position.set(rioX + Math.cos(ang) * 5.4, 3.3, rioLakeZ - 15 + Math.sin(ang) * 5.4);
      sceneryGroup.add(pole);
    }
    const carouselFrieze = new THREE.Mesh(new THREE.CylinderGeometry(7.9, 7.9, 0.85, 22), makeCityMat({ color: 0xfde047, roughness: 0.32 }));
    carouselFrieze.position.set(rioX, 5.4, rioLakeZ - 15);
    sceneryGroup.add(carouselFrieze);
    const carouselCanopy = new THREE.Mesh(new THREE.ConeGeometry(8.2, 4.2, 22), makeCityMat({ color: 0xdc2626, roughness: 0.42 }));
    carouselCanopy.position.set(rioX, 7.9, rioLakeZ - 15);
    sceneryGroup.add(carouselCanopy);
    const carouselFinial = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.6, 8), brassPoleMat);
    carouselFinial.position.set(rioX, 10.6, rioLakeZ - 15);
    sceneryGroup.add(carouselFinial);

    // Waterfront Stores & Restaurants surrounding all 4 sides of RIO Lake (cleanly West of Washingtonian Blvd x = gx(-378))
    const rioStores: {
      x: number;
      z: number;
      w: number;
      h: number;
      d: number;
      brickHex: string;
      winHex: string;
      awningHex?: number;
      signLines?: string[];
      signSide?: 'N' | 'S' | 'E' | 'W';
      kind?: 'amc' | 'target' | 'bn' | 'restaurant';
      name: string;
    }[] = [
      // North Row (facing lake)
      { x: gx(-464), z: gz(2244), w: 42, h: 15.5, d: 20, brickHex: '#9a3412', winHex: '#fbbf24', awningHex: 0x7f1d1d, kind: 'amc', signLines: ['RIO LAKEFRONT · WASHINGTONIAN', 'AMC DINE-IN 18 · IMAX'], signSide: 'S', name: 'RIO Lakefront AMC Dine-In 18' },
      { x: gx(-502), z: gz(2248), w: 24, h: 12.2, d: 18, brickHex: '#b91c1c', winHex: '#f8fafc', awningHex: 0x991b1b, kind: 'target', signLines: ['TARGET · DICK\'S SPORTING GOODS', 'RIO WASHINGTONIAN CENTER'], signSide: 'S', name: 'RIO Target & Dick\'s Sporting Goods' },
      { x: gx(-426), z: gz(2248), w: 24, h: 11.8, d: 18, brickHex: '#78350f', winHex: '#fde68a', awningHex: 0x14532d, kind: 'bn', signLines: ['BARNES & NOBLE · COPPER CANYON', 'BOOKSELLERS & WATERFRONT CAFE'], signSide: 'S', name: 'RIO Barnes & Noble & Copper Canyon' },
      // West Row (facing lake East)
      { x: gx(-516), z: gz(2289), w: 14, h: 10.5, d: 22, brickHex: '#a16207', winHex: '#fef08a', awningHex: 0x9a3412, signLines: ['UNCLE JULIO\'S RIO'], signSide: 'E', name: 'Uncle Julio\'s Rio Grande Cafe' },
      { x: gx(-516), z: gz(2317), w: 14, h: 10.0, d: 22, brickHex: '#475569', winHex: '#bae6fd', awningHex: 0x0f766e, signLines: ['TRUE FOOD KITCHEN · BOUTIQUES'], signSide: 'E', name: 'True Food Kitchen & RIO Shops' },
      // East Row (facing lake West, pulled cleanly clear of Washingtonian Blvd gx(-378))
      { x: gx(-412), z: gz(2290), w: 14, h: 10.5, d: 20, brickHex: '#7c2d12', winHex: '#fde68a', awningHex: 0x1e293b, signLines: ['GUAPO\'S CANTINA · PATIO'], signSide: 'W', name: 'Guapo\'s Cantina RIO' },
      { x: gx(-408), z: gz(2320), w: 14, h: 10.0, d: 20, brickHex: '#334155', winHex: '#38bdf8', awningHex: 0xb91c1c, signLines: ['SILVER DINER · LAKEFRONT'], signSide: 'W', name: 'Silver Diner RIO Lakefront' },
      // South Row (facing lake North)
      { x: gx(-486), z: gz(2344), w: 20, h: 9.8, d: 11, brickHex: '#8b3a2b', winHex: '#fef3c7', awningHex: 0x7c2d12, signLines: ['CHARLEY PRIME FOODS'], signSide: 'N', name: 'Charley Prime Foods RIO' },
      { x: gx(-458), z: gz(2344), w: 20, h: 9.8, d: 11, brickHex: '#57534e', winHex: '#bae6fd', awningHex: 0x1e293b, signLines: ['YARD HOUSE · LAKEFRONT PATIO'], signSide: 'N', name: 'Yard House RIO' },
      { x: gx(-430), z: gz(2344), w: 20, h: 9.8, d: 11, brickHex: '#1e3a5f', winHex: '#fde047', awningHex: 0x0369a1, signLines: ['LAKESIDE BISTRO & GELATO'], signSide: 'N', name: 'Lakeside Bistro & Shops' },
    ];
    const amcGlassMat = new THREE.MeshPhysicalMaterial({ color: 0x0f2744, roughness: 0.06, metalness: 0.25, clearcoat: 1.0 });
    disposables.push(amcGlassMat);

    for (const st of rioStores) {
      const mat = makeBrickFacadeMat(st.brickHex, '#f1f5f9', st.winHex, 6, 2, true);
      const bMesh = new THREE.Mesh(new THREE.BoxGeometry(st.w, st.h, st.d), boxWithRoofMat(mat, flatRoofMat));
      bMesh.position.set(st.x, st.h * 0.5 + 0.25, st.z);
      bMesh.castShadow = isUltra;
      bMesh.receiveShadow = isUltra;
      sceneryGroup.add(bMesh);
      const crown = new THREE.Mesh(new THREE.BoxGeometry(st.w + 1.1, 0.95, st.d + 1.1), campusTrimMat);
      crown.position.set(st.x, st.h + 0.72, st.z);
      sceneryGroup.add(crown);

      // Architectural ground-floor storefront awning canopy facing RIO lakefront promenade
      if (st.awningHex !== undefined) {
        const awMat = makeCityMat({ color: st.awningHex, roughness: 0.55 });
        const awW = st.signSide === 'N' || st.signSide === 'S' ? st.w - 2.4 : 2.6;
        const awD = st.signSide === 'N' || st.signSide === 'S' ? 2.6 : st.d - 2.4;
        const aw = new THREE.Mesh(new THREE.BoxGeometry(awW, 0.36, awD), awMat);
        if (st.signSide === 'S') aw.position.set(st.x, 4.4, st.z + st.d * 0.5 + 1.25);
        else if (st.signSide === 'N') aw.position.set(st.x, 4.4, st.z - st.d * 0.5 - 1.25);
        else if (st.signSide === 'E') aw.position.set(st.x + st.w * 0.5 + 1.25, 4.4, st.z);
        else aw.position.set(st.x - st.w * 0.5 - 1.25, 4.4, st.z);
        sceneryGroup.add(aw);
      }

      // Signature RIO Anchor Landmark Details
      if (st.kind === 'amc') {
        const lobbyGlass = new THREE.Mesh(new THREE.BoxGeometry(22, 11.2, 2.2), amcGlassMat);
        lobbyGlass.position.set(st.x, 5.85, st.z + st.d * 0.5 + 0.9);
        sceneryGroup.add(lobbyGlass);
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 9.2, 1.4),
          makeTextSignMat(['AMC', '18'], '#b91c1c', '#fef08a', '#ffffff')
        );
        blade.position.set(st.x, 12.2, st.z + st.d * 0.5 + 2.1);
        sceneryGroup.add(blade);
      } else if (st.kind === 'target') {
        const bullOuter = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.38, 10, 22), makeCityMat({ color: 0xef4444, roughness: 0.35 }));
        bullOuter.position.set(st.x, st.h + 1.9, st.z + st.d * 0.5 + 0.3);
        sceneryGroup.add(bullOuter);
        const bullDot = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.35, 16), makeCityMat({ color: 0xef4444, roughness: 0.35 }));
        bullDot.rotation.x = Math.PI / 2;
        bullDot.position.set(st.x, st.h + 1.9, st.z + st.d * 0.5 + 0.3);
        sceneryGroup.add(bullDot);
      } else if (st.kind === 'bn') {
        // Famous RIO Barnes & Noble literary art mural panel & brick pilasters
        const mural = new THREE.Mesh(
          new THREE.BoxGeometry(11.5, 6.2, 0.35),
          makeTextSignMat(['CLASSIC BOOKS · POETRY', 'GAITHERSBURG LITERARY WALL'], '#1e3a5f', '#fde68a', '#d97706')
        );
        mural.position.set(st.x + 5.2, 6.4, st.z + st.d * 0.5 + 0.25);
        sceneryGroup.add(mural);
      }

      if (st.signLines) {
        const signFaceW = st.signSide === 'N' || st.signSide === 'S' ? Math.min(st.w - 3, 28) : Math.min(st.d - 3, 18);
        const sMesh = new THREE.Mesh(
          new THREE.BoxGeometry(signFaceW, 2.4, 0.35),
          makeTextSignMat(st.signLines, '#0f172a', '#fde047', '#38bdf8')
        );
        if (st.signSide === 'S') sMesh.position.set(st.x, st.h - 1.6, st.z + st.d * 0.5 + 0.28);
        else if (st.signSide === 'N') sMesh.position.set(st.x, st.h - 1.6, st.z - st.d * 0.5 - 0.28);
        else if (st.signSide === 'E') {
          sMesh.rotation.y = Math.PI / 2;
          sMesh.position.set(st.x + st.w * 0.5 + 0.28, st.h - 1.6, st.z);
        } else {
          sMesh.rotation.y = -Math.PI / 2;
          sMesh.position.set(st.x - st.w * 0.5 - 0.28, st.h - 1.6, st.z);
        }
        sceneryGroup.add(sMesh);
      }
      cityBuildings.push({
        minX: st.x - st.w * 0.5 - 0.6,
        maxX: st.x + st.w * 0.5 + 0.6,
        minZ: st.z - st.d * 0.5 - 0.6,
        maxZ: st.z + st.d * 0.5 + 0.6,
        height: st.h + 2,
        stories: 2,
        name: st.name,
      });
    }

    // DOWNTOWN CROWN URBAN VILLAGE (Multi-Building Brick Piazza + Courtyard Fountain + Neon Bowling Lanes)
    const crownPiazza = new THREE.Mesh(new THREE.PlaneGeometry(84, 92), makeCityMat({ color: 0x475569, roughness: 0.78 }));
    crownPiazza.rotation.x = -Math.PI / 2;
    crownPiazza.position.set(gx(-324), 0.242, gz(2294));
    crownPiazza.receiveShadow = isUltra;
    sceneryGroup.add(crownPiazza);

    // Central Crown Plaza Fountain
    const crownBasin = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.8, 0.75, 18), limestoneMat);
    crownBasin.position.set(gx(-324), 0.62, gz(2294));
    sceneryGroup.add(crownBasin);
    const crownJet = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.8, 10), fountainGlowMat);
    crownJet.position.set(gx(-324), 2.7, gz(2294));
    sceneryGroup.add(crownJet);

    // Downtown Crown Neon Bowling Lanes Pavilion at MD_LANDMARKS.rioBowlingArcade (gx(-348), gz(2268))
    {
      const bx = gx(-344);
      const bz = gz(2264);
      const bowlWallMat = makeBrickFacadeMat('#312e81', '#cbd5e1', '#e879f9', 6, 2, true);
      const bowlMesh = new THREE.Mesh(new THREE.BoxGeometry(24, 11.5, 22), boxWithRoofMat(bowlWallMat, flatRoofMat));
      bowlMesh.position.set(bx, 6.0, bz);
      bowlMesh.castShadow = isUltra;
      sceneryGroup.add(bowlMesh);
      const bowlSign = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 2.8, 18),
        makeTextSignMat(['CROWN NEON BOWLING', 'PRESS [B] · 5-FRAME ARCADE'], '#4c1d95', '#f0abfc', '#22d3ee')
      );
      bowlSign.position.set(bx - 12.2, 8.2, bz);
      sceneryGroup.add(bowlSign);
      // Giant Rooftop Bowling Pin Sculpture
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.15, 5.2, 12), whitePergolaMat);
      pin.position.set(bx, 14.3, bz);
      sceneryGroup.add(pin);
      const pinStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.65, 12), makeCityMat({ color: 0xef4444, roughness: 0.35 }));
      pinStripe.position.set(bx, 15.2, bz);
      sceneryGroup.add(pinStripe);
      const bowlRingMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
      disposables.push(bowlRingMat);
      const bowlRing = new THREE.Mesh(new THREE.RingGeometry(3.8, 4.8, 24), bowlRingMat);
      bowlRing.rotation.x = -Math.PI / 2;
      bowlRing.position.set(gx(-348), 0.28, gz(2268));
      sceneryGroup.add(bowlRing);
      cityBuildings.push({ minX: bx - 12.5, maxX: bx + 12.5, minZ: bz - 11.5, maxZ: bz + 11.5, height: 18, stories: 2, name: 'Downtown Crown Neon Bowling Lanes' });
    }

    // Dave & Buster's RIO Washingtonian Flagship (3-Story Landmark Building matching 3F Interior!)
    {
      const dbx = gx(-376);
      const dbz = gz(2142);
      drawGaithParkingLot(dbx, gz(2170), 42, 24, 0);
      const dbGroup = new THREE.Group();
      dbGroup.position.set(dbx, 0.25, dbz);
      const dbWallMat = makeBrickFacadeMat('#1e293b', '#38bdf8', '#f97316', 8, 3, true);
      const dbBody = new THREE.Mesh(new THREE.BoxGeometry(36, 15.0, 20), boxWithRoofMat(dbWallMat, flatRoofMat));
      dbBody.position.set(0, 7.5, 0);
      dbBody.castShadow = isUltra;
      dbGroup.add(dbBody);
      const dbTrim = new THREE.Mesh(
        new THREE.BoxGeometry(37.2, 1.4, 21.2),
        makeCityMat({ color: 0xf97316, roughness: 0.35 })
      );
      dbTrim.position.set(0, 15.6, 0);
      dbGroup.add(dbTrim);
      const dbPortal = new THREE.Mesh(
        new THREE.CylinderGeometry(5.8, 5.8, 14.5, 16, 1, false, -Math.PI * 0.5, Math.PI),
        makeCityMat({ color: 0x0f172a, roughness: 0.35, metalness: 0.5 })
      );
      dbPortal.position.set(0, 7.25, 10.0);
      dbGroup.add(dbPortal);
      const dbSign = new THREE.Mesh(
        new THREE.BoxGeometry(28, 3.2, 0.5),
        makeTextSignMat(["DAVE & BUSTER'S · RIO", '3 FLOORS · MEGA ARCADE · AIR HOCKEY · BILLIARDS'], '#1e3a8a', '#f97316', '#38bdf8')
      );
      dbSign.position.set(0, 12.2, 12.6);
      dbGroup.add(dbSign);
      const dbRingMat = new THREE.MeshBasicMaterial({ color: 0xf97316, side: THREE.DoubleSide, transparent: true, opacity: 0.82 });
      disposables.push(dbRingMat);
      const dbRing = new THREE.Mesh(new THREE.RingGeometry(3.4, 4.4, 24), dbRingMat);
      dbRing.rotation.x = -Math.PI / 2;
      dbRing.position.set(0, 0.05, 22); // gz(2164) in front of entrance
      dbGroup.add(dbRing);
      sceneryGroup.add(dbGroup);
      cityBuildings.push({ minX: dbx - 18.5, maxX: dbx + 18.5, minZ: dbz - 10.5, maxZ: dbz + 11.5, height: 17, stories: 3, name: "Dave & Buster's RIO Washingtonian" });
    }

    // Surrounding Mixed-Use Downtown Crown Buildings (Retail + Penthouse Lofts)
    for (const [cx, cz, cw, ch, cd, brick, win, signL, label] of [
      [gx(-342), gz(2324), 24, 15, 26, '#7c2d12', '#fef08a', ['FOUNDING FARMERS', 'DOWNTOWN CROWN'], 'Founding Farmers & Crown Bistro'],
      [gx(-300), gz(2264), 26, 18, 24, '#475569', '#bae6fd', ['LA FITNESS · LOFTS', 'CROWN URBAN VILLAGE'], 'Crown Residences North'],
      [gx(-300), gz(2324), 26, 16.5, 26, '#57534e', '#fde047', ['HARRIS TEETER · RUTH\'S CHRIS', 'DOWNTOWN CROWN'], 'Downtown Crown Urban Village'],
    ] as [number, number, number, number, number, string, string, string[], string][]) {
      const mat = makeBrickFacadeMat(brick, '#e2e8f0', win, 6, 3, true);
      const blk = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cd), boxWithRoofMat(mat, flatRoofMat));
      blk.position.set(cx, ch * 0.5 + 0.25, cz);
      blk.castShadow = isUltra;
      sceneryGroup.add(blk);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(cw + 1, 0.9, cd + 1), campusTrimMat);
      trim.position.set(cx, ch + 0.7, cz);
      sceneryGroup.add(trim);
      const sg = new THREE.Mesh(new THREE.BoxGeometry(cw - 4, 2.2, 0.35), makeTextSignMat(signL, '#0f172a', '#fde047', '#f59e0b'));
      sg.position.set(cx, 5.4, cz - cd * 0.5 - 0.28);
      sceneryGroup.add(sg);
      cityBuildings.push({ minX: cx - cw * 0.5 - 0.6, maxX: cx + cw * 0.5 + 0.6, minZ: cz - cd * 0.5 - 0.6, maxZ: cz + cd * 0.5 + 0.6, height: ch + 1.5, stories: 3, name: label });
    }

    // INTERACTIVE WOODFIELD SHELL PIT STOP, WASHINGTONIAN EV BAY, CAR MEET PLAZA & GAITHERSBURG SPEED TRAPS
    for (const [sx, sz, col, label] of [
      [gx(448), gz(1760), 0xfacc15, 'SHELL V-POWER · NITRO & REPAIR'],
      [gx(-378), gz(2232), 0x06b6d4, 'RIO SUPERCHARGE · WASH & NITRO'],
    ] as [number, number, number, string][]) {
      const canopyMat = makeCityMat({ color: col, roughness: 0.35, metalness: 0.3 });
      const canopyRoof = new THREE.Mesh(new THREE.BoxGeometry(11, 0.7, 7.5), canopyMat);
      canopyRoof.position.set(sx + 6.5, 4.6, sz);
      sceneryGroup.add(canopyRoof);
      for (const pz of [-2.4, 2.4]) {
        const colMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 4.4, 0.55), limestoneMat);
        colMesh.position.set(sx + 9.2, 2.45, sz + pz);
        sceneryGroup.add(colMesh);
      }
      const baySign = new THREE.Mesh(new THREE.BoxGeometry(9.6, 1.1, 0.28), makeTextSignMat([label, 'PRESS [E] TO REFUEL & REPAIR'], '#0f172a', '#38bdf8', '#22c55e'));
      baySign.rotation.y = -Math.PI / 2;
      baySign.position.set(sx + 0.9, 4.6, sz);
      sceneryGroup.add(baySign);
      const bayRing = new THREE.Mesh(
        new THREE.RingGeometry(3.2, 4.2, 24),
        new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide, transparent: true, opacity: 0.72 })
      );
      bayRing.rotation.x = -Math.PI / 2;
      bayRing.position.set(sx, 0.29, sz);
      sceneryGroup.add(bayRing);
    }

    // Car Meet Showcase Pad at Washingtonian Blvd Promenade
    const meetRing = new THREE.Mesh(
      new THREE.RingGeometry(4.4, 5.6, 28),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0.78 })
    );
    meetRing.rotation.x = -Math.PI / 2;
    meetRing.position.set(gx(-378), 0.29, gz(2285));
    sceneryGroup.add(meetRing);

    // Highway Speed Trap Camera Arches in Gaithersburg
    for (const [cx, cz, rotY] of [
      [gx(-365), gz(1890), 0.26],
      [gx(356), gz(1845), -0.34],
    ] as [number, number, number][]) {
      const arch = new THREE.Group();
      arch.position.set(cx, 0.25, cz);
      arch.rotation.y = rotY;
      for (const side of [-16, 16]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 7.6, 8), ironRailMat);
        leg.position.set(side, 3.8, 0);
        arch.add(leg);
      }
      const truss = new THREE.Mesh(new THREE.BoxGeometry(33, 0.65, 0.65), ironRailMat);
      truss.position.set(0, 7.6, 0);
      arch.add(truss);
      const camBox = new THREE.Mesh(
        new THREE.BoxGeometry(5.5, 1.0, 0.45),
        makeTextSignMat(['SPEED TRAP RADAR', 'EXCEED TARGET FOR BONUS $'], '#0f172a', '#ef4444', '#facc15')
      );
      camBox.position.set(0, 7.6, 0.45);
      arch.add(camBox);
      sceneryGroup.add(arch);
    }

    drawGaithParkingLot(gx(-630), gz(2095), 72, 54, 0);
    const kmPlaza = new THREE.Mesh(new THREE.BoxGeometry(66, 12, 28), boxWithRoofMat(makeBrickFacadeMat('#9a3412', '#fef3c7', '#38bdf8', 7, 1, false), flatRoofMat));
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
    cityBuildings.push({ minX: gx(-664), maxX: gx(-596), minZ: gz(2031), maxZ: gz(2061), height: 14, stories: 1, name: 'Kentlands Market Square' });

    const kLake = new THREE.Mesh(new THREE.PlaneGeometry(82, 56), waterMat);
    kLake.rotation.x = -Math.PI / 2;
    kLake.position.set(gx(-610), 0.232, gz(2290));
    sceneryGroup.add(kLake);
    // Historic Kentlands Georgian Brick Mansion (paired chimneys, white roof widow's walk balustrade & columned portico)
    const kMansionBrick = makeBrickFacadeMat('#991b1b', '#f8fafc', '#1e293b', 5, 3, true);
    const kMansion = new THREE.Mesh(new THREE.BoxGeometry(40, 12.5, 22), boxWithRoofMat(kMansionBrick, flatRoofMat));
    kMansion.position.set(gx(-610), 6.5, gz(2246));
    kMansion.castShadow = isUltra;
    kMansion.receiveShadow = isUltra;
    sceneryGroup.add(kMansion);
    const kMansionRoof = buildPitchedRoofGroup(40.8, 22.8, 4.8, kMansionBrick, makeCityMat({ color: 0x1e293b, roughness: 0.74 }), 'x');
    kMansionRoof.position.set(gx(-610), 12.75, gz(2246));
    sceneryGroup.add(kMansionRoof);
    const whiteManorTrim = makeCityMat({ color: 0xf8fafc, roughness: 0.36 });
    const kPorticoRoof = buildPitchedRoofGroup(10.5, 4.6, 2.4, whiteManorTrim, makeCityMat({ color: 0x1e293b, roughness: 0.74 }), 'z');
    kPorticoRoof.position.set(gx(-610), 9.2, gz(2246) + 13.0);
    sceneryGroup.add(kPorticoRoof);
    for (const cx of [-4.2, -1.4, 1.4, 4.2]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 8.8, 10), whiteManorTrim);
      col.position.set(gx(-610) + cx, 4.65, gz(2246) + 14.6);
      sceneryGroup.add(col);
    }
    const widowBase = new THREE.Mesh(new THREE.BoxGeometry(12.5, 1.4, 7.6), whiteManorTrim);
    widowBase.position.set(gx(-610), 17.6, gz(2246));
    sceneryGroup.add(widowBase);
    for (const cx of [-18.5, 18.5]) {
      const mChim = new THREE.Mesh(new THREE.BoxGeometry(2.0, 6.2, 2.2), makeCityMat({ color: 0x881337, roughness: 0.8 }));
      mChim.position.set(gx(-610) + cx, 16.4, gz(2246));
      sceneryGroup.add(mChim);
    }
    cityBuildings.push({ minX: gx(-631), maxX: gx(-589), minZ: gz(2234), maxZ: gz(2261), height: 19, stories: 3, name: 'Historic Kentlands Mansion' });
  }

  // =========================================================================================
  // 12. ARCHITECTURAL HOMES ALIGNED CLEANLY ALONG MONTGOMERY VILLAGE, KENTLANDS & FLOWER HILL
  // =========================================================================================
  {
    const gaithSuburbs = [
      { x: gx(-510), z: gz(1898), rotY: 0, addr: '112 Clopper Rd', col: 0xe2e8f0, roof: 0x1e293b, tier: 'regular' as const },
      { x: gx(-598), z: gz(1898), rotY: Math.PI / 2, addr: '118 Lakelands Dr', col: 0x881337, roof: 0x1e1b4b, tier: 'luxury' as const },
      { x: gx(-530), z: gz(2175), rotY: 0, addr: '208 Kentlands Blvd', col: 0xd97706, roof: 0x451a03, tier: 'luxury' as const },
      { x: gx(-472), z: gz(2408), rotY: 0, addr: '308 Kent Oaks Way', col: 0xe2e8f0, roof: 0x0f172a, tier: 'luxury' as const },
      { x: gx(-340), z: gz(1596), rotY: 0, addr: '9768 Whetstone Dr', col: 0x881337, roof: 0x1e1b4b, tier: 'regular' as const },
      { x: gx(176), z: gz(1602), rotY: -Math.PI / 2, addr: '9085 Centerway Rd', col: 0xe2e8f0, roof: 0x1e293b, tier: 'regular' as const },
      { x: gx(245), z: gz(1602), rotY: Math.PI / 2, addr: '9722 Shadow Oak Dr', col: 0x78716c, roof: 0x292524, tier: 'regular' as const },
      { x: gx(255), z: gz(2236), rotY: Math.PI, addr: '7212 Muncaster Mill Rd', col: 0xe2e8f0, roof: 0x1e293b, tier: 'luxury' as const },
      { x: gx(330), z: gz(2225), rotY: Math.PI, addr: '15920 Redland Rd', col: 0x78716c, roof: 0x292524, tier: 'regular' as const },
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
  // 13. INSTANCED BRANCHED OAK & PINE WOODLAND TREES + 3D GRASS TUFTS & SHRUBS IN GAITHERSBURG
  // =========================================================================================
  {
    const treePlacements: WoodlandTreePlacement[] = [];
    const grassPatches: GrassPatchPlacement[] = [];
    const isBlockedGaithSpot = (tx: number, tz: number, roadPad: number, bldgPad: number): boolean => {
      if (isOnGaithersburgPavedSurface(tx, tz)) return true;
      for (const r of ALL_MARYLAND_ROADS) {
        const minClr = r.width * 0.5 + roadPad;
        const clrSq = minClr * minClr;
        for (let k = 0; k < r.points.length - 1; k++) {
          if (distSqPointToSeg(tx, tz, r.points[k].x, r.points[k].z, r.points[k + 1].x, r.points[k + 1].z) < clrSq) {
            return true;
          }
        }
      }
      if (
        (tx >= gx(100) && tx <= gx(805) && tz >= gz(1045) && tz <= gz(1925)) ||
        (tx >= gx(-205) && tx <= gx(-35) && tz >= gz(1530) && tz <= gz(1600)) ||
        (tx >= gx(235) && tx <= gx(410) && tz >= gz(2240) && tz <= gz(2315)) ||
        (tx >= gx(445) && tx <= gx(585) && tz >= gz(2232) && tz <= gz(2318)) ||
        (tx >= gx(-10) && tx <= gx(74) && tz >= gz(2054) && tz <= gz(2178)) ||
        (tx >= gx(-74) && tx <= gx(-10) && tz >= gz(2220) && tz <= gz(2266)) ||
        (tx >= gx(95) && tx <= gx(255) && tz >= gz(1940) && tz <= gz(2105)) ||
        (tx >= gx(-365) && tx <= gx(-265) && tz >= gz(1655) && tz <= gz(1735)) ||
        (tx >= gx(-535) && tx <= gx(-268) && tz >= gz(2225) && tz <= gz(2360)) ||
        (tx >= gx(-665) && tx <= gx(-555) && tz >= gz(2245) && tz <= gz(2335)) ||
        (tx >= gx(-205) && tx <= gx(-95) && tz >= gz(1825) && tz <= gz(1920))
      ) {
        return true;
      }
      for (let b = 0; b < cityBuildings.length; b++) {
        const box = cityBuildings[b];
        if (tx >= box.minX - bldgPad && tx <= box.maxX + bldgPad && tz >= box.minZ - bldgPad && tz <= box.maxZ + bldgPad) {
          return true;
        }
      }
      return false;
    };

    const isSafeSuburbanTreeSpot = (tx: number, tz: number): boolean => {
      if (isOnGaithersburgPavedSurface(tx, tz)) return false;
      for (const r of ALL_MARYLAND_ROADS) {
        const minClr = r.width * 0.5 + 4.8;
        const clrSq = minClr * minClr;
        for (let k = 0; k < r.points.length - 1; k++) {
          if (distSqPointToSeg(tx, tz, r.points[k].x, r.points[k].z, r.points[k + 1].x, r.points[k + 1].z) < clrSq) {
            return false;
          }
        }
        if (r.culDeSacEndRadius && r.points.length > 0) {
          const ep = r.points[r.points.length - 1];
          if (Math.hypot(tx - ep.x, tz - ep.z) < r.culDeSacEndRadius + 4.5) return false;
        }
      }
      for (let b = 0; b < cityBuildings.length; b++) {
        const box = cityBuildings[b];
        if (tx >= box.minX - 6.8 && tx <= box.maxX + 6.8 && tz >= box.minZ - 6.8 && tz <= box.maxZ + 6.8) {
          return false;
        }
      }
      for (let s = 0; s < suburbanHouses.length; s++) {
        const d = suburbanHouses[s].drivewayTarget;
        if ((tx - d.x) * (tx - d.x) + (tz - d.z) * (tz - d.z) < 6.5 * 6.5) return false;
      }
      return true;
    };

    for (let i = 0; i < 380; i++) {
      const tx = gx(-690 + ((i * 97) % 1380));
      const tz = gz(1500 + ((i * 73) % 940));
      if (isBlockedGaithSpot(tx, tz, 8.5, 6.0)) continue;
      treePlacements.push({
        x: tx,
        z: tz,
        s: 0.85 + (i % 4) * 0.2,
        species: i % 4 === 0 ? 'pine' : 'oak',
      });
    }

    // Lush suburban backyard & side-yard oak/pine trees in spacious Hadley Farms & Edinburgh Village greenbelts
    for (let i = 0; i < 280; i++) {
      const rx = 118 + ((i * 89 + 17) % 665);
      const rz = 1058 + ((i * 67 + 23) % 765);
      const tx = gx(rx);
      const tz = gz(rz);
      if (!isSafeSuburbanTreeSpot(tx, tz)) continue;
      treePlacements.push({
        x: tx,
        z: tz,
        s: 0.72 + (i % 4) * 0.14,
        species: i % 5 === 0 ? 'pine' : 'oak',
      });
    }
    populateInstancedWoodlandTrees(sceneryGroup, treePlacements, { isUltra, isRetroPixel }, disposables);

    // Scatter 3D crossed-blade grass clumps & shrubs across greenbelts, parks & RIO verges
    for (let i = 0; i < 950; i++) {
      const rx = ((i * 173 + 29) % 1480) - 720;
      const rz = 1080 + ((i * 211 + 53) % 1380);
      const px = gx(rx);
      const pz = gz(rz);
      if (isBlockedGaithSpot(px, pz, 2.8, 2.2)) continue;
      grassPatches.push({
        x: px,
        z: pz,
        s: 0.95 + (i % 5) * 0.16,
        kind: i % 9 === 0 ? 'shrub' : 'grass',
      });
    }
    populateChunkedGrassAndShrubs(sceneryGroup, grassPatches, { isUltra, isRetroPixel }, disposables);
  }

  for (const jct of GAITHERSBURG_SIGNAL_JUNCTIONS.slice(0, 4)) {
    addStreetNamePost(jct.x - 18, jct.z - 14, jct.name.toUpperCase(), 0);
  }
}
