import * as THREE from 'three';
import {
  MD_LANDMARKS,
  buildPitchedRoofGroup,
  boxWithRoofMat,
} from './marylandRoadNetwork';
import {
  CityBuildingBox,
  BuiltSuburbanHouse,
  buildSuburbanHouseMesh,
} from './cityTrafficBuilder';
import { SuburbanBatchBuilder } from './suburbanBatchBuilder';

export interface BaltimoreBuilderContext {
  group: THREE.Group;
  sceneryGroup: THREE.Group;
  cityBuildings: CityBuildingBox[];
  suburbanHouses: BuiltSuburbanHouse[];
  suburbanBatch: SuburbanBatchBuilder;
  streetAsphaltMat: THREE.Material;
  whiteLineMat: THREE.Material;
  sidewalkMat: THREE.Material;
  treeTrunkMat: THREE.Material;
  treeFoliageMat: THREE.Material;
  goldMat: THREE.Material;
  isUltra: boolean;
  isRetroPixel: boolean;
  makeCityMat: (opts: { color?: number; map?: THREE.Texture; roughness?: number; metalness?: number; envMapIntensity?: number }) => THREE.Material;
  makeTextSignMat: (
    lines: string[],
    bgHex: string,
    fgHex: string,
    borderHex?: string,
    emissiveHex?: string
  ) => THREE.Material;
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
  drawParkingLotBay: (cx: number, cz: number, width: number, depth: number, rotY?: number) => void;
}

export function buildBaltimoreDistrict(ctx: BaltimoreBuilderContext): {
  bankPosition: { x: number; z: number };
  policeStationPosition: { x: number; z: number };
} {
  const {
    sceneryGroup,
    cityBuildings,
    suburbanHouses,
    suburbanBatch,
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
  } = ctx;

  // Shared Baltimore Materials
  const harborWaterMat = makeCityMat({ color: 0x075985, roughness: 0.14, metalness: 0.72 });
  const seawallMat = makeCityMat({ color: 0x475569, roughness: 0.78 });
  const promBrickMat = makeCityMat({ color: 0x7c2d12, roughness: 0.82 });
  const marbleMat = makeCityMat({ color: 0xf1f5f9, roughness: 0.34, metalness: 0.1 });
  const limestoneMat = makeCityMat({ color: 0xe2e8f0, roughness: 0.48, metalness: 0.08 });
  const darkSlateRoofMat = makeCityMat({ color: 0x1e293b, roughness: 0.72 });
  const terracottaRoofMat = makeCityMat({ color: 0x92400e, roughness: 0.62 });
  const copperRoofMat = makeCityMat({ color: 0x0f766e, roughness: 0.4, metalness: 0.48 });
  const steelMat = makeCityMat({ color: 0x334155, roughness: 0.45, metalness: 0.65 });
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const policeBlueMat = makeCityMat({ color: 0x1d4ed8, roughness: 0.32, metalness: 0.55 });

  // Multi-floor tower facade materials & flat roof cap
  const flatRoofMat = makeCityMat({ color: 0x334155, roughness: 0.85, metalness: 0.1 });
  const glassTowerMat = makeBrickFacadeMat('#1e293b', '#475569', '#93c5fd', 10, 22, false);
  const limestoneOfficeMat = makeBrickFacadeMat('#cbd5e1', '#94a3b8', '#334155', 8, 18, false);
  const darkGlassMat = makeBrickFacadeMat('#334155', '#1e293b', '#bae6fd', 9, 20, false);
  const brickMidriseMat = makeBrickFacadeMat('#7c2d12', '#d6d3d1', '#fde68a', 8, 12, true);
  const solidBrickMasonryMat = makeCityMat({ color: 0x7c2d12, roughness: 0.78 });
  const wtcFacetTex = (limestoneOfficeMat as THREE.MeshLambertMaterial).map?.clone();
  if (wtcFacetTex) {
    wtcFacetTex.repeat.set(4, 1);
    wtcFacetTex.needsUpdate = true;
  }
  const wtcWallMat = makeCityMat({ map: wtcFacetTex ?? undefined, color: wtcFacetTex ? 0xffffff : 0xcbd5e1, roughness: 0.5 });

  // =========================================================================
  // 1. INNER HARBOR WATER BASIN, PATAPSCO HARBOR CHANNEL & SEAWALL PROMENADES
  // =========================================================================
  {
    // Inner Harbor West Cove (bounded N by Pratt St Z=-144, W by Light St X=1248, S by Key Hwy Z=-45/-25)
    const innerWater = new THREE.Mesh(new THREE.PlaneGeometry(156, 108), harborWaterMat);
    innerWater.rotation.x = -Math.PI / 2;
    innerWater.position.set(1328, 0.234, -86);
    sceneryGroup.add(innerWater);

    // Northwest Branch & Patapsco River Ship Channel flowing SE out under Key Bridge toward Bay
    const branchWater = new THREE.Mesh(new THREE.PlaneGeometry(170, 122), harborWaterMat);
    branchWater.rotation.x = -Math.PI / 2;
    branchWater.position.set(1485, 0.234, -76);
    sceneryGroup.add(branchWater);

    // Light St Brick Promenade (West Edge of Inner Harbor)
    const westProm = new THREE.Mesh(new THREE.BoxGeometry(11, 0.42, 92), promBrickMat);
    westProm.position.set(1255.5, 0.21, -98);
    sceneryGroup.add(westProm);

    // Pratt St Waterfront Boardwalk & Bulkhead
    const northBulkhead = new THREE.Mesh(new THREE.BoxGeometry(148, 0.45, 8), seawallMat);
    northBulkhead.position.set(1332, 0.22, -139);
    sceneryGroup.add(northBulkhead);

    // Pier 3 & Pier 4 concrete aprons supporting Aquarium & Constellation
    const pier3 = new THREE.Mesh(new THREE.BoxGeometry(58, 0.46, 52), seawallMat);
    pier3.position.set(1348, 0.23, -118);
    sceneryGroup.add(pier3);

    const pier1 = new THREE.Mesh(new THREE.BoxGeometry(36, 0.46, 44), seawallMat);
    pier1.position.set(1280, 0.23, -116);
    sceneryGroup.add(pier1);

    // World Trade Center Baltimore (27-Story Regular Pentagon Tower on Pier 1 clear of Pratt St)
    const wtcX = 1278;
    const wtcZ = -118;
    const wtcTower = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 96, 5), [wtcWallMat, flatRoofMat, flatRoofMat]);
    wtcTower.position.set(wtcX, 0.4 + 48, wtcZ);
    wtcTower.castShadow = isUltra;
    sceneryGroup.add(wtcTower);

    const wtcCrown = new THREE.Mesh(new THREE.CylinderGeometry(18.8, 18.8, 4.5, 5), limestoneMat);
    wtcCrown.position.set(wtcX, 0.4 + 96, wtcZ);
    sceneryGroup.add(wtcCrown);

    for (let v = 0; v < 5; v++) {
      const ang = (v / 5) * Math.PI * 2 + Math.PI / 2;
      const rib = new THREE.Mesh(new THREE.BoxGeometry(1.6, 97, 1.6), limestoneMat);
      rib.position.set(wtcX + Math.cos(ang) * 17.6, 0.4 + 48.5, wtcZ + Math.sin(ang) * 17.6);
      sceneryGroup.add(rib);
    }

    const wtcSign = makeTextSignMat(['WORLD TRADE CENTER · INNER HARBOR'], '#0f172a', '#38bdf8', '#e2e8f0');
    const wtcSignMesh = new THREE.Mesh(new THREE.BoxGeometry(26, 3.6, 0.6), wtcSign);
    wtcSignMesh.position.set(wtcX, 14, wtcZ - 18.5);
    sceneryGroup.add(wtcSignMesh);
    cityBuildings.push({
      minX: wtcX - 19,
      maxX: wtcX + 19,
      minZ: wtcZ - 19,
      maxZ: wtcZ + 19,
      height: 102,
      name: 'World Trade Center Baltimore',
    });

    // National Aquarium Pier 3 (Twin Glass Pyramids + Brick Reef Pavilion)
    const aqX = 1356;
    const aqZ = -118;
    const aqBrickMat = makeBrickFacadeMat('#475569', '#94a3b8', '#38bdf8', 6, 2, false);
    const aqGlassMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      roughness: 0.14,
      metalness: 0.65,
      transparent: true,
      opacity: 0.82,
    });
    const aqBase = new THREE.Mesh(new THREE.BoxGeometry(46, 11, 36), boxWithRoofMat(aqBrickMat, flatRoofMat));
    aqBase.position.set(aqX, 0.46 + 5.5, aqZ);
    sceneryGroup.add(aqBase);

    const pyrMain = new THREE.Mesh(new THREE.ConeGeometry(16.5, 24, 4), aqGlassMat);
    pyrMain.rotation.y = Math.PI / 4;
    pyrMain.position.set(aqX - 6, 0.46 + 11 + 12, aqZ);
    sceneryGroup.add(pyrMain);

    const pyrEast = new THREE.Mesh(new THREE.ConeGeometry(11, 16, 4), aqGlassMat);
    pyrEast.rotation.y = Math.PI / 4;
    pyrEast.position.set(aqX + 14, 0.46 + 11 + 8, aqZ + 2);
    sceneryGroup.add(pyrEast);

    const aqSign = new THREE.Mesh(
      new THREE.BoxGeometry(32, 3.2, 0.5),
      makeTextSignMat(['NATIONAL AQUARIUM · PIER 3'], '#082f49', '#38bdf8', '#0ea5e9')
    );
    aqSign.position.set(aqX, 10.2, aqZ - 18.4);
    sceneryGroup.add(aqSign);
    cityBuildings.push({
      minX: aqX - 24,
      maxX: aqX + 24,
      minZ: aqZ - 19,
      maxZ: aqZ + 19,
      height: 36,
      name: 'National Aquarium in Baltimore',
    });

    // Historic 1854 USS Constellation 3-Masted Sloop moored at Pier 1
    const hullMat = makeCityMat({ color: 0x1c1917, roughness: 0.78 });
    const sailMat = makeCityMat({ color: 0xf8fafc, roughness: 0.62 });
    const ship = new THREE.Group();
    ship.position.set(1295, 0.65, -86);
    ship.rotation.y = 0.25;
    const hull = new THREE.Mesh(new THREE.BoxGeometry(6.5, 3.8, 30), hullMat);
    ship.add(hull);
    const bowsprit = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 8, 6), treeTrunkMat);
    bowsprit.rotation.x = Math.PI / 2.4;
    bowsprit.position.set(0, 2.1, -17.5);
    ship.add(bowsprit);
    for (const mz of [-8.5, 0, 8.5]) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 18, 7), treeTrunkMat);
      mast.position.set(0, 9.5, mz);
      ship.add(mast);
      const spar = new THREE.Mesh(new THREE.BoxGeometry(8.2, 3.0, 0.18), sailMat);
      spar.position.set(0, 10.5, mz);
      ship.add(spar);
    }
    sceneryGroup.add(ship);

    // Maryland Science Center (Curved IMAX Dome & Exhibit Hall East of Light & Key Hwy)
    const sciX = 1292;
    const sciZ = -56;
    const sciBody = new THREE.Mesh(new THREE.BoxGeometry(32, 14, 24), boxWithRoofMat(brickMidriseMat, flatRoofMat));
    sciBody.position.set(sciX, 0.35 + 7, sciZ);
    sceneryGroup.add(sciBody);
    const imaxDrum = new THREE.Mesh(new THREE.CylinderGeometry(10, 10.5, 6, 16), limestoneMat);
    imaxDrum.position.set(sciX + 5, 0.35 + 16.5, sciZ);
    sceneryGroup.add(imaxDrum);
    const imaxDome = new THREE.Mesh(
      new THREE.SphereGeometry(9.8, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
      limestoneMat
    );
    imaxDome.position.set(sciX + 5, 0.35 + 19.5, sciZ);
    sceneryGroup.add(imaxDome);
    cityBuildings.push({
      minX: sciX - 17,
      maxX: sciX + 17,
      minZ: sciZ - 13,
      maxZ: sciZ + 13,
      height: 30,
      name: 'Maryland Science Center',
    });

    addStreetNamePost(1214, -142, 'W PRATT ST & LIGHT ST', 0);
    addStreetNamePost(1312, -142, 'PRATT ST · PIER 3', 0);
  }

  // =========================================================================
  // 2. DOMINO SUGAR REFINERY, FEDERAL HILL, FORT McHENRY & FELLS POINT
  // =========================================================================
  {
    // Domino Sugar Refinery (Locust Point waterfront north of Key Hwy Z=15)
    const domX = MD_LANDMARKS.baltimoreDominoSugar.x;
    const domZ = -18;
    const domBrickMat = makeBrickFacadeMat('#7f1d1d', '#94a3b8', '#fbbf24', 8, 5, false);
    const refinery = new THREE.Mesh(new THREE.BoxGeometry(60, 26, 30), boxWithRoofMat(domBrickMat, flatRoofMat));
    refinery.position.set(domX, 0.35 + 13, domZ);
    refinery.castShadow = isUltra;
    sceneryGroup.add(refinery);

    for (const sx of [-22, -10]) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.3, 38, 10), steelMat);
      stack.position.set(domX + sx, 0.35 + 19, domZ + 10);
      sceneryGroup.add(stack);
    }
    for (const siloX of [16, 26]) {
      const silo = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.8, 30, 12), limestoneMat);
      silo.position.set(domX + siloX, 0.35 + 15, domZ - 8);
      sceneryGroup.add(silo);
    }

    const domTrussL = new THREE.Mesh(new THREE.BoxGeometry(1.1, 13, 1.1), steelMat);
    domTrussL.position.set(domX - 24, 0.35 + 32, domZ - 12);
    sceneryGroup.add(domTrussL);
    const domTrussR = new THREE.Mesh(new THREE.BoxGeometry(1.1, 13, 1.1), steelMat);
    domTrussR.position.set(domX + 24, 0.35 + 32, domZ - 12);
    sceneryGroup.add(domTrussR);
    const domSign = new THREE.Mesh(
      new THREE.BoxGeometry(52, 13, 1.3),
      makeTextSignMat(['Domino', 'SUGAR'], '#090d16', '#ff3b1f', '#fb923c', '#ff3b1f')
    );
    domSign.position.set(domX, 0.35 + 34, domZ - 12);
    sceneryGroup.add(domSign);
    cityBuildings.push({
      minX: domX - 34,
      maxX: domX + 34,
      minZ: domZ - 19,
      maxZ: domZ + 19,
      height: 44,
      name: 'Domino Sugar Refinery',
    });

    // Federal Hill Park Grassy Terraced Hill + Flag Overlook (between Key Hwy & I-95 south tunnel approach)
    const fedX = 1322;
    const fedZ = 48;
    const fedHill = new THREE.Mesh(
      new THREE.CylinderGeometry(15, 20, 9.5, 16),
      makeCityMat({ color: 0x2d6a2e, roughness: 0.9 })
    );
    fedHill.position.set(fedX, 0.25 + 4.75, fedZ);
    sceneryGroup.add(fedHill);
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 14, 8), marbleMat);
    flagPole.position.set(fedX, 0.25 + 9.5 + 7, fedZ);
    sceneryGroup.add(flagPole);
    const flagBanner = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 2.5, 0.12),
      makeCityMat({ color: 0xdc2626, roughness: 0.6 })
    );
    flagBanner.position.set(fedX + 2.1, 0.25 + 21.5, fedZ);
    sceneryGroup.add(flagBanner);
    addLandscapedTree(fedX - 18, fedZ + 8, 1.05);
    addLandscapedTree(fedX + 16, fedZ + 10, 1.05);

    // Fort McHenry Star-Shaped Brick Bastion & Star-Spangled Banner (Locust Point tip east of gate)
    const ftX = 1546;
    const ftZ = 94;
    const ftLawn = new THREE.Mesh(
      new THREE.CylinderGeometry(28, 31, 0.04, 10),
      makeCityMat({ color: 0x2f682f, roughness: 0.9 })
    );
    ftLawn.position.set(ftX, 0.222, ftZ);
    sceneryGroup.add(ftLawn);

    const starRampart = new THREE.Mesh(new THREE.CylinderGeometry(18, 20, 5.5, 5), solidBrickMasonryMat);
    starRampart.position.set(ftX, 0.25 + 2.75, ftZ);
    sceneryGroup.add(starRampart);

    // 5 pointed star bastions at polygon vertices
    for (let b = 0; b < 5; b++) {
      const ang = (b / 5) * Math.PI * 2;
      const bastion = new THREE.Mesh(new THREE.ConeGeometry(6.4, 5.4, 4), solidBrickMasonryMat);
      bastion.rotation.y = ang + Math.PI / 4;
      bastion.position.set(ftX + Math.cos(ang) * 19, 0.25 + 2.7, ftZ + Math.sin(ang) * 19);
      sceneryGroup.add(bastion);
    }
    const barracksA = new THREE.Mesh(new THREE.BoxGeometry(14, 5.5, 6), solidBrickMasonryMat);
    barracksA.position.set(ftX - 5, 0.25 + 2.75, ftZ);
    sceneryGroup.add(barracksA);
    const barracksRoof = buildPitchedRoofGroup(14, 6, 2.2, solidBrickMasonryMat, darkSlateRoofMat, 'x');
    barracksRoof.position.set(ftX - 5, 0.25 + 5.5, ftZ);
    sceneryGroup.add(barracksRoof);

    const ftPole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 18, 8), marbleMat);
    ftPole.position.set(ftX, 0.25 + 9, ftZ);
    sceneryGroup.add(ftPole);
    const ftFlag = new THREE.Mesh(
      new THREE.BoxGeometry(6.5, 3.8, 0.14),
      makeCityMat({ color: 0xb91c1c, roughness: 0.55 })
    );
    ftFlag.position.set(ftX + 3.2, 0.25 + 16, ftZ);
    sceneryGroup.add(ftFlag);
    cityBuildings.push({
      minX: ftX - 24,
      maxX: ftX + 24,
      minZ: ftZ - 24,
      maxZ: ftZ + 24,
      height: 12,
      name: 'Fort McHenry National Monument',
    });

    // Fells Point Waterfront Brick Tavern Row & Cobble Square (North of Thames St)
    const fpX = 1455;
    const fpZ = -192;
    const fpPlaza = new THREE.Mesh(new THREE.BoxGeometry(62, 0.02, 22), promBrickMat);
    fpPlaza.position.set(fpX, 0.232, fpZ + 2);
    sceneryGroup.add(fpPlaza);
    const tavernColors = ['#8b2e24', '#7c2d12', '#92400e', '#78350f'];
    for (let t = 0; t < 4; t++) {
      const tx = fpX - 21 + t * 14;
      const tavernMat = makeBrickFacadeMat(tavernColors[t], '#e2e8f0', '#fde68a', 3, 3, true);
      const tavern = new THREE.Mesh(new THREE.BoxGeometry(13.2, 11.5, 16), boxWithRoofMat(tavernMat, flatRoofMat));
      tavern.position.set(tx, 0.28 + 5.75, fpZ);
      sceneryGroup.add(tavern);
      const tRoof = buildPitchedRoofGroup(13.4, 16.2, 3.8, tavernMat, darkSlateRoofMat, 'x');
      tRoof.position.set(tx, 0.28 + 11.5, fpZ);
      sceneryGroup.add(tRoof);
    }
    const fpSign = new THREE.Mesh(
      new THREE.BoxGeometry(28, 2.8, 0.4),
      makeTextSignMat(['FELLS POINT · THAMES ST'], '#451a03', '#fde68a', '#d97706')
    );
    fpSign.position.set(fpX, 14.5, fpZ + 8.3);
    sceneryGroup.add(fpSign);
    cityBuildings.push({
      minX: fpX - 28,
      maxX: fpX + 28,
      minZ: fpZ - 9,
      maxZ: fpZ + 9,
      height: 16,
      name: 'Fells Point Waterfront Row',
    });
  }

  // =========================================================================
  // 3. ORIOLE PARK AT CAMDEN YARDS, B&O WAREHOUSE & M&T BANK RAVENS STADIUM
  // =========================================================================
  {
    // Camden Yards & Historic B&O Warehouse (East of MLK/Russell X=1110, West of Light X=1235)
    const camX = 1172;
    const camZ = -98;
    const boBrickMat = makeBrickFacadeMat('#7c2d12', '#d6d3d1', '#fef3c7', 12, 6, true);
    const fieldGreenMat = makeCityMat({ color: 0x15803d, roughness: 0.85 });
    const dirtDiamondMat = makeCityMat({ color: 0xb45309, roughness: 0.92 });
    const standMat = makeCityMat({ color: 0x1e293b, roughness: 0.65 });

    const warehouse = new THREE.Mesh(new THREE.BoxGeometry(12, 28, 68), boxWithRoofMat(boBrickMat, flatRoofMat));
    warehouse.position.set(camX + 32, 0.35 + 14, camZ);
    warehouse.castShadow = isUltra;
    sceneryGroup.add(warehouse);
    const boRoof = buildPitchedRoofGroup(12.4, 68, 3.2, boBrickMat, darkSlateRoofMat, 'z');
    boRoof.position.set(camX + 32, 0.35 + 28, camZ);
    sceneryGroup.add(boRoof);

    const boSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 3.8, 38),
      makeTextSignMat(['ORIOLE PARK · B&O WAREHOUSE'], '#450a0a', '#fed7aa', '#ea580c')
    );
    boSign.position.set(camX + 38.3, 21, camZ);
    sceneryGroup.add(boSign);

    const turf = new THREE.Mesh(new THREE.PlaneGeometry(50, 64), fieldGreenMat);
    turf.rotation.x = -Math.PI / 2;
    turf.position.set(camX - 4, 0.42, camZ);
    sceneryGroup.add(turf);

    const diamond = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), dirtDiamondMat);
    diamond.rotation.x = -Math.PI / 2;
    diamond.rotation.z = Math.PI / 4;
    diamond.position.set(camX - 8, 0.45, camZ + 10);
    sceneryGroup.add(diamond);

    const westStand = new THREE.Mesh(new THREE.BoxGeometry(9, 15, 60), standMat);
    westStand.position.set(camX - 30, 0.35 + 7.5, camZ);
    sceneryGroup.add(westStand);
    const southStand = new THREE.Mesh(new THREE.BoxGeometry(50, 15, 9), standMat);
    southStand.position.set(camX - 7, 0.35 + 7.5, camZ + 30);
    sceneryGroup.add(southStand);

    const floodMat = new THREE.MeshBasicMaterial({ color: 0xfef9c3 });
    for (const [fx, fz] of [
      [-30, -25],
      [-30, 29],
      [17, 29],
      [17, -25],
    ]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 30, 6), standMat);
      tower.position.set(camX + fx, 0.35 + 15, camZ + fz);
      sceneryGroup.add(tower);
      const bank = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 1), floodMat);
      bank.position.set(camX + fx, 0.35 + 30.5, camZ + fz);
      sceneryGroup.add(bank);
    }

    cityBuildings.push(
      {
        minX: camX + 25,
        maxX: camX + 39,
        minZ: camZ - 35,
        maxZ: camZ + 35,
        height: 33,
        name: 'Historic B&O Warehouse (Camden Yards)',
      },
      {
        minX: camX - 36,
        maxX: camX + 22,
        minZ: camZ - 35,
        maxZ: camZ + 36,
        height: 20,
        name: 'Oriole Park at Camden Yards',
      }
    );

    // M&T Bank Ravens Stadium directly south of Camden Yards
    const ravX = 1172;
    const ravZ = -6;
    const ravWallMat = makeBrickFacadeMat('#312e81', '#cbd5e1', '#a855f7', 12, 3, false);
    const bowlOuter = new THREE.Mesh(new THREE.CylinderGeometry(32, 35, 20, 16, 1, true), ravWallMat);
    bowlOuter.position.set(ravX, 0.35 + 10, ravZ);
    sceneryGroup.add(bowlOuter);
    const bowlRim = new THREE.Mesh(new THREE.TorusGeometry(32, 2.2, 8, 20), steelMat);
    bowlRim.rotation.x = Math.PI / 2;
    bowlRim.position.set(ravX, 0.35 + 20, ravZ);
    sceneryGroup.add(bowlRim);
    const ravTurf = new THREE.Mesh(new THREE.CircleGeometry(29, 18), fieldGreenMat);
    ravTurf.rotation.x = -Math.PI / 2;
    ravTurf.position.set(ravX, 0.42, ravZ);
    sceneryGroup.add(ravTurf);
    const ravSign = new THREE.Mesh(
      new THREE.BoxGeometry(34, 4.2, 0.7),
      makeTextSignMat(['M&T BANK STADIUM · BALTIMORE', 'PRESS [B] AT PLAZA · RETRO FOOTBALL'], '#1e1b4b', '#e9d5ff', '#7c3aed', '#6d28d9')
    );
    ravSign.position.set(ravX, 18.5, ravZ - 34);
    sceneryGroup.add(ravSign);

    const ravRing = new THREE.Mesh(
      new THREE.RingGeometry(4.2, 5.4, 24),
      new THREE.MeshBasicMaterial({ color: 0xa855f7, side: THREE.DoubleSide, transparent: true, opacity: 0.78 })
    );
    ravRing.rotation.x = -Math.PI / 2;
    ravRing.position.set(1132, 0.34, -6);
    sceneryGroup.add(ravRing);

    cityBuildings.push({
      minX: ravX - 34,
      maxX: ravX + 34,
      minZ: ravZ - 34,
      maxZ: ravZ + 34,
      height: 22,
      name: 'M&T Bank Stadium',
    });
  }

  // =========================================================================
  // 4. DOWNTOWN CORE: BANK, POLICE HQ, DEALERSHIP, 10 LIGHT ST, 100 E PRATT
  // =========================================================================
  const bankPosition = { x: MD_LANDMARKS.baltimoreBank.x, z: MD_LANDMARKS.baltimoreBank.z };
  const policeStationPosition = { x: MD_LANDMARKS.baltimorePoliceHQ.x, z: MD_LANDMARKS.baltimorePoliceHQ.z };

  {
    // A. Baltimore Federal Reserve Bank facing South toward E Fayette St (-245)
    const bX = bankPosition.x;
    const bZ = -278;
    const bankBody = new THREE.Mesh(new THREE.BoxGeometry(32, 24, 26), marbleMat);
    bankBody.position.set(bX, 0.35 + 12, bZ);
    bankBody.castShadow = isUltra;
    sceneryGroup.add(bankBody);

    const bankSteps = new THREE.Mesh(new THREE.BoxGeometry(26, 1.2, 6), limestoneMat);
    bankSteps.position.set(bX, 0.35 + 0.6, bZ + 15.5);
    sceneryGroup.add(bankSteps);
    for (let c = -2; c <= 2; c++) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.95, 19, 10), marbleMat);
      col.position.set(bX + c * 5.2, 0.35 + 9.5, bZ + 15.5);
      sceneryGroup.add(col);
    }
    const pediment = buildPitchedRoofGroup(32.5, 26.5, 5.8, limestoneMat, limestoneMat, 'z');
    pediment.position.set(bX, 0.35 + 24, bZ);
    sceneryGroup.add(pediment);

    const bankSign = new THREE.Mesh(
      new THREE.BoxGeometry(24, 2.8, 0.5),
      makeTextSignMat(['BALTIMORE FEDERAL RESERVE BANK'], '#1e293b', '#facc15', '#eab308')
    );
    bankSign.position.set(bX, 21.5, bZ + 13.3);
    sceneryGroup.add(bankSign);
    cityBuildings.push({
      minX: bX - 17,
      maxX: bX + 17,
      minZ: bZ - 14,
      maxZ: bZ + 19,
      height: 31,
      name: 'Baltimore Reserve Bank',
    });

    // B. Baltimore Central Police HQ facing South toward E Fayette St (-245), clear of I-83 (1335)
    const pX = 1296;
    const pZ = -278;
    const precinctBody = new THREE.Mesh(new THREE.BoxGeometry(30, 26, 26), boxWithRoofMat(limestoneOfficeMat, flatRoofMat));
    precinctBody.position.set(pX, 0.35 + 13, pZ);
    precinctBody.castShadow = isUltra;
    sceneryGroup.add(precinctBody);

    const blueStrip = new THREE.Mesh(new THREE.BoxGeometry(30.5, 1.0, 26.5), policeBlueMat);
    blueStrip.position.set(pX, 0.35 + 19.5, pZ);
    sceneryGroup.add(blueStrip);

    const pSign = new THREE.Mesh(
      new THREE.BoxGeometry(25, 3.0, 0.5),
      makeTextSignMat(['BALTIMORE POLICE HQ · E FAYETTE'], '#0f172a', '#60a5fa', '#3b82f6')
    );
    pSign.position.set(pX, 12.5, pZ + 13.3);
    sceneryGroup.add(pSign);

    const helipad = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 8.2, 0.3, 18), steelMat);
    helipad.position.set(pX - 4, 0.35 + 26.2, pZ);
    sceneryGroup.add(helipad);
    const heliRing = new THREE.Mesh(new THREE.RingGeometry(7.2, 8.0, 18), goldMat);
    heliRing.rotation.x = -Math.PI / 2;
    heliRing.position.set(pX - 4, 0.35 + 26.45, pZ);
    sceneryGroup.add(heliRing);

    const commMast = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.85, 16, 8), steelMat);
    commMast.position.set(pX + 9, 0.35 + 26 + 8, pZ + 5);
    sceneryGroup.add(commMast);
    const commBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 8), beaconMat);
    commBeacon.position.set(pX + 9, 0.35 + 42.5, pZ + 5);
    sceneryGroup.add(commBeacon);
    cityBuildings.push({
      minX: pX - 16,
      maxX: pX + 16,
      minZ: pZ - 14,
      maxZ: pZ + 14,
      height: 43,
      name: 'Baltimore Police Headquarters',
    });

    // C. Baltimore Motor Mile Dealership West of Cathedral St (1185) & North of Fayette St (-245)
    const dX = 1142;
    const dZ = -284;
    const glassShowMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.14,
      metalness: 0.72,
      transparent: true,
      opacity: 0.78,
    });
    const showroom = new THREE.Mesh(new THREE.BoxGeometry(34, 10, 20), glassShowMat);
    showroom.position.set(dX, 0.35 + 5, dZ);
    sceneryGroup.add(showroom);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(37, 1.0, 24), steelMat);
    canopy.position.set(dX, 0.35 + 10.4, dZ + 2);
    sceneryGroup.add(canopy);
    const dSign = new THREE.Mesh(
      new THREE.BoxGeometry(28, 3.0, 0.5),
      makeTextSignMat(['BALTIMORE MOTOR MILE · SHOWROOM'], '#090d16', '#38bdf8', '#0ea5e9')
    );
    dSign.position.set(dX, 12.2, dZ + 12.5);
    sceneryGroup.add(dSign);
    drawParkingLotBay(dX, dZ + 17, 34, 11, 0);
    cityBuildings.push({
      minX: dX - 18,
      maxX: dX + 18,
      minZ: dZ - 11,
      maxZ: dZ + 11,
      height: 13,
      name: 'Baltimore Motor Mile Dealership',
    });

    // D. 10 Light Street Art-Deco Tower (inside Charles–I-83 / Fayette–Pratt block)
    const boaX = 1260;
    const boaZ = -202;
    const boaLower = new THREE.Mesh(new THREE.BoxGeometry(24, 66, 24), boxWithRoofMat(limestoneOfficeMat, flatRoofMat));
    boaLower.position.set(boaX, 0.35 + 33, boaZ);
    boaLower.castShadow = isUltra;
    sceneryGroup.add(boaLower);
    const boaSetback = new THREE.Mesh(new THREE.BoxGeometry(17, 20, 17), boxWithRoofMat(limestoneOfficeMat, flatRoofMat));
    boaSetback.position.set(boaX, 0.35 + 66 + 10, boaZ);
    sceneryGroup.add(boaSetback);
    const boaRoof = new THREE.Mesh(new THREE.ConeGeometry(12.2, 14, 4), terracottaRoofMat);
    boaRoof.rotation.y = Math.PI / 4;
    boaRoof.position.set(boaX, 0.35 + 86 + 7, boaZ);
    sceneryGroup.add(boaRoof);
    const boaSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.45, 9, 8), goldMat);
    boaSpire.position.set(boaX, 0.35 + 104, boaZ);
    sceneryGroup.add(boaSpire);
    cityBuildings.push({
      minX: boaX - 13,
      maxX: boaX + 13,
      minZ: boaZ - 13,
      maxZ: boaZ + 13,
      height: 108,
      name: '10 Light St Art-Deco Tower',
    });

    // E. Transamerica / 100 E Pratt Harbor Glass Skyline Towers (inside city blocks)
    for (const tw of [
      { x: 1298, z: -202, w: 24, d: 24, h: 76, mat: glassTowerMat, name: '100 E Pratt Glass Tower' },
      { x: 1138, z: -202, w: 26, d: 24, h: 58, mat: darkGlassMat, name: 'Charles Center Plaza Tower' },
      { x: 1262, z: -326, w: 26, d: 24, h: 64, mat: glassTowerMat, name: '1 E Pratt / Midtown Tower' },
      { x: 1136, z: -380, w: 24, d: 24, h: 46, mat: brickMidriseMat, name: 'Mercantile Trust Tower' },
    ]) {
      const podium = new THREE.Mesh(new THREE.BoxGeometry(tw.w + 2.4, 7.5, tw.d + 2.4), limestoneMat);
      podium.position.set(tw.x, 0.35 + 3.75, tw.z);
      sceneryGroup.add(podium);
      const box = new THREE.Mesh(new THREE.BoxGeometry(tw.w, tw.h, tw.d), boxWithRoofMat(tw.mat, flatRoofMat));
      box.position.set(tw.x, 0.35 + tw.h * 0.5, tw.z);
      box.castShadow = isUltra;
      sceneryGroup.add(box);
      const crown = new THREE.Mesh(new THREE.BoxGeometry(tw.w * 0.78, 8, tw.d * 0.78), limestoneMat);
      crown.position.set(tw.x, 0.35 + tw.h + 4, tw.z);
      sceneryGroup.add(crown);
      const mechCap = new THREE.Mesh(new THREE.BoxGeometry(tw.w * 0.44, 4.5, tw.d * 0.44), steelMat);
      mechCap.position.set(tw.x, 0.35 + tw.h + 10.2, tw.z);
      sceneryGroup.add(mechCap);
      cityBuildings.push({
        minX: tw.x - tw.w * 0.5 - 1.2,
        maxX: tw.x + tw.w * 0.5 + 1.2,
        minZ: tw.z - tw.d * 0.5 - 1.2,
        maxZ: tw.z + tw.d * 0.5 + 1.2,
        height: tw.h + 12,
        name: tw.name,
      });
    }
  }

  // =========================================================================
  // 5. MOUNT VERNON MONUMENT, BASILICA, PENN STATION, JOHNS HOPKINS, PATTERSON, DRUID HILL, TOWSON
  // =========================================================================
  {
    // A. Mount Vernon Place & Washington Monument (east of Charles St lane)
    const mvX = 1262;
    const mvZ = -380;
    const mvLawn = new THREE.Mesh(
      new THREE.BoxGeometry(36, 0.02, 36),
      makeCityMat({ color: 0x166534, roughness: 0.88 })
    );
    mvLawn.position.set(mvX, 0.232, mvZ);
    sceneryGroup.add(mvLawn);
    const pedBase = new THREE.Mesh(new THREE.BoxGeometry(13, 6.5, 13), marbleMat);
    pedBase.position.set(mvX, 0.26 + 3.25, mvZ);
    sceneryGroup.add(pedBase);
    const doricShaft = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.7, 36, 14), marbleMat);
    doricShaft.position.set(mvX, 0.26 + 6.5 + 18, mvZ);
    sceneryGroup.add(doricShaft);
    const gwStatue = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.1, 4.0, 8),
      makeCityMat({ color: 0x451a03, roughness: 0.45, metalness: 0.6 })
    );
    gwStatue.position.set(mvX, 0.26 + 44.5, mvZ);
    sceneryGroup.add(gwStatue);
    addLandscapedTree(mvX - 14, mvZ - 14, 0.95);
    addLandscapedTree(mvX + 14, mvZ + 14, 0.95);
    cityBuildings.push({
      minX: mvX - 7,
      maxX: mvX + 7,
      minZ: mvZ - 7,
      maxZ: mvZ + 7,
      height: 48,
      name: 'Washington Monument (Mount Vernon)',
    });

    // B. Baltimore Basilica (West of Cathedral St at 1148, -310)
    const basX = 1145;
    const basZ = -310;
    const basGroup = new THREE.Group();
    basGroup.position.set(basX, 0.25, basZ);
    const basHall = new THREE.Mesh(new THREE.BoxGeometry(44, 18, 52), limestoneMat);
    basHall.position.set(0, 9, 0);
    basGroup.add(basHall);
    for (let c = -2; c <= 2; c++) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 16, 8), marbleMat);
      col.position.set(25, 8, c * 8);
      basGroup.add(col);
    }
    const basPed = buildPitchedRoofGroup(10, 38, 6.5, limestoneMat, limestoneMat, 'x');
    basPed.position.set(24, 18, 0);
    basGroup.add(basPed);
    const basDome = new THREE.Mesh(
      new THREE.SphereGeometry(8.5, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
      copperRoofMat
    );
    basDome.position.set(-2, 18, 0);
    basGroup.add(basDome);
    for (const bz of [-16, 16]) {
      const belfry = new THREE.Mesh(new THREE.BoxGeometry(7.5, 25, 7.5), limestoneMat);
      belfry.position.set(18, 12.5, bz);
      basGroup.add(belfry);
      const bCap = new THREE.Mesh(new THREE.ConeGeometry(4.4, 6, 8), copperRoofMat);
      bCap.position.set(18, 28, bz);
      basGroup.add(bCap);
    }
    sceneryGroup.add(basGroup);
    cityBuildings.push({
      minX: basX - 23,
      maxX: basX + 27,
      minZ: basZ - 27,
      maxZ: basZ + 27,
      height: 32,
      name: 'Baltimore Basilica',
    });

    // C. Penn Station (Beaux-Arts Station House + Amtrak Rail Corridor at 1259, -445)
    const pennX = 1259;
    const pennZ = -445;
    const pennBody = new THREE.Mesh(new THREE.BoxGeometry(44, 13, 22), limestoneMat);
    pennBody.position.set(pennX, 0.35 + 6.5, pennZ);
    sceneryGroup.add(pennBody);
    const pennRoof = buildPitchedRoofGroup(44.5, 22.5, 4.5, limestoneMat, copperRoofMat, 'x');
    pennRoof.position.set(pennX, 0.35 + 13, pennZ);
    sceneryGroup.add(pennRoof);
    const pennSign = new THREE.Mesh(
      new THREE.BoxGeometry(24, 2.8, 0.45),
      makeTextSignMat(['BALTIMORE PENN STATION · AMTRAK'], '#0f172a', '#f8fafc', '#38bdf8')
    );
    pennSign.position.set(pennX, 11.2, pennZ - 11.3);
    sceneryGroup.add(pennSign);
    // Flush E-W Amtrak rail bed below street asphalt level across Penn Station corridor
    const railBed = new THREE.Mesh(new THREE.BoxGeometry(240, 0.04, 8), steelMat);
    railBed.position.set(1255, 0.222, -422);
    sceneryGroup.add(railBed);
    cityBuildings.push({
      minX: pennX - 23,
      maxX: pennX + 23,
      minZ: pennZ - 12,
      maxZ: pennZ + 12,
      height: 18,
      name: 'Baltimore Penn Station',
    });

    // D. Johns Hopkins Hospital Billings Administration Dome & Medical Campus
    const jhX = 1445;
    const jhZ = -345;
    const jhMain = new THREE.Mesh(new THREE.BoxGeometry(64, 20, 44), boxWithRoofMat(brickMidriseMat, flatRoofMat));
    jhMain.position.set(jhX, 0.35 + 10, jhZ);
    sceneryGroup.add(jhMain);
    const jhDrum = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 9.2, 10, 12), solidBrickMasonryMat);
    jhDrum.position.set(jhX, 0.35 + 25, jhZ);
    sceneryGroup.add(jhDrum);
    const jhDome = new THREE.Mesh(
      new THREE.SphereGeometry(8.6, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      copperRoofMat
    );
    jhDome.position.set(jhX, 0.35 + 30, jhZ);
    sceneryGroup.add(jhDome);
    const jhSign = new THREE.Mesh(
      new THREE.BoxGeometry(36, 3.2, 0.5),
      makeTextSignMat(['JOHNS HOPKINS HOSPITAL'], '#1e3a8a', '#f8fafc', '#60a5fa')
    );
    jhSign.position.set(jhX, 16, jhZ + 22.3);
    sceneryGroup.add(jhSign);
    cityBuildings.push({
      minX: jhX - 33,
      maxX: jhX + 33,
      minZ: jhZ - 23,
      maxZ: jhZ + 23,
      height: 40,
      name: 'Johns Hopkins Hospital',
    });

    // E. Patterson Park Conservatory Lawn & 4-Tier Octagonal Pagoda
    const ppX = 1545;
    const ppZ = -236;
    const ppLawn = new THREE.Mesh(
      new THREE.BoxGeometry(58, 0.02, 54),
      makeCityMat({ color: 0x2d5e29, roughness: 0.9 })
    );
    ppLawn.position.set(ppX, 0.232, ppZ);
    sceneryGroup.add(ppLawn);
    for (let tier = 0; tier < 3; tier++) {
      const tBody = new THREE.Mesh(
        new THREE.CylinderGeometry(4.8 - tier * 1.0, 4.8 - tier * 1.0, 4.2, 8),
        marbleMat
      );
      tBody.position.set(ppX, 0.26 + 2.1 + tier * 5.0, ppZ);
      sceneryGroup.add(tBody);
      const tRoof = new THREE.Mesh(new THREE.ConeGeometry(6.8 - tier * 1.2, 2.2, 8), copperRoofMat);
      tRoof.position.set(ppX, 0.26 + 4.8 + tier * 5.0, ppZ);
      sceneryGroup.add(tRoof);
    }
    for (const [ox, oz] of [
      [-22, -20],
      [22, -20],
      [-22, 20],
      [22, 20],
    ]) {
      addLandscapedTree(ppX + ox, ppZ + oz, 1.1);
    }
    cityBuildings.push({
      minX: ppX - 7,
      maxX: ppX + 7,
      minZ: ppZ - 7,
      maxZ: ppZ + 7,
      height: 20,
      name: 'Patterson Park Observatory Pagoda',
    });

    // F. Druid Hill Park, Reservoir Lake & Howard Peters Rawlings Conservatory
    const dhX = 1070;
    const dhZ = -600;
    const dhLawn = new THREE.Mesh(
      new THREE.BoxGeometry(116, 0.02, 106),
      makeCityMat({ color: 0x265824, roughness: 0.9 })
    );
    dhLawn.position.set(dhX, 0.232, dhZ);
    sceneryGroup.add(dhLawn);
    const dhLake = new THREE.Mesh(new THREE.CircleGeometry(36, 20), harborWaterMat);
    dhLake.rotation.x = -Math.PI / 2;
    dhLake.position.set(dhX + 12, 0.244, dhZ + 12);
    sceneryGroup.add(dhLake);
    const consGlassMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      roughness: 0.16,
      metalness: 0.4,
      transparent: true,
      opacity: 0.8,
    });
    const consPalm = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 9, 10, 12), consGlassMat);
    consPalm.position.set(dhX - 32, 0.26 + 5, dhZ - 26);
    sceneryGroup.add(consPalm);
    const consDome = new THREE.Mesh(
      new THREE.SphereGeometry(8.5, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      consGlassMat
    );
    consDome.position.set(dhX - 32, 0.26 + 10, dhZ - 26);
    sceneryGroup.add(consDome);
    for (let i = 0; i < 8; i++) {
      addLandscapedTree(dhX - 45 + (i % 4) * 28, dhZ - 42 + Math.floor(i / 4) * 76, 1.2);
    }

    // G. Towson Courthouse & Circle Plaza (North Charles St & I-695 at 1172, -808)
    const twX = 1172;
    const twZ = -808;
    const towBody = new THREE.Mesh(new THREE.BoxGeometry(44, 16, 28), marbleMat);
    towBody.position.set(twX, 0.35 + 8, twZ);
    sceneryGroup.add(towBody);
    const towRoof = buildPitchedRoofGroup(44.5, 28.5, 5.2, marbleMat, darkSlateRoofMat, 'x');
    towRoof.position.set(twX, 0.35 + 16, twZ);
    sceneryGroup.add(towRoof);
    const towSign = new THREE.Mesh(
      new THREE.BoxGeometry(28, 2.8, 0.5),
      makeTextSignMat(['TOWSON · BALTIMORE CO COURTHOUSE'], '#1e293b', '#f8fafc', '#cbd5e1')
    );
    towSign.position.set(twX, 13, twZ + 14.4);
    sceneryGroup.add(towSign);
    cityBuildings.push({
      minX: twX - 23,
      maxX: twX + 23,
      minZ: twZ - 15,
      maxZ: twZ + 15,
      height: 22,
      name: 'Towson Historic Courthouse',
    });
  }

  // =========================================================================
  // 6. AUTHENTIC BALTIMORE BRICK & FORMSTONE ROWHOME STREETS (Narrow Individual Units + Marble Stoops)
  // =========================================================================
  {
    const rowPalettes = ['#8b2e24', '#9a3412', '#7c2d12', '#a16207', '#78716c', '#6b2c26'];
    const rowBrickMats = rowPalettes.map((hex) => makeBrickFacadeMat(hex, '#e2e8f0', '#0f172a', 2, 3, false));
    const corniceMat = makeCityMat({ color: 0x0f172a, roughness: 0.7 });
    const rowDoorMat = makeCityMat({ color: 0x1e293b, roughness: 0.55 });

    const rowhomeStrips = [
      // Bolton Hill / Midtown (between MLK & Cathedral St)
      { startX: 1112, startZ: -440, count: 9, stepZ: 17.5, dirStoop: -1, label: 'Bolton Hill Rowhomes' },
      // Charles Village (along N Charles St north of Penn Station)
      { startX: 1188, startZ: -740, count: 9, stepZ: 17.5, dirStoop: 1, label: 'Charles Village Rowhomes' },
      // Canton / Butcher's Hill (between Fayette & Pratt east of JHH)
      { startX: 1412, startZ: -244, count: 4, stepZ: 16.5, dirStoop: -1, label: 'Canton Brick Rowhomes' },
      // Highlandtown / East Baltimore strip east of Patterson Park
      { startX: 1595, startZ: -380, count: 6, stepZ: 17.5, dirStoop: 1, label: 'Highlandtown Brick Rowhomes' },
      // Federal Hill residential west of Light St
      { startX: 1218, startZ: -38, count: 4, stepZ: 16.0, dirStoop: 1, label: 'Federal Hill Rowhomes' },
    ];

    for (const strip of rowhomeStrips) {
      for (let i = 0; i < strip.count; i++) {
        // Divide each block bay into 2 narrow authentic 7.4m attached Baltimore rowhomes!
        for (let sub = 0; sub < 2; sub++) {
          const rx = strip.startX;
          const rz = strip.startZ + i * strip.stepZ + (sub === 0 ? -4.0 : 4.0);
          const colorIdx = (i * 2 + sub) % rowBrickMats.length;
          const unitMat = rowBrickMats[colorIdx];
          const rH = 10.6 + ((i + sub) % 3) * 1.1;

          const unit = new THREE.Mesh(new THREE.BoxGeometry(15.2, rH, 7.6), boxWithRoofMat(unitMat, flatRoofMat));
          unit.position.set(rx, 0.3 + rH * 0.5, rz);
          unit.castShadow = isUltra;
          sceneryGroup.add(unit);

          const cornice = new THREE.Mesh(new THREE.BoxGeometry(15.7, 0.85, 7.8), corniceMat);
          cornice.position.set(rx, 0.3 + rH + 0.35, rz);
          sceneryGroup.add(cornice);

          const frontDoor = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.1, 1.8), rowDoorMat);
          frontDoor.position.set(rx + strip.dirStoop * 7.65, 0.3 + 2.55, rz);
          sceneryGroup.add(frontDoor);

          // Classic 3-step white Baltimore marble stoop facing the street
          for (let st = 0; st < 3; st++) {
            const step = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.42 + st * 0.32, 2.2), marbleMat);
            step.position.set(rx + strip.dirStoop * (9.2 - st * 0.72), 0.3 + 0.21 + st * 0.16, rz);
            sceneryGroup.add(step);
          }
        }
      }
      cityBuildings.push({
        minX: strip.startX - 9,
        maxX: strip.startX + 9,
        minZ: strip.startZ - 9,
        maxZ: strip.startZ + (strip.count - 1) * strip.stepZ + 9,
        height: 15,
        name: strip.label,
      });
    }
  }

  // =========================================================================
  // 7. ISLAMIC SOCIETY OF BALTIMORE (6631 JOHNNYCAKE RD) & WOODLAWN/CATONSVILLE
  // =========================================================================
  {
    // Place ISB & Al-Rahmah School cleanly on the NE terrace of Johnnycake Rd at (796, -365)
    // aligned facing SW toward Johnnycake Rd (junction (740, -340) -> (840, -280)), with driveway aprons
    // connecting right onto Johnnycake Rd & Rolling Rd.
    const isbCx = 810;
    const isbCz = -384;
    const isbRot = -0.54; // local +Z points SW directly toward Johnnycake Rd!
    const isbGroup = new THREE.Group();
    isbGroup.position.set(isbCx, 0.25, isbCz);
    isbGroup.rotation.y = isbRot;

    const campusLawnMat = makeCityMat({ color: 0x1e462d, roughness: 0.9 });
    const campusLawn = new THREE.Mesh(new THREE.BoxGeometry(82, 0.02, 52), campusLawnMat);
    campusLawn.position.set(0, -0.018, 0);
    isbGroup.add(campusLawn);

    const isbBrickMat = makeBrickFacadeMat('#b8845c', '#e5dac7', '#1e293b', 6, 4, true);
    const isbSolidBrickMat = makeCityMat({ color: 0xb8845c, roughness: 0.76 });
    const isbSchoolBrickMat = makeBrickFacadeMat('#8b3428', '#d6c7b2', '#1e293b', 8, 2, false);
    const isbLimestoneMat = makeCityMat({ color: 0xede2cf, roughness: 0.55, metalness: 0.06 });
    const isbBronzeDomeMat = makeCityMat({ color: 0xdfb143, roughness: 0.25, metalness: 0.72 });

    // Masjid Al-Rahmah Main Prayer Hall (East side)
    const masjidX = 16;
    const masjidZ = -6;
    const masjidBody = new THREE.Mesh(new THREE.BoxGeometry(36, 15, 34), boxWithRoofMat(isbBrickMat, flatRoofMat));
    masjidBody.position.set(masjidX, 7.5, masjidZ);
    masjidBody.castShadow = isUltra;
    isbGroup.add(masjidBody);

    const masjidBand = new THREE.Mesh(new THREE.BoxGeometry(36.6, 1.3, 34.6), isbLimestoneMat);
    masjidBand.position.set(masjidX, 14.6, masjidZ);
    isbGroup.add(masjidBand);

    const drum = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 9.8, 4.0, 8), isbLimestoneMat);
    drum.position.set(masjidX, 17.0, masjidZ);
    isbGroup.add(drum);

    const isbDome = new THREE.Mesh(
      new THREE.SphereGeometry(8.4, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
      isbBronzeDomeMat
    );
    isbDome.position.set(masjidX, 18.8, masjidZ);
    isbGroup.add(isbDome);

    const finialMast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, 3.8, 8), isbBronzeDomeMat);
    finialMast.position.set(masjidX, 28.5, masjidZ);
    isbGroup.add(finialMast);
    const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.14, 8, 16, Math.PI * 1.45), isbBronzeDomeMat);
    crescent.position.set(masjidX, 30.8, masjidZ);
    crescent.rotation.y = Math.PI / 4;
    isbGroup.add(crescent);

    // Tall Brick & Limestone Minaret at South-East corner overlooking Johnnycake Rd
    const minX = masjidX + 16;
    const minZ = masjidZ + 14;
    const minShaft = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.1, 26, 8), isbSolidBrickMat);
    minShaft.position.set(minX, 13, minZ);
    isbGroup.add(minShaft);
    const minBalcony = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.4, 1.4, 8), isbLimestoneMat);
    minBalcony.position.set(minX, 26.2, minZ);
    isbGroup.add(minBalcony);
    const minLantern = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 3.2, 8), isbLimestoneMat);
    minLantern.position.set(minX, 28.4, minZ);
    isbGroup.add(minLantern);
    const minSpire = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.6, 8), isbBronzeDomeMat);
    minSpire.position.set(minX, 32.2, minZ);
    isbGroup.add(minSpire);

    // Arched Portico Canopy facing South (+Z) toward Johnnycake Rd
    const porticoRoof = new THREE.Mesh(new THREE.BoxGeometry(18, 2.0, 6.5), isbLimestoneMat);
    porticoRoof.position.set(masjidX, 7.0, masjidZ + 19.5);
    isbGroup.add(porticoRoof);
    for (let px = -6; px <= 6; px += 6) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 6.6, 8), isbLimestoneMat);
      col.position.set(masjidX + px, 3.3, masjidZ + 22.0);
      isbGroup.add(col);
    }

    // Al-Rahmah School Red-Brick Wing (West side)
    const schoolBody = new THREE.Mesh(new THREE.BoxGeometry(34, 10.5, 42), boxWithRoofMat(isbSchoolBrickMat, flatRoofMat));
    schoolBody.position.set(-22, 5.25, -8);
    isbGroup.add(schoolBody);
    const schoolParapet = new THREE.Mesh(new THREE.BoxGeometry(34.6, 0.9, 42.6), isbLimestoneMat);
    schoolParapet.position.set(-22, 10.8, -8);
    isbGroup.add(schoolParapet);
    const schoolSign = new THREE.Mesh(
      new THREE.BoxGeometry(16, 1.8, 0.35),
      makeTextSignMat(['AL-RAHMAH SCHOOL'], '#7c2d23', '#fef3c7', '#e7dcc8')
    );
    schoolSign.position.set(-22, 8.6, 13.2);
    isbGroup.add(schoolSign);

    // Illuminated Monument Sign facing Johnnycake Rd (6631 Johnnycake Rd)
    const isbSignMat = makeTextSignMat(
      ['ISLAMIC SOCIETY OF BALTIMORE', '6631 JOHNNYCAKE RD · MASJID AL-RAHMAH'],
      '#1e293b',
      '#fde68a',
      '#d97706'
    );
    const monBase = new THREE.Mesh(new THREE.BoxGeometry(12, 2.2, 1.2), solidBrickMasonryMat);
    monBase.position.set(0, 1.1, 31);
    isbGroup.add(monBase);
    const monFace = new THREE.Mesh(new THREE.BoxGeometry(11.2, 1.8, 0.35), isbSignMat);
    monFace.position.set(0, 1.8, 31.7);
    isbGroup.add(monFace);

    sceneryGroup.add(isbGroup);

    // Paved parking bay between ISB Masjid front and Johnnycake Rd (clear open asphalt)
    drawParkingLotBay(794, -356, 38, 16, isbRot);
    const isbDriveApron = new THREE.Mesh(new THREE.PlaneGeometry(14, 18), streetAsphaltMat);
    isbDriveApron.rotation.x = -Math.PI / 2;
    isbDriveApron.rotation.z = isbRot;
    isbDriveApron.position.set(778, 0.242, -336);
    sceneryGroup.add(isbDriveApron);

    cityBuildings.push(
      {
        minX: isbCx - 5,
        maxX: isbCx + 34,
        minZ: isbCz - 24,
        maxZ: isbCz + 16,
        height: 34,
        name: 'Islamic Society of Baltimore (Masjid Al-Rahmah)',
      },
      {
        minX: isbCx - 42,
        maxX: isbCx - 6,
        minZ: isbCz - 28,
        maxZ: isbCz + 16,
        height: 12,
        name: 'Al-Rahmah School (ISB)',
      }
    );

    // Greens at Rolling Road (brick garden apartments West of I-695 off Security Blvd)
    const greensBrickMat = makeBrickFacadeMat('#7f3f33', '#d6d3d1', '#0f172a', 7, 3, false);
    for (const [bx, bz] of [
      [594, -490],
      [594, -530],
      [594, -570],
    ]) {
      const apt = new THREE.Mesh(new THREE.BoxGeometry(28, 11.5, 22), boxWithRoofMat(greensBrickMat, flatRoofMat));
      apt.position.set(bx, 0.35 + 5.75, bz);
      sceneryGroup.add(apt);
      const roof = buildPitchedRoofGroup(28.4, 22.4, 3.6, greensBrickMat, darkSlateRoofMat, 'x');
      roof.position.set(bx, 0.35 + 11.5, bz);
      sceneryGroup.add(roof);
      cityBuildings.push({
        minX: bx - 15,
        maxX: bx + 15,
        minZ: bz - 12,
        maxZ: bz + 12,
        height: 16,
        name: 'Greens at Rolling Rd Apartments',
      });
    }

    // Security Square Plaza (North side of Security Blvd at 780, -508)
    const mallBrickMat = makeBrickFacadeMat('#57534e', '#cbd5e1', '#38bdf8', 9, 2, false);
    const mallBody = new THREE.Mesh(new THREE.BoxGeometry(76, 13, 34), boxWithRoofMat(mallBrickMat, flatRoofMat));
    mallBody.position.set(780, 0.35 + 6.5, -508);
    sceneryGroup.add(mallBody);
    const mallParapet = new THREE.Mesh(new THREE.BoxGeometry(77.2, 1.2, 35.2), limestoneMat);
    mallParapet.position.set(780, 0.35 + 13.4, -508);
    sceneryGroup.add(mallParapet);
    const mallCanopy = new THREE.Mesh(new THREE.BoxGeometry(70, 0.7, 4.2), steelMat);
    mallCanopy.position.set(780, 0.35 + 4.8, -489.4);
    sceneryGroup.add(mallCanopy);
    const secSign = new THREE.Mesh(
      new THREE.BoxGeometry(48, 3.2, 0.5),
      makeTextSignMat(['SECURITY SQUARE PLAZA · WOODLAWN'], '#1e293b', '#38bdf8', '#0284c7')
    );
    secSign.position.set(780, 11, -490.7);
    sceneryGroup.add(secSign);
    drawParkingLotBay(780, -476, 70, 20, 0);
    cityBuildings.push({
      minX: 742,
      maxX: 818,
      minZ: -525,
      maxZ: -491,
      height: 15,
      name: 'Security Square Plaza',
    });

    // Woodbridge Valley / Catonsville Detached Homes along N Rolling Rd & Ingleside Ave
    const catonsvilleHomes = [
      { x: 726, z: -245, rotY: -Math.PI / 2, addr: '6604 Johnnycake Rd', col: 0x881337, roof: 0x1e293b },
      { x: 726, z: -200, rotY: -Math.PI / 2, addr: '1412 Ingleside Ave', col: 0x78716c, roof: 0x292524 },
      { x: 730, z: -115, rotY: 0, addr: '1205 Woodbridge Rd', col: 0x334155, roof: 0x0f172a },
      { x: 798, z: -108, rotY: 0, addr: '812 S Rolling Rd (Catonsville)', col: 0xe2e8f0, roof: 0x1e293b },
      { x: 796, z: -78, rotY: Math.PI, addr: '814 Frederick Rd', col: 0x8b3a2b, roof: 0x292524 },
    ];
    for (const ch of catonsvilleHomes) {
      const built = buildSuburbanHouseMesh(ch.x, ch.z, ch.rotY, {
        wallColor: ch.col,
        roofColor: ch.roof,
        address: ch.addr,
        tier: 'regular',
      });
      sceneryGroup.add(built.group);
      suburbanHouses.push(built);
      cityBuildings.push(built.collider);
    }

    // Expanded Catonsville, Woodlawn & Towson Suburban Neighborhood Clusters
    const baltSuburbSpecs: { x: number; z: number; rotY: number; num: string; st: string; city: string }[] = [
      // Woodlawn North (north of Security Blvd -450 and Security Square -525)
      { x: 742, z: -560, rotY: 0, num: '6702', st: 'Windsor Mill Rd', city: 'Woodlawn' },
      { x: 760, z: -560, rotY: 0, num: '6706', st: 'Windsor Mill Rd', city: 'Woodlawn' },
      { x: 778, z: -560, rotY: 0, num: '6710', st: 'Windsor Mill Rd', city: 'Woodlawn' },
      { x: 796, z: -560, rotY: 0, num: '6714', st: 'Windsor Mill Rd', city: 'Woodlawn' },
      { x: 742, z: -592, rotY: Math.PI, num: '6703', st: 'Windsor Mill Rd', city: 'Woodlawn' },
      { x: 760, z: -592, rotY: Math.PI, num: '6707', st: 'Windsor Mill Rd', city: 'Woodlawn' },
      { x: 778, z: -592, rotY: Math.PI, num: '6711', st: 'Windsor Mill Rd', city: 'Woodlawn' },
      { x: 796, z: -592, rotY: Math.PI, num: '6715', st: 'Windsor Mill Rd', city: 'Woodlawn' },
      // Catonsville / Woodbridge Valley East
      { x: 850, z: -185, rotY: 0, num: '6204', st: 'Edmondson Ave', city: 'Catonsville' },
      { x: 868, z: -185, rotY: 0, num: '6208', st: 'Edmondson Ave', city: 'Catonsville' },
      { x: 886, z: -185, rotY: 0, num: '6212', st: 'Edmondson Ave', city: 'Catonsville' },
      { x: 850, z: -152, rotY: Math.PI, num: '6205', st: 'Edmondson Ave', city: 'Catonsville' },
      { x: 868, z: -152, rotY: Math.PI, num: '6209', st: 'Edmondson Ave', city: 'Catonsville' },
      { x: 886, z: -152, rotY: Math.PI, num: '6213', st: 'Edmondson Ave', city: 'Catonsville' },
      // Gwynn Oak / Howard Park
      { x: 910, z: -360, rotY: 0, num: '4402', st: 'Liberty Heights Ave', city: 'Baltimore' },
      { x: 928, z: -360, rotY: 0, num: '4406', st: 'Liberty Heights Ave', city: 'Baltimore' },
      { x: 946, z: -360, rotY: 0, num: '4410', st: 'Liberty Heights Ave', city: 'Baltimore' },
      { x: 910, z: -392, rotY: Math.PI, num: '4403', st: 'Liberty Heights Ave', city: 'Baltimore' },
      { x: 928, z: -392, rotY: Math.PI, num: '4407', st: 'Liberty Heights Ave', city: 'Baltimore' },
      { x: 946, z: -392, rotY: Math.PI, num: '4411', st: 'Liberty Heights Ave', city: 'Baltimore' },
      // Towson / Rodgers Forge West of N Charles St
      { x: 1096, z: -760, rotY: 0, num: '512', st: 'York Rd', city: 'Towson' },
      { x: 1114, z: -760, rotY: 0, num: '516', st: 'York Rd', city: 'Towson' },
      { x: 1132, z: -760, rotY: 0, num: '520', st: 'York Rd', city: 'Towson' },
      { x: 1150, z: -760, rotY: 0, num: '524', st: 'York Rd', city: 'Towson' },
    ];
    baltSuburbSpecs.forEach((b, idx) => {
      suburbanBatch.addHouse(
        {
          x: b.x,
          z: b.z,
          rotY: b.rotY,
          houseNum: b.num,
          street: b.st,
          cityTag: b.city,
          style: idx % 2 === 0 ? 'colonial' : 'split',
          sidingHex: ['#e7dec8', '#cbd5e1', '#d6ccb8', '#f1f5f9'][idx % 4],
          roofColor: [0x1e293b, 0x292524, 0x3b2f2f][idx % 3],
          shutterColor: [0x14532d, 0x0f172a, 0x7f1d1d][idx % 3],
          doorColor: [0x7f1d1d, 0x1e3a8a, 0x14532d][idx % 3],
          brickFront: idx % 2 === 0,
        },
        suburbanHouses,
        cityBuildings
      );
    });

    // White Lane Stripes inside Parking Lot Helper sanity signposts around Woodlawn/ISB
    void whiteLineMat;
    void sidewalkMat;
    addStreetNamePost(725, -355, 'JOHNNYCAKE RD · 6631 ISB', 0);
    addStreetNamePost(684, -430, 'N ROLLING RD & SECURITY', Math.PI / 2);
  }

  return {
    bankPosition,
    policeStationPosition,
  };
}
