import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BuiltSuburbanHouse, CityBuildingBox } from './cityTrafficBuilder';
import {
  getConcretePBRTextures,
  getLawnPBRTextures,
  getLeafClusterTexture,
  getRoofShinglePBRTextures,
  getSuburbanSidingNormalTexture,
} from './pbrTextures';

export interface BatchedHouseSpec {
  x: number;
  z: number;
  rotY: number;
  houseNum: string;
  street: string;
  cityTag?: string;
  style: 'colonial' | 'split';
  sidingHex: string;
  roofColor: number;
  shutterColor: number;
  doorColor: number;
  brickFront?: boolean;
}

interface PlacedHouseRecord extends BatchedHouseSpec {
  fullAddress: string;
}

function makeSuburbanSidingCanvasTexture(isRetroPixel: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    for (let y = 0; y < 64; y += 8) ctx.fillRect(0, y, 64, 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    for (let y = 2; y < 64; y += 8) ctx.fillRect(0, y, 64, 1);
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
  return tex;
}

function ensureNonIndexedUV(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const nonIdx = g.index ? g.toNonIndexed() : g;
  if (!nonIdx.getAttribute('normal')) nonIdx.computeVertexNormals();
  if (!nonIdx.getAttribute('uv')) {
    const count = nonIdx.getAttribute('position').count;
    nonIdx.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  return nonIdx;
}

function createNormalizedBox(w: number, h: number, d: number, tx = 0, ty = 0, tz = 0, rx = 0, rz = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx !== 0) g.rotateX(rx);
  if (rz !== 0) g.rotateZ(rz);
  if (tx !== 0 || ty !== 0 || tz !== 0) g.translate(tx, ty, tz);
  return ensureNonIndexedUV(g);
}

function createPitchedRoofBuffer(
  width: number,
  depth: number,
  ridgeHeight: number,
  alongAxis: 'x' | 'z',
  cx: number,
  cy: number,
  cz: number
): { gables: THREE.BufferGeometry; slopes: THREE.BufferGeometry } {
  let gables: THREE.BufferGeometry;
  const slopeParts: THREE.BufferGeometry[] = [];

  if (alongAxis === 'x') {
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-depth * 0.5, 0);
    gableShape.lineTo(depth * 0.5, 0);
    gableShape.lineTo(0, ridgeHeight);
    gableShape.closePath();
    const gRaw = new THREE.ExtrudeGeometry(gableShape, { depth: width, bevelEnabled: false });
    gRaw.rotateY(Math.PI / 2);
    gRaw.translate(-width * 0.5 + cx, cy, cz);
    gables = ensureNonIndexedUV(gRaw);

    const slopeLen = Math.hypot(depth * 0.55, ridgeHeight);
    const slopeAng = Math.atan2(ridgeHeight, depth * 0.5);
    for (const s of [-1, 1]) {
      const sp = createNormalizedBox(width + 0.78, 0.24, slopeLen, cx, cy + ridgeHeight * 0.5, cz + s * depth * 0.27, s * slopeAng, 0);
      slopeParts.push(sp);
    }
  } else {
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-width * 0.5, 0);
    gableShape.lineTo(width * 0.5, 0);
    gableShape.lineTo(0, ridgeHeight);
    gableShape.closePath();
    const gRaw = new THREE.ExtrudeGeometry(gableShape, { depth, bevelEnabled: false });
    gRaw.translate(cx, cy, -depth * 0.5 + cz);
    gables = ensureNonIndexedUV(gRaw);

    const slopeLen = Math.hypot(width * 0.55, ridgeHeight);
    const slopeAng = Math.atan2(ridgeHeight, width * 0.5);
    for (const s of [-1, 1]) {
      const sp = createNormalizedBox(slopeLen, 0.24, depth + 0.78, cx + s * width * 0.27, cy + ridgeHeight * 0.5, cz, 0, -s * slopeAng);
      slopeParts.push(sp);
    }
  }

  gables.computeVertexNormals();
  const mergedSlopes = mergeGeometries(slopeParts, false);
  slopeParts.forEach((p) => p.dispose());
  return { gables, slopes: mergedSlopes };
}

function buildArchetypeGeometries(isSplit: boolean): {
  sidingGeo: THREE.BufferGeometry;
  roofGeo: THREE.BufferGeometry;
  trimGeo: THREE.BufferGeometry;
  glassGeo: THREE.BufferGeometry;
  shutterGeo: THREE.BufferGeometry;
  doorGeo: THREE.BufferGeometry;
  concreteGeo: THREE.BufferGeometry;
  chimneyGeo: THREE.BufferGeometry;
  hedgeGeo: THREE.BufferGeometry;
} {
  const bodyW = 6.8;
  const bodyH = isSplit ? 4.25 : 5.4;
  const bodyD = 6.4;
  const bodyX = -2.0;
  const bodyZ = -1.6;
  const frontZ = bodyZ + bodyD * 0.5;

  const garW = 4.4;
  const garH = 3.25;
  const garD = 5.6;
  const garX = 3.3;
  const garZ = -1.1;
  const garFrontZ = garZ + garD * 0.5;

  const mainBody = createNormalizedBox(bodyW, bodyH, bodyD, bodyX, bodyH * 0.5 + 0.16, bodyZ);
  const garBody = createNormalizedBox(garW, garH, garD, garX, garH * 0.5 + 0.16, garZ);

  const mainRoof = createPitchedRoofBuffer(bodyW + 0.22, bodyD + 0.22, 2.25, 'x', bodyX, bodyH + 0.16, bodyZ);
  const garRoof = createPitchedRoofBuffer(garW + 0.22, garD + 0.22, 1.68, 'z', garX, garH + 0.16, garZ);

  // Gabled front portico pediment over entrance
  const porchPediment = createPitchedRoofBuffer(2.9, 1.7, 0.78, 'z', bodyX, 2.95, frontZ + 0.78);

  const sidingParts: THREE.BufferGeometry[] = [
    mainBody,
    garBody,
    mainRoof.gables,
    garRoof.gables,
    porchPediment.gables,
  ];
  const roofParts: THREE.BufferGeometry[] = [mainRoof.slopes, garRoof.slopes, porchPediment.slopes];

  const trimParts: THREE.BufferGeometry[] = [
    // White garage door outer frame + crisp 3-panel relief rails
    createNormalizedBox(3.88, 2.38, 0.14, garX, 1.28, garFrontZ + 0.04),
    createNormalizedBox(3.72, 0.06, 0.18, garX, 0.78, garFrontZ + 0.05),
    createNormalizedBox(3.72, 0.06, 0.18, garX, 1.38, garFrontZ + 0.05),
    createNormalizedBox(3.72, 0.08, 0.18, garX, 1.94, garFrontZ + 0.05),
    // Front entry portico columns + horizontal frieze board & porch fascia
    createNormalizedBox(0.18, 2.65, 0.18, bodyX - 1.18, 1.52, frontZ + 1.38),
    createNormalizedBox(0.18, 2.65, 0.18, bodyX + 1.18, 1.52, frontZ + 1.38),
    createNormalizedBox(2.95, 0.16, 1.75, bodyX, 2.92, frontZ + 0.78),
    // Roof eave fascia boards (crisp Maryland colonial trim edge)
    createNormalizedBox(bodyW + 0.78, 0.14, 0.1, bodyX, bodyH + 0.14, frontZ + 0.24),
    createNormalizedBox(garW + 0.78, 0.14, 0.1, garX, garH + 0.14, garFrontZ + 0.22),
    // Corner trim boards
    createNormalizedBox(0.14, bodyH, 0.14, bodyX - bodyW * 0.5 + 0.02, bodyH * 0.5 + 0.16, frontZ + 0.01),
    createNormalizedBox(0.14, bodyH, 0.14, bodyX + bodyW * 0.5 - 0.02, bodyH * 0.5 + 0.16, frontZ + 0.01),
    // Sign post
    createNormalizedBox(0.08, 1.05, 0.08, 0.45, 0.52, 7.35),
  ];

  const glassParts: THREE.BufferGeometry[] = [
    createNormalizedBox(3.45, 0.34, 0.16, garX, 2.15, garFrontZ + 0.06), // garage top carriage lites
  ];
  const shutterParts: THREE.BufferGeometry[] = [];

  // Colonial homes get 2 authentic roof dormers on front slope!
  if (!isSplit) {
    for (const dx of [bodyX - 1.9, bodyX + 1.9]) {
      const dormerBox = createNormalizedBox(1.25, 1.05, 1.35, dx, bodyH + 0.78, frontZ - 0.92);
      const dormerRoof = createPitchedRoofBuffer(1.38, 1.48, 0.52, 'z', dx, bodyH + 1.3, frontZ - 0.92);
      sidingParts.push(dormerBox, dormerRoof.gables);
      roofParts.push(dormerRoof.slopes);
      trimParts.push(createNormalizedBox(0.95, 0.85, 0.08, dx, bodyH + 0.82, frontZ - 0.24));
      glassParts.push(createNormalizedBox(0.75, 0.68, 0.11, dx, bodyH + 0.82, frontZ - 0.22));
      dormerRoof.gables.dispose();
      dormerRoof.slopes.dispose();
    }
  }

  const winPositions: [number, number][] = isSplit
    ? [
        [bodyX - 2.0, 2.65],
        [bodyX + 2.0, 2.65],
      ]
    : [
        [bodyX - 2.05, 1.62],
        [bodyX + 2.05, 1.62],
        [bodyX - 2.05, 4.08],
        [bodyX, 4.08],
        [bodyX + 2.05, 4.08],
      ];

  for (const [wx, wy] of winPositions) {
    // Frame + protruding sill + header lintel
    trimParts.push(createNormalizedBox(1.16, 1.34, 0.09, wx, wy + 0.05, frontZ + 0.03));
    trimParts.push(createNormalizedBox(1.28, 0.1, 0.16, wx, wy - 0.65, frontZ + 0.06)); // window sill
    trimParts.push(createNormalizedBox(1.24, 0.12, 0.14, wx, wy + 0.74, frontZ + 0.05)); // header lintel
    // Divided 6-over-6 muntin crossbars
    trimParts.push(createNormalizedBox(0.94, 0.05, 0.14, wx, wy + 0.05, frontZ + 0.06));
    trimParts.push(createNormalizedBox(0.05, 1.08, 0.14, wx, wy + 0.05, frontZ + 0.06));

    glassParts.push(createNormalizedBox(0.92, 1.08, 0.12, wx, wy + 0.05, frontZ + 0.045));
    for (const sSide of [-1, 1]) {
      shutterParts.push(createNormalizedBox(0.32, 1.3, 0.08, wx + sSide * 0.75, wy + 0.05, frontZ + 0.04));
    }
  }

  // Front door with transom & trim surround
  trimParts.push(createNormalizedBox(1.24, 2.38, 0.1, bodyX, 1.32, frontZ + 0.03));
  glassParts.push(createNormalizedBox(0.84, 0.3, 0.16, bodyX, 2.28, frontZ + 0.06));

  const sidingGeo = mergeGeometries(sidingParts, false);
  const roofGeo = mergeGeometries(roofParts, false);
  const trimGeo = mergeGeometries(trimParts, false);
  const glassGeo = mergeGeometries(glassParts, false);
  const shutterGeo = mergeGeometries(shutterParts, false);
  const doorGeo = createNormalizedBox(0.96, 2.02, 0.14, bodyX, 1.18, frontZ + 0.05);

  // Brick chimney shaft + corbeled cap
  const chimShaft = createNormalizedBox(0.92, 3.85, 1.08, bodyX - 3.65, bodyH + 1.12, bodyZ);
  const chimCap = createNormalizedBox(1.12, 0.24, 1.28, bodyX - 3.65, bodyH + 3.06, bodyZ);
  const chimneyGeo = mergeGeometries([chimShaft, chimCap], false);

  // Concrete driveway, entry sidewalk, multi-step stoop & stone foundation base plinth
  const driveway = createNormalizedBox(4.05, 0.03, 7.6, garX, 0.015, 4.0);
  const walk = createNormalizedBox(1.18, 0.03, 5.6, bodyX, 0.015, 5.0);
  const stoop = createNormalizedBox(2.9, 0.28, 1.58, bodyX, 0.14, frontZ + 0.76);
  const stepFront = createNormalizedBox(1.4, 0.14, 0.42, bodyX, 0.07, frontZ + 1.72);
  const stoneMainBase = createNormalizedBox(bodyW + 0.14, 0.36, bodyD + 0.14, bodyX, 0.18, bodyZ);
  const stoneGarBase = createNormalizedBox(garW + 0.14, 0.36, garD + 0.14, garX, 0.18, garZ);
  const concreteGeo = mergeGeometries([driveway, walk, stoop, stepFront, stoneMainBase, stoneGarBase], false);

  // Front foundation ornamental shrubs flanking entry walk
  const hedgeParts: THREE.BufferGeometry[] = [];
  for (const [hx, hz, hr] of [
    [bodyX - 2.25, frontZ + 0.55, 0.52],
    [bodyX - 1.55, frontZ + 0.58, 0.45],
    [bodyX + 1.55, frontZ + 0.58, 0.46],
    [bodyX + 2.25, frontZ + 0.55, 0.52],
  ] as [number, number, number][]) {
    const sph = new THREE.IcosahedronGeometry(hr, 1);
    sph.scale(1.18, 0.82, 1.05);
    sph.translate(hx, hr * 0.55, hz);
    hedgeParts.push(ensureNonIndexedUV(sph));
  }
  const hedgeGeo = mergeGeometries(hedgeParts, false);
  hedgeParts.forEach((p) => p.dispose());

  [
    ...sidingParts,
    ...roofParts,
    ...trimParts,
    ...glassParts,
    ...shutterParts,
    chimShaft,
    chimCap,
    driveway,
    walk,
    stoop,
    stepFront,
    stoneMainBase,
    stoneGarBase,
  ].forEach((g) => g.dispose());

  return {
    sidingGeo,
    roofGeo,
    trimGeo,
    glassGeo,
    shutterGeo,
    doorGeo,
    concreteGeo,
    chimneyGeo,
    hedgeGeo,
  };
}

export class SuburbanBatchBuilder {
  private readonly records: PlacedHouseRecord[] = [];
  private readonly sharedPlaceholderGroup = new THREE.Group();

  public get count(): number {
    return this.records.length;
  }

  public addHouse(
    opts: BatchedHouseSpec,
    suburbanHouses: BuiltSuburbanHouse[],
    cityBuildings: CityBuildingBox[]
  ): boolean {
    const fullAddress = opts.cityTag
      ? `${opts.houseNum} ${opts.street} (${opts.cityTag})`
      : `${opts.houseNum} ${opts.street}`;

    const record: PlacedHouseRecord = { ...opts, fullAddress };
    this.records.push(record);

    const dLocal = new THREE.Vector3(3.3, 0, 7.4);
    dLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), opts.rotY);

    const cRot = Math.cos(opts.rotY);
    const sRot = Math.sin(opts.rotY);
    const centerOffZ = -1.2;
    const cx = opts.x + centerOffZ * sRot;
    const cz = opts.z + centerOffZ * cRot;
    const halfExtX = Math.abs(5.8 * cRot) + Math.abs(3.8 * sRot);
    const halfExtZ = Math.abs(5.8 * sRot) + Math.abs(3.8 * cRot);

    const collider: CityBuildingBox = {
      minX: cx - halfExtX,
      maxX: cx + halfExtX,
      minZ: cz - halfExtZ,
      maxZ: cz + halfExtZ,
      height: opts.style === 'split' ? 6.8 : 8.2,
      name: fullAddress,
    };

    let addrHash = 2166136261;
    for (let i = 0; i < fullAddress.length; i++) {
      addrHash ^= fullAddress.charCodeAt(i);
      addrHash = Math.imul(addrHash, 16777619);
    }
    const roofHex = '#' + (opts.roofColor & 0xffffff).toString(16).padStart(6, '0');

    suburbanHouses.push({
      group: this.sharedPlaceholderGroup,
      collider,
      drivewayTarget: { x: opts.x + dLocal.x, z: opts.z + dLocal.z },
      drivewayCoord: { x: opts.x + dLocal.x, z: opts.z + dLocal.z },
      address: fullAddress,
      exteriorProfile: {
        wallColorHex: opts.sidingHex,
        roofColorHex: roofHex,
        style: opts.style === 'split' ? 'split' : 'colonial',
        stories: opts.style === 'split' ? 1 : 2,
        hasGarage: true,
        hasPool: false,
        hasBasement: opts.style === 'split' ? false : (addrHash >>> 0) % 2 === 0,
      },
    });
    cityBuildings.push(collider);
    return true;
  }

  public commit(
    sceneryGroup: THREE.Group,
    opts: {
      isUltra: boolean;
      isRetroPixel: boolean;
      makeCityMat: (o: { color?: number; map?: THREE.Texture; roughness?: number; metalness?: number; envMapIntensity?: number }) => THREE.Material;
    },
    disposables: { dispose: () => void }[]
  ): void {
    if (this.records.length === 0) return;

    const { isUltra, isRetroPixel, makeCityMat } = opts;
    const sidingTex = makeSuburbanSidingCanvasTexture(isRetroPixel);
    disposables.push(sidingTex);

    const shinglePBR = getRoofShinglePBRTextures(isRetroPixel);
    const concretePBR = getConcretePBRTextures(isRetroPixel, isUltra ? 8 : 4);
    const lawnPBR = getLawnPBRTextures(isRetroPixel, isUltra ? 8 : 4);
    const hedgeTex = getLeafClusterTexture(isRetroPixel);
    const sidingNormal = !isRetroPixel ? getSuburbanSidingNormalTexture() : undefined;

    const sidingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: sidingTex,
      normalMap: sidingNormal,
      normalScale: sidingNormal ? new THREE.Vector2(0.85, 0.85) : undefined,
      roughness: 0.72,
      metalness: 0.03,
      envMapIntensity: isUltra ? 0.72 : 0.45,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: shinglePBR.map,
      normalMap: !isRetroPixel ? shinglePBR.normalMap : undefined,
      normalScale: !isRetroPixel ? new THREE.Vector2(1.05, 1.05) : undefined,
      roughness: 0.86,
      metalness: 0.02,
      envMapIntensity: isUltra ? 0.55 : 0.35,
    });
    const trimMat = makeCityMat({ color: 0xf8fafc, roughness: 0.36 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b1a2d,
      roughness: 0.05,
      metalness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      reflectivity: 1.0,
      envMapIntensity: isUltra ? 1.85 : 0.95,
    });
    const shutterMat = makeCityMat({ color: 0xffffff, roughness: 0.52 });
    const doorMat = makeCityMat({ color: 0xffffff, roughness: 0.42, metalness: 0.08 });
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0xc2cbd6,
      map: concretePBR.map,
      normalMap: !isRetroPixel ? concretePBR.normalMap : undefined,
      normalScale: !isRetroPixel ? new THREE.Vector2(0.65, 0.65) : undefined,
      roughness: 0.86,
      metalness: 0.03,
    });
    const lawnMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: lawnPBR.map,
      normalMap: !isRetroPixel ? lawnPBR.normalMap : undefined,
      normalScale: !isRetroPixel ? new THREE.Vector2(0.85, 0.85) : undefined,
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: isUltra ? 0.35 : 0.2,
    });
    const hedgeMat = new THREE.MeshStandardMaterial({
      color: 0x99c47f,
      map: hedgeTex,
      roughness: 0.86,
      metalness: 0.01,
    });
    const chimneyMat = makeCityMat({ color: 0x7a3225, roughness: 0.84 });
    const brickAccentMat = makeCityMat({ color: 0x7c3426, roughness: 0.82 });

    disposables.push(
      sidingMat,
      roofMat,
      trimMat,
      glassMat,
      shutterMat,
      doorMat,
      concreteMat,
      lawnMat,
      hedgeMat,
      chimneyMat,
      brickAccentMat
    );

    const lawnGeo = new THREE.BoxGeometry(12.6, 0.02, 14.6);
    lawnGeo.translate(0, -0.015, 0.6);
    const brickLowerGeo = new THREE.BoxGeometry(6.92, 2.35, 0.24);
    brickLowerGeo.translate(-2.0, 1.32, -1.6 + 3.2 + 0.08);
    const colonialGeos = buildArchetypeGeometries(false);
    const splitGeos = buildArchetypeGeometries(true);
    disposables.push(
      lawnGeo,
      brickLowerGeo,
      colonialGeos.sidingGeo,
      colonialGeos.roofGeo,
      colonialGeos.trimGeo,
      colonialGeos.glassGeo,
      colonialGeos.shutterGeo,
      colonialGeos.doorGeo,
      colonialGeos.concreteGeo,
      colonialGeos.chimneyGeo,
      colonialGeos.hedgeGeo,
      splitGeos.sidingGeo,
      splitGeos.roofGeo,
      splitGeos.trimGeo,
      splitGeos.glassGeo,
      splitGeos.shutterGeo,
      splitGeos.doorGeo,
      splitGeos.concreteGeo,
      splitGeos.chimneyGeo,
      splitGeos.hedgeGeo
    );

    const CHUNK_SIZE = 240;
    const chunkBuckets = new Map<string, PlacedHouseRecord[]>();
    for (let i = 0; i < this.records.length; i++) {
      const rec = this.records[i];
      const cx = Math.floor(rec.x / CHUNK_SIZE);
      const cz = Math.floor(rec.z / CHUNK_SIZE);
      const key = `${cx},${cz}`;
      let list = chunkBuckets.get(key);
      if (!list) {
        list = [];
        chunkBuckets.set(key, list);
      }
      list.push(rec);
    }

    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();
    const upAxis = new THREE.Vector3(0, 1, 0);

    for (const [, chunkRecords] of chunkBuckets.entries()) {
      const chunkGroup = new THREE.Group();
      chunkGroup.name = 'suburban_chunk';
      const total = chunkRecords.length;

      const lawnInst = new THREE.InstancedMesh(lawnGeo, lawnMat, total);
      lawnInst.receiveShadow = isUltra;

      const brickRecords = chunkRecords.filter((r) => r.brickFront);
      const brickInst =
        brickRecords.length > 0 ? new THREE.InstancedMesh(brickLowerGeo, brickAccentMat, brickRecords.length) : null;
      if (brickInst) brickInst.receiveShadow = isUltra;

      for (let i = 0; i < total; i++) {
        const rec = chunkRecords[i];
        dummy.position.set(rec.x, 0.25, rec.z);
        dummy.rotation.set(0, rec.rotY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        lawnInst.setMatrixAt(i, dummy.matrix);
        tmpColor.setHex(i % 3 === 0 ? 0xd8ebd0 : i % 3 === 1 ? 0xcbe3c2 : 0xdfedd2);
        lawnInst.setColorAt(i, tmpColor);
      }
      lawnInst.instanceMatrix.needsUpdate = true;
      if (lawnInst.instanceColor) lawnInst.instanceColor.needsUpdate = true;
      lawnInst.computeBoundingBox();
      lawnInst.computeBoundingSphere();
      chunkGroup.add(lawnInst);

      if (brickInst) {
        for (let i = 0; i < brickRecords.length; i++) {
          const rec = brickRecords[i];
          dummy.position.set(rec.x, 0.25, rec.z);
          dummy.rotation.set(0, rec.rotY, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          brickInst.setMatrixAt(i, dummy.matrix);
        }
        brickInst.instanceMatrix.needsUpdate = true;
        brickInst.computeBoundingBox();
        brickInst.computeBoundingSphere();
        chunkGroup.add(brickInst);
      }

      const byStyle: { geos: ReturnType<typeof buildArchetypeGeometries>; items: PlacedHouseRecord[] }[] = [
        { geos: colonialGeos, items: chunkRecords.filter((r) => r.style === 'colonial') },
        { geos: splitGeos, items: chunkRecords.filter((r) => r.style === 'split') },
      ];

      for (const bucket of byStyle) {
        if (bucket.items.length === 0) continue;
        const n = bucket.items.length;
        const { geos } = bucket;

        const sidingInst = new THREE.InstancedMesh(geos.sidingGeo, sidingMat, n);
        const roofInst = new THREE.InstancedMesh(geos.roofGeo, roofMat, n);
        const trimInst = new THREE.InstancedMesh(geos.trimGeo, trimMat, n);
        const glassInst = new THREE.InstancedMesh(geos.glassGeo, glassMat, n);
        const shutterInst = new THREE.InstancedMesh(geos.shutterGeo, shutterMat, n);
        const doorInst = new THREE.InstancedMesh(geos.doorGeo, doorMat, n);
        const concreteInst = new THREE.InstancedMesh(geos.concreteGeo, concreteMat, n);
        const chimneyInst = new THREE.InstancedMesh(geos.chimneyGeo, chimneyMat, n);
        const hedgeInst = new THREE.InstancedMesh(geos.hedgeGeo, hedgeMat, n);

        if (isUltra) {
          sidingInst.castShadow = true;
          sidingInst.receiveShadow = true;
          roofInst.castShadow = true;
          roofInst.receiveShadow = true;
          chimneyInst.castShadow = true;
          hedgeInst.castShadow = true;
          hedgeInst.receiveShadow = true;
          trimInst.receiveShadow = true;
          concreteInst.receiveShadow = true;
        }

        for (let i = 0; i < n; i++) {
          const rec = bucket.items[i];
          dummy.position.set(rec.x, 0.25, rec.z);
          dummy.rotation.set(0, rec.rotY, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();

          sidingInst.setMatrixAt(i, dummy.matrix);
          roofInst.setMatrixAt(i, dummy.matrix);
          trimInst.setMatrixAt(i, dummy.matrix);
          glassInst.setMatrixAt(i, dummy.matrix);
          shutterInst.setMatrixAt(i, dummy.matrix);
          doorInst.setMatrixAt(i, dummy.matrix);
          concreteInst.setMatrixAt(i, dummy.matrix);
          chimneyInst.setMatrixAt(i, dummy.matrix);
          hedgeInst.setMatrixAt(i, dummy.matrix);

          tmpColor.set(rec.sidingHex);
          sidingInst.setColorAt(i, tmpColor);
          tmpColor.setHex(rec.roofColor);
          roofInst.setColorAt(i, tmpColor);
          tmpColor.setHex(rec.shutterColor);
          shutterInst.setColorAt(i, tmpColor);
          tmpColor.setHex(rec.doorColor);
          doorInst.setColorAt(i, tmpColor);
        }

        const meshes = [sidingInst, roofInst, trimInst, glassInst, shutterInst, doorInst, concreteInst, chimneyInst, hedgeInst];
        for (const m of meshes) {
          m.instanceMatrix.needsUpdate = true;
          if (m.instanceColor) m.instanceColor.needsUpdate = true;
          m.computeBoundingBox();
          m.computeBoundingSphere();
          chunkGroup.add(m);
        }
      }

      // Per-chunk crisp Double-Sided Street Address Plaque Atlas (sized cleanly to chunk record count)
      const SLOTS_COLS = 4;
      const SLOT_W = 256;
      const SLOT_H = 64;
      const SLOTS_PER_PAGE = 64; // max 4x16 per atlas page -> 1024x1024
      for (let pageStart = 0; pageStart < chunkRecords.length; pageStart += SLOTS_PER_PAGE) {
        const pageRecords = chunkRecords.slice(pageStart, pageStart + SLOTS_PER_PAGE);
        const rowsNeeded = Math.max(1, Math.ceil(pageRecords.length / SLOTS_COLS));
        const canvas = document.createElement('canvas');
        canvas.width = SLOTS_COLS * SLOT_W;
        canvas.height = rowsNeeded * SLOT_H;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const totalQuads = pageRecords.length * 2;
        const positions = new Float32Array(totalQuads * 4 * 3);
        const normals = new Float32Array(totalQuads * 4 * 3);
        const uvs = new Float32Array(totalQuads * 4 * 2);
        const indices: number[] = [];

        const plaqueHalfW = 1.12;
        const plaqueHalfH = 0.28;
        const localOffset = new THREE.Vector3(0.45, 1.38, 7.38);

        for (let i = 0; i < pageRecords.length; i++) {
          const rec = pageRecords[i];
          const col = i % SLOTS_COLS;
          const row = Math.floor(i / SLOTS_COLS);
          const px = col * SLOT_W;
          const py = row * SLOT_H;

          ctx.fillStyle = '#0f172a';
          ctx.fillRect(px + 2, py + 2, SLOT_W - 4, SLOT_H - 4);
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 3;
          ctx.strokeRect(px + 4, py + 4, SLOT_W - 8, SLOT_H - 8);
          ctx.fillStyle = '#fef3c7';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
          ctx.fillText(rec.houseNum, px + SLOT_W * 0.5, py + 22, SLOT_W - 20);
          ctx.fillStyle = '#cbd5e1';
          ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
          ctx.fillText(rec.street.toUpperCase(), px + SLOT_W * 0.5, py + 46, SLOT_W - 20);

          const u0 = (px + 2) / canvas.width;
          const u1 = (px + SLOT_W - 2) / canvas.width;
          const vTop = 1 - (py + 2) / canvas.height;
          const vBot = 1 - (py + SLOT_H - 2) / canvas.height;

          const worldAnchor = localOffset.clone().applyAxisAngle(upAxis, rec.rotY);
          const cx = rec.x + worldAnchor.x;
          const cy = 0.25 + worldAnchor.y;
          const cz = rec.z + worldAnchor.z;

          const rightX = Math.cos(rec.rotY);
          const rightZ = -Math.sin(rec.rotY);
          const fwdX = Math.sin(rec.rotY);
          const fwdZ = Math.cos(rec.rotY);

          for (let face = 0; face < 2; face++) {
            const sign = face === 0 ? 1 : -1;
            const qIdx = i * 2 + face;
            const vBase = qIdx * 4;
            const nx = fwdX * sign;
            const nz = fwdZ * sign;
            const rx = rightX * plaqueHalfW * sign;
            const rz = rightZ * plaqueHalfW * sign;

            const corners = [
              [cx - rx + nx * 0.03, cy - plaqueHalfH, cz - rz + nz * 0.03],
              [cx + rx + nx * 0.03, cy - plaqueHalfH, cz + rz + nz * 0.03],
              [cx + rx + nx * 0.03, cy + plaqueHalfH, cz + rz + nz * 0.03],
              [cx - rx + nx * 0.03, cy + plaqueHalfH, cz - rz + nz * 0.03],
            ];
            for (let c = 0; c < 4; c++) {
              positions[(vBase + c) * 3] = corners[c][0];
              positions[(vBase + c) * 3 + 1] = corners[c][1];
              positions[(vBase + c) * 3 + 2] = corners[c][2];
              normals[(vBase + c) * 3] = nx;
              normals[(vBase + c) * 3 + 1] = 0;
              normals[(vBase + c) * 3 + 2] = nz;
            }
            uvs[vBase * 2] = u0;
            uvs[vBase * 2 + 1] = vBot;
            uvs[(vBase + 1) * 2] = u1;
            uvs[(vBase + 1) * 2 + 1] = vBot;
            uvs[(vBase + 2) * 2] = u1;
            uvs[(vBase + 2) * 2 + 1] = vTop;
            uvs[(vBase + 3) * 2] = u0;
            uvs[(vBase + 3) * 2 + 1] = vTop;

            indices.push(vBase, vBase + 1, vBase + 2, vBase, vBase + 2, vBase + 3);
          }
        }

        const atlasGeo = new THREE.BufferGeometry();
        atlasGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        atlasGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        atlasGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        atlasGeo.setIndex(indices);
        atlasGeo.computeBoundingBox();
        atlasGeo.computeBoundingSphere();

        const atlasTex = new THREE.CanvasTexture(canvas);
        atlasTex.colorSpace = THREE.SRGBColorSpace;
        atlasTex.anisotropy = isRetroPixel ? 1 : 8;
        if (isRetroPixel) {
          atlasTex.minFilter = THREE.NearestFilter;
          atlasTex.magFilter = THREE.NearestFilter;
        }

        const atlasMat = makeCityMat({ map: atlasTex, roughness: 0.45, metalness: 0.15 });
        const atlasMesh = new THREE.Mesh(atlasGeo, atlasMat);
        chunkGroup.add(atlasMesh);
        disposables.push(atlasGeo, atlasTex, atlasMat);
      }

      sceneryGroup.add(chunkGroup);
    }
  }
}
