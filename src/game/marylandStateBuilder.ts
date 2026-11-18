import * as THREE from 'three';
import {
  ALL_MARYLAND_ROADS,
  MD_LANDMARKS,
  distSqPointToSeg,
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

export interface MarylandStateBuilderContext {
  group: THREE.Group;
  sceneryGroup: THREE.Group;
  cityBuildings: CityBuildingBox[];
  suburbanHouses: BuiltSuburbanHouse[];
  suburbanBatch: SuburbanBatchBuilder;
  disposables: { dispose: () => void }[];
  streetAsphaltMat: THREE.Material;
  whiteLineMat: THREE.Material;
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

export function buildMarylandStateDistrict(ctx: MarylandStateBuilderContext): void {
  const {
    sceneryGroup,
    cityBuildings,
    suburbanHouses,
    suburbanBatch,
    disposables,
    streetAsphaltMat,
    whiteLineMat,
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

  // Shared Statewide Landscape & Architectural Materials
  const bayWaterMat = makeCityMat({ color: 0x0b4f6c, roughness: 0.16, metalness: 0.68 });
  const atlanticWaterMat = makeCityMat({ color: 0x075985, roughness: 0.15, metalness: 0.72 });
  const lakeWaterMat = makeCityMat({ color: 0x0e7490, roughness: 0.18, metalness: 0.64 });
  const sandBeachMat = makeCityMat({ color: 0xe6d2a2, roughness: 0.92, metalness: 0.0 });
  const easternShoreSoilMat = makeCityMat({ color: 0x3b6e32, roughness: 0.9 });
  const brickRedMat = makeBrickFacadeMat('#8b2e24', '#e2e8f0', '#0f172a', 6, 3, false);
  const georgianBrickMat = makeBrickFacadeMat('#991b1b', '#f1f5f9', '#1e293b', 8, 4, true);
  const stoneCladMat = makeCityMat({ color: 0xe5e0d5, roughness: 0.56, metalness: 0.06 });
  const whiteTrimMat = makeCityMat({ color: 0xf8fafc, roughness: 0.36 });
  const darkSlateRoofMat = makeCityMat({ color: 0x1e293b, roughness: 0.72 });
  const copperRoofMat = makeCityMat({ color: 0x0f766e, roughness: 0.38, metalness: 0.52 });
  const timberMat = makeCityMat({ color: 0x7c4a26, roughness: 0.85 });
  const steelGrayMat = makeCityMat({ color: 0x64748b, roughness: 0.38, metalness: 0.68 });
  const rockCliffMat = makeCityMat({ color: 0x57534e, roughness: 0.94, metalness: 0.04 });
  const appalachianSlopeMat = makeCityMat({ color: 0x1f4b24, roughness: 0.92 });
  const glassTowerMat = makeBrickFacadeMat('#334155', '#64748b', '#93c5fd', 8, 16, false);
  const flatRoofMat = makeCityMat({ color: 0x334155, roughness: 0.85, metalness: 0.1 });
  const solidBrickMat = makeCityMat({ color: 0x8b2e24, roughness: 0.78 });

  // =========================================================================
  // 1. STATEWIDE WATERS, ISLANDS & BEACHES (Bay, Atlantic, Potomac, Deep Creek)
  // =========================================================================
  {
    // Chesapeake Bay Main Stem (East of Sandy Point X=1545 to Eastern Shore X=2530)
    const bayMain = new THREE.Mesh(new THREE.PlaneGeometry(990, 4200), bayWaterMat);
    bayMain.rotation.x = -Math.PI / 2;
    bayMain.position.set(2035, 0.232, 600);
    sceneryGroup.add(bayMain);

    // Outer Patapsco River / Chesapeake Mouth connecting Baltimore Harbor to the Bay
    const patapscoWater = new THREE.Mesh(new THREE.PlaneGeometry(420, 210), bayWaterMat);
    patapscoWater.rotation.x = -Math.PI / 2;
    patapscoWater.position.set(1745, 0.232, -45);
    sceneryGroup.add(patapscoWater);

    // Atlantic Ocean East of Ocean City Barrier Island
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(2400, 4200), atlanticWaterMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(3730, 0.232, 600);
    sceneryGroup.add(ocean);

    // Severn River Inlet North of Annapolis USNA
    const severnRiver = new THREE.Mesh(new THREE.PlaneGeometry(260, 72), bayWaterMat);
    severnRiver.rotation.x = -Math.PI / 2;
    severnRiver.rotation.z = -0.35;
    severnRiver.position.set(1480, 0.233, 610);
    sceneryGroup.add(severnRiver);

    // Kent Island (raised cleanly below road surface at y=0.238 along US-50 X=2025..2235)
    const kentIsland = new THREE.Mesh(new THREE.PlaneGeometry(215, 190), easternShoreSoilMat);
    kentIsland.rotation.x = -Math.PI / 2;
    kentIsland.position.set(2130, 0.238, 745);
    sceneryGroup.add(kentIsland);

    // Eastern Shore Delmarva Mainland (Easton, Salisbury, Berlin)
    const easternShore = new THREE.Mesh(new THREE.PlaneGeometry(250, 1280), easternShoreSoilMat);
    easternShore.rotation.x = -Math.PI / 2;
    easternShore.position.set(2325, 0.238, 920);
    sceneryGroup.add(easternShore);

    // Ocean City Barrier Island + Golden Sand Beach facing Atlantic
    const ocSand = new THREE.Mesh(new THREE.PlaneGeometry(92, 540), sandBeachMat);
    ocSand.rotation.x = -Math.PI / 2;
    ocSand.position.set(2504, 0.238, 1110);
    sceneryGroup.add(ocSand);

    // Potomac River (curving South of Montgomery / Cabin John / National Harbor / under Wilson Bridge)
    const potomacMain = new THREE.Mesh(new THREE.PlaneGeometry(1100, 160), bayWaterMat);
    potomacMain.rotation.x = -Math.PI / 2;
    potomacMain.rotation.z = 0.24;
    potomacMain.position.set(-460, 0.232, 1985);
    sceneryGroup.add(potomacMain);

    const potomacUpper = new THREE.Mesh(new THREE.PlaneGeometry(600, 95), bayWaterMat);
    potomacUpper.rotation.x = -Math.PI / 2;
    potomacUpper.rotation.z = -0.45;
    potomacUpper.position.set(-960, 0.232, 1780);
    sceneryGroup.add(potomacUpper);

    // Deep Creek Lake (Garrett County Western MD)
    const deepCreek = new THREE.Mesh(new THREE.PlaneGeometry(175, 220), lakeWaterMat);
    deepCreek.rotation.x = -Math.PI / 2;
    deepCreek.position.set(-2415, 0.234, -460);
    sceneryGroup.add(deepCreek);

    // Lake Kittamaqundi (Downtown Columbia)
    const kittamaqundi = new THREE.Mesh(new THREE.CircleGeometry(38, 18), lakeWaterMat);
    kittamaqundi.rotation.x = -Math.PI / 2;
    kittamaqundi.position.set(335, 0.236, 130);
    sceneryGroup.add(kittamaqundi);
  }

  // =========================================================================
  // 2. CHESAPEAKE BAY BRIDGE, WOODROW WILSON BRIDGE & OCEAN CITY ROUTE 50 BRIDGE
  // =========================================================================
  {
    // A. Gov. William Preston Lane Jr. Chesapeake Bay Bridge (Suspension Spans at Z=720, X=1540..2040)
    const bayZ = 720;
    for (const pierX of [1590, 1650, 1720, 1790, 1860, 1930, 1995]) {
      for (const pzOff of [-12.5, 12.5]) {
        const pier = new THREE.Mesh(new THREE.BoxGeometry(4.5, 4.0, 4.5), steelGrayMat);
        pier.position.set(pierX, -1.75, bayZ + pzOff);
        sceneryGroup.add(pier);
      }
    }
    // Dual Iconic White/Silver Suspension Towers
    for (const twX of [1730, 1850]) {
      for (const zSide of [-16.8, 16.8]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(2.6, 46, 2.6), whiteTrimMat);
        leg.position.set(twX, 0.35 + 23, bayZ + zSide);
        sceneryGroup.add(leg);
      }
      const crossTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 36), whiteTrimMat);
      crossTop.position.set(twX, 0.35 + 45, bayZ);
      sceneryGroup.add(crossTop);
      const crossMid = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 36), whiteTrimMat);
      crossMid.position.set(twX, 0.35 + 28, bayZ);
      sceneryGroup.add(crossMid);
    }
    // Main Catenary Suspension Cables & Vertical Hangars (using TubeGeometry curve!)
    for (const zSide of [-16.8, 16.8]) {
      const cableCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(1630, 1.5, bayZ + zSide),
        new THREE.Vector3(1730, 46.2, bayZ + zSide),
        new THREE.Vector3(1790, 14.5, bayZ + zSide),
        new THREE.Vector3(1850, 46.2, bayZ + zSide),
        new THREE.Vector3(1950, 1.5, bayZ + zSide),
      ]);
      const cableMesh = new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 28, 0.42, 6, false), steelGrayMat);
      sceneryGroup.add(cableMesh);

      for (let hx = 1660; hx <= 1920; hx += 20) {
        const distFromMid = Math.abs(hx - 1790);
        const hTop = hx >= 1730 && hx <= 1850 ? 14.5 + (distFromMid / 60) * 30 : 12 + (1 - Math.abs(hx - 1790) / 160) * 20;
        const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, Math.max(4, hTop), 5), steelGrayMat);
        hanger.position.set(hx, 0.4 + Math.max(4, hTop) * 0.5, bayZ + zSide);
        sceneryGroup.add(hanger);
      }
    }

    // B. Woodrow Wilson Memorial Drawbridge Towers (I-495 at -420, 1980, outside 34m highway width)
    const wwX = -420;
    const wwZ = 1980;
    for (const zSide of [-20.5, 20.5]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(5.5, 18, 4.2), stoneCladMat);
      tower.position.set(wwX, 0.35 + 9, wwZ + zSide);
      sceneryGroup.add(tower);
    }
    const wwArch = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 44), whiteTrimMat);
    wwArch.position.set(wwX, 0.35 + 17.5, wwZ);
    sceneryGroup.add(wwArch);

    // C. Route 50 Harry Kelley Memorial Drawbridge Towers entering Ocean City (outside 30m US-50 width)
    for (const zSide of [-18.5, 18.5]) {
      const ocPier = new THREE.Mesh(new THREE.BoxGeometry(4.5, 12, 3.5), stoneCladMat);
      ocPier.position.set(2450, 0.35 + 6, 1180 + zSide);
      sceneryGroup.add(ocPier);
    }
  }

  // =========================================================================
  // 3. WESTERN MARYLAND: DEEP CREEK LAKE, WISP RESORT, CUMBERLAND, SIDELING HILL, HAGERSTOWN
  // =========================================================================
  {
    // A. Deep Creek Lake & Wisp Mountain Resort (NW of US-219 / I-68 at -2545, -587)
    const wispX = -2565;
    const wispZ = -635;
    // Stratified Allegheny Green Mountain Ridge + White Ski Slope
    for (const [mx, mz, mr, mh] of [
      [-2555, -620, 48, 44],
      [-2485, -650, 46, 40],
      [-2360, -610, 48, 36],
      [-2520, -390, 56, 40],
      [-2280, -430, 50, 34],
    ]) {
      const mtn = new THREE.Mesh(new THREE.ConeGeometry(mr, mh, 7), appalachianSlopeMat);
      mtn.position.set(mx, mh * 0.45, mz);
      sceneryGroup.add(mtn);
    }
    const skiRun = new THREE.Mesh(new THREE.PlaneGeometry(24, 64), whiteTrimMat);
    skiRun.rotation.x = -Math.PI / 3.2;
    skiRun.rotation.z = 0.25;
    skiRun.position.set(wispX + 18, 16, wispZ + 18);
    sceneryGroup.add(skiRun);

    // Wisp Timber Mountain Lodge
    const lodge = new THREE.Mesh(new THREE.BoxGeometry(36, 10, 22), timberMat);
    lodge.position.set(wispX + 20, 0.35 + 5, wispZ + 44);
    lodge.castShadow = isUltra;
    sceneryGroup.add(lodge);
    const lodgeRoof = buildPitchedRoofGroup(36.6, 22.6, 5.2, timberMat, darkSlateRoofMat, 'x');
    lodgeRoof.position.set(wispX + 20, 0.35 + 10, wispZ + 44);
    sceneryGroup.add(lodgeRoof);
    const wispSign = new THREE.Mesh(
      new THREE.BoxGeometry(26, 2.8, 0.45),
      makeTextSignMat(['WISP RESORT · DEEP CREEK LAKE'], '#064e3b', '#f8fafc', '#10b981')
    );
    wispSign.position.set(wispX + 20, 12.2, wispZ + 55.3);
    sceneryGroup.add(wispSign);
    cityBuildings.push({
      minX: wispX + 2,
      maxX: wispX + 38,
      minZ: wispZ + 33,
      maxZ: wispZ + 55,
      height: 16,
      name: 'Wisp Mountain Resort Lodge',
    });

    // Deep Creek Lakeside Mountain Cabins (East shore of Deep Creek Lake along US-219)
    for (const dc of [
      { x: -2365, z: -500, rotY: Math.PI / 2, addr: '296 Marsh Hill Rd (Deep Creek)', col: 0x7c4a26, roof: 0x1c1917 },
      { x: -2365, z: -435, rotY: Math.PI / 2, addr: '204 Glendale Rd (Deep Creek)', col: 0x57534e, roof: 0x1e293b },
    ]) {
      const cabin = buildSuburbanHouseMesh(dc.x, dc.z, dc.rotY, {
        wallColor: dc.col,
        roofColor: dc.roof,
        address: dc.addr,
        tier: 'mansion',
      });
      sceneryGroup.add(cabin.group);
      suburbanHouses.push(cabin);
      cityBuildings.push(cabin.collider);
    }

    // B. Cumberland Queen City Station & Rocky Gap Ridges (-2080, -562)
    const cumbX = -2080;
    const cumbZ = -562;
    const station = new THREE.Mesh(new THREE.BoxGeometry(44, 12, 22), boxWithRoofMat(brickRedMat, flatRoofMat));
    station.position.set(cumbX, 0.35 + 6, cumbZ);
    sceneryGroup.add(station);
    const clockTower = new THREE.Mesh(new THREE.BoxGeometry(8, 22, 8), boxWithRoofMat(brickRedMat, flatRoofMat));
    clockTower.position.set(cumbX, 0.35 + 11, cumbZ + 6);
    sceneryGroup.add(clockTower);
    const towerCap = new THREE.Mesh(new THREE.ConeGeometry(5.8, 6.5, 4), copperRoofMat);
    towerCap.rotation.y = Math.PI / 4;
    towerCap.position.set(cumbX, 0.35 + 25, cumbZ + 6);
    sceneryGroup.add(towerCap);
    const cumbSign = new THREE.Mesh(
      new THREE.BoxGeometry(28, 2.8, 0.5),
      makeTextSignMat(['CUMBERLAND · QUEEN CITY STATION'], '#450a0a', '#fde68a', '#b45309')
    );
    cumbSign.position.set(cumbX, 10.5, cumbZ + 11.4);
    sceneryGroup.add(cumbSign);
    cityBuildings.push({
      minX: cumbX - 22,
      maxX: cumbX + 22,
      minZ: cumbZ - 11,
      maxZ: cumbZ + 11,
      height: 28,
      name: 'Cumberland Queen City Station',
    });

    // C. Sideling Hill Dramatic Stratified Syncline Rock Cut & Overpass (-1880, -520 on I-68)
    const shX = -1880;
    const shZ = -520;
    for (const side of [-1, 1]) {
      const cliffWall = new THREE.Mesh(new THREE.BoxGeometry(72, 34, 24), rockCliffMat);
      cliffWall.position.set(shX, 0.35 + 17, shZ + side * 34);
      sceneryGroup.add(cliffWall);
      const ridgeCap = new THREE.Mesh(new THREE.BoxGeometry(64, 10, 18), appalachianSlopeMat);
      ridgeCap.position.set(shX, 0.35 + 37, shZ + side * 36);
      sceneryGroup.add(ridgeCap);
    }
    const shBridge = new THREE.Mesh(new THREE.BoxGeometry(7.5, 1.8, 52), whiteTrimMat);
    shBridge.position.set(shX, 14.5, shZ);
    sceneryGroup.add(shBridge);
    const shSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 3.2, 34),
      makeTextSignMat(['SIDELING HILL CUT · ELEV 2,310 FT'], '#064e3b', '#f8fafc', '#e2e8f0')
    );
    shSign.rotation.y = Math.PI / 2;
    shSign.position.set(shX + 4.1, 15.8, shZ);
    sceneryGroup.add(shSign);

    // D. Hagerstown Public Square & Courthouse (North of I-70 at -1536, -498)
    const hagX = -1536;
    const hagZ = -498;
    const hagCourt = new THREE.Mesh(new THREE.BoxGeometry(34, 15, 28), boxWithRoofMat(brickRedMat, flatRoofMat));
    hagCourt.position.set(hagX, 0.35 + 7.5, hagZ);
    sceneryGroup.add(hagCourt);
    const hagRoof = buildPitchedRoofGroup(34.5, 28.5, 4.8, brickRedMat, darkSlateRoofMat, 'x');
    hagRoof.position.set(hagX, 0.35 + 15, hagZ);
    sceneryGroup.add(hagRoof);
    const hagBase = new THREE.Mesh(new THREE.BoxGeometry(7.8, 4.0, 7.8), whiteTrimMat);
    hagBase.position.set(hagX, 0.35 + 18.8, hagZ);
    sceneryGroup.add(hagBase);
    const hagCupola = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 5.8, 8), whiteTrimMat);
    hagCupola.position.set(hagX, 0.35 + 23.5, hagZ);
    sceneryGroup.add(hagCupola);
    cityBuildings.push({
      minX: hagX - 18,
      maxX: hagX + 18,
      minZ: hagZ - 15,
      maxZ: hagZ + 15,
      height: 27,
      name: 'Hagerstown Courthouse Square',
    });
  }

  // =========================================================================
  // 4. HISTORIC FREDERICK (CLUSTERED SPIRES & CARROLL CREEK), ELLICOTT CITY, COLUMBIA, OLNEY
  // =========================================================================
  {
    // A. Historic Frederick & Carroll Creek Linear Park
    const frX = MD_LANDMARKS.frederick.x;
    const frZ = MD_LANDMARKS.frederick.z;
    const canalWater = new THREE.Mesh(new THREE.PlaneGeometry(78, 12), lakeWaterMat);
    canalWater.rotation.x = -Math.PI / 2;
    canalWater.position.set(frX - 38, 0.244, frZ + 62);
    sceneryGroup.add(canalWater);

    // Arched Brick Carroll Creek Footbridge
    const creekBridge = new THREE.Mesh(new THREE.BoxGeometry(8, 1.4, 16), solidBrickMat);
    creekBridge.position.set(frX - 38, 1.4, frZ + 62);
    sceneryGroup.add(creekBridge);

    // Frederick "Clustered Spires" Churches North of Market St & I-70
    for (const [sx, sz, h, col] of [
      [frX + 36, frZ - 76, 28, 0xf8fafc],
      [frX - 2, frZ - 82, 24, 0xf1f5f9],
      [frX + 48, frZ - 34, 22, 0xe2e8f0],
    ]) {
      const church = new THREE.Mesh(new THREE.BoxGeometry(16, 11, 22), boxWithRoofMat(brickRedMat, flatRoofMat));
      church.position.set(sx, 0.35 + 5.5, sz);
      sceneryGroup.add(church);
      const cRoof = buildPitchedRoofGroup(16.4, 22.4, 3.6, brickRedMat, darkSlateRoofMat, 'z');
      cRoof.position.set(sx, 0.35 + 11, sz);
      sceneryGroup.add(cRoof);
      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(2.8, h - 11, 6),
        makeCityMat({ color: col, roughness: 0.4 })
      );
      spire.position.set(sx, 0.35 + 11 + (h - 11) * 0.5, sz - 6);
      sceneryGroup.add(spire);
      cityBuildings.push({
        minX: sx - 9,
        maxX: sx + 9,
        minZ: sz - 12,
        maxZ: sz + 12,
        height: h,
        name: 'Frederick Clustered Spires',
      });
    }

    const fredHome = buildSuburbanHouseMesh(-1136, -328, Math.PI / 2, {
      wallColor: 0x8b2e24,
      roofColor: 0x1e293b,
      address: '214 N Market St (Frederick)',
      tier: 'regular',
    });
    sceneryGroup.add(fredHome.group);
    suburbanHouses.push(fredHome);
    cityBuildings.push(fredHome.collider);
    addStreetNamePost(frX + 16, frZ - 18, 'N MARKET ST · FREDERICK', 0);

    // B. Historic Ellicott City (1830 B&O Granite Station & Main St Brick Shops near 320, -250)
    const ecX = 362;
    const ecZ = -212;
    const graniteDepot = new THREE.Mesh(new THREE.BoxGeometry(28, 9.5, 16), stoneCladMat);
    graniteDepot.position.set(ecX, 0.35 + 4.75, ecZ);
    sceneryGroup.add(graniteDepot);
    const depotRoof = buildPitchedRoofGroup(28.6, 16.6, 3.6, stoneCladMat, darkSlateRoofMat, 'x');
    depotRoof.position.set(ecX, 0.35 + 9.5, ecZ);
    sceneryGroup.add(depotRoof);
    const ecSign = new THREE.Mesh(
      new THREE.BoxGeometry(26, 2.6, 0.45),
      makeTextSignMat(['ELLICOTT CITY · 1830 B&O STATION'], '#1e293b', '#f8fafc', '#cbd5e1')
    );
    ecSign.position.set(ecX, 11.2, ecZ - 8.4);
    sceneryGroup.add(ecSign);
    cityBuildings.push({
      minX: ecX - 15,
      maxX: ecX + 15,
      minZ: ecZ - 9,
      maxZ: ecZ + 9,
      height: 14,
      name: 'Ellicott City B&O Railroad Station',
    });

    // C. Downtown Columbia (Merriweather Post Pavilion, Mall in Columbia, Town Center Homes)
    const colMallX = 212;
    const colMallZ = 136;
    const colPlaza = new THREE.Mesh(new THREE.BoxGeometry(56, 0.02, 42), stoneCladMat);
    colPlaza.position.set(colMallX, 0.232, colMallZ);
    sceneryGroup.add(colPlaza);
    const colMall = new THREE.Mesh(new THREE.BoxGeometry(44, 12, 30), boxWithRoofMat(georgianBrickMat, flatRoofMat));
    colMall.position.set(colMallX, 0.35 + 6, colMallZ);
    colMall.castShadow = isUltra;
    sceneryGroup.add(colMall);
    const colCrown = new THREE.Mesh(new THREE.BoxGeometry(45.2, 1.1, 31.2), whiteTrimMat);
    colCrown.position.set(colMallX, 0.35 + 12.4, colMallZ);
    sceneryGroup.add(colCrown);
    const colCanopy = new THREE.Mesh(new THREE.BoxGeometry(34, 0.7, 4.0), darkSlateRoofMat);
    colCanopy.position.set(colMallX, 0.35 + 4.8, colMallZ - 16.8);
    sceneryGroup.add(colCanopy);
    const colSign = new THREE.Mesh(
      new THREE.BoxGeometry(30, 2.8, 0.45),
      makeTextSignMat(['THE MALL IN COLUMBIA'], '#0f172a', '#fde68a', '#f59e0b')
    );
    colSign.position.set(colMallX, 10.5, colMallZ - 15.4);
    sceneryGroup.add(colSign);
    cityBuildings.push({
      minX: colMallX - 23,
      maxX: colMallX + 23,
      minZ: colMallZ - 16,
      maxZ: colMallZ + 16,
      height: 14,
      name: 'The Mall in Columbia',
    });

    // Merriweather Post Pavilion Shell Roof over Lake Kittamaqundi Amphitheater Lawn
    const merriX = 358;
    const merriZ = 166;
    const stageShell = new THREE.Mesh(new THREE.CylinderGeometry(16, 20, 7, 12, 1, false, 0, Math.PI), timberMat);
    stageShell.position.set(merriX, 0.35 + 3.5, merriZ);
    stageShell.rotation.y = Math.PI;
    sceneryGroup.add(stageShell);
    const merriRoof = buildPitchedRoofGroup(32, 24, 5.5, timberMat, darkSlateRoofMat, 'x');
    merriRoof.position.set(merriX, 0.35 + 7, merriZ);
    sceneryGroup.add(merriRoof);
    cityBuildings.push({
      minX: merriX - 17,
      maxX: merriX + 17,
      minZ: merriZ - 13,
      maxZ: merriZ + 13,
      height: 14,
      name: 'Merriweather Post Pavilion',
    });

    const colHome = buildSuburbanHouseMesh(228, 72, Math.PI / 2, {
      wallColor: 0xe7e5e4,
      roofColor: 0x334155,
      address: '10420 Hickory Ridge Rd (Columbia)',
      tier: 'regular',
    });
    sceneryGroup.add(colHome.group);
    suburbanHouses.push(colHome);
    cityBuildings.push(colHome.collider);

    // D. Olney Town Center & Olney Theatre Center (West of MD-108 & North of MD-97)
    const olX = 70;
    const olZ = 602;
    const olneyTheatre = new THREE.Mesh(new THREE.BoxGeometry(32, 9.5, 24), whiteTrimMat);
    olneyTheatre.position.set(olX, 0.35 + 4.75, olZ);
    sceneryGroup.add(olneyTheatre);
    const olneyRoof = buildPitchedRoofGroup(32.5, 24.5, 4.4, whiteTrimMat, darkSlateRoofMat, 'x');
    olneyRoof.position.set(olX, 0.35 + 9.5, olZ);
    sceneryGroup.add(olneyRoof);
    const olneySign = new THREE.Mesh(
      new THREE.BoxGeometry(26, 2.6, 0.45),
      makeTextSignMat(['OLNEY THEATRE CENTER · MD-108'], '#14532d', '#f8fafc', '#22c55e')
    );
    olneySign.position.set(olX, 10.5, olZ + 12.4);
    sceneryGroup.add(olneySign);
    cityBuildings.push({
      minX: olX - 17,
      maxX: olX + 17,
      minZ: olZ - 13,
      maxZ: olZ + 13,
      height: 15,
      name: 'Olney Theatre Center',
    });
  }

  // =========================================================================
  // 5. CAPITAL REGION: SHADY GROVE METRO, ROCKVILLE, BETHESDA/NIH, SILVER SPRING, UMD, NATIONAL HARBOR
  // =========================================================================
  {
    // A. Shady Grove WMATA Red Line Metro Station & Garage (North/East of MD-355)
    const sgX = -568;
    const sgZ = 1236;
    const sgGarage = new THREE.Mesh(new THREE.BoxGeometry(40, 16, 24), stoneCladMat);
    sgGarage.position.set(sgX - 30, 0.35 + 8, sgZ);
    sceneryGroup.add(sgGarage);
    // Metro Rail Concrete Canopy & Silver/Red Train Consist
    const metroPlat = new THREE.Mesh(new THREE.BoxGeometry(52, 1.4, 12), stoneCladMat);
    metroPlat.position.set(sgX + 24, 0.35 + 2.8, sgZ - 12);
    sceneryGroup.add(metroPlat);
    const metroCanopy = new THREE.Mesh(new THREE.BoxGeometry(50, 0.8, 14), whiteTrimMat);
    metroCanopy.position.set(sgX + 24, 0.35 + 8.5, sgZ - 12);
    sceneryGroup.add(metroCanopy);
    const metroTrain = new THREE.Mesh(
      new THREE.BoxGeometry(36, 3.2, 3.4),
      makeCityMat({ color: 0xcbd5e1, roughness: 0.35, metalness: 0.55 })
    );
    metroTrain.position.set(sgX + 24, 0.35 + 5.2, sgZ - 12);
    sceneryGroup.add(metroTrain);
    const sgSign = new THREE.Mesh(
      new THREE.BoxGeometry(28, 3.0, 0.45),
      makeTextSignMat(['SHADY GROVE METRO · RED LINE'], '#18181b', '#f8fafc', '#ef4444')
    );
    sgSign.position.set(sgX + 24, 10.6, sgZ - 5.2);
    sceneryGroup.add(sgSign);
    cityBuildings.push(
      {
        minX: sgX - 51,
        maxX: sgX - 9,
        minZ: sgZ - 13,
        maxZ: sgZ + 13,
        height: 17,
        name: 'Shady Grove WMATA Metro Garage',
      },
      {
        minX: sgX - 3,
        maxX: sgX + 51,
        minZ: sgZ - 20,
        maxZ: sgZ - 4,
        height: 12,
        name: 'Shady Grove WMATA Metro Station',
      }
    );

    // B. Rockville Town Square & Colonial Brick Home (East of MD-355, South of Shady Grove Rd)
    const rkX = -516;
    const rkZ = 1416;
    const rkPlaza = new THREE.Mesh(new THREE.BoxGeometry(44, 0.02, 36), stoneCladMat);
    rkPlaza.position.set(rkX, 0.232, rkZ);
    sceneryGroup.add(rkPlaza);
    const rkLib = new THREE.Mesh(new THREE.BoxGeometry(34, 13, 28), boxWithRoofMat(georgianBrickMat, flatRoofMat));
    rkLib.position.set(rkX, 0.35 + 6.5, rkZ);
    sceneryGroup.add(rkLib);
    const rkUpper = new THREE.Mesh(new THREE.BoxGeometry(26, 4.2, 18), boxWithRoofMat(glassTowerMat, flatRoofMat));
    rkUpper.position.set(rkX, 0.35 + 15.1, rkZ);
    sceneryGroup.add(rkUpper);
    const rkCanopy = new THREE.Mesh(new THREE.BoxGeometry(28, 0.7, 3.8), darkSlateRoofMat);
    rkCanopy.position.set(rkX, 0.35 + 4.6, rkZ - 15.6);
    sceneryGroup.add(rkCanopy);
    const rkSign = new THREE.Mesh(
      new THREE.BoxGeometry(26, 2.8, 0.45),
      makeTextSignMat(['ROCKVILLE TOWN SQUARE'], '#0f172a', '#fde68a', '#f59e0b')
    );
    rkSign.position.set(rkX, 11.2, rkZ - 14.3);
    sceneryGroup.add(rkSign);
    cityBuildings.push({
      minX: rkX - 18,
      maxX: rkX + 18,
      minZ: rkZ - 15,
      maxZ: rkZ + 15,
      height: 18,
      name: 'Rockville Town Square',
    });

    const rkHome = buildSuburbanHouseMesh(-620, 1384, -Math.PI / 2, {
      wallColor: 0x334155,
      roofColor: 0x0f172a,
      address: '215 W Montgomery Ave (Rockville)',
      tier: 'regular',
    });
    sceneryGroup.add(rkHome.group);
    suburbanHouses.push(rkHome);
    cityBuildings.push(rkHome.collider);

    // C. Bethesda Downtown Skyline & NIH Clinical Center (East of MD-355)
    for (const bt of [
      { x: -468, z: 1720, w: 28, d: 24, h: 48, mat: glassTowerMat, name: 'Bethesda Metro Center' },
      { x: -468, z: 1605, w: 38, d: 28, h: 24, mat: georgianBrickMat, name: 'NIH Clinical Center' },
    ]) {
      const podium = new THREE.Mesh(new THREE.BoxGeometry(bt.w + 3, 6.5, bt.d + 3), stoneCladMat);
      podium.position.set(bt.x, 0.35 + 3.25, bt.z);
      sceneryGroup.add(podium);
      const bMesh = new THREE.Mesh(new THREE.BoxGeometry(bt.w, bt.h, bt.d), boxWithRoofMat(bt.mat, flatRoofMat));
      bMesh.position.set(bt.x, 0.35 + bt.h * 0.5, bt.z);
      bMesh.castShadow = isUltra;
      sceneryGroup.add(bMesh);
      const crown = new THREE.Mesh(new THREE.BoxGeometry(bt.w * 0.72, 6.5, bt.d * 0.72), whiteTrimMat);
      crown.position.set(bt.x, 0.35 + bt.h + 3.25, bt.z);
      sceneryGroup.add(crown);
      cityBuildings.push({
        minX: bt.x - bt.w * 0.5 - 1.5,
        maxX: bt.x + bt.w * 0.5 + 1.5,
        minZ: bt.z - bt.d * 0.5 - 1.5,
        maxZ: bt.z + bt.d * 0.5 + 1.5,
        height: bt.h + 7,
        name: bt.name,
      });
    }
    const betHome = buildSuburbanHouseMesh(-555, 1735, -Math.PI / 2, {
      wallColor: 0x8b3a2b,
      roofColor: 0x1e293b,
      address: '4902 Edgemoor Ln (Bethesda)',
      tier: 'mansion',
    });
    sceneryGroup.add(betHome.group);
    suburbanHouses.push(betHome);
    cityBuildings.push(betHome.collider);

    // D. Silver Spring Downtown & Art-Deco AFI Silver Theatre (-152, 1712)
    const ssX = -152;
    const ssZ = 1712;
    const afiMat = makeCityMat({ color: 0xfef3c7, roughness: 0.55 });
    const afiBody = new THREE.Mesh(new THREE.BoxGeometry(30, 14, 24), afiMat);
    afiBody.position.set(ssX, 0.35 + 7, ssZ);
    sceneryGroup.add(afiBody);
    const afiFin = new THREE.Mesh(
      new THREE.BoxGeometry(5, 24, 4),
      makeCityMat({ color: 0xd97706, roughness: 0.35 })
    );
    afiFin.position.set(ssX - 11, 0.35 + 12, ssZ - 10);
    sceneryGroup.add(afiFin);
    const afiSign = new THREE.Mesh(
      new THREE.BoxGeometry(24, 3.0, 0.5),
      makeTextSignMat(['AFI SILVER THEATRE · SILVER SPRING'], '#450a0a', '#fde68a', '#f59e0b', '#d97706')
    );
    afiSign.position.set(ssX, 10.5, ssZ - 12.3);
    sceneryGroup.add(afiSign);
    cityBuildings.push({
      minX: ssX - 16,
      maxX: ssX + 16,
      minZ: ssZ - 13,
      maxZ: ssZ + 13,
      height: 25,
      name: 'Downtown Silver Spring & AFI Theatre',
    });

    // E. College Park · University of Maryland (McKeldin Library, Memorial Chapel, SECU Stadium at 210, 1525)
    const umdX = 210;
    const umdZ = 1525;
    const mallLawn = new THREE.Mesh(
      new THREE.BoxGeometry(72, 0.02, 42),
      makeCityMat({ color: 0x166534, roughness: 0.88 })
    );
    mallLawn.position.set(umdX, 0.232, umdZ);
    sceneryGroup.add(mallLawn);
    const mckeldin = new THREE.Mesh(new THREE.BoxGeometry(28, 16, 34), boxWithRoofMat(georgianBrickMat, flatRoofMat));
    mckeldin.position.set(umdX + 34, 0.35 + 8, umdZ);
    sceneryGroup.add(mckeldin);
    const mckRoof = buildPitchedRoofGroup(28.5, 34.5, 4.8, georgianBrickMat, darkSlateRoofMat, 'z');
    mckRoof.position.set(umdX + 34, 0.35 + 16, umdZ);
    sceneryGroup.add(mckRoof);
    for (let c = -2; c <= 2; c++) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.8, 14, 8), whiteTrimMat);
      col.position.set(umdX + 18, 0.35 + 7, umdZ + c * 5.2);
      sceneryGroup.add(col);
    }
    const umdChapel = new THREE.Mesh(new THREE.BoxGeometry(16, 12, 22), boxWithRoofMat(georgianBrickMat, flatRoofMat));
    umdChapel.position.set(umdX - 18, 0.35 + 6, umdZ - 32);
    sceneryGroup.add(umdChapel);
    const chapelRoof = buildPitchedRoofGroup(16.4, 22.4, 3.6, georgianBrickMat, darkSlateRoofMat, 'z');
    chapelRoof.position.set(umdX - 18, 0.35 + 12, umdZ - 32);
    sceneryGroup.add(chapelRoof);
    const chapelBelfry = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.8, 5.2), whiteTrimMat);
    chapelBelfry.position.set(umdX - 18, 0.35 + 15.2, umdZ - 32);
    sceneryGroup.add(chapelBelfry);
    const chapelSpire = new THREE.Mesh(new THREE.ConeGeometry(2.6, 12, 8), whiteTrimMat);
    chapelSpire.position.set(umdX - 18, 0.35 + 16.6 + 6, umdZ - 32);
    sceneryGroup.add(chapelSpire);
    const umdSign = new THREE.Mesh(
      new THREE.BoxGeometry(26, 2.8, 0.45),
      makeTextSignMat(['UNIVERSITY OF MARYLAND · COLLEGE PARK'], '#7f1d1d', '#facc15', '#fbbf24')
    );
    umdSign.position.set(umdX + 34, 13.5, umdZ - 17.3);
    sceneryGroup.add(umdSign);
    cityBuildings.push({
      minX: umdX + 19,
      maxX: umdX + 49,
      minZ: umdZ - 18,
      maxZ: umdZ + 18,
      height: 22,
      name: 'UMD McKeldin Library & Mall',
    });

    // F. National Harbor (Capital Wheel Ferris Wheel over Potomac Pier + MGM Resort)
    const nhX = -180;
    const nhZ = 2022;
    const nhPier = new THREE.Mesh(new THREE.BoxGeometry(30, 0.8, 56), timberMat);
    nhPier.position.set(nhX, 0.45, nhZ + 8);
    sceneryGroup.add(nhPier);
    // Capital Wheel (Monumental Potomac Observation Wheel)
    const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(20, 1.0, 8, 28), whiteTrimMat);
    wheelRing.position.set(nhX, 0.8 + 23, nhZ + 22);
    sceneryGroup.add(wheelRing);
    const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 3.2, 10), goldMat);
    wheelHub.rotation.x = Math.PI / 2;
    wheelHub.position.set(nhX, 0.8 + 23, nhZ + 22);
    sceneryGroup.add(wheelHub);
    for (let sp = 0; sp < 8; sp++) {
      const ang = (sp / 8) * Math.PI;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.4, 40, 0.4), whiteTrimMat);
      spoke.position.set(nhX, 0.8 + 23, nhZ + 22);
      spoke.rotation.z = ang;
      sceneryGroup.add(spoke);
    }
    for (const sx of [-10, 10]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.0, 26, 8), steelGrayMat);
      leg.position.set(nhX + sx * 0.5, 0.8 + 12, nhZ + 22);
      leg.rotation.z = sx > 0 ? 0.36 : -0.36;
      sceneryGroup.add(leg);
    }
    // MGM National Harbor Curved Ivory Resort Tower (North of Beltway at -132, 1912)
    const mgmBase = new THREE.Mesh(new THREE.BoxGeometry(50, 8, 30), stoneCladMat);
    mgmBase.position.set(-132, 0.35 + 4, 1912);
    sceneryGroup.add(mgmBase);
    const mgm = new THREE.Mesh(new THREE.BoxGeometry(40, 26, 22), boxWithRoofMat(glassTowerMat, flatRoofMat));
    mgm.position.set(-132, 0.35 + 8 + 13, 1912);
    sceneryGroup.add(mgm);
    const mgmCrown = new THREE.Mesh(new THREE.BoxGeometry(42, 2.2, 24), whiteTrimMat);
    mgmCrown.position.set(-132, 0.35 + 8 + 26 + 1.1, 1912);
    sceneryGroup.add(mgmCrown);
    const nhSign = new THREE.Mesh(
      new THREE.BoxGeometry(28, 3.0, 0.5),
      makeTextSignMat(['NATIONAL HARBOR · CAPITAL WHEEL'], '#0f172a', '#fde68a', '#f59e0b', '#d97706')
    );
    nhSign.position.set(-132, 24, 1923.3);
    sceneryGroup.add(nhSign);
    cityBuildings.push({
      minX: -157,
      maxX: -107,
      minZ: 1897,
      maxZ: 1927,
      height: 36,
      name: 'National Harbor & MGM Resort',
    });
  }

  // =========================================================================
  // 6. BWI THURGOOD MARSHALL AIRPORT & HISTORIC ANNAPOLIS (STATE HOUSE, USNA, CITY DOCK)
  // =========================================================================
  {
    // A. BWI Thurgood Marshall International Airport (1020, 392 — Terminal Arrivals Gate at z=312)
    const bwiX = 1020;
    const bwiZ = 392;
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(165, 130), streetAsphaltMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(bwiX, 0.24, bwiZ);
    sceneryGroup.add(apron);

    // Runways 10/28 and 15R/33L positioned cleanly clear of I-195 & I-97
    const rwy1 = new THREE.Mesh(new THREE.PlaneGeometry(175, 20), streetAsphaltMat);
    rwy1.rotation.x = -Math.PI / 2;
    rwy1.position.set(bwiX + 10, 0.242, bwiZ + 52);
    sceneryGroup.add(rwy1);
    const rwy2 = new THREE.Mesh(new THREE.PlaneGeometry(20, 155), streetAsphaltMat);
    rwy2.rotation.x = -Math.PI / 2;
    rwy2.rotation.z = 0.28;
    rwy2.position.set(bwiX + 74, 0.242, bwiZ + 18);
    sceneryGroup.add(rwy2);
    for (let dx = -68; dx <= 86; dx += 18) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.9), whiteLineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(bwiX + dx, 0.25, bwiZ + 52);
      sceneryGroup.add(dash);
    }

    // Main Y-Concourse Glass Terminal & Air Traffic Control Tower
    const term = new THREE.Mesh(new THREE.BoxGeometry(74, 12, 28), boxWithRoofMat(glassTowerMat, flatRoofMat));
    term.position.set(bwiX, 0.35 + 6, bwiZ - 26);
    sceneryGroup.add(term);
    const termRoof = new THREE.Mesh(new THREE.BoxGeometry(77, 1.4, 31), whiteTrimMat);
    termRoof.position.set(bwiX, 0.35 + 12.6, bwiZ - 26);
    sceneryGroup.add(termRoof);
    const termWingL = new THREE.Mesh(new THREE.BoxGeometry(16, 9.5, 22), stoneCladMat);
    termWingL.position.set(bwiX - 24, 0.35 + 4.75, bwiZ - 4);
    sceneryGroup.add(termWingL);
    const termWingR = new THREE.Mesh(new THREE.BoxGeometry(16, 9.5, 22), stoneCladMat);
    termWingR.position.set(bwiX + 24, 0.35 + 4.75, bwiZ - 4);
    sceneryGroup.add(termWingR);
    const atcShaft = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.4, 34, 8), stoneCladMat);
    atcShaft.position.set(bwiX - 52, 0.35 + 17, bwiZ - 26);
    sceneryGroup.add(atcShaft);
    const atcCab = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 4.8, 5.5, 8), [glassTowerMat, flatRoofMat, stoneCladMat]);
    atcCab.position.set(bwiX - 52, 0.35 + 36, bwiZ - 26);
    sceneryGroup.add(atcCab);
    const bwiSign = new THREE.Mesh(
      new THREE.BoxGeometry(36, 3.2, 0.5),
      makeTextSignMat(['BWI THURGOOD MARSHALL AIRPORT'], '#082f49', '#f8fafc', '#38bdf8')
    );
    bwiSign.position.set(bwiX, 11, bwiZ - 40.3);
    sceneryGroup.add(bwiSign);

    // Parked Southwest-style Airliner on Gate Concourse
    const planeFuselage = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.1, 26, 10),
      makeCityMat({ color: 0x1d4ed8, roughness: 0.35, metalness: 0.45 })
    );
    planeFuselage.rotation.z = Math.PI / 2;
    planeFuselage.position.set(bwiX + 12, 3.2, bwiZ + 12);
    sceneryGroup.add(planeFuselage);
    const planeWings = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.4, 24), whiteTrimMat);
    planeWings.position.set(bwiX + 12, 2.8, bwiZ + 12);
    sceneryGroup.add(planeWings);
    cityBuildings.push({
      minX: bwiX - 38,
      maxX: bwiX + 38,
      minZ: bwiZ - 41,
      maxZ: bwiZ - 11,
      height: 38,
      name: 'BWI Thurgood Marshall Terminal & ATC',
    });

    // B. Annapolis: Maryland State House, US Naval Academy & City Dock (Ego Alley)
    const annX = 1408;
    const annZ = 660;
    // Maryland State House (1772 Georgian Brick + Iconic Tall White Wooden Dome + Acorn Spire)
    const shBody = new THREE.Mesh(new THREE.BoxGeometry(34, 13, 24), boxWithRoofMat(georgianBrickMat, flatRoofMat));
    shBody.position.set(annX, 0.35 + 6.5, annZ);
    shBody.castShadow = isUltra;
    sceneryGroup.add(shBody);
    const shRoof = buildPitchedRoofGroup(34.5, 24.5, 4.2, georgianBrickMat, darkSlateRoofMat, 'x');
    shRoof.position.set(annX, 0.35 + 13, annZ);
    sceneryGroup.add(shRoof);
    const shBase = new THREE.Mesh(new THREE.BoxGeometry(14.5, 3.5, 14.5), whiteTrimMat);
    shBase.position.set(annX, 0.35 + 16.5, annZ);
    sceneryGroup.add(shBase);
    const shDrum = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.8, 6.0, 8), whiteTrimMat);
    shDrum.position.set(annX, 0.35 + 20.5, annZ);
    sceneryGroup.add(shDrum);
    const shDome = new THREE.Mesh(
      new THREE.SphereGeometry(6.4, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      whiteTrimMat
    );
    shDome.position.set(annX, 0.35 + 23.5, annZ);
    sceneryGroup.add(shDome);
    const shCupola = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 5.5, 8), whiteTrimMat);
    shCupola.position.set(annX, 0.35 + 30.5, annZ);
    sceneryGroup.add(shCupola);
    const shRod = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 4.5, 6), goldMat);
    shRod.position.set(annX, 0.35 + 35.5, annZ);
    sceneryGroup.add(shRod);
    const annSign = new THREE.Mesh(
      new THREE.BoxGeometry(26, 2.8, 0.45),
      makeTextSignMat(['MARYLAND STATE HOUSE · ANNAPOLIS'], '#7f1d1d', '#fef3c7', '#fbbf24')
    );
    annSign.position.set(annX, 11.2, annZ + 12.3);
    sceneryGroup.add(annSign);
    cityBuildings.push({
      minX: annX - 18,
      maxX: annX + 18,
      minZ: annZ - 13,
      maxZ: annZ + 13,
      height: 36,
      name: 'Maryland State House (Annapolis)',
    });

    // US Naval Academy (Bancroft Hall Beaux-Arts Limestone & Green Copper Chapel Dome East of gate 1474,684)
    const usnaX = 1524;
    const usnaZ = 656;
    const bancroft = new THREE.Mesh(new THREE.BoxGeometry(44, 14, 24), stoneCladMat);
    bancroft.position.set(usnaX, 0.35 + 7, usnaZ);
    sceneryGroup.add(bancroft);
    const usnaChapel = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 18), stoneCladMat);
    usnaChapel.position.set(usnaX - 10, 0.35 + 6, usnaZ + 32);
    sceneryGroup.add(usnaChapel);
    const usnaDome = new THREE.Mesh(
      new THREE.SphereGeometry(7.2, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
      copperRoofMat
    );
    usnaDome.position.set(usnaX - 10, 0.35 + 12, usnaZ + 32);
    sceneryGroup.add(usnaDome);
    cityBuildings.push({
      minX: usnaX - 23,
      maxX: usnaX + 23,
      minZ: usnaZ - 13,
      maxZ: usnaZ + 42,
      height: 22,
      name: 'U.S. Naval Academy (Bancroft Hall & Chapel)',
    });

    // Annapolis City Dock / Ego Alley & Sailboat Marina (1492, 748)
    const dockWater = new THREE.Mesh(new THREE.PlaneGeometry(40, 18), bayWaterMat);
    dockWater.rotation.x = -Math.PI / 2;
    dockWater.position.set(1492, 0.238, 748);
    sceneryGroup.add(dockWater);
    for (const bx of [1482, 1500]) {
      const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 9.5), whiteTrimMat);
      hull.position.set(bx, 0.9, 748);
      sceneryGroup.add(hull);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 9.5, 6), whiteTrimMat);
      mast.position.set(bx, 5.8, 748);
      sceneryGroup.add(mast);
    }

    const annHome = buildSuburbanHouseMesh(1410, 745, 0, {
      wallColor: 0x8b2e24,
      roofColor: 0x1e293b,
      address: '148 Prince George St (Annapolis)',
      tier: 'mansion',
    });
    sceneryGroup.add(annHome.group);
    suburbanHouses.push(annHome);
    cityBuildings.push(annHome.collider);
  }

  // =========================================================================
  // 7. EASTERN SHORE (EASTON & SALISBURY) & OCEAN CITY BOARDWALK + FERRIS WHEEL
  // =========================================================================
  {
    // A. Easton Talbot County Brick Courthouse (West of US-50 at 2212, 920)
    const eaX = 2212;
    const eaZ = 920;
    const eaBody = new THREE.Mesh(new THREE.BoxGeometry(28, 13, 22), boxWithRoofMat(georgianBrickMat, flatRoofMat));
    eaBody.position.set(eaX, 0.35 + 6.5, eaZ);
    sceneryGroup.add(eaBody);
    const eaRoof = buildPitchedRoofGroup(28.5, 22.5, 4.2, georgianBrickMat, darkSlateRoofMat, 'x');
    eaRoof.position.set(eaX, 0.35 + 13, eaZ);
    sceneryGroup.add(eaRoof);
    const eaPed = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.8, 6.4), whiteTrimMat);
    eaPed.position.set(eaX, 0.35 + 16.2, eaZ);
    sceneryGroup.add(eaPed);
    const eaCupola = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 5.5, 8), whiteTrimMat);
    eaCupola.position.set(eaX, 0.35 + 19.8, eaZ);
    sceneryGroup.add(eaCupola);
    cityBuildings.push({
      minX: eaX - 15,
      maxX: eaX + 15,
      minZ: eaZ - 12,
      maxZ: eaZ + 12,
      height: 24,
      name: 'Easton Historic Courthouse (Eastern Shore)',
    });

    // B. Ocean City Timber Boardwalk, Trimper's Pier Ferris Wheel & Pastel Coastal Resorts
    const ocX = 2528;
    const boardwalk = new THREE.Mesh(new THREE.BoxGeometry(10, 0.55, 360), timberMat);
    boardwalk.position.set(ocX, 0.28, 1150);
    sceneryGroup.add(boardwalk);

    // Ocean City Pier extending into Atlantic Ocean + Jolly Roger Ferris Wheel (2548, 1265)
    const ocPier = new THREE.Mesh(new THREE.BoxGeometry(36, 0.65, 22), timberMat);
    ocPier.position.set(ocX + 20, 0.32, 1265);
    sceneryGroup.add(ocPier);
    const ocWheel = new THREE.Mesh(
      new THREE.TorusGeometry(15, 0.9, 8, 22),
      makeCityMat({ color: 0xf43f5e, roughness: 0.35 })
    );
    ocWheel.rotation.y = Math.PI / 2;
    ocWheel.position.set(ocX + 22, 0.65 + 17.5, 1265);
    sceneryGroup.add(ocWheel);
    for (const sp of [0, 1, 2, 3]) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.35, 30, 0.35), whiteTrimMat);
      spoke.rotation.x = (sp / 4) * Math.PI;
      spoke.position.set(ocX + 22, 0.65 + 17.5, 1265);
      sceneryGroup.add(spoke);
    }

    // Pastel High-Rise Oceanfront Condos & Boardwalk Hotels (East of Coastal Hwy X=2502)
    const ocPalettes = [0xfef3c7, 0xe0f2fe, 0xfce7f3, 0xd1fae5];
    const ocTowerZs = [955, 1030, 1105, 1235];
    for (let i = 0; i < ocTowerZs.length; i++) {
      const hz = ocTowerZs[i];
      const th = 28 + (i % 2) * 10;
      const hMat = makeCityMat({ color: ocPalettes[i], roughness: 0.45 });
      const podium = new THREE.Mesh(new THREE.BoxGeometry(14, 4.8, 26), whiteTrimMat);
      podium.position.set(2516, 0.35 + 2.4, hz);
      sceneryGroup.add(podium);
      const tower = new THREE.Mesh(new THREE.BoxGeometry(12.5, th, 23), hMat);
      tower.position.set(2516, 0.35 + th * 0.5, hz);
      sceneryGroup.add(tower);
      const roofCap = new THREE.Mesh(new THREE.BoxGeometry(13.6, 1.4, 24.2), darkSlateRoofMat);
      roofCap.position.set(2516, 0.35 + th + 0.7, hz);
      sceneryGroup.add(roofCap);
      cityBuildings.push({
        minX: 2508,
        maxX: 2524,
        minZ: hz - 13,
        maxZ: hz + 13,
        height: 41,
        name: 'Ocean City Oceanfront Resort',
      });
    }
    const ocSign = new THREE.Mesh(
      new THREE.BoxGeometry(28, 3.0, 0.5),
      makeTextSignMat(['OCEAN CITY · ATLANTIC BOARDWALK'], '#082f49', '#fef08a', '#38bdf8', '#0284c7')
    );
    ocSign.position.set(2512, 14, 1218);
    ocSign.rotation.y = -Math.PI / 2;
    sceneryGroup.add(ocSign);

    const ocHome = buildSuburbanHouseMesh(2452, 1060, Math.PI / 2, {
      wallColor: 0xbae6fd,
      roofColor: 0x334155,
      address: '1404 Coastal Hwy (Ocean City)',
      tier: 'mansion',
    });
    sceneryGroup.add(ocHome.group);
    suburbanHouses.push(ocHome);
    cityBuildings.push(ocHome.collider);

    // Expanded Town Neighborhoods Across Statewide Maryland (Deep Creek, Cumberland, Hagerstown,
    // Frederick, Columbia, Olney, Rockville, Bethesda, Silver Spring, College Park, Annapolis, Ocean City)
    const stateClusters: {
      city: string;
      street: string;
      baseNum: number;
      houses: { x: number; z: number; rotY: number }[];
    }[] = [
      {
        city: 'Deep Creek Lake',
        street: 'Glendale Rd',
        baseNum: 100,
        houses: [
          { x: -2305, z: -470, rotY: -Math.PI / 2 },
          { x: -2305, z: -446, rotY: -Math.PI / 2 },
          { x: -2305, z: -422, rotY: -Math.PI / 2 },
          { x: -2305, z: -398, rotY: -Math.PI / 2 },
          { x: -2305, z: -374, rotY: -Math.PI / 2 },
          { x: -2305, z: -350, rotY: -Math.PI / 2 },
          { x: -2365, z: -315, rotY: Math.PI },
          { x: -2345, z: -315, rotY: Math.PI },
          { x: -2325, z: -315, rotY: Math.PI },
          { x: -2305, z: -315, rotY: Math.PI },
        ],
      },
      {
        city: 'Cumberland',
        street: 'Greene St',
        baseNum: 300,
        houses: Array.from({ length: 8 }, (_, k) => ({ x: -2140 + k * 18, z: -480, rotY: Math.PI })).concat([
          { x: -2120, z: -446, rotY: 0 },
          { x: -2102, z: -446, rotY: 0 },
        ]),
      },
      {
        city: 'Hagerstown',
        street: 'Oak Hill Ave',
        baseNum: 800,
        houses: Array.from({ length: 8 }, (_, k) => ({ x: -1575 + k * 17, z: -556, rotY: Math.PI })).concat([
          { x: -1558, z: -586, rotY: 0 },
          { x: -1540, z: -586, rotY: 0 },
        ]),
      },
      {
        city: 'Frederick',
        street: 'N Bentz St',
        baseNum: 400,
        houses: [
          { x: -1208, z: -440, rotY: Math.PI / 2 },
          { x: -1208, z: -418, rotY: Math.PI / 2 },
          { x: -1208, z: -396, rotY: Math.PI / 2 },
          { x: -1208, z: -374, rotY: Math.PI / 2 },
          { x: -1208, z: -352, rotY: Math.PI / 2 },
          { x: -1208, z: -330, rotY: Math.PI / 2 },
          { x: -1020, z: -312, rotY: 0 },
          { x: -1002, z: -312, rotY: 0 },
          { x: -984, z: -312, rotY: 0 },
          { x: -966, z: -312, rotY: 0 },
        ],
      },
      {
        city: 'Columbia',
        street: 'Hickory Ridge Rd',
        baseNum: 10430,
        houses: [
          { x: 404, z: 64, rotY: Math.PI / 2 },
          { x: 404, z: 88, rotY: Math.PI / 2 },
          { x: 404, z: 112, rotY: Math.PI / 2 },
          { x: 404, z: 136, rotY: Math.PI / 2 },
          { x: 404, z: 160, rotY: Math.PI / 2 },
          { x: 404, z: 184, rotY: Math.PI / 2 },
          { x: 434, z: 64, rotY: -Math.PI / 2 },
          { x: 434, z: 88, rotY: -Math.PI / 2 },
          { x: 434, z: 112, rotY: -Math.PI / 2 },
          { x: 434, z: 136, rotY: -Math.PI / 2 },
        ],
      },
      {
        city: 'Olney',
        street: 'Prince Philip Dr',
        baseNum: 18100,
        houses: [
          { x: 218, z: 648, rotY: 0 },
          { x: 236, z: 648, rotY: 0 },
          { x: 254, z: 648, rotY: 0 },
          { x: 272, z: 648, rotY: 0 },
          { x: 290, z: 648, rotY: 0 },
          { x: 218, z: 684, rotY: Math.PI },
          { x: 236, z: 684, rotY: Math.PI },
          { x: 254, z: 684, rotY: Math.PI },
          { x: 272, z: 684, rotY: Math.PI },
          { x: 290, z: 684, rotY: Math.PI },
        ],
      },
      {
        city: 'Rockville',
        street: 'N Adams St',
        baseNum: 100,
        houses: [
          { x: -454, z: 1390, rotY: 0 },
          { x: -436, z: 1390, rotY: 0 },
          { x: -418, z: 1390, rotY: 0 },
          { x: -400, z: 1390, rotY: 0 },
          { x: -382, z: 1390, rotY: 0 },
          { x: -454, z: 1445, rotY: Math.PI },
          { x: -436, z: 1445, rotY: Math.PI },
          { x: -418, z: 1445, rotY: Math.PI },
          { x: -400, z: 1445, rotY: Math.PI },
          { x: -382, z: 1445, rotY: Math.PI },
        ],
      },
      {
        city: 'Bethesda',
        street: 'Cordell Ave',
        baseNum: 4800,
        houses: [
          { x: -412, z: 1724, rotY: 0 },
          { x: -394, z: 1724, rotY: 0 },
          { x: -376, z: 1724, rotY: 0 },
          { x: -358, z: 1724, rotY: 0 },
          { x: -340, z: 1724, rotY: 0 },
          { x: -412, z: 1770, rotY: Math.PI },
          { x: -394, z: 1770, rotY: Math.PI },
          { x: -376, z: 1770, rotY: Math.PI },
          { x: -358, z: 1770, rotY: Math.PI },
          { x: -340, z: 1770, rotY: Math.PI },
        ],
      },
      {
        city: 'Silver Spring',
        street: 'Ellsworth Dr',
        baseNum: 850,
        houses: [
          { x: -98, z: 1720, rotY: 0 },
          { x: -80, z: 1720, rotY: 0 },
          { x: -62, z: 1720, rotY: 0 },
          { x: -44, z: 1720, rotY: 0 },
          { x: -26, z: 1720, rotY: 0 },
          { x: -98, z: 1766, rotY: Math.PI },
          { x: -80, z: 1766, rotY: Math.PI },
          { x: -62, z: 1766, rotY: Math.PI },
          { x: -44, z: 1766, rotY: Math.PI },
          { x: -26, z: 1766, rotY: Math.PI },
        ],
      },
      {
        city: 'College Park',
        street: 'Knox Rd',
        baseNum: 4400,
        houses: [
          { x: 224, z: 1435, rotY: 0 },
          { x: 242, z: 1435, rotY: 0 },
          { x: 260, z: 1435, rotY: 0 },
          { x: 278, z: 1435, rotY: 0 },
          { x: 296, z: 1435, rotY: 0 },
          { x: 224, z: 1472, rotY: Math.PI },
          { x: 242, z: 1472, rotY: Math.PI },
          { x: 260, z: 1472, rotY: Math.PI },
          { x: 278, z: 1472, rotY: Math.PI },
          { x: 296, z: 1472, rotY: Math.PI },
        ],
      },
      {
        city: 'Annapolis',
        street: 'Duke of Gloucester St',
        baseNum: 110,
        houses: [
          { x: 1356, z: 786, rotY: 0 },
          { x: 1374, z: 786, rotY: 0 },
          { x: 1392, z: 786, rotY: 0 },
          { x: 1410, z: 786, rotY: 0 },
          { x: 1428, z: 786, rotY: 0 },
          { x: 1356, z: 818, rotY: Math.PI },
          { x: 1374, z: 818, rotY: Math.PI },
          { x: 1392, z: 818, rotY: Math.PI },
          { x: 1410, z: 818, rotY: Math.PI },
          { x: 1428, z: 818, rotY: Math.PI },
        ],
      },
      {
        city: 'Ocean City',
        street: 'Baltimore Ave',
        baseNum: 200,
        houses: [
          { x: 2452, z: 940, rotY: Math.PI / 2 },
          { x: 2452, z: 964, rotY: Math.PI / 2 },
          { x: 2452, z: 988, rotY: Math.PI / 2 },
          { x: 2452, z: 1012, rotY: Math.PI / 2 },
          { x: 2452, z: 1094, rotY: Math.PI / 2 },
          { x: 2452, z: 1118, rotY: Math.PI / 2 },
          { x: 2426, z: 940, rotY: -Math.PI / 2 },
          { x: 2426, z: 964, rotY: -Math.PI / 2 },
          { x: 2426, z: 988, rotY: -Math.PI / 2 },
          { x: 2426, z: 1012, rotY: -Math.PI / 2 },
        ],
      },
    ];
    let stCounter = 0;
    for (const cluster of stateClusters) {
      cluster.houses.forEach((h, i) => {
        suburbanBatch.addHouse(
          {
            x: h.x,
            z: h.z,
            rotY: h.rotY,
            houseNum: String(cluster.baseNum + i * 2),
            street: cluster.street,
            cityTag: cluster.city,
            style: stCounter % 2 === 0 ? 'colonial' : 'split',
            sidingHex: ['#e7dec8', '#cbd5e1', '#bae6fd', '#f1f5f9', '#d6ccb8'][stCounter % 5],
            roofColor: [0x1e293b, 0x292524, 0x3b2f2f][stCounter % 3],
            shutterColor: [0x14532d, 0x1e3a8a, 0x7f1d1d][stCounter % 3],
            doorColor: [0x7f1d1d, 0x1e3a8a, 0x14532d][stCounter % 3],
            brickFront: stCounter % 2 === 0,
          },
          suburbanHouses,
          cityBuildings
        );
        stCounter++;
      });
    }

    void drawParkingLotBay;
    void addStreetNamePost;
    void addLandscapedTree;
  }

  // =========================================================================
  // 8. STATEWIDE INSTANCED BRANCHED WOODLAND BELTS & 3D MEADOW GRASS TUFTS
  // =========================================================================
  {
    const treePlacements: WoodlandTreePlacement[] = [];
    const grassPatches: GrassPatchPlacement[] = [];

    const isInvalidStateSpot = (tx: number, tz: number, roadPad: number, bldgPad: number) => {
      if (tx > 1520 && tx < 2030) return true; // Chesapeake Bay
      if (tx > 2500) return true; // Ocean
      if (tx < -2320 && tx > -2505 && tz > -580 && tz < -340) return true; // Deep Creek
      if (tz > 1880 && tx < -20 && tx > -960) return true; // Potomac
      if (tx > 1060 && tx < 1600 && tz > -520 && tz < 110) return true; // Urban Baltimore core
      if (tx > 910 && tx < 1210 && tz > 280 && tz < 490) return true; // BWI runways
      if (tx > -1200 && tx < -10 && tz > 160 && tz < 1260) return true; // Gaithersburg handles its own dense trees

      const clrSq = roadPad * roadPad;
      for (let rIdx = 0; rIdx < ALL_MARYLAND_ROADS.length; rIdx++) {
        const road = ALL_MARYLAND_ROADS[rIdx];
        for (let k = 0; k < road.points.length - 1; k++) {
          const a = road.points[k];
          const b = road.points[k + 1];
          if (distSqPointToSeg(tx, tz, a.x, a.z, b.x, b.z) < clrSq) return true;
        }
      }
      for (let b = 0; b < cityBuildings.length; b++) {
        const box = cityBuildings[b];
        if (tx >= box.minX - bldgPad && tx <= box.maxX + bldgPad && tz >= box.minZ - bldgPad && tz <= box.maxZ + bldgPad) {
          return true;
        }
      }
      return false;
    };

    const seeds = 440;
    for (let i = 0; i < seeds; i++) {
      const rx = Math.sin(i * 12.9898 + 1.3) * 43758.5453;
      const rz = Math.sin(i * 78.233 + 4.7) * 29431.1237;
      const ux = rx - Math.floor(rx);
      const uz = rz - Math.floor(rz);
      const tx = -2550 + ux * 4950;
      const tz = -880 + uz * 2820;

      if (isInvalidStateSpot(tx, tz, 34, 10)) continue;
      // Western Maryland mountains get more Eastern Pines; Piedmont/Shore get mixed Oaks & Pines
      const isAppalachian = tx < -950;
      treePlacements.push({
        x: tx,
        z: tz,
        s: 0.9 + (i % 5) * 0.16,
        species: isAppalachian ? (i % 3 === 0 ? 'oak' : 'pine') : i % 4 === 0 ? 'pine' : 'oak',
      });
    }

    populateInstancedWoodlandTrees(sceneryGroup, treePlacements, { isUltra, isRetroPixel }, disposables);

    for (let i = 0; i < 650; i++) {
      const rx = Math.sin(i * 41.31 + 2.9) * 19384.217;
      const rz = Math.sin(i * 93.17 + 7.1) * 35712.883;
      const ux = rx - Math.floor(rx);
      const uz = rz - Math.floor(rz);
      const tx = -2500 + ux * 4850;
      const tz = -860 + uz * 2760;
      if (isInvalidStateSpot(tx, tz, 22, 4)) continue;
      grassPatches.push({
        x: tx,
        z: tz,
        s: 1.0 + (i % 4) * 0.18,
        kind: i % 8 === 0 ? 'shrub' : 'grass',
      });
    }
    populateChunkedGrassAndShrubs(sceneryGroup, grassPatches, { isUltra, isRetroPixel }, disposables);
  }
}
