export class MusicSystem {
  private audio: HTMLAudioElement | null = null;
  private startTime = 0;
  private pauseTime = 0;
  private isPlaying = false;

  constructor(private delayMs: number = 0) {}

  async load(url: string): Promise<void> {
    this.audio = new Audio(url);
    this.audio.preload = 'auto';

    return new Promise((resolve, reject) => {
      if (!this.audio) return reject();
      this.audio.oncanplaythrough = () => resolve();
      this.audio.onerror = () => reject();
    });
  }

  play(): void {
    if (this.audio) {
      this.audio.currentTime = 0;
      this.audio.play().catch(() => {});
    }
    this.startTime = Date.now() - this.delayMs;
    this.isPlaying = true;
  }

  pause(): void {
    this.pauseTime = this.getGameTime();
    if (this.audio) this.audio.pause();
    this.isPlaying = false;
  }

  resume(): void {
    this.startTime = Date.now() - this.pauseTime - this.delayMs;
    if (this.audio) this.audio.play().catch(() => {});
    this.isPlaying = true;
  }

  getGameTime(): number {
    if (!this.isPlaying) return this.pauseTime;
    if (this.audio) return this.audio.currentTime * 1000;
    return Date.now() - this.startTime;
  }

  isEnded(): boolean {
    return !!this.audio && this.audio.ended;
  }

  setVolume(volume: number): void {
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(1, volume));
    }
  }

  dispose(): void {
    this.isPlaying = false;
    this.pauseTime = 0;
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
  }
}
