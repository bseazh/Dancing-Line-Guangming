const BASE_URL = process.env.SMOKE_URL || 'http://127.0.0.1:3000';
const FULL_SOCKET_SMOKE = process.env.SMOKE_SOCKET === '1';
const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 8000);

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`timeout ${ms}ms`)), ms);
  timer.unref?.();
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

function healthUrl(base) {
  const url = new URL(base);
  if (url.pathname === '/' || !url.pathname) return new URL('/health', url.origin);
  if (url.pathname.endsWith('/health')) return url;
  return new URL('/health', url.origin);
}

async function checkHealth() {
  const url = healthUrl(BASE_URL);
  const timeout = withTimeout(REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: timeout.signal });
    const text = await response.text();
    if (!response.ok) throw new Error(`health ${response.status}: ${text.slice(0, 120)}`);
    const body = JSON.parse(text);
    if (!body.ok) throw new Error(`health body not ok: ${text.slice(0, 120)}`);
    return { url: url.href, body };
  } finally {
    timeout.cancel();
  }
}

function raceTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms);
      timer.unref?.();
    }),
  ]).finally(() => clearTimeout(timer));
}

async function checkSocket() {
  const { io } = await import('socket.io-client');
  const smokeUrl = new URL(BASE_URL);
  const socketPath = `${smokeUrl.pathname.replace(/\/$/, '')}/socket.io`;

  function connect() {
    return raceTimeout(new Promise((resolve, reject) => {
      const socket = io(smokeUrl.origin, {
        path: socketPath,
        transports: ['websocket', 'polling'],
        forceNew: true,
        reconnection: false,
        timeout: 3000,
      });
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    }), 4000, 'socket connect');
  }

  const a = await connect();
  const b = await connect();
  try {
    const emitAck = (socket, event, payload) => raceTimeout(
      new Promise((resolve) => socket.emit(event, payload, resolve)),
      4000,
      event,
    );

    const joinedA = await emitAck(a, 'join-room', { name: 'A' });
    if (!joinedA.ok || !joinedA.code) throw new Error('host join failed');

    const joinedB = await emitAck(b, 'join-room', { name: 'B', code: joinedA.code });
    if (!joinedB.ok) throw new Error('guest join failed');

    return { room: joinedA.code };
  } finally {
    a.close();
    b.close();
  }
}

const health = await checkHealth();
const result = {
  ok: true,
  health: health.body.service || health.url,
};

if (FULL_SOCKET_SMOKE) {
  result.socket = await checkSocket();
}

console.log(JSON.stringify(result));
