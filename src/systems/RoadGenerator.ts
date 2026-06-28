import * as THREE from 'three';
import { parseCssColor } from '../utils/colorUtils';

export const ROAD_WIDTH = 3.2;
export const ROAD_HALF = ROAD_WIDTH / 2;

interface TrackColors {
  base: string; dark: string; inner: string; edge: string; glow: string;
}

export interface TrackSegment {
  center: THREE.Vector3;
  dir: THREE.Vector3;
  perp: THREE.Vector3;
  length: number;
}

export class RoadGenerator {
  private meshes: THREE.Mesh[] = [];
  private ownedMaterials = new WeakSet<THREE.Material>();
  public segments: TrackSegment[] = [];
  public totalDist = 0;
  private labelSprites: THREE.Sprite[] = [];

  heightAt(_dist: number): number { return 0; }

  constructor(private scene: THREE.Scene) {}

  update(_gameTime: number): void {}

  generate(hitTimes: number[], speed: number, colors: TrackColors, groundHex?: number): void {
    this.clear();

    // resolve rgba→hex for Three.js
    const baseHex  = parseCssColor(colors.base);
    const darkHex  = parseCssColor(colors.dark);
    const innerHex = parseCssColor(colors.inner);
    const edgeHex  = parseCssColor(colors.edge);
    const glowHex  = parseCssColor(colors.glow);

    const roadMat  = new THREE.MeshStandardMaterial({
      color: baseHex, roughness: 0.88, metalness: 0.08, side: THREE.DoubleSide
    });
    const innerMat = new THREE.MeshStandardMaterial({
      color: innerHex, roughness: 0.6, transparent: true, opacity: 0.92, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    const glowMat  = new THREE.MeshStandardMaterial({
      color: glowHex, emissive: glowHex, emissiveIntensity: 0.9,
      roughness: 0.4, metalness: 0.1, side: THREE.DoubleSide
    });
    const edgeMat  = new THREE.MeshStandardMaterial({
      color: edgeHex, emissive: edgeHex, emissiveIntensity: 2.0,
      roughness: 0.15, metalness: 0.5, side: THREE.DoubleSide
    });

    // ── 1. Build the centerline polyline from the music sheet ─────────────
    this.segments = [];
    const pts: THREE.Vector3[] = [];
    const ptCum: number[] = [0];   // cumulative forward distance at each point
    const pos = new THREE.Vector3(0, 0, 0);
    const dir = new THREE.Vector3(1, 0, 1).normalize();
    let prevTime = 0;
    let cumDist = 0;
    const times = [...hitTimes, hitTimes[hitTimes.length - 1] + 5000];

    pts.push(pos.clone());
    for (const t of times) {
      const dist = Math.max(0.5, ((t - prevTime) / 1000) * speed);
      const perp = new THREE.Vector3(-dir.z, 0, dir.x);
      const mid  = pos.clone().addScaledVector(dir, dist / 2);
      this.segments.push({ center: mid.clone(), dir: dir.clone(), perp: perp.clone(), length: dist });

      pos.addScaledVector(dir, dist);
      cumDist += dist;
      pts.push(pos.clone());
      ptCum.push(cumDist);
      dir.x = -dir.x;
      prevTime = t;
    }

    this.totalDist = cumDist;

    // ── 2. Offset polylines with mitered corners (no crossing) ────────────
    const wallW   = 0.28;
    const roadTop = 0.08;
    const wallTop = 0.55;
    const innerW  = ROAD_WIDTH * 0.28;

    const leftRoad  = this.offsetPolyline(pts,  ROAD_HALF);
    const rightRoad = this.offsetPolyline(pts, -ROAD_HALF);
    const innerL    = this.offsetPolyline(pts,  innerW);
    const innerR    = this.offsetPolyline(pts, -innerW);
    const lWallIn   = this.offsetPolyline(pts,  ROAD_HALF);
    const lWallOut  = this.offsetPolyline(pts,  ROAD_HALF + wallW);
    const rWallIn   = this.offsetPolyline(pts, -ROAD_HALF);
    const rWallOut  = this.offsetPolyline(pts, -(ROAD_HALF + wallW));

    // ── 3. Build continuous ribbon + wall geometry ────────────────────────
    this.addRibbon(leftRoad, rightRoad, roadTop, roadMat);          // road surface
    this.addRibbon(innerL, innerR, roadTop + 0.025, innerMat);      // glowing inner strip
    this.addWall(lWallIn, lWallOut, 0, wallTop, glowMat, edgeMat);  // left curb
    this.addWall(rWallIn, rWallOut, 0, wallTop, glowMat, edgeMat);  // right curb

    // ── 3b. Progress arches every 10% with floating percent labels ────────
    this.buildProgressArches(pts, ptCum, cumDist, edgeHex);

    // ── 4. Atmosphere lights along the path ───────────────────────────────
    // ── 4. Atmosphere: a couple of cheap edge accents (no per-segment lights) ──
    // emissive curb materials already glow; dynamic point lights are too costly
    // per-pixel in WebGL forward rendering, so we skip them.

    this.buildGround(pos, darkHex, groundHex);
    // roadside props are now real GLB models handled by EnvironmentProps

    [roadMat, innerMat, glowMat, edgeMat].forEach((m) => this.ownedMaterials.add(m));
  }

  /** Offset a polyline laterally by `dist` (signed), using miter joins at corners. */
  private offsetPolyline(pts: THREE.Vector3[], dist: number): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    const N = pts.length;
    for (let i = 0; i < N; i++) {
      if (i === 0) {
        const d = pts[1].clone().sub(pts[0]).normalize();
        const n = new THREE.Vector3(-d.z, 0, d.x);
        out.push(pts[i].clone().addScaledVector(n, dist));
      } else if (i === N - 1) {
        const d = pts[i].clone().sub(pts[i - 1]).normalize();
        const n = new THREE.Vector3(-d.z, 0, d.x);
        out.push(pts[i].clone().addScaledVector(n, dist));
      } else {
        const dIn  = pts[i].clone().sub(pts[i - 1]).normalize();
        const dOut = pts[i + 1].clone().sub(pts[i]).normalize();
        const nIn  = new THREE.Vector3(-dIn.z, 0, dIn.x);
        const nOut = new THREE.Vector3(-dOut.z, 0, dOut.x);
        const m = nIn.clone().add(nOut).normalize();
        const denom = m.dot(nIn);
        const len = Math.abs(denom) < 1e-3 ? dist : dist / denom;
        out.push(pts[i].clone().addScaledVector(m, len));
      }
    }
    return out;
  }

  /** Horizontal ribbon between two equal-length polylines; yOff is added above each vertex's baked height. */
  private addRibbon(A: THREE.Vector3[], B: THREE.Vector3[], yOff: number, mat: THREE.Material): void {
    const positions: number[] = [];
    for (let i = 0; i < A.length - 1; i++) {
      const a0 = A[i], a1 = A[i + 1], b0 = B[i], b1 = B[i + 1];
      positions.push(a0.x, a0.y + yOff, a0.z,  b0.x, b0.y + yOff, b0.z,  b1.x, b1.y + yOff, b1.z);
      positions.push(a0.x, a0.y + yOff, a0.z,  b1.x, b1.y + yOff, b1.z,  a1.x, a1.y + yOff, a1.z);
    }
    this.pushGeometry(positions, mat);
  }

  /** Vertical ribbon following a polyline, from each vertex's height+yLow up to height+yHigh. */
  private addVerticalRibbon(poly: THREE.Vector3[], yLow: number, yHigh: number, mat: THREE.Material): void {
    const positions: number[] = [];
    for (let i = 0; i < poly.length - 1; i++) {
      const p0 = poly[i], p1 = poly[i + 1];
      const l0 = p0.y + yLow, h0 = p0.y + yHigh, l1 = p1.y + yLow, h1 = p1.y + yHigh;
      positions.push(p0.x, l0, p0.z,  p0.x, h0, p0.z,  p1.x, h1, p1.z);
      positions.push(p0.x, l0, p0.z,  p1.x, h1, p1.z,  p1.x, l1, p1.z);
    }
    this.pushGeometry(positions, mat);
  }

  /** A curb: inner & outer vertical faces (side material) plus a top cap (edge material). */
  private addWall(innerPoly: THREE.Vector3[], outerPoly: THREE.Vector3[], yLow: number, yHigh: number, sideMat: THREE.Material, capMat: THREE.Material): void {
    this.addVerticalRibbon(innerPoly, yLow, yHigh, sideMat);
    this.addVerticalRibbon(outerPoly, yLow, yHigh, sideMat);
    this.addRibbon(innerPoly, outerPoly, yHigh, capMat);
  }

  private pushGeometry(positions: number[], mat: THREE.Material): void {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);
  }

  checkBoundary(pos: THREE.Vector3): boolean {
    let minSide = Infinity;
    for (const seg of this.segments) {
      const toPos = pos.clone().sub(seg.center);
      const along = Math.abs(toPos.dot(seg.dir));
      if (along > seg.length / 2 + 0.4) continue;
      const side = Math.abs(toPos.dot(seg.perp));
      if (side < minSide) minSide = side;
    }
    return minSide > ROAD_HALF + 0.15;
  }

  /** Glowing gateway arches at each 10% mark, each with a floating percent label. */
  private buildProgressArches(pts: THREE.Vector3[], ptCum: number[], total: number, edgeHex: number): void {
    if (total <= 1) return;
    const archMat = new THREE.MeshStandardMaterial({
      color: edgeHex, emissive: edgeHex, emissiveIntensity: 1.6, roughness: 0.3, metalness: 0.4
    });
    this.ownedMaterials.add(archMat);

    const sampleAt = (dist: number): THREE.Vector3 => {
      for (let i = 1; i < ptCum.length; i++) {
        if (dist <= ptCum[i]) {
          const u = (dist - ptCum[i - 1]) / Math.max(1e-3, ptCum[i] - ptCum[i - 1]);
          return pts[i - 1].clone().lerp(pts[i], u);
        }
      }
      return pts[pts.length - 1].clone();
    };
    const dirAt = (i0: number): THREE.Vector3 => {
      const a = Math.min(i0, pts.length - 2);
      return pts[a + 1].clone().sub(pts[a]).setY(0).normalize();
    };

    const W = ROAD_HALF + 0.9;
    const postH = 3.4;
    for (let pct = 10; pct <= 90; pct += 10) {
      const dist = (pct / 100) * total;
      const c = sampleAt(dist);
      // nearest index for direction
      let ni = 0; for (let i = 0; i < ptCum.length; i++) { if (ptCum[i] <= dist) ni = i; }
      const d = dirAt(ni);
      const perp = new THREE.Vector3(-d.z, 0, d.x);

      for (const side of [-1, 1] as const) {
        const base = c.clone().addScaledVector(perp, side * W);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, postH, 0.22), archMat);
        post.position.set(base.x, base.y + postH / 2, base.z);
        post.castShadow = true;
        this.scene.add(post); this.meshes.push(post);
      }
      // top beam across the road
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, W * 2), archMat);
      beam.position.set(c.x, c.y + postH, c.z);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), perp);
      this.scene.add(beam); this.meshes.push(beam);

      // floating percent label above the beam
      const sprite = this.makeLabelSprite(`${pct}%`);
      sprite.position.set(c.x, c.y + postH + 1.1, c.z);
      this.scene.add(sprite); this.labelSprites.push(sprite);
    }
  }

  private makeLabelSprite(text: string): THREE.Sprite {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 128);
    ctx.font = 'bold 76px "PingFang SC", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(text, 128, 64);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 128, 64);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(3.2, 1.6, 1);
    return sprite;
  }

  private buildGround(trackEnd: THREE.Vector3, darkHex: number, groundHex?: number): void {
    // prefer an explicit, pleasant ground tone (passed from the level); otherwise derive a
    // brightened version of the track's dark color so it never reads as near-black
    let groundColor: THREE.Color;
    if (groundHex !== undefined) {
      groundColor = new THREE.Color(groundHex);
    } else {
      groundColor = new THREE.Color(darkHex).multiplyScalar(3.0);
      if (groundColor.r + groundColor.g + groundColor.b < 0.4) groundColor.set(0x24402c);
    }

    const geo = new THREE.PlaneGeometry(2000, 2000);
    const mat = new THREE.MeshStandardMaterial({ color: groundColor, roughness: 0.95, metalness: 0.0 });
    this.ownedMaterials.add(mat);
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    // sit at y=0, road slab starts at y=0 so road sits on top
    ground.position.set(trackEnd.x / 2, 0.0, trackEnd.z / 2);
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.meshes.push(ground);
  }

  private clear(): void {
    for (const m of this.meshes) {
      this.scene.remove(m);
      m.geometry.dispose();
      const materials = Array.isArray(m.material) ? m.material : [m.material];
      for (const material of materials) {
        if (this.ownedMaterials.has(material)) material.dispose();
      }
    }
    // dispose floating percent labels
    for (const s of this.labelSprites) {
      this.scene.remove(s);
      const sm = s.material as THREE.SpriteMaterial;
      sm.map?.dispose();
      sm.dispose();
    }
    this.labelSprites = [];
    // remove point lights added for atmosphere
    const toRemove: THREE.Object3D[] = [];
    this.scene.traverse(obj => { if (obj instanceof THREE.PointLight) toRemove.push(obj); });
    toRemove.forEach(l => this.scene.remove(l));
    this.meshes = [];
    this.segments = [];
  }

  dispose(): void { this.clear(); }
}
