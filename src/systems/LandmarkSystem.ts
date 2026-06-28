import type { Landmark } from '../types/LevelData';

// HTML overlay landmark — not rendered in 3D, never occluded by trees or props
export class LandmarkSystem {
  private landmarks: Landmark[] = [];
  private currentLandmarkIndex = 0;
  private container: HTMLDivElement;
  private activeCard: HTMLDivElement | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  // preloaded image cache — key: url, value: resolved HTMLImageElement
  private imageCache = new Map<string, HTMLImageElement>();

  private readonly SHOW_DURATION_MS = 11000;
  private readonly FADE_MS = 600;

  constructor(_scene: unknown) {
    this.container = document.createElement('div');
    this.container.id = 'dl-landmarks';
    document.body.appendChild(this.container);
    this.injectStyles();
  }

  private injectStyles(): void {
    if (document.getElementById('dl-landmark-styles')) return;
    const style = document.createElement('style');
    style.id = 'dl-landmark-styles';
    style.textContent = `
      #dl-landmarks {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 55;
      }
      .dl-lm-card {
        position: absolute;
        top: 50%;
        transform: translateY(-50%) translateX(60px) scale(0.93);
        right: 48px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        opacity: 0;
        transition: opacity ${this.FADE_MS}ms ease, transform ${this.FADE_MS}ms ease;
        filter: drop-shadow(0 8px 32px rgba(0,0,0,0.7));
        will-change: opacity, transform;
      }
      .dl-lm-card.dl-lm-card--left {
        right: auto;
        left: 48px;
        transform: translateY(-50%) translateX(-60px) scale(0.93);
      }
      .dl-lm-card.dl-lm-in {
        opacity: 1;
        transform: translateY(-50%) translateX(0) scale(1);
      }
      .dl-lm-card.dl-lm-out {
        opacity: 0;
        transform: translateY(-50%) translateX(60px) scale(0.93);
      }
      .dl-lm-card.dl-lm-card--left.dl-lm-out {
        transform: translateY(-50%) translateX(-60px) scale(0.93);
      }
      .dl-lm-img {
        display: block;
        width: min(340px, 32vw);
        aspect-ratio: 3/4;
        object-fit: cover;
        border-radius: 16px;
        border: 3px solid var(--lm-color, #fff);
        box-shadow:
          0 0 0 1px rgba(255,255,255,0.08),
          0 0 40px var(--lm-glow, rgba(255,255,255,0.3)),
          0 16px 48px rgba(0,0,0,0.6);
        /* fixed size prevents layout jump when image loads */
        background: rgba(0,0,0,0.3);
      }
      .dl-lm-label {
        font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
        font-size: clamp(13px, 1.4vw, 16px);
        font-weight: 700;
        letter-spacing: 0.14em;
        color: #fff;
        background: rgba(0,0,0,0.55);
        border: 1px solid var(--lm-color, rgba(255,255,255,0.4));
        border-radius: 999px;
        padding: 6px 20px;
        backdrop-filter: blur(8px);
        text-shadow: 0 1px 8px rgba(0,0,0,0.8);
        box-shadow: 0 0 12px var(--lm-glow, transparent);
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  setLandmarks(landmarks: Landmark[]): void {
    this.clearActiveCard();
    this.landmarks = landmarks;
    this.currentLandmarkIndex = 0;
    this.preloadImages();
  }

  // Preload all images and store resolved elements in cache
  private preloadImages(): void {
    this.landmarks.forEach(lm => {
      if (this.imageCache.has(lm.image)) return;
      const img = new Image();
      img.onload = () => this.imageCache.set(lm.image, img);
      img.onerror = () => {
        // store anyway so we don't retry forever; display will still work via src
        this.imageCache.set(lm.image, img);
      };
      img.src = lm.image;
    });
  }

  update(gameTime: number, _linePosition: unknown): void {
    if (this.currentLandmarkIndex < this.landmarks.length) {
      const lm = this.landmarks[this.currentLandmarkIndex];
      if (gameTime >= lm.time) {
        this.showLandmark(lm);
        this.currentLandmarkIndex++;
      }
    }
  }

  private showLandmark(lm: Landmark): void {
    // Hard-remove any existing card first (no delay) to avoid layout overlap
    if (this.activeCard) {
      this.activeCard.remove();
      this.activeCard = null;
    }
    if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }

    const card = document.createElement('div');
    card.className = `dl-lm-card${lm.side === -1 ? ' dl-lm-card--left' : ''}`;
    card.style.setProperty('--lm-color', lm.color);
    card.style.setProperty('--lm-glow', lm.color + '66');

    const img = document.createElement('img');
    img.className = 'dl-lm-img';
    img.alt = lm.label;

    const label = document.createElement('div');
    label.className = 'dl-lm-label';
    label.textContent = lm.label;

    card.append(img, label);
    this.container.appendChild(card);
    this.activeCard = card;

    const cached = this.imageCache.get(lm.image);
    if (cached?.complete && cached.naturalWidth > 0) {
      // Image already loaded — set src and animate immediately
      img.src = lm.image;
      requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('dl-lm-in')));
    } else {
      // Wait for image to load before fading in — prevents flash of empty frame
      img.onload = () => {
        if (this.activeCard === card) {
          requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('dl-lm-in')));
        }
      };
      img.src = lm.image;
    }

    this.hideTimer = setTimeout(() => this.dismissCard(), this.SHOW_DURATION_MS);
  }

  private dismissCard(): void {
    if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
    const card = this.activeCard;
    if (!card) return;
    this.activeCard = null;
    card.classList.remove('dl-lm-in');
    card.classList.add('dl-lm-out');
    setTimeout(() => card.remove(), this.FADE_MS + 50);
  }

  private clearActiveCard(): void {
    if (this.activeCard) { this.activeCard.remove(); this.activeCard = null; }
    if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
  }

  dispose(): void {
    this.clearActiveCard();
    this.container.remove();
    this.imageCache.clear();
    this.landmarks = [];
    this.currentLandmarkIndex = 0;
  }
}
