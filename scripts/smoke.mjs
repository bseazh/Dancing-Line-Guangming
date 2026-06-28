import { io } from 'socket.io-client';

const BASE_URL = process.env.SMOKE_URL || 'http://127.0.0.1:3000';
const smokeUrl = new URL(BASE_URL);
const socketPath = `${smokeUrl.pathname.replace(/\/$/, '')}/socket.io`;
const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms));

function connect() {
  return new Promise((resolve, reject) => {
    const socket = io(smokeUrl.origin, {
      path: socketPath,
      transports: ['websocket'],
      forceNew: true,
      timeout: 5000,
    });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

function emitAck(socket, event, payload) {
  return Promise.race([
    new Promise((resolve) => socket.emit(event, payload, resolve)),
    timeout(5000),
  ]);
}

function waitState(socket, predicate) {
  return Promise.race([
    new Promise((resolve) => socket.on('state', (state) => predicate(state) && resolve(state))),
    timeout(5000),
  ]);
}

const a = await connect();
const b = await connect();

try {
  const joinedA = await emitAck(a, 'join-room', { name: 'A' });
  if (!joinedA.ok || !joinedA.code) throw new Error('host join failed');

  const joinedB = await emitAck(b, 'join-room', { name: 'B', code: joinedA.code });
  if (!joinedB.ok) throw new Error('guest join failed');

  a.emit('start-game');
  a.emit('player-input', { x: 12, y: 34, turn: true });

  const state = await waitState(b, (s) => s.phase === 'PLAYING' && s.players.length === 2);
  console.log(JSON.stringify({ ok: true, room: state.code, phase: state.phase, players: state.players.length }));
} finally {
  a.close();
  b.close();
}
