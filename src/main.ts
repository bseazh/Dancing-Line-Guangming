import './styles.css';
import { DancingLineGame } from './game/DancingLineGame';
import { allLevels } from './data/levels';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvas) throw new Error('Missing #game-canvas');

const game = new DancingLineGame(canvas);
let selectedMode: 'auto' | 'game' = 'auto';

// ── Splash Screen ─────────────────────────────────────────────────────────────
const splash = document.createElement('div');
splash.id = 'dl-splash';
splash.innerHTML = `
  <div class="dl-splash-bg"></div>
  <div class="dl-splash-content">
    <h1 class="dl-splash-title">光明舞动线</h1>
    <p class="dl-splash-sub">DANCING LINE · GUANGMING</p>
    <div class="dl-splash-line"></div>
    <p class="dl-splash-tap">点击任意位置开始</p>
  </div>
`;
document.body.appendChild(splash);

splash.addEventListener('click', () => {
  splash.classList.add('dl-splash--out');
  setTimeout(() => { splash.style.display = 'none'; }, 600);
}, { once: true });

// ── Level Select Menu ─────────────────────────────────────────────────────────
const menu = document.createElement('div');
menu.id = 'dl-menu';
menu.style.display = 'none';
menu.innerHTML = `
  <div class="dl-menu-bg"></div>
  <div class="dl-menu-inner">
    <div class="dl-logo">
      <div class="dl-logo-icon"></div>
      <h1 class="dl-title">光明舞动线</h1>
      <p class="dl-subtitle">Dancing Line · 文旅宣传版 3D</p>
    </div>
    <div class="dl-mode" id="dl-mode">
      <button class="dl-mode-btn" data-mode="game">游戏挑战</button>
      <button class="dl-mode-btn" data-mode="auto">自动演示</button>
    </div>
    <div class="dl-levels" id="dl-levels"></div>
    <p class="dl-hint" id="dl-hint">自动演示：跟随音乐自动转弯，欣赏即可</p>
  </div>
`;
document.body.appendChild(menu);

// show menu after splash
splash.addEventListener('click', () => {
  setTimeout(() => {
    menu.style.display = 'flex';
    menu.style.opacity = '0';
    requestAnimationFrame(() => {
      menu.style.transition = 'opacity 0.5s ease';
      menu.style.opacity = '1';
    });
  }, 300);
}, { once: true });

// mode toggle
const modeBox = menu.querySelector<HTMLDivElement>('#dl-mode')!;
const hintEl = menu.querySelector<HTMLParagraphElement>('#dl-hint')!;
const modeBtns = Array.from(modeBox.querySelectorAll<HTMLButtonElement>('.dl-mode-btn'));
const syncMode = () => {
  modeBtns.forEach((b) => b.classList.toggle('dl-mode-btn--on', b.dataset.mode === selectedMode));
  hintEl.textContent = selectedMode === 'game'
    ? '游戏挑战：点击 / 空格转弯，时机错了会出界'
    : '自动演示：跟随音乐自动转弯，欣赏即可';
};
modeBtns.forEach((b) => b.addEventListener('click', () => {
  selectedMode = (b.dataset.mode as 'auto' | 'game');
  syncMode();
}));
syncMode();

// level cards with cover art
const levelGrid = menu.querySelector<HTMLDivElement>('#dl-levels')!;
allLevels.forEach((level) => {
  const card = document.createElement('button');
  card.className = 'dl-level-card';
  card.innerHTML = `
    <div class="dl-card-cover" style="background-image:url('${level.coverImage}')"></div>
    <div class="dl-card-info">
      <span class="dl-card-title">${level.title}</span>
      <span class="dl-card-meta">${level.version} · ${level.artist}</span>
    </div>
    <div class="dl-card-dot" style="background:${level.lineColor};box-shadow:0 0 10px ${level.lineColor}aa"></div>
    <span class="dl-card-arrow">▶</span>
  `;
  card.addEventListener('click', async () => {
    menu.classList.add('dl-menu--out');
    await game.loadLevel(level, selectedMode);
    game.start();
    hud.style.display = 'flex';
    hudName.textContent = level.title;
    hudHint.textContent = selectedMode === 'game' ? '点击 / 空格 转弯' : '自动演示中';
    setTimeout(() => { menu.style.display = 'none'; }, 400);
  });
  levelGrid.appendChild(card);
});

// ── In-game HUD ───────────────────────────────────────────────────────────────
const hud = document.createElement('div');
hud.id = 'dl-hud';
hud.style.display = 'none';
hud.innerHTML = `
  <div id="dl-hud-left">
    <button id="dl-back-btn" title="返回菜单">←</button>
    <div id="dl-hud-name"></div>
  </div>
  <div id="dl-hud-hint">点击 / 空格 转弯</div>
`;
document.body.appendChild(hud);
const hudName = hud.querySelector<HTMLDivElement>('#dl-hud-name')!;
const hudHint = hud.querySelector<HTMLDivElement>('#dl-hud-hint')!;

hud.querySelector('#dl-back-btn')!.addEventListener('click', () => {
  game.returnToMenu();
  hud.style.display = 'none';
  menu.style.display = 'flex';
  menu.classList.remove('dl-menu--out');
  menu.style.opacity = '1';
  menu.style.transform = '';
});

// ── Back to menu (from game event) ───────────────────────────────────────────
window.addEventListener('dl-back', () => {
  game.returnToMenu();
  hud.style.display = 'none';
  menu.style.display = 'flex';
  menu.classList.remove('dl-menu--out');
  menu.style.opacity = '1';
  menu.style.transform = '';
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose());
}
