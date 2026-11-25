import * as THREE from 'three';

export interface WorldChunkUpdateOptions {
  isDynamicMode: boolean;
  qualityFactor: number; // 0.05..1.0
  baseMaxDistance?: number; // preset cap (e.g. 820 Ultra, 540 Medium, 420 Low)
  chunkLoadScale?: number; // 0.14..1.0 automatic struggle reduction
  aggressiveDynamic?: boolean; // strict 60+ FPS lock mode (Conservative Dynamic)
}

interface SpatialChunk {
  key: string;
  group: THREE.Group;
  bounds: THREE.Box3;
  centerX: number;
  centerZ: number;
  halfDiag: number;
  visible: boolean;
}

interface WideSpanItem {
  obj: THREE.Object3D;
  bounds: THREE.Box3;
  centerX: number;
  centerZ: number;
  halfDiag: number;
  visible: boolean;
}

/**
 * Spatial Chunk Streaming & Camera-Frustum Visibility Manager for the 5,200m x 3,150m Maryland World.
 * Partitions static scenery/road meshes into 240m x 240m chunks with precomputed Box3 bounds,
 * renders ONLY chunks inside distance + camera frustum, and automatically sheds far chunks when
 * device frame times climb (`chunkLoadScale < 1.0`).
 */
export class WorldChunkManager {
  public readonly chunkSize: number;
  private readonly chunks: SpatialChunk[] = [];
  private readonly wideItems: WideSpanItem[] = [];
  private readonly containerGroups: THREE.Group[] = [];

  // Pre-allocated scratch math objects (Zero per-frame allocations at 60-240Hz)
  private readonly projScreenMatrix = new THREE.Matrix4();
  private readonly frustum = new THREE.Frustum();
  private readonly tmpBox = new THREE.Box3();
  private readonly tmpCenter = new THREE.Vector3();
  private readonly tmpSize = new THREE.Vector3();
  private candidateIndices: number[] = [];
  private candidateDists: number[] = [];

  constructor(chunkSize = 240) {
    this.chunkSize = chunkSize;
  }

  /**
   * Partitions static children of the supplied parent groups (`sceneryGroup`, `group`) into spatial chunks.
   * Objects marked `obj.userData.neverChunkCull = true` (e.g. infinite ground base plane, lights, camera targets)
   * remain untouched at top level.
   */
  public partitionStaticGroups(parents: THREE.Group[]): void {
    const bucketMap = new Map<string, THREE.Object3D[]>();

    for (let p = 0; p < parents.length; p++) {
      const parent = parents[p];
      this.containerGroups.push(parent);
      const snapshot = [...parent.children];

      for (let i = 0; i < snapshot.length; i++) {
        const child = snapshot[i];
        if (child.userData?.neverChunkCull) continue;
        // Skip lights / cameras / non-renderables
        if ((child as THREE.Light).isLight || (child as THREE.Camera).isCamera) continue;

        child.updateMatrixWorld(true);
        this.tmpBox.setFromObject(child);
        if (this.tmpBox.isEmpty()) continue;

        this.tmpBox.getSize(this.tmpSize);
        this.tmpBox.getCenter(this.tmpCenter);

        // Long continuous road corridors or bridges (> 280m span) get individual tight frustum bounds
        // so they don't inflate neighborhood 240m chunks.
        if (this.tmpSize.x > 280 || this.tmpSize.z > 280) {
          this.wideItems.push({
            obj: child,
            bounds: this.tmpBox.clone(),
            centerX: this.tmpCenter.x,
            centerZ: this.tmpCenter.z,
            halfDiag: Math.hypot(this.tmpSize.x * 0.5, this.tmpSize.z * 0.5),
            visible: true,
          });
          continue;
        }

        const cx = Math.floor(this.tmpCenter.x / this.chunkSize);
        const cz = Math.floor(this.tmpCenter.z / this.chunkSize);
        const key = `${parent.id}:${cx},${cz}`;
        let list = bucketMap.get(key);
        if (!list) {
          list = [];
          bucketMap.set(key, list);
        }
        list.push(child);
      }

      // Reparent bucketed static items into chunk THREE.Group containers inside `parent`
      for (const [key, objects] of bucketMap.entries()) {
        if (!key.startsWith(`${parent.id}:`)) continue;
        const chunkGroup = new THREE.Group();
        chunkGroup.name = `world_chunk_${key}`;
        const chunkBounds = new THREE.Box3();

        for (let k = 0; k < objects.length; k++) {
          const obj = objects[k];
          parent.remove(obj);
          chunkGroup.add(obj);
          this.tmpBox.setFromObject(obj);
          if (!this.tmpBox.isEmpty()) {
            chunkBounds.union(this.tmpBox);
          }
        }

        chunkBounds.getCenter(this.tmpCenter);
        chunkBounds.getSize(this.tmpSize);
        parent.add(chunkGroup);

        this.chunks.push({
          key,
          group: chunkGroup,
          bounds: chunkBounds,
          centerX: this.tmpCenter.x,
          centerZ: this.tmpCenter.z,
          halfDiag: Math.hypot(this.tmpSize.x * 0.5, this.tmpSize.z * 0.5),
          visible: true,
        });
      }
    }

    if (this.candidateIndices.length < this.chunks.length) {
      this.candidateIndices = new Array(this.chunks.length).fill(0);
      this.candidateDists = new Array(this.chunks.length).fill(0);
    }
  }

  /**
   * Streams & frustum-culls chunks every frame before rendering.
   * Automatically tightens distance & max visible chunk count when `chunkLoadScale < 1.0`.
   */
  public update(
    camera: THREE.Camera,
    carPos: THREE.Vector3,
    opts: WorldChunkUpdateOptions
  ): void {
    const q = Math.max(0.05, Math.min(1.0, opts.qualityFactor));
    const loadScale = Math.max(0.14, Math.min(1.0, opts.chunkLoadScale ?? 1.0));
    const isStrict60 = Boolean(opts.aggressiveDynamic);

    let maxDist = opts.isDynamicMode
      ? isStrict60
        ? 145 + q * 395
        : 220 + q * 420
      : opts.baseMaxDistance ?? 820;

    if (loadScale < 0.98) {
      maxDist = Math.max(isStrict60 ? 120 : 150, maxDist * (0.25 + 0.75 * loadScale));
    }

    const carX = carPos.x;
    const carZ = carPos.z;

    camera.updateMatrixWorld();
    this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

    const baseNear = opts.isDynamicMode ? (isStrict60 ? 28 : 36) : 95;
    const nearKeepRadius = Math.max(18, baseNear * (0.4 + 0.6 * loadScale));

    const applyChunkBudget =
      loadScale < 0.96 || (opts.isDynamicMode && q < (isStrict60 ? 0.92 : 0.75));
    const budgetFactor = opts.isDynamicMode ? Math.min(loadScale, 0.22 + q * 0.78) : loadScale;
    const maxVisibleChunks = applyChunkBudget
      ? isStrict60
        ? Math.max(6, Math.round(6 + budgetFactor * 36))
        : Math.max(10, Math.round(10 + budgetFactor * 46))
      : this.chunks.length;

    let candidateCount = 0;

    for (let i = 0; i < this.chunks.length; i++) {
      const ch = this.chunks[i];
      const dist = Math.hypot(ch.centerX - carX, ch.centerZ - carZ) - ch.halfDiag;
      let shouldShow = false;
      if (dist <= nearKeepRadius) {
        shouldShow = true;
      } else if (dist <= maxDist) {
        shouldShow = this.frustum.intersectsBox(ch.bounds);
      }

      if (!applyChunkBudget) {
        if (ch.visible !== shouldShow) {
          ch.visible = shouldShow;
          ch.group.visible = shouldShow;
        }
      } else if (!shouldShow) {
        if (ch.visible) {
          ch.visible = false;
          ch.group.visible = false;
        }
      } else {
        this.candidateIndices[candidateCount] = i;
        this.candidateDists[candidateCount] = dist;
        candidateCount++;
      }
    }

    if (applyChunkBudget && candidateCount > 0) {
      if (candidateCount <= maxVisibleChunks) {
        for (let k = 0; k < candidateCount; k++) {
          const ch = this.chunks[this.candidateIndices[k]];
          if (!ch.visible) {
            ch.visible = true;
            ch.group.visible = true;
          }
        }
      } else {
        // Partial selection sort for nearest `maxVisibleChunks` (zero heap allocation)
        for (let a = 0; a < maxVisibleChunks; a++) {
          let bestPos = a;
          let bestD = this.candidateDists[a];
          for (let b = a + 1; b < candidateCount; b++) {
            if (this.candidateDists[b] < bestD) {
              bestD = this.candidateDists[b];
              bestPos = b;
            }
          }
          if (bestPos !== a) {
            const tmpIdx = this.candidateIndices[a];
            this.candidateIndices[a] = this.candidateIndices[bestPos];
            this.candidateIndices[bestPos] = tmpIdx;

            const tmpDist = this.candidateDists[a];
            this.candidateDists[a] = this.candidateDists[bestPos];
            this.candidateDists[bestPos] = tmpDist;
          }
        }

        for (let k = 0; k < candidateCount; k++) {
          const ch = this.chunks[this.candidateIndices[k]];
          const keep = k < maxVisibleChunks;
          if (ch.visible !== keep) {
            ch.visible = keep;
            ch.group.visible = keep;
          }
        }
      }
    }

    // Keep major continuous road corridors slightly further than buildings so roads never vanish ahead
    const wideMaxDist = isStrict60
      ? Math.max(210, maxDist * 1.2 + 75)
      : Math.max(260, maxDist * 1.28 + 110);
    for (let i = 0; i < this.wideItems.length; i++) {
      const wi = this.wideItems[i];
      const dist = Math.hypot(wi.centerX - carX, wi.centerZ - carZ) - wi.halfDiag;
      let shouldShow = false;
      if (dist <= nearKeepRadius) {
        shouldShow = true;
      } else if (dist <= wideMaxDist) {
        shouldShow = this.frustum.intersectsBox(wi.bounds);
      }
      if (wi.visible !== shouldShow) {
        wi.visible = shouldShow;
        wi.obj.visible = shouldShow;
      }
    }
  }

  /**
   * Optional helper during planar reflection RT render: skips far chunks (> 240m) to cut reflection GPU cost 3x.
   */
  public applyReflectionRange(carPos: THREE.Vector3, maxReflDist = 250): void {
    const carX = carPos.x;
    const carZ = carPos.z;
    for (let i = 0; i < this.chunks.length; i++) {
      const ch = this.chunks[i];
      if (!ch.visible) continue;
      const dist = Math.hypot(ch.centerX - carX, ch.centerZ - carZ) - ch.halfDiag;
      if (dist > maxReflDist) {
        ch.group.visible = false;
      }
    }
  }

  public restoreAfterReflection(): void {
    for (let i = 0; i < this.chunks.length; i++) {
      const ch = this.chunks[i];
      ch.group.visible = ch.visible;
    }
  }

  public get stats(): { totalChunks: number; wideItems: number } {
    return {
      totalChunks: this.chunks.length,
      wideItems: this.wideItems.length,
    };
  }
}
