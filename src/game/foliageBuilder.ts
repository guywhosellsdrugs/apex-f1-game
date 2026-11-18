import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  getBarkPBRTextures,
  getGrassTuftTexture,
  getLeafClusterTexture,
  getPineNeedleTexture,
} from './pbrTextures';

export interface WoodlandTreePlacement {
  x: number;
  z: number;
  s: number;
  species?: 'oak' | 'pine';
}

export interface GrassPatchPlacement {
  x: number;
  z: number;
  s: number;
  kind?: 'grass' | 'shrub';
}

function normalizeForMerge(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const nonIdx = g.index ? g.toNonIndexed() : g;
  if (!nonIdx.getAttribute('normal')) nonIdx.computeVertexNormals();
  if (!nonIdx.getAttribute('uv')) {
    const count = nonIdx.getAttribute('position').count;
    nonIdx.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  return nonIdx;
}

function makeBranchSegment(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  rBot: number,
  rTop: number,
  radialSegs: number
): THREE.BufferGeometry {
  const dir = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0);
  const len = Math.max(0.1, dir.length());
  const cyl = new THREE.CylinderGeometry(rTop, rBot, len, radialSegs, 1);
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
  cyl.applyQuaternion(q);
  cyl.translate((x0 + x1) * 0.5, (y0 + y1) * 0.5, (z0 + z1) * 0.5);
  return normalizeForMerge(cyl);
}

/**
 * Builds a branched broadleaf oak/maple trunk + multi-lobe organic leaf-cluster crown.
 */
function createBroadleafGeometries(isRetroPixel: boolean): {
  trunkGeo: THREE.BufferGeometry;
  crownGeo: THREE.BufferGeometry;
} {
  const segs = isRetroPixel ? 5 : 7;
  const trunkParts: THREE.BufferGeometry[] = [];

  // Root flare + main crooked oak bole
  trunkParts.push(makeBranchSegment(0, 0, 0, 0.08, 1.8, 0.04, 0.44, 0.28, segs));
  trunkParts.push(makeBranchSegment(0.08, 1.7, 0.04, -0.05, 3.25, -0.04, 0.28, 0.19, segs));

  // Root buttresses
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    trunkParts.push(
      makeBranchSegment(
        Math.cos(a) * 0.48,
        0,
        Math.sin(a) * 0.48,
        Math.cos(a) * 0.12,
        0.72,
        Math.sin(a) * 0.12,
        0.16,
        0.09,
        Math.max(4, segs - 1)
      )
    );
  }

  // Forked primary & secondary scaffold limbs
  const limbTargets: [number, number, number, number][] = [
    [1.45, 4.75, 0.95, 0.16],
    [-1.5, 4.65, 0.72, 0.15],
    [0.2, 4.95, -1.55, 0.15],
    [-0.95, 5.15, -0.85, 0.13],
    [0.9, 5.25, -0.45, 0.13],
  ];
  for (const [tx, ty, tz, rB] of limbTargets) {
    trunkParts.push(makeBranchSegment(-0.02, 2.85, 0.0, tx, ty, tz, rB, rB * 0.45, Math.max(4, segs - 1)));
  }

  const trunkGeo = mergeGeometries(trunkParts, false);
  trunkParts.forEach((p) => p.dispose());

  // Multi-lobe canopy composed of crossed organic leaf-card clusters & irregular displaced sub-crowns
  const crownParts: THREE.BufferGeometry[] = [];
  const cardDim = isRetroPixel ? 2.5 : 2.95;
  const lobeCenters: [number, number, number, number][] = [
    [0, 5.65, 0, 1.15],
    [1.65, 4.75, 1.05, 0.95],
    [-1.65, 4.68, 0.82, 0.95],
    [0.25, 4.95, -1.62, 0.95],
    [-1.08, 5.35, -1.05, 0.88],
    [1.05, 5.42, -0.58, 0.88],
    [0.08, 6.45, 0.18, 0.82],
  ];

  // For each lobe add 3 rotated foliage cards + subtle inner shading volume so tree has crisp silhouettes from every camera angle
  const cardAngles: [number, number, number][] = [
    [0, 0, 0],
    [0, Math.PI / 3, 0.18],
    [0.22, (Math.PI * 2) / 3, -0.15],
    [Math.PI / 2 - 0.18, 0.4, 0],
  ];

  for (let l = 0; l < lobeCenters.length; l++) {
    const [lx, ly, lz, lScale] = lobeCenters[l];
    // Core organic icosahedron pod gives solid shadow mass under leaf cards
    const core = new THREE.IcosahedronGeometry(1.12 * lScale, isRetroPixel ? 0 : 1);
    core.scale(1.15, 0.84, 1.15);
    core.translate(lx, ly, lz);
    crownParts.push(normalizeForMerge(core));

    const cardsThisLobe = isRetroPixel ? 2 : cardAngles.length;
    for (let c = 0; c < cardsThisLobe; c++) {
      const [rx, ry, rz] = cardAngles[c];
      const plane = new THREE.PlaneGeometry(cardDim * lScale, cardDim * lScale);
      plane.rotateX(rx + ((l * 0.37) % 0.4));
      plane.rotateY(ry + l * 0.9);
      plane.rotateZ(rz);
      plane.translate(lx, ly, lz);
      crownParts.push(normalizeForMerge(plane));
    }
  }

  const crownGeo = mergeGeometries(crownParts, false);
  crownParts.forEach((p) => p.dispose());
  return { trunkGeo, crownGeo };
}

/**
 * Builds an Eastern White Pine / Virginia Pine with tall straight trunk and 5 tiered conifer bough whorls.
 */
function createPineGeometries(isRetroPixel: boolean): {
  trunkGeo: THREE.BufferGeometry;
  crownGeo: THREE.BufferGeometry;
} {
  const segs = isRetroPixel ? 5 : 7;
  const trunkGeo = makeBranchSegment(0, 0, 0, 0, 6.2, 0, 0.34, 0.08, segs);

  const boughParts: THREE.BufferGeometry[] = [];
  const tiers: [number, number, number][] = [
    [2.6, 2.35, 1.55],
    [3.7, 2.05, 1.45],
    [4.75, 1.72, 1.38],
    [5.7, 1.32, 1.25],
    [6.55, 0.85, 1.1],
  ];

  for (let t = 0; t < tiers.length; t++) {
    const [ty, radius, height] = tiers[t];
    const cone = new THREE.ConeGeometry(radius, height, isRetroPixel ? 6 : 8, 1, false);
    cone.rotateY(t * 0.55);
    cone.translate(0, ty, 0);
    boughParts.push(normalizeForMerge(cone));

    // Drooping lateral needle bough planes per tier
    const fronds = isRetroPixel ? 2 : 4;
    for (let f = 0; f < fronds; f++) {
      const a = (f / fronds) * Math.PI * 2 + t * 0.6;
      const p = new THREE.PlaneGeometry(radius * 1.9, radius * 1.9);
      p.rotateX(-Math.PI / 2 + 0.28);
      p.rotateY(a);
      p.translate(0, ty - height * 0.18, 0);
      boughParts.push(normalizeForMerge(p));
    }
  }

  const crownGeo = mergeGeometries(boughParts, false);
  boughParts.forEach((p) => p.dispose());
  return { trunkGeo, crownGeo };
}

function createGrassTuftGeometry(isRetroPixel: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const planes = isRetroPixel ? 2 : 3;
  for (let i = 0; i < planes; i++) {
    const p = new THREE.PlaneGeometry(0.95, 0.68);
    p.translate(0, 0.34, 0);
    p.rotateY((i / planes) * Math.PI);
    parts.push(normalizeForMerge(p));
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

function createShrubGeometry(isRetroPixel: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const lobes: [number, number, number, number][] = [
    [0, 0.42, 0, 0.56],
    [0.36, 0.34, 0.22, 0.42],
    [-0.34, 0.35, -0.18, 0.44],
    [0.14, 0.32, -0.35, 0.38],
  ];
  for (let i = 0; i < lobes.length; i++) {
    const [lx, ly, lz, r] = lobes[i];
    const g = new THREE.IcosahedronGeometry(r, isRetroPixel ? 0 : 1);
    g.scale(1.15, 0.85, 1.15);
    g.translate(lx, ly, lz);
    parts.push(normalizeForMerge(g));
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

const foliageWindUniform = { value: 0 };
export function updateFoliageWindTime(timeSec: number): void {
  foliageWindUniform.value = timeSec;
}

function attachWindSwayShader(mat: THREE.MeshStandardMaterial, swayStrength: number): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = foliageWindUniform;
    shader.vertexShader =
      `uniform float uWindTime;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float worldSeed = position.x * 0.7 + position.z * 0.9;
        #ifdef USE_INSTANCING
          worldSeed += instanceMatrix[3][0] * 0.13 + instanceMatrix[3][2] * 0.17;
        #endif
        float heightFactor = clamp(position.y * 0.45, 0.0, 1.5);
        float swayWave = sin(uWindTime * 1.9 + worldSeed) * ${swayStrength.toFixed(3)} * heightFactor;
        transformed.x += swayWave;
        transformed.z += cos(uWindTime * 1.5 + worldSeed * 1.3) * ${(swayStrength * 0.6).toFixed(3)} * heightFactor;`
      );
  };
}

/**
 * Builds a single standalone branched landscaped tree group (for parks, plazas, and landmarks).
 */
export function buildDetailedSingleTreeGroup(
  tx: number,
  tz: number,
  scale: number,
  isRetroPixel: boolean,
  isUltra: boolean,
  species: 'oak' | 'pine' = 'oak'
): { group: THREE.Group; disposables: { dispose: () => void }[] } {
  const disposables: { dispose: () => void }[] = [];
  const barkPBR = getBarkPBRTextures(isRetroPixel, isUltra ? 4 : 2);
  const leafTex = species === 'pine' ? getPineNeedleTexture(isRetroPixel) : getLeafClusterTexture(isRetroPixel);

  const barkMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: barkPBR.map,
    normalMap: !isRetroPixel ? barkPBR.normalMap : undefined,
    normalScale: !isRetroPixel ? new THREE.Vector2(1.1, 1.1) : undefined,
    roughness: 0.92,
    metalness: 0.0,
  });
  const leafMat = new THREE.MeshStandardMaterial({
    color: species === 'pine' ? 0xc2dec2 : 0xd6e8c8,
    map: leafTex,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    roughness: 0.84,
    metalness: 0.01,
    envMapIntensity: isUltra ? 0.55 : 0.35,
  });
  if (!isRetroPixel && isUltra) attachWindSwayShader(leafMat, 0.06);

  const geos = species === 'pine' ? createPineGeometries(isRetroPixel) : createBroadleafGeometries(isRetroPixel);
  disposables.push(barkMat, leafMat, geos.trunkGeo, geos.crownGeo);

  const g = new THREE.Group();
  g.position.set(tx, 0.24, tz);
  g.rotation.y = (Math.abs(Math.sin(tx * 12.7 + tz * 31.3)) * Math.PI * 2) % (Math.PI * 2);
  g.scale.setScalar(scale);

  const trunkMesh = new THREE.Mesh(geos.trunkGeo, barkMat);
  trunkMesh.castShadow = isUltra;
  trunkMesh.receiveShadow = isUltra;
  const crownMesh = new THREE.Mesh(geos.crownGeo, leafMat);
  crownMesh.castShadow = isUltra;
  crownMesh.receiveShadow = isUltra;

  g.add(trunkMesh, crownMesh);
  return { group: g, disposables };
}

/**
 * Populates woodland belts & park corridors using branched Oak + Eastern Pine instanced trees
 * bucketed into 240m spatial chunks so WorldChunkManager frustum-culls distant groves seamlessly.
 */
export function populateInstancedWoodlandTrees(
  sceneryGroup: THREE.Group,
  placements: WoodlandTreePlacement[],
  opts: { isUltra: boolean; isRetroPixel: boolean },
  disposables: { dispose: () => void }[]
): void {
  if (placements.length === 0) return;
  const { isUltra, isRetroPixel } = opts;

  const barkPBR = getBarkPBRTextures(isRetroPixel, isUltra ? 8 : 2);
  const oakLeafTex = getLeafClusterTexture(isRetroPixel);
  const pineLeafTex = getPineNeedleTexture(isRetroPixel);

  const barkMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: barkPBR.map,
    normalMap: !isRetroPixel ? barkPBR.normalMap : undefined,
    normalScale: !isRetroPixel ? new THREE.Vector2(1.1, 1.1) : undefined,
    roughness: 0.93,
    metalness: 0.0,
  });
  const oakMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: oakLeafTex,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    roughness: 0.85,
    metalness: 0.01,
    envMapIntensity: isUltra ? 0.55 : 0.35,
  });
  const pineMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: pineLeafTex,
    alphaTest: 0.38,
    side: THREE.DoubleSide,
    roughness: 0.86,
    metalness: 0.01,
    envMapIntensity: isUltra ? 0.5 : 0.32,
  });
  if (!isRetroPixel && isUltra) {
    attachWindSwayShader(oakMat, 0.065);
    attachWindSwayShader(pineMat, 0.04);
  }

  const oakGeos = createBroadleafGeometries(isRetroPixel);
  const pineGeos = createPineGeometries(isRetroPixel);

  disposables.push(
    barkMat,
    oakMat,
    pineMat,
    oakGeos.trunkGeo,
    oakGeos.crownGeo,
    pineGeos.trunkGeo,
    pineGeos.crownGeo
  );

  // Bucket into 240m chunks so WorldChunkManager streams groves smoothly
  const CHUNK_SIZE = 240;
  const chunks = new Map<string, WoodlandTreePlacement[]>();
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    const key = `${Math.floor(p.x / CHUNK_SIZE)},${Math.floor(p.z / CHUNK_SIZE)}`;
    let list = chunks.get(key);
    if (!list) {
      list = [];
      chunks.set(key, list);
    }
    list.push(p);
  }

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  const oakPalette = [0xb9d6a3, 0xa8cc92, 0xc8deaa, 0x99bf85, 0xc3cc86];
  const pinePalette = [0x8fb58e, 0x7ea67f, 0x9dc298];

  for (const [, list] of chunks.entries()) {
    const chunkGroup = new THREE.Group();
    chunkGroup.name = 'woodland_chunk';

    const oaks: WoodlandTreePlacement[] = [];
    const pines: WoodlandTreePlacement[] = [];
    for (let i = 0; i < list.length; i++) {
      const sp = list[i].species ?? (i % 4 === 0 ? 'pine' : 'oak');
      if (sp === 'pine') pines.push(list[i]);
      else oaks.push(list[i]);
    }

    if (oaks.length > 0) {
      const tInst = new THREE.InstancedMesh(oakGeos.trunkGeo, barkMat, oaks.length);
      const cInst = new THREE.InstancedMesh(oakGeos.crownGeo, oakMat, oaks.length);
      if (isUltra) {
        tInst.castShadow = true;
        cInst.castShadow = true;
        cInst.receiveShadow = true;
      }
      for (let i = 0; i < oaks.length; i++) {
        const tp = oaks[i];
        dummy.position.set(tp.x, 0.23, tp.z);
        dummy.rotation.set(0, ((Math.abs(tp.x * 0.37 + tp.z * 0.71)) % (Math.PI * 2)), 0);
        dummy.scale.set(tp.s, tp.s * (0.94 + (i % 3) * 0.08), tp.s);
        dummy.updateMatrix();
        tInst.setMatrixAt(i, dummy.matrix);
        cInst.setMatrixAt(i, dummy.matrix);
        tint.setHex(oakPalette[i % oakPalette.length]);
        cInst.setColorAt(i, tint);
      }
      tInst.instanceMatrix.needsUpdate = true;
      cInst.instanceMatrix.needsUpdate = true;
      if (cInst.instanceColor) cInst.instanceColor.needsUpdate = true;
      tInst.computeBoundingBox();
      tInst.computeBoundingSphere();
      cInst.computeBoundingBox();
      cInst.computeBoundingSphere();
      chunkGroup.add(tInst, cInst);
    }

    if (pines.length > 0) {
      const tInst = new THREE.InstancedMesh(pineGeos.trunkGeo, barkMat, pines.length);
      const cInst = new THREE.InstancedMesh(pineGeos.crownGeo, pineMat, pines.length);
      if (isUltra) {
        tInst.castShadow = true;
        cInst.castShadow = true;
        cInst.receiveShadow = true;
      }
      for (let i = 0; i < pines.length; i++) {
        const tp = pines[i];
        dummy.position.set(tp.x, 0.23, tp.z);
        dummy.rotation.set(0, ((Math.abs(tp.x * 0.51 + tp.z * 0.29)) % (Math.PI * 2)), 0);
        dummy.scale.set(tp.s, tp.s * (1.02 + (i % 3) * 0.1), tp.s);
        dummy.updateMatrix();
        tInst.setMatrixAt(i, dummy.matrix);
        cInst.setMatrixAt(i, dummy.matrix);
        tint.setHex(pinePalette[i % pinePalette.length]);
        cInst.setColorAt(i, tint);
      }
      tInst.instanceMatrix.needsUpdate = true;
      cInst.instanceMatrix.needsUpdate = true;
      if (cInst.instanceColor) cInst.instanceColor.needsUpdate = true;
      tInst.computeBoundingBox();
      tInst.computeBoundingSphere();
      cInst.computeBoundingBox();
      cInst.computeBoundingSphere();
      chunkGroup.add(tInst, cInst);
    }

    sceneryGroup.add(chunkGroup);
  }
}

/**
 * Scatters chunked 3D crossed-blade grass tufts & ornamental landscape shrubs
 * across parks, lakefronts, greenbelts, and roadside verges with wind sway.
 */
export function populateChunkedGrassAndShrubs(
  sceneryGroup: THREE.Group,
  patches: GrassPatchPlacement[],
  opts: { isUltra: boolean; isRetroPixel: boolean },
  disposables: { dispose: () => void }[]
): void {
  if (patches.length === 0) return;
  const { isUltra, isRetroPixel } = opts;

  const grassTex = getGrassTuftTexture(isRetroPixel);
  const shrubLeafTex = getLeafClusterTexture(isRetroPixel);

  const grassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: grassTex,
    alphaTest: 0.36,
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0.0,
    envMapIntensity: isUltra ? 0.42 : 0.25,
  });
  const shrubMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: shrubLeafTex,
    roughness: 0.85,
    metalness: 0.01,
    envMapIntensity: isUltra ? 0.5 : 0.3,
  });

  if (!isRetroPixel && isUltra) {
    attachWindSwayShader(grassMat, 0.09);
  }

  const grassGeo = createGrassTuftGeometry(isRetroPixel);
  const shrubGeo = createShrubGeometry(isRetroPixel);
  disposables.push(grassMat, shrubMat, grassGeo, shrubGeo);

  const CHUNK_SIZE = 240;
  const chunks = new Map<string, GrassPatchPlacement[]>();
  for (let i = 0; i < patches.length; i++) {
    const p = patches[i];
    const key = `${Math.floor(p.x / CHUNK_SIZE)},${Math.floor(p.z / CHUNK_SIZE)}`;
    let list = chunks.get(key);
    if (!list) {
      list = [];
      chunks.set(key, list);
    }
    list.push(p);
  }

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  const grassTints = [0xc2e0a4, 0xb0d48f, 0xd4e2a1, 0xa2c885];
  const shrubTints = [0x92bc7b, 0xa8cf8d, 0x7da86b];

  for (const [, list] of chunks.entries()) {
    const chunkGroup = new THREE.Group();
    chunkGroup.name = 'grass_chunk';

    const tufts: GrassPatchPlacement[] = [];
    const shrubs: GrassPatchPlacement[] = [];
    for (let i = 0; i < list.length; i++) {
      if (list[i].kind === 'shrub') shrubs.push(list[i]);
      else tufts.push(list[i]);
    }

    if (tufts.length > 0) {
      const inst = new THREE.InstancedMesh(grassGeo, grassMat, tufts.length);
      inst.receiveShadow = isUltra;
      for (let i = 0; i < tufts.length; i++) {
        const g = tufts[i];
        dummy.position.set(g.x, 0.23, g.z);
        dummy.rotation.set(0, ((i * 1.618) % (Math.PI * 2)), 0);
        dummy.scale.set(g.s * (0.9 + (i % 3) * 0.14), g.s * (0.85 + (i % 4) * 0.12), g.s * (0.9 + (i % 3) * 0.14));
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        tint.setHex(grassTints[i % grassTints.length]);
        inst.setColorAt(i, tint);
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.computeBoundingBox();
      inst.computeBoundingSphere();
      chunkGroup.add(inst);
    }

    if (shrubs.length > 0) {
      const inst = new THREE.InstancedMesh(shrubGeo, shrubMat, shrubs.length);
      inst.castShadow = isUltra;
      inst.receiveShadow = isUltra;
      for (let i = 0; i < shrubs.length; i++) {
        const sh = shrubs[i];
        dummy.position.set(sh.x, 0.23, sh.z);
        dummy.rotation.set(0, ((i * 2.13) % (Math.PI * 2)), 0);
        dummy.scale.setScalar(sh.s);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        tint.setHex(shrubTints[i % shrubTints.length]);
        inst.setColorAt(i, tint);
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.computeBoundingBox();
      inst.computeBoundingSphere();
      chunkGroup.add(inst);
    }

    sceneryGroup.add(chunkGroup);
  }
}
