import * as THREE from 'three';

const SIZE = 0.4;

export class DancingLine {
  public group = new THREE.Group();
  public position = new THREE.Vector3(0, 0.5, 0);
  public direction = new THREE.Vector3(1, 0, 1).normalize();
  public speed = 6;

  private cube: THREE.Mesh;
  private trailMat: THREE.MeshStandardMaterial;
  private segments: THREE.Mesh[] = [];
  private activeSegment: THREE.Mesh | null = null;
  private lastTurnPos = new THREE.Vector3(0, 0.5, 0);

  // road vertical profile sampler (forward distance → centerline height); set per level
  private heightSampler: ((dist: number) => number) | null = null;
  private traveled = 0;
  private readonly rideOffset = 0.42;   // float just above the road surface

  constructor(private scene: THREE.Scene, color = '#ff4d5f') {
    const mat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.6, metalness: 0.2, roughness: 0.4
    });
    this.trailMat = mat.clone();
    this.trailMat.emissiveIntensity = 0.25;
    this.cube = new THREE.Mesh(new THREE.BoxGeometry(SIZE, SIZE, SIZE), mat);
    this.cube.castShadow = true;
    this.group.add(this.cube);
    this.scene.add(this.group);
    this.syncGroup();
  }

  /** Provide the road height sampler so the line stays aligned with the track. */
  setHeightSampler(fn: ((dist: number) => number) | null): void {
    this.heightSampler = fn;
    this.applyHeight();
    this.lastTurnPos.y = this.position.y;
    this.syncGroup();
  }

  private sampleHeight(dist: number): number {
    return (this.heightSampler ? this.heightSampler(dist) : 0) + this.rideOffset;
  }

  private applyHeight(): void {
    this.position.y = this.sampleHeight(this.traveled);
  }

  reset(): void {
    this.position.set(0, 0.5, 0);
    this.direction.set(1, 0, 1).normalize();
    this.traveled = 0;
    this.applyHeight();
    this.lastTurnPos.set(0, this.position.y, 0);
    this.clearTrail();
    this.syncGroup();
  }

  turn(): void {
    if (this.activeSegment) {
      this.segments.push(this.activeSegment);
      this.activeSegment = null;
    }
    // joint cube fills the corner gap between diagonal segments
    const joint = new THREE.Mesh(new THREE.BoxGeometry(SIZE, SIZE, SIZE), this.trailMat);
    joint.position.copy(this.position);
    this.scene.add(joint);
    this.segments.push(joint);
    this.lastTurnPos.copy(this.position);
    this.direction.x = -this.direction.x;
  }

  update(delta: number): void {
    this.position.addScaledVector(this.direction, this.speed * delta);
    this.traveled += this.speed * delta;
    this.applyHeight();
    this.syncGroup();
    this.updateActiveSegment();
  }

  private syncGroup(): void {
    this.group.position.copy(this.position);
    // slope pitch from the height a short step ahead vs behind
    const ahead = this.sampleHeight(this.traveled + 0.6);
    const behind = this.sampleHeight(this.traveled - 0.6);
    const pitch = -Math.atan2(ahead - behind, 1.2);
    this.group.rotation.order = 'YXZ';
    this.group.rotation.y = Math.atan2(this.direction.x, this.direction.z);
    this.group.rotation.x = pitch;
  }

  private updateActiveSegment(): void {
    // remove old active segment geometry
    if (this.activeSegment) {
      this.scene.remove(this.activeSegment);
      this.activeSegment.geometry.dispose();
      this.activeSegment = null;
    }
    const dir = this.position.clone().sub(this.lastTurnPos);
    const len = Math.max(0.01, dir.length());
    const horiz = Math.max(1e-4, Math.hypot(dir.x, dir.z));
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(SIZE, SIZE, len), this.trailMat);
    mesh.position.copy(this.lastTurnPos).lerp(this.position, 0.5);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = Math.atan2(dir.x, dir.z);
    mesh.rotation.x = -Math.atan2(dir.y, horiz);
    this.scene.add(mesh);
    this.activeSegment = mesh;
  }

  private clearTrail(): void {
    if (this.activeSegment) {
      this.scene.remove(this.activeSegment);
      this.activeSegment.geometry.dispose();
      this.activeSegment = null;
    }
    for (const s of this.segments) {
      this.scene.remove(s);
      s.geometry.dispose();
    }
    this.segments = [];
  }

  get traveledDist(): number { return this.traveled; }

  setColor(color: string): void {    (this.cube.material as THREE.MeshStandardMaterial).color.set(color);
    (this.cube.material as THREE.MeshStandardMaterial).emissive.set(color);
    this.trailMat.color.set(color);
    this.trailMat.emissive.set(color);
  }

  dispose(): void {
    this.cube.geometry.dispose();
    (this.cube.material as THREE.Material).dispose();
    this.trailMat.dispose();
    this.clearTrail();
  }
}
