export interface SceneImage {
  time: number;
  image: string;
}

export interface Landmark {
  time: number;
  label: string;
  side: -1 | 1;
  color: string;
  image: string;
}

export interface CameraEvent {
  time: number;
  zoom: number;
  rotate: number;
  transition: number;
}

export interface MapEvent {
  time: number;
  type: 'title' | 'caption' | 'flash' | 'background';
  text?: string;
  color?: string;
  top?: string;
  bottom?: string;
  accent?: string;
}

export interface Background {
  top: string;
  bottom: string;
  accent: string;
  ground?: string;
}

export interface TrackStyle {
  base: string;
  dark: string;
  inner: string;
  edge: string;
  glow: string;
}

export interface Music {
  bpm: number;
  title: string;
  style: string;
  root: number;
  scale: number[];
}

export interface LevelData {
  id: string;
  title: string;
  artist: string;
  version: string;
  coverImage: string;
  sceneImages: SceneImage[];
  lineColor: string;
  background: Background;
  track: TrackStyle;
  routeDirection: 'up' | 'down';
  musicFile: string;
  music: Music;
  hitTimes: number[];
  landmarks: Landmark[];
  cameraEvents: CameraEvent[];
  mapEvents: MapEvent[];
}
