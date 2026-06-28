import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const ROOM_SIZE = Number(process.env.ROOM_SIZE || 8);
const STATIC_DIR = fs.existsSync(path.join(__dirname, 'dist', 'index.html'))
  ? path.join(__dirname, 'dist')
  : path.join(__dirname, 'public');

const rooms = new Map();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  httpCompression: true,
  maxHttpBufferSize: 64 * 1024,
  perMessageDeflate: {
    threshold: 256,
    zlibDeflateOptions: { level: 4 },
    zlibInflateOptions: { chunkSize: 10 * 1024 },
  },
});

app.use(express.static(STATIC_DIR));
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'dancing-line-guangming',
    rooms: rooms.size,
    staticDir: path.basename(STATIC_DIR),
    uptime: process.uptime(),
    time: new Date().toISOString(),
  });
});

app.get('*', (_req, res, next) => {
  const indexPath = path.join(STATIC_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) return next();
  res.sendFile(indexPath);
});

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function getOrCreateRoom(hostId, requestedCode) {
  const code = requestedCode
    ? String(requestedCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
    : makeCode();
  if (!rooms.has(code)) {
    rooms.set(code, {
      code,
      hostId,
      phase: 'LOBBY',
      players: {},
      messages: [],
      createdAt: Date.now(),
    });
  }
  return rooms.get(code);
}

function publicState(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    players: Object.values(room.players),
    messages: room.messages.slice(-20),
    serverNow: Date.now(),
  };
}

function broadcast(room, volatile = false) {
  const target = io.to(room.code);
  (volatile ? target.volatile : target).emit('state', publicState(room));
}

function normalizeInput(input = {}) {
  if (typeof input === 'number') return { m: input };
  const mask = Number(input.m || 0);
  if (mask) return { m: mask, x: Number(input.x || 0), y: Number(input.y || 0) };
  return { x: Number(input.x || 0), y: Number(input.y || 0), turn: !!input.turn };
}

function addPlayer(room, socket, name) {
  if (Object.keys(room.players).length >= ROOM_SIZE) throw new Error('ROOM_FULL');
  room.players[socket.id] = {
    id: socket.id,
    name: String(name || 'Player').slice(0, 16),
    ready: false,
    x: 0,
    y: 0,
    input: {},
  };
}

io.on('connection', (socket) => {
  socket.on('join-room', ({ code, name, solo } = {}, ack) => {
    try {
      const room = getOrCreateRoom(socket.id, solo ? `SOLO${socket.id.slice(0, 4)}` : code);
      socket.join(room.code);
      socket.data.roomCode = room.code;
      addPlayer(room, socket, name);
      if (solo) room.phase = 'PLAYING';
      broadcast(room);
      ack?.({ ok: true, code: room.code, playerId: socket.id });
    } catch (error) {
      ack?.({ ok: false, error: error.message });
    }
  });

  socket.on('set-ready', (ready = true) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players?.[socket.id];
    if (!room || !player) return;
    player.ready = !!ready;
    broadcast(room);
  });

  socket.on('start-game', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id) return;
    room.phase = 'PLAYING';
    room.startedAt = Date.now();
    broadcast(room);
  });

  socket.on('player-input', (input = {}) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players?.[socket.id];
    if (!player) return;
    const next = normalizeInput(input);
    player.input = next;
    if (Number.isFinite(next.x)) player.x = next.x;
    if (Number.isFinite(next.y)) player.y = next.y;
    broadcast(room, true);
  });

  socket.on('room-message', (text = '') => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players?.[socket.id];
    if (!room || !player) return;
    room.messages.push({ name: player.name, text: String(text).slice(0, 80), time: Date.now() });
    broadcast(room);
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    delete room.players[socket.id];
    if (room.hostId === socket.id) room.hostId = Object.keys(room.players)[0] || null;
    if (!Object.keys(room.players).length) rooms.delete(room.code);
    else broadcast(room);
  });
});

server.listen(PORT, () => {
  console.log(`Dancing Line Guangming server on :${PORT}`);
  console.log(`Serving static files from ${STATIC_DIR}`);
});
