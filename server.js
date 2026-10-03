import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';
import { generateQuestion } from './public/js/questions.js';

const TEACHER_USER = process.env.TEACHER_USER || 'marcos';
const TEACHER_PASS = process.env.TEACHER_PASS || '16477709d';
const PORT = process.env.PORT || 3000;
const READY_MS = 3000; // tempo de "prepare-se" antes das respostas liberarem

const app = express();
const http = createServer(app);
const io = new Server(http, { pingInterval: 10000, pingTimeout: 20000 });
const ROOT = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(ROOT, 'public')));
app.use('/vendor', express.static(path.join(ROOT, 'node_modules/three/build'), { maxAge: '7d' }));
app.get('/health', (_, res) => res.send('ok'));

const hostTokens = new Set();
const rooms = new Map(); // pin -> room

const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
const newPin = () => { let p; do p = String(Math.floor(100000 + Math.random() * 900000)); while (rooms.has(p)); return p; };
const cleanName = (n) => String(n || '').replace(/[<>]/g, '').trim().slice(0, 16) || 'Jogador';
const cleanAvatar = (a = {}) => ({ body: clamp(a.body, 0, 11) | 0, skin: clamp(a.skin, 0, 5) | 0, hat: clamp(a.hat, 0, 8) | 0, eyes: clamp(a.eyes, 0, 3) | 0, acc: clamp(a.acc, 0, 4) | 0 });
const pubPlayer = (p) => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score, streak: p.streak, connected: p.connected, x: p.x, z: p.z });
const ranking = (room) => [...room.players.values()].sort((a, b) => b.score - a.score).map(pubPlayer);
const emitPlayers = (room) => io.to(room.pin).emit('room:players', [...room.players.values()].map(pubPlayer));

function hostRoom(socket) { const r = rooms.get(socket.data.pin); return r && r.hostSocket === socket.id ? r : null; }

function sendQuestion(room) {
  clearTimeout(room.timer);
  const seen = room.seen; let q, tries = 0;
  do q = generateQuestion(room.settings); while (seen.has(q.q) && tries++ < 30);
  seen.add(q.q);
  room.qIndex++;
  room.current = { ...q, double: room.qIndex > 1 && Math.random() < 0.15, startAt: Date.now() + READY_MS };
  room.answers = new Map();
  room.state = 'question';
  room.log.push({ q: q.q, op: q.op, answer: q.choices[q.correct], right: 0, total: 0 });
  io.to(room.pin).emit('game:question', questionPayload(room));
  room.timer = setTimeout(() => reveal(room), READY_MS + room.settings.time * 1000 + 300);
}
const questionPayload = (room) => {
  const c = room.current;
  return { index: room.qIndex, total: room.settings.count, q: c.q, choices: c.choices, op: c.op, small: !!c.small, double: c.double, time: room.settings.time, ready: Math.max(0, c.startAt - Date.now()), left: Math.max(0, c.startAt + room.settings.time * 1000 - Date.now()) };
};

function reveal(room) {
  if (room.state !== 'question') return;
  clearTimeout(room.timer);
  room.state = 'reveal';
  const c = room.current, log = room.log[room.log.length - 1], results = {};
  for (const p of room.players.values()) {
    const a = room.answers.get(p.id);
    const ok = !!a && a.choice === c.correct;
    let gained = 0;
    if (ok) {
      p.streak++;
      gained = Math.round(1000 - 500 * Math.min(1, a.ms / (room.settings.time * 1000)));
      gained += Math.min(p.streak - 1, 5) * 100;
      if (c.double) gained *= 2;
    } else p.streak = 0;
    p.score += gained;
    if (a || p.connected) {
      p.stats[c.op] = p.stats[c.op] || [0, 0]; p.stats[c.op][1]++; if (ok) p.stats[c.op][0]++;
      p.total++; if (ok) p.correct++;
      log.total++; if (ok) log.right++;
    }
    results[p.id] = { choice: a ? a.choice : -1, ok, gained, score: p.score, streak: p.streak };
  }
  const counts = [0, 0, 0, 0]; for (const a of room.answers.values()) counts[a.choice]++;
  io.to(room.pin).emit('game:reveal', { correct: c.correct, expl: c.expl, results, counts, ranking: ranking(room).slice(0, 5), last: room.qIndex >= room.settings.count });
  if (room.settings.auto) room.timer = setTimeout(() => next(room), 9000);
}

function next(room) {
  clearTimeout(room.timer);
  if (room.qIndex >= room.settings.count) return endGame(room);
  sendQuestion(room);
}

function endGame(room) {
  clearTimeout(room.timer);
  room.state = 'end';
  const rank = ranking(room);
  io.to(room.pin).emit('game:end', { ranking: rank });
  const report = {
    players: [...room.players.values()].sort((a, b) => b.score - a.score).map((p) => ({ name: p.name, score: p.score, correct: p.correct, total: p.total, stats: p.stats })),
    questions: room.log,
  };
  if (room.hostSocket) io.to(room.hostSocket).emit('host:report', report);
}

io.on('connection', (socket) => {
  // ---------- PROFESSOR ----------
  socket.on('host:login', ({ user, pass } = {}, cb) => {
    if (String(user).trim().toLowerCase() !== TEACHER_USER || pass !== TEACHER_PASS) return cb?.({ ok: false });
    const token = randomBytes(16).toString('hex'); hostTokens.add(token); cb?.({ ok: true, token });
  });

  socket.on('host:create', ({ token, settings = {} } = {}, cb) => {
    if (!hostTokens.has(token)) return cb?.({ ok: false, error: 'Faça login novamente.' });
    const ops = (settings.ops || []).filter((o) => ['add', 'sub', 'mul', 'div'].includes(o));
    const pin = newPin();
    const room = {
      pin, token, hostSocket: socket.id, players: new Map(), state: 'lobby', qIndex: 0, seen: new Set(), log: [], timer: null, last: Date.now(),
      settings: { count: clamp(settings.count, 3, 60) | 0, time: clamp(settings.time, 8, 90) | 0, difficulty: ['1', '2', '3', 'mix'].includes(String(settings.difficulty)) ? String(settings.difficulty) : 'mix', ops: ops.length ? ops : ['add', 'sub', 'mul', 'div'], auto: !!settings.auto },
    };
    rooms.set(pin, room); socket.join(pin); socket.data.pin = pin;
    cb?.({ ok: true, pin, settings: room.settings });
  });

  socket.on('host:rejoin', ({ token, pin } = {}, cb) => {
    const room = rooms.get(pin);
    if (!room || room.token !== token) return cb?.({ ok: false });
    room.hostSocket = socket.id; socket.join(pin); socket.data.pin = pin;
    cb?.({ ok: true, state: room.state, settings: room.settings, players: [...room.players.values()].map(pubPlayer), question: room.state === 'question' ? questionPayload(room) : null });
  });

  socket.on('host:start', () => { const r = hostRoom(socket); if (r && r.state === 'lobby' && r.players.size) { r.state = 'starting'; io.to(r.pin).emit('game:starting'); r.timer = setTimeout(() => sendQuestion(r), 3500); } });
  socket.on('host:next', () => { const r = hostRoom(socket); if (r && r.state === 'reveal') next(r); });
  socket.on('host:skip', () => { const r = hostRoom(socket); if (r && r.state === 'question') reveal(r); });
  socket.on('host:end', () => { const r = hostRoom(socket); if (r && r.state !== 'end') endGame(r); });
  socket.on('host:kick', (pid) => {
    const r = hostRoom(socket); const p = r?.players.get(pid); if (!p) return;
    io.to(p.socketId).emit('kicked'); io.sockets.sockets.get(p.socketId)?.leave(r.pin);
    r.players.delete(pid); emitPlayers(r);
  });
  socket.on('host:again', () => {
    const r = hostRoom(socket); if (!r) return;
    clearTimeout(r.timer); Object.assign(r, { state: 'lobby', qIndex: 0, log: [], seen: new Set() });
    for (const p of r.players.values()) Object.assign(p, { score: 0, streak: 0, correct: 0, total: 0, stats: {} });
    io.to(r.pin).emit('game:lobby'); emitPlayers(r);
  });

  // ---------- ALUNO ----------
  socket.on('player:join', ({ pin, name, avatar, pid } = {}, cb) => {
    const room = rooms.get(String(pin || '').trim());
    if (!room) return cb?.({ ok: false, error: 'Sala não encontrada. Confira o PIN!' });
    let p = pid && room.players.get(pid);
    if (!p) {
      if (room.players.size >= 60) return cb?.({ ok: false, error: 'Sala cheia!' });
      name = cleanName(name);
      if ([...room.players.values()].some((o) => o.name.toLowerCase() === name.toLowerCase())) return cb?.({ ok: false, error: 'Esse nome já está na sala. Escolha outro!' });
      p = { id: randomBytes(8).toString('hex'), name, score: 0, streak: 0, correct: 0, total: 0, stats: {}, x: (Math.random() - 0.5) * 6, z: (Math.random() - 0.5) * 6 };
      room.players.set(p.id, p);
    }
    p.avatar = cleanAvatar(avatar); p.socketId = socket.id; p.connected = true;
    socket.join(room.pin); socket.data.pin = room.pin; socket.data.pid = p.id;
    room.last = Date.now();
    const st = { ok: true, pid: p.id, pin: room.pin, state: room.state, players: [...room.players.values()].map(pubPlayer), me: pubPlayer(p) };
    if (room.state === 'question') st.question = { ...questionPayload(room), answered: room.answers.has(p.id) };
    cb?.(st);
    emitPlayers(room);
  });

  socket.on('player:answer', (choice) => {
    const room = rooms.get(socket.data.pin), pid = socket.data.pid;
    if (!room || room.state !== 'question' || !pid || room.answers.has(pid)) return;
    const now = Date.now(); if (now < room.current.startAt) return;
    choice = choice | 0; if (choice < 0 || choice > 3) return;
    room.answers.set(pid, { choice, ms: now - room.current.startAt });
    socket.emit('player:answered');
    const online = [...room.players.values()].filter((p) => p.connected).length;
    io.to(room.pin).emit('game:answerCount', { n: room.answers.size, total: online });
    if (room.answers.size >= online) setTimeout(() => reveal(room), 400);
  });

  socket.on('player:move', ({ x, z } = {}) => {
    const room = rooms.get(socket.data.pin), p = room?.players.get(socket.data.pid);
    if (!p) return;
    const d = Math.hypot(x, z) || 1, m = Math.min(1, 9 / d);
    p.x = clamp(x * m, -9, 9); p.z = clamp(z * m, -9, 9);
    socket.to(room.pin).emit('player:moved', { id: p.id, x: p.x, z: p.z });
  });

  socket.on('emote', (e) => {
    const room = rooms.get(socket.data.pin), pid = socket.data.pid;
    if (!room || !pid) return;
    const now = Date.now(); if (now - (socket.data.lastEmote || 0) < 700) return;
    socket.data.lastEmote = now;
    io.to(room.pin).emit('emote', { id: pid, e: clamp(e, 0, 7) | 0 });
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.pin); if (!room) return;
    if (room.hostSocket === socket.id) { room.hostSocket = null; room.last = Date.now(); return; }
    const p = room.players.get(socket.data.pid);
    if (!p || p.socketId !== socket.id) return;
    if (room.state === 'lobby') room.players.delete(p.id); else p.connected = false;
    emitPlayers(room);
    if (room.state === 'question') {
      const online = [...room.players.values()].filter((x) => x.connected).length;
      if (online && room.answers.size >= online) reveal(room);
    }
  });
});

// limpeza de salas abandonadas
setInterval(() => {
  const now = Date.now();
  for (const [pin, r] of rooms) {
    const active = r.hostSocket || [...r.players.values()].some((p) => p.connected);
    if (!active && now - r.last > 15 * 60 * 1000) { clearTimeout(r.timer); rooms.delete(pin); }
    if (active) r.last = now;
  }
}, 60 * 1000);

http.listen(PORT, () => console.log(`🎮 Ultimate Math rodando em http://localhost:${PORT}`));
