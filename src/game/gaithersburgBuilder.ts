import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
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

    addRotatedCollider(REDEEMER_CAMPUS_ORIGIN.x, REDEEMER_CAMPUS_ORIGIN.z, REDEEMER_CAMPUS_ORIGIN.rotY, 126, 2, 60, 50, 17, 'Church of the Redeemer (19425 Woodfield Rd)');
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
    // 7. EDINBURGH VILLAGE (100-Home Real-Street Community — Including 19624 Kildonan Dr)
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

    const totMulch = new THREE.Mesh(new THREE.BoxGeometry(10, 0.02, 8), makeCityMat({ color: 0x78350f, roughness: 0.95 }));
    totMulch.position.set(gx(526), 0.232, gz(1628.5));
    sceneryGroup.add(totMulch);
    const pergolaRoof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.5, 4), makeCityMat({ color: 0x0ea5e9, roughness: 0.5 }));
    pergolaRoof.rotation.y = Math.PI / 4;
    pergolaRoof.position.set(gx(526), 3.2, gz(1628.5));
    sceneryGroup.add(pergolaRoof);

    let edinburghCount = 0;
    const EDINBURGH_TARGET = 100;
    const addEdinburghLot = (x: number, z: number, rotY: number, houseNum: string, street: string) => {
      if (edinburghCount >= EDINBURGH_TARGET) return;
      if (addSuburbanSlot(x, z, rotY, houseNum, street, edinburghCount)) {
        edinburghCount++;
      }
    };

    // Place 19624 Kildonan Dr explicitly at the corner of Kildonan Dr (x=gx(468)) & Brenish Dr (z=gz(1652))
    addEdinburghLot(gx(484), gz(1636.5), 0, '19624', 'Kildonan Dr');

    const edWestCols = [486, 500, 514, 528, 542, 556]; // 6 cols clear of Kildonan W (468) & Kilcreggan Way (580)
    const edEastCols = [598, 612, 626, 640, 654, 668, 682, 696, 710]; // 9 cols clear of Kilcreggan Way (580) & Kildonan E (740)

    // 7A. Kildonan Dr (real range 19301-19709): 30 North E-W lots + 8 East N-S lots (+ 19624 corner = 39 total)
    let kilEven = 19600;
    let kilOdd = 19601;
    const nextKilEven = () => {
      kilEven += 2;
      if (kilEven === 19624) kilEven += 2;
      return String(kilEven);
    };
    const nextKilOdd = () => {
      kilOdd += 2;
      return String(kilOdd);
    };
    for (const xOff of [...edWestCols, ...edEastCols]) {
      addEdinburghLot(gx(xOff), gz(1586.5), 0, nextKilEven(), 'Kildonan Dr');
      addEdinburghLot(gx(xOff), gz(1617.5), Math.PI, nextKilOdd(), 'Kildonan Dr');
    }
    const kilEastLegZs = [1620, 1635, 1669, 1684, 1718, 1733, 1766, 1781];
    for (const kz of kilEastLegZs) {
      addEdinburghLot(gx(755.5), gz(kz), -Math.PI / 2, nextKilEven(), 'Kildonan Dr');
    }

    // 7B. Brenish Dr (real range 7320-7545): North cols (skipping 484 corner) + South cols = 26 homes
    let brEven = 7320;
    let brOdd = 7321;
    for (const xOff of [500, 514, 528, 542, 556, ...edEastCols]) {
      brEven += 4;
      addEdinburghLot(gx(xOff), gz(1636.5), 0, String(brEven), 'Brenish Dr');
    }
    for (const xOff of [534, 548, 562, ...edEastCols]) {
      brOdd += 4;
      addEdinburghLot(gx(xOff), gz(1667.5), Math.PI, String(brOdd), 'Brenish Dr');
    }

    // 7C. Tarfside Ln (real range 7300-7418): 4 homes branching south off Brenish Dr
    addEdinburghLot(gx(496.5), gz(1686), Math.PI / 2, '7402', 'Tarfside Ln');
    addEdinburghLot(gx(512), gz(1703.5), Math.PI, '7408', 'Tarfside Ln');
    addEdinburghLot(gx(527.5), gz(1686), -Math.PI / 2, '7412', 'Tarfside Ln');
    addEdinburghLot(gx(527.5), gz(1703), -Math.PI / 2, '7416', 'Tarfside Ln');

    // 7D. Kilcreggan Way (real range 19500-19630): E-W loop at z=1702 (18 homes) + N-S west-side lots (5 homes)
    let kwNum = 19500;
    for (const xOff of edEastCols) {
      kwNum += 4;
      addEdinburghLot(gx(xOff), gz(1686.5), 0, String(kwNum), 'Kilcreggan Way');
      kwNum += 2;
      addEdinburghLot(gx(xOff), gz(1717.5), Math.PI, String(kwNum), 'Kilcreggan Way');
    }
    for (const mz of [1718, 1733, 1766, 1781]) {
      kwNum += 4;
      addEdinburghLot(gx(564.5), gz(mz), Math.PI / 2, String(kwNum), 'Kilcreggan Way');
    }

    // 7E. Kilcreggan Ter (real range 7400-7437): E-W streets at z=1748 & z=1795 (fills exact 100-home total)
    let ktNum = 7400;
    for (const xOff of edEastCols) {
      ktNum += 1;
      addEdinburghLot(gx(xOff), gz(1732.5), 0, String(ktNum), 'Kilcreggan Ter');
      ktNum += 1;
      addEdinburghLot(gx(xOff), gz(1763.5), Math.PI, String(ktNum), 'Kilcreggan Ter');
    }
    for (const xOff of edEastCols) {
      ktNum += 1;
      addEdinburghLot(gx(xOff), gz(1779.5), 0, String(ktNum), 'Kilcreggan Ter');
    }
    addStreetNamePost(gx(426), gz(1660), 'BRENISH DR', 0);

    // =======================================================================================
    // 8. HADLEY FARMS (Expansive 300-Home Real-Street Community + Townhomes + Resnik ES + Pool)
    // =======================================================================================
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

    const tennis = new THREE.Mesh(new THREE.BoxGeometry(14, 0.02, 12), makeCityMat({ color: 0x15803d, roughness: 0.88 }));
    tennis.position.set(gx(526), 0.232, gz(1539));
    sceneryGroup.add(tennis);
    const clubWallMat = makeSidingMat('#e6decb');
    const clubRoofMat = makeCityMat({ color: 0x292524, roughness: 0.78 });
    const clubHouse = new THREE.Mesh(new THREE.BoxGeometry(16, 4.8, 10), clubWallMat);
    clubHouse.position.set(gx(526), 2.65, gz(1553));
    clubHouse.castShadow = isUltra;
    sceneryGroup.add(clubHouse);
    const clubRoof = buildPitchedRoofGroup(16.4, 10.4, 2.2, clubWallMat, clubRoofMat, 'x');
    clubRoof.position.set(gx(526), 5.05, gz(1553));
    sceneryGroup.add(clubRoof);
    const poolWater = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), makeCityMat({ color: 0x0ea5e9, roughness: 0.14, metalness: 0.45 }));
    poolWater.rotation.x = -Math.PI / 2;
    poolWater.position.set(gx(526), 0.28, gz(1569));
    sceneryGroup.add(poolWater);
    cityBuildings.push({ minX: gx(518), maxX: gx(534), minZ: gz(1547), maxZ: gz(1559), height: 7, name: 'Hadley Farms Community Pool & Clubhouse' });

    drawGaithParkingLot(gx(578), gz(1554), 22, 34, 0);
    const schGroup = new THREE.Group();
    schGroup.position.set(gx(610), 0.25, gz(1554));
    const schBrickMat = makeBrickFacadeMat('#9b3b2c', '#e5e7eb', '#1e3a5f', 7, 2, false);
    const schTrimMat = makeCityMat({ color: 0xede5d4, roughness: 0.58 });
    const mainWing = new THREE.Mesh(new THREE.BoxGeometry(30, 7.4, 20), boxWithRoofMat(schBrickMat, flatRoofMat));
    mainWing.position.set(0, 3.7, -3);
    mainWing.castShadow = isUltra;
    schGroup.add(mainWing);
    const gymWing = new THREE.Mesh(new THREE.BoxGeometry(20, 8.8, 14), schTrimMat);
    gymWing.position.set(-5, 4.4, 11);
    gymWing.castShadow = isUltra;
    schGroup.add(gymWing);
    const schSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 1.2, 9.6),
      makeTextSignMat(['JUDITH A. RESNIK ES', '7301 HADLEY FARMS DR'], '#1e3a8a', '#f8fafc', '#fde047')
    );
    schSign.position.set(-15.4, 4.6, -3);
    schGroup.add(schSign);
    sceneryGroup.add(schGroup);
    cityBuildings.push({ minX: gx(594), maxX: gx(626), minZ: gz(1540), maxZ: gz(1574), height: 10, name: 'Judith A. Resnik Elementary School (7301 Hadley Farms Dr)' });

    // 8A. 300 Batched Single-Family Homes across Hadley Farms East & West (ONLY real Hadley Farms streets & ranges)
    let hadleyCount = 0;
    const HADLEY_TARGET = 300;
    const addHadleyLot = (x: number, z: number, rotY: number, houseNum: string, street: string) => {
      if (hadleyCount >= HADLEY_TARGET) return;
      if (addSuburbanSlot(x, z, rotY, houseNum, street, hadleyCount + 100)) {
        hadleyCount++;
      }
    };

    // Hadley Farms West (5 streets x 2 sides x 10 houses = 100 homes)
    const hfWestCols = [286, 302.2, 318.4, 334.6, 350.8, 392, 408.5, 425, 441.5, 458];
    for (const [stName, stZ, baseNum] of [
      ['Filbert Dr', 1250, 19700],
      ['Boxberry Dr', 1296, 19701],
      ['Mayhill Ter', 1342, 19702],
      ['Tygart Ln', 1388, 19901],
      ['Mattingly Ter', 1434, 20001],
    ] as [string, number, number][]) {
      let n = baseNum;
      for (const xOff of hfWestCols) {
        n += 2;
        addHadleyLot(gx(xOff), gz(stZ - 15.5), 0, String(n), stName);
        n += 2;
        addHadleyLot(gx(xOff), gz(stZ + 15.5), Math.PI, String(n), stName);
      }
    }

    // Hadley Farms East (10 streets: up to 200 more homes -> 300 total)
    const hfEastBayA = [524, 537.5, 551, 564.5, 578];
    const hfEastBayB = [620, 635.2, 650.4, 665.6, 680.8];
    const hfEastBayC = [722, 738.2, 754.4, 770.6];
    for (const [stName, stZ, baseNum, hasBayC] of [
      ['Cliff Pine Dr', 1066, 7100, true],
      ['Barcellona Dr', 1112, 7200, true],
      ['Torran Rocks Way', 1158, 7300, true],
      ['Cinnabar Ter', 1204, 7404, true],
      ['Elioak Ter', 1250, 7400, true],
      ['Filbert Ter', 1296, 7500, false],
      ['Electra Ct', 1342, 7400, false],
      ['Harkness Ct', 1388, 19600, false],
      ['Mayhill Ct', 1434, 19700, false],
      ['Cinnabar Dr', 1480, 19800, false],
    ] as [string, number, number, boolean][]) {
      let n = baseNum;
      const cols = hasBayC ? [...hfEastBayA, ...hfEastBayB, ...hfEastBayC] : [...hfEastBayA, ...hfEastBayB];
      for (const xOff of cols) {
        n += 2;
        addHadleyLot(gx(xOff), gz(stZ - 15.5), 0, String(n), stName);
        if (stZ < 1480) {
          n += 2;
          addHadleyLot(gx(xOff), gz(stZ + 15.5), Math.PI, String(n), stName);
        }
      }
    }
    // Fill remaining Hadley Farms slots on south edge of Hadley Farms Dr East of Resnik ES
    for (const [hx, hz, rotY, hNum, hSt] of [
      [gx(654), gz(1539.5), Math.PI, '7310', 'Hadley Farms Dr'],
      [gx(672), gz(1539.5), Math.PI, '7314', 'Hadley Farms Dr'],
      [gx(690), gz(1539.5), Math.PI, '7318', 'Hadley Farms Dr'],
    ] as [number, number, number, string, string][]) {
      addHadleyLot(hx, hz, rotY, hNum, hSt);
    }

    // 5 Brick Townhome Rows in Hadley Farms South Plaza (real street names, clear of roads & Resnik ES)
    const hfThBrick = makeBrickFacadeMat('#8b3728', '#f1f5f9', '#1e293b', 6, 3, false);
    const hfThRoof = makeCityMat({ color: 0x1e293b, roughness: 0.75 });
    for (const [tx, tz, rotY, label] of [
      [gx(656), gz(1558), 0, 'Barcellona Dr Townhomes (Hadley Farms)'],
      [gx(656), gz(1576), 0, 'Filbert Ter Townhomes (Hadley Farms)'],
      [gx(690), gz(1558), 0, 'Elioak Ter Townhomes (Hadley Farms)'],
      [gx(690), gz(1576), 0, 'Hadley Farms Dr Townhomes'],
      [gx(498), gz(1558), Math.PI / 2, 'Torran Rocks Way Townhomes'],
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
      cityBuildings.push({ minX: tx - halfX, maxX: tx + halfX, minZ: tz - halfZ, maxZ: tz + halfZ, height: 11, name: label });
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
    cityBuildings.push({ minX: gx(-153), maxX: gx(-97), minZ: gz(1945), maxZ: gz(1972), height: 24, name: 'Gaithersburg 1884 B&O / MARC Station' });

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

    // Timber Boardwalk promenade, Waterfront Pergolas, Festive String-Light Patio Posts & Americana Carousel
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

    // Waterfront Stores & Restaurants surrounding all 4 sides of RIO Lake with awnings, glazed storefronts & signature architecture
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
      // East Row (facing lake West)
      { x: gx(-412), z: gz(2290), w: 14, h: 10.5, d: 20, brickHex: '#7c2d12', winHex: '#fde68a', awningHex: 0x1e293b, signLines: ['GUAPO\'S CANTINA · PATIO'], signSide: 'W', name: 'Guapo\'s Cantina RIO' },
      { x: gx(-404), z: gz(2320), w: 14, h: 10.0, d: 20, brickHex: '#334155', winHex: '#38bdf8', awningHex: 0xb91c1c, signLines: ['SILVER DINER · LAKEFRONT'], signSide: 'W', name: 'Silver Diner RIO Lakefront' },
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
        name: st.name,
      });
    }

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
    cityBuildings.push({ minX: gx(-631), maxX: gx(-589), minZ: gz(2234), maxZ: gz(2261), height: 19, name: 'Historic Kentlands Mansion' });
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
        (tx >= gx(245) && tx <= gx(805) && tz >= gz(1045) && tz <= gz(1925)) ||
        (tx >= gx(-205) && tx <= gx(-35) && tz >= gz(1530) && tz <= gz(1600)) ||
        (tx >= gx(235) && tx <= gx(410) && tz >= gz(2240) && tz <= gz(2315)) ||
        (tx >= gx(95) && tx <= gx(255) && tz >= gz(1940) && tz <= gz(2105)) ||
        (tx >= gx(-365) && tx <= gx(-265) && tz >= gz(1655) && tz <= gz(1735)) ||
        (tx >= gx(-535) && tx <= gx(-365) && tz >= gz(2225) && tz <= gz(2360)) ||
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
