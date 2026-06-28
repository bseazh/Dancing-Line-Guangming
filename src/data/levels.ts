import type { LevelData } from '../types/LevelData';
import { extendHitTimes } from '../utils/beatMap';

/**
 * 红桥穿林 - 虹桥公园主线
 * 从原项目完整提取的关卡数据
 */
export const hongqiaoForestLevel: LevelData = {
  id: 'hongqiao-forest',
  title: '红桥穿林',
  artist: 'Guangming Tour',
  version: '虹桥公园主线',
  coverImage: '/assets/tour/covers/hongqiao.png',

  sceneImages: [
    { time: 0, image: '/assets/tour/scenes/hongqiao-aerial.png' },
    { time: 7000, image: '/assets/tour/scenes/hongqiao-bridge-mid.png' },
    { time: 17600, image: '/assets/tour/scenes/nature-education-center.png' }
  ],

  lineColor: '#ff4d5f',

  background: {
    top: '#1f725f',
    bottom: '#0b3140',
    accent: 'rgba(255,77,95,0.16)',
    ground: '#235f42'
  },

  track: {
    base: 'rgba(72,29,38,0.96)',
    dark: 'rgba(24,13,20,0.86)',
    inner: 'rgba(255,77,95,0.20)',
    edge: 'rgba(255,106,118,0.88)',
    glow: 'rgba(255,77,95,0.24)'
  },

  routeDirection: 'down',
  musicFile: '/assets/tour/music/hongqiao-forest.mp3',

  music: {
    bpm: 109.12,
    title: 'Red Bridge Through Forest',
    style: 'light instrumental, fresh electronic pop',
    root: 196,
    scale: [0, 2, 4, 7, 9, 12, 9, 7]
  },

  // 转弯时间点 - 从TOUR_ROUTES.hongqiao提取
  hitTimes: [
    4445, 4995, 5545, 6095, 7740, 8290, 8840, 9390, 9940, 10490, 12135, 12685,
    13235, 13785, 15430, 15980, 16530, 17080, 18725, 19275, 19825, 20375, 22020,
    22570, 23120, 23670, 24220, 25865, 26415, 26965, 27515, 29160, 29710, 30260,
    30810, 31360, 32455, 33000, 33550, 34100, 36295
  ],

  // 触发时机：总时长87920ms 每10%一张（8800ms间隔）
  landmarks: [
    { time:  8800, label: '入口栈桥',  side: -1, color: '#ff6b76', image: '/landmarks/hongqiao/bridge-wide.png' },
    { time: 17600, label: '红色虹桥',  side:  1, color: '#ff4d5f', image: '/landmarks/hongqiao/bridge-forest.png' },
    { time: 26400, label: '桥上观塔',  side: -1, color: '#ff8c42', image: '/landmarks/hongqiao/bridge-tower.png' },
    { time: 35200, label: '桥头第一视角', side: 1, color: '#ffcf5c', image: '/landmarks/hongqiao/bridge-firstperson.png' },
    { time: 44000, label: '日落栈道',  side: -1, color: '#ff9f43', image: '/landmarks/hongqiao/bridge-sunset.png' },
    { time: 52800, label: '月在庭·湖景', side: 1, color: '#57d7ff', image: '/landmarks/hongqiao/moon-lake.png' },
    { time: 61600, label: '月在庭·航拍', side: -1, color: '#5ac8fa', image: '/landmarks/hongqiao/moon-aerial.png' },
    { time: 70400, label: '月在庭·庭院', side: 1, color: '#a8e6cf', image: '/landmarks/hongqiao/moon-garden.png' },
    { time: 79200, label: '日熹阁·黄昏', side: -1, color: '#ffd460', image: '/landmarks/hongqiao/sunshine-loft.png' },
    { time: 87000, label: '森林全景',  side:  1, color: '#79ff9b', image: '/landmarks/hongqiao/bridge-panorama.png' },
  ],

  cameraEvents: [
    { time: 0, zoom: 0.98, rotate: 0, transition: 0 },
    { time: 4200, zoom: 1.18, rotate: -0.42, transition: 420 },
    { time: 9000, zoom: 0.78, rotate: 0.68, transition: 580 },
    { time: 13700, zoom: 1.25, rotate: 0.95, transition: 420 },
    { time: 20800, zoom: 0.86, rotate: -0.72, transition: 620 },
    { time: 28600, zoom: 1.12, rotate: 0.15, transition: 700 }
  ],

  mapEvents: [
    { time: 900, type: 'title', text: '红桥穿林' },
    { time: 7100, type: 'caption', text: '红色栈桥点亮' },
    { time: 21600, type: 'flash', color: 'rgba(87,215,255,0.30)' },
    { time: 22040, type: 'caption', text: '湖面飞跃' },
    { time: 30000, type: 'background', top: '#246648', bottom: '#102c36', accent: 'rgba(121,255,155,0.13)' },
    { time: 42100, type: 'caption', text: '森林出口' }
  ]
};

/**
 * 科学飞船 - 深圳科学技术馆
 */
export const scienceStarshipLevel: LevelData = {
  id: 'science-starship',
  title: '科学飞船',
  artist: 'Guangming Tour',
  version: '深圳科学技术馆',
  coverImage: '/assets/tour/covers/science.jpg',

  sceneImages: [
    { time: 0, image: '/assets/tour/scenes/science-museum-wide.png' },
    { time: 6400, image: '/assets/tour/scenes/science-museum-plaza.png' },
    { time: 16600, image: '/assets/tour/scenes/science-museum-wide.png' }
  ],

  lineColor: '#5af5ff',

  background: {
    top: '#183d72',
    bottom: '#071325',
    accent: 'rgba(90,245,255,0.16)',
    ground: '#16304a'
  },

  track: {
    base: 'rgba(22,48,68,0.98)',
    dark: 'rgba(7,14,26,0.90)',
    inner: 'rgba(90,245,255,0.18)',
    edge: 'rgba(150,250,255,0.92)',
    glow: 'rgba(90,245,255,0.26)'
  },

  routeDirection: 'down',
  musicFile: '/assets/tour/music/science-starship.mp3',

  music: {
    bpm: 116.93,
    title: 'Science Starship',
    style: 'light instrumental, soft synthwave',
    root: 220,
    scale: [0, 3, 5, 7, 10, 12, 10, 7]
  },

  hitTimes: [
    4314, 4828, 5343, 5857, 6372, 7914, 8428, 8943, 9457, 11514, 12029, 12543,
    13058, 15115, 15629, 16144, 16658, 17173, 18715, 19229, 19744, 20258, 21800,
    22314, 23857, 24371, 24886, 25400, 25915, 27457, 27971, 28486, 29000, 30543,
    31057, 31571, 33114, 33628, 35171
  ],

  // 触发时机：总时长138240ms 每10%一张（13820ms间隔）
  landmarks: [
    { time: 13800,  label: '科技馆全景', side: -1, color: '#5af5ff', image: '/landmarks/science/museum-aerial.png' },
    { time: 27600,  label: '鸟瞰全区',   side:  1, color: '#a9f7ff', image: '/landmarks/science/museum-aerial2.png' },
    { time: 41400,  label: '石材层叠',   side: -1, color: '#57b6ff', image: '/landmarks/science/museum-side-bands.png' },
    { time: 55200,  label: '有机石壳',   side:  1, color: '#7ec8e3', image: '/landmarks/science/museum-closeup.png' },
    { time: 69000,  label: '仰视星舰',   side: -1, color: '#c5a3ff', image: '/landmarks/science/museum-worms-eye.png' },
    { time: 82800,  label: '双馆对比',   side:  1, color: '#d7b0ff', image: '/landmarks/science/museum-two-buildings.png' },
    { time: 96600,  label: '日景展厅',   side: -1, color: '#a9f7ff', image: '/landmarks/science/museum-daylight.png' },
    { time: 110400, label: '黄昏光幕',   side:  1, color: '#ffb347', image: '/landmarks/science/museum-dusk-glow.png' },
    { time: 124200, label: '星舰展厅',   side: -1, color: '#ffd700', image: '/landmarks/science/museum-dusk-wide.png' },
    { time: 137000, label: '叠层梯台',   side:  1, color: '#5af5ff', image: '/landmarks/science/museum-terraces.jpg' },
  ],

  cameraEvents: [
    { time: 0, zoom: 1.06, rotate: 0, transition: 0 },
    { time: 3800, zoom: 1.32, rotate: 0.58, transition: 360 },
    { time: 8200, zoom: 0.76, rotate: -0.92, transition: 520 },
    { time: 11600, zoom: 1.42, rotate: 1.18, transition: 360 },
    { time: 18500, zoom: 0.88, rotate: -1.05, transition: 560 },
    { time: 25800, zoom: 1.2, rotate: 0.4, transition: 650 }
  ],

  mapEvents: [
    { time: 900, type: 'title', text: '科学飞船' },
    { time: 6100, type: 'caption', text: '星舰外壳展开' },
    { time: 12140, type: 'flash', color: 'rgba(90,245,255,0.34)' },
    { time: 12520, type: 'caption', text: '数据跃迁' },
    { time: 26000, type: 'background', top: '#222662', bottom: '#070f24', accent: 'rgba(215,176,255,0.16)' },
    { time: 38000, type: 'caption', text: '点亮数字星图' }
  ]
};

/**
 * 所有可用关卡 —— hitTimes 按 BPM 续写到整首歌长度（原手工转弯点保留在前段）
 */
hongqiaoForestLevel.hitTimes = extendHitTimes(hongqiaoForestLevel.hitTimes, { bpm: 109.12, durationMs: 87920 });
scienceStarshipLevel.hitTimes = extendHitTimes(scienceStarshipLevel.hitTimes, { bpm: 116.93, durationMs: 138240 });

export const allLevels: LevelData[] = [
  hongqiaoForestLevel,
  scienceStarshipLevel
];
