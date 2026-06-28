import * as THREE from 'three';
import type { CameraEvent } from '../types/LevelData';

export class CameraAnimator {
  private cameraEvents: CameraEvent[] = [];
  private currentEventIndex = 0;
  private currentZoom = 1;
  private currentRotate = 0;
  private targetZoom = 1;
  private targetRotate = 0;
  private transitionProgress = 1;
  private transitionDuration = 0;
  private transitionStartTime = 0;

  private readonly baseDistance = 15;
  private readonly baseHeight = 11;
  // keep a steep, consistent downward pitch so roadside props never block the line
  private readonly pitchRatio = 0.9;

  constructor(private camera: THREE.PerspectiveCamera) {}

  setCameraEvents(events: CameraEvent[]): void {
    this.cameraEvents = events;
    this.currentEventIndex = 0;

    if (events.length > 0) {
      const first = events[0];
      this.currentZoom = first.zoom;
      this.currentRotate = first.rotate;
      this.targetZoom = first.zoom;
      this.targetRotate = first.rotate;
    }
  }

  update(gameTime: number, targetPosition: THREE.Vector3, _deltaMs: number): void {
    if (this.currentEventIndex < this.cameraEvents.length) {
      const event = this.cameraEvents[this.currentEventIndex];
      if (gameTime >= event.time) {
        this.startTransition(event);
        this.currentEventIndex++;
      }
    }

    if (this.transitionProgress < 1) {
      const elapsed = Date.now() - this.transitionStartTime;
      this.transitionProgress = Math.min(elapsed / this.transitionDuration, 1);

      const eased = this.easeInOutCubic(this.transitionProgress);
      this.currentZoom = this.lerp(this.currentZoom, this.targetZoom, eased);
      this.currentRotate = this.lerp(this.currentRotate, this.targetRotate, eased);
    }

    this.applyTransform(targetPosition);
  }

  private startTransition(event: CameraEvent): void {
    this.targetZoom = event.zoom;
    this.targetRotate = event.rotate;
    this.transitionDuration = event.transition || 500;
    this.transitionStartTime = Date.now();
    this.transitionProgress = 0;
  }

  private applyTransform(targetPosition: THREE.Vector3): void {
    const distance = this.baseDistance / this.currentZoom;
    // height tracks distance so the downward pitch stays constant (~42°) at every zoom,
    // guaranteeing the camera always looks down over the roadside props
    const height = Math.max(this.baseHeight, distance * this.pitchRatio);

    const angle = this.currentRotate;
    const x = targetPosition.x + Math.sin(angle) * distance;
    const z = targetPosition.z + Math.cos(angle) * distance;

    // ride the camera with the line so track motion stays framed
    this.camera.position.set(x, targetPosition.y + height, z);
    // aim slightly ahead/above the line so more of the upcoming track and sky is framed
    this.camera.lookAt(targetPosition.x, targetPosition.y + 1.5, targetPosition.z);
  }

  private lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}
