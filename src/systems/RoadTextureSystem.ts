import * as THREE from 'three';
import type { SceneImage } from '../types/LevelData';

export class RoadTextureSystem {
  private currentCanvas: HTMLCanvasElement;
  private currentTexture: THREE.CanvasTexture;
  private currentContext: CanvasRenderingContext2D;

  private targetImage: HTMLImageElement | null = null;
  private currentImage: HTMLImageElement | null = null;
  private fadeProgress = 0;
  private isFading = false;
  private fadeDuration = 1500;
  private fadeStartTime = 0;

  private sceneImages: SceneImage[] = [];
  private currentSceneIndex = 0;
  private preloadedImages = new Map<string, HTMLImageElement>();

  constructor(private width = 2048, private height = 2048) {
    this.currentCanvas = document.createElement('canvas');
    this.currentCanvas.width = width;
    this.currentCanvas.height = height;

    const ctx = this.currentCanvas.getContext('2d', { alpha: false, willReadFrequently: false });
    if (!ctx) throw new Error('无法创建画布上下文');
    this.currentContext = ctx;

    this.currentTexture = new THREE.CanvasTexture(this.currentCanvas);
    this.currentTexture.colorSpace = THREE.SRGBColorSpace;
    this.currentTexture.wrapS = THREE.RepeatWrapping;
    this.currentTexture.wrapT = THREE.RepeatWrapping;

    this.clearCanvas('#1a1a1a');
  }

  setBaseColors(base: string, edge: string, inner: string): void {
    const ctx = this.currentContext;
    const w = this.width;
    const h = this.height;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    // edge glow stripes
    ctx.strokeStyle = edge;
    ctx.lineWidth = 20;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    // center dashed lane
    ctx.strokeStyle = inner;
    ctx.lineWidth = 8;
    ctx.setLineDash([h * 0.06, h * 0.06]);
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
    ctx.setLineDash([]);
    this.currentImage = null;
    this.currentTexture.needsUpdate = true;
  }

  setSceneImages(images: SceneImage[]): void {
    this.sceneImages = images;
    this.currentSceneIndex = 0;
    this.currentImage = null;
    this.targetImage = null;
    this.fadeProgress = 0;
    this.isFading = false;
    this.clearCanvas('#1a1a1a');
    this.preloadImages();
  }

  private async preloadImages(): Promise<void> {
    const promises = this.sceneImages.map(scene => {
      return new Promise<void>((resolve, reject) => {
        if (this.preloadedImages.has(scene.image)) {
          resolve();
          return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          this.preloadedImages.set(scene.image, img);
          resolve();
        };
        img.onerror = () => {
          console.warn(`无法加载图片: ${scene.image}`);
          reject();
        };
        img.src = scene.image;
      });
    });

    try {
      await Promise.all(promises);
      console.log(`✓ 预加载了 ${this.preloadedImages.size} 张场景图片`);
    } catch (error) {
      console.warn('部分图片加载失败', error);
    }
  }

  update(gameTime: number, _deltaMs: number): void {
    if (this.currentSceneIndex < this.sceneImages.length) {
      const nextScene = this.sceneImages[this.currentSceneIndex];
      if (gameTime >= nextScene.time) {
        this.transitionToScene(nextScene.image);
        this.currentSceneIndex++;
      }
    }

    if (this.isFading) {
      const elapsed = Date.now() - this.fadeStartTime;
      this.fadeProgress = Math.min(elapsed / this.fadeDuration, 1);

      if (this.fadeProgress >= 1) {
        this.isFading = false;
        this.currentImage = this.targetImage;
        this.targetImage = null;
      }

      this.renderCanvas();
    }
  }

  private transitionToScene(imagePath: string): void {
    const img = this.preloadedImages.get(imagePath);
    if (!img) {
      console.warn(`图片未预加载: ${imagePath}`);
      return;
    }

    this.targetImage = img;
    this.isFading = true;
    this.fadeProgress = 0;
    this.fadeStartTime = Date.now();
  }

  private renderCanvas(): void {
    const ctx = this.currentContext;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    if (this.currentImage) {
      ctx.globalAlpha = 1 - this.fadeProgress;
      this.drawImageCover(ctx, this.currentImage, w, h);
    }

    if (this.targetImage) {
      ctx.globalAlpha = this.fadeProgress;
      this.drawImageCover(ctx, this.targetImage, w, h);
    }

    ctx.globalAlpha = 1;
    this.currentTexture.needsUpdate = true;
  }

  private drawImageCover(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    canvasW: number,
    canvasH: number
  ): void {
    const imgRatio = img.width / img.height;
    const canvasRatio = canvasW / canvasH;

    let drawW, drawH, offsetX, offsetY;

    if (imgRatio > canvasRatio) {
      drawH = canvasH;
      drawW = drawH * imgRatio;
      offsetX = (canvasW - drawW) / 2;
      offsetY = 0;
    } else {
      drawW = canvasW;
      drawH = drawW / imgRatio;
      offsetX = 0;
      offsetY = (canvasH - drawH) / 2;
    }

    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  }

  private clearCanvas(color: string): void {
    this.currentContext.fillStyle = color;
    this.currentContext.fillRect(0, 0, this.width, this.height);
    this.currentTexture.needsUpdate = true;
  }

  getTexture(): THREE.CanvasTexture {
    return this.currentTexture;
  }

  dispose(): void {
    this.currentTexture.dispose();
    this.preloadedImages.clear();
  }
}
