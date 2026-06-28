import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { TrackSegment } from './RoadGenerator';
import { ROAD_HALF } from './RoadGenerator';

const BASE = import.meta.env.BASE_URL ?? '/';

// file path is relative to public/models/, including kit subfolder
interface PropSpec { file: string; height: number; }

const CATALOG = {
  trees: [
    { file: 'racing/treeLarge', height: 5.5 },
    { file: 'racing/treeSmall', height: 3.5 },
    { file: 'survival/tree', height: 4.5 },
    { file: 'survival/tree-tall', height: 6 },
    { file: 'survival/tree-autumn', height: 5 },
    { file: 'castle/tree-large', height: 5.5 },
    { file: 'castle/tree-small', height: 3.5 },
  ] as PropSpec[],
  rocks: [
    { file: 'survival/rock-a', height: 1.0 },
    { file: 'survival/rock-b', height: 1.2 },
    { file: 'survival/rock-c', height: 0.8 },
    { file: 'castle/rocks-large', height: 1.6 },
    { file: 'castle/rocks-small', height: 0.9 },
  ] as PropSpec[],
  grass: [
    { file: 'racing/grass', height: 0.6 },
    { file: 'survival/grass-large', height: 0.9 },
    { file: 'survival/patch-grass', height: 0.4 },
  ] as PropSpec[],
  posts: [
    { file: 'racing/lightPostLarge', height: 4 },
    { file: 'racing/lightPostModern', height: 3.6 },
    { file: 'racing/lightRed', height: 3.2 },
    { file: 'survival/signpost', height: 2.2 },
  ] as PropSpec[],
  fences: [
    { file: 'racing/fenceStraight', height: 1.0 },
    { file: 'racing/fenceCurved', height: 1.1 },
    { file: 'racing/barrierRed', height: 0.7 },
    { file: 'racing/barrierWhite', height: 0.7 },
    { file: 'racing/pylon', height: 0.7 },
  ] as PropSpec[],
  banners: [
    { file: 'racing/bannerTowerGreen', height: 4 },
    { file: 'racing/bannerTowerRed', height: 4 },
    { file: 'racing/flagGreen', height: 3 },
    { file: 'racing/flagRed', height: 3 },
    { file: 'racing/flagCheckers', height: 3 },
    { file: 'castle/flag-banner-long', height: 4 },
  ] as PropSpec[],
  landmarks: [
    { file: 'racing/grandStand', height: 5 },
    { file: 'racing/grandStandCovered', height: 6 },
    { file: 'racing/tent', height: 3.5 },
    { file: 'racing/tentLong', height: 3.5 },
    { file: 'racing/billboard', height: 5 },
    { file: 'castle/tower-square', height: 9 },
    { file: 'castle/tower-hexagon-base', height: 7 },
  ] as PropSpec[],
};

// one renderable piece of a template: shared geometry + material + local transform
interface TemplatePart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrix: THREE.Matrix4;
}

export class EnvironmentProps {
  private loader = new GLTFLoader();
  private templates = new Map<string, TemplatePart[]>();
  private instanced: THREE.InstancedMesh[] = [];
  private loaded = false;

  constructor(private scene: THREE.Scene) {}

  /** Preload every GLB once, baking each into normalized geometry+material parts. */
  async preload(): Promise<void> {
    if (this.loaded) return;
    const all = Object.values(CATALOG).flat();
    await Promise.all(all.map((spec) => this.loadOne(spec)));
    this.loaded = true;
  }

  private loadOne(spec: PropSpec): Promise<void> {
    if (this.templates.has(spec.file)) return Promise.resolve();
    const url = `${BASE}models/${spec.file}.glb`;
    return new Promise((resolve) => {
      this.loader.load(
        url,
        (gltf) => {
          const root = gltf.scene;
          root.updateMatrixWorld(true);

          // normalize: scale to target height, recenter x/z, sit min-y on ground
          const box = new THREE.Box3().setFromObject(root);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);
          const s = size.y > 1e-4 ? spec.height / size.y : 1;
          const norm = new THREE.Matrix4()
            .makeTranslation(-center.x * s, -box.min.y * s, -center.z * s)
            .multiply(new THREE.Matrix4().makeScale(s, s, s));

          const parts: TemplatePart[] = [];
          root.updateMatrixWorld(true);
          root.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) return;
            const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
            parts.push({
              geometry: mesh.geometry,
              material: mat,
              matrix: norm.clone().multiply(mesh.matrixWorld),
            });
          });
          this.templates.set(spec.file, parts);
          resolve();
        },
        undefined,
        () => { console.warn('GLB load failed:', url); resolve(); }
      );
    });
  }

  /** Min distance from a point to any road segment surface (clamped to segment extent). */
  private distToRoad(p: THREE.Vector3, segments: TrackSegment[]): number {
    let min = Infinity;
    for (const seg of segments) {
      const dx = p.x - seg.center.x;
      const dz = p.z - seg.center.z;
      let along = dx * seg.dir.x + dz * seg.dir.z;
      const half = seg.length / 2;
      if (along > half) along = half; else if (along < -half) along = -half;
      const cx = seg.center.x + seg.dir.x * along;
      const cz = seg.center.z + seg.dir.z * along;
      const d = Math.hypot(p.x - cx, p.z - cz);
      if (d < min) min = d;
    }
    return min;
  }

  /** Scatter props ONLY along both sides of the track, never on/over the road. */
  populate(segments: TrackSegment[]): void {
    this.clear();
    if (!segments.length) return;
    const rng = this.seededRng(1337);

    const placements = new Map<string, THREE.Matrix4[]>();
    const add = (file: string, m: THREE.Matrix4) => {
      let arr = placements.get(file);
      if (!arr) { arr = []; placements.set(file, arr); }
      arr.push(m);
    };
    const pickFile = (specs: PropSpec[]) => specs[Math.floor(rng() * specs.length)].file;

    const tmp = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();

    // keep everything at least this far from ANY road segment so nothing blocks the line
    const CLEAR = ROAD_HALF + 1.2;

    // 1) Low edge dressing: posts / fences hugging the road edge, facing the centerline
    for (const seg of segments) {
      const count = Math.max(1, Math.floor(seg.length / 7));
      for (let i = 0; i < count; i++) {
        const along = ((i + 0.5) / count - 0.5) * seg.length;
        for (const side of [-1, 1] as const) {
          if (rng() > 0.5) continue;
          pos.copy(seg.center)
            .addScaledVector(seg.dir, along)
            .addScaledVector(seg.perp, side * (ROAD_HALF + 1.4));
          pos.y = 0;
          if (this.distToRoad(pos, segments) < CLEAR) continue;
          const yaw = Math.atan2(-seg.perp.x * side, -seg.perp.z * side);
          q.setFromAxisAngle(up, yaw);
          scl.setScalar(1);
          tmp.compose(pos, q, scl);
          add(pickFile(rng() > 0.45 ? CATALOG.posts : CATALOG.fences), tmp.clone());
        }
      }
    }

    // 2) Sparse scenery set back from both sides (trees/rocks/grass), big items pushed far out
    const DECOR = 220;
    for (let i = 0; i < DECOR; i++) {
      const seg = segments[Math.floor(rng() * segments.length)];
      const side = rng() > 0.5 ? 1 : -1;
      const lat = ROAD_HALF + 2.5 + rng() * rng() * 24;   // bias near-but-not-on the road
      const along = (rng() - 0.5) * seg.length * 0.9;
      pos.copy(seg.center)
        .addScaledVector(seg.dir, along)
        .addScaledVector(seg.perp, side * lat);
      pos.y = 0;
      if (this.distToRoad(pos, segments) < CLEAR) continue;   // skip anything over the road

      const r = rng();
      let cat: PropSpec[];
      const far = this.distToRoad(pos, segments);
      if (far < ROAD_HALF + 4)       cat = r < 0.55 ? CATALOG.grass : CATALOG.rocks;
      else if (r < 0.60)             cat = CATALOG.trees;
      else if (r < 0.78)             cat = CATALOG.rocks;
      else if (r < 0.90)             cat = CATALOG.grass;
      else if (far > 12)             cat = r < 0.5 ? CATALOG.banners : CATALOG.landmarks; // big items only far out
      else                           cat = CATALOG.trees;

      q.setFromAxisAngle(up, rng() * Math.PI * 2);
      scl.setScalar(0.85 + rng() * 0.4);
      tmp.compose(pos, q, scl);
      add(pickFile(cat), tmp.clone());
    }

    // build one InstancedMesh per (template part) — collapses draw calls
    for (const [file, mats] of placements) {
      const parts = this.templates.get(file);
      if (!parts) continue;
      for (const part of parts) {
        const inst = new THREE.InstancedMesh(part.geometry, part.material, mats.length);
        inst.castShadow = false;       // props skip the shadow pass (big perf win)
        inst.receiveShadow = false;
        for (let k = 0; k < mats.length; k++) {
          tmp.multiplyMatrices(mats[k], part.matrix);
          inst.setMatrixAt(k, tmp);
        }
        inst.instanceMatrix.needsUpdate = true;
        inst.frustumCulled = true;
        this.scene.add(inst);
        this.instanced.push(inst);
      }
    }
  }

  private seededRng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  }

  clear(): void {
    for (const inst of this.instanced) {
      this.scene.remove(inst);
      inst.dispose(); // disposes only the instance buffer, not shared geo/mat
    }
    this.instanced = [];
  }

  dispose(): void {
    this.clear();
    const seenGeo = new Set<THREE.BufferGeometry>();
    const seenMat = new Set<THREE.Material>();
    for (const parts of this.templates.values()) {
      for (const p of parts) {
        if (!seenGeo.has(p.geometry)) { p.geometry.dispose(); seenGeo.add(p.geometry); }
        if (!seenMat.has(p.material)) { p.material.dispose(); seenMat.add(p.material); }
      }
    }
    this.templates.clear();
    this.loaded = false;
  }
}
