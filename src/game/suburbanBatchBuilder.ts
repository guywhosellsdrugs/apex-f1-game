import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BuiltSuburbanHouse, CityBuildingBox } from './cityTrafficBuilder';

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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
    for (let y = 0; y < 64; y += 8) ctx.fillRect(0, y, 64, 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
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

function createNormalizedBox(w: number, h: number, d: number, tx = 0, ty = 0, tz = 0, rx = 0, rz = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx !== 0) g.rotateX(rx);
  if (rz !== 0) g.rotateZ(rz);
  if (tx !== 0 || ty !== 0 || tz !== 0) g.translate(tx, ty, tz);
  return g;
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
    gables = gRaw.index ? gRaw.toNonIndexed() : gRaw;

    const slopeLen = Math.hypot(depth * 0.54, ridgeHeight);
    const slopeAng = Math.atan2(ridgeHeight, depth * 0.5);
    for (const s of [-1, 1]) {
      const sp = createNormalizedBox(width + 0.72, 0.24, slopeLen, cx, cy + ridgeHeight * 0.5, cz + s * depth * 0.27, s * slopeAng, 0);
      slopeParts.push(sp.index ? sp.toNonIndexed() : sp);
    }
  } else {
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-width * 0.5, 0);
    gableShape.lineTo(width * 0.5, 0);
    gableShape.lineTo(0, ridgeHeight);
    gableShape.closePath();
    const gRaw = new THREE.ExtrudeGeometry(gableShape, { depth, bevelEnabled: false });
    gRaw.translate(cx, cy, -depth * 0.5 + cz);
    gables = gRaw.index ? gRaw.toNonIndexed() : gRaw;

    const slopeLen = Math.hypot(width * 0.54, ridgeHeight);
    const slopeAng = Math.atan2(ridgeHeight, width * 0.5);
    for (const s of [-1, 1]) {
      const sp = createNormalizedBox(slopeLen, 0.24, depth + 0.72, cx + s * width * 0.27, cy + ridgeHeight * 0.5, cz, 0, -s * slopeAng);
      slopeParts.push(sp.index ? sp.toNonIndexed() : sp);
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
} {
  const bodyW = 6.8;
  const bodyH = isSplit ? 4.2 : 5.3;
  const bodyD = 6.4;
  const bodyX = -2.0;
  const bodyZ = -1.6;
  const frontZ = bodyZ + bodyD * 0.5;

  const garW = 4.4;
  const garH = 3.2;
  const garD = 5.6;
  const garX = 3.3;
  const garZ = -1.1;
  const garFrontZ = garZ + garD * 0.5;

  const mainBody = createNormalizedBox(bodyW, bodyH, bodyD, bodyX, bodyH * 0.5 + 0.05, bodyZ).toNonIndexed();
  const garBody = createNormalizedBox(garW, garH, garD, garX, garH * 0.5 + 0.05, garZ).toNonIndexed();

  const mainRoof = createPitchedRoofBuffer(bodyW + 0.22, bodyD + 0.22, 2.2, 'x', bodyX, bodyH + 0.05, bodyZ);
  const garRoof = createPitchedRoofBuffer(garW + 0.22, garD + 0.22, 1.65, 'z', garX, garH + 0.05, garZ);

  const porchRoofBox = createNormalizedBox(2.8, 0.22, 1.5, bodyX, 2.85, frontZ + 0.72).toNonIndexed();

  const sidingGeo = mergeGeometries([mainBody, garBody, mainRoof.gables, garRoof.gables], false);
  const roofGeo = mergeGeometries([mainRoof.slopes, garRoof.slopes, porchRoofBox], false);

  const trimParts: THREE.BufferGeometry[] = [
    createNormalizedBox(3.8, 2.35, 0.14, garX, 1.22, garFrontZ + 0.04).toNonIndexed(), // garage door
    createNormalizedBox(0.18, 2.55, 0.18, bodyX - 1.15, 1.4, frontZ + 1.32).toNonIndexed(), // left col
    createNormalizedBox(0.18, 2.55, 0.18, bodyX + 1.15, 1.4, frontZ + 1.32).toNonIndexed(), // right col
    createNormalizedBox(0.08, 1.05, 0.08, 0.45, 0.52, 7.35).toNonIndexed(), // sign post
  ];
  const glassParts: THREE.BufferGeometry[] = [
    createNormalizedBox(3.4, 0.32, 0.16, garX, 2.08, garFrontZ + 0.06).toNonIndexed(), // garage upper windows
  ];
  const shutterParts: THREE.BufferGeometry[] = [];

  const winPositions: [number, number][] = isSplit
    ? [
        [bodyX - 2.0, 2.55],
        [bodyX + 2.0, 2.55],
      ]
    : [
        [bodyX - 2.0, 1.5],
        [bodyX + 2.0, 1.5],
        [bodyX - 2.0, 3.95],
        [bodyX, 3.95],
        [bodyX + 2.0, 3.95],
      ];

  for (const [wx, wy] of winPositions) {
    trimParts.push(createNormalizedBox(1.12, 1.28, 0.09, wx, wy + 0.05, frontZ + 0.03).toNonIndexed());
    glassParts.push(createNormalizedBox(0.9, 1.06, 0.12, wx, wy + 0.05, frontZ + 0.05).toNonIndexed());
    for (const sSide of [-1, 1]) {
      shutterParts.push(createNormalizedBox(0.32, 1.26, 0.08, wx + sSide * 0.72, wy + 0.05, frontZ + 0.04).toNonIndexed());
    }
  }

  const trimGeo = mergeGeometries(trimParts, false);
  const glassGeo = mergeGeometries(glassParts, false);
  const shutterGeo = mergeGeometries(shutterParts, false);
  const doorGeo = createNormalizedBox(0.95, 2.05, 0.14, bodyX, 1.12, frontZ + 0.05).toNonIndexed();
  const chimneyGeo = createNormalizedBox(0.9, 3.6, 1.05, bodyX - 3.65, bodyH + 0.95, bodyZ).toNonIndexed();

  const driveway = createNormalizedBox(4.0, 0.03, 7.6, garX, 0.015, 4.0).toNonIndexed();
  const walk = createNormalizedBox(1.1, 0.03, 5.6, bodyX, 0.015, 5.0).toNonIndexed();
  const stoop = createNormalizedBox(2.8, 0.28, 1.5, bodyX, 0.14, frontZ + 0.72).toNonIndexed();
  const concreteGeo = mergeGeometries([driveway, walk, stoop], false);

  [
    mainBody,
    garBody,
    mainRoof.gables,
    garRoof.gables,
    mainRoof.slopes,
    garRoof.slopes,
    porchRoofBox,
    driveway,
    walk,
    stoop,
    ...trimParts,
    ...glassParts,
    ...shutterParts,
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
    // Tight collider around house + garage structure (local x in [-5.8..5.5], local z in [-5.0..2.6], center z=-1.2)
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
      height: opts.style === 'split' ? 6.8 : 8.0,
      name: fullAddress,
    };

    suburbanHouses.push({
      group: this.sharedPlaceholderGroup,
      collider,
      drivewayTarget: { x: opts.x + dLocal.x, z: opts.z + dLocal.z },
      drivewayCoord: { x: opts.x + dLocal.x, z: opts.z + dLocal.z },
      address: fullAddress,
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

    // Base color MUST stay white on InstancedMesh materials using setColorAt
    const sidingMat = makeCityMat({ color: 0xffffff, map: sidingTex, roughness: 0.68, metalness: 0.04 });
    const roofMat = makeCityMat({ color: 0xffffff, roughness: 0.80, metalness: 0.02 });
    const trimMat = makeCityMat({ color: 0xf8fafc, roughness: 0.36 });
    const glassMat = makeCityMat({
      color: 0x16304f,
      roughness: 0.12,
      metalness: 0.85,
      envMapIntensity: isUltra ? 1.55 : 0.7,
    });
    const shutterMat = makeCityMat({ color: 0xffffff, roughness: 0.55 });
    const doorMat = makeCityMat({ color: 0xffffff, roughness: 0.45 });
    const concreteMat = makeCityMat({ color: 0x94a3b8, roughness: 0.8 });
    const lawnMat = makeCityMat({ color: 0xffffff, roughness: 0.92 });
    const chimneyMat = makeCityMat({ color: 0x8b3728, roughness: 0.78 });
    const brickAccentMat = makeCityMat({ color: 0x8b3728, roughness: 0.78 });

    disposables.push(sidingMat, roofMat, trimMat, glassMat, shutterMat, doorMat, concreteMat, lawnMat, chimneyMat, brickAccentMat);

    // Shared Lawn Plane & Brick Lower Accent for brickFront subset
    const lawnGeo = new THREE.BoxGeometry(12.4, 0.02, 14.4);
    lawnGeo.translate(0, -0.015, 0.6);
    const brickLowerGeo = new THREE.BoxGeometry(6.9, 2.35, 0.22);
    brickLowerGeo.translate(-2.0, 1.25, -1.6 + 3.2 + 0.08);
    disposables.push(lawnGeo, brickLowerGeo);

    const total = this.records.length;
    const lawnInst = new THREE.InstancedMesh(lawnGeo, lawnMat, total);
    lawnInst.receiveShadow = isUltra;

    const brickRecords = this.records.filter((r) => r.brickFront);
    const brickInst =
      brickRecords.length > 0 ? new THREE.InstancedMesh(brickLowerGeo, brickAccentMat, brickRecords.length) : null;
    if (brickInst) brickInst.receiveShadow = isUltra;

    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();

    for (let i = 0; i < total; i++) {
      const rec = this.records[i];
      dummy.position.set(rec.x, 0.25, rec.z);
      dummy.rotation.set(0, rec.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      lawnInst.setMatrixAt(i, dummy.matrix);
      tmpColor.setHex(i % 3 === 0 ? 0x26642b : i % 3 === 1 ? 0x2b6e30 : 0x225c28);
      lawnInst.setColorAt(i, tmpColor);
    }
    lawnInst.instanceMatrix.needsUpdate = true;
    if (lawnInst.instanceColor) lawnInst.instanceColor.needsUpdate = true;
    lawnInst.computeBoundingSphere();
    sceneryGroup.add(lawnInst);

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
      brickInst.computeBoundingSphere();
      sceneryGroup.add(brickInst);
    }

    const byStyle: { style: 'colonial' | 'split'; items: PlacedHouseRecord[] }[] = [
      { style: 'colonial', items: this.records.filter((r) => r.style === 'colonial') },
      { style: 'split', items: this.records.filter((r) => r.style === 'split') },
    ];

    for (const bucket of byStyle) {
      if (bucket.items.length === 0) continue;
      const n = bucket.items.length;
      const geos = buildArchetypeGeometries(bucket.style === 'split');
      disposables.push(
        geos.sidingGeo,
        geos.roofGeo,
        geos.trimGeo,
        geos.glassGeo,
        geos.shutterGeo,
        geos.doorGeo,
        geos.concreteGeo,
        geos.chimneyGeo
      );

      const sidingInst = new THREE.InstancedMesh(geos.sidingGeo, sidingMat, n);
      const roofInst = new THREE.InstancedMesh(geos.roofGeo, roofMat, n);
      const trimInst = new THREE.InstancedMesh(geos.trimGeo, trimMat, n);
      const glassInst = new THREE.InstancedMesh(geos.glassGeo, glassMat, n);
      const shutterInst = new THREE.InstancedMesh(geos.shutterGeo, shutterMat, n);
      const doorInst = new THREE.InstancedMesh(geos.doorGeo, doorMat, n);
      const concreteInst = new THREE.InstancedMesh(geos.concreteGeo, concreteMat, n);
      const chimneyInst = new THREE.InstancedMesh(geos.chimneyGeo, chimneyMat, n);

      if (isUltra) {
        sidingInst.castShadow = true;
        sidingInst.receiveShadow = true;
        roofInst.castShadow = true;
        roofInst.receiveShadow = true;
        chimneyInst.castShadow = true;
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

        tmpColor.set(rec.sidingHex);
        sidingInst.setColorAt(i, tmpColor);
        tmpColor.setHex(rec.roofColor);
        roofInst.setColorAt(i, tmpColor);
        tmpColor.setHex(rec.shutterColor);
        shutterInst.setColorAt(i, tmpColor);
        tmpColor.setHex(rec.doorColor);
        doorInst.setColorAt(i, tmpColor);
      }

      const meshes = [sidingInst, roofInst, trimInst, glassInst, shutterInst, doorInst, concreteInst, chimneyInst];
      for (const m of meshes) {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        m.computeBoundingSphere();
        sceneryGroup.add(m);
      }
    }

    // Build crisp 2048x2048 Texture-Atlas Double-Sided Street Address Plaques (256 houses per atlas page)
    const SLOTS_COLS = 8;
    const SLOTS_ROWS = 32;
    const SLOTS_PER_PAGE = SLOTS_COLS * SLOTS_ROWS; // 256
    const SLOT_W = 256;
    const SLOT_H = 64;

    const upAxis = new THREE.Vector3(0, 1, 0);
    for (let pageStart = 0; pageStart < this.records.length; pageStart += SLOTS_PER_PAGE) {
      const pageRecords = this.records.slice(pageStart, pageStart + SLOTS_PER_PAGE);
      const canvas = document.createElement('canvas');
      canvas.width = SLOTS_COLS * SLOT_W; // 2048
      canvas.height = SLOTS_ROWS * SLOT_H; // 2048
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const totalQuads = pageRecords.length * 2; // front + back faces
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

        // Draw crisp architectural street-number plaque
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
        // Canvas Y=0 is top; WebGL Texture flipY=true maps v=1 to top -> vTop = 1 - py/H, vBot = 1 - (py+H)/H
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
          const fOff = 0.03 * sign;

          const rx = rightX * plaqueHalfW * sign;
          const rz = rightZ * plaqueHalfW * sign;

          // bottom-left, bottom-right, top-right, top-left
          const corners = [
            [cx - rx + nx * 0.03, cy - plaqueHalfH, cz - rz + nz * 0.03],
            [cx + rx + nx * 0.03, cy - plaqueHalfH, cz + rz + nz * 0.03],
            [cx + rx + nx * 0.03, cy + plaqueHalfH, cz + rz + nz * 0.03],
            [cx - rx + nx * 0.03, cy + plaqueHalfH, cz - rz + nz * 0.03],
          ];
          void fOff;
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
      sceneryGroup.add(atlasMesh);
      disposables.push(atlasGeo, atlasTex, atlasMat);
    }
  }
}
