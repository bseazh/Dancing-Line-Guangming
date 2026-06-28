import * as THREE from 'three';
import { DancingLine } from '../entities/DancingLine';
import { RoadGenerator } from '../systems/RoadGenerator';
import { EnvironmentProps } from '../systems/EnvironmentProps';
import { RoadTextureSystem } from '../systems/RoadTextureSystem';
import { LandmarkSystem } from '../systems/LandmarkSystem';
import { CameraAnimator } from '../systems/CameraAnimator';
import { MusicSystem } from '../systems/MusicSystem';
import { HudOverlay } from '../systems/HudOverlay';
import { parseCssColor } from '../utils/colorUtils';
import type { LevelData } from '../types/LevelData';

export class DancingLineGame {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  private line: DancingLine;
  private roadGenerator: RoadGenerator;
  private environmentProps: EnvironmentProps;
  private roadTextureSystem: RoadTextureSystem;
  private landmarkSystem: LandmarkSystem;
  private cameraAnimator: CameraAnimator;
  private musicSystem: MusicSystem;
  private hudOverlay: HudOverlay;

  private currentLevel: LevelData | null = null;
  private hitTimeIndex = 0;
  private isPlaying = false;
  private isPaused = false;
  private lastFrameTime = 0;
  private levelEndTimer: ReturnType<typeof setTimeout> | null = null;
  private mode: 'auto' | 'game' = 'auto';
  private trackEndZ = Infinity;
  private disposed = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.line = new DancingLine(this.scene);

    this.roadTextureSystem = new RoadTextureSystem(2048, 2048);
    this.roadGenerator = new RoadGenerator(this.scene);
    this.environmentProps = new EnvironmentProps(this.scene);
    this.landmarkSystem = new LandmarkSystem(this.scene);
    this.cameraAnimator = new CameraAnimator(this.camera);
    this.musicSystem = new MusicSystem(0);
    this.hudOverlay = new HudOverlay();

    this.setupScene();
    this.setupInput();
    this.resize();
    window.addEventListener('resize', this.onResize);

    if (import.meta.env.DEV) (window as any).__dlRenderer = this.renderer;
  }

  private readonly onResize = (): void => {
    this.resize();
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Space' && this.isPlaying && !this.isPaused && this.mode === 'game') {
      e.preventDefault();
      this.line.turn();
    }
    if (e.code === 'KeyP') {
      this.isPaused ? this.resume() : this.pause();
    }
  };

  private readonly onCanvasPointerDown = (): void => {
    if (this.isPlaying && !this.isPaused && this.mode === 'game') {
      this.line.turn();
    }
  };

  async loadLevel(level: LevelData, mode: 'auto' | 'game' = 'auto'): Promise<void> {
    this.currentLevel = level;
    this.mode = mode;
    this.hitTimeIndex = 0;
    if (this.levelEndTimer) { clearTimeout(this.levelEndTimer); this.levelEndTimer = null; }

    this.line.setColor(level.lineColor);
    this.line.reset();
    this.roadTextureSystem.setSceneImages(level.sceneImages);
    this.landmarkSystem.setLandmarks(level.landmarks);
    this.cameraAnimator.setCameraEvents(level.cameraEvents);
    this.hudOverlay.setLevel(level.mapEvents, level.lineColor);

    this.roadGenerator.generate(level.hitTimes, this.line.speed, level.track, level.background.ground ? parseCssColor(level.background.ground) : undefined);
    this.line.setHeightSampler((d) => this.roadGenerator.heightAt(d));
    this.trackEndZ = this.computeTrackEndZ();

    this.scene.background = this.makeSkyTexture(level.background.top, level.background.bottom);
    // fog color = brightened horizon tone (not the near-black bottom) + lower density,
    // so distant track fades into haze instead of going black
    const fogColor = new THREE.Color(parseCssColor(level.background.top))
      .lerp(new THREE.Color(parseCssColor(level.background.bottom)), 0.4)
      .multiplyScalar(1.25);
    this.scene.fog = new THREE.FogExp2(fogColor.getHex(), 0.0042);

    // load GLB roadside props (preload once, then scatter along the track)
    try {
      await this.environmentProps.preload();
      this.environmentProps.populate(this.roadGenerator.segments);
    } catch (e) {
      console.warn('环境模型加载失败，继续无环境装饰', e);
    }

    if (level.musicFile) {
      try {
        await this.musicSystem.load(level.musicFile);
      } catch (e) {
        console.warn('音乐加载失败，继续无音乐游戏');
      }
    }

    console.log(`✓ 关卡加载完成: ${level.title}`);
  }

  start(): void {
    if (!this.currentLevel) {
      console.error('请先加载关卡！');
      return;
    }

    this.isPlaying = true;
    this.isPaused = false;
    this.lastFrameTime = performance.now();
    this.hudOverlay.show();
    this.musicSystem.play();
    this.animate();
  }

  pause(): void {
    this.isPaused = true;
    this.musicSystem.pause();
  }

  resume(): void {
    this.isPaused = false;
    this.musicSystem.resume();
    this.lastFrameTime = performance.now();
  }

  /** 0..1 fraction of the track the line has travelled. */
  getProgress(): number {
    const total = this.roadGenerator.totalDist;
    if (total <= 0) return 0;
    return Math.min(1, this.line.traveledDist / total);
  }

  private animate = (): void => {
    if (!this.isPlaying) return;
    requestAnimationFrame(this.animate);

    const now = performance.now();
    const delta = Math.min((now - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = now;

    if (this.isPaused) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const gameTime = this.musicSystem.getGameTime();

    if (this.mode === 'auto') {
      // auto demo: turn automatically at each scripted hit time
      if (this.currentLevel && this.hitTimeIndex < this.currentLevel.hitTimes.length) {
        const nextHitTime = this.currentLevel.hitTimes[this.hitTimeIndex];
        if (gameTime >= nextHitTime) {
          this.line.turn();
          this.hitTimeIndex++;
        }
      } else if (this.currentLevel && !this.levelEndTimer) {
        // all turns done — end level after 2s grace period
        this.levelEndTimer = setTimeout(() => {
          this.isPlaying = false;
          this.showEndScreen();
        }, 2000);
      }
    } else {
      // game challenge: only the player's spacebar/click turns the line.
      // reaching the end of the track wins the level.
      if (this.line.position.z >= this.trackEndZ && !this.levelEndTimer) {
        this.levelEndTimer = setTimeout(() => {
          this.isPlaying = false;
          this.showEndScreen();
        }, 400);
      }
    }

    this.line.update(delta);
    this.roadGenerator.update(gameTime);
    this.roadTextureSystem.update(gameTime, delta * 1000);
    this.landmarkSystem.update(gameTime, this.line.position);
    this.cameraAnimator.update(gameTime, this.line.position, delta * 1000);
    this.hudOverlay.update(gameTime, this.getProgress());

    // collision only in game challenge mode — auto demo runs freely
    if (this.mode === 'game' && this.roadGenerator.checkBoundary(this.line.position)) {
      this.isPlaying = false;
      this.musicSystem.pause();
      this.showCrashScreen();
    }

    if (this.musicSystem.isEnded()) {
      this.isPlaying = false;
      this.showEndScreen();
    }

    this.renderer.render(this.scene, this.camera);
  };

  private setupScene(): void {
    // hemisphere light — sky/ground gradient, no harsh shadows
    const hemi = new THREE.HemisphereLight(0x9bbdff, 0x3d5c3a, 0.9);
    this.scene.add(hemi);

    // key directional light with shadows
    const dir = new THREE.DirectionalLight(0xfff5e0, 1.6);
    dir.position.set(30, 60, 20);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 300;
    dir.shadow.camera.left = -50;
    dir.shadow.camera.right = 50;
    dir.shadow.camera.top = 50;
    dir.shadow.camera.bottom = -50;
    dir.shadow.bias = -0.001;
    this.scene.add(dir);

    // fill from opposite side
    const fill = new THREE.DirectionalLight(0x8899cc, 0.5);
    fill.position.set(-20, 15, -10);
    this.scene.add(fill);

    // tone mapping for richer colors
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  private skyTexture: THREE.CanvasTexture | null = null;

  /** Vertical gradient sky backdrop (top → bright horizon glow → horizon), used as scene.background. */
  private makeSkyTexture(top: string, bottom: string): THREE.CanvasTexture {
    if (this.skyTexture) { this.skyTexture.dispose(); this.skyTexture = null; }
    const c = document.createElement('canvas');
    c.width = 16; c.height = 256;
    const ctx = c.getContext('2d')!;
    // brightened horizon tone sits between top & bottom so the lower sky glows instead of going black
    const horizon = new THREE.Color(parseCssColor(top))
      .lerp(new THREE.Color(parseCssColor(bottom)), 0.5)
      .multiplyScalar(1.5);
    const horizonCss = '#' + horizon.getHexString();
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.0, top);
    g.addColorStop(0.62, horizonCss);
    g.addColorStop(0.82, top);
    g.addColorStop(1.0, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    this.skyTexture = tex;
    return tex;
  }

  private computeTrackEndZ(): number {
    const segs = this.roadGenerator.segments;
    if (!segs.length) return Infinity;
    const last = segs[segs.length - 1];
    // the final segment is a long tail beyond the last turn; stop a bit before its end
    return last.center.z + last.dir.z * (last.length / 2) - 3;
  }

  private setupInput(): void {
    window.addEventListener('keydown', this.onKeyDown);
    this.canvas.addEventListener('pointerdown', this.onCanvasPointerDown);
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  private showCrashScreen(): void {
    this.hudOverlay.hide();
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.8);z-index:2000;';
    el.innerHTML = `
      <div style="background:rgba(25,8,8,0.97);border-radius:16px;padding:40px 48px;text-align:center;color:#fff;font-family:'PingFang SC',sans-serif;min-width:300px;border:1px solid rgba(255,60,60,0.3);">
        <div style="font-size:42px;margin-bottom:8px;">💥</div>
        <div style="font-size:24px;font-weight:bold;color:#ff5555;margin-bottom:8px;">出界了！</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:28px;">${this.currentLevel?.title ?? ''}</div>
        <button id="dl-retry" style="padding:12px 28px;font-size:15px;background:${this.currentLevel?.lineColor ?? '#ff4d5f'};color:#fff;border:none;border-radius:8px;cursor:pointer;margin:0 8px;">再试一次</button>
        <button id="dl-back2" style="padding:12px 28px;font-size:15px;background:rgba(255,255,255,0.12);color:#fff;border:none;border-radius:8px;cursor:pointer;margin:0 8px;">选择关卡</button>
      </div>`;
    document.body.appendChild(el);
    el.querySelector('#dl-retry')!.addEventListener('click', () => { el.remove(); this.restart(); });
    el.querySelector('#dl-back2')!.addEventListener('click', () => { el.remove(); window.dispatchEvent(new CustomEvent('dl-back')); });
  }

  private showEndScreen(): void {
    this.hudOverlay.hide();
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);z-index:2000;';
    el.innerHTML = `
      <div style="background:rgba(15,15,25,0.96);border-radius:16px;padding:40px 48px;text-align:center;color:#fff;font-family:'PingFang SC',sans-serif;min-width:300px;">
        <div style="font-size:26px;font-weight:bold;color:#79ff9b;margin-bottom:10px;">关卡完成！</div>
        <div style="font-size:15px;color:rgba(255,255,255,0.6);margin-bottom:28px;">${this.currentLevel?.title ?? ''}</div>
        <button id="dl-restart" style="padding:12px 28px;font-size:15px;background:${this.currentLevel?.lineColor ?? '#ff4d5f'};color:#fff;border:none;border-radius:8px;cursor:pointer;margin:0 8px;">再玩一次</button>
        <button id="dl-back" style="padding:12px 28px;font-size:15px;background:rgba(255,255,255,0.12);color:#fff;border:none;border-radius:8px;cursor:pointer;margin:0 8px;">选择关卡</button>
      </div>`;
    document.body.appendChild(el);
    el.querySelector('#dl-restart')!.addEventListener('click', () => {
      el.remove();
      this.restart();
    });
    el.querySelector('#dl-back')!.addEventListener('click', () => {
      el.remove();
      window.dispatchEvent(new CustomEvent('dl-back'));
    });
  }

  private restart(): void {
    if (!this.currentLevel) return;
    this.hitTimeIndex = 0;
    if (this.levelEndTimer) { clearTimeout(this.levelEndTimer); this.levelEndTimer = null; }
    this.line.reset();
    this.roadTextureSystem.setSceneImages(this.currentLevel.sceneImages);
    this.landmarkSystem.setLandmarks(this.currentLevel.landmarks);
    this.roadGenerator.generate(this.currentLevel.hitTimes, this.line.speed, this.currentLevel.track, this.currentLevel.background.ground ? parseCssColor(this.currentLevel.background.ground) : undefined);
    this.line.setHeightSampler((d) => this.roadGenerator.heightAt(d));
    this.trackEndZ = this.computeTrackEndZ();
    this.environmentProps.populate(this.roadGenerator.segments);
    this.cameraAnimator.setCameraEvents(this.currentLevel.cameraEvents);
    this.hudOverlay.setLevel(this.currentLevel.mapEvents, this.currentLevel.lineColor);
    this.start();
  }

  returnToMenu(): void {
    this.isPlaying = false;
    this.isPaused = false;
    this.hitTimeIndex = 0;
    if (this.levelEndTimer) { clearTimeout(this.levelEndTimer); this.levelEndTimer = null; }
    this.musicSystem.pause();
    this.hudOverlay.hide();
    this.landmarkSystem.setLandmarks([]);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.isPlaying = false;
    if (this.levelEndTimer) { clearTimeout(this.levelEndTimer); this.levelEndTimer = null; }
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    this.canvas.removeEventListener('pointerdown', this.onCanvasPointerDown);
    this.line.dispose();
    this.roadGenerator.dispose();
    this.environmentProps.dispose();
    this.roadTextureSystem.dispose();
    this.landmarkSystem.dispose();
    this.musicSystem.dispose();
    this.hudOverlay.dispose();
    this.renderer.dispose();
  }
}
