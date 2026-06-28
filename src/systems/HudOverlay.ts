import type { MapEvent } from '../types/LevelData';

/**
 * DOM overlay for in-game feedback: a top progress bar (0→100%) plus cutscene
 * effects (title cards, captions, color flashes, background shifts) fired from
 * the level's mapEvents timeline.
 */
export class HudOverlay {
  private root: HTMLDivElement;
  private barFill: HTMLDivElement;
  private barPct: HTMLDivElement;
  private cutscene: HTMLDivElement;
  private flash: HTMLDivElement;

  private events: MapEvent[] = [];
  private fired = 0;
  private accent = '#ff4d5f';

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'dl-overlay';
    this.root.innerHTML = `
      <div id="dl-progress"><div id="dl-progress-fill"></div><div id="dl-progress-pct">0%</div></div>
      <div id="dl-cutscene"></div>
      <div id="dl-flash"></div>
    `;
    document.body.appendChild(this.root);
    this.barFill = this.root.querySelector('#dl-progress-fill')!;
    this.barPct = this.root.querySelector('#dl-progress-pct')!;
    this.cutscene = this.root.querySelector('#dl-cutscene')!;
    this.flash = this.root.querySelector('#dl-flash')!;
    this.hide();
  }

  setLevel(events: MapEvent[], accentColor: string): void {
    this.events = [...events].sort((a, b) => a.time - b.time);
    this.fired = 0;
    this.accent = accentColor;
    this.barFill.style.background = accentColor;
    this.barFill.style.width = '0%';
    this.barPct.textContent = '0%';
    this.cutscene.innerHTML = '';
  }

  show(): void { this.root.style.display = 'block'; }
  hide(): void { this.root.style.display = 'none'; }

  /** Called each frame with current music time (ms) and travel progress (0..1). */
  update(gameTime: number, progress: number): void {
    const pct = Math.round(progress * 100);
    this.barFill.style.width = `${pct}%`;
    this.barPct.textContent = `${pct}%`;

    while (this.fired < this.events.length && gameTime >= this.events[this.fired].time) {
      this.fireEvent(this.events[this.fired]);
      this.fired++;
    }
  }

  private fireEvent(e: MapEvent): void {
    switch (e.type) {
      case 'title':
        this.popCard(e.text ?? '', 'dl-cs-title', 2600);
        break;
      case 'caption':
        this.popCard(e.text ?? '', 'dl-cs-caption', 2000);
        break;
      case 'flash':
        this.doFlash(e.color ?? 'rgba(255,255,255,0.3)');
        break;
      case 'background':
        // soft tint sweep using the new top color; the 3D scene keeps its own sky
        if (e.top) this.doFlash(e.accent ?? this.hexToRgba(e.top, 0.22));
        break;
    }
  }

  private popCard(text: string, cls: string, ms: number): void {
    if (!text) return;
    const card = document.createElement('div');
    card.className = `dl-cs-card ${cls}`;
    card.textContent = text;
    card.style.setProperty('--dl-accent', this.accent);
    this.cutscene.appendChild(card);
    requestAnimationFrame(() => card.classList.add('dl-cs-in'));
    setTimeout(() => {
      card.classList.remove('dl-cs-in');
      setTimeout(() => card.remove(), 500);
    }, ms);
  }

  private doFlash(color: string): void {
    this.flash.style.background = color;
    this.flash.style.opacity = '1';
    requestAnimationFrame(() => { this.flash.style.opacity = '0'; });
  }

  private hexToRgba(hex: string, a: number): string {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  dispose(): void {
    this.root.remove();
  }
}
